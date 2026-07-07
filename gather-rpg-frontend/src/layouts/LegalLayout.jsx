import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FileText, Shield, UserCheck, ArrowLeft, Scale } from 'lucide-react';

const LegalLayout = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;

  const tabs = [
    { path: '/terms', label: 'Términos de Servicio', icon: FileText },
    { path: '/privacy', label: 'Política de Privacidad', icon: Shield },
    { path: '/code-of-conduct', label: 'Código de Conducta', icon: UserCheck }
  ];

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/dashboard');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-indigo-950 to-gray-950 text-white font-sans selection:bg-yellow-500 selection:text-black py-8 px-4 sm:px-6 lg:px-8 relative overflow-x-hidden">
      {/* Decorative backdrop glow elements */}
      <div className="absolute top-20 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-20 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="max-w-6xl mx-auto relative z-10">
        {/* Top Header Navigation */}
        <header className="flex justify-between items-center mb-8 pb-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2.5 hover:opacity-90 transition-opacity">
              <img src="/banners/logo.png" alt="Odyssey Logo" className="w-12 h-auto object-contain" />
              <div>
                <h1 className="text-xl md:text-2xl font-extrabold tracking-wider bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500 bg-clip-text text-transparent uppercase font-medieval">
                  Odyssey RPG
                </h1>
                <p className="text-gray-400 text-xs font-sans">
                  Aviso Legal y Normativas de la Comunidad
                </p>
              </div>
            </Link>
          </div>

          <button
            onClick={handleBack}
            className="p-2.5 bg-black/40 backdrop-blur-md border border-white/10 hover:border-yellow-500/30 text-gray-400 hover:text-white rounded-xl shadow-xl transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer flex items-center gap-2 text-xs font-semibold"
            title="Volver"
          >
            <ArrowLeft size={14} />
            <span className="hidden sm:inline">Volver</span>
          </button>
        </header>

        {/* Layout Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Navigation Sidebar/Top Tabs */}
          <aside className="lg:col-span-3">
            <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl p-4 space-y-1.5 lg:sticky lg:top-8 shadow-2xl">
              <div className="px-3 py-2 text-[10px] font-extrabold text-yellow-500/80 uppercase tracking-widest border-b border-white/5 mb-2 flex items-center gap-1.5">
                <Scale size={12} className="text-yellow-500" />
                <span>Documentos</span>
              </div>
              
              {/* Vertical Menu on large screens, horizontal on mobile */}
              <div className="flex lg:flex-col overflow-x-auto lg:overflow-x-visible gap-1.5 pb-2 lg:pb-0 scrollbar-thin scrollbar-thumb-white/5">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = currentPath === tab.path;
                  return (
                    <Link
                      key={tab.path}
                      to={tab.path}
                      className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-xs font-bold transition-all duration-300 shrink-0 lg:shrink w-full border ${
                        isActive
                          ? 'bg-gradient-to-r from-yellow-500/10 to-amber-500/5 border-yellow-500/40 text-yellow-400 shadow-[0_0_15px_rgba(245,158,11,0.05)]'
                          : 'bg-transparent border-transparent text-gray-400 hover:text-white hover:bg-white/5 hover:border-white/5'
                      }`}
                    >
                      <Icon size={16} className={isActive ? 'text-yellow-400' : 'text-gray-400'} />
                      <span>{tab.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </aside>

          {/* Legal Content Card */}
          <main className="lg:col-span-9 bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl p-6 md:p-8 shadow-2xl relative overflow-hidden">
            {children}
            
            {/* Fine print footer inside card */}
            <div className="border-t border-white/5 mt-10 pt-6 text-[10px] text-gray-500 font-sans flex flex-col sm:flex-row justify-between gap-4">
              <span>© {new Date().getFullYear()} Odyssey RPG. Todos los derechos reservados.</span>
              <span>Contacto: support@odisea-rpg.com</span>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

export default LegalLayout;
