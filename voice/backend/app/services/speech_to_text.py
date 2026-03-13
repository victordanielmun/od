import os
import whisper
import warnings

# Ignore fp16 warning on standard CPUs
warnings.filterwarnings("ignore", message="FP16 is not supported on CPU; using FP32 instead")

class SpeechToTextService:
    def __init__(self, model_size="base"):
        """
        Initializes the Whisper model. 
        'tiny' or 'base' are recommended for CPU-only fast inference.
        """
        print(f"Loading Whisper model '{model_size}'...")
        self.model = whisper.load_model(model_size)
        print("Whisper model loaded successfully.")

    def transcribe(self, audio_path: str, language: str = "en") -> str:
        """
        Transcribes the audio file at the given path.
        Returns the transcribed text.
        """
        if not os.path.exists(audio_path):
            raise FileNotFoundError(f"Audio file not found: {audio_path}")

        result = self.model.transcribe(
            audio_path,
            language=language,
            fp16=False # Force FP32 to avoid warnings on CPU
        )
        return result["text"].strip()

# Singleton instance to be imported
stt_service = SpeechToTextService("base")
