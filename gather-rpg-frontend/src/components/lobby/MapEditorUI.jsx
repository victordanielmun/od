import React, { useState, useEffect, useRef } from 'react';
import {
  Hammer, Save, Download, X, Undo2, Redo2, Trash2,
  Paintbrush, Eraser, Square, ChevronDown, ChevronUp,
  Camera, User, MapPin,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import api from '../../services/api';

const TOOLS = [
  { id: 'brush', label: 'Pincel', icon: Paintbrush, shortcut: 'B' },
  { id: 'eraser', label: 'Borrar', icon: Eraser, shortcut: 'E' },
  { id: 'rect', label: 'Rect', icon: Square, shortcut: 'R' },
  { id: 'marker', label: 'Marcador', icon: MapPin, shortcut: 'M' },
];

const TILE_TYPES = [
  { id: 'wall', label: 'Muro', color: '#666666' },
  { id: 'floor', label: 'Suelo', color: '#8B7355' },
  { id: 'forest', label: 'Bosque', color: '#228B22' },
  { id: 'build', label: 'Edif.', color: '#CD853F' },
  { id: 'spawn', label: 'Spawn', color: '#00CC66' },
  { id: 'npc', label: 'NPC', color: '#4488FF' },
  { id: 'void', label: 'Vacio', color: '#111111' },
];

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
  const isAdmin = useAuthStore(s => s.isAdmin());
  const adminCheck = isAdmin;

  const [isEditorActive, setIsEditorActive] = useState(false);
  const [moveMode, setMoveMode] = useState('camera'); // 'camera' | 'character'
  const [activeTool, setActiveTool] = useState('brush');
  const [activeTile, setActiveTile] = useState('wall');
  const [activeTexture, setActiveTexture] = useState('sprite1');
  const [buildMeta, setBuildMeta] = useState({ portalType: 'map', targetMap: '', targetX: '', targetY: '', targetRoute: '', interactionText: '' });
  const [buildScale, setBuildScale] = useState(2);
  const [availableMaps, setAvailableMaps] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null); // 'success'|'error'|null
  const [exportedData, setExportedData] = useState(null);
  const [stats, setStats] = useState({ walls: 0, floors: 0, forest: 0, builds: 0, spawns: 0, npcZones: 0, historySize: 0, redoSize: 0 });

  // Current map settings (width, height, public, etc.)
  const [currentSettings, setCurrentSettings] = useState({
    width: 800, height: 800, isPublic: false, maxUsers: 50,
    defaultSpawnX: 1000, defaultSpawnY: 750
  });

  useEffect(() => {
    const onStats = e => setStats(e.detail);
    window.addEventListener('editor-stats', onStats);
    return () => window.removeEventListener('editor-stats', onStats);
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

  useEffect(() => {
    if (!isEditorActive) return;
    const h = e => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      if (e.key === 'b' || e.key === 'B') { selectTool('brush'); return; }
      if (e.key === 'e' || e.key === 'E') { selectTool('eraser'); return; }
      if (e.key === 'r' || e.key === 'R') { selectTool('rect'); return; }
      if (e.key === 'm' || e.key === 'M') { selectTool('marker'); return; }
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
  const selectMoveMode = (mode) => { setMoveMode(mode); dispatchEditorCommand('setMoveMode', mode); };

  const getMapKey = () => {
    const sc = getScene();
    if (sc && sc.currentMapKey) return sc.currentMapKey;
    return new URLSearchParams(window.location.search).get('edit_map') || 'lobby';
  };
  const currentMapKey = getMapKey();

  const saveToServer = () => {
    const sc = getScene(); if (!sc) return;
    const sceneKey = getMapKey();
    setSaving(true); setSaveStatus(null);

    setCurrentSettings(prev => {
      const wallsJson = sc.exportMapConfig();
      const mapData = JSON.stringify({
        width: prev.width,
        height: prev.height,
        defaultSpawnX: prev.defaultSpawnX,
        defaultSpawnY: prev.defaultSpawnY,
        bgmTrack: prev.bgmTrack
      });
      const payload = {
        scene_key: sceneKey,
        walls_json: wallsJson,
        map_data: mapData,
        is_public: prev.isPublic,
        max_users: prev.maxUsers,
      };

      // Use PUT when map already exists (send settings + walls together in one call)
      // This avoids the race condition where POST saves walls but settings come from a different request
      const existingMap = availableMaps.find(m => m.scene_key === sceneKey);
      const request = existingMap
        ? api.put(`/admin/maps/${existingMap.id}`, payload)
        : api.post('/admin/maps', payload);

      request
        .then(() => {
          setSaveStatus('success');
          if (isEditorActive) api.get('/admin/maps').then(r => setAvailableMaps(r.data));
        })
        .catch(() => setSaveStatus('error'))
        .finally(() => {
          setSaving(false);
          setTimeout(() => setSaveStatus(null), 3000);
        });

      return prev; // no state mutation
    });
  };

  const exportMap = () => {
    const sc = getScene(); if (!sc) return;
    const data = sc.exportMapConfig();
    setExportedData(data);
    navigator.clipboard.writeText(data).catch(() => { });
  };

  const total = (stats.walls || 0) + (stats.floors || 0) + (stats.forest || 0) + (stats.builds || 0) + (stats.spawns || 0) + (stats.npcZones || 0);

  /* ─── render ─── */
  return (
    <>
      {/* Toggle button */}
      <div className="absolute top-4 right-4 z-50 pointer-events-auto flex flex-col items-end gap-2">
        <button
          onClick={toggleEditor}
          title="Editor de Mapa (Admin)"
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
            {saveStatus === 'success' ? '✅ Guardado' : '❌ Error al guardar'}
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
              <span className="text-xs font-bold text-white tracking-wide">Map Editor</span>
            </div>
            <button onClick={toggleEditor} className="text-gray-500 hover:text-white transition-colors">
              <X size={14} />
            </button>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto"
            style={{ scrollbarWidth: 'thin', scrollbarColor: '#374151 transparent' }}>

            {/* Map Settings — single unified panel, no duplicate */}
            <Section title="Configuración del Mapa" defaultOpen={true}>
              <div className="flex flex-col gap-2">
                <div className="flex gap-1">
                  <div className="flex-1">
                    <label className="text-[9px] text-gray-500 block mb-0.5">Ancho</label>
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
                    <label className="text-[9px] text-gray-500 block mb-0.5">Alto</label>
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

                {/* Default Spawn for this map */}
                <div className="border-t border-gray-700/60 pt-1.5">
                  <div className="text-[9px] text-green-400 font-semibold mb-1">Spawn Predeterminado del Mapa</div>
                  <div className="flex gap-1">
                    <div className="flex-1">
                      <label className="text-[9px] text-gray-500 block mb-0.5">Spawn X</label>
                      <input type="number" value={currentSettings.defaultSpawnX}
                        onChange={e => setCurrentSettings(p => ({ ...p, defaultSpawnX: Number(e.target.value) }))}
                        placeholder="1000"
                        className="w-full bg-gray-800 border border-green-800/60 rounded px-2 py-1 text-[10px] text-green-300 outline-none" />
                    </div>
                    <div className="flex-1">
                      <label className="text-[9px] text-gray-500 block mb-0.5">Spawn Y</label>
                      <input type="number" value={currentSettings.defaultSpawnY}
                        onChange={e => setCurrentSettings(p => ({ ...p, defaultSpawnY: Number(e.target.value) }))}
                        placeholder="750"
                        className="w-full bg-gray-800 border border-green-800/60 rounded px-2 py-1 text-[10px] text-green-300 outline-none" />
                    </div>
                  </div>
                  <p className="text-[8px] text-gray-600 mt-1 leading-tight">Usado cuando no hay spawn de portal específico.</p>
                </div>

                {/* Background Music Selector */}
                <div className="border-t border-gray-700/60 pt-1.5">
                  <label className="text-[9px] text-blue-400 font-semibold block mb-1">Música de Fondo (BGM)</label>
                  <select
                    value={currentSettings.bgmTrack || 'none'}
                    onChange={e => setCurrentSettings(p => ({ ...p, bgmTrack: e.target.value }))}
                    className="w-full bg-gray-800 border border-blue-800/60 rounded px-2 py-1 text-[10px] text-blue-300 outline-none"
                  >
                    <option value="none">Sin Música</option>
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
                    <span className="text-[10px] text-gray-300">Público</span>
                  </label>
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] text-gray-500">Max:</span>
                    <input type="number" value={currentSettings.maxUsers}
                      onChange={e => setCurrentSettings(p => ({ ...p, maxUsers: Number(e.target.value) }))}
                      className="w-10 bg-gray-800 border border-gray-700 rounded px-1 text-[10px] text-white text-right outline-none" />
                  </div>
                </div>
                <p className="text-[8px] text-gray-600 leading-tight">
                  Pulsa <span className="text-yellow-500 font-semibold">Guardar</span> para aplicar todos los cambios.
                </p>
              </div>
            </Section>

            {/* Move Mode toggle */}
            <Section title="Modo Movimiento">
              <div className="flex gap-1.5">
                <button
                  onClick={() => selectMoveMode('camera')}
                  title="Cámara libre — WASD desplaza el mapa"
                  className={`flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded border text-[9px] transition-all
                    ${moveMode === 'camera'
                      ? 'bg-yellow-500/20 border-yellow-500/60 text-yellow-400'
                      : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'}`}
                >
                  <Camera size={13} />
                  <span>Cámara</span>
                </button>
                <button
                  onClick={() => selectMoveMode('character')}
                  title="Personaje — WASD mueve al personaje"
                  className={`flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded border text-[9px] transition-all
                    ${moveMode === 'character'
                      ? 'bg-blue-500/20 border-blue-500/60 text-blue-400'
                      : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'}`}
                >
                  <User size={13} />
                  <span>Personaje</span>
                </button>
              </div>
              <p className="text-[8px] text-gray-600 mt-1.5 leading-tight">
                {moveMode === 'camera'
                  ? '🎥 WASD desplaza la cámara libremente'
                  : '🧍 WASD mueve tu personaje (cámara sigue)'}
              </p>
            </Section>

            {/* Tools */}
            <Section title="Herramientas">
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
            <Section title="Tipo de tile">
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
            <Section title="Textura">
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
              {!['floor', 'forest', 'build', 'wall'].includes(activeTile) && (
                <p className="text-[10px] text-gray-600 italic">Sin opciones de textura</p>
              )}
            </Section>

            {/* Build portal settings */}
            {activeTile === 'build' && (
              <Section title="Config. Portal" defaultOpen={true}>
                {/* Scale */}
                <div className="mb-2">
                  <div className="flex justify-between mb-0.5">
                    <span className="text-[9px] text-gray-500">Escala</span>
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
                  <label className="block text-[9px] text-gray-500 mb-0.5">Tipo de Portal</label>
                  <select value={buildMeta.portalType} onChange={e => updateMeta('portalType', e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-[10px] text-white outline-none">
                    <option value="map">Viajar a otro Mapa</option>
                    <option value="local">Teleport Local (Mismo Mapa)</option>
                    <option value="route">Abrir Ruta Web (Popup)</option>
                  </select>
                </div>

                {/* Target map (Only if type is 'map') */}
                {(buildMeta.portalType === 'map') && (
                  <div className="mb-2">
                    <label className="block text-[9px] text-gray-500 mb-0.5">Mapa destino</label>
                    <select value={buildMeta.targetMap} onChange={e => updateMeta('targetMap', e.target.value)}
                      className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-[10px] text-white outline-none">
                      <option value="">Seleccionar...</option>
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
                    <label className="block text-[9px] text-gray-500 mb-0.5">Ruta Destino</label>
                    <input type="text" value={buildMeta.targetRoute || ''} onChange={e => updateMeta('targetRoute', e.target.value)}
                      placeholder="/learn"
                      className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-[10px] text-white outline-none" />
                  </div>
                )}

                {/* Interaction text */}
                <div className="mb-2">
                  <label className="block text-[9px] text-gray-500 mb-0.5">Texto interacción</label>
                  <input type="text" value={buildMeta.interactionText || ''}
                    onChange={e => updateMeta('interactionText', e.target.value)}
                    placeholder="Entrar al Dungeon…"
                    className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-[10px] text-white outline-none" />
                </div>

                {/* Spawn coords (Skip for route) */}
                {(buildMeta.portalType !== 'route') && (
                  <div className="grid grid-cols-2 gap-1.5 mb-2">
                    <div>
                      <label className="block text-[9px] text-gray-500 mb-0.5">Spawn X</label>
                      <input type="number" value={buildMeta.targetX} onChange={e => updateMeta('targetX', e.target.value)}
                        placeholder="1000"
                        className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-[10px] text-white outline-none" />
                    </div>
                    <div>
                      <label className="block text-[9px] text-gray-500 mb-0.5">Spawn Y</label>
                      <input type="number" value={buildMeta.targetY} onChange={e => updateMeta('targetY', e.target.value)}
                        placeholder="750"
                        className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-[10px] text-white outline-none" />
                    </div>
                  </div>
                )}

                <button onClick={() => dispatchEditorCommand('applyBuildMetadata')}
                  className="w-full py-1 bg-yellow-900/40 border border-yellow-700/50 rounded text-[9px] text-yellow-200 hover:bg-yellow-900/60 transition-colors">
                  Aplicar a todos los existentes
                </button>
              </Section>
            )}


            {/* Stats */}
            <Section title={`Stats · ${total} tiles`} defaultOpen={false}>
              <div className="grid grid-cols-2 gap-1">
                {TILE_TYPES.map(t => {
                  const key = t.id === 'npc' ? 'npcZones' : `${t.id}s`;
                  const cnt = stats[key] || 0;
                  return (
                    <div key={t.id} className="flex items-center gap-1.5 text-[9px] text-gray-400">
                      <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: t.color }} />
                      {t.label}: <span className="text-white font-mono">{cnt}</span>
                    </div>
                  );
                })}
                <div className="text-[9px] text-gray-500 col-span-2 pt-1 border-t border-gray-800 mt-1">
                  Historial: {stats.historySize || 0} &nbsp;|&nbsp; Redo: {stats.redoSize || 0}
                </div>
              </div>
            </Section>
          </div>

          {/* Bottom action bar */}
          <div className="flex-shrink-0 border-t border-gray-700 p-2 flex flex-col gap-1.5">
            {/* Undo / Redo / Clear */}
            <div className="flex gap-1">
              <button onClick={() => dispatchEditorCommand('undo')} disabled={!stats.historySize} title="Deshacer (Ctrl+Z)"
                className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-gray-800 border border-gray-700 rounded text-gray-400 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                <Undo2 size={13} /><span className="text-[9px]">Deshacer</span>
              </button>
              <button onClick={() => dispatchEditorCommand('redo')} disabled={!stats.redoSize} title="Rehacer (Ctrl+Y)"
                className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-gray-800 border border-gray-700 rounded text-gray-400 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                <Redo2 size={13} /><span className="text-[9px]">Rehacer</span>
              </button>
              <button onClick={() => { if (confirm('¿Borrar todos los tiles?')) dispatchEditorCommand('clearAll'); }} title="Limpiar todo"
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
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
              <button onClick={exportMap}
                className="px-3 py-2 bg-blue-700 hover:bg-blue-600 text-white rounded text-[11px] font-semibold flex items-center gap-1 transition-all">
                <Download size={13} />
              </button>
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
