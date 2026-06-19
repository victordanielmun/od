import EnemySprite from '../entities/EnemySprite';

export class EnemySystem {
  constructor(scene) {
    this.scene = scene;
    this.activeEnemies = new Map(); // instanceId -> EnemySprite

    this.onEnemyUpdate = (e) => this._onEnemiesUpdate(e);
    this.onEnemyDied = (e) => this._onEnemyDied(e);

    window.addEventListener('enemies-update', this.onEnemyUpdate);
    window.addEventListener('enemy-died-broadcast', this.onEnemyDied);
  }

  destroy() {
    window.removeEventListener('enemies-update', this.onEnemyUpdate);
    window.removeEventListener('enemy-died-broadcast', this.onEnemyDied);
    this.activeEnemies.forEach(sprite => {
      if (sprite.active) sprite.destroy();
    });
    this.activeEnemies.clear();
  }

  _onEnemiesUpdate(e) {
    const { enemies } = e.detail;
    if (!enemies) return;

    const now = Date.now();
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
        if (this.scene.player) sprite.target = this.scene.player;
        
        this.activeEnemies.set(data.instance_id, sprite);
      }

      sprite.syncFromServer(data);
      sprite.lastUpdated = now;
    });

    // Cleanup orphans (> 2 seconds)
    this.activeEnemies.forEach((sprite, id) => {
      if (now - sprite.lastUpdated > 2000) {
        console.log(`[EnemySystem] Removing stale enemy: ${id}`);
        sprite.destroy();
        this.activeEnemies.delete(id);
      }
    });
  }

  _onEnemyDied(e) {
    const { instance_id } = e.detail;
    const sprite = this.activeEnemies.get(instance_id);
    if (sprite) {
      console.log(`[EnemySystem] enemy_died received → playing death + removing ${instance_id}`);
      sprite.updateHealth(0, 100); // Triggers death animation
      this.scene.time.delayedCall(1500, () => {
        if (sprite.active) sprite.destroy();
        this.activeEnemies.delete(instance_id);
      });
    } else {
      console.warn(`[EnemySystem] enemy_died for unknown/already-removed instance ${instance_id}`);
    }
  }
}
