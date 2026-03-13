import {
    createContext,
    useContext,
    useState,
    useEffect,
    useCallback,
    type ReactNode,
} from "react";
import {
    loginUser,
    registerUser,
    fetchMe,
    type AuthUser,
} from "../services/api";

interface AuthContextType {
    user: AuthUser | null;
    isLoading: boolean;
    login: (username: string, password: string) => Promise<void>;
    register: (username: string, email: string, password: string) => Promise<void>;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // ── Restore session on mount ──────────────────────────
    useEffect(() => {
        const token = localStorage.getItem("auth_token");
        if (!token) {
            setIsLoading(false);
            return;
        }
        fetchMe()
            .then(setUser)
            .catch(() => localStorage.removeItem("auth_token"))
            .finally(() => setIsLoading(false));
    }, []);

    const login = useCallback(async (username: string, password: string) => {
        const { access_token } = await loginUser(username, password);
        localStorage.setItem("auth_token", access_token);
        const me = await fetchMe();
        setUser(me);
    }, []);

    const register = useCallback(
        async (username: string, email: string, password: string) => {
            await registerUser(username, email, password);
            // Auto-login after register
            await login(username, password);
        },
        [login]
    );

    const logout = useCallback(() => {
        localStorage.removeItem("auth_token");
        setUser(null);
    }, []);

    return (
        <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth(): AuthContextType {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used within AuthProvider");
    return ctx;
}
