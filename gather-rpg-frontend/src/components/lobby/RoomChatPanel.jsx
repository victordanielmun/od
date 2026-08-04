import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageSquare, ChevronDown } from 'lucide-react';
import { useGameStore } from '../../store/gameStore';
import { useAuthStore } from '../../store/authStore';

// Tipos de sala con chat de grupo. Es el espejo en cliente de Room.IsGroupInstance
// (backend): cooperativas e instancias privadas por PIN. Un mapa público queda
// fuera a propósito — allí se habla 1:1 por mensajes privados, para que un sitio
// por el que pasan desconocidos no sea un canal donde todos escriben a todos.
//
// 'solo' también es de grupo para el servidor (una instancia individual es
// privada), pero ahí solo hay un jugador: enseñar un chat para hablar contigo
// mismo no aporta nada, así que el panel no se monta.
const GROUP_ROOM_TYPES = ['cooperative', 'mission'];

const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';

export const RoomChatPanel = () => {
  const { t } = useTranslation();
  const roomMessages = useGameStore(state => state.roomMessages);
  const sendRoomMessage = useGameStore(state => state.sendRoomMessage);
  const currentRoomType = useGameStore(state => state.currentRoomType);
  const myId = useAuthStore(state => state.user?.id);

  const [input, setInput] = useState('');
  const [collapsed, setCollapsed] = useState(false);
  const endRef = useRef(null);

  const isGroupRoom = GROUP_ROOM_TYPES.includes(currentRoomType);

  useEffect(() => {
    if (!collapsed) endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [roomMessages, collapsed]);

  if (!isGroupRoom) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    // El servidor devuelve el eco al emisor, así que el mensaje aparece solo.
    sendRoomMessage(text);
    setInput('');
  };

  return (
    <div className="fixed bottom-24 right-4 z-40 w-72 max-w-[85vw] pointer-events-auto md:bottom-28">
      <div className="bg-gray-900/80 backdrop-blur-sm border border-gray-700 rounded-lg shadow-xl overflow-hidden">
        <button
          onClick={() => setCollapsed(c => !c)}
          className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-gray-800/60 transition-colors cursor-pointer"
        >
          <span className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-gray-300">
            <MessageSquare className="w-3.5 h-3.5" />
            {t('lobby.room_chat.title', 'Chat de sala')}
          </span>
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${collapsed ? '-rotate-90' : ''}`} />
        </button>

        {!collapsed && (
          <>
            <div className="h-40 overflow-y-auto custom-scrollbar px-3 py-2 space-y-1.5 border-t border-gray-700/60">
              {roomMessages.length === 0 ? (
                <div className="text-xs text-gray-500 italic">
                  {t('lobby.room_chat.no_messages', 'Aún no ha hablado nadie.')}
                </div>
              ) : (
                roomMessages.map((m, idx) => {
                  const isSystem = String(m.user_id || '') === SYSTEM_USER_ID;
                  const isMine = !isSystem && myId && String(m.user_id) === String(myId);
                  if (isSystem) {
                    return (
                      <div key={idx} className="text-xs text-amber-300/80 italic">
                        {m.message}
                      </div>
                    );
                  }
                  return (
                    <div key={idx} className="text-sm leading-snug">
                      <span className={isMine ? 'text-emerald-300 font-semibold' : 'text-orange-300 font-semibold'}>
                        {m.username}
                      </span>
                      <span className="text-gray-400">: </span>
                      <span className="text-gray-200 break-words">{m.message}</span>
                    </div>
                  );
                })
              )}
              <div ref={endRef} />
            </div>

            <form onSubmit={handleSubmit} className="flex gap-2 p-2 border-t border-gray-700/60">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                maxLength={200}
                placeholder={t('lobby.room_chat.input_placeholder', 'Mensaje a la sala...')}
                className="flex-1 min-w-0 bg-gray-800 text-white text-sm px-2 py-1.5 rounded border border-gray-700 focus:border-orange-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!input.trim()}
                className="bg-orange-700 hover:bg-orange-600 disabled:opacity-40 text-white text-sm px-3 py-1.5 rounded transition-colors cursor-pointer"
              >
                {t('lobby.room_chat.send', 'Enviar')}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default RoomChatPanel;
