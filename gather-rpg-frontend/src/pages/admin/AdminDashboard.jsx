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
        <div className="bg-gray-900 border border-gray-800 p-6 rounded-xl flex items-center justify-between">
            <div>
                <p className="text-gray-400 text-sm uppercase tracking-wider mb-1">{title}</p>
                <h3 className="text-3xl font-bold text-white">{value}</h3>
            </div>
            <div className={`p-4 rounded-lg bg-opacity-20 ${color.replace('text-', 'bg-')} ${color}`}>
                <Icon size={32} />
            </div>
        </div>
    );

    return (
        <div>
            <h1 className="text-3xl font-bold text-white mb-2">{t('admin.dashboard.title')}</h1>
            <p className="text-gray-400 mb-8">{t('admin.welcome')}</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard title={t('admin.stats.total_maps')} value={stats.maps} icon={MapIcon} color="text-purple-500" />
                <StatCard title={t('admin.stats.total_users')} value="-" icon={Users} color="text-blue-500" />
                <StatCard title={t('admin.stats.server_status')} value={t('admin.stats.online')} icon={Server} color="text-green-500" />
            </div>
        </div>
    );
};
