import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Send, X, Volume2, MessageSquare, AlertCircle, ChevronDown, ShoppingBag, MapPin, Compass, ShieldCheck, Map } from 'lucide-react';
import api from '../../services/api';
import { analyzeDialogueAudio, generateTTS, getTTSAudioUrl } from '../../services/voiceApi';
import ShopModal from '../common/ShopModal';
import { useAuthStore } from '../../store/authStore';
import { useGameStore } from '../../store/gameStore';
import { ItemIcon } from '../common/ItemIcon';
import { STATE_TO_ANIM, NPC_CONFIG } from '../../game/config/NPCConfig';

const NPCPortrait = ({ npcId, state, size = 'small' }) => {
    // Normalize ID: sprite2 -> 2
    const cleanId = String(npcId || '1').replace('sprite', '');
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
        
        // Safety check: ensure the specific animation exists for this NPC
        const animation = npcAnims ? npcAnims[animConfig.portrait] : null;
        const animName = (animation && animation.frames) ? animation.frames[0] : null;
        
        if (animName) {
            const frame = atlasData.frames.find(f => f.filename === animName);
            if (frame) setFrameInfo(frame.frame);
        } else {
            console.warn(`[NPCPortrait] No portrait frame found for NPC ${cleanId} in state ${state}`);
            // Optional: fallback to first available frame in atlas if everything fails
            if (atlasData.frames.length > 0 && !frameInfo) {
                setFrameInfo(atlasData.frames[0].frame);
            }
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
    const [loadingMissionId, setLoadingMissionId] = useState(null);
    const [npcState, setNpcState] = useState('idle');
    const [lastTtsUrl, setLastTtsUrl] = useState(null);
    const [isTtsPlaying, setIsTtsPlaying] = useState(false);
    const [isShopOpen, setIsShopOpen] = useState(false);
    const [hasShop, setHasShop] = useState(false);
    const [shopData, setShopData] = useState(null);
    const [giftInfo, setGiftInfo] = useState(null);
    const [availableMissions, setAvailableMissions] = useState([]);
    const [selectedMissionId, setSelectedMissionId] = useState(null);
    const [resolvedType, setResolvedType] = useState(null);
    const [autoPlay, setAutoPlay] = useState(true);
    const [isMissionComplete, setIsMissionComplete] = useState(false);
    const [completedMissionData, setCompletedMissionData] = useState(null);
    const hasPlayedGreeting = useRef(false);
    
    const mediaRecorderRef = useRef(null);
    const audioRef = useRef(null);
    const audioChunksRef = useRef([]);
    const scrollRef = useRef(null);
    const recordingTimeoutRef = useRef(null);
    const user = useAuthStore(state => state.user);
    const { currentSceneKey, requestMapJoin } = useGameStore();

    // Normalize NPC data (Handle nested definition if it's an instance)
    const definition = npcData.npc_template?.npc_definition || npcData;
    const npcType = definition.type || npcData.type;
    const npcName = definition.name || npcData.name;

    console.log("[NPCDialogue] DEBUG DATA:", {
        rawType: npcData.type,
        defType: definition.type,
        finalType: npcType,
        npcData
    });

    const selectedMission = availableMissions.find(m => m.id === selectedMissionId);
    const needsTeleport = selectedMission && selectedMission.scene_key && selectedMission.scene_key !== currentSceneKey;

    useEffect(() => {
        console.log("[NPCDialogue] MOUNTED. Props npcData:", npcData);
        
        window.dispatchEvent(new CustomEvent('npc-interaction-start', {
            detail: { templateId: npcData.templateId }
        }));

        const fetchMissions = async () => {
            try {
                console.log("[NPCDialogue] Fetching missions for templateId:", npcData.templateId);
                const res = await api.get(`/missions/npc/${npcData.templateId}`);
                const data = res.data;
                console.log("[NPCDialogue] API Response (data):", data);
                
                // Set custom greeting or default
                const npcGreeting = data.greeting || `Hello ${user?.username || 'traveler'}! How can I help you today?`;
                setMessages([{
                    sender: 'npc',
                    text: npcGreeting,
                    timestamp: new Date()
                }]);

                // AUTO-PLAY: Play the first greeting automatically
                if (autoPlay && !hasPlayedGreeting.current) {
                    hasPlayedGreeting.current = true;
                    console.log("[NPCDialogue] Playing initial greeting audio:", npcGreeting);
                    setTimeout(() => {
                        handleListen(npcGreeting, 'en', false);
                    }, 500);
                }
                
                if (data && data.missions) {
                    setAvailableMissions(data.missions);
                    
                    // Use the type from API if available (source of truth)
                    const finalRoleType = data.npc_type || npcType;
                    console.log("[NPCDialogue] Final Role Type resolved:", finalRoleType);
                    setResolvedType(finalRoleType);

                    // Priority 1: Check NPC type for role-based UI
                    if (finalRoleType === 'merchant') {
                        setHasShop(true);
                        console.log("[NPCDialogue] Merchant type detected, enabling shop");
                    } else {
                        setHasShop(data.is_merchant);
                    }

                    if (data.shop) {
                        setShopData(data.shop);
                    }
                    
                    // AUTO-SELECT MISSION: If there is exactly one mission and NPC is not a Master/Portal,
                    // skip the selection menu and start dialogue immediately.
                    if (data.missions.length === 1 && finalRoleType !== 'quest_master' && finalRoleType !== 'master') {
                        console.log("[NPCDialogue] Auto-selecting single mission:", data.missions[0].id);
                        setSelectedMissionId(data.missions[0].id);
                    }
                    
                    // Also update npcType state if needed for rendering
                    // We can use a local variable or update a state if we had one for it
                } else if (Array.isArray(data)) {
                    console.log("[NPCDialogue] Fallback Array. Setting availableMissions:", data.length);
                    setAvailableMissions(data);
                    if (data.length === 1) setSelectedMissionId(data[0].id);
                }
            } catch (err) {
                console.error("[NPCDialogue] Error fetching NPC missions:", err);
            }
        };

        fetchMissions();

        return () => {
            window.dispatchEvent(new CustomEvent('npc-interaction-end', {
                detail: { templateId: npcData.templateId }
            }));
        };
    }, [user, npcData.templateId]);

    const handleSelectMission = async (mission) => {
        if (loadingMissionId) return;
        setLoadingMissionId(mission.id);
        
        const currentScene = useGameStore.getState().currentMapKey;
        const joinRoom = useGameStore.getState().joinRoom;
        
        // LOGIC: If mission is in a different scene, teleport the player!
        if (mission.scene_key && mission.scene_key !== currentScene && mission.scene_key !== 'lobby') {
            console.log(`[NPCDialogue] Mission is in different scene: ${mission.scene_key}. Teleporting...`);
            
            // Show a simple teleport message before switching
            setMessages(prev => [...prev, {
                sender: 'npc',
                text: `¡Excelente elección! Te enviaré de inmediato a ${mission.scene_key}. ¡Buena suerte en tu aventura!`,
                timestamp: new Date()
            }]);

            // Save the mission in global store so we can show a notice on arrival
            useGameStore.setState({ activeMission: mission });

            // Wait a moment for the player to read the message
            setTimeout(() => {
                window.dispatchEvent(new CustomEvent('lobby-change-map', {
                    detail: { 
                        targetMap: mission.scene_key,
                        targetX: 0,
                        targetY: 0
                    }
                }));
                onClose(); // Close dialogue after triggering teleport
            }, 2000);
            
            return;
        }

        // Normal logic for same-scene missions
        setSelectedMissionId(mission.id);
        setLoadingMissionId(null);
    };

    const stopAudio = () => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            audioRef.current = null;
        }
        if (window.speechSynthesis) {
            window.speechSynthesis.cancel();
        }
        setIsTtsPlaying(false);
    };

    const handleListen = async (text, language = 'en', isManual = false) => {
        if (!text) return;
        console.log(`[NPCDialogue] handleListen triggered (Manual: ${isManual}) for ${language}:`, text);
        
        // If it's a manual click and we are already playing, stop it (Toggle behavior)
        if (isManual && isTtsPlaying) {
            console.log("[NPCDialogue] Manual stop requested");
            stopAudio();
            return;
        }

        // Always stop previous before starting new
        stopAudio();
        setIsTtsPlaying(true);
        
        try {
            let url = lastTtsUrl;
            // If the text is different from last cached TTS, fetch new
            if (!url || text !== messages[messages.length-1]?.text) {
                let npcVoice = NPC_CONFIG.voices[npcData.templateId] || NPC_CONFIG.voices.default;
                
                if (language === 'es') {
                    // Spanish Voices
                    npcVoice = npcData.voiceType === 'female' ? 'es-ES-ElviraNeural' : 'es-ES-AlvaroNeural';
                } else {
                    // English Voices
                    if (npcData.voiceType === 'female') {
                        npcVoice = 'en-US-AriaNeural';
                    } else if (npcData.voiceType === 'male') {
                        npcVoice = 'en-US-GuyNeural';
                    }
                }

                const tts = await generateTTS(text, npcVoice);
                url = tts.audio_url || getTTSAudioUrl(tts.cache_key);
                
                if (url.includes('/audio/')) {
                    url += `?t=${Date.now()}`;
                }
                
                setLastTtsUrl(url);
            }

            const audio = new Audio(url);
            audioRef.current = audio;
            audio.onended = () => setIsTtsPlaying(false);
            audio.onerror = (e) => {
                console.error("Audio playback error:", e);
                if ('speechSynthesis' in window) {
                    const utterance = new SpeechSynthesisUtterance(text);
                    utterance.lang = language === 'es' ? 'es-ES' : 'en-US';
                    utterance.onend = () => setIsTtsPlaying(false);
                    speechSynthesis.speak(utterance);
                } else {
                    setIsTtsPlaying(false);
                }
            };
            audio.play().catch(err => {
                console.error("Audio.play() failed:", err);
                setIsTtsPlaying(false);
            });
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
        
        // Reset TTS for the new turn
        stopAudio();
        setLastTtsUrl(null);

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
                translation: data.npc_response_es,
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
            
            // ONLY ENGLISH AUDIO: As requested, we now only play the English response
            if (data.npc_response && autoPlay) {
                // Short delay to ensure state is settled
                setTimeout(() => {
                    handleListen(data.npc_response, 'en', false);
                }, 300);
            }

            if (data.mission_newly_completed) {
                console.log("[NPCDialogue] Mission Completed detected!", data.mission_details);
                setCompletedMissionData(data.mission_details);
                setIsMissionComplete(true);
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

    const toggleRecording = async () => {
        if (isRecording) {
            // Stop recording
            if (mediaRecorderRef.current) {
                if (recordingTimeoutRef.current) clearTimeout(recordingTimeoutRef.current);
                mediaRecorderRef.current.stop();
                setIsRecording(false);
                mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
            }
        } else {
            // Start recording
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
                        const result = await analyzeDialogueAudio(audioBlob); 
                        handleSend(result.transcription, result.pronunciation_score);
                    } catch (err) { console.error("Audio analysis failed:", err); }
                    finally { setIsProcessing(false); }
                };
                recorder.start();
                setIsRecording(true);
                
                // Enforce maximum recording time of 15 seconds
                recordingTimeoutRef.current = setTimeout(() => {
                    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
                        console.log("Maximum recording time reached (15s). Stopping automatically.");
                        mediaRecorderRef.current.stop();
                        setIsRecording(false);
                        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
                    }
                }, 15000);

            } catch (err) { console.error("Microphone access denied:", err); }
        }
    };

    const lastMessage = messages[messages.length - 1] || { text: '...', sender: 'npc' };
    const isAudioOnly = npcData.interactionMode === 'audio_only';

    const handleAcceptMissionComplete = () => {
        console.log("[NPCDialogue] Accepting mission completion, returning to lobby...");
        window.dispatchEvent(new CustomEvent('lobby-change-map', {
            detail: { 
                targetMap: 'lobby',
                targetX: 0,
                targetY: 0
            }
        }));
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex flex-col justify-end items-center pb-20 pointer-events-none bg-black/20 backdrop-blur-sm">
            {/* Mission Complete Overlay */}
            {isMissionComplete && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md pointer-events-auto p-4 animate-in fade-in duration-500">
                    <div className="relative w-full max-w-2xl bg-[var(--color-parchment)] border-8 border-double border-[var(--color-gold)] p-12 text-center shadow-[0_0_100px_rgba(255,191,0,0.3)] animate-in zoom-in-95 duration-500">
                        {/* Decorative corners */}
                        <div className="absolute -top-4 -left-4 w-12 h-12 border-t-8 border-l-8 border-[var(--color-gold)]"></div>
                        <div className="absolute -top-4 -right-4 w-12 h-12 border-t-8 border-r-8 border-[var(--color-gold)]"></div>
                        <div className="absolute -bottom-4 -left-4 w-12 h-12 border-b-8 border-l-8 border-[var(--color-gold)]"></div>
                        <div className="absolute -bottom-4 -right-4 w-12 h-12 border-b-8 border-r-8 border-[var(--color-gold)]"></div>

                        <div className="mb-8">
                            <ShieldCheck size={80} className="mx-auto text-green-700 mb-4 animate-bounce" />
                            <h2 className="text-5xl font-medieval text-[var(--color-base-dark)] uppercase tracking-widest drop-shadow-md">
                                ¡Misión Completada!
                            </h2>
                            <div className="h-1 w-48 bg-gradient-to-r from-transparent via-[var(--color-gold)] to-transparent mx-auto mt-4"></div>
                        </div>

                        <div className="mb-10 space-y-4">
                            <p className="text-2xl font-serif italic text-gray-700">
                                Has demostrado gran valentía y destreza al completar:
                            </p>
                            <p className="text-3xl font-medieval text-[var(--color-orange-vibrant)] font-black uppercase">
                                {completedMissionData?.title || "La Aventura"}
                            </p>
                        </div>

                        <div className="bg-white/50 border-2 border-[var(--color-gold-dark)]/30 p-6 rounded-lg mb-10 shadow-inner">
                            <h4 className="text-sm font-medieval uppercase tracking-tighter text-gray-500 mb-4">Recompensas Obtenidas</h4>
                            <div className="flex items-center justify-center gap-12">
                                {completedMissionData?.reward_gold > 0 && (
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="w-16 h-16 bg-yellow-400 rounded-full border-4 border-yellow-600 flex items-center justify-center shadow-lg transform hover:scale-110 transition-transform">
                                            <span className="text-2xl font-black text-yellow-900">$</span>
                                        </div>
                                        <span className="font-medieval text-xl font-bold">+{completedMissionData.reward_gold} Oro</span>
                                    </div>
                                )}
                                {completedMissionData?.reward_item_id && (
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="w-16 h-16 bg-blue-100 rounded-lg border-4 border-blue-600 flex items-center justify-center shadow-lg transform hover:scale-110 transition-transform overflow-hidden">
                                            {/* We don't have the item object here directly, so we use a generic icon or the reward name if we had it */}
                                            <ShoppingBag size={32} className="text-blue-700" />
                                        </div>
                                        <span className="font-medieval text-xl font-bold">Objeto Especial</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <button
                            onClick={handleAcceptMissionComplete}
                            className="group relative px-12 py-5 bg-[var(--color-orange-vibrant)] text-white font-medieval text-2xl uppercase tracking-[0.2em] border-4 border-[var(--color-gold)] shadow-[0_10px_0_rgb(180,60,0)] hover:shadow-[0_5px_0_rgb(180,60,0)] hover:translate-y-[5px] active:translate-y-[10px] active:shadow-none transition-all overflow-hidden"
                        >
                            <span className="relative z-10">Reclamar y Volver al Lobby</span>
                            <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500"></div>
                        </button>
                    </div>
                </div>
            )}

            {/* Main Dialogue UI */}
            <div className="relative w-full max-w-5xl px-4 pointer-events-auto">
                
                {/* Close Button (Fixed to viewport) */}
                <button 
                    onClick={onClose} 
                    className="fixed top-6 right-6 z-[100] p-3 bg-[var(--color-orange-vibrant)] text-white border-2 border-[var(--color-gold)] shadow-2xl hover:bg-[var(--color-accent-blue)] transition-colors pointer-events-auto"
                >
                    <X size={24} />
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
                                {npcName}
                            </span>
                        </div>
                    </div>
                    
                    {/* Dialogue Bubble */}
                    <div className="bg-[var(--color-parchment)] border-8 border-double border-[var(--color-gold)] p-10 pb-8 shadow-[0_20px_50px_rgba(0,0,0,0.8)] relative min-h-[220px] max-h-[70vh] flex flex-col overflow-hidden pointer-events-auto">
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

                        {/* Mission Selector / Hub */}
                        {((availableMissions.length > 0 && !selectedMissionId) || (resolvedType || npcType) === 'quest_master') && !selectedMissionId && (
                            <div className="absolute inset-0 z-[100] bg-[var(--color-parchment)]/95 backdrop-blur-sm p-8 flex flex-col items-center justify-start gap-4 text-center overflow-y-auto custom-scrollbar-light">

                                <h3 className="text-3xl font-medieval text-[var(--color-base-dark)] mt-12 mb-4 drop-shadow-sm uppercase tracking-wider">
                                    {(resolvedType || npcType) === 'quest_master' ? 'Tablón de Misiones' : '¿En qué puedo ayudarte hoy?'}
                                </h3>
                                <div className="grid grid-cols-1 gap-4 w-full max-w-xl pb-10">
                                    {/* Empty State for Portals */}
                                    {(resolvedType || npcType) === 'quest_master' && availableMissions.length === 0 && (
                                        <div className="p-10 border-4 border-dashed border-gray-400 bg-gray-100/50 rounded-lg">
                                            <p className="text-xl font-serif text-gray-600">No hay misiones disponibles en este momento.</p>
                                            <p className="text-sm text-gray-400 mt-2 italic">Vuelve más tarde o consulta con otro Maestro de Misiones.</p>
                                        </div>
                                    )}
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
                                                onClick={() => handleSelectMission(m)}
                                                disabled={loadingMissionId !== null}
                                                className={`p-6 border-4 border-double transition-all flex flex-col items-start gap-2 group shadow-xl w-full text-left disabled:opacity-50 disabled:cursor-not-allowed ${
                                                    selectedMissionId === m.id
                                                        ? 'border-[var(--color-orange-vibrant)] bg-orange-100 ring-4 ring-[var(--color-orange-vibrant)]/30'
                                                        : m.status === 'completed' 
                                                            ? 'border-green-800 bg-green-50 hover:bg-green-700 hover:border-green-900 transition-all' 
                                                            : m.status === 'in_progress'
                                                                ? 'border-blue-800 bg-blue-50 hover:bg-blue-700 hover:border-blue-900 transition-all ring-2 ring-blue-500/10'
                                                                : 'border-[var(--color-gold-dark)] bg-white hover:bg-[var(--color-accent-blue)] hover:border-[var(--color-gold)] hover:-translate-y-1'
                                                }`}
                                            >
                                                <div className="flex items-center justify-between w-full">
                                                    <div className="flex items-center gap-3">
                                                        <span className={`font-medieval text-2xl uppercase tracking-tighter transition-colors ${
                                                            selectedMissionId === m.id 
                                                                ? 'text-[var(--color-orange-vibrant)]' 
                                                                : 'text-[var(--color-base-dark)] group-hover:text-white'
                                                        }`}>
                                                            {m.title}
                                                        </span>
                                                        {m.status === 'completed' && (
                                                            <span className="text-[10px] bg-green-800 text-white px-3 py-1 font-bold uppercase tracking-widest border border-green-600 rounded-sm">
                                                                ✓ Completada
                                                            </span>
                                                        )}
                                                        {m.status === 'in_progress' && (
                                                            <span className="text-[10px] bg-blue-700 text-white px-3 py-1 font-bold uppercase tracking-widest border border-blue-500 rounded-sm">
                                                                ↻ En Progreso
                                                            </span>
                                                        )}
                                                        {loadingMissionId === m.id && (
                                                            <span className="flex items-center gap-2 text-[10px] bg-gray-800 text-white px-3 py-1 font-bold uppercase tracking-widest border border-gray-600 rounded-sm animate-pulse">
                                                                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                                                Cargando...
                                                            </span>
                                                        )}
                                                        {(m.status === 'not_started' || !m.status) && (
                                                            <span className="text-[10px] bg-orange-600 text-white px-3 py-1 font-bold uppercase tracking-widest border border-orange-400 rounded-sm">
                                                                ★ Nueva
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <span className={`text-base font-serif leading-snug transition-colors ${
                                                    selectedMissionId === m.id
                                                        ? 'text-[var(--color-base-dark)]'
                                                        : 'text-[var(--color-base-dark)] font-medium group-hover:text-white'
                                                }`}>
                                                    {m.objective || m.current_task_instruction || m.player_instruction || m.description}
                                                </span>
                                                
                                                {m.scene_key && (
                                                    <div className={`flex items-center gap-2 mt-2 text-[11px] font-bold uppercase tracking-widest transition-colors ${
                                                        selectedMissionId === m.id
                                                            ? 'text-[var(--color-orange-vibrant)]'
                                                            : 'text-[var(--color-gold-dark)] group-hover:text-white/90'
                                                    }`}>
                                                        <MapPin size={12} /> Ubicación: {m.scene_key}
                                                    </div>
                                                )}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Speaking Status / Mission Header */}
                        <div className="flex items-center justify-between mb-3 relative z-10">
                            <h4 className="text-[var(--color-accent-blue)] text-[12px] font-medieval uppercase tracking-widest opacity-90 flex items-center gap-2">
                                {selectedMission 
                                    ? <span className="text-[var(--color-orange-vibrant)] flex items-center gap-2 animate-pulse"><Map size={14} /> Misión: {selectedMission.title}</span>
                                    : (lastMessage.sender === 'npc' ? `${npcName} speaks...` : 'You responded:')
                                }
                                {isAudioOnly && lastMessage.sender === 'npc' && (
                                    <span className="bg-[var(--color-orange-vibrant)] text-white px-2 py-0.5 border border-[var(--color-gold)] text-[9px]">
                                        SILENCE REQ.
                                    </span>
                                )}
                            </h4>
                            {selectedMission && (
                                <span className={`text-[9px] px-2 py-0.5 font-bold uppercase tracking-widest border border-current rounded-sm ${
                                    selectedMission.status === 'completed' ? 'text-green-700 border-green-700' : 'text-blue-700 border-blue-700'
                                }`}>
                                    {selectedMission.status === 'completed' ? 'Completada' : 'En Curso'}
                                </span>
                            )}
                        </div>

                        {/* Current Message */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar-light mb-6 flex flex-col gap-4 relative z-10">
                            {/* Mission Objective Helper */}
                            {selectedMission && (
                                <div className="bg-orange-50/50 border-l-4 border-[var(--color-orange-vibrant)] p-3 mb-2 animate-in slide-in-from-top-2 duration-500">
                                    <p className="text-[11px] font-serif uppercase tracking-wider text-[var(--color-orange-vibrant)] font-black mb-1 flex items-center gap-2">
                                        <Compass size={12} /> Tarea Actual
                                    </p>
                                    <p className="text-sm font-serif text-[var(--color-base-dark)] leading-tight italic">
                                        "{selectedMission.current_task_instruction || selectedMission.player_instruction || selectedMission.description}"
                                    </p>
                                </div>
                            )}
                            
                            <div className="flex items-start justify-between gap-6">
                                <div className="flex-1 flex flex-col gap-3">
                                    <p className="text-2xl text-[var(--color-base-dark)] font-medieval leading-tight tracking-tight drop-shadow-sm">
                                        {(lastMessage.sender === 'npc' && isAudioOnly) ? (
                                            <span className="text-[var(--color-accent-blue)] italic opacity-60">Listen closely to the words...</span>
                                        ) : (
                                            lastMessage.text
                                        )}
                                    </p>
                                    {lastMessage.sender === 'npc' && lastMessage.translation && (
                                        <div className="border-t border-[var(--color-gold)]/40 pt-4 mt-2 bg-black/5 px-6 py-3 rounded-lg shadow-inner">
                                            <p className="text-xl text-[#1a1a1a] italic font-serif font-medium leading-relaxed drop-shadow-sm">
                                                {lastMessage.translation}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            {lastMessage.sender === 'npc' && (
                                <div className="flex flex-col gap-2">
                                    <button
                                        onClick={() => handleListen(lastMessage.text, 'en', true)}
                                        disabled={isProcessing || isRecording}
                                        className={`p-4 transition-all duration-300 border-4 border-[var(--color-gold)] shadow-xl ${
                                            isTtsPlaying 
                                                ? 'bg-[var(--color-orange-vibrant)] text-white' 
                                                : 'bg-[var(--color-accent-blue)] text-[var(--color-gold)] hover:bg-[var(--color-base-dark)] active:translate-y-1'
                                        }`}
                                        title={isTtsPlaying ? "Stop audio" : "Hear voice"}
                                    >
                                        <Volume2 size={28} className={isTtsPlaying ? 'animate-pulse' : ''} />
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

                                    {/* Back to Mission Menu Button (Only for Quest Masters) */}
                                    {availableMissions.length > 0 && (resolvedType || npcType) === 'quest_master' && (
                                        <button
                                            onClick={() => {
                                                setSelectedMissionId(null);
                                                setMessages([{
                                                    sender: 'npc',
                                                    text: `¿En qué más puedo ayudarte?`,
                                                    timestamp: new Date()
                                                }]);
                                            }}
                                            className="p-4 bg-gray-800 text-white border-4 border-gray-600 shadow-2xl hover:bg-gray-700 transition-all active:translate-y-1 flex items-center justify-center"
                                            title="Menú de Misiones"
                                        >
                                            <MapPin size={28} />
                                        </button>
                                    )}

                                    {/* Autoplay Toggle */}
                                    <div className="flex items-center gap-2 mt-2 px-2 py-1 bg-white/40 rounded border border-black/10 shadow-sm">
                                        <input 
                                            type="checkbox" 
                                            id="autoplay-toggle"
                                            checked={autoPlay}
                                            onChange={(e) => setAutoPlay(e.target.checked)}
                                            className="w-4 h-4 accent-[var(--color-orange-vibrant)] cursor-pointer"
                                        />
                                        <label htmlFor="autoplay-toggle" className="text-[10px] font-medieval font-bold uppercase tracking-tighter cursor-pointer text-[#1a1a1a]">
                                            Auto-voz
                                        </label>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                        {/* Input Area (Centered within bubble) */}
                        <div className="mt-auto flex items-center gap-4 bg-[var(--color-base-dark)]/10 p-2 pl-6 border-4 border-double border-[var(--color-gold)] relative z-10">
                            <button
                                onClick={toggleRecording}
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
