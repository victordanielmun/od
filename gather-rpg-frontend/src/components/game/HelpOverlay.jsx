import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, HelpCircle, Keyboard, Gamepad2, Brain, Check, Compass, AlertCircle } from 'lucide-react';

export const HelpOverlay = ({ onClose }) => {
  const { t, i18n } = useTranslation();
  const [activeTab, setActiveTab] = useState('controls');
  const isEs = i18n.language?.startsWith('es');

  const tabs = [
    { id: 'controls', label: isEs ? 'Controles' : 'Controls', icon: Keyboard },
    { id: 'gameplay', label: isEs ? 'Cómo Jugar' : 'How to Play', icon: Compass },
    { id: 'english', label: isEs ? 'Práctica de Inglés' : 'English Practice', icon: Brain },
  ];

  const controls = [
    { keys: ['W', 'A', 'S', 'D'], desc: isEs ? 'Mover personaje (Arriba, Izquierda, Abajo, Derecha)' : 'Move character (Up, Left, Down, Right)' },
    { keys: ['J', 'Click Izq'], desc: isEs ? 'Combo de 3 Golpes cuerpo a cuerpo' : '3-Hit Melee Combo' },
    { keys: ['K'], desc: isEs ? 'Lanzar Daga Arrojadiza' : 'Throw Dagger' },
    { keys: ['L'], desc: isEs ? 'Lanzar Hechizo Mágico (Nova / Fire Rain)' : 'Cast Magic Spell' },
    { keys: ['SPACE'], desc: isEs ? 'Esquivar / Dash de velocidad' : 'Dash / Evade' },
    { keys: ['Q'], desc: isEs ? 'Consumir Poción de Vida (Health Potion)' : 'Drink Health Potion' },
    { keys: ['R'], desc: isEs ? 'Consumir Poción de Maná (Mana Potion)' : 'Drink Mana Potion' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-auto p-2 md:p-4 animate-in fade-in duration-300">
      {/* Parchment Box */}
      <div className="relative w-full max-w-3xl bg-[var(--color-parchment)] border-2 md:border-8 border-double border-[var(--color-gold)] p-3 md:p-8 shadow-[0_20px_60px_rgba(0,0,0,0.8)] flex flex-col max-h-[90vh] md:max-h-[85vh] overflow-hidden animate-in zoom-in-95 duration-300 text-[var(--color-base-dark)]">
        {/* Parchment Texture Overlay */}
        <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/parchment.png")' }}></div>

        {/* Decorative corner borders */}
        <div className="absolute -top-3 -left-3 w-8 h-8 border-t-4 border-l-4 border-[var(--color-gold)]"></div>
        <div className="absolute -top-3 -right-3 w-8 h-8 border-t-4 border-r-4 border-[var(--color-gold)]"></div>
        <div className="absolute -bottom-3 -left-3 w-8 h-8 border-b-4 border-l-4 border-[var(--color-gold)]"></div>
        <div className="absolute -bottom-3 -right-3 w-8 h-8 border-b-4 border-r-4 border-[var(--color-gold)]"></div>

        {/* Header */}
        <div className="flex items-center gap-2 md:gap-3 mb-3 pb-2 md:mb-6 md:pb-4 border-b-2 border-[var(--color-gold-dark)]/30 relative z-10">
          <HelpCircle className="w-5 h-5 md:w-8 md:h-8 text-[var(--color-orange-vibrant)]" />
          <h2 className="text-lg sm:text-xl md:text-3xl font-medieval uppercase tracking-wider pr-6">
            {isEs ? 'Guía del Aventurero' : 'Adventurer\'s Guide'}
          </h2>
          
          <button 
            onClick={onClose} 
            className="absolute top-0 right-0 p-1 md:p-2 bg-[var(--color-orange-vibrant)] text-white border-2 border-[var(--color-gold)] shadow-md hover:bg-[var(--color-base-dark)] transition-colors cursor-pointer active:translate-y-0.5"
            title={isEs ? 'Cerrar' : 'Close'}
          >
            <X className="w-4 h-4 md:w-5 md:h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div 
          className="flex gap-1 md:gap-2 mb-3 md:mb-6 border-b border-gray-300 pb-1.5 md:pb-2 relative z-10 overflow-x-auto select-none"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1 md:gap-2 px-2 py-1.5 md:px-4 md:py-2 font-medieval text-[10px] sm:text-xs md:text-base uppercase border-2 transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-[var(--color-base-dark)] border-[var(--color-gold)] text-[var(--color-gold)] shadow-md'
                    : 'bg-white/40 border-transparent text-[var(--color-base-dark)] hover:bg-white/70'
                }`}
              >
                <Icon className="w-3 h-3 sm:w-4 sm:h-4 md:w-[18px] md:h-[18px]" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar-light relative z-10 pr-2">
          {activeTab === 'controls' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <p className="text-xs md:text-sm font-serif italic text-gray-700 mb-2">
                {isEs 
                  ? 'Aprende los atajos de teclado y clics para controlar a tu personaje y derrotar enemigos:' 
                  : 'Learn the keyboard shortcuts and click actions to control your character and defeat enemies:'}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:gap-4">
                {controls.map((ctrl, index) => (
                  <div key={index} className="flex items-center bg-white/40 border border-[var(--color-gold-dark)]/20 p-2 md:p-3 shadow-inner">
                    <div className="flex gap-1 mr-2 md:mr-4 min-w-[75px] md:min-w-[100px] justify-start flex-wrap">
                      {ctrl.keys.map((key, kIdx) => (
                        <kbd 
                          key={kIdx} 
                          className="px-1.5 py-0.5 md:px-2 md:py-1 bg-[var(--color-base-dark)] text-[var(--color-gold)] border border-[var(--color-gold-dark)] rounded font-mono text-[9px] md:text-xs font-bold shadow-md"
                        >
                          {key}
                        </kbd>
                      ))}
                    </div>
                    <span className="text-xs md:text-sm font-serif font-semibold text-gray-800 leading-snug">
                      {ctrl.desc}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'gameplay' && (
            <div className="space-y-3 md:space-y-6 font-serif text-gray-800 animate-in fade-in duration-200">
              <div className="bg-yellow-500/10 border-2 border-dashed border-[var(--color-gold)] p-2 md:p-4 shadow-inner">
                <h4 className="font-medieval text-[var(--color-orange-vibrant)] text-sm md:text-xl uppercase tracking-wider mb-1 md:mb-2 flex items-center gap-1 md:gap-2">
                  <span>🎯</span> {isEs ? 'Misión Inicial' : 'Starter Objective'}
                </h4>
                <p className="text-xs md:text-sm leading-relaxed font-semibold">
                  {isEs 
                    ? '¡Tu aventura comienza aquí! Para comenzar, dirígete hacia el norte cruzando el puente, entra en el Castillo y habla con el Maestro de Misiones (Quest Master) para recibir tus primeras órdenes.' 
                    : 'Your adventure starts here! To begin, head north across the bridge, enter the Castle, and talk to the Quest Master to receive your first orders.'}
                </p>
              </div>

              <div>
                <h3 className="text-sm md:text-xl font-medieval text-[var(--color-orange-vibrant)] mb-1 md:mb-2 uppercase tracking-wide">
                  {isEs ? '1. Misiones e Interacción' : '1. Missions & Interaction'}
                </h3>
                <p className="text-[11px] md:text-sm leading-relaxed">
                  {isEs 
                    ? 'Camina cerca de los NPCs y presiona la tecla de interactuar (o haz clic sobre ellos) para entablar una conversación. Los NPCs con misiones disponibles tienen marcadores especiales. Completa sus peticiones para progresar en tu aventura.' 
                    : 'Walk close to NPCs and press the interaction key (or click on them) to start a conversation. NPCs with available quests have special indicators. Complete their requests to progress in your adventure.'}
                </p>
              </div>

              <div>
                <h3 className="text-sm md:text-xl font-medieval text-[var(--color-orange-vibrant)] mb-1 md:mb-2 uppercase tracking-wide">
                  {isEs ? '2. Combate y Mazmorras' : '2. Combat & Dungeons'}
                </h3>
                <p className="text-[11px] md:text-sm leading-relaxed">
                  {isEs
                    ? 'Cruza portales o acepta misiones para entrar en zonas de combate (Beat \'em up). El combo de 3 golpes (J / Clic Izq) es tu ataque cuerpo a cuerpo; los hechizos (L) pegan aún más fuerte pero gastan maná. Cuando el enemigo está a punto de caer aparece una Ninja Card: acierta la pregunta y lo derrotas. ¡Vigila tu barra de vida y usa pociones (Q) si estás en peligro!'
                    : 'Cross portals or accept quests to enter combat zones (Beat \'em up). The 3-hit combo (J / Left Click) is your melee attack; spells (L) hit even harder but cost mana. When an enemy is about to fall, a Ninja Card appears: answer correctly to defeat it. Watch your health bar and use potions (Q) if you are in danger!'}
                </p>
              </div>

              <div>
                <h3 className="text-sm md:text-xl font-medieval text-[var(--color-orange-vibrant)] mb-1 md:mb-2 uppercase tracking-wide">
                  {isEs ? '3. Gestión de Salas' : '3. Room Management'}
                </h3>
                <p className="text-[11px] md:text-sm leading-relaxed">
                  {isEs 
                    ? 'Puedes jugar en salas públicas con otros usuarios o crear salas privadas protegidas por un código PIN para jugar cooperativamente con tus amigos. Copia el PIN desde la interfaz superior derecha para compartirlo.' 
                    : 'You can play in public rooms with other users or create private rooms protected by a PIN code to play cooperatively with your friends. Copy the PIN from the top-right interface to share it.'}
                </p>
              </div>
            </div>
          )}

          {activeTab === 'english' && (
            <div className="space-y-4 md:space-y-6 font-serif text-gray-800 animate-in fade-in duration-200">
              <div className="bg-white/50 border-l-4 border-[var(--color-orange-vibrant)] p-3 md:p-4 shadow-inner">
                <div className="flex items-center gap-2 text-[var(--color-orange-vibrant)] font-black text-xs md:text-sm uppercase tracking-wide mb-1 md:mb-2">
                  <Brain size={16} />
                  <span>{isEs ? '¡Aprende Jugando!' : 'Learn while Playing!'}</span>
                </div>
                <p className="leading-relaxed text-xs md:text-sm italic">
                  {isEs 
                    ? 'Odyssey combina la diversión de un RPG con la práctica del inglés. Toda interacción verbal con los habitantes del mundo te ayudará a perfeccionar el idioma.' 
                    : 'Odyssey combines the fun of an RPG with English practice. Every verbal interaction with the world\'s inhabitants helps you refine the language.'}
                </p>
              </div>

              <div>
                <h3 className="text-base md:text-xl font-medieval text-[var(--color-orange-vibrant)] mb-1 md:mb-2 uppercase tracking-wide">
                  {isEs ? '🎙️ Práctica de Pronunciación' : '🎙️ Pronunciation Practice'}
                </h3>
                <p className="text-xs md:text-sm leading-relaxed">
                  {isEs 
                    ? 'Durante las conversaciones con los NPCs, puedes hacer clic en el botón del micrófono para responder hablando. El sistema analizará tu audio y te dará una puntuación de pronunciación.' 
                    : 'During conversations with NPCs, you can click the microphone button to respond by speaking. The system will analyze your audio and provide a pronunciation score.'}
                </p>
              </div>

              <div>
                <h3 className="text-base md:text-xl font-medieval text-[var(--color-orange-vibrant)] mb-1 md:mb-2 uppercase tracking-wide">
                  {isEs ? '🔊 Escucha Activa' : '🔊 Active Listening'}
                </h3>
                <p className="text-xs md:text-sm leading-relaxed">
                  {isEs 
                    ? 'Haz clic en el botón del altavoz en los diálogos de los NPCs para escuchar su pronunciación correcta en inglés en cualquier momento. También puedes activar las traducciones en español si tienes dudas sobre el significado.' 
                    : 'Click the speaker button during NPC dialogues to hear their correct English pronunciation at any time. You can also toggle Spanish translations if you are unsure of the meaning.'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-4 pt-2 md:mt-6 md:pt-4 border-t border-[var(--color-gold-dark)]/20 text-center relative z-10 flex items-center justify-between gap-4">
          <span className="text-[10px] md:text-xs font-serif text-gray-500 italic flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5 md:w-4 md:h-4" />
            {isEs ? 'Presiona "H" para abrir/cerrar esta guía' : 'Press "H" to open/close this guide'}
          </span>
          
          <button
            onClick={onClose}
            className="px-4 py-1.5 md:px-6 md:py-2 bg-[var(--color-base-dark)] text-[var(--color-gold)] hover:bg-[var(--color-orange-vibrant)] hover:text-white border-2 border-[var(--color-gold)] transition-all font-medieval uppercase text-xs md:text-sm cursor-pointer shadow-lg active:translate-y-0.5"
          >
            {isEs ? 'Entendido' : 'Got it'}
          </button>
        </div>
      </div>
    </div>
  );
};
