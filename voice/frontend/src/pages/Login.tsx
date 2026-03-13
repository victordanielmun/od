import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Login() {
    const { login, register } = useAuth();
    const navigate = useNavigate();

    const [isRegister, setIsRegister] = useState(false);
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);
        try {
            if (isRegister) {
                await register(username, email, password);
            } else {
                await login(username, password);
            }
            navigate("/practice");
        } catch (err: any) {
            const msg =
                err?.response?.data?.detail || "Something went wrong. Try again.";
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col">
            {/* Nav */}
            <nav className="flex items-center justify-between px-6 py-4 border-b border-white/5">
                <Link to="/" className="text-xl font-bold text-white tracking-tight">
                    🎙️{" "}
                    <span className="bg-gradient-to-r from-primary-light to-accent bg-clip-text text-transparent">
                        PronounceIt
                    </span>
                </Link>
            </nav>

            <main className="flex-1 flex items-center justify-center px-4">
                <div className="glass-card p-8 w-full max-w-md animate-slide-up">
                    {/* Toggle */}
                    <div className="flex rounded-xl overflow-hidden mb-8 bg-surface-lighter">
                        <button
                            onClick={() => setIsRegister(false)}
                            className={`flex-1 py-3 text-sm font-semibold transition-all cursor-pointer ${!isRegister
                                    ? "bg-primary text-white"
                                    : "text-text-muted hover:text-white"
                                }`}
                        >
                            Sign In
                        </button>
                        <button
                            onClick={() => setIsRegister(true)}
                            className={`flex-1 py-3 text-sm font-semibold transition-all cursor-pointer ${isRegister
                                    ? "bg-primary text-white"
                                    : "text-text-muted hover:text-white"
                                }`}
                        >
                            Sign Up
                        </button>
                    </div>

                    <h2 className="text-2xl font-bold text-white mb-6 text-center">
                        {isRegister ? "Create your account" : "Welcome back"}
                    </h2>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Username */}
                        <div>
                            <label className="block text-xs text-text-muted uppercase tracking-wide mb-1">
                                Username
                            </label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                required
                                autoComplete="username"
                                className="w-full px-4 py-3 rounded-xl bg-surface-lighter border border-white/5
                           text-white placeholder-text-muted/50 focus:outline-none
                           focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition"
                                placeholder="your_username"
                            />
                        </div>

                        {/* Email (register only) */}
                        {isRegister && (
                            <div className="animate-slide-up">
                                <label className="block text-xs text-text-muted uppercase tracking-wide mb-1">
                                    Email
                                </label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    className="w-full px-4 py-3 rounded-xl bg-surface-lighter border border-white/5
                             text-white placeholder-text-muted/50 focus:outline-none
                             focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition"
                                    placeholder="you@example.com"
                                />
                            </div>
                        )}

                        {/* Password */}
                        <div>
                            <label className="block text-xs text-text-muted uppercase tracking-wide mb-1">
                                Password
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                minLength={4}
                                autoComplete={isRegister ? "new-password" : "current-password"}
                                className="w-full px-4 py-3 rounded-xl bg-surface-lighter border border-white/5
                           text-white placeholder-text-muted/50 focus:outline-none
                           focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition"
                                placeholder="••••••••"
                            />
                        </div>

                        {/* Error */}
                        {error && (
                            <p className="text-sm text-danger bg-danger/10 px-4 py-2 rounded-xl">
                                {error}
                            </p>
                        )}

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3 rounded-xl bg-primary hover:bg-primary-light
                         text-white font-semibold transition-all duration-200 cursor-pointer
                         shadow-[0_0_20px_rgba(99,102,241,0.2)]
                         hover:shadow-[0_0_30px_rgba(99,102,241,0.35)]
                         disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading
                                ? "..."
                                : isRegister
                                    ? "Create Account"
                                    : "Sign In"}
                        </button>
                    </form>

                    <p className="text-center text-text-muted text-sm mt-6">
                        {isRegister ? "Already have an account? " : "Don't have an account? "}
                        <button
                            onClick={() => {
                                setIsRegister(!isRegister);
                                setError("");
                            }}
                            className="text-primary-light hover:underline cursor-pointer"
                        >
                            {isRegister ? "Sign In" : "Sign Up"}
                        </button>
                    </p>
                </div>
            </main>
        </div>
    );
}
