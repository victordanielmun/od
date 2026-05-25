import { Outlet, Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export const AuthLayout = () => {
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-950 via-indigo-950 to-gray-950 px-4 relative overflow-hidden font-sans">
      {/* Decorative backdrop glow elements */}
      <div className="absolute top-20 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-20 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="max-w-md w-full space-y-8 relative z-10">
        <div className="flex flex-col items-center justify-center">
          <img src="/banners/logo.png" alt="Odisea Logo" className="w-64 h-auto object-contain mb-4" />
          {/* <h1 className="text-3xl font-extrabold tracking-wider bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500 bg-clip-text text-transparent uppercase font-medieval drop-shadow-md">Odisea RPG</h1> */}
          <p className="text-3xl font-bold tracking-wider bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500 bg-clip-text text-transparent uppercase italic drop-shadow-md">Level up your English</p>

        </div>
        <div className="bg-black/40 backdrop-blur-md p-8 rounded-2xl shadow-2xl border border-white/10 relative overflow-hidden">
          <Outlet />
        </div>
      </div>
    </div>
  );
};
