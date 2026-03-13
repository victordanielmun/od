"""User ORM model — references the gather_rpg users table (UUID primary key)."""

from sqlalchemy import Column, String, DateTime, func
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import relationship

from app.db.database import Base


class User(Base):
    """
    Reflects the `users` table owned by the Go Gather backend.
    DO NOT run create_all for this table — GORM manages it.
    This mapping is read-only for the Voice backend.
    """
    __tablename__ = "users"

    id = Column(PGUUID(as_uuid=True), primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    recordings = relationship("Recording", back_populates="user", cascade="all, delete-orphan")
    progress = relationship("UserProgress", back_populates="user", cascade="all, delete-orphan")
