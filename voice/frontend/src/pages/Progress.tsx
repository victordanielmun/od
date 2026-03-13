import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import StatsCard from "../components/StatsCard";
import ScoreHistory from "../components/ScoreHistory";
import { useAuth } from "../context/AuthContext";
import {
    fetchStats,
    fetchHistory,
    type UserStats,
    type HistoryItem,
} from "../services/api";

export default function Progress() {
    const { user, isLoading: authLoading } = useAuth();
    const [stats, setStats] = useState<UserStats | null>(null);
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) {
            setLoading(false);
            return;
        }
        const load = async () => {
            try {
                const [s, h] = await Promise.all([fetchStats(), fetchHistory(30)]);
                setStats(s);
                setHistory(h);
            } catch (err) {
                console.error("Failed to load progress:", err);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [user]);

    // ── Not logged in ──────────────────────────────────────
    if (!authLoading && !user) {
        return (
            <div className="min-h-screen flex flex-col">
                <Navbar />
                <main className="flex-1 flex items-center justify-center px-6">
                    <div className="glass-card p-12 max-w-md text-center space-y-4 animate-slide-up">
                        <p className="text-5xl">🔒</p>
                        <h2 className="text-2xl font-bold text-white">
                            Sign in to track your progress
                        </h2>
                        <p className="text-text-muted">
                            Create an account to save your practice history, track improvement, and set personal goals.
                        </p>
                        <Link
                            to="/login"
                            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl
                         bg-primary hover:bg-primary-light text-white font-medium
                         transition-all duration-200 cursor-pointer"
                        >
                            Sign In →
                        </Link>
                    </div>
                </main>
            </div>
        );
    }

    // ── Loading ────────────────────────────────────────────
    if (loading) {
        return (
            <div className="min-h-screen flex flex-col">
                <Navbar />
                <main className="flex-1 flex items-center justify-center">
                    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </main>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col">
            <Navbar />

            <main className="flex-1 px-4 py-8 max-w-3xl mx-auto w-full space-y-6">
                <h1 className="text-3xl font-bold text-white animate-slide-up">
                    Your Progress
                </h1>

                {/* Stats grid */}
                {stats && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 animate-slide-up">
                        <StatsCard
                            icon="📝"
                            label="Words Practiced"
                            value={stats.total_words_practiced}
                        />
                        <StatsCard
                            icon="🔁"
                            label="Total Attempts"
                            value={stats.total_attempts}
                        />
                        <StatsCard
                            icon="⭐"
                            label="Average Score"
                            value={`${stats.average_score}%`}
                            color="text-accent"
                        />
                        <StatsCard
                            icon="🔥"
                            label="Day Streak"
                            value={stats.current_streak}
                            color="text-orange-400"
                        />
                    </div>
                )}

                {/* Mastery breakdown */}
                {stats && stats.words_mastered > 0 && (
                    <div className="glass-card p-6 animate-slide-up">
                        <h3 className="text-sm text-text-muted uppercase tracking-wide mb-4 font-semibold">
                            Words Mastered ({stats.words_mastered})
                        </h3>
                        <div className="grid grid-cols-3 gap-4">
                            <div className="text-center">
                                <p className="text-2xl font-bold text-green-400">{stats.beginner_mastered}</p>
                                <p className="text-xs text-text-muted">Beginner</p>
                            </div>
                            <div className="text-center">
                                <p className="text-2xl font-bold text-amber-400">{stats.intermediate_mastered}</p>
                                <p className="text-xs text-text-muted">Intermediate</p>
                            </div>
                            <div className="text-center">
                                <p className="text-2xl font-bold text-red-400">{stats.advanced_mastered}</p>
                                <p className="text-xs text-text-muted">Advanced</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Score history chart */}
                <div className="animate-slide-up">
                    <ScoreHistory history={history} />
                </div>

                {/* Recent history table */}
                {history.length > 0 && (
                    <div className="glass-card p-6 animate-slide-up">
                        <h3 className="text-sm text-text-muted uppercase tracking-wide mb-4 font-semibold">
                            Recent Activity
                        </h3>
                        <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
                            {history.map((h) => (
                                <div
                                    key={h.id}
                                    className="flex items-center justify-between p-3 rounded-xl bg-surface-lighter/40 border border-white/5"
                                >
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm text-white font-medium truncate">
                                            {h.word_text}
                                        </p>
                                        {h.transcription && (
                                            <p className="text-xs text-text-muted truncate">
                                                You said: "{h.transcription}"
                                            </p>
                                        )}
                                    </div>
                                    <div className="ml-3 text-right">
                                        {h.pronunciation_score !== null && (
                                            <span
                                                className={`text-sm font-bold ${h.pronunciation_score >= 80
                                                        ? "text-green-400"
                                                        : h.pronunciation_score >= 60
                                                            ? "text-amber-400"
                                                            : "text-red-400"
                                                    }`}
                                            >
                                                {Math.round(h.pronunciation_score)}%
                                            </span>
                                        )}
                                        {h.created_at && (
                                            <p className="text-xs text-text-muted/60">
                                                {new Date(h.created_at).toLocaleDateString()}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Empty state */}
                {stats && stats.total_attempts === 0 && (
                    <div className="glass-card p-12 text-center animate-slide-up">
                        <p className="text-5xl mb-4">🎯</p>
                        <h3 className="text-xl font-bold text-white mb-2">No practice yet</h3>
                        <p className="text-text-muted mb-4">Start practicing to see your progress here!</p>
                        <Link
                            to="/practice"
                            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl
                         bg-primary hover:bg-primary-light text-white font-medium
                         transition-all duration-200 cursor-pointer"
                        >
                            Start Practicing →
                        </Link>
                    </div>
                )}
            </main>
        </div>
    );
}
