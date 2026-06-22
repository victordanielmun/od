import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/authStore';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import {
  User, Mail, Lock, Check, ArrowRight, ChevronRight,
  Sparkles, Phone, Clock, Globe, AlertCircle, Loader2,
  BookOpen, Award, ShieldAlert, Compass, Eye, EyeOff, ChevronLeft,
  QrCode, Languages
} from 'lucide-react';
import { LANGUAGES } from '../common/LanguageSwitcher';
import { NPC_CONFIG } from '../../game/config/NPCConfig';
import { useRef } from 'react';

const Phaser = window.Phaser;

// Simple preview scene to render a single NPC portrait animation
class GuidePortraitScene extends Phaser.Scene {
  constructor(npcId) {
    super({ key: `guide-portrait-${npcId}-${Date.now()}` });
    this.npcId = npcId;
    this.animSprite = null;
  }

  preload() {
    const npcDef = NPC_CONFIG.npcs.find(n => n.id === this.npcId);
    if (!npcDef) return;
    
    const portraitSheet = npcDef.sheets.find(s => s.type === 'portrait');
    if (portraitSheet && portraitSheet.json) {
      const key = `npc-${this.npcId}-portrait`;
      if (!this.textures.exists(key)) {
        this.load.atlas(key, portraitSheet.path, portraitSheet.json);
      }
    }
  }

  create() {
    this.cameras.main.setBackgroundColor('#00000000');

    const npcDef = NPC_CONFIG.npcs.find(n => n.id === this.npcId);
    if (!npcDef) return;

    const npcAnims = NPC_CONFIG.animationsByNPC[this.npcId];
    if (!npcAnims) return;

    Object.entries(npcAnims).forEach(([animName, config]) => {
      if (animName.startsWith('portrait-')) {
        const textureKey = `npc-${this.npcId}-${config.type}`;
        const animKey = `npc-${this.npcId}-${animName}`;
        if (!this.anims.exists(animKey) && this.textures.exists(textureKey)) {
          this.anims.create({
            key: animKey,
            frames: config.frames.map(frameName => ({
              key: textureKey,
              frame: frameName
            })),
            frameRate: config.frameRate,
            repeat: config.repeat
          });
        }
      }
    });

    const textureKey = `npc-${this.npcId}-portrait`;
    if (this.textures.exists(textureKey)) {
      this.animSprite = this.add.sprite(100, 100, textureKey);
      this.animSprite.setScale(1.5);
      this.animSprite.setOrigin(0.5, 0.5);
      
      const animKey = `npc-${this.npcId}-portrait-idle`;
      if (this.anims.exists(animKey)) {
        this.animSprite.play(animKey, true);
      }
    }
  }
}

export const GuidePhaserPreview = ({ npcId }) => {
  const canvasRef = useRef(null);
  const gameRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !npcId) return;

    const scene = new GuidePortraitScene(npcId);

    const game = new Phaser.Game({
      type: Phaser.CANVAS,
      width: 200,
      height: 200,
      parent: canvasRef.current,
      backgroundColor: '#00000000',
      transparent: true,
      scene: scene,
      audio: { disableWebAudio: true, noAudio: true },
      physics: { default: 'arcade', arcade: { gravity: { y: 0 }, debug: false } },
      scale: { mode: Phaser.Scale.NONE },
      render: { pixelArt: true },
      input: {
        keyboard: false,
        mouse: false,
        touch: false,
        gamepad: false
      }
    });
    gameRef.current = game;

    return () => {
      game.destroy(true);
    };
  }, [npcId]);

  return (
    <div className="flex justify-center items-center rounded-2xl overflow-hidden bg-gray-950/85 border border-white/10 p-2 shadow-inner w-52 h-52">
      <div ref={canvasRef} style={{ width: 200, height: 200 }} />
    </div>
  );
};

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

export const RegisterForm = () => {
  const { t, i18n } = useTranslation();
  // Wizard steps
  const [step, setStep] = useState(1);

  // Step 1: Credentials
  // Native language seeds the i18n UI and the native_language sent on register.
  const [nativeLang, setNativeLang] = useState((i18n.language || 'en').split('-')[0].toLowerCase());
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [step1Error, setStep1Error] = useState('');
  const register = useAuthStore(state => state.register);
  const authError = useAuthStore(state => state.error);
  const user = useAuthStore(state => state.user);
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  const updateUser = useAuthStore(state => state.updateUser);
  
  // Step 2: Companion Guide
  const [guides, setGuides] = useState([]);
  const [selectedGuideId, setSelectedGuideId] = useState(null);
  const [guideIndex, setGuideIndex] = useState(0);
  const [loadingGuides, setLoadingGuides] = useState(false);
  const [step2Error, setStep2Error] = useState('');

  // Step 3: WhatsApp Settings
  const [enableWhatsApp, setEnableWhatsApp] = useState(true);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [countryCode, setCountryCode] = useState('+57');
  const [mobileNumber, setMobileNumber] = useState('');
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Bogota');
  const [preferredHourStart, setPreferredHourStart] = useState(8);
  const [preferredHourEnd, setPreferredHourEnd] = useState(21);
  const [step3Error, setStep3Error] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [waitingActivation, setWaitingActivation] = useState(false);
  const [botPhone, setBotPhone] = useState('');
  const [activationMessage, setActivationMessage] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  // Onboarding restore / redirect logic on mount
  useEffect(() => {
    if (isAuthenticated && step === 1) {
      if (user && user.companion_npc_id) {
        // Fully onboarded, skip to dashboard
        navigate('/dashboard');
      } else {
        // Logged in but missing guide - jump straight to Step 2
        setStep(2);
      }
    }
  }, [isAuthenticated, user, navigate, step]);

  // Polling to check if WhatsApp notifications have been activated
  useEffect(() => {
    if (!waitingActivation) return;

    let intervalId = setInterval(async () => {
      try {
        const res = await api.get('/whatsapp/contact');
        if (res.data && res.data.notifications_enabled) {
          clearInterval(intervalId);
          setWaitingActivation(false);
          // Auto-save terms and navigate
          await api.post('/auth/terms', { terms_accepted: true });
          navigate('/dashboard');
        }
      } catch (err) {
        console.error("Polling error checking contact status:", err);
      }
    }, 3000);

    return () => clearInterval(intervalId);
  }, [waitingActivation, navigate]);

  // Fallback guides definition if API call is empty or fails
  const fallbackGuides = [
    {
      id: 1001,
      name: "Aria",
      sprite: "aria_sprite",
      greeting: "Hello there, traveler! I am Aria, a skilled archer, and your guide to mastering the art of English pronunciation. Shall we practice speaking?",
      type: "guide",
      interaction_mode: "hybrid",
      voice_type: "female"
    },
    {
      id: 1002,
      name: "Eldrin",
      sprite: "eldrin_sprite",
      greeting: "Greetings, seeker of wisdom. I am Eldrin, master of arcane grammar. Let me aid you in weaving the complex threads of English structure into pure magic.",
      type: "guide",
      interaction_mode: "hybrid",
      voice_type: "male"
    },
    {
      id: 1003,
      name: "Thorin",
      sprite: "thorin_sprite",
      greeting: "Hail, warrior! Thorin here! If you want to keep your stamina high and build an unbreakable streak, I am your dwarf. Let's conquer these language challenges together!",
      type: "guide",
      interaction_mode: "hybrid",
      voice_type: "male"
    }
  ];

  // Fetch guides on Step 2 transition
  useEffect(() => {
    if (step === 2) {
      const fetchGuides = async () => {
        setLoadingGuides(true);
        setStep2Error('');
        try {
          const response = await api.get('/npcs/guides');
          if (response.data && response.data.length > 0) {
            setGuides(response.data);
            setSelectedGuideId(response.data[0].id);
            setGuideIndex(0);
          } else {
            setGuides(fallbackGuides);
            setSelectedGuideId(fallbackGuides[0].id);
            setGuideIndex(0);
          }
        } catch (err) {
          console.error("Failed to fetch guides, using fallbacks:", err);
          setGuides(fallbackGuides);
          setSelectedGuideId(fallbackGuides[0].id);
          setGuideIndex(0);
        } finally {
          setLoadingGuides(false);
        }
      };
      fetchGuides();
    }
  }, [step]);

  const handlePrevGuide = () => {
    if (guides.length === 0) return;
    const newIdx = (guideIndex - 1 + guides.length) % guides.length;
    setGuideIndex(newIdx);
    setSelectedGuideId(guides[newIdx].id);
  };

  const handleNextGuide = () => {
    if (guides.length === 0) return;
    const newIdx = (guideIndex + 1) % guides.length;
    setGuideIndex(newIdx);
    setSelectedGuideId(guides[newIdx].id);
  };

  const getPhaserNpcId = (guide) => {
    if (!guide) return '1';
    if (guide.sprite && !isNaN(guide.sprite)) return String(guide.sprite);
    
    const name = (guide.name || '').toLowerCase();
    if (name.includes('aria')) return '2';
    if (name.includes('eldrin')) return '4';
    if (name.includes('thorin')) return '1';
    
    const npcId = String((guide.id % 13) + 1);
    return npcId;
  };

  // Handle Step 1 Submit
  const handleStep1Submit = async (e) => {
    e.preventDefault();
    setStep1Error('');
    if (!username || !email || !password || !confirmPassword) {
      setStep1Error(t('register.step1.error_all_fields'));
      return;
    }
    if (password !== confirmPassword) {
      setStep1Error(t('register.step1.error_mismatch'));
      return;
    }
    setSubmitting(true);
    const success = await register(username, email, password);
    setSubmitting(false);
    if (success) {
      setStep(2);
    } else {
      setStep1Error(authError || t('register.step1.error_generic'));
    }
  };

  // Handle Step 2 Submit
  const handleStep2Submit = async () => {
    if (!selectedGuideId) {
      setStep2Error(t('register.step2.error_select'));
      return;
    }
    setSubmitting(true);
    setStep2Error('');
    try {
      await api.post('/auth/companion', { companion_npc_id: selectedGuideId });
      // Update local state and localStorage
      updateUser({ companion_npc_id: selectedGuideId });
      setStep(3);
    } catch (err) {
      console.error("Failed to save companion guide selection:", err);
      setStep2Error(t('register.step2.error_save'));
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Step 3 Submit
  const handleStep3Submit = async (e) => {
    e.preventDefault();
    if (!enableWhatsApp) {
      // User opted out, save terms acceptance and navigate to dashboard
      setSubmitting(true);
      try {
        await api.post('/auth/terms', { terms_accepted: true });
        navigate('/dashboard');
      } catch (err) {
        console.error("Failed to save terms:", err);
        setStep3Error(t('register.step3.error_terms'));
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (!mobileNumber) {
      setStep3Error(t('register.step3.error_phone'));
      return;
    }

    setSubmitting(true);
    setStep3Error('');
    try {
      const fullPhoneNumber = countryCode + mobileNumber.replace(/\D/g, ''); // strip any non-digits
      // 1. Save the contact initially with notifications disabled (pending activation)
      await api.post('/whatsapp/contact', {
        phone_number: fullPhoneNumber,
        whatsapp_name: username,
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
          
          // Generate a randomized warm-up message to avoid WhatsApp automated patterns
          const messages = [
            `¡Hola Odisea! Soy ${username}. Quiero recibir ayuda para mejorar mi inglés y activar mis notificaciones diarias.`,
            `Hola, me gustaría comenzar a practicar mi inglés con Odisea y activar mis notificaciones de aprendizaje. Mi usuario es ${username}.`,
            `Hola Odisea. Deseo iniciar mi entrenamiento diario de inglés. Por favor, activa las notificaciones para el usuario ${username}.`,
            `¡Hola! Estoy listo para el reto de inglés en Odisea con mi guía. Activa las notificaciones para ${username}.`
          ];
          const randIndex = Math.floor(Math.random() * messages.length);
          setActivationMessage(messages[randIndex]);
          setWaitingActivation(true);
        } else {
          // If the admin bot is not connected, gracefully skip activation check and proceed
          console.warn("Global bot is not open, skipping QR activation check.");
          await api.post('/auth/terms', { terms_accepted: true });
          navigate('/dashboard');
        }
      } catch (phoneErr) {
        console.error("Failed to fetch bot phone, proceeding to dashboard:", phoneErr);
        await api.post('/auth/terms', { terms_accepted: true });
        navigate('/dashboard');
      }
    } catch (err) {
      console.error("Failed to save WhatsApp settings:", err);
      const errMsg = err.response?.data?.error || t('register.step3.error_save');
      setStep3Error(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  // Guide detailed layout definitions (Visual theme styling dynamically assigned by ID/name)
  const getGuideDetails = (guide) => {
    const name = guide.name || 'Guía';
    const isAria = name.toLowerCase().includes('aria');
    const isEldrin = name.toLowerCase().includes('eldrin');
    
    // Fallback/Dynamic color theme assignation
    if (isAria || guide.id % 3 === 1) {
      return {
        cardGlow: "hover:shadow-[0_0_25px_rgba(16,185,129,0.15)]",
        selectedColor: "border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.3)] bg-emerald-950/20",
        colorHex: "#10b981",
        avatarColor: "from-emerald-600 to-teal-500"
      };
    } else if (isEldrin || guide.id % 3 === 2) {
      return {
        cardGlow: "hover:shadow-[0_0_25px_rgba(99,102,241,0.15)]",
        selectedColor: "border-indigo-500 shadow-[0_0_20px_rgba(99,102,241,0.3)] bg-indigo-950/20",
        colorHex: "#6366f1",
        avatarColor: "from-indigo-600 to-violet-500"
      };
    } else {
      return {
        cardGlow: "hover:shadow-[0_0_25px_rgba(245,158,11,0.15)]",
        selectedColor: "border-yellow-500 shadow-[0_0_20px_rgba(245,158,11,0.3)] bg-yellow-950/20",
        colorHex: "#f59e0b",
        avatarColor: "from-yellow-600 to-amber-500"
      };
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-6">
      {/* Dynamic inline styles for smooth keyframe slide-fade wizard transition */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes fadeInSlide {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in-slide {
          animation: fadeInSlide 0.45s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}} />

      {/* Medieval Timeline Wizard Progress Indicator */}
      <div className="mb-10 flex items-center justify-between max-w-xl mx-auto relative px-2">
        <div className="absolute top-1/2 left-0 right-0 h-[2px] bg-white/5 -translate-y-1/2 z-0"></div>
        <div className="absolute top-1/2 left-0 h-[2px] bg-gradient-to-r from-yellow-500/50 to-amber-500/50 -translate-y-1/2 z-0 transition-all duration-500 ease-out" style={{ width: `${((step - 1) / 2) * 100}%` }}></div>
        
        {/* Step 1 Circle */}
        <div className="relative z-10 flex flex-col items-center">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center font-medieval font-bold transition-all duration-300 ${
            step > 1 
              ? 'bg-yellow-500 text-black shadow-[0_0_15px_rgba(245,158,11,0.4)]' 
              : step === 1 
                ? 'bg-gray-900 border-2 border-yellow-500 text-yellow-400 shadow-[0_0_15px_rgba(245,158,11,0.3)]' 
                : 'bg-gray-950 border border-white/10 text-gray-500'
          }`}>
            {step > 1 ? <Check className="w-4 h-4 stroke-[3px]" /> : 'I'}
          </div>
          <span className={`text-[10px] uppercase font-bold tracking-wider mt-2 transition-colors duration-300 ${step === 1 ? 'text-yellow-400' : 'text-gray-500'}`}>{t('register.timeline.account')}</span>
        </div>

        {/* Step 2 Circle */}
        <div className="relative z-10 flex flex-col items-center">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center font-medieval font-bold transition-all duration-300 ${
            step > 2 
              ? 'bg-yellow-500 text-black shadow-[0_0_15px_rgba(245,158,11,0.4)]' 
              : step === 2 
                ? 'bg-gray-900 border-2 border-yellow-500 text-yellow-400 shadow-[0_0_15px_rgba(245,158,11,0.3)]' 
                : 'bg-gray-950 border border-white/10 text-gray-500'
          }`}>
            {step > 2 ? <Check className="w-4 h-4 stroke-[3px]" /> : 'II'}
          </div>
          <span className={`text-[10px] uppercase font-bold tracking-wider mt-2 transition-colors duration-300 ${step === 2 ? 'text-yellow-400' : 'text-gray-500'}`}>{t('register.timeline.guide')}</span>
        </div>

        {/* Step 3 Circle */}
        <div className="relative z-10 flex flex-col items-center">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center font-medieval font-bold transition-all duration-300 ${
            step === 3 
              ? 'bg-gray-900 border-2 border-yellow-500 text-yellow-400 shadow-[0_0_15px_rgba(245,158,11,0.3)]' 
              : 'bg-gray-950 border border-white/10 text-gray-500'
          }`}>
            {'III'}
          </div>
          <span className={`text-[10px] uppercase font-bold tracking-wider mt-2 transition-colors duration-300 ${step === 3 ? 'text-yellow-400' : 'text-gray-500'}`}>{t('register.timeline.whatsapp')}</span>
        </div>
      </div>

      {/* Main Glassmorphic Onboarding Wizard Container */}
      <div className="bg-gray-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 md:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative overflow-hidden transition-all duration-500 animate-fade-in-slide">
        
        {/* Subtle glowing ambient lighting */}
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-yellow-500/5 rounded-full filter blur-[100px] pointer-events-none z-0"></div>
        <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-amber-500/5 rounded-full filter blur-[100px] pointer-events-none z-0"></div>

        <div className="relative z-10">
          
          {/* STEP 1: CREDENTIALS FORM */}
          {step === 1 && (
            <div className="max-w-md mx-auto">
              <div className="text-center mb-8">
                <div className="inline-flex p-3 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 mb-3 shadow-[0_0_15px_rgba(245,158,11,0.1)]">
                  <Sparkles className="w-6 h-6 animate-pulse" />
                </div>
                <h2 className="text-2xl md:text-3xl font-extrabold text-yellow-400 font-medieval uppercase tracking-widest drop-shadow-md">
                  {t('register.step1.title')}
                </h2>
                <p className="text-gray-400 text-xs mt-1.5 font-sans tracking-wide">
                  {t('register.step1.subtitle')}
                </p>
              </div>

              {(step1Error || authError) && (
                <div className="text-red-400 mb-6 text-xs font-mono uppercase bg-red-500/10 border border-red-500/20 p-3 rounded-xl text-center flex items-center justify-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{step1Error || authError}</span>
                </div>
              )}

              <form onSubmit={handleStep1Submit} className="space-y-5">
                <div>
                  <label htmlFor="nativeLang" className="text-gray-400 text-[10px] font-extrabold uppercase tracking-widest block mb-2 flex items-center gap-1.5">
                    <Languages className="w-3.5 h-3.5" />
                    <span>{t('register.step1.language')}</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none">
                      <Globe className="w-4.5 h-4.5" />
                    </span>
                    <select
                      id="nativeLang"
                      value={nativeLang}
                      onChange={(e) => {
                        const code = e.target.value;
                        setNativeLang(code);
                        // Drive the i18n UI now; register() reads this as native_language on submit.
                        i18n.changeLanguage(code);
                      }}
                      className="w-full bg-gray-950/60 text-white border border-white/10 rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition-all font-sans text-sm cursor-pointer appearance-none"
                    >
                      {LANGUAGES.map((lang) => (
                        <option key={lang.code} value={lang.code}>
                          {lang.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <span className="text-[10px] text-gray-500 font-sans mt-1.5 block leading-normal">
                    {t('register.step1.language_help')}
                  </span>
                </div>

                <div>
                  <label htmlFor="username" className="text-gray-400 text-[10px] font-extrabold uppercase tracking-widest block mb-2">
                    {t('register.step1.username')}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500">
                      <User className="w-4.5 h-4.5" />
                    </span>
                    <input
                      id="username"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full bg-gray-950/60 text-white border border-white/10 rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition-all font-sans placeholder-gray-600 text-sm"
                      placeholder={t('register.step1.username_placeholder')}
                      minLength={3}
                      maxLength={20}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="email" className="text-gray-400 text-[10px] font-extrabold uppercase tracking-widest block mb-2">
                    {t('register.step1.email')}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500">
                      <Mail className="w-4.5 h-4.5" />
                    </span>
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-gray-950/60 text-white border border-white/10 rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition-all font-sans placeholder-gray-600 text-sm"
                      placeholder={t('register.step1.email_placeholder')}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="password" className="text-gray-400 text-[10px] font-extrabold uppercase tracking-widest block mb-2">
                    {t('register.step1.password')}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500">
                      <Lock className="w-4.5 h-4.5" />
                    </span>
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-gray-950/60 text-white border border-white/10 rounded-xl pl-10 pr-10 py-3 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition-all font-sans placeholder-gray-600 text-sm"
                      placeholder="••••••••"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-500 hover:text-white cursor-pointer"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="text-gray-400 text-[10px] font-extrabold uppercase tracking-widest block mb-2">
                    {t('register.step1.confirm_password')}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500">
                      <Lock className="w-4.5 h-4.5" />
                    </span>
                    <input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full bg-gray-950/60 text-white border border-white/10 rounded-xl pl-10 pr-10 py-3 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition-all font-sans placeholder-gray-600 text-sm"
                      placeholder="••••••••"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-500 hover:text-white cursor-pointer"
                    >
                      {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full mt-6 bg-gradient-to-r from-yellow-500 via-amber-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-black font-extrabold py-3.5 rounded-xl transition-all font-medieval uppercase tracking-widest shadow-[0_0_20px_rgba(245,158,11,0.15)] hover:shadow-[0_0_25px_rgba(245,158,11,0.35)] border border-yellow-300 cursor-pointer flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>{t('register.step1.submitting')}</span>
                    </>
                  ) : (
                    <>
                      <span>{t('register.step1.submit')}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-8 text-center text-xs tracking-wide border-t border-white/5 pt-5">
                <span className="text-gray-500">{t('register.step1.has_account')} </span>
                <a href="/login" className="text-yellow-400 hover:text-yellow-300 font-bold transition-colors">
                  {t('register.step1.login_link')}
                </a>
              </div>
            </div>
          )}

          {/* STEP 2: CHOOSE COMPANION NPC */}
          {step === 2 && (
            <div className="animate-fade-in-slide">
              <div className="text-center mb-8">
                <div className="inline-flex p-3 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 mb-3 shadow-[0_0_15px_rgba(245,158,11,0.1)]">
                  <Compass className="w-6 h-6 animate-spin-slow" />
                </div>
                <h2 className="text-2xl md:text-3xl font-extrabold text-yellow-400 font-medieval uppercase tracking-widest drop-shadow-md">
                  {t('register.step2.title')}
                </h2>
                <p className="text-gray-400 text-xs mt-1.5 font-sans tracking-wide max-w-lg mx-auto">
                  {t('register.step2.subtitle')}
                </p>
              </div>

              {step2Error && (
                <div className="text-red-400 mb-6 text-xs font-mono uppercase bg-red-500/10 border border-red-500/20 p-3 rounded-xl text-center flex items-center justify-center gap-2 max-w-lg mx-auto">
                  <AlertCircle className="w-4 h-4" />
                  <span>{step2Error}</span>
                </div>
              )}

              {loadingGuides ? (
                <div className="py-20 flex flex-col items-center justify-center gap-3">
                  <Loader2 className="w-10 h-10 animate-spin text-yellow-400" />
                  <span className="text-gray-400 text-sm font-medieval tracking-widest uppercase">{t('register.step2.loading')}</span>
                </div>
              ) : (
                <div className="flex items-center justify-between max-w-2xl mx-auto gap-4 mb-8">
                  {/* Left Arrow */}
                  <button
                    type="button"
                    onClick={handlePrevGuide}
                    className="p-3 rounded-full bg-gray-950/60 border border-white/10 hover:border-yellow-500 hover:text-yellow-400 text-gray-400 active:scale-95 transition-all shadow-xl cursor-pointer"
                    title={t('register.step2.prev')}
                  >
                    <ChevronLeft size={24} />
                  </button>

                  {/* Large Central Guide Card */}
                  {guides.length > 0 && (
                    (() => {
                      const currentGuide = guides[guideIndex];
                      const details = getGuideDetails(currentGuide);
                      return (
                        <div className={`flex-1 relative flex flex-col items-center border rounded-3xl p-8 bg-gray-950/40 backdrop-blur-md shadow-2xl transition-all duration-500 overflow-hidden ${details.selectedColor} ${details.cardGlow}`}>
                          {/* Ambient background glow */}
                          <div 
                            className="absolute -right-16 -bottom-16 w-48 h-48 rounded-full filter blur-[50px] opacity-10 pointer-events-none"
                            style={{ backgroundColor: details.colorHex }}
                          ></div>

                          {/* Animated Phaser Preview */}
                          <div className="mb-6 relative z-10">
                            <GuidePhaserPreview npcId={getPhaserNpcId(currentGuide)} />
                          </div>

                          {/* Info */}
                          <div className="text-center relative z-10 max-w-md w-full">
                            <h3 className="text-3xl font-extrabold text-white font-medieval uppercase tracking-widest drop-shadow-md mb-2">
                              {currentGuide.name}
                            </h3>
                            
                            <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/5 text-xs text-gray-400 mb-4 font-sans tracking-wide">
                              <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></span>
                              <span>{currentGuide.type === 'guide' ? t('register.step2.companion') : t('register.step2.mentor')}</span>
                            </div>

                            <p className="text-gray-300 text-sm italic font-serif leading-relaxed px-4 min-h-[80px]">
                              "{currentGuide.greeting || t('register.step2.ready')}"
                            </p>
                          </div>
                        </div>
                      );
                    })()
                  )}

                  {/* Right Arrow */}
                  <button
                    type="button"
                    onClick={handleNextGuide}
                    className="p-3 rounded-full bg-gray-950/60 border border-white/10 hover:border-yellow-500 hover:text-yellow-400 text-gray-400 active:scale-95 transition-all shadow-xl cursor-pointer"
                    title={t('register.step2.next')}
                  >
                    <ChevronRight size={24} />
                  </button>
                </div>
              )}

              <div className="flex justify-center max-w-sm mx-auto">
                <button
                  onClick={handleStep2Submit}
                  disabled={submitting || loadingGuides}
                  className="w-full bg-gradient-to-r from-yellow-500 via-amber-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-black font-extrabold py-3.5 rounded-xl transition-all font-medieval uppercase tracking-widest shadow-[0_0_20px_rgba(245,158,11,0.15)] hover:shadow-[0_0_25px_rgba(245,158,11,0.35)] border border-yellow-300 cursor-pointer flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>{t('register.step2.submitting')}</span>
                    </>
                  ) : (
                    <>
                      <span>{t('register.step2.submit')}</span>
                      <ChevronRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: WHATSAPP NOTIFICATION SETTINGS */}
          {step === 3 && (
            <div className="max-w-xl mx-auto animate-fade-in-slide">
              {!waitingActivation ? (
                <>
                  <div className="text-center mb-8">
                    <div className="inline-flex p-3 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 mb-3 shadow-[0_0_15px_rgba(245,158,11,0.1)]">
                      <Phone className="w-6 h-6 animate-pulse" />
                    </div>
                    <h2 className="text-2xl md:text-3xl font-extrabold text-yellow-400 font-medieval uppercase tracking-widest drop-shadow-md">
                      {t('register.step3.title')}
                    </h2>
                    <p className="text-gray-400 text-xs mt-1.5 font-sans tracking-wide">
                      {t('register.step3.subtitle')}
                    </p>
                  </div>

                  {step3Error && (
                    <div className="text-red-400 mb-6 text-xs font-mono uppercase bg-red-500/10 border border-red-500/20 p-3 rounded-xl text-center flex items-center justify-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{step3Error}</span>
                    </div>
                  )}

                  {/* Elegant glow switch buttons */}
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <button
                      type="button"
                      onClick={() => setEnableWhatsApp(true)}
                      className={`border rounded-xl p-4 text-center cursor-pointer transition-all duration-300 font-medieval uppercase tracking-wider text-xs ${
                        enableWhatsApp 
                          ? 'border-yellow-500 bg-yellow-500/10 text-yellow-400 shadow-[0_0_15px_rgba(245,158,11,0.2)] font-black' 
                          : 'border-white/10 text-gray-500 hover:text-gray-400 bg-gray-950/20'
                      }`}
                    >
                      <Sparkles className="w-4 h-4 mx-auto mb-1.5 opacity-80" />
                      <span>{t('register.step3.yes_reminders')}</span>
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => setEnableWhatsApp(false)}
                      className={`border rounded-xl p-4 text-center cursor-pointer transition-all duration-300 font-medieval uppercase tracking-wider text-xs ${
                        !enableWhatsApp 
                          ? 'border-gray-500 bg-white/5 text-gray-300 shadow-[0_0_15px_rgba(255,255,255,0.05)] font-black' 
                          : 'border-white/10 text-gray-500 hover:text-gray-400 bg-gray-950/20'
                      }`}
                    >
                      <ShieldAlert className="w-4 h-4 mx-auto mb-1.5 opacity-80" />
                      <span>{t('register.step3.no_reminders')}</span>
                    </button>
                  </div>

                  <form onSubmit={handleStep3Submit} className="space-y-6">
                    {enableWhatsApp ? (
                      <div className="bg-gray-950/40 border border-white/5 rounded-2xl p-5 md:p-6 space-y-5 transition-all duration-500 animate-fade-in-slide">
                        
                        <div>
                          <label htmlFor="mobileNumber" className="text-gray-400 text-[10px] font-extrabold uppercase tracking-widest block mb-2">
                            {t('register.step3.phone_label')}
                          </label>
                          <div className="flex gap-2.5">
                            {/* Country Code Select */}
                            <div className="w-1/3 min-w-[140px]">
                              <select
                                value={countryCode}
                                onChange={(e) => setCountryCode(e.target.value)}
                                className="w-full bg-gray-950/80 text-white border border-white/10 rounded-xl px-3.5 py-3.5 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition-all font-sans text-sm cursor-pointer"
                              >
                                {COUNTRY_CODES.map((c) => (
                                  <option key={c.code} value={c.code}>
                                    {c.flag} {c.code} ({c.country})
                                  </option>
                                ))}
                              </select>
                            </div>
                            
                            {/* Mobile Number Input */}
                            <div className="flex-1 relative">
                              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500">
                                <Phone className="w-4 h-4" />
                              </span>
                              <input
                                id="mobileNumber"
                                type="tel"
                                value={mobileNumber}
                                onChange={(e) => setMobileNumber(e.target.value)}
                                className="w-full bg-gray-950/80 text-white border border-white/10 rounded-xl pl-10 pr-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition-all font-sans placeholder-gray-600 text-sm"
                                placeholder="3001234567"
                                required={enableWhatsApp}
                              />
                            </div>
                          </div>
                          <span className="text-[10px] text-gray-500 font-sans mt-1.5 block leading-normal">
                            {t('register.step3.phone_help')}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label htmlFor="timezone" className="text-gray-400 text-[10px] font-extrabold uppercase tracking-widest block mb-2 flex items-center gap-1.5">
                              <Globe className="w-3.5 h-3.5" />
                              <span>{t('register.step3.timezone_label')}</span>
                            </label>
                            <select
                              id="timezone"
                              value={timezone}
                              onChange={(e) => setTimezone(e.target.value)}
                              className="w-full bg-gray-950/80 text-white border border-white/10 rounded-xl px-3.5 py-3 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition-all font-sans text-sm cursor-pointer"
                            >
                              <option value="America/Bogota">Bogotá, Lima, Quito (GMT-5)</option>
                              <option value="America/Mexico_City">Ciudad de México (GMT-6)</option>
                              <option value="America/Lima">Lima, Perú (GMT-5)</option>
                              <option value="America/Santiago">Santiago, Chile (GMT-4)</option>
                              <option value="America/Caracas">Caracas, Venezuela (GMT-4)</option>
                              <option value="America/Buenos_Aires">Buenos Aires, Argentina (GMT-3)</option>
                              <option value="America/Madrid">Madrid, España (GMT+1/GMT+2)</option>
                              <option value="America/New_York">Nueva York (GMT-5)</option>
                              <option value="Europe/London">Londres (GMT)</option>
                            </select>
                          </div>

                          <div>
                            <label htmlFor="hours" className="text-gray-400 text-[10px] font-extrabold uppercase tracking-widest block mb-2 flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5" />
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
                                  className="w-full bg-gray-950/80 text-white border border-white/10 rounded-xl px-3 py-3 text-center focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition-all font-sans text-sm"
                                />
                                <span className="absolute bottom-1 right-2 text-[8px] text-gray-500 font-mono">{t('register.step3.hours_start')}</span>
                              </div>
                              <span className="text-gray-600 font-bold font-sans">{t('register.step3.hours_to')}</span>
                              <div className="relative flex-1">
                                <input
                                  type="number"
                                  min="0"
                                  max="23"
                                  value={preferredHourEnd}
                                  onChange={(e) => setPreferredHourEnd(e.target.value)}
                                  className="w-full bg-gray-950/80 text-white border border-white/10 rounded-xl px-3 py-3 text-center focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition-all font-sans text-sm"
                                />
                                <span className="absolute bottom-1 right-2 text-[8px] text-gray-500 font-mono">{t('register.step3.hours_end')}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="bg-yellow-500/5 border border-yellow-500/10 rounded-xl p-3.5 flex gap-3 text-left">
                          <BookOpen className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
                          <div className="text-[10px] text-gray-400 font-sans leading-normal">
                            <strong className="text-yellow-400 font-bold uppercase tracking-wide block mb-0.5">{t('register.step3.training_title')}</strong>
                            {t('register.step3.training_desc')}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-gray-950/30 border border-dashed border-white/10 rounded-2xl p-6 text-center text-gray-400 transition-all duration-500">
                        <Award className="w-10 h-10 mx-auto mb-2 text-gray-600 animate-bounce" />
                        <p className="text-xs font-sans max-w-sm mx-auto leading-relaxed">
                          {t('register.step3.opt_out_text')}
                        </p>
                      </div>
                    )}

                    {/* Immersive Scrollable Terms of Service (Disclaimer) */}
                    <div className="bg-gray-950/80 border border-white/10 rounded-xl p-4 space-y-3">
                      <label className="text-yellow-400 text-[10px] font-extrabold uppercase tracking-widest block">
                        {t('register.step3.legal_title')}
                      </label>
                      <div className="max-h-32 overflow-y-auto pr-2 text-[9px] text-gray-400 font-sans leading-relaxed scrollbar-thin scrollbar-thumb-white/10 space-y-2 border-b border-white/5 pb-2.5">
                        <p className="font-bold text-white text-center">ODISEA</p>
                        <p className="text-center font-bold text-gray-300">Plataforma de Aprendizaje de Inglés Gamificada</p>
                        <p className="text-center font-semibold text-gray-300">AVISO LEGAL, TÉRMINOS DE USO Y POLÍTICA DE PRIVACIDAD</p>
                        <p className="text-center">Versión: 1.0 — Mayo 2026</p>
                        <p className="text-center">Aplicable a: Usuarios registrados en la plataforma Odisea</p>
                        <p className="text-center">Marco legal: Ley 1581 de 2012 (Colombia) · Decreto 1377 de 2013 · Ley 1273 de 2009</p>
                        
                        <p className="font-bold text-yellow-500/90 uppercase tracking-wide mt-2">1. Aceptación de los Términos</p>
                        <p>Al registrarte en Odisea, confirmas que has leído, comprendido y aceptas en su totalidad los presentes términos. Si no estás de acuerdo con alguna disposición, debes abstenerte de usar la plataforma.</p>
                        
                        <p className="font-bold text-yellow-500/90 uppercase tracking-wide mt-2 flex items-center gap-1">2. Restricción de Edad — Solo Mayores de 18 Años</p>
                        <p className="text-amber-400">⚠️ Odisea es una plataforma diseñada exclusivamente para mayores de 18 años.</p>
                        <p>Al completar el proceso de registro, el usuario declara bajo la gravedad de juramento que:</p>
                        <ul className="list-disc pl-4 space-y-1">
                          <li>Tiene 18 años de edad cumplidos o más al momento del registro.</li>
                          <li>La información suministrada durante el registro es veraz y verificable.</li>
                          <li>Comprende que el acceso por menores de edad está estrictamente prohibido.</li>
                        </ul>
                        <p>Odisea se reserva el derecho de suspender o eliminar permanentemente cualquier cuenta cuyo titular no cumpla el requisito de edad, sin previo aviso y sin derecho a reembolso.</p>
                        
                        <p className="font-bold text-yellow-500/90 uppercase tracking-wide mt-2">3. Protección de Datos Personales</p>
                        <p>En cumplimiento de la Ley Estatutaria 1581 de 2012 y el Decreto Reglamentario 1377 de 2013, Odisea informa al usuario:</p>
                        <p className="font-semibold text-white">3.1 Datos que recopilamos</p>
                        <ul className="list-disc pl-4 space-y-1">
                          <li>Nombre y apellidos</li>
                          <li>Correo electrónico</li>
                          <li>Número de teléfono / WhatsApp (cuando el usuario lo proporciona voluntariamente)</li>
                          <li>Datos de uso y progreso dentro de la plataforma</li>
                          <li>Grabaciones de voz cuando el usuario utiliza funciones de pronunciación</li>
                        </ul>
                        <p className="font-semibold text-white">3.2 Finalidad del tratamiento</p>
                        <p>Los datos recopilados se utilizarán exclusivamente para:</p>
                        <ul className="list-disc pl-4 space-y-1">
                          <li>Personalizar la experiencia de aprendizaje dentro de Odisea.</li>
                          <li>Enviar recordatorios y mensajes motivacionales a través de WhatsApp (únicamente con autorización expresa del usuario).</li>
                          <li>Generar estadísticas de progreso individual.</li>
                          <li>Mejorar los algoritmos de enseñanza de la plataforma.</li>
                        </ul>
                        <p className="font-semibold text-white">3.3 No compartimos tus datos con terceros</p>
                        <p>Odisea NO vende, alquila, cede ni comparte tu información personal con terceros bajo ninguna circunstancia, salvo:</p>
                        <ul className="list-disc pl-4 space-y-1">
                          <li>Orden judicial o requerimiento de autoridad competente colombiana.</li>
                          <li>Proveedores de infraestructura técnica (almacenamiento en nube), quienes están contractualmente obligados a mantener la confidencialidad de los datos.</li>
                        </ul>
                        <p className="italic text-yellow-500/70">Tus datos son tuyos. Solo los usamos para hacer de Odisea una mejor experiencia para ti.</p>
                        
                        <p className="font-bold text-yellow-500/90 uppercase tracking-wide mt-2">4. Comunicaciones por WhatsApp</p>
                        <p>El envío de mensajes, recordatorios y contenido motivacional a través de WhatsApp es completamente opcional y requiere autorización expresa del usuario.</p>
                        <ul className="list-disc pl-4 space-y-1">
                          <li>Puedes activar o desactivar las notificaciones en cualquier momento desde la configuración de tu cuenta.</li>
                          <li>Puedes solicitar la suspensión temporal o permanente del envío de mensajes respondiendo "STOP" en cualquier momento.</li>
                          <li>Los datos de tu número de teléfono no serán compartidos con terceros bajo ningún concepto.</li>
                          <li>Las conversaciones son procesadas de forma segura y utilizadas únicamente para personalizar tu experiencia de aprendizaje.</li>
                        </ul>
                        
                        <p className="font-bold text-yellow-500/90 uppercase tracking-wide mt-2">5. Entorno Multijugador — Responsabilidad del Usuario</p>
                        <p>Odisea es una plataforma con componentes multijugador que permite la interacción entre usuarios registrados. Al participar en funciones multijugador, el usuario reconoce y acepta lo siguiente:</p>
                        <p className="font-semibold text-white">5.1 Responsabilidad de terceros</p>
                        <p>Odisea no puede controlar ni garantizar el comportamiento de otros usuarios de la plataforma. Las interacciones entre jugadores son responsabilidad de cada usuario individualmente. Odisea no se hace responsable por:</p>
                        <ul className="list-disc pl-4 space-y-1">
                          <li>Comentarios, mensajes o conductas inapropiadas de otros jugadores.</li>
                          <li>Experiencias negativas derivadas de interacciones entre usuarios.</li>
                          <li>Contenido generado por usuarios que no haya sido reportado a través de los canales oficiales.</li>
                        </ul>
                        <p className="font-semibold text-white">5.2 Sistema de reporte</p>
                        <p>Odisea pone a disposición de sus usuarios un sistema de reporte para denunciar conductas inapropiadas. Al reportar un jugador:</p>
                        <ul className="list-disc pl-4 space-y-1">
                          <li>El reporte será revisado por el equipo de moderación en un plazo máximo de 72 horas hábiles.</li>
                          <li>Odisea podrá suspender temporal o permanentemente las cuentas que incumplan las normas de convivencia.</li>
                          <li>El usuario reportante mantendrá el anonimato frente al usuario reportado.</li>
                        </ul>
                        <p>Para reportar un jugador: accede a su perfil dentro del juego y selecciona la opción "Reportar", o escríbenos a soporte@odiseagame.co</p>
                        <p className="font-semibold text-white">5.3 Conductas prohibidas</p>
                        <p>Queda estrictamente prohibido en la plataforma:</p>
                        <ul className="list-disc pl-4 space-y-1">
                          <li>Acoso, hostigamiento o discriminación hacia otros usuarios.</li>
                          <li>Uso de lenguaje ofensivo, amenazante o inapropiado.</li>
                          <li>Suplantación de identidad de otros jugadores o del equipo de Odisea.</li>
                          <li>Compartir información personal de otros usuarios sin su consentimiento.</li>
                          <li>Cualquier conducta que vulnere la Ley 1273 de 2009 sobre delitos informáticos.</li>
                        </ul>
                        
                        <p className="font-bold text-yellow-500/90 uppercase tracking-wide mt-2">6. Derechos del Usuario (Habeas Data)</p>
                        <p>En cumplimiento del artículo 8 de la Ley 1581 de 2012, el usuario tiene derecho a:</p>
                        <ul className="list-disc pl-4 space-y-1">
                          <li>Conocer, actualizar y rectificar sus datos personales en cualquier momento.</li>
                          <li>Solicitar la supresión de sus datos cuando no exista obligación legal de conservarlos.</li>
                          <li>Revocar la autorización de tratamiento de datos en cualquier momento.</li>
                          <li>Presentar quejas ante la Superintendencia de Industria y Comercio (SIC).</li>
                        </ul>
                        <p>Para ejercer estos derechos, escríbenos a: privacidad@odiseagame.co</p>
                        
                        <p className="font-bold text-yellow-500/90 uppercase tracking-wide mt-2">7. Modificaciones a este Aviso</p>
                        <p>Odisea se reserva el derecho de actualizar estos términos en cualquier momento. Los cambios serán notificados a través de la plataforma y/o correo electrónico con un mínimo de 15 días de anticipación. El uso continuado de la plataforma después de dicha notificación implica la aceptación de los nuevos términos.</p>
                      </div>
                      
                      <div className="flex items-start gap-3 mt-3">
                        <input
                          id="acceptedTerms"
                          type="checkbox"
                          checked={acceptedTerms}
                          onChange={(e) => setAcceptedTerms(e.target.checked)}
                          className="w-4 h-4 rounded border-white/10 bg-gray-950 text-yellow-500 focus:ring-yellow-500 accent-yellow-500 mt-0.5 cursor-pointer"
                        />
                        <label htmlFor="acceptedTerms" className="text-[10px] text-gray-400 font-sans leading-normal cursor-pointer select-none">
                          {t('register.step3.legal_checkbox')}
                        </label>
                      </div>
                    </div>

                    <div className="flex justify-center max-w-sm mx-auto pt-3">
                      <button
                        type="submit"
                        disabled={submitting || !acceptedTerms}
                        className="w-full bg-gradient-to-r from-yellow-500 via-amber-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-black font-extrabold py-3.5 rounded-xl transition-all font-medieval uppercase tracking-widest shadow-[0_0_20px_rgba(245,158,11,0.15)] hover:shadow-[0_0_25px_rgba(245,158,11,0.35)] border border-yellow-300 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none disabled:from-gray-700 disabled:to-gray-800 disabled:text-gray-500 disabled:border-gray-600"
                      >
                        {submitting ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            <span>{t('register.step3.submitting')}</span>
                          </>
                        ) : (
                          <>
                            <span>{t('register.step3.submit')}</span>
                            <Check className="w-5 h-5 stroke-[2.5px]" />
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </>
              ) : (
                <div className="max-w-md mx-auto text-center animate-fade-in-slide space-y-6 py-4">
                  <div className="inline-flex p-3 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 mb-2 shadow-[0_0_15px_rgba(245,158,11,0.1)] animate-bounce">
                    <QrCode className="w-8 h-8" />
                  </div>
                  <h2 className="text-2xl font-extrabold text-yellow-400 font-medieval uppercase tracking-widest">
                    {t('register.step4.title')}
                  </h2>
                  <p className="text-gray-300 text-xs leading-relaxed max-w-sm mx-auto font-sans">
                    {t('register.step4.subtitle')}
                  </p>

                  {/* QR Image Container */}
                  <div className="flex flex-col items-center justify-center bg-black/60 border-2 border-yellow-500/20 rounded-2xl p-6 max-w-xs mx-auto shadow-2xl">
                    <div className="bg-white p-3 rounded-xl shadow-[0_0_30px_rgba(245,158,11,0.1)] border-4 border-yellow-500/10">
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(`https://wa.me/${botPhone}?text=${encodeURIComponent(activationMessage)}`)}`}
                        alt="WhatsApp Activation QR Code"
                        className="w-44 h-44 object-contain"
                      />
                    </div>
                    <span className="text-[9px] text-gray-500 font-sans mt-3 block leading-normal">
                      {t('register.step4.send_message')}<br />
                      <code className="text-yellow-500/80 font-mono text-[8px] bg-white/5 px-1.5 py-0.5 rounded italic block mt-1 leading-normal max-w-[200px] mx-auto whitespace-pre-line">
                        "{activationMessage}"
                      </code>
                    </span>
                  </div>

                  {/* Pulse Active Indicator */}
                  <div className="flex items-center justify-center gap-2 text-[10px] font-semibold text-yellow-400 animate-pulse bg-yellow-500/5 py-2.5 px-4 rounded-xl border border-yellow-500/10 max-w-xs mx-auto">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-yellow-400" />
                    <span>{t('register.step4.waiting_activation')}</span>
                  </div>

                  <div className="space-y-3 pt-2 max-w-xs mx-auto">
                    <a
                      href={`https://wa.me/${botPhone}?text=${encodeURIComponent(activationMessage)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full bg-gradient-to-r from-yellow-500 via-amber-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-black font-extrabold py-3.5 rounded-xl transition-all font-medieval uppercase tracking-widest shadow-[0_0_20px_rgba(245,158,11,0.15)] border border-yellow-300 flex items-center justify-center gap-2 cursor-pointer text-center text-xs"
                    >
                      <Phone className="w-4 h-4" />
                      <span>{t('register.step4.open_whatsapp')}</span>
                    </a>
                    
                    <button
                      onClick={async () => {
                        setSubmitting(true);
                        try {
                          await api.post('/auth/terms', { terms_accepted: true });
                          navigate('/dashboard');
                        } catch (err) {
                          console.error("Failed to skip activation:", err);
                        } finally {
                          setSubmitting(false);
                        }
                      }}
                      className="w-full bg-transparent hover:bg-white/5 border border-white/10 text-gray-400 font-bold py-2.5 rounded-xl transition-all text-[10px] uppercase tracking-wider font-medieval cursor-pointer"
                    >
                      {t('register.step4.skip_step')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
