"""LearningChallenge SQLAlchemy model — mirrors the Go GORM model in gather_rpg DB."""

import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, Integer, Boolean, DateTime
from sqlalchemy.dialects.postgresql import UUID as PGUUID, ARRAY
from sqlalchemy.orm import relationship

from app.db.database import Base


class LearningChallenge(Base):
    __tablename__ = "learning_challenges"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    type = Column(String(30), nullable=False)
    question = Column(Text, nullable=False)
    option1 = Column(Text, nullable=False)
    option2 = Column(Text, nullable=False)
    option3 = Column(Text, nullable=False)
    correct_option = Column(Integer, nullable=False)
    explanation_es = Column(Text)
    question_es = Column(Text)
    tags = Column(ARRAY(String), nullable=False, default=[])
    difficulty = Column(String(20), nullable=False, default="beginner")
    language_learning = Column(String(20), nullable=False, default="english")
    phonetic = Column(String(100), nullable=True)
    requires_audio = Column(Boolean, nullable=False, default=False)
    audio_url = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    attempts = relationship("UserChallengeAttempt", back_populates="challenge")
