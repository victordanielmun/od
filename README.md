# 🏰 Odyssey: Gather RPG + English Learning Platform

Bienvenido a Odyssey. Este proyecto integra un motor de RPG top-down multijugador (Gather RPG) con un sistema interactivo de práctica de pronunciación de inglés (Voice). 

Ambos sistemas comparten la misma base de datos PostgreSQL, lo que permite que los progresos del juego y del perfil de inglés estén integrados.

---

## 🏗️ Arquitectura del Proyecto

El ecosistema se compone de 4 piezas fundamentales ejecutándose en diferentes puertos:

1. **Base de Datos (Docker)**: PostgreSQL (5433) + Redis (6379)
2. **Backend Principal (Go)**: API multijugador, WebSockets del mapa (`localhost:3000`)
3. **Backend Voice (Python/FastAPI)**: Análisis de pronunciación y IA (`localhost:8000`)
4. **Frontend Game (Vite/React)**: El juego web con Phaser y UI (`localhost:5173`)

---

## 🚀 Cómo iniciar todo el entorno de desarrollo

Para poder desarrollar o jugar correctamente, debes levantar todos los servicios en el siguiente orden. **Se recomienda abrir 4 terminales diferentes.**

### 1️⃣ Levantar los contenedores de Datos (Docker)
Asegúrate de tener Docker Desktop abierto.
```powershell
# Abre tu TERCERA terminal, ve al backend de Go
cd gather-rpg-backend

# Levanta Postgres y Redis en segundo plano
docker compose up -d
```
*(Confirma que los contenedores están corriendo antes de seguir)*

---

### 2️⃣ Levantar el Backend Principal (Go)
Este servidor maneja el estado de las salas, los jugadores en el mapa y crea las tablas principales (GORM).
```powershell
# En la misma terminal (gather-rpg-backend) o en una NUEVA:
.\server.exe

# O si tienes Go instalado y prefieres compilar:
# go run cmd/server/main.go
```
*(Verás que dice: Listening on http://localhost:3000)*

---

### 3️⃣ Levantar el Backend de Voice (Python)
Este servidor procesa los audios de la práctica de inglés y consulta a Ollama/Claude.
```powershell
# Abre una SEGUNDA terminal
cd voice/backend

# Si el venv no existe todavía, créalo así:
python -m venv venv

# Actívalo con:
.\venv\Scripts\Activate.ps1
# Si da error de permisos, ejecuta primero: Set-ExecutionPolicy -Scope CurrentUser RemoteSigned

# (Dependiendo de tu OS alternativo)
# source venv/bin/activate    # En Mac/Linux

# Instala dependencias (usando python -m pip para evitar errores de PATH)
python -m pip install -r requirements-local.txt
python -m pip install uvicorn openai-whisper python-multipart

# --- REQUISITO IMPORTANTE DE SISTEMA (WHISPER) ---
# Para que Whisper funcione correctamente, necesitas tener instalado 'ffmpeg' en Windows.
# Si no lo tienes, descárgalo (ej. ffmpeg-master-latest-win64-gpl.zip), extráelo en C:\ffmpeg
# y agrega C:\ffmpeg\bin a las variables de entorno (PATH) de tu sistema.
# ------------------------------------------------

# Inicia el servidor FastAPI (con python -m uvicorn)
python -m uvicorn app.main:app --reload --port 8000
```
*(Verás que dice: Application startup complete. Seeded words...)*

#### 🔧 Solución: Agregar Python al PATH permanentemente (Opcional pero recomendado)
Python está instalado pero sus herramientas (`pip`, `uvicorn`) no son reconocidas directamente porque la carpeta `Scripts` no está en el PATH del sistema. Para solucionarlo:

1. Busca **"Variables de entorno"** en el menú inicio → *Editar las variables de entorno del sistema*
2. En **Variables de usuario**, selecciona `Path` → **Editar**
3. Agrega estas dos rutas (ajusta la versión de la carpeta si es diferente):
   * `C:\Users\USUARIO\AppData\Local\Programs\Python\Python313\`
   * `C:\Users\USUARIO\AppData\Local\Programs\Python\Python313\Scripts\`
4. Acepta todo y reinicia PowerShell.

Después de eso, `pip` y `uvicorn` funcionarán directamente sin necesidad de usar `python -m`.
---

### 4️⃣ Levantar el Frontend / Juego (React + Vite)
Esta es la interfaz visual del usuario.
```powershell
# Abre una CUARTA terminal
cd gather-rpg-frontend

# (Si es tu primera vez)
# npm install

# Arranca el servidor de desarrollo
npm run dev
```
*(Verás un enlace a http://localhost:5173)*

---

## 🎮 ¡Listo para jugar!

Una vez los 4 pasos estén corriendo, simplemente abre tu navegador en:
👉 **[http://localhost:5173](http://localhost:5173)**

*   **Login**: Puedes acceder como invitado (`Guest Login`) o registrarte.
*   **Lobby**: Entrarás al mapa principal ("Lobby") para caminar con tu personaje.
*   **Editor**: Para construir edificios o mapas, añade `?edit_map=lobby` a la URL si eres admin.
*   **Aprender Inglés**: Interactúa (presionando la **E**) con los edificios que estén configurados con ruta web, o ve manualmente a **[http://localhost:5173/learn](http://localhost:5173/learn)**.
