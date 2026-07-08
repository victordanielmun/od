import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Hammer, Save, Download, Upload, X, Undo2, Redo2, Trash2,
  Paintbrush, Eraser, Square, ChevronDown, ChevronUp, Pause, Play,
  Camera, User, MapPin, Pipette, Zap, Swords
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import api from '../../services/api';
import { normalizeBehavior } from '../../game/config/enemyBehaviors';
import { InfoSignEditor } from './InfoSignEditor';

const TILE_COLORS = {
  wall: '#666666',
  floor: '#8B7355',
  forest: '#228B22',
  build: '#CD853F',
  spawn: '#00CC66',
  npc: '#4488FF',
  item: '#E91E63',
  void: '#111111',
  collider: '#FFD700',
  store: '#556270',
  furniture: '#FF6B6B',
  furniture2: '#FF8E8E',
  furniture3: '#FFB3B3',
  exit: '#FF4500',
  enemy: '#FF4444',
};

const dispatchEditorCommand = (action, value) =>
  window.dispatchEvent(new CustomEvent('editor-command', { detail: { action, value } }));

/* ─── section wrapper ─── */
const Section = ({ title, children, defaultOpen = true }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-gray-700/60">
      <button
        className="w-full flex items-center justify-between px-3 py-2 text-[10px] uppercase tracking-widest text-gray-500 hover:text-gray-300 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        {title}
        {open ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
      </button>
      {open && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
};

/* ─── sprite grids ─── */
const FloorGrid = ({ active, onSelect }) => (
  <div className="grid grid-cols-4 gap-1 max-h-52 overflow-y-auto pr-1"
    style={{ scrollbarWidth: 'thin', scrollbarColor: '#4b5563 transparent' }}>
    {Array.from({ length: 64 }).map((_, i) => {
      const id = `sprite${i + 1}`;
      const col = i % 8, row = Math.floor(i / 8);
      return (
        <button
          key={id} onClick={() => onSelect(id)} title={id}
          className={`w-8 h-8 border rounded overflow-hidden flex-shrink-0
            ${active === id ? 'border-yellow-400 ring-1 ring-yellow-400' : 'border-gray-700 opacity-60 hover:opacity-100'}`}
        >
          <div style={{
            width: '100%', height: '100%',
            backgroundImage: 'url(/terrain/terrain-spritesheet.png)',
            backgroundSize: '800% 800%',
            backgroundPosition: `${(col / 7) * 100}% ${(row / 7) * 100}%`,
            imageRendering: 'pixelated',
          }} />
        </button>
      );
    })}
  </div>
);

const SpriteJsonGrid = ({ jsonPath, imgPath, active, onSelect, scaleTarget = 32 }) => {
  const [sprites, setSprites] = useState([]);
  useEffect(() => {
    const paths = Array.isArray(jsonPath) ? jsonPath : [jsonPath];
    const imgs = Array.isArray(imgPath) ? imgPath : [imgPath];
    
    Promise.all(paths.map((p, idx) => 
      fetch(p).then(r => r.json()).then(d => {
        const matchingImg = imgs[idx] || imgs[0];
        return d.frames
          .filter(f => f.sourceSize.w > 10 && f.sourceSize.h > 10)
          .map(f => ({
            ...f,
            _imagePath: matchingImg
          }));
      })
    ))
    .then(results => {
      setSprites(results.flat());
    })
    .catch(() => { });
  }, [jsonPath, imgPath]);
  return (
    <div className="grid grid-cols-4 gap-1 max-h-52 overflow-y-auto pr-1"
      style={{ scrollbarWidth: 'thin', scrollbarColor: '#4b5563 transparent' }}>
      {sprites.map(s => {
        const { x, y, w, h } = s.frame;
        const sc = Math.min(1, scaleTarget / Math.max(w, h));
        return (
          <button
            key={s.filename} onClick={() => onSelect(s.filename)} title={s.filename}
            className={`w-10 h-10 border rounded flex items-center justify-center bg-gray-900 overflow-hidden
              ${active === s.filename ? 'border-yellow-400 ring-1 ring-yellow-400' : 'border-gray-700 opacity-80 hover:opacity-100'}`}
          >
            <div style={{
              width: w, height: h,
              backgroundImage: `url(${s._imagePath})`,
              backgroundPosition: `-${x}px -${y}px`,
              transform: `scale(${sc})`, transformOrigin: 'center',
              imageRendering: 'pixelated', flexShrink: 0,
            }} />
          </button>
        );
      })}
    </div>
  );
};

/* ═══════════════════════════════════════════ */
const mapFaceToBodyState = (state) => {
  if (!state) return 'idle';
  const s = state.toLowerCase();
  if (s === 'waiting' || s === 'idle-waiting') return 'idle';
  if (s === 'thinking' || s === 'surprised' || s === 'angry') return 'talking';
  if (s === 'grateful' || s === 'happy-grateful') return 'happy';
  return s; // 'idle', 'talking', 'happy', 'sad', 'walking', 'dying'
};

export const MapEditorUI = ({ gameRef }) => {
  const { t } = useTranslation();
  const isAdmin = useAuthStore(s => s.isAdmin());
  const adminCheck = isAdmin;

  const [isEditorActive, setIsEditorActive] = useState(false);
  const [moveMode, setMoveMode] = useState('character'); // Default to character mode as requested
  const [activeTool, setActiveTool] = useState('brush');
  const [activeTile, setActiveTile] = useState('wall');
  const [activeTexture, setActiveTexture] = useState('sprite1');
  const [buildMeta, setBuildMeta] = useState({ portalType: 'map', targetMap: '', targetX: '', targetY: '', targetRoute: '', interactionText: '', missionIds: [] });
  const [npcMeta, setNpcMeta] = useState({ definitionId: '', missionIds: [], state: 'idle', facing: 'right', movementType: 'static', waypoints: [] });
  const [editingNpcRoute, setEditingNpcRoute] = useState(false);
  const [enemyMeta, setEnemyMeta] = useState({ npcId: '', waveNum: 1, hp: 50, speed: 120, damage: 10, attackRate: 1000, type: 'melee', projectileSprite: '', manaMax: 100, manaRegen: 10, hpRegen: 0, cardFailHealPct: 100 });
  const [buildScale, setBuildScale] = useState(2.5);
  const [availableMaps, setAvailableMaps] = useState([]);
  const [npcDefinitions, setNpcDefinitions] = useState([]);
  const [availableMissions, setAvailableMissions] = useState([]);
  const [availableItems, setAvailableItems] = useState([]);
  const [pickupMeta, setPickupMeta] = useState({ itemId: '', quantity: 1 });
  const [furnitureMeta, setFurnitureMeta] = useState({ minigameType: '', minigameId: '', readText: '' });
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null); // 'success'|'error'|null
  const [exportedData, setExportedData] = useState(null);
  const [stats, setStats] = useState({ 
    walls: 0, floors: 0, forest: 0, builds: 0, spawns: 0, 
    npcZones: 0, pickups: 0, storeTiles: 0, furniture: 0, exits: 0,
    enemySpawns: 0,
    historySize: 0, redoSize: 0 
  });
  const [availableEnemies, setAvailableEnemies] = useState([]);
  const [playerSpeed, setPlayerSpeed] = useState(160);
  const [enemiesPaused, setEnemiesPaused] = useState(false);

  // Current map settings (width, height, public, etc.)
  const [currentSettings, setCurrentSettings] = useState({
    width: 800, height: 800, isPublic: false, maxUsers: 50,
    defaultSpawnX: 1000, defaultSpawnY: 750
  });
  // True once currentSettings has been seeded from the loaded map. Until then we
  // must NOT push currentSettings back into the scene, or the initial React
  // defaults (spawn 1000,750) clobber the spawn/dims loaded from the DB.
  const hasInitializedSettings = useRef(false);

  const TOOLS = useMemo(() => [
    { id: 'brush', label: t('lobby.editor.tool_brush'), icon: Paintbrush, shortcut: 'B' },
    { id: 'eraser', label: t('lobby.editor.tool_eraser'), icon: Eraser, shortcut: 'E' },
    { id: 'rect', label: t('lobby.editor.tool_rect'), icon: Square, shortcut: 'R' },
    { id: 'marker', label: t('lobby.editor.tool_marker'), icon: MapPin, shortcut: 'M' },
    { id: 'inspector', label: t('lobby.editor.tool_inspector') || 'Pick', icon: Pipette, shortcut: 'I' },
  ], [t]);

  const fileInputRef = useRef(null);

  const TILE_TYPES = useMemo(() => [
    { id: 'wall', label: t('lobby.editor.tile_wall'), color: TILE_COLORS.wall },
    { id: 'floor', label: t('lobby.editor.tile_floor'), color: TILE_COLORS.floor },
    { id: 'forest', label: t('lobby.editor.tile_forest'), color: TILE_COLORS.forest },
    { id: 'build', label: t('lobby.editor.tile_build'), color: TILE_COLORS.build },
    { id: 'exit', label: t('lobby.editor.tile_exit'), color: TILE_COLORS.exit },
    { id: 'spawn', label: t('lobby.editor.tile_spawn'), color: TILE_COLORS.spawn },
    { id: 'npc', label: t('lobby.editor.tile_npc'), color: TILE_COLORS.npc },
    { id: 'item', label: t('lobby.editor.tile_item'), color: TILE_COLORS.item },
    { id: 'void', label: t('lobby.editor.tile_void'), color: TILE_COLORS.void },
    { id: 'collider', label: t('lobby.editor.tile_collider') || 'Collider', color: TILE_COLORS.collider },
    { id: 'store', label: t('lobby.editor.tile_store') || 'Store Tiles', color: TILE_COLORS.store },
    { id: 'furniture', label: t('lobby.editor.tile_furniture') || 'Furniture 1', color: TILE_COLORS.furniture },
    { id: 'furniture2', label: t('lobby.editor.tile_furniture2') || 'Furniture 2', color: TILE_COLORS.furniture2 },
    { id: 'furniture3', label: t('lobby.editor.tile_furniture3') || 'Furniture 3', color: TILE_COLORS.furniture3 },
    { id: 'enemy', label: t('lobby.editor.tile_enemy') || 'Enemy Spawn', color: TILE_COLORS.enemy },
  ], [t]);

  useEffect(() => {
    const onStats = e => setStats(e.detail);
    const onPicked = e => {
      const { type, frame, scale, metadata } = e.detail;
      console.log('[MapEditorUI] Object picked from scene:', e.detail);
      
      const newFrame = frame || 'sprite1';
      const newScale = scale || 1;
      
      setActiveTile(type);
      setActiveTexture(newFrame);
      setBuildScale(newScale);

      dispatchEditorCommand('setTileType', type);
      dispatchEditorCommand('setTexture', newFrame);
      dispatchEditorCommand('setBuildScale', newScale);

      if (type === 'build' || type === 'exit') {
        const bm = {
          portalType: metadata.portalType || 'map',
          targetMap: metadata.targetMap || '',
          targetX: metadata.targetX || '',
          targetY: metadata.targetY || '',
          targetRoute: metadata.targetRoute || '',
          interactionText: metadata.interactionText || '',
          missionIds: Array.isArray(metadata.missionIds) ? metadata.missionIds : (metadata.missionId ? [metadata.missionId] : [])
        };
        setBuildMeta(bm);
        dispatchEditorCommand('setBuildMetadata', bm);
      } else if (type === 'npc') {
        const nm = {
          definitionId: metadata.definitionId || '',
          missionIds: Array.isArray(metadata.missionIds) ? metadata.missionIds : (metadata.missionId ? [metadata.missionId] : []),
          state: mapFaceToBodyState(metadata.state || 'idle'),
          facing: metadata.facing || 'right',
          movementType: metadata.movementType || metadata.movement_type || 'static',
          waypoints: Array.isArray(metadata.waypoints) ? metadata.waypoints : []
        };
        setNpcMeta(nm);
        dispatchEditorCommand('setNPCMetadata', nm);
        setPickupMeta({
          itemId: metadata.itemId || '',
          quantity: metadata.quantity || 1
        });
      } else if (type === 'furniture' || type === 'furniture2' || type === 'furniture3') {
        const fm = {
          minigameType: metadata.minigameType || '',
          minigameId: metadata.minigameId || '',
          readText: metadata.readText || ''
        };
        setFurnitureMeta(fm);
        dispatchEditorCommand('setFurnitureMetadata', fm);
      } else if (type === 'enemy') {
        setEnemyMeta({
          npcId: metadata.npcId || '',
          waveNum: metadata.waveNum || 1,
          hp: metadata.hp || 50,
          attackRate: metadata.attackRate || 1000,
          speed: metadata.speed || 120,
          damage: metadata.damage || 10,
          type: metadata.type || 'melee',
          projectileSprite: metadata.projectileSprite || '',
          manaMax: metadata.manaMax || 100,
          manaRegen: metadata.manaRegen || 10,
          hpRegen: metadata.hpRegen || 0,
          cardFailHealPct: metadata.cardFailHealPct || 100,
        });
      }

      // Switch to brush tool automatically after picking for convenience
      setActiveTool('brush');
      dispatchEditorCommand('setTool', 'brush');
    };

    const onControllerReady = () => {
      console.log('[MapEditorUI] EditorController ready, syncing state...');
      dispatchEditorCommand('setTileType', activeTile);
      dispatchEditorCommand('setTexture', activeTexture);
      dispatchEditorCommand('setTool', activeTool);
      dispatchEditorCommand('setMoveMode', moveMode);
      dispatchEditorCommand('setBuildScale', buildScale);
      dispatchEditorCommand('setBuildMetadata', buildMeta);
      dispatchEditorCommand('setFurnitureMetadata', furnitureMeta);
      dispatchEditorCommand('setNPCMetadata', npcMeta);
      dispatchEditorCommand('setEnemyMetadata', enemyMeta);
      dispatchEditorCommand('setPickupMetadata', pickupMeta);
    };

    window.addEventListener('editor-stats', onStats);
    window.addEventListener('editor-picked-object', onPicked);
    window.addEventListener('editor-controller-ready', onControllerReady);

    return () => {
      window.removeEventListener('editor-stats', onStats);
      window.removeEventListener('editor-picked-object', onPicked);
      window.removeEventListener('editor-controller-ready', onControllerReady);
    };
  }, [activeTile, activeTexture, activeTool, moveMode, buildScale, buildMeta, furnitureMeta, npcMeta, enemyMeta, pickupMeta]);

  // Sync moveMode when the Phaser scene changes it (e.g. on editor open/close)
  useEffect(() => {
    const onModeChange = e => setMoveMode(e.detail?.mode ?? 'camera');
    window.addEventListener('editor-move-mode-changed', onModeChange);

    const onEnemiesPaused = e => setEnemiesPaused(e.detail?.paused ?? false);
    window.addEventListener('editor-enemies-paused', onEnemiesPaused);

    return () => {
        window.removeEventListener('editor-move-mode-changed', onModeChange);
        window.removeEventListener('editor-enemies-paused', onEnemiesPaused);
    }
  }, []);

  useEffect(() => {
    if (isEditorActive) {
      api.get('/admin/maps').then(r => setAvailableMaps(r.data)).catch(() => { });
      api.get('/admin/npc-definitions').then(r => setNpcDefinitions(r.data)).catch(() => { });
      // Fetch all missions for assignment (assuming endpoint exists, if not we'll use a placeholder/mock)
      api.get('/admin/missions').then(r => setAvailableMissions(r.data)).catch(() => { 
        // Fallback for missions if /all doesn't exist yet
        setAvailableMissions([
          { id: 1, title: 'First Steps' },
          { id: 2, title: 'The Lost Gem' }
        ]);
      });
      api.get('/admin/items').then(r => setAvailableItems(r.data)).catch(() => { });
      api.get('/admin/enemies').then(r => setAvailableEnemies(r.data)).catch(() => { });
    }
  }, [isEditorActive]);

  // Reset the init guard whenever the editor closes so a fresh open re-seeds.
  useEffect(() => {
    if (!isEditorActive) hasInitializedSettings.current = false;
  }, [isEditorActive]);

  // Sync current settings when availableMaps loads or editor opens
  useEffect(() => {
    if (!isEditorActive) return;
    const sceneKey = getMapKey();
    const map = availableMaps.find(m => m.scene_key === sceneKey);
    if (map) {
      let w = 800, h = 800, spawnX = 1000, spawnY = 750, bgm = 'none';
      try {
        const md = typeof map.map_data === 'string' ? JSON.parse(map.map_data) : map.map_data;
        if (md?.width) w = md.width;
        if (md?.height) h = md.height;
        if (md?.defaultSpawnX != null) spawnX = md.defaultSpawnX;
        if (md?.defaultSpawnY != null) spawnY = md.defaultSpawnY;
        if (md?.bgmTrack) bgm = md.bgmTrack;
      } catch { }
      setCurrentSettings({
        width: w, height: h,
        isPublic: !!map.is_public,
        maxUsers: map.max_users || 50,
        defaultSpawnX: spawnX, defaultSpawnY: spawnY,
        bgmTrack: bgm
      });
      hasInitializedSettings.current = true;
    } else {
      // New map defaults? Or maybe read from current scene if already loaded
      const sc = getScene();
      if (sc) {
        setCurrentSettings(prev => ({
          ...prev,
          width: sc.mapWidth || 800,
          height: sc.mapHeight || 800,
          defaultSpawnX: sc.mapDefaultSpawnX ?? prev.defaultSpawnX,
          defaultSpawnY: sc.mapDefaultSpawnY ?? prev.defaultSpawnY,
          bgmTrack: sc.bgmTrack || 'none'
        }));
        hasInitializedSettings.current = true;
      }
    }
  }, [availableMaps, isEditorActive]);

  // Sync currentSettings back to Phaser scene whenever they change. Guarded so the
  // initial React defaults can't overwrite the spawn/dims loaded from the DB before
  // currentSettings has been seeded from the map (see hasInitializedSettings).
  useEffect(() => {
    if (!isEditorActive || !hasInitializedSettings.current) return;
    const sc = getScene();
    if (sc && typeof sc.updateMapMetadata === 'function') {
      sc.updateMapMetadata(currentSettings);
    }
  }, [currentSettings, isEditorActive]);

  useEffect(() => {
    if (!isEditorActive) return;
    const h = e => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      if (e.key === 'b' || e.key === 'B') { selectTool('brush'); return; }
      if (e.key === 'e' || e.key === 'E') { selectTool('eraser'); return; }
      if (e.key === 'r' || e.key === 'R') { selectTool('rect'); return; }
      if (e.key === 'm' || e.key === 'M') { selectTool('marker'); return; }
      if (e.key === 'i' || e.key === 'I') { selectTool('inspector'); return; }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); dispatchEditorCommand('undo'); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); dispatchEditorCommand('redo'); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [isEditorActive]);

  useEffect(() => {
    const onPicked = (e) => {
      const { x, y } = e.detail;
      if (activeTile === 'build' || activeTile === 'exit') {
        setBuildMeta(prev => {
          const m = { ...prev, targetX: x, targetY: y };
          dispatchEditorCommand('setBuildMetadata', m);
          return m;
        });
      } else {
        setCurrentSettings(prev => ({ ...prev, defaultSpawnX: x, defaultSpawnY: y }));
      }
    };
    window.addEventListener('editor-picked-coord', onPicked);
    return () => window.removeEventListener('editor-picked-coord', onPicked);
  }, [activeTile]);

  // Ref guard — prevents React StrictMode from double-invoking the auto-open
  const editorAutoOpenedRef = useRef(false);

  // Auto-open if URL has ?edit_map
  useEffect(() => {
    if (!isAdmin) return;
    if (!new URLSearchParams(window.location.search).get('edit_map')) return;
    if (editorAutoOpenedRef.current) return; // already triggered
    editorAutoOpenedRef.current = true;

    let n = 0;
    const tryOpen = () => {
      const scene = getScene();
      if (scene) {
        setIsEditorActive(true);
        if (typeof scene.toggleEditorMode === 'function') {
          scene.toggleEditorMode(true);
        } else {
          console.warn('[MapEditorUI] Current scene does not support editor mode.');
        }
        window.dispatchEvent(new CustomEvent('editor-mode-changed', { detail: { active: true } }));
      } else if (n++ < 20) setTimeout(tryOpen, 500);
    };
    setTimeout(tryOpen, 1000);
  }, []);

  if (!adminCheck) return null;

  /* ─── helpers ─── */
  const getScene = () =>
    gameRef.current?.scene?.getScene('LobbyScene') || gameRef.current?.scene?.scenes?.[0];

  const toggleEditor = () => {
    const next = !isEditorActive;
    const tryToggle = (n = 0) => {
      const sc = getScene();
      if (sc) {
        setIsEditorActive(next);
        if (typeof sc.toggleEditorMode === 'function') {
          sc.toggleEditorMode(next);
        } else {
          console.warn('[MapEditorUI] Current scene does not support editor mode.');
        }
        window.dispatchEvent(new CustomEvent('editor-mode-changed', { detail: { active: next } }));
      } else if (n < 10) setTimeout(() => tryToggle(n + 1), 500);
    };
    tryToggle();
  };

  const selectTool = id => { setActiveTool(id); dispatchEditorCommand('setTool', id); };
  const selectTile = id => { 
    setActiveTile(id); 
    dispatchEditorCommand('setTileType', id);
    // Para tipos con atlas propios NO reseteamos a 'sprite1' (que solo existe en el terrain atlas).
    // Dejamos que el usuario seleccione el sprite, o usamos null para que _placeTileDirect
    // use su propio frame por defecto (ej. tree1.png para forest).
    const tilesWithOwnAtlas = ['forest', 'wall', 'build', 'store', 'furniture', 'furniture2', 'furniture3'];
    if (!tilesWithOwnAtlas.includes(id)) {
      setActiveTexture('sprite1');
      dispatchEditorCommand('setTexture', 'sprite1');
    } else {
      // Mantener la textura activa si el usuario ya tenia una seleccionada para ese tipo,
      // o resetear a null para que _placeTileDirect use el default de cada atlas.
      setActiveTexture(null);
      dispatchEditorCommand('setTexture', null);
    }
  };
  const selectTexture = id => { setActiveTexture(id); dispatchEditorCommand('setTexture', id); };
  const updateMeta = (k, v) => { const m = { ...buildMeta, [k]: v }; setBuildMeta(m); dispatchEditorCommand('setBuildMetadata', m); };
  const updateScale = v => { const s = parseFloat(v); setBuildScale(s); dispatchEditorCommand('setBuildScale', s); };
  const updateNpcMeta = (k, v) => { 
    setNpcMeta(prev => ({ ...prev, [k]: k === 'state' ? mapFaceToBodyState(v) : v })); 
  };
  useEffect(() => {
    dispatchEditorCommand('setNPCMetadata', npcMeta);
  }, [npcMeta]);

  useEffect(() => {
    dispatchEditorCommand('setPickupMetadata', pickupMeta);
  }, [pickupMeta]);

  useEffect(() => {
    dispatchEditorCommand('setEnemyMetadata', enemyMeta);
  }, [enemyMeta]);

  useEffect(() => {
    dispatchEditorCommand('setFurnitureMetadata', furnitureMeta);
  }, [furnitureMeta]);

  useEffect(() => {
    const handleSyncWaypoints = (e) => {
      setNpcMeta(prev => ({ ...prev, waypoints: e.detail || [] }));
    };
    window.addEventListener('editor-sync-npc-waypoints', handleSyncWaypoints);
    return () => {
      window.removeEventListener('editor-sync-npc-waypoints', handleSyncWaypoints);
    };
  }, []);

  useEffect(() => {
    if (activeTile !== 'npc' || !isEditorActive) {
      setEditingNpcRoute(false);
      dispatchEditorCommand('setEditingNpcRouteMode', false);
    }
  }, [activeTile, isEditorActive]);
  const selectMoveMode = (mode) => { setMoveMode(mode); dispatchEditorCommand('setMoveMode', mode); };
  const updatePlayerSpeed = (val) => {
    const s = parseInt(val);
    setPlayerSpeed(s);
    dispatchEditorCommand('setPlayerSpeed', s);
  };

  const getMapKey = () => {
    const sc = getScene();
    if (sc && sc.currentMapKey) return sc.currentMapKey;
    return new URLSearchParams(window.location.search).get('edit_map') || 'lobby';
  };
  const currentMapKey = getMapKey();

  const saveToServer = () => {
    const sc = getScene(); 
    if (!sc) return;
    
    const sceneKey = getMapKey();
    setSaving(true); 
    setSaveStatus(null);

    const wallsJson = sc.exportMapConfig();
    // Single source of truth: derive map_data's dimensions/spawn from the live
    // exported config (the running scene), NOT from the React `currentSettings`.
    // loadServerMapConfig lets map_data override walls_json for width/height, so if
    // these two disagree the map "jumps" to whatever stale/default value was in
    // currentSettings on reload. Reading both from the same source keeps them in sync.
    let live = {};
    try { live = JSON.parse(wallsJson) || {}; } catch { live = {}; }
    const mapData = JSON.stringify({
      width:         live.width        ?? currentSettings.width,
      height:        live.height       ?? currentSettings.height,
      defaultSpawnX: live.defaultSpawnX ?? currentSettings.defaultSpawnX,
      defaultSpawnY: live.defaultSpawnY ?? currentSettings.defaultSpawnY,
      bgmTrack:      live.bgmTrack     ?? currentSettings.bgmTrack,
    });

    // Trace: confirm what gets persisted (dimensions/spawn single source of truth +
    // how many sign/furniture pieces are being saved, to debug readText persistence).
    console.log(`[MapEditor] Saving '${sceneKey}' → dims ${live.width}x${live.height}, spawn (${live.defaultSpawnX},${live.defaultSpawnY}), furniture ${(live.furniture?.length || 0) + (live.furniture2?.length || 0) + (live.furniture3?.length || 0)} (with text: ${[...(live.furniture || []), ...(live.furniture2 || []), ...(live.furniture3 || [])].filter(f => f.readText).length})`);

    const payload = {
      scene_key: sceneKey,
      walls_json: wallsJson,
      map_data: mapData,
      is_public: currentSettings.isPublic,
      max_users: currentSettings.maxUsers,
    };

    console.log(`[MapEditor] Sending save request. Payload size: ${(JSON.stringify(payload).length / 1024).toFixed(2)} KB`);

    // Use PUT when map already exists
    const existingMap = availableMaps.find(m => m.scene_key === sceneKey);
    const request = existingMap
      ? api.put(`/admin/maps/${existingMap.id}`, payload)
      : api.post('/admin/maps', payload);

    request
      .then(() => {
        setSaveStatus('success');
        // Signal Game Scene to refresh pickups now that IDs might have changed on server
        window.dispatchEvent(new CustomEvent('map-pickups-updated'));
        if (isEditorActive) api.get('/admin/maps').then(r => setAvailableMaps(r.data));
      })
      .catch((err) => {
        const errorMsg = err.response?.data?.error || err.message;
        console.error('[MapEditor] Save failed:', errorMsg, err.response?.data || err);
        setSaveStatus('error');
      })
      .finally(() => {
        setSaving(false);
        setTimeout(() => setSaveStatus(null), 3000);
      });
  };

  const exportMap = () => {
    const sc = getScene(); if (!sc) return;
    const configString = sc.exportMapConfig();
    
    const blob = new Blob([configString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `map_export_${currentMapKey}_${new Date().getTime()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target.result);
        if (confirm(t('lobby.editor.import_confirm') || '¿Importar mapa? Esto borrará el contenido actual.')) {
          // Send to Phaser
          dispatchEditorCommand('importMap', json);
          
          // Update React state to match imported values
          setCurrentSettings({
            width: json.width || 800,
            height: json.height || 800,
            defaultSpawnX: json.defaultSpawnX !== undefined ? json.defaultSpawnX : 1000,
            defaultSpawnY: json.defaultSpawnY !== undefined ? json.defaultSpawnY : 750,
            bgmTrack: json.bgmTrack || 'none',
            isPublic: json.isPublic !== undefined ? json.isPublic : false,
            maxUsers: json.maxUsers || 50
          });
        }
      } catch (err) {
        alert(t('lobby.editor.import_error') || 'Error al importar el archivo JSON.');
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset for next time
  };

  const total = (stats.walls || 0) + (stats.floors || 0) + (stats.forest || 0) + (stats.builds || 0) + (stats.spawns || 0) + (stats.npcZones || 0) + (stats.pickups || 0) + (stats.storeTiles || 0) + (stats.furniture || 0) + (stats.furniture2 || 0) + (stats.furniture3 || 0) + (stats.exits || 0);

  const TILE_TYPE_TO_STAT = {
    wall: 'stat_walls',
    floor: 'stat_floors',
    forest: 'stat_forests',
    build: 'stat_builds',
    spawn: 'stat_spawns',
    npc: 'stat_npcs',
    item: 'stat_pickups',
    collider: 'stat_colliders',
    store: 'stat_store',
    furniture: 'stat_furniture',
    furniture2: 'stat_furniture2',
    furniture3: 'stat_furniture3',
    exit: 'stat_exits',
    enemy: 'stat_enemies',
  };

  /* ─── render ─── */
  return (
    <>
      {/* Toggle button */}
      <div className="absolute top-4 right-4 z-50 pointer-events-auto flex flex-col items-end gap-2">
        <button
          onClick={toggleEditor}
          title={t('lobby.editor.title')}
          className={`p-3 rounded-full shadow-xl transition-all ${isEditorActive
            ? 'bg-yellow-500 text-black'
            : 'bg-gray-900/90 border border-gray-700 text-gray-400 hover:bg-gray-800'}`}
        >
          <Hammer size={20} />
        </button>
        {saveStatus && (
          <div className={`px-3 py-1.5 rounded text-xs font-semibold shadow-lg ${saveStatus === 'success'
            ? 'bg-green-900 text-green-300 border border-green-700'
            : 'bg-red-900   text-red-300   border border-red-700'}`}>
            {saveStatus === 'success' ? `✅ ${t('lobby.editor.saved')}` : `❌ ${t('lobby.editor.save_error')}`}
          </div>
        )}
      </div>

      {/* Right sidebar */}
      {isEditorActive && (
        <div
          className="absolute top-0 right-0 z-40 pointer-events-auto h-full
                     bg-gray-950/95 border-l border-gray-700 shadow-2xl backdrop-blur-sm
                     flex flex-col w-56"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700 flex-shrink-0">
            <div className="flex items-center gap-2">
              <Hammer size={14} className="text-yellow-400" />
              <span className="text-xs font-bold text-white tracking-wide">{t('lobby.editor.title')}</span>
            </div>
            <button onClick={toggleEditor} className="text-gray-500 hover:text-white transition-colors">
              <X size={14} />
            </button>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto"
            style={{ scrollbarWidth: 'thin', scrollbarColor: '#374151 transparent' }}>

            <Section title={t('lobby.editor.map_settings')} defaultOpen={true}>
              <div className="flex flex-col gap-2">
                <div className="flex gap-1">
                  <div className="flex-1">
                    <label className="text-[9px] text-gray-500 block mb-0.5">{t('lobby.editor.width')}</label>
                    <input type="number" value={currentSettings.width}
                      onChange={e => {
                        const val = Number(e.target.value);
                        setCurrentSettings(prev => {
                          getScene()?.resizeMap(val, prev.height);
                          return { ...prev, width: val };
                        });
                      }}
                      className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-[10px] text-white outline-none" />
                  </div>
                  <div className="flex-1">
                    <label className="text-[9px] text-gray-500 block mb-0.5">{t('lobby.editor.height')}</label>
                    <input type="number" value={currentSettings.height}
                      onChange={e => {
                        const val = Number(e.target.value);
                        setCurrentSettings(prev => {
                          getScene()?.resizeMap(prev.width, val);
                          return { ...prev, height: val };
                        });
                      }}
                      className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-[10px] text-white outline-none" />
                  </div>
                </div>

                <div className="border-t border-gray-700/60 pt-1.5">
                  <div className="text-[9px] text-green-400 font-semibold mb-1">{t('lobby.editor.default_spawn')}</div>
                  <div className="flex gap-1">
                    <div className="flex-1">
                      <label className="text-[9px] text-gray-500 block mb-0.5">{t('lobby.editor.spawn_x')}</label>
                      <input type="number" value={currentSettings.defaultSpawnX}
                        onChange={e => {
                          const val = Number(e.target.value);
                          getScene()?.updateMapMetadata?.({ defaultSpawnX: val });
                          setCurrentSettings(p => ({ ...p, defaultSpawnX: val }));
                        }}
                        placeholder="1000"
                        className="w-full bg-gray-800 border border-green-800/60 rounded px-2 py-1 text-[10px] text-green-300 outline-none" />
                    </div>
                    <div className="flex-1">
                      <label className="text-[9px] text-gray-500 block mb-0.5">{t('lobby.editor.spawn_y')}</label>
                      <input type="number" value={currentSettings.defaultSpawnY}
                        onChange={e => {
                          const val = Number(e.target.value);
                          getScene()?.updateMapMetadata?.({ defaultSpawnY: val });
                          setCurrentSettings(p => ({ ...p, defaultSpawnY: val }));
                        }}
                        placeholder="750"
                        className="w-full bg-gray-800 border border-green-800/60 rounded px-2 py-1 text-[10px] text-green-300 outline-none" />
                    </div>
                  </div>
                  <p className="text-[8px] text-gray-600 mt-1 leading-tight">{t('lobby.editor.default_spawn_hint') || 'Usado cuando no hay spawn de portal específico.'}</p>
                </div>

                {/* Background Music Selector */}
                <div className="border-t border-gray-700/60 pt-1.5">
                  <label className="text-[9px] text-blue-400 font-semibold block mb-1">{t('lobby.editor.bgm')}</label>
                  <select
                    value={currentSettings.bgmTrack || 'none'}
                    onChange={e => setCurrentSettings(p => ({ ...p, bgmTrack: e.target.value }))}
                    className="w-full bg-gray-800 border border-blue-800/60 rounded px-2 py-1 text-[10px] text-blue-300 outline-none"
                  >
                    <option value="none">{t('lobby.editor.no_music')}</option>
                    <option value="bgm_pixelated_prelude">Pixelated Prelude (Lobby/Inicio)</option>
                    <option value="bgm_serene_village">Serene Village (Pueblo)</option>
                    <option value="bgm_whispering_woods">Whispering Woods (Bosque)</option>
                    <option value="bgm_whispering_woods_past">Whispering Woods Past (Bosque Antiguo)</option>
                    <option value="bgm_whispers_glitch">Glitch Garden (Jardín Glitch)</option>
                    <option value="bgm_cave1">Cave 1 (Cueva/Mazmorra)</option>
                    <option value="bgm_fight_level">Fight Level (Batalla Básica)</option>
                    <option value="bgm_fight_boss">Fight Boss (Jefe Final)</option>
                    <option value="bgm_pixel_pantry">Pixel Pantry Jingle (Tienda)</option>
                    <option value="bgm_pixelated_haven">Pixelated Haven (Refugio)</option>
                  </select>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-gray-700/60">
                  <label className="flex items-center gap-1.5 cursor-pointer select-none">
                    <input type="checkbox" checked={currentSettings.isPublic}
                      onChange={e => setCurrentSettings(p => ({ ...p, isPublic: e.target.checked }))}
                      className="w-3 h-3 accent-yellow-500 rounded-sm" />
                    <span className="text-[10px] text-gray-300">{t('lobby.editor.is_public')}</span>
                  </label>
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] text-gray-500">{t('lobby.editor.max_users_label') || 'Max'}:</span>
                    <input type="number" value={currentSettings.maxUsers}
                      onChange={e => setCurrentSettings(p => ({ ...p, maxUsers: Number(e.target.value) }))}
                      className="w-10 bg-gray-800 border border-gray-700 rounded px-1 text-[10px] text-white text-right outline-none" />
                  </div>
                </div>
                <p className="text-[8px] text-gray-600 leading-tight">
                  {t('lobby.editor.save_hint')}
                </p>
              </div>
            </Section>

            {/* Move Mode toggle */}
            <Section title={t('lobby.editor.move_mode')}>
              <div className="flex gap-1.5 mb-3">
                <button
                  onClick={() => selectMoveMode('camera')}
                  title={t('lobby.editor.camera_tooltip')}
                  className={`flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded border text-[9px] transition-all
                    ${moveMode === 'camera'
                      ? 'bg-yellow-500/20 border-yellow-500/60 text-yellow-400'
                      : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'}`}
                >
                  <Camera size={13} />
                  <span>{t('lobby.editor.camera')}</span>
                </button>
                <button
                  onClick={() => selectMoveMode('character')}
                  title={t('lobby.editor.character_tooltip')}
                  className={`flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded border text-[9px] transition-all
                    ${moveMode === 'character'
                      ? 'bg-blue-500/20 border-blue-500/60 text-blue-400'
                      : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'}`}
                >
                  <User size={13} />
                  <span>{t('lobby.editor.character')}</span>
                </button>
              </div>

              {/* Character Speed (Only show/relevance in character mode) */}
              <div className="border-t border-gray-700/40 pt-2 pb-1">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1 text-[9px] font-bold text-blue-400">
                    <Zap size={11} />
                    <span>{t('lobby.editor.speed') || 'Test Speed'}</span>
                  </div>
                  <span className="text-[10px] text-gray-400 font-mono">{(playerSpeed / 160).toFixed(1)}x</span>
                </div>
                
                <input 
                  type="range" 
                  min="160" max="800" step="160" 
                  value={playerSpeed}
                  onChange={e => updatePlayerSpeed(e.target.value)}
                  className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-blue-500 mb-2"
                />
                
                <div className="flex gap-1">
                  {[160, 320, 800].map(s => (
                    <button
                      key={s}
                      onClick={() => updatePlayerSpeed(s)}
                      className={`flex-1 py-0.5 rounded text-[8px] border transition-all
                        ${playerSpeed === s 
                          ? 'bg-blue-600/20 border-blue-500 text-blue-400' 
                          : 'bg-gray-900 border-gray-800 text-gray-500 hover:text-gray-300'}`}
                    >
                      {s === 160 ? '1x' : (s === 320 ? '2x' : '5x')}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-1 mt-2">
                <button
                  onClick={() => dispatchEditorCommand(enemiesPaused ? 'resumeEnemies' : 'pauseEnemies')}
                  className={`flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded border text-[9px] transition-all
                    ${enemiesPaused
                      ? 'bg-red-500/20 border-red-500/60 text-red-400'
                      : 'bg-green-500/20 border-green-500/60 text-green-400'}`}
                >
                  {enemiesPaused ? <Play size={13} /> : <Pause size={13} />}
                  <span>{enemiesPaused ? 'Resume Enemies' : 'Pause Enemies'}</span>
                </button>
              </div>

              <p className="text-[8px] text-gray-600 mt-2 leading-tight">
                {moveMode === 'camera'
                  ? `🎥 ${t('lobby.editor.camera_tooltip')}`
                  : `🧍 ${t('lobby.editor.character_tooltip')}`}
              </p>
            </Section>

            {/* Tools */}
            <Section title={t('lobby.editor.tools')}>
              <div className="flex gap-1.5">
                {TOOLS.map(t => {
                  const Icon = t.icon;
                  const on = activeTool === t.id;
                  return (
                    <button key={t.id} onClick={() => selectTool(t.id)} title={`${t.label} (${t.shortcut})`}
                      className={`flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded border text-[9px] transition-all
                        ${on ? 'bg-yellow-500/20 border-yellow-500/60 text-yellow-400' : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'}`}>
                      <Icon size={13} /><span>{t.shortcut}</span>
                    </button>
                  );
                })}
              </div>
            </Section>

            {/* Tile type */}
            <Section title={t('lobby.editor.tile_type')}>
              <div className="grid grid-cols-3 gap-1">
                {TILE_TYPES.map(tile => {
                  const on = activeTile === tile.id;
                  return (
                    <button key={tile.id} onClick={() => selectTile(tile.id)}
                      className={`flex items-center gap-1 px-1.5 py-1 rounded border text-[9px] transition-all truncate
                        ${on 
                          ? (tile.id === 'enemy' ? 'bg-red-600 border-red-400 text-white ring-1 ring-red-400/50' : 'bg-gray-700 border-gray-400 text-white') 
                          : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'}`}>
                      <span className="w-2 h-2 rounded-sm flex-shrink-0 border border-black/20" style={{ backgroundColor: tile.color }} />
                      {tile.label}
                    </button>
                  );
                })}
              </div>
            </Section>

            {/* Enemy Settings - MOVED HERE for better flow */}
            {activeTile === 'enemy' && (
              <div className="mx-2 mb-4 p-2 bg-red-900/10 border border-red-500/20 rounded-lg">
                <div className="flex items-center gap-2 mb-2 text-red-400">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">{t('lobby.editor.enemy_config') || 'Configuración de Enemigo'}</span>
                </div>

                <div className="space-y-2">
                  <div>
                    <label className="block text-[9px] text-gray-500 mb-0.5">{t('lobby.editor.enemy_model') || 'Modelo de enemigo'}</label>
                    <select value={enemyMeta.npcId}
                      onChange={e => {
                        const id = e.target.value;
                        const model = availableEnemies.find(m => String(m.id) === String(id));
                        // El modelo es la fuente de verdad: al elegirlo se hereda su
                        // comportamiento (y stats base). Editable después si hace falta.
                        setEnemyMeta(p => ({
                          ...p,
                          npcId: id,
                          ...(model ? {
                            type: normalizeBehavior(model.ai_behavior),
                            hp: model.hp_max ?? p.hp,
                            damage: model.attack ?? p.damage,
                            speed: model.speed ?? p.speed,
                            attackRate: model.attack_rate ?? p.attackRate,
                            // Si el modelo es boss, hereda también su economía de jefe.
                            ...(normalizeBehavior(model.ai_behavior) === 'boss' ? {
                              manaMax: model.mana_max ?? p.manaMax,
                              manaRegen: model.mana_regen ?? p.manaRegen,
                              hpRegen: model.hp_regen ?? p.hpRegen,
                              cardFailHealPct: model.card_fail_heal_pct ?? p.cardFailHealPct,
                            } : {}),
                          } : {}),
                        }));
                      }}
                      className="w-full bg-gray-900/50 border border-gray-700 rounded px-2 py-1 text-[10px] text-white outline-none focus:border-red-500/50 transition-colors">
                      <option value="">{t('lobby.editor.none')}...</option>
                      {availableEnemies.map(e => (
                        <option key={e.id} value={e.id}>{e.name} (Lv.{e.level} · {normalizeBehavior(e.ai_behavior)})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[9px] text-gray-500 mb-0.5">{t('lobby.editor.enemy_archetype') || 'Comportamiento'}</label>
                    <select value={enemyMeta.type} onChange={e => setEnemyMeta(p => ({ ...p, type: e.target.value }))}
                      className="w-full bg-gray-900/50 border border-gray-700 rounded px-2 py-1 text-[10px] text-white outline-none focus:border-red-500/50 transition-colors">
                      <option value="melee">Normal (melee)</option>
                      <option value="fast">Rápido</option>
                      <option value="thrower">Lanzador</option>
                      <option value="boss">Boss</option>
                    </select>
                    <p className="text-[8px] text-gray-600 mt-0.5">{t('lobby.editor.enemy_archetype_hint') || 'Se hereda del modelo; puedes sobreescribirlo.'}</p>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mt-2">
                    <div>
                      <label className="block text-[9px] text-gray-500 mb-0.5">Speed</label>
                      <input type="number" min="1" value={enemyMeta.speed}
                        onChange={e => setEnemyMeta(p => ({ ...p, speed: parseInt(e.target.value) || 120 }))}
                        className="w-full bg-gray-900/50 border border-gray-700 rounded px-2 py-1 text-[10px] text-white outline-none focus:border-red-500/50" />
                    </div>
                    <div>
                      <label className="block text-[9px] text-gray-500 mb-0.5">Damage</label>
                      <input type="number" min="1" value={enemyMeta.damage}
                        onChange={e => setEnemyMeta(p => ({ ...p, damage: parseInt(e.target.value) || 10 }))}
                        className="w-full bg-gray-900/50 border border-gray-700 rounded px-2 py-1 text-[10px] text-white outline-none focus:border-red-500/50" />
                    </div>
                    <div>
                      <label className="block text-[9px] text-gray-500 mb-0.5">Attack Rate</label>
                      <input type="number" min="100" value={enemyMeta.attackRate}
                        onChange={e => setEnemyMeta(p => ({ ...p, attackRate: parseInt(e.target.value) || 1000 }))}
                        className="w-full bg-gray-900/50 border border-gray-700 rounded px-2 py-1 text-[10px] text-white outline-none focus:border-red-500/50" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[9px] text-gray-500 mb-0.5">{t('lobby.editor.wave_num') || 'Oleada'}</label>
                      <input type="number" min="1" value={enemyMeta.waveNum}
                        onChange={e => setEnemyMeta(p => ({ ...p, waveNum: parseInt(e.target.value) || 1 }))}
                        className="w-full bg-gray-900/50 border border-gray-700 rounded px-2 py-1 text-[10px] text-white outline-none focus:border-red-500/50" />
                    </div>
                    <div>
                      <label className="block text-[9px] text-gray-500 mb-0.5">HP</label>
                      <input type="number" min="1" value={enemyMeta.hp}
                        onChange={e => setEnemyMeta(p => ({ ...p, hp: parseInt(e.target.value) || 1 }))}
                        className="w-full bg-gray-900/50 border border-gray-700 rounded px-2 py-1 text-[10px] text-white outline-none focus:border-red-500/50" />
                    </div>
                  </div>

                  {/* Lanzador: sprite del proyectil (icon_key); vacío → círculo rojo */}
                  {enemyMeta.type === 'thrower' && (
                    <div>
                      <label className="block text-[9px] text-gray-500 mb-0.5">{t('lobby.editor.projectile_sprite') || 'Proyectil (icon_key)'}</label>
                      <input type="text" placeholder="ej: dagger (vacío = círculo)" value={enemyMeta.projectileSprite}
                        onChange={e => setEnemyMeta(p => ({ ...p, projectileSprite: e.target.value }))}
                        className="w-full bg-gray-900/50 border border-gray-700 rounded px-2 py-1 text-[10px] text-white outline-none focus:border-red-500/50" />
                    </div>
                  )}

                  {/* Boss: maná (regen + gate de skill), autoregen de HP, % heal al fallar la card */}
                  {enemyMeta.type === 'boss' && (
                    <div className="mt-1 p-2 bg-amber-900/10 border border-amber-500/20 rounded space-y-2">
                      <div className="text-[9px] font-bold uppercase text-amber-400/80">Boss</div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[9px] text-gray-500 mb-0.5">Maná Máx</label>
                          <input type="number" min="0" value={enemyMeta.manaMax}
                            onChange={e => setEnemyMeta(p => ({ ...p, manaMax: parseInt(e.target.value) || 0 }))}
                            className="w-full bg-gray-900/50 border border-gray-700 rounded px-2 py-1 text-[10px] text-white outline-none focus:border-amber-500/50" />
                        </div>
                        <div>
                          <label className="block text-[9px] text-gray-500 mb-0.5">Maná/seg</label>
                          <input type="number" min="0" value={enemyMeta.manaRegen}
                            onChange={e => setEnemyMeta(p => ({ ...p, manaRegen: parseInt(e.target.value) || 0 }))}
                            className="w-full bg-gray-900/50 border border-gray-700 rounded px-2 py-1 text-[10px] text-white outline-none focus:border-amber-500/50" />
                        </div>
                        <div>
                          <label className="block text-[9px] text-gray-500 mb-0.5">HP/seg (autoregen)</label>
                          <input type="number" min="0" value={enemyMeta.hpRegen}
                            onChange={e => setEnemyMeta(p => ({ ...p, hpRegen: parseInt(e.target.value) || 0 }))}
                            className="w-full bg-gray-900/50 border border-gray-700 rounded px-2 py-1 text-[10px] text-white outline-none focus:border-amber-500/50" />
                        </div>
                        <div>
                          <label className="block text-[9px] text-gray-500 mb-0.5">% Heal (card fail)</label>
                          <input type="number" min="1" max="100" value={enemyMeta.cardFailHealPct}
                            onChange={e => setEnemyMeta(p => ({ ...p, cardFailHealPct: parseInt(e.target.value) || 100 }))}
                            className="w-full bg-gray-900/50 border border-gray-700 rounded px-2 py-1 text-[10px] text-white outline-none focus:border-amber-500/50" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <p className="text-[8px] text-red-400/60 italic mt-2 text-center">
                  {t('lobby.editor.enemy_placement_hint') || 'Haz clic en el mapa para colocar puntos de spawn.'}
                </p>
              </div>
            )}

            {/* Texture / Sprites */}
            <Section title={t('lobby.editor.texture')}>
              {activeTile === 'floor' && (
                <FloorGrid active={activeTexture} onSelect={selectTexture} />
              )}
              {activeTile === 'forest' && (
                <SpriteJsonGrid
                  jsonPath="/forest/forest-sprites.json"
                  imgPath="/forest/forest-spritesheet.png"
                  active={activeTexture} onSelect={selectTexture} scaleTarget={32}
                />
              )}
              {activeTile === 'build' && (
                <SpriteJsonGrid
                  jsonPath="/builds/build-sprites.json"
                  imgPath="/builds/build-spritesheet.png"
                  active={activeTexture} onSelect={selectTexture} scaleTarget={38}
                />
              )}
              {activeTile === 'wall' && (
                <SpriteJsonGrid
                  jsonPath="/wall/wall-sprites.json"
                  imgPath="/wall/wall-spritesheet.png"
                  active={activeTexture} onSelect={selectTexture} scaleTarget={32}
                />
              )}
              {activeTile === 'store' && (
                <SpriteJsonGrid
                  jsonPath="/store/tiles.json"
                  imgPath="/store/tiles.png"
                  active={activeTexture} onSelect={selectTexture} scaleTarget={32}
                />
              )}
              {activeTile === 'furniture' && (
                <SpriteJsonGrid
                  jsonPath="/store/furniture.json"
                  imgPath="/store/furniture.png"
                  active={activeTexture} onSelect={selectTexture} scaleTarget={32}
                />
              )}
              {activeTile === 'furniture2' && (
                <SpriteJsonGrid
                  jsonPath="/store/furniture2.json"
                  imgPath="/store/furniture2.png"
                  active={activeTexture} onSelect={selectTexture} scaleTarget={32}
                />
              )}
              {activeTile === 'furniture3' && (
                <SpriteJsonGrid
                  jsonPath="/furniture/sprites.json"
                  imgPath="/furniture/spritesheet.png"
                  active={activeTexture} onSelect={selectTexture} scaleTarget={32}
                />
              )}
              {activeTile === 'exit' && (
                <p className="text-[10px] text-gray-600 italic">{t('lobby.editor.exit_marker_hint') || 'La salida usa un marcador de portal automático. Configura su destino abajo.'}</p>
              )}
              {!['floor', 'forest', 'build', 'wall', 'store', 'furniture', 'furniture2', 'furniture3', 'exit'].includes(activeTile) && (
                <p className="text-[10px] text-gray-600 italic">{t('lobby.editor.no_texture_options')}</p>
              )}
            </Section>

            {/* Build portal settings */}
            {(activeTile === 'build' || activeTile === 'exit') && (
              <Section title={t('lobby.editor.portal_config')} defaultOpen={true}>
                {/* Scale */}
                <div className="mb-2">
                  <div className="flex justify-between mb-0.5">
                    <span className="text-[9px] text-gray-500">{t('lobby.editor.scale')}</span>
                    <span className="text-[9px] text-yellow-400 font-mono">{buildScale.toFixed(2)}×</span>
                  </div>
                  <input type="range" min="1" max="4.0" step="0.05" value={buildScale}
                    onChange={e => updateScale(e.target.value)}
                    className="w-full accent-yellow-400" />
                  <div className="flex justify-between text-[8px] text-gray-700 mt-0.5">
                    <span>1×</span><span>4.0×</span>
                  </div>
                </div>

                {/* Portal Type */}
                <div className="mb-2">
                  <label className="block text-[9px] text-gray-500 mb-0.5">{t('lobby.editor.portal_type')}</label>
                  <select value={buildMeta.portalType} onChange={e => updateMeta('portalType', e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-[10px] text-white outline-none">
                    <option value="map">{t('lobby.editor.portal_type_map')}</option>
                    <option value="local">{t('lobby.editor.portal_type_local')}</option>
                    <option value="route">{t('lobby.editor.portal_type_route')}</option>
                  </select>
                </div>

                {/* Target map (Only if type is 'map') */}
                {(buildMeta.portalType === 'map') && (
                  <div className="mb-2">
                    <label className="block text-[9px] text-gray-500 mb-0.5">{t('lobby.editor.target_map')}</label>
                    <select value={buildMeta.targetMap} onChange={e => updateMeta('targetMap', e.target.value)}
                      className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-[10px] text-white outline-none">
                      <option value="">{t('lobby.editor.none')}...</option>
                      {availableMaps
                        .filter(m => m.scene_key !== 'lobby') // Filter out if api returns it
                        .map(m => <option key={m.id} value={m.scene_key}>{m.scene_key}</option>)}
                      <option value="lobby">lobby</option>
                    </select>
                  </div>
                )}

                {/* Target Route (Only if type is 'route') */}
                {(buildMeta.portalType === 'route') && (
                  <div className="mb-2">
                    <label className="block text-[9px] text-gray-500 mb-0.5">{t('lobby.editor.target_route')}</label>
                    <input type="text" value={buildMeta.targetRoute || ''} onChange={e => updateMeta('targetRoute', e.target.value)}
                      placeholder="/learn"
                      className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-[10px] text-white outline-none" />
                  </div>
                )}

                {/* Interaction text */}
                <div className="mb-2">
                  <label className="block text-[9px] text-gray-500 mb-0.5">{t('lobby.editor.interaction_text')}</label>
                  <input type="text" value={buildMeta.interactionText || ''}
                    onChange={e => updateMeta('interactionText', e.target.value)}
                    placeholder={t('lobby.editor.interaction_placeholder') || 'Enter...'}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-[10px] text-white outline-none" />
                </div>

                {/* Mission gate: portal only appears while the player is on a selected
                    mission. No scene filter — a return portal gates on a mission from
                    another map (e.g. pet_shop → back to amy_house during "help Amy"). */}
                <div className="mb-2">
                  <label className="block text-[9px] text-gray-500 mb-0.5">{t('lobby.editor.portal_mission_gate')}</label>
                  <div className="max-h-32 overflow-y-auto bg-gray-800 border border-gray-700 rounded p-2 custom-scrollbar">
                    {availableMissions.length === 0 && (
                      <p className="text-[10px] text-gray-500 italic">{t('lobby.editor.no_missions_found') || 'No missions found'}</p>
                    )}
                    {availableMissions.map(m => {
                      const ids = (buildMeta.missionIds || []).map(String);
                      const checked = ids.includes(String(m.id));
                      return (
                        <label key={m.id} className="flex items-center gap-2 py-1 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={e => {
                              const next = (buildMeta.missionIds || []).map(String).filter(x => x !== String(m.id));
                              if (e.target.checked) next.push(String(m.id));
                              updateMeta('missionIds', next);
                            }}
                            className="w-3 h-3 accent-yellow-500"
                          />
                          <span className="text-[10px] text-gray-300 group-hover:text-white truncate">
                            {m.title} <span className="text-gray-500">({m.scene_key})</span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  <p className="text-[9px] text-gray-500 italic mt-0.5">{t('lobby.editor.portal_mission_gate_hint')}</p>
                </div>

                {/* Spawn coords (Skip for route) */}
                {(buildMeta.portalType !== 'route') && (
                  <div className="grid grid-cols-2 gap-1.5 mb-2">
                    <div>
                      <label className="block text-[9px] text-gray-500 mb-0.5">{t('lobby.editor.spawn_x')}</label>
                      <input type="number" value={buildMeta.targetX} onChange={e => updateMeta('targetX', e.target.value)}
                        placeholder="1000"
                        className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-[10px] text-white outline-none" />
                    </div>
                    <div>
                      <label className="block text-[9px] text-gray-500 mb-0.5">{t('lobby.editor.spawn_y')}</label>
                      <input type="number" value={buildMeta.targetY} onChange={e => updateMeta('targetY', e.target.value)}
                        placeholder="750"
                        className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-[10px] text-white outline-none" />
                    </div>
                  </div>
                )}

                <button onClick={() => dispatchEditorCommand('applyBuildMetadata')}
                  className="w-full py-1 bg-yellow-900/40 border border-yellow-700/50 rounded text-[9px] text-yellow-200 hover:bg-yellow-900/60 transition-colors">
                  {t('lobby.editor.apply_to_all')}
                </button>
              </Section>
            )}

            {/* NPC Settings */}
            {activeTile === 'npc' && (
              <Section title={t('lobby.editor.npc_config')} defaultOpen={true}>
                <div className="mb-2">
                  <label className="block text-[9px] text-gray-500 mb-0.5">{t('lobby.editor.character_def')}</label>
                  <select value={npcMeta.definitionId} onChange={e => updateNpcMeta('definitionId', e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-[10px] text-white outline-none">
                    <option value="">{t('lobby.editor.none')}...</option>
                    {npcDefinitions.map(d => (
                      <option key={d.id} value={d.id}>{d.name} (ID: {d.id})</option>
                    ))}
                  </select>
                </div>

                <div className="mb-2">
                  <label className="block text-[9px] text-gray-500 mb-0.5">{t('lobby.editor.initial_state') || 'Initial State'}</label>
                  <select value={npcMeta.state || 'idle'} onChange={e => updateNpcMeta('state', e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-[10px] text-white outline-none">
                    <option value="idle">Idle / Waiting (Row 1)</option>
                    <option value="talking">Talking (Row 2)</option>
                    <option value="happy">Happy / Grateful (Row 3)</option>
                    <option value="sad">Sad (Row 4)</option>
                    <option value="walking">Walking (Row 5)</option>
                    <option value="dying">Dying (Row 6)</option>
                  </select>
                </div>

                <div className="mb-2">
                  <label className="block text-[9px] text-gray-500 mb-0.5">{t('lobby.editor.facing') || 'Facing / Dirección'}</label>
                  <select value={npcMeta.facing || 'right'} onChange={e => updateNpcMeta('facing', e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-[10px] text-white outline-none">
                    <option value="right">➡️ {t('lobby.editor.facing_right') || 'Derecha'}</option>
                    <option value="left">⬅️ {t('lobby.editor.facing_left') || 'Izquierda'}</option>
                  </select>
                </div>

                <div className="mb-2">
                  <label className="block text-[9px] text-gray-500 mb-0.5">Movimiento / Comportamiento</label>
                  <select value={npcMeta.movementType || 'static'} onChange={e => updateNpcMeta('movementType', e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-[10px] text-white outline-none">
                    <option value="static">Estático (Static)</option>
                    <option value="wander">Vagar Aleatorio (Wander)</option>
                    <option value="follow">Acompañar (Follow Player)</option>
                    <option value="lead_player">Guiar Jugador (Lead Player)</option>
                  </select>
                </div>

                {npcMeta.movementType === 'lead_player' && (
                  <div className="mb-2 p-2 bg-gray-900/40 border border-gray-750 rounded">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[9px] text-gray-400">Puntos de Ruta ({npcMeta.waypoints?.length || 0})</span>
                      {npcMeta.waypoints?.length > 0 && (
                        <button onClick={() => updateNpcMeta('waypoints', [])} className="text-[8px] text-red-400 hover:underline">
                          Borrar Todo
                        </button>
                      )}
                    </div>

                    {/* Lista editable de waypoints */}
                    {(npcMeta.waypoints || []).length > 0 && (
                      <div className="mb-2 space-y-1 max-h-40 overflow-y-auto custom-scrollbar">
                        {(npcMeta.waypoints || []).map((wp, idx) => (
                          <div key={idx} className="flex items-center gap-1 bg-gray-800/70 rounded px-1 py-0.5">
                            <span className="text-[8px] text-indigo-400 shrink-0 w-10">Pt {idx + 1}</span>
                            <input
                              type="text"
                              placeholder={`Mensaje (opcional)`}
                              value={wp.message || ''}
                              onChange={e => {
                                const wps = [...(npcMeta.waypoints || [])];
                                wps[idx] = { ...wps[idx], message: e.target.value };
                                updateNpcMeta('waypoints', wps);
                              }}
                              className="flex-1 bg-gray-700 border border-gray-600 rounded px-1 py-0.5 text-[9px] text-white outline-none placeholder-gray-500"
                            />
                            <button
                              onClick={() => {
                                const wps = (npcMeta.waypoints || []).filter((_, i) => i !== idx);
                                updateNpcMeta('waypoints', wps);
                              }}
                              className="text-[9px] text-red-400 hover:text-red-300 shrink-0 px-0.5"
                              title="Eliminar punto"
                            >✕</button>
                          </div>
                        ))}
                      </div>
                    )}

                    <button
                      onClick={() => {
                        const nextVal = !editingNpcRoute;
                        setEditingNpcRoute(nextVal);
                        dispatchEditorCommand('setEditingNpcRouteMode', nextVal);
                      }}
                      className={`w-full py-1 text-[10px] font-bold rounded transition ${
                        editingNpcRoute ? 'bg-red-600 text-white animate-pulse' : 'bg-indigo-650 hover:bg-indigo-600 text-white'
                      }`}
                    >
                      {editingNpcRoute ? '🔴 Detener Marcado' : '📍 Marcar Puntos'}
                    </button>
                  </div>
                )}

                {/* Associated Missions */}

                <div className="mb-2">
                  <label className="block text-[9px] text-gray-500 mb-0.5">{t('lobby.editor.associated_mission')}</label>
                  <div className="max-h-40 overflow-y-auto bg-gray-800 border border-gray-700 rounded p-2 custom-scrollbar">
                    {availableMissions.length === 0 && (
                      <p className="text-[10px] text-gray-500 italic">{t('lobby.editor.no_missions_found') || 'No missions found'}</p>
                    )}
                    {availableMissions
                      .filter(m => m.scene_key === currentSettings.sceneKey || !currentSettings.sceneKey) // Filter by map
                      .map(m => (
                      <label key={m.id} className="flex items-center gap-2 py-1 cursor-pointer group">
                        <input 
                          type="checkbox" 
                          checked={(npcMeta.missionIds || []).includes(String(m.id)) || (npcMeta.missionIds || []).includes(Number(m.id))}
                          onChange={e => {
                            const ids = [...(npcMeta.missionIds || [])];
                            if (e.target.checked) {
                              ids.push(String(m.id));
                            } else {
                              const idx = ids.indexOf(String(m.id));
                              if (idx > -1) ids.splice(idx, 1);
                              // also check for numeric match
                              const idxNum = ids.indexOf(Number(m.id));
                              if (idxNum > -1) ids.splice(idxNum, 1);
                            }
                            updateNpcMeta('missionIds', ids);
                          }}
                          className="w-3 h-3 accent-yellow-500"
                        />
                        <span className="text-[10px] text-gray-300 group-hover:text-white truncate">{m.title}</span>
                      </label>
                    ))}
                    {availableMissions.filter(m => m.scene_key === currentSettings.sceneKey).length === 0 && (
                      <p className="text-[10px] text-gray-500 italic p-2">
                        {t('lobby.editor.no_missions_for_scene') || 'No hay misiones para este mapa.'}
                      </p>
                    )}
                  </div>
                </div>
                
                <p className="text-[8px] text-gray-400 italic mt-2">
                  {t('lobby.editor.npc_placement_hint')}
                </p>
              </Section>
            )}

            {/* Item Settings */}
            {activeTile === 'item' && (
              <Section title={t('lobby.editor.item_config')} defaultOpen={true}>
                <div className="mb-2">
                  <label className="block text-[9px] text-gray-500 mb-0.5">{t('lobby.editor.select_item')}</label>
                  <select 
                    value={pickupMeta.itemId} 
                    onChange={e => setPickupMeta(p => ({ ...p, itemId: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-[10px] text-white outline-none"
                  >
                    <option value="">{t('lobby.editor.none')}...</option>
                    {availableItems.map(item => (
                      <option key={item.id} value={item.id}>
                        {item.name} ({item.logic_type})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mb-2">
                  <label className="block text-[9px] text-gray-500 mb-0.5">{t('lobby.editor.quantity')}</label>
                  <input 
                    type="number" 
                    min="1" 
                    value={pickupMeta.quantity} 
                    onChange={e => setPickupMeta(p => ({ ...p, quantity: parseInt(e.target.value) || 1 }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-[10px] text-white outline-none"
                  />
                </div>

                <p className="text-[8px] text-gray-400 italic mt-2">
                  {t('lobby.editor.item_placement_hint')}
                </p>
              </Section>
            )}

            {/* Furniture Settings */}
            {(activeTile === 'furniture' || activeTile === 'furniture2' || activeTile === 'furniture3') && (
              <Section title="Configuración de Interactivos" defaultOpen={true}>
                <div className="mb-2">
                  <label className="block text-[9px] text-gray-500 mb-0.5">Tipo de Interactividad</label>
                  <select
                    value={furnitureMeta.minigameType || ''}
                    onChange={e => {
                      const val = e.target.value;
                      setFurnitureMeta(prev => {
                        const generatedId = val && val !== 'read' ? `minigame_${val}_${Date.now()}` : '';
                        return { 
                          ...prev,
                          minigameType: val, 
                          minigameId: val === 'read' ? '' : (prev.minigameId || generatedId)
                        };
                      });
                    }}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-[10px] text-white outline-none"
                  >
                    <option value="">Ninguno / Decorativo</option>
                    <option value="chess">Ajedrez (Tablero por Voz/Teclado)</option>
                    <option value="park">Zona Social (Parque/Voz)</option>
                    <option value="read">Letrero / Texto de Lectura</option>
                  </select>
                </div>

                {furnitureMeta.minigameType === 'read' ? (
                  <InfoSignEditor
                    value={furnitureMeta.readText}
                    onChange={(v) => setFurnitureMeta(prev => ({ ...prev, readText: v }))}
                  />
                ) : (
                  <div className="mb-2">
                    <label className="block text-[9px] text-gray-500 mb-0.5">ID de la Sala</label>
                    <input
                      type="text"
                      value={furnitureMeta.minigameId || ''}
                      onChange={e => setFurnitureMeta(prev => ({ ...prev, minigameId: e.target.value }))}
                      placeholder="Generado automáticamente..."
                      className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-[10px] text-white outline-none"
                    />
                  </div>
                )}

                <p className="text-[8px] text-gray-400 italic mt-2">
                  Haz clic en el mapa para colocar el mueble configurado. Los jugadores podrán interactuar con él presionando E.
                </p>
              </Section>
            )}


            {/* Stats */}
            <Section title={`${t('lobby.editor.stats')} · ${total} tiles`} defaultOpen={false}>
              <div className="grid grid-cols-2 gap-1">
                {TILE_TYPES.map(t_obj => {
                  const key = TILE_TYPE_TO_STAT[t_obj.id] || `${t_obj.id}s`;
                  const cnt = stats[t_obj.id === 'npc' ? 'npcZones' : (t_obj.id === 'item' ? 'pickups' : (t_obj.id === 'enemy' ? 'enemySpawns' : (t_obj.id === 'furniture' ? 'furniture' : (t_obj.id === 'furniture2' ? 'furniture2' : (t_obj.id === 'furniture3' ? 'furniture3' : `${t_obj.id}s`)))))] || 0;
                  return (
                    <div key={t_obj.id} className="flex items-center gap-1.5 text-[9px] text-gray-400">
                      <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: t_obj.color }} />
                      {t_obj.label}: <span className="text-white font-mono">{cnt}</span>
                    </div>
                  );
                })}
                <div className="text-[9px] text-gray-500 col-span-2 pt-1 border-t border-gray-800 mt-1">
                  {t('lobby.editor.history')}: {stats.historySize || 0} &nbsp;|&nbsp; {t('lobby.editor.redo')}: {stats.redoSize || 0}
                </div>
              </div>
            </Section>
          </div>

          {/* Bottom action bar */}
          <div className="flex-shrink-0 border-t border-gray-700 p-2 flex flex-col gap-1.5">
            {/* Undo / Redo / Clear */}
            <div className="flex gap-1">
              <button onClick={() => dispatchEditorCommand('undo')} disabled={!stats.historySize} title={`${t('lobby.editor.undo')} (Ctrl+Z)`}
                className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-gray-800 border border-gray-700 rounded text-gray-400 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                <Undo2 size={13} /><span className="text-[9px]">{t('lobby.editor.undo')}</span>
              </button>
              <button onClick={() => dispatchEditorCommand('redo')} disabled={!stats.redoSize} title={`${t('lobby.editor.redo')} (Ctrl+Y)`}
                className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-gray-800 border border-gray-700 rounded text-gray-400 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                <Redo2 size={13} /><span className="text-[9px]">{t('lobby.editor.redo')}</span>
              </button>
              <button onClick={() => { if (confirm(t('lobby.editor.clear_confirm'))) dispatchEditorCommand('clearAll'); }} title={t('lobby.editor.clear_all')}
                className="px-2 py-1.5 bg-red-900/50 border border-red-800/60 rounded text-red-400 hover:bg-red-800/60 transition-all">
                <Trash2 size={13} />
              </button>
            </div>

            {/* Save / Export */}
            <div className="flex gap-1">
              <button onClick={saveToServer} disabled={saving}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded text-[11px] font-semibold transition-all
                  ${saving ? 'bg-gray-700 text-gray-400 cursor-wait' : 'bg-green-700 hover:bg-green-600 text-white'}`}>
                <Save size={13} />
                {saving ? t('lobby.editor.saving') : t('lobby.editor.save')}
              </button>
              <button onClick={exportMap} title={t('lobby.editor.download') || 'Descargar JSON'}
                className="px-3 py-2 bg-blue-700 hover:bg-blue-600 text-white rounded text-[11px] font-semibold flex items-center justify-center transition-all">
                <Download size={13} />
              </button>
              <button onClick={handleImportClick} title={t('lobby.editor.upload') || 'Subir JSON'}
                className="px-3 py-2 bg-purple-700 hover:bg-purple-600 text-white rounded text-[11px] font-semibold flex items-center justify-center transition-all">
                <Upload size={13} />
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                accept=".json" 
                className="hidden" 
              />
            </div>
          </div>
        </div >
      )}

      {/* Export popup */}
      {
        exportedData && (
          <div className="absolute bottom-4 right-60 z-50 bg-gray-900 border border-gray-700 p-4 rounded-xl shadow-2xl w-80 pointer-events-auto">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-white font-bold text-sm">Exportar JSON</h3>
              <button onClick={() => setExportedData(null)} className="text-gray-400 hover:text-white"><X size={16} /></button>
            </div>
            <textarea readOnly value={exportedData}
              className="w-full h-44 bg-gray-800 text-xs text-green-400 font-mono p-2 rounded border border-gray-700 resize-none" />
            <p className="text-[10px] text-gray-500 mt-1">📋 Copiado al portapapeles.</p>
          </div>
        )
      }
    </>
  );
};
