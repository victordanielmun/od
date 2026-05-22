import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/authStore';
import { useGameStore } from '../../store/gameStore';
import { useNotificationStore } from '../../store/notificationStore';
import { LogOut, Settings, MessageSquare, Users, ChevronLeft, ChevronRight, User, Send, X, UserPlus, MapPin, Phone, Pin, PinOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import SettingsMenu from '../common/SettingsMenu';

export const Sidebar = ({ isOpen: initialOpen, toggle: initialToggle }) => {
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

    const { players, movePlayer, activeChat, sendPrivateMessage, closeChat, chatRequests, acceptChatRequest, rejectChatRequest, sendChatRequest } = useGameStore();
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
    const handleTeleportToFriend = (id) => {
        const f = players.get(String(id));
        if (f && movePlayer) movePlayer(Number(f.x), Number(f.y));
    }
    const handleCallFriend = async (id) => {
        const myId = String(user?.id || '');
        const otherId = String(id || '');
        if (myId && otherId) {
            const { peerManager } = await import('../../services/webrtc/PeerManager');
            peerManager.createPeer(otherId, myId < otherId);
        }
    };


    // Sidebar is always rendered but translated off-screen if closed
    const sidebarClass = `fixed top-0 left-0 h-full w-80 bg-[var(--color-base-dark)] border-r-4 border-[var(--color-gold)] flex flex-col shadow-[10px_0_40px_rgba(0,0,0,0.8)] transition-transform duration-300 z-40 ${isOpen ? 'translate-x-0' : '-translate-x-full'
        } relative overflow-y-auto overflow-x-hidden custom-scrollbar`;

    // Toggle Button (Visible when closed)
    // We put a transparent trigger zone on the left edge to hover-open?
    // User requested "Auto hide", implies hover.

    return (
        <>
            {/* Hover Trigger Zone (Left Edge) */}
            {!isPinned && !isOpen && (
                <div
                    className="fixed top-0 left-0 w-4 h-full z-50 hover:bg-white/5 transition-colors"
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
                    className="fixed top-4 left-4 z-40 bg-[var(--color-base-dark)] border-2 border-[var(--color-gold-dark)] text-[var(--color-gold)] p-2 rounded-sm hover:bg-[var(--color-accent-blue)] transition shadow-lg flex items-center gap-2"
                >
                    <ChevronRight size={20} />
                    {unreadCount > 0 && (
                        <span className="bg-[var(--color-orange-vibrant)] text-white text-[10px] font-bold px-1.5 rounded-full animate-pulse">
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
                <div className="p-5 border-b-4 border-[var(--color-gold)] bg-[var(--color-accent-blue)] flex justify-between items-start relative z-10 shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-[var(--color-base-dark)] border-4 border-[var(--color-gold)] shadow-xl flex items-center justify-center overflow-hidden relative">
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
                                <User size={28} className="text-yellow-700" />
                            )}
                        </div>
                        <div>
                            <p className="text-yellow-700 text-[10px] uppercase font-medieval tracking-[0.2em] mb-0.5">
                                {isGuest ? t('lobby.sidebar.guest') : t('lobby.sidebar.traveler')}
                            </p>
                            <p className="text-yellow-500 font-medieval text-xl truncate max-w-[140px] drop-shadow-md">
                                {user?.username || t('lobby.sidebar.guest')}
                            </p>
                            <div className="flex flex-col">
                                <p className="text-[#8d6e63] text-xs font-medieval tracking-wide capitalize">
                                    {user?.characterClass || t('lobby.sidebar.adventurer')}
                                </p>
                                 {profile && (
                                    <div className="flex items-center gap-1 mt-1">
                                        <div className="bg-[var(--color-orange-vibrant)] px-2 py-0.5 border border-[var(--color-gold)] shadow-sm">
                                            <span className="text-white text-[10px] font-medieval">XP: {profile.total_xp}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                     {/* Pin Toggle */}
                    <button
                        onClick={() => setIsPinned(!isPinned)}
                        className={`p-1.5 border-2 transition ${isPinned ? 'text-white bg-[var(--color-orange-vibrant)] border-[var(--color-gold)]' : 'text-[var(--color-gold-dark)] border-[var(--color-gold-dark)]/30 hover:border-[var(--color-gold)] hover:text-[var(--color-gold)]'}`}
                        title={isPinned ? t('lobby.sidebar.unpin') : t('lobby.sidebar.pin')}
                    >
                        {isPinned ? <Pin size={16} /> : <PinOff size={16} />}
                    </button>
                </div>

                {/* Chat Section */}
                <div className="flex-1 flex flex-col min-h-[300px] border-b-4 border-[#8b6d1b] relative z-10">
                    <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/wood-pattern.png")' }}></div>
                    <div className="p-4 pb-2 flex items-center gap-3 border-b-2 border-[var(--color-gold-dark)]/30 bg-[var(--color-sidebar-content-bg)]">
                        <MessageSquare size={16} className="text-[var(--color-gold)]" />
                        <h3 className="text-[var(--color-gold)] text-xs uppercase font-bold tracking-widest">{t('lobby.sidebar.logs')}</h3>
                    </div>

                    <div className="flex-1 overflow-y-auto bg-[var(--color-sidebar-content-bg)] p-4 custom-scrollbar relative">
                        {/* Chat Requests */}                         {chatRequests.length > 0 && (
                            <div className="mb-4 space-y-3">
                                {chatRequests.map((req, idx) => (
                                    <div key={idx} className="bg-[var(--color-base-dark)] border-2 border-[var(--color-gold)] p-3 shadow-lg">
                                        <p className="text-[var(--color-parchment)] text-xs mb-3 font-serif italic"><span className="text-[var(--color-gold)] font-medieval">{req.requester_name}</span> {t('lobby.sidebar.chat_request')}</p>
                                        <div className="flex gap-2">
                                            <button onClick={() => acceptChatRequest(req.requester_id)} className="flex-1 bg-[var(--color-green-primary)] text-white text-[10px] font-medieval py-1.5 uppercase border border-white/20 hover:brightness-110">{t('lobby.sidebar.accept')}</button>
                                            <button onClick={() => rejectChatRequest(req.requester_id)} className="flex-1 bg-[var(--color-orange-vibrant)] text-white text-[10px] font-medieval py-1.5 uppercase border border-white/20 hover:brightness-110">{t('lobby.sidebar.decline')}</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                         {activeChat ? (
                            <div className="flex flex-col h-full">
                                <div className="flex justify-between items-center mb-3 pb-2 border-b-2 border-[var(--color-gold-dark)]/20">
                                    <span className="text-[var(--color-gold)] text-sm font-medieval flex items-center gap-2">
                                        <span className="w-2 h-2 bg-[var(--color-gold)] animate-pulse"></span>
                                        {activeChat.partner_name}
                                    </span>
                                    <div className="flex items-center gap-3">
                                        {!isGuest && (
                                            <button onClick={handleAddFriendFromChat} className="text-[var(--color-gold-dark)] hover:text-[var(--color-gold)] transition-colors" title={t('lobby.sidebar.add_to_guild')}><UserPlus size={16} /></button>
                                        )}
                                        <button onClick={closeChat} className="text-[var(--color-parchment-dark)] hover:text-white transition-colors"><X size={16} /></button>
                                    </div>
                                </div>

                                 <div className="flex-1 space-y-4 overflow-y-auto pr-2 custom-scrollbar">
                                    {activeChat.messages.length === 0 && <p className="text-[var(--color-gold-dark)] text-[10px] text-center uppercase tracking-widest font-medieval mt-6 opacity-30">{t('lobby.sidebar.start_chat')}</p>}
                                    {activeChat.messages.map((msg, idx) => (
                                        <div key={idx} className={`flex flex-col ${msg.sender === 'Me' ? 'items-end' : 'items-start'}`}>
                                            <div className={`px-3 py-2 border-2 max-w-[90%] text-xs shadow-md ${msg.sender === 'Me' ? 'bg-[var(--color-orange-vibrant)]/30 text-white border-[var(--color-orange-vibrant)] shadow-[inset_0_2px_10px_rgba(0,0,0,0.3)]' : 'bg-[var(--color-parchment)] text-[var(--color-base-dark)] border-[var(--color-gold-dark)]/40 shadow-sm'
                                                }`}>
                                                {msg.text}
                                            </div>
                                        </div>
                                    ))}
                                    <div ref={messagesEndRef} />
                                </div>

                                 <form onSubmit={handleSendChat} className="mt-4 flex gap-2 pt-3 border-t-2 border-[var(--color-gold-dark)]/20">
                                    <input
                                        type="text"
                                        value={chatInput}
                                        onChange={(e) => setChatInput(e.target.value)}
                                        placeholder={t('lobby.sidebar.type_words')}
                                        className="flex-1 bg-[var(--color-base-dark)] text-white text-xs px-3 py-2 border-2 border-[var(--color-gold-dark)]/40 focus:border-[var(--color-gold)] focus:outline-none font-medieval"
                                    />
                                    <button type="submit" className="bg-[var(--color-orange-vibrant)] hover:bg-[var(--color-accent-blue)] text-white p-2 border-2 border-[var(--color-gold)] shadow-lg active:translate-y-1 transition-all">
                                        <Send size={16} />
                                    </button>
                                </form>

                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-[var(--color-gold-dark)]">
                                <MessageSquare size={48} className="mb-4 opacity-20" />
                                <p className="text-sm font-bold uppercase tracking-widest text-[var(--color-gold)]">{t('lobby.sidebar.empty_chat_title')}</p>
                                <p className="text-[11px] mt-2 font-medium italic text-center px-6 text-[var(--color-parchment-dark)]">{t('lobby.sidebar.empty_chat_subtitle')}</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Friends Section (Guild List) */}
                <div className="min-h-[200px] border-b-4 border-[#8b6d1b] flex flex-col flex-shrink-0 relative z-10">
                    <div className="p-4 pb-2 flex items-center justify-between bg-[var(--color-sidebar-content-bg)]">
                        <div className="flex items-center gap-3">
                            <Users size={16} className="text-[var(--color-gold)]" />
                            <h3 className="text-[var(--color-gold-dark)] text-xs uppercase font-medieval tracking-widest">{t('lobby.sidebar.guild')}</h3>
                        </div>
                        {!isGuest && (
                            <button onClick={refreshFriends} className="text-[9px] font-medieval text-[var(--color-gold-dark)]/60 hover:text-[var(--color-gold)] border-2 border-[var(--color-gold-dark)]/40 px-2 py-0.5 transition-colors bg-[var(--color-base-dark)] shadow-sm">{t('lobby.sidebar.refresh')}</button>
                        )}
                    </div>

                    {isGuest ? (
                        <div className="px-4 py-6 text-xs text-[var(--color-parchment-dark)] font-serif italic">{t('lobby.sidebar.login_required')}</div>
                    ) : (
                        <div className="flex-1 overflow-y-auto bg-[var(--color-sidebar-content-bg)] px-4 pb-4 custom-scrollbar relative">
                            {friendsError && <div className="mb-3 text-[10px] text-[var(--color-orange-vibrant)] font-medieval uppercase">{friendsError}</div>}
                            <form onSubmit={handleSendFriendRequest} className="flex gap-2 mb-4">
                                <input value={friendUsername} onChange={(e) => setFriendUsername(e.target.value)} placeholder={t('lobby.sidebar.username_placeholder')} className="flex-1 bg-[var(--color-base-dark)] text-white text-[10px] px-2 py-1.5 border-2 border-[var(--color-gold-dark)]/40 focus:border-[var(--color-gold)] outline-none font-medieval placeholder-[var(--color-gold-dark)]/50" />
                                <button type="submit" className="bg-[var(--color-green-primary)] text-white text-[10px] font-medieval px-3 py-1.5 border border-white/20 hover:brightness-110 shadow-lg">{t('lobby.sidebar.invite')}</button>
                            </form>

                            {incomingRequests.length > 0 && (
                                <div className="mb-4 space-y-2">
                                    {incomingRequests.map(req => (
                                        <div key={req.id} className="text-[10px] font-serif flex justify-between bg-[var(--color-base-dark)] p-2 border border-[var(--color-gold)]/30 text-[var(--color-parchment)]">
                                            <span className="truncate max-w-[100px] font-medieval">{req.requester_username}</span>
                                            <div className="flex gap-2">
                                                <button onClick={() => handleAcceptRequest(req.id)} className="text-green-500 hover:text-green-400 font-bold">✓</button>
                                                <button onClick={() => handleRejectRequest(req.id)} className="text-red-500 hover:text-red-400 font-bold">✗</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <ul className="space-y-2">
                                {friends.map(f => (
                                    <li key={f.id} className="bg-[var(--color-base-dark)]/40 p-2 border-2 border-[var(--color-gold-dark)]/30 flex justify-between items-center transition-colors hover:border-[var(--color-gold)]/50 group shadow-inner">
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <span className={`w-2 h-2 rounded-full shadow-[0_0_8px] ${f.is_online ? 'bg-green-600 shadow-green-600' : 'bg-gray-800 shadow-black'}`} />
                                            <span className="text-xs text-[var(--color-gold)] font-medieval truncate">{f.username}</span>
                                        </div>
                                        <div className="flex gap-2">
                                            <button disabled={!players.has(String(f.id))} onClick={() => handleTeleportToFriend(f.id)} className="text-[var(--color-gold-dark)] hover:text-[var(--color-gold)] disabled:opacity-10 transition-colors"><MapPin size={14} /></button>
                                            <button onClick={() => sendChatRequest(f.id)} className="text-[var(--color-gold-dark)] hover:text-[var(--color-gold)] transition-colors" title={t('lobby.sidebar.chat_request')}><MessageSquare size={14} /></button>
                                            <button onClick={() => handleCallFriend(f.id)} className="text-[var(--color-gold-dark)] hover:text-white transition-colors" title={t('lobby.sidebar.call_friend')}><Phone size={14} /></button>
                                            <button onClick={() => handleRemoveFriend(f.id)} className="text-[var(--color-orange-vibrant)]/40 hover:text-[var(--color-orange-vibrant)] transition-colors"><X size={14} /></button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
                {/* Footer (Controls) */}
                <div className="p-4 bg-[var(--color-accent-blue)] border-t-2 border-[var(--color-gold)] shrink-0 relative z-10 shadow-[0_-5px_20px_rgba(0,0,0,0.5)]">
                    <button onClick={() => setShowSettings(true)} className="flex items-center gap-4 text-[var(--color-gold)] hover:text-[var(--color-pure-white)] w-full p-3 transition-all hover:bg-[var(--color-base-dark)]/40 border border-transparent hover:border-[var(--color-gold-dark)]/30 mb-2 group shadow-sm">
                        <Settings size={20} className="group-hover:rotate-45 transition-transform" /> <span className="text-sm font-bold uppercase tracking-widest">{t('lobby.sidebar.settings')}</span>
                    </button>
                    <button onClick={handleLogout} className="flex items-center gap-4 text-[var(--color-orange-vibrant)] hover:text-white w-full p-3 transition-all hover:bg-[var(--color-base-dark)]/40 border border-transparent hover:border-[var(--color-orange-vibrant)]/20 shadow-sm">
                        <LogOut size={20} /> <span className="text-sm font-bold uppercase tracking-widest">{t('lobby.sidebar.depart')}</span>
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
