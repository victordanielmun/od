import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useGameStore } from '../../store/gameStore';
import { Bell, Home } from 'lucide-react';
import SettingsMenu from '../common/SettingsMenu';
import { useDeviceType } from '../../hooks/useDeviceType';

export const BottomHUD = () => {
    const { t } = useTranslation();
    const { activeChat, chatRequests, currentMapKey, virtualControlsMode } = useGameStore();
    const [menuOpen, setMenuOpen] = useState(false);
    const [initialTab, setInitialTab] = useState('notifications');
    const { isTouch } = useDeviceType();

    const openMenu = (tab = 'notifications') => {
        setInitialTab(tab);
        setMenuOpen(true);
    };

    const handleReturnToLobby = () => {
        window.dispatchEvent(new CustomEvent('lobby-change-map', {
            detail: { 
                targetMap: 'lobby'
            }
        }));
    };

    const hasNotifications = chatRequests.length > 0 || activeChat;
    const isNotInLobby = currentMapKey && currentMapKey !== 'lobby';
    const showVirtualControls = virtualControlsMode === 'always' || (virtualControlsMode === 'auto' && isTouch);

    const containerClass = showVirtualControls
        ? "fixed bottom-14 left-1/2 -translate-x-1/2 z-50 flex flex-row gap-2 md:bottom-6 md:gap-3"
        : "fixed md:bottom-6 md:right-6 bottom-14 left-1/2 -translate-x-1/2 md:left-auto md:translate-x-0 z-50 flex flex-row md:flex-col gap-2 md:gap-3";

    return (
        <>
            {/* HUD Buttons Container */}
            <div className={containerClass}>
                {/* Return to Lobby Button - Only visible when away */}
                {isNotInLobby && (
                    <button
                        onClick={handleReturnToLobby}
                        className="relative w-10 h-10 md:w-14 md:h-14 bg-gradient-to-r from-yellow-500/40 via-amber-500/40 to-yellow-600/40 hover:from-yellow-500 hover:to-yellow-600 border border-yellow-300/35 text-black shadow-[0_0_15px_rgba(245,158,11,0.15)] rounded-full transition-all duration-200 hover:scale-110 active:scale-95 flex items-center justify-center group animate-in slide-in-from-bottom-5 cursor-pointer"
                        title="Volver al Lobby"
                    >
                        <Home className="w-5 h-5 md:w-6 md:h-6 text-black/80 group-hover:text-black" />
                        <span className="absolute -top-1 -right-1 bg-red-600/70 border border-red-400/40 text-[7px] md:text-[8px] px-1 md:px-1.5 py-0.5 rounded font-extrabold text-white uppercase shadow-md">EXIT</span>
                    </button>
                )}

                {/* Single fixed notification bell — always visible */}
                <button
                    onClick={() => openMenu('notifications')}
                    className="relative w-10 h-10 md:w-14 md:h-14 bg-black/35 backdrop-blur-sm border border-white/5 hover:border-yellow-500/30 rounded-full text-gray-400/80 hover:text-yellow-400 shadow-xl transition-all duration-200 hover:scale-110 active:scale-95 flex items-center justify-center group cursor-pointer"
                    title={t('lobby.hud.open_dashboard') || "Open Dashboard"}
                >
                    <Bell className={`w-5 h-5 md:w-6 md:h-6 ${hasNotifications ? 'text-yellow-400/80 animate-pulse' : 'group-hover:text-yellow-400 transition-colors'}`} />

                    {/* Badge */}
                    {hasNotifications && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 md:w-5 md:h-5 bg-gradient-to-r from-yellow-500/80 to-amber-500/80 rounded-full text-[8px] md:text-[10px] font-black text-black flex items-center justify-center shadow-md animate-bounce">
                            {chatRequests.length > 0 ? chatRequests.length : '!'}
                        </span>
                    )}
                </button>
            </div>

            {/* Universal Dashboard Modal */}
            {menuOpen && (
                <SettingsMenu
                    initialTab={initialTab}
                    onClose={() => setMenuOpen(false)}
                />
            )}
        </>
    );
};
