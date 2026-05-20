import EnemySprite from '../entities/EnemySprite';

export default class EnemyPool {
  /**
   * @param {Phaser.Scene} scene
   * @param {number} maxSize - máximo de enemigos simultáneos en pantalla
   */
  constructor(scene, maxSize = 20) {
    this.scene   = scene;
    this.maxSize = maxSize;

    // ── Crear el Group con nuestra clase personalizada ──────────────────────
    // classType le dice a Phaser qué constructor usar en group.get()
    this.group = scene.add.group({
      classType:      EnemySprite,
      maxSize:        maxSize,
      runChildUpdate: false,
    });

    // ── Pre-poblar: crear todos los objetos inactivos desde el inicio ───────
    this._prewarm();
  }

  // ─── Pre-poblar el pool ───────────────────────────────────────────────────
  _prewarm() {
    for (let i = 0; i < this.maxSize; i++) {
      // Usamos el constructor de EnemySprite (scene, x, y, charId, username)
      // '1' es un charId por defecto
      const enemy = new EnemySprite(this.scene, 0, 0, '1', 'Enemy');
      this.scene.add.existing(enemy);
      
      // Asegurar que tiene físicas para que body.enable funcione
      if (!enemy.body) {
        this.scene.physics.add.existing(enemy);
      }

      enemy.setActive(false);
      enemy.setVisible(false);
      if (enemy.body) {
        enemy.body.enable = false;
      }

      this.group.add(enemy);
    }
  }

  // ─── Sacar un enemigo del pool y configurarlo ─────────────────────────────
  /**
   * @param {number} x
   * @param {number} y
   * @param {object} config  - EnemyConfig del backend
   * @param {Phaser.GameObjects.Sprite} target - el jugador
   * @returns {EnemySprite|null}
   */
  spawn(x, y, config, target) {
    const enemy = this.group.getFirstDead(false);

    if (!enemy) {
      console.warn(`[EnemyPool] Pool lleno (${this.maxSize}). Enemigo descartado.`);
      return null;
    }

    // Delegar la inicialización al propio EnemySprite
    enemy.spawn(x, y, config, target);

    return enemy;
  }

  // ─── Tick — llamar desde BeatEmUpScene.update() ───────────────────────────
  update(time, delta) {
    this.group.getChildren().forEach(enemy => {
      if (enemy.active) {
        enemy.update(time, delta);
      }
    });
  }

  // ─── Helpers de consulta ──────────────────────────────────────────────────
  countActive() {
    return this.group.countActive(true);
  }

  countAvailable() {
    return this.maxSize - this.countActive();
  }

  isEmpty() {
    return this.countActive() === 0;
  }

  getActiveList() {
    return this.group.getChildren().filter(e => e.active);
  }

  getGroup() {
    return this.group;
  }

  killAll() {
    this.group.getChildren().forEach(e => {
      if (e.active) e._returnToPool();
    });
  }
}
