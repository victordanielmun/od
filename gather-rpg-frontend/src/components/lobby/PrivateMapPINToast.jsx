import { useState, useEffect, useCallback } from 'react';
import { Lock, Copy, Check, X } from 'lucide-react';

/**
 * PrivateMapPINToast
 *
 * Renders when a new private map room is created by the current user.
 * Listens for the global 'map-pin-received' CustomEvent dispatched by LobbyGameCanvas.
 * Shows the 4-digit PIN in a dismissable toast so the user can share it.
 *
 * Event detail shape: { pin: string, mapName: string, roomId: string }
 */
export const PrivateMapPINToast = () => {
    const [toast, setToast] = useState(null); // { pin, mapName } | null
    const [copied, setCopied] = useState(false);
    const [exiting, setExiting] = useState(false);

    useEffect(() => {
        const handler = (e) => {
            const { pin, mapName } = e.detail || {};
            if (!pin) return;
            setToast({ pin, mapName: mapName || 'Mapa privado' });
            setCopied(false);
            setExiting(false);
        };
        window.addEventListener('map-pin-received', handler);
        return () => window.removeEventListener('map-pin-received', handler);
    }, []);

    const dismiss = useCallback(() => {
        setExiting(true);
        setTimeout(() => setToast(null), 350);
    }, []);

    const copyPIN = useCallback(() => {
        if (!toast) return;
        navigator.clipboard.writeText(toast.pin).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    }, [toast]);

    if (!toast) return null;

    return (
        <div
            className={`
        fixed bottom-24 left-1/2 -translate-x-1/2 z-[200]
        w-[320px] max-w-[90vw]
        transition-all duration-350 ease-out
        ${exiting ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'}
      `}
            role="alert"
            aria-live="polite"
        >
            {/* Glow backdrop */}
            <div className="absolute inset-0 rounded-2xl bg-purple-600/20 blur-xl pointer-events-none" />

            <div className="relative rounded-2xl border border-purple-500/50 bg-gray-900/95 backdrop-blur-md shadow-2xl overflow-hidden">
                {/* Top accent bar */}
                <div className="h-0.5 w-full bg-gradient-to-r from-purple-500 via-pink-400 to-purple-500" />

                <div className="p-5">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-purple-600/30 border border-purple-500/40 flex items-center justify-center">
                                <Lock size={15} className="text-purple-300" />
                            </div>
                            <div>
                                <div className="text-[10px] text-purple-400 uppercase tracking-widest font-semibold">
                                    Sala Privada Creada
                                </div>
                                <div className="text-xs text-gray-400 mt-0.5 truncate max-w-[180px]">
                                    {toast.mapName}
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={dismiss}
                            className="text-gray-500 hover:text-gray-300 transition ml-2 mt-0.5"
                            aria-label="Cerrar"
                        >
                            <X size={16} />
                        </button>
                    </div>

                    {/* PIN display */}
                    <div className="mb-4 text-center">
                        <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-2">
                            Comparte este PIN con tu equipo
                        </div>
                        <div className="flex items-center justify-center gap-2">
                            {toast.pin.split('').map((digit, i) => (
                                <div
                                    key={i}
                                    className="
                    w-14 h-16 rounded-xl
                    bg-purple-950/60 border border-purple-500/60
                    flex items-center justify-center
                    text-3xl font-bold text-white
                    shadow-lg shadow-purple-900/30
                    select-all
                  "
                                >
                                    {digit}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                        <button
                            onClick={copyPIN}
                            className={`
                flex-1 flex items-center justify-center gap-2
                py-2.5 rounded-xl text-sm font-medium
                transition-all duration-200
                ${copied
                                    ? 'bg-green-600/30 border border-green-500/50 text-green-300'
                                    : 'bg-purple-600/30 border border-purple-500/50 text-purple-200 hover:bg-purple-600/50'
                                }
              `}
                        >
                            {copied
                                ? <><Check size={14} /> PIN copiado</>
                                : <><Copy size={14} /> Copiar PIN</>
                            }
                        </button>
                        <button
                            onClick={dismiss}
                            className="
                px-4 py-2.5 rounded-xl text-sm
                bg-gray-800 border border-gray-700
                text-gray-400 hover:text-gray-200 hover:bg-gray-700
                transition-all duration-200
              "
                        >
                            Cerrar
                        </button>
                    </div>

                    <p className="text-[10px] text-gray-600 text-center mt-3">
                        El PIN expira si la sala queda vacía
                    </p>
                </div>
            </div>
        </div>
    );
};
