import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { CharacterIdleRenderer } from '../components/dashboard/CharacterIdleRenderer';
import {
  Swords,
  Brain,
  Smartphone,
  Users,
  Trophy,
  Crown,
  Gamepad2,
  Loader2,
  ChevronRight,
  Sparkles,
  Heart,
  Zap,
  Shield,
  Coins,
  Award,
} from 'lucide-react';

const FEATURES = [
  {
    icon: Swords,
    color: 'text-red-400',
    ring: 'border-red-500/20 hover:border-red-500/40',
    glow: 'bg-red-600/10',
    title: 'Combate de acción en tiempo real',
    desc: 'Esquiva, combina golpes y lanza hechizos contra enemigos y jefes para subir de nivel y conseguir oro y objetos.',
  },
  {
    icon: Brain,
    color: 'text-indigo-400',
    ring: 'border-indigo-500/20 hover:border-indigo-500/40',
    glow: 'bg-indigo-600/10',
    title: 'Coach de IA para inglés',
    desc: 'Practica pronunciación y conversación con tu compañero NPC, adaptado a tu nivel real.',
  },
  {
    icon: Smartphone,
    color: 'text-emerald-400',
    ring: 'border-emerald-500/20 hover:border-emerald-500/40',
    glow: 'bg-emerald-600/10',
    title: 'Recordatorios por WhatsApp',
    desc: 'Recibe retos diarios y notificaciones para no perder tu racha de aprendizaje.',
  },
  {
    icon: Users,
    color: 'text-cyan-400',
    ring: 'border-cyan-500/20 hover:border-cyan-500/40',
    glow: 'bg-cyan-600/10',
    title: 'Aventuras cooperativas',
    desc: 'Juega con amigos, sigue a tu compañero y completa misiones en equipo.',
  },
  {
    icon: Trophy,
    color: 'text-yellow-400',
    ring: 'border-yellow-500/20 hover:border-yellow-500/40',
    glow: 'bg-yellow-600/10',
    title: 'Rankings semanales',
    desc: 'Compite en la tabla de líderes y gana reconocimiento entre aventureros.',
  },
  {
    icon: Crown,
    color: 'text-amber-400',
    ring: 'border-amber-500/20 hover:border-amber-500/40',
    glow: 'bg-amber-600/10',
    title: 'Misiones premium',
    desc: 'Desbloquea contenido exclusivo y avanza más rápido con la membresía.',
  },
];

const STEPS = [
  {
    n: '01',
    title: 'Elige tu aventurero',
    desc: 'Selecciona la apariencia de tu personaje entre varios sprites disponibles y entra al mundo.',
  },
  {
    n: '02',
    title: 'Explora y combate',
    desc: 'Recorre el mapa, cumple misiones y vence enemigos junto a tus amigos.',
  },
  {
    n: '03',
    title: 'Aprende inglés jugando',
    desc: 'Tu compañero de IA te guía con retos y conversación en cada aventura.',
  },
];

export const PlayLanding = () => {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const loginGuest = useAuthStore((s) => s.loginGuest);
  const [startingGuest, setStartingGuest] = useState(false);

  const handlePlayNow = () => {
    navigate(isAuthenticated ? '/dashboard' : '/login');
  };

  const handlePlayAsGuest = async () => {
    if (isAuthenticated) {
      navigate('/dashboard');
      return;
    }
    setStartingGuest(true);
    try {
      const success = await loginGuest();
      if (success) navigate('/dashboard');
    } finally {
      setStartingGuest(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-indigo-950 to-gray-950 text-white font-sans selection:bg-yellow-500 selection:text-black relative overflow-x-hidden">
      {/* Decorative backdrop glow elements */}
      <div className="absolute top-20 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute top-[40%] right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-20 left-1/3 w-96 h-96 bg-amber-600/5 rounded-full blur-3xl pointer-events-none"></div>

      {/* Navbar */}
      <header className="sticky top-0 z-50 bg-black/40 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/banners/logo.png" alt="Odisea RPG" className="w-10 h-auto object-contain" />
            <span className="font-medieval font-extrabold uppercase tracking-widest text-sm sm:text-base bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500 bg-clip-text text-transparent">
              Odisea RPG
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/login')}
              className="hidden sm:inline-flex text-xs font-bold uppercase tracking-wider text-gray-300 hover:text-yellow-400 transition-colors px-3 py-2 cursor-pointer"
            >
              Iniciar sesión
            </button>
            <button
              onClick={handlePlayNow}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-yellow-500 via-amber-500 to-yellow-600 text-black text-xs font-extrabold uppercase tracking-widest shadow-[0_0_15px_rgba(245,158,11,0.25)] hover:shadow-[0_0_20px_rgba(245,158,11,0.4)] hover:scale-105 active:scale-95 transition-all cursor-pointer"
            >
              <Gamepad2 size={16} />
              <span>Jugar</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Hero */}
        <section className="pt-14 pb-16 text-center">
          <h1 className="sr-only">Odisea RPG — Aprende inglés jugando</h1>

          <div className="relative max-w-3xl mx-auto mb-8 animate-float">
            <div className="absolute -inset-4 bg-yellow-500/10 blur-3xl rounded-full pointer-events-none"></div>
            <img
              src="/banners/home.jpg"
              alt="Odisea RPG — Level up your English"
              className="relative w-full h-auto rounded-2xl border-2 border-yellow-500/30 shadow-2xl"
            />
          </div>

          <p className="max-w-2xl mx-auto text-gray-300 text-base sm:text-lg leading-relaxed mb-2">
            Un RPG multijugador donde cada misión, combate y conversación con tu compañero de IA
            te ayuda a mejorar tu inglés de verdad.
          </p>
          <p className="max-w-xl mx-auto text-gray-500 text-sm mb-10">
            Gratis para empezar. Sin descargas, se juega desde el navegador.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={handlePlayNow}
              className="group relative flex items-center gap-3 px-10 py-4 rounded-2xl bg-gradient-to-r from-yellow-500 via-amber-500 to-yellow-600 text-black font-extrabold text-base uppercase font-medieval tracking-widest shadow-[0_0_30px_rgba(245,158,11,0.3)] transition-all hover:scale-105 active:scale-95 border-2 border-yellow-300 hover:shadow-[0_0_40px_rgba(245,158,11,0.5)] cursor-pointer"
            >
              <Gamepad2 className="w-5 h-5 group-hover:rotate-12 transition-transform" />
              <span>{isAuthenticated ? 'Entrar al juego' : 'Jugar Ahora'}</span>
              <ChevronRight className="w-4 h-4 opacity-70 group-hover:translate-x-1 transition-transform" />
            </button>

            {!isAuthenticated && (
              <button
                onClick={handlePlayAsGuest}
                disabled={startingGuest}
                className="flex items-center gap-2 px-8 py-4 rounded-2xl bg-black/40 hover:bg-black/60 text-white font-bold text-sm uppercase font-medieval tracking-widest border border-white/15 hover:border-white/30 transition-all hover:scale-105 active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {startingGuest ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4 text-amber-300" />
                )}
                <span>Jugar como invitado</span>
              </button>
            )}
          </div>
        </section>

        {/* Feature grid */}
        <section className="pb-16">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-extrabold font-medieval uppercase tracking-wide bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500 bg-clip-text text-transparent">
              Todo un mundo por explorar
            </h2>
            <p className="text-gray-400 text-sm mt-2">Combate, amigos e inglés en una sola aventura</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map(({ icon: Icon, color, ring, glow, title, desc }) => (
              <div
                key={title}
                className={`bg-black/40 backdrop-blur-md border ${ring} rounded-2xl p-6 shadow-2xl transition-all hover:-translate-y-1 relative overflow-hidden`}
              >
                <div className={`absolute -top-8 -right-8 w-28 h-28 rounded-full blur-2xl ${glow} pointer-events-none`}></div>
                <div className={`inline-flex p-3 rounded-xl bg-gray-950/60 border border-white/5 ${color} mb-4`}>
                  <Icon size={22} />
                </div>
                <h3 className="font-bold text-white font-medieval uppercase tracking-wide text-sm mb-2">{title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="pb-16">
          <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl p-6 sm:p-10 shadow-2xl">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
              <div className="lg:col-span-5 flex flex-col items-center justify-center bg-gray-950/60 border border-white/5 rounded-xl p-6 min-h-[220px]">
                <CharacterIdleRenderer characterId="1" scale={3.2} className="mb-2" />
                <span className="text-[10px] uppercase tracking-widest text-gray-500 font-mono">Tu aventurero te espera</span>
              </div>

              <div className="lg:col-span-7 space-y-6">
                {STEPS.map((step) => (
                  <div key={step.n} className="flex gap-4 items-start">
                    <span className="shrink-0 w-10 h-10 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 font-mono font-bold text-sm flex items-center justify-center">
                      {step.n}
                    </span>
                    <div>
                      <h3 className="font-bold text-white font-medieval uppercase tracking-wide text-sm mb-1">{step.title}</h3>
                      <p className="text-gray-400 text-sm leading-relaxed">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Stat preview strip */}
        <section className="pb-16">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: Heart, color: 'text-emerald-400', label: 'HP & MP', value: 'Sistema RPG completo' },
              { icon: Zap, color: 'text-amber-400', label: 'XP', value: 'Sube de nivel jugando' },
              { icon: Shield, color: 'text-blue-400', label: 'Equipo', value: 'Ataque y defensa' },
              { icon: Coins, color: 'text-yellow-400', label: 'Oro', value: 'Consigue y gasta' },
            ].map(({ icon: Icon, color, label, value }) => (
              <div key={label} className="bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl p-4 text-center shadow-xl">
                <Icon className={`mx-auto mb-1.5 w-5 h-5 ${color}`} />
                <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">{label}</p>
                <p className="text-xs text-white mt-1 font-medium">{value}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section className="pb-20">
          <div className="bg-black/40 backdrop-blur-md border border-yellow-500/20 rounded-2xl p-8 sm:p-12 text-center shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-72 h-72 bg-yellow-500/10 rounded-full blur-3xl pointer-events-none"></div>
            <Award className="w-8 h-8 text-yellow-400 mx-auto mb-3 relative z-10" />
            <h2 className="text-2xl sm:text-3xl font-extrabold font-medieval uppercase tracking-wide text-white mb-3 relative z-10">
              ¿Listo para comenzar tu aventura?
            </h2>
            <p className="text-gray-400 text-sm max-w-lg mx-auto mb-8 relative z-10">
              Regístrate en segundos y empieza a mejorar tu inglés mientras juegas con amigos.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 relative z-10">
              <button
                onClick={handlePlayNow}
                className="flex items-center gap-2 px-10 py-4 rounded-2xl bg-gradient-to-r from-yellow-500 via-amber-500 to-yellow-600 text-black font-extrabold text-sm uppercase font-medieval tracking-widest shadow-[0_0_25px_rgba(245,158,11,0.3)] hover:shadow-[0_0_35px_rgba(245,158,11,0.5)] hover:scale-105 active:scale-95 transition-all cursor-pointer"
              >
                <Gamepad2 className="w-5 h-5" />
                <span>{isAuthenticated ? 'Entrar al juego' : 'Comenzar aventura'}</span>
              </button>
              {!isAuthenticated && (
                <button
                  onClick={() => navigate('/login')}
                  className="text-xs font-bold uppercase tracking-wider text-gray-400 hover:text-yellow-400 transition-colors cursor-pointer"
                >
                  Ya tengo cuenta
                </button>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-black/40 backdrop-blur-md relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-500">
          <span>© {new Date().getFullYear()} Odisea RPG. Todos los derechos reservados.</span>
          <div className="flex items-center gap-5">
            <a href="/terms" className="hover:text-yellow-400 transition-colors">Términos</a>
            <a href="/privacy" className="hover:text-yellow-400 transition-colors">Privacidad</a>
            <a href="/code-of-conduct" className="hover:text-yellow-400 transition-colors">Código de conducta</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PlayLanding;
