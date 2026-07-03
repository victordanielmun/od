/**
 * Learning service — composes identity + repos + translation into the operations the webview
 * calls. Grading happens here (server-side), and the correct option is NEVER sent to the
 * client, so the answer can't be read off the wire (an integrity fix over the old Go API).
 *
 * The native-language translator is injected and, until Fase 3 (OpenAI) lands, is a stub that
 * only serves the free Spanish backfill; other languages fall back to English helper-less.
 */
import { requireUser } from '../core/identity.js';
import { getLearning, getProfile, getStats, setNativeLanguage as repoSetLang } from '../repos/userRepo.js';
import {
  getRandomChallenge,
  recordAttempt as repoRecordAttempt,
  getWeeklyLeaderboard,
  type ChallengeFilter,
  type AttemptResult,
} from '../repos/challengeRepo.js';
import { getChallengeTranslation } from '../repos/translationRepo.js';
import { challengeTranslator } from './translators.js';
import { HttpError } from '../core/http.js';
import type { LearningChallenge, LeaderboardEntry } from '../../shared/types.js';

/** Challenge shape sent to the client — WITHOUT the correct option. */
export interface ClientChallenge {
  id: string;
  type: string;
  question: string;
  option1: string;
  option2: string;
  option3: string;
  difficulty: string;
  tags: string[];
  nativeLang: string;
  questionNative: string;
  explanationNative: string;
}

function toClient(c: LearningChallenge, nativeLang: string, questionNative: string, explanationNative: string): ClientChallenge {
  return {
    id: c.id,
    type: c.type,
    question: c.question,
    option1: c.option1,
    option2: c.option2,
    option3: c.option3,
    difficulty: c.difficulty,
    tags: c.tags,
    nativeLang,
    questionNative,
    explanationNative,
  };
}

export async function getRandomForUser(filter: ChallengeFilter): Promise<ClientChallenge> {
  const { profile } = await requireUser();
  const challenge = await getRandomChallenge(filter);
  if (!challenge) throw new HttpError(404, 'No challenges found matching criteria.');

  const tr = await getChallengeTranslation(challenge, profile.nativeLanguage, challengeTranslator);
  return toClient(challenge, tr.lang, tr.questionNative, tr.explanationNative);
}

export interface AttemptResponse {
  isCorrect: boolean;
  correctOption: number;
  xpGained: number;
  leveledUp: boolean;
  englishLevel: string;
  totalXp: number;
  streakDays: number;
}

export async function submitAttempt(challengeId: string, selectedOption: number): Promise<AttemptResponse> {
  const { user } = await requireUser();
  const result: AttemptResult | null = await repoRecordAttempt(user.userId, user.username, challengeId, selectedOption);
  if (!result) throw new HttpError(404, 'Challenge not found.');
  return {
    isCorrect: result.isCorrect,
    correctOption: result.correctOption,
    xpGained: result.xpGained,
    leveledUp: result.leveledUp,
    englishLevel: result.profile.englishLevel,
    totalXp: result.profile.totalXp,
    streakDays: result.profile.streakDays,
  };
}

export async function leaderboard(topN = 20): Promise<LeaderboardEntry[]> {
  return getWeeklyLeaderboard(topN);
}

/** Everything the webview needs to render the player header on load. */
export async function myBundle() {
  const { user, profile } = await requireUser();
  const [stats, learning] = await Promise.all([getStats(user.userId), getLearning(user.userId)]);
  return { profile, stats, learning };
}

export async function chooseNativeLanguage(lang: string): Promise<{ nativeLanguage: string }> {
  const { user } = await requireUser();
  await repoSetLang(user.userId, lang);
  const p = await getProfile(user.userId);
  return { nativeLanguage: p?.nativeLanguage ?? 'en' };
}
