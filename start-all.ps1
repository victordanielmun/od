# Odyssey Development Startup Script
# Run this from the project root to lift all services

Write-Host "`n--- Starting Odyssey Development Environment ---" -ForegroundColor Cyan

# Check if Docker is running (basic check)
if (!(Get-Process -Name "Docker Desktop" -ErrorAction SilentlyContinue)) {
    Write-Host "[WARNING] Docker Desktop does not seem to be running. Docker services might fail." -ForegroundColor Yellow
}

# 1. Docker Containers
Write-Host "[1/4] Starting Docker containers (Postgres & Redis)..." -ForegroundColor Green
Set-Location -Path ".\gather-rpg-backend"
docker-compose up -d
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Failed to start Docker containers. Please check Docker status." -ForegroundColor Red
}
Set-Location -Path ".."

# 2. Go Backend
Write-Host "[2/4] Starting Go Backend (Gather RPG)..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'gather-rpg-backend'; Write-Host '-- Gather RPG Backend Logs --' -ForegroundColor Yellow; .\server.exe"

# 3. Voice Backend (Python with venv)
Write-Host "[3/4] Starting Voice Backend (FastAPI)..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'voice/backend'; Write-Host '-- Voice Backend Logs --' -ForegroundColor Yellow; .\venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000"

# 4. Vite Frontend
Write-Host "[4/4] Starting Vite Frontend (React)..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'gather-rpg-frontend'; Write-Host '-- Vite Frontend Dev Server --' -ForegroundColor Yellow; npm run dev"

Write-Host "`n--- All services started in separate windows ---" -ForegroundColor Cyan
Write-Host "Monitoring logs in the opened terminals.`n"
