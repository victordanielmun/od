import { NPCSprite } from '../entities/NPCSprite';
import { STATE_TO_ANIM } from '../config/NPCConfig';

// Centralizes every `window` CustomEvent the LobbyScene listens to. Each handler
// is registered once via setup() and torn down in a single destroy(), which
// removes the previous "removed in three places / leaked in one" bookkeeping.
export class LobbyEventBridge {
  constructor(scene) {
    this.scene = scene;
    this._registered = []; // { event, handler } pairs, for teardown
  }

  setup() {
    const scene = this.scene;

    // NPC animation state changes during dialogue
    this._on('npc-state-changed', (e) => {
      const { templateId, state } = e.detail;
      const container = scene.npcSprites.get(templateId);
      if (container && container.list) {
        const npcSprite = container.list.find(obj => obj instanceof NPCSprite);
        if (npcSprite) {
          const anims = STATE_TO_ANIM[state] || STATE_TO_ANIM.idle;
          npcSprite.playAnimation(anims.body);
        }
      }
    });

    // Camera zoom requests (absolute zoom, delta, or in/out direction)
    this._on('phaser-camera-zoom', (e) => {
      const detail = e?.detail;
      if (detail?.sceneKey && detail.sceneKey !== 'LobbyScene') return;
      if (typeof detail?.zoom === 'number') {
        scene.cameraSystem.setZoom(detail.zoom);
      } else if (typeof detail?.delta === 'number') {
        scene.cameraSystem.adjustZoom(detail.delta);
      } else if (detail?.direction === 'in') {
        scene.cameraSystem.adjustZoom(scene.zoomStep);
      } else if (detail?.direction === 'out') {
        scene.cameraSystem.adjustZoom(-scene.zoomStep);
      }
    });

    // Chat and NPC speech bubbles
    this._on('chat-message-received', (e) => scene.chatBubbleManager.handleChat(e));
    this._on('npc-speech-bubble', (e) => scene.chatBubbleManager.handleNPCSpeech(e));

    // Map pickup updates (from Editor save)
    this._on('map-pickups-updated', () => scene.pickupManager.loadMapPickups());

    // NPC interaction states pause/resume their movement
    this._on('npc-interaction-start', (e) => {
      const npc = scene.npcSprites.get(e.detail.templateId);
      if (npc) npc.npcData.isTalking = true;
    });
    this._on('npc-interaction-end', (e) => {
      const npc = scene.npcSprites.get(e.detail.templateId);
      if (npc) npc.npcData.isTalking = false;
    });

    // Spectator mode
    this._on('spectate-player', () => scene._onSpectate());

    // TAREA 2 FIX: reset explícito de estado de muerte
    // (disparado por DeathOverlay antes de solicitar cambio de mapa)
    this._on('reset-player-state', () => {
      console.log('[LobbyEvents] reset-player-state received — resetting death state');
      if (scene.combatSystem) scene.combatSystem.resetDeathState();
      scene.isSpectating = false;
      scene.spectatorTarget = null;
      if (scene.player) {
        scene.player.setAlpha(1);
        scene.player.clearTint && scene.player.clearTint();
        scene.cameras.main.startFollow(scene.player, true, 0.1, 0.1);
      }
    });
  }

  _on(event, handler) {
    window.addEventListener(event, handler);
    this._registered.push({ event, handler });
  }

  destroy() {
    this._registered.forEach(({ event, handler }) => window.removeEventListener(event, handler));
    this._registered = [];
  }
}
