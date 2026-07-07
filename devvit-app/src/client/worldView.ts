/**
 * World — the Phaser multiplayer scene wired to Realtime. Handles presence, host election
 * (lowest userId in the room runs the enemy AI), position/enemy relay through the server, and
 * the Ninja Card combat modal (an English challenge that must be answered to kill an enemy).
 *
 * NOTE: this layer needs `devvit playtest` to validate at runtime.
 */
import Phaser from 'phaser';
import { api } from './api.js';
import { subscribeRoom, type RoomConnection } from './realtime.js';
import { h } from './dom.js';
import { GameScene, WORLD_W, WORLD_H, type GameHooks } from './game/GameScene.js';

const ROOM_ID = 'lobby';
const PING_MS = 15_000;

let game: Phaser.Game | null = null;
let scene: GameScene | null = null;
let conn: RoomConnection | null = null;
let pingTimer: number | null = null;
let myId = '';
let users: string[] = [];
let modalOpen = false;

function amHost(): boolean {
  if (!myId || users.length === 0) return false;
  return [...users].sort()[0] === myId;
}

function trackUsers(list: string[]): void {
  users = list;
  if (myId && !users.includes(myId)) users.push(myId);
}

export async function mountWorld(container: HTMLElement): Promise<void> {
  container.replaceChildren(h('div', { id: 'game-holder', class: 'game-holder' }));

  try {
    myId = (await api.me()).profile.userId;
  } catch {
    myId = '';
  }
  try {
    trackUsers((await api.roomJoin(ROOM_ID)).users.map((u) => u.userId));
  } catch {
    trackUsers([]);
  }

  // Fetch active missions for the room
  let activeMissions: any[] = [];
  try {
    activeMissions = await api.missionsForScene(ROOM_ID);
  } catch {
    activeMissions = [];
  }

  const hooks: GameHooks = {
    onMove: (x, y, dir, state) => void api.roomMove(ROOM_ID, x, y, dir, state).catch(() => {}),
    onAttack: (enemyId, enemyType) => void openNinjaCard(enemyId, enemyType),
    onEnemySnapshot: (enemies) => void api.roomEnemies(ROOM_ID, enemies).catch(() => {}),
    isHost: amHost,
    canAttack: () => {
      const active = activeMissions.find(m => m.status === 'in_progress');
      if (!active) return true;
      return active.tasks.some((t: any) => t.type === 'defeat_enemy' || t.type === 'kill_all' || t.type === 'kill_boss');
    }
  };

  game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game-holder',
    width: WORLD_W,
    height: WORLD_H,
    backgroundColor: '#1c1710',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_HORIZONTALLY },
  });
  scene = game.scene.add('game', GameScene, true, { hooks }) as GameScene;

  conn = subscribeRoom(ROOM_ID, (msg) => {
    if (!scene) return;
    if (msg.kind === 'move') {
      if (msg.userId !== myId) scene.setRemotePlayer(msg.userId, msg.x, msg.y);
    } else if (msg.kind === 'presence') {
      if (msg.event === 'join' && !users.includes(msg.userId)) users.push(msg.userId);
      if (msg.event === 'leave') {
        users = users.filter((u) => u !== msg.userId);
        scene.removeRemotePlayer(msg.userId);
      }
      scene.setHost(amHost());
    } else if (msg.kind === 'enemy') {
      if (msg.hostId !== myId) scene.applyEnemySnapshot(msg.enemies);
    } else if (msg.kind === 'enemy_killed') {
      scene.removeEnemy(msg.enemyId);
    }
  });

  pingTimer = window.setInterval(() => {
    api.roomPing(ROOM_ID)
      .then((r) => {
        trackUsers(r.users.map((u) => u.userId));
        scene?.setHost(amHost());
      })
      .catch(() => {});
  }, PING_MS);
}

export function unmountWorld(): void {
  if (pingTimer !== null) {
    clearInterval(pingTimer);
    pingTimer = null;
  }
  if (conn) {
    conn.disconnect();
    conn = null;
  }
  api.roomLeave(ROOM_ID).catch(() => {});
  if (game) {
    game.destroy(true);
    game = null;
  }
  scene = null;
  document.querySelector('.modal-overlay')?.remove();
  modalOpen = false;
}

// ── Ninja Card combat modal ────────────────────────────────────────────────────

async function openNinjaCard(enemyId: string, enemyType: string): Promise<void> {
  if (modalOpen) return;
  modalOpen = true;

  let challenge;
  try {
    challenge = await api.randomChallenge();
  } catch {
    modalOpen = false;
    return;
  }

  const overlay = h('div', { class: 'modal-overlay' });
  const card = h('div', { class: 'card modal' });
  card.append(h('div', { class: 'badge' }, `⚔️ Ninja Card · ${enemyType}`));
  card.append(h('h2', { class: 'question' }, challenge.question));
  if (challenge.questionNative && challenge.nativeLang !== 'en') {
    card.append(h('p', { class: 'native' }, challenge.questionNative));
  }

  const options = [challenge.option1, challenge.option2, challenge.option3];
  const opts = h('div', { class: 'options' });
  const close = () => {
    overlay.remove();
    modalOpen = false;
  };

  options.forEach((text, i) => {
    const btn = h('button', { class: 'opt' }, text);
    btn.addEventListener('click', async () => {
      try {
        const res = await api.ninjaCard({ roomId: ROOM_ID, enemyId, enemyType, challengeId: challenge!.id, selectedOption: i + 1 });
        if (res.killed) scene?.removeEnemy(enemyId);
      } catch {
        // ignore; keep the enemy
      }
      close();
    });
    opts.append(btn);
  });
  card.append(opts);
  card.append(
    (() => {
      const b = h('button', { class: 'closebtn flee' }, 'Flee');
      b.addEventListener('click', close);
      return b;
    })(),
  );

  overlay.append(card);
  document.body.append(overlay);
}
