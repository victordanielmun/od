/**
 * NPC dialogue — text in, text out, via OpenAI. Ported from the Go `dialogue_service` but
 * stripped of audio/pronunciation. The NPC always speaks English (the language being learned)
 * and returns a translation in the player's native language. Grading of "did the player
 * complete the task" is done by the model against the task description.
 *
 * NPC personas are passed in for now; Fase 4 moves NPCDefinition/mission wiring into Redis.
 */
import { requireUser } from '../core/identity.js';
import { chatJSON } from './openai.js';
import { languageName } from './translators.js';
import { isEnglish } from '../repos/translationRepo.js';
import { getNpc } from '../repos/npcRepo.js';
import { getMission, getProgress, nextTaskForNpc, completeTask } from '../repos/missionRepo.js';
import { HttpError } from '../core/http.js';

export interface DialogueTurn {
  player: string;
  npc: string;
}

export interface DialogueRequest {
  npcName: string;
  /** The NPC's personality / knowledge / behaviour instructions. */
  npcInstructions?: string;
  /** Active task the player must fulfil with this NPC, if any. */
  taskDescription?: string;
  playerInput: string;
  history?: DialogueTurn[];
}

export interface DialogueResponse {
  npcResponse: string;       // English
  npcResponseNative: string; // player's native language ("" when native is English)
  npcState: string;          // idle|talking|happy|angry|sad|surprised|thinking|grateful|waiting
  taskCompleted: boolean;
  feedback: string;          // short pedagogical note on the player's English
}

function buildSystemPrompt(req: DialogueRequest, nativeLang: string): string {
  const nativeLangName = languageName(nativeLang);
  const englishOnly = isEnglish(nativeLang);

  const nativeRule = englishOnly
    ? `Use English only for 'npc_response'. Leave 'npc_response_native' as an empty string.`
    : `Use English for 'npc_response', and ALWAYS provide a ${nativeLangName} translation in 'npc_response_native'.`;

  const nativeJsonLine = englishOnly
    ? `"npc_response_native": "",`
    : `"npc_response_native": "translation in ${nativeLangName}",`;

  return `You are ${req.npcName}, a character in an English-learning RPG.

CONTEXT:
- Your personality / knowledge: ${req.npcInstructions || 'A friendly villager. Make small talk and encourage the player.'}
- Active task for the player: ${req.taskDescription || 'No specific task; just chat and help them practice English.'}

BEHAVIOR RULES:
1. Stay in character. ${nativeRule}
2. The player is learning English. To complete any task they MUST write it in English. If they respond in another language, acknowledge it kindly but do NOT mark the task completed.
3. Only set "task_completed": true if the player has clearly and correctly fulfilled the active task in English.
4. Gently correct notable English mistakes in the 'feedback' field (one short sentence). If there are none, leave it empty.
5. Keep 'npc_response' to 1-3 sentences, natural and in character.
6. RESPOND ONLY IN JSON.

JSON FORMAT:
{
  "npc_response": "string in English",
  ${nativeJsonLine}
  "npc_state": "idle|talking|happy|angry|sad|surprised|thinking|grateful|waiting",
  "task_completed": boolean,
  "feedback": "string"
}`;
}

interface RawDialogue {
  npc_response?: string;
  npc_response_native?: string;
  npc_state?: string;
  task_completed?: boolean;
  feedback?: string;
}

/** The pure LLM turn — no identity/persistence, just persona + input → structured reply. */
async function runDialogue(req: DialogueRequest, nativeLang: string): Promise<DialogueResponse> {
  const history = (req.history ?? [])
    .slice(-5)
    .map((h) => `Player: ${h.player}\nNPC: ${h.npc}`)
    .join('\n');
  const userPrompt = `History:\n${history}\nCurrent Input: ${req.playerInput}`;

  const raw = await chatJSON<RawDialogue>(buildSystemPrompt(req, nativeLang), userPrompt, 0.7);
  return {
    npcResponse: raw.npc_response ?? '',
    npcResponseNative: raw.npc_response_native ?? '',
    npcState: raw.npc_state ?? 'talking',
    taskCompleted: raw.task_completed === true,
    feedback: raw.feedback ?? '',
  };
}

/** Free-form dialogue with a persona passed inline (no Redis NPC/mission needed). */
export async function talk(req: DialogueRequest): Promise<DialogueResponse> {
  const { profile } = await requireUser();
  return runDialogue(req, profile.nativeLanguage);
}

// ── Mission-aware dialogue (loads NPC persona + active task from Redis) ─────────

export interface NpcTalkRequest {
  npcId: string;
  missionId?: string;
  playerInput: string;
  history?: DialogueTurn[];
}

export interface NpcTalkResponse extends DialogueResponse {
  missionNewlyCompleted: boolean;
}

/**
 * Talk to a persisted NPC within an optional mission. If the mission's active task for this
 * NPC is a talk/deliver task and the model marks it complete, we persist that progress.
 * Item/enemy conditions are NOT auto-completed here — those belong to combat (Fase 5).
 */
export async function talkToNpc(req: NpcTalkRequest): Promise<NpcTalkResponse> {
  const { user, profile } = await requireUser();

  const npc = await getNpc(req.npcId);
  if (!npc) throw new HttpError(404, 'NPC not found.');

  const mission = req.missionId ? await getMission(req.missionId) : null;
  const progress = mission ? await getProgress(user.userId, mission.id) : null;
  const activeTask = mission ? nextTaskForNpc(mission, progress, npc.id) : undefined;

  const reply = await runDialogue(
    {
      npcName: npc.name,
      npcInstructions: npc.instructions || npc.greeting,
      taskDescription: activeTask?.descriptionEn,
      playerInput: req.playerInput,
      history: req.history,
    },
    profile.nativeLanguage,
  );

  // Only talk/deliver tasks can be completed by conversation alone.
  let missionNewlyCompleted = false;
  if (
    reply.taskCompleted &&
    mission &&
    activeTask &&
    (activeTask.type === 'talk_to_npc' || activeTask.type === 'deliver_message')
  ) {
    const res = await completeTask(user.userId, mission, activeTask.id);
    missionNewlyCompleted = res.missionNewlyCompleted;
  } else {
    // Don't let the model claim completion for non-conversational tasks.
    reply.taskCompleted = false;
  }

  return { ...reply, missionNewlyCompleted };
}
