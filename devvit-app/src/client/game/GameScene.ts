/**
 * Phaser world scene. Placeholder graphics (circles/labels) so it runs WITHOUT the art
 * assets — sprites swap in later. Multiplayer model (see shared/realtime.ts):
 *   · Local player: moved by input, position throttle-broadcast via `hooks.onMove`.
 *   · Remote players: created/updated from `move` messages, interpolated.
 *   · Enemies: the elected HOST ticks a simple chase AI and broadcasts snapshots; everyone
 *     else renders the host's snapshot. A kill is resolved server-side (Ninja Card) and
 *     removed for all via `removeEnemy`.
 *
 * NOTE: needs `devvit playtest` to validate at runtime (input/netcode/timing).
 */
import Phaser from 'phaser';
import type { EnemyState } from '../../shared/realtime.js';

export interface GameHooks {
  onMove: (x: number, y: number, dir: string, state: string) => void;
  onAttack: (enemyId: string, enemyType: string) => void;
  onEnemySnapshot: (enemies: EnemyState[]) => void;
  isHost: () => boolean;
}

export const WORLD_W = 800;
export const WORLD_H = 560;
const SPEED = 190;
const MOVE_HZ = 6;
const ENEMY_HZ = 5;
const ENEMY_SPEED = 60;
const ATTACK_RANGE = 60;

interface Remote {
  sprite: Phaser.GameObjects.Arc;
  label: Phaser.GameObjects.Text;
  tx: number;
  ty: number;
}
interface Enemy {
  sprite: Phaser.GameObjects.Arc;
  label: Phaser.GameObjects.Text;
  state: EnemyState;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const dirOf = (vx: number, vy: number) =>
  Math.abs(vx) > Math.abs(vy) ? (vx > 0 ? 'east' : 'west') : vy > 0 ? 'south' : 'north';

export class GameScene extends Phaser.Scene {
  private hooks!: GameHooks;
  private player!: Phaser.GameObjects.Arc;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private remotes = new Map<string, Remote>();
  private enemies = new Map<string, Enemy>();
  private lastMove = 0;
  private lastEnemyBroadcast = 0;
  private dir = 'south';
  private host = false;
  private spawned = false;

  constructor() {
    super('game');
  }

  init(data: { hooks: GameHooks }): void {
    this.hooks = data.hooks;
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#1c1710');
    const g = this.add.graphics();
    g.lineStyle(2, 0x3d3222, 1);
    g.strokeRect(4, 4, WORLD_W - 8, WORLD_H - 8);

    this.player = this.add.circle(WORLD_W / 2, WORLD_H / 2, 14, 0xe0a145).setDepth(5);
    this.add.text(6, WORLD_H - 20, 'WASD / arrows to move · SPACE to attack', { fontSize: '12px', color: '#9c8f79' });

    const kb = this.input.keyboard!;
    this.cursors = kb.createCursorKeys();
    this.keys = kb.addKeys('W,A,S,D') as Record<string, Phaser.Input.Keyboard.Key>;
    kb.on('keydown-SPACE', () => this.tryAttack());

    // Establish initial host role now that the scene systems are ready.
    this.setHost(this.hooks.isHost());
  }

  update(time: number, delta: number): void {
    this.handleMovement(time, delta);

    for (const r of this.remotes.values()) {
      r.sprite.x = lerp(r.sprite.x, r.tx, 0.2);
      r.sprite.y = lerp(r.sprite.y, r.ty, 0.2);
      r.label.setPosition(r.sprite.x, r.sprite.y - 24);
    }

    if (this.host) this.tickEnemies(time, delta);
    for (const e of this.enemies.values()) {
      e.sprite.setPosition(e.state.x, e.state.y);
      e.label.setPosition(e.state.x, e.state.y - 22);
    }
  }

  // ── Local movement ───────────────────────────────────────────────────────────

  private handleMovement(time: number, delta: number): void {
    let vx = 0;
    let vy = 0;
    if (this.cursors.left.isDown || this.keys['A']!.isDown) vx -= 1;
    if (this.cursors.right.isDown || this.keys['D']!.isDown) vx += 1;
    if (this.cursors.up.isDown || this.keys['W']!.isDown) vy -= 1;
    if (this.cursors.down.isDown || this.keys['S']!.isDown) vy += 1;

    const moving = vx !== 0 || vy !== 0;
    if (moving) {
      const len = Math.hypot(vx, vy);
      this.player.x = clamp(this.player.x + (vx / len) * SPEED * (delta / 1000), 16, WORLD_W - 16);
      this.player.y = clamp(this.player.y + (vy / len) * SPEED * (delta / 1000), 16, WORLD_H - 16);
      this.dir = dirOf(vx, vy);
    }

    if (time - this.lastMove > 1000 / MOVE_HZ) {
      this.lastMove = time;
      this.hooks.onMove(Math.round(this.player.x), Math.round(this.player.y), this.dir, moving ? 'walking' : 'idle');
    }
  }

  private tryAttack(): void {
    let nearest: Enemy | undefined;
    let best = ATTACK_RANGE;
    for (const e of this.enemies.values()) {
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, e.state.x, e.state.y);
      if (d < best) {
        best = d;
        nearest = e;
      }
    }
    if (nearest) this.hooks.onAttack(nearest.state.id, nearest.state.type);
  }

  // ── Remote players ───────────────────────────────────────────────────────────

  setRemotePlayer(userId: string, x: number, y: number): void {
    let r = this.remotes.get(userId);
    if (!r) {
      const sprite = this.add.circle(x, y, 13, 0x6fa8dc).setDepth(4);
      const label = this.add.text(x, y - 24, '🧑', { fontSize: '12px' }).setOrigin(0.5);
      r = { sprite, label, tx: x, ty: y };
      this.remotes.set(userId, r);
    }
    r.tx = x;
    r.ty = y;
  }

  removeRemotePlayer(userId: string): void {
    const r = this.remotes.get(userId);
    if (r) {
      r.sprite.destroy();
      r.label.destroy();
      this.remotes.delete(userId);
    }
  }

  // ── Enemies ──────────────────────────────────────────────────────────────────

  setHost(isHost: boolean): void {
    this.host = isHost;
    if (isHost && !this.spawned) this.spawnEnemies();
  }

  private spawnEnemies(): void {
    this.spawned = true;
    const types = ['slime', 'goblin', 'boss'];
    for (let i = 0; i < 3; i++) {
      const id = `e${i}-${Date.now()}`;
      const state: EnemyState = {
        id,
        type: types[i] ?? 'slime',
        x: 120 + i * 220,
        y: 120,
        hp: 3,
        state: 'walking',
      };
      this.upsertEnemy(state);
    }
  }

  private tickEnemies(time: number, delta: number): void {
    for (const e of this.enemies.values()) {
      const target = this.nearestPlayerTo(e.state.x, e.state.y);
      const dx = target.x - e.state.x;
      const dy = target.y - e.state.y;
      const len = Math.hypot(dx, dy) || 1;
      e.state.x = clamp(e.state.x + (dx / len) * ENEMY_SPEED * (delta / 1000), 16, WORLD_W - 16);
      e.state.y = clamp(e.state.y + (dy / len) * ENEMY_SPEED * (delta / 1000), 16, WORLD_H - 16);
    }
    if (time - this.lastEnemyBroadcast > 1000 / ENEMY_HZ) {
      this.lastEnemyBroadcast = time;
      this.hooks.onEnemySnapshot([...this.enemies.values()].map((e) => e.state));
    }
  }

  private nearestPlayerTo(x: number, y: number): { x: number; y: number } {
    let best = { x: this.player.x, y: this.player.y };
    let bestD = Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y);
    for (const r of this.remotes.values()) {
      const d = Phaser.Math.Distance.Between(x, y, r.tx, r.ty);
      if (d < bestD) {
        bestD = d;
        best = { x: r.tx, y: r.ty };
      }
    }
    return best;
  }

  /** Non-host: reconcile the rendered enemies with the host's authoritative snapshot. */
  applyEnemySnapshot(snapshot: EnemyState[]): void {
    if (this.host) return;
    const seen = new Set<string>();
    for (const s of snapshot) {
      this.upsertEnemy(s);
      seen.add(s.id);
    }
    for (const id of [...this.enemies.keys()]) {
      if (!seen.has(id)) this.removeEnemy(id);
    }
  }

  private upsertEnemy(state: EnemyState): void {
    let e = this.enemies.get(state.id);
    if (!e) {
      const color = state.type === 'boss' ? 0xb23b3b : 0xcc5b4a;
      const sprite = this.add.circle(state.x, state.y, state.type === 'boss' ? 20 : 14, color).setDepth(3);
      const label = this.add.text(state.x, state.y - 22, state.type, { fontSize: '11px', color: '#ece3d4' }).setOrigin(0.5);
      e = { sprite, label, state };
      this.enemies.set(state.id, e);
    } else {
      e.state = state;
    }
  }

  removeEnemy(enemyId: string): void {
    const e = this.enemies.get(enemyId);
    if (e) {
      e.sprite.destroy();
      e.label.destroy();
      this.enemies.delete(enemyId);
    }
  }
}
