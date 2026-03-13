import { Outlet } from 'react-router-dom';
import { Gamepad2 } from 'lucide-react';

export const AuthLayout = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 px-4">
      <div className="max-w-md w-full space-y-8">
        <div className="flex flex-col items-center justify-center">
          <div className="bg-blue-600 p-3 rounded-full mb-4">
            <Gamepad2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Gather RPG</h1>
          <p className="mt-2 text-gray-400">Join the adventure</p>
        </div>
        <div className="bg-gray-800 p-8 rounded-lg shadow-xl border border-gray-700">
          <Outlet />
        </div>
      </div>
    </div>
  );
};
