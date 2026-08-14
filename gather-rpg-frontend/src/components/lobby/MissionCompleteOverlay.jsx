import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Trophy, Home, Play } from 'lucide-react';
import { playSfx } from '../../utils/sfx';

export const MissionCompleteOverlay = () => {
    const { t } = useTranslation();
    const [isVisible, setIsVisible] = useState(false);
    const [title, setTitle] = useState('');

    useEffect(() => {
        const handleMissionComplete = (e) => {
            playSfx('level_win');
            setTitle(e.detail?.title || 'Misión');
            setIsVisible(true);
        };
        window.addEventListener('mission-completed-overlay', handleMissionComplete);
        return () => window.removeEventListener('mission-completed-overlay', handleMissionComplete);
    }, []);

    const handleReturnToLobby = () => {
        setIsVisible(false);
        window.dispatchEvent(new CustomEvent('lobby-change-map', {
            detail: { targetMap: 'lobby', targetX: 0, targetY: 0 }
        }));
    };

    const handleStay = () => {
        setIsVisible(false);
    };

    if (!isVisible) return null;

    return (
        <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-700">
            <div className="max-w-md w-full mx-4 text-center space-y-8 animate-in zoom-in-95 slide-in-from-bottom-10 duration-700 delay-150">
                <div className="relative inline-block">
                    <div className="absolute inset-0 bg-yellow-400 blur-3xl opacity-25 animate-pulse"></div>
                    <Trophy size={120} className="text-yellow-400 relative z-10 mx-auto drop-shadow-[0_0_15px_rgba(250,204,21,0.6)]" />
                </div>

                <div className="space-y-2">
                    <h2 className="text-4xl font-medieval text-yellow-400 uppercase tracking-[0.2em] drop-shadow-lg">
                        {t('npc.dialogue.mission_completed') || '¡Misión Completada!'}
                    </h2>
                    <p className="text-lg text-[var(--color-parchment-dark)] italic font-serif">
                        {title}
                    </p>
                </div>

                <div className="flex flex-col gap-3">
                    <button
                        onClick={handleReturnToLobby}
                        className="w-full py-3 bg-[var(--color-orange-vibrant)] hover:bg-[var(--color-accent-blue)] text-white font-medieval border-2 border-[var(--color-gold)] shadow-[0_4px_0_rgba(0,0,0,0.5)] active:translate-y-1 transition-all uppercase tracking-widest text-sm flex items-center justify-center gap-2"
                    >
                        <Home size={18} /> {t('lobby.mission.return_lobby') || 'Volver al Lobby'}
                    </button>
                    <button
                        onClick={handleStay}
                        className="w-full py-2.5 bg-transparent hover:bg-white/10 text-[var(--color-parchment-dark)] font-medieval border border-[var(--color-gold-dark)]/50 transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-2"
                    >
                        <Play size={16} /> {t('lobby.mission.stay_here') || 'Seguir aquí'}
                    </button>
                </div>
            </div>
        </div>
    );
};
