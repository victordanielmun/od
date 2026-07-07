import { useGameStore } from '../../store/gameStore';
import { NPCSprite } from '../entities/NPCSprite';
import { STATE_TO_ANIM } from '../config/NPCConfig';
import api from '../../services/api';

const Phaser = window.Phaser;

// Owns the lobby's NPC lifecycle: fetching instances from the backend,
// spawning sprites, mission-indicator state, and per-frame wander movement.
// The scene exposes `npcs` / `npcSprites` as getters onto this manager.
export class NPCManager {
  constructor(scene) {
    this.scene = scene;
    this.npcs = [];               // Array of containers
    this.npcSprites = new Map();  // npcTemplateId -> container
    this.lastLoadedRoomId = null;
    this.lastLoadedSceneKey = null;
  }

  // Reset transient spawn state on scene (re)create.
  reset() {
    this.npcs = [];
    this.npcSprites = new Map();
    this.lastLoadedRoomId = null;
    this.lastLoadedSceneKey = null;
  }

  async loadNPCs() {
    const scene = this.scene;

    // NPC spritesheets are streamed in after the map paints. Spawning before they
    // land would render textureless/animationless NPCs and (worse) lock the
    // dedupe guard with broken sprites. The deferred-load completion handler in
    // LobbyScene re-invokes loadNPCs() once npcTexturesReady flips to true.
    if (!scene.npcTexturesReady) {
      console.log('[NPCManager] NPC textures not ready yet; deferring spawn until they finish loading.');
      return;
    }

    const roomId = scene.initData?.roomId || useGameStore.getState().currentRoomId;
    if (!roomId) return;

    if (this.lastLoadedRoomId === roomId && this.lastLoadedSceneKey === scene.currentMapKey) {
      console.log(`[NPCManager] NPCs already loaded for room ${roomId} and map ${scene.currentMapKey}`);
      return;
    }

    try {
      console.log(`[NPCManager] Fetching NPCs for Room: ${roomId}, Map: ${scene.currentMapKey}`);
      const response = await api.get(`/rooms/${roomId}/npcs`, {
        params: { scene_key: scene.currentMapKey }
      });

      if (response.data) {
        // Clear existing NPCs
        this.npcs.forEach(npc => npc.destroy());
        this.npcs = [];
        this.npcSprites.clear();

        response.data.forEach(instance => this.createNPCSprite(instance));

        // Only lock the dedupe guard once we actually rendered NPCs. If the list
        // came back empty or nothing rendered (a transient race), leave the guard
        // open so a later trigger (room subscription / map reload) retries instead
        // of forcing the user to refresh.
        const received = response.data.length;
        const rendered = this.npcs.length;
        console.log(`[NPCManager] Rendered ${rendered}/${received} NPCs (room ${roomId}, map ${scene.currentMapKey}) — guard ${rendered > 0 ? 'LOCKED' : 'OPEN (will retry)'}`);
        if (rendered > 0) {
          this.lastLoadedRoomId = roomId;
          this.lastLoadedSceneKey = scene.currentMapKey;
        }

        // Update indicators based on active mission
        this.handleMissionUpdate(useGameStore.getState().activeMission);
      }
    } catch (err) {
      console.error('[NPCManager] Failed to load NPCs:', err);
    }
  }

  createNPCSprite(instance) {
    const scene = this.scene;
    console.log('[NPCManager] Raw instance from API:', instance);
    const tmpl = instance.npc_template;
    const def = tmpl?.npc_definition;
    if (!tmpl || !def) {
      console.warn('[NPCManager] Skipping NPC instance with missing template/definition:', instance?.id, { hasTemplate: !!tmpl, hasDefinition: !!def });
      return;
    }

    console.log(`[NPCManager] Spawning NPC: ${def.name} at (${tmpl.position_x}, ${tmpl.position_y})`);

    // Use a container for name tags and indicators
    const container = scene.add.container(tmpl.position_x, tmpl.position_y);
    container.setDepth(tmpl.position_y);

    // FIX: Si hay un marcador de editor ('tile-npc') debajo, lo ocultamos para que no haga de "fondo"
    if (scene.npcZones) {
      scene.npcZones.getChildren().forEach(zone => {
        if (Math.abs(zone.x - tmpl.position_x) < 5 && Math.abs(zone.y - tmpl.position_y) < 5) {
          zone.setVisible(false);
        }
      });
    }

    // NPC Sprite (using NPCSprite for high-quality visuals)
    // FIX: Usamos def.character_id o def.sprite en lugar de tmpl.id para cargar el arte correcto
    const sprite = new NPCSprite(
      scene,
      0, 0,
      def.character_id || def.sprite || '2',
      def.name
    );

    // NPC doesn't move by default, so we set it to idle facing the default direction
    const facing = tmpl.facing_direction || 'south';
    sprite.setFacing(facing);

    const defState = tmpl.default_state || def.default_state || 'idle';
    const initialAnim = STATE_TO_ANIM[defState] || STATE_TO_ANIM.idle;
    const spawnAnim = defState === 'walking' ? 'idle-waiting' : (initialAnim.body || 'idle-waiting');
    sprite.playAnimation(spawnAnim);

    container.add(sprite);

    // Store essential data for interactions
    container.npcData = {
      templateId: tmpl.id,
      definitionId: def.id,
      instanceId: instance.id,
      characterId: def.character_id || def.sprite || '2',
      name: def.name,
      // The NPC definition's type (quest_master, merchant, ...). Passed so the
      // dialogue UI can render the right surface (mission board / shop) instantly
      // on open, without waiting for the missions API to resolve the type.
      type: def.type,
      role: instance.role || tmpl.role || 'ambient',
      interactionMode: def.interaction_mode || 'hybrid',
      voiceType: def.voice_type || 'male',
      defaultState: defState,
      missionId: instance.mission_id,
      shopId: def.shop_id,
      roomId: instance.room_id,
      // Movement Params
      movementType: tmpl.movement_type || (defState === 'walking' ? 'wander' : 'static'),
      movementRange: tmpl.movement_range || (defState === 'walking' ? 150 : 0),
      movementSpeed: tmpl.movement_speed || 50,
      waypoints: Array.isArray(tmpl.waypoints) ? tmpl.waypoints : [],
      spawnX: tmpl.position_x,
      spawnY: tmpl.position_y,
      targetX: tmpl.position_x,
      targetY: tmpl.position_y,
      moveTimer: 0,
      isTalking: false
    };

    container.showDialogueBubble = (txt) => {
      if (container.bubble) {
        container.bubble.destroy();
      }
      const npcSprite = container.list.find(item => item instanceof NPCSprite);
      const h = (npcSprite && npcSprite.sprite) ? npcSprite.sprite.displayHeight : 86;
      const bubble = scene.add.text(0, -h - 20, txt, {
        fontSize: '11px',
        color: '#ffffff',
        backgroundColor: '#000000bb',
        padding: { x: 5, y: 3 }
      }).setOrigin(0.5);
      container.add(bubble);
      container.bubble = bubble;
      scene.time.delayedCall(2500, () => {
        if (bubble && bubble.active) {
          bubble.destroy();
          if (container.bubble === bubble) container.bubble = null;
        }
      });
    };

    scene.physics.add.existing(container, false); // Dynamic body
    if (container.body) {
      container.body.setImmovable(true); // Don't let player push them
      // setImmovable alone is not enough in Phaser 3.50+: a colliding dynamic
      // body (the player) still transfers momentum unless the NPC is marked
      // non-pushable. This keeps the NPC anchored where it's placed; it can
      // still move under its own velocity when in a 'walking' state.
      container.body.pushable = false;
      // Increase collider size to ~70% of tile size for better presence
      container.body.setCircle(35, -35, -35);
      // Ensure they don't move on collision
      container.body.setBounce(0);
      container.body.setFriction(1);
      // Safety net: even if shoved by the player, a wandering NPC can't be pushed
      // past the map edges (world bounds are set to the map size on load).
      container.body.setCollideWorldBounds(true);
    }
    this.npcs.push(container);
    this.npcSprites.set(tmpl.id, container);

    // Add collision between local player and this NPC
    if (scene.player && scene.player.body) {
      scene.physics.add.collider(scene.player, container);
    }
  }

  handleMissionUpdate(mission) {
    this.npcs.forEach(npcContainer => {
      const npcId = npcContainer.npcData.templateId;
      const status = this.getNpcMissionStatus(npcId, mission);
      this.updateNpcIndicator(npcContainer, status);
    });
  }

  getNpcMissionStatus(npcId, mission) {
    if (!mission) return null;

    // Check if this NPC is the source of the mission or a target
    const isStartNpc = mission.start_npc_id === npcId;
    const tasks = mission.tasks || [];
    
    // Find if there is any uncompleted task targeting this NPC
    const npcTask = tasks.find(t => !t.is_completed && t.npc_id === npcId);
    if (npcTask) {
      return 'active';
    }

    const allCompleted = tasks.every(t => t.is_completed);
    if (allCompleted && isStartNpc) {
      return 'complete';
    }

    return null;
  }

  updateNpcIndicator(container, status) {
    const scene = this.scene;
    // Remove old indicator if exists
    if (container.indicator) {
      container.indicator.destroy();
      container.indicator = null;
    }

    let emoji = '';
    let color = '#ffffff';

    if (status === 'complete') {
      emoji = '❓';
      color = '#ffff00';
    } else if (status === 'active') {
      emoji = '❗';
      color = '#ffff00';
    } else if (status === 'success') {
      emoji = '✔';
      color = '#00ff00';
    }

    if (emoji) {
      const npcSprite = container.list.find(item => item instanceof NPCSprite);
      let npcHeight = 86; // Default fallback height
      if (npcSprite && npcSprite.sprite) {
        npcHeight = npcSprite.sprite.displayHeight;
      }
      const indicatorY = -npcHeight * 0.85 - 43;
      const bounceY = indicatorY - 7;

      const indicator = scene.add.text(0, indicatorY, emoji, {
        fontSize: '20px',
        fill: color,
        stroke: '#000000',
        strokeThickness: 3
      }).setOrigin(0.5);
      container.add(indicator);
      container.indicator = indicator;
      // Add a little bounce
      scene.tweens.add({
        targets: indicator,
        y: bounceY,
        duration: 1000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
    }
  }

  // Per-frame update: depth sorting, idle/talking anims and wander movement.
  update(time) {
    const scene = this.scene;
    this.npcs.forEach(npc => {
      // Enforce depth sorting (Feet at container.y)
      npc.setDepth(npc.y + 1);

      const data = npc.npcData;
      if (!data) return;

      // Enforce depth sorting (Feet at container.y)
      npc.setDepth(npc.y + 1);

      // Talking override (always takes priority)
      if (data.isTalking) {
        if (npc.body) npc.body.setVelocity(0);
        const sprite = npc.list.find(item => item instanceof NPCSprite);
        if (sprite) sprite.playAnimation('talking');
        return;
      }

      const player = scene.player;
      const sprite = npc.list.find(item => item instanceof NPCSprite);

      // ── MODO ACOMPAÑANTE (follow) ──
      if (data.movementType === 'follow' && player) {
        const dist = Phaser.Math.Distance.Between(npc.x, npc.y, player.x, player.y);
        
        // Stuck prevention: teleport if too far
        if (dist > 350) {
          npc.setPosition(player.x - 40, player.y);
          if (npc.body) npc.body.setVelocity(0);
          if (sprite) sprite.playAnimation('idle-waiting');
          return;
        }

        // Move to player
        if (dist > 75) {
          scene.physics.moveToObject(npc, player, data.movementSpeed || 150);
          if (sprite) {
            sprite.playAnimation('walking');
            if (npc.body.velocity.x < 0) sprite.sprite.setFlipX(true);
            else if (npc.body.velocity.x > 0) sprite.sprite.setFlipX(false);
          }
        } else {
          // Stop near player
          if (npc.body) npc.body.setVelocity(0);
          if (sprite) {
            const defState = data.defaultState || 'idle';
            const animConfig = STATE_TO_ANIM[defState] || STATE_TO_ANIM.idle;
            sprite.playAnimation(animConfig.body || 'idle-waiting');
          }
        }
        return;
      }

      // ── MODO GUIA (lead_player) ──
      if (data.movementType === 'lead_player' && player) {
        const distToPlayer = Phaser.Math.Distance.Between(npc.x, npc.y, player.x, player.y);
        const waypoints = data.waypoints || [];

        if (data.currentWaypointIdx === undefined) {
          data.currentWaypointIdx = 0;
        }

        // Reached end of path
        if (data.currentWaypointIdx >= waypoints.length) {
          if (npc.body) npc.body.setVelocity(0);
          if (sprite) sprite.playAnimation('idle-waiting');
          return;
        }

        // Pacing: wait for player if they get left behind
        if (distToPlayer > 130) {
          if (npc.body) npc.body.setVelocity(0);
          if (sprite) {
            sprite.playAnimation('idle-waiting');
            sprite.sprite.setFlipX(player.x < npc.x);
          }
          
          // Occasional wait speech bubble
          if (time > (data.nextWaitShout || 0)) {
            if (typeof npc.showDialogueBubble === 'function') {
              npc.showDialogueBubble("¡Por aquí! ¡Sígueme!");
            }
            data.nextWaitShout = time + 4000;
          }
          return;
        }

        // Move towards current waypoint
        const targetPt = waypoints[data.currentWaypointIdx];
        const distToTarget = Phaser.Math.Distance.Between(npc.x, npc.y, targetPt.x, targetPt.y);

        if (distToTarget < 15) {
          data.currentWaypointIdx++;
        } else {
          scene.physics.moveTo(npc, targetPt.x, targetPt.y, data.movementSpeed || 110);
          if (sprite) {
            sprite.playAnimation('walking');
            if (npc.body.velocity.x < 0) sprite.sprite.setFlipX(true);
            else if (npc.body.velocity.x > 0) sprite.sprite.setFlipX(false);
          }
        }
        return;
      }

      // ── MODO CONVERSACIONAL ESTATICO ──
      if (data.movementType === 'static') {
        if (npc.body) npc.body.setVelocity(0);
        if (sprite) {
          const defState = data.defaultState || 'idle';
          const animConfig = STATE_TO_ANIM[defState] || STATE_TO_ANIM.idle;
          sprite.playAnimation(animConfig.body || 'idle-waiting');
        }
        return;
      }

      // ── MODO VAGABUNDEO (wander) ──
      if (data.movementType === 'wander') {
        const distToTarget = Phaser.Math.Distance.Between(npc.x, npc.y, data.targetX, data.targetY);

        if (distToTarget < 5) {
          if (npc.body) npc.body.setVelocity(0);
          if (sprite) {
            const defState = data.defaultState || 'idle';
            const animConfig = STATE_TO_ANIM[defState] || STATE_TO_ANIM.idle;
            const idleAnim = defState === 'walking' ? 'idle-waiting' : (animConfig.body || 'idle-waiting');
            sprite.playAnimation(idleAnim);
          }

          if (time > data.moveTimer) {
            const angle = Math.random() * Math.PI * 2;
            const dist = Math.random() * data.movementRange;
            const mm = scene.mapManager;
            const margin = 40;
            const maxX = (mm?.mapWidth  || scene.scale.width)  - margin;
            const maxY = (mm?.mapHeight || scene.scale.height) - margin;
            data.targetX = Phaser.Math.Clamp(data.spawnX + Math.cos(angle) * dist, margin, maxX);
            data.targetY = Phaser.Math.Clamp(data.spawnY + Math.sin(angle) * dist, margin, maxY);
            data.moveTimer = time + 2000 + Math.random() * 3000;
          }
        } else {
          scene.physics.moveTo(npc, data.targetX, data.targetY, data.movementSpeed);
          if (sprite) {
            sprite.playAnimation('walking');
            if (npc.body.velocity.x < 0) sprite.sprite.setFlipX(true);
            else if (npc.body.velocity.x > 0) sprite.sprite.setFlipX(false);
          }
        }
      }
    });
  }
}
