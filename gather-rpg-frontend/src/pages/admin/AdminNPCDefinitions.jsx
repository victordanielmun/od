import React, { useEffect, useRef, useState } from 'react';
import { Users, Plus, Trash2, Edit2, Save, X, AlertCircle, MapPin, ScrollText, ChevronRight, Brain, CheckCircle, MessageSquare } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import { NPC_CONFIG } from '../../game/config/NPCConfig';

const Phaser = window.Phaser;

// --- Preview Scene (Simplified for NPCs) ---
class DefinitionPreviewScene extends Phaser.Scene {
    constructor(charId) {
        // Normalize charId (e.g., 'sprite1' -> '1') to match NPC_CONFIG
        const cleanId = charId?.toString().replace('sprite', '') || '1';
        super({ key: `preview-${cleanId}-${Date.now()}` });
        this.npcId = cleanId;
    }

    preload() {
        // Get NPC definition from NPC_CONFIG
        const npcDef = NPC_CONFIG.npcs.find(n => n.id === this.npcId);
        if (!npcDef) {
            console.warn(`[PreviewScene] NPC ID ${this.npcId} not found in NPC_CONFIG`);
            return;
        }
        
        npcDef.sheets.forEach(sheet => {
            if (sheet.json) {
                // Key format matches NPCSprite: npc-{id}-{type}
                this.load.atlas(`npc-${this.npcId}-${sheet.type}`, sheet.path, sheet.json);
            }
        });
    }

    create() {
        this.cameras.main.setBackgroundColor('#1a1a2e');
        
        // Ensure NPC exists in animations config
        const npcAnims = NPC_CONFIG.animationsByNPC[this.npcId] || 
                         NPC_CONFIG.animationsByNPC['1']; // Fallback to Trainer
        
        if (!npcAnims) return;

        Object.entries(npcAnims).forEach(([animName, config]) => {
            const textureKey = `npc-${this.npcId}-${config.type}`;
            const animKey = `npc-${this.npcId}-${animName}`;
            
            if (!this.anims.exists(animKey) && this.textures.exists(textureKey)) {
                try {
                    this.anims.create({
                        key: animKey,
                        frames: config.frames.map(f => ({ key: textureKey, frame: f })),
                        frameRate: config.frameRate,
                        repeat: config.repeat
                    });
                } catch (err) {
                    console.error(`Error creating animation ${animKey}:`, err);
                }
            }
        });

        // Use body-idle for preview
        const mainTexture = `npc-${this.npcId}-body`;
        if (this.textures.exists(mainTexture)) {
            this.sprite = this.add.sprite(75, 75, mainTexture);
            this.sprite.setScale(1.1);
            
            // Try different idle variations if body-idle missing
            const idleAnim = `npc-${this.npcId}-body-idle`;
            if (this.anims.exists(idleAnim)) {
                this.sprite.play(idleAnim);
            }
        } else {
            // Fallback for missing texture
            this.add.text(75, 75, '?', { fontSize: '40px', color: '#666' }).setOrigin(0.5);
        }
    }
}

const DefinitionCard = ({ definition, onEdit, onDelete }) => {
    const canvasRef = useRef(null);
    const gameRef = useRef(null);
    const { t } = useTranslation();

    useEffect(() => {
        if (!canvasRef.current) return;
        const game = new Phaser.Game({
            type: Phaser.AUTO,
            width: 150,
            height: 150,
            parent: canvasRef.current,
            backgroundColor: '#1a1a2e',
            scene: new DefinitionPreviewScene(definition.sprite || '1'),
            audio: { disableWebAudio: true, noAudio: true },
            render: { pixelArt: true }
        });
        gameRef.current = game;
        return () => game.destroy(true);
    }, [definition.sprite]);

    return (
        <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden shadow-lg group">
            <div className="flex justify-center bg-gray-900 p-4 border-b border-gray-700">
                <div ref={canvasRef} className="rounded-lg overflow-hidden border border-gray-800" />
            </div>
            <div className="p-4">
                <div className="flex justify-between items-start mb-2">
                    <div className="flex-1 min-w-0">
                        <h3 className="text-white font-bold truncate">{definition.name}</h3>
                        <span className="text-[10px] text-gray-400 uppercase tracking-wider block truncate">
                            {t(`admin.npc_definitions.types.${(definition.type || 'other').toLowerCase()}`)}
                        </span>
                    </div>
                    <div className="flex gap-1 flex-shrink-0 ml-2 transition-opacity">
                        <button onClick={() => onEdit(definition)} className="p-1.5 text-blue-400 hover:bg-blue-400/20 bg-blue-400/5 rounded-lg transition-colors border border-blue-400/20" title={t('common.edit')}>
                            <Edit2 size={14} />
                        </button>
                        <button onClick={() => onDelete(definition.id)} className="p-1.5 text-red-400 hover:bg-red-400/20 bg-red-400/5 rounded-lg transition-colors border border-red-400/20" title={t('common.delete')}>
                            <Trash2 size={14} />
                        </button>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[10px] text-gray-500 mt-3">
                    <span className="bg-gray-700 px-2 py-0.5 rounded text-gray-300">Sprite: {definition.sprite}</span>
                    <span className={`px-2 py-0.5 rounded border border-gray-700 capitalize ${definition.voice_type === 'female' ? 'text-pink-400' : 'text-blue-400'}`}>
                        {t(`admin.npc_definitions.voices.${definition.voice_type}`)}
                    </span>
                    <span className="bg-gray-700 px-2 py-0.5 rounded text-gray-400 capitalize">
                        {t(`admin.npc_definitions.modes.${definition.interaction_mode}`)}
                    </span>
                </div>
            </div>
        </div>
    );
};

export const AdminNPCDefinitions = () => {
    const { t } = useTranslation();
    const [definitions, setDefinitions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingDef, setEditingDef] = useState(null);
    const [formData, setFormData] = useState({ 
        name: '', 
        sprite: '1', 
        greeting: '',
        type: 'other',
        interaction_mode: 'hybrid',
        voice_type: 'male',
        gift_item_id: '',
        gift_quantity: 0,
        shop_id: ''
    });
    const [allItems, setAllItems] = useState([]);
    const [allShops, setAllShops] = useState([]);
    const [allMissions, setAllMissions] = useState([]);
    const [instances, setInstances] = useState([]);
    const [loadingInstances, setLoadingInstances] = useState(false);
    const [instanceFormData, setInstanceFormData] = useState({}); // { tmplID: { mission_ids: [], role: '', instructions: '', success_message: '' } }

    const fetchData = async () => {
        try {
            setLoading(true);
            const [npcsRes, itemsRes, shopsRes, missionsRes] = await Promise.all([
                api.get('/admin/npc-definitions'),
                api.get('/admin/items'),
                api.get('/admin/shops'),
                api.get('/admin/missions')
            ]);
            setDefinitions(npcsRes.data);
            setAllItems(itemsRes.data);
            setAllShops(shopsRes.data);
            setAllMissions(missionsRes.data);
            setError(null);
        } catch (err) {
            setError(t('admin.npc_definitions.errors.loading'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const submissionData = {
            ...formData,
            shop_id: formData.shop_id === "" ? null : parseInt(formData.shop_id),
            gift_item_id: formData.gift_item_id === "" ? null : formData.gift_item_id
        };

        try {
            if (editingDef) {
                await api.put(`/admin/npc-definitions/${editingDef.id}`, submissionData);
            } else {
                await api.post('/admin/npc-definitions', submissionData);
            }
            setIsModalOpen(false);
            setEditingDef(null);
            setFormData({ 
                name: '', 
                sprite: '1', 
                type: 'other',
                interaction_mode: 'hybrid',
                voice_type: 'male',
                gift_item_id: '',
                gift_quantity: 0,
                shop_id: ''
            });
            fetchData();
        } catch (err) {
            setError(t('admin.npc_definitions.errors.save'));
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm(t('common.confirm_delete') || '¿Seguro que deseas eliminar esta definición?')) return;
        try {
            await api.delete(`/admin/npc-definitions/${id}`);
            fetchData();
        } catch (err) {
            setError(t('admin.npc_definitions.errors.delete'));
        }
    };

    const openCreateModal = () => {
        setEditingDef(null);
        setFormData({ 
            name: '', 
            sprite: '1', 
            greeting: '',
            type: 'other',
            interaction_mode: 'hybrid',
            voice_type: 'male',
            shop_id: ''
        });
        setInstances([]);
        setIsModalOpen(true);
    };

    const fetchInstancesForDef = async (defID) => {
        setLoadingInstances(true);
        try {
            const res = await api.get(`/admin/npc-definitions/${defID}/templates`);
            const fetchedInstances = res.data;
            setInstances(fetchedInstances);
            
            // Initialize form data with current mission assignments
            const initialData = {};
            for (const tmpl of fetchedInstances) {
                // Fetch missions for this specific NPC
                try {
                    const missionsRes = await api.get(`/missions/npc/${tmpl.id}`);
                    initialData[tmpl.id] = {
                        mission_ids: missionsRes.data.missions?.map(m => m.id) || [],
                        role: missionsRes.data.npc_type || 'task_npc',
                        instructions: tmpl.instructions || '',
                        success_message: tmpl.success_message || '',
                        greeting: tmpl.greeting || ''
                    };
                } catch (err) {
                    initialData[tmpl.id] = { mission_ids: [], role: 'task_npc' };
                }
            }
            setInstanceFormData(initialData);
        } catch (err) {
            console.error("Error loading instances", err);
        } finally {
            setLoadingInstances(false);
        }
    };

    const openEditModal = (def) => {
        setEditingDef(def);
        setFormData({ 
            name: def.name, 
            sprite: def.sprite, 
            greeting: def.greeting || '',
            type: def.type,
            interaction_mode: def.interaction_mode || 'hybrid',
            voice_type: def.voice_type || 'male',
            gift_item_id: def.gift_item_id || '',
            gift_quantity: def.gift_quantity || 0,
            shop_id: def.shop_id || ''
        });
        
        // Reset and Fetch instances for this definition
        setInstances([]);
        setInstanceFormData({});
        fetchInstancesForDef(def.id);
        
        setIsModalOpen(true);
    };

    const openInstanceModal = async (def) => {
        setSelectedDefForInstances(def);
        setIsInstanceModalOpen(true);
        setLoadingInstances(true);
        try {
            const res = await api.get(`/admin/npc-definitions/${def.id}/templates`);
            const fetchedInstances = res.data;
            setInstances(fetchedInstances);
            
            // Initialize form data with current mission assignments
            const initialData = {};
            for (const tmpl of fetchedInstances) {
                // Fetch missions for this specific NPC
                try {
                    const missionsRes = await api.get(`/missions/npc/${tmpl.id}`);
                    initialData[tmpl.id] = {
                        mission_ids: missionsRes.data.missions?.map(m => m.id) || [],
                        role: missionsRes.data.npc_type || 'task_npc',
                        instructions: tmpl.instructions || '',
                        success_message: tmpl.success_message || '',
                        greeting: tmpl.greeting || ''
                    };
                } catch (err) {
                    initialData[tmpl.id] = { mission_ids: [], role: 'task_npc' };
                }
            }
            setInstanceFormData(initialData);
        } catch (err) {
            setError("Error loading instances");
        } finally {
            setLoadingInstances(false);
        }
    };

    const handleSaveInstanceMissions = async (tmplID) => {
        const data = instanceFormData[tmplID];
        try {
            await api.put(`/admin/npc-templates/${tmplID}/missions`, {
                mission_ids: data.mission_ids,
                role: data.role,
                instructions: data.instructions,
                success_message: data.success_message,
                greeting: data.greeting
            });
            // Show a subtle toast or feedback instead of alert if possible
            alert(t('admin.npc_definitions.missions_updated') || "Misiones actualizadas correctamente");
        } catch (err) {
            alert(t('admin.npc_definitions.missions_error') || "Error al guardar misiones");
        }
    };

    const toggleMissionForInstance = (tmplID, missionID) => {
        setInstanceFormData(prev => {
            const current = prev[tmplID]?.mission_ids || [];
            const updated = current.includes(missionID)
                ? current.filter(id => id !== missionID)
                : [...current, missionID];
            return {
                ...prev,
                [tmplID]: { ...prev[tmplID], mission_ids: updated }
            };
        });
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                    <Users size={28} className="text-yellow-400" />
                    <div>
                        <h1 className="text-2xl font-bold text-white">{t('admin.npc_definitions.title')}</h1>
                        <p className="text-gray-400 text-sm">{t('admin.npc_definitions.subtitle')}</p>
                    </div>
                </div>
                <button 
                    onClick={openCreateModal}
                    className="flex items-center gap-2 bg-yellow-500 hover:bg-yellow-400 text-black px-4 py-2 rounded-lg font-bold transition-all shadow-lg hover:scale-105"
                >
                    <Plus size={20} />
                    {t('admin.npc_definitions.new_definition')}
                </button>
            </div>

            {error && (
                <div className="bg-red-900/20 border border-red-900/50 text-red-400 p-4 rounded-lg flex items-center gap-3">
                    <AlertCircle size={20} />
                    <span>{error}</span>
                </div>
            )}

            {loading ? (
                <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-400"></div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {definitions.map(def => (
                        <DefinitionCard 
                            key={def.id} 
                            definition={def} 
                            onEdit={openEditModal} 
                            onDelete={handleDelete} 
                        />
                    ))}
                </div>
            )}

            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
                    <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-3xl shadow-2xl my-8">
                        <div className="flex items-center justify-between p-6 border-b border-gray-800 sticky top-0 bg-gray-900 rounded-t-2xl z-20">
                            <h2 className="text-xl font-bold text-white">
                                {editingDef ? `${t('admin.npc_definitions.form.title_edit') || 'Editar NPC'}: ${editingDef.name}` : t('admin.npc_definitions.form.title_new') || 'Nueva Definición'}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white transition-colors">
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto max-h-[70vh] custom-scrollbar">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Columna Izquierda: Identidad */}
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 mb-2 text-yellow-500">
                                        <Users size={16} />
                                        <span className="text-xs font-bold uppercase tracking-widest">Identidad</span>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('admin.npc_definitions.form.name') || 'Nombre'}</label>
                                        <input 
                                            type="text" 
                                            required
                                            value={formData.name}
                                            onChange={e => setFormData({...formData, name: e.target.value})}
                                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-yellow-500/50"
                                            placeholder={t('admin.npc_definitions.form.name_placeholder') || 'Nombre del NPC'}
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('admin.npc_definitions.form.sprite_base') || 'Sprite Base'}</label>
                                        <select 
                                            value={formData.sprite}
                                            onChange={e => setFormData({...formData, sprite: e.target.value})}
                                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-yellow-500/50"
                                        >
                                            {NPC_CONFIG.npcs.map(n => (
                                                <option key={n.id} value={n.id}>NPC #{n.id}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('admin.npc_definitions.form.greeting') || 'Saludo Inicial'}</label>
                                        <textarea 
                                            value={formData.greeting}
                                            onChange={e => setFormData({...formData, greeting: e.target.value})}
                                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-yellow-500/50 min-h-[100px]"
                                            placeholder="Ej: Hello hero! How can I help you today?"
                                        />
                                    </div>
                                </div>

                                {/* Columna Derecha: Configuración */}
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 mb-2 text-blue-500">
                                        <Edit2 size={16} />
                                        <span className="text-xs font-bold uppercase tracking-widest">Comportamiento</span>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('admin.npc_definitions.form.type') || 'Tipo / Rol'}</label>
                                        <select 
                                            value={formData.type}
                                            onChange={e => {
                                                const newType = e.target.value;
                                                const newData = { ...formData, type: newType };
                                                if (newType !== 'merchant') newData.shop_id = '';
                                                setFormData(newData);
                                            }}
                                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-yellow-500/50"
                                        >
                                            <option value="other">{t('admin.npc_definitions.types.other') || 'Otro'}</option>
                                            <option value="quest_giver">{t('admin.npc_definitions.types.quest_giver') || 'Misiones (Juez)'}</option>
                                            <option value="quest_master">{t('admin.npc_definitions.types.quest_master') || 'Maestro de Misiones (Portal)'}</option>
                                            <option value="merchant">{t('admin.npc_definitions.types.merchant') || 'Tienda'}</option>
                                            <option value="guide">{t('admin.npc_definitions.types.guide') || 'Guía'}</option>
                                        </select>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('admin.npc_definitions.form.interaction_mode') || 'Modo Diálogo'}</label>
                                            <select 
                                                value={formData.interaction_mode}
                                                onChange={e => setFormData({...formData, interaction_mode: e.target.value})}
                                                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-yellow-500/50"
                                            >
                                                <option value="hybrid">{t('admin.npc_definitions.modes.hybrid') || 'Híbrido'}</option>
                                                <option value="audio_only">{t('admin.npc_definitions.modes.audio_only') || 'Solo Audio'}</option>
                                                <option value="text_only">{t('admin.npc_definitions.modes.text_only') || 'Solo Texto'}</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('admin.npc_definitions.form.voice_type') || 'Voz Genérica'}</label>
                                            <select 
                                                value={formData.voice_type}
                                                onChange={e => setFormData({...formData, voice_type: e.target.value})}
                                                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-yellow-500/50"
                                            >
                                                <option value="male">{t('admin.npc_definitions.voices.male') || 'Masculina'}</option>
                                                <option value="female">{t('admin.npc_definitions.voices.female') || 'Femenina'}</option>
                                            </select>
                                        </div>
                                    </div>

                                    {formData.type === 'merchant' && (
                                        <div className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-xl">
                                            <label className="block text-xs font-bold text-blue-500 uppercase mb-2 tracking-widest">{t('admin.npc_definitions.form.shop') || 'Tienda Asociada'}</label>
                                            <select 
                                                value={formData.shop_id}
                                                onChange={e => setFormData({...formData, shop_id: e.target.value})}
                                                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50"
                                            >
                                                <option value="">{t('admin.npc_definitions.form.no_shop') || 'Ninguna tienda'}</option>
                                                {allShops.map(shop => (
                                                    <option key={shop.id} value={shop.id}>{shop.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                    <div className="p-4 bg-yellow-500/5 border border-yellow-500/20 rounded-xl space-y-3">
                                        <p className="text-[10px] font-bold text-yellow-500 uppercase tracking-widest">{t('admin.npc_definitions.form.gift_title') || 'Regalo Inicial (Opcional)'}</p>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-[10px] text-gray-500 mb-1 font-semibold">{t('admin.npc_definitions.form.gift_item') || 'Ítem a Entregar'}</label>
                                                <select 
                                                    value={formData.gift_item_id}
                                                    onChange={e => setFormData({...formData, gift_item_id: e.target.value})}
                                                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-yellow-500/50"
                                                >
                                                    <option value="">{t('admin.npc_definitions.form.gift_none') || 'Ninguno'}</option>
                                                    {allItems.map(item => (
                                                        <option key={item.id} value={item.id}>{item.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] text-gray-500 mb-1 font-semibold">{t('admin.npc_definitions.form.gift_quantity') || 'Cantidad'}</label>
                                                <input 
                                                    type="number"
                                                    min="0"
                                                    value={formData.gift_quantity}
                                                    onChange={e => setFormData({...formData, gift_quantity: parseInt(e.target.value) || 0})}
                                                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-yellow-500/50"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Sección Condicional: Misiones e Instancias */}
                            {(formData.type === 'quest_giver' || formData.type === 'other' || formData.type === 'guide') && (
                                <div className="mt-8 border-t border-gray-800 pt-8">
                                    <div className="flex items-center gap-2 mb-4 text-green-500">
                                        <ScrollText size={20} />
                                        <h3 className="text-lg font-bold">Misiones Asociadas</h3>
                                    </div>
                                    
                                    {loadingInstances ? (
                                        <div className="flex flex-col items-center justify-center py-12 bg-gray-800/20 rounded-xl border border-gray-700/50">
                                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-500 mb-3"></div>
                                            <p className="text-xs text-gray-500 animate-pulse">Buscando ubicaciones en el mapa...</p>
                                        </div>
                                    ) : instances.length === 0 ? (
                                        <div className="text-center py-8 bg-gray-800/30 rounded-xl border border-dashed border-gray-700">
                                            <AlertCircle className="mx-auto mb-2 text-gray-600" size={24} />
                                            <p className="text-sm text-gray-500">Este NPC aún no ha sido colocado en ningún mapa.</p>
                                            <p className="text-[10px] text-gray-600">Las misiones se asignan a cada ubicación del NPC en el juego.</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 gap-4">
                                            {instances.map(tmpl => (
                                                <div key={tmpl.id} className="bg-gray-800/50 border border-gray-700 rounded-xl overflow-hidden shadow-sm border-l-4 border-l-green-600">
                                                    <div className="p-3 bg-gray-800/80 flex items-center justify-between border-b border-gray-700">
                                                        <div>
                                                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block leading-none mb-1">Mapa / Escena</span>
                                                            <h4 className="text-white font-bold uppercase flex items-center gap-2">
                                                                <MapPin size={12} className="text-green-500" />
                                                                {tmpl.scene_key}
                                                            </h4>
                                                        </div>
                                                        <button 
                                                            type="button"
                                                            onClick={() => handleSaveInstanceMissions(tmpl.id)}
                                                            className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-md active:scale-95"
                                                        >
                                                            <Save size={14} />
                                                            {t('common.save') || 'Guardar Misiones'}
                                                        </button>
                                                    </div>
                                                    
                                                    <div className="p-4 bg-gray-900/20 space-y-4">
                                                        {/* Nuevos campos de Instrucciones y Mensaje de Éxito */}
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                            <div>
                                                                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1 tracking-widest flex items-center gap-1">
                                                                    <Brain size={12} className="text-blue-400" />
                                                                    Instrucciones de Instancia (AI Prompt)
                                                                </label>
                                                                <textarea 
                                                                    value={instanceFormData[tmpl.id]?.instructions || ''}
                                                                    onChange={e => setInstanceFormData({
                                                                        ...instanceFormData,
                                                                        [tmpl.id]: { ...instanceFormData[tmpl.id], instructions: e.target.value }
                                                                    })}
                                                                    placeholder="Ej: Debes saludar al player e invitarle a presentarse..."
                                                                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500/50 min-h-[60px] custom-scrollbar"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1 tracking-widest flex items-center gap-1">
                                                                    <CheckCircle size={12} className="text-green-400" />
                                                                    Mensaje de Propósito Cumplido
                                                                </label>
                                                                <textarea 
                                                                    value={instanceFormData[tmpl.id]?.success_message || ''}
                                                                    onChange={e => setInstanceFormData({
                                                                        ...instanceFormData,
                                                                        [tmpl.id]: { ...instanceFormData[tmpl.id], success_message: e.target.value }
                                                                    })}
                                                                    placeholder="Ej: ¡Muy bien! Has demostrado un gran nivel de inglés."
                                                                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-green-500/50 min-h-[60px] custom-scrollbar"
                                                                />
                                                            </div>
                                                        </div>

                                                        <div>
                                                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1 tracking-widest flex items-center gap-1">
                                                                <MessageSquare size={12} className="text-yellow-400" />
                                                                Saludo Específico de esta Ubicación (Sobrescribe el base)
                                                            </label>
                                                            <textarea 
                                                                value={instanceFormData[tmpl.id]?.greeting || ''}
                                                                onChange={e => setInstanceFormData({
                                                                    ...instanceFormData,
                                                                    [tmpl.id]: { ...instanceFormData[tmpl.id], greeting: e.target.value }
                                                                })}
                                                                placeholder="Ej: ¡Bienvenido a la Aldea del Saludo! Soy el guía local."
                                                                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-yellow-500/50 min-h-[40px] custom-scrollbar"
                                                            />
                                                        </div>

                                                        <div className="border-t border-gray-800 pt-4">
                                                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-2 tracking-widest flex items-center gap-1">
                                                                <ScrollText size={12} className="text-yellow-500" />
                                                                Asignar Misiones de la Base de Datos
                                                            </label>
                                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                                                {allMissions.length === 0 ? (
                                                                    <p className="text-[10px] text-gray-600 italic">No hay misiones creadas.</p>
                                                                ) : (
                                                                    allMissions.map(mission => {
                                                                        const isSelected = instanceFormData[tmpl.id]?.mission_ids?.some(id => Number(id) === Number(mission.id));
                                                                        return (
                                                                            <button
                                                                                key={mission.id}
                                                                                type="button"
                                                                                onClick={() => toggleMissionForInstance(tmpl.id, mission.id)}
                                                                                className={`flex items-center gap-3 p-2 rounded-lg border text-left transition-all ${
                                                                                    isSelected 
                                                                                    ? 'bg-green-600/10 border-green-500/50 text-green-100' 
                                                                                    : 'bg-gray-800/50 border-gray-700 text-gray-500 hover:border-gray-600'
                                                                                }`}
                                                                            >
                                                                                <div className={`flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center ${
                                                                                    isSelected ? 'bg-green-500 border-green-400' : 'bg-gray-900 border-gray-600'
                                                                                }`}>
                                                                                    {isSelected && <X size={10} className="text-white" />}
                                                                                </div>
                                                                                <span className="text-[11px] font-medium truncate">{mission.title}</span>
                                                                            </button>
                                                                        );
                                                                    })
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="pt-6 flex gap-3 border-t border-gray-800 sticky bottom-0 bg-gray-900 pb-2 z-10">
                                <button 
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 px-4 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl font-bold transition-all"
                                >
                                    {t('admin.npc_definitions.form.cancel') || 'Cancelar'}
                                </button>
                                <button 
                                    type="submit"
                                    className="flex-1 px-4 py-3 bg-yellow-500 hover:bg-yellow-400 text-black rounded-xl font-bold transition-all shadow-lg shadow-yellow-500/10 active:scale-[0.98]"
                                >
                                    {editingDef ? t('admin.npc_definitions.form.save_edit') || 'Actualizar' : t('admin.npc_definitions.form.save_new') || 'Crear NPC'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
