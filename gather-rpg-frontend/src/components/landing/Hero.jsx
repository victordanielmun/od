import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { IMAGES, EVENT_DETAILS } from './constants';

const Hero = () => {
  const { t } = useTranslation();
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    // Parse "16 DE ENERO DEL 2026"
    const parseDate = (str) => {
      const months = {
        'ENERO': 0, 'FEBRERO': 1, 'MARZO': 2, 'ABRIL': 3, 'MAYO': 4, 'JUNIO': 5,
        'JULIO': 6, 'AGOSTO': 7, 'SEPTIEMBRE': 8, 'OCTUBRE': 9, 'NOVIEMBRE': 10, 'DICIEMBRE': 11
      };
      const parts = str.toUpperCase().split(' ');
      // ["16", "DE", "ENERO", "DEL", "2026"]
      if (parts.length >= 5) {
        // Set to 9 AM on the event day
        return new Date(parseInt(parts[4]), months[parts[2]], parseInt(parts[0]), 9, 0, 0);
      }
      return new Date();
    };

    const targetDate = parseDate(EVENT_DETAILS.date);

    const timer = setInterval(() => {
      const now = new Date();
      const difference = targetDate.getTime() - now.getTime();

      if (difference > 0) {
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((difference / 1000 / 60) % 60),
          seconds: Math.floor((difference / 1000) % 60),
        });
      } else {
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setMousePos({ x, y });
  };

  const TimeUnit = ({ value, label }) => (
    <div className="flex flex-col items-center">
      <div className="relative bg-black/40 backdrop-blur-sm border border-neon-blue/30 p-3 sm:p-4 rounded-md w-16 sm:w-20 md:w-24 text-center group overflow-hidden">
        <div className="absolute inset-0 bg-neon-blue/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
        <span className="relative font-pixel text-lg sm:text-2xl md:text-3xl text-white block shadow-neon-blue">
          {value.toString().padStart(2, '0')}
        </span>
      </div>
      <span className="text-neon-purple font-tech text-[10px] sm:text-xs uppercase tracking-widest mt-2">
        {label}
      </span>
    </div>
  );

  return (
    <div
      className="relative min-h-screen flex items-center justify-center overflow-hidden pt-24 pb-20 group"
      onMouseMove={handleMouseMove}
    >
      {/* Dynamic Background Layers */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        {/* Parallax Image */}
        <div
          className="absolute -inset-[5%] w-[110%] h-[110%] transition-transform duration-100 ease-out will-change-transform"
          style={{
            transform: `translate(${mousePos.x * -20}px, ${mousePos.y * -20}px) scale(1.05)`
          }}
        >
          <img
            src={IMAGES.heroBanner}
            alt="Odisea Arena"
            className="w-full h-full object-cover opacity-40 filter contrast-125 saturate-150"
          />
        </div>

        {/* Dynamic Interactive Gradients */}
        <div
          className="absolute inset-0 transition-opacity duration-500"
          style={{
            background: `
              radial-gradient(circle 600px at ${50 + mousePos.x * 80}% ${50 + mousePos.y * 80}%, rgba(188, 19, 254, 0.15), transparent 50%),
              radial-gradient(circle 500px at ${50 - mousePos.x * 80}% ${50 - mousePos.y * 80}%, rgba(0, 243, 255, 0.1), transparent 50%)
            `
          }}
        ></div>

        {/* Base Overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-neon-dark via-neon-dark/90 to-transparent"></div>
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150 mix-blend-overlay"></div>

        {/* Grid Pattern */}
        <div className="absolute inset-0 bg-grid-pattern bg-[length:40px_40px] opacity-10 [mask-image:linear-gradient(to_bottom,transparent,black)]"></div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        {/* Glitch Effect Title */}
        <div className="mb-6 relative inline-block">
          <h1 className="font-pixel text-4xl sm:text-6xl md:text-8xl text-transparent bg-clip-text bg-gradient-to-r from-neon-blue via-white to-neon-purple animate-pulse neon-text-glow tracking-tighter">
            ODISEA
          </h1>
          <div className="absolute -inset-1 bg-neon-blue/20 blur-xl opacity-50 animate-pulse"></div>
        </div>

        <p className="font-tech text-xl sm:text-2xl md:text-3xl text-neon-blue mb-12 tracking-[0.2em] uppercase neon-text-glow">
          {t('landing.hero.tagline')}
        </p>

        {/* Countdown Timer */}
        <div className="flex justify-center gap-4 sm:gap-8 mb-16">
          <TimeUnit value={timeLeft.days} label={t('landing.hero.days')} />
          <TimeUnit value={timeLeft.hours} label={t('landing.hero.hours')} />
          <TimeUnit value={timeLeft.minutes} label={t('landing.hero.minutes')} />
          <TimeUnit value={timeLeft.seconds} label={t('landing.hero.seconds')} />
        </div>

        <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
          <a
            href="#register"
            className="group relative px-8 py-4 bg-transparent overflow-hidden rounded-sm"
          >
            <div className="absolute inset-0 w-full h-full bg-neon-purple/20 border border-neon-purple/50 transform skew-x-12 transition-all group-hover:bg-neon-purple/40 group-hover:scale-105"></div>
            <div className="absolute inset-0 w-full h-full border-t border-b border-neon-purple scale-x-0 group-hover:scale-x-100 transition-transform duration-500"></div>
            <span className="relative font-pixel text-sm text-white group-hover:text-neon-yellow transition-colors flex items-center gap-2">
              {t('landing.hero.register_now')}
              <span className="block w-2 h-2 bg-neon-yellow animate-ping"></span>
            </span>
          </a>

          <a
            href="#challenges"
            className="font-tech text-lg text-gray-400 hover:text-white border-b border-transparent hover:border-neon-blue transition-all"
          >
            {t('landing.hero.view_challenges')}
          </a>
        </div>
      </div>

      {/* Scrolling Text Strip */}
      <div className="absolute bottom-0 w-full bg-neon-blue/10 border-t border-neon-blue/20 py-3 overflow-hidden">
        <div className="flex whitespace-nowrap animate-[slide-in-right_20s_linear_infinite]">
          {[...Array(10)].map((_, i) => (
            <span key={i} className="font-pixel text-xs text-neon-blue/70 mx-8">
              +++ SYSTEM READY +++ AI AGENTS ONLINE +++ AUTOMATION PROTOCOLS ENGAGED +++
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Hero;
