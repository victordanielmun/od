/**
 * Domain types for Odyssey on Devvit. Ported from the Go models (`gather-rpg-backend`),
 * trimmed for the TEXT-ONLY scope: no audio, TTS, STT, or pronunciation. English is the
 * language being learned; `nativeLanguage` drives all helper translations.
 *
 * Identity comes from Reddit (`context.userId` / username), so there is no password,
 * email, JWT, or guest concept — a `UserProfile` is just per-user game state.
 */

export type Difficulty = 'beginner' | 'intermediate' | 'advanced';

/** Text-only challenge kinds. `pronunciation` / `listening` are dropped (needed audio). */
export type ChallengeType = 'vocabulary' | 'grammar';

/** Per-user game profile keyed by Reddit user id. */
export interface UserProfile {
  userId: string;        // Reddit t2_* id (context.userId)
  username: string;      // Reddit username
  nativeLanguage: string; // ISO-639-1, e.g. "es", "pt"; "en" = immersion, no helper
  characterId: string;   // chosen sprite
  companionNpcId?: number;
  createdAt: number;     // epoch ms
}

/** Combat / economy stats. Kept minimal; combat is in scope but resolves request/response. */
export interface PlayerStats {
  userId: string;
  gold: number;
  hpCurrent: number;
  mpCurrent: number;
}

/** English-learning progression + weekly scoring (feeds the leaderboard). */
export interface UserLearningProfile {
  userId: string;
  englishLevel: Difficulty;
  preferredTags: string[];
  weeklyScore: number;
  weeklyCorrect: number;
  weeklyAttempts: number;
  weekStart: string;      // ISO date (YYYY-MM-DD) of the current week bucket
  currentLevelXp: number;
  totalXp: number;
  streakDays: number;     // consecutive-day streak (retention hook)
  lastActiveDay: string;  // ISO date of last recorded activity
}

/** A multiple-choice English question. English fields are canonical; native helper text
 * is resolved separately (see ChallengeTranslation). */
export interface LearningChallenge {
  id: string;
  type: ChallengeType;
  question: string;
  option1: string;
  option2: string;
  option3: string;
  correctOption: 1 | 2 | 3;
  tags: string[];
  difficulty: Difficulty;
  /** Legacy Spanish helper text carried over from the seed; used to backfill the "es"
   * translation cache for free. Optional and never shown directly. */
  questionEs?: string;
  explanationEs?: string;
}

/** Native-language helper for a challenge, cached per (challenge, lang). */
export interface ChallengeTranslation {
  challengeId: string;
  lang: string;
  questionNative: string;
  explanationNative: string;
}

/** One recorded answer attempt (for history + weekly aggregates). */
export interface ChallengeAttempt {
  userId: string;
  challengeId: string;
  selectedOption: number;
  isCorrect: boolean;
  at: number; // epoch ms
}

export interface LeaderboardEntry {
  userId: string;
  username: string;
  score: number;
  rank: number; // 1-based
}

/** XP / level tuning, mirrored from the Go rules (5 wrong / 15 correct; 500/1500 level-up). */
export const XP = {
  correct: 15,
  attempt: 5,
  levelUpBeginner: 500,
  levelUpOther: 1500,
} as const;

// ── Missions / NPCs (Fase 4) ────────────────────────────────────────────────

export type MissionMode = 'individual' | 'cooperative' | 'competitive';

export type TaskType =
  | 'bring_item'
  | 'find_item'
  | 'collect_items'
  | 'defeat_enemy'
  | 'kill_all'
  | 'kill_boss'
  | 'talk_to_npc'
  | 'deliver_message';

/** A step within a mission. `descriptionEn` is player-facing helper (translated); the
 * learning targets `targetPhraseEn`/`messageToDeliver` are NEVER translated. */
export interface MissionTask {
  id: number;
  order: number;
  type: TaskType;
  descriptionEn: string;
  targetNpcId?: string;
  requiredItem?: string;
  requiredQuantity?: number;
  requiredEnemy?: string;
  requiredKills?: number;
  targetPhraseEn?: string;
  messageToDeliver?: string;
}

/** Tasks are embedded (denormalized) so a mission is a single Redis read. */
export interface Mission {
  id: string;
  sceneKey: string;
  title: string;
  descriptionEn: string;
  objectiveEn: string;
  mode: MissionMode;
  difficulty: Difficulty;
  rewardGold: number;
  rewardXp: number;
  tasks: MissionTask[];
}

export type ProgressStatus = 'not_started' | 'in_progress' | 'completed';

export interface PlayerMissionProgress {
  userId: string;
  missionId: string;
  status: ProgressStatus;
  tasksCompleted: Record<string, boolean>;
  killCounts: Record<string, number>;
  startedAt?: number;
  completedAt?: number;
}

export type NPCType = 'quest_giver' | 'quest_master' | 'merchant' | 'guide' | 'other';

export interface NPCDefinition {
  id: string;
  name: string;
  sprite: string;
  greeting: string;
  type: NPCType;
  /** AI persona / knowledge / behaviour, fed to the dialogue LLM. */
  instructions: string;
  sceneKey?: string;
}

export interface MissionTranslation {
  missionId: string;
  lang: string;
  title: string;
  description: string;
  objective: string;
}

export interface TaskTranslation {
  taskId: string;
  lang: string;
  description: string;
}
