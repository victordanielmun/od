import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
    const { user, logout } = useAuth();
    const location = useLocation();

    const isActive = (path: string) =>
        location.pathname === path ? "text-white font-medium" : "text-text-muted hover:text-white";

    return (
        <nav className="flex items-center justify-between px-6 py-4 border-b border-white/5">
            <Link to="/" className="text-xl font-bold text-white tracking-tight">
                🎙️{" "}
                <span className="bg-gradient-to-r from-primary-light to-accent bg-clip-text text-transparent">
                    PronounceIt
                </span>
            </Link>

            <div className="flex items-center gap-4">
                <Link to="/practice" className={`text-sm transition ${isActive("/practice")}`}>
                    Practice
                </Link>
                <Link to="/progress" className={`text-sm transition ${isActive("/progress")}`}>
                    Progress
                </Link>
                <Link to="/achievements" className={`text-sm transition ${isActive("/achievements")}`}>
                    🏆
                </Link>

                {user ? (
                    <div className="flex items-center gap-3 ml-2 pl-4 border-l border-white/10">
                        <span className="text-sm text-primary-light font-medium">
                            {user.username}
                        </span>
                        <button
                            onClick={logout}
                            className="text-xs text-text-muted hover:text-danger transition cursor-pointer"
                        >
                            Logout
                        </button>
                    </div>
                ) : (
                    <Link
                        to="/login"
                        className="ml-2 px-4 py-1.5 rounded-lg bg-primary/20 text-primary-light text-sm
                       font-medium hover:bg-primary/30 transition cursor-pointer border border-primary/30"
                    >
                        Sign In
                    </Link>
                )}
            </div>
        </nav>
    );
}
