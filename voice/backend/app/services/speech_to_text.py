import os
import math
from faster_whisper import WhisperModel


class SpeechToTextService:
    def __init__(self, model_size="base"):
        """
        Initializes the faster-whisper model (CTranslate2 backend).
        Runs 100% locally on CPU with int8 quantization for speed/low RAM.
        'tiny' or 'base' are fastest; 'small' gives better vowel distinction
        for non-native speakers at the cost of some speed.
        """
        print(f"Loading faster-whisper model '{model_size}' (CPU, int8)...")
        self.model = WhisperModel(model_size, device="cpu", compute_type="int8")
        print("faster-whisper model loaded successfully.")

    def transcribe_with_confidence(
        self, audio_path: str, language: str = "en"
    ) -> tuple[str, float]:
        """
        Transcribes the audio file and returns (text, confidence).

        confidence is a 0-1 estimate derived from the model's own
        duration-weighted average log-probability across segments
        (exp(avg_logprob)), which reflects how sure the model was about
        what it heard. Useful to down-weight unclear / mumbled audio.
        """
        if not os.path.exists(audio_path):
            raise FileNotFoundError(f"Audio file not found: {audio_path}")

        segments, info = self.model.transcribe(
            audio_path,
            language=language,
            beam_size=5,
        )

        texts: list[str] = []
        weighted_logprob = 0.0
        total_duration = 0.0

        for seg in segments:
            texts.append(seg.text)
            duration = max(seg.end - seg.start, 0.0)
            # Weight each segment's avg_logprob by its duration
            weighted_logprob += seg.avg_logprob * duration
            total_duration += duration

        text = " ".join(t.strip() for t in texts).strip()

        if total_duration > 0:
            mean_logprob = weighted_logprob / total_duration
            confidence = math.exp(mean_logprob)  # logprob (<=0) -> (0, 1]
        else:
            confidence = 0.0

        # Clamp to [0, 1] for safety
        confidence = max(0.0, min(1.0, confidence))
        return text, confidence

    def transcribe(self, audio_path: str, language: str = "en") -> str:
        """Backward-compatible helper returning only the transcribed text."""
        text, _ = self.transcribe_with_confidence(audio_path, language)
        return text


# Singleton instance to be imported
stt_service = SpeechToTextService("base")
