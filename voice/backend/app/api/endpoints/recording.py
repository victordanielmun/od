"""Recording and analysis API endpoints."""

import os
import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from app.db.database import get_db
from app.models.recording import Recording, UserProgress
from app.models.user import User
from app.models.learning_challenge import LearningChallenge
from app.core.config import get_settings
from app.core.security import get_current_user
from app.services.pronunciation_analyzer import PronunciationAnalyzer
from app.services.speech_to_text import stt_service
from app.api.endpoints.achievements import check_and_award_achievements

router = APIRouter(tags=["recordings"])
settings = get_settings()
analyzer = PronunciationAnalyzer()


# ─── Schemas ──────────────────────────────────────────────
class RecordingOut(BaseModel):
    id: int
    word_id: int
    transcription: Optional[str] = None
    confidence_score: Optional[float] = None
    pronunciation_score: Optional[float] = None
    feedback: Optional[dict] = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class AnalysisResult(BaseModel):
    transcription: str
    expected_text: str
    pronunciation_score: float
    confidence_score: float
    feedback: dict
    new_achievements: list[dict] = []


class AnalyzeRequest(BaseModel):
    word_id: int
    transcription: str
    confidence: float = 1.0


# ─── Endpoints ────────────────────────────────────────────
@router.post("/api/recordings", response_model=RecordingOut, status_code=201)
async def upload_recording(
    word_id: int = Form(...),
    audio: UploadFile = File(...),
    user_id: Optional[int] = Form(None),
    db: Session = Depends(get_db),
):
    """Upload an audio recording for a word."""
    word = db.query(Word).filter(Word.id == word_id).first()
    if not word:
        raise HTTPException(status_code=404, detail="Word not found")

    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    ext = os.path.splitext(audio.filename or "audio.webm")[1] or ".webm"
    filename = f"{uuid.uuid4()}{ext}"
    filepath = os.path.join(settings.UPLOAD_DIR, filename)

    content = await audio.read()
    with open(filepath, "wb") as f:
        f.write(content)

    recording = Recording(
        user_id=user_id,
        word_id=word_id,
        audio_path=filepath,
    )
    db.add(recording)
    db.commit()
    db.refresh(recording)
    return recording


@router.post("/api/analyze", response_model=AnalysisResult)
def analyze_pronunciation(
    payload: AnalyzeRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    """Analyze pronunciation based on browser-side transcription."""
    word = db.query(Word).filter(Word.id == payload.word_id).first()
    if not word:
        raise HTTPException(status_code=404, detail="Word not found")

    result = analyzer.analyze(
        expected=word.text,
        transcription=payload.transcription,
        confidence=payload.confidence,
    )

    # Persist as recording
    user_id = current_user.id if current_user else None
    recording = Recording(
        user_id=user_id,
        word_id=payload.word_id,
        transcription=payload.transcription,
        confidence_score=result["confidence_score"],
        pronunciation_score=result["pronunciation_score"],
        feedback=result["feedback"],
    )
    db.add(recording)
    db.commit()

    # ── Update user progress if authenticated ──────────────
    if current_user:
        progress = (
            db.query(UserProgress)
            .filter(
                UserProgress.user_id == current_user.id,
                UserProgress.word_id == payload.word_id,
            )
            .first()
        )
        if not progress:
            progress = UserProgress(
                user_id=current_user.id,
                word_id=payload.word_id,
                attempts=0,
                best_score=0,
            )
            db.add(progress)

        progress.attempts += 1
        progress.last_practice = datetime.utcnow()
        score = result["pronunciation_score"]
        if progress.best_score is None or score > progress.best_score:
            progress.best_score = score
        if score >= 90:
            progress.mastered = True
        db.commit()

        # ── Check achievements ──────────────────────────────
        new_achs = check_and_award_achievements(current_user.id, db)
    else:
        new_achs = []

    return AnalysisResult(
        transcription=payload.transcription,
        expected_text=word.text,
        pronunciation_score=result["pronunciation_score"],
        confidence_score=result["confidence_score"],
        feedback=result["feedback"],
        new_achievements=[a.model_dump() for a in new_achs],
    )

@router.post("/api/analyze/test")
async def analyze_test(
    challenge_id: str = Form(...),
    audio: UploadFile = File(...)
):
    try:
        content = await audio.read()
        return {"status": "ok", "challenge_id": challenge_id, "size": len(content)}
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"status": "error", "message": str(e), "tb": traceback.format_exc()}


@router.post("/api/analyze/audio", response_model=AnalysisResult)
async def analyze_audio(
    challenge_id: str = Form(...),
    audio: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    """
    Receives an audio file (e.g. from MediaRecorder blob),
    transcribes it locally using Whisper, analyzes it against the DB Challenge,
    and returns the metrics without saving RPG progress inside Python.
    """
    try:
        challenge_uuid = uuid.UUID(challenge_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid challenge_id format. Expected UUID.")

    challenge = db.query(LearningChallenge).filter(LearningChallenge.id == challenge_uuid).first()
    if not challenge:
        raise HTTPException(status_code=404, detail=f"Challenge not found: {challenge_id}")

    # 1. Save audio temp file
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    ext = os.path.splitext(audio.filename or "audio.webm")[1] or ".webm"
    filename = f"{uuid.uuid4()}{ext}"
    filepath = os.path.join(settings.UPLOAD_DIR, filename)

    content = await audio.read()
    with open(filepath, "wb") as f:
        f.write(content)

    # 2. Transcribe locally with Whisper
    transcription = ""
    try:
        transcription = stt_service.transcribe(filepath)
    except Exception as e:
        print(f"Whisper transcription error: {e}")
        pass

    # Clean transcription of common punctuation that might mess with comparison
    clean_transcription = transcription.lower().strip()
    import re
    clean_transcription = re.sub(r'[^\w\s]', '', clean_transcription)

    # 3. Analyze pronunciation against challenge question
    result = analyzer.analyze(
        expected=challenge.question,
        transcription=clean_transcription,
        confidence=1.0,
    )

    # Note: We no longer save UserProgress or Achievements here because the Go Backend (Gather RPG)
    # is the single source of truth for all game mechanics, levels, and attempts history.
    # The Frontend should submit this result straight to Go.

    return AnalysisResult(
        transcription=clean_transcription,
        expected_text=challenge.question,
        pronunciation_score=result["pronunciation_score"],
        confidence_score=result["confidence_score"],
        feedback=result["feedback"],
        new_achievements=[],
    )


@router.get("/api/recordings/{recording_id}", response_model=RecordingOut)
def get_recording(recording_id: int, db: Session = Depends(get_db)):
    """Get a recording by ID."""
    rec = db.query(Recording).filter(Recording.id == recording_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Recording not found")
    return rec
