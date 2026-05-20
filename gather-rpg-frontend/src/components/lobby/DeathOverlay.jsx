import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Skull, Eye, Home } from 'lucide-react';
import { useGameStore } from '../../store/gameStore';

export const DeathOverlay = () => {
    const { t } = useTranslation();
    const [isVisible, setIsVisible] = useState(false);
    const players = useGameStore(state => state.players);
    const otherPlayersCount = players ? players.size : 0;

    const otherPlayersCountRef = useRef(otherPlayersCount);

    useEffect(() => {
        otherPlayersCountRef.current = otherPlayersCount;
    }, [otherPlayersCount]);

    useEffect(() => {
        const handlePlayerDead = () => {
            console.log(`[DeathOverlay] Player dead event received. Players in room: ${otherPlayersCountRef.current}`);
            setIsVisible(true);
        };

        window.addEventListener('player-dead', handlePlayerDead);
        return () => window.removeEventListener('player-dead', handlePlayerDead);
    }, []);

    const handleSpectate = () => {
        console.log('[DeathOverlay] Spectate clicked');
        setIsVisible(false);
        // Dispatch event to Phaser to switch to spectator mode
        window.dispatchEvent(new CustomEvent('spectate-player'));
    };

    const handleReturnToLobby = () => {
        console.log('[DeathOverlay] Return to lobby clicked');
        // Dispatch event to change map back to lobby
        window.dispatchEvent(new CustomEvent('lobby-change-map', {
            detail: { targetMap: 'lobby' }
        }));
        setIsVisible(false);
    };

    if (!isVisible) return null;

    return (
        <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-1000">
            <div className="max-w-md w-full mx-4 text-center space-y-8 animate-in zoom-in-95 slide-in-from-bottom-10 duration-700 delay-300">
                <div className="relative inline-block">
                    <div className="absolute inset-0 bg-red-500 blur-3xl opacity-20 animate-pulse"></div>
                    <Skull size={120} className="text-red-600 relative z-10 mx-auto drop-shadow-[0_0_15px_rgba(220,38,38,0.5)]" />
                </div>

                <div className="space-y-2">
                    <h1 className="text-5xl font-black text-white uppercase tracking-tighter">
                        Has Caído
                    </h1>
                    <p className="text-gray-400 text-lg font-light">
                        Tu aventura ha terminado por ahora. ¿Qué deseas hacer?
                    </p>
                </div>

                <div className={`grid grid-cols-1 gap-4 ${otherPlayersCount > 0 ? 'sm:grid-cols-2' : 'max-w-xs mx-auto'}`}>
                    {otherPlayersCount > 0 && (
                        <button
                            onClick={handleSpectate}
                            className="group relative flex items-center justify-center gap-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-indigo-500/50 p-4 rounded-2xl transition-all duration-300 overflow-hidden"
                        >
                            <div className="absolute inset-0 bg-indigo-600/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                            <Eye size={20} className="text-indigo-400 relative z-10" />
                            <span className="text-white font-medium relative z-10">Observar</span>
                        </button>
                    )}

                    <button
                        onClick={handleReturnToLobby}
                        className="group relative flex items-center justify-center gap-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-red-500/50 p-4 rounded-2xl transition-all duration-300 overflow-hidden"
                    >
                        <div className="absolute inset-0 bg-red-600/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                        <Home size={20} className="text-red-400 relative z-10" />
                        <span className="text-white font-medium relative z-10">Regresar</span>
                    </button>
                </div>

                <div className="pt-8 border-t border-white/5">
                    <p className="text-xs text-gray-500 uppercase tracking-widest font-bold">
                        Odyssey Combat System
                    </p>
                </div>
            </div>
        </div>
    );
};
