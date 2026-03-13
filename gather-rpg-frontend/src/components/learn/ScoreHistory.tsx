import type { HistoryItem } from "../services/api";

interface ScoreHistoryProps {
    history: HistoryItem[];
}

export default function ScoreHistory({ history }: ScoreHistoryProps) {
    if (history.length === 0) {
        return (
            <div className="glass-card p-6 text-center text-text-muted">
                <p>No practice history yet. Start practicing to see your progress!</p>
            </div>
        );
    }

    const scores = history
        .filter((h) => h.pronunciation_score !== null)
        .reverse() // oldest first for chart
        .slice(-20);

    if (scores.length === 0) return null;

    const maxScore = 100;
    const chartW = 100; // SVG viewBox width percentage
    const chartH = 60;
    const padding = 5;

    const points = scores.map((s, i) => {
        const x = padding + (i / Math.max(scores.length - 1, 1)) * (chartW - padding * 2);
        const y = chartH - padding - ((s.pronunciation_score ?? 0) / maxScore) * (chartH - padding * 2);
        return { x, y, score: s.pronunciation_score ?? 0, word: s.word_text };
    });

    const polyline = points.map((p) => `${p.x},${p.y}`).join(" ");

    // Gradient fill area
    const areaPath = `M${points[0].x},${chartH - padding} ${points
        .map((p) => `L${p.x},${p.y}`)
        .join(" ")} L${points[points.length - 1].x},${chartH - padding} Z`;

    return (
        <div className="glass-card p-6">
            <h3 className="text-sm text-text-muted uppercase tracking-wide mb-4 font-semibold">
                Score History
            </h3>

            <svg
                viewBox={`0 0 ${chartW} ${chartH}`}
                className="w-full h-48"
                preserveAspectRatio="none"
            >
                <defs>
                    <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgb(99,102,241)" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="rgb(99,102,241)" stopOpacity="0" />
                    </linearGradient>
                </defs>

                {/* Grid lines */}
                {[25, 50, 75].map((v) => {
                    const gy =
                        chartH -
                        padding -
                        (v / maxScore) * (chartH - padding * 2);
                    return (
                        <line
                            key={v}
                            x1={padding}
                            y1={gy}
                            x2={chartW - padding}
                            y2={gy}
                            stroke="rgba(255,255,255,0.05)"
                            strokeWidth="0.3"
                        />
                    );
                })}

                {/* Fill area */}
                <path d={areaPath} fill="url(#scoreGrad)" />

                {/* Line */}
                <polyline
                    points={polyline}
                    fill="none"
                    stroke="rgb(99,102,241)"
                    strokeWidth="0.8"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                />

                {/* Dots */}
                {points.map((p, i) => (
                    <circle
                        key={i}
                        cx={p.x}
                        cy={p.y}
                        r="1"
                        fill="rgb(129,140,248)"
                        className="hover:r-2 transition-all"
                    >
                        <title>
                            {p.word}: {p.score}%
                        </title>
                    </circle>
                ))}
            </svg>

            {/* Legend */}
            <div className="flex justify-between text-xs text-text-muted/60 mt-2 px-1">
                <span>Oldest</span>
                <span>Most recent</span>
            </div>
        </div>
    );
}
