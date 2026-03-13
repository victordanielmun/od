import { useState, useCallback } from 'react';
import { submitChallengeAttempt } from '../../services/voiceApi';
import { Check, X, ShieldAlert, Award, Star, ArrowRight } from 'lucide-react';

export default function ChallengeView({ challenge, onNext, difficulty }) {
    const [selectedId, setSelectedId] = useState(null);
    const [isCorrect, setIsCorrect] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSelect = useCallback(async (optionIndex) => {
        if (selectedId !== null || isSubmitting) return;
        
        setSelectedId(optionIndex);
        const correct = optionIndex === challenge.correct_option;
        setIsCorrect(correct);
        setIsSubmitting(true);

        try {
            await submitChallengeAttempt(
                challenge.id,
                correct,
                challenge.explanation_es || "",
                optionIndex
            );
        } catch (err) {
            console.warn('Failed to record challenge attempt:', err);
        } finally {
            setIsSubmitting(false);
        }
    }, [challenge, selectedId, isSubmitting]);

    if (!challenge) return null;

    const options = [
        { id: 1, text: challenge.option_1 },
        { id: 2, text: challenge.option_2 },
        { id: 3, text: challenge.option_3 },
    ].filter(opt => opt.text && opt.text.trim() !== "");

    return (
        <div className="w-full animate-fade-in">
            {/* Card Body */}
            <div className={`relative overflow-hidden bg-gray-900/60 backdrop-blur-xl border-2 rounded-3xl p-8 transition-all duration-500 ${
                isCorrect === true ? 'border-green-500/50 shadow-[0_0_40px_rgba(34,197,94,0.2)]' :
                isCorrect === false ? 'border-red-500/50 shadow-[0_0_40px_rgba(239,68,68,0.2)]' :
                'border-white/10 shadow-2xl'
            }`}>
                
                {/* Header Decoration */}
                <div className="absolute top-0 right-0 p-4 opacity-10">
                    <Star size={80} />
                </div>

                {/* Difficulty Badge */}
                <div className="flex justify-between items-start mb-6">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border ${
                        challenge.difficulty === 'beginner' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                        challenge.difficulty === 'intermediate' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                        'bg-red-500/10 text-red-400 border-red-500/20'
                    }`}>
                        {challenge.difficulty || 'Normal'}
                    </span>
                    <span className="text-[10px] font-medium text-gray-500 uppercase tracking-widest">
                        {challenge.type === 'vocabulary' ? 'Vocabulario' : 
                         challenge.type === 'grammar' ? 'Gramática' : 
                         challenge.type}
                    </span>
                </div>

                {/* Question Section */}
                <div className="mb-8">
                    <h3 className="text-2xl font-bold text-white mb-2 leading-tight">
                        {challenge.question}
                    </h3>
                    {challenge.question_es && (
                        <p className="text-sm text-gray-400 italic">
                            {challenge.question_es}
                        </p>
                    )}
                </div>

                {/* Options Grid */}
                <div className="space-y-3">
                    {options.map((opt) => {
                        const isThisSelected = selectedId === opt.id;
                        const isThisCorrect = challenge.correct_option === opt.id;
                        
                        let stateClasses = "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20 text-gray-300";
                        if (selectedId !== null) {
                            if (isThisCorrect) {
                                stateClasses = "bg-green-500/20 border-green-500/50 text-green-400";
                            } else if (isThisSelected) {
                                stateClasses = "bg-red-500/20 border-red-500/50 text-red-400";
                            } else {
                                stateClasses = "bg-gray-800/20 border-gray-800/50 text-gray-600 opacity-50";
                            }
                        }

                        return (
                            <button
                                key={opt.id}
                                onClick={() => handleSelect(opt.id)}
                                disabled={selectedId !== null}
                                className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all duration-200 group relative ${stateClasses} ${selectedId === null ? 'cursor-pointer hover:scale-[1.02] active:scale-[0.98]' : ''}`}
                            >
                                <span className="font-semibold text-sm">{opt.text}</span>
                                <div className="flex items-center gap-2">
                                    {selectedId !== null && isThisCorrect && <Check size={18} />}
                                    {selectedId !== null && isThisSelected && !isThisCorrect && <X size={18} />}
                                </div>
                            </button>
                        );
                    })}
                </div>

                {/* Feedback Area */}
                <div className={`mt-8 overflow-hidden transition-all duration-500 ${selectedId !== null ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
                    <div className={`p-5 rounded-2xl border ${isCorrect ? 'bg-green-500/5 border-green-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
                        <div className="flex items-center gap-2 mb-2">
                            {isCorrect ? <Award className="text-green-400" size={18} /> : <ShieldAlert className="text-red-400" size={18} />}
                            <h4 className={`text-sm font-bold uppercase tracking-wider ${isCorrect ? 'text-green-400' : 'text-red-400'}`}>
                                {isCorrect ? '¡Correcto!' : '¡Sigue intentando!'}
                            </h4>
                        </div>
                        <p className="text-xs text-gray-300 leading-relaxed mb-4">
                            {challenge.explanation_es}
                        </p>
                        <button 
                            onClick={onNext}
                            className="w-full py-3 rounded-xl bg-white text-black font-bold text-xs flex items-center justify-center gap-2 hover:bg-gray-200 transition-colors uppercase tracking-widest"
                        >
                            Siguiente Desafío <ArrowRight size={14} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
