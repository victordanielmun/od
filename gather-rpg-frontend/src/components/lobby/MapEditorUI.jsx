import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Hammer, Save, Download, Upload, X, Undo2, Redo2, Trash2,
  Paintbrush, Eraser, Square, ChevronDown, ChevronUp,
  Camera, User, MapPin, Pipette,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import api from '../../services/api';

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
    fetch(jsonPath).then(r => r.json())
      .then(d => setSprites(d.frames.filter(f => f.sourceSize.w > 10 && f.sourceSize.h > 10)))
      .catch(() => { });
  }, [jsonPath]);
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
              backgroundImage: `url(${imgPath})`,
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
export const MapEditorUI = ({ gameRef }) => {
  const { t } = useTranslation();
  const isAdmin = useAuthStore(s => s.isAdmin());
  const adminCheck = isAdmin;

  const [isEditorActive, setIsEditorActive] = useState(false);
  const [moveMode, setMoveMode] = useState('camera'); // 'camera' | 'character'
  const [activeTool, setActiveTool] = useState('brush');
  const [activeTile, setActiveTile] = useState('wall');
  const [activeTexture, setActiveTexture] = useState('sprite1');
  const [buildMeta, setBuildMeta] = useState({ portalType: 'map', targetMap: '', targetX: '', targetY: '', targetRoute: '', interactionText: '' });
  const [npcMeta, setNpcMeta] = useState({ definitionId: '', missionIds: [] });
  const [buildScale, setBuildScale] = useState(2);
  const [availableMaps, setAvailableMaps] = useState([]);
  const [npcDefinitions, setNpcDefinitions] = useState([]);
  const [availableMissions, setAvailableMissions] = useState([]);
  const [availableItems, setAvailableItems] = useState([]);
  const [pickupMeta, setPickupMeta] = useState({ itemId: '', quantity: 1 });
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null); // 'success'|'error'|null
  const [exportedData, setExportedData] = useState(null);
  const [stats, setStats] = useState({ 
    walls: 0, floors: 0, forest: 0, builds: 0, spawns: 0, 
    npcZones: 0, pickups: 0, storeTiles: 0, furniture: 0,
    historySize: 0, redoSize: 0 
  });

  // Current map settings (width, height, public, etc.)
  const [currentSettings, setCurrentSettings] = useState({
    width: 800, height: 800, isPublic: false, maxUsers: 50,
    defaultSpawnX: 1000, defaultSpawnY: 750
  });

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
    { id: 'spawn', label: t('lobby.editor.tile_spawn'), color: TILE_COLORS.spawn },
    { id: 'npc', label: t('lobby.editor.tile_npc'), color: TILE_COLORS.npc },
    { id: 'item', label: t('lobby.editor.tile_item'), color: TILE_COLORS.item },
    { id: 'void', label: t('lobby.editor.tile_void'), color: TILE_COLORS.void },
    { id: 'collider', label: t('lobby.editor.tile_collider') || 'Collider', color: TILE_COLORS.collider },
    { id: 'store', label: t('lobby.editor.tile_store') || 'Store Tiles', color: TILE_COLORS.store },
    { id: 'furniture', label: t('lobby.editor.tile_furniture') || 'Furniture', color: TILE_COLORS.furniture },
  ], [t]);

  useEffect(() => {
    const onStats = e => setStats(e.detail);
    const onPicked = e => {
      const { type, frame, scale, metadata } = e.detail;
      console.log('[MapEditorUI] Object picked from scene:', e.detail);
      
      setActiveTile(type);
      setActiveTexture(frame);
      setBuildScale(scale);

      if (type === 'build') {
        setBuildMeta({
          portalType: metadata.portalType || 'map',
          targetMap: metadata.targetMap || '',
          targetX: metadata.targetX || '',
          targetY: metadata.targetY || '',
          targetRoute: metadata.targetRoute || '',
          interactionText: metadata.interactionText || ''
        });
      } else if (type === 'npc') {
        setNpcMeta({
          definitionId: metadata.definitionId || '',
          missionIds: Array.isArray(metadata.missionIds) ? metadata.missionIds : (metadata.missionId ? [metadata.missionId] : [])
        });
      } else if (type === 'item') {
        setPickupMeta({
          itemId: metadata.itemId || '',
          quantity: metadata.quantity || 1
        });
      }

      // Switch to brush tool automatically after picking for convenience
      setActiveTool('brush');
      dispatchEditorCommand('setTool', 'brush');
    };

    window.addEventListener('editor-stats', onStats);
    window.addEventListener('editor-picked-object', onPicked);
    return () => {
      window.removeEventListener('editor-stats', onStats);
      window.removeEventListener('editor-picked-object', onPicked);
    };
  }, []);

  // Sync moveMode when the Phaser scene changes it (e.g. on editor open/close)
  useEffect(() => {
    const onModeChange = e => setMoveMode(e.detail?.mode ?? 'camera');
    window.addEventListener('editor-move-mode-changed', onModeChange);
    return () => window.removeEventListener('editor-move-mode-changed', onModeChange);
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
    }
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
    } else {
      // New map defaults? Or maybe read from current scene if already loaded
      const sc = getScene();
      if (sc) {
        setCurrentSettings(prev => ({
          ...prev,
          width: sc.mapWidth || 800,
          height: sc.mapHeight || 800,
          bgmTrack: sc.bgmTrack || 'none'
        }));
      }
    }
  }, [availableMaps, isEditorActive]);

  // Sync currentSettings back to Phaser scene whenever they change
  useEffect(() => {
    if (!isEditorActive) return;
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
      if (activeTile === 'build') {
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

  // Auto-open if URL has ?edit_map
  useEffect(() => {
    if (!isAdmin) return;
    if (!new URLSearchParams(window.location.search).get('edit_map')) return;
    let n = 0;
    const tryOpen = () => {
      const scene = gameRef.current?.scene?.getScene('LobbyScene') || gameRef.current?.scene?.scenes?.[0];
      if (scene) {
        setIsEditorActive(true);
        scene.toggleEditorMode(true);
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
        sc.toggleEditorMode(next);
        window.dispatchEvent(new CustomEvent('editor-mode-changed', { detail: { active: next } }));
      } else if (n < 10) setTimeout(() => tryToggle(n + 1), 500);
    };
    tryToggle();
  };

  const selectTool = id => { setActiveTool(id); dispatchEditorCommand('setTool', id); };
  const selectTile = id => { setActiveTile(id); dispatchEditorCommand('setTileType', id); };
  const selectTexture = id => { setActiveTexture(id); dispatchEditorCommand('setTexture', id); };
  const updateMeta = (k, v) => { const m = { ...buildMeta, [k]: v }; setBuildMeta(m); dispatchEditorCommand('setBuildMetadata', m); };
  const updateScale = v => { const s = parseFloat(v); setBuildScale(s); dispatchEditorCommand('setBuildScale', s); };
  const updateNpcMeta = (k, v) => { 
    setNpcMeta(prev => ({ ...prev, [k]: v })); 
  };
  useEffect(() => {
    dispatchEditorCommand('setNPCMetadata', npcMeta);
  }, [npcMeta]);

  useEffect(() => {
    dispatchEditorCommand('setPickupMetadata', pickupMeta);
  }, [pickupMeta]);
  const selectMoveMode = (mode) => { setMoveMode(mode); dispatchEditorCommand('setMoveMode', mode); };

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
    const mapData = JSON.stringify({
      width: currentSettings.width,
      height: currentSettings.height,
      defaultSpawnX: currentSettings.defaultSpawnX,
      defaultSpawnY: currentSettings.defaultSpawnY,
      bgmTrack: currentSettings.bgmTrack
    });

    const payload = {
      scene_key: sceneKey,
      walls_json: wallsJson,
      map_data: mapData,
      is_public: currentSettings.isPublic,
      max_users: currentSettings.maxUsers,
    };

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
        console.error('[MapEditor] Save failed:', err);
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

  const total = (stats.walls || 0) + (stats.floors || 0) + (stats.forest || 0) + (stats.builds || 0) + (stats.spawns || 0) + (stats.npcZones || 0) + (stats.pickups || 0) + (stats.storeTiles || 0) + (stats.furniture || 0);

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
                        onChange={e => setCurrentSettings(p => ({ ...p, defaultSpawnX: Number(e.target.value) }))}
                        placeholder="1000"
                        className="w-full bg-gray-800 border border-green-800/60 rounded px-2 py-1 text-[10px] text-green-300 outline-none" />
                    </div>
                    <div className="flex-1">
                      <label className="text-[9px] text-gray-500 block mb-0.5">{t('lobby.editor.spawn_y')}</label>
                      <input type="number" value={currentSettings.defaultSpawnY}
                        onChange={e => setCurrentSettings(p => ({ ...p, defaultSpawnY: Number(e.target.value) }))}
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
              <div className="flex gap-1.5">
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
              <p className="text-[8px] text-gray-600 mt-1.5 leading-tight">
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
                        ${on ? 'bg-gray-700 border-gray-400 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'}`}>
                      <span className="w-2 h-2 rounded-sm flex-shrink-0 border border-black/20" style={{ backgroundColor: tile.color }} />
                      {tile.label}
                    </button>
                  );
                })}
              </div>
            </Section>

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
              {!['floor', 'forest', 'build', 'wall', 'store', 'furniture'].includes(activeTile) && (
                <p className="text-[10px] text-gray-600 italic">{t('lobby.editor.no_texture_options')}</p>
              )}
            </Section>

            {/* Build portal settings */}
            {activeTile === 'build' && (
              <Section title={t('lobby.editor.portal_config')} defaultOpen={true}>
                {/* Scale */}
                <div className="mb-2">
                  <div className="flex justify-between mb-0.5">
                    <span className="text-[9px] text-gray-500">{t('lobby.editor.scale')}</span>
                    <span className="text-[9px] text-yellow-400 font-mono">{buildScale.toFixed(2)}×</span>
                  </div>
                  <input type="range" min="1" max="2.5" step="0.05" value={buildScale}
                    onChange={e => updateScale(e.target.value)}
                    className="w-full accent-yellow-400" />
                  <div className="flex justify-between text-[8px] text-gray-700 mt-0.5">
                    <span>1×</span><span>2.5×</span>
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
                      <option key={d.id} value={d.id}>{d.name} ({d.character_id})</option>
                    ))}
                  </select>
                </div>

                {/* Associated Missions */}

                <div className="mb-2">
                  <label className="block text-[9px] text-gray-500 mb-0.5">{t('lobby.editor.associated_mission')}</label>
                  <div className="max-h-40 overflow-y-auto bg-gray-800 border border-gray-700 rounded p-2 custom-scrollbar">
                    {availableMissions.length === 0 && (
                      <p className="text-[10px] text-gray-500 italic">{t('lobby.editor.no_missions_found') || 'No missions found'}</p>
                    )}
                    {availableMissions.map(m => (
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


            {/* Stats */}
            <Section title={`${t('lobby.editor.stats')} · ${total} tiles`} defaultOpen={false}>
              <div className="grid grid-cols-2 gap-1">
                {TILE_TYPES.map(t_obj => {
                  const key = TILE_TYPE_TO_STAT[t_obj.id] || `${t_obj.id}s`;
                  const cnt = stats[t_obj.id === 'npc' ? 'npcZones' : (t_obj.id === 'item' ? 'pickups' : `${t_obj.id}s`)] || 0;
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
