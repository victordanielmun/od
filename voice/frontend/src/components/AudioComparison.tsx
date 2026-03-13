import Waveform from "./Waveform";

interface AudioComparisonProps {
    referenceUrl: string;
    userUrl: string;
    score?: number;
}

export default function AudioComparison({
    referenceUrl,
    userUrl,
    score,
}: AudioComparisonProps) {
    const scoreColor =
        score !== undefined
            ? score >= 80
                ? "#4ade80"
                : score >= 60
                    ? "#fbbf24"
                    : "#f87171"
            : "#818cf8";

    return (
        <div className="glass-card p-5 space-y-4 animate-slide-up">
            <div className="flex items-center justify-between">
                <h3 className="text-sm text-white font-semibold flex items-center gap-2">
                    〰️ Audio Comparison
                </h3>
                {score !== undefined && (
                    <span
                        className="text-xs font-bold px-2 py-0.5 rounded-md"
                        style={{
                            color: scoreColor,
                            backgroundColor: scoreColor + "15",
                            border: `1px solid ${scoreColor}30`,
                        }}
                    >
                        Match: {Math.round(score)}%
                    </span>
                )}
            </div>

            <p className="text-xs text-text-muted -mt-2">
                Compare the waveforms — listen to each and notice differences in rhythm, stress, and intonation.
            </p>

            {/* Reference waveform */}
            <Waveform
                audioUrl={referenceUrl}
                label="🔊 Correct Pronunciation"
                color="#6366f1"
                progressColor="#818cf8"
                height={50}
            />

            {/* Divider with arrow */}
            <div className="flex items-center gap-3 px-2">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-text-muted/40 text-xs">VS</span>
                <div className="flex-1 h-px bg-white/10" />
            </div>

            {/* User waveform */}
            <Waveform
                audioUrl={userUrl}
                label="🎙️ Your Pronunciation"
                color={scoreColor}
                progressColor={scoreColor}
                height={50}
            />

            {/* Tips */}
            <div className="mt-2 p-3 rounded-lg bg-surface-lighter/30 border border-white/5">
                <p className="text-[11px] text-text-muted leading-relaxed">
                    <span className="text-primary-light font-semibold">💡 Tip: </span>
                    Play both audio tracks one after the other. Pay attention to where the wave pattern
                    differs — tall peaks = louder sounds, wider sections = longer syllables. Try to match
                    the reference rhythm and stress pattern.
                </p>
            </div>
        </div>
    );
}
