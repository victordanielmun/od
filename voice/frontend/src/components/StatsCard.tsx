interface StatsCardProps {
    icon: string;
    label: string;
    value: string | number;
    subtext?: string;
    color?: string;
}

export default function StatsCard({
    icon,
    label,
    value,
    subtext,
    color = "text-primary-light",
}: StatsCardProps) {
    return (
        <div className="glass-card p-5 flex flex-col items-center text-center hover:border-primary/20 transition-all duration-200 group">
            <span className="text-3xl mb-2 group-hover:scale-110 transition-transform">
                {icon}
            </span>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-sm text-text-muted mt-1">{label}</p>
            {subtext && (
                <p className="text-xs text-text-muted/60 mt-0.5">{subtext}</p>
            )}
        </div>
    );
}
