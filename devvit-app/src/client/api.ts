/**
 * Typed fetch client for the Devvit server. The webview runs in an iframe served by Reddit,
 * so these are same-origin calls to `/api/*` (no CORS, no base URL).
 */
import type { LeaderboardEntry, PlayerStats, UserLearningProfile, UserProfile } from '../shared/types.js';
import type { ChatEvent, EnemyState } from '../shared/realtime.js';

export interface PresentUser {
  userId: string;
  username: string;
}

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
  return data as T;
}

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

export interface AttemptResponse {
  isCorrect: boolean;
  correctOption: number;
  xpGained: number;
  leveledUp: boolean;
  englishLevel: string;
  totalXp: number;
  streakDays: number;
}

export interface MeBundle {
  profile: UserProfile;
  stats: PlayerStats;
  learning: UserLearningProfile;
}

export interface ClientTask {
  id: number;
  order: number;
  type: string;
  description: string;
  descriptionEn: string;
  isCompleted: boolean;
  targetNpcId?: string;
}

export interface ClientMission {
  id: string;
  title: string;
  description: string;
  descriptionEn: string;
  objective: string;
  objectiveEn: string;
  mode: string;
  status: string;
  tasks: ClientTask[];
}

export interface ClientNpc {
  id: string;
  name: string;
  sprite: string;
  greeting: string;
  type: string;
}

export interface NpcTalkResponse {
  npcResponse: string;
  npcResponseNative: string;
  npcState: string;
  taskCompleted: boolean;
  feedback: string;
  missionNewlyCompleted: boolean;
}

export interface DialogueTurn {
  player: string;
  npc: string;
}

export interface NinjaCardResult {
  isCorrect: boolean;
  correctOption: number;
  killed: boolean;
  xpGained: number;
  completedTaskIds: number[];
  missionNewlyCompleted: boolean;
}

export const api = {
  me: () => req<MeBundle>('GET', '/api/me'),
  setNativeLanguage: (nativeLanguage: string) =>
    req<{ nativeLanguage: string }>('PUT', '/api/me/native-language', { nativeLanguage }),

  randomChallenge: (filter: { type?: string; difficulty?: string; tag?: string } = {}) => {
    const q = new URLSearchParams();
    if (filter.type) q.set('type', filter.type);
    if (filter.difficulty) q.set('difficulty', filter.difficulty);
    if (filter.tag) q.set('tag', filter.tag);
    return req<ClientChallenge>('GET', `/api/challenge/random?${q.toString()}`);
  },
  submitAttempt: (challengeId: string, selectedOption: number) =>
    req<AttemptResponse>('POST', '/api/attempt', { challengeId, selectedOption }),

  leaderboard: (top = 20) => req<LeaderboardEntry[]>('GET', `/api/leaderboard?top=${top}`),

  // ── Missions / NPC dialogue ──────────────────────────────────────────────────
  missionsForScene: (key: string) => req<ClientMission[]>('GET', `/api/missions/scene?key=${encodeURIComponent(key)}`),
  acceptMission: (missionId: string) => req<{ status: string }>('POST', '/api/missions/accept', { missionId }),
  npcsForScene: (key: string) => req<ClientNpc[]>('GET', `/api/npc/scene?key=${encodeURIComponent(key)}`),
  talkToNpc: (payload: { npcId: string; missionId?: string; playerInput: string; history?: DialogueTurn[] }) =>
    req<NpcTalkResponse>('POST', '/api/npc/talk', payload),

  // ── Multiplayer room ─────────────────────────────────────────────────────────
  roomJoin: (roomId: string) => req<{ users: PresentUser[] }>('POST', '/api/room/join', { roomId }),
  roomPing: (roomId: string) => req<{ users: PresentUser[] }>('POST', '/api/room/ping', { roomId }),
  roomLeave: (roomId: string) => req<{ ok: true }>('POST', '/api/room/leave', { roomId }),
  roomChatHistory: (roomId: string) => req<ChatEvent[]>('GET', `/api/room/chat?roomId=${encodeURIComponent(roomId)}`),
  roomSendChat: (roomId: string, text: string) => req<{ ok: true }>('POST', '/api/room/chat', { roomId, text }),
  roomMove: (roomId: string, x: number, y: number, dir: string, state: string) =>
    req<{ ok: true }>('POST', '/api/room/move', { roomId, x, y, dir, state }),
  roomEnemies: (roomId: string, enemies: EnemyState[]) =>
    req<{ ok: true }>('POST', '/api/room/enemies', { roomId, enemies }),

  // ── Combat ───────────────────────────────────────────────────────────────────
  ninjaCard: (payload: { roomId: string; enemyId: string; enemyType: string; missionId?: string; challengeId: string; selectedOption: number }) =>
    req<NinjaCardResult>('POST', '/api/combat/ninja-card', payload),

  seed: () => req<{ challenges: number; npcs: number; missions: number; alreadyDone: boolean }>('POST', '/api/admin/seed'),
};
