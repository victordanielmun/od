import React from 'react';
import Waveform from './Waveform';

export default function AudioComparison({
    referenceUrl,
    userUrl,
    score,
}) {
    const scoreColor =
        score !== undefined
            ? score >= 80
                ? "#4ade80" // green-400
                : score >= 60
                    ? "#fbbf24" // amber-400
                    : "#f87171" // red-400
            : "#818cf8"; // indigo-400

    return (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-5 animate-fadeIn w-full">
            <div className="flex items-center justify-between">
                <h3 className="text-sm text-white font-semibold flex items-center gap-2">
                    〰️ Audio Comparison
                </h3>
            </div>

            <p className="text-xs text-gray-400 -mt-2">
                Compare the waveforms — listen to each and notice differences in rhythm, stress, and intonation.
            </p>

            {/* Reference waveform */}
            {referenceUrl && (
                <Waveform
                    audioUrl={referenceUrl}
                    label="🔊 Correct Pronunciation"
                    color="#6366f1"
                    progressColor="#818cf8"
                    height={50}
                />
            )}

            {/* Divider with arrow */}
            <div className="flex items-center gap-3 px-2">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-gray-500 text-xs">VS</span>
                <div className="flex-1 h-px bg-white/10" />
            </div>

            {/* User waveform */}
            {userUrl && (
                <Waveform
                    audioUrl={userUrl}
                    label="🎙️ Your Pronunciation"
                    color={scoreColor}
                    progressColor={scoreColor}
                    height={50}
                />
            )}
        </div>
    );
}
