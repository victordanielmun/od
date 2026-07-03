/**
 * Translation cache in Redis — the Devvit equivalent of the Go `ChallengeTranslation`
 * table. English is canonical and never cached; any other language is generated once and
 * reused. The actual LLM call is INJECTED (see Fase 3 / OpenAI), keeping this layer free of
 * any network dependency.
 */
import { keys } from '../core/keys.js';
import { getJSON, setJSON } from '../core/redis.js';
import type {
  LearningChallenge,
  ChallengeTranslation,
  Mission,
  MissionTask,
  MissionTranslation,
  TaskTranslation,
} from '../../shared/types.js';

export function normalizeLang(code: string): string {
  const c = (code || '').split('-')[0]!.trim().toLowerCase();
  return c || 'en';
}

export function isEnglish(code: string): boolean {
  return normalizeLang(code) === 'en';
}

/** Produces native helper text for a challenge. Implemented by the OpenAI layer in Fase 3. */
export type ChallengeTranslator = (
  challenge: LearningChallenge,
  lang: string,
) => Promise<{ questionNative: string; explanationNative: string }>;

/**
 * Resolve a challenge's native helper text for `lang`, caching per (challenge, lang).
 * Order: English → canonical (no helper); cache hit; legacy Spanish backfill; LLM generate.
 * On generation failure returns empty helper so the English challenge is still usable.
 */
export async function getChallengeTranslation(
  challenge: LearningChallenge,
  lang: string,
  translate: ChallengeTranslator,
): Promise<ChallengeTranslation> {
  const l = normalizeLang(lang);

  if (isEnglish(l)) {
    return { challengeId: challenge.id, lang: 'en', questionNative: challenge.question, explanationNative: '' };
  }

  const cacheKey = keys.trChallenge(challenge.id, l);
  const cached = await getJSON<ChallengeTranslation>(cacheKey);
  if (cached) return cached;

  // Backfill from the legacy Spanish seed fields for free.
  if (l === 'es' && (challenge.questionEs || challenge.explanationEs)) {
    const tr: ChallengeTranslation = {
      challengeId: challenge.id,
      lang: 'es',
      questionNative: challenge.questionEs ?? '',
      explanationNative: challenge.explanationEs ?? '',
    };
    await setJSON(cacheKey, tr);
    return tr;
  }

  try {
    const out = await translate(challenge, l);
    const tr: ChallengeTranslation = {
      challengeId: challenge.id,
      lang: l,
      questionNative: out.questionNative.trim(),
      explanationNative: out.explanationNative.trim(),
    };
    await setJSON(cacheKey, tr);
    return tr;
  } catch {
    return { challengeId: challenge.id, lang: l, questionNative: '', explanationNative: '' };
  }
}

// ── Missions / tasks (same per-language cache pattern) ─────────────────────────

export type MissionTranslator = (
  mission: Mission,
  lang: string,
) => Promise<{ title: string; description: string; objective: string }>;

export type TextTranslator = (text: string, lang: string) => Promise<string>;

/** Native title/description/objective for a mission, cached per (mission, lang). */
export async function getMissionTranslation(
  mission: Mission,
  lang: string,
  translate: MissionTranslator,
): Promise<MissionTranslation> {
  const l = normalizeLang(lang);
  if (isEnglish(l)) {
    return { missionId: mission.id, lang: 'en', title: mission.title, description: mission.descriptionEn, objective: mission.objectiveEn };
  }

  const cacheKey = keys.trMission(mission.id, l);
  const cached = await getJSON<MissionTranslation>(cacheKey);
  if (cached) return cached;

  try {
    const out = await translate(mission, l);
    const tr: MissionTranslation = { missionId: mission.id, lang: l, title: out.title.trim(), description: out.description.trim(), objective: out.objective.trim() };
    await setJSON(cacheKey, tr);
    return tr;
  } catch {
    return { missionId: mission.id, lang: l, title: mission.title, description: mission.descriptionEn, objective: mission.objectiveEn };
  }
}

/** Native description for a task, cached per (task, lang). Learning targets stay English. */
export async function getTaskTranslation(
  task: MissionTask,
  lang: string,
  translate: TextTranslator,
): Promise<TaskTranslation> {
  const l = normalizeLang(lang);
  const taskId = String(task.id);
  if (isEnglish(l)) {
    return { taskId, lang: 'en', description: task.descriptionEn };
  }

  const cacheKey = keys.trTask(taskId, l);
  const cached = await getJSON<TaskTranslation>(cacheKey);
  if (cached) return cached;

  try {
    const description = await translate(task.descriptionEn, l);
    const tr: TaskTranslation = { taskId, lang: l, description: description.trim() };
    await setJSON(cacheKey, tr);
    return tr;
  } catch {
    return { taskId, lang: l, description: task.descriptionEn };
  }
}
