/**
 * Mission repo. Missions embed their tasks (denormalized → one Redis read per mission) and
 * are indexed by scene. Per-player progress is a JSON record keyed by (user, mission).
 */
import { keys } from '../core/keys.js';
import { getJSON, setJSON, indexAdd, indexMembers } from '../core/redis.js';
import type { Mission, MissionTask, PlayerMissionProgress } from '../../shared/types.js';

// ── Missions ─────────────────────────────────────────────────────────────────

export async function saveMission(m: Mission): Promise<void> {
  await setJSON(keys.mission(m.id), m);
  await indexAdd(keys.ixMissionsByScene(m.sceneKey), m.id);
}

export async function getMission(id: string): Promise<Mission | null> {
  return getJSON<Mission>(keys.mission(id));
}

export async function listMissionsByScene(sceneKey: string): Promise<Mission[]> {
  const ids = await indexMembers(keys.ixMissionsByScene(sceneKey));
  const out: Mission[] = [];
  for (const id of ids) {
    const m = await getMission(id);
    if (m) out.push(m);
  }
  return out;
}

// ── Progress ─────────────────────────────────────────────────────────────────

export async function getProgress(userId: string, missionId: string): Promise<PlayerMissionProgress | null> {
  return getJSON<PlayerMissionProgress>(keys.progress(userId, missionId));
}

function freshProgress(userId: string, missionId: string): PlayerMissionProgress {
  return { userId, missionId, status: 'not_started', tasksCompleted: {}, killCounts: {} };
}

/** Start a mission for a player (idempotent — returns existing in-progress if any). */
export async function acceptMission(userId: string, missionId: string): Promise<PlayerMissionProgress> {
  const existing = await getProgress(userId, missionId);
  if (existing && existing.status !== 'not_started') return existing;
  const p: PlayerMissionProgress = { ...freshProgress(userId, missionId), status: 'in_progress', startedAt: Date.now() };
  await setJSON(keys.progress(userId, missionId), p);
  return p;
}

/**
 * Mark a task complete and, if that was the last task, complete the mission. Returns the
 * updated progress plus whether the mission was newly completed by this call.
 */
export async function completeTask(
  userId: string,
  mission: Mission,
  taskId: number,
): Promise<{ progress: PlayerMissionProgress; missionNewlyCompleted: boolean }> {
  const p = (await getProgress(userId, mission.id)) ?? { ...freshProgress(userId, mission.id), status: 'in_progress', startedAt: Date.now() };
  p.tasksCompleted[String(taskId)] = true;

  const allDone = mission.tasks.every((t) => p.tasksCompleted[String(t.id)]);
  let missionNewlyCompleted = false;
  if (allDone && p.status !== 'completed') {
    p.status = 'completed';
    p.completedAt = Date.now();
    missionNewlyCompleted = true;
  }

  await setJSON(keys.progress(userId, mission.id), p);
  return { progress: p, missionNewlyCompleted };
}

export function isTaskComplete(p: PlayerMissionProgress | null, taskId: number): boolean {
  return !!p?.tasksCompleted[String(taskId)];
}

/**
 * Register an enemy kill against a mission's kill-type tasks. Increments per-task kill counts
 * and completes a task once its `requiredKills` threshold is met. Mirrors the Go shared
 * `processEnemyKill` path. Returns which tasks completed and whether the mission finished.
 */
export async function recordKill(
  userId: string,
  mission: Mission,
  enemyType: string,
): Promise<{ progress: PlayerMissionProgress; completedTaskIds: number[]; missionNewlyCompleted: boolean }> {
  const p =
    (await getProgress(userId, mission.id)) ??
    { ...freshProgress(userId, mission.id), status: 'in_progress' as const, startedAt: Date.now() };
  if (p.status === 'not_started') {
    p.status = 'in_progress';
    p.startedAt = Date.now();
  }

  const completedTaskIds: number[] = [];
  for (const t of mission.tasks) {
    if (isTaskComplete(p, t.id)) continue;
    const isKill = t.type === 'defeat_enemy' || t.type === 'kill_all' || t.type === 'kill_boss';
    if (!isKill) continue;

    const matches =
      t.type === 'kill_all'
        ? true
        : t.type === 'kill_boss'
          ? enemyType === 'boss' || t.requiredEnemy === enemyType
          : !t.requiredEnemy || t.requiredEnemy === enemyType; // defeat_enemy
    if (!matches) continue;

    const need = t.requiredKills && t.requiredKills > 0 ? t.requiredKills : 1;
    const cur = (p.killCounts[String(t.id)] ?? 0) + 1;
    p.killCounts[String(t.id)] = cur;
    if (cur >= need) {
      p.tasksCompleted[String(t.id)] = true;
      completedTaskIds.push(t.id);
    }
  }

  let missionNewlyCompleted = false;
  if (mission.tasks.every((t) => p.tasksCompleted[String(t.id)]) && p.status !== 'completed') {
    p.status = 'completed';
    p.completedAt = Date.now();
    missionNewlyCompleted = true;
  }

  await setJSON(keys.progress(userId, mission.id), p);
  return { progress: p, completedTaskIds, missionNewlyCompleted };
}

/** First not-yet-complete task for this NPC (or any incomplete task if none target it). */
export function nextTaskForNpc(mission: Mission, p: PlayerMissionProgress | null, npcId: string): MissionTask | undefined {
  const npcTasks = mission.tasks.filter((t) => t.targetNpcId === npcId && !isTaskComplete(p, t.id));
  if (npcTasks.length > 0) return npcTasks.sort((a, b) => a.order - b.order)[0];
  return mission.tasks.filter((t) => !isTaskComplete(p, t.id)).sort((a, b) => a.order - b.order)[0];
}
