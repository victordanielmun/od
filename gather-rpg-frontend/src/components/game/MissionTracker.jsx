import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const MissionTracker = ({ mission }) => {
  const { t, i18n } = useTranslation();
  
  // Load initial collapse state from localStorage
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem('mission_tracker_collapsed') === 'true';
  });

  // Sync state changes to localStorage
  const handleToggleCollapse = () => {
    setIsCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('mission_tracker_collapsed', String(next));
      return next;
    });
  };

  if (!mission) return null;

  return (
    <div className={`absolute bottom-24 right-6 w-64 bg-gray-900/80 border border-gray-700 rounded-xl backdrop-blur-md shadow-2xl transition-all duration-300 animate-in fade-in slide-in-from-bottom-4 pointer-events-auto ${
      isCollapsed ? 'p-3' : 'p-4'
    }`}>
      <div 
        className="flex justify-between items-center select-none cursor-pointer"
        onClick={handleToggleCollapse}
      >
        <h3 className="text-indigo-400 font-bold text-sm flex items-center gap-2 truncate pr-2">
          <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse shrink-0" />
          {mission.title}
        </h3>
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleToggleCollapse();
          }}
          className="text-gray-400 hover:text-white p-1 rounded hover:bg-gray-800 transition-colors shrink-0"
          title={isCollapsed ? t('lobby.mission.expand', 'Expandir') : t('lobby.mission.collapse', 'Colapsar')}
        >
          {isCollapsed ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
            </svg>
          )}
        </button>
      </div>

      {!isCollapsed && (
        <div className="mt-3">
          <p className="text-gray-300 text-xs mb-4">
            {i18n.language.startsWith('es') 
              ? (mission.description || mission.description_en) 
              : (mission.description_en || mission.description)}
          </p>
          
          <div className="space-y-3">
            {mission.tasks?.map((task, idx) => {
              const isCompleted = task.completed || task.is_completed;
              return (
                <div key={idx} className="flex items-start gap-2">
                  <div className={`mt-1 w-3 h-3 rounded-sm border ${
                    isCompleted ? 'bg-green-500 border-green-400' : 'border-gray-600'
                  } shrink-0`} />
                  <div className="flex flex-col">
                    <span className={`text-[11px] ${
                      isCompleted ? 'text-gray-500 line-through' : 'text-gray-200'
                    }`}>
                      {(i18n.language.startsWith('es') ? task.description : task.description_en) || task.description}
                    </span>
                    {task.required_kills > 0 && !isCompleted && (
                      <div className="mt-1.5 flex flex-col gap-1 w-full min-w-[160px] pointer-events-none">
                        <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden border border-gray-700/30">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-red-500 to-orange-500 transition-all duration-500"
                            style={{ width: `${Math.min(100, ((task.kills_done || 0) / (task.required_kills || 1)) * 100)}%` }}
                          />
                        </div>
                        <span className="text-[9px] text-gray-400 font-mono self-end">
                          {t('lobby.mission.enemies_defeated', { done: task.kills_done || 0, req: task.required_kills }) || `${task.kills_done || 0}/${task.required_kills}`}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default MissionTracker;
