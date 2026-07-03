/**
 * Room service — multiplayer presence and chat. Presence is heartbeat-based (see
 * presenceRepo); join/leave and chat are broadcast to the room's Realtime channel so every
 * connected webview updates live. Movement is NOT routed here — clients broadcast their own
 * positions directly on the channel (client-authoritative) to avoid a server hop per frame.
 */
import { requireUser } from '../core/identity.js';
import { broadcast } from '../core/realtime.js';
import { heartbeat, leave, listActive, type PresentUser } from '../repos/presenceRepo.js';
import { keys } from '../core/keys.js';
import { histAdd, histRecent } from '../core/redis.js';
import { HttpError } from '../core/http.js';
import type { ChatEvent, EnemyState } from '../../shared/realtime.js';

/** Register presence + announce the join. Called on entry and periodically as a heartbeat. */
export async function join(roomId: string): Promise<{ users: PresentUser[] }> {
  const { user } = await requireUser();
  await heartbeat(roomId, user.userId, user.username);
  await broadcast(roomId, { kind: 'presence', event: 'join', userId: user.userId, username: user.username });
  return { users: await listActive(roomId) };
}

/** Lightweight heartbeat (no join broadcast) to keep presence fresh. */
export async function ping(roomId: string): Promise<{ users: PresentUser[] }> {
  const { user } = await requireUser();
  await heartbeat(roomId, user.userId, user.username);
  return { users: await listActive(roomId) };
}

export async function leaveRoom(roomId: string): Promise<{ ok: true }> {
  const { user } = await requireUser();
  await leave(roomId, user.userId);
  await broadcast(roomId, { kind: 'presence', event: 'leave', userId: user.userId, username: user.username });
  return { ok: true };
}

/**
 * Broadcast the caller's position. Devvit clients can't publish to a channel directly, so
 * movement is a throttled POST that the server relays. Clients interpolate between updates.
 */
export async function broadcastMove(
  roomId: string,
  x: number,
  y: number,
  dir: string,
  moveState: string,
): Promise<{ ok: true }> {
  const { user } = await requireUser();
  await broadcast(roomId, { kind: 'move', userId: user.userId, x, y, dir, state: moveState });
  return { ok: true };
}

/** Host-only relay: the elected host posts its authoritative enemy snapshot to broadcast. */
export async function broadcastEnemies(roomId: string, enemies: EnemyState[]): Promise<{ ok: true }> {
  const { user } = await requireUser();
  await broadcast(roomId, { kind: 'enemy', hostId: user.userId, enemies });
  return { ok: true };
}

export async function sendChat(roomId: string, text: string): Promise<{ ok: true }> {
  const trimmed = text.trim();
  if (!trimmed) throw new HttpError(400, 'Empty message.');
  if (trimmed.length > 500) throw new HttpError(400, 'Message too long.');

  const { user } = await requireUser();
  const msg: ChatEvent = { kind: 'chat', userId: user.userId, username: user.username, text: trimmed, at: Date.now() };

  await histAdd(keys.roomChat(roomId), JSON.stringify(msg), msg.at, 50);
  await broadcast(roomId, msg);
  return { ok: true };
}

/** Recent chat backlog so a joining player sees the last messages. */
export async function chatHistory(roomId: string): Promise<ChatEvent[]> {
  await requireUser();
  const raw = await histRecent(keys.roomChat(roomId), 50);
  const out: ChatEvent[] = [];
  for (const r of raw) {
    try {
      out.push(JSON.parse(r) as ChatEvent);
    } catch {
      // skip malformed
    }
  }
  return out.reverse(); // oldest first for display
}
