import React, { useRef, useEffect, useState } from 'react';
import { Settings, Volume2, Music, Mic, X, MessageSquare, Backpack, Bell, Send, Check, Smile } from 'lucide-react';
import { useAudioStore } from '../../store/audioStore';
import { useGameStore } from '../../store/gameStore';

export default function SettingsMenu({ onClose, initialTab = 'config' }) {
    const { musicVolume, sfxVolume, voiceVolume, setVolume } = useAudioStore();
    const { activeChat, sendPrivateMessage, chatRequests, acceptChatRequest, rejectChatRequest, sendEmoji } = useGameStore();
    
    const [activeTab, setActiveTab] = useState(initialTab);
    const [chatInput, setChatInput] = useState('');
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const menuRef = useRef(null);
    const chatEndRef = useRef(null);

    // Auto-scroll chat to bottom
    useEffect(() => {
        if (activeTab === 'notifications') {
            chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [activeChat?.messages, activeTab]);

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
                className="bg-gray-900/95 border border-gray-700/50 rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden text-white font-sans flex flex-col max-h-[80vh] backdrop-blur-xl border-b-4 border-b-blue-500/30"
            >
                {/* Header & Tabs */}
                <div className="bg-gray-800/50 border-b border-gray-700 p-4">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="flex items-center gap-2 font-bold uppercase text-xs tracking-[0.2em] text-gray-300">
                            Dashboard Universal
                        </h3>
                        <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors p-1"><X size={20} /></button>
                    </div>
                    
                    <div className="flex gap-2">
                        <button 
                            onClick={() => setActiveTab('notifications')}
                            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${activeTab === 'notifications' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' : 'bg-gray-800/50 text-gray-500 hover:text-gray-300'}`}
                        >
                            <Bell size={14} /> Notificaciones
                        </button>
                        <button 
                            onClick={() => setActiveTab('inventory')}
                            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${activeTab === 'inventory' ? 'bg-orange-600 text-white shadow-lg shadow-orange-900/40' : 'bg-gray-800/50 text-gray-500 hover:text-gray-300'}`}
                        >
                            <Backpack size={14} /> Inventario
                        </button>
                        <button 
                            onClick={() => setActiveTab('config')}
                            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${activeTab === 'config' ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/40' : 'bg-gray-800/50 text-gray-500 hover:text-gray-300'}`}
                        >
                            <Settings size={14} /> Config
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
                                    <h4 className="text-[10px] uppercase tracking-widest text-gray-500 mb-2">Solicitudes</h4>
                                    {chatRequests.map(req => (
                                        <div key={req.requester_id} className="flex items-center justify-between bg-blue-900/20 border border-blue-500/30 p-3 rounded-xl">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center shadow-lg"><MessageSquare size={16} /></div>
                                                <div>
                                                    <p className="text-white text-sm font-bold">{req.requester_name}</p>
                                                    <p className="text-[10px] text-blue-300">quiere chatear.</p>
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
                                        {activeChat.messages.length === 0 && <p className="text-center text-gray-600 text-xs mt-10 italic">Inicia la conversación...</p>}
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
                                    <form onSubmit={handleSendChat} className="flex gap-2 bg-gray-900 border border-gray-700 p-2 rounded-xl">
                                        <button 
                                            type="button" 
                                            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                            className={`p-2 rounded-lg transition ${showEmojiPicker ? 'text-blue-400 bg-blue-900/40' : 'text-gray-500 hover:text-gray-300'}`}
                                        >
                                            <Smile size={18} />
                                        </button>
                                        <input 
                                            value={chatInput} 
                                            onChange={e => setChatInput(e.target.value)}
                                            placeholder="Escribe un mensaje..."
                                            className="flex-1 bg-transparent text-xs px-2 focus:outline-none"
                                        />
                                        <button type="submit" disabled={!chatInput.trim()} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-30 text-white p-2 rounded-lg transition"><Send size={16} /></button>
                                    </form>
                                </div>
                            ) : chatRequests.length === 0 && (
                                <div className="flex-1 flex flex-col items-center justify-center py-10 opacity-30">
                                    <Bell size={48} className="text-gray-600 mb-4" />
                                    <p className="text-sm tracking-widest uppercase">Sin Mensajes</p>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'inventory' && (
                        <div className="grid grid-cols-5 gap-3">
                            {[...Array(20)].map((_, i) => (
                                <div key={i} className="aspect-square bg-gray-800/50 border border-gray-700 hover:border-orange-500/50 rounded-xl flex items-center justify-center transition cursor-pointer group shadow-inner">
                                    <Backpack size={20} className="text-gray-600 group-hover:text-orange-500/50" />
                                </div>
                            ))}
                        </div>
                    )}

                    {activeTab === 'config' && (
                        <div className="space-y-8 py-4">
                            <div className="flex flex-col gap-3">
                                <div className="flex justify-between items-center">
                                    <label className="flex items-center gap-3 text-xs font-bold uppercase tracking-[0.2em] text-blue-400"><Music size={16} /> Música</label>
                                    <span className="text-sm font-mono text-gray-400">{Math.round(musicVolume * 100)}%</span>
                                </div>
                                <input type="range" min="0" max="1" step="0.01" value={musicVolume} onChange={(e) => setVolume('musicVolume', parseFloat(e.target.value))} 
                                       className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-blue-500 shadow-inner" />
                            </div>
                            <div className="flex flex-col gap-3">
                                <div className="flex justify-between items-center">
                                    <label className="flex items-center gap-3 text-xs font-bold uppercase tracking-[0.2em] text-green-400"><Volume2 size={16} /> Efectos</label>
                                    <span className="text-sm font-mono text-gray-400">{Math.round(sfxVolume * 100)}%</span>
                                </div>
                                <input type="range" min="0" max="1" step="0.01" value={sfxVolume} onChange={(e) => setVolume('sfxVolume', parseFloat(e.target.value))} 
                                       className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-green-500 shadow-inner" />
                            </div>
                            <div className="flex flex-col gap-3">
                                <div className="flex justify-between items-center">
                                    <label className="flex items-center gap-3 text-xs font-bold uppercase tracking-[0.2em] text-purple-400"><Mic size={16} /> Voz</label>
                                    <span className="text-sm font-mono text-gray-400">{Math.round(voiceVolume * 100)}%</span>
                                </div>
                                <input type="range" min="0" max="1" step="0.01" value={voiceVolume} onChange={(e) => setVolume('voiceVolume', parseFloat(e.target.value))} 
                                       className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-purple-500 shadow-inner" />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
