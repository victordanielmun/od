import type { Word } from "../types";

interface WordCardProps {
    word: Word;
    onListen: () => void;
    isPlaying: boolean;
}

const difficultyColors: Record<string, string> = {
    beginner: "bg-green-500/20 text-green-400 border-green-500/30",
    intermediate: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    advanced: "bg-red-500/20 text-red-400 border-red-500/30",
};

export default function WordCard({ word, onListen, isPlaying }: WordCardProps) {
    const diffClass = word.difficulty
        ? difficultyColors[word.difficulty] ?? ""
        : "";

    return (
        <div className="glass-card p-8 animate-slide-up">
            {/* Difficulty badge */}
            {word.difficulty && (
                <span
                    className={`inline-block px-3 py-1 text-xs font-semibold uppercase tracking-wider rounded-full border mb-4 ${diffClass}`}
                >
                    {word.difficulty}
                </span>
            )}

            {/* Word text */}
            <h2 className="text-4xl font-bold text-white mb-2 tracking-tight">
                {word.text}
            </h2>

            {/* Phonetic */}
            {word.phonetic && (
                <p className="text-text-muted text-lg mb-6 font-mono">
                    {word.phonetic}
                </p>
            )}

            {/* Listen button */}
            <button
                onClick={onListen}
                disabled={isPlaying}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl
                   bg-primary/20 hover:bg-primary/30 text-primary-light
                   border border-primary/30 transition-all duration-200
                   hover:scale-105 active:scale-95 disabled:opacity-50
                   disabled:cursor-not-allowed cursor-pointer"
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className={`w-5 h-5 ${isPlaying ? "animate-pulse" : ""}`}
                >
                    <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 001.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06zM18.584 5.106a.75.75 0 011.06 0c3.808 3.807 3.808 9.98 0 13.788a.75.75 0 01-1.06-1.06 8.25 8.25 0 000-11.668.75.75 0 010-1.06z" />
                    <path d="M15.932 7.757a.75.75 0 011.061 0 6 6 0 010 8.486.75.75 0 01-1.06-1.061 4.5 4.5 0 000-6.364.75.75 0 010-1.06z" />
                </svg>
                {isPlaying ? "Playing..." : "Listen"}
            </button>
        </div>
    );
}
