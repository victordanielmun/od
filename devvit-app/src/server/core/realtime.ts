/**
 * Server-side Realtime broadcast. The only place that calls `realtime.send`, so the channel
 * convention and the RoomMessage contract stay in one spot.
 */
import { realtime } from '@devvit/web/server';
import { roomChannel, type RoomMessage } from '../../shared/realtime.js';

/** Broadcast a message to everyone connected to a room's channel. */
export async function broadcast(roomId: string, msg: RoomMessage): Promise<void> {
  // RoomMessage is JSON-serializable at runtime; the send generic wants a JsonValue index
  // signature that our typed unions intentionally don't carry, so we relax the call site.
  const send = realtime.send as (channel: string, msg: unknown) => Promise<void>;
  await send(roomChannel(roomId), msg);
}
