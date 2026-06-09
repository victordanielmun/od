import { useNotificationStore } from '../../store/notificationStore';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

export const NotificationContainer = () => {
  const notifications = useNotificationStore((state) => state.notifications);
  const removeNotification = useNotificationStore((state) => state.removeNotification);

  if (notifications.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={`pointer-events-auto flex items-start gap-3 p-4 rounded shadow-lg border animate-slide-in-right ${
            notification.type === 'success' ? 'bg-green-900/90 border-green-700 text-green-100' :
            notification.type === 'error' ? 'bg-red-900/90 border-red-700 text-red-100' :
            'bg-blue-900/90 border-blue-700 text-blue-100'
          }`}
        >
          <div className="mt-0.5">
            {notification.type === 'success' && <CheckCircle size={18} />}
            {notification.type === 'error' && <AlertCircle size={18} />}
            {notification.type === 'info' && <Info size={18} />}
          </div>
          <div className="flex-grow min-w-0">
            <p className="text-sm">{notification.message}</p>
            {notification.actions && notification.actions.length > 0 && (
              <div className="flex gap-2 mt-2.5 pt-2.5 border-t border-white/10 w-full pointer-events-auto">
                {notification.actions.map((action, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      action.onClick();
                      removeNotification(notification.id);
                    }}
                    className={`px-3 py-1.5 rounded text-[10px] uppercase tracking-wider font-extrabold transition cursor-pointer ${
                      action.primary
                        ? 'bg-yellow-500 hover:bg-yellow-400 text-black border border-yellow-300 shadow-md'
                        : 'bg-white/10 hover:bg-white/20 text-white border border-white/10'
                    }`}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button 
            onClick={() => removeNotification(notification.id)}
            className="text-white/60 hover:text-white flex-shrink-0"
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
};
