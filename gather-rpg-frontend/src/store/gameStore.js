import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import api from '../services/api';
import wsClient from '../services/websocket';
import { useAuthStore } from './authStore';
import { useNotificationStore } from './notificationStore';
import { usePeerStore } from './peerStore';

export const useGameStore = create(subscribeWithSelector((set, get) => ({
    isConnected: false,
    players: new Map(),
    messages: [],
    listenersInitialized: false,
    currentRoomId: null,
    currentRoomScene: null, // scene_key that the current room actually belongs to
    currentSceneKey: 'lobby',
    currentInviteCode: null,
    activeChallengeId: null,
    challengeParticipants: [],
    challengeMessages: [],
    activeMission: null,
    inventory: [],
    virtualControlsMode: 'auto', // 'auto' | 'always' | 'never'

    setVirtualControlsMode: (mode) => set({ virtualControlsMode: mode }),

    // Ninja Cards
    ninjaCardData: null,

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

                wsClient.on('ninja_card_triggered', (payload) => {
                    console.log('[NinjaCard] Triggered:', payload);
                    set({ ninjaCardData: payload });
                });

                wsClient.on('ninja_card_result', (payload) => {
                    console.log('[NinjaCard] Result received:', payload);
                    window.dispatchEvent(new CustomEvent('ninja-card-result', { detail: payload }));
                });

                set({ listenersInitialized: true });

                wsClient.on('connection_status', ({ status }) => {
                    set({ isConnected: status === 'connected' });
                });

                wsClient.on('init_state', (state) => {
                    // Handle initial state (players, etc.)
                    console.log("[gameStore] Received init_state:", state);
                    const playersMap = new Map();
                    if (state.players) {
                        state.players.forEach(p => {
                            const id = String(p.id);
                            console.log(`[gameStore] Initial player: ${p.username} (ID: ${id}) at (${p.x}, ${p.y})`);
                            playersMap.set(id, { ...p, id });
                        });
                    }
                    set({ players: playersMap });
                });

                wsClient.on('player_joined', (player) => {
                    // Notify other users
                    const myId = String(useAuthStore.getState().user?.id || '');
                    const id = String(player.id);

                    if (myId && id === myId) {
                        return; // Ignore self-join in players map
                    }

                    console.log(`[gameStore] Remote player joined: ${player.username} (ID: ${id}) at (${player.x}, ${player.y})`);

                    // Notify only about OTHER users
                    useNotificationStore.getState().addNotification('info', `¡${player.username} se ha unido!`);

                    set(state => {
                        const newPlayers = new Map(state.players);
                        newPlayers.set(id, {
                            ...player,
                            id,
                            character_id: player.character_id || '1'
                        });
                        return { players: newPlayers };
                    });
                });

                wsClient.on('room_joined', (payload) => {
                    console.log("Room joined:", payload.room_id);
                    // Resolve the scene this room belongs to. room_joined doesn't carry
                    // scene_key, so we use the value captured at map_join_approved for
                    // this same room_id (set _pendingRoomScene below).
                    const pending = get()._pendingRoomScene;
                    const roomScene = (pending && pending.roomId === payload.room_id) ? pending.sceneKey : get().currentRoomScene;
                    set({
                        currentRoomId: payload.room_id,
                        currentRoomScene: roomScene,
                        currentInviteCode: payload.invite_code || null,
                        players: new Map() // Clear players from previous room
                    });
                    // Request initial positions
                    wsClient.send('request_positions', {});
                });

                wsClient.on('map_join_approved', (payload) => {
                    console.log("Map join approved:", payload);
                    // Remember which scene this upcoming room belongs to so room_joined
                    // can tag currentRoomScene accurately (room_joined lacks scene_key).
                    set({
                        currentInviteCode: payload.invite_code || null,
                        _pendingRoomScene: { roomId: payload.room_id, sceneKey: payload.scene_key }
                    });
                    // Server has found/created a room for us. Now join it.
                    // Payload: { room_id, scene_key, type, x?, y?, invite_code? }
                    // We dispatch a custom event so the UI/Canvas can handle the scene transition
                    window.dispatchEvent(new CustomEvent('map-join-approved', { detail: payload }));
                });

                wsClient.on('positions_snapshot', ({ positions }) => {
                    const myId = String(useAuthStore.getState().user?.id || '');
                    console.log(`[gameStore] Received positions_snapshot for ${positions?.length || 0} players`);

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
                                    newPlayers.set(id, {
                                        ...existing,
                                        x,
                                        y,
                                        anim: pos.anim || 'idle',
                                        direction: pos.direction || existing.direction,
                                        character_id: pos.character_id || existing.character_id || '1'
                                    });
                                } else {
                                    console.log(`[gameStore] Adding new player from snapshot: ${pos.username} (ID: ${id}) at (${x}, ${y})`);
                                    newPlayers.set(id, {
                                        id,
                                        username: pos.username || 'Unknown',
                                        x,
                                        y,
                                        anim: pos.anim || 'idle',
                                        direction: pos.direction || 'right',
                                        character_id: pos.character_id || '1',
                                        timestamp: pos.timestamp || Date.now()
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
                    console.log(`[gameStore] User left: ID ${targetId}`);
                    set(state => {
                        const newPlayers = new Map(state.players);
                        newPlayers.delete(targetId);
                        return { players: newPlayers };
                    });
                });

                // Updated event name to match backend "position_update"
                wsClient.on('position_update', (payload) => {
                    const { user_id, x, y, username } = payload;
                    const id = String(user_id);
                    const myId = String(useAuthStore.getState().user?.id || '');
                    if (myId && id === myId) return;

                    set(state => {
                        const newPlayers = new Map(state.players);
                        const player = newPlayers.get(id);
                        if (player) {
                            console.log(`[gameStore] Position update for ${player.username} (ID: ${id}): (${Number(x).toFixed(1)}, ${Number(y).toFixed(1)}) | State: ${payload.anim || player.anim} | Dir: ${payload.direction || player.direction}`);
                            newPlayers.set(id, {
                                ...player,
                                x: Number(x),
                                y: Number(y),
                                anim: payload.anim || player.anim,
                                direction: payload.direction || player.direction,
                                character_id: payload.character_id || player.character_id || '1'
                            });
                        } else {
                            console.log(`[gameStore] Position update for NEW player ${username || payload.username || 'Unknown'} (ID: ${id}): (${Number(x).toFixed(1)}, ${Number(y).toFixed(1)})`);
                            newPlayers.set(id, {
                                id,
                                username: username || payload.username || 'Unknown',
                                x: Number(x),
                                y: Number(y),
                                anim: payload.anim || 'idle',
                                direction: payload.direction || 'right',
                                character_id: payload.character_id || '1'
                            });
                        }
                        return { players: newPlayers };
                    });
                });

                wsClient.on('positions_update', (payload) => {
                    // payload is { positions: [ {user_id, x, y, ...}, ... ] }
                    const updates = payload.positions;
                    if (!updates || !Array.isArray(updates)) return;

                    console.log(`[gameStore] Received batched update for ${updates.length} players`);

                    const myId = String(useAuthStore.getState().user?.id || '');

                    set(state => {
                        const newPlayers = new Map(state.players);
                        let changed = false;

                        updates.forEach(pos => {
                            const id = String(pos.user_id);
                            if (myId && id === myId) {
                                return;
                            }

                            const existing = newPlayers.get(id);
                            const name = existing ? existing.username : (pos.username || 'Unknown');
                            // Log only every 5th update for each player to reduce spam while moving
                            if (!existing || (existing.__logCounter || 0) % 5 === 0) {
                                console.log(`[gameStore] Batched update for ${name} (ID: ${id}): (${Number(pos.x).toFixed(1)}, ${Number(pos.y).toFixed(1)}) | State: ${pos.anim || (existing ? existing.anim : 'idle')} | Dir: ${pos.direction || (existing ? existing.direction : 'right')}`);
                            }
                            const logCounter = ((existing ? existing.__logCounter : 0) || 0) + 1;

                            if (existing) {
                                newPlayers.set(id, {
                                    ...existing,
                                    x: Number(pos.x),
                                    y: Number(pos.y),
                                    anim: pos.anim || existing.anim,
                                    direction: pos.direction || existing.direction,
                                    character_id: pos.character_id || existing.character_id,
                                    timestamp: Number(pos.timestamp || Date.now()),
                                    __logCounter: logCounter
                                });
                            } else {
                                newPlayers.set(id, {
                                    id,
                                    username: pos.username || 'Unknown',
                                    x: Number(pos.x),
                                    y: Number(pos.y),
                                    anim: pos.anim || 'idle',
                                    direction: pos.direction || 'right',
                                    character_id: pos.character_id || '1',
                                    timestamp: pos.timestamp || Date.now()
                                });
                            }
                            changed = true;
                        });

                        return changed ? { players: newPlayers } : state;
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

                wsClient.on('challenge_capacity_update', (payload) => {
                    console.log("[gameStore] Challenge capacity update:", payload);
                    window.dispatchEvent(new CustomEvent('minigame-capacity-update', { detail: payload }));
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
                    console.log(`[gameStore] Challenge chat from ${payload.username}: ${payload.message}`);
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

                wsClient.on('audio_mute_state', (payload) => {
                    if (!payload?.user_id || !payload?.session_id) return;
                    usePeerStore.getState().setUserSelfMuted(
                        payload.session_id,
                        String(payload.user_id),
                        !!payload.is_muted
                    );
                });

                wsClient.on('friend_request_received', (payload) => {
                    const { addNotification } = useNotificationStore.getState();
                    addNotification('info', `New friend request from ${payload.requester_username}`);
                    // We could also update a pendingRequests count in store to trigger UI refresh
                    // For now, Sidebar listens to local state but we might want to signal it
                    window.dispatchEvent(new CustomEvent('friend-request-update'));
                });

                wsClient.on('friend_list_update', () => {
                    window.dispatchEvent(new CustomEvent('friend-request-update'));
                });

                wsClient.on('room_invite_received', (payload) => {
                    const { inviter_name, scene_key, invite_code } = payload;
                    const { addNotification } = useNotificationStore.getState();
                    addNotification(
                        'info',
                        `⚔️ ¡${inviter_name} te invita a unirte a su sala en ${scene_key}!`,
                        15000,
                        [
                            {
                                label: 'Aceptar',
                                primary: true,
                                onClick: () => {
                                    window.dispatchEvent(new CustomEvent('lobby-change-map', {
                                        detail: { 
                                            targetMap: scene_key,
                                            targetX: 1000,
                                            targetY: 350,
                                            pin: invite_code
                                        }
                                    }));
                                }
                            },
                            {
                                label: 'Rechazar',
                                primary: false,
                                onClick: () => {}
                            }
                        ]
                    );
                });

                wsClient.on('emoji_broadcast', (payload) => {
                    // Send event to Phaser LobbyScene to show bubble
                    window.dispatchEvent(new CustomEvent('player-emoji-received', { detail: payload }));
                });

                wsClient.on('mission_completed', (payload) => {
                    console.log("[gameStore] Mission completed event received:", payload);
                    
                    const { addNotification } = useNotificationStore.getState();
                    const title = payload.title || "Misión";
                    addNotification('success', `🏆 ¡MISIÓN COMPLETADA: ${title}!`);
                    
                    // Clear active mission state
                    set({ activeMission: null });

                    // Auto-redirect to lobby after a few seconds to let players see the success message
                    setTimeout(() => {
                        console.log("[gameStore] Auto-redirecting to lobby after mission completion");
                        window.dispatchEvent(new CustomEvent('lobby-change-map', {
                            detail: { 
                                targetMap: 'lobby',
                                targetX: 0,
                                targetY: 0
                            }
                        }));
                    }, 4000);
                });

                wsClient.on('enemy_update', (payload) => {
                    // console.log(`[gameStore] Received enemy_update for ${payload.enemies?.length} enemies`);
                    // Dispatch to Phaser scenes (LobbyScene)
                    window.dispatchEvent(new CustomEvent('enemies-update', { detail: payload }));
                });

                wsClient.on('enemy_died', (payload) => {
                    // Dispatch to Phaser scenes
                    window.dispatchEvent(new CustomEvent('enemy-died-broadcast', { detail: payload }));
                    
                    // Show notification if it was a player who killed it
                    if (payload.killed_by) {
                        const myId = String(useAuthStore.getState().user?.id || '');
                        if (String(payload.killed_by) === myId) {
                            useNotificationStore.getState().addNotification('success', '⚔️ ¡Enemigo derrotado!');
                        }
                    }
                });

                wsClient.on('enemy_kill_progress', (payload) => {
                    const { mission_id, task_id, kills_done, required_kills, task_completed } = payload;

                    console.log(`[gameStore] Kill progress: task ${task_id} → ${kills_done}/${required_kills}`);
                    
                    // Mostrar notificación de progreso
                    const { addNotification } = useNotificationStore.getState();
                    if (task_completed) {
                        addNotification('success', `✅ ¡Tarea completada! ${kills_done}/${required_kills} enemigos eliminados`);
                    } else {
                        addNotification('info', `⚔️ ${kills_done}/${required_kills} enemigos eliminados`);
                    }

                    // Actualizar el conteo de kills en la misión activa para el HUD
                    set(state => {
                        const mission = state.activeMission;
                        if (!mission || mission.id !== mission_id) return {};
                        const updatedTasks = (mission.tasks || []).map(t => {
                            if (t.id === task_id) {
                                return { ...t, kills_done, required_kills, is_completed: task_completed };
                            }
                            return t;
                        });
                        return { activeMission: { ...mission, tasks: updatedTasks } };
                    });
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
            currentRoomScene: null,
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
        const timestamp = Date.now();
        /* console.log(`[gameStore] Sending update_position (self): (${x.toFixed(1)}, ${y.toFixed(1)}) | State: ${anim} | Dir: ${direction}`); */
        wsClient.send('update_position', { x, y, direction, anim, is_moving: anim !== 'idle', timestamp });

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
                newPlayers.set(userId, { ...myPlayer, x, y, direction, anim, timestamp });
                return { players: newPlayers };
            } else {
                newPlayers.set(userId, {
                    id: userId,
                    username: user.username,
                    x,
                    y,
                    anim,
                    direction,
                    timestamp
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
        
        // CRITICAL: Clear local entities before joining a new room
        // so we don't bring ghost players/enemies to the new map.
        set({ players: new Map(), enemies: new Map() });
        
        wsClient.send('join_room', payload);
    },

    requestMapJoin: (sceneKey, type = 'public', inviteCode = '') => {
        wsClient.send('request_map_join', { scene_key: sceneKey, type, invite_code: inviteCode });
    },

    fetchActiveMission: async (sceneKey, silent = false) => {
        if (!silent) set({ activeMission: null }); // Clear previous mission state
        try {

            const response = await api.get(`/missions/scene/${sceneKey}`);
            if (response.data && response.data.length > 0) {
                const mission = response.data.find(m => m?.status !== 'completed') || null;

                set({ activeMission: mission });

                if (!silent) {
                    // Multi-user mission mode notifications
                    const { addNotification } = useNotificationStore.getState();
                    switch (mission?.mode) {
                        case 'cooperative':
                            addNotification('info', "🤝 Modo Cooperativo: ¡Luchen juntos por el objetivo!");
                            break;
                        case 'competitive':
                            addNotification('warning', "⚔️ Modo Competitivo: ¡Sé el primero en conseguirlo!");
                            break;
                        case 'individual':
                            addNotification('info', "👤 Modo Individual: Tu progreso es personal.");
                            break;
                    }
                }
            } else {

                set({ activeMission: null });
            }
        } catch (err) {
            console.error("Failed to fetch missions:", err);
            if (!silent) set({ activeMission: null });
        }
    },

    // Explicitly accept/start a mission, scoped to the current room instance.
    // Progress is no longer auto-created on view, so this must be called for the
    // mission to begin tracking (and for kills to count toward it).
    acceptMission: async (missionId) => {
        if (!missionId) return;
        const roomId = get().currentRoomId;
        try {
            await api.post(`/missions/${missionId}/accept${roomId ? `?room_id=${roomId}` : ''}`);
            console.log(`[gameStore] Mission ${missionId} accepted (room ${roomId || 'none'})`);
        } catch (err) {
            console.error('Failed to accept mission:', err);
        }
    },

    fetchInventory: async () => {
        try {
            const response = await api.get('/inventory');
            if (response.data) {
                set({ inventory: response.data });
            }
        } catch (err) {
            console.error("Failed to fetch inventory:", err);
            set({ inventory: [] });
        }
    },

    buyItem: async (itemId, quantity) => {
        try {
            const response = await api.post('/shop/buy', { item_id: itemId, quantity });
            if (response.data.status === 'success') {
                get().fetchInventory();

                // Update gold and stats in authStore for UI reactivity
                const { user } = useAuthStore.getState();
                if (user && response.data.player_stats) {
                    useAuthStore.setState({
                        user: {
                            ...user,
                            stats: response.data.player_stats
                        }
                    });
                }

                useNotificationStore.getState().addNotification('success', '¡Compra realizada con éxito!');
                return true;
            }
        } catch (err) {
            console.error("Failed to buy item:", err);
            const errorMsg = err.response?.data?.error || 'Error al realizar la compra';
            useNotificationStore.getState().addNotification('error', errorMsg);
            return false;
        }
    },

    pickupItem: async (pickupId) => {
        try {
            const response = await api.post(`/inventory/pickup/${pickupId}`);
            if (response.data.status === 'success') {
                get().fetchInventory();
                useNotificationStore.getState().addNotification('success', '¡Objeto recogido!');
                return true;
            }
        } catch (err) {
            console.error("Failed to pickup item:", err);
            useNotificationStore.getState().addNotification('error', 'Error al recoger el objeto');
            return false;
        }
    },

    useItem: async (inventoryId) => {
        try {
            const response = await api.post(`/inventory/use/${inventoryId}`);
            if (response.data.status === 'success') {
                get().fetchInventory();
                useNotificationStore.getState().addNotification('success', response.data.message || '¡Objeto usado!');
                return true;
            }
        } catch (err) {
            console.error("Failed to use item:", err);
            const errorMsg = err.response?.data?.error || 'Error al usar el objeto';
            useNotificationStore.getState().addNotification('error', errorMsg);
            return false;
        }
    },

    sendNinjaCardAnswer: (targetInstanceId, challengeId, selectedOption) => {
        if (!targetInstanceId || !challengeId) {
            return;
        }

        wsClient.send("ninja_card_answer", {
            target_instance_id: targetInstanceId,
            challenge_id: challengeId,
            selected_option: selectedOption,
        });
    },

    clearNinjaCardData: () => {
        set({ ninjaCardData: null });
    },

    sendPlayerAttack: (enemyInstanceId, damage = 10) => {
        const roomId = get().currentRoomId;
        if (roomId && enemyInstanceId) {
            console.log(`[gameStore] Sending player_attack for enemy: ${enemyInstanceId} with damage: ${damage}`);
            wsClient.send('player_attack', { 
                target_instance_id: enemyInstanceId,
                damage: damage,
                room_id: roomId
            });
        }
    },

    teleportToFriend: (friendId) => {
        wsClient.send('teleport_to_friend', { target_user_id: friendId });
    },

    sendRoomInvite: (friendId) => {
        wsClient.send('send_room_invite', { target_user_id: friendId });
    }
})));
