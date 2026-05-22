import { useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useNavigate } from 'react-router-dom';

export const RegisterForm = () => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const register = useAuthStore(state => state.register);
  const error = useAuthStore(state => state.error);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const success = await register(username, email, password);
    if (success) {
      navigate('/dashboard');
    }
  };

  return (
    <>
      <h2 className="text-2xl font-bold text-yellow-400 mb-6 text-center font-medieval uppercase tracking-widest drop-shadow-md">Register</h2>
      {error && <div className="text-red-400 mb-4 text-xs font-mono uppercase bg-red-500/10 border border-red-500/20 p-2.5 rounded-xl text-center">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="username" className="text-gray-400 text-xs font-bold uppercase tracking-wider block mb-1.5">Username</label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full bg-gray-950/60 text-white border border-white/10 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition-all font-sans placeholder-gray-500 text-sm"
            placeholder="Enter your username"
            required
          />
        </div>
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
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-gray-950/60 text-white border border-white/10 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition-all font-sans placeholder-gray-500 text-sm"
            placeholder="••••••••"
            required
          />
        </div>
        <button
          type="submit"
          className="w-full bg-gradient-to-r from-yellow-500 via-amber-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-black font-extrabold py-3 rounded-xl transition-all font-medieval uppercase tracking-widest shadow-[0_0_20px_rgba(245,158,11,0.2)] hover:shadow-[0_0_25px_rgba(245,158,11,0.4)] border border-yellow-300 cursor-pointer"
        >
          Create Account
        </button>
      </form>
      <div className="mt-6 text-center text-xs tracking-wide">
        <span className="text-gray-400">Already have an account? </span>
        <a href="/login" className="text-yellow-400 hover:text-yellow-300 font-bold transition-colors">Sign In</a>
      </div>
    </>
  );
};
