/**
 * Challenge repo: seeding/reading text challenges via sorted-set indices, plus the core
 * learning loop — RecordAttempt (XP, level-up, daily streak) and the weekly leaderboard.
 *
 * getRandomChallenge intersects the relevant indices IN MEMORY (challenge count is small
 * and seeded), avoiding a full scan and any dependency on server-side set intersection.
 */
import { keys } from '../core/keys.js';
import { getJSON, setJSON, indexAdd, indexMembers, zIncr, zScore, zTopN, histAdd } from '../core/redis.js';
import { getLearning, getProfile, currentWeekStart, today } from './userRepo.js';
import { hSetObj } from '../core/redis.js';
import type {
  LearningChallenge,
  ChallengeAttempt,
  UserLearningProfile,
  Difficulty,
  LeaderboardEntry,
} from '../../shared/types.js';
import { XP } from '../../shared/types.js';

// ── Seeding / CRUD ─────────────────────────────────────────────────────────

export async function saveChallenge(c: LearningChallenge): Promise<void> {
  await setJSON(keys.challenge(c.id), c);
  await indexAdd(keys.ixChallengesAll(), c.id);
  await indexAdd(keys.ixChallengesByType(c.type), c.id);
  await indexAdd(keys.ixChallengesByDifficulty(c.difficulty), c.id);
  for (const tag of c.tags) await indexAdd(keys.ixChallengesByTag(tag), c.id);
}

export async function getChallenge(id: string): Promise<LearningChallenge | null> {
  return getJSON<LearningChallenge>(keys.challenge(id));
}

// ── Random selection ─────────────────────────────────────────────────────────

export interface ChallengeFilter {
  type?: string;
  difficulty?: string;
  tag?: string;
}

/** Pick a random challenge matching the given facets by intersecting index members. */
export async function getRandomChallenge(f: ChallengeFilter = {}): Promise<LearningChallenge | null> {
  const sets: string[][] = [];
  if (f.type) sets.push(await indexMembers(keys.ixChallengesByType(f.type)));
  if (f.difficulty) sets.push(await indexMembers(keys.ixChallengesByDifficulty(f.difficulty)));
  if (f.tag) sets.push(await indexMembers(keys.ixChallengesByTag(f.tag)));
  if (sets.length === 0) sets.push(await indexMembers(keys.ixChallengesAll()));

  let ids = sets[0] ?? [];
  for (let i = 1; i < sets.length; i++) {
    const s = new Set(sets[i]);
    ids = ids.filter((id) => s.has(id));
  }
  if (ids.length === 0) return null;

  const pick = ids[Math.floor(Math.random() * ids.length)]!;
  return getChallenge(pick);
}

// ── RecordAttempt (the learning loop) ──────────────────────────────────────

export interface AttemptResult {
  isCorrect: boolean;
  correctOption: number;
  xpGained: number;
  leveledUp: boolean;
  profile: UserLearningProfile;
}

const levelUpThreshold = (level: Difficulty) =>
  level === 'beginner' ? XP.levelUpBeginner : XP.levelUpOther;

const nextLevel = (level: Difficulty): Difficulty =>
  level === 'beginner' ? 'intermediate' : level === 'intermediate' ? 'advanced' : 'advanced';

/**
 * Grade an answer and advance the player: XP, level-up, weekly counters, daily streak, and
 * the weekly leaderboard. Read-modify-write on the per-user learning hash is safe here
 * because a single user answers sequentially.
 */
export async function recordAttempt(
  userId: string,
  username: string,
  challengeId: string,
  selectedOption: number,
): Promise<AttemptResult | null> {
  const challenge = await getChallenge(challengeId);
  if (!challenge) return null;

  const isCorrect = selectedOption === challenge.correctOption;
  const xpGained = isCorrect ? XP.correct : XP.attempt;

  const p = await getLearning(userId);

  // Lazy weekly rollover: if we've crossed into a new week, reset the weekly bucket.
  const week = currentWeekStart();
  if (p.weekStart !== week) {
    p.weekStart = week;
    p.weeklyScore = 0;
    p.weeklyCorrect = 0;
    p.weeklyAttempts = 0;
  }

  p.weeklyAttempts += 1;
  if (isCorrect) p.weeklyCorrect += 1;
  p.weeklyScore += xpGained;
  p.totalXp += xpGained;
  p.currentLevelXp += xpGained;

  // Level-up (can only advance one tier per attempt).
  let leveledUp = false;
  const threshold = levelUpThreshold(p.englishLevel);
  if (p.currentLevelXp >= threshold && p.englishLevel !== 'advanced') {
    p.currentLevelXp -= threshold;
    p.englishLevel = nextLevel(p.englishLevel);
    leveledUp = true;
  }

  // Daily streak (retention hook).
  const day = today();
  if (p.lastActiveDay !== day) {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    p.streakDays = p.lastActiveDay === yesterday ? p.streakDays + 1 : 1;
    p.lastActiveDay = day;
  }

  await hSetObj(keys.userLearning(userId), { ...p, preferredTags: JSON.stringify(p.preferredTags) });

  // Weekly leaderboard: accumulate this week's XP by user.
  await zIncr(keys.leaderboardWeekly(week), userId, xpGained);

  // Attempt history (capped, newest-first via timestamp score).
  const attempt: ChallengeAttempt = { userId, challengeId, selectedOption, isCorrect, at: Date.now() };
  await histAdd(keys.userAttempts(userId), JSON.stringify(attempt), attempt.at, 200);

  return { isCorrect, correctOption: challenge.correctOption, xpGained, leveledUp, profile: p };
}

// ── Leaderboard read ─────────────────────────────────────────────────────────

export async function getWeeklyLeaderboard(topN = 20): Promise<LeaderboardEntry[]> {
  const week = currentWeekStart();
  const rows = await zTopN(keys.leaderboardWeekly(week), topN);
  const entries: LeaderboardEntry[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const profile = await getProfile(row.member);
    entries.push({
      userId: row.member,
      username: profile?.username ?? 'unknown',
      score: row.score,
      rank: i + 1,
    });
  }
  return entries;
}

/** The caller's own score + rank (for showing "you are #N" even outside the top list). */
export async function getMyRank(userId: string): Promise<{ score: number; rank: number | null }> {
  const week = currentWeekStart();
  const score = (await zScore(keys.leaderboardWeekly(week), userId)) ?? 0;
  // rank resolved by the leaderboard read when needed; kept simple here.
  return { score, rank: null };
}
