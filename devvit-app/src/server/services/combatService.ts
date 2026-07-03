/**
 * Combat = learning. Enemies don't die from raw HP; the player must resolve a "Ninja Card" —
 * an English challenge. A correct answer kills the enemy, awards XP (via the normal learning
 * loop), advances any kill-type mission tasks, and broadcasts the death to the room. This is
 * the request/response half of combat that ports cleanly to Devvit serverless (the enemy AI
 * tick stays client-host; see shared/realtime.ts).
 */
import { requireUser } from '../core/identity.js';
import { broadcast } from '../core/realtime.js';
import { getChallenge, recordAttempt } from '../repos/challengeRepo.js';
import { getMission, recordKill } from '../repos/missionRepo.js';
import { HttpError } from '../core/http.js';

export interface NinjaCardRequest {
  roomId: string;
  enemyId: string;
  enemyType: string;
  missionId?: string;
  challengeId: string;
  selectedOption: number;
}

export interface NinjaCardResult {
  isCorrect: boolean;
  correctOption: number;
  killed: boolean;
  xpGained: number;
  completedTaskIds: number[];
  missionNewlyCompleted: boolean;
}

/** Resolve a Ninja Card: grade the challenge and, if correct, kill the enemy. */
export async function resolveNinjaCard(req: NinjaCardRequest): Promise<NinjaCardResult> {
  const { user } = await requireUser();

  const challenge = await getChallenge(req.challengeId);
  if (!challenge) throw new HttpError(404, 'Challenge not found.');

  // Grade + record through the normal learning loop (XP, streak, leaderboard).
  const attempt = await recordAttempt(user.userId, user.username, req.challengeId, req.selectedOption);
  if (!attempt) throw new HttpError(404, 'Challenge not found.');

  if (!attempt.isCorrect) {
    return {
      isCorrect: false,
      correctOption: attempt.correctOption,
      killed: false,
      xpGained: attempt.xpGained,
      completedTaskIds: [],
      missionNewlyCompleted: false,
    };
  }

  // Correct → the enemy dies. Advance kill-type mission tasks if in a mission.
  let completedTaskIds: number[] = [];
  let missionNewlyCompleted = false;
  if (req.missionId) {
    const mission = await getMission(req.missionId);
    if (mission) {
      const res = await recordKill(user.userId, mission, req.enemyType);
      completedTaskIds = res.completedTaskIds;
      missionNewlyCompleted = res.missionNewlyCompleted;
    }
  }

  await broadcast(req.roomId, {
    kind: 'enemy_killed',
    userId: user.userId,
    enemyId: req.enemyId,
    enemyType: req.enemyType,
  });

  return {
    isCorrect: true,
    correctOption: attempt.correctOption,
    killed: true,
    xpGained: attempt.xpGained,
    completedTaskIds,
    missionNewlyCompleted,
  };
}
