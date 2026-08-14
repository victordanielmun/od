import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Skull, Eye, Home, RotateCcw } from 'lucide-react';
import { useGameStore } from '../../store/gameStore';
import { useAuthStore } from '../../store/authStore';
import { playSfx } from '../../utils/sfx';

export const DeathOverlay = () => {
    const { t } = useTranslation();
    const [isVisible, setIsVisible] = useState(false);
    // Snapshot del conteo de otros jugadores tomado en el momento exacto de la muerte
    // para evitar race conditions con actualizaciones posteriores del store.
    const [otherPlayersCount, setOtherPlayersCount] = useState(0);
    // Mapa (y PIN, si la sala es privada) donde murió el jugador: es lo que se
    // vuelve a pedir al reintentar. También se captura al morir, porque el store
    // cambia en cuanto empieza la transición de escena.
    const [retryMap, setRetryMap] = useState(null);
    const retryPinRef = useRef('');

    useEffect(() => {
        const handlePlayerDead = () => {
            playSfx('game_over');
            // Capturar snapshot en el momento del evento, excluyendo al propio jugador
            const { players, currentSceneKey, currentInviteCode } = useGameStore.getState();
            const myId = String(useAuthStore.getState().user?.id || '');
            let count = 0;
            if (players) {
                players.forEach((_, id) => {
                    if (id !== myId) count++;
                });
            }

            if (count === 0) {
                console.log('[DeathOverlay] Player dead. Solo en la sala — solo se muestra "Regresar".');
            } else {
                console.log(`[DeathOverlay] Player dead. Hay ${count} jugador(es) más en la sala — se muestra "Observar".`);
            }

            // Reintentar solo tiene sentido fuera del lobby: es volver a entrar al
            // mapa de la misión, que se regenera al reentrar (enemigos e ítems).
            setRetryMap(currentSceneKey && currentSceneKey !== 'lobby' ? currentSceneKey : null);
            retryPinRef.current = currentInviteCode || '';

            setOtherPlayersCount(count);
            setIsVisible(true);
        };

        window.addEventListener('player-dead', handlePlayerDead);
        return () => window.removeEventListener('player-dead', handlePlayerDead);
    }, []);

    const handleSpectate = () => {
        console.log('[DeathOverlay] Spectate clicked');
        setIsVisible(false);
        window.dispatchEvent(new CustomEvent('spectate-player'));
    };

    const handleReturnToLobby = () => {
        console.log('[DeathOverlay] Return to lobby clicked');
        setIsVisible(false);
        // Primero resetear el estado de muerte en la escena Phaser,
        // luego solicitar el cambio de mapa
        window.dispatchEvent(new CustomEvent('reset-player-state'));
        window.dispatchEvent(new CustomEvent('lobby-change-map', {
            detail: { targetMap: 'lobby' }
        }));
    };

    // Reintentar = volver a entrar al mismo mapa. El servidor resetea el HP en
    // cada join y, en misiones individuales, crea una instancia nueva (enemigos
    // desde cero); la escena al recrearse repone los ítems del mapa.
    const handleRetry = () => {
        console.log(`[DeathOverlay] Retry clicked → re-entering ${retryMap}`);
        setIsVisible(false);
        window.dispatchEvent(new CustomEvent('reset-player-state'));
        window.dispatchEvent(new CustomEvent('lobby-change-map', {
            detail: { targetMap: retryMap, pin: retryPinRef.current }
        }));
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
                        {t('lobby.death.has_fallen')}
                    </h1>
                    <p className="text-gray-400 text-lg font-light">
                        {t('lobby.death.desc')}
                    </p>
                </div>

                <div className="space-y-4">
                    {retryMap && (
                        <button
                            onClick={handleRetry}
                            className="group relative w-full flex items-center justify-center gap-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-emerald-500/50 p-4 rounded-2xl transition-all duration-300 overflow-hidden"
                        >
                            <div className="absolute inset-0 bg-emerald-600/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                            <RotateCcw size={20} className="text-emerald-400 relative z-10" />
                            <span className="text-white font-medium relative z-10">{t('lobby.death.retry')}</span>
                        </button>
                    )}

                    <div className={`grid grid-cols-1 gap-4 ${otherPlayersCount > 0 ? 'sm:grid-cols-2' : 'max-w-xs mx-auto'}`}>
                        {otherPlayersCount > 0 && (
                            <button
                                onClick={handleSpectate}
                                className="group relative flex items-center justify-center gap-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-indigo-500/50 p-4 rounded-2xl transition-all duration-300 overflow-hidden"
                            >
                                <div className="absolute inset-0 bg-indigo-600/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                                <Eye size={20} className="text-indigo-400 relative z-10" />
                                <span className="text-white font-medium relative z-10">{t('lobby.death.spectate')}</span>
                            </button>
                        )}

                        <button
                            onClick={handleReturnToLobby}
                            className="group relative flex items-center justify-center gap-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-red-500/50 p-4 rounded-2xl transition-all duration-300 overflow-hidden"
                        >
                            <div className="absolute inset-0 bg-red-600/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                            <Home size={20} className="text-red-400 relative z-10" />
                            <span className="text-white font-medium relative z-10">{t('lobby.death.return')}</span>
                        </button>
                    </div>
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
