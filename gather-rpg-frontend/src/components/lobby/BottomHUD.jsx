import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useGameStore } from '../../store/gameStore';
import { Bell, Home } from 'lucide-react';
import SettingsMenu from '../common/SettingsMenu';

export const BottomHUD = () => {
    const { t } = useTranslation();
    const { activeChat, chatRequests, currentMapKey } = useGameStore();
    const [menuOpen, setMenuOpen] = useState(false);
    const [initialTab, setInitialTab] = useState('notifications');

    const openMenu = (tab = 'notifications') => {
        setInitialTab(tab);
        setMenuOpen(true);
    };

    const handleReturnToLobby = () => {
        window.dispatchEvent(new CustomEvent('lobby-change-map', {
            detail: { 
                targetMap: 'lobby',
                targetX: 0,
                targetY: 0
            }
        }));
    };

    const hasNotifications = chatRequests.length > 0 || activeChat;
    const isNotInLobby = currentMapKey && currentMapKey !== 'lobby';

    return (
        <>
            {/* HUD Buttons Container */}
            <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3">
                {/* Return to Lobby Button - Only visible when away */}
                {isNotInLobby && (
                    <button
                        onClick={handleReturnToLobby}
                        className="relative w-14 h-14 bg-gradient-to-r from-yellow-500 via-amber-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 border border-yellow-300 text-black shadow-[0_0_20px_rgba(245,158,11,0.25)] rounded-full transition-all duration-200 hover:scale-110 active:scale-95 flex items-center justify-center group animate-in slide-in-from-bottom-5 cursor-pointer"
                        title="Volver al Lobby"
                    >
                        <Home size={24} />
                        <span className="absolute -top-1 -right-1 bg-red-600 text-[8px] px-1.5 py-0.5 rounded font-extrabold text-white uppercase border border-red-400 shadow-md">EXIT</span>
                    </button>
                )}

                {/* Single fixed notification bell — always visible */}
                <button
                    onClick={() => openMenu('notifications')}
                    className="relative w-14 h-14 bg-black/60 backdrop-blur-md border border-white/10 hover:border-yellow-500/50 rounded-full text-gray-400 hover:text-yellow-400 shadow-2xl transition-all duration-200 hover:scale-110 active:scale-95 flex items-center justify-center group cursor-pointer"
                    title={t('lobby.hud.open_dashboard') || "Open Dashboard"}
                >
                    <Bell size={24} className={hasNotifications ? 'text-yellow-400 animate-pulse' : 'group-hover:text-yellow-400 transition-colors'} />

                    {/* Badge */}
                    {hasNotifications && (
                        <span className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-r from-yellow-500 to-amber-500 rounded-full text-[10px] font-black text-black flex items-center justify-center shadow-md animate-bounce">
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
