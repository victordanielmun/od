import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/authStore';
import { LayoutDashboard, Map as MapIcon, Settings, LogOut, Gamepad2, Users, Terminal, ScrollText, Package, ShoppingBag, Swords, Brain, MessageSquare } from 'lucide-react';
import { LanguageSwitcher } from '../components/common/LanguageSwitcher';

export const AdminLayout = () => {
    const { t } = useTranslation();
    const { isAdmin, logout } = useAuthStore();
    const location = useLocation();

    if (!isAdmin()) {
        return (
            <div className="h-screen w-screen bg-gradient-to-br from-gray-950 via-indigo-950 to-gray-950 flex items-center justify-center text-white relative overflow-hidden font-sans">
                {/* Decorative backdrop glow elements */}
                <div className="absolute top-20 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>
                <div className="absolute bottom-20 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none"></div>

                <div className="bg-black/40 backdrop-blur-md border border-white/10 p-8 rounded-2xl shadow-2xl relative overflow-hidden max-w-md w-full text-center z-10">
                    <h1 className="text-3xl font-extrabold tracking-wider bg-gradient-to-r from-red-500 via-orange-400 to-red-600 bg-clip-text text-transparent uppercase font-medieval mb-4">
                        {t('admin.access_denied.title')}
                    </h1>
                    <p className="text-gray-400 mb-6 text-sm">
                        {t('admin.access_denied.message')}
                    </p>
                    <Link to="/" className="inline-block bg-gradient-to-r from-yellow-500 via-amber-500 to-yellow-600 hover:shadow-[0_0_15px_rgba(245,158,11,0.4)] text-black font-extrabold px-6 py-2.5 rounded-xl transition-all font-medieval uppercase tracking-wider border border-yellow-300">
                        {t('admin.access_denied.go_home')}
                    </Link>
                </div>
            </div>
        );
    }

    const navItems = [
        { path: '/admin', label: t('admin.nav.dashboard'), icon: LayoutDashboard },
        { path: '/admin/maps', label: t('admin.nav.maps'), icon: MapIcon },
        { path: '/admin/challenges', label: t('admin.nav.challenges'), icon: Brain },
        { path: '/admin/npcs', label: t('admin.nav.npc_models'), icon: Users },
        { path: '/admin/npcsprites', label: t('admin.nav.npc_sprites'), icon: Gamepad2 },
        { path: '/admin/items', label: t('admin.nav.items'), icon: Package },
        { path: '/admin/shops', label: t('admin.nav.shops'), icon: ShoppingBag },
        { path: '/admin/missions', label: t('admin.nav.missions'), icon: ScrollText },
        { path: '/admin/enemy-models', label: t('admin.nav.enemy_models'), icon: Swords },
        { path: '/admin/enemies', label: t('admin.nav.enemy_visualizer'), icon: Gamepad2 },
        { path: '/admin/ai-test', label: t('admin.nav.ai_test'), icon: Terminal },
        { path: '/admin/characters', label: t('admin.nav.characters'), icon: Gamepad2 },
        { path: '/admin/whatsapp', label: 'WhatsApp', icon: MessageSquare },
    ];

    return (
        <div className="flex h-screen w-screen bg-gradient-to-br from-gray-950 via-indigo-950 to-gray-950 text-white overflow-hidden font-sans relative">
            {/* Decorative backdrop glow elements */}
            <div className="absolute top-20 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>
            <div className="absolute bottom-20 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none"></div>

            {/* Sidebar */}
            <div className="w-64 flex flex-col border-r border-white/10 bg-black/40 backdrop-blur-md relative z-10">
                <div className="p-6 border-b border-white/10 flex items-center justify-between">
                    <h1 className="text-xl font-bold bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500 bg-clip-text text-transparent uppercase font-medieval drop-shadow-md">
                        {t('admin.dashboard.title')}
                    </h1>
                    <LanguageSwitcher />
                </div>

                <nav className="flex-1 p-4 space-y-2 overflow-y-auto custom-scrollbar">
                    {navItems.map(item => {
                        const Icon = item.icon;
                        const isActive = location.pathname === item.path || (item.path !== '/admin' && location.pathname.startsWith(item.path));

                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all border ${isActive
                                    ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30 shadow-[0_0_10px_rgba(245,158,11,0.1)] font-medieval uppercase text-xs tracking-wider'
                                    : 'text-gray-400 border-transparent hover:bg-white/5 hover:text-white'
                                    }`}
                            >
                                <Icon size={18} />
                                <span>{item.label}</span>
                            </Link>
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-white/10 space-y-2">
                    <Link to="/lobby" className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-400 hover:bg-emerald-500/10 hover:text-emerald-400 border border-transparent hover:border-emerald-500/20 transition-all font-medieval uppercase text-xs tracking-wider">
                        <Gamepad2 size={18} />
                        <span>{t('admin.nav.back_to_game')}</span>
                    </Link>
                    <button
                        onClick={logout}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-400 hover:bg-red-500/10 hover:text-red-300 border border-transparent hover:border-red-500/20 transition-all font-medieval uppercase text-xs tracking-wider"
                    >
                        <LogOut size={18} />
                        <span>{t('admin.nav.logout')}</span>
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto bg-transparent custom-scrollbar relative z-10">
                <div className="p-8 max-w-7xl mx-auto">
                    <Outlet />
                </div>
            </div>
        </div>
    );
};
