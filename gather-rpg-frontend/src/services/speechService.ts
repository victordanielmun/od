/**
 * Speech recognition service using Web Speech API.
 * Falls back gracefully when the API isn't available (e.g. Firefox).
 */

type SpeechCallback = (transcript: string, confidence: number) => void;

/* eslint-disable @typescript-eslint/no-explicit-any */
const SpeechRecognitionCtor: any =
    typeof window !== "undefined"
        ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        : undefined;

export function isSpeechRecognitionSupported(): boolean {
    return !!SpeechRecognitionCtor;
}

export function createRecognition(
    onResult: SpeechCallback,
    onEnd: () => void,
    onError: (err: string) => void,
    lang = "en-US"
): any | null {
    if (!SpeechRecognitionCtor) return null;

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = lang;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    recognition.onresult = (event: any) => {
        const result = event.results[0][0];
        onResult(result.transcript, result.confidence);
    };

    recognition.onend = onEnd;
    recognition.onerror = (e: any) => {
        console.warn("Speech recognition error:", e.error);
        onError(e.error);
        onEnd();
    };

    return recognition;
}
