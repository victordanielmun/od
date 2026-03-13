import { useRef, useEffect, useState, useCallback } from "react";
import WaveSurfer from "wavesurfer.js";

interface OverlaidWaveformProps {
    referenceUrl: string;
    userUrl: string;
    score?: number;
}

/**
 * Renders two waveforms overlaid on the same graph —
 * reference (purple) and user recording (colored by score).
 * Each has independent play/pause controls.
 */
export default function OverlaidWaveform({
    referenceUrl,
    userUrl,
    score,
}: OverlaidWaveformProps) {
    const refContainerRef = useRef<HTMLDivElement>(null);
    const userContainerRef = useRef<HTMLDivElement>(null);
    const refWs = useRef<WaveSurfer | null>(null);
    const userWs = useRef<WaveSurfer | null>(null);

    const [refPlaying, setRefPlaying] = useState(false);
    const [userPlaying, setUserPlaying] = useState(false);
    const [refReady, setRefReady] = useState(false);
    const [userReady, setUserReady] = useState(false);

    const userColor =
        score !== undefined
            ? score >= 80
                ? "#4ade80"
                : score >= 60
                    ? "#fbbf24"
                    : "#f87171"
            : "#f59e0b";

    // ─── Create reference waveform ────────────────────────
    useEffect(() => {
        if (!refContainerRef.current) return;

        const ws = WaveSurfer.create({
            container: refContainerRef.current,
            waveColor: "#6366f1" + "55",
            progressColor: "#818cf8",
            cursorColor: "#818cf8",
            barWidth: 3,
            barGap: 2,
            barRadius: 3,
            height: 70,
            normalize: true,
            backend: "WebAudio" as any,
        });

        ws.load(referenceUrl);
        ws.on("ready", () => setRefReady(true));
        ws.on("play", () => setRefPlaying(true));
        ws.on("pause", () => setRefPlaying(false));
        ws.on("finish", () => setRefPlaying(false));

        refWs.current = ws;
        return () => { ws.destroy(); };
    }, [referenceUrl]);

    // ─── Create user waveform ─────────────────────────────
    useEffect(() => {
        if (!userContainerRef.current) return;

        const ws = WaveSurfer.create({
            container: userContainerRef.current,
            waveColor: userColor + "55",
            progressColor: userColor,
            cursorColor: userColor,
            barWidth: 3,
            barGap: 2,
            barRadius: 3,
            height: 70,
            normalize: true,
            backend: "WebAudio" as any,
        });

        ws.load(userUrl);
        ws.on("ready", () => setUserReady(true));
        ws.on("play", () => setUserPlaying(true));
        ws.on("pause", () => setUserPlaying(false));
        ws.on("finish", () => setUserPlaying(false));

        userWs.current = ws;
        return () => { ws.destroy(); };
    }, [userUrl, userColor]);

    const toggleRef = useCallback(() => refWs.current?.playPause(), []);
    const toggleUser = useCallback(() => userWs.current?.playPause(), []);
    const playBoth = useCallback(() => {
        refWs.current?.seekTo(0);
        userWs.current?.seekTo(0);
        refWs.current?.play();
        userWs.current?.play();
    }, []);

    return (
        <div className="glass-card p-5 space-y-4 animate-slide-up">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h3 className="text-sm text-white font-semibold">
                    〰️ Pronunciation Comparison
                </h3>
                {score !== undefined && (
                    <span
                        className="text-xs font-bold px-2 py-0.5 rounded-md"
                        style={{
                            color: userColor,
                            backgroundColor: userColor + "15",
                            border: `1px solid ${userColor}30`,
                        }}
                    >
                        {Math.round(score)}%
                    </span>
                )}
            </div>

            <p className="text-xs text-text-muted">
                Both waveforms are overlaid — compare the shape, rhythm, and stress patterns.
            </p>

            {/* Overlaid waveforms container */}
            <div className="relative rounded-xl bg-surface-lighter/30 border border-white/5 p-3">
                {/* Reference waveform (bottom layer) */}
                <div ref={refContainerRef} className="w-full" />
                {/* User waveform (top layer, overlaid) */}
                <div
                    ref={userContainerRef}
                    className="absolute inset-0 p-3"
                    style={{ pointerEvents: "none" }}
                />

                {/* Loading */}
                {(!refReady || !userReady) && (
                    <div className="absolute inset-0 flex items-center justify-center bg-surface/50 rounded-xl">
                        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                )}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-6 text-xs">
                <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-sm bg-[#6366f1]" />
                    <span className="text-text-muted">Reference (correct)</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: userColor }} />
                    <span className="text-text-muted">Your pronunciation</span>
                </div>
            </div>

            {/* Controls */}
            <div className="flex gap-2 flex-wrap">
                <button
                    onClick={toggleRef}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                     bg-[#6366f1]/15 text-[#818cf8] border border-[#6366f1]/20
                     hover:bg-[#6366f1]/25 transition cursor-pointer"
                >
                    {refPlaying ? "⏸" : "▶"} Reference
                </button>
                <button
                    onClick={toggleUser}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                     border transition cursor-pointer"
                    style={{
                        backgroundColor: userColor + "15",
                        color: userColor,
                        borderColor: userColor + "30",
                    }}
                >
                    {userPlaying ? "⏸" : "▶"} Your Recording
                </button>
                <button
                    onClick={playBoth}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                     bg-white/5 text-text-muted border border-white/10
                     hover:bg-white/10 transition cursor-pointer"
                >
                    ▶▶ Play Both
                </button>
            </div>

            {/* Tip */}
            <div className="p-3 rounded-lg bg-surface-lighter/20 border border-white/5">
                <p className="text-[11px] text-text-muted leading-relaxed">
                    <span className="text-primary-light font-semibold">💡 </span>
                    Look for differences in wave height (volume) and width (syllable duration).
                    If your wave is shorter or taller in certain areas, focus on those syllables.
                    Use "Play Both" to hear them simultaneously.
                </p>
            </div>
        </div>
    );
}
