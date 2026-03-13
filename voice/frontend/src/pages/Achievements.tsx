import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import AchievementBadge from "../components/AchievementBadge";
import { useAuth } from "../context/AuthContext";
import { fetchAchievements, type AchievementItem } from "../services/api";

export default function Achievements() {
    const { user, isLoading: authLoading } = useAuth();
    const [achievements, setAchievements] = useState<AchievementItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState("all");

    useEffect(() => {
        const load = async () => {
            try {
                const data = await fetchAchievements();
                setAchievements(data);
            } catch (err) {
                console.error("Failed to load achievements:", err);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const categories = ["all", "practice", "mastery", "streak"];

    const filtered =
        filter === "all"
            ? achievements
            : achievements.filter((a) => a.category === filter);

    const unlockedCount = achievements.filter((a) => a.unlocked).length;

    // Not logged in
    if (!authLoading && !user) {
        return (
            <div className="min-h-screen flex flex-col">
                <Navbar />
                <main className="flex-1 flex items-center justify-center px-6">
                    <div className="glass-card p-12 max-w-md text-center space-y-4 animate-slide-up">
                        <p className="text-5xl">🏆</p>
                        <h2 className="text-2xl font-bold text-white">
                            Sign in to view achievements
                        </h2>
                        <p className="text-text-muted">
                            Track your badges and unlock achievements as you practice.
                        </p>
                        <Link
                            to="/login"
                            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl
                         bg-primary hover:bg-primary-light text-white font-medium transition cursor-pointer"
                        >
                            Sign In →
                        </Link>
                    </div>
                </main>
            </div>
        );
    }

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
                {/* Header */}
                <div className="flex items-center justify-between animate-slide-up">
                    <h1 className="text-3xl font-bold text-white">Achievements</h1>
                    <div className="glass-card px-4 py-2 text-sm">
                        <span className="text-amber-400 font-bold">{unlockedCount}</span>
                        <span className="text-text-muted">
                            /{achievements.length} unlocked
                        </span>
                    </div>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-surface-lighter rounded-full h-2 overflow-hidden animate-slide-up">
                    <div
                        className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-500"
                        style={{
                            width: `${achievements.length > 0 ? (unlockedCount / achievements.length) * 100 : 0}%`,
                        }}
                    />
                </div>

                {/* Category filter */}
                <div className="flex gap-2 flex-wrap animate-slide-up">
                    {categories.map((cat) => (
                        <button
                            key={cat}
                            onClick={() => setFilter(cat)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all cursor-pointer ${filter === cat
                                    ? "bg-primary/20 text-primary-light border border-primary/30"
                                    : "bg-surface-lighter text-text-muted hover:text-white"
                                }`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>

                {/* Achievement grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {filtered
                        .sort((a, b) => (a.unlocked === b.unlocked ? 0 : a.unlocked ? -1 : 1))
                        .map((a) => (
                            <AchievementBadge
                                key={a.id}
                                icon={a.icon}
                                name={a.name}
                                description={a.description}
                                unlocked={a.unlocked}
                                category={a.category}
                            />
                        ))}
                </div>

                {filtered.length === 0 && (
                    <div className="glass-card p-8 text-center">
                        <p className="text-text-muted">No achievements in this category</p>
                    </div>
                )}
            </main>
        </div>
    );
}
