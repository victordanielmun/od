import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { Map as MapIcon, Plus, Search, Edit2, Trash2 } from 'lucide-react';
import { CreateMapModal } from '../../components/admin/CreateMapModal';

export const AdminMapList = () => {
    const { t } = useTranslation();
    const [maps, setMaps] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        loadMaps();
    }, []);

    const loadMaps = async () => {
        try {
            const res = await api.get('/admin/maps');
            setMaps(res.data);
        } catch (error) {
            console.error("Failed to load maps:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (sceneKey) => {
        navigate(`/lobby?edit_map=${sceneKey}`);
    };

    const handleCreateMap = async (formData) => {
        try {
            const mapData = {
                width: Number(formData.width),
                height: Number(formData.height),
                defaultSpawnX: Number(formData.spawnX),
                defaultSpawnY: Number(formData.spawnY),
                bgmTrack: formData.bgmTrack
            };

            await api.post('/admin/maps', {
                scene_key: formData.sceneKey,
                walls_json: JSON.stringify({
                    width: mapData.width,
                    height: mapData.height,
                    defaultSpawnX: mapData.defaultSpawnX,
                    defaultSpawnY: mapData.defaultSpawnY,
                    walls: [],
                    floors: [],
                    forest: [],
                    builds: [],
                    spawns: [],
                    npcZones: [],
                    pickups: [],
                    voids: [],
                    colliders: [],
                    enemySpawns: []
                }),
                map_data: mapData,
                is_public: true,
                max_users: 50
            });

            setIsCreateModalOpen(false);
            loadMaps();
            // Optional: Auto-navigate to editor
            // navigate(`/lobby?edit_map=${formData.sceneKey}`);
        } catch (error) {
            console.error("Failed to create map:", error);
            alert("Error al crear el mapa: " + (error.response?.data?.error || error.message));
        }
    };

    const handleDelete = async (id, sceneKey) => {
        if (!window.confirm(`Are you sure you want to delete the map "${sceneKey}"? This will also delete all associated NPCs and Pickups.`)) {
            return;
        }

        try {
            await api.delete(`/admin/maps/${id}`);
            loadMaps();
        } catch (error) {
            console.error("Failed to delete map:", error);
            alert("Failed to delete map. Check console for details.");
        }
    };

    const filteredMaps = maps.filter(m => 
        m.scene_key.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="animate-fade-in">
            <div className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-3">
                    <MapIcon size={28} className="text-yellow-400" />
                    <div>
                        <h1 className="text-3xl font-bold text-white mb-2">{t('admin.maps.title')}</h1>
                        <p className="text-gray-400">{t('admin.maps.subtitle')}</p>
                    </div>
                </div>
                <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-all shadow-lg hover:shadow-green-500/20"
                >
                    <Plus size={20} />
                    {t('admin.maps.new_map')}
                </button>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <div className="p-4 border-b border-gray-800 flex gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                        <input
                            type="text"
                            placeholder={t('admin.maps.search_placeholder')}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full bg-gray-950 border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-gray-300 focus:border-blue-500 focus:outline-none"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-gray-950 text-gray-400 text-xs uppercase tracking-wider">
                                <th className="px-6 py-4 font-medium">Map / Scene Key</th>
                                <th className="px-6 py-4 font-medium">Last Updated</th>
                                <th className="px-6 py-4 font-medium text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800">
                            {loading ? (
                                <tr><td colSpan="3" className="px-6 py-8 text-center text-gray-500">Loading maps...</td></tr>
                            ) : maps.length === 0 ? (
                                <tr><td colSpan="3" className="px-6 py-8 text-center text-gray-500">No maps found.</td></tr>
                            ) : (
                                maps.map((map) => (
                                    <tr key={map.id} className="hover:bg-gray-800/50 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded bg-blue-900/30 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold">
                                                    {map.scene_key.substring(0, 2).toUpperCase()}
                                                </div>
                                                <span className="font-medium text-white">{map.scene_key}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-gray-400 text-sm">
                                            {new Date(map.updated_at).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => handleEdit(map.scene_key)}
                                                className="text-blue-400 hover:text-white bg-blue-900/20 hover:bg-blue-600 px-3 py-1.5 rounded text-sm font-medium transition-all mr-2"
                                            >
                                                Edit Map
                                            </button>
                                            <button
                                                onClick={() => handleDelete(map.id, map.scene_key)}
                                                className="text-red-400 hover:text-white bg-red-900/20 hover:bg-red-600 px-3 py-1.5 rounded text-sm font-medium transition-all"
                                                title="Delete Map"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <CreateMapModal 
                isOpen={isCreateModalOpen} 
                onClose={() => setIsCreateModalOpen(false)} 
                onSubmit={handleCreateMap} 
            />
        </div>
    );
};
