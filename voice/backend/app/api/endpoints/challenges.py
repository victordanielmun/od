"""Challenge endpoints — CRUD, next challenge selection, and attempt recording with Ollama feedback."""

import uuid
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel

from app.db.database import get_db
from app.models.learning_challenge import LearningChallenge
from app.models.user_challenge_attempt import UserChallengeAttempt
from app.services.ollama_service import generate_feedback

router = APIRouter(prefix="/challenges", tags=["challenges"])


# ── Pydantic Schemas ──────────────────────────────────────────────────────────

class ChallengeOut(BaseModel):
    id: uuid.UUID
    type: str
    question: str
    option_1: str
    option_2: str
    option_3: str
    difficulty: str
    tags: List[str]
    requires_audio: bool
    audio_url: Optional[str] = None

    class Config:
        from_attributes = True


class ChallengeCreate(BaseModel):
    type: str
    question: str
    option_1: str
    option_2: str
    option_3: str
    correct_option: int
    explanation_es: str
    tags: List[str] = []
    difficulty: str = "beginner"
    language_learning: str = "english"
    requires_audio: bool = False
    audio_url: Optional[str] = None


class AttemptIn(BaseModel):
    selected_option: int  # 1, 2 or 3
    user_id: uuid.UUID


class AttemptOut(BaseModel):
    id: uuid.UUID
    challenge_id: uuid.UUID
    selected_option: int
    is_correct: bool
    feedback_ai: Optional[str] = None
    correct_option: int
    explanation_es: str

    class Config:
        from_attributes = True


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/next", response_model=Optional[ChallengeOut])
def get_next_challenge(
    user_id: uuid.UUID,
    difficulty: Optional[str] = None,
    tags: Optional[str] = None,  # comma-separated tags
    db: Session = Depends(get_db),
):
    """
    Return the next unanswered challenge for the user based on:
    - Their difficulty level
    - Their preferred tags (if provided)
    - Excluding challenges the user has answered correctly ≥ 3 times
    """
    # Build subquery: challenges answered correctly ≥ 3 times by this user
    mastered_ids = (
        db.query(UserChallengeAttempt.challenge_id)
        .filter(
            UserChallengeAttempt.user_id == user_id,
            UserChallengeAttempt.is_correct == True,
        )
        .group_by(UserChallengeAttempt.challenge_id)
        .having(func.count(UserChallengeAttempt.id) >= 3)
        .subquery()
    )

    query = db.query(LearningChallenge).filter(
        LearningChallenge.id.not_in(db.query(mastered_ids.c.challenge_id))
    )

    if difficulty:
        query = query.filter(LearningChallenge.difficulty == difficulty)

    if tags:
        tag_list = [t.strip() for t in tags.split(",") if t.strip()]
        if tag_list:
            # Postgres array overlap: challenge.tags && tag_list
            query = query.filter(
                LearningChallenge.tags.overlap(tag_list)
            )

    challenge = query.order_by(func.random()).first()
    return challenge


@router.post("/{challenge_id}/attempt", response_model=AttemptOut)
async def submit_attempt(
    challenge_id: uuid.UUID,
    attempt: AttemptIn,
    db: Session = Depends(get_db),
):
    """
    Submit an answer to a challenge.
    - Checks if the answer is correct
    - Generates AI feedback via Ollama gemma2:2b
    - Saves and returns the attempt
    """
    challenge = db.query(LearningChallenge).filter(LearningChallenge.id == challenge_id).first()
    if not challenge:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Challenge not found")

    if attempt.selected_option not in (1, 2, 3):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="selected_option must be 1, 2 or 3")

    is_correct = attempt.selected_option == challenge.correct_option
    options = {1: challenge.option_1, 2: challenge.option_2, 3: challenge.option_3}
    correct_text = options[challenge.correct_option]
    user_text = options[attempt.selected_option]

    # Generate AI feedback
    feedback = await generate_feedback(
        question=challenge.question,
        correct_answer=correct_text,
        user_answer=user_text,
        is_correct=is_correct,
        explanation_es=challenge.explanation_es,
    )

    db_attempt = UserChallengeAttempt(
        user_id=attempt.user_id,
        challenge_id=challenge_id,
        selected_option=attempt.selected_option,
        is_correct=is_correct,
        feedback_ai=feedback,
        answered_at=datetime.now(timezone.utc),
    )
    db.add(db_attempt)
    db.commit()
    db.refresh(db_attempt)

    return AttemptOut(
        id=db_attempt.id,
        challenge_id=db_attempt.challenge_id,
        selected_option=db_attempt.selected_option,
        is_correct=db_attempt.is_correct,
        feedback_ai=db_attempt.feedback_ai,
        correct_option=challenge.correct_option,
        explanation_es=challenge.explanation_es,
    )


@router.get("/", response_model=List[ChallengeOut])
def list_challenges(
    difficulty: Optional[str] = None,
    type: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
):
    """List challenges with optional filters."""
    query = db.query(LearningChallenge)
    if difficulty:
        query = query.filter(LearningChallenge.difficulty == difficulty)
    if type:
        query = query.filter(LearningChallenge.type == type)
    return query.offset(skip).limit(limit).all()


@router.post("/", response_model=ChallengeOut, status_code=status.HTTP_201_CREATED)
def create_challenge(challenge: ChallengeCreate, db: Session = Depends(get_db)):
    """(Admin) Create a new learning challenge."""
    db_challenge = LearningChallenge(**challenge.model_dump())
    db.add(db_challenge)
    db.commit()
    db.refresh(db_challenge)
    return db_challenge
