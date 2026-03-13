import { useEffect, useState } from 'react';
import Navbar from '../components/landing/Navbar';
import Hero from '../components/landing/Hero';
import Challenges from '../components/landing/Challenges';
import Registration from '../components/landing/Registration';
import Footer from '../components/landing/Footer';

function LandingPage() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="bg-neon-dark min-h-screen text-white selection:bg-neon-purple selection:text-white">
      <Navbar />
      
      <main>
        <Hero />
        
        {/* Divider Bar */}
        <div className="h-2 w-full bg-gradient-to-r from-neon-blue via-neon-purple to-neon-pink"></div>
        
        <Challenges />
        
        {/* Stats Strip */}
        <div className="bg-black border-y border-white/10 py-12">
           <div className="max-w-7xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
              <div className="space-y-2">
                 <div className="font-pixel text-2xl md:text-3xl text-neon-blue">500+</div>
                 <div className="font-tech text-gray-400 uppercase tracking-widest">Participantes</div>
              </div>
              <div className="space-y-2">
                 <div className="font-pixel text-2xl md:text-3xl text-neon-purple">$10K</div>
                 <div className="font-tech text-gray-400 uppercase tracking-widest">En Premios</div>
              </div>
              <div className="space-y-2">
                 <div className="font-pixel text-2xl md:text-3xl text-neon-pink">5</div>
                 <div className="font-tech text-gray-400 uppercase tracking-widest">Mentores</div>
              </div>
              <div className="space-y-2">
                 <div className="font-pixel text-2xl md:text-3xl text-neon-yellow">5+</div>
                 <div className="font-tech text-gray-400 uppercase tracking-widest">Retos</div>
              </div>
           </div>
        </div>

        <Registration />
      </main>

      <Footer />
      
      {/* Floating CTA for Mobile */}
      <div className={`fixed bottom-4 right-4 z-50 transition-all duration-300 transform ${scrolled ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0'}`}>
        <a 
          href="#register"
          className="bg-neon-blue text-black font-pixel text-[10px] px-6 py-3 rounded shadow-[4px_4px_0px_0px_#000000] border-2 border-white hover:translate-y-1 hover:shadow-none transition-all block"
        >
          REGISTRARSE
        </a>
      </div>
    </div>
  );
}

export default LandingPage;
