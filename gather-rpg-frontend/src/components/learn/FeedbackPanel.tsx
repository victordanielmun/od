import type { AnalysisResult } from "../types";

interface FeedbackPanelProps {
    result: AnalysisResult;
    onTryAgain: () => void;
    onNextWord: () => void;
}

interface WordAnalysis {
    expected: string;
    heard: string;
    text_match: boolean;
    text_similarity: number;
    phonetic_similarity: number;
    phonetically_close: boolean;
}

function ScoreRing({ score }: { score: number }) {
    const radius = 45;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (score / 100) * circumference;

    const color =
        score >= 80
            ? "#22c55e"
            : score >= 60
                ? "#f59e0b"
                : score >= 40
                    ? "#f97316"
                    : "#ef4444";

    return (
        <div className="relative w-36 h-36">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle
                    cx="50"
                    cy="50"
                    r={radius}
                    fill="none"
                    stroke="rgba(255,255,255,0.05)"
                    strokeWidth="8"
                />
                <circle
                    cx="50"
                    cy="50"
                    r={radius}
                    fill="none"
                    stroke={color}
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    className="transition-all duration-1000 ease-out"
                    style={{ animation: "score-fill 1.2s ease-out" }}
                />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold text-white">{Math.round(score)}</span>
                <span className="text-xs text-text-muted">/ 100</span>
            </div>
        </div>
    );
}

function WordHighlight({ words }: { words: WordAnalysis[] }) {
    return (
        <div className="p-4 rounded-xl bg-surface-lighter/40 border border-white/5">
            <p className="text-xs text-text-muted uppercase tracking-wide mb-3 font-semibold">
                Word-by-word result
            </p>
            <div className="flex flex-wrap gap-2">
                {words.map((w, i) => {
                    const isCorrect = w.text_match;
                    const isClose = !isCorrect && w.phonetically_close;
                    const isMissing = w.expected === "(missing)" || w.heard === "(missing)";

                    let bgColor: string;
                    let textColor: string;
                    let borderColor: string;
                    let icon: string;

                    if (isCorrect) {
                        bgColor = "rgba(34,197,94,0.1)";
                        textColor = "#4ade80";
                        borderColor = "rgba(34,197,94,0.2)";
                        icon = "✓";
                    } else if (isClose) {
                        bgColor = "rgba(251,191,36,0.1)";
                        textColor = "#fbbf24";
                        borderColor = "rgba(251,191,36,0.2)";
                        icon = "~";
                    } else {
                        bgColor = "rgba(248,113,113,0.1)";
                        textColor = "#f87171";
                        borderColor = "rgba(248,113,113,0.2)";
                        icon = "✗";
                    }

                    return (
                        <div
                            key={i}
                            className="group relative flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg transition-all duration-200 cursor-default"
                            style={{
                                backgroundColor: bgColor,
                                border: `1px solid ${borderColor}`,
                            }}
                        >
                            {/* Correct word */}
                            <span
                                className="text-sm font-semibold"
                                style={{ color: textColor }}
                            >
                                {w.expected}
                            </span>

                            {/* What was heard (only if different) */}
                            {!isCorrect && !isMissing && (
                                <span className="text-[10px] text-text-muted/60 line-through">
                                    {w.heard}
                                </span>
                            )}
                            {isMissing && w.heard === "(missing)" && (
                                <span className="text-[10px] text-red-400/60">skipped</span>
                            )}
                            {isMissing && w.expected === "(missing)" && (
                                <span className="text-[10px] text-amber-400/60">extra</span>
                            )}

                            {/* Icon badge */}
                            <span
                                className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold"
                                style={{
                                    backgroundColor: bgColor,
                                    color: textColor,
                                    border: `1px solid ${borderColor}`,
                                }}
                            >
                                {icon}
                            </span>
                        </div>
                    );
                })}
            </div>

            {/* Legend */}
            <div className="flex gap-4 mt-3 pt-2 border-t border-white/5">
                <span className="flex items-center gap-1 text-[10px] text-green-400/70">
                    <span className="w-2 h-2 rounded-full bg-green-400/40" /> Correct
                </span>
                <span className="flex items-center gap-1 text-[10px] text-amber-400/70">
                    <span className="w-2 h-2 rounded-full bg-amber-400/40" /> Close
                </span>
                <span className="flex items-center gap-1 text-[10px] text-red-400/70">
                    <span className="w-2 h-2 rounded-full bg-red-400/40" /> Wrong
                </span>
            </div>
        </div>
    );
}

export default function FeedbackPanel({
    result,
    onTryAgain,
    onNextWord,
}: FeedbackPanelProps) {
    const { feedback, pronunciation_score } = result;
    const wordAnalysis: WordAnalysis[] | undefined = feedback.word_analysis;

    return (
        <div className="glass-card p-8 animate-slide-up space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-center gap-6">
                <ScoreRing score={pronunciation_score} />
                <div className="text-center sm:text-left">
                    <h3 className="text-2xl font-bold text-white mb-1">
                        {feedback.overall}
                    </h3>
                    <p className="text-text-muted text-sm">
                        Similarity: {(feedback.similarity_ratio * 100).toFixed(0)}%
                    </p>
                </div>
            </div>

            {/* Comparison: Expected vs You said */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-surface-lighter/60 border border-white/5">
                    <p className="text-xs text-text-muted uppercase tracking-wide mb-1">
                        Expected
                    </p>
                    <p className="text-white font-medium">{result.expected_text}</p>
                </div>
                <div className="p-4 rounded-xl bg-surface-lighter/60 border border-white/5">
                    <p className="text-xs text-text-muted uppercase tracking-wide mb-1">
                        You said
                    </p>
                    <p className="text-white font-medium">
                        {result.transcription || "—"}
                    </p>
                </div>
            </div>

            {/* ── Word-by-word color-coded result ── */}
            {wordAnalysis && wordAnalysis.length > 0 && (
                <WordHighlight words={wordAnalysis} />
            )}

            {/* Tips */}
            {feedback.tips.length > 0 && (
                <div className="space-y-2">
                    <p className="text-xs uppercase tracking-wide text-text-muted font-semibold">
                        Tips
                    </p>
                    <ul className="space-y-1">
                        {feedback.tips.map((tip: string, i: number) => (
                            <li
                                key={i}
                                className="flex items-start gap-2 text-sm text-text-muted"
                            >
                                <span className="text-accent mt-0.5">💡</span>
                                <span>{tip}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
                <button
                    onClick={onTryAgain}
                    className="flex-1 py-3 rounded-xl bg-surface-lighter hover:bg-surface-light
                     text-white font-medium transition-all duration-200
                     border border-white/5 hover:border-white/10 cursor-pointer"
                >
                    🔄 Try Again
                </button>
                <button
                    onClick={onNextWord}
                    className="flex-1 py-3 rounded-xl bg-primary hover:bg-primary-light
                     text-white font-medium transition-all duration-200 cursor-pointer
                     shadow-[0_0_20px_rgba(99,102,241,0.2)] hover:shadow-[0_0_30px_rgba(99,102,241,0.35)]"
                >
                    Next Word →
                </button>
            </div>
        </div>
    );
}
