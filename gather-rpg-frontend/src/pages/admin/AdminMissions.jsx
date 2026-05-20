import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollText, Plus, Trash2, Edit2, ChevronDown, ChevronUp, Target, User, MapPin, List, MessageSquare, Mic, Box, Sword, Send, Search, Hammer } from 'lucide-react';
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

    const MISSION_TYPES = [
        { value: 'talk_to_npc', label: t('admin.missions.types.talk_to_npc') },
        { value: 'find_item', label: t('admin.missions.types.find_item') },
        { value: 'find_items', label: t('admin.missions.types.find_items') },
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
        reward_item_id: '',
        reward_quantity: 0,
        reward_gold: 0,
        objective_target: ''
    });

    const [mapNPCs, setMapNPCs] = useState([]);
    const [loadingMapNPCs, setLoadingMapNPCs] = useState(false);
    const [npcInstanceEdits, setNpcInstanceEdits] = useState({ instructions: '', success_message: '', greeting: '' });

    const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
    const [editingTask, setEditingTask] = useState(null);
    const [activeMissionId, setActiveMissionId] = useState(null);
    const [taskFormData, setTaskFormData] = useState({
        type: 'talk_to_npc',
        description_en: '',
        order: 0,
        target_npc_template_id: '',
        required_item: '',
        required_enemy: '',
        pronunciation_min_score: 80,
        target_phrase_en: '',
        message_to_deliver: ''
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
            } catch (err) {
                console.error("Error fetching map NPCs:", err);
            } finally {
                setLoadingMapNPCs(false);
            }
        };
        fetchMapNPCs();
    }, [missionFormData.scene_key]);



    // Reactively sync NPC instructions when task data or map NPCs are available
    useEffect(() => {
        if (isTaskModalOpen && taskFormData.target_npc_template_id && mapNPCs.length > 0) {
            const npc = mapNPCs.find(n => String(n.id) === String(taskFormData.target_npc_template_id));
            if (npc) {
                setNpcInstanceEdits(prev => {
                    // Only update if currently empty (modal just opened) or if ID changed
                    // We don't want to overwrite manual edits while the modal is open
                    if (prev.instructions || prev.success_message) return prev;
                    return {
                        instructions: npc.instructions || '',
                        success_message: npc.success_message || '',
                        greeting: npc.greeting || ''
                    };
                });
            }
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
                            reward_item_id: '',
                            reward_quantity: 0,
                            reward_gold: 0,
                            objective_target: ''
                        }); 
                        setIsMissionModalOpen(true); 
                    }}
                    className="bg-orange-600 hover:bg-orange-500 text-white px-4 py-2 rounded-lg font-bold transition-all shadow-lg active:scale-95 flex items-center gap-2"
                >
                    <Plus size={20} /> {t('admin.missions.new_mission')}
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-400"></div></div>
            ) : (
                <div className="grid gap-4">
                    {missions.map(mission => (
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
                                            reward_quantity: mission.reward_quantity || 0,
                                            reward_gold: mission.reward_gold || 0,
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
                                                    setTaskFormData({ type: 'talk_to_npc', description_en: '', order: (tasks[mission.id]?.length || 0) + 1, target_npc_template_id: '', required_item: '', required_enemy: '', pronunciation_min_score: 80, target_phrase_en: '', message_to_deliver: '' });
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
                                                                    {task.required_item && (
                                                                        <span className="text-yellow-400 font-bold bg-yellow-400/5 px-1.5 rounded border border-yellow-400/10">
                                                                            Item: {task.required_item}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button onClick={() => { 
                                                                setEditingTask(task); 
                                                                setActiveMissionId(mission.id); 
                                                                setMissionFormData(prev => ({ ...prev, scene_key: mission.scene_key }));
                                                                setTaskFormData(task);
                                                                // Clear edits first, useEffect will pick up the correct values from mapNPCs
                                                                setNpcInstanceEdits({ instructions: '', success_message: '', greeting: '' });
                                                                setIsTaskModalOpen(true); 
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

                                        <div className="flex items-center gap-2 bg-gray-950 border border-gray-800 rounded-2xl px-5 text-orange-400">
                                            <span className="text-[10px] font-bold uppercase">{t('admin.missions.form.gold')}:</span>
                                            <input type="number" value={missionFormData.reward_gold} onChange={e => setMissionFormData({...missionFormData, reward_gold: parseInt(e.target.value)})} className="bg-transparent w-full outline-none font-bold" />
                                        </div>
                                    </div>
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
                                    <div className="space-y-1 md:col-span-2">
                                        <label className="text-[10px] font-bold text-yellow-500 uppercase tracking-widest pl-1">{t('admin.missions.tasks.select_item')}</label>
                                        <select value={taskFormData.required_item} onChange={e => setTaskFormData({...taskFormData, required_item: e.target.value})} className="w-full bg-gray-950 border border-yellow-500/20 rounded-2xl px-5 py-3 text-yellow-100 outline-none">
                                            <option value="">{t('admin.missions.form.objective_item_placeholder')}</option>
                                            {items.map(item => <option key={item.id} value={item.name}>{item.name}</option>)}
                                        </select>
                                    </div>
                                )}

                                {(taskFormData.type === 'defeat_enemy' || taskFormData.type === 'kill_boss') && (
                                    <div className="space-y-1 md:col-span-2">
                                        <label className="text-[10px] font-bold text-red-500 uppercase tracking-widest pl-1">{t('admin.missions.tasks.select_enemy')}</label>
                                        <select value={taskFormData.required_enemy} onChange={e => setTaskFormData({...taskFormData, required_enemy: e.target.value})} className="w-full bg-gray-950 border border-red-500/20 rounded-2xl px-5 py-3 text-red-100 outline-none">
                                            <option value="">{t('admin.missions.form.objective_enemy_placeholder')}</option>
                                            {enemies.map(enemy => <option key={enemy.id} value={enemy.name}>{enemy.name}</option>)}
                                        </select>
                                    </div>
                                )}

                                {taskFormData.type === 'pronunciation' && (
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
