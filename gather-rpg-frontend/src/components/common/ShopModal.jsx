import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ShoppingBag, Coins, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useGameStore } from '../../store/gameStore';
import { useAuthStore } from '../../store/authStore';
import api from '../../services/api';
import { ItemIcon } from './ItemIcon';

export default function ShopModal({ npcId, onClose, shopName, initialData }) {
    const { t } = useTranslation();
    const { buyItem } = useGameStore();
    const { user } = useAuthStore();
    
    // Type colors mapping with localized labels
    const typeColors = {
        health:  { bg: "#c0392b", border: "#e74c3c", label: t('lobby.shop.categories.health') },
        mana:    { bg: "#1e3a5f", border: "#2980b9", label: t('lobby.shop.categories.mana') },
        attack:  { bg: "#7d3c98", border: "#9b59b6", label: t('lobby.shop.categories.attack') },
        defense: { bg: "#27ae60", border: "#2ecc71", label: t('lobby.shop.categories.defense') },
        default: { bg: "#5d4037", border: "#795548", label: t('lobby.shop.categories.item') },
    };

    const [shopInfo, setShopInfo] = useState({ 
        name: shopName || t('lobby.shop.title_loading'), 
        description: t('lobby.shop.desc_loading') 
    });
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [purchasingId, setPurchasingId] = useState(null);
    const [purchaseStatus, setPurchaseStatus] = useState(null); // { id, status: 'success' | 'error' }

    useEffect(() => {
        if (initialData) {
            console.log("[ShopModal] Rendering with initialData:", initialData);
            setItems(initialData.items || []);
            setShopInfo({
                name: initialData.name || shopName || t('lobby.shop.default_name'),
                description: initialData.description || t('lobby.shop.default_desc')
            });
            setLoading(false);
        } else if (npcId) {
            fetchNPCItems();
        }

        const handleEsc = (e) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [npcId, onClose]);

    const fetchNPCItems = async () => {
        try {
            setLoading(true);
            const response = await api.get(`/shop/npc/${npcId}/items`);
            const data = response.data;
            
            let finalShop = null;
            let finalItems = [];

            // Case 1: Complex shop object { name, description, items: [...] }
            if (data && data.items) {
                finalShop = data;
                finalItems = data.items;
            } 
            // Case 2: Array of shops [{ name, items: [...] }]
            else if (Array.isArray(data) && data.length > 0) {
                if (data[0].items) {
                    finalShop = data[0];
                    finalItems = data[0].items;
                } else {
                    // It's just a direct list of items
                    finalItems = data;
                }
            }

            setItems(finalItems || []);

            if (finalShop) {
                setShopInfo({
                    name: finalShop.name || shopName || t('lobby.shop.default_name'),
                    description: finalShop.description || t('lobby.shop.default_desc')
                });
            } else if (shopName) {
                setShopInfo(prev => ({ ...prev, name: shopName }));
            }
        } catch (err) {
            console.error("Failed to fetch shop items:", err);
            setShopInfo(prev => ({ ...prev, description: t('lobby.shop.error') || "Error" }));
        } finally {
            setLoading(false);
        }
    };

    const handleBuy = async (item) => {
        if (user?.stats?.gold < item.price) return;
        
        setPurchasingId(item.id);
        const success = await buyItem(item.id, 1);
        
        if (success) {
            setPurchaseStatus({ id: item.id, status: 'success' });
        } else {
            setPurchaseStatus({ id: item.id, status: 'error' });
        }

        setTimeout(() => {
            setPurchasingId(null);
            setPurchaseStatus(null);
        }, 2000);
    };

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300 pointer-events-auto">
            <div className="bg-[#1a1a2e] border-4 border-[#c9a84c] rounded-none w-full max-w-lg overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.8)] transform animate-in zoom-in-95 duration-300 relative">
                
                {/* Decorative Corners */}
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-yellow-400/30"></div>
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-yellow-400/30"></div>
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-yellow-400/30"></div>
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-yellow-400/30"></div>
                
                {/* Header */}
                <div className="p-6 bg-[#1e3a5f] border-b-4 border-[#c9a84c] flex justify-between items-center relative z-10">
                    <div className="flex items-center gap-4">
                        <div className="bg-[#c0392b] p-3 border-2 border-[#c9a84c] shadow-lg">
                            <ShoppingBag className="text-[#c9a84c]" size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-medieval text-[#c9a84c] tracking-widest uppercase drop-shadow-md">
                                {shopInfo.name}
                            </h2>
                            <p className="text-[10px] font-medieval text-[#f0e6c8]/70 uppercase tracking-widest">
                                {shopInfo.description}
                            </p>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2 bg-[#1a1a2e] px-4 py-2 border-2 border-[#c9a84c] shadow-inner">
                        <Coins size={16} className="text-[#c9a84c]" />
                        <span className="text-lg font-medieval text-white">{user?.stats?.gold || 0}</span>
                    </div>
                </div>

                {/* Items List */}
                <div className="p-4 max-h-80 overflow-y-auto bg-[#f5ead5] space-y-3 relative z-10 custom-scrollbar shadow-[inset_0_0_20px_rgba(0,0,0,0.1)]">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-70">
                            <Loader2 className="text-[#1e3a5f] animate-spin" size={40} />
                            <p className="text-sm font-medieval text-[#3e2a10] uppercase tracking-widest">{t('lobby.shop.inventory_loading')}</p>
                        </div>
                    ) : items.length > 0 ? (
                        items.map(item => {
                            const isPurchasing = purchasingId === item.id;
                            const isSuccess = purchaseStatus?.id === item.id && purchaseStatus.status === 'success';
                            const isError = purchaseStatus?.id === item.id && purchaseStatus.status === 'error';
                            const canAfford = (user?.stats?.gold || 0) >= item.price;
                            const c = typeColors[item.item_type] ?? typeColors.default;

                            // Build stats list
                            const itemStats = [];
                            if (item.effect_value) itemStats.push(`+${item.effect_value} ${item.effect_type === "heal_hp" ? "HP" : "EF"}`);
                            if (item.attack_bonus) itemStats.push(`+${item.attack_bonus} ATK`);
                            if (item.defense_bonus) itemStats.push(`+${item.defense_bonus} DEF`);

                            return (
                                <div 
                                    key={item.id} 
                                    className={`relative group border-2 p-3 flex items-center justify-between transition-all duration-300 ${
                                        isSuccess ? 'border-green-700 bg-green-50' : 
                                        isError ? 'border-red-700 bg-red-50' : 
                                        'bg-[#fff8e7] border-[#c9a84c]/40 hover:border-[#c9a84c] shadow-sm'
                                    }`}
                                >
                                    <div className="flex items-center gap-3 relative z-10">
                                        <div 
                                            className="w-12 h-12 flex-shrink-0 border-2 flex items-center justify-center shadow-inner relative overflow-hidden"
                                            style={{ background: c.bg, borderColor: c.border }}
                                        >
                                            <ItemIcon 
                                                iconKey={item.icon_key} 
                                                type={item.item_type} 
                                                size={40}
                                                className="pixelated drop-shadow-md"
                                            />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <h3 className="text-[#3e2a10] font-medieval text-sm font-bold truncate leading-tight">
                                                    {item.name}
                                                </h3>
                                                <span 
                                                    className="text-[9px] text-white px-1.5 py-0.5 uppercase tracking-wide font-medieval rounded-sm"
                                                    style={{ background: c.bg }}
                                                >
                                                    {c.label}
                                                </span>
                                            </div>
                                            <p className="text-[11px] text-[#7b6240] mb-1 line-clamp-1 italic">{item.description}</p>
                                            
                                            <div className="flex flex-wrap gap-1">
                                                {itemStats.map(s => (
                                                    <span key={s} className="text-[10px] bg-green-100 text-green-800 border border-green-200 px-1 py-0.5 rounded-sm font-bold">
                                                        {s}
                                                    </span>
                                                ))}
                                                <span className="text-[10px] bg-blue-100 text-blue-800 border border-blue-200 px-1 py-0.5 rounded-sm font-bold">
                                                    Nv. {item.required_level}
                                                </span>
                                                <span className="text-[10px] bg-gray-100 text-gray-600 border border-gray-200 px-1 py-0.5 rounded-sm">
                                                    x{item.max_stack} máx
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-col items-center gap-2 relative z-10 min-w-[80px]">
                                        <div className="flex items-center gap-1">
                                            <Coins size={14} className="text-[#7d5a1e]" />
                                            <span className="font-medieval text-[#7d5a1e] text-base font-bold">{item.price}</span>
                                        </div>
                                        <button 
                                            onClick={() => handleBuy(item)}
                                            disabled={loading || isPurchasing || !canAfford}
                                            className={`w-full py-1.5 px-3 border-2 font-medieval uppercase text-[10px] tracking-widest transition-all duration-200 transform active:translate-y-1 ${
                                                isSuccess ? 'bg-green-700 text-white border-green-900' :
                                                isError ? 'bg-red-700 text-white border-red-900' :
                                                !canAfford ? 'bg-gray-400 text-white border-gray-600 cursor-not-allowed' :
                                                'bg-[#c0392b] text-white border-[#e74c3c] hover:bg-[#a93226] shadow-md hover:shadow-sm'
                                            }`}
                                        >
                                            {isPurchasing ? (
                                                <Loader2 size={12} className="animate-spin" />
                                            ) : isSuccess ? (
                                                <CheckCircle2 size={14} />
                                            ) : isError ? (
                                                <AlertCircle size={14} />
                                            ) : (
                                                t('lobby.shop.buy')
                                            )}
                                        </button>
                                        {!canAfford && !isPurchasing && (
                                            <span className="text-[9px] font-medieval text-[#c0392b] font-bold uppercase tracking-tighter">{t('lobby.shop.insufficient_gold')}</span>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="text-center py-16 bg-[#fff8e7]/50 border-2 border-dashed border-[#c9a84c]/30 rounded-lg">
                            <AlertCircle className="mx-auto text-[#7b6240]/40 mb-3" size={32} />
                            <p className="text-sm font-medieval text-[#7b6240] uppercase tracking-widest opacity-60">{t('lobby.shop.no_items')}</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 bg-[#1a1a2e] border-t-4 border-[#c9a84c] flex justify-center relative z-10">
                    <button 
                        onClick={(e) => {
                            console.log("[ShopModal] Boton Cerrar cliqueado");
                            e.preventDefault();
                            e.stopPropagation();
                            onClose();
                        }} 
                        className="px-10 py-2.5 bg-[#1e3a5f] text-[#c9a84c] border-2 border-[#966f24] font-medieval uppercase tracking-[0.2em] text-sm hover:bg-[#c0392b] hover:text-white transition-all shadow-xl active:translate-y-1 relative z-20 pointer-events-auto"
                    >
                        {t('lobby.shop.close')}
                    </button>
                </div>
            </div>
        </div>
    );
}
