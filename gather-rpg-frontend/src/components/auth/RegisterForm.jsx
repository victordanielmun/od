import { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { 
  User, Mail, Lock, Check, ArrowRight, ChevronRight, 
  Sparkles, Phone, Clock, Globe, AlertCircle, Loader2,
  BookOpen, Award, ShieldAlert, Compass
} from 'lucide-react';

export const RegisterForm = () => {
  // Wizard steps
  const [step, setStep] = useState(1);
  
  // Step 1: Credentials
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [step1Error, setStep1Error] = useState('');
  const register = useAuthStore(state => state.register);
  const authError = useAuthStore(state => state.error);
  const user = useAuthStore(state => state.user);
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  const updateUser = useAuthStore(state => state.updateUser);
  
  // Step 2: Companion Guide
  const [guides, setGuides] = useState([]);
  const [selectedGuideId, setSelectedGuideId] = useState(null);
  const [loadingGuides, setLoadingGuides] = useState(false);
  const [step2Error, setStep2Error] = useState('');

  // Step 3: WhatsApp Settings
  const [enableWhatsApp, setEnableWhatsApp] = useState(true);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Bogota');
  const [preferredHourStart, setPreferredHourStart] = useState(8);
  const [preferredHourEnd, setPreferredHourEnd] = useState(21);
  const [step3Error, setStep3Error] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);

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
          } else {
            setGuides(fallbackGuides);
            setSelectedGuideId(fallbackGuides[0].id);
          }
        } catch (err) {
          console.error("Failed to fetch guides, using fallbacks:", err);
          setGuides(fallbackGuides);
          setSelectedGuideId(fallbackGuides[0].id);
        } finally {
          setLoadingGuides(false);
        }
      };
      fetchGuides();
    }
  }, [step]);

  // Handle Step 1 Submit
  const handleStep1Submit = async (e) => {
    e.preventDefault();
    setStep1Error('');
    if (!username || !email || !password || !confirmPassword) {
      setStep1Error('Por favor, completa todos los campos.');
      return;
    }
    if (password !== confirmPassword) {
      setStep1Error('Las contraseñas no coinciden.');
      return;
    }
    setSubmitting(true);
    const success = await register(username, email, password);
    setSubmitting(false);
    if (success) {
      setStep(2);
    } else {
      setStep1Error(authError || 'Error al registrar la cuenta. Inténtalo de nuevo.');
    }
  };

  // Handle Step 2 Submit
  const handleStep2Submit = async () => {
    if (!selectedGuideId) {
      setStep2Error('Por favor, selecciona un guía.');
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
      setStep2Error('No pudimos guardar tu selección de guía. Reintenta por favor.');
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
        setStep3Error('No se pudo guardar la aceptación de términos. Inténtalo de nuevo.');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (!phoneNumber) {
      setStep3Error('Por favor, ingresa tu número de WhatsApp.');
      return;
    }

    setSubmitting(true);
    setStep3Error('');
    try {
      await api.post('/whatsapp/contact', {
        phone_number: phoneNumber,
        whatsapp_name: username,
        notifications_enabled: true,
        timezone: timezone,
        preferred_hour_start: parseInt(preferredHourStart, 10),
        preferred_hour_end: parseInt(preferredHourEnd, 10)
      });
      // Save terms acceptance
      await api.post('/auth/terms', { terms_accepted: true });
      navigate('/dashboard');
    } catch (err) {
      console.error("Failed to save WhatsApp settings:", err);
      setStep3Error('No se pudo guardar la configuración de WhatsApp. Inténtalo de nuevo.');
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
          <span className={`text-[10px] uppercase font-bold tracking-wider mt-2 transition-colors duration-300 ${step === 1 ? 'text-yellow-400' : 'text-gray-500'}`}>Cuenta</span>
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
          <span className={`text-[10px] uppercase font-bold tracking-wider mt-2 transition-colors duration-300 ${step === 2 ? 'text-yellow-400' : 'text-gray-500'}`}>Elegir Guía</span>
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
          <span className={`text-[10px] uppercase font-bold tracking-wider mt-2 transition-colors duration-300 ${step === 3 ? 'text-yellow-400' : 'text-gray-500'}`}>WhatsApp</span>
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
                  Comienza tu Odisea
                </h2>
                <p className="text-gray-400 text-xs mt-1.5 font-sans tracking-wide">
                  Crea tu avatar lingüístico para entrar en el reino de Gather RPG.
                </p>
              </div>

              {step1Error && (
                <div className="text-red-400 mb-6 text-xs font-mono uppercase bg-red-500/10 border border-red-500/20 p-3 rounded-xl text-center flex items-center justify-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{step1Error}</span>
                </div>
              )}

              <form onSubmit={handleStep1Submit} className="space-y-5">
                <div>
                  <label htmlFor="username" className="text-gray-400 text-[10px] font-extrabold uppercase tracking-widest block mb-2">
                    Nombre de Héroe (Username)
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
                      placeholder="Ej. EldarGamer"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="email" className="text-gray-400 text-[10px] font-extrabold uppercase tracking-widest block mb-2">
                    Correo Electrónico
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
                      placeholder="tu@odisea.com"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="password" className="text-gray-400 text-[10px] font-extrabold uppercase tracking-widest block mb-2">
                    Contraseña Secreta
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500">
                      <Lock className="w-4.5 h-4.5" />
                    </span>
                    <input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-gray-950/60 text-white border border-white/10 rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition-all font-sans placeholder-gray-600 text-sm"
                      placeholder="••••••••"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="text-gray-400 text-[10px] font-extrabold uppercase tracking-widest block mb-2">
                    Confirmar Contraseña
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500">
                      <Lock className="w-4.5 h-4.5" />
                    </span>
                    <input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full bg-gray-950/60 text-white border border-white/10 rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition-all font-sans placeholder-gray-600 text-sm"
                      placeholder="••••••••"
                      required
                    />
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
                      <span>Invocando Cuenta...</span>
                    </>
                  ) : (
                    <>
                      <span>Crear Cuenta</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-8 text-center text-xs tracking-wide border-t border-white/5 pt-5">
                <span className="text-gray-500">¿Ya tienes un personaje creado? </span>
                <a href="/login" className="text-yellow-400 hover:text-yellow-300 font-bold transition-colors">
                  Iniciar Sesión
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
                  Elige a tu Guía de Combate
                </h2>
                <p className="text-gray-400 text-xs mt-1.5 font-sans tracking-wide max-w-lg mx-auto">
                  Si tuvieras que salvar a uno del abismo... ¿a quién elegirías? Éste será el NPC con el que te comunicarás a diario.
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
                  <span className="text-gray-400 text-sm font-medieval tracking-widest uppercase">Invocando opciones de guías...</span>
                </div>
              ) : (
                <div className="flex flex-wrap justify-center gap-6 max-w-4xl mx-auto mb-8">
                  {guides.map((guide) => {
                    const details = getGuideDetails(guide);
                    const isSelected = selectedGuideId === guide.id;
                    return (
                      <div
                        key={guide.id}
                        onClick={() => setSelectedGuideId(guide.id)}
                        className={`group relative flex flex-col items-center justify-center border rounded-2xl p-6 cursor-pointer transition-all duration-300 select-none overflow-hidden bg-gray-950/40 backdrop-blur-md w-full sm:w-[220px] md:w-[240px] shrink-0 ${
                          isSelected 
                            ? details.selectedColor 
                            : 'border-white/10 hover:border-white/20 hover:bg-gray-900/30'
                        } ${details.cardGlow}`}
                      >
                        {/* Background guide glow */}
                        <div 
                          className="absolute -right-12 -bottom-12 w-28 h-28 rounded-full filter blur-[35px] opacity-10 transition-opacity duration-300 group-hover:opacity-25 pointer-events-none"
                          style={{ backgroundColor: details.colorHex }}
                        ></div>

                        {/* Top corner selected check indicator */}
                        {isSelected && (
                          <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-yellow-400 text-black flex items-center justify-center shadow-[0_0_10px_rgba(234,179,8,0.5)] z-20">
                            <Check className="w-3.5 h-3.5 stroke-[3px]" />
                          </div>
                        )}

                        {/* Guide visual placeholder avatar (Sleek circles with initial letter) */}
                        <div className="text-center relative z-10 w-full flex flex-col items-center">
                          <div className={`w-20 h-20 rounded-full bg-gradient-to-tr ${details.avatarColor} p-0.5 shadow-lg relative flex items-center justify-center border-2 border-white/15 overflow-hidden group-hover:scale-105 transition-all duration-300 mb-3`}>
                            {guide.sprite && (
                              <img 
                                src={`/npcs/${guide.sprite}.png`} 
                                alt={guide.name} 
                                className="w-full h-full object-cover object-top rounded-full z-10"
                                onError={(e) => {
                                  if (e.target.src.includes('/npcs/')) {
                                    e.target.src = `/characters/${guide.sprite}.png`;
                                  } else {
                                    e.target.style.display = 'none';
                                    if (e.target.nextSibling) {
                                      e.target.nextSibling.style.display = 'block';
                                    }
                                  }
                                }}
                              />
                            )}
                            <span className="text-3xl font-medieval text-white font-black tracking-widest drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]" style={{ display: guide.sprite ? 'none' : 'block' }}>
                              {guide.name ? guide.name[0].toUpperCase() : 'G'}
                            </span>
                            {/* Sparkles glow */}
                            <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                          </div>
                          
                          <h3 className="text-xl font-bold text-white font-medieval uppercase tracking-wider group-hover:text-yellow-400 transition-colors">
                            {guide.name}
                          </h3>
                          
                          <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/5 border border-white/5 text-[11px] text-gray-400 font-sans tracking-wide">
                            <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse"></span>
                            <span>Sprite: {guide.sprite || 'default'}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
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
                      <span>Fijando Alianza...</span>
                    </>
                  ) : (
                    <>
                      <span>Elegir a mi Guía</span>
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
              <div className="text-center mb-8">
                <div className="inline-flex p-3 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 mb-3 shadow-[0_0_15px_rgba(245,158,11,0.1)]">
                  <Phone className="w-6 h-6 animate-pulse" />
                </div>
                <h2 className="text-2xl md:text-3xl font-extrabold text-yellow-400 font-medieval uppercase tracking-widest drop-shadow-md">
                  Vincular tu WhatsApp
                </h2>
                <p className="text-gray-400 text-xs mt-1.5 font-sans tracking-wide">
                  La repetición diaria es la llave para consolidar tu inglés en el cerebro. ¿Te gustaría recibir notificaciones de práctica y recordatorios?
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
                  <span>Sí, deseo recordatorios</span>
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
                  <span>No, prefiero avanzar solo</span>
                </button>
              </div>

              <form onSubmit={handleStep3Submit} className="space-y-6">
                {enableWhatsApp ? (
                  <div className="bg-gray-950/40 border border-white/5 rounded-2xl p-5 md:p-6 space-y-5 transition-all duration-500 animate-fade-in-slide">
                    
                    <div>
                      <label htmlFor="phoneNumber" className="text-gray-400 text-[10px] font-extrabold uppercase tracking-widest block mb-2">
                        Número de Teléfono WhatsApp (con Código de País)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500">
                          <Phone className="w-4 h-4" />
                        </span>
                        <input
                          id="phoneNumber"
                          type="tel"
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                          className="w-full bg-gray-950/80 text-white border border-white/10 rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition-all font-sans placeholder-gray-600 text-sm"
                          placeholder="Ej. +573001234567"
                          required={enableWhatsApp}
                        />
                      </div>
                      <span className="text-[10px] text-gray-500 font-sans mt-1.5 block leading-normal">
                        Importante: Incluye el signo '+' y el indicativo de tu país sin espacios (por ejemplo, +34 para España, +57 para Colombia, +52 para México).
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="timezone" className="text-gray-400 text-[10px] font-extrabold uppercase tracking-widest block mb-2 flex items-center gap-1.5">
                          <Globe className="w-3.5 h-3.5" />
                          <span>Zona Horaria</span>
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
                          <span>Horas Preferidas</span>
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
                            <span className="absolute bottom-1 right-2 text-[8px] text-gray-500 font-mono">INICIO</span>
                          </div>
                          <span className="text-gray-600 font-bold font-sans">a</span>
                          <div className="relative flex-1">
                            <input
                              type="number"
                              min="0"
                              max="23"
                              value={preferredHourEnd}
                              onChange={(e) => setPreferredHourEnd(e.target.value)}
                              className="w-full bg-gray-950/80 text-white border border-white/10 rounded-xl px-3 py-3 text-center focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition-all font-sans text-sm"
                            />
                            <span className="absolute bottom-1 right-2 text-[8px] text-gray-500 font-mono">FIN</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-yellow-500/5 border border-yellow-500/10 rounded-xl p-3.5 flex gap-3 text-left">
                      <BookOpen className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
                      <div className="text-[10px] text-gray-400 font-sans leading-normal">
                        <strong className="text-yellow-400 font-bold uppercase tracking-wide block mb-0.5">Entrenamiento de Aventurero</strong>
                        Tu guía elegido te enviará pequeños desafíos orales y motivaciones personalizadas dentro de estas horas preferidas para que no interrumpa tus horas de sueño.
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-950/30 border border-dashed border-white/10 rounded-2xl p-6 text-center text-gray-400 transition-all duration-500">
                    <Award className="w-10 h-10 mx-auto mb-2 text-gray-600 animate-bounce" />
                    <p className="text-xs font-sans max-w-sm mx-auto leading-relaxed">
                      ¡Entendido! Continuarás sin alertas automáticas de WhatsApp. Tu guía te esperará dentro del lobby del juego para tus prácticas.
                    </p>
                  </div>
                )}

                {/* Immersive Scrollable Terms of Service (Disclaimer) */}
                <div className="bg-gray-950/80 border border-white/10 rounded-xl p-4 space-y-3">
                  <label className="text-yellow-400 text-[10px] font-extrabold uppercase tracking-widest block">
                    Aviso Legal, Términos y Privacidad (Odisea)
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
                      Declaro bajo la gravedad de juramento que <strong className="text-yellow-400 font-bold">tengo 18 años de edad o más</strong> y que <strong className="text-yellow-400 font-bold">acepto en su totalidad</strong> el Aviso Legal, Términos de Uso y Política de Privacidad de Odisea.
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
                        <span>Sincronizando Alquimia...</span>
                      </>
                    ) : (
                      <>
                        <span>Completar Registro</span>
                        <Check className="w-5 h-5 stroke-[2.5px]" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
