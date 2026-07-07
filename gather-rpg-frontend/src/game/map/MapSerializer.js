/**
 * MapSerializer.js
 * Maneja la exportación e importación del estado completo del mapa en formato JSON.
 *
 * Extraído de MapManager.js para mantener SRP (Single Responsibility Principle).
 */

/**
 * Sanitiza el nombre del frame de un sprite de Phaser.
 * Phaser a veces retorna '__BASE' cuando no se especificó frame al crear el sprite.
 * @param {string} frameName
 * @param {string} [fallback='sprite1']
 * @returns {string}
 */
function safeFrame(frameName, fallback = 'sprite1') {
  if (!frameName || frameName === '__BASE') return fallback;
  return frameName;
}

/**
 * Lee de forma segura un valor del DataManager de un sprite.
 * @param {Phaser.Data.DataManager|null} data
 * @param {string} key
 * @param {*} [def=undefined]
 * @returns {*}
 */
function getData(data, key, def = undefined) {
  if (!data) return def;
  const val = data.get(key);
  return val !== undefined ? val : def;
}

export class MapSerializer {
  /**
   * Exporta el estado actual del mapa a una cadena JSON.
   * @param {import('./MapManager').MapManager} mm - Instancia de MapManager
   * @returns {string} JSON del mapa
   */
  static export(mm) {
    const scene = mm.scene;

    const data = {
      width:         mm.mapWidth,
      height:        mm.mapHeight,
      defaultSpawnX: mm.mapDefaultSpawnX,
      defaultSpawnY: mm.mapDefaultSpawnY,
      bgmTrack:      scene.currentBgmTrackId || 'none',
      isPublic:      mm.mapIsPublic || false,
      maxUsers:      mm.mapMaxUsers || 50,

      walls: mm.walls.getChildren().map(t => ({
        x: t.x, y: t.y,
        frame: (t.frame.name === '__BASE' || t.texture.key === 'tile-wall') ? 'sprite1' : t.frame.name,
      })),

      floors: mm.floors.getChildren().map(t => ({
        x: t.x, y: t.y,
        frame: safeFrame(t.frame?.name),
      })),

      forest: mm.forest.getChildren().map(t => ({
        x: t.x, y: t.y,
        frame: safeFrame(t.frame?.name),
      })),

      builds: mm.builds.getChildren().map(t => {
        const entry = {
          x: t.x, y: t.y,
          frame: safeFrame(t.frame?.name),
          scale: getData(t.data, 'buildScale') || t.scaleX || 1,
        };
        const portalKeys = ['targetMap', 'targetRoute', 'targetX', 'targetY', 'interactionText', 'portalType', 'missionIds'];
        portalKeys.forEach(k => {
          const v = getData(t.data, k);
          if (v !== undefined) entry[k] = v;
        });
        // Distingue el tile 'exit' (marcador de salida en el suelo) del 'build' (edificio);
        // ambos comparten el grupo `builds`, así que persistimos el flag para recrearlos bien.
        if (getData(t.data, 'isExit')) entry.isExit = true;
        return entry;
      }),

      spawns: mm.spawns.getChildren().map(t => ({ x: t.x, y: t.y })),

      npcZones: mm.npcZones.getChildren().map(t => ({
        x:            t.x,
        y:            t.y,
        definitionId: getData(t.data, 'definitionId'),
        role:         getData(t.data, 'role'),
        missionIds:   getData(t.data, 'missionIds'),
        missionId:    getData(t.data, 'missionId'),   // compat legacy
        templateId:   getData(t.data, 'templateId'),
        state:        getData(t.data, 'state'),
        facing:       getData(t.data, 'facing'),
        movement_type: getData(t.data, 'movementType'),
        waypoints:     getData(t.data, 'waypoints'),
      })),

      pickups: mm.pickups.getChildren().map(t => ({
        x:        t.x,
        y:        t.y,
        itemId:   getData(t.data, 'itemId'),
        quantity: getData(t.data, 'quantity', 1),
      })),

      voids:     mm.voids.getChildren().map(t => ({ x: t.x, y: t.y })),
      colliders: mm.colliders.getChildren().map(t => ({ x: t.x, y: t.y })),

      storeTiles: mm.storeTiles.getChildren().map(t => ({
        x: t.x, y: t.y,
        frame: safeFrame(t.frame?.name),
      })),

      furniture: mm.storeFurniture.getChildren()
        .filter(t => t.texture.key === 'store-furniture')
        .map(t => {
          const entry = {
            x: t.x,
            y: t.y,
            frame: safeFrame(t.frame?.name),
          };
          const minigameType = getData(t.data, 'minigameType');
          const minigameId = getData(t.data, 'minigameId');
          const readText = getData(t.data, 'readText');
          if (minigameType !== undefined) entry.minigameType = minigameType;
          if (minigameId !== undefined) entry.minigameId = minigameId;
          if (readText !== undefined) entry.readText = readText;
          return entry;
        }),

      furniture2: mm.storeFurniture.getChildren()
        .filter(t => t.texture.key === 'store-furniture2')
        .map(t => {
          const entry = {
            x: t.x,
            y: t.y,
            frame: safeFrame(t.frame?.name),
          };
          const minigameType = getData(t.data, 'minigameType');
          const minigameId = getData(t.data, 'minigameId');
          const readText = getData(t.data, 'readText');
          if (minigameType !== undefined) entry.minigameType = minigameType;
          if (minigameId !== undefined) entry.minigameId = minigameId;
          if (readText !== undefined) entry.readText = readText;
          return entry;
        }),

      furniture3: mm.storeFurniture.getChildren()
        .filter(t => t.texture.key === 'furniture')
        .map(t => {
          const entry = {
            x: t.x,
            y: t.y,
            frame: safeFrame(t.frame?.name),
          };
          const minigameType = getData(t.data, 'minigameType');
          const minigameId = getData(t.data, 'minigameId');
          const readText = getData(t.data, 'readText');
          if (minigameType !== undefined) entry.minigameType = minigameType;
          if (minigameId !== undefined) entry.minigameId = minigameId;
          if (readText !== undefined) entry.readText = readText;
          return entry;
        }),

      enemySpawns: mm.enemySpawns.getChildren().map(t => ({
        x:          t.x,
        y:          t.y,
        npcId:      getData(t.data, 'npcId'),
        waveNum:    getData(t.data, 'waveNum', 1),
        hp:         getData(t.data, 'hp'),
        speed:      getData(t.data, 'speed'),
        damage:     getData(t.data, 'damage'),
        attackRate: getData(t.data, 'attackRate'),
        type:       getData(t.data, 'type', 'melee'),
        projectileSprite: getData(t.data, 'projectileSprite', ''),
        manaMax:         getData(t.data, 'manaMax', 0),
        manaRegen:       getData(t.data, 'manaRegen', 0),
        hpRegen:         getData(t.data, 'hpRegen', 0),
        cardFailHealPct: getData(t.data, 'cardFailHealPct', 0),
      })),
    };

    return JSON.stringify(data, null, 2);
  }

  /**
   * Importa un JSON de mapa y aplica los cambios al MapManager.
   * @param {import('./MapManager').MapManager} mm - Instancia de MapManager
   * @param {string|Object} config - JSON string o objeto de configuración del mapa
   */
  static import(mm, config) {
    if (!config) return;
    try {
      const data = typeof config === 'string' ? JSON.parse(config) : config;
      const scene = mm.scene;

      // Soporte formato legacy (array plano de walls)
      if (Array.isArray(data)) {
        mm.resizeMap(800, 800);
        if (scene.editor) {
          scene.editor.clearAllTiles();
        } else {
          mm.clearMap();
        }
        data.forEach(w => mm.walls.create(w.x, w.y, 'tile-wall').refreshBody());
        return;
      }

      // Limpiar mapa actual
      if (scene.editor) {
        scene.editor.clearAllTiles();
      } else {
        mm.clearMap();
      }

      // Aplicar dimensiones y metadatos
      if (data.width)  mm.mapWidth  = data.width;
      if (data.height) mm.mapHeight = data.height;
      mm.resizeMap(mm.mapWidth, mm.mapHeight);

      if (data.defaultSpawnX != null) mm.mapDefaultSpawnX = Number(data.defaultSpawnX);
      if (data.defaultSpawnY != null) mm.mapDefaultSpawnY = Number(data.defaultSpawnY);
      if (data.isPublic !== undefined) mm.mapIsPublic = !!data.isPublic;
      if (data.maxUsers !== undefined) mm.mapMaxUsers = Number(data.maxUsers);

      if (data.bgmTrack && data.bgmTrack !== 'none') {
        scene.currentBgmTrackId = data.bgmTrack;
      }

      // Sync physics y background
      scene.physics.world.setBounds(0, 0, mm.mapWidth, mm.mapHeight);
      if (mm.backgroundRect) {
        mm.backgroundRect.setSize(mm.mapWidth, mm.mapHeight);
        mm.backgroundRect.setPosition(mm.mapWidth / 2, mm.mapHeight / 2);
      }
      if (mm.gridGraphics) {
        mm._rebuildEditorGrid(mm.mapWidth, mm.mapHeight);
      }

      // Colocar tiles usando TilePlacer a través de _placeTileDirect de MapManager
      const place = (type, x, y, frame, meta, scale) =>
        mm._placeTileDirect(type, x, y, frame, meta, scale);

      (data.floors || []).forEach(t => place('floor', t.x, t.y, t.frame));
      (data.walls  || []).forEach(t => place('wall',  t.x, t.y, t.frame));
      (data.forest || []).forEach(t => place('forest', t.x, t.y, t.frame));

      (data.builds || []).forEach(t => place(t.isExit ? 'exit' : 'build', t.x, t.y, t.frame, {
        targetMap:       t.targetMap,
        targetRoute:     t.targetRoute,
        targetX:         t.targetX,
        targetY:         t.targetY,
        interactionText: t.interactionText,
        portalType:      t.portalType,
        missionIds:      t.missionIds, // mission-gated portal: only shown on these missions
        buildScale:      t.scale,
      }));

      (data.spawns  || []).forEach(t => place('spawn', t.x, t.y));
      (data.voids   || []).forEach(t => place('void',  t.x, t.y));

      // Soporte legacy: 'collider' singular y 'colliders' plural
      const colls = data.colliders || data.collider || [];
      colls.forEach(t => place('collider', t.x, t.y));

      (data.npcZones || []).forEach(t => place('npc', t.x, t.y, null, {
        definitionId: t.definitionId,
        role:         t.role,
        missionIds:   t.missionIds,
        missionId:    t.missionId,
        state:        t.state,
        facing:       t.facing,
        movementType: t.movementType || t.movement_type || 'static',
        waypoints:    Array.isArray(t.waypoints) ? t.waypoints : [],
      }));

      (data.pickups || []).forEach(t => place('item', t.x, t.y, null, {
        itemId:   t.itemId,
        quantity: t.quantity,
      }));

      (data.storeTiles || []).forEach(t => place('store',     t.x, t.y, t.frame));
      (data.furniture  || []).forEach(t => place('furniture', t.x, t.y, t.frame, {
        minigameType: t.minigameType,
        minigameId:   t.minigameId,
        readText:     t.readText,
      }));
      (data.furniture2 || []).forEach(t => place('furniture2', t.x, t.y, t.frame, {
        minigameType: t.minigameType,
        minigameId:   t.minigameId,
        readText:     t.readText,
      }));
      (data.furniture3 || []).forEach(t => place('furniture3', t.x, t.y, t.frame, {
        minigameType: t.minigameType,
        minigameId:   t.minigameId,
        readText:     t.readText,
      }));

      (data.enemySpawns || []).forEach(t => place('enemy', t.x, t.y, null, {
        npcId:      t.npcId,
        waveNum:    t.waveNum,
        hp:         t.hp,
        speed:      t.speed,
        attackRate: t.attackRate,
        damage:     t.damage,
        type:       t.type || 'melee',
        projectileSprite: t.projectileSprite || '',
        manaMax:         t.manaMax || 0,
        manaRegen:       t.manaRegen || 0,
        hpRegen:         t.hpRegen || 0,
        cardFailHealPct: t.cardFailHealPct || 0,
      }));

      console.log('[MapSerializer] Map imported successfully');
      if (scene.editor) scene.editor.emitStats();
      scene.cameras.main.flash(300, 0, 150, 255);
    } catch (err) {
      console.error('[MapSerializer] Error importing map config:', err);
    }
  }
}
