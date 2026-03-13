interface RecorderProps {
    isListening: boolean;
    onStart: () => void;
    onStop: () => void;
    transcript: string;
    isSupported: boolean;
}

export default function Recorder({
    isListening,
    onStart,
    onStop,
    transcript,
    isSupported,
}: RecorderProps) {
    if (!isSupported) {
        return (
            <div className="glass-card p-6 text-center text-amber-400 animate-slide-up">
                <p className="text-lg font-semibold mb-1">⚠️ Speech Recognition Unavailable</p>
                <p className="text-sm text-text-muted">
                    Please use&nbsp;
                    <span className="text-white font-medium">Google Chrome</span> or{" "}
                    <span className="text-white font-medium">Microsoft Edge</span> for
                    speech recognition support.
                </p>
            </div>
        );
    }

    return (
        <div className="glass-card p-8 flex flex-col items-center gap-6 animate-slide-up">
            {/* Record button */}
            <button
                onClick={isListening ? onStop : onStart}
                className="relative group cursor-pointer"
            >
                <div
                    className={`w-24 h-24 rounded-full flex items-center justify-center
                      transition-all duration-300 ${isListening
                            ? "bg-danger recording-pulse shadow-[0_0_40px_rgba(239,68,68,0.3)]"
                            : "bg-primary hover:bg-primary-light shadow-[0_0_30px_rgba(99,102,241,0.25)] hover:shadow-[0_0_40px_rgba(99,102,241,0.4)]"
                        }`}
                >
                    {isListening ? (
                        /* Stop icon */
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="white"
                            className="w-10 h-10"
                        >
                            <path
                                fillRule="evenodd"
                                d="M4.5 7.5a3 3 0 013-3h9a3 3 0 013 3v9a3 3 0 01-3 3h-9a3 3 0 01-3-3v-9z"
                                clipRule="evenodd"
                            />
                        </svg>
                    ) : (
                        /* Mic icon */
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="white"
                            className="w-10 h-10"
                        >
                            <path d="M8.25 4.5a3.75 3.75 0 117.5 0v8.25a3.75 3.75 0 11-7.5 0V4.5z" />
                            <path d="M6 10.5a.75.75 0 01.75.75v1.5a5.25 5.25 0 1010.5 0v-1.5a.75.75 0 011.5 0v1.5a6.751 6.751 0 01-6 6.709v2.291h3a.75.75 0 010 1.5h-7.5a.75.75 0 010-1.5h3v-2.291a6.751 6.751 0 01-6-6.709v-1.5A.75.75 0 016 10.5z" />
                        </svg>
                    )}
                </div>
            </button>

            {/* Status label */}
            <p className="text-text-muted text-sm font-medium tracking-wide uppercase">
                {isListening ? (
                    <span className="text-danger flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-danger animate-pulse" />
                        Listening…
                    </span>
                ) : (
                    "Tap to record"
                )}
            </p>

            {/* Live transcript */}
            {transcript && (
                <div className="w-full mt-2 p-4 rounded-xl bg-surface-lighter/60 border border-white/5">
                    <p className="text-xs text-text-muted mb-1 uppercase tracking-wide">
                        You said:
                    </p>
                    <p className="text-lg text-white font-medium">{transcript}</p>
                </div>
            )}
        </div>
    );
}
