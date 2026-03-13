import { useEffect } from 'react';
import { useRoomStore } from '../../store/roomStore';
import { useNavigate } from 'react-router-dom';

export const RoomList = () => {
  const { rooms, fetchRooms, isLoading, error } = useRoomStore();
  const navigate = useNavigate();

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  const handleJoin = (roomId) => {
    navigate(`/game/${roomId}`);
  };

  if (isLoading && rooms.length === 0) {
    return <div className="text-center text-white mt-8">Loading rooms...</div>;
  }

  if (error) {
    return <div className="text-center text-red-500 mt-8">{error}</div>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
      {rooms.length === 0 ? (
        <div className="col-span-full text-center text-gray-400 py-8">
          No rooms available. Create one to get started!
        </div>
      ) : (
        rooms.map((room) => (
          <div 
            key={room.id} 
            className="bg-gray-800 border border-gray-700 rounded-lg p-4 hover:border-blue-500 transition cursor-pointer shadow-lg"
            onClick={() => handleJoin(room.id)}
          >
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-xl font-bold text-white truncate">{room.name}</h3>
              <span className="bg-blue-900 text-blue-200 text-xs px-2 py-1 rounded-full">
                {room.max_users} Max
              </span>
            </div>
            <div className="text-gray-400 text-sm mb-4">
              <p>Public Room</p>
            </div>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                handleJoin(room.id);
              }}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded transition"
            >
              Join Room
            </button>
          </div>
        ))
      )}
    </div>
  );
};
