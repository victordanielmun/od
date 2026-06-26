import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Package, Plus, Trash2, Edit2, Search, X, AlertCircle, Save, HelpCircle, Heart, Zap, Shield, Sparkles, Target, Scroll } from 'lucide-react';
import api from '../../services/api';
import { ItemIcon } from '../../components/common/ItemIcon';

const ITEM_TYPES = [
    { value: 'health', label: 'Consumible Salud', icon: Heart },
    { value: 'mana', label: 'Consumible Maná', icon: Zap },
    { value: 'reviver', label: 'Revividor', icon: Sparkles },
    { value: 'throwable', label: 'Arma Arrojable', icon: Target },
    { value: 'weapon', label: 'Arma', icon: Target },
    { value: 'defense', label: 'Defensa', icon: Shield },
    { value: 'scroll', label: 'Pergamino de Habilidad', icon: Scroll },
    { value: 'mission_item', label: 'Ítem de Misión', icon: Sparkles },
    { value: 'other', label: 'Otro / Material', icon: HelpCircle }
];

const EFFECT_TYPES = [
    { value: 'heal_hp', label: 'Curar Vida (HP)' },
    { value: 'restore_mp', label: 'Restaurar Maná (MP)' },
    { value: 'revive', label: 'Revivir Jugador' },
    { value: 'damage', label: 'Daño (Arrojable)' },
    { value: 'grant_skill', label: 'Otorgar Habilidad' },
    { value: 'none', label: 'Ninguno' }
];

const ItemCard = ({ item, onEdit, onDelete }) => {
    const { t } = useTranslation();
    return (
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 hover:border-yellow-500/50 transition-all group">
            <div className="flex gap-4">
                <ItemIcon iconKey={item.icon_key} type={item.item_type} />
                <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                        <h3 className="text-white font-bold truncate">{item.name}</h3>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => onEdit(item)} className="p-1.5 text-blue-400 hover:bg-blue-400/10 rounded">
                                <Edit2 size={14} />
                            </button>
                            <button onClick={() => onDelete(item.id)} className="p-1.5 text-red-400 hover:bg-red-400/10 rounded">
                                <Trash2 size={14} />
                            </button>
                        </div>
                    </div>
                    <p className="text-gray-400 text-xs line-clamp-2 mt-1">{item.description}</p>
                    <div className="flex flex-wrap items-center gap-3 mt-3 text-[10px]">
                        <span className="text-yellow-400 font-bold">{item.price} Gold</span>
                        <span className="text-gray-500 uppercase tracking-wider">{t(`admin.items.effect_types.${item.item_type}`)}</span>
                        {item.attack_bonus > 0 && <span className="text-red-400 font-bold">ATK: +{item.attack_bonus}</span>}
                        {item.defense_bonus > 0 && <span className="text-blue-400 font-bold">DEF: +{item.defense_bonus}</span>}
                    </div>
                </div>
            </div>
        </div>
    );
};

export const AdminItems = () => {
    const { t } = useTranslation();
    
    const LOCALIZED_ITEM_TYPES = [
        { value: 'health', label: t('admin.npc_definitions.types.merchant'), icon: Heart }, // Reusing or new keys
        { value: 'health', label: t('admin.items.effect_types.heal_hp'), icon: Heart },
        { value: 'mana', label: t('admin.items.effect_types.restore_mp'), icon: Zap },
        { value: 'reviver', label: t('admin.items.effect_types.revive'), icon: Sparkles },
        { value: 'throwable', label: t('admin.items.effect_types.damage'), icon: Target },
        { value: 'weapon', label: t('items.types.weapon'), icon: Target },
        { value: 'defense', label: t('items.types.armor'), icon: Shield },
        { value: 'scroll', label: t('items.types.scroll') || 'Pergamino de Habilidad', icon: Scroll },
        { value: 'mission_item', label: t('items.types.quest'), icon: Sparkles },
        { value: 'other', label: t('items.types.material'), icon: HelpCircle }
    ];

    const LOCALIZED_EFFECT_TYPES = [
        { value: 'heal_hp', label: t('admin.items.effect_types.heal_hp') },
        { value: 'restore_mp', label: t('admin.items.effect_types.restore_mp') },
        { value: 'revive', label: t('admin.items.effect_types.revive') },
        { value: 'damage', label: t('admin.items.effect_types.damage') },
        { value: 'grant_skill', label: t('admin.items.effect_types.grant_skill') || 'Otorgar Habilidad' },
        { value: 'none', label: t('admin.items.effect_types.none') }
    ];

    const [items, setItems] = useState([]);
    const [skills, setSkills] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [search, setSearch] = useState('');
    const [isIdModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [availableSprites, setAvailableSprites] = useState([]);
    const [showSpritePicker, setShowSpritePicker] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        item_type: 'health',
        effect_type: 'none',
        effect_value: 0,
        attack_bonus: 0,
        defense_bonus: 0,
        required_level: 1,
        price: 10,
        max_stack: 99,
        icon_key: '',
        grants_skill_id: '',
        spell_type: ''
    });

    const fetchData = async () => {
        try {
            setLoading(true);
            const [itemsRes, spritesRes, skillsRes] = await Promise.all([
                api.get('/admin/items'),
                api.get('/admin/item-sprites'),
                api.get('/admin/skills').catch(() => ({ data: [] }))
            ]);
            setItems(itemsRes.data);
            setAvailableSprites(spritesRes.data || []);
            setSkills(skillsRes.data || []);
            setError(null);
        } catch (err) {
            setError(t('common.error_load') || 'Error al cargar items');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                ...formData,
                grants_skill_id: formData.grants_skill_id || null
            };
            if (editingItem) {
                await api.put(`/admin/items/${editingItem.id}`, payload);
            } else {
                await api.post('/admin/items', payload);
            }
            setIsModalOpen(false);
            setEditingItem(null);
            fetchData();
        } catch (err) {
            setError(t('common.error_save') || 'Error al guardar item');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm(t('admin.items.delete_confirm'))) return;
        try {
            await api.delete(`/admin/items/${id}`);
            fetchData();
        } catch (err) {
            setError(t('common.error_delete') || 'Error al eliminar item');
        }
    };

    const openCreateModal = () => {
        setEditingItem(null);
        setFormData({
            name: '',
            description: '',
            item_type: 'health',
            effect_type: 'none',
            effect_value: 0,
            attack_bonus: 0,
            defense_bonus: 0,
            required_level: 1,
            price: 10,
            max_stack: 99,
            icon_key: '',
            grants_skill_id: '',
            spell_type: ''
        });
        setIsModalOpen(true);
    };

    const openEditModal = (item) => {
        setEditingItem(item);
        setFormData({
            name: item.name,
            description: item.description,
            item_type: item.item_type,
            effect_type: item.effect_type,
            effect_value: item.effect_value,
            attack_bonus: item.attack_bonus || 0,
            defense_bonus: item.defense_bonus || 0,
            required_level: item.required_level || 1,
            price: item.price,
            max_stack: item.max_stack,
            icon_key: item.icon_key || '',
            grants_skill_id: item.grants_skill_id || '',
            spell_type: item.spell_type || ''
        });
        setIsModalOpen(true);
    };

    const filteredItems = items.filter(i => 
        i.name.toLowerCase().includes(search.toLowerCase()) || 
        i.item_type.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="bg-yellow-500/10 p-2 rounded-lg">
                        <Package size={28} className="text-yellow-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-white">{t('admin.items.title')}</h1>
                        <p className="text-gray-400 text-sm">{t('admin.items.subtitle')}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                        <input 
                            type="text"
                            placeholder={t('admin.items.search_placeholder')}
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:ring-2 focus:ring-yellow-500/50 focus:outline-none w-full md:w-64"
                        />
                    </div>
                    <button 
                        onClick={openCreateModal}
                        className="flex items-center gap-2 bg-yellow-500 hover:bg-yellow-400 text-black px-4 py-2 rounded-lg font-bold transition-all shadow-lg whitespace-nowrap"
                    >
                        <Plus size={20} />
                        {t('admin.items.new_item')}
                    </button>
                </div>
            </div>

            {error && (
                <div className="bg-red-900/20 border border-red-900/50 text-red-400 p-4 rounded-xl flex items-center gap-3 animate-shake">
                    <AlertCircle size={20} />
                    <span>{error}</span>
                </div>
            )}

            {loading ? (
                <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-400"></div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredItems.map(item => (
                        <ItemCard key={item.id} item={item} onEdit={openEditModal} onDelete={handleDelete} />
                    ))}
                    {filteredItems.length === 0 && (
                        <div className="col-span-full py-12 text-center text-gray-500 bg-gray-800/20 rounded-2xl border-2 border-dashed border-gray-800">
                            <Package className="mx-auto mb-3 opacity-20" size={48} />
                            <p>{t('admin.items.empty')}</p>
                        </div>
                    )}
                </div>
            )}

            {/* Item Modal */}
            {isIdModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-zoomIn">
                        <div className="flex items-center justify-between p-6 border-b border-gray-800">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                {editingItem ? <Edit2 size={20} className="text-blue-400" /> : <Plus size={20} className="text-green-400" />}
                                {editingItem ? t('admin.items.form.title_edit') : t('admin.items.form.title_new')}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white transition-colors">
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto custom-scrollbar">
                            <div className="flex gap-4">
                                <div className="flex-1 space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 px-1">{t('admin.items.form.name')}</label>
                                        <input 
                                            type="text" required
                                            value={formData.name}
                                            onChange={e => setFormData({...formData, name: e.target.value})}
                                            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white focus:ring-2 focus:ring-yellow-500/30 focus:outline-none transition-all"
                                            placeholder={t('admin.items.form.name_placeholder')}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 px-1">{t('admin.items.form.type')}</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {LOCALIZED_ITEM_TYPES.map(type => (
                                                <button
                                                    key={type.label}
                                                    type="button"
                                                    onClick={() => setFormData({...formData, item_type: type.value})}
                                                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
                                                        formData.item_type === type.value 
                                                        ? 'bg-yellow-500/10 border-yellow-500/50 text-yellow-400' 
                                                        : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-750'
                                                    }`}
                                                >
                                                    <type.icon size={14} />
                                                    {type.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                <div className="w-32 flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-800 rounded-2xl bg-gray-950/20">
                                    <ItemIcon iconKey={formData.icon_key} type={formData.item_type} size={84} />
                                    <span className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">{t('admin.items.form.preview')}</span>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 px-1">{t('admin.items.form.description')}</label>
                                <textarea 
                                    rows="2"
                                    value={formData.description}
                                    onChange={e => setFormData({...formData, description: e.target.value})}
                                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 text-white focus:ring-2 focus:ring-yellow-500/30 focus:outline-none resize-none"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 px-1">{t('admin.items.form.price')}</label>
                                    <input 
                                        type="number"
                                        value={formData.price}
                                        onChange={e => setFormData({...formData, price: parseInt(e.target.value)})}
                                        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white focus:ring-2 focus:ring-yellow-500/30 focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 px-1">{t('admin.items.form.icon_key')}</label>
                                    <div className="relative group/picker">
                                        <div 
                                            onClick={() => setShowSpritePicker(!showSpritePicker)}
                                            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white cursor-pointer hover:border-yellow-500/50 transition-all flex items-center justify-between"
                                        >
                                            <span className="font-mono text-sm">{formData.icon_key || t('admin.items.form.select_sprite')}</span>
                                            <Sparkles size={16} className={formData.icon_key ? 'text-yellow-500' : 'text-gray-600'} />
                                        </div>

                                        {showSpritePicker && (
                                            <div className="absolute top-full left-0 right-0 mt-2 bg-gray-900 border border-gray-700 rounded-xl p-3 shadow-2xl z-[60] animate-fadeIn">
                                                <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto custom-scrollbar p-1">
                                                    {availableSprites.map(sprite => (
                                                        <button
                                                            key={sprite}
                                                            type="button"
                                                            onClick={() => {
                                                                setFormData({...formData, icon_key: sprite});
                                                                setShowSpritePicker(false);
                                                            }}
                                                            className={`p-2 rounded-lg border transition-all flex flex-col items-center gap-1 ${
                                                                formData.icon_key === sprite 
                                                                ? 'bg-yellow-500/20 border-yellow-500/50' 
                                                                : 'bg-gray-800 border-gray-800 hover:border-gray-600'
                                                            }`}
                                                        >
                                                            <ItemIcon iconKey={sprite} type={formData.item_type} size={32} />
                                                            <span className="text-[8px] text-gray-400 truncate w-full text-center">{sprite}</span>
                                                        </button>
                                                    ))}
                                                    {availableSprites.length === 0 && (
                                                        <div className="col-span-full py-4 text-center text-xs text-gray-500 italic">
                                                            {t('admin.items.form.no_sprites')}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {(formData.item_type === 'health' || formData.item_type === 'mana' || formData.item_type === 'reviver' || formData.item_type === 'throwable' || formData.item_type === 'scroll') && (
                                <div className="bg-gray-800/50 p-4 rounded-2xl border border-gray-800 space-y-4">
                                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                        <Sparkles size={12} className="text-yellow-400" />
                                        {t('admin.items.form.effect_props')}
                                    </h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-600 uppercase mb-1.5 px-1">{t('admin.items.form.effect_type')}</label>
                                            <select 
                                                value={formData.effect_type}
                                                onChange={e => setFormData({...formData, effect_type: e.target.value})}
                                                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
                                            >
                                                {LOCALIZED_EFFECT_TYPES.map(eff => <option key={eff.value} value={eff.value}>{eff.label}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-600 uppercase mb-1.5 px-1">{t('admin.items.form.effect_value')}</label>
                                            <input 
                                                type="number"
                                                value={formData.effect_value}
                                                onChange={e => setFormData({...formData, effect_value: parseInt(e.target.value)})}
                                                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-white focus:outline-none"
                                            />
                                        </div>
                                        {formData.effect_type === 'grant_skill' && (
                                            <div className="col-span-2">
                                                <label className="block text-xs font-bold text-gray-600 uppercase mb-1.5 px-1">Habilidad que Otorga</label>
                                                <select
                                                    value={formData.grants_skill_id || ''}
                                                    onChange={e => setFormData({...formData, grants_skill_id: e.target.value || null})}
                                                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none"
                                                >
                                                    <option value="">Selecciona una habilidad...</option>
                                                    {skills.map(sk => (
                                                        <option key={sk.id} value={sk.id}>{sk.name} ({sk.skill_type})</option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}
                                        {formData.item_type === 'scroll' && (
                                            <div className="col-span-2">
                                                <label className="block text-xs font-bold text-gray-600 uppercase mb-1.5 px-1">Hechizo del Pergamino</label>
                                                <select
                                                    value={formData.spell_type || ''}
                                                    onChange={e => setFormData({...formData, spell_type: e.target.value})}
                                                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none"
                                                >
                                                    <option value="">Auto (según el nombre)</option>
                                                    <option value="fire_rain">Lluvia de Fuego (12 dmg/bola)</option>
                                                    <option value="wave">Onda (25 dmg)</option>
                                                    <option value="nova">Nova (40 dmg)</option>
                                                </select>
                                                <p className="text-[10px] text-gray-500 mt-1 px-1">Define qué hechizo lanza este Pergamino al equiparlo y pulsar la tecla de hechizo.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {(formData.item_type === 'weapon' || formData.item_type === 'defense') && (
                                <div className="bg-blue-900/10 p-4 rounded-2xl border border-blue-900/20 space-y-4">
                                    <h3 className="text-xs font-bold text-blue-400 uppercase tracking-widest flex items-center gap-2">
                                        <Shield size={12} className="text-blue-400" />
                                        {t('admin.items.form.equip_props')}
                                    </h3>
                                    <div className="grid grid-cols-3 gap-4">
                                        {formData.item_type === 'weapon' && (
                                            <div>
                                                <label className="block text-xs font-bold text-gray-600 uppercase mb-1.5 px-1">{t('admin.items.form.attack_bonus')}</label>
                                                <input 
                                                    type="number"
                                                    value={formData.attack_bonus}
                                                    onChange={e => setFormData({...formData, attack_bonus: parseInt(e.target.value)})}
                                                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-white focus:outline-none"
                                                />
                                            </div>
                                        )}
                                        {formData.item_type === 'defense' && (
                                            <div>
                                                <label className="block text-xs font-bold text-gray-600 uppercase mb-1.5 px-1">{t('admin.items.form.defense_bonus')}</label>
                                                <input 
                                                    type="number"
                                                    value={formData.defense_bonus}
                                                    onChange={e => setFormData({...formData, defense_bonus: parseInt(e.target.value)})}
                                                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-white focus:outline-none"
                                                />
                                            </div>
                                        )}
                                        <div>
                                            <label className="block text-xs font-bold text-gray-600 uppercase mb-1.5 px-1">{t('admin.items.form.required_level')}</label>
                                            <input 
                                                type="number"
                                                value={formData.required_level}
                                                onChange={e => setFormData({...formData, required_level: parseInt(e.target.value)})}
                                                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-white focus:outline-none"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="pt-4 flex gap-3">
                                <button 
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 px-4 py-3 bg-gray-800 hover:bg-gray-750 text-gray-400 rounded-xl font-bold transition-all border border-gray-700"
                                >
                                    {t('common.cancel')}
                                </button>
                                <button 
                                    type="submit"
                                    className="flex-1 px-4 py-3 bg-yellow-500 hover:bg-yellow-400 text-black rounded-xl font-bold transition-all shadow-lg shadow-yellow-500/20 flex items-center justify-center gap-2"
                                >
                                    <Save size={18} />
                                    {editingItem ? t('admin.items.form.save_edit') : t('admin.items.form.save_new')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
