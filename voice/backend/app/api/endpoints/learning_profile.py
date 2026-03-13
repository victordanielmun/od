"""Learning profile endpoints — onboarding quiz, profile view, and weekly leaderboard."""

import uuid
from datetime import date, datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc
from pydantic import BaseModel

from app.db.database import get_db
from app.models.user_learning_profile import UserLearningProfile

router = APIRouter(prefix="/learning", tags=["learning"])

XP_PER_CORRECT = 10
XP_PER_LEVEL = 100


# ── Pydantic Schemas ──────────────────────────────────────────────────────────

class ProfileSetup(BaseModel):
    user_id: uuid.UUID
    english_level: str  # beginner | intermediate | advanced
    preferred_tags: List[str]  # ["travel", "work", "communication"]


class ProfileOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    english_level: str
    preferred_tags: List[str]
    weekly_score: int
    weekly_correct: int
    weekly_attempts: int
    current_level_xp: int
    total_xp: int
    level: int  # computed: total_xp // XP_PER_LEVEL

    class Config:
        from_attributes = True


class LeaderboardEntry(BaseModel):
    user_id: uuid.UUID
    weekly_score: int
    weekly_correct: int
    level: int


# ── Helpers ───────────────────────────────────────────────────────────────────

def _reset_weekly_if_needed(profile: UserLearningProfile) -> None:
    """Reset weekly stats if we're in a new week."""
    today = date.today()
    week_start = today - __import__("datetime").timedelta(days=today.weekday())
    if profile.week_start is None or profile.week_start < week_start:
        profile.weekly_score = 0
        profile.weekly_correct = 0
        profile.weekly_attempts = 0
        profile.week_start = week_start


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/profile/setup", response_model=ProfileOut, status_code=status.HTTP_201_CREATED)
def setup_profile(data: ProfileSetup, db: Session = Depends(get_db)):
    """
    Upsert a user's learning profile after they complete the onboarding quiz.
    """
    profile = db.query(UserLearningProfile).filter(UserLearningProfile.user_id == data.user_id).first()
    if profile:
        # Update preferences
        profile.english_level = data.english_level
        profile.preferred_tags = data.preferred_tags
        profile.updated_at = datetime.now(timezone.utc)
    else:
        today = date.today()
        week_start = today - __import__("datetime").timedelta(days=today.weekday())
        profile = UserLearningProfile(
            user_id=data.user_id,
            english_level=data.english_level,
            preferred_tags=data.preferred_tags,
            week_start=week_start,
        )
        db.add(profile)

    db.commit()
    db.refresh(profile)

    return ProfileOut(
        **{c.name: getattr(profile, c.name) for c in profile.__table__.columns},
        level=profile.total_xp // XP_PER_LEVEL,
    )


@router.get("/profile/{user_id}", response_model=ProfileOut)
def get_profile(user_id: uuid.UUID, db: Session = Depends(get_db)):
    """Get a user's learning profile."""
    profile = db.query(UserLearningProfile).filter(UserLearningProfile.user_id == user_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found. Please complete onboarding.")
    _reset_weekly_if_needed(profile)
    db.commit()
    return ProfileOut(
        **{c.name: getattr(profile, c.name) for c in profile.__table__.columns},
        level=profile.total_xp // XP_PER_LEVEL,
    )


@router.post("/profile/{user_id}/xp")
def add_xp(user_id: uuid.UUID, is_correct: bool, db: Session = Depends(get_db)):
    """
    Called internally after a challenge attempt to update XP and weekly scores.
    """
    profile = db.query(UserLearningProfile).filter(UserLearningProfile.user_id == user_id).first()
    if not profile:
        return {"detail": "No profile found"}

    _reset_weekly_if_needed(profile)
    profile.weekly_attempts += 1

    if is_correct:
        xp_earned = XP_PER_CORRECT
        profile.weekly_correct += 1
        profile.weekly_score += xp_earned
        profile.total_xp += xp_earned
        profile.current_level_xp = profile.total_xp % XP_PER_LEVEL

        # Auto-level up: when accuracy is high enough, suggest next difficulty
        accuracy = profile.weekly_correct / max(profile.weekly_attempts, 1)
        if accuracy >= 0.8 and profile.weekly_attempts >= 10 and profile.english_level == "beginner":
            profile.english_level = "intermediate"
        elif accuracy >= 0.8 and profile.weekly_attempts >= 20 and profile.english_level == "intermediate":
            profile.english_level = "advanced"

    db.commit()
    return {"total_xp": profile.total_xp, "level": profile.total_xp // XP_PER_LEVEL}


@router.get("/leaderboard", response_model=List[LeaderboardEntry])
def get_leaderboard(limit: int = 20, db: Session = Depends(get_db)):
    """Weekly leaderboard sorted by weekly score descending."""
    profiles = (
        db.query(UserLearningProfile)
        .order_by(desc(UserLearningProfile.weekly_score))
        .limit(limit)
        .all()
    )
    return [
        LeaderboardEntry(
            user_id=p.user_id,
            weekly_score=p.weekly_score,
            weekly_correct=p.weekly_correct,
            level=p.total_xp // XP_PER_LEVEL,
        )
        for p in profiles
    ]
