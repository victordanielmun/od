/**
 * Mission service — the quest-log operations the webview calls. Missions are localized into
 * the player's native language (cached per language) and merged with their per-player progress.
 * English canonical text is always sent alongside the native text so the client can toggle.
 */
import { requireUser } from '../core/identity.js';
import { listMissionsByScene, getProgress, acceptMission, isTaskComplete } from '../repos/missionRepo.js';
import { getMissionTranslation, getTaskTranslation, isEnglish } from '../repos/translationRepo.js';
import { missionTranslator, translateText } from './translators.js';
import type { Mission, ProgressStatus } from '../../shared/types.js';

export interface ClientTask {
  id: number;
  order: number;
  type: string;
  description: string;   // native (or English when native is English)
  descriptionEn: string; // English canonical
  isCompleted: boolean;
  targetNpcId?: string;  // which NPC this task is completed with, if any
}

export interface ClientMission {
  id: string;
  title: string;
  description: string;    // native
  descriptionEn: string;  // English canonical
  objective: string;      // native
  objectiveEn: string;    // English canonical
  mode: string;
  status: ProgressStatus;
  tasks: ClientTask[];
}

async function toClientMission(m: Mission, userId: string, lang: string): Promise<ClientMission> {
  const progress = await getProgress(userId, m.id);

  let title = m.title;
  let description = m.descriptionEn;
  let objective = m.objectiveEn;
  if (!isEnglish(lang)) {
    const mt = await getMissionTranslation(m, lang, missionTranslator);
    title = mt.title;
    description = mt.description;
    objective = mt.objective;
  }

  const tasks: ClientTask[] = [];
  for (const t of m.tasks.slice().sort((a, b) => a.order - b.order)) {
    let desc = t.descriptionEn;
    if (!isEnglish(lang)) {
      desc = (await getTaskTranslation(t, lang, translateText)).description;
    }
    tasks.push({
      id: t.id,
      order: t.order,
      type: t.type,
      description: desc,
      descriptionEn: t.descriptionEn,
      isCompleted: isTaskComplete(progress, t.id),
      targetNpcId: t.targetNpcId,
    });
  }

  return {
    id: m.id,
    title,
    description,
    descriptionEn: m.descriptionEn,
    objective,
    objectiveEn: m.objectiveEn,
    mode: m.mode,
    status: progress?.status ?? 'not_started',
    tasks,
  };
}

export async function getMissionsForScene(sceneKey: string): Promise<ClientMission[]> {
  const { user, profile } = await requireUser();
  const missions = await listMissionsByScene(sceneKey);
  const out: ClientMission[] = [];
  for (const m of missions) {
    out.push(await toClientMission(m, user.userId, profile.nativeLanguage));
  }
  return out;
}

export async function accept(missionId: string): Promise<{ status: ProgressStatus }> {
  const { user } = await requireUser();
  const p = await acceptMission(user.userId, missionId);
  return { status: p.status };
}
