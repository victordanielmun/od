/**
 * Thin typed wrapper over the Devvit Redis client. EVERY raw redis call lives here, so if
 * a method signature differs in the installed @devvit/web version, this is the ONLY file to
 * touch — repos depend on these helpers, never on the raw client.
 *
 * Devvit Redis reliably supports strings, hashes, and sorted-sets (plus incr/expire). Plain
 * SETs are avoided; "index" collections below are modeled as sorted-sets with score 0, which
 * gives O(1) membership (zScore) and cheap enumeration (zRange).
 */
import { redis } from '@devvit/web/server';

// ── JSON records (stored as strings) ─────────────────────────────────────────

export async function getJSON<T>(key: string): Promise<T | null> {
  const raw = await redis.get(key);
  if (raw === undefined || raw === null || raw === '') return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function setJSON<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
  await redis.set(key, JSON.stringify(value));
  if (ttlSeconds && ttlSeconds > 0) await redis.expire(key, ttlSeconds);
}

export async function del(key: string): Promise<void> {
  await redis.del(key);
}

export async function exists(key: string): Promise<boolean> {
  const n = await redis.exists(key);
  return n > 0;
}

// ── Hash records (all values coerced to strings; numbers parsed on read) ──────

/** Write a flat object as a hash. Numbers/booleans are stringified; string[] via JSON. */
export async function hSetObj<T extends object>(key: string, obj: T): Promise<void> {
  const flat: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (v === undefined || v === null) continue;
    flat[k] = typeof v === 'string' ? v : JSON.stringify(v);
  }
  if (Object.keys(flat).length === 0) return;
  await redis.hSet(key, flat);
}

export async function hGetAllObj(key: string): Promise<Record<string, string>> {
  const res = await redis.hGetAll(key);
  return res ?? {};
}

export async function hIncrBy(key: string, field: string, by: number): Promise<number> {
  return redis.hIncrBy(key, field, by);
}

export async function incrBy(key: string, by: number): Promise<number> {
  return redis.incrBy(key, by);
}

export async function expire(key: string, ttlSeconds: number): Promise<void> {
  await redis.expire(key, ttlSeconds);
}

// ── Index collections (sorted-set with score 0 used as a Set) ─────────────────

export async function indexAdd(indexKey: string, member: string): Promise<void> {
  await redis.zAdd(indexKey, { member, score: 0 });
}

export async function indexRem(indexKey: string, member: string): Promise<void> {
  await redis.zRem(indexKey, [member]);
}

export async function indexHas(indexKey: string, member: string): Promise<boolean> {
  const score = await redis.zScore(indexKey, member);
  return score !== undefined && score !== null;
}

/** Enumerate all members of an index collection. */
export async function indexMembers(indexKey: string): Promise<string[]> {
  const rows = await redis.zRange(indexKey, 0, -1, { by: 'rank' });
  return rows.map((r) => r.member);
}

// ── Sorted-sets (scored — leaderboards) ──────────────────────────────────────

export async function zSet(key: string, member: string, score: number): Promise<void> {
  await redis.zAdd(key, { member, score });
}

export async function zIncr(key: string, member: string, by: number): Promise<number> {
  return redis.zIncrBy(key, member, by);
}

export async function zScore(key: string, member: string): Promise<number | null> {
  const s = await redis.zScore(key, member);
  return s ?? null;
}

/** 0-based rank counting from the TOP (highest score first). */
export async function zRevRank(key: string, member: string): Promise<number | null> {
  const total = await redis.zCard(key);
  const asc = await redis.zRank(key, member); // 0-based ascending
  if (asc === undefined || asc === null) return null;
  return total - 1 - asc;
}

/** Top N members by score descending, with scores. */
export async function zTopN(
  key: string,
  n: number,
): Promise<Array<{ member: string; score: number }>> {
  const rows = await redis.zRange(key, 0, Math.max(0, n - 1), { reverse: true, by: 'rank' });
  return rows.map((r) => ({ member: r.member, score: r.score }));
}

/** Members whose score is within [min, max] (used for TTL-style presence windows). */
export async function zRangeByScore(key: string, min: number, max: number): Promise<string[]> {
  const rows = await redis.zRange(key, min, max, { by: 'score' });
  return rows.map((r) => r.member);
}

/** Drop members whose score is within [min, max] (prune stale presence). */
export async function zRemByScore(key: string, min: number, max: number): Promise<void> {
  await redis.zRemRangeByScore(key, min, max);
}

// ── Hash field helpers ────────────────────────────────────────────────────────

export async function hGet(key: string, field: string): Promise<string | undefined> {
  return redis.hGet(key, field);
}

export async function hDelField(key: string, field: string): Promise<void> {
  await redis.hDel(key, [field]);
}

// ── Capped history (Devvit Redis has no lists → sorted-set scored by timestamp) ──

/**
 * Append an entry to a capped, time-ordered history. Members are scored by `at` (epoch ms)
 * so newest sort highest; when over `cap`, the oldest ranks are trimmed.
 */
export async function histAdd(key: string, value: string, at: number, cap?: number): Promise<void> {
  await redis.zAdd(key, { member: value, score: at });
  if (cap && cap > 0) {
    // Remove everything except the newest `cap` (ranks are ascending by score).
    await redis.zRemRangeByRank(key, 0, -(cap + 1));
  }
}

/** Read the most recent `n` history entries (newest first). */
export async function histRecent(key: string, n: number): Promise<string[]> {
  const rows = await redis.zRange(key, 0, Math.max(0, n - 1), { reverse: true, by: 'rank' });
  return rows.map((r) => r.member);
}
