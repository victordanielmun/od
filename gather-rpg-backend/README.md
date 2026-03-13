# 🏰 Odyssey: Gather RPG + English Learning Platform

A multiplayer top-down RPG game built with React + Phaser, featuring an integrated English pronunciation learning module powered by AI.

---

## 📦 Project Structure

```
-Odyssey-main/
├── gather-rpg-frontend/    # React + Vite + Phaser game (port 5173)
├── gather-rpg-backend/     # Go + Fiber API server (port 3000)
│   └── docker-compose.yml  # PostgreSQL (5433) + Redis (6379)
└── voice/
    └── backend/            # Python + FastAPI pronunciation API (port 8000)
```

---

## 🗄️ Unified Database

Both backends share a **single PostgreSQL database** (`gather_rpg`) running on port **5433**.

| Tabla | Backend dueño | Descripción |
|---|---|---|
| `users` | Go (GORM) | Usuarios, con UUID como PK |
| `rooms`, `map_configs`, ... | Go (GORM) | Multiplayer game state |
| `learning_challenges` | Go (GORM) | Retos de inglés (vocab, gramática, etc.) |
| `user_challenge_attempts` | Go (GORM) | Intentos del usuario con feedback de AI |
| `user_learning_profiles` | Go (GORM) | Perfil, XP, nivel, tags |
| `words`, `recordings`, `user_progress` | Voice (SQLAlchemy) | Pronunciación |
| `achievements`, `user_achievements` | Voice (SQLAlchemy) | Logros |

---

## 🚀 Cómo levantar el proyecto

### Requisitos
- [Docker Desktop](https://www.docker.com/get-started)
- [Go 1.21+](https://go.dev/dl/)
- [Node.js 18+](https://nodejs.org/)
- [Python 3.11+](https://www.python.org/)
- [Ollama](https://ollama.com/) (para el NPC conversacional)

---

### 1️⃣ Base de Datos (PostgreSQL + Redis)

```powershell
cd gather-rpg-backend
docker compose up -d
```

Esto levanta:
- **PostgreSQL** en puerto `5433` (DB: `gather_rpg`)
- **Redis** en puerto `6379`

---

### 2️⃣ Go Backend (API principal + migraciones GORM)

```powershell
cd gather-rpg-backend
.\server.exe        # o: go run cmd/server/main.go
```

> ✅ Las tablas se crean automáticamente al iniciar (AutoMigrate).
> El servidor escucha en `http://localhost:3000`

---

### 3️⃣ Voice Backend (Pronunciación + AI)

```powershell
cd voice/backend

# Primera vez: crear entorno e instalar dependencias
python -m venv venv
.\venv\Scripts\activate    # Windows
pip install -r requirements-local.txt

# Arrancar el servidor
uvicorn app.main:app --reload --port 8000
```

> ✅ Apunta a `gather_rpg` en el puerto 5433 (ya configurado en `.env`)
> El servidor escucha en `http://localhost:8000`
> Docs disponibles en `http://localhost:8000/docs`

---

### 4️⃣ Ollama (NPC Conversacional)

```powershell
# Descargar e instalar Ollama desde: https://ollama.com/
ollama pull gemma2:2b
ollama serve          # Corre en http://localhost:11434
```

---

### 5️⃣ Frontend React (Juego)

```powershell
cd gather-rpg-frontend
npm install
npm run dev
```

> El juego corre en `http://localhost:5173`

---

## 🌐 Endpoints Principales

### Go Backend (`localhost:3000`)
- `POST /auth/register` — Registro
- `POST /auth/login` — Login
- `POST /auth/guest` — Login como invitado
- `GET /rooms` — Listar salas
- `GET /maps/config` — Configuración de mapas

### Voice Backend (`localhost:8000`)
- `GET /words/random?difficulty=beginner` — Palabra aleatoria para práctica
- `POST /analyze` — Analizar pronunciación (devuelve score + tips)
- `POST /tts/generate` — Text-to-Speech
- `GET /challenges/next?user_id=UUID` — Siguiente reto de inglés
- `POST /challenges/{id}/attempt` — Responder reto (feedback IA via Ollama)
- `POST /learning/profile/setup` — Cuestionario de nivel inicial
- `GET /learning/leaderboard` — Ranking semanal
- Docs completos: `http://localhost:8000/docs`

---

## 🎮 Rutas del Frontend

| Ruta | Descripción |
|---|---|
| `/login` | Login / Registro |
| `/lobby` | Mapa principal del juego (Phaser) |
| `/learn` | **Módulo de pronunciación de inglés** |
| `/admin` | Configuración de mapas y personajes |

---

## 🔧 Variables de entorno

### `gather-rpg-backend/.env`
```env
DB_HOST=localhost
DB_PORT=5433
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=gather_rpg
REDIS_HOST=localhost
REDIS_PORT=6379
```

### `voice/backend/.env`
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/gather_rpg
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=gemma2:2b
```
