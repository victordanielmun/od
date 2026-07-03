/**
 * Tavern — the multiplayer room view: live presence + text chat over Devvit Realtime. Proves
 * the social/multiplayer core end to end. Movement/Phaser rendering layers on top later using
 * the same channel (the `move`/`enemy` messages are already in the contract).
 *
 * One shared room per post; here we use a constant id for the demo (prod: the postId).
 */
import { api, type PresentUser } from './api.js';
import { subscribeRoom, type RoomConnection } from './realtime.js';
import { h, withClick } from './dom.js';
import type { ChatEvent } from '../shared/realtime.js';

const ROOM_ID = 'lobby';
const PING_MS = 15_000;

let conn: RoomConnection | null = null;
let pingTimer: number | null = null;
let users: PresentUser[] = [];
let messages: ChatEvent[] = [];
let root: HTMLElement | null = null;

export async function mountTavern(container: HTMLElement): Promise<void> {
  root = container;
  messages = [];
  users = [];
  renderShell();

  try {
    const [joinRes, history] = await Promise.all([api.roomJoin(ROOM_ID), api.roomChatHistory(ROOM_ID)]);
    users = joinRes.users;
    messages = history;
  } catch {
    // presence/chat unavailable — still show the shell
  }
  renderShell();

  conn = subscribeRoom(ROOM_ID, (msg) => {
    if (msg.kind === 'presence') {
      if (msg.event === 'join' && !users.some((u) => u.userId === msg.userId)) {
        users = [...users, { userId: msg.userId, username: msg.username }];
      } else if (msg.event === 'leave') {
        users = users.filter((u) => u.userId !== msg.userId);
      }
      renderPresence();
    } else if (msg.kind === 'chat') {
      messages = [...messages, msg].slice(-50);
      renderChat();
    }
  });

  pingTimer = window.setInterval(() => {
    api.roomPing(ROOM_ID).then((r) => {
      users = r.users;
      renderPresence();
    }).catch(() => {});
  }, PING_MS);
}

export function unmountTavern(): void {
  if (pingTimer !== null) { clearInterval(pingTimer); pingTimer = null; }
  if (conn) { conn.disconnect(); conn = null; }
  api.roomLeave(ROOM_ID).catch(() => {});
  root = null;
}

// ── Rendering ────────────────────────────────────────────────────────────────

function renderShell(): void {
  if (!root) return;
  root.replaceChildren();

  const presence = h('aside', { class: 'leaderboard', id: 'presence' });
  const chat = h('section', { class: 'card chat', id: 'chatcard' });
  const layout = h('main', { class: 'layout' }, chat, presence);
  root.append(layout);

  renderPresence();
  renderChat();
}

function renderPresence(): void {
  const el = document.getElementById('presence');
  if (!el) return;
  el.replaceChildren(h('h3', {}, `🛡️ In the Tavern (${users.length})`));
  if (users.length === 0) el.append(h('p', { class: 'muted' }, 'Nobody here yet.'));
  for (const u of users) el.append(h('div', { class: 'lb-row' }, h('span', {}, `🧑 ${u.username}`), h('span', {}, '')));
}

function renderChat(): void {
  const card = document.getElementById('chatcard');
  if (!card) return;
  card.replaceChildren(h('h3', {}, '💬 Tavern Chat'));

  const log = h('div', { class: 'chatlog' });
  for (const m of messages) {
    log.append(h('div', { class: 'chatmsg' }, h('strong', {}, `${m.username}: `), h('span', {}, m.text)));
  }
  card.append(log);

  const input = h('input', { class: 'chatinput', placeholder: 'Say something in English…', maxlength: '500' }) as HTMLInputElement;
  const send = () => {
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    api.roomSendChat(ROOM_ID, text).catch(() => {});
  };
  input.addEventListener('keydown', (e) => { if ((e as KeyboardEvent).key === 'Enter') send(); });

  const row = h('div', { class: 'chatrow' }, input, withClick(h('button', { class: 'next' }, 'Send'), send));
  card.append(row);
  log.scrollTop = log.scrollHeight;
}
