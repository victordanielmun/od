export default class WaveSpawner {
  /**
   * @param {Phaser.Scene} scene
   * @param {EnemyPool} enemyPool
   * @param {Phaser.GameObjects.Container} player
   */
  constructor(scene, enemyPool, player) {
    this.scene     = scene;
    this.enemyPool = enemyPool;
    this.player    = player;

    this.waves        = [];
    this.currentWave  = 0;
    this.isStarted    = false;
  }

  async loadFromBackend(levelId, mapData = null) {
    if (mapData && mapData.enemySpawns) {
      console.log('WaveSpawner: Loading from map data');
      this.waves = this._groupByWave(mapData.enemySpawns);
      return;
    }

    try {
      // Intentar cargar del backend si no hay datos de mapa
      const response = await fetch(`/api/enemies/config?level=${levelId}`);
      if (response.ok) {
        const configs = await response.json();
        this.waves = this._groupByWave(configs);
      } else {
        console.warn('WaveSpawner: Backend falló, usando datos locales de prueba');
        this.waves = this._getTestData();
      }
    } catch (e) {
      console.warn('WaveSpawner: Error cargando config, usando datos locales de prueba');
      this.waves = this._getTestData();
    }
  }

  loadFromMap(enemySpawns) {
    console.log('WaveSpawner: Loading from MapManager group');
    // Convertir el grupo de Phaser a un array de objetos de configuración
    const configs = enemySpawns.getChildren().map(s => ({
      npcId:    s.data.get('npcId'),
      waveNum:  s.data.get('waveNum'),
      hp:       s.data.get('hp'),
      speed:    s.data.get('speed'),
      damage:   s.data.get('damage'),
      spawnX:   s.x,
      spawnY:   s.y
    }));
    this.waves = this._groupByWave(configs);
  }

  start() {
    this.isStarted = true;
    this.currentWave = 0;
    this._spawnNextWave();
  }

  onEnemyDied() {
    if (!this.isStarted) return;

    // Si no quedan enemigos activos, pasar a la siguiente oleada
    if (this.enemyPool.isEmpty()) {
      this.scene.time.delayedCall(1500, () => {
        this.currentWave++;
        if (this.currentWave < this.waves.length) {
          this._spawnNextWave();
        } else {
          this.scene.events.emit('level-cleared');
        }
      });
    }
  }

  _spawnNextWave() {
    const configs = this.waves[this.currentWave];
    if (!configs) return;

    this.scene.events.emit('wave-started', this.currentWave + 1);

    configs.forEach((config, i) => {
      // Delay pequeño entre enemigos para no saturar
      this.scene.time.delayedCall(i * 500, () => {
        this.enemyPool.spawn(config.spawnX, config.spawnY, config, this.player);
      });
    });
  }

  _groupByWave(configs) {
    const waves = [];
    configs.forEach(c => {
      const waveIdx = (c.waveNum || 1) - 1;
      if (!waves[waveIdx]) waves[waveIdx] = [];
      waves[waveIdx].push(c);
    });
    return waves.filter(w => w !== undefined);
  }

  _getTestData() {
    // Configuración de prueba local
    const baseConfig = {
      npcId:          '1',
      textureKey:     'npc-1-body',
      defaultFrame:   'idle-waiting',
      hp:             50,
      speed:          100,
      damage:         5,
      attackRate:     1500,
      attackRange:    60,
      detectRange:    300,
      knockThreshold: 15,
    };

    return [
      // Oleada 1
      [
        { ...baseConfig, npcId: '1', spawnX: 600, spawnY: 400, waveNum: 1 },
        { ...baseConfig, npcId: '2', spawnX: 700, spawnY: 450, waveNum: 1 },
      ],
      // Oleada 2
      [
        { ...baseConfig, npcId: '3', spawnX: 100, spawnY: 400, waveNum: 2, hp: 80 },
        { ...baseConfig, npcId: '4', spawnX: 150, spawnY: 480, waveNum: 2, hp: 80 },
      ]
    ];
  }
}
