import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Mic, MicOff, Volume2, Music, CheckCircle, X, Loader, Star } from 'lucide-react';
import api from '../../services/api';
import { analyzeDialogueAudio, generateTTS, getTTSAudioUrl } from '../../services/voiceApi';

/**
 * KaraokeOverlay — a line-by-line "sing/recite the lyrics" minigame that reuses the
 * voice backend's pronunciation scoring (analyzeDialogueAudio with an expected line).
 * The player records each line; the average score is submitted to the Go backend,
 * which deterministically completes the karaoke task when it meets the threshold.
 *
 * Props:
 *  - lines: array of { order, line } objects (or plain strings)
 *  - missionId, taskId, roomId, minScore
 *  - npcName, npcVoice
 *  - onComplete(result) — result from POST /missions/karaoke/complete
 *  - onClose()
 */
export const KaraokeOverlay = ({ lines, missionId, taskId, roomId, minScore = 80, npcName, npcVoice, onComplete, onClose }) => {
    const { t } = useTranslation();

    const lyricLines = (lines || [])
        .map(l => (typeof l === 'string' ? l : l?.line || ''))
        .map(s => s.trim())
        .filter(Boolean);

    const [phase, setPhase] = useState('intro'); // intro | singing | submitting | result
    const [currentIndex, setCurrentIndex] = useState(0);
    const [lineScores, setLineScores] = useState([]);
    const [isRecording, setIsRecording] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [lastLineScore, setLastLineScore] = useState(null);
    const [result, setResult] = useState(null);
    const [errorMsg, setErrorMsg] = useState(null); // user-visible mic / analysis errors

    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const audioRef = useRef(null);
    const recordingTimeoutRef = useRef(null);

    const stopAudio = () => {
        if (audioRef.current) {
            const a = audioRef.current;
            a.pause();
            try { a.currentTime = 0; } catch (_) {}
            // Abort any in-flight load + detach handlers so a superseded clip can't
            // fire a late 'canplaythrough' and start ghost playback.
            a.oncanplaythrough = null;
            a.onended = null;
            a.onerror = null;
            a.src = '';
            audioRef.current = null;
        }
        if (window.speechSynthesis) window.speechSynthesis.cancel();
        setIsPlaying(false);
    };

    useEffect(() => {
        return () => {
            stopAudio();
            if (recordingTimeoutRef.current) clearTimeout(recordingTimeoutRef.current);
            if (mediaRecorderRef.current?.stream) {
                mediaRecorderRef.current.stream.getTracks().forEach(tr => tr.stop());
            }
        };
    }, []);

    // ── Play the model line (TTS) with Web Speech fallback ───────────────────
    const playLine = async (text) => {
        if (!text) return;
        stopAudio();
        setIsPlaying(true);
        try {
            const tts = await generateTTS(text, npcVoice);
            let url = tts.audio_url || getTTSAudioUrl(tts.cache_key);
            if (url.includes('/audio/')) url += `?t=${Date.now()}`;
            const audio = new Audio();
            audio.preload = 'auto';
            audioRef.current = audio;
            audio.onended = () => setIsPlaying(false);
            audio.onerror = () => {
                if ('speechSynthesis' in window) {
                    const u = new SpeechSynthesisUtterance(text);
                    u.lang = 'en-US';
                    u.onend = () => setIsPlaying(false);
                    speechSynthesis.speak(u);
                } else {
                    setIsPlaying(false);
                }
            };
            // Play only once buffered enough to play through, from the very start,
            // so the model line is never cut off at the beginning.
            let started = false;
            const startPlayback = () => {
                if (started || audioRef.current !== audio) return;
                started = true;
                try { audio.currentTime = 0; } catch (_) {}
                audio.play().catch(() => setIsPlaying(false));
            };
            audio.addEventListener('canplaythrough', startPlayback, { once: true });
            setTimeout(startPlayback, 2500); // safety net if canplaythrough is slow
            audio.src = url;
            audio.load();
        } catch {
            setIsPlaying(false);
        }
    };

    // ── Recording ────────────────────────────────────────────────────────────
    const toggleRecording = async () => {
        if (isRecording) {
            if (mediaRecorderRef.current) {
                if (recordingTimeoutRef.current) clearTimeout(recordingTimeoutRef.current);
                mediaRecorderRef.current.stop();
                setIsRecording(false);
                mediaRecorderRef.current.stream.getTracks().forEach(tr => tr.stop());
            }
            return;
        }
        stopAudio();
        setErrorMsg(null);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream);
            mediaRecorderRef.current = recorder;
            audioChunksRef.current = [];
            recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
            recorder.onstop = async () => {
                const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                setIsProcessing(true);
                try {
                    const res = await analyzeDialogueAudio(blob, lyricLines[currentIndex]);
                    const score = res.pronunciation_score ?? 0;
                    setLastLineScore(score);
                    const nextScores = [...lineScores, score];
                    setLineScores(nextScores);

                    if (currentIndex + 1 < lyricLines.length) {
                        // Brief pause so the player sees the per-line score, then advance.
                        setTimeout(() => {
                            setLastLineScore(null);
                            setCurrentIndex(i => i + 1);
                        }, 1400);
                    } else {
                        await submitResult(nextScores);
                    }
                } catch (err) {
                    console.error('[Karaoke] line analysis failed:', err);
                    setErrorMsg(t('npc.karaoke.analyze_failed'));
                } finally {
                    setIsProcessing(false);
                }
            };
            recorder.start();
            setIsRecording(true);
            recordingTimeoutRef.current = setTimeout(() => {
                if (mediaRecorderRef.current?.state === 'recording') {
                    mediaRecorderRef.current.stop();
                    setIsRecording(false);
                    mediaRecorderRef.current.stream.getTracks().forEach(tr => tr.stop());
                }
            }, 15000);
        } catch (err) {
            console.error('[Karaoke] microphone access denied:', err);
            setIsRecording(false);
            setErrorMsg(t('npc.karaoke.mic_denied'));
        }
    };

    const submitResult = async (scores) => {
        setPhase('submitting');
        const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
        try {
            const { data } = await api.post('/missions/karaoke/complete', {
                mission_id: missionId,
                task_id: taskId,
                room_id: roomId,
                avg_score: avg,
                line_scores: scores,
            });
            setResult({ ...data, avg });
            setPhase('result');
            onComplete?.({ ...data, avg });
        } catch (err) {
            console.error('[Karaoke] submit failed:', err);
            setResult({ task_completed: false, avg, error: true });
            setPhase('result');
        }
    };

    const avgSoFar = lineScores.length ? Math.round(lineScores.reduce((a, b) => a + b, 0) / lineScores.length) : 0;
    const progressPct = Math.round((lineScores.length / Math.max(lyricLines.length, 1)) * 100);

    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/85 backdrop-blur-md pointer-events-auto p-4 animate-in fade-in duration-300">
            <button
                onClick={() => { stopAudio(); onClose?.(); }}
                className="fixed top-6 right-6 z-[160] p-3 bg-[var(--color-orange-vibrant)] text-white border-2 border-[var(--color-gold)] shadow-2xl hover:bg-[var(--color-accent-blue)] transition-colors"
            >
                <X size={24} />
            </button>

            <div className="relative w-full max-w-2xl bg-[var(--color-parchment)] border-8 border-double border-[var(--color-gold)] p-10 shadow-[0_0_80px_rgba(255,0,128,0.25)]">
                {/* Header */}
                <div className="flex items-center justify-center gap-3 mb-2">
                    <Music size={28} className="text-pink-600 animate-pulse" />
                    <h2 className="text-3xl font-medieval uppercase tracking-widest text-[var(--color-base-dark)]">
                        {t('npc.karaoke.title')}
                    </h2>
                </div>
                <p className="text-center text-sm font-serif italic text-gray-600 mb-6">
                    {t('npc.karaoke.subtitle', { name: npcName, score: minScore })}
                </p>

                {/* ── Intro ── */}
                {phase === 'intro' && (
                    <div className="text-center space-y-6 py-6">
                        <p className="text-lg font-serif text-[var(--color-base-dark)]">
                            {t('npc.karaoke.intro', { count: lyricLines.length })}
                        </p>
                        <button
                            onClick={() => setPhase('singing')}
                            className="px-10 py-4 bg-pink-600 hover:bg-pink-500 text-white font-medieval text-xl uppercase tracking-widest border-4 border-[var(--color-gold)] shadow-lg active:translate-y-1 transition-all"
                        >
                            {t('npc.karaoke.start')}
                        </button>
                    </div>
                )}

                {/* ── Singing ── */}
                {phase === 'singing' && (
                    <div className="space-y-6">
                        {/* Progress bar */}
                        <div className="flex items-center gap-3">
                            <div className="flex-1 h-3 bg-black/10 rounded-full overflow-hidden border border-[var(--color-gold)]/30">
                                <div className="h-full bg-gradient-to-r from-pink-500 to-[var(--color-gold)] transition-all duration-500" style={{ width: `${progressPct}%` }} />
                            </div>
                            <span className="text-xs font-medieval text-gray-600">{lineScores.length}/{lyricLines.length}</span>
                        </div>

                        {/* Current line */}
                        <div className="bg-white/50 border-l-4 border-pink-500 p-6 text-center min-h-[120px] flex flex-col items-center justify-center gap-3">
                            <span className="text-[10px] font-medieval uppercase tracking-widest text-pink-600">
                                {t('npc.karaoke.line')} {currentIndex + 1}
                            </span>
                            <p className="text-2xl font-medieval text-[var(--color-base-dark)] leading-tight">
                                {`“${lyricLines[currentIndex]}”`}
                            </p>
                            {lastLineScore !== null && (
                                <span className={`text-sm font-bold ${lastLineScore >= minScore ? 'text-green-700' : 'text-orange-600'} animate-in fade-in`}>
                                    {t('npc.karaoke.line_score', { score: Math.round(lastLineScore) })}
                                </span>
                            )}
                        </div>

                        {/* Controls */}
                        <div className="flex items-center justify-center gap-6">
                            <button
                                onClick={() => playLine(lyricLines[currentIndex])}
                                disabled={isRecording || isProcessing}
                                className={`p-4 border-4 border-[var(--color-gold)] shadow-lg transition-all ${isPlaying ? 'bg-[var(--color-orange-vibrant)] text-white' : 'bg-[var(--color-accent-blue)] text-[var(--color-gold)] hover:bg-[var(--color-base-dark)]'} disabled:opacity-40`}
                                title={t('npc.karaoke.listen')}
                            >
                                <Volume2 size={26} className={isPlaying ? 'animate-pulse' : ''} />
                            </button>

                            <button
                                onClick={toggleRecording}
                                disabled={isProcessing}
                                className={`p-6 border-4 shadow-xl transition-all ${isRecording ? 'bg-pink-600 text-white border-pink-300 animate-pulse' : 'bg-[var(--color-accent-blue)] text-[var(--color-gold)] border-[var(--color-gold)]'} disabled:opacity-40`}
                                title={isRecording ? t('npc.karaoke.stop') : t('npc.karaoke.sing')}
                            >
                                {isProcessing ? <Loader size={30} className="animate-spin" /> : (isRecording ? <MicOff size={30} /> : <Mic size={30} />)}
                            </button>
                        </div>

                        <p className="text-center text-xs font-serif italic text-gray-500">
                            {isProcessing ? t('npc.karaoke.analyzing') : isRecording ? t('npc.karaoke.recording') : t('npc.karaoke.hint')}
                        </p>
                        {errorMsg && (
                            <p className="text-center text-sm font-bold text-red-600 bg-red-50 border border-red-200 rounded-md py-2 px-3 animate-in fade-in">
                                {errorMsg}
                            </p>
                        )}
                        {avgSoFar > 0 && (
                            <p className="text-center text-sm font-medieval text-gray-600">
                                {t('npc.karaoke.avg_so_far')}: <span className="text-pink-600 font-bold">{avgSoFar}</span>
                            </p>
                        )}
                    </div>
                )}

                {/* ── Submitting ── */}
                {phase === 'submitting' && (
                    <div className="text-center py-12">
                        <Loader size={48} className="mx-auto text-pink-600 animate-spin mb-4" />
                        <p className="font-medieval uppercase tracking-widest text-gray-600">{t('npc.karaoke.scoring')}</p>
                    </div>
                )}

                {/* ── Result ── */}
                {phase === 'result' && result && (
                    <div className="text-center space-y-6 py-4 animate-in zoom-in-95 duration-300">
                        <div className="flex justify-center gap-1">
                            {[1, 2, 3, 4, 5].map(n => (
                                <Star key={n} size={36} className={Math.round(result.avg) >= n * 20 ? 'text-[var(--color-gold)] fill-[var(--color-gold)]' : 'text-gray-300'} />
                            ))}
                        </div>
                        <div>
                            <p className="text-5xl font-medieval text-[var(--color-base-dark)]">{Math.round(result.avg)}</p>
                            <p className="text-xs uppercase tracking-widest text-gray-500">{t('npc.karaoke.final_score')}</p>
                        </div>
                        {result.task_completed ? (
                            <div className="flex items-center justify-center gap-2 text-green-700 font-medieval uppercase tracking-wider">
                                <CheckCircle size={22} /> {t('npc.karaoke.passed')}
                            </div>
                        ) : (
                            <p className="text-orange-600 font-serif italic">
                                {t('npc.karaoke.failed', { score: minScore })}
                            </p>
                        )}
                        <div className="flex gap-4 justify-center pt-2">
                            {!result.task_completed && (
                                <button
                                    onClick={() => { setLineScores([]); setCurrentIndex(0); setLastLineScore(null); setResult(null); setPhase('singing'); }}
                                    className="px-8 py-3 bg-pink-600 hover:bg-pink-500 text-white font-medieval uppercase tracking-widest border-4 border-[var(--color-gold)] shadow-lg active:translate-y-1 transition-all"
                                >
                                    {t('npc.karaoke.retry')}
                                </button>
                            )}
                            <button
                                onClick={() => { stopAudio(); onClose?.(); }}
                                className="px-8 py-3 bg-[var(--color-base-dark)] text-[var(--color-gold)] font-medieval uppercase tracking-widest border-4 border-[var(--color-gold)] shadow-lg active:translate-y-1 transition-all"
                            >
                                {t('npc.karaoke.done')}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default KaraokeOverlay;
