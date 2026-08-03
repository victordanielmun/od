import { useState, useEffect } from 'react';
import { useGameStore } from '../../store/gameStore';
import ReactMarkdown from 'react-markdown';

const COUNTDOWN_START = 10; // segundos de presión para responder

export const NinjaCardHUD = () => {
  const ninjaCardData = useGameStore(state => state.ninjaCardData);
  const sendNinjaCardAnswer = useGameStore(state => state.sendNinjaCardAnswer);
  const clearNinjaCardData = useGameStore(state => state.clearNinjaCardData);

  const [resultEffect, setResultEffect] = useState(null);
  const [isCorrect, setIsCorrect] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [timeLeft, setTimeLeft] = useState(COUNTDOWN_START);

  const targetId = ninjaCardData?.target_instance_id;
  const challenge = ninjaCardData?.challenge;

  // Resultado del servidor → mostrar y limpiar tras 1s.
  useEffect(() => {
    const handleResult = (e) => {
      const data = e.detail;
      console.log('[NinjaCard] HUD Received result:', data);
      setResultEffect(data.effect);
      setIsCorrect(data.correct);
      setIsSubmitting(false);

      setTimeout(() => {
        setResultEffect(null);
        setIsCorrect(null);
        setIsSubmitting(false);
        clearNinjaCardData();
      }, 1000);
    };
    window.addEventListener('ninja-card-result', handleResult);
    return () => window.removeEventListener('ninja-card-result', handleResult);
  }, [clearNinjaCardData]);

  // Reiniciar el contador cuando aparece una nueva card.
  useEffect(() => {
    if (targetId) setTimeLeft(COUNTDOWN_START);
  }, [targetId]);

  // Tick del contador (1s) mientras la card está activa y sin responder.
  useEffect(() => {
    if (!ninjaCardData || resultEffect || isSubmitting || timeLeft <= 0) return;
    const t = setTimeout(() => setTimeLeft(v => v - 1), 1000);
    return () => clearTimeout(t);
  }, [ninjaCardData, resultEffect, isSubmitting, timeLeft]);

  // Tiempo agotado → enviar respuesta de timeout (opción 0 = incorrecta).
  useEffect(() => {
    if (!ninjaCardData || resultEffect || isSubmitting) return;
    if (timeLeft <= 0) {
      setIsSubmitting(true);
      console.log('[NinjaCard] Time expired → enviando timeout (incorrecto)');
      sendNinjaCardAnswer(targetId, challenge?.id, 0);
    }
  }, [timeLeft, ninjaCardData, resultEffect, isSubmitting, targetId, challenge, sendNinjaCardAnswer]);

  if (!ninjaCardData || !challenge) return null;

  const handleOptionClick = (optionId) => {
    if (resultEffect || isSubmitting) return;
    setIsSubmitting(true);
    console.log('[NinjaCard] Option selected:', optionId);
    sendNinjaCardAnswer(targetId, challenge.id, optionId);
  };

  const timerColor = timeLeft <= 3 ? 'bg-red-600 border-red-300 animate-pulse'
                   : timeLeft <= 5 ? 'bg-amber-600 border-amber-300'
                   : 'bg-emerald-600 border-emerald-300';

  return (
    <div className="absolute inset-0 z-[9999] flex items-center justify-center bg-black/60 pointer-events-auto animate-in fade-in duration-200">
      <div className="bg-slate-900 border-2 border-amber-500 p-8 rounded-xl max-w-lg w-full shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-200">

        {/* Result Overlay */}
        {resultEffect && (
          <div className={`absolute inset-0 z-10 flex flex-col items-center justify-center backdrop-blur-sm ${isCorrect ? 'bg-green-900/80' : 'bg-red-900/80'}`}>
            <h2 className="text-4xl font-bold text-white mb-2">
              {isCorrect ? '¡CORRECTO!' : '¡INCORRECTO!'}
            </h2>
            <p className="text-xl text-white text-center px-4">
              {isCorrect ? 'Enemigo eliminado' :
               resultEffect === 'enemy_heals' ? 'El enemigo se ha curado completamente.' :
               resultEffect === 'player_takes_damage' ? '¡Respuesta incorrecta! Has recibido daño.' :
               resultEffect === 'player_is_stunned' ? '¡Respuesta incorrecta! Estás aturdido.' :
               resultEffect === 'expired' ? '¡Se acabó el tiempo! El enemigo se ha recuperado.' :
               'El enemigo se ha recuperado.'}
            </p>
          </div>
        )}

        {/* Countdown */}
        {!resultEffect && (
          <div className="absolute top-4 right-4 z-20">
            <div className={`w-12 h-12 rounded-full border-2 flex items-center justify-center text-2xl font-extrabold text-white shadow-lg ${timerColor}`}>
              {Math.max(0, timeLeft)}
            </div>
          </div>
        )}

        {/* Content */}
        <div className="text-center mb-6">
          <div className="inline-block px-3 py-1 bg-amber-500/20 text-amber-400 rounded-full text-xs font-bold uppercase tracking-wider mb-4 border border-amber-500/30">
            NINJA CARD
          </div>
          <div className="text-2xl font-bold text-white mb-2 prose prose-invert prose-2xl max-w-none prose-p:my-0">
            <ReactMarkdown>{challenge.question}</ReactMarkdown>
          </div>
          {challenge.question_es && (
            <div className="text-gray-400 mb-4 prose prose-invert prose-sm max-w-none prose-p:my-0">
              <ReactMarkdown>{challenge.question_es}</ReactMarkdown>
            </div>
          )}
        </div>

        <div className="space-y-3">
          {[1, 2, 3].map((optNum) => {
            const optionText = challenge[`option_${optNum}`];
            if (!optionText) return null;
            return (
              <button
                key={optNum}
                onClick={() => handleOptionClick(optNum)}
                disabled={!!resultEffect || isSubmitting}
                className="w-full p-4 rounded-lg bg-slate-800 text-left hover:bg-slate-700 transition border border-slate-600 hover:border-amber-400 flex items-center gap-4 group"
              >
                <div className="w-8 h-8 rounded-full bg-slate-700 group-hover:bg-amber-500 flex items-center justify-center text-white font-bold transition">
                  {['A', 'B', 'C'][optNum - 1]}
                </div>
                <span className="text-white text-lg">{optionText}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
