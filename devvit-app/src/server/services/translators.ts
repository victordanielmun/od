/**
 * Concrete translators backed by OpenAI. These are the implementations injected where the
 * data layer expects a translator (challenge helper text, and later missions/tasks). English
 * is canonical; only native-language helper text is generated, then cached in Redis by the
 * repos.
 */
import { chatJSON, chat } from './openai.js';
import type { ChallengeTranslator, MissionTranslator } from '../repos/translationRepo.js';

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English', es: 'Spanish', pt: 'Portuguese', fr: 'French', de: 'German',
  it: 'Italian', ru: 'Russian', ja: 'Japanese', ko: 'Korean', zh: 'Chinese',
  ar: 'Arabic', hi: 'Hindi', tr: 'Turkish', pl: 'Polish', nl: 'Dutch',
  id: 'Indonesian', vi: 'Vietnamese', th: 'Thai', uk: 'Ukrainian', ro: 'Romanian',
};

export function languageName(code: string): string {
  const c = (code || 'en').split('-')[0]!.toLowerCase();
  return LANGUAGE_NAMES[c] ?? c;
}

const optionText = (c: { correctOption: number; option1: string; option2: string; option3: string }) =>
  c.correctOption === 1 ? c.option1 : c.correctOption === 2 ? c.option2 : c.option3;

/** Produces native question + explanation for a challenge. Injected into translationRepo. */
export const challengeTranslator: ChallengeTranslator = async (challenge, lang) => {
  const langName = languageName(lang);
  const system =
    `You are a translator for an English-learning RPG. The player's native language is ${langName}. ` +
    `You are given an English multiple-choice question, its options, and the correct answer. ` +
    `Produce helper text in ${langName} ONLY (never English) so a ${langName} speaker learning English can understand. ` +
    `Respond with STRICT JSON only: {"question_native":"...","explanation_native":"..."}`;

  const user =
    `English question: ${challenge.question}\n` +
    `Options: 1) ${challenge.option1}  2) ${challenge.option2}  3) ${challenge.option3}\n` +
    `Correct option: ${challenge.correctOption} (${optionText(challenge)})`;

  const parsed = await chatJSON<{ question_native?: string; explanation_native?: string }>(system, user);
  return {
    questionNative: (parsed.question_native ?? '').trim(),
    explanationNative: (parsed.explanation_native ?? '').trim(),
  };
};

/** Produces native title/description/objective for a mission. Injected into translationRepo. */
export const missionTranslator: MissionTranslator = async (mission, lang) => {
  const langName = languageName(lang);
  const system =
    `You translate quest text for an English-learning RPG into ${langName}. ` +
    `Translate naturally for a player who speaks ${langName}. Respond with STRICT JSON only: ` +
    `{"title":"...","description":"...","objective":"..."}`;
  const user = `Title: ${mission.title}\nDescription: ${mission.descriptionEn}\nObjective: ${mission.objectiveEn}`;
  const parsed = await chatJSON<{ title?: string; description?: string; objective?: string }>(system, user);
  return {
    title: (parsed.title ?? mission.title).trim(),
    description: (parsed.description ?? mission.descriptionEn).trim(),
    objective: (parsed.objective ?? mission.objectiveEn).trim(),
  };
};

/** Translate a single free-text field (mission/task descriptions). */
export async function translateText(text: string, lang: string): Promise<string> {
  if (!text.trim()) return '';
  const langName = languageName(lang);
  const out = await chat(
    `Translate the user's text into ${langName} for a player learning English. Reply with the translation only, no quotes.`,
    text,
    { temperature: 0.3 },
  );
  return out.trim();
}
