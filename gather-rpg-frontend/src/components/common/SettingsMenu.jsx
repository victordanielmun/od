import React, { useRef, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Settings, Volume2, Music, Mic, X, MessageSquare, Backpack, Bell, Send, Check, Smile } from 'lucide-react';
import { useAudioStore } from '../../store/audioStore';
import { useGameStore } from '../../store/gameStore';
import { useAuthStore } from '../../store/authStore';
import { ItemIcon } from './ItemIcon';
import { Heart, Zap, Shield, Target, Sparkles, HelpCircle, Swords, Info } from 'lucide-react';

export default function SettingsMenu({ onClose, initialTab = 'config' }) {
    const { t } = useTranslation();
    const { musicVolume, sfxVolume, voiceVolume, setVolume } = useAudioStore();
    const { activeChat, sendPrivateMessage, chatRequests, acceptChatRequest, rejectChatRequest, sendEmoji, inventory, fetchInventory, useItem } = useGameStore();
    const { user } = useAuthStore();
    
    const [activeTab, setActiveTab] = useState(initialTab);
    const [chatInput, setChatInput] = useState('');
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);
    const menuRef = useRef(null);
    const chatEndRef = useRef(null);

    // Auto-scroll chat to bottom
    useEffect(() => {
        if (activeTab === 'notifications') {
            chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
        if (activeTab === 'inventory') {
            fetchInventory();
        }
    }, [activeChat?.messages, activeTab, fetchInventory]);

    // Close when clicking outside
    useEffect(() => {
        function handleClickOutside(event) {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                onClose();
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [onClose]);

    const handleSendChat = (e) => {
        e.preventDefault();
        if (!chatInput.trim() || !activeChat) return;
        sendPrivateMessage(chatInput.trim());
        setChatInput('');
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div
                ref={menuRef}
                className="bg-[var(--color-base-dark)] border-4 border-[var(--color-gold)] rounded-none shadow-[0_20px_50px_rgba(0,0,0,0.8)] w-full max-w-xl overflow-hidden text-[var(--color-pure-white)] font-sans flex flex-col max-h-[85vh] relative"
                style={{ outline: '2px solid var(--color-accent-blue)', outlineOffset: '-8px' }}
            >
                {/* Decorative Corners */}
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-yellow-400/30 z-50 pointer-events-none"></div>
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-yellow-400/30 z-50 pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-yellow-400/30 z-50 pointer-events-none"></div>
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-yellow-400/30 z-50 pointer-events-none"></div>

                {/* Header & Tabs */}
                <div className="bg-[var(--color-accent-blue)] border-b-4 border-[var(--color-gold)] p-4 pt-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="flex items-center gap-2 font-black uppercase text-sm tracking-[0.2em] text-[var(--color-gold)] font-medieval drop-shadow-sm">
                            {t('lobby.menu.title')}
                        </h3>
                        <button onClick={onClose} className="text-[var(--color-gold-dark)] hover:text-[var(--color-gold)] transition-colors p-1 border-2 border-[var(--color-gold-dark)] bg-black/40 rounded-sm">
                            <X size={18} />
                        </button>
                    </div>
                    
                    <div className="flex gap-2">
                        <button 
                            onClick={() => setActiveTab('notifications')}
                            className={`flex-1 flex items-center justify-center gap-2 py-2 border-2 transition-all font-medieval uppercase tracking-widest text-[11px] ${activeTab === 'notifications' ? 'bg-[var(--color-orange-vibrant)] border-[var(--color-gold)] text-white shadow-[inset_0_2px_10px_rgba(255,255,255,0.2)]' : 'bg-[var(--color-accent-blue)] border-[var(--color-gold-dark)]/50 text-[var(--color-parchment-dark)] hover:text-[var(--color-gold)]'}`}
                        >
                            <Bell size={14} /> {t('lobby.menu.notifications')}
                        </button>
                        <button 
                            onClick={() => setActiveTab('inventory')}
                            className={`flex-1 flex items-center justify-center gap-2 py-2 border-2 transition-all font-medieval uppercase tracking-widest text-[11px] ${activeTab === 'inventory' ? 'bg-[var(--color-orange-vibrant)] border-[var(--color-gold)] text-white shadow-[inset_0_2px_10px_rgba(255,255,255,0.2)]' : 'bg-[var(--color-accent-blue)] border-[var(--color-gold-dark)]/50 text-[var(--color-parchment-dark)] hover:text-[var(--color-gold)]'}`}
                        >
                            <Backpack size={14} /> {t('lobby.menu.inventory')}
                        </button>
                        <button 
                            onClick={() => setActiveTab('config')}
                            className={`flex-1 flex items-center justify-center gap-2 py-2 border-2 transition-all font-medieval uppercase tracking-widest text-[11px] ${activeTab === 'config' ? 'bg-[var(--color-orange-vibrant)] border-[var(--color-gold)] text-white shadow-[inset_0_2px_10px_rgba(255,255,255,0.2)]' : 'bg-[var(--color-accent-blue)] border-[var(--color-gold-dark)]/50 text-[var(--color-parchment-dark)] hover:text-[var(--color-gold)]'}`}
                        >
                            <Settings size={14} /> {t('lobby.menu.config')}
                        </button>
                    </div>
                </div>

                {/* Body Content */}
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar min-h-0">
                    
                    {activeTab === 'notifications' && (
                        <div className="flex flex-col h-full space-y-4">
                            {/* Chat Requests */}
                             {chatRequests.length > 0 && (
                                <div className="space-y-2">
                                    <h4 className="text-[10px] uppercase tracking-widest text-gray-500 mb-2">{t('lobby.menu.requests')}</h4>
                                    {chatRequests.map(req => (
                                        <div key={req.requester_id} className="flex items-center justify-between bg-blue-900/20 border border-blue-500/30 p-3 rounded-xl">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center shadow-lg"><MessageSquare size={16} /></div>
                                                <div>
                                                    <p className="text-white text-sm font-bold">{req.requester_name}</p>
                                                    <p className="text-[10px] text-blue-300">{t('lobby.menu.want_to_chat')}</p>
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <button onClick={() => acceptChatRequest(req.requester_id)} className="bg-green-600/20 text-green-400 hover:bg-green-600/40 p-2 rounded-lg"><Check size={18} /></button>
                                                <button onClick={() => rejectChatRequest(req.requester_id)} className="bg-red-600/20 text-red-400 hover:bg-red-600/40 p-2 rounded-lg"><X size={18} /></button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Active Chat Section */}
                            {activeChat ? (
                                <div className="flex flex-col flex-1 bg-black/30 border border-gray-800 rounded-2xl p-4 min-h-[300px]">
                                    <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-800">
                                        <span className="text-sm font-bold text-blue-400 flex items-center gap-2">
                                            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                                            {activeChat.partner_name}
                                        </span>
                                    </div>
                                    <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-1">
                                        {activeChat.messages.length === 0 && <p className="text-center text-gray-600 text-xs mt-10 italic">{t('lobby.menu.start_conversation')}</p>}
                                        {activeChat.messages.map((m, i) => (
                                            <div key={i} className={`flex flex-col ${m.sender === 'Me' ? 'items-end' : 'items-start'}`}>
                                                <div className={`px-3 py-1.5 rounded-2xl text-xs max-w-[85%] ${m.sender === 'Me' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300'}`}>
                                                    {m.text}
                                                </div>
                                            </div>
                                        ))}
                                        <div ref={chatEndRef} />
                                    </div>
                                    {showEmojiPicker && (
                                        <div className="flex gap-2 p-3 bg-gray-900/80 border border-gray-700/50 rounded-xl mb-2 backdrop-blur-md animate-slide-up overflow-x-auto custom-scrollbar">
                                            {['1', '2', '3', '4', '5', '6'].map(id => (
                                                <button 
                                                    key={id} 
                                                    onClick={() => {
                                                        sendEmoji(id + 'c');
                                                        setShowEmojiPicker(false);
                                                    }}
                                                    className="w-10 h-10 flex-shrink-0 hover:scale-110 transition-transform bg-black/20 rounded-lg p-1 hover:bg-blue-600/20"
                                                >
                                                    <img src={`/characters/${id}c.png`} alt={`Emoji ${id}`} className="w-full h-full object-contain" />
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    <form onSubmit={handleSendChat} className="flex gap-2 bg-[var(--color-base-dark)] border border-[var(--color-gold-dark)] p-2 rounded-xl">
                                        <button 
                                            type="button" 
                                            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                            className={`p-2 rounded-lg transition ${showEmojiPicker ? 'text-[var(--color-gold)] bg-[var(--color-accent-blue)]' : 'text-[var(--color-gold-dark)] hover:text-[var(--color-gold)]'}`}
                                        >
                                            <Smile size={18} />
                                        </button>
                                        <input 
                                            value={chatInput} 
                                            onChange={e => setChatInput(e.target.value)}
                                            placeholder={t('lobby.menu.type_message')}
                                            className="flex-1 bg-transparent text-xs px-2 focus:outline-none text-white"
                                        />
                                        <button type="submit" disabled={!chatInput.trim()} className="bg-[var(--color-orange-vibrant)] hover:bg-[var(--color-accent-blue)] disabled:opacity-30 text-white p-2 rounded-lg transition"><Send size={16} /></button>
                                    </form>
                                </div>
                            ) : chatRequests.length === 0 && (
                                <div className="flex-1 flex flex-col items-center justify-center py-10 opacity-30">
                                    <Bell size={48} className="text-gray-600 mb-4" />
                                    <p className="text-sm tracking-widest uppercase">{t('lobby.menu.no_messages')}</p>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'inventory' && (
                        <div className="flex flex-col gap-6">
                            <div className="grid grid-cols-5 gap-3">
                                {inventory.length > 0 ? (
                                    inventory.map((inv, i) => (
                                        <div 
                                            key={inv.id} 
                                            className={`aspect-square bg-[var(--color-base-dark)] border-2 flex flex-col items-center justify-center transition cursor-pointer group shadow-[inset_0_4px_10px_rgba(0,0,0,0.5)] overflow-hidden relative ${selectedItem?.id === inv.id ? 'border-[var(--color-gold)] ring-2 ring-[var(--color-gold)]/20' : 'border-[var(--color-accent-blue)] hover:border-[var(--color-gold)]'}`}
                                            onClick={() => setSelectedItem(inv)}
                                            onDoubleClick={() => useItem(inv.id)}
                                        >
                                            <div className="absolute top-1 right-1 bg-[var(--color-orange-vibrant)] text-white text-[10px] font-medieval px-1.5 py-0.5 border border-[var(--color-gold)] shadow-md z-10">x{inv.quantity}</div>
                                            <div className="p-2 transition-transform group-hover:scale-110 filter drop-shadow-lg">
                                                <ItemIcon 
                                                    iconKey={inv.item?.icon_key} 
                                                    type={inv.item?.item_type} 
                                                    size={40}
                                                    className="pixelated"
                                                />
                                            </div>
                                            <div className="absolute bottom-0 inset-x-0 bg-black/80 py-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <p className="text-[7px] uppercase font-medieval text-[var(--color-gold)] text-center px-1 truncate tracking-tighter">{inv.item?.name}</p>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    [...Array(15)].map((_, i) => (
                                        <div key={i} className="aspect-square bg-[#1a0f0a] border-2 border-[#2b1d12] opacity-40 shadow-inner flex items-center justify-center">
                                            <Backpack size={20} className="text-[#3e2723]" />
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Item Details Panel */}
                            {selectedItem && (
                                <div className="animate-slide-up bg-[var(--color-parchment)] border-4 border-[var(--color-gold)] p-5 shadow-2xl relative overflow-hidden flex gap-5">
                                    <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/parchment.png")' }}></div>
                                    
                                    <div className="w-24 h-24 flex-shrink-0 bg-[var(--color-base-dark)] border-4 border-[var(--color-gold)] flex items-center justify-center shadow-[inset_0_4px_10px_rgba(0,0,0,0.5)] relative overflow-hidden group">
                                        <div className="absolute inset-0 bg-gradient-to-tr from-[var(--color-gold)]/10 to-transparent"></div>
                                        <ItemIcon 
                                            iconKey={selectedItem.item?.icon_key} 
                                            type={selectedItem.item?.item_type} 
                                            size={64}
                                            className="pixelated drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)]"
                                        />
                                    </div>
                                    
                                    <div className="flex-1 flex flex-col justify-between relative z-10">
                                        <div>
                                            <div className="flex items-center justify-between mb-1">
                                                <h4 className="text-xl font-medieval uppercase tracking-tight text-[var(--color-base-dark)]">{selectedItem.item?.name}</h4>
                                                <span className="text-[10px] font-medieval bg-[var(--color-accent-blue)] text-[var(--color-gold)] px-3 py-1 border border-[var(--color-gold-dark)] shadow-sm">
                                                    {t(`items.types.${selectedItem.item?.item_type}`) || selectedItem.item?.item_type?.replace('_', ' ')}
                                                </span>
                                            </div>
                                            <p className="text-sm text-[var(--color-accent-blue)] leading-tight italic font-serif mb-4">
                                                {selectedItem.item?.description || t('lobby.menu.no_description')}
                                            </p>
                                            
                                            <div className="flex flex-wrap gap-2 mb-6">
                                                {selectedItem.item?.attack_bonus > 0 && (
                                                    <div className="flex items-center gap-1.5 px-3 py-1 bg-[#8b0000] border-2 border-yellow-600 text-yellow-400 font-medieval text-[11px] shadow-md">
                                                        <Swords size={12} /> +{selectedItem.item.attack_bonus} ATK
                                                    </div>
                                                )}
                                                {selectedItem.item?.defense_bonus > 0 && (
                                                    <div className="flex items-center gap-1.5 px-3 py-1 bg-[#0d47a1] border-2 border-[#1e88e5] text-blue-100 font-medieval text-[11px] shadow-md">
                                                        <Shield size={12} /> +{selectedItem.item.defense_bonus} DEF
                                                    </div>
                                                )}
                                                {selectedItem.item?.effect_value > 0 && (
                                                    <div className="flex items-center gap-1.5 px-3 py-1 bg-[#2e7d32] border-2 border-[#66bb6a] text-green-100 font-medieval text-[11px] shadow-md">
                                                        {selectedItem.item.effect_type === 'heal_hp' ? <Heart size={12} /> : <Zap size={12} />} 
                                                        +{selectedItem.item.effect_value} {selectedItem.item.effect_type?.includes('hp') ? 'HP' : 'MP'}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                         <div className="flex gap-2">                                             {(selectedItem.item?.item_type === 'consumable' || selectedItem.item?.item_type === 'health' || selectedItem.item?.item_type === 'mana') ? (
                                                <button 
                                                    onClick={() => useItem(selectedItem.id)}
                                                    className="flex-1 bg-[var(--color-orange-vibrant)] hover:bg-[var(--color-accent-blue)] text-white font-medieval uppercase text-sm py-3 border-2 border-[var(--color-gold)] shadow-[0_4px_10px_rgba(0,0,0,0.5)] active:translate-y-1 transition-all flex items-center justify-center gap-2"
                                                >
                                                    <Sparkles size={18} /> {t('lobby.menu.use')}
                                                </button>
                                            ) : (
                                                <button 
                                                    disabled
                                                    className="flex-1 bg-[var(--color-accent-blue)] text-white/30 text-xs font-medieval py-3 border-2 border-[var(--color-base-dark)] opacity-50 cursor-not-allowed"
                                                >
                                                    {t('lobby.menu.unusable')}
                                                </button>
                                            )}
                                            <button 
                                                onClick={() => setSelectedItem(null)}
                                                className="px-6 bg-[var(--color-base-dark)] hover:bg-[var(--color-accent-blue)] text-[var(--color-gold-dark)] hover:text-[var(--color-gold)] font-medieval border-2 border-[var(--color-gold-dark)] transition-colors"
                                            >
                                                {t('lobby.menu.close')}
                                            </button>
                                        </div>


                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'config' && (
                        <div className="space-y-8 py-4">                             <div className="flex flex-col gap-3">
                                <div className="flex justify-between items-center">
                                    <label className="flex items-center gap-3 text-xs font-bold uppercase tracking-[0.2em] text-[var(--color-gold-dark)]"><Music size={16} /> {t('lobby.menu.music')}</label>
                                    <span className="text-sm font-mono text-[var(--color-parchment-dark)]">{Math.round(musicVolume * 100)}%</span>
                                </div>
                                <input type="range" min="0" max="1" step="0.01" value={musicVolume} onChange={(e) => setVolume('musicVolume', parseFloat(e.target.value))} 
                                       className="w-full h-1.5 bg-black/40 rounded-lg appearance-none cursor-pointer accent-[var(--color-gold)] shadow-inner" />
                            </div>
                            <div className="flex flex-col gap-3">
                                <div className="flex justify-between items-center">
                                    <label className="flex items-center gap-3 text-xs font-bold uppercase tracking-[0.2em] text-[var(--color-gold-dark)]"><Volume2 size={16} /> {t('lobby.menu.sfx')}</label>
                                    <span className="text-sm font-mono text-[var(--color-parchment-dark)]">{Math.round(sfxVolume * 100)}%</span>
                                </div>
                                <input type="range" min="0" max="1" step="0.01" value={sfxVolume} onChange={(e) => setVolume('sfxVolume', parseFloat(e.target.value))} 
                                       className="w-full h-1.5 bg-black/40 rounded-lg appearance-none cursor-pointer accent-[var(--color-gold)] shadow-inner" />
                            </div>
                            <div className="flex flex-col gap-3">
                                <div className="flex justify-between items-center">
                                    <label className="flex items-center gap-3 text-xs font-bold uppercase tracking-[0.2em] text-[var(--color-gold-dark)]"><Mic size={16} /> {t('lobby.menu.voice')}</label>
                                    <span className="text-sm font-mono text-[var(--color-parchment-dark)]">{Math.round(voiceVolume * 100)}%</span>
                                </div>
                                <input type="range" min="0" max="1" step="0.01" value={voiceVolume} onChange={(e) => setVolume('voiceVolume', parseFloat(e.target.value))} 
                                       className="w-full h-1.5 bg-black/40 rounded-lg appearance-none cursor-pointer accent-[var(--color-gold)] shadow-inner" />
                            </div>

                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
