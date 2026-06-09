import { useAuthStore } from '../../store/authStore';
import { useGameStore } from '../../store/gameStore';
import { PlayerSprite } from '../entities/PlayerSprite';

export class PlayerManager {
  constructor(scene) {
    this.scene = scene;
    this.sprites = new Map();
    this.myPlayerId = null;

    // Initialize myPlayerId early
    const user = useAuthStore.getState().user;
    if (user?.id) {
      this.myPlayerId = String(user.id);
    }
  }

  createMyPlayer() {
    const user = useAuthStore.getState().user;
    if (!user?.id) return;
    this.myPlayerId = String(user.id);

    const urlParams = new URLSearchParams(window.location.search);
    let startX = this.scene.initData?.spawnX != null ? Number(this.scene.initData.spawnX) : (urlParams.get('spawnX') ? Number(urlParams.get('spawnX')) : null);
    let startY = this.scene.initData?.spawnY != null ? Number(this.scene.initData.spawnY) : (urlParams.get('spawnY') ? Number(urlParams.get('spawnY')) : null);

    if (startX == null || startY == null || isNaN(startX) || isNaN(startY)) {
      startX = this.scene.mapDefaultSpawnX ?? 1000;
      startY = this.scene.mapDefaultSpawnY ?? 350;
    }

    const GRID = this.scene.GRID_SIZE || 100;
    const snapToGrid = (v) => Math.floor(v / GRID) * GRID + GRID / 2;
    const isBlockedAt = (sx, sy) => {
      const gx = snapToGrid(sx);
      const gy = snapToGrid(sy);
      
      const checkGroup = (group) => {
        if (!group || typeof group.getChildren !== 'function') return false;
        try {
          const children = group.getChildren();
          if (!children || !Array.isArray(children)) return false;
          return children.some(v => Math.abs(v.x - gx) < GRID / 2 && Math.abs(v.y - gy) < GRID / 2);
        } catch (e) {
          return false;
        }
      };

      if (checkGroup(this.scene.voids)) return true;
      if (checkGroup(this.scene.walls)) return true;
      if (checkGroup(this.scene.colliders)) return true;
      return false;
    };

    if (isBlockedAt(startX, startY)) {
      console.warn('[PlayerManager] Spawn coords land on a blocked tile — falling back to map default or center');
      startX = this.scene.mapDefaultSpawnX ?? Math.floor(this.scene.mapWidth / 2);
      startY = this.scene.mapDefaultSpawnY ?? Math.floor(this.scene.mapHeight / 2);
      if (isBlockedAt(startX, startY)) { startX += GRID; startY += GRID; }
    }

    this.scene.player = new PlayerSprite(
      this.scene,
      startX,
      startY,
      user?.character_id || '1',
      undefined,
      user?.username || 'Guest',
      true
    );

    console.log(`[PlayerManager] Created self PlayerSprite (ID: ${this.myPlayerId}) at (${startX}, ${startY})`);
    this.scene.add.existing(this.scene.player);

    this.scene.cameras.main.centerOn(startX, startY);
    this.scene.cameras.main.startFollow(this.scene.player, true, 0.1, 0.1);

    if (this.scene.walls) this.scene.physics.add.collider(this.scene.player, this.scene.walls);
    if (this.scene.forest) this.scene.physics.add.collider(this.scene.player, this.scene.forest);
    if (this.scene.builds) this.scene.physics.add.collider(this.scene.player, this.scene.builds);
    if (this.scene.voids) this.scene.physics.add.collider(this.scene.player, this.scene.voids);
    if (this.scene.colliders) this.scene.physics.add.collider(this.scene.player, this.scene.colliders);
    if (this.scene.storeFurniture) this.scene.physics.add.collider(this.scene.player, this.scene.storeFurniture);

    if (this.scene.npcs) {
      this.scene.npcs.forEach(npc => this.scene.physics.add.collider(this.scene.player, npc));
    }
    
    // Add colliders for existing other players (if any already created)
    this.sprites.forEach(sprite => this.scene.physics.add.collider(this.scene.player, sprite));

    this.scene.cameras.main.startFollow(this.scene.player, true, 0.1, 0.1);

    // If editor was already active (e.g. opened via ?edit_map URL before player spawned),
    // re-apply the move mode so camera/alpha state is consistent.
    if (this.scene.editorMode && this.scene.editorController) {
      console.log('[PlayerManager] Editor was active at spawn — re-applying editor move mode.');
      this.scene.editorController._applyMoveMode(this.scene.editorController.moveMode);
    }

    console.log(`[PlayerManager] Broadcasting initial spawn position: (${startX}, ${startY})`);
    useGameStore.getState().movePlayer(startX, startY, 'right', 'idle');
  }

  handlePlayersUpdate(players) {
    if (!players || this.scene.isMapLoading) return;

    const currentUser = useAuthStore.getState().user;
    if (!this.myPlayerId && currentUser?.id) {
      this.myPlayerId = String(currentUser.id);
    }
    const myIdStr = this.myPlayerId ? String(this.myPlayerId) : null;
    const currentUserIdStr = currentUser?.id ? String(currentUser.id) : null;

    if (myIdStr && this.sprites.has(myIdStr)) {
      console.log(`[PlayerManager] Cleaning up accidental duplicate of self (${myIdStr})`);
      this.removeOtherPlayer(myIdStr);
    }
    if (currentUserIdStr && currentUserIdStr !== myIdStr && this.sprites.has(currentUserIdStr)) {
      this.removeOtherPlayer(currentUserIdStr);
    }

    players.forEach((player, id) => {
      const strId = String(id);
      const isMe = (myIdStr && strId === myIdStr) || (currentUserIdStr && strId === currentUserIdStr);
      if (isMe) return;

      if (!this.sprites.has(strId)) {
        console.log(`[PlayerManager] Found new player in store: ${strId} (${player.username}). Creating sprite...`);
        this.addOtherPlayer(strId, player);
      } else {
        this.updateOtherPlayer(strId, player);
      }
    });

    this.sprites.forEach((sprite, id) => {
      if (!players.has(id)) {
        console.log("[PlayerManager] Removing sprite for:", id);
        this.removeOtherPlayer(id);
      }
    });
  }

  addOtherPlayer(id, player) {
    let x = Number(player.x);
    let y = Number(player.y);

    if (isNaN(x)) x = 1000;
    if (isNaN(y)) y = 350;

    console.log(`[PlayerManager] Adding remote player sprite: ${player.username} (ID: ${id}) at (${x}, ${y})`);

    const newPlayer = new PlayerSprite(
      this.scene,
      x,
      y,
      player.character_id || '1',
      undefined,
      player.username || 'Unknown',
      false
    );

    this.scene.add.existing(newPlayer);
    this.sprites.set(id, newPlayer);

    if (this.scene.player && this.scene.player.body) {
      this.scene.physics.add.collider(this.scene.player, newPlayer);
    }
  }

  updateOtherPlayer(id, player) {
    const sprite = this.sprites.get(id);
    if (!sprite) return;

    if (typeof player.x !== 'number' || typeof player.y !== 'number' || isNaN(player.x) || isNaN(player.y)) {
      return;
    }

    if (sprite.targetX === player.x && sprite.targetY === player.y) {
      return;
    }

    sprite.targetX = player.x;
    sprite.targetY = player.y;

    if (sprite.alpha < 0.1 || !sprite.visible) {
      sprite.setAlpha(1);
      sprite.setVisible(true);
    }

    const dx = player.x - sprite.x;
    const dy = player.y - sprite.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Reproducir animaciones de combate/acción recibidas por red.
    // Mapa: nombre de animación → duración de lock en ms
    const COMBAT_ANIM_LOCKS = {
      // Combos (sheet 1b fila 1-3)
      combo1:       450,
      combo2:       500,
      combo3:       600,
      // Habilidades (sheet 1b fila 4-5)
      special:      1200,
      projectile:   600,
      // Acciones base (sheet 1a)
      potion:       900,
      block:        0,    // continua mientras dure el estado
      // Reacciones
      hurt:         350,
      dead:         2000,
      // Legacy: nombres que puedan venir del backend antiguo
      slash:        500,
      die:          2000,
    };

    if (player.anim in COMBAT_ANIM_LOCKS) {
      // EVITAR LOOP: Solo disparar si cambió el estado
      if (sprite._networkAnim !== player.anim) {
        const lockDur = COMBAT_ANIM_LOCKS[player.anim];
        sprite.playAnimation(player.anim, lockDur);

        // Auto-recuperar la animación base al terminar el combate (excepto dead/die)
        const isPermanent = player.anim === 'dead' || player.anim === 'die';
        if (!isPermanent && lockDur > 0) {
          sprite.scene.time.delayedCall(lockDur, () => {
            sprite._animLocked = false;
            sprite.playAnimation(sprite._pendingMovementAnim || 'idle');
          });
        }
        // 'block' con lock=0 se mantiene hasta que cambie el anim
      }
    } else {
      sprite._pendingMovementAnim = (player.anim === 'walk' || dist > 2) ? 'walk' : 'idle';
      if (!sprite._animLocked) {
        sprite.playAnimation(sprite._pendingMovementAnim);
      }
    }
    sprite._networkAnim = player.anim;

    if (player.direction === 'left') {
      sprite.sprite.setFlipX(true);
    } else if (player.direction === 'right') {
      sprite.sprite.setFlipX(false);
    }

    if (player.character_id && sprite.characterId !== player.character_id) {
      console.log(`[PlayerManager] Player ${id} changed character to ${player.character_id}. Updating sprite...`);
      sprite.characterId = player.character_id;
      sprite.updateSpriteTexture(player.character_id);
    }

    let duration = 150;
    const pTime = Number(player.timestamp);
    const sTime = Number(sprite.lastTimestamp);

    if (!isNaN(pTime) && !isNaN(sTime)) {
      duration = pTime - sTime;
      duration = Math.max(50, Math.min(500, duration));
    }
    
    if (isNaN(duration)) duration = 150;
    sprite.lastTimestamp = !isNaN(pTime) ? pTime : Date.now();

    if (isNaN(sprite.x) || isNaN(sprite.y)) {
      console.error(`[PlayerManager] Player ${sprite.username} had NaN position! Recovering to (${player.x}, ${player.y})`);
      sprite.setPosition(player.x, player.y);
      this.scene.tweens.killTweensOf(sprite);
      return;
    }

    if (dist > 300) {
      console.log(`[PlayerManager] Teleporting player ${id} to (${player.x}, ${player.y}) - Distance: ${dist.toFixed(2)}`);
      sprite.setPosition(player.x, player.y);
      this.scene.tweens.killTweensOf(sprite);
    } else {
      this.scene.tweens.killTweensOf(sprite);
      this.scene.tweens.add({
        targets: sprite,
        x: player.x,
        y: player.y,
        duration: duration,
        onComplete: () => {
          if (player.anim === 'idle') {
            sprite.playAnimation('idle');
          }
        }
      });
    }
  }

  removeOtherPlayer(id) {
    const sprite = this.sprites.get(id);
    if (sprite) {
      console.log(`[PlayerManager] Removing player sprite: ${sprite.username} (ID: ${id})`);
      sprite.destroy();
      this.sprites.delete(id);
    }
  }
}
