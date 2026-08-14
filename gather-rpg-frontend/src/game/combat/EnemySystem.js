import EnemySprite from '../entities/EnemySprite';
import { useGameStore } from '../../store/gameStore';
import { playGameSfx } from '../audio/playGameSfx';

// El servidor emite un tick de IA cada 100ms por cada enemigo vivo de la sala.
// Un sprite que lleve STALE_MS sin recibir su update ya no existe en el servidor.
const STALE_MS = 2000;

export class EnemySystem {
  constructor(scene) {
    this.scene = scene;
    this.activeEnemies = new Map(); // instanceId -> EnemySprite

    this.onEnemyUpdate = (e) => this._onEnemiesUpdate(e);
    this.onEnemyDied = (e) => this._onEnemyDied(e);

    window.addEventListener('enemies-update', this.onEnemyUpdate);
    window.addEventListener('enemy-died-broadcast', this.onEnemyDied);

    // El barrido de huérfanos NO puede depender de que sigan llegando updates: en
    // un mapa sin combate no llega ninguno, así que un sprite colado durante una
    // transición se quedaría para siempre (el enemigo que "se venía" al lobby).
    this.sweepTimer = scene.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => this._sweepStale(),
    });
  }

  destroy() {
    window.removeEventListener('enemies-update', this.onEnemyUpdate);
    window.removeEventListener('enemy-died-broadcast', this.onEnemyDied);
    if (this.sweepTimer) {
      this.sweepTimer.remove();
      this.sweepTimer = null;
    }
    this.activeEnemies.forEach(sprite => {
      if (sprite.active) sprite.destroy();
    });
    this.activeEnemies.clear();
    this._publishEnemyPresence();
  }

  // Elimina los sprites cuyo enemigo ya no reporta el servidor.
  _sweepStale() {
    const now = Date.now();
    this.activeEnemies.forEach((sprite, id) => {
      if (now - sprite.lastUpdated > STALE_MS) {
        console.log(`[EnemySystem] Removing stale enemy: ${id}`);
        if (sprite.active) sprite.destroy();
        this.activeEnemies.delete(id);
      }
    });
    this._publishEnemyPresence();
  }

  // Publica en el store si quedan enemigos vivos. Lo consume la UI (controles
  // táctiles) para saber que hay combate sin deducirlo del nombre del mapa.
  // Solo escribe cuando el booleano cambia: esto corre 10 veces por segundo.
  _publishEnemyPresence() {
    const has = this.activeEnemies.size > 0;
    if (has !== useGameStore.getState().hasActiveEnemies) {
      useGameStore.setState({ hasActiveEnemies: has });
    }
  }

  _onEnemiesUpdate(e) {
    const { enemies } = e.detail;
    if (!enemies) return;

    const now = Date.now();
    // Tregua de entrada: mientras dura, ningún enemigo puede engancharse conmigo
    // (el servidor tampoco me asigna, pero la FSM local se adelantaría sola).
    const inGrace = now < (useGameStore.getState().combatGraceUntil || 0);

    enemies.forEach(data => {
      let sprite = this.activeEnemies.get(data.instance_id);
      
      if (!sprite) {
        let assetId = data.sprite_id;
        if (!assetId) {
          const isUUID = data.npc_id && data.npc_id.length > 10;
          assetId = isUUID ? '1' : (data.npc_id || '1');
        }

        console.log(`[EnemySystem] Spawning new enemy: ${data.npc_id} with asset ${assetId} (${data.instance_id})`);
        sprite = new EnemySprite(this.scene, data.x, data.y, assetId, 'Enemy');
        this.scene.add.existing(sprite);
        this.scene.enemiesGroup.add(sprite);
        
        if (this.scene.player && sprite.body) {
          this.scene.physics.add.collider(this.scene.player, sprite);
        }
        
        sprite.config = data;
        if (this.scene.player && !inGrace) sprite.target = this.scene.player;

        this.activeEnemies.set(data.instance_id, sprite);
      }

      sprite.combatGrace = inGrace;
      sprite.syncFromServer(data);
      sprite.lastUpdated = now;
    });

    this._sweepStale();
  }

  _onEnemyDied(e) {
    const { instance_id } = e.detail;
    const sprite = this.activeEnemies.get(instance_id);
    if (sprite) {
      console.log(`[EnemySystem] enemy_died received → playing death + removing ${instance_id}`);
      playGameSfx(this.scene, 'sfx_enemy_die');
      // NO updateHealth(0,100): esa función solo mata localmente si !serverDriven, y
      // en el mundo abierto todo enemigo es serverDriven — la llamada no hacía nada
      // (el enemigo se quedaba en su última pose hasta el destroy). playDeathAnimation
      // fuerza la animación 'dying' porque este evento YA es la confirmación autoritativa.
      sprite.playDeathAnimation();
      this.scene.time.delayedCall(1500, () => {
        if (sprite.active) sprite.destroy();
        this.activeEnemies.delete(instance_id);
        this._publishEnemyPresence();
      });
    } else {
      console.warn(`[EnemySystem] enemy_died for unknown/already-removed instance ${instance_id}`);
    }
  }
}
