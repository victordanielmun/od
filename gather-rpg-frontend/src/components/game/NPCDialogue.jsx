import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Mic, MicOff, Send, X, Volume2, MessageSquare, AlertCircle, ChevronRight, ShoppingBag, MapPin, Compass, ShieldCheck, Map, CheckCircle, Loader2, Lock, Crown } from 'lucide-react';
import api from '../../services/api';
import { analyzeDialogueAudio, generateTTS, getTTSAudioUrl } from '../../services/voiceApi';
import ShopModal from '../common/ShopModal';
import { KaraokeOverlay } from './KaraokeOverlay';
import { useAuthStore } from '../../store/authStore';
import { useGameStore } from '../../store/gameStore';
import { ItemIcon } from '../common/ItemIcon';
import { STATE_TO_ANIM, NPC_CONFIG } from '../../game/config/NPCConfig';

// Remove emojis (and leftover variation selectors / regional indicators) from
// text that will be SPOKEN by TTS. The chat bubble keeps the original text with
// emojis; only the voice gets the cleaned version so it doesn't read "smiling
// face" aloud and break the pacing for learners.
const stripEmojisForSpeech = (s) =>
    (s || '')
        .replace(/\p{Extended_Pictographic}/gu, '')
        .replace(/[\u{1F1E6}-\u{1F1FF}]/gu, '') // flag regional indicators
        .replace(/[‍️]/g, '')         // ZWJ + variation selector
        .replace(/\s{2,}/g, ' ')
        .trim();

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

    const SIZES = { large: 400, medium: 220, small: 48 };
    const containerH = SIZES[size] || SIZES.small;
    const scale = containerH / frameInfo.h;
    const atlasW = atlasData.meta.size.w;
    const atlasH = atlasData.meta.size.h;

    const CLASSES = {
        large: "w-[400px] h-[400px] animate-float animate-slide-in-left transition-all duration-700 hover:scale-105 drop-shadow-[0_20px_40px_rgba(0,0,0,0.6)]",
        medium: "w-[220px] h-[220px] animate-float drop-shadow-[0_12px_24px_rgba(0,0,0,0.6)]",
        small: "w-12 h-12 rounded-none border-2 border-[var(--color-gold)] overflow-hidden bg-[var(--color-base-dark)] shadow-inner"
    };

    return (
        <div
            className={CLASSES[size] || CLASSES.small}
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
    const { t } = useTranslation();
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
    const [missionsLoading, setMissionsLoading] = useState(true); // true while the missions API is in flight
    const [autoPlay, setAutoPlay] = useState(true);
    const [isMissionComplete, setIsMissionComplete] = useState(false);
    const [hasPendingCompletion, setHasPendingCompletion] = useState(false);
    const [completedMissionData, setCompletedMissionData] = useState(null);
    const [showAudioTranscript, setShowAudioTranscript] = useState(false);
    const [showTooltip, setShowTooltip] = useState(false);
    const [taskCompletedBanner, setTaskCompletedBanner] = useState(null);
    const [npcTaskDone, setNpcTaskDone] = useState(false); // this NPC's task already completed by the player
    const [showKaraoke, setShowKaraoke] = useState(true); // karaoke overlay visible while its task is current
    const [missionFilter, setMissionFilter] = useState('all');
    const hasPlayedGreeting = useRef(false);
    const taskBannerTimeoutRef = useRef(null);

    const mediaRecorderRef = useRef(null);
    const audioRef = useRef(null);
    // Web Audio playback: a single persistent AudioContext kept alive (via a silent
    // keep-alive source) so the OS audio device never idles between clips. A cold
    // HTMLAudioElement lets the output device sleep during silence and drops the
    // first ~1s when it wakes; a warm AudioContext starts sample-accurate.
    const audioCtxRef = useRef(null);
    const audioSourceRef = useRef(null);
    // Monotonic token: bumped on each new TTS request so async work from a superseded
    // clip (fetch/decode) can bail instead of playing over the newer one.
    const playTokenRef = useRef(0);
    const audioChunksRef = useRef([]);
    const scrollRef = useRef(null);
    const recordingTimeoutRef = useRef(null);
    const user = useAuthStore(state => state.user);
    const { currentSceneKey, requestMapJoin, fetchActiveMission } = useGameStore();

    // Normalize NPC data (Handle nested definition if it's an instance)
    const definition = npcData.npc_template?.npc_definition || npcData;
    const npcType = definition.type || npcData.type || npcData.role;
    const npcName = definition.name || npcData.name;

    // Log debug data once on mount to avoid console clutter
    const hasLoggedDebug = useRef(false);
    useEffect(() => {
        if (!hasLoggedDebug.current && npcData) {
            hasLoggedDebug.current = true;
            console.log("[NPCDialogue] DEBUG DATA:", {
                rawType: npcData.type,
                defType: definition?.type,
                role: npcData.role,
                finalType: npcType,
                npcData
            });
        }
    }, [npcData, definition, npcType]);

    const getTranslation = (msg) => {
        if (!msg) return '';
        if (msg.translation) return msg.translation;
        if (!msg.text) return '';
        const cleanKey = msg.text.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
        const key = `npc.dialogue.custom.${cleanKey}`;
        const translated = t(key);
        if (translated && translated !== key) {
            return translated;
        }
        return '';
    };

    const selectedMission = availableMissions.find(m => m.id === selectedMissionId);
    const needsTeleport = selectedMission && selectedMission.scene_key && selectedMission.scene_key !== currentSceneKey;

    // Karaoke task: when the current task for the selected mission is 'karaoke', we
    // render the dedicated sing-the-lyrics overlay instead of the normal chat.
    const isKaraokeTask = selectedMission?.current_task_type === 'karaoke'
        && Array.isArray(selectedMission?.karaoke_lines)
        && selectedMission.karaoke_lines.length > 0;
    const npcVoice = definition.voice_type || definition.voiceType
        || NPC_CONFIG.voices[npcData.characterId] || NPC_CONFIG.voices[npcData.templateId] || NPC_CONFIG.voices.default;

    const handleKaraokeComplete = (res) => {
        if (!res) return;
        if (res.task_completed || res.mission_newly_completed) {
            fetchActiveMission(currentSceneKey, true);
        }
        if (res.mission_newly_completed) {
            setCompletedMissionData(res.mission_details);
            setHasPendingCompletion(true);
        } else if (res.task_completed) {
            setTaskCompletedBanner({ progress: '' });
            if (taskBannerTimeoutRef.current) clearTimeout(taskBannerTimeoutRef.current);
            taskBannerTimeoutRef.current = setTimeout(() => setTaskCompletedBanner(null), 4500);
        }
    };

    useEffect(() => {
        console.log("[NPCDialogue] MOUNTED. Props npcData:", npcData);
        
        const handleInteractionComplete = () => {
            if (npcData.autoCloseDialogue) {
                onClose();
            }
        };

        // Add auto-close effect
        if (npcData.autoCloseDialogue && !missionsLoading) {
            let timer;
            if (autoPlay) {
                // If autoPlay is on, close after TTS finishes
                if (hasPlayedGreeting.current && !isTtsPlaying) {
                    timer = setTimeout(() => onClose(), 1500);
                }
            } else {
                // If autoPlay is off, just close after a few seconds
                timer = setTimeout(() => onClose(), 3500);
            }
            return () => {
                if (timer) clearTimeout(timer);
            };
        }
    }, [isTtsPlaying, missionsLoading, autoPlay, npcData.autoCloseDialogue, onClose]);

    useEffect(() => {
        window.dispatchEvent(new CustomEvent('npc-interaction-start', {
            detail: { templateId: npcData.templateId }
        }));

        // NOTE: the greeting is set from the API response (fetchMissions), where we know
        // the NPC's real type and its own greeting. We intentionally do NOT show a generic
        // instant greeting here — doing so made every NPC open with the merchant line
        // "How can I help you today?". The "Cargando misiones…" spinner covers the (now
        // fast) fetch instead.

        const fetchMissions = async () => {
            setMissionsLoading(true);
            try {
                console.log("[NPCDialogue] Fetching missions for templateId:", npcData.templateId);
                const res = await api.get(`/missions/npc/${npcData.templateId}${npcData.roomId ? `?room_id=${npcData.roomId}` : ''}`);
                const data = res.data;
                console.log("[NPCDialogue] API Response (data):", data);

                // Whether THIS player already completed this NPC's task (per-player).
                // Used to show a persistent "task done" check when reopening the dialogue.
                setNpcTaskDone(!!data.npc_task_completed);

                // Resolve the real role from the API (source of truth) UP FRONT so the
                // mission board renders immediately for a quest master, instead of
                // waiting behind the greeting and its TTS.
                const finalRoleType = data.npc_type || npcType;
                console.log("[NPCDialogue] Final Role Type resolved:", finalRoleType);
                setResolvedType(finalRoleType);
                const isBoardNpc = finalRoleType === 'quest_master' || finalRoleType === 'master';

                // Greeting + auto-play. Skipped for board NPCs (quest master / portal):
                // their primary UI is the mission board, so a greeting bubble + spoken
                // audio just delayed the missions from showing ("sale primero un diálogo").
                if (!isBoardNpc) {
                    // When the NPC has no custom greeting, the fallback depends on its role:
                    // only merchants get the shopkeeper line ("How can I help you today?");
                    // every other NPC gets a neutral greeting.
                    const defaultKey = finalRoleType === 'merchant' ? 'npc.dialogue.merchant_greeting' : 'npc.dialogue.default_greeting';
                    const npcGreetingEn = data.greeting || t(defaultKey, { lng: 'en', username: user?.username || t('lobby.sidebar.traveler', { lng: 'en' }) });

                    let npcGreetingEs = '';
                    if (!data.greeting) {
                        npcGreetingEs = t(defaultKey, { lng: 'es', username: user?.username || t('lobby.sidebar.traveler', { lng: 'es' }) });
                    } else {
                        const cleanKey = data.greeting.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
                        const key = `npc.dialogue.custom.${cleanKey}`;
                        const translated = t(key);
                        if (translated && translated !== key) {
                            npcGreetingEs = translated;
                        }
                    }

                    setMessages([{
                        sender: 'npc',
                        text: npcGreetingEn,
                        translation: npcGreetingEs,
                        timestamp: new Date()
                    }]);

                    if (autoPlay && !hasPlayedGreeting.current) {
                        hasPlayedGreeting.current = true;
                        console.log("[NPCDialogue] Playing initial greeting audio:", npcGreetingEn);
                        setTimeout(() => {
                            handleListen(npcGreetingEn, 'en', false);
                        }, 500);
                    }
                }

                if (data && data.missions) {
                    setAvailableMissions(data.missions);

                    // Role-based UI (type already resolved above).
                    if (finalRoleType === 'merchant') {
                        setHasShop(true);
                        console.log("[NPCDialogue] Merchant type detected, enabling shop");
                    } else {
                        setHasShop(data.is_merchant);
                    }

                    if (data.shop) {
                        setShopData(data.shop);
                    }

                    // AUTO-SELECT MISSION: exactly one mission and NOT a board NPC →
                    // skip the selection menu and start its dialogue immediately.
                    if (data.missions.length === 1 && !isBoardNpc) {
                        console.log("[NPCDialogue] Auto-selecting single mission:", data.missions[0].id);
                        setSelectedMissionId(data.missions[0].id);
                    }
                } else if (Array.isArray(data)) {
                    console.log("[NPCDialogue] Fallback Array. Setting availableMissions:", data.length);
                    setAvailableMissions(data);
                    if (data.length === 1) setSelectedMissionId(data[0].id);
                }
            } catch (err) {
                console.error("[NPCDialogue] Error fetching NPC missions:", err);
            } finally {
                setMissionsLoading(false);
            }
        };

        fetchMissions();

        return () => {
            stopAudio();
            // Tear down the persistent AudioContext + keep-alive when leaving this NPC.
            if (audioCtxRef.current) {
                try { audioCtxRef.current.close(); } catch (_) {}
                audioCtxRef.current = null;
            }
            if (taskBannerTimeoutRef.current) clearTimeout(taskBannerTimeoutRef.current);
            window.dispatchEvent(new CustomEvent('npc-interaction-end', {
                detail: { templateId: npcData.templateId }
            }));
        };
        // Depend only on the user's stable identity, NOT the whole user object.
        // A conversational purchase syncs gold into authStore.user (new reference);
        // depending on `user` would re-run this effect and reset the conversation
        // back to the greeting mid-flow (wiping the "now say thank you" step).
    }, [user?.id, npcData.templateId]);

    const handleSelectMission = async (mission) => {
        stopAudio();
        if (loadingMissionId) return;

        // Premium gate: a locked mission needs a membership. Point the player to the
        // membership page (new tab so they keep the game session) instead of accepting.
        if (mission.locked) {
            setMessages(prev => [...prev, {
                sender: 'npc',
                text: t('npc.dialogue.premium_locked'),
                timestamp: new Date()
            }]);
            window.open('/membership', '_blank');
            return;
        }

        setLoadingMissionId(mission.id);

        const currentScene = useGameStore.getState().currentMapKey;
        const joinRoom = useGameStore.getState().joinRoom;
        
        // LOGIC: If mission is in a different scene, teleport the player!
        if (mission.scene_key && mission.scene_key !== currentScene && mission.scene_key !== 'lobby') {
            console.log(`[NPCDialogue] Mission is in different scene: ${mission.scene_key}. Teleporting...`);
            
            // Show a simple teleport message before switching
            setMessages(prev => [...prev, {
                sender: 'npc',
                text: t('npc.dialogue.teleport_msg', { scene: mission.scene_key }),
                timestamp: new Date()
            }]);

            // Save the mission in global store so we can show a notice on arrival
            useGameStore.setState({ activeMission: mission });

            // Wait a moment for the player to read the message
            setTimeout(() => {
                window.dispatchEvent(new CustomEvent('lobby-change-map', {
                    detail: { 
                        targetMap: mission.scene_key,
                        targetX: null,
                        targetY: null
                    }
                }));
                onClose(); // Close dialogue after triggering teleport
            }, 2000);
            
            return;
        }

        // Normal logic for same-scene missions: the player is already in this
        // instance, so accept the mission now (binds progress to this room).
        const res = await useGameStore.getState().acceptMission(mission.id);
        if (res && res.premiumRequired) {
            setMessages(prev => [...prev, {
                sender: 'npc',
                text: t('npc.dialogue.premium_locked'),
                timestamp: new Date()
            }]);
            window.open('/membership', '_blank');
            setLoadingMissionId(null);
            return;
        }
        setSelectedMissionId(mission.id);
        setLoadingMissionId(null);
    };

    // Lazily create (and resume) one shared AudioContext, plus a zero-gain silent
    // keep-alive source so the OS output device stays awake between clips. Must be
    // called from a user gesture the first time (dialogue is opened by a click/key,
    // so that's satisfied). Returns null if Web Audio is unavailable.
    const getWarmAudioContext = () => {
        try {
            if (!audioCtxRef.current) {
                const Ctx = window.AudioContext || window.webkitAudioContext;
                if (!Ctx) return null;
                const ctx = new Ctx();
                // Silent keep-alive: a looping near-zero buffer through a muted gain
                // node keeps the audio graph (and the physical device) active, so the
                // next real clip doesn't pay a wake-up delay that eats its first second.
                const gain = ctx.createGain();
                gain.gain.value = 0;
                gain.connect(ctx.destination);
                const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
                const keepAlive = ctx.createBufferSource();
                keepAlive.buffer = buffer;
                keepAlive.loop = true;
                keepAlive.connect(gain);
                keepAlive.start(0);
                audioCtxRef.current = ctx;
            }
            if (audioCtxRef.current.state === 'suspended') {
                audioCtxRef.current.resume().catch(() => {});
            }
            return audioCtxRef.current;
        } catch (_) {
            return null;
        }
    };

    // Stop any Web Audio clip currently playing (the persistent context + keep-alive
    // stay alive so the device doesn't idle).
    const stopWebAudioSource = () => {
        if (audioSourceRef.current) {
            const src = audioSourceRef.current;
            audioSourceRef.current = null;
            try { src.onended = null; } catch (_) {}
            try { src.stop(); } catch (_) {}
            try { src.disconnect(); } catch (_) {}
        }
    };

    const stopAudio = () => {
        stopWebAudioSource();
        if (audioRef.current) {
            const a = audioRef.current;
            a.pause();
            try { a.currentTime = 0; } catch (_) {}
            // Abort any in-flight load and detach handlers so a superseded clip
            // can't fire a late 'canplaythrough' and start ghost playback.
            a.oncanplaythrough = null;
            a.onended = null;
            a.onerror = null;
            a.src = '';
            // Free the in-memory Blob URL for the superseded clip (no-op if streaming).
            if (typeof a._revokeObjectUrl === 'function') a._revokeObjectUrl();
            audioRef.current = null;
        }
        if (window.speechSynthesis) {
            window.speechSynthesis.cancel();
        }
        setIsTtsPlaying(false);
    };

    const handleListen = async (text, language = 'en', isManual = false) => {
        if (!text) return;
        // Voice gets an emoji-free copy; the displayed bubble keeps the original.
        const spokenText = stripEmojisForSpeech(text);
        if (!spokenText) return; // nothing pronounceable (e.g. an emoji-only line)
        const startTtsTotal = performance.now();
        console.log(`\n[Performance] === Frontend: TTS Request Start ===`);
        console.log(`[Performance] Text: "${text}" | Language: ${language} | Manual: ${isManual}`);
        
        // If it's a manual click and we are already playing, stop it (Toggle behavior)
        if (isManual && isTtsPlaying) {
            console.log("[Performance] Frontend: Manual stop requested for active TTS");
            stopAudio();
            return;
        }

        // Always stop previous before starting new
        stopAudio();
        setIsTtsPlaying(true);
        // Claim this playback; any older in-flight request becomes superseded.
        const myToken = ++playTokenRef.current;
        const isSuperseded = () => playTokenRef.current !== myToken;

        try {
            let url = lastTtsUrl;
            // If the text is different from last cached TTS, fetch new
            if (!url || text !== messages[messages.length-1]?.text) {
                let npcVoice = definition.voice_type || definition.voiceType || NPC_CONFIG.voices[npcData.characterId] || NPC_CONFIG.voices[npcData.templateId] || NPC_CONFIG.voices.default;
                
                if (language === 'es') {
                    // Spanish Voices
                    const voiceVal = (definition.voice_type || definition.voiceType || '').toLowerCase();
                    const isFemale = voiceVal === 'female' || voiceVal === 'amy' || voiceVal === 'lessac' || voiceVal === 'kristin' || voiceVal === 'ana' || voiceVal === 'aria' || voiceVal === 'natasha' || voiceVal === 'maisie' || voiceVal === 'jenny' || voiceVal === 'emily' || voiceVal === 'sonia';
                    npcVoice = isFemale ? 'es-ES-ElviraNeural' : 'es-ES-AlvaroNeural';
                }
                // Si es inglés, conservamos la voz asignada en NPC_CONFIG.voices, la cual ya tiene la variedad de modelos.

                const startTtsGeneration = performance.now();
                console.log(`[Performance] Frontend: Sending generateTTS request to Voice Backend (Voice: ${npcVoice})...`);
                const tts = await generateTTS(spokenText, npcVoice);
                const generationDuration = performance.now() - startTtsGeneration;
                console.log(`[Performance] Frontend: generateTTS response received. Took ${generationDuration.toFixed(2)} ms.`);

                url = tts.audio_url || getTTSAudioUrl(tts.cache_key);
                
                if (url.includes('/audio/')) {
                    url += `?t=${Date.now()}`;
                }
                
                setLastTtsUrl(url);
            } else {
                console.log("[Performance] Frontend: Using cached local TTS URL from last turn");
            }

            console.log(`[Performance] Frontend: Fetching TTS clip: ${url}`);
            // Download the whole clip once (bytes reused by both playback paths).
            let arrayBuf = null;
            try {
                const resp = await fetch(url);
                if (!resp.ok) throw new Error(`TTS fetch HTTP ${resp.status}`);
                arrayBuf = await resp.arrayBuffer();
            } catch (fetchErr) {
                console.warn("[Performance] Frontend: TTS prefetch failed:", fetchErr);
            }
            if (isSuperseded()) return; // a newer clip took over while downloading

            // --- Preferred path: Web Audio via the warm, persistent AudioContext ---
            // A cold HTMLAudioElement lets the OS output device sleep during silence and
            // drops the first ~1s on wake. The kept-alive AudioContext stays active, so a
            // decoded AudioBuffer starts sample-accurate with no clipped opening.
            const ctx = getWarmAudioContext();
            if (ctx && arrayBuf) {
                try {
                    // decodeAudioData may detach the ArrayBuffer, so hand it a copy and
                    // keep the original for the HTMLAudio fallback.
                    const decoded = await ctx.decodeAudioData(arrayBuf.slice(0));
                    if (isSuperseded()) return;
                    stopWebAudioSource();
                    const source = ctx.createBufferSource();
                    source.buffer = decoded;
                    source.connect(ctx.destination);
                    source.onended = () => {
                        if (audioSourceRef.current === source) {
                            audioSourceRef.current = null;
                            console.log("[Performance] Frontend: TTS Audio playback finished naturally (WebAudio)");
                            setIsTtsPlaying(false);
                        }
                    };
                    audioSourceRef.current = source;
                    source.start(0);
                    const totalTtsDuration = performance.now() - startTtsTotal;
                    console.log(`[Performance] Frontend: TTS Audio playback started successfully (WebAudio). Total latency: ${totalTtsDuration.toFixed(2)} ms\n`);
                    return;
                } catch (decodeErr) {
                    console.warn("[Performance] Frontend: WebAudio decode failed, falling back to HTMLAudio:", decodeErr);
                }
            }

            // --- Fallback path: HTMLAudioElement from a fully-buffered Blob URL ---
            const audio = new Audio();
            audio.preload = 'auto';
            audioRef.current = audio;

            let objectUrl = null;
            try {
                const blob = arrayBuf ? new Blob([arrayBuf]) : await (await fetch(url)).blob();
                if (audioRef.current !== audio) return;
                objectUrl = URL.createObjectURL(blob);
            } catch (blobErr) {
                console.warn("[Performance] Frontend: Blob build failed, streaming direct URL:", blobErr);
                objectUrl = null;
            }
            const playbackUrl = objectUrl || url;
            const revokeObjectUrl = () => {
                if (objectUrl) {
                    URL.revokeObjectURL(objectUrl);
                    objectUrl = null;
                }
            };
            audio._revokeObjectUrl = revokeObjectUrl;

            audio.onended = () => {
                console.log("[Performance] Frontend: TTS Audio playback finished naturally");
                revokeObjectUrl();
                setIsTtsPlaying(false);
            };

            audio.onerror = (e) => {
                revokeObjectUrl();
                console.error("[Performance] Frontend: Audio element playback error, falling back to Web Speech API:", e);
                if ('speechSynthesis' in window) {
                    const utterance = new SpeechSynthesisUtterance(spokenText);
                    utterance.lang = language === 'es' ? 'es-ES' : 'en-US';
                    utterance.onend = () => {
                        console.log("[Performance] Frontend: Web Speech API playback complete");
                        setIsTtsPlaying(false);
                    };
                    speechSynthesis.speak(utterance);
                } else {
                    setIsTtsPlaying(false);
                }
            };

            let started = false;
            const startPlayback = () => {
                // Bail if already started or this clip was superseded by a newer one.
                if (started || audioRef.current !== audio) return;
                started = true;
                try { audio.currentTime = 0; } catch (_) {}
                audio.play().then(() => {
                    const totalTtsDuration = performance.now() - startTtsTotal;
                    console.log(`[Performance] Frontend: TTS Audio playback started successfully. Total latency: ${totalTtsDuration.toFixed(2)} ms\n`);
                }).catch(err => {
                    console.error("[Performance] Frontend: Audio.play() failed:", err);
                    setIsTtsPlaying(false);
                });
            };
            audio.addEventListener('canplaythrough', startPlayback, { once: true });
            // Safety net: if 'canplaythrough' is slow/never fires, start anyway after a
            // short wait (the guard prevents double playback).
            setTimeout(startPlayback, 2500);

            audio.src = playbackUrl;
            audio.load();
        } catch (err) {
            console.error("[Performance] Frontend: TTS setup failed:", err);
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

        const startDialogueRequest = performance.now();
        console.log(`\n[Performance] === Frontend: Sending Dialogue Request to Go Backend ===`);
        console.log(`[Performance] Input: "${text}" | Expected score: ${score}`);

        try {
            const response = await api.post('/npc/dialogue', {
                npc_template_id: npcData.templateId,
                room_id: npcData.roomId,
                player_input: text,
                pronunciation_score: score,
                mission_id: selectedMissionId
            });

            const data = response.data;
            const dialogueDuration = performance.now() - startDialogueRequest;
            console.log(`[Performance] Frontend: Go Backend response received. Took ${dialogueDuration.toFixed(2)} ms. Response: "${data.npc_response}"`);

            if (data.task_completed || data.mission_newly_completed) {
                console.log("[NPCDialogue] Task or Mission completed! Refreshing active mission...");
                fetchActiveMission(currentSceneKey, true);
            }

            // Visual confirmation that the current task was completed (distinct from the
            // full-mission overlay, which only fires on mission_newly_completed). Without
            // this the player only sees the NPC's final line with no explicit "task done".
            if (data.task_completed) {
                setTaskCompletedBanner({ progress: data.task_progress || '' });
                if (taskBannerTimeoutRef.current) clearTimeout(taskBannerTimeoutRef.current);
                taskBannerTimeoutRef.current = setTimeout(() => setTaskCompletedBanner(null), 4500);
            }

            setMessages(prev => [...prev, {
                sender: 'npc',
                text: data.npc_response,
                translation: data.npc_response_native ?? data.npc_response_es,
                timestamp: new Date(),
                eval: data.pronunciation_eval,
                taskCompleted: data.task_completed && !data.mission_newly_completed
            }]);
            
            setNpcState(data.npc_state || 'idle');

            if (data.item_gift) {
                setGiftInfo({
                    item: data.item_gift,
                    quantity: data.gift_quantity || 1
                });
                // A conversational purchase/gift changed gold and inventory on the
                // server; resync the wallet so the shop header and HUD stay correct.
                useGameStore.getState().fetchPlayerStats();
                useGameStore.getState().fetchInventory();
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
                // DELAYED: We don't show the overlay yet so the user can read the NPC's final words
                setHasPendingCompletion(true);
            }

            if (data.is_shop) {
                 setHasShop(true);
            }
        } catch (err) {
            const dialogueDuration = performance.now() - startDialogueRequest;
            console.error(`[Performance] Frontend: Dialogue request failed after ${dialogueDuration.toFixed(2)} ms:`, err);
        } finally {
            setIsProcessing(false);
        }
    };

    const toggleRecording = async () => {
        if (isRecording) {
            // Stop recording
            if (mediaRecorderRef.current) {
                if (recordingTimeoutRef.current) clearTimeout(recordingTimeoutRef.current);
                console.log("\n[Performance] === Frontend: User Stopped Recording ===");
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
                    const startAnalysis = performance.now();
                    console.log("[Performance] Frontend: Starting audio analysis request...");
                    try {
                        const result = await analyzeDialogueAudio(audioBlob); 
                        const analysisDuration = performance.now() - startAnalysis;
                        console.log(`[Performance] Frontend: Audio analysis complete. Took ${analysisDuration.toFixed(2)} ms. Transcription: "${result.transcription}"`);
                        handleSend(result.transcription, result.pronunciation_score);
                    } catch (err) { 
                        const analysisDuration = performance.now() - startAnalysis;
                        console.error(`[Performance] Frontend: Audio analysis failed after ${analysisDuration.toFixed(2)} ms:`, err); 
                    }
                    finally { setIsProcessing(false); }
                };
                recorder.start();
                setIsRecording(true);
                
                // Enforce maximum recording time of 15 seconds
                recordingTimeoutRef.current = setTimeout(() => {
                    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
                        console.log("[Performance] Frontend: Maximum recording time reached (15s). Stopping automatically.");
                        mediaRecorderRef.current.stop();
                        setIsRecording(false);
                        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
                    }
                }, 15000);

            } catch (err) { console.error("Microphone access denied:", err); }
        }
    };

    const lastMessage = messages[messages.length - 1] || { text: '...', sender: 'npc' };
    const interactionMode = npcData.interactionMode || npcData.interaction_mode || definition?.interaction_mode || definition?.interactionMode || 'hybrid';
    // Merchants are always hybrid (voice OR text): forcing audio_only would block
    // buying for players without a working mic. Any NPC with a shop allows typing.
    const isAudioOnly = interactionMode === 'audio_only' && !hasShop;

    const handleClose = () => {
        if (hasPendingCompletion) {
            setIsMissionComplete(true);
            setHasPendingCompletion(false);
        } else {
            onClose();
        }
    };

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
        <div className="fixed inset-0 z-50 flex flex-col justify-end items-center pb-4 lg:pb-20 pointer-events-none bg-black/20 backdrop-blur-sm">
            {/* Karaoke Overlay — replaces the chat while a karaoke task is current */}
            {isKaraokeTask && showKaraoke && !isMissionComplete && (
                <KaraokeOverlay
                    lines={selectedMission.karaoke_lines}
                    missionId={selectedMissionId}
                    taskId={selectedMission.current_task_id}
                    roomId={npcData.roomId}
                    minScore={selectedMission.pronunciation_min_score || 80}
                    npcName={npcName}
                    npcVoice={npcVoice}
                    onComplete={handleKaraokeComplete}
                    onClose={() => { setShowKaraoke(false); handleClose(); }}
                />
            )}

            {/* Mission Complete Overlay */}
            {isMissionComplete && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md pointer-events-auto p-4 animate-in fade-in duration-500">
                    <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-[var(--color-parchment)] border-4 lg:border-8 border-double border-[var(--color-gold)] p-6 lg:p-12 text-center shadow-[0_0_100px_rgba(255,191,0,0.3)] animate-in zoom-in-95 duration-500">
                        {/* Decorative corners */}
                        <div className="absolute -top-4 -left-4 w-12 h-12 border-t-8 border-l-8 border-[var(--color-gold)]"></div>
                        <div className="absolute -top-4 -right-4 w-12 h-12 border-t-8 border-r-8 border-[var(--color-gold)]"></div>
                        <div className="absolute -bottom-4 -left-4 w-12 h-12 border-b-8 border-l-8 border-[var(--color-gold)]"></div>
                        <div className="absolute -bottom-4 -right-4 w-12 h-12 border-b-8 border-r-8 border-[var(--color-gold)]"></div>

                        <div className="mb-8">
                            <ShieldCheck size={60} className="mx-auto text-green-700 mb-4 animate-bounce" />
                            <h2 className="text-3xl lg:text-5xl font-medieval text-[var(--color-base-dark)] uppercase tracking-widest drop-shadow-md">
                                {t('npc.dialogue.mission_completed')}
                            </h2>
                            <div className="h-1 w-48 bg-gradient-to-r from-transparent via-[var(--color-gold)] to-transparent mx-auto mt-4"></div>
                        </div>

                        <div className="mb-6 lg:mb-10 space-y-4">
                            <p className="text-lg lg:text-2xl font-serif italic text-gray-700">
                                {t('npc.dialogue.mission_completed_desc')}
                            </p>
                            <p className="text-2xl lg:text-3xl font-medieval text-[var(--color-orange-vibrant)] font-black uppercase">
                                {completedMissionData?.title || t('lobby.mission.mysterious_adventure')}
                            </p>
                        </div>

                        <div className="bg-white/50 border-2 border-[var(--color-gold-dark)]/30 p-4 lg:p-6 rounded-lg mb-6 lg:mb-10 shadow-inner">
                            <h4 className="text-sm font-medieval uppercase tracking-tighter text-gray-500 mb-4">{t('npc.dialogue.rewards_obtained')}</h4>
                            <div className="flex items-center justify-center flex-wrap gap-6 lg:gap-12">
                                {completedMissionData?.reward_gold > 0 && (
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="w-16 h-16 bg-yellow-400 rounded-full border-4 border-yellow-600 flex items-center justify-center shadow-lg transform hover:scale-110 transition-transform">
                                            <span className="text-2xl font-black text-yellow-900">$</span>
                                        </div>
                                        <span className="font-medieval text-xl font-bold">+{completedMissionData.reward_gold} {t('npc.dialogue.gold')}</span>
                                    </div>
                                )}
                                {completedMissionData?.reward_xp > 0 && (
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="w-16 h-16 bg-purple-100 rounded-full border-4 border-purple-600 flex items-center justify-center shadow-lg transform hover:scale-110 transition-transform">
                                            <span className="text-2xl font-black text-purple-900">XP</span>
                                        </div>
                                        <span className="font-medieval text-xl font-bold">+{completedMissionData.reward_xp} XP</span>
                                    </div>
                                )}
                                {completedMissionData?.reward_item_id && (
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="w-16 h-16 bg-blue-100 rounded-lg border-4 border-blue-600 flex items-center justify-center shadow-lg transform hover:scale-110 transition-transform overflow-hidden">
                                            {/* We don't have the item object here directly, so we use a generic icon or the reward name if we had it */}
                                            <ShoppingBag size={32} className="text-blue-700" />
                                        </div>
                                        <span className="font-medieval text-xl font-bold">{t('npc.dialogue.special_item')}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <button
                            onClick={handleAcceptMissionComplete}
                            className="group relative px-6 py-4 lg:px-12 lg:py-5 bg-[var(--color-orange-vibrant)] text-white font-medieval text-lg lg:text-2xl uppercase tracking-[0.2em] border-4 border-[var(--color-gold)] shadow-[0_10px_0_rgb(180,60,0)] hover:shadow-[0_5px_0_rgb(180,60,0)] hover:translate-y-[5px] active:translate-y-[10px] active:shadow-none transition-all overflow-hidden"
                        >
                            <span className="relative z-10">{t('npc.dialogue.claim_and_lobby')}</span>
                            <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500"></div>
                        </button>
                    </div>
                </div>
            )}

            {/* Close Button — rendered as a direct child of the root so it lives in the
                top-level stacking context and is never trapped behind the dialogue bubble /
                mission hub (which sit in a nested z-10 context). z-[210] keeps it above
                everything (incl. the Mission Complete overlay at z-200) so there is ALWAYS
                a visible way back to the map, regardless of dialogue/mission state. */}
            <button
                onClick={handleClose}
                className="fixed top-3 right-3 lg:top-6 lg:right-6 z-[210] p-3 bg-[var(--color-orange-vibrant)] text-white border-2 border-[var(--color-gold)] shadow-2xl hover:bg-[var(--color-accent-blue)] transition-colors pointer-events-auto"
            >
                <X size={24} />
            </button>

            {/* Main Dialogue UI */}
            <div className="relative w-full max-w-5xl px-4 pointer-events-auto">

                {/* NPC Portrait (Izquierda) — lado a lado desde md; escalado en md para
                    dejar espacio al globo, tamaño completo en lg+. En móvil (<md) se
                    muestra una versión mediana sobre el globo. */}
                <div className="hidden md:block absolute left-[-40px] bottom-[-40px] z-20 pointer-events-none drop-shadow-2xl md:scale-75 lg:scale-100 origin-bottom-left">
                    <NPCPortrait npcId={npcData.characterId || npcData.templateId} state={npcState} size="large" />
                </div>

                {/* Dialogue Area (Derecha) */}
                <div className="ml-0 md:ml-[260px] lg:ml-[360px] relative z-10">

                    {/* Mobile NPC Portrait — ocupa el espacio libre sobre el globo */}
                    <div className="md:hidden flex justify-start ml-1 mb-[-30px] relative z-20 pointer-events-none">
                        <NPCPortrait npcId={npcData.characterId || npcData.templateId} state={npcState} size="medium" />
                    </div>

                    {/* Name Tag (Parallelogram) */}
                    <div className="relative inline-block ml-2 md:ml-8 lg:ml-12 mb-[-6px] z-30">
                        <div className="bg-[var(--color-orange-vibrant)] text-white px-4 py-2 lg:px-12 lg:py-3 border-4 border-[var(--color-gold)] shadow-[0_8px_16px_rgba(0,0,0,0.5)] relative">
                            <div className="absolute -left-2 -top-2 w-4 h-4 bg-[var(--color-gold)] rotate-45 border border-[var(--color-gold-dark)]"></div>
                            <div className="absolute -right-2 -top-2 w-4 h-4 bg-[var(--color-gold)] rotate-45 border border-[var(--color-gold-dark)]"></div>
                            <span className="block font-medieval text-lg lg:text-2xl tracking-wider lg:tracking-widest uppercase drop-shadow-[2px_2px_0_rgba(0,0,0,0.5)]">
                                {npcName}
                            </span>
                        </div>
                    </div>
                    
                    {/* Dialogue Bubble */}
                    <div className="bg-[var(--color-parchment)] border-4 lg:border-8 border-double border-[var(--color-gold)] p-4 pb-4 lg:p-10 lg:pb-8 shadow-[0_20px_50px_rgba(0,0,0,0.8)] relative min-h-[220px] max-h-[75vh] lg:max-h-[70vh] flex flex-col overflow-hidden pointer-events-auto">
                        {/* Parchment Texture */}
                        <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/parchment.png")' }}></div>
                        
                        {/* Pronunciation Badge (Top Right) */}
                        {lastMessage.sender === 'npc' && lastMessage.eval && (
                            <div className="absolute top-2 right-2 lg:top-6 lg:right-10 flex items-center gap-2 px-3 lg:px-4 py-1.5 bg-[var(--color-base-dark)] text-[var(--color-gold)] border-2 border-[var(--color-gold)] text-[10px] lg:text-[11px] font-medieval uppercase tracking-widest shadow-lg z-20">
                                <AlertCircle size={12} className="text-[var(--color-gold)]" />
                                {lastMessage.eval}
                            </div>
                        )}

                        {giftInfo && (
                            <div className="fixed top-24 left-1/2 -translate-x-1/2 flex items-center gap-4 px-6 py-3 bg-gradient-to-r from-yellow-700 to-yellow-500 text-black border-4 border-yellow-900 shadow-2xl animate-bounce z-[300] font-medieval uppercase pointer-events-none">
                                <ItemIcon iconKey={giftInfo.item.icon_key} type={giftInfo.item.item_type} size={32} className="pixelated" />
                                <span className="font-black italic text-sm">{t('npc.dialogue.purchased', { quantity: giftInfo.quantity, name: giftInfo.item.name })}</span>
                            </div>
                        )}

                        {/* Mission Selector / Hub */}
                        {((availableMissions.length > 0 && !selectedMissionId) || (resolvedType || npcType) === 'quest_master') && !selectedMissionId && (
                            <div className="absolute inset-0 z-[100] bg-[var(--color-parchment)]/95 backdrop-blur-sm p-4 lg:p-8 flex flex-col items-center justify-start gap-4 text-center overflow-y-auto custom-scrollbar-light">

                                <h3 className="text-xl lg:text-3xl font-medieval text-[var(--color-base-dark)] mt-6 lg:mt-12 mb-4 drop-shadow-sm uppercase tracking-wider">
                                    {(resolvedType || npcType) === 'quest_master' ? t('npc.dialogue.mission_board') : t('npc.dialogue.how_can_i_help')}
                                </h3>
                                <div className="grid grid-cols-1 gap-4 w-full max-w-xl pb-10">
                                    {/* Loading state: board is shown instantly from the NPC type, but the
                                        missions list is still being fetched — show a spinner, not "no missions". */}
                                    {(resolvedType || npcType) === 'quest_master' && availableMissions.length === 0 && missionsLoading && (
                                        <div className="p-10 border-4 border-dashed border-gray-400 bg-gray-100/50 rounded-lg flex flex-col items-center gap-3">
                                            <Loader2 className="animate-spin text-gray-500" size={32} />
                                            <p className="text-lg font-serif text-gray-600">{t('npc.dialogue.loading_missions')}</p>
                                        </div>
                                    )}
                                    {/* Empty State for Portals (only once the fetch has finished). */}
                                    {(resolvedType || npcType) === 'quest_master' && availableMissions.length === 0 && !missionsLoading && (
                                        <div className="p-10 border-4 border-dashed border-gray-400 bg-gray-100/50 rounded-lg">
                                            <p className="text-xl font-serif text-gray-600">{t('npc.dialogue.no_missions')}</p>
                                            <p className="text-sm text-gray-400 mt-2 italic">{t('npc.dialogue.no_missions_desc')}</p>
                                        </div>
                                    )}
                                    {/* Merchant Option */}
                                    {hasShop && (
                                        <button 
                                            onClick={() => setIsShopOpen(true)}
                                            className="p-4 lg:p-6 border-4 border-double border-yellow-700 bg-yellow-50 hover:bg-yellow-600 hover:text-white transition-all flex items-center justify-between group shadow-xl -translate-y-1"
                                        >
                                            <div className="flex flex-col items-start">
                                                <span className="font-medieval text-lg lg:text-2xl uppercase tracking-widest text-[#8b0000] group-hover:text-white">{t('npc.dialogue.view_goods')}</span>
                                                <span className="text-sm opacity-80 font-serif">{t('npc.dialogue.view_goods_desc')}</span>
                                            </div>
                                            <ShoppingBag size={40} className="text-yellow-700 group-hover:text-white" />
                                        </button>
                                    )}

                                    {/* Missions Filter */}
                                    {(resolvedType || npcType) === 'quest_master' && availableMissions.length > 0 && (
                                        <div className="flex justify-end w-full mb-2">
                                            <select
                                                value={missionFilter}
                                                onChange={(e) => setMissionFilter(e.target.value)}
                                                className="p-2 border-2 border-[var(--color-gold)] bg-[var(--color-parchment)] font-medieval text-[var(--color-base-dark)] shadow-md focus:outline-none focus:ring-2 focus:ring-[var(--color-orange-vibrant)] cursor-pointer"
                                            >
                                                <option value="all">{t('npc.dialogue.filter_all', { defaultValue: 'Todas' })}</option>
                                                <option value="uncompleted">{t('npc.dialogue.filter_uncompleted', { defaultValue: 'No realizadas' })}</option>
                                                <option value="npc">NPC</option>
                                                <option value="item">{t('npc.dialogue.filter_item', { defaultValue: 'Búsqueda de Item' })}</option>
                                                <option value="karaoke">Karaoke</option>
                                                <option value="combat">{t('npc.dialogue.filter_combat', { defaultValue: 'Combate' })}</option>
                                            </select>
                                        </div>
                                    )}

                                    {/* Missions List */}
                                    {availableMissions.filter(m => {
                                        if (missionFilter === 'all') return true;
                                        if (missionFilter === 'uncompleted') return m.status !== 'completed';
                                        
                                        const mType = m.mission_type || m.type;
                                        const tType = m.current_task_type;
                                        
                                        const isNpc = ['talk_to_npc', 'deliver_message'].includes(tType) || ['talk_to_npc', 'deliver_message'].includes(mType);
                                        const isItem = ['find_item', 'bring_item', 'collect_items', 'find_items'].includes(tType) || ['find_item', 'bring_item', 'collect_items', 'find_items'].includes(mType);
                                        const isKaraoke = tType === 'karaoke' || mType === 'karaoke';
                                        const isCombat = ['defeat_enemy', 'kill_boss', 'kill_all'].includes(tType) || ['defeat_enemy', 'kill_boss', 'kill_all'].includes(mType);

                                        if (missionFilter === 'npc') return isNpc;
                                        if (missionFilter === 'item') return isItem;
                                        if (missionFilter === 'karaoke') return isKaraoke;
                                        if (missionFilter === 'combat') return isCombat;
                                        
                                        return true;
                                    }).map(m => (
                                        <div key={m.id} className="flex flex-col gap-1">
                                            <button 
                                                onClick={() => handleSelectMission(m)}
                                                disabled={loadingMissionId !== null}
                                                className={`p-4 lg:p-6 border-4 border-double transition-all flex flex-col items-start gap-2 group shadow-xl w-full text-left disabled:opacity-50 disabled:cursor-not-allowed ${
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
                                                    <div className="flex items-center gap-2 lg:gap-3 flex-wrap">
                                                        <span className={`font-medieval text-lg lg:text-2xl uppercase tracking-tighter transition-colors ${
                                                            selectedMissionId === m.id 
                                                                ? 'text-[var(--color-orange-vibrant)]' 
                                                                : 'text-[var(--color-base-dark)] group-hover:text-white'
                                                        }`}>
                                                            {m.title}
                                                        </span>
                                                        {m.status === 'completed' && (
                                                            <span className="text-[10px] bg-green-800 text-white px-3 py-1 font-bold uppercase tracking-widest border border-green-600 rounded-sm">
                                                                {t('npc.dialogue.status_completed')}
                                                            </span>
                                                        )}
                                                        {m.status === 'in_progress' && (
                                                            <span className="text-[10px] bg-blue-700 text-white px-3 py-1 font-bold uppercase tracking-widest border border-blue-500 rounded-sm">
                                                                {t('npc.dialogue.status_in_progress')}
                                                            </span>
                                                        )}
                                                        {m.is_premium && (
                                                            <span className={`flex items-center gap-1 text-[10px] px-3 py-1 font-bold uppercase tracking-widest border rounded-sm ${
                                                                m.locked
                                                                    ? 'bg-amber-100 text-amber-800 border-amber-500'
                                                                    : 'bg-amber-500 text-white border-amber-600'
                                                            }`}>
                                                                {m.locked ? <Lock size={11} /> : <Crown size={11} />}
                                                                {t('npc.dialogue.premium_badge')}
                                                            </span>
                                                        )}
                                                        {loadingMissionId === m.id && (
                                                            <span className="flex items-center gap-2 text-[10px] bg-gray-800 text-white px-3 py-1 font-bold uppercase tracking-widest border border-gray-600 rounded-sm animate-pulse">
                                                                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                                                {t('npc.dialogue.loading')}
                                                            </span>
                                                        )}
                                                        {(m.status === 'not_started' || !m.status) && (
                                                            <span className="text-[10px] bg-orange-600 text-white px-3 py-1 font-bold uppercase tracking-widest border border-orange-400 rounded-sm">
                                                                {t('npc.dialogue.status_new')}
                                                            </span>
                                                        )}
                                                        {m.difficulty && (
                                                            <span className={`text-[10px] px-3 py-1 font-bold uppercase tracking-widest border rounded-sm ${
                                                                m.difficulty === 'advanced'
                                                                    ? 'bg-red-700 text-white border-red-500'
                                                                    : m.difficulty === 'intermediate'
                                                                        ? 'bg-amber-600 text-white border-amber-400'
                                                                        : 'bg-emerald-700 text-white border-emerald-500'
                                                            }`}>
                                                                {t(`npc.dialogue.difficulty_${m.difficulty}`)}
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
                                                        <MapPin size={12} /> {t('npc.dialogue.location', { scene: m.scene_key })}
                                                    </div>
                                                )}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Speaking Status / Mission Header */}
                        <div className="flex items-center justify-between gap-2 mb-3 relative z-10">
                            <h4 className="text-[var(--color-accent-blue)] text-[11px] lg:text-[12px] font-medieval uppercase tracking-widest opacity-90 flex items-center gap-2 flex-wrap min-w-0">
                                {selectedMission 
                                    ? <span className="text-[var(--color-orange-vibrant)] flex items-center gap-2 animate-pulse"><Map size={14} /> {t('lobby.challenge.title')}: {selectedMission.title}</span>
                                    : (lastMessage.sender === 'npc' ? t('npc.dialogue.speaks', { name: npcName }) : t('npc.dialogue.you_responded'))
                                }
                                {isAudioOnly && lastMessage.sender === 'npc' && (
                                    <span className="bg-[var(--color-orange-vibrant)] text-white px-2 py-0.5 border border-[var(--color-gold)] text-[9px]">
                                        {t('npc.dialogue.silence_req')}
                                    </span>
                                )}
                            </h4>
                            {selectedMission && (
                                <span className={`text-[9px] px-2 py-0.5 font-bold uppercase tracking-widest border border-current rounded-sm ${
                                    selectedMission.status === 'completed' ? 'text-green-700 border-green-700' : 'text-blue-700 border-blue-700'
                                }`}>
                                    {selectedMission.status === 'completed' ? t('npc.dialogue.completed') : t('npc.dialogue.in_progress')}
                                </span>
                            )}
                        </div>

                        {/* Current Message */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar-light mb-6 flex flex-col gap-4 relative z-10">
                            {/* Mission Objective Helper — green confirmation when done, orange task nudge otherwise */}
                            {selectedMission && (
                                selectedMission.status === 'completed' ? (
                                    <div className="bg-green-50 border-l-4 border-green-700 p-3 mb-2 animate-in slide-in-from-top-2 duration-500">
                                        <p className="text-[11px] font-serif uppercase tracking-wider text-green-700 font-black mb-1 flex items-center gap-2">
                                            <CheckCircle size={12} /> {t('npc.dialogue.completed')}
                                        </p>
                                        <p className="text-sm font-serif text-[var(--color-base-dark)] leading-tight italic">
                                            "{selectedMission.objective || selectedMission.description}"
                                        </p>
                                    </div>
                                ) : (
                                    <div className="bg-orange-50/50 border-l-4 border-[var(--color-orange-vibrant)] p-3 mb-2 animate-in slide-in-from-top-2 duration-500">
                                        <p className="text-[11px] font-serif uppercase tracking-wider text-[var(--color-orange-vibrant)] font-black mb-1 flex items-center gap-2">
                                            <Compass size={12} /> {t('npc.dialogue.current_task')}
                                        </p>
                                        <p className="text-sm font-serif text-[var(--color-base-dark)] leading-tight italic">
                                            "{selectedMission.current_task_instruction || selectedMission.player_instruction || selectedMission.description}"
                                        </p>
                                    </div>
                                )
                            )}
                            
                            {/* "Thinking" indicator while the backend prepares the NPC reply */}
                            {isProcessing && (
                                <div className="flex items-center gap-3 text-[var(--color-accent-blue)] animate-in fade-in duration-300">
                                    <Loader2 size={22} className="animate-spin" />
                                    <span className="text-lg font-serif italic">{t('npc.dialogue.thinking')}</span>
                                    <span className="flex gap-1 ml-1">
                                        <span className="w-2 h-2 rounded-full bg-[var(--color-accent-blue)] animate-bounce [animation-delay:-0.3s]"></span>
                                        <span className="w-2 h-2 rounded-full bg-[var(--color-accent-blue)] animate-bounce [animation-delay:-0.15s]"></span>
                                        <span className="w-2 h-2 rounded-full bg-[var(--color-accent-blue)] animate-bounce"></span>
                                    </span>
                                </div>
                            )}

                            {/* "Loading missions" indicator: shown while the greeting plays and the
                                (often slow, remote-DB) missions fetch is still in flight. */}
                            {missionsLoading && !isProcessing && !isKaraokeTask && (
                                <div className="flex items-center gap-3 text-[var(--color-accent-blue)]/80 animate-in fade-in duration-300">
                                    <Loader2 size={18} className="animate-spin" />
                                    <span className="text-base font-serif italic">{t('npc.dialogue.loading_missions')}</span>
                                </div>
                            )}

                            <div className="flex items-start justify-between gap-3 lg:gap-6">
                                <div className="flex-1 min-w-0 flex flex-col gap-3">
                                    <p className="text-lg lg:text-2xl text-[var(--color-base-dark)] font-medieval leading-tight tracking-tight drop-shadow-sm">
                                        {(lastMessage.sender === 'npc' && isAudioOnly && !showAudioTranscript) ? (
                                            <span className="text-[var(--color-accent-blue)] italic opacity-60">{t('npc.dialogue.listen_closely')}</span>
                                        ) : (
                                            lastMessage.text
                                        )}
                                    </p>
                                    {lastMessage.sender === 'npc' && getTranslation(lastMessage) && (!isAudioOnly || showAudioTranscript) && (
                                        <p className="text-base lg:text-xl text-gray-700 italic font-serif leading-relaxed mt-2 border-t border-[var(--color-gold)]/20 pt-2">
                                            {getTranslation(lastMessage)}
                                        </p>
                                    )}
                                    {lastMessage.sender === 'npc' && (lastMessage.taskCompleted || npcTaskDone) && (
                                        <div className="flex items-center gap-2 mt-3 px-3 py-1.5 self-start bg-green-100 border-2 border-green-700 text-green-800 font-medieval uppercase text-sm tracking-wider shadow-sm animate-in fade-in duration-500">
                                            <CheckCircle size={18} className="text-green-700" /> {t('npc.dialogue.task_done_check')}
                                        </div>
                                    )}
                                </div>
                            {lastMessage.sender === 'npc' && (
                                <div className="flex flex-col gap-2 shrink-0">
                                    <button
                                        onClick={() => handleListen(lastMessage.text, 'en', true)}
                                        disabled={isProcessing || isRecording}
                                        className={`p-2.5 lg:p-4 transition-all duration-300 border-4 border-[var(--color-gold)] shadow-xl ${
                                            isTtsPlaying 
                                                ? 'bg-[var(--color-orange-vibrant)] text-white' 
                                                : 'bg-[var(--color-accent-blue)] text-[var(--color-gold)] hover:bg-[var(--color-base-dark)] active:translate-y-1'
                                        }`}
                                        title={isTtsPlaying ? "Stop audio" : "Hear voice"}
                                    >
                                        <Volume2 size={22} className={isTtsPlaying ? 'animate-pulse' : ''} />
                                    </button>
                                    
                                    {hasShop && (
                                        <button
                                            onClick={() => setIsShopOpen(true)}
                                            className="p-2.5 lg:p-4 bg-[#8b0000] text-yellow-500 border-4 border-yellow-600 shadow-2xl hover:bg-[#a00000] transition-all active:translate-y-1 flex items-center justify-center animate-in fade-in zoom-in duration-300"
                                            title="Merchant Store"
                                        >
                                            <ShoppingBag size={22} />
                                        </button>
                                    )}

                                    {/* Back to Mission Menu Button (Only for Quest Masters) */}
                                    {availableMissions.length > 0 && (resolvedType || npcType) === 'quest_master' && (
                                        <button
                                            onClick={() => {
                                                setSelectedMissionId(null);
                                                setMessages([{
                                                    sender: 'npc',
                                                    text: t('npc.dialogue.anything_else', { lng: 'en' }),
                                                    translation: t('npc.dialogue.anything_else', { lng: 'es' }),
                                                    timestamp: new Date()
                                                }]);
                                            }}
                                            className="p-2.5 lg:p-4 bg-gray-800 text-white border-4 border-gray-600 shadow-2xl hover:bg-gray-700 transition-all active:translate-y-1 flex items-center justify-center"
                                            title={t('npc.dialogue.missions_menu')}
                                        >
                                            <MapPin size={22} />
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
                                            {t('npc.dialogue.auto_voice')}
                                        </label>
                                    </div>

                                    {/* Audio Only Transcription Toggle & Tooltip */}
                                    {isAudioOnly && (
                                        <div className="relative flex items-center gap-2 mt-2 px-2 py-1 bg-white/40 rounded border border-black/10 shadow-sm">
                                            <input 
                                                type="checkbox" 
                                                id="transcript-toggle"
                                                checked={showAudioTranscript}
                                                onChange={(e) => setShowAudioTranscript(e.target.checked)}
                                                className="w-4 h-4 accent-[var(--color-orange-vibrant)] cursor-pointer"
                                            />
                                            <label htmlFor="transcript-toggle" className="text-[10px] font-medieval font-bold uppercase tracking-tighter cursor-pointer text-[#1a1a1a]">
                                                {t('npc.dialogue.show_text')}
                                            </label>
                                            <div 
                                                className="relative cursor-pointer text-gray-600 hover:text-gray-900 pointer-events-auto flex items-center"
                                                onMouseEnter={() => setShowTooltip(true)}
                                                onMouseLeave={() => setShowTooltip(false)}
                                            >
                                                <AlertCircle size={14} className="text-gray-500 hover:text-gray-800" />
                                                {showTooltip && (
                                                    <div className="absolute right-0 bottom-6 z-50 w-72 bg-gray-900 text-white text-xs p-4 rounded-lg shadow-2xl border border-gray-700 pointer-events-none animate-in fade-in slide-in-from-bottom-2 duration-200">
                                                        <p className="font-medieval text-yellow-400 mb-1.5 uppercase tracking-wider text-[10px]">{t('npc.dialogue.transcript')}</p>
                                                        <p className="font-serif italic text-sm text-gray-100 mb-2 leading-tight">"{lastMessage.text}"</p>
                                                        {getTranslation(lastMessage) && (
                                                            <>
                                                                <div className="h-[1px] bg-gray-700 my-2"></div>
                                                                <p className="font-serif italic text-sm text-gray-300 leading-tight">"{getTranslation(lastMessage)}"</p>
                                                            </>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Task Completed banner — rendered at the end of the
                            conversation so it's never clipped by the bubble's
                            overflow-hidden and reads as the latest beat. */}
                        {taskCompletedBanner && (
                            <div className="self-center mt-2 z-50 flex items-center gap-3 px-6 py-2.5 bg-gradient-to-r from-green-700 to-green-500 text-white border-4 border-green-900 shadow-2xl animate-in slide-in-from-bottom-4 fade-in duration-500 font-medieval uppercase tracking-wider">
                                <CheckCircle size={24} className="text-white animate-bounce" />
                                <span className="font-black italic text-sm">{t('npc.dialogue.task_complete_banner')}</span>
                            </div>
                        )}
                    </div>

                        {/* Input Area — replaced by a completion panel when the mission/task is
                            already done, so the player isn't nudged to keep talking to a finished quest. */}
                        {((selectedMission?.status === 'completed') || npcTaskDone) ? (
                            <div className="mt-auto flex flex-col sm:flex-row items-center justify-between gap-4 bg-green-50 p-4 border-4 border-double border-green-700 relative z-10 animate-in fade-in slide-in-from-bottom-2 duration-500">
                                <div className="flex items-center gap-3 text-green-800">
                                    <CheckCircle size={30} className="text-green-700 shrink-0" />
                                    <div className="text-left">
                                        <p className="font-medieval uppercase tracking-wider text-base font-black leading-tight">{t('npc.dialogue.mission_done_title')}</p>
                                        <p className="text-xs font-serif italic text-green-700/80 leading-tight">{t('npc.dialogue.mission_done_hint')}</p>
                                    </div>
                                </div>
                                {(availableMissions.length > 0 && (resolvedType || npcType) === 'quest_master') ? (
                                    <button
                                        onClick={() => {
                                            setSelectedMissionId(null);
                                            setMessages([{
                                                sender: 'npc',
                                                text: t('npc.dialogue.anything_else', { lng: 'en' }),
                                                translation: t('npc.dialogue.anything_else', { lng: 'es' }),
                                                timestamp: new Date()
                                            }]);
                                        }}
                                        className="flex items-center gap-2 px-6 py-3 bg-[var(--color-accent-blue)] text-[var(--color-gold)] font-medieval uppercase tracking-wider border-4 border-[var(--color-gold)] shadow-lg hover:bg-[var(--color-base-dark)] active:translate-y-1 transition-all whitespace-nowrap"
                                    >
                                        <MapPin size={20} /> {t('npc.dialogue.back_to_missions')}
                                    </button>
                                ) : (
                                    <button
                                        onClick={handleClose}
                                        className="flex items-center gap-2 px-6 py-3 bg-green-700 text-white font-medieval uppercase tracking-wider border-4 border-green-900 shadow-lg hover:bg-green-600 active:translate-y-1 transition-all whitespace-nowrap"
                                    >
                                        <CheckCircle size={20} /> {t('npc.dialogue.close')}
                                    </button>
                                )}
                            </div>
                        ) : (
                        <div className="mt-auto flex items-center gap-2 lg:gap-4 bg-[var(--color-base-dark)]/10 p-2 pl-3 lg:pl-6 border-4 border-double border-[var(--color-gold)] relative z-10">
                            <button
                                onClick={toggleRecording}
                                className={`p-3 lg:p-4 transition-all border-2 border-[var(--color-gold-dark)] shadow-md ${
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
                                placeholder={isAudioOnly ? t('npc.dialogue.silence_required_placeholder') : t('npc.dialogue.type_words_placeholder')}
                                className={`flex-1 min-w-0 bg-transparent text-[var(--color-base-dark)] text-base lg:text-xl font-medieval placeholder-[var(--color-accent-blue)]/50 focus:outline-none ${isAudioOnly ? 'cursor-not-allowed opacity-50' : ''}`}
                            />

                            <button
                                onClick={() => handleSend(inputText)}
                                disabled={!inputText.trim() || isProcessing || isAudioOnly}
                                className="bg-[var(--color-orange-vibrant)] text-white p-3 lg:p-4 border-2 border-[var(--color-gold)] hover:bg-[var(--color-accent-blue)] disabled:opacity-50 transition-all flex items-center justify-center shadow-lg active:translate-y-1"
                            >
                                <ChevronRight size={24} />
                            </button>
                        </div>
                        )}
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
