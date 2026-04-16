import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/authStore';
import { LayoutDashboard, Map as MapIcon, Settings, LogOut, Gamepad2, Users, Terminal, ScrollText, Package, ShoppingBag } from 'lucide-react';
import { LanguageSwitcher } from '../components/common/LanguageSwitcher';

export const AdminLayout = () => {
    const { t } = useTranslation();
    const { isAdmin, logout } = useAuthStore();
    const location = useLocation();

    if (!isAdmin()) {
        return (
            <div className="h-screen w-screen bg-gray-900 flex items-center justify-center text-white">
                <div className="text-center">
                    <h1 className="text-4xl font-bold mb-4">{t('admin.access_denied.title')}</h1>
                    <p className="text-gray-400 mb-6">{t('admin.access_denied.message')}</p>
                    <Link to="/" className="bg-blue-600 px-6 py-2 rounded hover:bg-blue-500">{t('admin.access_denied.go_home')}</Link>
                </div>
            </div>
        );
    }

    const navItems = [
        { path: '/admin', label: t('admin.nav.dashboard'), icon: LayoutDashboard },
        { path: '/admin/maps', label: t('admin.nav.maps'), icon: MapIcon },
        { path: '/admin/npcs', label: t('admin.nav.npc_models'), icon: Users },
        { path: '/admin/npcsprites', label: t('admin.nav.npc_sprites'), icon: Gamepad2 },
        { path: '/admin/items', label: t('admin.nav.items'), icon: Package },
        { path: '/admin/shops', label: t('admin.nav.shops'), icon: ShoppingBag },
        { path: '/admin/missions', label: t('admin.nav.missions'), icon: ScrollText },
        { path: '/admin/ai-test', label: t('admin.nav.ai_test'), icon: Terminal },
        { path: '/admin/characters', label: t('admin.nav.characters'), icon: Gamepad2 },
    ];

    return (
        <div className="flex h-screen w-screen bg-gray-900 text-white overflow-hidden">
            {/* Sidebar */}
            <div className="w-64 flex flex-col border-r border-gray-800 bg-gray-900/50">
                <div className="p-6 border-b border-gray-800 flex items-center justify-between">
                    <h1 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500">
                        {t('admin.dashboard.title')}
                    </h1>
                    <LanguageSwitcher />
                </div>

                <nav className="flex-1 p-4 space-y-2">
                    {navItems.map(item => {
                        const Icon = item.icon;
                        const isActive = location.pathname === item.path || (item.path !== '/admin' && location.pathname.startsWith(item.path));

                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${isActive
                                    ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                                    }`}
                            >
                                <Icon size={20} />
                                <span className="font-medium">{item.label}</span>
                            </Link>
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-gray-800 space-y-2">
                    <Link to="/lobby" className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-green-400 transition-all">
                        <Gamepad2 size={20} />
                        <span className="font-medium">{t('admin.nav.back_to_game')}</span>
                    </Link>
                    <button
                        onClick={logout}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-red-400 hover:bg-red-900/10 hover:text-red-300 transition-all"
                    >
                        <LogOut size={20} />
                        <span className="font-medium">{t('admin.nav.logout')}</span>
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto bg-gray-950 custom-scrollbar">
                <div className="p-8 max-w-7xl mx-auto">
                    <Outlet />
                </div>
            </div>
        </div>
    );
};
