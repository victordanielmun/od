import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";

export default function Home() {
    return (
        <div className="min-h-screen flex flex-col">
            <Navbar />

            {/* Hero */}
            <main className="flex-1 flex items-center justify-center px-6">
                <div className="max-w-2xl text-center space-y-8 animate-slide-up">
                    {/* Floating mic */}
                    <div className="animate-float mx-auto w-28 h-28 rounded-full bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center shadow-[0_0_60px_rgba(99,102,241,0.35)]">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="white"
                            className="w-14 h-14"
                        >
                            <path d="M8.25 4.5a3.75 3.75 0 117.5 0v8.25a3.75 3.75 0 11-7.5 0V4.5z" />
                            <path d="M6 10.5a.75.75 0 01.75.75v1.5a5.25 5.25 0 1010.5 0v-1.5a.75.75 0 011.5 0v1.5a6.751 6.751 0 01-6 6.709v2.291h3a.75.75 0 010 1.5h-7.5a.75.75 0 010-1.5h3v-2.291a6.751 6.751 0 01-6-6.709v-1.5A.75.75 0 016 10.5z" />
                        </svg>
                    </div>

                    <h1 className="text-5xl sm:text-6xl font-extrabold text-white leading-tight">
                        Master Your{" "}
                        <span className="bg-gradient-to-r from-primary-light via-accent to-primary bg-clip-text text-transparent">
                            English Pronunciation
                        </span>
                    </h1>

                    <p className="text-lg text-text-muted max-w-lg mx-auto">
                        Listen, speak, and get instant AI-powered feedback. Practice words
                        and phrases across different difficulty levels.
                    </p>

                    {/* CTA */}
                    <Link
                        to="/practice"
                        className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl
                       bg-gradient-to-r from-primary to-primary-dark text-white
                       font-semibold text-lg shadow-[0_0_30px_rgba(99,102,241,0.3)]
                       hover:shadow-[0_0_50px_rgba(99,102,241,0.45)]
                       hover:scale-105 active:scale-95 transition-all duration-200"
                    >
                        Start Practicing
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            className="w-5 h-5"
                        >
                            <path
                                fillRule="evenodd"
                                d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z"
                                clipRule="evenodd"
                            />
                        </svg>
                    </Link>

                    {/* Features grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-8">
                        {[
                            {
                                icon: "🎯",
                                title: "50+ Words",
                                desc: "Curated vocabulary across 3 difficulty levels",
                            },
                            {
                                icon: "⚡",
                                title: "Instant Feedback",
                                desc: "Real-time pronunciation scoring",
                            },
                            {
                                icon: "📈",
                                title: "Track Progress",
                                desc: "Monitor your improvement over time",
                            },
                        ].map((f) => (
                            <div
                                key={f.title}
                                className="glass-card p-5 text-center hover:border-primary/20 transition-colors"
                            >
                                <p className="text-3xl mb-2">{f.icon}</p>
                                <h3 className="text-white font-semibold mb-1">{f.title}</h3>
                                <p className="text-text-muted text-sm">{f.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </main>
        </div>
    );
}
