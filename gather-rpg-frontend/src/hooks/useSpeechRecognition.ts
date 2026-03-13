import { useState, useCallback, useRef } from "react";
import {
    createRecognition,
    isSpeechRecognitionSupported,
} from "../services/speechService";

interface UseSpeechRecognitionReturn {
    isListening: boolean;
    transcript: string;
    confidence: number;
    startListening: () => void;
    stopListening: () => void;
    resetTranscript: () => void;
    isSupported: boolean;
    error: string | null;
}

export function useSpeechRecognition(): UseSpeechRecognitionReturn {
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState("");
    const [confidence, setConfidence] = useState(0);
    const [error, setError] = useState<string | null>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recognitionRef = useRef<any>(null);
    const isSupported = isSpeechRecognitionSupported();

    const startListening = useCallback(() => {
        setError(null);
        if (!isSupported) {
            setError("Speech recognition is not supported in this browser.");
            return;
        }
        
        try {
            const rec = createRecognition(
                (text, conf) => {
                    setTranscript(text);
                    setConfidence(conf);
                },
                () => setIsListening(false),
                (err) => setError(err)
            );
            
            if (rec) {
                recognitionRef.current = rec;
                setTranscript("");
                setConfidence(0);
                setIsListening(true);
                rec.start();
            }
        } catch (err: any) {
            console.error("Failed to start speech recognition:", err);
            setError(err.message || "Could not start microphone.");
            setIsListening(false);
        }
    }, [isSupported]);

    const stopListening = useCallback(() => {
        recognitionRef.current?.stop();
        setIsListening(false);
    }, []);

    const resetTranscript = useCallback(() => {
        setTranscript("");
        setConfidence(0);
    }, []);

    return { isListening, transcript, confidence, startListening, stopListening, resetTranscript, isSupported, error };
}
