import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Menu, X } from 'lucide-react';
import { IMAGES } from './constants';
import LanguageSwitcher from '../common/LanguageSwitcher';

const Navbar = () => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const navLinks = [
    { name: t('landing.navbar.challenges'), href: '#challenges' },
    { name: t('landing.navbar.agenda'), href: '#agenda' },
    { name: t('landing.navbar.speakers'), href: '#speakers' },
  ];

  return (
    <nav className="fixed w-full z-40 bg-neon-dark/90 backdrop-blur-md border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          <div className="flex items-center gap-3">
            <img src={IMAGES.logoBadge} alt="Odisea Logo" className="h-12 w-12 rounded-full border-2 border-neon-blue shadow-[0_0_10px_#00f3ff]" />
            <span className="font-pixel text-xs md:text-sm text-white tracking-widest hidden sm:block">
              ODISEA
            </span>
          </div>
          
          <div className="hidden md:block">
            <div className="ml-10 flex items-center space-x-8">
              {navLinks.map((link) => (
                <a
                  key={link.name}
                  href={link.href}
                  className="font-tech text-xl text-gray-300 hover:text-neon-blue hover:text-shadow transition-all duration-300 uppercase"
                >
                  {link.name}
                </a>
              ))}
              <a 
                href="#register"
                className="font-pixel text-xs bg-neon-purple hover:bg-fuchsia-600 text-white px-4 py-3 rounded-sm shadow-[4px_4px_0px_0px_rgba(255,255,255,0.2)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
              >
                {t('landing.navbar.join')}
              </a>
              <LanguageSwitcher />
            </div>
          </div>

          <div className="-mr-2 flex md:hidden items-center gap-2">
            <LanguageSwitcher />
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 focus:outline-none"
            >
              {isOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {isOpen && (
        <div className="md:hidden bg-neon-dark border-b border-white/10">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                className="text-gray-300 hover:text-neon-blue block px-3 py-2 rounded-md text-base font-medium font-tech uppercase"
                onClick={() => setIsOpen(false)}
              >
                {link.name}
              </a>
            ))}
             <a
                href="#register"
                className="text-white bg-neon-purple block px-3 py-2 rounded-md text-xs font-bold font-pixel mt-4 text-center"
                onClick={() => setIsOpen(false)}
              >
                {t('landing.navbar.join_now')}
              </a>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
