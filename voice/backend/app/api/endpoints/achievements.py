"""Achievements API endpoints and auto-award logic."""

from datetime import datetime
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from app.db.database import get_db
from app.models.user import User
from app.models.achievement import Achievement, UserAchievement
from app.models.recording import Recording, UserProgress
from app.core.security import get_current_user, require_current_user

router = APIRouter(prefix="/api/achievements", tags=["achievements"])


# ─── Schemas ──────────────────────────────────────────────
class AchievementOut(BaseModel):
    id: int
    key: str
    name: str
    description: str
    icon: str
    category: Optional[str] = None
    unlocked: bool = False
    unlocked_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class NewAchievementOut(BaseModel):
    """Returned when a new achievement is unlocked."""
    achievement: AchievementOut
    is_new: bool = True


# ─── Endpoints ────────────────────────────────────────────
@router.get("/", response_model=list[AchievementOut])
def list_achievements(
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user),
):
    """List all achievements with user unlock status."""
    all_achievements = db.query(Achievement).all()
    user_unlocked: set[int] = set()
    unlock_times: dict[int, datetime] = {}

    if user:
        user_achs = (
            db.query(UserAchievement)
            .filter(UserAchievement.user_id == user.id)
            .all()
        )
        for ua in user_achs:
            user_unlocked.add(ua.achievement_id)
            unlock_times[ua.achievement_id] = ua.unlocked_at

    result = []
    for a in all_achievements:
        result.append(
            AchievementOut(
                id=a.id,
                key=a.key,
                name=a.name,
                description=a.description,
                icon=a.icon,
                category=a.category,
                unlocked=a.id in user_unlocked,
                unlocked_at=unlock_times.get(a.id),
            )
        )
    return result


# ─── Achievement Checker ──────────────────────────────────
def check_and_award_achievements(
    user_id: int, db: Session
) -> list[AchievementOut]:
    """Check all achievement conditions and award any new ones. Returns newly unlocked."""
    newly_unlocked: list[AchievementOut] = []

    # Gather user stats
    progress_entries = (
        db.query(UserProgress).filter(UserProgress.user_id == user_id).all()
    )
    recordings = (
        db.query(Recording).filter(Recording.user_id == user_id).all()
    )

    total_attempts = sum(p.attempts for p in progress_entries)
    words_practiced = len(progress_entries)
    words_mastered = sum(1 for p in progress_entries if p.mastered)
    perfect_scores = sum(
        1 for r in recordings if r.pronunciation_score and r.pronunciation_score >= 95
    )
    best_score = max(
        (r.pronunciation_score for r in recordings if r.pronunciation_score),
        default=0,
    )

    # Calculate streak
    dates = sorted(
        {p.last_practice.date() for p in progress_entries if p.last_practice},
        reverse=True,
    )
    from datetime import date, timedelta
    streak = 0
    expected = date.today()
    for d in dates:
        if d == expected:
            streak += 1
            expected -= timedelta(days=1)
        elif d < expected:
            break

    # Achievement conditions map
    conditions: dict[str, bool] = {
        "first_word": total_attempts >= 1,
        "ten_words": words_practiced >= 10,
        "all_words": words_practiced >= 50,
        "first_perfect": perfect_scores >= 1,
        "ten_perfect": perfect_scores >= 10,
        "streak_3": streak >= 3,
        "streak_7": streak >= 7,
        "streak_30": streak >= 30,
        "mastery_5": words_mastered >= 5,
        "mastery_10": words_mastered >= 10,
        "mastery_25": words_mastered >= 25,
        "practice_50": total_attempts >= 50,
        "practice_100": total_attempts >= 100,
        "high_score": best_score >= 98,
    }

    # Check which are already unlocked
    existing = set(
        ua.achievement_id
        for ua in db.query(UserAchievement)
        .filter(UserAchievement.user_id == user_id)
        .all()
    )

    all_achievements = db.query(Achievement).all()
    for ach in all_achievements:
        if ach.id in existing:
            continue
        if conditions.get(ach.key, False):
            ua = UserAchievement(
                user_id=user_id,
                achievement_id=ach.id,
                unlocked_at=datetime.utcnow(),
            )
            db.add(ua)
            newly_unlocked.append(
                AchievementOut(
                    id=ach.id,
                    key=ach.key,
                    name=ach.name,
                    description=ach.description,
                    icon=ach.icon,
                    category=ach.category,
                    unlocked=True,
                    unlocked_at=ua.unlocked_at,
                )
            )

    if newly_unlocked:
        db.commit()

    return newly_unlocked
