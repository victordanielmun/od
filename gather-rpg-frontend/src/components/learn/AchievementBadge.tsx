interface AchievementBadgeProps {
    icon: string;
    name: string;
    description: string;
    unlocked: boolean;
    category?: string | null;
    size?: "sm" | "md" | "lg";
}

export default function AchievementBadge({
    icon,
    name,
    description,
    unlocked,
    category,
    size = "md",
}: AchievementBadgeProps) {
    const sizeClasses = {
        sm: "p-3",
        md: "p-4",
        lg: "p-6",
    };

    const iconSizes = {
        sm: "text-2xl",
        md: "text-3xl",
        lg: "text-5xl",
    };

    const categoryColors: Record<string, string> = {
        practice: "text-blue-400",
        mastery: "text-amber-400",
        streak: "text-orange-400",
        special: "text-purple-400",
    };

    return (
        <div
            className={`glass-card ${sizeClasses[size]} text-center transition-all duration-300
        ${unlocked
                    ? "hover:border-primary/20 hover:scale-105 cursor-default"
                    : "opacity-40 grayscale"
                }`}
        >
            <p className={`${iconSizes[size]} mb-2 ${unlocked ? "animate-float" : ""}`}>
                {unlocked ? icon : "🔒"}
            </p>
            <h4 className={`font-semibold text-white ${size === "sm" ? "text-xs" : "text-sm"}`}>
                {name}
            </h4>
            <p className={`text-text-muted mt-1 ${size === "sm" ? "text-[10px]" : "text-xs"}`}>
                {description}
            </p>
            {category && (
                <span
                    className={`text-[10px] uppercase tracking-wider mt-2 inline-block ${categoryColors[category] || "text-text-muted"
                        }`}
                >
                    {category}
                </span>
            )}
        </div>
    );
}
