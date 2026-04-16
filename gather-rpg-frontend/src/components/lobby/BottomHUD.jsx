import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useGameStore } from '../../store/gameStore';
import { Bell } from 'lucide-react';
import SettingsMenu from '../common/SettingsMenu';

export const BottomHUD = () => {
    const { t } = useTranslation();
    const { activeChat, chatRequests } = useGameStore();
    const [menuOpen, setMenuOpen] = useState(false);
    const [initialTab, setInitialTab] = useState('notifications');

    const openMenu = (tab = 'notifications') => {
        setInitialTab(tab);
        setMenuOpen(true);
    };

    const hasNotifications = chatRequests.length > 0 || activeChat;

    return (
        <>
            {/* Single fixed notification bell — always visible */}
            <div className="fixed bottom-6 right-6 z-50">
                <button
                    onClick={() => openMenu('notifications')}
                    className="relative w-14 h-14 bg-gray-900/90 border border-gray-700 hover:border-blue-500/60 rounded-full text-gray-400 hover:text-white shadow-2xl backdrop-blur-md transition-all duration-200 hover:scale-110 active:scale-95 flex items-center justify-center group"
                    title={t('lobby.hud.open_dashboard')}
                >
                    <Bell size={24} className={hasNotifications ? 'text-blue-400 animate-pulse' : 'group-hover:text-blue-400 transition-colors'} />

                    {/* Badge */}
                    {hasNotifications && (
                        <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-[10px] font-bold text-white flex items-center justify-center shadow-md animate-bounce">
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
