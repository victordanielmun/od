/**
 * Room presence in Redis. Each member's score is its last-seen timestamp; clients heartbeat
 * periodically and stale entries age out (there is no socket-close hook on serverless, so
 * presence is TTL-based rather than connection-based).
 */
import { keys } from '../core/keys.js';
import { zSet, indexRem, zRangeByScore, zRemByScore, hSetObj, hGetAllObj, hDelField } from '../core/redis.js';

const PRESENCE_TTL_MS = 30_000;

export async function heartbeat(roomId: string, userId: string, username: string): Promise<void> {
  await zSet(keys.roomPresence(roomId), userId, Date.now());
  await hSetObj(keys.roomNames(roomId), { [userId]: username });
}

export async function leave(roomId: string, userId: string): Promise<void> {
  await indexRem(keys.roomPresence(roomId), userId);
  await hDelField(keys.roomNames(roomId), userId);
}

export interface PresentUser {
  userId: string;
  username: string;
}

/** Active users in the room (prunes anyone whose heartbeat is older than the TTL). */
export async function listActive(roomId: string): Promise<PresentUser[]> {
  const now = Date.now();
  const cutoff = now - PRESENCE_TTL_MS;

  // Drop stale members, then read the fresh window.
  await zRemByScore(keys.roomPresence(roomId), 0, cutoff);
  const ids = await zRangeByScore(keys.roomPresence(roomId), cutoff, now);

  const names = await hGetAllObj(keys.roomNames(roomId));
  return ids.map((userId) => ({ userId, username: names[userId] ?? 'anon' }));
}
