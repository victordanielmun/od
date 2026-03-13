import { useState } from 'react';
import { useRoomStore } from '../../store/roomStore';

export const CreateRoomModal = ({ isOpen, onClose }) => {
  const [name, setName] = useState('');
  const [maxUsers, setMaxUsers] = useState(50);
  const createRoom = useRoomStore(state => state.createRoom);
  const isLoading = useRoomStore(state => state.isLoading);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    const success = await createRoom({
      name,
      max_users: parseInt(maxUsers),
      is_public: true,
      map_data: {} // Placeholder
    });

    if (success) {
      setName('');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 w-full max-w-md shadow-2xl">
        <h2 className="text-2xl text-white mb-4">Create New Room</h2>
        
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="roomName" className="block text-gray-300 mb-2">Room Name</label>
            <input
              type="text"
              id="roomName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-gray-700 text-white border border-gray-600 rounded px-3 py-2 focus:outline-none focus:border-blue-500"
              placeholder="Enter room name..."
              required
            />
          </div>

          <div className="mb-6">
            <label htmlFor="maxUsers" className="block text-gray-300 mb-2">Max Users</label>
            <input
              type="number"
              id="maxUsers"
              value={maxUsers}
              onChange={(e) => setMaxUsers(e.target.value)}
              min="2"
              max="100"
              className="w-full bg-gray-700 text-white border border-gray-600 rounded px-3 py-2 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-700 text-gray-300 rounded hover:bg-gray-600 transition"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition flex items-center"
              disabled={isLoading}
            >
              {isLoading ? 'Creating...' : 'Create Room'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
