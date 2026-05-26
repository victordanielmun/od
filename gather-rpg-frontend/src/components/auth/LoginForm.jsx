import { useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';

export const LoginForm = () => {
  const [email, setEmail] = useState(localStorage.getItem('savedEmail') || '');
  const [password, setPassword] = useState(localStorage.getItem('savedPassword') || '');
  const [rememberMe, setRememberMe] = useState(localStorage.getItem('rememberMe') === 'true');
  const [showPassword, setShowPassword] = useState(false);
  const login = useAuthStore(state => state.login);
  const loginGuest = useAuthStore(state => state.loginGuest);
  const error = useAuthStore(state => state.error);
  const navigate = useNavigate();

  const handleGuestLogin = async () => {
    const success = await loginGuest();
    if (success) {
      navigate('/dashboard');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const success = await login(email, password);
    if (success) {
      if (rememberMe) {
        localStorage.setItem('savedEmail', email);
        localStorage.setItem('savedPassword', password);
        localStorage.setItem('rememberMe', 'true');
      } else {
        localStorage.removeItem('savedEmail');
        localStorage.removeItem('savedPassword');
        localStorage.setItem('rememberMe', 'false');
      }

      // Check if user is admin
      if (useAuthStore.getState().isAdmin()) {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }
    }
  };

  return (
    <>
      <h2 className="text-2xl font-bold text-yellow-400 mb-6 text-center font-medieval uppercase tracking-widest drop-shadow-md">Login</h2>
      {error && <div className="text-red-400 mb-4 text-xs font-mono uppercase bg-red-500/10 border border-red-500/20 p-2.5 rounded-xl text-center">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="text-gray-400 text-xs font-bold uppercase tracking-wider block mb-1.5">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-gray-950/60 text-white border border-white/10 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition-all font-sans placeholder-gray-500 text-sm"
            placeholder="Enter your email"
            required
          />
        </div>
        <div>
          <label htmlFor="password" className="text-gray-400 text-xs font-bold uppercase tracking-wider block mb-1.5">Password</label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-gray-950/60 text-white border border-white/10 rounded-xl pl-3 pr-10 py-2.5 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition-all font-sans placeholder-gray-500 text-sm"
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-white cursor-pointer"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
        <div className="flex items-center">
          <input
            id="rememberMe"
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="w-4 h-4 text-yellow-600 bg-gray-950 border-white/10 rounded focus:ring-yellow-500 focus:ring-2 cursor-pointer"
          />
          <label htmlFor="rememberMe" className="ml-2 text-xs font-bold uppercase tracking-wider text-gray-400 cursor-pointer select-none">
            Remember me
          </label>
        </div>
        <button
          type="submit"
          className="w-full bg-gradient-to-r from-yellow-500 via-amber-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-black font-extrabold py-3 rounded-xl transition-all font-medieval uppercase tracking-widest shadow-[0_0_20px_rgba(245,158,11,0.2)] hover:shadow-[0_0_25px_rgba(245,158,11,0.4)] border border-yellow-300 cursor-pointer"
        >
          Sign In
        </button>
      </form>

      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-white/10"></div>
        </div>
        <div className="relative flex justify-center text-xs uppercase tracking-widest">
          <span className="px-3 bg-[#0d0a2d] text-gray-400">Or continue with</span>
        </div>
      </div>

      <button
        onClick={handleGuestLogin}
        className="w-full bg-indigo-600/15 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/20 py-3 rounded-xl transition-all font-medieval uppercase tracking-widest cursor-pointer"
      >
        Play as Guest
      </button>

      <div className="mt-6 text-center text-xs tracking-wide">
        <span className="text-gray-400">Don&apos;t have an account? </span>
        <a href="/register" className="text-yellow-400 hover:text-yellow-300 font-bold transition-colors">Register</a>
      </div>
    </>
  );
};
