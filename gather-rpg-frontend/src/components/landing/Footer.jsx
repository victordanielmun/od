import { Link } from 'react-router-dom';
import { Github, Twitter, Linkedin, Bot } from 'lucide-react';
import { IMAGES } from './constants';

const Footer = () => {
  return (
    <footer className="bg-black border-t border-white/10 pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          <div className="col-span-1 md:col-span-2">
             <div className="flex items-center gap-3 mb-6">
                <img src={IMAGES.logoBadge} alt="Logo" className="h-10 w-10 grayscale hover:grayscale-0 transition-all duration-500" />
                <span className="font-pixel text-sm text-white tracking-widest">
                  ODISEA
                </span>
            </div>
            <p className="text-gray-400 font-sans max-w-sm mb-6">
              El evento líder en Latinoamérica conectando entusiastas de la Inteligencia Artificial, Automatización y desarrollo No-Code.
            </p>
            <div className="flex space-x-4">
              <a href="#" className="text-gray-400 hover:text-neon-blue transition-colors"><Twitter size={20} /></a>
              <a href="#" className="text-gray-400 hover:text-neon-purple transition-colors"><Github size={20} /></a>
              <a href="#" className="text-gray-400 hover:text-neon-pink transition-colors"><Linkedin size={20} /></a>
            </div>
          </div>
          
          <div>
            <h3 className="font-pixel text-xs text-white mb-6 uppercase">Recursos</h3>
            <ul className="space-y-4 font-tech text-gray-400">
              <li><Link to="/rules" className="hover:text-neon-blue transition-colors">Reglas del Reto</Link></li>
              <li><Link to="/starter-kit" className="hover:text-neon-blue transition-colors">Kit de Inicio</Link></li>
              <li><a href="#" className="hover:text-neon-blue transition-colors">Discord Server</a></li>
              <li><a href="#" className="hover:text-neon-blue transition-colors">API Documentation</a></li>
            </ul>
          </div>

          <div>
             <h3 className="font-pixel text-xs text-white mb-6 uppercase">Legal</h3>
            <ul className="space-y-4 font-tech text-gray-400">
              <li><Link to="/privacy" className="hover:text-neon-blue transition-colors">Privacidad</Link></li>
              <li><Link to="/terms" className="hover:text-neon-blue transition-colors">Términos</Link></li>
              <li><Link to="/code-of-conduct" className="hover:text-neon-blue transition-colors">Código de Conducta</Link></li>
            </ul>
          </div>
        </div>
        
        <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-gray-600 text-sm font-mono">
            © 2026 Odisea AI. All systems operational.
          </p>
          <div className="flex items-center gap-2 text-gray-600 text-sm">
            <Bot size={16} />
            <span>Powered by Human Intelligence + AI</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
