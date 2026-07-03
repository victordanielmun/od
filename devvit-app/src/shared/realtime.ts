/**
 * Realtime message contract shared by the Devvit server (broadcaster) and the webview
 * (subscriber). All payloads must be JSON-serializable. One discriminated union per room
 * channel keeps client and server in lockstep.
 *
 * Movement and enemy AI are CLIENT-AUTHORITATIVE: each client broadcasts its own position,
 * and a single elected "host" client broadcasts enemy state (the tick loop runs in the
 * webview, since Devvit serverless has no persistent 60fps process). Combat resolution
 * (Ninja Card) is request/response against the server, which then broadcasts the outcome.
 */

export interface EnemyState {
  id: string;
  type: string;
  x: number;
  y: number;
  hp: number;
  state: string; // idle|walking|attacking|dying
}

export type PresenceEvent = {
  kind: 'presence';
  event: 'join' | 'leave';
  userId: string;
  username: string;
};

export type MoveEvent = {
  kind: 'move';
  userId: string;
  x: number;
  y: number;
  dir: string; // north|south|east|west
  state: string; // idle|walking
};

export type ChatEvent = {
  kind: 'chat';
  userId: string;
  username: string;
  text: string;
  at: number;
};

/** Broadcast by the elected host client with the authoritative enemy snapshot. */
export type EnemySyncEvent = {
  kind: 'enemy';
  hostId: string;
  enemies: EnemyState[];
};

/** Server → room after a Ninja Card resolves and an enemy dies. */
export type EnemyKilledEvent = {
  kind: 'enemy_killed';
  userId: string;
  enemyId: string;
  enemyType: string;
};

export type RoomMessage = PresenceEvent | MoveEvent | ChatEvent | EnemySyncEvent | EnemyKilledEvent;

/** Channel name for a room (a scene instance within the post). */
export const roomChannel = (roomId: string): string => `room:${roomId}`;
