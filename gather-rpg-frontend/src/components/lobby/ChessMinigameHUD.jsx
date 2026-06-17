import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Mic, MicOff, Send, Volume2, VolumeX, RefreshCw, X } from 'lucide-react';
import { Chess } from 'chess.js';
import { useGameStore } from '../../store/gameStore';
import { useAuthStore } from '../../store/authStore';
import { useMediaStore } from '../../store/mediaStore';

// Mapeo visual de piezas de ajedrez a Unicode
const PIECE_SYMBOLS = {
  'wp': '♙', 'wr': '♖', 'wn': '♘', 'wb': '♗', 'wq': '♕', 'wk': '♔',
  'bp': '♟', 'br': '♜', 'bn': '♞', 'bb': '♝', 'bq': '♛', 'bk': '♚',
};

export const ChessMinigameHUD = ({ minigameId, onClose }) => {
  const { t } = useTranslation();
  const [game, setGame] = useState(() => new Chess());
  const [board, setBoard] = useState(() => new Chess().board());
  const [inputMove, setInputMove] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [voiceText, setVoiceText] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [playerColor, setPlayerColor] = useState('w'); // 'w' o 'b'

  const recognitionRef = useRef(null);

  const challengeParticipants = useGameStore(state => state.challengeParticipants);
  const challengeMessages = useGameStore(state => state.challengeMessages);
  const sendChallengeMessage = useGameStore(state => state.sendChallengeMessage);
  const myUser = useAuthStore(state => state.user);

  const localStream = useMediaStore(state => state.localStream);
  const isAudioEnabled = useMediaStore(state => state.isAudioEnabled);
  const toggleAudio = useMediaStore(state => state.toggleAudio);
  const startMedia = useMediaStore(state => state.startMedia);

  const colorInitializedRef = useRef(false);

  // Determinar color del jugador basado en el orden de entrada a la sala (solo al inicializar)
  useEffect(() => {
    if (!colorInitializedRef.current && challengeParticipants.length > 0 && myUser) {
      const myIndex = challengeParticipants.findIndex(p => String(p.user_id) === String(myUser.id));
      if (myIndex === 1) {
        setPlayerColor('b'); // El segundo en unirse es Negro
      } else {
        setPlayerColor('w'); // El primero (o cualquier otro) es Blanco
      }
      colorInitializedRef.current = true;
    }
  }, [challengeParticipants, myUser]);

  // Suscribirse a los mensajes del WebSocket para recibir jugadas y sincronizaciones del rival
  useEffect(() => {
    if (challengeMessages.length > 0) {
      const lastMsg = challengeMessages[challengeMessages.length - 1];
      // Intentar parsear como jugada de ajedrez
      try {
        const payload = JSON.parse(lastMsg.message);
        if (payload.type === 'chess_move' && String(lastMsg.user_id) !== String(myUser?.id)) {
          console.log('[ChessHUD] Recibido movimiento del rival:', payload);
          makeMove(payload.from, payload.to, false); // false = no re-transmitir
        } else if (payload.type === 'chess_reset') {
          console.log('[ChessHUD] Reiniciando partida por orden externa');
          resetGame(false);
        } else if (payload.type === 'chess_sync') {
          console.log('[ChessHUD] Recibida sincronización de partida:', payload);
          if (payload.fen) {
            game.load(payload.fen);
            setBoard(game.board());
          }
          if (payload.white && myUser) {
            if (String(payload.white) === String(myUser.id)) {
              setPlayerColor('w');
            } else {
              setPlayerColor('b');
            }
          }
        }
      } catch (e) {
        // No es un mensaje de ajedrez, ignorar (es chat normal)
      }
    }
  }, [challengeMessages, myUser, game]);

  const prevParticipantsCount = useRef(challengeParticipants.length);

  // Monitorear cuando los participantes cambian para alertar de desconexiones o sincronizar estados
  useEffect(() => {
    if (challengeParticipants.length < prevParticipantsCount.current) {
      setErrorMsg(t('chess.opponent_disconnected'));
    } else if (challengeParticipants.length > prevParticipantsCount.current) {
      setErrorMsg(''); // Limpiar mensaje de error
      
      // Si somos el jugador que ya estaba en la sala y un nuevo oponente entra,
      // enviamos la sincronización de la partida y asignación de colores actual.
      if (prevParticipantsCount.current === 1 && challengeParticipants.length === 2) {
        const opponentUser = challengeParticipants.find(p => String(p.user_id) !== String(myUser?.id));
        const whiteId = playerColor === 'w' ? myUser?.id : opponentUser?.user_id;
        
        console.log('[ChessHUD] Enviando sincronización de partida al oponente recién unido...', {
          fen: game.fen(),
          white: whiteId
        });
        
        sendChallengeMessage(JSON.stringify({
          type: 'chess_sync',
          fen: game.fen(),
          white: whiteId
        }));
      }
    }
    prevParticipantsCount.current = challengeParticipants.length;
  }, [challengeParticipants, playerColor, game, myUser, sendChallengeMessage]);

  // Configuración de Web Speech API
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.lang = 'es-ES';
      rec.continuous = false;
      rec.interimResults = false;

      rec.onstart = () => {
        setIsListening(true);
        setErrorMsg('');
      };

      rec.onresult = (event) => {
        const text = event.results[0][0].transcript;
        setVoiceText(text);
        processVoiceCommand(text);
      };

      rec.onerror = (event) => {
        console.error('Speech recognition error', event.error);
        setErrorMsg(t('chess.error_voice_service', { error: event.error }));
        setIsListening(false);
      };

      rec.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = rec;
    } else {
      console.warn('Speech recognition not supported in this browser.');
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, [game]);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      setErrorMsg(t('chess.voice_not_supported'));
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
    }
  };

  // Procesar comandos de voz como "e2 a e4" o "e2 e4"
  const processVoiceCommand = (text) => {
    console.log('[ChessHUD] Transcrito de voz:', text);
    const cleanedText = text.toLowerCase()
      .replace(/ a /g, ' ')
      .replace(/ para /g, ' ')
      .replace(/ al /g, ' ')
      .trim();

    // Buscar patrones de coordenadas (a-h)(1-8)
    const matches = cleanedText.match(/[a-h][1-8]/g);
    if (matches && matches.length === 2) {
      const from = matches[0];
      const to = matches[1];
      makeMove(from, to, true);
    } else {
      setErrorMsg(t('chess.error_voice_parse', { text }));
      if (soundEnabled) playAudioFeedback(false);
    }
  };

  // Realizar movimiento en el estado de ajedrez
  const makeMove = (from, to, broadcast = true) => {
    setErrorMsg('');
    try {
      // Validar turno
      const activeColor = game.turn();
      if (broadcast && activeColor !== playerColor) {
        setErrorMsg(t('chess.not_your_turn'));
        if (soundEnabled) playAudioFeedback(false);
        return;
      }

      const move = game.move({ from, to, promotion: 'q' });
      if (move) {
        setBoard(game.board());
        setInputMove('');
        setVoiceText('');
        if (soundEnabled) playAudioFeedback(true);

        if (broadcast) {
          // Re-transmitir la jugada válida por el WebSocket
          sendChallengeMessage(JSON.stringify({ type: 'chess_move', from, to }));
        }
      }
    } catch (e) {
      setErrorMsg(t('chess.invalid_move', { from, to }));
      if (soundEnabled) playAudioFeedback(false);
    }
  };

  const handleKeyboardSubmit = (e) => {
    e.preventDefault();
    if (!inputMove.trim()) return;

    const cleaned = inputMove.toLowerCase().replace(/\s+/g, '');
    const matches = cleaned.match(/[a-h][1-8]/g);
    if (matches && matches.length === 2) {
      makeMove(matches[0], matches[1], true);
    } else {
      setErrorMsg(t('chess.incorrect_format'));
      if (soundEnabled) playAudioFeedback(false);
    }
  };

  const playAudioFeedback = (success) => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (success) {
        osc.frequency.setValueAtTime(600, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
      } else {
        osc.frequency.setValueAtTime(150, ctx.currentTime);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
        osc.start();
        osc.stop(ctx.currentTime + 0.2);
      }
    } catch (err) {
      // AudioContext bloqueado o no soportado
    }
  };

  const resetGame = (broadcast = true) => {
    const newGame = new Chess();
    setGame(newGame);
    setBoard(newGame.board());
    setErrorMsg('');
    setVoiceText('');
    if (broadcast) {
      sendChallengeMessage(JSON.stringify({ type: 'chess_reset' }));
    }
  };

  // Renderizar una casilla del tablero
  const renderSquare = (piece, rowIdx, colIdx) => {
    const isDark = (rowIdx + colIdx) % 2 === 1;
    const colLetter = String.fromCharCode(97 + colIdx); // a-h
    const rowNum = 8 - rowIdx; // 8-1
    const squareCoord = `${colLetter}${rowNum}`;

    let pieceText = '';
    let pieceColorClass = '';
    if (piece) {
      const key = `${piece.color}${piece.type}`;
      pieceText = PIECE_SYMBOLS[key] || '';
      pieceColorClass = piece.color === 'w' ? 'text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]' : 'text-gray-900 drop-shadow-[0_1px_1px_rgba(255,255,255,0.6)]';
    }

    return (
      <div
        key={squareCoord}
        className={`relative aspect-square flex items-center justify-center text-3xl md:text-4xl select-none font-semibold transition-colors
          ${isDark ? 'bg-amber-800/80' : 'bg-amber-100/90'}
          hover:bg-yellow-400/40`}
      >
        <span className={pieceColorClass}>{pieceText}</span>
        
        {/* Coordenadas en los bordes */}
        {colIdx === 0 && (
          <span className={`absolute top-0.5 left-1 text-[10px] md:text-[12px] pointer-events-none font-extrabold ${
            isDark ? 'text-amber-100/85' : 'text-amber-950/85'
          }`}>
            {rowNum}
          </span>
        )}
        {rowIdx === 7 && (
          <span className={`absolute bottom-0.5 right-1 text-[10px] md:text-[12px] pointer-events-none font-extrabold ${
            isDark ? 'text-amber-100/85' : 'text-amber-950/85'
          }`}>
            {colLetter}
          </span>
        )}
      </div>
    );
  };

  // Determinar oponente
  const opponent = challengeParticipants.find(p => String(p.user_id) !== String(myUser?.id));

  // Renderizado del tablero según la orientación del jugador
  const boardRows = [];
  if (playerColor === 'w') {
    for (let r = 0; r < 8; r++) {
      const row = [];
      for (let c = 0; c < 8; c++) row.push(renderSquare(board[r][c], r, c));
      boardRows.push(<div key={r} className="grid grid-cols-8">{row}</div>);
    }
  } else {
    // Invertir tablero para las negras (las negras van abajo)
    for (let r = 7; r >= 0; r--) {
      const row = [];
      for (let c = 7; c >= 0; c--) row.push(renderSquare(board[r][c], r, c));
      boardRows.push(<div key={r} className="grid grid-cols-8">{row}</div>);
    }
  }

  return (
    <div className="bg-gray-800 rounded-xl w-full max-w-4xl max-h-[95vh] md:max-h-[90vh] overflow-hidden relative shadow-2xl border border-gray-700 animate-fade-in flex flex-col pointer-events-auto mx-4">
      {/* Header */}
      <div className="p-4 md:p-6 border-b border-gray-700 flex items-center justify-between">
        <div>
          <h2 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
            {t('chess.title')}
            <span className="text-[10px] md:text-xs bg-amber-600/30 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full">
              {playerColor === 'w' ? t('chess.white') : t('chess.black')}
            </span>
          </h2>
          <p className="text-[10px] md:text-xs text-gray-400 mt-1">
            {t('chess.instructions')}
          </p>
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          <button
            onClick={async () => {
              if (!localStream) {
                await startMedia();
              } else {
                toggleAudio();
              }
            }}
            className={`p-2 rounded-lg transition border ${
              isAudioEnabled
                ? 'text-green-400 border-green-700/50 bg-green-950/30 hover:bg-green-950/50'
                : 'text-red-400 border-red-800/50 bg-red-950/30 hover:bg-red-950/50'
            }`}
            title={isAudioEnabled ? t('chess.mute_mic') : t('chess.unmute_mic')}
          >
            {isAudioEnabled ? <Mic size={14} /> : <MicOff size={14} />}
          </button>

          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2 text-gray-400 hover:text-white bg-gray-700 rounded-lg transition"
            title={soundEnabled ? t('chess.mute_sounds') : t('chess.unmute_sounds')}
          >
            {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
          </button>
          
          <button
            onClick={() => { if (confirm(t('chess.confirm_reset'))) resetGame(true); }}
            className="p-2 text-gray-400 hover:text-white bg-gray-700 rounded-lg transition"
            title={t('chess.reset')}
          >
            <RefreshCw size={14} />
          </button>

          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white bg-red-900/40 border border-red-800/60 rounded-lg transition"
            title={t('chess.exit')}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto custom-scrollbar grid grid-cols-1 md:grid-cols-5 gap-4 md:gap-6 p-4 md:p-6">
        
        {/* Tablero (3/5 columnas) */}
        <div className="md:col-span-3 flex items-center justify-center bg-gray-900 border border-gray-700 rounded-xl p-2 md:p-4 shadow-inner">
          <div className="w-full max-w-[320px] md:max-w-[400px] border-4 border-amber-900 rounded-lg overflow-hidden shadow-2xl">
            {boardRows}
          </div>
        </div>

        {/* Panel de Controles e Info (2/5 columnas) */}
        <div className="md:col-span-2 flex flex-col gap-4 min-h-0">
          
          {/* Oponentes */}
          <div className="bg-gray-900/60 border border-gray-700 rounded-xl p-3 md:p-4">
            <div className="text-[9px] md:text-[10px] text-gray-500 uppercase tracking-widest mb-2">{t('chess.room_status')}</div>
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs md:text-sm bg-gray-800/60 border border-gray-700 rounded px-3 py-1.5">
                <span className="text-gray-200">{t('chess.player_1_white')}</span>
                <span className="font-semibold text-white truncate max-w-[120px]">
                  {playerColor === 'w' ? `${myUser?.username} (${t('chess.you')})` : (opponent?.username || t('chess.waiting'))}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs md:text-sm bg-gray-800/60 border border-gray-700 rounded px-3 py-1.5">
                <span className="text-gray-400">{t('chess.player_2_black')}</span>
                <span className="font-semibold text-white truncate max-w-[120px]">
                  {playerColor === 'b' ? `${myUser?.username} (${t('chess.you')})` : (opponent?.username || t('chess.waiting'))}
                </span>
              </div>
            </div>
          </div>

          {/* Estado de Turno */}
          <div className="bg-gray-900/60 border border-gray-700 rounded-xl p-3 md:p-4 flex flex-col justify-center items-center text-center py-4">
            <div className="text-[9px] md:text-[10px] text-gray-500 uppercase tracking-widest mb-1">{t('chess.current_turn')}</div>
            <div className="text-lg md:text-xl font-bold text-white mb-2">
              {game.turn() === 'w' ? t('chess.white') : t('chess.black')}
            </div>
            <div className={`text-xs px-3 py-1 rounded-full font-semibold border ${
              game.turn() === playerColor
                ? 'bg-green-950 text-green-300 border-green-700/50'
                : 'bg-yellow-950 text-yellow-300 border-yellow-700/50'
            }`}>
              {game.turn() === playerColor ? t('chess.your_turn') : t('chess.waiting_opponent')}
            </div>
          </div>

          {/* Entrada de Comandos */}
          <div className="bg-gray-900/60 border border-gray-700 rounded-xl p-3 md:p-4 flex flex-col gap-3">
            
            {/* Control por Voz */}
            <div>
              <div className="text-[9px] md:text-[10px] text-gray-500 uppercase tracking-widest mb-2">{t('chess.voice_control')}</div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={toggleListening}
                  className={`flex items-center justify-center gap-2 flex-1 py-2 rounded-xl border text-xs md:text-sm font-bold transition-all active:scale-95 cursor-pointer
                    ${isListening 
                      ? 'bg-red-600 border-red-500 text-white shadow-[0_0_12px_rgba(220,38,38,0.5)] animate-pulse' 
                      : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700'}`}
                >
                  {isListening ? <Mic size={14} /> : <MicOff size={14} />}
                  {isListening ? t('chess.listening') : t('chess.press_to_speak')}
                </button>
              </div>
              
              {voiceText && (
                <div className="mt-2 text-xs bg-gray-800/80 border border-gray-700 rounded-lg p-2 font-mono text-cyan-300">
                  {t('chess.voice_text', { text: voiceText })}
                </div>
              )}
            </div>

            <div className="border-t border-gray-800 my-0.5"></div>

            {/* Control por Teclado */}
            <div>
              <div className="text-[9px] md:text-[10px] text-gray-500 uppercase tracking-widest mb-2">{t('chess.keyboard_control')}</div>
              <form onSubmit={handleKeyboardSubmit} className="flex gap-2">
                <input
                  type="text"
                  value={inputMove}
                  onChange={(e) => setInputMove(e.target.value)}
                  placeholder={t('chess.keyboard_placeholder')}
                  className="flex-1 bg-gray-800 text-white text-xs px-3 py-2 rounded-xl border border-gray-700 focus:border-amber-500 focus:outline-none placeholder:text-gray-600"
                />
                <button
                  type="submit"
                  className="bg-amber-700 hover:bg-amber-600 text-white px-3 py-2 rounded-xl transition text-xs font-bold flex items-center justify-center"
                >
                  <Send size={12} />
                </button>
              </form>
            </div>

            {/* Mensajes de Error */}
            {errorMsg && (
              <div className="text-xs bg-red-950/60 border border-red-800/40 text-red-300 rounded-lg p-2">
                {errorMsg}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};
