"""UserChallengeAttempt SQLAlchemy model — mirrors the Go GORM model in gather_rpg DB."""

import uuid
from datetime import datetime
from sqlalchemy import Column, Integer, Boolean, Text, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import relationship

from app.db.database import Base


class UserChallengeAttempt(Base):
    __tablename__ = "user_challenge_attempts"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(PGUUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    challenge_id = Column(PGUUID(as_uuid=True), ForeignKey("learning_challenges.id"), nullable=False, index=True)
    selected_option = Column(Integer, nullable=False)
    is_correct = Column(Boolean, nullable=False, default=False)
    feedback_ai = Column(Text, nullable=True)
    answered_at = Column(DateTime, default=datetime.utcnow)

    challenge = relationship("LearningChallenge", back_populates="attempts")
