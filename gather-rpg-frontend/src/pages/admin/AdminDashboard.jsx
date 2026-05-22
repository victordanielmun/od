import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import { Map as MapIcon, Users, Server } from 'lucide-react';

export const AdminDashboard = () => {
    const { t } = useTranslation();
    const [stats, setStats] = useState({ maps: 0, users: 0, online: 0 });

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await api.get('/admin/maps'); 
                if (res.data && Array.isArray(res.data)) {
                    setStats(s => ({ ...s, maps: res.data.length }));
                }
            } catch (e) {
                console.error("Failed to load stats", e);
            }
        };
        fetchStats();
    }, []);

    const StatCard = ({ title, value, icon: Icon, color }) => (
        <div className="bg-black/40 backdrop-blur-md border border-white/10 p-6 rounded-2xl flex items-center justify-between shadow-2xl relative overflow-hidden">
            <div className="relative z-10">
                <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">{title}</p>
                <h3 className="text-3xl font-extrabold text-white font-medieval">{value}</h3>
            </div>
            <div className={`p-4 rounded-xl bg-opacity-10 relative z-10 ${color.replace('text-', 'bg-')} ${color} border border-white/5`}>
                <Icon size={28} />
            </div>
        </div>
    );

    return (
        <div>
            <h1 className="text-3xl font-extrabold tracking-wider bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500 bg-clip-text text-transparent uppercase font-medieval mb-2 drop-shadow-md">
                {t('admin.dashboard.title')}
            </h1>
            <p className="text-gray-400 text-sm mb-8">{t('admin.welcome')}</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard title={t('admin.stats.total_maps')} value={stats.maps} icon={MapIcon} color="text-purple-400" />
                <StatCard title={t('admin.stats.total_users')} value="-" icon={Users} color="text-blue-400" />
                <StatCard title={t('admin.stats.server_status')} value={t('admin.stats.online')} icon={Server} color="text-emerald-400" />
            </div>
        </div>
    );
};
