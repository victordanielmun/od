/**
 * User repo: per-user profile, combat/economy stats, and English-learning progression.
 *
 * Profile is stored as a JSON record (rarely changes, read whole). Stats and learning are
 * stored as HASHES so gold/XP/weekly counters can be incremented atomically — important
 * because multiplayer means concurrent writes to the same user.
 */
import { keys } from '../core/keys.js';
import { getJSON, setJSON, hSetObj, hGetAllObj, hIncrBy } from '../core/redis.js';
import type { UserProfile, PlayerStats, UserLearningProfile, Difficulty } from '../../shared/types.js';

const num = (h: Record<string, string>, k: string, d = 0) => {
  const v = Number(h[k]);
  return Number.isFinite(v) ? v : d;
};

// ── Profile ──────────────────────────────────────────────────────────────────

export async function getProfile(userId: string): Promise<UserProfile | null> {
  return getJSON<UserProfile>(keys.userProfile(userId));
}

/** Get the profile, creating a default one on first sight (identity comes from Reddit). */
export async function ensureProfile(userId: string, username: string): Promise<UserProfile> {
  const existing = await getProfile(userId);
  if (existing) return existing;
  const profile: UserProfile = {
    userId,
    username,
    nativeLanguage: 'en',
    characterId: '1',
    createdAt: Date.now(),
  };
  await setJSON(keys.userProfile(userId), profile);
  return profile;
}

export async function saveProfile(profile: UserProfile): Promise<void> {
  await setJSON(keys.userProfile(profile.userId), profile);
}

export async function setNativeLanguage(userId: string, lang: string): Promise<void> {
  const p = await getProfile(userId);
  if (!p) return;
  p.nativeLanguage = (lang || 'en').split('-')[0]!.toLowerCase();
  await saveProfile(p);
}

// ── Stats ──────────────────────────────────────────────────────────────────

export async function getStats(userId: string): Promise<PlayerStats> {
  const h = await hGetAllObj(keys.userStats(userId));
  if (Object.keys(h).length === 0) {
    const fresh: PlayerStats = { userId, gold: 100, hpCurrent: 100, mpCurrent: 50 };
    await hSetObj(keys.userStats(userId), fresh);
    return fresh;
  }
  return {
    userId,
    gold: num(h, 'gold', 100),
    hpCurrent: num(h, 'hpCurrent', 100),
    mpCurrent: num(h, 'mpCurrent', 50),
  };
}

/** Atomically add gold (can be negative). Returns the new balance. */
export async function addGold(userId: string, delta: number): Promise<number> {
  await getStats(userId); // ensure the hash exists with defaults
  return hIncrBy(keys.userStats(userId), 'gold', delta);
}

export async function saveStats(stats: PlayerStats): Promise<void> {
  await hSetObj(keys.userStats(stats.userId), stats);
}

// ── Learning profile ─────────────────────────────────────────────────────────

function defaultLearning(userId: string): UserLearningProfile {
  return {
    userId,
    englishLevel: 'beginner',
    preferredTags: [],
    weeklyScore: 0,
    weeklyCorrect: 0,
    weeklyAttempts: 0,
    weekStart: currentWeekStart(),
    currentLevelXp: 0,
    totalXp: 0,
    streakDays: 0,
    lastActiveDay: '',
  };
}

export async function getLearning(userId: string): Promise<UserLearningProfile> {
  const h = await hGetAllObj(keys.userLearning(userId));
  if (Object.keys(h).length === 0) {
    const fresh = defaultLearning(userId);
    await hSetObj(keys.userLearning(userId), { ...fresh, preferredTags: JSON.stringify(fresh.preferredTags) });
    return fresh;
  }
  let tags: string[] = [];
  try {
    tags = h['preferredTags'] ? (JSON.parse(h['preferredTags']) as string[]) : [];
  } catch {
    tags = [];
  }
  return {
    userId,
    englishLevel: (h['englishLevel'] as Difficulty) || 'beginner',
    preferredTags: tags,
    weeklyScore: num(h, 'weeklyScore'),
    weeklyCorrect: num(h, 'weeklyCorrect'),
    weeklyAttempts: num(h, 'weeklyAttempts'),
    weekStart: h['weekStart'] || currentWeekStart(),
    currentLevelXp: num(h, 'currentLevelXp'),
    totalXp: num(h, 'totalXp'),
    streakDays: num(h, 'streakDays'),
    lastActiveDay: h['lastActiveDay'] || '',
  };
}

export async function setEnglishLevel(userId: string, level: Difficulty): Promise<void> {
  await getLearning(userId); // ensure exists
  await hSetObj(keys.userLearning(userId), { englishLevel: level });
}

/** Atomic increments used by RecordAttempt (see challengeRepo). Fields must be numeric. */
export async function bumpLearning(
  userId: string,
  fields: Partial<Record<'weeklyScore' | 'weeklyCorrect' | 'weeklyAttempts' | 'currentLevelXp' | 'totalXp', number>>,
): Promise<void> {
  for (const [field, by] of Object.entries(fields)) {
    if (by) await hIncrBy(keys.userLearning(userId), field, by);
  }
}

// ── Week bucket / streak helpers ──────────────────────────────────────────────

/** ISO date (YYYY-MM-DD) of the Monday of the current UTC week. */
export function currentWeekStart(now = new Date()): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = d.getUTCDay(); // 0=Sun..6=Sat
  const diff = (day + 6) % 7; // days since Monday
  d.setUTCDate(d.getUTCDate() - diff);
  return d.toISOString().slice(0, 10);
}

export function today(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}
