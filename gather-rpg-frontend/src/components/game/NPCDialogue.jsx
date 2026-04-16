import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Send, X, Volume2, MessageSquare, AlertCircle, ChevronDown, ShoppingBag, MapPin, Compass } from 'lucide-react';
import api from '../../services/api';
import { analyzeAudio, generateTTS, getTTSAudioUrl } from '../../services/voiceApi';
import ShopModal from '../common/ShopModal';
import { useAuthStore } from '../../store/authStore';
import { useGameStore } from '../../store/gameStore';
import { ItemIcon } from '../common/ItemIcon';
import { STATE_TO_ANIM, NPC_CONFIG } from '../../game/config/NPCConfig';

const NPCPortrait = ({ npcId, state, size = 'small' }) => {
    // Normalize ID: sprite2 -> 2
    const cleanId = String(npcId || '2').replace('sprite', '');
    const [atlasData, setAtlasData] = useState(null);
    const [frameInfo, setFrameInfo] = useState(null);

    useEffect(() => {
        if (NPC_CONFIG.hasAssets(cleanId)) {
            fetch(`/npcs/${cleanId}a.json`)
                .then(res => res.json())
                .then(data => setAtlasData(data))
                .catch(err => console.error("Error loading atlas:", err));
        }
    }, [cleanId]);

    useEffect(() => {
        if (!atlasData) return;
        
        const animConfig = STATE_TO_ANIM[state] || STATE_TO_ANIM.idle;
        const npcAnims = NPC_CONFIG.animationsByNPC[cleanId];
        const animName = npcAnims ? npcAnims[animConfig.portrait].frames[0] : null;
        
        if (animName) {
            const frame = atlasData.frames.find(f => f.filename === animName);
            if (frame) setFrameInfo(frame.frame);
        }
    }, [atlasData, state, cleanId]);

    if (!NPC_CONFIG.hasAssets(cleanId)) return null;
    if (!frameInfo) return <div className="w-12 h-12 rounded-full bg-gray-800 animate-pulse" />;

    const isLarge = size === 'large';
    const containerH = isLarge ? 400 : 48;
    const scale = containerH / frameInfo.h;
    const atlasW = atlasData.meta.size.w;
    const atlasH = atlasData.meta.size.h;

    return (
        <div 
            className={isLarge 
                ? "w-[400px] h-[400px] animate-float animate-slide-in-left transition-all duration-700 hover:scale-105 drop-shadow-[0_20px_40px_rgba(0,0,0,0.6)]" 
                : "w-12 h-12 rounded-none border-2 border-[var(--color-gold)] overflow-hidden bg-[var(--color-base-dark)] shadow-inner"
            }
            style={{
                backgroundImage: `url(/npcs/${cleanId}a.png)`,
                backgroundPosition: `-${frameInfo.x * scale}px -${frameInfo.y * scale}px`,
                backgroundSize: `${atlasW * scale}px ${atlasH * scale}px`,
                imageRendering: 'pixelated',
                backgroundRepeat: 'no-repeat',
                backgroundBlendMode: 'multiply',
            }}
        />
    );
};

export const NPCDialogue = ({ npcData, onClose }) => {
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const [isRecording, setIsRecording] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [npcState, setNpcState] = useState('idle');
    const [lastTtsUrl, setLastTtsUrl] = useState(null);
    const [isTtsPlaying, setIsTtsPlaying] = useState(false);
    const [isShopOpen, setIsShopOpen] = useState(false);
    const [hasShop, setHasShop] = useState(false);
    const [shopData, setShopData] = useState(null);
    const [giftInfo, setGiftInfo] = useState(null);
    const [availableMissions, setAvailableMissions] = useState([]);
    const [selectedMissionId, setSelectedMissionId] = useState(null);
    
    const mediaRecorderRef = useRef(null);
    const audioRef = useRef(null);
    const audioChunksRef = useRef([]);
    const scrollRef = useRef(null);
    const user = useAuthStore(state => state.user);
    const { currentSceneKey, requestMapJoin } = useGameStore();

    const selectedMission = availableMissions.find(m => m.id === selectedMissionId);
    const needsTeleport = selectedMission && selectedMission.scene_key && selectedMission.scene_key !== currentSceneKey;

    useEffect(() => {
        window.dispatchEvent(new CustomEvent('npc-interaction-start', {
            detail: { templateId: npcData.templateId }
        }));

        const initialGreet = () => {
            setMessages([{
                sender: 'npc',
                text: `Hello ${user?.username || 'traveler'}! How can I help you today?`,
                timestamp: new Date()
            }]);
        };
        initialGreet();

        const fetchMissions = async () => {
            try {
                const res = await api.get(`/missions/npc/${npcData.templateId}`);
                const data = res.data;
                
                // New structure: { missions, is_merchant, shop, npc_name }
                if (data && data.missions) {
                    setAvailableMissions(data.missions);
                    setHasShop(data.is_merchant);
                    if (data.shop) {
                        console.log("[NPCDialogue] Shop data received:", data.shop);
                        setShopData(data.shop);
                    }
                    
                    // If only one mission and NOT a merchant, select it automatically
                    if (data.missions.length === 1 && !data.is_merchant) {
                        setSelectedMissionId(data.missions[0].id);
                    }
                } else if (Array.isArray(data)) {
                    // Fallback for old API format
                    setAvailableMissions(data);
                    if (data.length === 1) setSelectedMissionId(data[0].id);
                }
            } catch (err) {
                console.error("Error fetching NPC missions:", err);
            }
        };

        fetchMissions();

        return () => {
            window.dispatchEvent(new CustomEvent('npc-interaction-end', {
                detail: { templateId: npcData.templateId }
            }));
        };
    }, [user, npcData.templateId]);

    const handleListen = async (text) => {
        if (!text || isTtsPlaying) return;
        setIsTtsPlaying(true);
        try {
            let url = lastTtsUrl;
            if (!url) {
                let npcVoice = NPC_CONFIG.voices[npcData.templateId] || NPC_CONFIG.voices.default;
                
                // Override with specific voice based on configured gender if available
                if (npcData.voiceType === 'female') {
                    npcVoice = 'en-US-AriaNeural';
                } else if (npcData.voiceType === 'male') {
                    npcVoice = 'en-US-GuyNeural';
                }

                const tts = await generateTTS(text, npcVoice);
                url = tts.audio_url || getTTSAudioUrl(tts.cache_key);
                setLastTtsUrl(url);
            }
            if (audioRef.current) audioRef.current.pause();
            const audio = new Audio(url);
            audioRef.current = audio;
            audio.onended = () => setIsTtsPlaying(false);
            audio.onerror = () => {
                if ('speechSynthesis' in window) {
                    const utterance = new SpeechSynthesisUtterance(text);
                    utterance.lang = 'en-US';
                    utterance.onend = () => setIsTtsPlaying(false);
                    speechSynthesis.speak(utterance);
                } else {
                    setIsTtsPlaying(false);
                }
            };
            audio.play();
        } catch (err) {
            console.error("TTS play failed:", err);
            setIsTtsPlaying(false);
        }
    };

    const handleSend = async (text, score = 100) => {
        if (!text.trim() || isProcessing) return;
        
        setIsProcessing(true);
        const newMsg = { sender: 'player', text, timestamp: new Date(), score };
        setMessages(prev => [...prev, newMsg]);
        setInputText('');
        setLastTtsUrl(null); // Reset when starting new turn

        try {
            const response = await api.post('/npc/dialogue', {
                npc_template_id: npcData.templateId,
                room_id: npcData.roomId,
                player_input: text,
                pronunciation_score: score,
                mission_id: selectedMissionId
            });

            const data = response.data;
            setMessages(prev => [...prev, {
                sender: 'npc',
                text: data.npc_response,
                timestamp: new Date(),
                eval: data.pronunciation_eval
            }]);
            
            setNpcState(data.npc_state || 'idle');

            if (data.item_gift) {
                setGiftInfo({
                    item: data.item_gift,
                    quantity: data.gift_quantity || 1
                });
                // Auto-clear gift info after 5 seconds
                setTimeout(() => setGiftInfo(null), 5000);
            }
            
            if (data.npc_response) {
                handleListen(data.npc_response);
            }

            if (data.is_shop) {
                 setHasShop(true);
            }
        } catch (err) {
            console.error("Dialogue error:", err);
        } finally {
            setIsProcessing(false);
        }
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream);
            mediaRecorderRef.current = recorder;
            audioChunksRef.current = [];
            recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
            recorder.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                setIsProcessing(true);
                try {
                    const result = await analyzeAudio(audioBlob, "00000000-0000-0000-0000-000000000000"); 
                    handleSend(result.transcription, result.pronunciation_score);
                } catch (err) { console.error("Audio analysis failed:", err); }
                finally { setIsProcessing(false); }
            };
            recorder.start();
            setIsRecording(true);
        } catch (err) { console.error("Microphone access denied:", err); }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
        }
    };

    const lastMessage = messages[messages.length - 1] || { text: '...', sender: 'npc' };
    const isAudioOnly = npcData.interactionMode === 'audio_only';

    return (
        <div className="fixed inset-0 z-50 flex flex-col justify-end items-center pb-20 pointer-events-none bg-black/20 backdrop-blur-sm">
            {/* Main Dialogue UI */}
            <div className="relative w-full max-w-5xl px-4 pointer-events-auto">
                
                {/* Close Button */}
                <button 
                    onClick={onClose} 
                    className="absolute top-[-60px] right-2 p-2 bg-[var(--color-orange-vibrant)] text-white border-2 border-[var(--color-gold)] shadow-2xl hover:bg-[var(--color-accent-blue)] transition-colors"
                >
                    <X size={20} />
                </button>

                {/* NPC Portrait (Izquierda) */}
                <div className="absolute left-[-40px] bottom-[-40px] z-20 pointer-events-none drop-shadow-2xl">
                    <NPCPortrait npcId={npcData.characterId || npcData.templateId} state={npcState} size="large" />
                </div>
                
                {/* Dialogue Area (Derecha) */}
                <div className="ml-[360px] relative z-10">
                    
                    {/* Name Tag (Parallelogram) */}
                    <div className="relative inline-block ml-12 mb-[-6px] z-30">
                        <div className="bg-[var(--color-orange-vibrant)] text-white px-12 py-3 border-4 border-[var(--color-gold)] shadow-[0_8px_16px_rgba(0,0,0,0.5)] relative">
                            <div className="absolute -left-2 -top-2 w-4 h-4 bg-[var(--color-gold)] rotate-45 border border-[var(--color-gold-dark)]"></div>
                            <div className="absolute -right-2 -top-2 w-4 h-4 bg-[var(--color-gold)] rotate-45 border border-[var(--color-gold-dark)]"></div>
                            <span className="block font-medieval text-2xl tracking-widest uppercase drop-shadow-[2px_2px_0_rgba(0,0,0,0.5)]">
                                {npcData.name}
                            </span>
                        </div>
                    </div>
                    
                    {/* Dialogue Bubble */}
                    <div className="bg-[var(--color-parchment)] border-8 border-double border-[var(--color-gold)] p-10 pb-8 shadow-[0_20px_50px_rgba(0,0,0,0.8)] relative min-h-[220px] flex flex-col overflow-hidden">
                        {/* Parchment Texture */}
                        <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/parchment.png")' }}></div>
                        
                        {/* Pronunciation Badge (Top Right) */}
                        {lastMessage.sender === 'npc' && lastMessage.eval && (
                            <div className="absolute top-6 right-10 flex items-center gap-2 px-4 py-1.5 bg-[var(--color-base-dark)] text-[var(--color-gold)] border-2 border-[var(--color-gold)] text-[11px] font-medieval uppercase tracking-widest shadow-lg z-20">
                                <AlertCircle size={12} className="text-[var(--color-gold)]" />
                                {lastMessage.eval}
                            </div>
                        )}

                        {giftInfo && (
                            <div className="absolute top-[-40px] left-1/2 -translate-x-1/2 flex items-center gap-4 px-6 py-3 bg-gradient-to-r from-yellow-700 to-yellow-500 text-black border-4 border-yellow-900 shadow-2xl animate-bounce z-50 font-medieval uppercase">
                                <ItemIcon iconKey={giftInfo.item.icon_key} type={giftInfo.item.item_type} size={32} className="pixelated" />
                                <span className="font-black italic text-sm">RECOMPENSA: {giftInfo.quantity}x {giftInfo.item.name}</span>
                            </div>
                        )}

                        {/* Mission Selector (If > 1 available) */}
                        {availableMissions.length > 1 && !selectedMissionId && (
                            <div className="absolute inset-0 z-[100] bg-[var(--color-parchment)]/95 backdrop-blur-sm p-8 flex flex-col items-center justify-start gap-4 text-center overflow-y-auto custom-scrollbar-light">
                                <h3 className="text-3xl font-medieval text-[var(--color-base-dark)] mt-4 mb-4 drop-shadow-sm uppercase tracking-wider">¿En qué puedo ayudarte hoy?</h3>
                                <div className="grid grid-cols-1 gap-4 w-full max-w-xl pb-10">
                                    {/* Merchant Option */}
                                    {hasShop && (
                                        <button 
                                            onClick={() => setIsShopOpen(true)}
                                            className="p-6 border-4 border-double border-yellow-700 bg-yellow-50 hover:bg-yellow-600 hover:text-white transition-all flex items-center justify-between group shadow-xl -translate-y-1"
                                        >
                                            <div className="flex flex-col items-start">
                                                <span className="font-medieval text-2xl uppercase tracking-widest text-[#8b0000] group-hover:text-white">Ver Mercancías</span>
                                                <span className="text-sm opacity-80 font-serif">Explora los tesoros y suministros de mi tienda.</span>
                                            </div>
                                            <ShoppingBag size={40} className="text-yellow-700 group-hover:text-white" />
                                        </button>
                                    )}

                                    {/* Missions List */}
                                    {availableMissions.map(m => (
                                        <div key={m.id} className="flex flex-col gap-1">
                                            <button 
                                                onClick={() => setSelectedMissionId(m.id)}
                                                className={`p-6 border-4 border-double transition-all flex flex-col items-start gap-2 group shadow-lg w-full ${
                                                    selectedMissionId === m.id
                                                        ? 'border-[var(--color-orange-vibrant)] bg-orange-50'
                                                        : m.status === 'completed' 
                                                            ? 'border-green-800 bg-green-100/50 opacity-80 cursor-default' 
                                                            : 'border-[var(--color-gold)] bg-white/60 hover:bg-[var(--color-accent-blue)] hover:text-white hover:-translate-y-1'
                                                }`}
                                            >
                                                <div className="flex items-center justify-between w-full">
                                                    <span className="font-medieval text-xl uppercase tracking-tighter">{m.title}</span>
                                                    {m.status === 'completed' && (
                                                        <span className="text-[10px] bg-green-800 text-white px-3 py-1 font-bold uppercase tracking-widest border border-green-600">
                                                            Completada
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="text-sm opacity-80 text-left font-serif leading-snug">{m.description}</span>
                                                
                                                {m.scene_key && (
                                                    <div className="flex items-center gap-2 mt-2 text-[10px] font-bold uppercase tracking-widest text-[#8b0000]/60 group-hover:text-white/60">
                                                        <MapPin size={10} /> Ubicación: {m.scene_key}
                                                    </div>
                                                )}
                                            </button>

                                            {selectedMissionId === m.id && needsTeleport && m.status !== 'completed' && (
                                                <button
                                                    onClick={() => {
                                                        // Dispatch event so LobbyGameCanvas handles loading/restart
                                                        window.dispatchEvent(new CustomEvent('lobby-change-map', {
                                                            detail: { targetMap: m.scene_key }
                                                        }));
                                                        onClose();
                                                    }}
                                                    className="w-full mt-2 p-4 bg-[var(--color-orange-vibrant)] text-white border-4 border-[var(--color-gold)] font-medieval text-xl uppercase tracking-widest hover:bg-[var(--color-base-dark)] transition-all flex items-center justify-center gap-3 animate-bounce shadow-2xl"
                                                >
                                                    <Compass className="animate-spin-slow" />
                                                    Viajar a la Misión
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Speaking Status */}
                        <h4 className="text-[var(--color-accent-blue)] text-[12px] font-medieval uppercase tracking-widest mb-3 opacity-90 flex items-center gap-2 relative z-10">
                            {lastMessage.sender === 'npc' ? 'The Merchant speaks...' : 'You response:'}
                            {isAudioOnly && lastMessage.sender === 'npc' && (
                                <span className="bg-[var(--color-orange-vibrant)] text-white px-2 py-0.5 border border-[var(--color-gold)] text-[9px]">
                                    SILENCE REQ.
                                </span>
                            )}
                        </h4>

                        {/* Current Message */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar-light mb-6 flex items-start justify-between gap-6 relative z-10">
                            <p className="text-2xl text-[var(--color-base-dark)] font-medieval leading-tight tracking-tight flex-1 drop-shadow-sm">
                                {(lastMessage.sender === 'npc' && isAudioOnly) ? (
                                    <span className="text-[var(--color-accent-blue)] italic opacity-60">Listen closely to the words...</span>
                                ) : (
                                    lastMessage.text
                                )}
                            </p>
                            {lastMessage.sender === 'npc' && (
                                <div className="flex flex-col gap-2">
                                    <button
                                        onClick={() => handleListen(lastMessage.text)}
                                        disabled={isProcessing || isRecording || isTtsPlaying}
                                        className={`p-4 transition-all duration-300 border-4 border-[var(--color-gold)] shadow-xl ${
                                            isTtsPlaying 
                                                ? 'bg-[var(--color-orange-vibrant)] text-white animate-pulse' 
                                                : 'bg-[var(--color-accent-blue)] text-[var(--color-gold)] hover:bg-[var(--color-base-dark)] active:translate-y-1'
                                        }`}
                                        title="Hear voice"
                                    >
                                        <Volume2 size={28} className={isTtsPlaying ? 'animate-bounce' : ''} />
                                    </button>
                                    
                                    {hasShop && (
                                        <button
                                            onClick={() => setIsShopOpen(true)}
                                            className="p-4 bg-[#8b0000] text-yellow-500 border-4 border-yellow-600 shadow-2xl hover:bg-[#a00000] transition-all active:translate-y-1 flex items-center justify-center animate-in fade-in zoom-in duration-300"
                                            title="Merchant Store"
                                        >
                                            <ShoppingBag size={28} />
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Input Area (Centered within bubble) */}
                        <div className="mt-auto flex items-center gap-4 bg-[var(--color-base-dark)]/10 p-2 pl-6 border-4 border-double border-[var(--color-gold)] relative z-10">
                            <button
                                onMouseDown={startRecording}
                                onMouseUp={stopRecording}
                                className={`p-4 transition-all border-2 border-[var(--color-gold-dark)] shadow-md ${
                                    isRecording 
                                        ? 'bg-[var(--color-orange-vibrant)] text-white animate-pulse' 
                                        : 'bg-[var(--color-accent-blue)] text-[var(--color-gold)]'
                                }`}
                            >
                                {isRecording ? <MicOff size={22} /> : <Mic size={22} />}
                            </button>
                            
                            <input
                                type="text"
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleSend(inputText)}
                                disabled={isProcessing || isRecording || isAudioOnly}
                                placeholder={isAudioOnly ? "Silence required..." : "Type your words..."}
                                className={`flex-1 bg-transparent text-[var(--color-base-dark)] text-xl font-medieval placeholder-[var(--color-accent-blue)]/50 focus:outline-none ${isAudioOnly ? 'cursor-not-allowed opacity-50' : ''}`}
                            />

                            <button
                                onClick={() => handleSend(inputText)}
                                disabled={!inputText.trim() || isProcessing || isAudioOnly}
                                className="bg-[var(--color-orange-vibrant)] text-white p-4 border-2 border-[var(--color-gold)] hover:bg-[var(--color-accent-blue)] disabled:opacity-50 transition-all flex items-center justify-center shadow-lg active:translate-y-1"
                            >
                                <ChevronDown size={28} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {isShopOpen && (
                <ShopModal 
                    isOpen={isShopOpen} 
                    onClose={() => setIsShopOpen(false)} 
                    npcId={npcData.templateId}
                    shopName={npcData.name}
                    initialData={shopData}
                />
            )}
        </div>
    );
};
