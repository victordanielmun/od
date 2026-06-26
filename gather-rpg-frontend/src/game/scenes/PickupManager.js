import api from '../../services/api';

// Owns the lobby's map item pickups: fetching them from the backend and
// spawning the floating sprites. The scene exposes `activePickups` as a
// getter/setter onto this manager (EditorController and InteractionSystem
// read and mutate it directly).
export class PickupManager {
  constructor(scene) {
    this.scene = scene;
    this.activePickups = []; // Array of pickup containers
  }

  // Clears this player's claims for the current scene on the backend, then
  // reloads the pickups so every item is available again. Called on (re)entry
  // to a scene/mission instance (each scene.restart() re-runs create()), so a
  // retry — including death + retry — restores the items, mirroring how combat
  // enemies are regenerated per room entry. Per-player claims also mean another
  // user opening the same scene gets their own full set.
  async resetAndLoadMapPickups() {
    const scene = this.scene;
    try {
      await api.post(`/inventory/pickups/${scene.currentMapKey}/reset`);
    } catch (err) {
      console.error('[PickupManager] Failed to reset map pickups:', err);
    }
    await this.loadMapPickups();
  }

  async loadMapPickups() {
    const scene = this.scene;
    const url = `/inventory/pickups/${scene.currentMapKey}`;

    // La BD puede ir lenta y devolver un 500/timeout puntual al cargar el mapa. Reintentamos
    // con backoff antes de rendirnos para que un fallo transitorio no deje el mapa sin items.
    const MAX_ATTEMPTS = 3;
    let response = null;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        console.log(`[PickupManager] Fetching Map Pickups for scene: ${scene.currentMapKey} (intento ${attempt}/${MAX_ATTEMPTS})`);
        response = await api.get(url);
        break;
      } catch (err) {
        console.warn(`[PickupManager] Fallo al cargar pickups (intento ${attempt}/${MAX_ATTEMPTS}):`, err?.message || err);
        if (attempt === MAX_ATTEMPTS) {
          console.error('[PickupManager] Se agotaron los reintentos de carga de pickups.');
          return;
        }
        await new Promise(r => setTimeout(r, 400 * attempt)); // 400ms, luego 800ms
      }
    }

    if (response?.data) {
      // Clear existing pickups if any (usually empty on start)
      this.activePickups.forEach(p => p.destroy());
      this.activePickups = [];

      response.data.forEach(pickup => {
        if (!pickup.is_picked_up) {
          this.createMapPickupSprite(pickup);
        }
      });
    }
  }

  createMapPickupSprite(pickup) {
    const scene = this.scene;
    const item = pickup.item;
    if (!item) return;

    // Visual container for the item
    const container = scene.add.container(pickup.x, pickup.y);
    container.setDepth(pickup.y);

    // Hide editor marker if exists underneath
    if (scene.pickups) {
      scene.pickups.getChildren().forEach(p => {
        if (Math.abs(p.x - pickup.x) < 5 && Math.abs(p.y - pickup.y) < 5) {
          p.setVisible(false);
        }
      });
    }

    const spriteKey = `item-sprite-${item.icon_key}`;
    // If not loaded yet, use a fallback square
    let sprite;
    if (scene.textures.exists(spriteKey)) {
      sprite = scene.add.image(0, 0, spriteKey);
    } else {
      sprite = scene.add.rectangle(0, 0, 32, 32, 0xffff00);
    }

    sprite.setDisplaySize(32, 32);
    container.add(sprite);

    // Floating animation
    scene.tweens.add({
      targets: sprite,
      y: -5,
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    container.pickupData = pickup;
    this.activePickups.push(container);
  }
}
