import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollText, Plus, Trash2, Edit2, ChevronDown, ChevronUp, Target, User, MapPin, List, MessageSquare, Mic, Box, Sword, Send, Search, Hammer, Music, ArrowUpDown, SlidersHorizontal } from 'lucide-react';
import api from '../../services/api';

const slugify = (text) => {
    return text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')     // Replace spaces with -
        .replace(/[^\w-]+/g, '')   // Remove all non-word chars
        .replace(/--+/g, '-');    // Replace multiple - with single -
};

export const AdminMissions = () => {
    const { t } = useTranslation();

    // NOTE: 'find_items' (multi-item at the MISSION level) was removed: a mission
    // only stores ONE objective_target, so it could never really hold several
    // items. The supported way to require multiple items is one TASK per item
    // (bring_item / collect_items, each with its own quantity). Legacy missions
    // already saved as 'find_items' still render via the fallback option below.
    const MISSION_TYPES = [
        { value: 'talk_to_npc', label: t('admin.missions.types.talk_to_npc') },
        { value: 'find_item', label: t('admin.missions.types.find_item') },
        { value: 'defeat_enemy', label: t('admin.missions.types.defeat_enemy') },
        { value: 'kill_all', label: t('admin.missions.types.kill_all') },
        { value: 'kill_boss', label: t('admin.missions.types.kill_boss') },
        { value: 'deliver_message', label: t('admin.missions.types.deliver_message') },
        { value: 'pronunciation_challenge', label: t('admin.missions.types.pronunciation_challenge') }
    ];

    const TASK_TYPES = [
        { value: 'talk_to_npc', label: t('admin.missions.types.talk_to_npc'), icon: MessageSquare },
        { value: 'bring_item', label: t('admin.missions.types.bring_item'), icon: Box },
        { value: 'find_item', label: t('admin.missions.types.find_item'), icon: Search },
        { value: 'collect_items', label: t('admin.missions.types.collect_items'), icon: List },
        { value: 'defeat_enemy', label: t('admin.missions.types.defeat_enemy'), icon: Sword },
        { value: 'kill_boss', label: t('admin.missions.types.kill_boss'), icon: Target },
        { value: 'kill_all', label: t('admin.missions.types.kill_all'), icon: Sword },
        { value: 'pronunciation_threshold', label: t('admin.missions.types.pronunciation'), icon: Mic },
        { value: 'karaoke', label: t('admin.missions.types.karaoke'), icon: Music },
        { value: 'deliver_message', label: t('admin.missions.types.deliver_msg'), icon: Send }
    ];
    const [missions, setMissions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [expandedMission, setExpandedMission] = useState(null);
    const [tasks, setTasks] = useState({}); // missionId -> tasks[]
    const [npcs, setNpcs] = useState([]);
    const [items, setItems] = useState([]);
    const [enemies, setEnemies] = useState([]);
    const [maps, setMaps] = useState([]);

    // Search / filter / sort for the mission list
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [difficultyFilter, setDifficultyFilter] = useState('all');
    const [sortBy, setSortBy] = useState('title_asc');
    
    const [isMissionModalOpen, setIsMissionModalOpen] = useState(false);
    const [editingMission, setEditingMission] = useState(null);
    const [missionFormData, setMissionFormData] = useState({ 
        title: '', 
        scene_key: 'lobby', 
        description_en: '', 
        objective_en: '', 
        type: 'talk_to_npc', 
        status: 'active',
        mode: 'individual',
        difficulty: 'beginner',
        reward_item_id: '',
        reward_quantity: 0,
        reward_gold: 0,
        reward_xp: 0,
        advance_gold: 0,
        objective_target: ''
    });

    const [mapNPCs, setMapNPCs] = useState([]);
    const [loadingMapNPCs, setLoadingMapNPCs] = useState(false);
    const [mapEnemiesCount, setMapEnemiesCount] = useState(0);
    const [npcInstanceEdits, setNpcInstanceEdits] = useState({ instructions: '', success_message: '', greeting: '' });
    const loadedNpcIdRef = useRef(null); // which NPC's config is currently loaded in the task form

    const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
    const [editingTask, setEditingTask] = useState(null);
    const [activeMissionId, setActiveMissionId] = useState(null);
    const [taskFormData, setTaskFormData] = useState({
        type: 'talk_to_npc',
        description_en: '',
        order: 0,
        target_npc_template_id: '',
        required_item: '',
        required_quantity: 1,
        required_items: [],
        required_enemy: '',
        required_kills: 1,
        pronunciation_min_score: 80,
        target_phrase_en: '',
        message_to_deliver: '',
        karaoke_lines: [] // array of strings in the form; serialized to [{order,line}] on submit
    });

    const fetchData = async () => {
        try {
            setLoading(true);
            const [missionRes, npcRes, itemRes, enemyRes, mapsRes] = await Promise.all([
                api.get('/admin/missions'),
                api.get('/admin/npc-definitions'),
                api.get('/admin/items'),
                api.get('/admin/enemies'),
                api.get('/admin/maps')
            ]);
            setMissions(missionRes.data);
            setNpcs(npcRes.data);
            setItems(itemRes.data || []);
            setEnemies(enemyRes.data || []);
            setMaps(mapsRes.data || []);
            setError(null);
        } catch (err) {
            setError(t('admin.missions.errors.loading'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Fetch NPCs for the selected map context
    useEffect(() => {
        const fetchMapNPCs = async () => {
            if (!missionFormData.scene_key) return;
            try {
                setLoadingMapNPCs(true);
                const res = await api.get(`/admin/npc-instances?scene_key=${missionFormData.scene_key}`);
                setMapNPCs(res.data || []);
                try {
                    const mapRes = await api.get(`/maps/config?scene_key=${missionFormData.scene_key}`);
                    if (mapRes.data && mapRes.data.map_data) {
                        const mapData = JSON.parse(mapRes.data.map_data);
                        setMapEnemiesCount(mapData.enemies ? mapData.enemies.length : 0);
                    } else {
                        setMapEnemiesCount(0);
                    }
                } catch(e) {
                    setMapEnemiesCount(0);
                }
            } catch (err) {
                console.error("Error fetching map NPCs:", err);
            } finally {
                setLoadingMapNPCs(false);
            }
        };
        fetchMapNPCs();
    }, [missionFormData.scene_key]);



    // Reactively load the selected NPC's instructions/success/greeting into the form.
    // These fields belong to the NPC (template), not the task. We must RELOAD them when
    // the target NPC changes — otherwise the previous task's NPC config lingered in the
    // form and got written to the new NPC on save (so every task ended up with the last
    // task's data). loadedNpcIdRef tracks which NPC is currently loaded so we reload on
    // a change but preserve manual edits while the same NPC stays selected.
    useEffect(() => {
        if (!isTaskModalOpen) {
            loadedNpcIdRef.current = null; // reset so the next open reloads fresh
            return;
        }
        const npcId = taskFormData.target_npc_template_id ? String(taskFormData.target_npc_template_id) : '';
        if (npcId !== loadedNpcIdRef.current) {
            loadedNpcIdRef.current = npcId;
            const npc = npcId ? mapNPCs.find(n => String(n.id) === npcId) : null;
            setNpcInstanceEdits({
                instructions: npc?.instructions || '',
                success_message: npc?.success_message || '',
                greeting: npc?.greeting || ''
            });
        }
    }, [isTaskModalOpen, taskFormData.target_npc_template_id, mapNPCs]);

    const toggleMission = async (missionId) => {
        if (expandedMission === missionId) {
            setExpandedMission(null);
            return;
        }
        setExpandedMission(missionId);
        if (!tasks[missionId]) {
            try {
                const res = await api.get(`/admin/missions/${missionId}/tasks`);
                setTasks(prev => ({ ...prev, [missionId]: res.data }));
            } catch (err) {
                console.error("Error loading tasks:", err);
            }
        }
    };

    const handleMissionSubmit = async (e) => {
        e.preventDefault();
        const payload = { ...missionFormData };
        // Convert empty reward_item_id to null for backend UUID parsing
        if (!payload.reward_item_id || payload.reward_item_id === "") {
            payload.reward_item_id = null;
        }

        try {
            if (editingMission) {
                await api.put(`/admin/missions/${editingMission.id}`, payload);
            } else {
                await api.post('/admin/missions', payload);
            }
            setIsMissionModalOpen(false);
            fetchData();
        } catch (err) {
            setError(t('admin.missions.errors.save_mission'));
        }
    };

    const handleTaskSubmit = async (e) => {
        e.preventDefault();
        const payload = { ...taskFormData };
        if (payload.target_npc_template_id) payload.target_npc_template_id = parseInt(payload.target_npc_template_id);
        else payload.target_npc_template_id = null;

        // Karaoke: the form keeps lyric lines as a flat string array; the backend
        // stores them as ordered objects ([{order, line}]). Drop empty lines.
        if (payload.type === 'karaoke') {
            payload.karaoke_lines = (payload.karaoke_lines || [])
                .map(l => (typeof l === 'string' ? l : l?.line || '').trim())
                .filter(Boolean)
                .map((line, i) => ({ order: i + 1, line }));
        } else {
            // Non-karaoke tasks must not carry a partial lyric list.
            delete payload.karaoke_lines;
        }

        try {
            if (editingTask) {
                await api.put(`/admin/tasks/${editingTask.id}`, payload);
            } else {
                await api.post(`/admin/missions/${activeMissionId}/tasks`, payload);
            }

            // If an NPC is selected, save its instance instructions too (PATCH only updates instructions, not missions)
            if (payload.target_npc_template_id && (npcInstanceEdits.instructions !== undefined || npcInstanceEdits.success_message !== undefined)) {
                try {
                    await api.patch(`/admin/npc-templates/${payload.target_npc_template_id}/instructions`, {
                        instructions: npcInstanceEdits.instructions,
                        success_message: npcInstanceEdits.success_message,
                        greeting: npcInstanceEdits.greeting
                    });
                } catch (npcErr) {
                    console.warn('[AdminMissions] Could not save NPC instance instructions:', npcErr);
                }
            }

            setIsTaskModalOpen(false);
            // Refresh tasks for this mission
            const res = await api.get(`/admin/missions/${activeMissionId}/tasks`);
            setTasks(prev => ({ ...prev, [activeMissionId]: res.data }));
        } catch (err) {
            setError(t('admin.missions.errors.save_task'));
        }
    };

    const deleteTask = async (missionId, taskId) => {
        if (!window.confirm(t('admin.missions.delete_task_confirm'))) return;
        try {
            await api.delete(`/admin/tasks/${taskId}`);
            const res = await api.get(`/admin/missions/${missionId}/tasks`);
            setTasks(prev => ({ ...prev, [missionId]: res.data }));
        } catch (err) {
            setError(t('admin.missions.errors.delete_task'));
        }
    };

    const deleteMission = async (missionId) => {
        if (!window.confirm(t('admin.missions.delete_confirm') || '¿Estás seguro de que quieres eliminar esta misión?')) return;
        try {
            await api.delete(`/admin/missions/${missionId}`);
            fetchData();
        } catch (err) {
            setError(t('admin.missions.errors.delete_mission') || 'Error al eliminar misión');
        }
    };

    const diffRank = { beginner: 1, intermediate: 2, advanced: 3 };
    const displayedMissions = missions
        .filter(m => {
            const q = search.toLowerCase();
            return (m.title || '').toLowerCase().includes(q) || (m.scene_key || '').toLowerCase().includes(q);
        })
        .filter(m => statusFilter === 'all' || m.status === statusFilter)
        .filter(m => difficultyFilter === 'all' || (m.difficulty || 'beginner') === difficultyFilter)
        .slice()
        .sort((a, b) => {
            switch (sortBy) {
                case 'title_desc':      return (b.title || '').localeCompare(a.title || '');
                case 'difficulty_asc':  return (diffRank[a.difficulty] || 1) - (diffRank[b.difficulty] || 1);
                case 'difficulty_desc': return (diffRank[b.difficulty] || 1) - (diffRank[a.difficulty] || 1);
                case 'scene':           return (a.scene_key || '').localeCompare(b.scene_key || '');
                case 'title_asc':
                default:                return (a.title || '').localeCompare(b.title || '');
            }
        });

    return (
        <div className="space-y-6 pb-20">
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                    <ScrollText size={28} className="text-orange-400" />
                    <div>
                        <h1 className="text-2xl font-bold text-white">{t('admin.missions.title')}</h1>
                        <p className="text-gray-400 text-sm">{t('admin.missions.subtitle')}</p>
                    </div>
                </div>
                <button 
                    onClick={() => { 
                        setEditingMission(null); 
                        setMissionFormData({ 
                            title: '', 
                            scene_key: maps[0]?.scene_key || 'lobby', 
                            description_en: '', 
                            objective_en: '', 
                            type: 'talk_to_npc',
                            status: 'active',
                            mode: 'individual',
                            difficulty: 'beginner',
                            reward_item_id: '',
                            reward_quantity: 0,
                            reward_gold: 0,
                            reward_xp: 0,
                            advance_gold: 0,
                            objective_target: ''
                        });
                        setIsMissionModalOpen(true);
                    }}
                    className="bg-orange-600 hover:bg-orange-500 text-white px-4 py-2 rounded-lg font-bold transition-all shadow-lg active:scale-95 flex items-center gap-2"
                >
                    <Plus size={20} /> {t('admin.missions.new_mission')}
                </button>
            </div>

            {/* Search / Filter / Sort toolbar */}
            <div className="flex flex-col md:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                    <input
                        type="text"
                        placeholder={t('admin.missions.search_placeholder') || 'Buscar por título o escena...'}
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-sm text-gray-200 focus:border-orange-500 focus:outline-none"
                    />
                </div>
                <div className="relative">
                    <SlidersHorizontal className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" size={16} />
                    <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                        className="appearance-none bg-gray-900 border border-gray-700 rounded-lg pl-9 pr-8 py-2 text-sm text-gray-200 focus:border-orange-500 focus:outline-none cursor-pointer">
                        <option value="all">{t('admin.missions.filter_all_status') || 'Todos los estados'}</option>
                        <option value="active">{t('admin.missions.form.active') || 'Activa'}</option>
                        <option value="inactive">{t('admin.missions.form.inactive') || 'Inactiva'}</option>
                    </select>
                </div>
                <div className="relative">
                    <Target className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" size={16} />
                    <select value={difficultyFilter} onChange={e => setDifficultyFilter(e.target.value)}
                        className="appearance-none bg-gray-900 border border-gray-700 rounded-lg pl-9 pr-8 py-2 text-sm text-gray-200 focus:border-orange-500 focus:outline-none cursor-pointer">
                        <option value="all">{t('admin.missions.filter_all_difficulty') || 'Toda dificultad'}</option>
                        <option value="beginner">{t('admin.missions.form.difficulty_beginner') || 'Principiante'}</option>
                        <option value="intermediate">{t('admin.missions.form.difficulty_intermediate') || 'Intermedio'}</option>
                        <option value="advanced">{t('admin.missions.form.difficulty_advanced') || 'Avanzado'}</option>
                    </select>
                </div>
                <div className="relative">
                    <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" size={16} />
                    <select value={sortBy} onChange={e => setSortBy(e.target.value)}
                        className="appearance-none bg-gray-900 border border-gray-700 rounded-lg pl-9 pr-8 py-2 text-sm text-gray-200 focus:border-orange-500 focus:outline-none cursor-pointer">
                        <option value="title_asc">{t('admin.missions.sort_title_asc') || 'Título (A-Z)'}</option>
                        <option value="title_desc">{t('admin.missions.sort_title_desc') || 'Título (Z-A)'}</option>
                        <option value="difficulty_asc">{t('admin.missions.sort_difficulty_asc') || 'Dificultad ↑'}</option>
                        <option value="difficulty_desc">{t('admin.missions.sort_difficulty_desc') || 'Dificultad ↓'}</option>
                        <option value="scene">{t('admin.missions.sort_scene') || 'Escena'}</option>
                    </select>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-400"></div></div>
            ) : displayedMissions.length === 0 ? (
                <div className="py-12 text-center text-gray-500 bg-gray-800/20 rounded-2xl border-2 border-dashed border-gray-800">
                    <ScrollText className="mx-auto mb-3 opacity-20" size={48} />
                    <p>{t('admin.missions.no_results') || 'No hay misiones que coincidan con el filtro.'}</p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {displayedMissions.map(mission => (
                        <div key={mission.id} className="bg-gray-800/50 border border-gray-700/50 rounded-2xl overflow-hidden backdrop-blur-sm transition-all hover:bg-gray-800/80">
                            <div className="p-4 flex items-center justify-between">
                                <div className="flex items-center gap-4 flex-1 cursor-pointer" onClick={() => toggleMission(mission.id)}>
                                    <div className={`p-3 rounded-xl ${
                                        mission.type === 'main' ? 'bg-orange-500/10 text-orange-400' : 
                                        mission.type === 'kill_boss' ? 'bg-red-500/10 text-red-400' :
                                        mission.type === 'find_item' ? 'bg-yellow-500/10 text-yellow-400' :
                                        'bg-blue-500/10 text-blue-400'
                                    }`}>
                                        {mission.type === 'kill_boss' ? <Sword size={24} /> : 
                                         mission.type === 'find_item' ? <Search size={24} /> : 
                                         <Target size={24} />}
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-white">{mission.title}</h3>
                                        <div className="flex items-center gap-3 mt-1">
                                            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider flex items-center gap-1 bg-gray-900/50 px-2 py-0.5 rounded border border-white/5">
                                                <MapPin size={10} /> {mission.scene_key}
                                            </span>
                                            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${mission.status === 'active' ? 'bg-green-500/10 text-green-400' : 'bg-gray-700 text-gray-400'}`}>
                                                {mission.status}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <button 
                                        onClick={() => {
                                            const url = `/game?edit_map=${mission.scene_key}&edit_mode=true`;
                                            window.open(url, '_blank');
                                        }}
                                        title={t('admin.missions.design_map')}
                                        className="p-2 text-blue-400 hover:text-white hover:bg-blue-400/10 rounded-lg transition-all"
                                    >
                                        <Hammer size={18} />
                                    </button>
                                    <button onClick={() => { 
                                        setEditingMission(mission); 
                                        setMissionFormData({
                                            ...mission,
                                            reward_item_id: mission.reward_item_id || '',
                                            mode: mission.mode || 'individual',
                                            difficulty: mission.difficulty || 'beginner',
                                            reward_quantity: mission.reward_quantity || 0,
                                            reward_gold: mission.reward_gold || 0,
                                            reward_xp: mission.reward_xp || 0,
                                            advance_gold: mission.advance_gold || 0,
                                            objective_target: mission.objective_target || ''
                                        });
                                        setIsMissionModalOpen(true); 
                                    }} className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-all"><Edit2 size={18} /></button>
                                    
                                    <button onClick={() => deleteMission(mission.id)} className="p-2 text-red-400 hover:text-white hover:bg-red-400/10 rounded-lg transition-all">
                                        <Trash2 size={18} />
                                    </button>

                                    <button onClick={() => toggleMission(mission.id)} className="p-2 text-orange-400 hover:bg-orange-400/10 rounded-lg transition-all">
                                        {expandedMission === mission.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                    </button>
                                </div>
                            </div>

                            {expandedMission === mission.id && (
                                <div className="px-6 pb-6 pt-2 border-t border-gray-800/50 animate-in slide-in-from-top-1 duration-200">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                                        <div className="bg-gray-900/30 p-4 rounded-xl border border-white/5">
                                            <label className="text-[10px] font-bold text-gray-500 uppercase mb-2 block tracking-widest">{t('admin.missions.narrative_context')}</label>
                                            <p className="text-gray-300 text-sm leading-relaxed">{mission.description_en || t('admin.missions.form.narrative_placeholder')}</p>
                                        </div>
                                        <div className="bg-orange-500/5 p-4 rounded-xl border border-orange-500/10">
                                            <label className="text-[10px] font-bold text-orange-400 uppercase mb-2 block tracking-widest">{t('admin.missions.ui_objective')}</label>
                                            <p className="text-orange-100 font-medium text-sm">{mission.objective_en || t('admin.missions.form.ui_objective_placeholder')}</p>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between border-b border-gray-800/50 pb-2">
                                            <h4 className="flex items-center gap-2 text-sm font-bold text-white tracking-wide">
                                                <List size={16} className="text-orange-400" /> {t('admin.missions.sequence_title')}
                                            </h4>
                                            <button 
                                                onClick={() => { 
                                                    setEditingTask(null); 
                                                    setActiveMissionId(mission.id);
                                                    setMissionFormData(prev => ({ ...prev, scene_key: mission.scene_key }));
                                                    setTaskFormData({ type: 'talk_to_npc', description_en: '', order: (tasks[mission.id]?.length || 0) + 1, target_npc_template_id: '', required_item: '', required_quantity: 1, required_items: [], required_enemy: '', required_kills: 1, pronunciation_min_score: 80, target_phrase_en: '', message_to_deliver: '', karaoke_lines: [] });
                                                    setNpcInstanceEdits({ instructions: '', success_message: '', greeting: '' });
                                                    setIsTaskModalOpen(true); 
                                                }}
                                                className="text-[10px] font-bold text-orange-400 hover:text-orange-300 flex items-center gap-1.5 py-1 px-3 bg-orange-500/5 hover:bg-orange-500/10 border border-orange-500/20 rounded-full transition-all"
                                            >
                                                <Plus size={14} /> {t('admin.missions.add_task')}
                                            </button>
                                        </div>

                                        <div className="space-y-2">
                                            {tasks[mission.id]?.length === 0 && (
                                                <div className="text-center py-6 text-gray-500 italic text-xs">{t('admin.missions.no_tasks')}</div>
                                            )}
                                            {tasks[mission.id]?.map((task, idx) => {
                                                const taskType = TASK_TYPES.find(t => t.value === task.type);
                                                const Icon = taskType?.icon || Target;
                                                return (
                                                    <div key={task.id} className="group flex items-center justify-between bg-gray-900/40 border border-white/5 p-3 rounded-xl hover:border-orange-500/20 transition-all">
                                                        <div className="flex items-center gap-4">
                                                            <div className="bg-gray-800 text-gray-500 text-[10px] font-mono w-6 h-6 flex items-center justify-center rounded-lg border border-white/5">
                                                                {task.order}
                                                            </div>
                                                            <div className="p-2 bg-gray-800 rounded-lg text-gray-400 group-hover:text-orange-400 transition-colors">
                                                                <Icon size={18} />
                                                            </div>
                                                            <div>
                                                                <p className="text-gray-200 text-sm font-medium">{task.description_en}</p>
                                                                <div className="flex items-center gap-x-3 gap-y-1 flex-wrap mt-0.5 text-[10px]">
                                                                    <span className="text-indigo-400 font-bold uppercase">{task.type.replace(/_/g, ' ')}</span>
                                                                    {task.target_npc_template_id && (
                                                                        <span className="text-gray-500 flex items-center gap-1">
                                                                            <User size={10} /> NPC #{task.target_npc_template_id}
                                                                        </span>
                                                                    )}
                                                                    {task.required_items && task.required_items.length > 0 ? (
                                                                        task.required_items.map((ri, i) => (
                                                                            <span key={`ri-${i}`} className="text-yellow-400 font-bold bg-yellow-400/5 px-1.5 rounded border border-yellow-400/10">
                                                                                Item: {ri.item}{(ri.quantity || 1) > 1 ? ` x${ri.quantity}` : ''}
                                                                            </span>
                                                                        ))
                                                                    ) : task.required_item ? (
                                                                        <span className="text-yellow-400 font-bold bg-yellow-400/5 px-1.5 rounded border border-yellow-400/10">
                                                                            Item: {task.required_item}{(task.required_quantity || 1) > 1 ? ` x${task.required_quantity}` : ''}
                                                                        </span>
                                                                    ) : null}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button onClick={async () => {
                                                                setEditingTask(task);
                                                                setActiveMissionId(mission.id);
                                                                setMissionFormData(prev => ({ ...prev, scene_key: mission.scene_key }));
                                                                // Karaoke lines come back as [{order,line}]; the form edits plain strings.
                                                                setTaskFormData({
                                                                    ...task,
                                                                    required_quantity: task.required_quantity || 1,
                                                                    required_items: task.required_items || [],
                                                                    karaoke_lines: (task.karaoke_lines || []).map(l => (typeof l === 'string' ? l : l?.line || ''))
                                                                });
                                                                // Clear edits first; we then load them deterministically below.
                                                                setNpcInstanceEdits({ instructions: '', success_message: '', greeting: '' });
                                                                setIsTaskModalOpen(true);
                                                                // Deterministically load the NPC instance config for editing.
                                                                // Relying only on the reactive effect is racy: opening the modal
                                                                // changes scene_key, which refetches mapNPCs asynchronously, so the
                                                                // instructions textarea could stay empty. Fetch the scene NPCs here
                                                                // and populate directly.
                                                                if (task.target_npc_template_id) {
                                                                    try {
                                                                        const res = await api.get(`/admin/npc-instances?scene_key=${mission.scene_key}`);
                                                                        const list = res.data || [];
                                                                        setMapNPCs(list);
                                                                        const npc = list.find(n => String(n.id) === String(task.target_npc_template_id));
                                                                        if (npc) {
                                                                            setNpcInstanceEdits({
                                                                                instructions: npc.instructions || '',
                                                                                success_message: npc.success_message || '',
                                                                                greeting: npc.greeting || ''
                                                                            });
                                                                        }
                                                                    } catch (e) {
                                                                        console.warn('[AdminMissions] Could not load NPC instructions for editing:', e);
                                                                    }
                                                                }
                                                            }} className="p-2 text-gray-400 hover:text-white"><Edit2 size={16} /></button>
                                                            <button onClick={() => deleteTask(mission.id, task.id)} className="p-2 text-red-400 hover:text-red-300"><Trash2 size={16} /></button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Mission Modal */}
            {isMissionModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md overflow-hidden">
                    <div className="bg-gray-900 border border-gray-700 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                        <div className="p-8 border-b border-gray-800 flex justify-between items-center bg-gray-800/20 shrink-0">
                            <h2 className="text-2xl font-bold text-white tracking-tight">{editingMission ? t('admin.missions.edit_mission') : t('admin.missions.new_mission')}</h2>
                            <button onClick={() => setIsMissionModalOpen(false)} className="bg-gray-800 p-2 rounded-full text-gray-400 hover:text-white transition-all"><Plus size={24} className="rotate-45" /></button>
                        </div>
                        <form onSubmit={handleMissionSubmit} className="p-8 space-y-5 overflow-y-auto custom-scrollbar-light">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest pl-1">{t('admin.missions.form.title')}</label>
                                <input 
                                    required 
                                    value={missionFormData.title} 
                                    onChange={e => {
                                        const newTitle = e.target.value;
                                        setMissionFormData(prev => ({
                                            ...prev, 
                                            title: newTitle,
                                            scene_key: editingMission ? prev.scene_key : `mission-${slugify(newTitle)}`
                                        }));
                                    }} 
                                    className="w-full bg-gray-950 border border-gray-800 rounded-2xl px-5 py-3.5 text-white focus:border-orange-500/50 outline-none transition-all placeholder-gray-700" 
                                    placeholder={t('admin.missions.form.title_placeholder')} 
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-5">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest pl-1">{t('admin.missions.form.scene')}</label>
                                    <select required value={missionFormData.scene_key} onChange={e => setMissionFormData({...missionFormData, scene_key: e.target.value})} className="w-full bg-gray-950 border border-gray-800 rounded-2xl px-5 py-3.5 text-white outline-none appearance-none">
                                        {maps.map(m => <option key={m.scene_key} value={m.scene_key}>{m.scene_key}</option>)}
                                        {maps.length === 0 && <option value="lobby">lobby</option>}
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest pl-1">{t('admin.missions.form.type')}</label>
                                    <select value={missionFormData.type} onChange={e => setMissionFormData({...missionFormData, type: e.target.value})} className="w-full bg-gray-950 border border-gray-800 rounded-2xl px-5 py-3.5 text-white outline-none appearance-none">
                                        {MISSION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                        {missionFormData.type && !MISSION_TYPES.some(mt => mt.value === missionFormData.type) && (
                                            <option value={missionFormData.type}>{missionFormData.type} (legacy)</option>
                                        )}
                                    </select>
                                </div>
                                <div className="space-y-1 col-span-2">
                                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest pl-1">{t('admin.missions.form.status')}</label>
                                    <div className="grid grid-cols-2 gap-4">
                                        <select value={missionFormData.status} onChange={e => setMissionFormData({...missionFormData, status: e.target.value})} className="w-full bg-gray-950 border border-gray-800 rounded-2xl px-5 py-3.5 text-white outline-none appearance-none">
                                            <option value="active">{t('admin.missions.form.active')}</option>
                                            <option value="inactive">{t('admin.missions.form.inactive')}</option>
                                        </select>

                                        <select value={missionFormData.mode} onChange={e => setMissionFormData({...missionFormData, mode: e.target.value})} className="w-full bg-gray-950 border border-gray-800 rounded-2xl px-5 py-3.5 text-white outline-none appearance-none">
                                            <option value="individual">{t('admin.missions.form.individual')}</option>
                                            <option value="cooperative">{t('admin.missions.form.cooperative')}</option>
                                            <option value="competitive">{t('admin.missions.form.competitive')}</option>
                                        </select>

                                        <select value={missionFormData.difficulty} onChange={e => setMissionFormData({...missionFormData, difficulty: e.target.value})} className="w-full bg-gray-950 border border-gray-800 rounded-2xl px-5 py-3.5 text-white outline-none appearance-none">
                                            <option value="beginner">{t('admin.missions.form.difficulty_beginner')}</option>
                                            <option value="intermediate">{t('admin.missions.form.difficulty_intermediate')}</option>
                                            <option value="advanced">{t('admin.missions.form.difficulty_advanced')}</option>
                                        </select>

                                        <div className="flex items-center gap-2 bg-gray-950 border border-gray-800 rounded-2xl px-5 text-orange-400">
                                            <span className="text-[10px] font-bold uppercase">{t('admin.missions.form.gold')}:</span>
                                            <input type="number" value={missionFormData.reward_gold} onChange={e => setMissionFormData({...missionFormData, reward_gold: parseInt(e.target.value)})} className="bg-transparent w-full outline-none font-bold" />
                                        </div>

                                        <div className="flex items-center gap-2 bg-gray-950 border border-gray-800 rounded-2xl px-5 text-sky-400">
                                            <span className="text-[10px] font-bold uppercase">{t('admin.missions.form.xp')}:</span>
                                            <input type="number" value={missionFormData.reward_xp} onChange={e => setMissionFormData({...missionFormData, reward_xp: parseInt(e.target.value) || 0})} className="bg-transparent w-full outline-none font-bold" />
                                        </div>

                                        <div className="flex items-center gap-2 bg-gray-950 border border-emerald-800/40 rounded-2xl px-5 text-emerald-400">
                                            <span className="text-[10px] font-bold uppercase">{t('admin.missions.form.advance_gold')}:</span>
                                            <input type="number" min="0" value={missionFormData.advance_gold} onChange={e => setMissionFormData({...missionFormData, advance_gold: parseInt(e.target.value) || 0})} className="bg-transparent w-full outline-none font-bold" />
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-emerald-600/80 italic px-1 mt-2">{t('admin.missions.form.advance_gold_hint')}</p>
                                    <p className="text-[10px] text-gray-600 italic px-1 mt-1">{t('admin.missions.form.difficulty')}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-5 p-4 bg-gray-950/50 rounded-2xl border border-white/5">
                                <div className="col-span-2">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1 mb-2 block">{t('admin.missions.form.reward_item')}</label>
                                    <div className="grid grid-cols-3 gap-4">
                                        <select 
                                            className="col-span-2 bg-gray-900 border border-gray-800 rounded-xl px-4 py-2 text-sm text-white outline-none" 
                                            value={missionFormData.reward_item_id || ''} 
                                            onChange={e => setMissionFormData({...missionFormData, reward_item_id: e.target.value})}
                                        >
                                            <option value="">{t('admin.missions.form.reward_item_placeholder')}</option>
                                            {items && items.length > 0 ? items.map(it => (
                                                <option key={it.id} value={it.id}>{it.name}</option>
                                            )) : <option disabled>{t('admin.missions.form.reward_loading')}</option>}
                                        </select>
                                        <input type="number" placeholder={t('admin.missions.form.reward_qty')} className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-2 text-sm text-white outline-none" value={missionFormData.reward_quantity} onChange={e => setMissionFormData({...missionFormData, reward_quantity: parseInt(e.target.value)})} />
                                    </div>
                                </div>
                            </div>

                            {(missionFormData.type === 'find_item' || missionFormData.type === 'find_items') && (
                                <div className="space-y-1 p-4 bg-yellow-500/5 rounded-2xl border border-yellow-500/10">
                                    <label className="text-[10px] font-bold text-yellow-500 uppercase tracking-widest pl-1">{t('admin.missions.form.objective_item')}</label>
                                    <select 
                                        className="w-full bg-gray-900 border border-yellow-500/20 rounded-xl px-4 py-3 text-yellow-100 outline-none" 
                                        value={missionFormData.objective_target || ''} 
                                        onChange={e => setMissionFormData({...missionFormData, objective_target: e.target.value})}
                                    >
                                        <option value="">{t('admin.missions.form.objective_item_placeholder')}</option>
                                        {items && items.length > 0 ? items.map(it => (
                                            <option key={it.id} value={it.name}>{it.name}</option>
                                        )) : <option disabled>{t('common.loading')}</option>}
                                    </select>
                                </div>
                            )}

                            {(missionFormData.type === 'defeat_enemy' || missionFormData.type === 'kill_boss') && (
                                <div className="space-y-1 p-4 bg-red-500/5 rounded-2xl border border-red-500/10">
                                    <label className="text-[10px] font-bold text-red-500 uppercase tracking-widest pl-1">{t('admin.missions.form.objective_enemy')}</label>
                                    <select className="w-full bg-gray-900 border border-red-500/20 rounded-xl px-4 py-3 text-red-100 outline-none" value={missionFormData.objective_target || ''} onChange={e => setMissionFormData({...missionFormData, objective_target: e.target.value})}>
                                        <option value="">{t('admin.missions.form.objective_enemy_placeholder')}</option>
                                        {enemies.map(en => <option key={en.id} value={en.name}>{en.name}</option>)}
                                    </select>
                                </div>
                            )}

                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest pl-1">{t('admin.missions.form.narrative_desc')}</label>
                                <textarea rows={2} value={missionFormData.description_en} onChange={e => setMissionFormData({...missionFormData, description_en: e.target.value})} className="w-full bg-gray-950 border border-gray-800 rounded-2xl px-5 py-3.5 text-white outline-none resize-none" placeholder={t('admin.missions.form.narrative_placeholder')} />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest pl-1">{t('admin.missions.ui_objective')}</label>
                                <input value={missionFormData.objective_en} onChange={e => setMissionFormData({...missionFormData, objective_en: e.target.value})} className="w-full bg-gray-950 border border-gray-800 rounded-2xl px-5 py-3.5 text-orange-400 font-medium outline-none" placeholder={t('admin.missions.form.ui_objective_placeholder')} />
                            </div>
                            <div className="flex items-center gap-4 pt-4">
                                <button type="button" onClick={() => setIsMissionModalOpen(false)} className="flex-1 py-4 bg-gray-800/50 hover:bg-gray-800 text-gray-400 rounded-2xl font-bold transition-all">{t('common.cancel')}</button>
                                <button type="submit" className="flex-[2] py-4 bg-orange-600 hover:bg-orange-500 text-white rounded-2xl font-bold transition-all shadow-[0_0_20px_rgba(234,88,12,0.3)]">
                                    {editingMission ? t('admin.missions.update_mission') : t('admin.missions.create_mission')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Task Modal */}
            {isTaskModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md overflow-hidden">
                    <div className="bg-gray-900 border border-gray-800 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-8 border-b border-gray-800 flex justify-between items-center bg-indigo-500/5 shrink-0">
                            <div>
                                <h2 className="text-2xl font-bold text-white">{editingTask ? t('admin.missions.edit_task') : t('admin.missions.add_task')}</h2>
                                <p className="text-gray-500 text-xs uppercase font-bold tracking-widest mt-1">{t('admin.missions.tasks.technical_config')}</p>
                            </div>
                            <button onClick={() => setIsTaskModalOpen(false)} className="bg-gray-800 p-2 rounded-full text-gray-400 hover:text-white transition-all"><Plus size={24} className="rotate-45" /></button>
                        </div>
                        <form onSubmit={handleTaskSubmit} className="flex-1 p-8 overflow-y-auto custom-scrollbar-light bg-gray-900">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
                                <div className="md:col-span-2 space-y-1">
                                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest pl-1">{t('admin.missions.tasks.instruction')}</label>
                                    <input required value={taskFormData.description_en} onChange={e => setTaskFormData({...taskFormData, description_en: e.target.value})} className="w-full bg-gray-950 border border-gray-800 rounded-2xl px-5 py-3 text-white focus:border-indigo-500/50 outline-none transition-all" placeholder={t('admin.missions.tasks.instruction_placeholder')} />
                                </div>
                                
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest pl-1">{t('admin.missions.tasks.type')}</label>
                                    <select value={taskFormData.type} onChange={e => setTaskFormData({...taskFormData, type: e.target.value})} className="w-full bg-gray-950 border border-gray-800 rounded-2xl px-5 py-3 text-white outline-none">
                                        {TASK_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                    </select>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest pl-1">{t('admin.missions.tasks.order')}</label>
                                    <input type="number" required value={taskFormData.order} onChange={e => setTaskFormData({...taskFormData, order: parseInt(e.target.value)})} className="w-full bg-gray-950 border border-gray-800 rounded-2xl px-5 py-3 text-white outline-none" />
                                </div>

                                {/* NPC Selector with Inline Minimap */}
                                <div className="md:col-span-2 flex gap-6 items-center p-5 bg-gray-950/40 border border-gray-800 rounded-3xl group transition-all hover:border-gray-700">
                                    {/* Inline Mini Reference Map with Dynamic Aspect Ratio and Auto-Zoom */}
                                    {(() => {
                                        const currentMap = maps.find(m => m.scene_key === missionFormData.scene_key);
                                        
                                        // 1. Determine base dimensions from map data
                                        let baseWidth = 2000, baseHeight = 2000;
                                        if (currentMap?.map_data) {
                                            try {
                                                const d = JSON.parse(currentMap.map_data);
                                                if (d.width) baseWidth = d.width;
                                                if (d.height) baseHeight = d.height;
                                            } catch(e) {}
                                        }

                                        // 2. Calculate effective bounds based on NPCs to avoid "clumping" 
                                        // if the map is mostly empty space.
                                        let minX = 0, minY = 0;
                                        let maxX = baseWidth, maxY = baseHeight;

                                        if (mapNPCs.length > 0) {
                                            const npcsMaxX = Math.max(...mapNPCs.map(n => n.position_x));
                                            const npcsMaxY = Math.max(...mapNPCs.map(n => n.position_y));
                                            const npcsMinX = Math.min(...mapNPCs.map(n => n.position_x));
                                            const npcsMinY = Math.min(...mapNPCs.map(n => n.position_y));

                                            // If the NPCs are all in a much smaller area than the baseWidth/Height,
                                            // we "zoom in" to that area with some padding.
                                            // We use at least 1000px as a minimum effective world size to keep some perspective.
                                            maxX = Math.max(npcsMaxX + 100, 1000);
                                            maxY = Math.max(npcsMaxY + 100, 1000);
                                        }

                                        const ratio = maxX / maxY;

                                        return (
                                            <div 
                                                className="shrink-0 relative bg-black rounded-2xl border border-gray-800 overflow-hidden shadow-inner flex items-center justify-center"
                                                style={{ 
                                                    width: ratio > 1 ? '140px' : `${140 * ratio}px`,
                                                    height: ratio > 1 ? `${140 / ratio}px` : '140px',
                                                }}
                                            >
                                                <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(circle, #4f46e5 1px, transparent 1px)', backgroundSize: '12px 12px' }}></div>
                                                {mapNPCs.map(npc => {
                                                    const isSelected = String(npc.id) === String(taskFormData.target_npc_template_id);
                                                    
                                                    // Scaling relative to our calculated effective bounds
                                                    const left = (npc.position_x / maxX) * 100;
                                                    const top = (npc.position_y / maxY) * 100;

                                                    return (
                                                        <div 
                                                            key={npc.id}
                                                            className={`absolute w-2 h-2 -translate-x-1/2 -translate-y-1/2 rounded-full border transition-all duration-500 ${
                                                                isSelected ? 'bg-orange-500 border-white scale-125 z-20 shadow-[0_0_8px_rgba(249,115,22,1)]' : 'bg-gray-800 border-gray-700 opacity-20 z-10'
                                                            }`}
                                                            style={{ left: `${left}%`, top: `${top}%` }}
                                                        >
                                                            {isSelected && <div className="absolute inset-0 animate-ping rounded-full bg-orange-400 opacity-75"></div>}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        );
                                    })()}

                                    {/* Selector Fields */}
                                    <div className="flex-1 space-y-3">
                                        <div className="space-y-1">
                                            <div className="flex justify-between items-end px-1">
                                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{t('admin.missions.tasks.target_npc')}</label>
                                                {taskFormData.target_npc_template_id && (() => {
                                                    const sel = mapNPCs.find(n => String(n.id) === String(taskFormData.target_npc_template_id));
                                                    return sel ? <span className="text-[9px] font-mono text-orange-400 bg-orange-400/10 px-2 py-0.5 rounded-full border border-orange-400/20">X:{sel.position_x} Y:{sel.position_y}</span> : null;
                                                })()}
                                            </div>
                                            <select 
                                                value={taskFormData.target_npc_template_id || ''} 
                                                onChange={e => {
                                                    const newId = e.target.value;
                                                    setTaskFormData({...taskFormData, target_npc_template_id: newId});
                                                    setNpcInstanceEdits({ instructions: '', success_message: '', greeting: '' });
                                                }} 
                                                className="w-full bg-gray-950 border border-gray-800 rounded-2xl px-5 py-3 text-white outline-none focus:border-orange-500/30 transition-all cursor-pointer"
                                            >
                                                <option value="">{t('admin.missions.tasks.npc_none')}</option>
                                                {mapNPCs.length > 0 ? (
                                                    mapNPCs.map(tmpl => (
                                                        <option key={tmpl.id} value={tmpl.id}>
                                                            {tmpl.NPCDefinition?.name || tmpl.npc_definition?.name || 'NPC'} (X:{tmpl.position_x}, Y:{tmpl.position_y})
                                                        </option>
                                                    ))
                                                ) : (
                                                    <option disabled>No hay NPCs en el mapa {missionFormData.scene_key}</option>
                                                )}
                                            </select>
                                        </div>
                                        <p className="text-[10px] text-gray-600 italic px-1">La referencia visual a la izquierda te ayuda a identificar la posición del NPC en {missionFormData.scene_key}.</p>
                                    </div>
                                </div>

                                {/* NPC Instance Configuration */}
                                {taskFormData.target_npc_template_id && (
                                    <div className="md:col-span-2 p-5 bg-indigo-500/5 border border-indigo-500/10 rounded-3xl space-y-4 shadow-inner">
                                        <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                                            <User size={12} />
                                            Configuración de Instancia NPC
                                        </p>
                                        <div className="grid grid-cols-1 gap-4">
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest pl-1">Instrucciones AI (Prompt)</label>
                                                <textarea rows={3} value={npcInstanceEdits.instructions} onChange={e => setNpcInstanceEdits({...npcInstanceEdits, instructions: e.target.value})} className="w-full bg-gray-950 border border-indigo-500/20 rounded-xl px-4 py-2.5 text-white text-xs outline-none resize-none focus:border-indigo-500/50 transition-all" />
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest pl-1">Mensaje de Éxito</label>
                                                    <textarea rows={2} value={npcInstanceEdits.success_message} onChange={e => setNpcInstanceEdits({...npcInstanceEdits, success_message: e.target.value})} className="w-full bg-gray-950 border border-green-500/20 rounded-xl px-4 py-2 text-white text-xs outline-none resize-none focus:border-green-500/50 transition-all" />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest pl-1">Saludo Inicial</label>
                                                    <textarea rows={2} value={npcInstanceEdits.greeting} onChange={e => setNpcInstanceEdits({...npcInstanceEdits, greeting: e.target.value})} className="w-full bg-gray-950 border border-yellow-500/20 rounded-xl px-4 py-2 text-white text-xs outline-none resize-none focus:border-yellow-500/50 transition-all" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {(taskFormData.type === 'bring_item' || taskFormData.type === 'find_item' || taskFormData.type === 'collect_items') && (
                                    <div className="md:col-span-2 p-5 bg-yellow-500/5 border border-yellow-500/10 rounded-3xl space-y-4">
                                        <div className="flex items-center justify-between">
                                            <p className="text-[10px] font-bold text-yellow-400 uppercase tracking-widest flex items-center gap-2">
                                                <Box size={12} /> {t('admin.missions.tasks.required_items') || 'Ítems Requeridos'}
                                            </p>
                                        </div>

                                        <div className="space-y-2">
                                            {(taskFormData.required_items || []).map((req, idx) => (
                                                <div key={idx} className="flex items-center gap-2">
                                                    <span className="text-yellow-400/60 text-xs font-mono w-6 text-right">{idx + 1}.</span>
                                                    <select
                                                        value={req.item || ''}
                                                        onChange={e => {
                                                            const next = [...(taskFormData.required_items || [])];
                                                            next[idx] = { ...req, item: e.target.value };
                                                            setTaskFormData({...taskFormData, required_items: next});
                                                        }}
                                                        className="flex-1 bg-gray-950 border border-yellow-500/20 rounded-xl px-4 py-2 text-yellow-100 text-sm outline-none focus:border-yellow-500/50 transition-all"
                                                    >
                                                        <option value="">{t('admin.missions.form.objective_item_placeholder') || 'Seleccionar Ítem'}</option>
                                                        {items.map(item => <option key={item.id} value={item.name}>{item.name}</option>)}
                                                    </select>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        value={req.quantity || 1}
                                                        onChange={e => {
                                                            const next = [...(taskFormData.required_items || [])];
                                                            next[idx] = { ...req, quantity: parseInt(e.target.value) || 1 };
                                                            setTaskFormData({...taskFormData, required_items: next});
                                                        }}
                                                        className="w-24 bg-gray-950 border border-yellow-500/20 rounded-xl px-4 py-2 text-yellow-100 text-sm outline-none focus:border-yellow-500/50 transition-all"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setTaskFormData({...taskFormData, required_items: taskFormData.required_items.filter((_, i) => i !== idx)})}
                                                        className="p-2 text-red-400 hover:text-red-300"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => setTaskFormData({...taskFormData, required_items: [...(taskFormData.required_items || []), {item: '', quantity: 1}]})}
                                            className="text-[10px] font-bold text-yellow-400 hover:text-yellow-300 flex items-center gap-1.5 py-1.5 px-3 bg-yellow-500/5 hover:bg-yellow-500/10 border border-yellow-500/20 rounded-full transition-all"
                                        >
                                            <Plus size={14} /> Añadir Ítem
                                        </button>
                                        
                                        <p className="md:col-span-3 text-[10px] text-gray-500 italic pl-1">{t('admin.missions.tasks.multi_item_hint') || 'Puedes requerir múltiples ítems diferentes para esta tarea.'}</p>
                                    </div>
                                )}

                                {(taskFormData.type === 'defeat_enemy' || taskFormData.type === 'kill_boss' || taskFormData.type === 'kill_all') && (
                                    <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-red-500 uppercase tracking-widest pl-1">{t('admin.missions.tasks.select_enemy')}</label>
                                            <select value={taskFormData.required_enemy} onChange={e => setTaskFormData({...taskFormData, required_enemy: e.target.value})} className="w-full bg-gray-950 border border-red-500/20 rounded-2xl px-5 py-3 text-red-100 outline-none">
                                                <option value="">{t('admin.missions.form.objective_enemy_placeholder')}</option>
                                                {enemies.map(enemy => <option key={enemy.id} value={enemy.name}>{enemy.name}</option>)}
                                            </select>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-red-400 uppercase tracking-widest pl-1">
                                                Kills requeridos
                                            </label>
                                            <input
                                                type="number"
                                                min="1"
                                                value={taskFormData.required_kills}
                                                onChange={e => setTaskFormData({...taskFormData, required_kills: parseInt(e.target.value) || 1})}
                                                className="w-full bg-gray-950 border border-red-500/20 rounded-2xl px-5 py-3 text-white outline-none focus:border-red-500/50 transition-all"
                                                placeholder="Ej: 3"
                                            />
                                            <p className="text-[10px] text-gray-600 italic px-1">
                                                Cuántos de este enemigo debe matar el jugador para completar la tarea.
                                            </p>
                                            {taskFormData.type === 'kill_all' && mapEnemiesCount > 0 && (
                                                <p className="text-[10px] text-orange-400 font-bold px-1 mt-1">
                                                    Hint: Este mapa tiene un total de {mapEnemiesCount} enemigos.
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {taskFormData.type === 'pronunciation_threshold' && (
                                    <div className="md:col-span-2 grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-green-500 uppercase tracking-widest pl-1">{t('admin.missions.tasks.target_phrase')}</label>
                                            <input value={taskFormData.target_phrase_en} onChange={e => setTaskFormData({...taskFormData, target_phrase_en: e.target.value})} className="w-full bg-gray-950 border border-green-500/20 rounded-2xl px-5 py-3 text-green-100 outline-none" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-green-500 uppercase tracking-widest pl-1">{t('admin.missions.tasks.min_score')}</label>
                                            <input type="number" value={taskFormData.pronunciation_min_score} onChange={e => setTaskFormData({...taskFormData, pronunciation_min_score: parseInt(e.target.value)})} className="w-full bg-gray-950 border border-green-500/20 rounded-2xl px-5 py-3 text-white outline-none" />
                                        </div>
                                    </div>
                                )}

                                {taskFormData.type === 'karaoke' && (
                                    <div className="md:col-span-2 p-5 bg-pink-500/5 border border-pink-500/10 rounded-3xl space-y-4">
                                        <div className="flex items-center justify-between">
                                            <p className="text-[10px] font-bold text-pink-400 uppercase tracking-widest flex items-center gap-2">
                                                <Music size={12} /> {t('admin.missions.tasks.karaoke_lines')}
                                            </p>
                                            <div className="flex items-center gap-2">
                                                <label className="text-[10px] font-bold text-pink-400 uppercase tracking-widest">{t('admin.missions.tasks.min_avg_score')}</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max="100"
                                                    value={taskFormData.pronunciation_min_score}
                                                    onChange={e => setTaskFormData({...taskFormData, pronunciation_min_score: parseInt(e.target.value) || 0})}
                                                    className="w-20 bg-gray-950 border border-pink-500/20 rounded-xl px-3 py-1.5 text-white text-sm outline-none focus:border-pink-500/50 transition-all"
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            {(taskFormData.karaoke_lines || []).map((line, idx) => (
                                                <div key={idx} className="flex items-center gap-2">
                                                    <span className="text-pink-400/60 text-xs font-mono w-6 text-right">{idx + 1}.</span>
                                                    <input
                                                        value={typeof line === 'string' ? line : (line?.line || '')}
                                                        onChange={e => {
                                                            const next = [...taskFormData.karaoke_lines];
                                                            next[idx] = e.target.value;
                                                            setTaskFormData({...taskFormData, karaoke_lines: next});
                                                        }}
                                                        placeholder={t('admin.missions.tasks.karaoke_line_placeholder')}
                                                        className="flex-1 bg-gray-950 border border-pink-500/20 rounded-xl px-4 py-2 text-white text-sm outline-none focus:border-pink-500/50 transition-all"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setTaskFormData({...taskFormData, karaoke_lines: taskFormData.karaoke_lines.filter((_, i) => i !== idx)})}
                                                        className="p-2 text-red-400 hover:text-red-300"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => setTaskFormData({...taskFormData, karaoke_lines: [...(taskFormData.karaoke_lines || []), '']})}
                                            className="text-[10px] font-bold text-pink-400 hover:text-pink-300 flex items-center gap-1.5 py-1.5 px-3 bg-pink-500/5 hover:bg-pink-500/10 border border-pink-500/20 rounded-full transition-all"
                                        >
                                            <Plus size={14} /> {t('admin.missions.tasks.karaoke_add_line')}
                                        </button>
                                    </div>
                                )}

                                <div className="md:col-span-2 pt-4 flex gap-4">
                                    <button type="button" onClick={() => setIsTaskModalOpen(false)} className="flex-1 py-4 bg-gray-800 hover:bg-gray-700 text-gray-400 rounded-2xl font-bold transition-all">{t('common.cancel')}</button>
                                    <button type="submit" className="flex-[2] py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold transition-all shadow-lg">
                                        {editingTask ? t('admin.missions.save_changes') : t('admin.missions.add_task')}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
