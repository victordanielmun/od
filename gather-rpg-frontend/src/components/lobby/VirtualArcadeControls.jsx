import React, { useState, useEffect, useRef } from 'react';
import { useGameStore } from '../../store/gameStore';
import { Swords, Sword, Hand, RefreshCw, Flame, Zap, Sparkles } from 'lucide-react';

// Tareas que hacen de un mapa un mapa de combate (mismo criterio que CombatSystem).
const COMBAT_TASK_TYPES = ['defeat_enemy', 'kill_boss', 'kill_all'];

export const VirtualArcadeControls = () => {
  const currentSceneKey = useGameStore(state => state.currentSceneKey);
  const virtualControlsLayout = useGameStore(state => state.virtualControlsLayout);
  const activeMission = useGameStore(state => state.activeMission);
  const hasActiveEnemies = useGameStore(state => state.hasActiveEnemies);
  const containerRef = useRef(null);

  // Preferencias del jugador (SettingsMenu → Config): lado del D-pad, tamaño,
  // opacidad y separación del borde inferior. translateY/scale en vez de tocar
  // `bottom` para no pisar las posiciones base responsive (bottom-14/md:bottom-6).
  const { dpadSide = 'left', scale = 1, opacity = 1, offsetY = 0 } = virtualControlsLayout || {};
  const actionsSide = dpadSide === 'left' ? 'right' : 'left';
  const clusterStyle = (side) => ({
    opacity,
    transform: `translateY(-${offsetY}px) scale(${scale})`,
    transformOrigin: side === 'left' ? 'bottom left' : 'bottom right',
  });
  const sideClasses = (side) => side === 'left' ? 'left-4 md:left-6' : 'right-4 md:right-6';

  // Track button active state for visual feedback
  const [activeInputs, setActiveInputs] = useState({
    shift: false,
    up: false,
    down: false,
    left: false,
    right: false,
    potion: false,
    manaPotion: false,
    throw: false,
    interact: false,
    dash: false,
    combo: false,
    attack: false,
    spell: false
  });

  // Ref to always have the latest state inside event listeners
  const activeInputsRef = useRef(activeInputs);
  useEffect(() => {
    activeInputsRef.current = activeInputs;
  }, [activeInputs]);

  // ¿Mostrar el clúster de ataque? Adivinarlo por el NOMBRE del mapa dejaba a los
  // mapas sin 'fight/boss/combat/level' en la clave (p. ej. una misión kill_all en
  // 'bosque_oscuro') sin botones de ataque en móvil, con los enemigos encima. Lo
  // que manda es la realidad: hay enemigos vivos, o la misión de esta escena pide
  // matar. El nombre queda solo como último recurso (mapa aún sin oleada).
  const missionIsCombat = Array.isArray(activeMission?.tasks)
    && activeMission.tasks.some(t => COMBAT_TASK_TYPES.includes(t.type))
    && (!activeMission.scene_key || activeMission.scene_key === currentSceneKey);
  const nameLooksCombat = ['fight', 'boss', 'combat', 'level']
    .some(hint => currentSceneKey?.toLowerCase().includes(hint));
  const isCombat = hasActiveEnemies || missionIsCombat || nameLooksCombat;

  // Dispatch custom window events that the LobbyScene will listen to
  const handleButtonPress = (key, isDown) => {
    console.log(`[VirtualArcadeControls] handleButtonPress key=${key}, isDown=${isDown}`);
    setActiveInputs(prev => ({
      ...prev,
      [key]: isDown
    }));
    window.dispatchEvent(new CustomEvent('virtual-input', {
      detail: { key, isDown }
    }));
  };

  // Reset inputs when transitioning scenes/maps to avoid stuck states
  useEffect(() => {
    const defaultStates = {
      shift: false,
      up: false,
      down: false,
      left: false,
      right: false,
      potion: false,
      manaPotion: false,
      throw: false,
      interact: false,
      dash: false,
      combo: false,
      attack: false,
      spell: false
    };
    setActiveInputs(defaultStates);

    // Dispatch clear events for game engine
    Object.keys(defaultStates).forEach(key => {
      window.dispatchEvent(new CustomEvent('virtual-input', {
        detail: { key, isDown: false }
      }));
    });
  }, [currentSceneKey]);

  // Touch handlers with special logic for SPRINT ('shift') which behaves as a toggle
  const handlePress = (action) => {
    if (action === 'shift') {
      const currentShift = activeInputsRef.current.shift;
      handleButtonPress('shift', !currentShift);
    } else {
      handleButtonPress(action, true);
    }
  };

  const handleRelease = (action) => {
    if (action === 'shift') {
      // Ignore release events for SPRINT to allow toggle behavior
    } else {
      handleButtonPress(action, false);
    }
  };

  // Attach non-passive touch listeners using event delegation
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleTouchStart = (e) => {
      const target = e.target.closest('[data-action]');
      if (target) {
        // Prevent default browser touch actions (scrolling/panning)
        if (e.cancelable) e.preventDefault();
        const action = target.getAttribute('data-action');
        handlePress(action);
      }
    };

    const handleTouchEnd = (e) => {
      const target = e.target.closest('[data-action]');
      if (target) {
        if (e.cancelable) e.preventDefault();
        const action = target.getAttribute('data-action');
        handleRelease(action);
      }
    };

    const handleTouchCancel = (e) => {
      const target = e.target.closest('[data-action]');
      if (target) {
        const action = target.getAttribute('data-action');
        handleRelease(action);
      }
    };

    // Use passive: false to allow e.preventDefault() to block touch scrolling
    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: false });
    container.addEventListener('touchcancel', handleTouchCancel, { passive: false });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('touchcancel', handleTouchCancel);
    };
  }, []);

  return (
    <div 
      ref={containerRef}
      className="absolute inset-0 z-10 pointer-events-none select-none touch-none flex justify-between p-4 md:p-6"
    >
      {/* D-Pad & Sprint cluster (lado configurable en Ajustes) */}
      <div
        className={`absolute bottom-14 md:bottom-6 ${sideClasses(dpadSide)} flex flex-col items-center md:flex-row md:items-end gap-2 md:gap-4 pointer-events-none`}
        style={clusterStyle(dpadSide)}
      >
        {/* Sprint Button (Toggles on touch/click) */}
        <button
          data-action="shift"
          onMouseDown={() => {
            const currentShift = activeInputsRef.current.shift;
            handleButtonPress('shift', !currentShift);
          }}
          className={`w-10 h-10 md:w-16 md:h-16 border rounded-full flex flex-col items-center justify-center font-bold text-[7px] md:text-xs backdrop-blur-sm transition-all duration-150 cursor-pointer pointer-events-auto select-none touch-none ${
            activeInputs.shift
              ? 'bg-blue-500/35 border-blue-400/40 text-white scale-90 shadow-[0_0_15px_rgba(59,130,246,0.4)]'
              : 'bg-blue-600/10 border-blue-500/20 text-blue-200/60 shadow-[0_0_10px_rgba(59,130,246,0.15)]'
          }`}
        >
          <Zap className="w-3.5 h-3.5 md:w-5 md:h-5 mb-0.5 animate-pulse" />
          <span className="text-[6px] md:text-[9px] tracking-wider font-extrabold">SPRINT</span>
        </button>

        {/* Circular D-Pad */}
        <div className="w-24 h-24 md:w-44 md:h-44 bg-black/20 border border-white/5 rounded-full flex items-center justify-center relative backdrop-blur-sm shadow-[0_10px_25px_rgba(0,0,0,0.6)] pointer-events-auto">
          {/* Inner ring */}
          <div className="absolute inset-4 md:inset-8 border border-white/5 rounded-full pointer-events-none"></div>

          {/* D-Pad Buttons */}
          {/* UP */}
          <button
            data-action="up"
            onMouseDown={() => handleButtonPress('up', true)}
            onMouseUp={() => handleButtonPress('up', false)}
            onMouseLeave={() => handleButtonPress('up', false)}
            className={`absolute top-0.5 left-1/2 -translate-x-1/2 w-8 h-6 md:top-2 md:w-14 md:h-12 border rounded-t-xl flex items-center justify-center transition-all cursor-pointer pointer-events-auto select-none touch-none ${
              activeInputs.up
                ? 'bg-white/20 border-white/20 text-white scale-90 shadow-[0_0_10px_rgba(255,255,255,0.3)]'
                : 'bg-white/5 border-white/5 text-white/30 hover:text-white/70'
            }`}
            aria-label="Move Up"
          >
            <span className="text-[10px] md:text-xl font-bold">▲</span>
          </button>

          {/* DOWN */}
          <button
            data-action="down"
            onMouseDown={() => handleButtonPress('down', true)}
            onMouseUp={() => handleButtonPress('down', false)}
            onMouseLeave={() => handleButtonPress('down', false)}
            className={`absolute bottom-0.5 left-1/2 -translate-x-1/2 w-8 h-6 md:bottom-2 md:w-14 md:h-12 border rounded-b-xl flex items-center justify-center transition-all cursor-pointer pointer-events-auto select-none touch-none ${
              activeInputs.down
                ? 'bg-white/20 border-white/20 text-white scale-90 shadow-[0_0_10px_rgba(255,255,255,0.3)]'
                : 'bg-white/5 border-white/5 text-white/30 hover:text-white/70'
            }`}
            aria-label="Move Down"
          >
            <span className="text-[10px] md:text-xl font-bold">▼</span>
          </button>

          {/* LEFT */}
          <button
            data-action="left"
            onMouseDown={() => handleButtonPress('left', true)}
            onMouseUp={() => handleButtonPress('left', false)}
            onMouseLeave={() => handleButtonPress('left', false)}
            className={`absolute left-0.5 top-1/2 -translate-y-1/2 w-6 h-8 md:left-2 md:w-12 md:h-14 border rounded-l-xl flex items-center justify-center transition-all cursor-pointer pointer-events-auto select-none touch-none ${
              activeInputs.left
                ? 'bg-white/20 border-white/20 text-white scale-90 shadow-[0_0_10px_rgba(255,255,255,0.3)]'
                : 'bg-white/5 border-white/5 text-white/30 hover:text-white/70'
            }`}
            aria-label="Move Left"
          >
            <span className="text-[10px] md:text-xl font-bold">◀</span>
          </button>

          {/* RIGHT */}
          <button
            data-action="right"
            onMouseDown={() => handleButtonPress('right', true)}
            onMouseUp={() => handleButtonPress('right', false)}
            onMouseLeave={() => handleButtonPress('right', false)}
            className={`absolute right-0.5 top-1/2 -translate-y-1/2 w-6 h-8 md:right-2 md:w-12 md:h-14 border rounded-r-xl flex items-center justify-center transition-all cursor-pointer pointer-events-auto select-none touch-none ${
              activeInputs.right
                ? 'bg-white/20 border-white/20 text-white scale-90 shadow-[0_0_10px_rgba(255,255,255,0.3)]'
                : 'bg-white/5 border-white/5 text-white/30 hover:text-white/70'
            }`}
            aria-label="Move Right"
          >
            <span className="text-[10px] md:text-xl font-bold">▶</span>
          </button>

          {/* Center Knob */}
          <div className="w-5 h-5 md:w-10 md:h-10 bg-white/5 border border-white/10 rounded-full shadow-inner pointer-events-none flex items-center justify-center">
            <div className="w-1 h-1 bg-white/10 rounded-full"></div>
          </div>
        </div>
      </div>

      {/* Action Buttons cluster (lado opuesto al D-pad) */}
      <div
        className={`absolute bottom-14 md:bottom-6 ${sideClasses(actionsSide)} pointer-events-none`}
        style={clusterStyle(actionsSide)}
      >
        {isCombat ? (
          /* Combat Map Action Cluster */
          <div className="relative w-48 h-32 md:w-80 md:h-56 select-none pointer-events-none">
            {/* Top Row Actions */}
            {/* Potion (Q) */}
            <button
              data-action="potion"
              onMouseDown={() => handleButtonPress('potion', true)}
              onMouseUp={() => handleButtonPress('potion', false)}
              onMouseLeave={() => handleButtonPress('potion', false)}
              className={`absolute top-1 right-36 w-11 h-11 md:top-0 md:right-56 md:w-16 md:h-16 border text-emerald-300 rounded-full flex flex-col items-center justify-center transition-all duration-100 cursor-pointer pointer-events-auto select-none touch-none ${
                activeInputs.potion
                  ? 'bg-emerald-500/35 border-emerald-400/40 text-white scale-90 shadow-[0_0_15px_rgba(16,185,129,0.4)]'
                  : 'bg-emerald-600/10 border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.15)]'
              }`}
              title="Potion (Q)"
            >
              <Sparkles className="w-3.5 h-3.5 md:w-[18px] md:h-[18px]" />
              <span className="text-[5px] md:text-[8px] font-black tracking-tighter">POT (Q)</span>
            </button>

            {/* Mana Potion (R) */}
            <button
              data-action="manaPotion"
              onMouseDown={() => handleButtonPress('manaPotion', true)}
              onMouseUp={() => handleButtonPress('manaPotion', false)}
              onMouseLeave={() => handleButtonPress('manaPotion', false)}
              className={`absolute top-1 right-24 w-11 h-11 md:top-0 md:right-40 md:w-16 md:h-16 border text-sky-300 rounded-full flex flex-col items-center justify-center transition-all duration-100 cursor-pointer pointer-events-auto select-none touch-none ${
                activeInputs.manaPotion
                  ? 'bg-sky-500/35 border-sky-400/40 text-white scale-90 shadow-[0_0_15px_rgba(14,165,233,0.4)]'
                  : 'bg-sky-600/10 border-sky-500/20 shadow-[0_0_10px_rgba(14,165,233,0.15)]'
              }`}
              title="Mana Potion (R)"
            >
              <Zap className="w-3.5 h-3.5 md:w-[18px] md:h-[18px] text-sky-300" />
              <span className="text-[5px] md:text-[8px] font-black tracking-tighter">MANA (R)</span>
            </button>

            {/* Throw (U) */}
            <button
              data-action="throw"
              onMouseDown={() => handleButtonPress('throw', true)}
              onMouseUp={() => handleButtonPress('throw', false)}
              onMouseLeave={() => handleButtonPress('throw', false)}
              className={`absolute top-1 right-12 w-11 h-11 md:top-0 md:right-24 md:w-16 md:h-16 border text-teal-300 rounded-full flex flex-col items-center justify-center transition-all duration-100 cursor-pointer pointer-events-auto select-none touch-none ${
                activeInputs.throw
                  ? 'bg-teal-500/35 border-teal-400/40 text-white scale-90 shadow-[0_0_15px_rgba(20,184,166,0.4)]'
                  : 'bg-teal-600/10 border-teal-500/20 shadow-[0_0_10px_rgba(20,184,166,0.15)]'
              }`}
              title="Throw (U)"
            >
              <Flame className="w-3.5 h-3.5 md:w-[18px] md:h-[18px] rotate-45" />
              <span className="text-[5px] md:text-[8px] font-black tracking-tighter">THR (U)</span>
            </button>

            {/* Interact (E) */}
            <button
              data-action="interact"
              onMouseDown={() => handleButtonPress('interact', true)}
              onMouseUp={() => handleButtonPress('interact', false)}
              onMouseLeave={() => handleButtonPress('interact', false)}
              className={`absolute top-1 right-0 w-11 h-11 md:top-2 md:right-8 md:w-16 md:h-16 border text-amber-300 rounded-full flex flex-col items-center justify-center transition-all duration-100 cursor-pointer pointer-events-auto select-none touch-none ${
                activeInputs.interact
                  ? 'bg-amber-500/35 border-amber-400/40 text-white scale-90 shadow-[0_0_15px_rgba(245,158,11,0.4)]'
                  : 'bg-amber-600/10 border-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.15)]'
              }`}
              title="Interact (E)"
            >
              <Hand className="w-3.5 h-3.5 md:w-[18px] md:h-[18px]" />
              <span className="text-[5px] md:text-[8px] font-black tracking-tighter">INT (E)</span>
            </button>

            {/* Bottom Row Actions */}
            {/* Dodge/Dash (SPACE) */}
            <button
              data-action="dash"
              onMouseDown={() => handleButtonPress('dash', true)}
              onMouseUp={() => handleButtonPress('dash', false)}
              onMouseLeave={() => handleButtonPress('dash', false)}
              className={`absolute bottom-1 right-36 w-11 h-11 md:bottom-2 md:right-52 md:w-16 md:h-16 border text-slate-200 rounded-full flex flex-col items-center justify-center transition-all duration-100 cursor-pointer pointer-events-auto select-none touch-none ${
                activeInputs.dash
                  ? 'bg-slate-500/35 border-slate-400/40 text-white scale-90 shadow-[0_0_15px_rgba(100,116,139,0.4)]'
                  : 'bg-slate-600/10 border-slate-500/20 shadow-[0_0_8px_rgba(100,116,139,0.15)]'
              }`}
              title="Dash (Space)"
            >
              <RefreshCw className="w-3.5 h-3.5 md:w-[18px] md:h-[18px]" />
              <span className="text-[5px] md:text-[8px] font-black tracking-tighter">DASH</span>
            </button>

            {/* Combo (K) */}
            <button
              data-action="combo"
              onMouseDown={() => handleButtonPress('combo', true)}
              onMouseUp={() => handleButtonPress('combo', false)}
              onMouseLeave={() => handleButtonPress('combo', false)}
              className={`absolute bottom-1 right-24 w-11 h-11 md:bottom-2 md:right-36 md:w-16 md:h-16 border text-cyan-300 rounded-full flex flex-col items-center justify-center transition-all duration-100 cursor-pointer pointer-events-auto select-none touch-none ${
                activeInputs.combo
                  ? 'bg-cyan-500/35 border-cyan-400/40 text-white scale-90 shadow-[0_0_18px_rgba(6,182,212,0.5)]'
                  : 'bg-cyan-600/10 border-cyan-500/20 shadow-[0_0_10px_rgba(6,182,212,0.2)]'
              }`}
              title="Combo (K)"
            >
              <Swords className="w-3.5 h-3.5 md:w-[18px] md:h-[18px]" />
              <span className="text-[5px] md:text-[8px] font-black tracking-tight">COMBO</span>
            </button>

            {/* Attack (J) */}
            <button
              data-action="attack"
              onMouseDown={() => handleButtonPress('attack', true)}
              onMouseUp={() => handleButtonPress('attack', false)}
              onMouseLeave={() => handleButtonPress('attack', false)}
              className={`absolute bottom-1 right-12 w-11 h-11 md:bottom-2 md:right-20 md:w-16 md:h-16 border text-red-200 rounded-full flex flex-col items-center justify-center transition-all duration-100 cursor-pointer pointer-events-auto select-none touch-none ${
                activeInputs.attack
                  ? 'bg-red-500/45 border-red-400/50 text-white scale-90 shadow-[0_0_20px_rgba(239,68,68,0.5)]'
                  : 'bg-red-600/12 border-red-500/20 shadow-[0_0_12px_rgba(239,68,68,0.25)]'
              }`}
              title="Quick Strike (J)"
            >
              <Sword className="w-4 h-4 md:w-5 md:h-5 animate-pulse" />
              <span className="text-[6px] md:text-[9px] font-black tracking-wide">QUICK</span>
            </button>

            {/* Spell (L) */}
            <button
              data-action="spell"
              onMouseDown={() => handleButtonPress('spell', true)}
              onMouseUp={() => handleButtonPress('spell', false)}
              onMouseLeave={() => handleButtonPress('spell', false)}
              className={`absolute bottom-1 right-0 w-11 h-11 md:bottom-2 md:right-4 md:w-16 md:h-16 border text-purple-300 rounded-full flex flex-col items-center justify-center transition-all duration-100 cursor-pointer pointer-events-auto select-none touch-none ${
                activeInputs.spell
                  ? 'bg-purple-500/35 border-purple-400/40 text-white scale-90 shadow-[0_0_15px_rgba(168,85,247,0.4)]'
                  : 'bg-purple-600/10 border-purple-500/20 shadow-[0_0_10px_rgba(168,85,247,0.15)]'
              }`}
              title="Spell (L)"
            >
              <Zap className="w-3.5 h-3.5 md:w-[18px] md:h-[18px]" />
              <span className="text-[5px] md:text-[8px] font-black tracking-tighter">SPELL</span>
            </button>
          </div>
        ) : (
          /* Peaceful Map Action Cluster */
          <div className="flex items-end gap-3 pointer-events-none select-none">
            {/* Dash (SPACE) */}
            <button
              data-action="dash"
              onMouseDown={() => handleButtonPress('dash', true)}
              onMouseUp={() => handleButtonPress('dash', false)}
              onMouseLeave={() => handleButtonPress('dash', false)}
              className={`w-10 h-10 md:w-16 md:h-16 border text-slate-200 rounded-full flex flex-col items-center justify-center transition-all duration-100 cursor-pointer pointer-events-auto select-none touch-none ${
                activeInputs.dash
                  ? 'bg-slate-500/35 border-slate-400/40 text-white scale-90 shadow-[0_0_15px_rgba(100,116,139,0.4)]'
                  : 'bg-slate-600/10 border-slate-500/20 shadow-[0_0_10px_rgba(100,116,139,0.15)]'
              }`}
              title="Dash (Space)"
            >
              <RefreshCw className="w-3.5 h-3.5 md:w-[18px] md:h-[18px]" />
              <span className="text-[5px] md:text-[8px] font-black tracking-wider">DASH</span>
            </button>

            {/* Interact (E) */}
            <button
              data-action="interact"
              onMouseDown={() => handleButtonPress('interact', true)}
              onMouseUp={() => handleButtonPress('interact', false)}
              onMouseLeave={() => handleButtonPress('interact', false)}
              className={`w-10 h-10 md:w-16 md:h-16 border text-amber-200 rounded-full flex flex-col items-center justify-center transition-all duration-100 cursor-pointer pointer-events-auto select-none touch-none ${
                activeInputs.interact
                  ? 'bg-amber-500/35 border-amber-400/40 text-white scale-90 shadow-[0_0_18px_rgba(245,158,11,0.5)]'
                  : 'bg-amber-600/12 border-amber-500/20 shadow-[0_0_12px_rgba(245,158,11,0.25)] animate-pulse'
              }`}
              title="Interact (E)"
            >
              <Hand className="w-3.5 h-3.5 md:w-[18px] md:h-[18px]" />
              <span className="text-[5px] md:text-[8px] font-black tracking-wide">INTERACT</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
