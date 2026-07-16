/**
 * PracticePage — English pronunciation practice module.
 * Integrates voice components with the Gather RPG frontend.
 * Architecture mirrors voice/frontend/src/pages/Practice.tsx:
 *   - useRecorder  → local MediaRecorder (audio blob for waveform)
 *   - useSpeechRecognition → Chrome Speech API (transcript for /api/analyze)
 *   - OverlaidWaveform → wavesurfer.js overlaid comparison
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useRecorder } from '../hooks/useRecorder';
import {
    fetchRandomWord,
    analyzeAudio,
    generateTTS,
    getTTSAudioUrl,
    submitChallengeAttempt,
    fetchChallengeMetadata,
    fetchLearningProfile,
} from '../services/voiceApi';
import OverlaidWaveform from '../components/voice/OverlaidWaveform';
import Waveform from '../components/voice/Waveform';
import ChallengeView from '../components/learning/ChallengeView';
import { Mic, Layout, Trophy, BookOpen, Sparkles, ArrowLeft } from 'lucide-react';

export default function PracticePage() {
    const [word, setWord] = useState(null);
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [difficulty, setDifficulty] = useState('beginner');
    const [category, setCategory] = useState('');
    const [activeTab, setActiveTab] = useState('pronunciation'); // 'pronunciation' or 'challenges'
    const [ttsAudioUrl, setTtsAudioUrl] = useState(null);
    const [error, setError] = useState(null);

    const audioRef = useRef(null);
    const wordRef = useRef(null);
    wordRef.current = word;

    const recorder = useRecorder();

    const [difficulties, setDifficulties] = useState(['beginner']);
    const [categories, setCategories] = useState(['']);

    // ── Prefijar la dificultad con el nivel del usuario ──────
    // /learn sigue siendo práctica libre (el usuario puede cambiar dificultad y
    // categoría), pero arranca en su nivel real en vez de siempre en 'beginner',
    // para quedar coherente con Ninja Card y WhatsApp que ya son adaptativos.
    useEffect(() => {
        fetchLearningProfile().then((profile) => {
            if (profile?.english_level) setDifficulty(profile.english_level);
        }).catch((err) => {
            console.warn('Could not load learning profile, keeping default difficulty:', err);
        });
    }, []);

    // ── Load dynamic metadata ────────────────────────────────
    // Scoped to the active tab's type and the selected difficulty: a tag like
    // "animals" may only exist for "vocabulary" challenges, and a tag like "doubt"
    // may only exist at "advanced" difficulty. Offering it outside its actual scope
    // produces a type+difficulty+tag combo with zero matching challenges (404 on
    // loadWord).
    useEffect(() => {
        const typeParam = activeTab === 'pronunciation' ? 'pronunciation' : 'vocabulary';
        setCategory('');
        fetchChallengeMetadata(typeParam, difficulty).then((data) => {
            if (data.difficulties?.length) setDifficulties(data.difficulties);
            setCategories(['', ...(data.tags || [])]);
        }).catch((err) => {
            console.warn('Failed to load challenge metadata, using defaults:', err);
            setDifficulties(['beginner', 'intermediate', 'advanced']);
            setCategories(['', 'vocabulary', 'greetings', 'phrases', 'sentences']);
        });
    }, [activeTab, difficulty]);

    // ── Load a random word ──────────────────────────────────
    const loadWord = useCallback(async () => {
        setLoading(true);
        setResult(null);
        setTtsAudioUrl(null);
        setError(null);
        try {
            // Pronunciation tab -> pronunciation type
            // Challenges tab -> vocab or grammar (non-audio)
            const typeParam = activeTab === 'pronunciation' ? 'pronunciation' : 'vocabulary';
            const w = await fetchRandomWord(difficulty, typeParam, category || undefined);
            setWord(w);
            if (w.text && w.text.trim()) {
                try {
                    const tts = await generateTTS(w.text);
                    setTtsAudioUrl(getTTSAudioUrl(tts.cache_key));
                } catch (ttsErr) {
                    console.warn('TTS generation failed (optional):', ttsErr);
                }
            }
        } catch (err) {
            setError('Could not load word. Make sure the Voice Backend is running on port 8000.');
            console.error('Failed to load word:', err);
        } finally {
            setLoading(false);
        }
    }, [difficulty, category]);

    useEffect(() => { loadWord(); }, [loadWord, activeTab]);

    // ── Listen to pronunciation ────────────────────────────
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
            audio.onerror = () => {
                if ('speechSynthesis' in window && wordRef.current) {
                    const utterance = new SpeechSynthesisUtterance(wordRef.current.text);
                    utterance.lang = 'en-US';
                    utterance.onend = () => setIsPlaying(false);
                    speechSynthesis.speak(utterance);
                } else {
                    setIsPlaying(false);
                }
            };
            audio.play();
        } catch (ttsErr) {
            console.error('Manual TTS play failed:', ttsErr);
            setIsPlaying(false);
        }
    }, [ttsAudioUrl]);

    // ── Recording ──────────────────────────────────────────
    const handleRecordStart = useCallback(() => {
        setError(null);
        recorder.resetRecording();
        recorder.startRecording();
    }, [recorder]);

    const handleRecordStop = useCallback(() => {
        recorder.stopRecording();
    }, [recorder]);



    // ── Run audio analysis (Offline Whisper) ───────────────
    const runAudioAnalysis = useCallback(async (audioBlob) => {
        if (!wordRef.current || !audioBlob) return;
        const currentWord = wordRef.current;
        setLoading(true);
        try {
            const res = await analyzeAudio(audioBlob, currentWord.id);
            setResult(res);

            // Submit the attempt automatically to grant RPG XP
            try {
                const isCorrect = res.pronunciation_score >= 80;
                await submitChallengeAttempt(
                    currentWord.id,
                    isCorrect,
                    res.feedback?.tips?.join('. ') || ""
                );
            } catch (xpErr) {
                console.warn('Could not record attempt for XP:', xpErr);
            }

        } catch (err) {
            console.error('Analysis error:', err);
            setError('Failed to analyze pronunciation. Is the Voice Backend running?');
        } finally {
            setLoading(false);
        }
    }, []);




    const handleTryAgain = () => {
        setResult(null);
        setError(null);
        recorder.resetRecording();
    };

    const handleNextWord = () => {
        recorder.resetRecording();
        loadWord();
    };

    const scoreColor = (score) => {
        if (score >= 80) return 'text-green-400';
        if (score >= 60) return 'text-amber-400';
        return 'text-red-400';
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-indigo-950 to-gray-900 text-white">
            {/* Header */}
            <header className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-black/20 backdrop-blur-md">
                <div className="flex items-center gap-3 flex-1">
                    <Link
                        to="/lobby"
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium
                         bg-white/5 text-gray-300 border border-white/10
                         hover:bg-white/10 hover:text-white transition"
                    >
                        <ArrowLeft size={14} /> Lobby
                    </Link>
                    <div className="p-2 bg-indigo-600 rounded-lg shadow-lg">
                        <BookOpen size={20} className="text-white" />
                    </div>
                </div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent text-center flex-[2]">
                    Odyssey Learning Center
                </h1>
                <div className="flex-1 text-right flex items-center justify-end gap-2">
                    <Trophy size={16} className="text-amber-400" />
                    <span className="text-xs font-bold text-gray-300 tracking-widest uppercase">Práctica</span>
                </div>
            </header>

            <main className="flex flex-col items-center px-4 py-8 max-w-xl mx-auto w-full gap-6">

                {/* Main Tabs */}
                <div className="flex bg-white/5 p-1 rounded-2xl w-full border border-white/10 mb-4">
                    <button 
                        onClick={() => setActiveTab('pronunciation')}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all duration-300 ${activeTab === 'pronunciation' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                    >
                        <Mic size={16} /> Pronunciación
                    </button>
                    <button 
                        onClick={() => setActiveTab('challenges')}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all duration-300 ${activeTab === 'challenges' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                    >
                        <Layout size={16} /> Desafíos
                    </button>
                </div>

                {/* Error banner */}
                {error && (
                    <div className="w-full p-4 rounded-xl bg-red-500/20 border border-red-500/30 text-red-300 text-sm">
                        ⚠️ {error}
                    </div>
                )}

                {/* Difficulty selector */}
                <div className="flex gap-2 w-full justify-center">
                    {difficulties.map((d) => (
                        <button
                            key={d}
                            onClick={() => setDifficulty(d)}
                            className={`px-4 py-2 rounded-xl text-sm font-medium capitalize transition-all duration-200 cursor-pointer ${difficulty === d
                                ? 'bg-indigo-600 text-white shadow-[0_0_15px_rgba(99,102,241,0.3)]'
                                : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                                }`}
                        >
                            {d}
                        </button>
                    ))}
                </div>

                {/* Category selector */}
                <div className="flex flex-wrap gap-2 w-full justify-center">
                    {categories.map((c) => (
                        <button
                            key={c || 'all'}
                            onClick={() => setCategory(c)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all cursor-pointer ${category === c
                                ? 'bg-purple-600/40 text-purple-200 border border-purple-500/50'
                                : 'bg-white/5 text-gray-400 hover:bg-white/10 border border-transparent'
                                }`}
                        >
                            {c || 'All Categories'}
                        </button>
                    ))}
                </div>

                {/* Loading spinner */}
                {loading && !word && (
                    <div className="bg-black/30 backdrop-blur-md border border-white/10 rounded-2xl p-12 text-center">
                        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
                        <p className="text-gray-400 mt-3">Loading word...</p>
                    </div>
                )}

                {/* Content based on Active Tab */}
                {activeTab === 'pronunciation' ? (
                    <>
                        {/* Word card */}
                        {word && !result && (
                            <div className="bg-black/30 backdrop-blur-md border border-white/10 rounded-2xl p-8 w-full">
                                {word.difficulty && (
                                    <span className={`inline-block px-3 py-1 text-xs font-semibold uppercase tracking-wider rounded-full border mb-4 ${word.difficulty === 'beginner' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                                        word.difficulty === 'intermediate' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' :
                                            'bg-red-500/20 text-red-400 border-red-500/30'
                                        }`}>
                                        {word.difficulty}
                                    </span>
                                )}
                                <h2 className="text-4xl font-bold text-white mb-2 tracking-tight">{word.text}</h2>
                                {word.phonetic && <p className="text-gray-400 text-lg mb-6 font-mono">{word.phonetic}</p>}
                                {word.category && <p className="text-xs text-gray-500 mb-4 uppercase tracking-wider">{word.category}</p>}
                                <button
                                    onClick={handleListen}
                                    disabled={isPlaying}
                                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/30 transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-50 cursor-pointer"
                                >
                                    🔊 {isPlaying ? 'Playing...' : 'Listen'}
                                </button>
                            </div>
                        )}

                        {/* Recorder & Pre-Review */}
                        {word && !result && !loading && (
                            <div className="bg-black/30 backdrop-blur-md border border-white/10 rounded-2xl p-8 flex flex-col items-center gap-6 w-full">
                                
                                {/* 1) Before Recording: Show reference waveform so user can learn rhythm */}
                                {!recorder.audioUrl && ttsAudioUrl && (
                                    <div className="w-full bg-indigo-500/10 rounded-xl p-4 border border-indigo-500/20 mb-2">
                                        <p className="text-xs text-indigo-300 uppercase tracking-wide mb-3 text-center font-semibold">Reference Pronunciation</p>
                                        <Waveform audioUrl={ttsAudioUrl} label="" color="#818cf8" showControls={true} height={40} />
                                    </div>
                                )}

                                {/* 2) Before/During Recording: Show Record button */}
                                {!recorder.audioUrl && (
                                    <div className="flex flex-col items-center gap-4">
                                        <button
                                            onClick={recorder.isRecording ? handleRecordStop : handleRecordStart}
                                            className={`w-24 h-24 rounded-full flex items-center justify-center text-3xl transition-all duration-300 cursor-pointer disabled:opacity-40 ${recorder.isRecording
                                                ? 'bg-red-600 shadow-[0_0_40px_rgba(239,68,68,0.4)] animate-pulse'
                                                : 'bg-indigo-600 hover:bg-indigo-500 shadow-[0_0_30px_rgba(99,102,241,0.3)]'
                                                }`}
                                        >
                                            {recorder.isRecording ? '⏹' : '🎙️'}
                                        </button>
                                        <p className="text-gray-400 text-sm uppercase tracking-wider">
                                            {recorder.isRecording ? (
                                                <span className="text-red-400 flex items-center gap-2">
                                                    <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" /> Recording...
                                                </span>
                                            ) : 'Tap to record'}
                                        </p>
                                    </div>
                                )}

                                {/* 3) After Recording: Show Overlay Review and Manual Submit options */}
                                {recorder.audioUrl && (
                                    <div className="w-full flex flex-col items-center gap-4">
                                        <div className="w-full p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
                                            <p className="text-xs text-indigo-300 text-center mb-2 mt-1 uppercase tracking-wider font-semibold">Review your recording</p>
                                            {ttsAudioUrl && (
                                                <OverlaidWaveform
                                                    referenceUrl={ttsAudioUrl}
                                                    userUrl={recorder.audioUrl}
                                                    // Passing undefined score so the component renders without percentage badge
                                                    score={undefined} 
                                                />
                                            )}
                                        </div>
                                        <div className="flex gap-3 w-full mt-2">
                                            <button
                                                onClick={() => recorder.resetRecording()}
                                                className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 transition cursor-pointer"
                                            >
                                                Discard
                                            </button>
                                            <button
                                                onClick={() => runAudioAnalysis(recorder.audioBlob)}
                                                className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition cursor-pointer shadow-[0_4px_15px_rgba(79,70,229,0.4)]"
                                            >
                                                Analyze →
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                ) : (
                    <ChallengeView key={word?.id || "challenge"}
                        challenge={word} 
                        difficulty={difficulty} 
                        onNext={handleNextWord} 
                    />
                )}

                {/* Analyzing spinner */}
                {loading && word && !result && (
                    <div className="bg-black/30 backdrop-blur-md border border-white/10 rounded-2xl p-8 text-center w-full">
                        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto" />
                        <p className="text-gray-400 mt-3">Analyzing pronunciation...</p>
                    </div>
                )}

                {/* Results panel */}
                {result && (
                    <div className="bg-black/30 backdrop-blur-md border border-white/10 rounded-2xl p-8 w-full space-y-5">
                        {/* Score */}
                        <div className="text-center">
                            <p className="text-gray-400 text-sm uppercase tracking-wider mb-2">Pronunciation Score</p>
                            <p className={`text-6xl font-bold ${scoreColor(result.pronunciation_score)}`}>
                                {Math.round(result.pronunciation_score)}%
                            </p>
                        </div>

                        {/* Word Breakdown */}
                        {result.feedback?.word_analysis && (
                            <div className="bg-white/5 rounded-xl p-6 border border-white/5">
                                <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-4 font-bold">Word Breakdown</p>
                                <div className="flex flex-wrap gap-3">
                                    {result.feedback.word_analysis.map((w, i) => (
                                        <div key={i} className="flex flex-col items-center">
                                            <span className={`px-3 py-1.5 rounded-lg text-sm font-bold border transition-all ${
                                                w.text_match 
                                                ? 'bg-green-500/10 text-green-400 border-green-500/20 shadow-[0_0_10px_rgba(34,197,94,0.1)]' 
                                                : w.phonetically_close
                                                    ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                                    : 'bg-red-500/10 text-red-400 border-red-500/20 shadow-[0_0_10px_rgba(239,68,68,0.1)]'
                                            }`}>
                                                {w.expected}
                                            </span>
                                            {!w.text_match && w.heard !== '(missing)' && (
                                                <span className="text-[10px] text-gray-500 mt-1 font-mono italic">
                                                    Heard: "{w.heard}"
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Tips */}
                        {result.feedback?.tips?.length > 0 && (
                            <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4">
                                <div className="flex items-center gap-2 mb-2 text-indigo-300">
                                    <Sparkles size={14} />
                                    <p className="text-xs uppercase tracking-wider font-bold">Learning Tips</p>
                                </div>
                                <ul className="space-y-1.5">
                                    {result.feedback.tips.map((tip, i) => (
                                        <li key={i} className="text-sm text-gray-300 flex gap-2 leading-relaxed">
                                            <span className="text-indigo-400 mt-1">•</span> {tip}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Overlaid waveform comparison — when user recording captured */}
                        {ttsAudioUrl && recorder.audioUrl && (
                            <OverlaidWaveform
                                referenceUrl={ttsAudioUrl}
                                userUrl={recorder.audioUrl}
                                score={result.pronunciation_score}
                            />
                        )}

                        {/* Fallback: only reference waveform when no user recording */}
                        {ttsAudioUrl && !recorder.audioUrl && (
                            <div className="bg-black/30 backdrop-blur-md border border-white/10 rounded-2xl p-5 space-y-3">
                                <h3 className="text-sm text-white font-semibold">🔊 Reference Pronunciation</h3>
                                <p className="text-xs text-gray-400">
                                    Your recording was not captured. Listen again and try with the microphone.
                                </p>
                                <Waveform audioUrl={ttsAudioUrl} label="Correct" color="#6366f1" />
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex gap-3">
                            <button
                                onClick={handleTryAgain}
                                className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 transition cursor-pointer"
                            >
                                Try Again
                            </button>
                            <button
                                onClick={handleNextWord}
                                className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition cursor-pointer"
                            >
                                Next Word →
                            </button>
                        </div>
                    </div>
                )}

                {/* Skip */}
                {word && !result && !loading && (
                    <button
                        onClick={handleNextWord}
                        className="text-sm text-gray-500 hover:text-white transition cursor-pointer"
                    >
                        Skip this word →
                    </button>
                )}
            </main>
        </div>
    );
}
