import React from 'react';

const MissionTracker = ({ mission }) => {
  if (!mission) return null;

  return (
    <div className="absolute top-20 right-4 w-64 bg-gray-900/80 border border-gray-700 rounded-xl p-4 backdrop-blur-md shadow-2xl animate-in fade-in slide-in-from-right-4">
      <h3 className="text-indigo-400 font-bold text-sm mb-2 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
        {mission.title}
      </h3>
      <p className="text-gray-300 text-xs mb-4">{mission.description_en}</p>
      
      <div className="space-y-3">
        {mission.tasks?.map((task, idx) => (
          <div key={idx} className="flex items-start gap-2">
            <div className={`mt-1 w-3 h-3 rounded-sm border ${
              task.completed ? 'bg-green-500 border-green-400' : 'border-gray-600'
            } shrink-0`} />
            <span className={`text-[11px] ${
              task.completed ? 'text-gray-500 line-through' : 'text-gray-200'
            }`}>
              {task.description_en}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MissionTracker;
