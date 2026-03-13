"""Word ORM model."""

from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.orm import relationship

from app.db.database import Base


class Word(Base):
    __tablename__ = "words"

    id = Column(Integer, primary_key=True, index=True)
    text = Column(String(200), nullable=False)
    difficulty = Column(String(20), nullable=True)  # beginner, intermediate, advanced
    phonetic = Column(String(200), nullable=True)
    category = Column(String(50), nullable=True)  # vocabulary, phrases, sentences
    audio_url = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    recordings = relationship("Recording", back_populates="word")
    progress = relationship("UserProgress", back_populates="word")
