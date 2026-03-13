/* ─── API Data Types ──────────────────────────────────── */

export interface Word {
    id: number;
    text: string;
    difficulty: "beginner" | "intermediate" | "advanced" | null;
    phonetic: string | null;
    category: string | null;
    audio_url: string | null;
}

export interface AnalysisResult {
    transcription: string;
    expected_text: string;
    pronunciation_score: number;
    confidence_score: number;
    feedback: Feedback;
}

export interface Feedback {
    overall: string;
    similarity_ratio: number;
    match: boolean;
    tips: string[];
    word_differences?: WordDiff[];
}

export interface WordDiff {
    expected: string;
    heard: string;
}

export interface RecordingOut {
    id: number;
    word_id: number;
    transcription: string | null;
    confidence_score: number | null;
    pronunciation_score: number | null;
    feedback: Feedback | null;
    created_at: string | null;
}

export interface TTSResponse {
    audio_url: string;
    cache_key: string;
}

/* ─── UI Types ────────────────────────────────────────── */
export type Difficulty = "beginner" | "intermediate" | "advanced";

export interface RecorderState {
    isRecording: boolean;
    isListening: boolean;
    transcript: string;
    confidence: number;
}
