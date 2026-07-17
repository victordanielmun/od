import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import api from '../services/api';
import wsClient from '../services/websocket';
import { useAuthStore } from './authStore';
import { useNotificationStore } from './notificationStore';
import { usePeerStore } from './peerStore';
import i18n from '../i18n';

// Preferencias de los controles táctiles. Se persisten en localStorage porque
// son ajustes de dispositivo (no de cuenta) y deben sobrevivir recargas.
const VIRTUAL_CONTROLS_LAYOUT_DEFAULTS = {
    dpadSide: 'left', // 'left' = D-pad izquierda / acciones derecha (por defecto)
    scale: 1,         // factor de tamaño de ambos clústeres (0.7–1.5)
    opacity: 1,       // opacidad de los controles (0.3–1)
    offsetY: 0,       // px extra de separación desde el borde inferior (0–120)
};

const loadVirtualControlsMode = () => {
    const stored = localStorage.getItem('virtual_controls_mode');
    return ['auto', 'always', 'never'].includes(stored) ? stored : 'auto';
};

const loadVirtualControlsLayout = () => {
    try {
        const stored = JSON.parse(localStorage.getItem('virtual_controls_layout') || '{}');
        return { ...VIRTUAL_CONTROLS_LAYOUT_DEFAULTS, ...stored };
    } catch {
        return { ...VIRTUAL_CONTROLS_LAYOUT_DEFAULTS };
    }
};

export const useGameStore = create(subscribeWithSelector((set, get) => ({
    isConnected: false,
    players: new Map(),
    messages: [],
    listenersInitialized: false,
    currentRoomId: null,
    currentRoomScene: null, // scene_key that the current room actually belongs to
    currentRoomType: null,  // room type from map_join_approved ('cooperative' activa el audio de reunión)
    // IDs de usuarios que YO bloqueé (moderación): se cargan de GET /blocks al
    // conectar y filtran a esos jugadores de todos los handlers de posiciones,
    // así el bloqueador deja de verlos y de recibir sus actualizaciones.
    blockedIds: new Set(),
    currentSceneKey: 'lobby',
    currentInviteCode: null,
    activeChallengeId: null,
    challengeParticipants: [],
    challengeMessages: [],
    activeMission: null,
    inventory: [],
    virtualControlsMode: loadVirtualControlsMode(), // 'auto' | 'always' | 'never'
    virtualControlsLayout: loadVirtualControlsLayout(), // { dpadSide, scale, opacity, offsetY }

    setVirtualControlsMode: (mode) => {
        localStorage.setItem('virtual_controls_mode', mode);
        set({ virtualControlsMode: mode });
    },
    setVirtualControlsLayout: (partial) => set(state => {
        const layout = { ...state.virtualControlsLayout, ...partial };
        localStorage.setItem('virtual_controls_layout', JSON.stringify(layout));
        return { virtualControlsLayout: layout };
    }),
    resetVirtualControlsLayout: () => {
        localStorage.removeItem('virtual_controls_layout');
        set({ virtualControlsLayout: { ...VIRTUAL_CONTROLS_LAYOUT_DEFAULTS } });
    },

    // Ninja Cards
    ninjaCardData: null,

    // Slot activo de combate: qué pergamino (Q) y qué arrojadizo (U) usar cuando tienes
    // varios. Guardamos el id de la entrada de inventario; si no es válido, se usa el
    // primero del tipo como fallback. Se configuran desde el inventario (SettingsMenu).
    activeScrollId: null,
    activeThrowableId: null,
    setActiveScroll: (id) => set({ activeScrollId: id }),
    setActiveThrowable: (id) => set({ activeThrowableId: id }),

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
                    // Bloquear el input del canvas mientras la card está abierta (el jugador
                    // responde en el overlay HTML). Se re-habilita en clearNinjaCardData.
                    window.dispatchEvent(new CustomEvent('phaser-disable-input'));
                });

                wsClient.on('ninja_card_result', (payload) => {
                    console.log('[NinjaCard] Result received:', payload);
                    window.dispatchEvent(new CustomEvent('ninja-card-result', { detail: payload }));
                });

                set({ listenersInitialized: true });

                wsClient.on('connection_status', ({ status }) => {
                    set({ isConnected: status === 'connected' });
                });

                // Feedback for combat actions (player_attack/player_hit) sent via
                // sendReliable while the socket was down: queued now, resolved once
                // we reconnect (either replayed, or dropped if the outage ran long).
                // Throttled so a burst of combo hits during one outage shows one
                // toast, not one per hit.
                let lastQueuedNotifyAt = 0;
                wsClient.on('reliable_queued', () => {
                    const now = Date.now();
                    if (now - lastQueuedNotifyAt < 2000) return;
                    lastQueuedNotifyAt = now;
                    useNotificationStore.getState().addNotification(
                        'warning',
                        i18n.t('combat.action_queued'),
                        3000
                    );
                });
                wsClient.on('reliable_flushed', ({ count }) => {
                    useNotificationStore.getState().addNotification(
                        'info',
                        i18n.t('combat.action_flushed', { count }),
                        3000
                    );
                });
                wsClient.on('reliable_dropped', ({ count }) => {
                    useNotificationStore.getState().addNotification(
                        'error',
                        i18n.t('combat.action_dropped', { count }),
                        4000
                    );
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
                    if (get().blockedIds.has(id)) return; // usuario bloqueado: invisible

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
                    const isPending = pending && pending.roomId === payload.room_id;
                    const roomScene = isPending ? pending.sceneKey : get().currentRoomScene;
                    set({
                        currentRoomId: payload.room_id,
                        currentRoomScene: roomScene,
                        // El tipo autoritativo viene de map_join_approved; un join directo
                        // (p. ej. lobby) no pasa por ahí y queda como sala normal (null).
                        currentRoomType: isPending ? (pending.roomType || null) : null,
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
                        _pendingRoomScene: { roomId: payload.room_id, sceneKey: payload.scene_key, roomType: payload.type || null }
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
                                if (state.blockedIds.has(id)) return; // usuario bloqueado: invisible

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
                    if (get().blockedIds.has(id)) return; // usuario bloqueado: invisible

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
                            if (state.blockedIds.has(id)) return; // usuario bloqueado: invisible

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

                    // Load persisted message history with this partner.
                    (async () => {
                        try {
                            const myId = String(useAuthStore.getState().user?.id ?? '');
                            const { data } = await api.get(`/friends/${payload.partner_id}/messages`);
                            const history = (data?.messages || []).map(m => ({
                                sender: String(m.sender_id) === myId ? 'Me' : payload.partner_name,
                                text: m.content
                            }));
                            // Only apply if this chat is still the active one.
                            set(state => {
                                if (!state.activeChat || String(state.activeChat.partner_id) !== String(payload.partner_id)) {
                                    return {};
                                }
                                return { activeChat: { ...state.activeChat, messages: history } };
                            });
                        } catch (e) {
                            // No history or fetch failed — start with an empty conversation.
                        }
                    })();
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
                    addNotification('info', i18n.t('lobby.menu.friend_request_received', { name: payload.requester_username }));
                    // We could also update a pendingRequests count in store to trigger UI refresh
                    // For now, Sidebar listens to local state but we might want to signal it
                    window.dispatchEvent(new CustomEvent('friend-request-update'));
                });

                wsClient.on('friend_list_update', () => {
                    window.dispatchEvent(new CustomEvent('friend-request-update'));
                });

                wsClient.on('room_invite_received', (payload) => {
                    const { inviter_id, inviter_name, scene_key } = payload;
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
                                    // Teletransporte al amigo: garantiza caer en SU instancia de
                                    // sala exacta (crítico en coop, donde hay varias instancias
                                    // de la misma escena). Un join por scene_key podía aterrizar
                                    // en cualquier instancia pública, separando al equipo.
                                    get().teleportToFriend(inviter_id);
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

                // Aviso de moderación enviado por un admin (advertencia por bloqueos).
                wsClient.on('admin_notice', (payload) => {
                    const { addNotification } = useNotificationStore.getState();
                    addNotification('warning', `⚠️ Moderación: ${payload?.message || ''}`, 20000);
                });

                wsClient.on('emoji_broadcast', (payload) => {
                    // Send event to Phaser LobbyScene to show bubble
                    window.dispatchEvent(new CustomEvent('player-emoji-received', { detail: payload }));
                });

                wsClient.on('mission_completed', (payload) => {
                    console.log("[gameStore] Mission completed event received:", payload);

                    const title = payload.title || "Misión";

                    // Clear active mission state
                    set({ activeMission: null });

                    // Mostrar un modal claro de "Misión Completada" (sin auto-redirigir).
                    // El jugador decide cuándo volver al lobby.
                    window.dispatchEvent(new CustomEvent('mission-completed-overlay', {
                        detail: { title }
                    }));
                });

                wsClient.on('enemy_update', (payload) => {
                    // console.log(`[gameStore] Received enemy_update for ${payload.enemies?.length} enemies`);
                    // Dispatch to Phaser scenes (LobbyScene)
                    window.dispatchEvent(new CustomEvent('enemies-update', { detail: payload }));
                });

                wsClient.on('wave_started', (payload) => {
                    const { current_wave, max_wave } = payload || {};
                    console.log(`[gameStore] Wave started: ${current_wave}/${max_wave}`);
                    useNotificationStore.getState().addNotification('info', `🌊 Oleada ${current_wave} de ${max_wave}`);
                    window.dispatchEvent(new CustomEvent('wave-started', { detail: payload }));
                });

                // HP autoritativo del jugador (E2): el server decide HP/daño/muerte.
                wsClient.on('player_hp', (payload) => {
                    window.dispatchEvent(new CustomEvent('player-hp-update', { detail: payload }));
                });
                wsClient.on('player_died', () => {
                    window.dispatchEvent(new CustomEvent('player-died-server'));
                });
                // Maná autoritativo del jugador (fuente de verdad persistente). Lo escuchan
                // el HUD de combate (CombatSystem) y el Sidebar (LobbyLayout).
                wsClient.on('player_mp', (payload) => {
                    window.dispatchEvent(new CustomEvent('player-mp-update', { detail: payload }));
                });

                wsClient.on('enemy_died', (payload) => {
                    // Dispatch to Phaser scenes. Sin toast propio: la muerte ya se
                    // ve en el juego y enemy_kill_progress notifica el conteo; con
                    // ambos se apilaban 2 toasts por cada kill.
                    window.dispatchEvent(new CustomEvent('enemy-died-broadcast', { detail: payload }));
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
            // Cargar mi lista de bloqueados para que el filtrado de jugadores
            // (positions/player_joined) aplique desde el primer frame.
            get().loadBlockedUsers();
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
            currentRoomType: null,
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

    fetchActiveMission: async (sceneKey) => {
        // No se limpia la misión activa de entrada: una misión puede abarcar varias
        // escenas (p. ej. la de Amy manda a comprar ítems a la pet_store). Si al
        // teletransportarte a una escena sin misión propia borráramos activeMission,
        // el MissionTracker desaparecería y el jugador olvidaría qué comprar. La
        // misión debe mantenerse hasta que otra escena aporte SU propia misión, o
        // hasta que se complete (evento WS mission_completed limpia activeMission).
        try {
            // El progreso es room-agnostic (una fila por player+mission, scoped por
            // escena), así que no hace falta room_id aquí.
            const response = await api.get(`/missions/scene/${sceneKey}`);
            const mission = (response.data && response.data.length > 0)
                ? (response.data.find(m => m?.status !== 'completed') || null)
                : null;

            if (mission) {
                // La escena tiene su propia misión activa: reemplaza la anterior.
                // El modo (individual/coop/competitivo) ya no se anuncia con un
                // toast aparte: se muestra como chip dentro del banner "Aventura
                // Iniciada" para no apilar 3 avisos al iniciar la misión.
                set({ activeMission: mission });
            } else {
                // La escena no tiene misión activa. Solo se limpia el tracker si la
                // misión activa PERTENECE a esta escena (se completó/quitó aquí). Si
                // pertenece a otra escena (p. ej. la de Amy mientras visitas la
                // pet_store), se conserva para no borrar las tareas al comprar.
                set(state => (
                    state.activeMission && state.activeMission.scene_key === sceneKey
                        ? { activeMission: null }
                        : {}
                ));
            }
        } catch (err) {
            console.error("Failed to fetch missions:", err);
            // Ante un error transitorio se conserva la misión activa para no
            // hacerla parpadear/desaparecer del tracker.
        }
    },

    // Explicitly accept/start a mission, scoped to the current room instance.
    // Progress is no longer auto-created on view, so this must be called for the
    // mission to begin tracking (and for kills to count toward it).
    acceptMission: async (missionId) => {
        if (!missionId) return;
        const roomId = get().currentRoomId;
        try {
            const response = await api.post(`/missions/${missionId}/accept${roomId ? `?room_id=${roomId}` : ''}`);
            console.log(`[gameStore] Mission ${missionId} accepted (room ${roomId || 'none'})`);

            // If the mission paid an up-front gold advance, reflect the new gold in
            // the HUD (authStore.user.stats) and tell the player about the stipend.
            const advance = response?.data?.advance_gold || 0;
            if (advance > 0) {
                const { user } = useAuthStore.getState();
                if (user && response.data.player_stats) {
                    useAuthStore.setState({
                        user: { ...user, stats: response.data.player_stats }
                    });
                }
                useNotificationStore.getState().addNotification('success', `+${advance} de oro de anticipo para la misión`);
            }
            return { ok: true };
        } catch (err) {
            // 402 = premium mission and the player is not a member. Signal the caller
            // so it can route the player to the membership page instead of failing silently.
            if (err?.response?.status === 402) {
                return { ok: false, premiumRequired: true };
            }
            console.error('Failed to accept mission:', err);
            return { ok: false };
        }
    },

    // Pull the player's current stats (gold, HP, etc.) from the server and sync
    // them into authStore so any wallet display (shop header, HUD) shows the real
    // balance. Conversational purchases deduct gold server-side without returning
    // the new total, so call this to refresh after opening the shop.
    fetchPlayerStats: async () => {
        try {
            const response = await api.get('/player/stats');
            if (response.data) {
                const { user } = useAuthStore.getState();
                if (user) {
                    useAuthStore.setState({ user: { ...user, stats: response.data } });
                }
            }
            return response.data;
        } catch (err) {
            console.error('Failed to fetch player stats:', err);
            return null;
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

    // Gasto de maná autoritativo: el server valida, descuenta y persiste (PlayerStats),
    // y responde con el maná real vía 'player_mp'. El cliente descuenta optimista aparte.
    sendSpendMana: (amount) => {
        if (!amount || amount <= 0) return;
        wsClient.send('spend_mana', { amount });
    },

    // Pide al server recargar el maná desde BD (tras usar una poción de maná en el
    // inventario por REST) para sincronizar el HUD de combate.
    refreshMana: () => {
        wsClient.send('refresh_mana', {});
    },

    useItem: async (inventoryId) => {
        try {
            const response = await api.post(`/inventory/use/${inventoryId}`);
            if (response.data.status === 'success') {
                get().fetchInventory();
                // El maná/HP pudieron cambiar en BD (poción): sincroniza el maná de combate
                // (refreshMana → player_mp) y refresca los stats del Sidebar por REST (no
                // depende del WS, así funciona aunque el backend no esté reiniciado).
                get().refreshMana();
                window.dispatchEvent(new CustomEvent('refresh-player-stats'));
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
        // Al cerrar la card devolvemos el foco/control del teclado al canvas. Si el jugador
        // pulsó una opción (un <button>), el canvas perdió el foco y a veces dejaba de
        // recibir el input al reanudar. Re-habilitamos y enfocamos explícitamente.
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('phaser-enable-input'));
            const canvas = document.querySelector('canvas');
            if (canvas) canvas.focus();
            // El servidor puede matarnos con la card abierta (penalización por fallar):
            // CombatSystem aplaza esa muerte y la ejecuta al recibir este evento.
            window.dispatchEvent(new CustomEvent('ninja-card-closed'));
        }
    },

    sendPlayerAttack: (enemyInstanceId, attackType = 'basic', itemId = null) => {
        const roomId = get().currentRoomId;
        if (roomId && enemyInstanceId) {
            console.log(`[gameStore] Sending player_attack for enemy: ${enemyInstanceId} (${attackType})`);
            // El servidor decide el daño según attack_type; el cliente solo informa el tipo.
            // Para arrojables se manda el item_id: el servidor lee su effect_value de la BD
            // (daño definido por el admin), nunca un valor de daño enviado por el cliente.
            // sendReliable (no send): un combo aterrizado no debe perderse en silencio si
            // el socket está caído en ese instante — se encola y se reenvía al reconectar.
            wsClient.sendReliable('player_attack', {
                target_instance_id: enemyInstanceId,
                attack_type: attackType,
                ...(itemId ? { item_id: itemId } : {}),
                room_id: roomId
            });
        }
    },

    // El jugador reporta que un enemigo lo golpeó; el servidor aplica el daño.
    sendPlayerHit: (enemyInstanceId) => {
        const roomId = get().currentRoomId;
        if (roomId && enemyInstanceId) {
            wsClient.sendReliable('player_hit', { enemy_instance_id: enemyInstanceId, room_id: roomId });
        }
    },

    // Solicita revivir (reset de HP server-side).
    sendPlayerRespawn: () => {
        wsClient.send('player_respawn', {});
    },

    // Notifica el uso de poción de vida; el servidor cura el HP autoritativo.
    sendPlayerHeal: () => {
        wsClient.send('player_heal', {});
    },

    teleportToFriend: (friendId) => {
        wsClient.send('teleport_to_friend', { target_user_id: friendId });
    },

    sendRoomInvite: (friendId) => {
        wsClient.send('send_room_invite', { target_user_id: friendId });
    },

    // ── Bloqueos (moderación) ────────────────────────────────────────────────
    loadBlockedUsers: async () => {
        try {
            const res = await api.get('/blocks');
            const ids = new Set((res.data?.blocks || []).map(b => String(b.blocked_id)));
            set({ blockedIds: ids });
        } catch (err) {
            console.error('[gameStore] Failed to load blocked users:', err);
        }
    },

    // Bloquea a un usuario con motivo. Lo elimina de inmediato del mapa de
    // jugadores (deja de verse) y el backend corta chat/audio/invitaciones.
    blockUser: async (userId, reason, details = '') => {
        const id = String(userId);
        await api.post('/blocks', { blocked_id: id, reason, details });
        set(state => {
            const newBlocked = new Set(state.blockedIds);
            newBlocked.add(id);
            const newPlayers = new Map(state.players);
            newPlayers.delete(id);
            return { blockedIds: newBlocked, players: newPlayers };
        });
    },

    unblockUser: async (userId) => {
        const id = String(userId);
        await api.delete(`/blocks/${id}`);
        set(state => {
            const newBlocked = new Set(state.blockedIds);
            newBlocked.delete(id);
            return { blockedIds: newBlocked };
        });
    }
})));
