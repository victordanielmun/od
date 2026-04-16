"""TTS (Text-to-Speech) API endpoints."""

import os
import hashlib
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from gtts import gTTS

from app.core.config import get_settings

router = APIRouter(prefix="/api/tts", tags=["tts"])
settings = get_settings()


class TTSRequest(BaseModel):
    text: str
    lang: str = "en"
    voice: str = None # Nombre de la voz (ej: en-US-AriaNeural)


@router.post("/generate")
async def generate_tts(payload: TTSRequest):
    """Generate TTS audio for a given text and return the file URL."""
    if not payload.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")

    os.makedirs(settings.TTS_CACHE_DIR, exist_ok=True)

    # Cache key based on text + language + voice
    cache_key = hashlib.md5(f"{payload.text}_{payload.lang}_{payload.voice or ''}".encode()).hexdigest()
    filepath = os.path.join(settings.TTS_CACHE_DIR, f"{cache_key}.mp3")

    if not os.path.exists(filepath):
        try:
            # Si se especifica una voz, usamos edge-tts (Alta calidad Neural)
            if payload.voice:
                import edge_tts
                communicate = edge_tts.Communicate(payload.text, payload.voice)
                await communicate.save(filepath)
            else:
                # Fallback a gTTS
                tts = gTTS(text=payload.text, lang=payload.lang, slow=False)
                tts.save(filepath)
        except Exception as e:
            print(f"TTS error: {e}")
            raise HTTPException(
                status_code=500, 
                detail=f"Failed to generate audio: {str(e)}"
            )

    return {"audio_url": f"/api/tts/audio/{cache_key}", "cache_key": cache_key}


@router.get("/audio/{cache_key}")
def get_tts_audio(cache_key: str):
    """Stream a cached TTS audio file."""
    filepath = os.path.join(settings.TTS_CACHE_DIR, f"{cache_key}.mp3")
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Audio not found")
    return FileResponse(filepath, media_type="audio/mpeg", filename=f"{cache_key}.mp3")
