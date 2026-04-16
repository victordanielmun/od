import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Store, Plus, Trash2, Edit2, Search, X, CheckCircle2, Package, Tag, Info, Save, AlertCircle } from 'lucide-react';
import api from '../../services/api';
import { ItemIcon } from '../../components/common/ItemIcon';

const ShopCard = ({ shop, onEdit, onDelete }) => {
    const { t } = useTranslation();
    return (
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 hover:border-blue-500/50 transition-all group relative overflow-hidden">
            <div className="absolute top-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                <button onClick={() => onEdit(shop)} className="p-1.5 text-blue-400 hover:bg-blue-400/10 rounded">
                    <Edit2 size={16} />
                </button>
                <button onClick={() => onDelete(shop.id)} className="p-1.5 text-red-400 hover:bg-red-400/10 rounded">
                    <Trash2 size={16} />
                </button>
            </div>
            
            <div className="flex items-center gap-4 mb-4">
                <div className="bg-blue-500/10 p-3 rounded-2xl">
                    <Store size={24} className="text-blue-400" />
                </div>
                <div>
                    <h3 className="text-white font-bold text-lg">{shop.name}</h3>
                    <p className="text-gray-400 text-xs italic">{shop.description || 'Sin descripción'}</p>
                </div>
            </div>

            <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500 font-bold uppercase tracking-wider">{t('admin.shops.items_in_shop')}</span>
                    <span className="bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full font-mono">{shop.items?.length || 0}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                    {shop.items?.slice(0, 5).map(item => (
                        <span key={item.id} className="text-[10px] bg-gray-900 border border-gray-700 text-gray-400 px-2 py-1 rounded">
                            {item.name}
                        </span>
                    ))}
                    {(shop.items?.length || 0) > 5 && (
                        <span className="text-[10px] text-gray-500 font-bold px-2 py-1">+{shop.items.length - 5}</span>
                    )}
                    {(shop.items?.length || 0) === 0 && (
                        <span className="text-[10px] text-gray-600 italic px-1">{t('admin.shops.no_items')}</span>
                    )}
                </div>
            </div>
        </div>
    );
};

export const AdminShops = () => {
    const { t } = useTranslation();
    const [shops, setShops] = useState([]);
    const [allItems, setAllItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [search, setSearch] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingShop, setEditingShop] = useState(null);
    
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        item_ids: []
    });

    const fetchData = async () => {
        try {
            setLoading(true);
            const [shopsRes, itemsRes] = await Promise.all([
                api.get('/admin/shops'),
                api.get('/admin/items')
            ]);
            setShops(shopsRes.data);
            setAllItems(itemsRes.data);
            setError(null);
        } catch (err) {
            setError(t('common.error_load') || 'Error al cargar datos de tiendas e items');
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
            if (editingShop) {
                await api.put(`/admin/shops/${editingShop.id}`, formData);
            } else {
                await api.post('/admin/shops', formData);
            }
            setIsModalOpen(false);
            setEditingShop(null);
            fetchData();
        } catch (err) {
            setError(t('common.error_save') || 'Error al guardar tienda');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm(t('admin.shops.delete_confirm'))) return;
        try {
            await api.delete(`/admin/shops/${id}`);
            fetchData();
        } catch (err) {
            setError(t('common.error_delete') || 'Error al eliminar tienda');
        }
    };

    const toggleItem = (itemId) => {
        setFormData(prev => ({
            ...prev,
            item_ids: prev.item_ids.includes(itemId)
                ? prev.item_ids.filter(id => id !== itemId)
                : [...prev.item_ids, itemId]
        }));
    };

    const openCreateModal = () => {
        setEditingShop(null);
        setFormData({
            name: '',
            description: '',
            item_ids: []
        });
        setIsModalOpen(true);
    };

    const openEditModal = (shop) => {
        setEditingShop(shop);
        setFormData({
            name: shop.name || '',
            description: shop.description || '',
            item_ids: shop.items ? shop.items.map(i => i.id) : []
        });
        setIsModalOpen(true);
    };

    const filteredShops = shops.filter(s => 
        s.name.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="bg-blue-500/10 p-2 rounded-lg">
                        <Store size={28} className="text-blue-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-white">{t('admin.shops.title')}</h1>
                        <p className="text-gray-400 text-sm">{t('admin.shops.subtitle')}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                        <input 
                            type="text"
                            placeholder={t('admin.shops.search_placeholder')}
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500/50 focus:outline-none w-full md:w-64"
                        />
                    </div>
                    <button 
                        onClick={openCreateModal}
                        className="flex items-center gap-2 bg-blue-500 hover:bg-blue-400 text-white px-4 py-2 rounded-lg font-bold transition-all shadow-lg whitespace-nowrap"
                    >
                        <Plus size={20} />
                        {t('admin.shops.new_shop')}
                    </button>
                </div>
            </div>

            {error && (
                <div className="bg-red-900/20 border border-red-900/50 text-red-400 p-4 rounded-xl flex items-center gap-3">
                    <AlertCircle size={20} />
                    <span>{error}</span>
                </div>
            )}

            {loading ? (
                <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400"></div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredShops.map(shop => (
                        <ShopCard key={shop.id} shop={shop} onEdit={openEditModal} onDelete={handleDelete} />
                    ))}
                </div>
            )}

            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-gray-900 border border-gray-700 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-zoomIn">
                        <div className="flex flex-col p-8 border-b border-gray-800">
                            <div className="flex justify-between items-start mb-2">
                                <h2 className="text-2xl font-bold text-white">
                                    {editingShop ? t('admin.shops.form.title_edit') : t('admin.shops.form.title_new')}
                                </h2>
                                <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-white transition-colors">
                                    <X size={24} />
                                </button>
                            </div>
                            <p className="text-gray-400 text-sm">{t('admin.shops.form.subtitle')}</p>
                        </div>

                        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
                            <div className="p-8 space-y-6 overflow-y-auto custom-scrollbar">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-4">
                                        <div>
                                            <label className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase mb-2 tracking-widest px-1">
                                                <Tag size={12} className="text-blue-500" />
                                                {t('admin.shops.form.name')}
                                            </label>
                                            <input 
                                                type="text" required
                                                value={formData.name}
                                                onChange={e => setFormData({...formData, name: e.target.value})}
                                                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500/30 focus:outline-none transition-all"
                                                placeholder={t('admin.shops.form.name_placeholder')}
                                            />
                                        </div>
                                        <div>
                                            <label className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase mb-2 tracking-widest px-1">
                                                <Info size={12} className="text-blue-500" />
                                                {t('admin.shops.form.description')}
                                            </label>
                                            <textarea 
                                                rows="3"
                                                value={formData.description}
                                                onChange={e => setFormData({...formData, description: e.target.value})}
                                                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500/30 focus:outline-none transition-all resize-none"
                                                placeholder={t('admin.shops.form.description_placeholder')}
                                            />
                                        </div>
                                    </div>

                                    <div className="flex flex-col min-h-[300px]">
                                        <label className="flex items-center justify-between text-xs font-bold text-gray-500 uppercase mb-2 tracking-widest px-1">
                                            <div className="flex items-center gap-2">
                                                <Package size={12} className="text-blue-500" />
                                                {t('admin.shops.form.assign_items')}
                                            </div>
                                            <span className="text-[10px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full">
                                                {formData.item_ids.length} {t('admin.shops.form.selected')}
                                            </span>
                                        </label>
                                        <div className="flex-1 bg-gray-950/50 border border-gray-800 rounded-2xl overflow-hidden flex flex-col">
                                            <div className="overflow-y-auto custom-scrollbar p-3 grid grid-cols-1 gap-2">
                                                {allItems.map(item => (
                                                    <button
                                                        key={item.id}
                                                        type="button"
                                                        onClick={() => toggleItem(item.id)}
                                                        className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                                                            formData.item_ids.includes(item.id)
                                                            ? 'bg-blue-500/10 border-blue-500/50 text-blue-400'
                                                            : 'bg-gray-850 border-gray-700/50 text-gray-400 hover:border-gray-600'
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-3 truncate">
                                                            <div className={`p-1.5 rounded-lg ${formData.item_ids.includes(item.id) ? 'bg-blue-500/20' : 'bg-gray-800'}`}>
                                                                <Package size={14} />
                                                            </div>
                                                            <span className="text-sm font-medium truncate">{item.name}</span>
                                                        </div>
                                                        {formData.item_ids.includes(item.id) && <CheckCircle2 size={16} />}
                                                    </button>
                                                ))}
                                                {allItems.length === 0 && (
                                                    <div className="flex flex-col items-center justify-center py-12 text-gray-600 italic text-sm">
                                                        <Package size={32} className="mb-2 opacity-10" />
                                                        {t('admin.shops.form.no_items_catalog')}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="p-8 border-t border-gray-800 bg-gray-900/50 flex gap-4">
                                <button 
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 px-6 py-4 bg-gray-800 hover:bg-gray-750 text-gray-400 rounded-2xl font-bold transition-all border border-gray-700"
                                >
                                    {t('admin.shops.form.cancel')}
                                </button>
                                <button 
                                    type="submit"
                                    className="flex-[2] px-6 py-4 bg-blue-500 hover:bg-blue-400 text-white rounded-2xl font-bold transition-all shadow-xl shadow-blue-500/20 flex items-center justify-center gap-2"
                                >
                                    <Save size={20} />
                                    {editingShop ? t('admin.shops.form.save_edit') : t('admin.shops.form.save_new')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
