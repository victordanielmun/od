/**
 * Data seeding. There is no SQL import in Devvit — initial content is written into the
 * managed Redis by running this routine once (triggered by a mod menu action or on install).
 * Idempotent: a guard flag prevents re-seeding, and each challenge has a stable id so a
 * forced re-run just overwrites in place.
 */
import { getJSON, setJSON } from '../core/redis.js';
import { saveChallenge } from '../repos/challengeRepo.js';
import { saveMission } from '../repos/missionRepo.js';
import { saveNpc } from '../repos/npcRepo.js';
import { SEED_CHALLENGES } from './challenges.data.js';
import type { Mission, NPCDefinition } from '../../shared/types.js';

const SEED_FLAG = 'seed:content:v1';

const SEED_NPCS: NPCDefinition[] = [
  {
    id: 'npc-elder',
    name: 'Elder Maro',
    sprite: 'npc-1',
    greeting: 'Welcome, traveler.',
    type: 'quest_giver',
    sceneKey: 'lobby',
    instructions:
      'You are Elder Maro, a wise and warm village elder. You greet newcomers, help them practice English, ' +
      'and guide them on their first quest. Keep replies short and encouraging.',
  },
];

const SEED_MISSIONS: Mission[] = [
  {
    id: 'mission-first-words',
    sceneKey: 'lobby',
    title: 'First Words',
    descriptionEn: 'Greet Elder Maro in English to begin your journey.',
    objectiveEn: 'Introduce yourself to Elder Maro in English.',
    mode: 'individual',
    difficulty: 'beginner',
    rewardGold: 50,
    rewardXp: 30,
    tasks: [
      {
        id: 1,
        order: 1,
        type: 'talk_to_npc',
        descriptionEn: 'Say hello and tell Elder Maro your name in English.',
        targetNpcId: 'npc-elder',
        targetPhraseEn: 'Hello, my name is ...',
      },
    ],
  },
];

export interface SeedResult {
  challenges: number;
  npcs: number;
  missions: number;
  alreadyDone: boolean;
}

/** Load all starter content into Redis. Pass `force` to re-run even if already seeded. */
export async function seedAll(force = false): Promise<SeedResult> {
  const done = await getJSON<{ at: number }>(SEED_FLAG);
  if (done && !force) return { challenges: 0, npcs: 0, missions: 0, alreadyDone: true };

  for (const c of SEED_CHALLENGES) await saveChallenge(c);
  for (const n of SEED_NPCS) await saveNpc(n);
  for (const m of SEED_MISSIONS) await saveMission(m);

  await setJSON(SEED_FLAG, { at: Date.now() });
  return { challenges: SEED_CHALLENGES.length, npcs: SEED_NPCS.length, missions: SEED_MISSIONS.length, alreadyDone: false };
}
