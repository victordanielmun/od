import { useState, useCallback, useRef, useEffect } from "react";
import Navbar from "../components/Navbar";
import WordCard from "../components/WordCard";
import Recorder from "../components/Recorder";
import FeedbackPanel from "../components/FeedbackPanel";
import CategorySelector from "../components/CategorySelector";
import OverlaidWaveform from "../components/OverlaidWaveform";
import Waveform from "../components/Waveform";
import AchievementToast from "../components/AchievementToast";
import { useSpeechRecognition } from "../hooks/useSpeechRecognition";
import { useRecorder } from "../hooks/useRecorder";
import {
    fetchRandomWord,
    analyzePronounciation,
    generateTTS,
    getTTSAudioUrl,
} from "../services/api";
import type { Word, AnalysisResult, Difficulty } from "../types";

interface NewAchievement {
    icon: string;
    name: string;
    description: string;
}

export default function Practice() {
    const [word, setWord] = useState<Word | null>(null);
    const [result, setResult] = useState<AnalysisResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [difficulty, setDifficulty] = useState<Difficulty>("beginner");
    const [category, setCategory] = useState("");
    const [ttsAudioUrl, setTtsAudioUrl] = useState<string | null>(null);
    const [pendingAchievements, setPendingAchievements] = useState<NewAchievement[]>([]);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // Stable refs for word ID to prevent stale closures
    const wordRef = useRef<Word | null>(null);
    wordRef.current = word;

    const speech = useSpeechRecognition();
    const recorder = useRecorder();

    // ─── Load word (ONLY depends on difficulty & category) ──
    const loadWord = useCallback(async () => {
        setLoading(true);
        setResult(null);
        setTtsAudioUrl(null);
        try {
            const w = await fetchRandomWord(difficulty, category || undefined);
            setWord(w);

            // Pre-generate TTS
            try {
                const tts = await generateTTS(w.text);
                setTtsAudioUrl(getTTSAudioUrl(tts.cache_key));
            } catch {
                // TTS failed — not critical, user can still practice
            }
        } catch (err) {
            console.error("Failed to load word:", err);
        } finally {
            setLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [difficulty, category]);

    // Load word on mount and when difficulty/category changes
    useEffect(() => {
        loadWord();
    }, [loadWord]);

    // ─── Listen to pronunciation ──────────────────────────
    const handleListen = useCallback(async () => {
        if (!wordRef.current) return;
        setIsPlaying(true);
        try {
            let url = ttsAudioUrl;
            if (!url) {
                const tts = await generateTTS(wordRef.current.text);
                url = getTTSAudioUrl(tts.cache_key);
                setTtsAudioUrl(url);
            }
            if (audioRef.current) audioRef.current.pause();
            const audio = new Audio(url);
            audioRef.current = audio;
            audio.onended = () => setIsPlaying(false);
            audio.onerror = () => setIsPlaying(false);
            audio.play();
        } catch {
            if ("speechSynthesis" in window && wordRef.current) {
                const utterance = new SpeechSynthesisUtterance(wordRef.current.text);
                utterance.lang = "en-US";
                utterance.onend = () => setIsPlaying(false);
                speechSynthesis.speak(utterance);
            } else {
                setIsPlaying(false);
            }
        }
    }, [ttsAudioUrl]);

    // ─── Start recording: speech recognition + audio capture ─
    const handleRecordStart = useCallback(() => {
        speech.resetTranscript();
        recorder.resetRecording();
        speech.startListening();
        recorder.startRecording();
    }, [speech, recorder]);

    const handleRecordStop = useCallback(() => {
        speech.stopListening();
        recorder.stopRecording();
    }, [speech, recorder]);

    // ─── Auto-analyze when speech recognition completes ───
    useEffect(() => {
        if (!speech.transcript || !wordRef.current || speech.isListening) return;

        const currentWord = wordRef.current;
        const analyze = async () => {
            setLoading(true);
            try {
                const res = await analyzePronounciation(
                    currentWord.id,
                    speech.transcript,
                    speech.confidence
                );
                setResult(res);
                const newAchs = (res as any).new_achievements;
                if (newAchs && newAchs.length > 0) {
                    setPendingAchievements((prev) => [...prev, ...newAchs]);
                }
            } catch (err) {
                console.error("Analysis error:", err);
            } finally {
                setLoading(false);
            }
        };

        analyze();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [speech.transcript, speech.isListening]);

    // ─── Actions ──────────────────────────────────────────
    const handleTryAgain = () => {
        setResult(null);
        speech.resetTranscript();
        recorder.resetRecording();
    };

    const handleNextWord = () => {
        speech.resetTranscript();
        recorder.resetRecording();
        loadWord();
    };

    const dismissAchievement = () => {
        setPendingAchievements((prev) => prev.slice(1));
    };

    return (
        <div className="min-h-screen flex flex-col">
            <Navbar />

            {/* Achievement toast */}
            {pendingAchievements.length > 0 && (
                <AchievementToast
                    achievement={pendingAchievements[0]}
                    onDismiss={dismissAchievement}
                />
            )}

            <main className="flex-1 flex flex-col items-center px-4 py-8 max-w-xl mx-auto w-full gap-6">
                {/* Difficulty selector */}
                <div className="flex gap-2 w-full justify-center">
                    {(["beginner", "intermediate", "advanced"] as Difficulty[]).map((d) => (
                        <button
                            key={d}
                            onClick={() => setDifficulty(d)}
                            className={`px-4 py-2 rounded-xl text-sm font-medium capitalize transition-all duration-200 cursor-pointer ${difficulty === d
                                    ? "bg-primary text-white shadow-[0_0_15px_rgba(99,102,241,0.3)]"
                                    : "bg-surface-lighter text-text-muted hover:bg-surface-light hover:text-white"
                                }`}
                        >
                            {d}
                        </button>
                    ))}
                </div>

                {/* Category selector */}
                <CategorySelector selected={category} onChange={setCategory} />

                {/* Loading */}
                {loading && !word && (
                    <div className="glass-card p-12 text-center">
                        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                        <p className="text-text-muted mt-3">Loading word...</p>
                    </div>
                )}

                {/* Word card */}
                {word && !result && (
                    <WordCard word={word} onListen={handleListen} isPlaying={isPlaying} />
                )}

                {/* Recorder */}
                {word && !result && (
                    <Recorder
                        isListening={speech.isListening}
                        onStart={handleRecordStart}
                        onStop={handleRecordStop}
                        transcript={speech.transcript}
                        isSupported={speech.isSupported}
                    />
                )}

                {/* Loading analysis */}
                {loading && word && speech.transcript && (
                    <div className="glass-card p-8 text-center">
                        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto" />
                        <p className="text-text-muted mt-3">Analyzing pronunciation...</p>
                    </div>
                )}

                {/* Feedback */}
                {result && (
                    <FeedbackPanel
                        result={result}
                        onTryAgain={handleTryAgain}
                        onNextWord={handleNextWord}
                    />
                )}

                {/* ── Overlaid waveform comparison ── */}
                {result && ttsAudioUrl && recorder.audioUrl && (
                    <OverlaidWaveform
                        referenceUrl={ttsAudioUrl}
                        userUrl={recorder.audioUrl}
                        score={result.pronunciation_score}
                    />
                )}

                {/* Single reference waveform if no user recording */}
                {result && ttsAudioUrl && !recorder.audioUrl && (
                    <div className="glass-card p-5 space-y-3 animate-slide-up w-full">
                        <h3 className="text-sm text-white font-semibold">
                            🔊 Reference Pronunciation
                        </h3>
                        <p className="text-xs text-text-muted">
                            Your recording was not captured. Listen again and try once more.
                        </p>
                        <Waveform audioUrl={ttsAudioUrl} label="Correct" color="#6366f1" />
                    </div>
                )}

                {/* Skip button */}
                {word && !result && !loading && (
                    <button
                        onClick={handleNextWord}
                        className="text-sm text-text-muted hover:text-white transition cursor-pointer"
                    >
                        Skip this word →
                    </button>
                )}
            </main>
        </div>
    );
}
