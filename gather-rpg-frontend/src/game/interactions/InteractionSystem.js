import * as Phaser from 'phaser';
import { useGameStore } from '../../store/gameStore';
import api from '../../services/api';
import i18n from '../../i18n';

export class InteractionSystem {
  constructor(scene) {
    this.scene = scene;
    this._interactPressed = false;
    this._readyInteractions = null;

    this.interactionPrompt = null;

    // Keyboard listener for 'E'
    this._onInteractKeyDown = (e) => {
      if (e.key === 'e' || e.key === 'E') {
        // Prevent interaction if a modal/input is focused
        if (this.scene.isTyping && this.scene.isTyping()) return;
        this._interactPressed = true;
        this.processSyncInteractions();
      }
    };
    window.addEventListener('keydown', this._onInteractKeyDown);
  }

  update() {
    this.checkInteractions();
  }

  initialize() {
    this.interactionPrompt = this.scene.add.text(0, 0, '', {
      fontSize: '16px',
      fill: '#ffffff',
      backgroundColor: '#000000',
      padding: { x: 10, y: 5 },
      fontFamily: '"Outfit", sans-serif',
      fontWeight: 'bold',
      stroke: '#000000',
      strokeThickness: 2
    });
    this.interactionPrompt.setOrigin(0.5);
    this.interactionPrompt.setDepth(100000); 
    this.interactionPrompt.setShadow(2, 2, 'rgba(0,0,0,0.8)', 2);
    this.interactionPrompt.setVisible(false);
    this.interactionPrompt.setScrollFactor(0);
  }

  shutdown() {
    if (this._onInteractKeyDown) {
      window.removeEventListener('keydown', this._onInteractKeyDown);
      this._onInteractKeyDown = null;
    }
    if (this.interactionPrompt) {
      this.interactionPrompt.destroy();
      this.interactionPrompt = null;
    }
  }

  checkInteractions() {
    let found = null;
    let foundChallenge = null;
    let foundPlayer = null;
    let foundPickup = null;

    // Check NPCs
    if (this.scene.npcs) {
      this.scene.npcs.forEach(npc => {
        const dist = Phaser.Math.Distance.Between(
          this.scene.player.x, this.scene.player.y,
          npc.x, npc.y
        );

        if (dist < 150) { // Interaction radius increased from 80 to 150 to allow talking across desks
          found = npc;
        }
      });
    }

    if (!found && this.scene.challengePoints) {
      this.scene.challengePoints.forEach((point) => {
        const dist = Phaser.Math.Distance.Between(
          this.scene.player.x, this.scene.player.y,
          point.x, point.y
        );

        if (dist < 90) {
          foundChallenge = point;
        }
      });
    }

    // Check Players (only if no NPC is found)
    if (!found && !foundChallenge && this.scene.playerSprites) {
      for (const [id, sprite] of this.scene.playerSprites) {
        const dist = Phaser.Math.Distance.Between(
          this.scene.player.x, this.scene.player.y,
          sprite.x, sprite.y 
        );

        if (dist < 120) { // Increased from 80 to 120 so physical colliders (radius 40px each = min 80px apart) don't block interaction
          foundPlayer = { id, name: sprite.username };
          break;
        }
      }
    }

    // Check Pickups
    if (this.scene.activePickups) {
      this.scene.activePickups.forEach(p => {
        const dist = Phaser.Math.Distance.Between(this.scene.player.x, this.scene.player.y, p.x, p.y);
        if (dist < 60 && !foundPickup) {
          foundPickup = p;
        }
      });
    }

    // Update Chat Bubbles positions
    if (this.scene.player && this.scene.player.chatBubble) {
      this.scene.player.chatBubble.setPosition(this.scene.player.x, this.scene.player.y - 60);
    }
    if (this.scene.playerSprites) {
      this.scene.playerSprites.forEach((sprite) => {
        if (sprite.chatBubble) {
          sprite.chatBubble.setPosition(sprite.x, sprite.y - 60);
        }
      });
    }

    let foundBuild = null;
    if (this.scene.builds) {
      this.scene.builds.getChildren().forEach(build => {
        const doorX = build.x;
        const doorY = build.y + build.displayHeight * 0.45;

        const dist = Phaser.Math.Distance.Between(
          this.scene.player.x, this.scene.player.y, doorX, doorY
        );

        if (dist < 90 && !foundBuild) {
          foundBuild = build;
        }
      });
    }

    let foundMinigame = null;
    if (this.scene.storeFurniture) {
      this.scene.storeFurniture.getChildren().forEach(f => {
        const minigameType = f.data?.get('minigameType');
        const minigameId = f.data?.get('minigameId');
        if (minigameType && (minigameId || minigameType === 'read')) {
          const dist = Phaser.Math.Distance.Between(
            this.scene.player.x, this.scene.player.y, f.x, f.y
          );
          if (dist < 200 && !foundMinigame) {
            foundMinigame = f;
          }
        }
      });
    }

    // Save state for synchronous interaction processing
    this._readyInteractions = { found, foundChallenge, foundPlayer, foundBuild, foundPickup, foundMinigame };

    // Update Interaction Prompt
    if (found || foundChallenge || foundPlayer || foundBuild || foundPickup || foundMinigame) {
      const t = (key, opts) => i18n.t(`lobby.interactions.${key}`, opts);
      let msg = t('press_e');

      if (found) {
        msg = t('talk_to', { name: found.npcData?.name });
      } else if (foundPickup) {
        msg = t('pickup', { 
          name: foundPickup.pickupData?.item?.name, 
          qty: foundPickup.pickupData?.quantity 
        });
      } else if (foundChallenge) {
        const isJoined = useGameStore.getState().activeChallengeId === foundChallenge.challengeData.id;
        msg = isJoined ? t('leave_challenge') : t('join_challenge', { name: foundChallenge.challengeData.name });
      } else if (foundPlayer) {
        msg = t('chat_with', { name: foundPlayer.name });
      } else if (foundBuild) {
        const portalType = foundBuild.data?.get('portalType') || 'map';
        const targetMap = foundBuild.data?.get('targetMap');
        const targetRoute = foundBuild.data?.get('targetRoute');
        const targetX = foundBuild.data?.get('targetX');
        const targetY = foundBuild.data?.get('targetY');
        const customText = foundBuild.data?.get('interactionText');

        const hasDest = (portalType === 'map' && targetMap) ||
          (portalType === 'route' && targetRoute) ||
          (portalType === 'local' && targetX != null && targetY != null);

        if (hasDest) {
          msg = customText ? t('press_e_custom', { text: customText }) : t('enter');
        } else {
          msg = t('no_destination');
        }
      } else if (foundMinigame) {
        const type = foundMinigame.data?.get('minigameType');
        const activeChallengeId = useGameStore.getState().activeChallengeId;
        const isJoined = activeChallengeId === foundMinigame.data?.get('minigameId');

        if (type === 'chess') {
          msg = isJoined ? "Presiona E para salir del Ajedrez" : "Presiona E para jugar al Ajedrez";
        } else if (type === 'park') {
          msg = isJoined ? "Presiona E para salir del Parque" : "Presiona E para unirte al Parque";
        } else if (type === 'read') {
          msg = i18n.t('lobby.interactions.press_e_read') || "Presiona E para leer";
        } else {
          msg = isJoined ? "Presiona E para salir del juego" : "Presiona E para jugar";
        }
      }

      const cam = this.scene.cameras?.main;
      if (cam && this.interactionPrompt) {
        this.interactionPrompt.setPosition(cam.width / 2, cam.height - 100);
        this.interactionPrompt.setText(msg);
        this.interactionPrompt.setVisible(true);
      }
    } else {
      if (this.interactionPrompt) this.interactionPrompt.setVisible(false);
    }

    const pressed = this._interactPressed;
    if (pressed) {
      console.log(`[InteractionSystem] Interact key pressed at ${this.scene.player.x.toFixed(0)}, ${this.scene.player.y.toFixed(0)}`);
    }
    this._interactPressed = false;
  }

  processSyncInteractions() {
    if (!this._readyInteractions) return;
    const { found, foundChallenge, foundPlayer, foundBuild, foundPickup, foundMinigame } = this._readyInteractions;

    if (found) {
      this.triggerInteraction(found.npcData);
    } else if (foundChallenge) {
      const activeChallengeId = useGameStore.getState().activeChallengeId;
      const challengeId = foundChallenge.challengeData.id;

      if (activeChallengeId === challengeId) {
        useGameStore.getState().leaveChallenge();
      } else {
        useGameStore.getState().joinChallenge(challengeId);
        window.dispatchEvent(new CustomEvent('lobby-open-challenge', { detail: { challengeId } }));
      }
    } else if (foundPlayer) {
      useGameStore.getState().sendChatRequest(foundPlayer.id);
      console.log(`[InteractionSystem] Sent chat request to ${foundPlayer.id}`);
    } else if (foundBuild) {
      const portalType = foundBuild.data?.get('portalType') || 'map';
      const targetMap = foundBuild.data?.get('targetMap');
      const targetRoute = foundBuild.data?.get('targetRoute');
      const targetX = foundBuild.data?.get('targetX');
      const targetY = foundBuild.data?.get('targetY');

      console.log('[InteractionSystem] Portal Interaction detected:', { portalType, targetMap, targetRoute, targetX, targetY });

      if (portalType === 'local') {
        if (targetX != null && targetY != null) {
          console.log(`[InteractionSystem] Teleporting locally to: ${targetX}, ${targetY}`);
          this.scene.player.setPosition(Number(targetX), Number(targetY));
          this.scene.cameras.main.centerOn(this.scene.player.x, this.scene.player.y);
          useGameStore.getState().movePlayer(this.scene.player.x, this.scene.player.y);
          this.scene.lastSyncedPos = { x: this.scene.player.x, y: this.scene.player.y };
          this.scene.cameras.main.flash(200, 0, 0, 0);
        } else {
          console.warn('[InteractionSystem] Local teleport failed: missing targetX/targetY');
        }
      } else if (portalType === 'route') {
        if (!targetRoute || String(targetRoute).trim() === '') {
          console.warn('[InteractionSystem] Build has no valid targetRoute configured');
        } else {
          console.log(`[InteractionSystem] Opening route modal to: ${targetRoute}`);
          window.dispatchEvent(new CustomEvent('lobby-open-route', {
            detail: { route: targetRoute }
          }));
        }
      } else {
        if (!targetMap || String(targetMap).trim() === '') {
          console.warn('[InteractionSystem] Build has no valid targetMap configured');
        } else {
          console.log(`[InteractionSystem] Entering portal to: ${targetMap}`);
          this.scene._handleMapEntry(targetMap, targetX, targetY);
        }
      }
    } else if (foundPickup) {
      this.handlePickupItem(foundPickup);
    } else if (foundMinigame) {
      const minigameId = foundMinigame.data?.get('minigameId');
      const minigameType = foundMinigame.data?.get('minigameType');
      const readText = foundMinigame.data?.get('readText');
      const activeChallengeId = useGameStore.getState().activeChallengeId;

      if (minigameType === 'read') {
        window.dispatchEvent(new CustomEvent('lobby-open-read-popup', { detail: { text: readText } }));
      } else {
        if (activeChallengeId === minigameId) {
          useGameStore.getState().leaveChallenge();
        } else {
          useGameStore.getState().joinChallenge(minigameId);
          // Open minigame UI
          window.dispatchEvent(new CustomEvent('lobby-open-minigame', { detail: { minigameId, minigameType } }));
        }
      }
    }
  }

  async handlePickupItem(pickupContainer) {
    const pickup = pickupContainer.pickupData;
    if (!pickup || !pickup.id) {
        console.warn('[InteractionSystem] Interaction attempted with an object that has no pickup ID.');
        return;
    }
    
    try {
      console.log(`[InteractionSystem] Picking up item: ${pickup.item?.name || 'Unknown Item'}`);
      const response = await api.post(`/inventory/pickup/${pickup.id}`);
      
      if (response.data) {
        this.scene.activePickups = this.scene.activePickups.filter(p => p !== pickupContainer);
        
        this.scene.tweens.add({
          targets: pickupContainer,
          y: pickupContainer.y - 50,
          alpha: 0,
          scale: 1.5,
          duration: 500,
          onComplete: () => pickupContainer.destroy()
        });

        const itemName = pickup.item?.name || 'Objeto';
        window.dispatchEvent(new CustomEvent('player-message', { detail: { text: `Recogiste ${itemName} x${pickup.quantity}` } }));

        useGameStore.getState().fetchInventory();
      }
    } catch (err) {
      console.error('[InteractionSystem] Failed to pickup item:', err);
      if (err.response?.status === 404) {
          console.warn('[InteractionSystem] Pickup ID not found on server. Removing stale item from scene.');
          if (this.scene.activePickups) {
            this.scene.activePickups = this.scene.activePickups.filter(p => p !== pickupContainer);
          }
          pickupContainer.destroy();
      }
    }
  }

  triggerInteraction(data) {
    console.log('[InteractionSystem] Emitiendo evento lobby-interaction con data:', data);
    const event = new CustomEvent('lobby-interaction', { detail: data });
    window.dispatchEvent(event);
  }
}
