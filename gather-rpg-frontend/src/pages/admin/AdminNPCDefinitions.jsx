import React, { useEffect, useRef, useState } from 'react';
import { Users, Plus, Trash2, Edit2, Save, X, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import { NPC_CONFIG } from '../../game/config/NPCConfig';

const Phaser = window.Phaser;

// --- Preview Scene (Simplified for NPCs) ---
class DefinitionPreviewScene extends Phaser.Scene {
    constructor(charId) {
        // Normalize charId (e.g., 'sprite1' -> '1') to match NPC_CONFIG
        const cleanId = charId?.toString().replace('sprite', '') || '2';
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
                         NPC_CONFIG.animationsByNPC['2']; // Fallback to Trainer
        
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
            scene: new DefinitionPreviewScene(definition.sprite || '2'),
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
        type: 'other',
        interaction_mode: 'hybrid',
        voice_type: 'male',
        gift_item_id: '',
        gift_quantity: 0,
        shop_id: ''
    });
    const [allItems, setAllItems] = useState([]);
    const [allShops, setAllShops] = useState([]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [npcsRes, itemsRes, shopsRes] = await Promise.all([
                api.get('/admin/npc-definitions'),
                api.get('/admin/items'),
                api.get('/admin/shops')
            ]);
            setDefinitions(npcsRes.data);
            setAllItems(itemsRes.data);
            setAllShops(shopsRes.data);
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
            type: 'other',
            interaction_mode: 'hybrid',
            voice_type: 'male',
            shop_id: ''
        });
        setIsModalOpen(true);
    };

    const openEditModal = (def) => {
        setEditingDef(def);
        setFormData({ 
            name: def.name, 
            sprite: def.sprite, 
            type: def.type,
            interaction_mode: def.interaction_mode || 'hybrid',
            voice_type: def.voice_type || 'male',
            gift_item_id: def.gift_item_id || '',
            gift_quantity: def.gift_quantity || 0,
            shop_id: def.shop_id || ''
        });
        setIsModalOpen(true);
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

            {/* Modal de Formulario */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl">
                        <div className="flex items-center justify-between p-6 border-b border-gray-800">
                            <h2 className="text-xl font-bold text-white">
                                {editingDef ? t('admin.npc_definitions.form.title_edit') : t('admin.npc_definitions.form.title_new')}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white">
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('admin.npc_definitions.form.name')}</label>
                                <input 
                                    type="text" 
                                    required
                                    value={formData.name}
                                    onChange={e => setFormData({...formData, name: e.target.value})}
                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-yellow-500/50"
                                    placeholder={t('admin.npc_definitions.form.name_placeholder')}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('admin.npc_definitions.form.sprite_base')}</label>
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
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('admin.npc_definitions.form.type')}</label>
                                    <select 
                                        value={formData.type}
                                        onChange={e => {
                                            const newType = e.target.value;
                                            const newData = { ...formData, type: newType };
                                            // Reset role-specific fields if type changes
                                            if (newType !== 'merchant') {
                                                newData.shop_id = '';
                                            }
                                            setFormData(newData);
                                        }}
                                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-yellow-500/50"
                                    >
                                        <option value="other">{t('admin.npc_definitions.types.other')}</option>
                                        <option value="quest_giver">{t('admin.npc_definitions.types.quest_giver')}</option>
                                        <option value="merchant">{t('admin.npc_definitions.types.merchant')}</option>
                                        <option value="guide">{t('admin.npc_definitions.types.guide')}</option>
                                    </select>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('admin.npc_definitions.form.interaction_mode')}</label>
                                        <select 
                                            value={formData.interaction_mode}
                                            onChange={e => setFormData({...formData, interaction_mode: e.target.value})}
                                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-yellow-500/50"
                                        >
                                            <option value="hybrid">{t('admin.npc_definitions.modes.hybrid')}</option>
                                            <option value="audio_only">{t('admin.npc_definitions.modes.audio_only')}</option>
                                            <option value="text_only">{t('admin.npc_definitions.modes.text_only')}</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('admin.npc_definitions.form.voice_type')}</label>
                                        <select 
                                            value={formData.voice_type}
                                            onChange={e => setFormData({...formData, voice_type: e.target.value})}
                                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-yellow-500/50"
                                        >
                                            <option value="male">{t('admin.npc_definitions.voices.male')}</option>
                                            <option value="female">{t('admin.npc_definitions.voices.female')}</option>
                                        </select>
                                    </div>
                                </div>

                                {formData.type === 'merchant' && (
                                    <div className="p-3 bg-blue-500/5 border border-blue-500/20 rounded-xl">
                                        <label className="block text-xs font-bold text-blue-500 uppercase mb-2 tracking-widest">{t('admin.npc_definitions.form.shop')}</label>
                                        <select 
                                            value={formData.shop_id}
                                            onChange={e => setFormData({...formData, shop_id: e.target.value})}
                                            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50"
                                        >
                                            <option value="">{t('admin.npc_definitions.form.no_shop')}</option>
                                            {allShops.map(shop => (
                                                <option key={shop.id} value={shop.id}>{shop.name}</option>
                                            ))}
                                        </select>
                                        <p className="text-[10px] text-gray-500 mt-2 italic">
                                            {t('admin.npc_definitions.form.shop_hint')}
                                        </p>
                                    </div>
                                )}

                                <div className="p-3 bg-yellow-500/5 border border-yellow-500/20 rounded-xl space-y-3">
                                    <p className="text-[10px] font-bold text-yellow-500 uppercase tracking-widest">{t('admin.npc_definitions.form.gift_title')}</p>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-[10px] text-gray-500 mb-1 font-semibold">{t('admin.npc_definitions.form.gift_item')}</label>
                                            <select 
                                                value={formData.gift_item_id}
                                                onChange={e => setFormData({...formData, gift_item_id: e.target.value})}
                                                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-yellow-500/50"
                                            >
                                                <option value="">{t('admin.npc_definitions.form.gift_none')}</option>
                                                {allItems.map(item => (
                                                    <option key={item.id} value={item.id}>{item.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] text-gray-500 mb-1 font-semibold">{t('admin.npc_definitions.form.gift_quantity')}</label>
                                            <input 
                                                type="number"
                                                min="0"
                                                value={formData.gift_quantity}
                                                onChange={e => setFormData({...formData, gift_quantity: parseInt(e.target.value) || 0})}
                                                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-yellow-500/50"
                                            />
                                        </div>
                                    </div>
                                    {formData.gift_item_id && (
                                        <p className="text-[10px] text-gray-400 italic">
                                            {t('admin.npc_definitions.form.gift_hint')}
                                        </p>
                                    )}
                                </div>

                            <div className="pt-4 flex gap-3">
                                <button 
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg font-bold transition-all"
                                >
                                    {t('admin.npc_definitions.form.cancel')}
                                </button>
                                <button 
                                    type="submit"
                                    className="flex-1 px-4 py-2 bg-yellow-500 hover:bg-yellow-400 text-black rounded-lg font-bold transition-all"
                                >
                                    {editingDef ? t('admin.npc_definitions.form.save_edit') : t('admin.npc_definitions.form.save_new')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
