import { create } from 'zustand';
import wsClient from '../services/websocket';
import { useAuthStore } from './authStore';
import { useNotificationStore } from './notificationStore';

export const useGameStore = create((set, get) => ({
    isConnected: false,
    players: new Map(),
    messages: [],
    listenersInitialized: false,
    currentRoomId: null,
    currentInviteCode: null,
    activeChallengeId: null,
    challengeParticipants: [],
    challengeMessages: [],

    // Chat State
    chatRequests: [], // Array of { requester_id, requester_name }
    activeChat: null, // { partner_id, partner_name, messages: [] }

    connect: () => {
        const token = useAuthStore.getState().token;
        if (token) {
            // Setup listeners first, but only once
            if (!get().listenersInitialized) {
                // Clear any existing listeners (important for HMR/reloads)
                wsClient.removeAllListeners();

                set({ listenersInitialized: true });

                wsClient.on('connection_status', ({ status }) => {
                    set({ isConnected: status === 'connected' });
                });

                wsClient.on('init_state', (state) => {
                    // Handle initial state (players, etc.)
                    console.log("Init state:", state);
                    const playersMap = new Map();
                    if (state.players) {
                        state.players.forEach(p => playersMap.set(p.id, { ...p, id: String(p.id) }));
                    }
                    set({ players: playersMap });
                });

                wsClient.on('player_joined', (player) => {
                    console.log("Player joined event:", player);
                    set(state => {
                        const newPlayers = new Map(state.players);
                        const id = String(player.id); // Ensure string ID
                        newPlayers.set(id, { ...player, id });
                        return { players: newPlayers };
                    });
                });

                wsClient.on('room_joined', (payload) => {
                    console.log("Room joined:", payload.room_id);
                    set({
                        currentRoomId: payload.room_id,
                        currentInviteCode: payload.invite_code || null,
                        players: new Map() // Clear players from previous room
                    });
                    // Request initial positions
                    wsClient.send('request_positions', {});
                });

                wsClient.on('map_join_approved', (payload) => {
                    console.log("Map join approved:", payload);
                    set({ currentInviteCode: payload.invite_code || null });
                    // Server has found/created a room for us. Now join it.
                    // Payload: { room_id, scene_key, type, x?, y?, invite_code? }
                    // We dispatch a custom event so the UI/Canvas can handle the scene transition
                    window.dispatchEvent(new CustomEvent('map-join-approved', { detail: payload }));
                });

                wsClient.on('positions_snapshot', ({ positions }) => {
                    const myId = String(useAuthStore.getState().user?.id || '');
                    set(state => {
                        const newPlayers = new Map(state.players);
                        if (positions && Array.isArray(positions)) {
                            positions.forEach(pos => {
                                const id = String(pos.user_id || pos.id);
                                if (!id) return;
                                // CRITICAL: never put ourselves into the players map
                                // to prevent ghost sprites from stale server data
                                if (myId && id === myId) return;

                                const x = Number(pos.x);
                                const y = Number(pos.y);

                                const existing = newPlayers.get(id);
                                if (existing) {
                                    newPlayers.set(id, { ...existing, x, y, anim: pos.anim || 'idle', direction: pos.direction || existing.direction });
                                } else {
                                    newPlayers.set(id, {
                                        id,
                                        username: pos.username || 'Unknown',
                                        x,
                                        y,
                                        anim: pos.anim || 'idle',
                                        direction: pos.direction || 'right'
                                    });
                                }
                            });
                        }
                        return { players: newPlayers };
                    });
                });

                wsClient.on('user_left', (payload) => {
                    // Backend sends: { user_id: UUID, room_id: string }
                    const targetId = String(payload?.user_id || payload?.id || '');
                    if (!targetId) return;
                    set(state => {
                        const newPlayers = new Map(state.players);
                        newPlayers.delete(targetId);
                        return { players: newPlayers };
                    });
                });

                // Updated event name to match backend "position_update"
                wsClient.on('position_update', (payload) => {
                    // Backend sends: user_id, x, y, username, direction, anim, is_moving
                    const { user_id, x, y, username } = payload;
                    const id = String(user_id); // Normalize to string id

                    // CRITICAL: never update own player from network (ghost guard)
                    const myId = String(useAuthStore.getState().user?.id || '');
                    if (myId && id === myId) return;

                    const numX = Number(x);
                    const numY = Number(y);

                    set(state => {
                        const newPlayers = new Map(state.players);
                        const player = newPlayers.get(id);
                        if (player) {
                            newPlayers.set(id, { 
                                ...player, 
                                x: numX, 
                                y: numY, 
                                anim: payload.anim || player.anim,
                                direction: payload.direction || player.direction
                            });
                        } else {
                            newPlayers.set(id, {
                                id,
                                username: username || 'Unknown',
                                x: numX,
                                y: numY,
                                anim: payload.anim || 'idle',
                                direction: payload.direction || 'right'
                            });
                        }
                        return { players: newPlayers };
                    });
                });


                wsClient.on('character_selected', (data) => {
                    const { user } = useAuthStore.getState();
                    if (user && (user.id === data.user_id || user.id === data.user_id.toString())) {
                        useAuthStore.setState({ user: { ...user, characterClass: data.class, stats: data.stats } });
                    }
                });

                // Chat Handlers
                wsClient.on('chat_request_broadcast', (payload) => {
                    set(state => ({
                        chatRequests: [...state.chatRequests, payload]
                    }));
                });

                wsClient.on('chat_session_start', (payload) => {
                    set(state => ({
                        activeChat: {
                            partner_id: payload.partner_id,
                            partner_name: payload.partner_name,
                            messages: []
                        },
                        // Remove request from this user if it exists
                        chatRequests: state.chatRequests.filter(req => req.requester_id !== payload.partner_id)
                    }));
                });

                wsClient.on('chat_reject', (payload) => {
                    console.log("Chat rejected by", payload.rejecter_name);
                });

                wsClient.on('private_message', (payload) => {
                    const { sender_id, sender_name, message } = payload;
                    const activeChat = get().activeChat;

                    if (activeChat && activeChat.partner_id === sender_id) {
                        set(state => ({
                            activeChat: {
                                ...state.activeChat,
                                messages: [...state.activeChat.messages, { sender: sender_name, text: message }]
                            }
                        }));
                    }

                    // Dispatch event for Phaser bubbles (and Sidebar notifications)
                    window.dispatchEvent(new CustomEvent('chat-message-received', {
                        detail: { senderId: sender_id, text: message }
                    }));
                });

                wsClient.on('challenge_joined', (payload) => {
                    set({
                        activeChallengeId: payload.challenge_id,
                        challengeParticipants: payload.participants || [],
                        challengeMessages: []
                    });
                });

                wsClient.on('challenge_left', () => {
                    set({
                        activeChallengeId: null,
                        challengeParticipants: [],
                        challengeMessages: []
                    });
                });

                wsClient.on('challenge_user_joined', (payload) => {
                    set(state => ({
                        challengeParticipants: [
                            ...state.challengeParticipants,
                            { user_id: payload.user_id, username: payload.username }
                        ]
                    }));
                });

                wsClient.on('challenge_user_left', (payload) => {
                    set(state => ({
                        challengeParticipants: state.challengeParticipants.filter(p => String(p.user_id) !== String(payload.user_id))
                    }));
                });

                wsClient.on('challenge_chat_broadcast', (payload) => {
                    set(state => ({
                        challengeMessages: [
                            ...state.challengeMessages,
                            {
                                user_id: payload.user_id,
                                username: payload.username,
                                message: payload.message,
                                timestamp: payload.timestamp
                            }
                        ]
                    }));
                });

                wsClient.on('start_peer_connection', async (payload) => {
                    if (!payload?.session_id) return;
                    const peerId = String(payload.peer_user_id);
                    if (!peerId) return;
                    const { peerManager } = await import('../services/webrtc/PeerManager');
                    peerManager.createPeer(peerId, !!payload.initiator, payload.session_id);
                });

                wsClient.on('close_peer_connection', async (payload) => {
                    if (!payload?.session_id) return;
                    const peerId = String(payload.peer_user_id);
                    if (!peerId) return;
                    const { peerManager } = await import('../services/webrtc/PeerManager');
                    peerManager.removePeer(peerId, payload.session_id);
                });

                wsClient.on('friend_request_received', (payload) => {
                    const { addNotification } = useNotificationStore.getState();
                    addNotification('info', `New friend request from ${payload.requester_username}`);
                    // We could also update a pendingRequests count in store to trigger UI refresh
                    // For now, Sidebar listens to local state but we might want to signal it
                    window.dispatchEvent(new CustomEvent('friend-request-update'));
                });

                wsClient.on('emoji_broadcast', (payload) => {
                    // Send event to Phaser LobbyScene to show bubble
                    window.dispatchEvent(new CustomEvent('player-emoji-received', { detail: payload }));
                });
            }

            wsClient.connect(token);
        }
    },

    disconnect: () => {
        wsClient.disconnect();
        // CRITICAL: reset listenersInitialized so that the next connect() call
        // fully re-registers all WebSocket event handlers. Without this, a
        // logout + login cycle silently drops all server events.
        wsClient.removeAllListeners();
        set({ 
            isConnected: false,
            listenersInitialized: false,
            players: new Map(),
            currentRoomId: null,
            currentInviteCode: null,
            activeChallengeId: null,
            challengeParticipants: [],
            challengeMessages: [],
            chatRequests: [],
            activeChat: null
        });
    },

    sendChatRequest: (targetId) => {
        wsClient.send('chat_request', { target_id: targetId });
    },

    acceptChatRequest: (targetId) => {
        wsClient.send('chat_accept', { target_id: targetId, accepted: true });
    },

    rejectChatRequest: (targetId) => {
        wsClient.send('chat_accept', { target_id: targetId, accepted: false });
        set(state => ({
            chatRequests: state.chatRequests.filter(req => req.requester_id !== targetId)
        }));
    },

    sendPrivateMessage: (message) => {
        const activeChat = get().activeChat;
        if (activeChat) {
            wsClient.send('private_message', { target_id: activeChat.partner_id, message });
            // Optimistic add to chat history
            set(state => ({
                activeChat: {
                    ...state.activeChat,
                    messages: [...state.activeChat.messages, { sender: 'Me', text: message }]
                }
            }));
            // Show bubble above OUR own sprite (sender side)
            const myId = useAuthStore.getState().user?.id;
            window.dispatchEvent(new CustomEvent('chat-message-received', {
                detail: { senderId: myId, text: message }
            }));
        }
    },

    closeChat: () => {
        set({ activeChat: null });
    },

    sendEmoji: (emojiId) => {
        const roomId = get().currentRoomId;
        if (roomId) {
            wsClient.send('player_emoji', { emoji_id: emojiId, room_id: roomId });
            // Show bubble above OUR own sprite immediately (optimistic)
            const myId = useAuthStore.getState().user?.id;
            window.dispatchEvent(new CustomEvent('player-emoji-received', { 
                detail: { user_id: myId, emoji_id: emojiId } 
            }));
        }
    },

    joinChallenge: (challengeId) => {
        wsClient.send('join_challenge', { challenge_id: challengeId });
    },

    leaveChallenge: () => {
        const id = get().activeChallengeId;
        wsClient.send('leave_challenge', { challenge_id: id });
    },

    sendChallengeMessage: (message) => {
        const challengeId = get().activeChallengeId;
        if (!challengeId) return;
        wsClient.send('challenge_chat_message', { challenge_id: challengeId, message });
    },

    movePlayer: (x, y, direction = 'right', anim = 'idle') => {
        wsClient.send('update_position', { x, y, direction, anim, is_moving: anim !== 'idle' });

        // Optimistic update for self
        set(state => {
            const authState = useAuthStore.getState();
            const user = authState.user;
            if (!user) {
                console.warn("movePlayer: No user found in authStore. AuthState:", authState);
                return {};
            }

            const newPlayers = new Map(state.players);
            const userId = String(user.id);
            const myPlayer = newPlayers.get(userId);

            if (myPlayer) {
                newPlayers.set(userId, { ...myPlayer, x, y, direction, anim });
                return { players: newPlayers };
            } else {
                newPlayers.set(userId, {
                    id: userId,
                    username: user.username,
                    x,
                    y,
                    anim,
                    direction
                });
                return { players: newPlayers };
            }
        });
    },

    joinRoom: (roomId, x, y) => {
        const payload = { room_id: roomId };
        if (x != null && y != null) {
            payload.x = Number(x); // Pointer expects number
            payload.y = Number(y);
        }
        wsClient.send('join_room', payload);
    },

    requestMapJoin: (sceneKey, type = 'public', inviteCode = '') => {
        wsClient.send('request_map_join', { scene_key: sceneKey, type, invite_code: inviteCode });
    }
}));
