"""UserLearningProfile SQLAlchemy model — mirrors the Go GORM model in gather_rpg DB."""

import uuid
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Date
from sqlalchemy.dialects.postgresql import UUID as PGUUID, ARRAY
from sqlalchemy.orm import relationship

from app.db.database import Base


class UserLearningProfile(Base):
    __tablename__ = "user_learning_profiles"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(PGUUID(as_uuid=True), ForeignKey("users.id"), nullable=False, unique=True, index=True)
    english_level = Column(String(20), nullable=False, default="beginner")
    preferred_tags = Column(ARRAY(String), nullable=False, default=[])
    weekly_score = Column(Integer, nullable=False, default=0)
    weekly_correct = Column(Integer, nullable=False, default=0)
    weekly_attempts = Column(Integer, nullable=False, default=0)
    week_start = Column(Date, nullable=True)
    current_level_xp = Column(Integer, nullable=False, default=0)
    total_xp = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
