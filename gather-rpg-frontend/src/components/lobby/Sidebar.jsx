import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/authStore';
import { useGameStore } from '../../store/gameStore';
import { useNotificationStore } from '../../store/notificationStore';
import { LogOut, Settings, MessageSquare, Users, ChevronLeft, ChevronRight, User, Send, X, UserPlus, MapPin, Phone, Pin, PinOff, Coins, Mail } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import SettingsMenu from '../common/SettingsMenu';

export const Sidebar = ({ isOpen: initialOpen, toggle: initialToggle, rpgStats }) => {
    const { t } = useTranslation();
    const { user, logout } = useAuthStore();
    const navigate = useNavigate();

    // Internal State for Auto-Hide
    const [isPinned, setIsPinned] = useState(initialOpen || false); // Default unpinned (auto-hide)
    const [isHovered, setIsHovered] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const [showSettings, setShowSettings] = useState(false);

    // Sync state with prop updates
    useEffect(() => {
        setIsPinned(initialOpen || false);
    }, [initialOpen]);

    // Derived Open State
    const isOpen = isPinned || isHovered;

    const { players, movePlayer, activeChat, sendPrivateMessage, closeChat, chatRequests, acceptChatRequest, rejectChatRequest, sendChatRequest, teleportToFriend, sendRoomInvite } = useGameStore();
    const { addNotification } = useNotificationStore();

    const [chatInput, setChatInput] = useState("");
    const messagesEndRef = useRef(null);
    const sidebarRef = useRef(null);

    const isGuest = user?.is_guest ?? (user?.username?.startsWith('Guest_') || false);

    const [friends, setFriends] = useState([]);
    const [incomingRequests, setIncomingRequests] = useState([]);
    const [outgoingRequests, setOutgoingRequests] = useState([]);
    const [friendUsername, setFriendUsername] = useState('');
    const [friendsError, setFriendsError] = useState(null);
    const [friendsLoading, setFriendsLoading] = useState(false);
    const [profile, setProfile] = useState(null);

    const getAvatarUrl = (charId) => `/characters/${charId || '1'}c.png`;

    // Listen for unread messages when sidebar is closed
    useEffect(() => {
        const onChatMsg = (e) => {
            if (!isOpen) {
                setUnreadCount(prev => prev + 1);
            }
        };
        window.addEventListener('chat-message-received', onChatMsg);
        return () => window.removeEventListener('chat-message-received', onChatMsg);
    }, [isOpen]);

    // Clear unread when opened
    useEffect(() => {
        if (isOpen) {
            setUnreadCount(0);
        }
    }, [isOpen]);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, []);

    useEffect(() => {
        if (!activeChat) return;
        scrollToBottom();
    }, [activeChat, scrollToBottom]);

    const refreshFriends = useCallback(async () => {
        if (!isOpen) return;
        if (!user?.id) return;
        if (isGuest) return;
        setFriendsLoading(true);
        setFriendsError(null);
        try {
            const [friendsRes, requestsRes] = await Promise.all([
                api.get('/friends'),
                api.get('/friends/requests')
            ]);
            setFriends(friendsRes.data?.friends || []);
            setIncomingRequests(requestsRes.data?.incoming || []);
            setOutgoingRequests(requestsRes.data?.outgoing || []);
        } catch (e) {
            setFriendsError(e?.response?.data?.error || e?.message || 'Failed to load friends');
        } finally {
            setFriendsLoading(false);
        }
    }, [isGuest, isOpen, user?.id]);

    useEffect(() => {
        if (isOpen) refreshFriends();
    }, [refreshFriends, isOpen]);

    useEffect(() => {
        if (user && !isGuest) {
            api.get('/learning/profile')
                .then(res => setProfile(res.data))
                .catch(err => console.error('Failed to load learning profile:', err));
        }
    }, [user, isGuest]);

    useEffect(() => {
        const handleFriendUpdate = () => {
            refreshFriends();
        };
        window.addEventListener('friend-request-update', handleFriendUpdate);
        return () => window.removeEventListener('friend-request-update', handleFriendUpdate);
    }, [refreshFriends]);

    const handleSendChat = (e) => {
        e.preventDefault();
        if (chatInput.trim()) {
            sendPrivateMessage(chatInput);
            setChatInput("");

            // Dispatch event so 'Me' bubble appears too (optional, if backend doesn't echo)
            window.dispatchEvent(new CustomEvent('chat-message-received', {
                detail: { senderId: user.id, text: chatInput.trim() }
            }));
        }
    };

    // ... Friend Handlers (omitted for brevity, assume same logic as before) ...
    // NOTE: Re-implementing friend handlers briefly to ensure they exist
    const handleSendFriendRequest = async (e) => {
        e.preventDefault();
        if (!friendUsername.trim()) return;
        try {
            await api.post('/friends/requests', { target_username: friendUsername.trim() });
            setFriendUsername('');
            await refreshFriends();
        } catch (e) { setFriendsError(e?.response?.data?.error || 'Error'); }
    };
    const handleAcceptRequest = async (id) => { try { await api.post(`/friends/requests/${id}/accept`); refreshFriends(); } catch (e) { } };
    const handleRejectRequest = async (id) => { try { await api.post(`/friends/requests/${id}/reject`); refreshFriends(); } catch (e) { } };
    const handleRemoveFriend = async (id) => { try { await api.delete(`/friends/${id}`); refreshFriends(); } catch (e) { } };
    const handleAddFriendFromChat = async () => { if (activeChat) { try { await api.post('/friends/requests', { target_username: activeChat.partner_name }); refreshFriends(); } catch (e) { } } };
    const handleTeleportToFriend = (friend) => {
        const isLocal = players.has(String(friend.id));
        if (isLocal) {
            const f = players.get(String(friend.id));
            if (f && movePlayer) movePlayer(Number(f.x), Number(f.y));
        } else {
            teleportToFriend(friend.id);
        }
    };

    const handleInviteFriend = (friend) => {
        sendRoomInvite(friend.id);
        addNotification('success', `¡Invitación enviada a ${friend.username}!`);
    };
    const handleCallFriend = async (id) => {
        const myId = String(user?.id || '');
        const otherId = String(id || '');
        if (myId && otherId) {
            const { peerManager } = await import('../../services/webrtc/PeerManager');
            peerManager.createPeer(otherId, myId < otherId);
        }
    };


    // Sidebar is always rendered but translated off-screen if closed
    const sidebarClass = `fixed top-0 left-0 h-full w-80 bg-black/60 backdrop-blur-xl border-r border-white/10 flex flex-col shadow-[10px_0_40px_rgba(0,0,0,0.8)] transition-transform duration-300 z-40 ${isOpen ? 'translate-x-0' : '-translate-x-full'
        } overflow-y-auto overflow-x-hidden custom-scrollbar pointer-events-auto`;

    // Toggle Button (Visible when closed)
    // We put a transparent trigger zone on the left edge to hover-open?
    // User requested "Auto hide", implies hover.

    return (
        <>
            {/* Hover Trigger Zone (Left Edge) */}
            {!isPinned && !isOpen && (
                <div
                    className="fixed top-0 left-0 w-4 h-full z-50 hover:bg-white/5 transition-colors pointer-events-auto"
                    onMouseEnter={() => setIsHovered(true)}
                />
            )}

            {/* Manual Toggle / Unread Badge (Visible when closed) */}
            {!isOpen && (
                <button
                    data-testid="sidebar-toggle"
                    onClick={() => {
                        setIsPinned(true);
                        if (initialToggle) initialToggle();
                    }}
                    className="fixed top-20 left-4 z-40 bg-black/60 backdrop-blur-md border border-white/10 text-yellow-400 p-2.5 rounded-xl hover:bg-white/10 hover:border-yellow-500/50 transition shadow-xl flex items-center gap-2 cursor-pointer pointer-events-auto"
                >
                    <ChevronRight size={20} />
                    {unreadCount > 0 && (
                        <span className="bg-gradient-to-r from-yellow-500 to-amber-500 text-black text-[10px] font-bold px-1.5 rounded-full animate-pulse">
                            {unreadCount}
                        </span>
                    )}
                </button>
            )}

            {/* Sidebar Container */}
            <div
                ref={sidebarRef}
                className={sidebarClass}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
            >
                {/* Header / Pin Control */}
                <div className="p-5 border-b border-white/10 bg-black/30 flex flex-col gap-4 relative z-10 shrink-0">
                    <div className="flex justify-between items-start w-full">
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 bg-black/40 border-2 border-yellow-500/40 shadow-xl flex items-center justify-center overflow-hidden rounded-xl relative">
                                {user ? (
                                    <div 
                                        className="w-full h-full pixelated"
                                        style={{
                                            backgroundImage: `url(${getAvatarUrl(user.character_id)})`,
                                            backgroundSize: '400% 300%', 
                                            backgroundPosition: '0 0', 
                                            backgroundRepeat: 'no-repeat',
                                            filter: 'drop-shadow(2px 2px 2px rgba(0,0,0,0.5))'
                                        }}
                                    />
                                ) : (
                                    <User size={28} className="text-yellow-500" />
                                )}
                            </div>
                            <div>
                                <p className="text-yellow-400 text-[10px] uppercase font-bold tracking-[0.2em] mb-0.5">
                                    {isGuest ? t('lobby.sidebar.guest') : t('lobby.sidebar.traveler')}
                                </p>
                                <div className="flex items-center gap-2">
                                    <p className="text-white font-extrabold text-xl truncate max-w-[120px] drop-shadow-md">
                                        {user?.username || t('lobby.sidebar.guest')}
                                    </p>
                                    {rpgStats && (
                                        <span className="bg-yellow-500/20 text-yellow-400 text-[9px] font-black px-1.5 py-0.5 rounded-lg border border-yellow-500/30 font-mono">
                                            LVL {rpgStats.level}
                                        </span>
                                    )}
                                </div>
                                <div className="flex flex-col">
                                    <p className="text-gray-400 text-xs tracking-wide capitalize">
                                        {user?.characterClass || t('lobby.sidebar.adventurer')}
                                    </p>
                                </div>
                            </div>
                        </div>

                         {/* Pin Toggle */}
                        <button
                            onClick={() => setIsPinned(!isPinned)}
                            className={`p-1.5 border rounded-lg transition cursor-pointer ${isPinned ? 'text-black bg-gradient-to-r from-yellow-500 to-amber-500 border-yellow-300' : 'text-gray-400 border-white/10 hover:border-yellow-500 hover:text-yellow-400 bg-white/5'}`}
                            title={isPinned ? t('lobby.sidebar.unpin') : t('lobby.sidebar.pin')}
                        >
                            {isPinned ? <Pin size={16} /> : <PinOff size={16} />}
                        </button>
                    </div>

                    {/* RPG Stats Overlay (HP, MP, Gold) */}
                    {rpgStats && (
                        <div className="flex items-center justify-between bg-black/40 border border-white/5 p-3 rounded-xl shadow-inner w-full mt-1">
                            <div className="flex items-center gap-4 w-full">
                                {/* HP Progress Bar */}
                                <div className="flex flex-col flex-1">
                                    <div className="flex justify-between text-[9px] font-extrabold text-emerald-400 mb-1">
                                        <span>HP</span>
                                        <span>{rpgStats.hp_current}/{rpgStats.hp_max}</span>
                                    </div>
                                    <div className="w-full h-1.5 bg-gray-950 rounded-full overflow-hidden border border-white/5 shadow-inner">
                                        <div 
                                            className="h-full bg-gradient-to-r from-emerald-600 to-green-400 transition-all duration-300"
                                            style={{ width: `${Math.min(100, Math.round((rpgStats.hp_current / rpgStats.hp_max) * 100))}%` }}
                                        ></div>
                                    </div>
                                </div>

                                {/* MP Progress Bar */}
                                <div className="flex flex-col flex-1">
                                    <div className="flex justify-between text-[9px] font-extrabold text-blue-400 mb-1">
                                        <span>MP</span>
                                        <span>{rpgStats.mp_current}/{rpgStats.mp_max}</span>
                                    </div>
                                    <div className="w-full h-1.5 bg-gray-950 rounded-full overflow-hidden border border-white/5 shadow-inner">
                                        <div 
                                            className="h-full bg-gradient-to-r from-blue-600 to-cyan-400 transition-all duration-300"
                                            style={{ width: `${Math.min(100, Math.round((rpgStats.mp_current / rpgStats.mp_max) * 100))}%` }}
                                        ></div>
                                    </div>
                                </div>

                                {/* Gold Counter */}
                                <div className="flex items-center gap-1 text-yellow-400 font-extrabold text-[12px] font-mono shrink-0 pl-1">
                                    <Coins size={14} className="text-yellow-500 animate-bounce" />
                                    <span>{rpgStats.gold ?? 0}g</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Chat Section */}
                <div className="flex-1 flex flex-col min-h-[300px] border-b border-white/10 relative z-10">
                    <div className="p-4 pb-2 flex items-center gap-3 border-b border-white/5 bg-white/5">
                        <MessageSquare size={16} className="text-yellow-400" />
                        <h3 className="text-yellow-400 text-xs uppercase font-extrabold tracking-widest">{t('lobby.sidebar.logs')}</h3>
                    </div>

                    <div className="flex-1 overflow-y-auto bg-black/20 p-4 custom-scrollbar relative">
                        {/* Chat Requests */}
                        {chatRequests.length > 0 && (
                            <div className="mb-4 space-y-3">
                                {chatRequests.map((req, idx) => (
                                    <div key={idx} className="bg-black/40 border border-white/10 p-3 rounded-xl shadow-lg">
                                        <p className="text-gray-300 text-xs mb-3 italic"><span className="text-yellow-400 font-bold">{req.requester_name}</span> {t('lobby.sidebar.chat_request')}</p>
                                        <div className="flex gap-2">
                                            <button onClick={() => acceptChatRequest(req.requester_id)} className="flex-1 bg-green-600 hover:bg-green-500 text-white text-[10px] font-bold py-1.5 rounded-xl uppercase border border-green-500/30 transition cursor-pointer">{t('lobby.sidebar.accept')}</button>
                                            <button onClick={() => rejectChatRequest(req.requester_id)} className="flex-1 bg-red-600/20 hover:bg-red-600/40 text-red-300 text-[10px] font-bold py-1.5 rounded-xl uppercase border border-red-500/20 transition cursor-pointer">{t('lobby.sidebar.decline')}</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                         {activeChat ? (
                            <div className="flex flex-col h-full">
                                <div className="flex justify-between items-center mb-3 pb-2 border-b border-white/10">
                                    <span className="text-yellow-400 text-sm font-bold flex items-center gap-2">
                                        <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></span>
                                        {activeChat.partner_name}
                                    </span>
                                    <div className="flex items-center gap-3">
                                        {!isGuest && (
                                            <button onClick={handleAddFriendFromChat} className="text-gray-400 hover:text-yellow-400 transition-colors cursor-pointer" title={t('lobby.sidebar.add_to_guild')}><UserPlus size={16} /></button>
                                        )}
                                        <button onClick={closeChat} className="text-gray-400 hover:text-white transition-colors cursor-pointer"><X size={16} /></button>
                                    </div>
                                </div>

                                 <div className="flex-1 space-y-4 overflow-y-auto pr-2 custom-scrollbar">
                                    {activeChat.messages.length === 0 && <p className="text-gray-500 text-[10px] text-center uppercase tracking-widest font-bold mt-6 opacity-40">{t('lobby.sidebar.start_chat')}</p>}
                                    {activeChat.messages.map((msg, idx) => (
                                        <div key={idx} className={`flex flex-col ${msg.sender === 'Me' ? 'items-end' : 'items-start'}`}>
                                            <div className={`px-3 py-2 border max-w-[90%] text-xs shadow-md ${msg.sender === 'Me' ? 'bg-indigo-600/20 text-indigo-200 border-indigo-500/30 rounded-2xl rounded-tr-none px-3 py-2 shadow-lg' : 'bg-gray-800/80 text-white border border-white/5 rounded-2xl rounded-tl-none px-3 py-2 shadow-sm'
                                                }`}>
                                                {msg.text}
                                            </div>
                                        </div>
                                    ))}
                                    <div ref={messagesEndRef} />
                                </div>

                                 <form onSubmit={handleSendChat} className="mt-4 flex gap-2 pt-3 border-t border-white/10">
                                    <input
                                        type="text"
                                        value={chatInput}
                                        onChange={(e) => setChatInput(e.target.value)}
                                        placeholder={t('lobby.sidebar.type_words') || "Message..."}
                                        className="flex-1 bg-gray-950/60 text-white text-xs px-3 py-2 border border-white/10 rounded-xl focus:border-yellow-500 focus:outline-none"
                                    />
                                    <button type="submit" className="bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-black font-extrabold p-2.5 rounded-xl shadow-lg active:scale-95 transition-all cursor-pointer">
                                        <Send size={16} />
                                    </button>
                                </form>

                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-gray-500">
                                <MessageSquare size={48} className="mb-4 opacity-20" />
                                <p className="text-sm font-bold uppercase tracking-widest text-gray-400">{t('lobby.sidebar.empty_chat_title')}</p>
                                <p className="text-[11px] mt-2 font-medium italic text-center px-6 text-gray-500">{t('lobby.sidebar.empty_chat_subtitle')}</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Friends Section (Guild List) */}
                <div className="min-h-[200px] border-b border-white/10 flex flex-col flex-shrink-0 relative z-10">
                    <div className="p-4 pb-2 flex items-center justify-between bg-white/5">
                        <div className="flex items-center gap-3">
                            <Users size={16} className="text-yellow-400" />
                            <h3 className="text-yellow-400 text-xs uppercase font-extrabold tracking-widest">{t('lobby.sidebar.guild')}</h3>
                        </div>
                        {!isGuest && (
                            <button onClick={refreshFriends} className="text-[10px] font-bold text-yellow-400/80 hover:text-yellow-400 border border-white/10 hover:border-yellow-500/30 px-2.5 py-1 rounded-lg transition bg-white/5 cursor-pointer shadow-sm">{t('lobby.sidebar.refresh')}</button>
                        )}
                    </div>

                    {isGuest ? (
                        <div className="px-4 py-6 text-xs text-gray-500 italic">{t('lobby.sidebar.login_required')}</div>
                    ) : (
                        <div className="flex-1 overflow-y-auto bg-black/10 px-4 pb-4 custom-scrollbar relative">
                            {friendsError && <div className="mb-3 text-[10px] text-red-400 font-bold uppercase tracking-wide">{friendsError}</div>}
                            <form onSubmit={handleSendFriendRequest} className="flex gap-2 mb-4 mt-3">
                                <input value={friendUsername} onChange={(e) => setFriendUsername(e.target.value)} placeholder={t('lobby.sidebar.username_placeholder')} className="flex-1 bg-gray-950/60 text-white text-[11px] px-3 py-2 border border-white/10 rounded-xl focus:border-yellow-500 outline-none" />
                                <button type="submit" className="bg-yellow-500 hover:bg-yellow-400 text-black font-extrabold px-3 py-1.5 rounded-xl border border-yellow-300 shadow-md transition cursor-pointer">{t('lobby.sidebar.invite')}</button>
                            </form>

                            {incomingRequests.length > 0 && (
                                <div className="mb-4 space-y-2">
                                    {incomingRequests.map(req => (
                                        <div key={req.id} className="text-[10px] flex justify-between bg-black/40 p-2.5 rounded-xl border border-yellow-500/20 text-gray-300">
                                            <span className="truncate max-w-[100px] font-bold text-white">{req.requester_username}</span>
                                            <div className="flex gap-2">
                                                <button onClick={() => handleAcceptRequest(req.id)} className="text-green-500 hover:text-green-400 font-extrabold cursor-pointer">✓</button>
                                                <button onClick={() => handleRejectRequest(req.id)} className="text-red-500 hover:text-red-400 font-extrabold cursor-pointer">✗</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <ul className="space-y-2">
                                {friends.map(f => (
                                    <li key={f.id} className="bg-white/5 p-2.5 border border-white/5 rounded-xl flex justify-between items-center transition-all hover:bg-white/10 hover:border-white/10 group shadow-inner">
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <span className={`w-2.5 h-2.5 rounded-full shadow-[0_0_8px] ${f.is_online ? 'bg-green-500 shadow-green-500' : 'bg-gray-700 shadow-black'}`} />
                                            <span className="text-xs text-gray-200 group-hover:text-yellow-400 transition-colors truncate">{f.username}</span>
                                        </div>
                                        <div className="flex gap-2">
                                            <button disabled={!f.is_online} onClick={() => handleTeleportToFriend(f)} className="text-gray-400 hover:text-yellow-400 disabled:opacity-10 transition-colors cursor-pointer" title={t('lobby.sidebar.teleport') || "Teleport"}><MapPin size={14} /></button>
                                            <button disabled={!f.is_online} onClick={() => handleInviteFriend(f)} className="text-gray-400 hover:text-yellow-400 disabled:opacity-10 transition-colors cursor-pointer" title={t('lobby.sidebar.invite_to_room') || "Invite to room"}><Mail size={14} /></button>
                                            <button onClick={() => sendChatRequest(f.id)} className="text-gray-400 hover:text-yellow-400 transition-colors cursor-pointer" title={t('lobby.sidebar.chat_request')}><MessageSquare size={14} /></button>
                                            <button onClick={() => handleCallFriend(f.id)} className="text-gray-400 hover:text-white transition-colors cursor-pointer" title={t('lobby.sidebar.call_friend')}><Phone size={14} /></button>
                                            <button onClick={() => handleRemoveFriend(f.id)} className="text-red-400 hover:text-red-300 transition-colors cursor-pointer"><X size={14} /></button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
                {/* Footer (Controls) */}
                <div className="p-4 bg-black/40 border-t border-white/10 shrink-0 relative z-10 shadow-[0_-5px_20px_rgba(0,0,0,0.5)]">
                    <button onClick={() => setShowSettings(true)} className="flex items-center gap-4 text-gray-400 hover:text-white w-full p-3 rounded-xl transition-all hover:bg-white/5 border border-transparent hover:border-white/10 mb-2 group shadow-sm cursor-pointer">
                        <Settings size={20} className="group-hover:rotate-45 transition-transform" /> <span className="text-sm font-bold uppercase tracking-widest">{t('lobby.sidebar.settings')}</span>
                    </button>
                    <button onClick={handleLogout} className="flex items-center gap-4 text-red-400 hover:text-red-300 w-full p-3 rounded-xl transition-all hover:bg-red-500/10 border border-transparent hover:border-red-500/20 shadow-sm cursor-pointer">
                        <LogOut size={20} /> <span className="text-sm font-bold uppercase tracking-widest">{t('lobby.sidebar.depart') || "Depart"}</span>
                    </button>
                </div>
            </div>

            {/* Settings Overlay */}
            {showSettings && (
                <SettingsMenu initialTab="config" onClose={() => setShowSettings(false)} />
            )}
        </>
    );
};
