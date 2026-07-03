/**
 * NPC service — read-only listing of the NPCs present in a scene, for the quest/dialogue UI.
 * The AI `instructions` field is intentionally NOT exposed to the client (server-only persona).
 */
import { requireUser } from '../core/identity.js';
import { listNpcsByScene } from '../repos/npcRepo.js';

export interface ClientNpc {
  id: string;
  name: string;
  sprite: string;
  greeting: string;
  type: string;
}

export async function listForScene(sceneKey: string): Promise<ClientNpc[]> {
  await requireUser();
  const npcs = await listNpcsByScene(sceneKey);
  return npcs.map((n) => ({ id: n.id, name: n.name, sprite: n.sprite, greeting: n.greeting, type: n.type }));
}
