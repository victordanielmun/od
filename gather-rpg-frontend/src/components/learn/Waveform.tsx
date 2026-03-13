import { useRef, useEffect, useState, useCallback } from "react";
import WaveSurfer from "wavesurfer.js";

interface WaveformProps {
    audioUrl: string;
    label?: string;
    color?: string;
    progressColor?: string;
    height?: number;
    showControls?: boolean;
}

export default function Waveform({
    audioUrl,
    label,
    color = "#818cf8",
    progressColor,
    height = 64,
    showControls = true,
}: WaveformProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const wavesurfer = useRef<WaveSurfer | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);

    useEffect(() => {
        if (!containerRef.current) return;

        const ws = WaveSurfer.create({
            container: containerRef.current,
            waveColor: color + "50",
            progressColor: progressColor || color,
            cursorColor: "transparent",
            barWidth: 3,
            barGap: 2,
            barRadius: 3,
            height,
            normalize: true,
            backend: "WebAudio" as any,
        });

        ws.load(audioUrl);

        ws.on("ready", () => setDuration(ws.getDuration()));
        ws.on("play", () => setIsPlaying(true));
        ws.on("pause", () => setIsPlaying(false));
        ws.on("finish", () => setIsPlaying(false));
        ws.on("timeupdate", (time: number) => setCurrentTime(time));

        wavesurfer.current = ws;

        return () => {
            ws.destroy();
        };
    }, [audioUrl, color, progressColor, height]);

    const togglePlay = useCallback(() => {
        wavesurfer.current?.playPause();
    }, []);

    const formatTime = (t: number) => {
        const s = Math.floor(t);
        const ms = Math.floor((t - s) * 10);
        return `${s}.${ms}s`;
    };

    return (
        <div className="space-y-2">
            {label && (
                <div className="flex items-center justify-between">
                    <p className="text-xs text-text-muted uppercase tracking-wide font-semibold">
                        {label}
                    </p>
                    <span className="text-[10px] text-text-muted/60 tabular-nums">
                        {formatTime(currentTime)} / {formatTime(duration)}
                    </span>
                </div>
            )}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-lighter/40 border border-white/5">
                {showControls && (
                    <button
                        onClick={togglePlay}
                        className="w-8 h-8 rounded-full flex items-center justify-center
                       bg-surface-light hover:bg-surface-lighter transition shrink-0 cursor-pointer"
                        style={{ color }}
                    >
                        {isPlaying ? (
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                <path d="M5.75 3a.75.75 0 00-.75.75v12.5c0 .414.336.75.75.75h1.5a.75.75 0 00.75-.75V3.75A.75.75 0 007.25 3h-1.5zM12.75 3a.75.75 0 00-.75.75v12.5c0 .414.336.75.75.75h1.5a.75.75 0 00.75-.75V3.75a.75.75 0 00-.75-.75h-1.5z" />
                            </svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                            </svg>
                        )}
                    </button>
                )}
                <div ref={containerRef} className="flex-1 min-w-0" />
            </div>
        </div>
    );
}
