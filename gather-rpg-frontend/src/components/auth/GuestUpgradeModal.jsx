import React, { useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { X, User, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export const GuestUpgradeModal = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState('');
  
  const upgradeGuest = useAuthStore(state => state.upgradeGuest);
  const error = useAuthStore(state => state.error);
  const isLoading = useAuthStore(state => state.isLoading);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');
    
    if (password.length < 6) {
      setLocalError(t('admin.missions.errors.password_too_short') || 'Password must be at least 6 characters long.');
      return;
    }
    
    const success = await upgradeGuest(username, email, password);
    if (success) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 border border-yellow-500/30 rounded-2xl p-6 max-w-md w-full shadow-2xl relative overflow-hidden">
        
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
        >
          <X size={20} />
        </button>

        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-yellow-400 font-medieval uppercase tracking-widest drop-shadow-md">
            ¡Guarda tu progreso!
          </h2>
          <p className="text-gray-400 text-sm mt-2">
            Estás jugando como invitado. Completa tu registro para asegurar tu cuenta y no perder tus avances.
          </p>
        </div>

        {(error || localError) && (
          <div className="text-red-400 mb-4 text-xs font-mono uppercase bg-red-500/10 border border-red-500/20 p-2.5 rounded-xl text-center">
            {localError || error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-gray-400 text-xs font-bold uppercase tracking-wider block mb-1.5">Usuario</label>
            <div className="relative">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-gray-950/60 text-white border border-white/10 rounded-xl pl-10 pr-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition-all font-sans placeholder-gray-500 text-sm"
                placeholder="Elige un nombre de usuario"
                required
              />
              <User size={16} className="absolute left-3 top-3 text-gray-500" />
            </div>
          </div>
          
          <div>
            <label className="text-gray-400 text-xs font-bold uppercase tracking-wider block mb-1.5">Email</label>
            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-gray-950/60 text-white border border-white/10 rounded-xl pl-10 pr-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition-all font-sans placeholder-gray-500 text-sm"
                placeholder="Ingresa tu email"
                required
              />
              <Mail size={16} className="absolute left-3 top-3 text-gray-500" />
            </div>
          </div>

          <div>
            <label className="text-gray-400 text-xs font-bold uppercase tracking-wider block mb-1.5">Contraseña</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-gray-950/60 text-white border border-white/10 rounded-xl pl-10 pr-10 py-2.5 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition-all font-sans placeholder-gray-500 text-sm"
                placeholder="••••••••"
                required
              />
              <Lock size={16} className="absolute left-3 top-3 text-gray-500" />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-white cursor-pointer"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-6 bg-gradient-to-r from-yellow-500 via-amber-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-black font-extrabold py-3 rounded-xl transition-all font-medieval uppercase tracking-widest shadow-[0_0_20px_rgba(245,158,11,0.2)] hover:shadow-[0_0_25px_rgba(245,158,11,0.4)] border border-yellow-300 cursor-pointer disabled:opacity-50"
          >
            {isLoading ? 'Procesando...' : 'Completar Registro'}
          </button>
        </form>
      </div>
    </div>
  );
};
