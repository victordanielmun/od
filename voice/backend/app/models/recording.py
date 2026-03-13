"""Recording and UserProgress ORM models — user_id now references gather's UUID users table."""

from datetime import datetime
from sqlalchemy import Column, Integer, Float, String, Text, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import relationship

from app.db.database import Base


class Recording(Base):
    __tablename__ = "recordings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(PGUUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    word_id = Column(Integer, ForeignKey("words.id"), nullable=False)
    audio_path = Column(String(500), nullable=True)
    transcription = Column(Text, nullable=True)
    confidence_score = Column(Float, nullable=True)
    pronunciation_score = Column(Float, nullable=True)
    feedback = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="recordings")
    word = relationship("Word", back_populates="recordings")


class UserProgress(Base):
    __tablename__ = "user_progress"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(PGUUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    word_id = Column(Integer, ForeignKey("words.id"), nullable=False)
    attempts = Column(Integer, default=0)
    best_score = Column(Float, nullable=True)
    last_practice = Column(DateTime, nullable=True)
    mastered = Column(Boolean, default=False)

    # Relationships
    user = relationship("User", back_populates="progress")
    word = relationship("Word", back_populates="progress")
