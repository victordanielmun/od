import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { CharacterIdleRenderer } from '../components/dashboard/CharacterIdleRenderer';
import { CHARACTER_CONFIG } from '../game/config/CharacterConfig';
import { useAssetPreloader } from '../hooks/useAssetPreloader';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { 
  LogOut, 
  Users, 
  UserPlus, 
  X, 
  Gamepad2, 
  BookOpen, 
  Shield, 
  Swords, 
  Zap, 
  Coins, 
  Award, 
  Heart, 
  Sparkles,
  Brain,
  Bell,
  BellOff,
  Smartphone,
  Phone,
  Clock,
  Globe,
  AlertCircle,
  Loader2,
  ShieldAlert,
  QrCode,
  Check,
  Trophy,
  ChevronDown,
  ChevronUp,
  Crown
} from 'lucide-react';

const COUNTRY_CODES = [
  { code: '+57', country: 'Colombia', flag: '🇨🇴' },
  { code: '+34', country: 'España', flag: '🇪🇸' },
  { code: '+52', country: 'México', flag: '🇲🇽' },
  { code: '+54', country: 'Argentina', flag: '🇦🇷' },
  { code: '+56', country: 'Chile', flag: '🇨🇱' },
  { code: '+51', country: 'Perú', flag: '🇵🇪' },
  { code: '+593', country: 'Ecuador', flag: '🇪🇨' },
  { code: '+58', country: 'Venezuela', flag: '🇻🇪' },
  { code: '+591', country: 'Bolivia', flag: '🇧🇴' },
  { code: '+506', country: 'Costa Rica', flag: '🇨🇷' },
  { code: '+502', country: 'Guatemala', flag: '🇬🇹' },
  { code: '+503', country: 'El Salvador', flag: '🇸🇻' },
  { code: '+504', country: 'Honduras', flag: '🇭🇳' },
  { code: '+505', country: 'Nicaragua', flag: '🇳🇮' },
  { code: '+507', country: 'Panamá', flag: '🇵🇦' },
  { code: '+595', country: 'Paraguay', flag: '🇵🇾' },
  { code: '+598', country: 'Uruguay', flag: '🇺🇾' },
  { code: '+1', country: 'Estados Unidos / Canadá', flag: '🇺🇸' },
];

export const Dashboard = () => {
  const { t } = useTranslation();
  const { user, logout, isGuest } = useAuthStore();
  const navigate = useNavigate();

  // RPG stats state
  const [rpgStats, setRpgStats] = useState(null);
  const [rpgLoading, setRpgLoading] = useState(true);
  const [rpgError, setRpgError] = useState(null);

  // Learning stats state
  const [learningProfile, setLearningProfile] = useState(null);

  // Friends state
  const [friends, setFriends] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [friendUsername, setFriendUsername] = useState('');
  const [friendsError, setFriendsError] = useState(null);
  const [friendsLoading, setFriendsLoading] = useState(false);

  // Leaderboard state (lazy-loaded when the user opens the panel)
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [leaderboardError, setLeaderboardError] = useState(null);

  const [showSpriteSelector, setShowSpriteSelector] = useState(false);
  const [savingSprite, setSavingSprite] = useState(false);
  const [englishLevelUpdating, setEnglishLevelUpdating] = useState(false);

  const [whatsappContact, setWhatsappContact] = useState(null);
  const [togglingNotifs, setTogglingNotifs] = useState(false);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [linkingWA, setLinkingWA] = useState(false);

  // WhatsApp Register Flow equivalent states
  const [enableWhatsApp, setEnableWhatsApp] = useState(true);
  const [countryCode, setCountryCode] = useState('+57');
  const [mobileNumber, setMobileNumber] = useState('');
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Bogota');
  const [preferredHourStart, setPreferredHourStart] = useState(8);
  const [preferredHourEnd, setPreferredHourEnd] = useState(21);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [waitingActivation, setWaitingActivation] = useState(false);
  const [botPhone, setBotPhone] = useState('');
  const [activationMessage, setActivationMessage] = useState('');

  const guestStatus = isGuest();

  // Warm the lobby's assets into the browser HTTP cache while the user reviews
  // their adventurer card, so the lobby map paints instantly on arrival. Critical
  // assets (atlases + character/enemy/boss sheets) finish first; the heavy NPC +
  // music set keeps streaming in the background afterwards.
  const { loaded, total, criticalDone, done } = useAssetPreloader();
  const preloadPct = total ? Math.round((loaded / total) * 100) : 100;

  useEffect(() => {
    // Show selector if not guest and hasn't chosen sprite
    if (!guestStatus && user && user.has_chosen_sprite === false) {
      setShowSpriteSelector(true);
    }
  }, [user, guestStatus]);

  // Load RPG Stats
  useEffect(() => {
    const fetchRPGStats = async () => {
      try {
        setRpgLoading(true);
        const response = await api.get('/player/stats');
        setRpgStats(response.data);
      } catch (err) {
        console.error('Failed to load RPG stats:', err);
        setRpgError(err.response?.data?.error || 'Failed to load stats');
      } finally {
        setRpgLoading(false);
      }
    };
    fetchRPGStats();
  }, []);

  // Load Learning Profile & WhatsApp Contact
  useEffect(() => {
    if (!guestStatus) {
      api.get('/learning/profile')
        .then(res => setLearningProfile(res.data))
        .catch(err => console.error('Failed to load learning profile:', err));

      api.get('/whatsapp/contact')
        .then(res => setWhatsappContact(res.data))
        .catch(err => {
          if (err.response?.status !== 404) {
             console.error('Failed to load whatsapp contact:', err);
          }
        });
    }
  }, [guestStatus]);

  // Load Friends & Requests
  const fetchFriendsData = useCallback(async () => {
    if (guestStatus) return;
    setFriendsLoading(true);
    setFriendsError(null);
    try {
      const [friendsRes, requestsRes] = await Promise.all([
        api.get('/friends'),
        api.get('/friends/requests')
      ]);
      setFriends(friendsRes.data?.friends || []);
      setIncomingRequests(requestsRes.data?.incoming || []);
    } catch (err) {
      console.error('Failed to fetch friends data:', err);
      setFriendsError(err.response?.data?.error || 'Failed to load friends');
    } finally {
      setFriendsLoading(false);
    }
  }, [guestStatus]);

  useEffect(() => {
    fetchFriendsData();
  }, [fetchFriendsData]);

  // Polling to check if WhatsApp notifications have been activated
  useEffect(() => {
    if (!waitingActivation) return;

    let intervalId = setInterval(async () => {
      try {
        const res = await api.get('/whatsapp/contact');
        if (res.data && res.data.notifications_enabled) {
          clearInterval(intervalId);
          setWaitingActivation(false);
          await api.post('/auth/terms', { terms_accepted: true });
          setWhatsappContact(res.data);
          setShowWhatsAppModal(false);
        }
      } catch (err) {
        console.error("Polling error checking contact status:", err);
      }
    }, 3000);

    return () => clearInterval(intervalId);
  }, [waitingActivation]);

  // Handle friend request operations
  const handleSendFriendRequest = async (e) => {
    e.preventDefault();
    if (!friendUsername.trim()) return;
    setFriendsError(null);
    try {
      await api.post('/friends/requests', { target_username: friendUsername.trim() });
      setFriendUsername('');
      fetchFriendsData();
    } catch (err) {
      setFriendsError(err.response?.data?.error || 'Failed to send request');
    }
  };

  const handleAcceptRequest = async (requestId) => {
    try {
      await api.post(`/friends/requests/${requestId}/accept`);
      fetchFriendsData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleRejectRequest = async (requestId) => {
    try {
      await api.post(`/friends/requests/${requestId}/reject`);
      fetchFriendsData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleRemoveFriend = async (friendId) => {
    if (window.confirm('Are you sure you want to remove this friend?')) {
      try {
        await api.delete(`/friends/${friendId}`);
        fetchFriendsData();
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleLogoutClick = () => {
    logout();
    navigate('/login');
  };

  const fetchLeaderboard = useCallback(async () => {
    setLeaderboardLoading(true);
    setLeaderboardError(null);
    try {
      const res = await api.get('/learning/leaderboard?limit=20');
      setLeaderboard(res.data || []);
    } catch (err) {
      console.error('Failed to load leaderboard:', err);
      setLeaderboardError(err.response?.data?.error || 'Failed to load leaderboard');
    } finally {
      setLeaderboardLoading(false);
    }
  }, []);

  const handleToggleLeaderboard = () => {
    const next = !showLeaderboard;
    setShowLeaderboard(next);
    if (next) fetchLeaderboard();
  };

  const handleSpriteSelect = async (spriteId) => {
    setSavingSprite(true);
    try {
      await api.put('/auth/sprite', { character_id: String(spriteId) });
      useAuthStore.getState().updateUser({ character_id: String(spriteId), has_chosen_sprite: true });
      setShowSpriteSelector(false);
    } catch (err) {
      console.error('Failed to save sprite:', err);
      alert(err.response?.data?.error || 'Failed to save sprite');
    } finally {
      setSavingSprite(false);
    }
  };

  const handleEnglishLevelChange = async (e) => {
    const newLevel = e.target.value;
    setEnglishLevelUpdating(true);
    try {
      await api.put('/learning/profile/level', { english_level: newLevel });
      setLearningProfile(prev => ({ ...prev, english_level: newLevel }));
    } catch (err) {
      console.error('Failed to update English level:', err);
      alert('Failed to update English level');
    } finally {
      setEnglishLevelUpdating(false);
    }
  };

  const handleToggleNotifications = async () => {
    if (!whatsappContact) return;
    
    setTogglingNotifs(true);
    try {
      const newStatus = !whatsappContact.notifications_enabled;
      const res = await api.post('/whatsapp/contact', {
        phone_number: whatsappContact.phone_number,
        notifications_enabled: newStatus
      });
      setWhatsappContact(res.data);
    } catch (err) {
      console.error('Failed to toggle notifications:', err);
      alert('Failed to toggle notifications');
    } finally {
      setTogglingNotifs(false);
    }
  };

  const handleLinkWhatsApp = async (e) => {
    e.preventDefault();

    if (!enableWhatsApp) {
      setLinkingWA(true);
      try {
        if (whatsappContact) {
          const res = await api.post('/whatsapp/contact', {
            phone_number: whatsappContact.phone_number,
            notifications_enabled: false
          });
          setWhatsappContact(res.data);
        }
        setShowWhatsAppModal(false);
      } catch (err) {
        console.error("Failed to disable WhatsApp notifications:", err);
        alert('Failed to disable WhatsApp notifications');
      } finally {
        setLinkingWA(false);
      }
      return;
    }

    if (!mobileNumber) {
      alert(t('register.step3.error_phone'));
      return;
    }
    
    setLinkingWA(true);
    try {
      const fullPhoneNumber = countryCode + mobileNumber.replace(/\D/g, ''); // strip any non-digits
      
      // 1. Save the contact initially with notifications disabled (pending activation)
      const contactRes = await api.post('/whatsapp/contact', {
        phone_number: fullPhoneNumber,
        whatsapp_name: user?.username || '',
        notifications_enabled: false,
        timezone: timezone,
        preferred_hour_start: parseInt(preferredHourStart, 10),
        preferred_hour_end: parseInt(preferredHourEnd, 10)
      });

      // 2. Fetch the connected bot's phone number
      try {
        const phoneRes = await api.get('/whatsapp/global/phone');
        if (phoneRes.data && phoneRes.data.phone) {
          setBotPhone(phoneRes.data.phone);
          
          // Generate a randomized warm-up message
          const messages = [
            `¡Hola Odisea! Soy ${user?.username || ''}. Quiero recibir ayuda para mejorar mi inglés y activar mis notificaciones diarias.`,
            `Hola, me gustaría comenzar a practicar mi inglés con Odisea y activar mis notificaciones de aprendizaje. Mi usuario es ${user?.username || ''}.`,
            `Hola Odisea. Deseo iniciar mi entrenamiento diario de inglés. Por favor, activa las notificaciones para el usuario ${user?.username || ''}.`,
            `¡Hola! Estoy listo para el reto de inglés en Odisea con mi guía. Activa las notificaciones para ${user?.username || ''}.`
          ];
          const randIndex = Math.floor(Math.random() * messages.length);
          setActivationMessage(messages[randIndex]);
          setWaitingActivation(true);
        } else {
          console.warn("Global bot is not open, skipping QR activation check.");
          await api.post('/auth/terms', { terms_accepted: true });
          setWhatsappContact(contactRes.data);
          setShowWhatsAppModal(false);
        }
      } catch (phoneErr) {
        console.error("Failed to fetch bot phone, proceeding to dashboard:", phoneErr);
        await api.post('/auth/terms', { terms_accepted: true });
        setWhatsappContact(contactRes.data);
        setShowWhatsAppModal(false);
      }
    } catch (err) {
      console.error("Failed to link WhatsApp:", err);
      alert(err.response?.data?.error || t('register.step3.error_save'));
    } finally {
      setLinkingWA(false);
    }
  };

  const getExperiencePercentage = () => {
    if (!rpgStats) return 0;
    // Standard RPG curve or simplified percent for styling
    // Let's say XP needed per level is Level * 100
    const nextLevelXP = (rpgStats.level || 1) * 100;
    return Math.min(100, Math.round((rpgStats.experience / nextLevelXP) * 100));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-indigo-950 to-gray-950 text-white font-sans selection:bg-yellow-500 selection:text-black py-8 px-4 sm:px-6 lg:px-8 relative">
      {/* Decorative backdrop glow elements */}
      <div className="absolute top-20 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-20 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none"></div>

      {/* Floating Close Button to return to the Lobby */}
      <button
        onClick={() => navigate('/lobby')}
        className="absolute top-6 right-6 z-50 p-2.5 bg-black/40 backdrop-blur-md border border-white/10 hover:border-yellow-500/30 text-gray-400 hover:text-white rounded-xl shadow-xl transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer flex items-center justify-center"
        title="Back to Lobby"
      >
        <X size={20} />
      </button>

      <div className="max-w-7xl mx-auto relative z-10">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-center mb-8 pb-6 border-b border-white/10 gap-4">
          <div className="flex items-center gap-3">
            <img src="/banners/logo.png" alt="Odisea Logo" className="w-24 h-auto object-contain" />
            <div>
              <h1 className="text-3xl font-extrabold tracking-wider bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500 bg-clip-text text-transparent uppercase font-medieval">
                Odyssey Adventurer Card
              </h1>
              <p className="text-gray-400 text-sm mt-0.5">
                Prepare your stats before venturing into the game lobby
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/learn')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/30 transition-all hover:scale-105"
            >
              <Brain size={18} />
              <span>Practice English</span>
            </button>

            <button
              onClick={handleLogoutClick}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-all hover:scale-105"
            >
              <LogOut size={18} />
              <span>Log Out</span>
            </button>
          </div>
        </header>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-8">
          
          {/* Column 1: Character Portrait & RPG Stats (6 cols) */}
          <section className="lg:col-span-7 space-y-6">
            <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-3 bg-yellow-500/10 border-b border-l border-white/10 text-yellow-400 text-xs font-mono uppercase rounded-bl-xl tracking-widest">
                {rpgStats?.class || 'Adventurer'}
              </div>
              
              <h2 className="text-xl font-bold text-yellow-400 border-b border-white/10 pb-3 mb-6 font-medieval tracking-wide flex items-center gap-2">
                <Sparkles size={20} className="text-yellow-500" />
                Character & Base Stats
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                
                {/* Spritesheet Idle Animation Frame */}
                <div className="md:col-span-5 flex flex-col items-center justify-center bg-gray-950/60 border border-white/5 rounded-xl p-4 min-h-[220px]">
                  <CharacterIdleRenderer 
                    characterId={user?.character_id || '1'} 
                    scale={3.2} 
                    className="mb-4"
                  />
                  <div className="text-center w-full">
                    <p className="text-lg font-bold text-white font-medieval">{user?.username}</p>
                    {guestStatus && (
                      <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-[10px] uppercase font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        Guest Traveler
                      </span>
                    )}
                    {!guestStatus && (
                      <button 
                        onClick={() => setShowSpriteSelector(true)}
                        className="mt-3 mx-auto flex items-center justify-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 hover:text-yellow-400 border border-white/10 hover:border-yellow-400/50 rounded-lg transition-colors cursor-pointer bg-black/40 hover:bg-yellow-500/10"
                      >
                        Change Appearance
                      </button>
                    )}
                  </div>
                </div>

                {/* HP, MP & Primary stats */}
                <div className="md:col-span-7 space-y-5">
                  {rpgLoading ? (
                    <div className="space-y-4 py-8">
                      <div className="h-4 bg-white/5 rounded animate-pulse w-3/4"></div>
                      <div className="h-4 bg-white/5 rounded animate-pulse w-full"></div>
                      <div className="h-4 bg-white/5 rounded animate-pulse w-5/6"></div>
                    </div>
                  ) : rpgError ? (
                    <div className="text-red-400 text-sm py-8 text-center">{rpgError}</div>
                  ) : (
                    <>
                      {/* Health Points (HP) */}
                      <div>
                        <div className="flex justify-between text-xs font-bold mb-1.5 text-emerald-400">
                          <span className="flex items-center gap-1"><Heart size={14} /> Health Points (HP)</span>
                          <span>{rpgStats.hp_current} / {rpgStats.hp_max}</span>
                        </div>
                        <div className="w-full h-3 bg-gray-900 rounded-full border border-white/5 overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-emerald-600 to-green-400 transition-all duration-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                            style={{ width: `${Math.min(100, Math.round((rpgStats.hp_current / rpgStats.hp_max) * 100))}%` }}
                          ></div>
                        </div>
                      </div>

                      {/* Mana Points (MP) */}
                      <div>
                        <div className="flex justify-between text-xs font-bold mb-1.5 text-blue-400">
                          <span className="flex items-center gap-1"><Sparkles size={14} /> Mana Points (MP)</span>
                          <span>{rpgStats.mp_current} / {rpgStats.mp_max}</span>
                        </div>
                        <div className="w-full h-3 bg-gray-900 rounded-full border border-white/5 overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-blue-600 to-cyan-400 transition-all duration-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"
                            style={{ width: `${Math.min(100, Math.round((rpgStats.mp_current / rpgStats.mp_max) * 100))}%` }}
                          ></div>
                        </div>
                      </div>

                      {/* Experience Points (XP) */}
                      <div>
                        <div className="flex justify-between text-xs font-bold mb-1.5 text-amber-400">
                          <span className="flex items-center gap-1"><Award size={14} /> Experience & Level {rpgStats.level}</span>
                          <span>{rpgStats.experience} / {rpgStats.level * 100} XP</span>
                        </div>
                        <div className="w-full h-3 bg-gray-900 rounded-full border border-white/5 overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-amber-600 to-yellow-400 transition-all duration-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]"
                            style={{ width: `${getExperiencePercentage()}%` }}
                          ></div>
                        </div>
                      </div>

                      {/* Combat core stats */}
                      <div className="grid grid-cols-3 gap-3 pt-2">
                        <div className="bg-gray-950/40 border border-white/5 rounded-xl p-3 text-center">
                          <Swords className="mx-auto text-red-400 mb-1 w-5 h-5" />
                          <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Attack</span>
                          <p className="text-lg font-bold text-white mt-0.5">{rpgStats.attack}</p>
                        </div>

                        <div className="bg-gray-950/40 border border-white/5 rounded-xl p-3 text-center">
                          <Shield className="mx-auto text-blue-400 mb-1 w-5 h-5" />
                          <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Defense</span>
                          <p className="text-lg font-bold text-white mt-0.5">{rpgStats.defense}</p>
                        </div>

                        <div className="bg-gray-950/40 border border-white/5 rounded-xl p-3 text-center">
                          <Zap className="mx-auto text-amber-400 mb-1 w-5 h-5" />
                          <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Speed</span>
                          <p className="text-lg font-bold text-white mt-0.5">{rpgStats.speed}</p>
                        </div>
                      </div>
                    </>
                  )}
                </div>

              </div>

              {/* Gold Indicator */}
              <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between">
                <span className="text-gray-400 text-sm">Bag Gold</span>
                <div className="flex items-center gap-1.5 text-yellow-400 font-bold text-lg font-mono">
                  <Coins size={18} className="text-yellow-500 animate-bounce" />
                  <span>{rpgStats?.gold ?? 0}g</span>
                </div>
              </div>
            </div>
          </section>

          {/* Column 2: Learning Stats & Friends (5 cols) */}
          <section className="lg:col-span-5 space-y-6">
            
            {/* Learning Profile */}
            <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl p-6 shadow-2xl">
              <h2 className="text-xl font-bold text-indigo-400 border-b border-white/10 pb-3 mb-4 font-medieval tracking-wide flex items-center gap-2">
                <BookOpen size={20} className="text-indigo-400" />
                English Training Profile
              </h2>

              {guestStatus ? (
                <div className="py-6 text-center text-sm text-gray-400">
                  <p>Register an account to unlock complete English training tracking and quests.</p>
                </div>
              ) : learningProfile ? (
                <div className="space-y-4">
                  <div className="flex justify-between items-center bg-indigo-950/30 border border-indigo-500/10 rounded-xl p-3">
                    <span className="text-gray-400 text-sm">English Level</span>
                    {englishLevelUpdating ? (
                      <span className="text-indigo-400 text-xs">Updating...</span>
                    ) : (
                      <select 
                        value={learningProfile.english_level} 
                        onChange={handleEnglishLevelChange}
                        className="bg-indigo-950 text-yellow-400 border border-indigo-500/50 rounded-lg text-xs font-bold uppercase tracking-wider p-1.5 focus:outline-none focus:border-indigo-400 cursor-pointer shadow-md"
                      >
                        <option value="beginner" className="bg-gray-950 text-white">BEGINNER</option>
                        <option value="intermediate" className="bg-gray-950 text-white">INTERMEDIATE</option>
                        <option value="advanced" className="bg-gray-950 text-white">ADVANCED</option>
                      </select>
                    )}
                  </div>

                  <div className="flex justify-between items-center bg-indigo-950/30 border border-indigo-500/10 rounded-xl p-3">
                    <span className="text-gray-400 text-sm flex items-center gap-2">
                      <Smartphone size={16} className="text-emerald-400" />
                      WhatsApp AI
                    </span>
                    {whatsappContact ? (
                      <button 
                        onClick={handleToggleNotifications}
                        disabled={togglingNotifs}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer ${whatsappContact.notifications_enabled ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30'}`}
                      >
                        {whatsappContact.notifications_enabled ? (
                          <><Bell size={14} /> Active</>
                        ) : (
                          <><BellOff size={14} /> Paused</>
                        )}
                      </button>
                    ) : (
                      <button 
                        onClick={() => setShowWhatsAppModal(true)}
                        className="px-3 py-1 bg-gray-900 text-gray-400 hover:text-emerald-400 hover:border-emerald-500/50 border border-gray-800 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer"
                      >
                        Link WhatsApp
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-950/40 border border-white/5 rounded-xl p-3">
                      <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider block">Training XP</span>
                      <span className="text-xl font-bold text-white mt-1 block">{learningProfile.total_xp} XP</span>
                    </div>

                    <div className="bg-gray-950/40 border border-white/5 rounded-xl p-3">
                      <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider block">Weekly Score</span>
                      <span className="text-xl font-bold text-white mt-1 block">{learningProfile.weekly_score} pts</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-950/40 border border-white/5 rounded-xl p-3">
                      <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider block">Weekly Attempts</span>
                      <span className="text-xl font-bold text-white mt-1 block">{learningProfile.weekly_attempts}</span>
                    </div>

                    <div className="bg-gray-950/40 border border-white/5 rounded-xl p-3">
                      <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider block">Correct Answers</span>
                      <span className="text-xl font-bold text-green-400 mt-1 block">{learningProfile.weekly_correct}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-6 text-center text-sm text-gray-400">
                  <p>No learning profile loaded yet.</p>
                </div>
              )}
            </div>

            {/* Guild / Friends */}
            <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl p-6 shadow-2xl">
              <h2 className="text-xl font-bold text-emerald-400 border-b border-white/10 pb-3 mb-4 font-medieval tracking-wide flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users size={20} className="text-emerald-400" />
                  <span>Companions Guild</span>
                </div>
                {!guestStatus && (
                  <button 
                    onClick={fetchFriendsData}
                    className="text-[10px] font-mono text-emerald-400/60 hover:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 px-2 py-0.5 border border-emerald-500/20 rounded"
                  >
                    Refresh
                  </button>
                )}
              </h2>

              {guestStatus ? (
                <div className="py-6 text-center text-sm text-gray-400">
                  <p>Social features and guilds require a registered account.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  
                  {/* Friend invitation form */}
                  <form onSubmit={handleSendFriendRequest} className="flex gap-2">
                    <input 
                      value={friendUsername} 
                      onChange={(e) => setFriendUsername(e.target.value)} 
                      placeholder="Username to invite..." 
                      className="flex-1 bg-gray-950 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500" 
                    />
                    <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 border border-emerald-500/30 text-white rounded-xl px-3 py-1.5 text-xs font-bold transition flex items-center gap-1">
                      <UserPlus size={14} />
                      <span>Invite</span>
                    </button>
                  </form>

                  {friendsError && (
                    <p className="text-red-400 text-xs mt-1 text-center font-mono">{friendsError}</p>
                  )}

                  {/* Incoming Requests */}
                  {incomingRequests.length > 0 && (
                    <div className="border border-yellow-500/30 bg-yellow-500/5 p-3 rounded-xl space-y-2">
                      <p className="text-xs font-bold text-yellow-400 tracking-wide uppercase">Incoming Petitions</p>
                      {incomingRequests.map(req => (
                        <div key={req.id} className="flex justify-between items-center text-xs bg-gray-950/60 border border-white/5 p-2 rounded-lg">
                          <span className="font-bold text-gray-300 font-mono">{req.requester_username}</span>
                          <div className="flex gap-1.5">
                            <button onClick={() => handleAcceptRequest(req.id)} className="px-2 py-0.5 bg-green-600 text-white rounded text-[10px] font-bold">Accept</button>
                            <button onClick={() => handleRejectRequest(req.id)} className="px-2 py-0.5 bg-red-600 text-white rounded text-[10px] font-bold">Decline</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Friends List */}
                  {friendsLoading ? (
                    <div className="space-y-2 py-4">
                      <div className="h-8 bg-white/5 rounded animate-pulse"></div>
                      <div className="h-8 bg-white/5 rounded animate-pulse"></div>
                    </div>
                  ) : friends.length === 0 ? (
                    <p className="text-center text-xs text-gray-500 py-4 italic">No guild companions added yet.</p>
                  ) : (
                    <ul className="space-y-2 max-h-[160px] overflow-y-auto pr-1 custom-scrollbar">
                      {friends.map(f => (
                        <li key={f.id} className="flex items-center justify-between bg-gray-950/40 hover:bg-gray-950/60 border border-white/5 p-2.5 rounded-xl transition-colors">
                          <div className="flex items-center gap-2 overflow-hidden">
                            <span className="w-2.5 h-2.5 rounded-full bg-gray-600 shadow-md"></span>
                            <span className="text-xs font-medium text-gray-200 truncate">{f.username}</span>
                          </div>
                          <button onClick={() => handleRemoveFriend(f.id)} className="text-red-400/60 hover:text-red-400 transition-colors p-1" title="Remove companion">
                            <X size={14} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}

                </div>
              )}
            </div>

          </section>

        </div>

        {/* Action Button: Play/Enter Lobby */}
        <div className="flex flex-col items-center mt-10 gap-3">
          <button
            onClick={() => navigate('/lobby')}
            className="group relative flex items-center gap-3 px-12 py-5 rounded-2xl bg-gradient-to-r from-yellow-500 via-amber-500 to-yellow-600 text-black font-extrabold text-lg uppercase font-medieval tracking-widest shadow-[0_0_30px_rgba(245,158,11,0.3)] transition-all hover:scale-105 active:scale-95 border-2 border-yellow-300 hover:shadow-[0_0_40px_rgba(245,158,11,0.5)] cursor-pointer"
          >
            {criticalDone ? (
              <Gamepad2 className="w-6 h-6 text-black group-hover:rotate-12 transition-transform" />
            ) : (
              <Loader2 className="w-6 h-6 text-black animate-spin" />
            )}
            <span>{criticalDone ? 'Enter Lobby Realm' : 'Preparing Realm…'}</span>
          </button>

          {/* Cache-warming progress: shown until every asset is in the browser
              cache. Non-blocking — the button works at any point. */}
          {!done && (
            <div className="w-full max-w-sm flex flex-col items-center gap-1.5">
              <div className="w-full h-1.5 bg-gray-900 rounded-full border border-white/5 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-yellow-600 to-amber-400 transition-all duration-300"
                  style={{ width: `${preloadPct}%` }}
                ></div>
              </div>
              <span className="text-[10px] uppercase tracking-widest text-gray-500 font-mono">
                {criticalDone
                  ? `Lobby ready · caching extras ${loaded}/${total}`
                  : `Caching world assets ${loaded}/${total}`}
              </span>
            </div>
          )}
        </div>

        {/* Leaderboard (collapsed by default to avoid clutter) */}
        <div className="mt-8 max-w-3xl mx-auto">
          <button
            onClick={handleToggleLeaderboard}
            className="w-full flex items-center justify-between gap-3 px-5 py-3.5 rounded-2xl bg-black/40 backdrop-blur-md border border-white/10 hover:border-yellow-500/30 text-gray-300 hover:text-white transition-all cursor-pointer group"
          >
            <span className="flex items-center gap-2.5 font-medieval uppercase tracking-wider text-sm">
              <Trophy size={18} className="text-yellow-400" />
              Leaderboard &amp; Weekly Standings
            </span>
            {showLeaderboard
              ? <ChevronUp size={18} className="text-gray-400 group-hover:text-white" />
              : <ChevronDown size={18} className="text-gray-400 group-hover:text-white" />}
          </button>

          {showLeaderboard && (
            <div className="mt-3 bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl p-4 shadow-2xl">
              {leaderboardLoading ? (
                <div className="space-y-2 py-4">
                  <div className="h-9 bg-white/5 rounded animate-pulse"></div>
                  <div className="h-9 bg-white/5 rounded animate-pulse"></div>
                  <div className="h-9 bg-white/5 rounded animate-pulse"></div>
                </div>
              ) : leaderboardError ? (
                <p className="text-red-400 text-sm py-6 text-center">{leaderboardError}</p>
              ) : leaderboard.length === 0 ? (
                <p className="text-center text-xs text-gray-500 py-6 italic">No ranked adventurers yet. Complete missions and challenges to earn XP!</p>
              ) : (
                <>
                  {/* Header row */}
                  <div className="grid grid-cols-12 gap-2 px-3 pb-2 mb-1 border-b border-white/10 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                    <span className="col-span-2">Rank</span>
                    <span className="col-span-4">Adventurer</span>
                    <span className="col-span-2 text-center">Level</span>
                    <span className="col-span-2 text-right">Total</span>
                    <span className="col-span-2 text-right">Week</span>
                  </div>
                  <ul className="space-y-1.5 max-h-[360px] overflow-y-auto pr-1 custom-scrollbar">
                    {leaderboard.map(entry => {
                      const isMe = user && (entry.user_id === user.id || entry.username === user.username);
                      return (
                        <li
                          key={entry.user_id}
                          className={`grid grid-cols-12 gap-2 items-center px-3 py-2.5 rounded-xl border transition-colors ${
                            isMe
                              ? 'bg-yellow-500/10 border-yellow-500/40'
                              : 'bg-gray-950/40 border-white/5 hover:bg-gray-950/60'
                          }`}
                        >
                          <span className="col-span-2 flex items-center gap-1.5 font-bold">
                            {entry.rank === 1 ? (
                              <Crown size={16} className="text-yellow-400" />
                            ) : (
                              <span className={`text-sm font-mono ${entry.rank <= 3 ? 'text-yellow-400' : 'text-gray-500'}`}>#{entry.rank}</span>
                            )}
                          </span>
                          <span className="col-span-4 text-sm font-medium text-gray-200 truncate flex items-center gap-2">
                            {entry.username}
                            {isMe && <span className="text-[9px] uppercase font-bold text-yellow-400 bg-yellow-500/15 border border-yellow-500/30 px-1.5 py-0.5 rounded">You</span>}
                          </span>
                          <span className="col-span-2 text-center">
                            <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                              entry.english_level === 'advanced'
                                ? 'bg-red-700/30 text-red-300 border border-red-500/30'
                                : entry.english_level === 'intermediate'
                                  ? 'bg-amber-600/30 text-amber-300 border border-amber-500/30'
                                  : 'bg-emerald-700/30 text-emerald-300 border border-emerald-500/30'
                            }`}>
                              {entry.english_level?.slice(0, 3) || 'beg'}
                            </span>
                          </span>
                          <span className="col-span-2 text-right text-sm font-bold text-yellow-400 font-mono">{entry.total_xp}</span>
                          <span className="col-span-2 text-right text-xs text-indigo-300 font-mono">{entry.weekly_score}</span>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </div>
          )}
        </div>

      </div>

      {/* Sprite Selection Modal */}
      {showSpriteSelector && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-gray-900 border border-yellow-500/30 rounded-2xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto custom-scrollbar shadow-2xl relative">
            {user?.has_chosen_sprite && (
              <button 
                onClick={() => setShowSpriteSelector(false)}
                className="absolute top-4 right-4 text-gray-500 hover:text-white cursor-pointer"
              >
                <X size={24} />
              </button>
            )}
            <h2 className="text-3xl font-bold text-yellow-400 font-medieval text-center mb-2">Choose Your Adventurer</h2>
            <p className="text-gray-400 text-center mb-8 text-sm">Select your character appearance.</p>
            
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4">
              {CHARACTER_CONFIG.characters.map(({ id }) => (
                <button
                  key={id}
                  onClick={() => handleSpriteSelect(id)}
                  disabled={savingSprite}
                  className={`flex flex-col items-center p-4 bg-gray-950 border rounded-xl transition-all group disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-yellow-500 cursor-pointer ${
                    user?.character_id === id
                      ? 'border-yellow-400 bg-yellow-500/10 ring-2 ring-yellow-500'
                      : 'border-white/10 hover:border-yellow-400 hover:bg-yellow-500/10'
                  }`}
                >
                  <CharacterIdleRenderer characterId={id} scale={2.5} className="mb-4 group-hover:scale-110 transition-transform duration-300" />
                  <span className="text-xs text-gray-500 group-hover:text-yellow-400 font-mono tracking-wider">
                    Sprite {id}
                    {user?.character_id === id && (
                      <span className="ml-1 text-yellow-400">✓</span>
                    )}
                  </span>
                </button>
              ))}
            </div>
            {savingSprite && <p className="text-center text-yellow-400 mt-6 animate-pulse font-bold">Saving your choice...</p>}
          </div>
        </div>
      )}

      {/* WhatsApp Link Modal */}
      {showWhatsAppModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-gray-900 border border-emerald-500/30 rounded-2xl p-6 md:p-8 max-w-xl w-full shadow-2xl relative">
            <button 
              onClick={() => {
                setShowWhatsAppModal(false);
                setWaitingActivation(false);
              }}
              className="absolute top-4 right-4 text-gray-500 hover:text-white cursor-pointer z-50"
            >
              <X size={20} />
            </button>

            {/* Dynamic style for slide animation */}
            <style dangerouslySetInnerHTML={{__html: `
              @keyframes fadeInSlide {
                from { opacity: 0; transform: translateY(12px); }
                to { opacity: 1; transform: translateY(0); }
              }
              .animate-fade-in-slide {
                animation: fadeInSlide 0.4s ease-out forwards;
              }
            `}} />

            <div className="animate-fade-in-slide">
              {!waitingActivation ? (
                <>
                  <div className="text-center mb-6">
                    <div className="inline-flex p-3 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mb-2">
                      <Phone className="w-6 h-6 animate-pulse" />
                    </div>
                    <h2 className="text-2xl font-bold text-emerald-400 font-medieval uppercase tracking-wider">
                      {t('register.step3.title')}
                    </h2>
                    <p className="text-gray-400 text-xs mt-1.5 font-sans leading-normal">
                      {t('register.step3.subtitle')}
                    </p>
                  </div>

                  {/* Elegant glow switch buttons - Registration Style */}
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <button
                      type="button"
                      onClick={() => setEnableWhatsApp(true)}
                      className={`border rounded-xl p-4 text-center cursor-pointer transition-all duration-300 font-medieval uppercase tracking-wider text-[10px] sm:text-xs ${
                        enableWhatsApp 
                          ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)] font-black' 
                          : 'border-white/10 text-gray-500 hover:text-gray-400 bg-gray-950/20'
                      }`}
                    >
                      <Sparkles className="w-4 h-4 mx-auto mb-1.5 opacity-80" />
                      <span>{t('register.step3.yes_reminders')}</span>
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => setEnableWhatsApp(false)}
                      className={`border rounded-xl p-4 text-center cursor-pointer transition-all duration-300 font-medieval uppercase tracking-wider text-[10px] sm:text-xs ${
                        !enableWhatsApp 
                          ? 'border-gray-500 bg-white/5 text-gray-300 shadow-[0_0_15px_rgba(255,255,255,0.05)] font-black' 
                          : 'border-white/10 text-gray-500 hover:text-gray-400 bg-gray-950/20'
                      }`}
                    >
                      <ShieldAlert className="w-4 h-4 mx-auto mb-1.5 opacity-80" />
                      <span>{t('register.step3.no_reminders')}</span>
                    </button>
                  </div>

                  <form onSubmit={handleLinkWhatsApp} className="space-y-4">
                    {enableWhatsApp ? (
                      <div className="bg-gray-950/40 border border-white/5 rounded-2xl p-4 md:p-5 space-y-4 transition-all duration-300 animate-fade-in-slide">
                        
                        {/* Phone Input */}
                        <div>
                          <label htmlFor="mobileNumber" className="text-gray-400 text-[10px] font-extrabold uppercase tracking-widest block mb-2">
                            {t('register.step3.phone_label')}
                          </label>
                          <div className="flex gap-2">
                            <div className="w-1/3 min-w-[110px]">
                              <select
                                value={countryCode}
                                onChange={(e) => setCountryCode(e.target.value)}
                                className="w-full bg-gray-950 text-white border border-white/10 rounded-xl px-2.5 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-sans text-xs cursor-pointer"
                              >
                                {COUNTRY_CODES.map((c) => (
                                  <option key={c.code} value={c.code} className="bg-gray-950 text-white">
                                    {c.flag} {c.code}
                                  </option>
                                ))}
                              </select>
                            </div>
                            
                            <div className="flex-1 relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                                <Phone className="w-4 h-4" />
                              </span>
                              <input
                                id="mobileNumber"
                                type="tel"
                                value={mobileNumber}
                                onChange={(e) => setMobileNumber(e.target.value)}
                                className="w-full bg-gray-950 text-white border border-white/10 rounded-xl pl-9 pr-3 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-sans placeholder-gray-700 text-sm"
                                placeholder="3001234567"
                                required={enableWhatsApp}
                              />
                            </div>
                          </div>
                          <span className="text-[9px] text-gray-500 font-sans mt-1.5 block leading-normal">
                            {t('register.step3.phone_help')}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {/* Timezone */}
                          <div>
                            <label htmlFor="timezone" className="text-gray-400 text-[10px] font-extrabold uppercase tracking-widest block mb-1.5 flex items-center gap-1">
                              <Globe className="w-3 h-3 text-emerald-400" />
                              <span>{t('register.step3.timezone_label')}</span>
                            </label>
                            <select
                              id="timezone"
                              value={timezone}
                              onChange={(e) => setTimezone(e.target.value)}
                              className="w-full bg-gray-950 text-white border border-white/10 rounded-xl px-2.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-sans text-xs cursor-pointer"
                            >
                              <option value="America/Bogota" className="bg-gray-950 text-white">Bogotá, Lima, Quito (GMT-5)</option>
                              <option value="America/Mexico_City" className="bg-gray-950 text-white">Ciudad de México (GMT-6)</option>
                              <option value="America/Lima" className="bg-gray-950 text-white">Lima, Perú (GMT-5)</option>
                              <option value="America/Santiago" className="bg-gray-950 text-white">Santiago, Chile (GMT-4)</option>
                              <option value="America/Caracas" className="bg-gray-950 text-white">Caracas, Venezuela (GMT-4)</option>
                              <option value="America/Buenos_Aires" className="bg-gray-950 text-white">Buenos Aires (GMT-3)</option>
                              <option value="America/Madrid" className="bg-gray-950 text-white">Madrid (GMT+1/GMT+2)</option>
                              <option value="America/New_York" className="bg-gray-950 text-white">Nueva York (GMT-5)</option>
                              <option value="Europe/London" className="bg-gray-950 text-white">Londres (GMT)</option>
                            </select>
                          </div>

                          {/* Preferred hours */}
                          <div>
                            <label htmlFor="hours" className="text-gray-400 text-[10px] font-extrabold uppercase tracking-widest block mb-1.5 flex items-center gap-1">
                              <Clock className="w-3 h-3 text-emerald-400" />
                              <span>{t('register.step3.hours_label')}</span>
                            </label>
                            <div className="flex items-center gap-2">
                              <div className="relative flex-1">
                                <input
                                  type="number"
                                  min="0"
                                  max="23"
                                  value={preferredHourStart}
                                  onChange={(e) => setPreferredHourStart(e.target.value)}
                                  className="w-full bg-gray-950 text-white border border-white/10 rounded-xl px-2 py-2 text-center focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-sans text-xs"
                                />
                              </div>
                              <span className="text-gray-600 font-bold text-xs">{t('register.step3.hours_to')}</span>
                              <div className="relative flex-1">
                                <input
                                  type="number"
                                  min="0"
                                  max="23"
                                  value={preferredHourEnd}
                                  onChange={(e) => setPreferredHourEnd(e.target.value)}
                                  className="w-full bg-gray-950 text-white border border-white/10 rounded-xl px-2 py-2 text-center focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-sans text-xs"
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Info badge */}
                        <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-3 flex gap-2.5 text-left">
                          <BookOpen className="w-4.5 h-4.5 text-emerald-400 shrink-0 mt-0.5" />
                          <div className="text-[9px] text-gray-400 font-sans leading-normal">
                            <strong className="text-emerald-400 font-bold uppercase tracking-wide block mb-0.5">{t('register.step3.training_title')}</strong>
                            {t('register.step3.training_desc')}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-gray-950/30 border border-dashed border-white/10 rounded-2xl p-6 text-center text-gray-400 transition-all duration-300">
                        <Award className="w-10 h-10 mx-auto mb-2 text-gray-600 animate-bounce" />
                        <p className="text-xs font-sans max-w-sm mx-auto leading-relaxed">
                          {t('register.step3.opt_out_text')}
                        </p>
                      </div>
                    )}

                    {enableWhatsApp && (
                      /* Disclaimer Terms & Legal */
                      <div className="bg-gray-950/80 border border-white/10 rounded-xl p-3 space-y-2.5">
                        <label className="text-emerald-400 text-[9px] font-extrabold uppercase tracking-widest block">
                          {t('register.step3.legal_title')}
                        </label>
                        <div className="max-h-24 overflow-y-auto pr-2 text-[8px] text-gray-400 font-sans leading-relaxed scrollbar-thin scrollbar-thumb-white/10 space-y-1.5 border-b border-white/5 pb-2">
                          <p className="font-bold text-white text-center">ODISEA</p>
                          <p className="text-center">Aviso Legal, Términos de Uso y Privacidad</p>
                          <p className="font-bold text-yellow-500/90 mt-1 uppercase">1. Restricción de Edad — Solo Mayores de 18 Años</p>
                          <p>Al vincular WhatsApp, declaras bajo gravedad de juramento que eres mayor de 18 años y que la información suministrada es veraz y verificable.</p>
                          <p className="font-bold text-yellow-500/90 mt-1 uppercase">2. Protección de Datos Personales</p>
                          <p>En cumplimiento de la Ley 1581 de 2012, tus datos telefónicos se usarán únicamente para enviar recordatorios y notificaciones de aprendizaje. No se comparten con terceros.</p>
                          <p className="font-bold text-yellow-500/90 mt-1 uppercase">3. Revocación del Servicio</p>
                          <p>Puedes desactivar el servicio en cualquier momento desde esta tarjeta de aventurero o enviando la palabra STOP.</p>
                        </div>
                        
                        <div className="flex items-start gap-2 pt-1">
                          <input
                            id="acceptedTerms"
                            type="checkbox"
                            checked={acceptedTerms}
                            onChange={(e) => setAcceptedTerms(e.target.checked)}
                            className="w-3.5 h-3.5 rounded border-white/10 bg-gray-950 text-emerald-500 focus:ring-emerald-500 accent-emerald-500 mt-0.5 cursor-pointer"
                          />
                          <label htmlFor="acceptedTerms" className="text-[9px] text-gray-400 font-sans leading-normal cursor-pointer select-none">
                            {t('register.step3.legal_checkbox')}
                          </label>
                        </div>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={linkingWA || (enableWhatsApp && !acceptedTerms)}
                      className="w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-bold py-3 rounded-xl transition-all font-medieval uppercase tracking-widest border border-emerald-400 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:from-gray-700 disabled:to-gray-800 disabled:text-gray-500 disabled:border-gray-600"
                    >
                      {linkingWA ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>{t('register.step3.submitting')}</span>
                        </>
                      ) : (
                        <>
                          <span>{enableWhatsApp ? t('register.step3.submit') : 'PAUSAR / DESACTIVAR'}</span>
                          <Check className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </form>
                </>
              ) : (
                <div className="text-center animate-fade-in-slide space-y-4 py-2">
                  <div className="inline-flex p-3 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mb-1 animate-bounce">
                    <QrCode className="w-8 h-8" />
                  </div>
                  <h2 className="text-xl font-bold text-emerald-400 font-medieval uppercase tracking-wider">
                    {t('register.step4.title')}
                  </h2>
                  <p className="text-gray-300 text-xs leading-relaxed max-w-sm mx-auto font-sans">
                    {t('register.step4.subtitle')}
                  </p>

                  {/* QR Image */}
                  <div className="flex flex-col items-center justify-center bg-black/60 border-2 border-emerald-500/20 rounded-2xl p-4 max-w-[220px] mx-auto shadow-2xl">
                    <div className="bg-white p-2.5 rounded-xl border-4 border-emerald-500/10">
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(`https://wa.me/${botPhone}?text=${encodeURIComponent(activationMessage)}`)}`}
                        alt="WhatsApp Activation QR Code"
                        className="w-36 h-36 object-contain"
                      />
                    </div>
                    <span className="text-[8px] text-gray-500 font-sans mt-2 block leading-normal">
                      {t('register.step4.send_message')}<br />
                      <code className="text-emerald-400/80 font-mono text-[7.5px] bg-white/5 px-1 py-0.5 rounded italic block mt-1 leading-normal max-w-[180px] mx-auto whitespace-pre-line">
                        "{activationMessage}"
                      </code>
                    </span>
                  </div>

                  {/* Waiting Indicator */}
                  <div className="flex items-center justify-center gap-1.5 text-[9px] font-semibold text-emerald-400 animate-pulse bg-emerald-500/5 py-2 px-3 rounded-xl border border-emerald-500/10 max-w-[220px] mx-auto">
                    <Loader2 className="w-3 h-3 animate-spin text-emerald-400" />
                    <span>{t('register.step4.waiting_activation')}</span>
                  </div>

                  <div className="space-y-2 pt-2 max-w-[220px] mx-auto">
                    <a
                      href={`https://wa.me/${botPhone}?text=${encodeURIComponent(activationMessage)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-bold py-3 rounded-xl transition-all font-medieval uppercase tracking-widest border border-emerald-400 flex items-center justify-center gap-1.5 cursor-pointer text-center text-xs"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>{t('register.step4.open_whatsapp')}</span>
                    </a>
                    
                    <button
                      onClick={async () => {
                        setLinkingWA(true);
                        try {
                          await api.post('/auth/terms', { terms_accepted: true });
                          // Actualizar datos del contacto y cerrar modal
                          const res = await api.get('/whatsapp/contact');
                          setWhatsappContact(res.data);
                          setShowWhatsAppModal(false);
                        } catch (err) {
                          console.error("Failed to skip activation:", err);
                        } finally {
                          setLinkingWA(false);
                          setWaitingActivation(false);
                        }
                      }}
                      className="w-full bg-transparent hover:bg-white/5 border border-white/10 text-gray-400 font-bold py-2 rounded-xl transition-all text-[9px] uppercase tracking-wider font-medieval cursor-pointer"
                    >
                      {t('register.step4.skip_step')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
