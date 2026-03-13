# 🎙️ PronounceIt — English Pronunciation Trainer

AI-powered pronunciation training app with real-time speech analysis, waveform visualization, and gamification.

![Practice Page](https://img.shields.io/badge/status-production--ready-green) ![React](https://img.shields.io/badge/React-19-blue) ![FastAPI](https://img.shields.io/badge/FastAPI-0.109-009688) ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791) ![Docker](https://img.shields.io/badge/Docker-✓-2496ED)

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🎯 **Practice** | 60+ words, phrases, and sentences across 3 difficulty levels |
| 🎤 **Speech Recognition** | Browser-native Web Speech API for real-time transcription |
| 🧠 **Smart Analysis** | Blended text + phonetic matching (Double Metaphone) |
| 🟢🔴 **Word Highlighting** | Color-coded word-by-word results (correct/close/wrong) |
| 〰️ **Waveform Comparison** | Overlaid audio waveforms — reference vs your recording (WaveSurfer.js) |
| 🔊 **TTS** | Hear correct pronunciation via Google TTS (gTTS) |
| 🔐 **Authentication** | JWT + bcrypt user registration and login |
| 📊 **Progress Dashboard** | Stats, score history chart, streak tracking |
| 🏆 **Achievements** | 14 badges auto-awarded across practice, mastery & streaks |
| 📱 **Responsive** | Dark theme with glassmorphism, works on desktop & mobile |

---

## 🚀 Quick Start

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running
- [Node.js](https://nodejs.org/) ≥ 18

### 1. Clone & start backend

```bash
cd voice
docker-compose up -d --build
```

This starts:
- **PostgreSQL 16** on port `5432` (with health checks)
- **FastAPI backend** on port `8000` (auto-seeds 60+ words + 14 achievements)

### 2. Start frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at **http://localhost:5173**

### 3. Use the app

1. Go to http://localhost:5173
2. Click **"Start Practicing"**
3. Select difficulty + category
4. Click **"Listen"** to hear the correct pronunciation
5. Click **"Tap to Record"** and say the word
6. See your score, word-by-word highlights, and audio waveform comparison

---

## 🏗️ Architecture

```
voice/
├── docker-compose.yml          # PostgreSQL + FastAPI orchestration
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── .env                    # DATABASE_URL, CORS, etc.
│   └── app/
│       ├── main.py             # FastAPI app + routers
│       ├── core/
│       │   ├── config.py       # Pydantic settings
│       │   └── security.py     # JWT + bcrypt auth
│       ├── db/
│       │   ├── database.py     # SQLAlchemy engine
│       │   └── init_db.py      # Seed words + achievements
│       ├── models/
│       │   ├── user.py         # User model
│       │   ├── word.py         # Word model
│       │   ├── recording.py    # Recording + UserProgress
│       │   └── achievement.py  # Achievement + UserAchievement
│       ├── api/endpoints/
│       │   ├── words.py        # Word CRUD + random
│       │   ├── recording.py    # Upload + analyze
│       │   ├── analysis.py     # TTS generation
│       │   ├── auth.py         # Register / Login / Me
│       │   ├── progress.py     # Stats + history
│       │   └── achievements.py # List + auto-award
│       └── services/
│           └── pronunciation_analyzer.py
└── frontend/
    ├── vite.config.ts          # Vite + API proxy
    └── src/
        ├── App.tsx             # Routes + AuthProvider
        ├── index.css           # Tailwind v4 + design tokens
        ├── context/
        │   └── AuthContext.tsx  # Auth state management
        ├── hooks/
        │   ├── useSpeechRecognition.ts
        │   └── useRecorder.ts  # MediaRecorder audio capture
        ├── services/
        │   ├── api.ts          # Axios + JWT interceptor
        │   └── speechService.ts
        ├── components/
        │   ├── Navbar.tsx
        │   ├── WordCard.tsx
        │   ├── Recorder.tsx
        │   ├── FeedbackPanel.tsx        # Score ring + word highlights
        │   ├── OverlaidWaveform.tsx      # Dual WaveSurfer overlay
        │   ├── Waveform.tsx
        │   ├── AudioComparison.tsx
        │   ├── CategorySelector.tsx
        │   ├── StatsCard.tsx
        │   ├── ScoreHistory.tsx         # SVG line chart
        │   ├── AchievementBadge.tsx
        │   └── AchievementToast.tsx
        ├── pages/
        │   ├── Home.tsx
        │   ├── Practice.tsx
        │   ├── Progress.tsx
        │   ├── Achievements.tsx
        │   └── Login.tsx
        └── types/
            └── index.ts
```

---

## 📡 API Endpoints

### Words
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/words` | List words (filter by `difficulty`, `category`) |
| `GET` | `/api/words/random` | Get random word |
| `GET` | `/api/words/{id}` | Get word by ID |
| `POST` | `/api/words` | Create a new word |

### Analysis
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/analyze` | Analyze pronunciation (returns score + word analysis) |
| `POST` | `/api/tts/generate` | Generate TTS audio |
| `GET` | `/api/tts/audio/{cache_key}` | Stream cached TTS audio |

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/register` | Create account |
| `POST` | `/api/auth/login` | Login → JWT token |
| `GET` | `/api/auth/me` | Current user info (requires JWT) |

### Progress
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/progress/` | User's practiced words |
| `GET` | `/api/progress/stats` | Aggregated stats (streak, mastery, avg) |
| `GET` | `/api/progress/history` | Recent recording history |

### Achievements
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/achievements/` | All achievements + unlock status |

---

## 📝 Adding Words to the Database

### Option A: Via API (live, no restart needed)

```bash
# PowerShell
Invoke-RestMethod -Method POST -Uri "http://localhost:8000/api/words" `
  -ContentType "application/json" `
  -Body '{"text":"magnificent","difficulty":"advanced","phonetic":"/mæɡˈnɪfɪsənt/","category":"vocabulary"}'

# curl
curl -X POST http://localhost:8000/api/words \
  -H "Content-Type: application/json" \
  -d '{"text":"magnificent","difficulty":"advanced","phonetic":"/mæɡˈnɪfɪsənt/","category":"vocabulary"}'
```

### Option B: Edit seed data (for initial data)

Add entries to `SEED_WORDS` in `backend/app/db/init_db.py`:

```python
{"text": "your word", "difficulty": "beginner", "phonetic": "/jɔːr wɜːrd/", "category": "vocabulary"},
```

Then reset the database:

```bash
docker-compose down -v
docker-compose up -d --build
```

### Word Schema

| Field | Type | Values |
|-------|------|--------|
| `text` | string | The word, phrase, or sentence |
| `difficulty` | string | `beginner`, `intermediate`, `advanced` |
| `phonetic` | string | IPA transcription (optional) |
| `category` | string | `vocabulary`, `phrases`, `sentences`, `greetings` |

---

## 🧠 How the Analysis Works

1. **User records** → Web Speech API transcribes audio to text
2. **MediaRecorder** captures raw audio simultaneously (for waveform)
3. **Backend analyzes**:
   - **Text similarity** (SequenceMatcher) — 60% weight
   - **Phonetic similarity** (Double Metaphone) — 40% weight
   - **Word-level breakdown**: each word tagged as correct / phonetically close / wrong
4. **Frontend displays**:
   - Score ring (0-100)
   - 🟢 Green / 🟡 Yellow / 🔴 Red word-by-word highlights
   - Overlaid waveforms (reference vs user) with playback controls

---

## 🏆 Achievement System

14 auto-awarded badges across 3 categories:

| Category | Badge | Condition |
|----------|-------|-----------|
| **Practice** | 👶 First Step | 1 attempt |
| | 🗺️ Explorer | 10 words practiced |
| | 📚 Completionist | 50+ words |
| | 💪 Dedicated | 50 attempts |
| | 🚀 Unstoppable | 100 attempts |
| **Mastery** | 💎 Perfectionist | First ≥95% score |
| | 🌟 Diamond Voice | 10 perfect scores |
| | 👑 Legendary | ≥98% score |
| | 🎓 Quick Learner | 5 words mastered |
| | 🏅 Scholar | 10 words mastered |
| | 🧙 Word Wizard | 25 words mastered |
| **Streak** | 🔥 Warming Up | 3-day streak |
| | ⚡ On Fire | 7-day streak |
| | 🌋 Unstoppable Force | 30-day streak |

---

## ⚙️ Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql://postgres:postgres@db:5432/pronunciation_db` | Database connection |
| `DEBUG` | `true` | Debug mode |
| `CORS_ORIGINS` | `["http://localhost:5173"]` | Allowed CORS origins |
| `UPLOAD_DIR` | `uploads` | Audio upload directory |
| `TTS_CACHE_DIR` | `tts_cache` | TTS cache directory |
| `SECRET_KEY` | (in security.py) | JWT signing key |

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS v4 |
| **Audio** | WaveSurfer.js, Web Speech API, MediaRecorder |
| **Backend** | FastAPI, SQLAlchemy, Pydantic |
| **Database** | PostgreSQL 16 |
| **Auth** | JWT (python-jose), bcrypt (passlib) |
| **Analysis** | difflib.SequenceMatcher, Double Metaphone |
| **TTS** | gTTS (Google Text-to-Speech) |
| **Infra** | Docker, Docker Compose |

---

## 📄 License

MIT
