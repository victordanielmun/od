"""Application configuration using pydantic-settings."""

from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # App
    APP_NAME: str = "Pronunciation Trainer API"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True

    # Database
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/pronunciation_db"

    # CORS
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "https://localhost:5173", 
        "http://localhost:3000"
    ]    # Audio
    UPLOAD_DIR: str = "uploads"
    MAX_AUDIO_SIZE_MB: int = 10

    # TTS
    TTS_CACHE_DIR: str = "tts_cache"

    # Ollama AI
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "gemma2:2b"

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
    }


@lru_cache()
def get_settings() -> Settings:
    """Return cached settings instance."""
    return Settings()
