import { useEffect, useState } from "react";

interface AchievementToastProps {
    achievement: {
        icon: string;
        name: string;
        description: string;
    };
    onDismiss: () => void;
}

export default function AchievementToast({
    achievement,
    onDismiss,
}: AchievementToastProps) {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        // Mount animation
        requestAnimationFrame(() => setVisible(true));

        // Auto-dismiss after 5s
        const timer = setTimeout(() => {
            setVisible(false);
            setTimeout(onDismiss, 300);
        }, 5000);

        return () => clearTimeout(timer);
    }, [onDismiss]);

    return (
        <div
            className={`fixed top-6 right-6 z-50 transition-all duration-300 ${visible
                    ? "translate-x-0 opacity-100"
                    : "translate-x-full opacity-0"
                }`}
        >
            <div className="glass-card p-4 flex items-center gap-4 border-l-4 border-amber-400 min-w-[280px]
                      shadow-[0_0_30px_rgba(245,158,11,0.15)]">
                <span className="text-4xl animate-float">{achievement.icon}</span>
                <div>
                    <p className="text-xs text-amber-400 uppercase font-bold tracking-wide">
                        🏆 Achievement Unlocked!
                    </p>
                    <p className="text-white font-semibold text-sm mt-0.5">
                        {achievement.name}
                    </p>
                    <p className="text-text-muted text-xs mt-0.5">
                        {achievement.description}
                    </p>
                </div>
                <button
                    onClick={() => {
                        setVisible(false);
                        setTimeout(onDismiss, 300);
                    }}
                    className="text-text-muted hover:text-white transition ml-2 shrink-0 cursor-pointer"
                >
                    ✕
                </button>
            </div>
        </div>
    );
}
