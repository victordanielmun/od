import { useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useNavigate } from 'react-router-dom';

export const LoginForm = () => {
  const [email, setEmail] = useState(localStorage.getItem('savedEmail') || '');
  const [password, setPassword] = useState(localStorage.getItem('savedPassword') || '');
  const [rememberMe, setRememberMe] = useState(localStorage.getItem('rememberMe') === 'true');
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
      <h2 className="text-2xl text-white mb-6 text-center">Login</h2>
      {error && <div className="text-red-500 mb-4 text-sm">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="text-gray-300 block mb-1">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-gray-700 text-white rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
        <div>
          <label htmlFor="password" className="text-gray-300 block mb-1">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-gray-700 text-white rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
            autoComplete="current-password"
          />
        </div>
        <div className="flex items-center">
          <input
            id="rememberMe"
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
          />
          <label htmlFor="rememberMe" className="ml-2 text-sm font-medium text-gray-300">
            Remember me
          </label>
        </div>
        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition"
        >
          Sign In
        </button>
      </form>

      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-600"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-gray-800 text-gray-400">Or continue with</span>
        </div>
      </div>

      <button
        onClick={handleGuestLogin}
        className="w-full bg-gray-700 text-white py-2 rounded hover:bg-gray-600 transition border border-gray-600"
      >
        Play as Guest
      </button>

      <div className="mt-4 text-center">
        <span className="text-gray-400 text-sm">Don&apos;t have an account? </span>
        <a href="/register" className="text-blue-400 hover:text-blue-300 text-sm">Register</a>
      </div>
    </>
  );
};
