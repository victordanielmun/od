import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useGameStore } from '../../store/gameStore';
import { useNotificationStore } from '../../store/notificationStore';
import { LogOut, Settings, MessageSquare, Users, ChevronLeft, ChevronRight, User, Send, X, UserPlus, MapPin, Phone, Pin, PinOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import SettingsMenu from '../common/SettingsMenu';

export const Sidebar = ({ isOpen: initialOpen, toggle: initialToggle }) => {
    const { user, logout } = useAuthStore();
    const navigate = useNavigate();

    // Internal State for Auto-Hide
    const [isPinned, setIsPinned] = useState(false); // Default unpinned (auto-hide)
    const [isHovered, setIsHovered] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const [showSettings, setShowSettings] = useState(false);

    // Derived Open State
    const isOpen = isPinned || isHovered;

    const { players, movePlayer, activeChat, sendPrivateMessage, closeChat, chatRequests, acceptChatRequest, rejectChatRequest } = useGameStore();
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
    const sidebarClass = `fixed top-0 left-0 h-full w-80 bg-gray-900 border-r border-orange-900/50 flex flex-col shadow-2xl transition-transform duration-300 z-40 ${isOpen ? 'translate-x-0' : '-translate-x-full'
        }`;

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
                    onClick={() => setIsPinned(true)}
                    className="fixed top-4 left-4 z-40 bg-gray-900 border border-gray-600 text-white p-2 rounded hover:bg-gray-800 transition shadow-lg flex items-center gap-2"
                >
                    <ChevronRight size={20} />
                    {unreadCount > 0 && (
                        <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 rounded-full animate-pulse">
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
                <div className="p-4 border-b border-gray-700 bg-gray-800/50 flex justify-between items-start">
                    <div className="flex items-center gap-3">
                        <div className="w-14 h-14 bg-gray-800 rounded-lg border-2 border-orange-500/50 flex items-center justify-center overflow-hidden">
                            {user ? (
                                <div 
                                    className="w-full h-full"
                                    style={{
                                        backgroundImage: `url(${getAvatarUrl(user.character_id)})`,
                                        backgroundSize: '400% 300%', // 4 columns, 3 rows as per grid mapping
                                        backgroundPosition: '0 0', // IDLE is ROW 0, COL 0 (index 0)
                                        backgroundRepeat: 'no-repeat',
                                        imageRendering: 'pixelated'
                                    }}
                                />
                            ) : null}
                            {!user && <User size={24} className="text-blue-300" />}
                        </div>
                        <div>
                            <p className="text-gray-400 text-xs uppercase tracking-wider">
                                {isGuest ? 'Guest Mode' : 'User Logged In'}
                            </p>
                            <p className="text-white font-bold text-lg truncate max-w-[120px]">
                                {user?.username || 'Guest'}
                            </p>
                            <div className="flex flex-col">
                                <p className="text-blue-400 text-xs capitalize">
                                    {user?.characterClass || 'Adventurer'}
                                </p>
                                {profile && (
                                    <p className="text-orange-400 text-[10px] font-bold">
                                        XP: {profile.total_xp}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Pin Toggle */}
                    <button
                        onClick={() => setIsPinned(!isPinned)}
                        className={`p-1.5 rounded transition ${isPinned ? 'text-green-400 bg-green-900/20' : 'text-gray-500 hover:text-white'}`}
                        title={isPinned ? "Unpin Sidebar (Auto-hide)" : "Pin Sidebar"}
                    >
                        {isPinned ? <Pin size={16} /> : <PinOff size={16} />}
                    </button>
                </div>

                {/* Chat Section */}
                <div className="flex-1 flex flex-col min-h-0 border-b border-gray-700">
                    <div className="p-4 pb-2 flex items-center gap-2 border-b border-gray-800">
                        <MessageSquare size={16} className="text-green-400" />
                        <h3 className="text-gray-400 text-xs uppercase tracking-widest">Chat</h3>
                    </div>

                    <div className="flex-1 overflow-y-auto bg-black/20 p-4 custom-scrollbar">
                        {/* Chat Requests */}
                        {chatRequests.length > 0 && (
                            <div className="mb-4 space-y-2">
                                {chatRequests.map((req, idx) => (
                                    <div key={idx} className="bg-gray-800 border border-blue-500/50 p-2 rounded text-sm">
                                        <p className="text-white mb-2"><span className="text-blue-400 font-bold">{req.requester_name}</span> wants to chat.</p>
                                        <div className="flex gap-2">
                                            <button onClick={() => acceptChatRequest(req.requester_id)} className="flex-1 bg-green-600 text-white text-xs py-1 rounded">Accept</button>
                                            <button onClick={() => rejectChatRequest(req.requester_id)} className="flex-1 bg-gray-700 text-white text-xs py-1 rounded">Decline</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {activeChat ? (
                            <div className="flex flex-col h-full">
                                <div className="flex justify-between items-center mb-2 pb-2 border-b border-gray-800">
                                    <span className="text-white text-sm font-bold flex items-center gap-2">
                                        <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                                        {activeChat.partner_name}
                                    </span>
                                    <div className="flex items-center gap-2">
                                        {!isGuest && (
                                            <button onClick={handleAddFriendFromChat} className="text-gray-400 hover:text-green-400" title="Add Friend"><UserPlus size={14} /></button>
                                        )}
                                        <button onClick={closeChat} className="text-gray-500 hover:text-white"><X size={14} /></button>
                                    </div>
                                </div>

                                <div className="flex-1 space-y-3 overflow-y-auto pr-1">
                                    {activeChat.messages.length === 0 && <p className="text-gray-600 text-xs text-center italic mt-4">Start conversation...</p>}
                                    {activeChat.messages.map((msg, idx) => (
                                        <div key={idx} className={`flex flex-col ${msg.sender === 'Me' ? 'items-end' : 'items-start'}`}>
                                            <div className={`px-2 py-1 rounded max-w-[90%] text-xs ${msg.sender === 'Me' ? 'bg-blue-900/50 text-blue-100 border border-blue-800' : 'bg-gray-800 text-gray-300 border border-gray-700'
                                                }`}>
                                                {msg.text}
                                            </div>
                                        </div>
                                    ))}
                                    <div ref={messagesEndRef} />
                                </div>

                                <form onSubmit={handleSendChat} className="mt-2 flex gap-1 pt-2 border-t border-gray-800">
                                    <input
                                        type="text"
                                        value={chatInput}
                                        onChange={(e) => setChatInput(e.target.value)}
                                        placeholder="Message..."
                                        className="flex-1 bg-gray-800 text-white text-xs px-2 py-1 rounded border border-gray-700 focus:border-blue-500 focus:outline-none"
                                    />
                                    <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white p-1 rounded">
                                        <Send size={14} />
                                    </button>
                                </form>
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-gray-600">
                                <MessageSquare size={32} className="mb-2 opacity-20" />
                                <p className="text-xs">No active chat</p>
                                <p className="text-[10px] mt-1">Approach a player and press E</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Friends Section */}
                <div className="h-48 lg:h-64 border-b border-gray-700 flex flex-col flex-shrink-0">
                    <div className="p-4 pb-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Users size={16} className="text-purple-400" />
                            <h3 className="text-gray-400 text-xs uppercase tracking-widest">Friends</h3>
                        </div>
                        {!isGuest && (
                            <button onClick={refreshFriends} className="text-[10px] text-gray-400 hover:text-white border border-gray-700 px-2 py-1 rounded">Refresh</button>
                        )}
                    </div>

                    {isGuest ? (
                        <div className="px-4 pb-4 text-xs text-gray-500">Login required.</div>
                    ) : (
                        <div className="flex-1 overflow-y-auto px-4 pb-4 custom-scrollbar">
                            {friendsError && <div className="mb-2 text-xs text-red-400">{friendsError}</div>}
                            <form onSubmit={handleSendFriendRequest} className="flex gap-2 mb-3">
                                <input value={friendUsername} onChange={(e) => setFriendUsername(e.target.value)} placeholder="Add user..." className="flex-1 bg-gray-800 text-white text-xs px-2 py-1 rounded border-gray-700" />
                                <button type="submit" className="bg-purple-600 text-white text-xs px-3 py-1 rounded">Add</button>
                            </form>

                            {incomingRequests.length > 0 && (
                                <div className="mb-2 space-y-1">
                                    {incomingRequests.map(req => (
                                        <div key={req.id} className="text-xs flex justify-between bg-gray-800 p-1 rounded">
                                            <span className="truncate max-w-[80px]" title={req.requester_username}>{req.requester_username}</span>
                                            <div className="flex gap-1">
                                                <button onClick={() => handleAcceptRequest(req.id)} className="text-green-400">✓</button>
                                                <button onClick={() => handleRejectRequest(req.id)} className="text-red-400">✗</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <ul className="space-y-1">
                                {friends.map(f => (
                                    <li key={f.id} className="bg-gray-800/50 p-1.5 rounded flex justify-between items-center">
                                        <div className="flex items-center gap-2 overflow-hidden">
                                            <span className={`w-1.5 h-1.5 rounded-full ${players.has(String(f.id)) ? 'bg-green-500' : 'bg-gray-600'}`} />
                                            <span className="text-xs text-gray-300 truncate">{f.username}</span>
                                        </div>
                                        <div className="flex gap-1">
                                            <button disabled={!players.has(String(f.id))} onClick={() => handleTeleportToFriend(f.id)} className="text-gray-500 hover:text-white disabled:opacity-20"><MapPin size={12} /></button>
                                            <button onClick={() => handleCallFriend(f.id)} className="text-blue-500 hover:text-blue-400"><Phone size={12} /></button>
                                            <button onClick={() => handleRemoveFriend(f.id)} className="text-gray-600 hover:text-red-400"><X size={12} /></button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 bg-gray-800/30 mt-auto">
                    <button onClick={() => setShowSettings(true)} className="flex items-center gap-3 text-gray-400 hover:text-white w-full p-2 rounded hover:bg-gray-800 transition mb-1">
                        <Settings size={18} /> <span className="text-sm font-medium">Settings</span>
                    </button>
                    <button onClick={handleLogout} className="flex items-center gap-3 text-red-400 hover:text-red-300 w-full p-2 rounded hover:bg-red-900/20 transition">
                        <LogOut size={18} /> <span className="text-sm font-medium">Logout</span>
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
