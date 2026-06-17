/**
 * MinigameOverlayManager.js
 * 
 * Gestiona de forma modular las etiquetas flotantes de ocupantes (ej. 👤 2/5)
 * sobre los muebles interactivos de minijuegos o zonas sociales en Phaser.
 * Evita inflar la lógica de LobbyScene.jsx.
 */

export class MinigameOverlayManager {
  /**
   * @param {Phaser.Scene} scene - Escena Phaser activa (LobbyScene)
   */
  constructor(scene) {
    this.scene = scene;
    this.labels = new Map(); // minigameId -> Phaser.GameObjects.Text

    this._onCapacityUpdate = (e) => {
      const { challenge_id, count } = e.detail || {};
      if (challenge_id) {
        this.updateLabel(challenge_id, count);
      }
    };
  }

  /**
   * Inicializa las etiquetas escaneando los muebles interactivos colocados en la escena.
   */
  initialize() {
    this.cleanup();

    if (!this.scene.storeFurniture) {
      console.warn('[MinigameOverlayManager] storeFurniture static group not found on scene.');
      return;
    }

    // Escanear muebles para encontrar los que son minijuegos
    this.scene.storeFurniture.getChildren().forEach(furniture => {
      const minigameType = furniture.data?.get('minigameType');
      const minigameId = furniture.data?.get('minigameId');

      if (minigameType && minigameId) {
        // Crear un objeto de texto flotante encima del mueble
        const textX = furniture.x;
        const textY = furniture.y - (furniture.displayHeight * 0.6);

        const label = this.scene.add.text(textX, textY, '', {
          fontSize: '11px',
          fill: '#00ffaa',
          backgroundColor: '#000000b0',
          padding: { x: 5, y: 3 },
          fontFamily: '"Outfit", sans-serif',
          fontWeight: 'bold',
          stroke: '#000000',
          strokeThickness: 2
        });
        label.setOrigin(0.5);
        label.setDepth(furniture.y + 10); // Ligeramente por delante
        label.setVisible(false); // Ocultar si está vacío (0/5)

        this.labels.set(minigameId, label);
      }
    });

    // Registrar escucha de eventos de red
    window.addEventListener('minigame-capacity-update', this._onCapacityUpdate);
    
    // Escuchar el evento de recreación de mapa para re-inicializar
    this._onMapConfigImported = () => {
      // Pequeño delay para dejar que los muebles se coloquen en la escena
      this.scene.time.delayedCall(100, () => this.initialize());
    };
    window.addEventListener('map-pickups-updated', this._onMapConfigImported);
  }

  /**
   * Actualiza el valor de ocupantes en una etiqueta específica.
   * @param {string} minigameId 
   * @param {number} count 
   */
  updateLabel(minigameId, count) {
    const label = this.labels.get(minigameId);
    if (!label) return;

    if (count > 0) {
      label.setText(`👤 ${count}/5`);
      label.setVisible(true);
      
      // Animación de pop-in sutil al cambiar de estado
      this.scene.tweens.add({
        targets: label,
        scale: { from: 0.8, to: 1.0 },
        duration: 200,
        ease: 'Back.out'
      });
    } else {
      label.setVisible(false);
    }
  }

  /**
   * Destruye todas las etiquetas y remueve los event listeners.
   */
  cleanup() {
    this.labels.forEach(label => {
      if (label.active) label.destroy();
    });
    this.labels.clear();
    
    window.removeEventListener('minigame-capacity-update', this._onCapacityUpdate);
    if (this._onMapConfigImported) {
      window.removeEventListener('map-pickups-updated', this._onMapConfigImported);
    }
  }

  shutdown() {
    this.cleanup();
  }
}
