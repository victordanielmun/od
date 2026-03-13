"""Words API endpoints."""

import random
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from app.db.database import get_db
from app.models.word import Word

router = APIRouter(prefix="/api/words", tags=["words"])


# ─── Schemas ──────────────────────────────────────────────
class WordOut(BaseModel):
    id: int
    text: str
    difficulty: Optional[str] = None
    phonetic: Optional[str] = None
    category: Optional[str] = None
    audio_url: Optional[str] = None

    model_config = {"from_attributes": True}


class WordCreate(BaseModel):
    text: str
    difficulty: Optional[str] = None
    phonetic: Optional[str] = None
    category: Optional[str] = None


# ─── Endpoints ────────────────────────────────────────────
@router.get("/", response_model=list[WordOut])
def list_words(
    difficulty: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
):
    """Return words with optional filtering by difficulty and category."""
    query = db.query(Word)
    if difficulty:
        query = query.filter(Word.difficulty == difficulty)
    if category:
        query = query.filter(Word.category == category)
    return query.offset(skip).limit(limit).all()


@router.get("/random", response_model=WordOut)
def random_word(
    difficulty: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """Return a random word, optionally filtered."""
    query = db.query(Word)
    if difficulty:
        query = query.filter(Word.difficulty == difficulty)
    if category:
        query = query.filter(Word.category == category)
    words = query.all()
    if not words:
        raise HTTPException(status_code=404, detail="No words found matching criteria")
    return random.choice(words)


@router.get("/{word_id}", response_model=WordOut)
def get_word(word_id: int, db: Session = Depends(get_db)):
    """Return a single word by ID."""
    word = db.query(Word).filter(Word.id == word_id).first()
    if not word:
        raise HTTPException(status_code=404, detail="Word not found")
    return word


@router.post("/", response_model=WordOut, status_code=201)
def create_word(payload: WordCreate, db: Session = Depends(get_db)):
    """Create a new word."""
    word = Word(**payload.model_dump())
    db.add(word)
    db.commit()
    db.refresh(word)
    return word
