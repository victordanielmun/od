/**
 * Client-side Realtime subscription. Wraps Devvit's `connectRealtime` with our typed
 * RoomMessage contract so the room view gets presence/chat/enemy events live.
 */
import { connectRealtime } from '@devvit/web/client';
import { roomChannel, type RoomMessage } from '../shared/realtime.js';

export interface RoomConnection {
  disconnect(): void;
}

/** Subscribe to a room's channel. Returns a handle to disconnect on leave. */
export function subscribeRoom(roomId: string, onMessage: (msg: RoomMessage) => void): RoomConnection {
  // RoomMessage is JSON at runtime but our typed union lacks the JsonValue index signature,
  // so we relax the generic at the call site (same pattern as the server broadcast helper).
  const connect = connectRealtime as (opts: {
    channel: string;
    onMessage: (data: unknown) => void;
  }) => { disconnect(): void };

  return connect({
    channel: roomChannel(roomId),
    onMessage: (data) => onMessage(data as RoomMessage),
  });
}
