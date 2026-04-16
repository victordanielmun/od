import React from 'react';
import { useTranslation } from 'react-i18next';
import wsClient from '../../services/websocket';

const classes = [
  {
    id: 'warrior',
    name: 'Warrior',
    description: 'High HP and Defense. Melee attacks.',
    color: 'bg-red-600',
    stats: { hp: 150, mp: 20, atk: 20, def: 10, spd: 100 }
  },
  {
    id: 'mage',
    name: 'Mage',
    description: 'High Magic and MP. Ranged spells.',
    color: 'bg-blue-600',
    stats: { hp: 80, mp: 100, atk: 30, def: 3, spd: 90 }
  },
  {
    id: 'archer',
    name: 'Archer',
    description: 'Fast and agile. Ranged attacks.',
    color: 'bg-green-600',
    stats: { hp: 100, mp: 40, atk: 25, def: 6, spd: 120 }
  }
];

export const CharacterSelector = ({ onSelect }) => {
  const { t } = useTranslation();
  const handleSelect = (classId) => {
    // Send to backend
    wsClient.send('select_character', { character_class: classId });
    if (onSelect) onSelect(classId);
  };

  return (
    <div className="p-10 bg-[var(--color-base-dark)] border-4 border-[var(--color-gold)] shadow-[0_20px_50px_rgba(0,0,0,0.9)] max-w-5xl w-full relative overflow-hidden">
      <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/wood-pattern.png")' }}></div>
      <h2 className="text-4xl font-medieval text-[var(--color-gold)] mb-10 text-center uppercase tracking-[0.3em] drop-shadow-lg relative z-10">{t('lobby.character_selector.title')}</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {classes.map((cls) => (
          <div 
            key={cls.id}
            className="bg-[var(--color-accent-blue)] border-4 border-[var(--color-gold-dark)] hover:border-[var(--color-gold)] transition-all cursor-pointer group shadow-2xl relative z-10 overflow-hidden"
            onClick={() => handleSelect(cls.id)}
          >
            <div className={`h-40 ${cls.color} flex items-center justify-center border-b-4 border-[var(--color-gold-dark)]/50 relative overflow-hidden`}>
              <div className="absolute inset-0 bg-black/40 group-hover:bg-transparent transition-colors"></div>
              <span className="text-6xl font-medieval text-white drop-shadow-[0_4px_10px_rgba(0,0,0,0.5)] group-hover:scale-110 transition duration-500">
                {cls.name[0]}
              </span>
            </div>
            
            <div className="p-6 bg-[var(--color-base-dark)]/50">
              <h3 className="text-2xl font-medieval text-[var(--color-gold)] mb-3 tracking-wide">{t(`lobby.character_selector.${cls.id}`)}</h3>
              <p className="text-[var(--color-parchment-dark)] text-sm mb-6 min-h-[48px] italic font-serif leading-tight opacity-90">{t(`lobby.character_selector.${cls.id}_desc`)}</p>
              
              <div className="space-y-3 text-[11px] font-medieval uppercase tracking-widest text-[var(--color-parchment-dark)]">
                <div className="flex justify-between border-b border-[var(--color-gold-dark)]/20 pb-1">
                  <span>{t('lobby.character_selector.hp')}</span>
                  <span className="text-white font-bold">{cls.stats.hp}</span>
                </div>
                <div className="flex justify-between border-b border-[var(--color-gold-dark)]/20 pb-1">
                  <span>{t('lobby.character_selector.mp')}</span>
                  <span className="text-white font-bold">{cls.stats.mp}</span>
                </div>
                <div className="flex justify-between border-b border-[var(--color-gold-dark)]/20 pb-1">
                  <span>{t('lobby.character_selector.atk')}</span>
                  <span className="text-white font-bold">{cls.stats.atk}</span>
                </div>
                <div className="flex justify-between border-b border-[var(--color-gold-dark)]/20 pb-1">
                  <span>{t('lobby.character_selector.spd')}</span>
                  <span className="text-white font-bold">{cls.stats.spd}</span>
                </div>
              </div>
              
              <button className="w-full mt-8 py-3 bg-[var(--color-orange-vibrant)] hover:bg-[var(--color-accent-blue)] text-white font-medieval border-2 border-[var(--color-gold)] shadow-[0_4px_0_rgba(0,0,0,0.5)] active:translate-y-1 transition-all uppercase tracking-widest text-xs">
                {t('lobby.character_selector.select')} {t(`lobby.character_selector.${cls.id}`)}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
