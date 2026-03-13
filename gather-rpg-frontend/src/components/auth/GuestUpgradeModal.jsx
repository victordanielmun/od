import { useNavigate } from 'react-router-dom';

export const GuestUpgradeModal = ({ isOpen, onClose }) => {
  const navigate = useNavigate();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75">
      <div className="bg-gray-800 p-6 rounded-lg shadow-xl max-w-md w-full border border-gray-700">
        <h2 className="text-2xl text-white font-bold mb-4 text-center">Enable Video & Audio</h2>
        
        <p className="text-gray-300 mb-6 text-center">
          To use video and audio features, you need to create a full account. 
          It&apos;s free and takes just a minute!
        </p>
        
        <div className="space-y-3">
          <button
            onClick={() => navigate('/register')}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-medium transition"
          >
            Create Account
          </button>
          
          <button
            onClick={() => navigate('/login')}
            className="w-full bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-lg font-medium transition border border-gray-600"
          >
            Login
          </button>
          
          <button
            onClick={onClose}
            className="w-full text-gray-400 hover:text-white py-2 text-sm transition"
          >
            Continue without video
          </button>
        </div>
      </div>
    </div>
  );
};
