/**
 * Quests — the mission log + NPC dialogue view. Shows scene missions (objective + tasks,
 * localized), lists NPCs, and opens a text conversation with an NPC via OpenAI. Talk/deliver
 * tasks complete through conversation; the mission list refreshes when progress changes.
 */
import { api, type ClientMission, type ClientNpc, type DialogueTurn } from './api.js';
import { h, withClick } from './dom.js';

const SCENE = 'lobby';

interface DialogueLine {
  who: 'player' | 'npc';
  text: string;
  native?: string;
  feedback?: string;
}

let missions: ClientMission[] = [];
let npcs: ClientNpc[] = [];
let activeNpc: ClientNpc | null = null;
let lines: DialogueLine[] = [];
let history: DialogueTurn[] = [];
let sending = false;
let root: HTMLElement | null = null;

export async function mountQuests(container: HTMLElement): Promise<void> {
  root = container;
  activeNpc = null;
  lines = [];
  history = [];
  root.replaceChildren(h('section', { class: 'card' }, 'Loading quests…'));
  await refresh();
}

export function unmountQuests(): void {
  root = null;
}

async function refresh(): Promise<void> {
  try {
    [missions, npcs] = await Promise.all([api.missionsForScene(SCENE), api.npcsForScene(SCENE)]);
  } catch {
    missions = [];
    npcs = [];
  }
  render();
}

/** The mission whose next incomplete task targets this NPC (for talk/deliver progress). */
function missionForNpc(npcId: string): ClientMission | undefined {
  return missions.find((m) => m.status !== 'completed' && m.tasks.some((t) => !t.isCompleted && t.targetNpcId === npcId));
}

async function openNpc(npc: ClientNpc): Promise<void> {
  activeNpc = npc;
  history = [];
  lines = [{ who: 'npc', text: npc.greeting }];
  render();
}

async function send(input: HTMLInputElement): Promise<void> {
  const text = input.value.trim();
  if (!text || !activeNpc || sending) return;
  input.value = '';
  sending = true;
  lines.push({ who: 'player', text });
  render();

  try {
    const mission = missionForNpc(activeNpc.id);
    const reply = await api.talkToNpc({
      npcId: activeNpc.id,
      missionId: mission?.id,
      playerInput: text,
      history,
    });
    lines.push({ who: 'npc', text: reply.npcResponse, native: reply.npcResponseNative, feedback: reply.feedback });
    history.push({ player: text, npc: reply.npcResponse });
    sending = false;
    render();

    if (reply.taskCompleted || reply.missionNewlyCompleted) await refresh();
  } catch (e) {
    lines.push({ who: 'npc', text: `(…) ${(e as Error).message}` });
    sending = false;
    render();
  }
}

// ── Rendering ────────────────────────────────────────────────────────────────

function missionCard(m: ClientMission): HTMLElement {
  const card = h('section', { class: 'card mission' });
  card.append(h('div', { class: 'badge' }, `${m.mode} · ${m.status}`));
  card.append(h('h2', { class: 'question' }, m.title));
  card.append(h('p', { class: 'native' }, m.objective || m.objectiveEn));

  const list = h('div', { class: 'tasklist' });
  for (const t of m.tasks) {
    list.append(
      h('div', { class: `task ${t.isCompleted ? 'done' : ''}` }, `${t.isCompleted ? '✓' : '○'} ${t.description}`),
    );
  }
  card.append(list);

  if (m.status === 'not_started') {
    card.append(withClick(h('button', { class: 'next' }, 'Accept quest'), async () => {
      await api.acceptMission(m.id);
      await refresh();
    }));
  }
  return card;
}

function npcRow(n: ClientNpc): HTMLElement {
  const hasQuest = !!missionForNpc(n.id);
  const row = withClick(
    h('div', { class: 'lb-row npc-row' }, h('span', {}, `🧙 ${n.name}`), h('span', {}, hasQuest ? '❗' : '💬')),
    () => void openNpc(n),
  );
  return row;
}

function dialoguePanel(): HTMLElement {
  const panel = h('section', { class: 'card chat' });
  panel.append(
    h('div', { class: 'npc-head' },
      h('h3', {}, `🧙 ${activeNpc!.name}`),
      withClick(h('button', { class: 'closebtn' }, '✕'), () => { activeNpc = null; render(); }),
    ),
  );

  const log = h('div', { class: 'chatlog' });
  for (const l of lines) {
    const msg = h('div', { class: `chatmsg ${l.who}` });
    msg.append(h('strong', {}, l.who === 'npc' ? `${activeNpc!.name}: ` : 'You: '), h('span', {}, l.text));
    if (l.native) msg.append(h('p', { class: 'native' }, l.native));
    if (l.feedback) msg.append(h('p', { class: 'feedback' }, `📝 ${l.feedback}`));
    log.append(msg);
  }
  if (sending) log.append(h('div', { class: 'chatmsg npc muted' }, '…'));
  panel.append(log);

  const input = h('input', { class: 'chatinput', placeholder: 'Reply in English…', maxlength: '400' }) as HTMLInputElement;
  input.addEventListener('keydown', (e) => { if ((e as KeyboardEvent).key === 'Enter') void send(input); });
  panel.append(h('div', { class: 'chatrow' }, input, withClick(h('button', { class: 'next' }, 'Send'), () => void send(input))));

  log.scrollTop = log.scrollHeight;
  return panel;
}

function render(): void {
  if (!root) return;
  root.replaceChildren();

  const left = activeNpc ? dialoguePanel() : missionsColumn();
  const side = h('aside', { class: 'leaderboard' });
  side.append(h('h3', {}, '🧙 Characters'));
  if (npcs.length === 0) side.append(h('p', { class: 'muted' }, 'No one is here yet. Seed content in the Learn tab.'));
  for (const n of npcs) side.append(npcRow(n));

  root.append(h('main', { class: 'layout' }, left, side));
}

function missionsColumn(): HTMLElement {
  const col = h('div', {});
  if (missions.length === 0) {
    col.append(h('section', { class: 'card' }, h('p', { class: 'muted' }, 'No quests in this area yet.')));
  }
  for (const m of missions) col.append(missionCard(m));
  return col;
}
