import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { Map as MapIcon, Plus, Search, Edit2, Trash2, ArrowUpDown, Eye, Globe } from 'lucide-react';
import { CreateMapModal } from '../../components/admin/CreateMapModal';

// "pronoun_village" -> "Pronoun Village". Mejor que nada para mapas sin
// mision propia (ej. lobby, castle); los que sí tienen mision usan su
// `title` (ya pensado para verse bien), ver displayNameFor().
const humanizeSceneKey = (key) =>
    (key || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const UNASSIGNED_WORLD = '__unassigned__';

export const AdminMapList = () => {
    const { t } = useTranslation();
    const [maps, setMaps] = useState([]);
    const [missionsByScene, setMissionsByScene] = useState({});
    const [worlds, setWorlds] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [sortBy, setSortBy] = useState('name_asc');
    const [visibility, setVisibility] = useState('all');
    const [worldFilter, setWorldFilter] = useState('all');
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        loadMaps();
    }, []);

    const loadMaps = async () => {
        try {
            const [mapsRes, missionsRes, worldsRes] = await Promise.all([
                api.get('/admin/maps'),
                api.get('/admin/missions').catch(() => ({ data: [] })),
                api.get('/admin/worlds').catch(() => ({ data: [] })),
            ]);
            setMaps(mapsRes.data);
            // map_configs no tiene world_id propio -- se deriva de la mision
            // que comparte su scene_key (missions.scene_key + missions.world_id).
            const bySceneKey = {};
            for (const m of missionsRes.data || []) {
                bySceneKey[m.scene_key] = m;
            }
            setMissionsByScene(bySceneKey);
            setWorlds(worldsRes.data || []);
        } catch (error) {
            console.error("Failed to load maps:", error);
        } finally {
            setLoading(false);
        }
    };

    const worldNameById = useMemo(() => {
        const out = {};
        for (const w of worlds) out[w.id] = w.name;
        return out;
    }, [worlds]);

    // Nombre creativo: el titulo de la mision si el mapa tiene una (ya
    // pensado para verse bien, ej. "El examen final: vence a Gorgak"),
    // si no, la scene_key humanizada (mapas de transito sin mision, como
    // "lobby" o "castle").
    const displayNameFor = (map) => missionsByScene[map.scene_key]?.title || humanizeSceneKey(map.scene_key);
    const worldIdFor = (map) => missionsByScene[map.scene_key]?.world_id ?? null;

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

    const displayedMaps = maps
        .filter(m => {
            const q = search.toLowerCase();
            return m.scene_key.toLowerCase().includes(q) || displayNameFor(m).toLowerCase().includes(q);
        })
        .filter(m => visibility === 'all' || (visibility === 'public' ? m.is_public : !m.is_public))
        .filter(m => {
            if (worldFilter === 'all') return true;
            const worldId = worldIdFor(m);
            if (worldFilter === UNASSIGNED_WORLD) return worldId == null;
            return String(worldId) === worldFilter;
        })
        .slice() // avoid mutating state with sort
        .sort((a, b) => {
            switch (sortBy) {
                case 'name_desc':    return displayNameFor(b).localeCompare(displayNameFor(a));
                case 'updated_desc': return new Date(b.updated_at) - new Date(a.updated_at);
                case 'updated_asc':  return new Date(a.updated_at) - new Date(b.updated_at);
                case 'name_asc':
                default:             return displayNameFor(a).localeCompare(displayNameFor(b));
            }
        });

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
                <div className="p-4 border-b border-gray-800 flex flex-col md:flex-row gap-4">
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
                    <div className="relative">
                        <Eye className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" size={16} />
                        <select
                            value={visibility}
                            onChange={(e) => setVisibility(e.target.value)}
                            className="appearance-none bg-gray-950 border border-gray-700 rounded-lg pl-9 pr-8 py-2 text-sm text-gray-300 focus:border-blue-500 focus:outline-none cursor-pointer"
                        >
                            <option value="all">{t('admin.maps.filter_all') || 'Todas'}</option>
                            <option value="public">{t('admin.maps.filter_public') || 'Públicas'}</option>
                            <option value="private">{t('admin.maps.filter_private') || 'Privadas'}</option>
                        </select>
                    </div>
                    <div className="relative">
                        <Globe className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" size={16} />
                        <select
                            value={worldFilter}
                            onChange={(e) => setWorldFilter(e.target.value)}
                            className="appearance-none bg-gray-950 border border-gray-700 rounded-lg pl-9 pr-8 py-2 text-sm text-gray-300 focus:border-blue-500 focus:outline-none cursor-pointer"
                        >
                            <option value="all">{t('admin.maps.filter_world_all') || 'Todos los mundos'}</option>
                            <option value={UNASSIGNED_WORLD}>{t('admin.maps.filter_world_unassigned') || 'Sin mundo asignado'}</option>
                            {worlds.map(w => (
                                <option key={w.id} value={String(w.id)}>{w.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="relative">
                        <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" size={16} />
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            className="appearance-none bg-gray-950 border border-gray-700 rounded-lg pl-9 pr-8 py-2 text-sm text-gray-300 focus:border-blue-500 focus:outline-none cursor-pointer"
                        >
                            <option value="name_asc">{t('admin.maps.sort_name_asc') || 'Nombre (A-Z)'}</option>
                            <option value="name_desc">{t('admin.maps.sort_name_desc') || 'Nombre (Z-A)'}</option>
                            <option value="updated_desc">{t('admin.maps.sort_updated_desc') || 'Recientes primero'}</option>
                            <option value="updated_asc">{t('admin.maps.sort_updated_asc') || 'Antiguos primero'}</option>
                        </select>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-gray-950 text-gray-400 text-xs uppercase tracking-wider">
                                <th className="px-6 py-4 font-medium">Map / Scene Key</th>
                                <th className="px-6 py-4 font-medium">{t('admin.maps.table.world') || 'Mundo'}</th>
                                <th className="px-6 py-4 font-medium">Last Updated</th>
                                <th className="px-6 py-4 font-medium text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800">
                            {loading ? (
                                <tr><td colSpan="4" className="px-6 py-8 text-center text-gray-500">Loading maps...</td></tr>
                            ) : displayedMaps.length === 0 ? (
                                <tr><td colSpan="4" className="px-6 py-8 text-center text-gray-500">No maps found.</td></tr>
                            ) : (
                                displayedMaps.map((map) => {
                                    const name = displayNameFor(map);
                                    const worldId = worldIdFor(map);
                                    const worldName = worldId != null ? worldNameById[worldId] : null;
                                    return (
                                    <tr key={map.id} className="hover:bg-gray-800/50 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded bg-blue-900/30 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold shrink-0">
                                                    {name.substring(0, 2).toUpperCase()}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-white">{name}</span>
                                                    <span className="text-xs text-gray-500">{map.scene_key}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {worldName ? (
                                                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-purple-300 bg-purple-900/30 border border-purple-500/30 px-2.5 py-1 rounded-full">
                                                    <Globe size={12} />
                                                    {worldName}
                                                </span>
                                            ) : (
                                                <span className="text-xs text-gray-500 italic">
                                                    {t('admin.maps.filter_world_unassigned') || 'Sin mundo asignado'}
                                                </span>
                                            )}
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
                                    );
                                })
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
