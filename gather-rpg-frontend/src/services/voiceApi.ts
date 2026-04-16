/// <reference types="vite/client" />

/**
 * Voice API service for the Learning Module.
 * Points to the Voice Backend on port 8000.
 * Uses the Gather RPG JWT token (stored as 'token' in localStorage).
 */

import axios from 'axios';
import gatherApi from './api';

const VOICE_API_BASE = import.meta.env.VITE_VOICE_API_URL && import.meta.env.VITE_VOICE_API_URL !== "" 
    ? import.meta.env.VITE_VOICE_API_URL 
    : '/voice';

console.log('[VoiceApi] Base URL:', VOICE_API_BASE);

const voiceApi = axios.create({
    baseURL: VOICE_API_BASE,
    headers: { 'Content-Type': 'application/json' },
});

// Use the Gather token (stored as 'token', not 'auth_token')
voiceApi.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export default voiceApi;

/* ─── Challenges (Formerly Words) ──────────────────────── */
export interface LearningChallenge {
    id: string;
    type: string;
    question: string;
    question_es?: string;
    option_1: string;
    option_2: string;
    option_3: string;
    correct_option: number;
    explanation_es?: string;
    difficulty: 'beginner' | 'intermediate' | 'advanced' | null;
    tags: string[];
    phonetic: string | null;
    audio_url: string | null;
}

export async function fetchRandomWord(difficulty?: string, type: string = 'pronunciation'): Promise<any> {
    const params: Record<string, string> = { type };
    if (difficulty) params.difficulty = difficulty;
    
    // Redirected to Go Backend (gatherApi) mapped to the new schema
    const { data } = await gatherApi.get<LearningChallenge>('/learning/challenges/random', { params });
    
    return {
        ...data,
        text: data.question,
        category: data.tags && data.tags.length > 0 ? data.tags[0] : null,
        phonetic: data.phonetic || null,
    };
}

export async function fetchWords(difficulty?: string, type: string = 'pronunciation'): Promise<LearningChallenge[]> {
    const params: Record<string, string> = { type };
    if (difficulty) params.difficulty = difficulty;
    // We haven't implemented listing in Go yet, so this will throw a 404/500 if used. 
    // PracticePage only uses fetchRandomWord right now.
    const { data } = await gatherApi.get<LearningChallenge[]>('/api/v1/learning/challenges', { params });
    return data;
}

/* ─── Analysis ────────────────────────────────────────── */
export interface Feedback {
    overall: string;
    similarity_ratio: number;
    match: boolean;
    tips: string[];
    word_differences?: { expected: string; heard: string }[];
}

export interface AnalysisResult {
    transcription: string;
    expected_text: string;
    pronunciation_score: number;
    confidence_score: number;
    feedback: Feedback;
}

export async function analyzePronunciation(
    wordId: number,
    transcription: string,
    confidence: number
): Promise<AnalysisResult> {
    const { data } = await voiceApi.post<AnalysisResult>('/api/analyze', {
        word_id: wordId,
        transcription,
        confidence,
    });
    return data;
}

// Send audio blob + challenge_id to backend for pronunciation scoring
export async function analyzeAudio(audioBlob: Blob, challengeId: string): Promise<AnalysisResult> {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');
    formData.append('challenge_id', challengeId.toString());

    // Still hits Python Voice API because this is AI transcription/scoring
    const { data } = await voiceApi.post<AnalysisResult>('/api/analyze/audio', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
}

/* ─── TTS ─────────────────────────────────────────────── */
export interface TTSResponse {
    audio_url: string;
    cache_key: string;
}

export async function generateTTS(text: string, voice?: string): Promise<TTSResponse> {
    const { data } = await voiceApi.post<TTSResponse>('/api/tts/generate', { text, voice });
    
    // Prefix with /voice if needed to ensure Vite proxy picks it up
    if (data.audio_url && data.audio_url.startsWith('/api')) {
        const prefix = (VOICE_API_BASE === '/api' || !VOICE_API_BASE) ? '/voice' : VOICE_API_BASE;
        data.audio_url = `${prefix}${data.audio_url}`;
    }
    
    console.log('[VoiceApi] Generated TTS URL:', data.audio_url);
    return data;
}

export function getTTSAudioUrl(cacheKey: string): string {
    // Force /voice prefix if VOICE_API_BASE is empty or /api (Go backend)
    const base = (VOICE_API_BASE === '/api' || !VOICE_API_BASE) ? '/voice' : VOICE_API_BASE;
    return `${base}/api/tts/audio/${cacheKey}`;
}

/* ─── Learning Progress (Go Backend) ──────────────────── */
export async function submitChallengeAttempt(
    challengeId: string, 
    isCorrect: boolean, 
    feedbackAi: string,
    selectedOption: number = 0
) {
    // Note: We use the local `gatherApi` instance (Go Backend) instead of `voiceApi` 
    // to track progress since the Go backend holds the UserLearningProfile.
    const { data } = await gatherApi.post('/learning/attempts', {
        challenge_id: challengeId,
        is_correct: isCorrect,
        feedback_ai: feedbackAi,
        selected_option: selectedOption
    });
    return data;
}

export interface ChallengeMetadata {
    difficulties: string[];
    tags: string[];
}

export async function fetchChallengeMetadata(): Promise<ChallengeMetadata> {
    const { data } = await gatherApi.get<ChallengeMetadata>('/learning/challenges/metadata');
    return data;
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

export async function fetchProgress(): Promise<ProgressItem[]> {
    const { data } = await voiceApi.get<ProgressItem[]>('/api/progress/');
    return data;
}

export async function fetchStats(): Promise<UserStats> {
    const { data } = await voiceApi.get<UserStats>('/api/progress/stats');
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
    const { data } = await voiceApi.get<AchievementItem[]>('/api/achievements/');
    return data;
}

/* ─── Recording (upload audio blob) ──────────────────── */
export async function uploadRecording(
    wordId: number,
    audioBlob: Blob,
    transcription: string,
    confidence: number
): Promise<void> {
    const form = new FormData();
    form.append('file', audioBlob, 'recording.webm');
    form.append('word_id', String(wordId));
    form.append('transcription', transcription);
    form.append('confidence_score', String(confidence));
    await voiceApi.post('/api/recordings', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
}
