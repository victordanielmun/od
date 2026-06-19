import { useState, useEffect } from 'react';
import { useGameStore } from '../../store/gameStore';

export const NinjaCardHUD = () => {
  const ninjaCardData = useGameStore(state => state.ninjaCardData);
  const sendNinjaCardAnswer = useGameStore(state => state.sendNinjaCardAnswer);
  const clearNinjaCardData = useGameStore(state => state.clearNinjaCardData);

  const [resultEffect, setResultEffect] = useState(null);
  const [isCorrect, setIsCorrect] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const handleResult = (e) => {
      const data = e.detail;
      console.log('[NinjaCard] HUD Received result:', data);
      setResultEffect(data.effect);
      setIsCorrect(data.correct);
      setIsSubmitting(false);

      // Clear HUD after showing result for 1 second
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

  if (!ninjaCardData) return null;

  const challenge = ninjaCardData.challenge;
  if (!challenge) return null;

  const handleOptionClick = (optionId) => {
    if (resultEffect || isSubmitting) return;
    setIsSubmitting(true);
    console.log('[NinjaCard] Option selected:', optionId);
    sendNinjaCardAnswer(ninjaCardData.target_instance_id, challenge.id, optionId);
  };

  return (
    <div className="absolute inset-0 z-[9999] flex items-center justify-center bg-black/60 pointer-events-auto">
      <div className="bg-slate-900 border-2 border-amber-500 p-8 rounded-xl max-w-lg w-full shadow-2xl relative overflow-hidden">

        {/* Result Overlay */}
        {resultEffect && (
          <div className={`absolute inset-0 z-10 flex flex-col items-center justify-center backdrop-blur-sm ${isCorrect ? 'bg-green-900/80' : 'bg-red-900/80'}`}>
            <h2 className="text-4xl font-bold text-white mb-2">
              {isCorrect ? '¡CORRECTO!' : '¡INCORRECTO!'}
            </h2>
            <p className="text-xl text-white text-center px-4">
              {isCorrect ? 'Enemigo eliminado' :
               resultEffect === 'enemy_heals' ? 'El enemigo se ha curado completamente.' :
               resultEffect === 'player_takes_damage' ? '¡Respuesta incorrecta! Has recibido 30 de daño.' :
               resultEffect === 'player_is_stunned' ? '¡Respuesta incorrecta! Estás aturdido por 3 segundos.' :
               resultEffect === 'expired' ? '¡Se acabó el tiempo! El enemigo se ha recuperado.' :
               'El enemigo se ha recuperado.'}
            </p>
          </div>
        )}

        {/* Content */}
        <div className="text-center mb-6">
          <div className="inline-block px-3 py-1 bg-amber-500/20 text-amber-400 rounded-full text-xs font-bold uppercase tracking-wider mb-4 border border-amber-500/30">
            NINJA CARD
          </div>
          <h3 className="text-2xl font-bold text-white mb-2">{challenge.question}</h3>
          {challenge.question_es && (
            <p className="text-gray-400 mb-4">{challenge.question_es}</p>
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
