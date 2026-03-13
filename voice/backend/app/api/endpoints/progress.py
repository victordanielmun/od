"""Progress tracking API endpoints."""

from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from pydantic import BaseModel
from typing import Optional

from app.db.database import get_db
from app.models.user import User
from app.models.recording import Recording, UserProgress
from app.models.word import Word
from app.core.security import require_current_user

router = APIRouter(prefix="/api/progress", tags=["progress"])


# ─── Schemas ──────────────────────────────────────────────
class ProgressOut(BaseModel):
    word_id: int
    word_text: str
    difficulty: Optional[str] = None
    attempts: int
    best_score: Optional[float] = None
    mastered: bool
    last_practice: Optional[datetime] = None


class StatsOut(BaseModel):
    total_words_practiced: int
    total_attempts: int
    average_score: float
    words_mastered: int
    best_score: float
    current_streak: int
    beginner_mastered: int
    intermediate_mastered: int
    advanced_mastered: int


class HistoryItem(BaseModel):
    id: int
    word_text: str
    transcription: Optional[str] = None
    pronunciation_score: Optional[float] = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ─── Endpoints ────────────────────────────────────────────
@router.get("/", response_model=list[ProgressOut])
def get_progress(
    user: User = Depends(require_current_user),
    db: Session = Depends(get_db),
):
    """Get progress for all words the user has practiced."""
    progress_entries = (
        db.query(UserProgress)
        .filter(UserProgress.user_id == user.id)
        .all()
    )
    result = []
    for p in progress_entries:
        word = db.query(Word).filter(Word.id == p.word_id).first()
        if word:
            result.append(
                ProgressOut(
                    word_id=p.word_id,
                    word_text=word.text,
                    difficulty=word.difficulty,
                    attempts=p.attempts,
                    best_score=p.best_score,
                    mastered=p.mastered,
                    last_practice=p.last_practice,
                )
            )
    return result


@router.get("/stats", response_model=StatsOut)
def get_stats(
    user: User = Depends(require_current_user),
    db: Session = Depends(get_db),
):
    """Get aggregated statistics for the user."""
    progress_entries = (
        db.query(UserProgress)
        .filter(UserProgress.user_id == user.id)
        .all()
    )

    total_words = len(progress_entries)
    total_attempts = sum(p.attempts for p in progress_entries)
    scores = [p.best_score for p in progress_entries if p.best_score is not None]
    avg_score = round(sum(scores) / len(scores), 1) if scores else 0.0
    best_score = max(scores) if scores else 0.0
    mastered = [p for p in progress_entries if p.mastered]

    # Mastered by difficulty
    mastered_words = db.query(Word).filter(
        Word.id.in_([p.word_id for p in mastered])
    ).all() if mastered else []
    beginner_m = sum(1 for w in mastered_words if w.difficulty == "beginner")
    intermediate_m = sum(1 for w in mastered_words if w.difficulty == "intermediate")
    advanced_m = sum(1 for w in mastered_words if w.difficulty == "advanced")

    # Simple streak calc: consecutive days with at least one practice
    streak = _calc_streak(progress_entries)

    return StatsOut(
        total_words_practiced=total_words,
        total_attempts=total_attempts,
        average_score=avg_score,
        words_mastered=len(mastered),
        best_score=best_score,
        current_streak=streak,
        beginner_mastered=beginner_m,
        intermediate_mastered=intermediate_m,
        advanced_mastered=advanced_m,
    )


@router.get("/history", response_model=list[HistoryItem])
def get_history(
    limit: int = 20,
    user: User = Depends(require_current_user),
    db: Session = Depends(get_db),
):
    """Get recent recording history."""
    recordings = (
        db.query(Recording)
        .filter(Recording.user_id == user.id)
        .order_by(desc(Recording.created_at))
        .limit(limit)
        .all()
    )
    result = []
    for r in recordings:
        word = db.query(Word).filter(Word.id == r.word_id).first()
        result.append(
            HistoryItem(
                id=r.id,
                word_text=word.text if word else "—",
                transcription=r.transcription,
                pronunciation_score=r.pronunciation_score,
                created_at=r.created_at,
            )
        )
    return result


# ─── Helpers ──────────────────────────────────────────────
def _calc_streak(entries: list[UserProgress]) -> int:
    """Calculate consecutive practice days streak."""
    if not entries:
        return 0
    dates = sorted(
        {p.last_practice.date() for p in entries if p.last_practice},
        reverse=True,
    )
    if not dates:
        return 0

    from datetime import date, timedelta

    streak = 0
    expected = date.today()
    for d in dates:
        if d == expected:
            streak += 1
            expected -= timedelta(days=1)
        elif d < expected:
            break
    return streak
