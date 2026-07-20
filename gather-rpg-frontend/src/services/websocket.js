class WebSocketClient {
    constructor() {
        this.ws = null;
        this.url = import.meta.env.VITE_WS_URL || 'ws://localhost:3000/ws';
        this.listeners = new Map();
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.isConnected = false;

        // Messages queued via sendReliable() while the socket was down, flushed on
        // reconnect. Bounded and time-limited so a long outage doesn't replay a pile
        // of stale combat actions (e.g. attacking an enemy that died/despawned ages ago).
        this.pendingReliable = [];
        this.maxReliableQueue = 10;
        this.reliableMaxAgeMs = 4000;
    }

    connect(token) {
        if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
            return;
        }

        let wsUrl = this.url;
        
        // Handle relative URL for WebSocket if starting with /
        if (wsUrl.startsWith('/')) {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            wsUrl = `${protocol}//${window.location.host}${wsUrl}`;
        }
        
        wsUrl = `${wsUrl}?token=${token}`;
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
            console.log('WebSocket connected');
            this.isConnected = true;
            this.reconnectAttempts = 0;
            this.emit('connection_status', { status: 'connected' });
            this._flushReliableQueue();
        };

        this.ws.onmessage = (event) => {
            try {
                // Backend might send multiple newline-separated JSON objects in one frame
                const messages = event.data.split('\n');
                messages.forEach(msgStr => {
                    if (!msgStr.trim()) return;
                    try {
                        const message = JSON.parse(msgStr);
                        this.emit(message.type, message.payload);
                    } catch (e) {
                         console.error('Failed to parse individual message:', e, msgStr);
                    }
                });
            } catch (error) {
                console.error('Failed to process WebSocket event data:', error);
            }
        };

        this.ws.onclose = (event) => {
            console.log(`WebSocket disconnected. Code: ${event.code}, Reason: ${event.reason}`);
            this.isConnected = false;
            this.emit('connection_status', { status: 'disconnected' });

            // 4001 = the server replaced this session because the same user
            // connected from another tab/device. Reconnecting would kick that
            // newer session and both tabs would fight forever, so this one
            // stays disconnected and the UI tells the player why.
            if (event.code === 4001) {
                this.emit('session_replaced', {});
                return;
            }

            // Don't reconnect if it was a semi-controlled close or unauthorized
            if (event.code !== 1000 && event.code !== 1001) {
                this.attemptReconnect(token);
            }
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket Error Object:', error);
        };
    }

    attemptReconnect(token) {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            // Exponential backoff with a minimum of 3 seconds to avoid flapping
            const delay = Math.max(3000, Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000));
            console.log(`Attempting reconnect #${this.reconnectAttempts} in ${delay}ms...`);
            if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
            this.reconnectTimer = setTimeout(() => this.connect(token), delay);
        } else {
            console.error('Max WebSocket reconnect attempts reached.');
        }
    }

    isReady() {
        return !!this.ws && this.ws.readyState === WebSocket.OPEN;
    }

    send(type, payload) {
        if (this.isReady()) {
            this.ws.send(JSON.stringify({ type, payload }));
            return true;
        }
        // Rate-limit the warning: high-frequency messages (update_position at 60fps)
        // would otherwise flood the console while the socket is down/reconnecting.
        const now = Date.now();
        if (!this._lastNotConnectedWarn || now - this._lastNotConnectedWarn > 2000) {
            console.warn(`WebSocket not connected. Dropping outbound messages until reconnect (last: ${type})`);
            this._lastNotConnectedWarn = now;
        }
        return false;
    }

    // Like send(), but for one-shot actions the player already committed to (combat
    // hits, item use) that must not vanish silently on a connection blip: if the
    // socket is down, the message is queued and replayed as soon as it reconnects
    // instead of being dropped. Returns true if sent immediately, false if queued.
    sendReliable(type, payload) {
        if (this.isReady()) {
            this.ws.send(JSON.stringify({ type, payload }));
            return true;
        }
        if (this.pendingReliable.length >= this.maxReliableQueue) {
            this.pendingReliable.shift();
        }
        this.pendingReliable.push({ type, payload, ts: Date.now() });
        this.emit('reliable_queued', { type, payload });
        return false;
    }

    _flushReliableQueue() {
        if (this.pendingReliable.length === 0) return;
        const now = Date.now();
        const queued = this.pendingReliable;
        this.pendingReliable = [];

        const fresh = queued.filter(m => now - m.ts <= this.reliableMaxAgeMs);
        const droppedCount = queued.length - fresh.length;

        fresh.forEach(m => this.ws.send(JSON.stringify({ type: m.type, payload: m.payload })));

        if (fresh.length > 0) this.emit('reliable_flushed', { count: fresh.length });
        if (droppedCount > 0) this.emit('reliable_dropped', { count: droppedCount });
    }

    on(type, callback) {
        if (!this.listeners.has(type)) {
            this.listeners.set(type, new Set());
        }
        this.listeners.get(type).add(callback);
        return () => this.off(type, callback);
    }

    off(type, callback) {
        if (this.listeners.has(type)) {
            this.listeners.get(type).delete(callback);
        }
    }

    removeAllListeners() {
        this.listeners.clear();
    }

    emit(type, payload) {
        if (this.listeners.has(type)) {
            this.listeners.get(type).forEach(callback => callback(payload));
        }
    }

    disconnect() {
        if (this.ws) {
            this.ws.onclose = null; // Prevent reconnect trigger
            this.ws.onerror = null; // Prevent error logging if closing while connecting
            
            // Only close if it's not already CLOSED or CLOSING
            if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
                this.ws.close();
            }
            
            this.ws = null;
            this.isConnected = false;
        }
        // A deliberate disconnect (logout, leaving the map) invalidates whatever
        // combat actions were queued for the old session — don't replay them later.
        this.pendingReliable = [];
    }

    __reset() {
        this.disconnect();
        this.removeAllListeners();
        this.reconnectAttempts = 0;
        this.isConnected = false;
    }
}

export const wsClient = new WebSocketClient();
export default wsClient;
