import axios from "axios";
import type { Word, AnalysisResult, TTSResponse } from "../types";

const api = axios.create({
    baseURL: "/api",
    headers: { "Content-Type": "application/json" },
});

// ── JWT Interceptor ─────────────────────────────────────
api.interceptors.request.use((config) => {
    const token = localStorage.getItem("auth_token");
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

/* ─── Auth ────────────────────────────────────────────── */
export interface AuthUser {
    id: number;
    username: string;
    email: string;
}

export interface TokenResponse {
    access_token: string;
    token_type: string;
}

export async function registerUser(
    username: string,
    email: string,
    password: string
): Promise<AuthUser> {
    const { data } = await api.post<AuthUser>("/auth/register", {
        username,
        email,
        password,
    });
    return data;
}

export async function loginUser(
    username: string,
    password: string
): Promise<TokenResponse> {
    const { data } = await api.post<TokenResponse>("/auth/login", {
        username,
        password,
    });
    return data;
}

export async function fetchMe(): Promise<AuthUser> {
    const { data } = await api.get<AuthUser>("/auth/me");
    return data;
}

/* ─── Words ───────────────────────────────────────────── */
export async function fetchWords(
    difficulty?: string,
    category?: string
): Promise<Word[]> {
    const params: Record<string, string> = {};
    if (difficulty) params.difficulty = difficulty;
    if (category) params.category = category;
    const { data } = await api.get<Word[]>("/words/", { params });
    return data;
}

export async function fetchRandomWord(
    difficulty?: string,
    category?: string
): Promise<Word> {
    const params: Record<string, string> = {};
    if (difficulty) params.difficulty = difficulty;
    if (category) params.category = category;
    const { data } = await api.get<Word>("/words/random", { params });
    return data;
}

/* ─── Analysis ────────────────────────────────────────── */
export async function analyzePronounciation(
    wordId: number,
    transcription: string,
    confidence: number
): Promise<AnalysisResult> {
    const { data } = await api.post<AnalysisResult>("/analyze", {
        word_id: wordId,
        transcription,
        confidence,
    });
    return data;
}

/* ─── TTS ─────────────────────────────────────────────── */
export async function generateTTS(text: string): Promise<TTSResponse> {
    const { data } = await api.post<TTSResponse>("/tts/generate", { text });
    return data;
}

export function getTTSAudioUrl(cacheKey: string): string {
    return `/api/tts/audio/${cacheKey}`;
}

/* ─── Progress ────────────────────────────────────────── */
export interface ProgressItem {
    word_id: number;
    word_text: string;
    difficulty: string | null;
    attempts: number;
    best_score: number | null;
    mastered: boolean;
    last_practice: string | null;
}

export interface UserStats {
    total_words_practiced: number;
    total_attempts: number;
    average_score: number;
    words_mastered: number;
    best_score: number;
    current_streak: number;
    beginner_mastered: number;
    intermediate_mastered: number;
    advanced_mastered: number;
}

export interface HistoryItem {
    id: number;
    word_text: string;
    transcription: string | null;
    pronunciation_score: number | null;
    created_at: string | null;
}

export async function fetchProgress(): Promise<ProgressItem[]> {
    const { data } = await api.get<ProgressItem[]>("/progress/");
    return data;
}

export async function fetchStats(): Promise<UserStats> {
    const { data } = await api.get<UserStats>("/progress/stats");
    return data;
}

export async function fetchHistory(limit = 20): Promise<HistoryItem[]> {
    const { data } = await api.get<HistoryItem[]>("/progress/history", {
        params: { limit },
    });
    return data;
}

/* ─── Achievements ────────────────────────────────────── */
export interface AchievementItem {
    id: number;
    key: string;
    name: string;
    description: string;
    icon: string;
    category: string | null;
    unlocked: boolean;
    unlocked_at: string | null;
}

export async function fetchAchievements(): Promise<AchievementItem[]> {
    const { data } = await api.get<AchievementItem[]>("/achievements/");
    return data;
}

export default api;
