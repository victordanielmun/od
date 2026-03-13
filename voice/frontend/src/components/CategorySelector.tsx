interface CategorySelectorProps {
    selected: string;
    onChange: (category: string) => void;
}

const CATEGORIES = [
    { value: "", label: "All" },
    { value: "vocabulary", label: "Vocabulary" },
    { value: "phrases", label: "Phrases" },
    { value: "sentences", label: "Sentences" },
    { value: "greetings", label: "Greetings" },
];

export default function CategorySelector({
    selected,
    onChange,
}: CategorySelectorProps) {
    return (
        <div className="flex gap-2 flex-wrap justify-center">
            {CATEGORIES.map((cat) => (
                <button
                    key={cat.value}
                    onClick={() => onChange(cat.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 cursor-pointer ${selected === cat.value
                        ? "bg-accent/20 text-accent border border-accent/30"
                        : "bg-surface-lighter text-text-muted hover:text-white hover:bg-surface-light"
                        }`}
                >
                    {cat.label}
                </button>
            ))}
        </div>
    );
}
