"""Database initialisation: create tables and seed data."""

from sqlalchemy.orm import Session
from app.db.database import engine, Base, SessionLocal
from app.models.word import Word
from app.models.achievement import Achievement


SEED_WORDS = [
    # Beginner - Common words
    {"text": "hello", "difficulty": "beginner", "phonetic": "/həˈloʊ/", "category": "greetings"},
    {"text": "goodbye", "difficulty": "beginner", "phonetic": "/ɡʊdˈbaɪ/", "category": "greetings"},
    {"text": "thank you", "difficulty": "beginner", "phonetic": "/θæŋk juː/", "category": "greetings"},
    {"text": "please", "difficulty": "beginner", "phonetic": "/pliːz/", "category": "greetings"},
    {"text": "water", "difficulty": "beginner", "phonetic": "/ˈwɔːtər/", "category": "vocabulary"},
    {"text": "food", "difficulty": "beginner", "phonetic": "/fuːd/", "category": "vocabulary"},
    {"text": "house", "difficulty": "beginner", "phonetic": "/haʊs/", "category": "vocabulary"},
    {"text": "car", "difficulty": "beginner", "phonetic": "/kɑːr/", "category": "vocabulary"},
    {"text": "book", "difficulty": "beginner", "phonetic": "/bʊk/", "category": "vocabulary"},
    {"text": "school", "difficulty": "beginner", "phonetic": "/skuːl/", "category": "vocabulary"},
    {"text": "happy", "difficulty": "beginner", "phonetic": "/ˈhæpi/", "category": "vocabulary"},
    {"text": "friend", "difficulty": "beginner", "phonetic": "/frɛnd/", "category": "vocabulary"},
    {"text": "family", "difficulty": "beginner", "phonetic": "/ˈfæməli/", "category": "vocabulary"},
    {"text": "morning", "difficulty": "beginner", "phonetic": "/ˈmɔːrnɪŋ/", "category": "vocabulary"},
    {"text": "night", "difficulty": "beginner", "phonetic": "/naɪt/", "category": "vocabulary"},
    {"text": "yes", "difficulty": "beginner", "phonetic": "/jɛs/", "category": "vocabulary"},
    {"text": "no", "difficulty": "beginner", "phonetic": "/noʊ/", "category": "vocabulary"},
    # Intermediate - Trickier pronunciation
    {"text": "comfortable", "difficulty": "intermediate", "phonetic": "/ˈkʌmftərbəl/", "category": "vocabulary"},
    {"text": "vegetable", "difficulty": "intermediate", "phonetic": "/ˈvɛdʒtəbəl/", "category": "vocabulary"},
    {"text": "temperature", "difficulty": "intermediate", "phonetic": "/ˈtɛmprətʃər/", "category": "vocabulary"},
    {"text": "interesting", "difficulty": "intermediate", "phonetic": "/ˈɪntrəstɪŋ/", "category": "vocabulary"},
    {"text": "beautiful", "difficulty": "intermediate", "phonetic": "/ˈbjuːtɪfəl/", "category": "vocabulary"},
    {"text": "restaurant", "difficulty": "intermediate", "phonetic": "/ˈrɛstərɒnt/", "category": "vocabulary"},
    {"text": "environment", "difficulty": "intermediate", "phonetic": "/ɪnˈvaɪrənmənt/", "category": "vocabulary"},
    {"text": "government", "difficulty": "intermediate", "phonetic": "/ˈɡʌvərnmənt/", "category": "vocabulary"},
    {"text": "Tuesday", "difficulty": "intermediate", "phonetic": "/ˈtuːzdeɪ/", "category": "vocabulary"},
    {"text": "Wednesday", "difficulty": "intermediate", "phonetic": "/ˈwɛnzdeɪ/", "category": "vocabulary"},
    {"text": "February", "difficulty": "intermediate", "phonetic": "/ˈfɛbruˌɛri/", "category": "vocabulary"},
    {"text": "library", "difficulty": "intermediate", "phonetic": "/ˈlaɪbrɛri/", "category": "vocabulary"},
    {"text": "chocolate", "difficulty": "intermediate", "phonetic": "/ˈtʃɒklət/", "category": "vocabulary"},
    {"text": "different", "difficulty": "intermediate", "phonetic": "/ˈdɪfərənt/", "category": "vocabulary"},
    {"text": "naturally", "difficulty": "intermediate", "phonetic": "/ˈnætʃərəli/", "category": "vocabulary"},
    {"text": "probably", "difficulty": "intermediate", "phonetic": "/ˈprɒbəbli/", "category": "vocabulary"},
    {"text": "actually", "difficulty": "intermediate", "phonetic": "/ˈæktʃuəli/", "category": "vocabulary"},
    # Advanced - Difficult words
    {"text": "entrepreneurship", "difficulty": "advanced", "phonetic": "/ˌɒntrəprəˈnɜːrʃɪp/", "category": "vocabulary"},
    {"text": "peculiar", "difficulty": "advanced", "phonetic": "/pɪˈkjuːliər/", "category": "vocabulary"},
    {"text": "phenomenon", "difficulty": "advanced", "phonetic": "/fɪˈnɒmɪnɒn/", "category": "vocabulary"},
    {"text": "particularly", "difficulty": "advanced", "phonetic": "/pərˈtɪkjʊlərli/", "category": "vocabulary"},
    {"text": "thoroughly", "difficulty": "advanced", "phonetic": "/ˈθʌrəli/", "category": "vocabulary"},
    {"text": "worcestershire", "difficulty": "advanced", "phonetic": "/ˈwʊstərʃər/", "category": "vocabulary"},
    {"text": "colonel", "difficulty": "advanced", "phonetic": "/ˈkɜːrnəl/", "category": "vocabulary"},
    {"text": "psychology", "difficulty": "advanced", "phonetic": "/saɪˈkɒlədʒi/", "category": "vocabulary"},
    {"text": "hierarchy", "difficulty": "advanced", "phonetic": "/ˈhaɪərɑːrki/", "category": "vocabulary"},
    {"text": "pneumonia", "difficulty": "advanced", "phonetic": "/njuːˈmoʊniə/", "category": "vocabulary"},
    {"text": "queue", "difficulty": "advanced", "phonetic": "/kjuː/", "category": "vocabulary"},
    {"text": "subtle", "difficulty": "advanced", "phonetic": "/ˈsʌtəl/", "category": "vocabulary"},
    {"text": "conscience", "difficulty": "advanced", "phonetic": "/ˈkɒnʃəns/", "category": "vocabulary"},
    # Phrases
    {"text": "How are you doing?", "difficulty": "beginner", "phonetic": "/haʊ ɑːr juː ˈduːɪŋ/", "category": "phrases"},
    {"text": "Nice to meet you", "difficulty": "beginner", "phonetic": "/naɪs tə miːt juː/", "category": "phrases"},
    {"text": "What time is it?", "difficulty": "beginner", "phonetic": "/wɒt taɪm ɪz ɪt/", "category": "phrases"},
    {"text": "I would like a cup of coffee", "difficulty": "intermediate", "phonetic": "/aɪ wʊd laɪk ə kʌp ɒv ˈkɒfi/", "category": "phrases"},
    {"text": "Could you repeat that, please?", "difficulty": "intermediate", "phonetic": "/kʊd juː rɪˈpiːt ðæt pliːz/", "category": "phrases"},
    {"text": "The weather is really nice today", "difficulty": "intermediate", "phonetic": "/ðə ˈwɛðər ɪz ˈrɪəli naɪs təˈdeɪ/", "category": "phrases"},
    # ── Sentences (Phase 3) ───────────────────────────────
    {"text": "I enjoy learning new languages every day", "difficulty": "beginner", "phonetic": "/aɪ ɪnˈdʒɔɪ ˈlɜːrnɪŋ njuː ˈlæŋɡwɪdʒɪz ˈɛvri deɪ/", "category": "sentences"},
    {"text": "She walks to the park every morning", "difficulty": "beginner", "phonetic": "/ʃiː wɔːks tə ðə pɑːrk ˈɛvri ˈmɔːrnɪŋ/", "category": "sentences"},
    {"text": "My brother is taller than me", "difficulty": "beginner", "phonetic": "/maɪ ˈbrʌðər ɪz ˈtɔːlər ðæn miː/", "category": "sentences"},
    {"text": "The quick brown fox jumps over the lazy dog", "difficulty": "intermediate", "phonetic": "/ðə kwɪk braʊn fɒks dʒʌmps ˈoʊvər ðə ˈleɪzi dɒɡ/", "category": "sentences"},
    {"text": "Could you tell me where the nearest hospital is?", "difficulty": "intermediate", "phonetic": "/kʊd juː tɛl miː wɛr ðə ˈnɪərɪst ˈhɒspɪtəl ɪz/", "category": "sentences"},
    {"text": "I have been studying English for three years", "difficulty": "intermediate", "phonetic": "/aɪ hæv biːn ˈstʌdiɪŋ ˈɪŋɡlɪʃ fɔːr θriː jɪərz/", "category": "sentences"},
    {"text": "The restaurant around the corner serves excellent Italian food", "difficulty": "advanced", "phonetic": "/ðə ˈrɛstərɒnt əˈraʊnd ðə ˈkɔːrnər sɜːrvz ˈɛksələnt ɪˈtæliən fuːd/", "category": "sentences"},
    {"text": "She would have finished the project if she had had more time", "difficulty": "advanced", "phonetic": "/ʃiː wʊd hæv ˈfɪnɪʃt ðə ˈprɒdʒɛkt ɪf ʃiː hæd hæd mɔːr taɪm/", "category": "sentences"},
    {"text": "Although it was raining heavily, they decided to go for a hike", "difficulty": "advanced", "phonetic": "/ɔːlˈðoʊ ɪt wɒz ˈreɪnɪŋ ˈhɛvɪli ðeɪ dɪˈsaɪdɪd tə ɡoʊ fɔːr ə haɪk/", "category": "sentences"},
    {"text": "The unprecedented circumstances required extraordinary measures", "difficulty": "advanced", "phonetic": "/ðə ʌnˈprɛsɪdɛntɪd ˈsɜːrkəmstænsɪz rɪˈkwaɪərd ɪkˈstrɔːrdɪnɛri ˈmɛʒərz/", "category": "sentences"},
]


SEED_ACHIEVEMENTS = [
    # Practice milestones
    {"key": "first_word", "name": "First Step", "description": "Complete your first practice", "icon": "👶", "category": "practice"},
    {"key": "ten_words", "name": "Explorer", "description": "Practice 10 different words", "icon": "🗺️", "category": "practice"},
    {"key": "all_words", "name": "Completionist", "description": "Practice all 50+ words", "icon": "📚", "category": "practice"},
    {"key": "practice_50", "name": "Dedicated", "description": "Complete 50 practice attempts", "icon": "💪", "category": "practice"},
    {"key": "practice_100", "name": "Unstoppable", "description": "Complete 100 practice attempts", "icon": "🚀", "category": "practice"},
    # Perfect scores
    {"key": "first_perfect", "name": "Perfectionist", "description": "Get your first perfect score (95%+)", "icon": "💎", "category": "mastery"},
    {"key": "ten_perfect", "name": "Diamond Voice", "description": "Get 10 perfect scores", "icon": "🌟", "category": "mastery"},
    {"key": "high_score", "name": "Legendary", "description": "Achieve a score of 98% or higher", "icon": "👑", "category": "mastery"},
    # Mastery
    {"key": "mastery_5", "name": "Quick Learner", "description": "Master 5 words", "icon": "🎓", "category": "mastery"},
    {"key": "mastery_10", "name": "Scholar", "description": "Master 10 words", "icon": "🏅", "category": "mastery"},
    {"key": "mastery_25", "name": "Word Wizard", "description": "Master 25 words", "icon": "🧙", "category": "mastery"},
    # Streaks
    {"key": "streak_3", "name": "Warming Up", "description": "Practice 3 days in a row", "icon": "🔥", "category": "streak"},
    {"key": "streak_7", "name": "On Fire", "description": "Practice 7 days in a row", "icon": "⚡", "category": "streak"},
    {"key": "streak_30", "name": "Unstoppable Force", "description": "Practice 30 days in a row", "icon": "🌋", "category": "streak"},
]


def init_db() -> None:
    """Create all tables and seed initial data."""
    # Import all models so Base.metadata knows about them
    from app.models import user, word, recording  # noqa: F401
    from app.models import achievement  # noqa: F401
    # ── English Learning System ────────────────────────────
    from app.models import learning_challenge, user_challenge_attempt, user_learning_profile  # noqa: F401

    Base.metadata.create_all(bind=engine)

    db: Session = SessionLocal()
    try:
        # Seed words
        existing_words = db.query(Word).count()
        if existing_words == 0:
            for w in SEED_WORDS:
                db.add(Word(**w))
            db.commit()
            print(f"Seeded {len(SEED_WORDS)} words into database.")
        else:
            print(f"Database already has {existing_words} words. Skipping word seed.")

        # Seed achievements
        existing_achs = db.query(Achievement).count()
        if existing_achs == 0:
            for a in SEED_ACHIEVEMENTS:
                db.add(Achievement(**a))
            db.commit()
            print(f"Seeded {len(SEED_ACHIEVEMENTS)} achievements into database.")
        else:
            print(f"Database already has {existing_achs} achievements. Skipping seed.")
    finally:
        db.close()
