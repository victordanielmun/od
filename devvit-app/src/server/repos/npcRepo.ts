/**
 * NPC repo. Definitions are JSON records indexed by scene. The `instructions` field is the
 * AI persona fed to the dialogue LLM (see dialogueService).
 */
import { keys } from '../core/keys.js';
import { getJSON, setJSON, indexAdd, indexMembers } from '../core/redis.js';
import type { NPCDefinition } from '../../shared/types.js';

export async function saveNpc(def: NPCDefinition): Promise<void> {
  await setJSON(keys.npcDef(def.id), def);
  if (def.sceneKey) await indexAdd(keys.ixNpcTemplatesByScene(def.sceneKey), def.id);
}

export async function getNpc(id: string): Promise<NPCDefinition | null> {
  return getJSON<NPCDefinition>(keys.npcDef(id));
}

export async function listNpcsByScene(sceneKey: string): Promise<NPCDefinition[]> {
  const ids = await indexMembers(keys.ixNpcTemplatesByScene(sceneKey));
  const out: NPCDefinition[] = [];
  for (const id of ids) {
    const n = await getNpc(id);
    if (n) out.push(n);
  }
  return out;
}
