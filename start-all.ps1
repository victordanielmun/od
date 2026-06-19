# Ensure script directory context
$ScriptDir = Split-Path -Parent -Path $MyInvocation.MyCommand.Definition
if ([string]::IsNullOrEmpty($ScriptDir)) {
    $ScriptDir = $PSScriptRoot
}
if ([string]::IsNullOrEmpty($ScriptDir)) {
    $ScriptDir = Get-Location
}

Write-Host "`n--- Starting Odyssey Development Environment ---" -ForegroundColor Cyan
Write-Host "Project directory: $ScriptDir" -ForegroundColor Gray

# Check if Docker Daemon is running
$DockerRunning = $false
try {
    docker ps > $null 2>&1
    if ($LASTEXITCODE -eq 0) {
        $DockerRunning = $true
    }
} catch {
    $DockerRunning = $false
}

# 1. Docker Containers
if ($DockerRunning) {
    Write-Host "[1/4] Starting Docker containers (Postgres, Redis & Evolution)..." -ForegroundColor Green
    Set-Location -Path "$ScriptDir\gather-rpg-backend"
    docker-compose up -d
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[WARNING] Failed to start Docker containers. Continuing anyway..." -ForegroundColor Yellow
    }
    Set-Location -Path "$ScriptDir"
} else {
    Write-Host "[1/4] Docker is NOT running. Skipping Docker containers (Postgres, Redis & Evolution)." -ForegroundColor Yellow
    Write-Host "      (If you need local services, please start Docker Desktop and run the script again)" -ForegroundColor DarkGray
}

# 2. Go Backend
Write-Host "[2/4] Starting Go Backend (Gather RPG on port 3000)..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$ScriptDir\gather-rpg-backend'; Write-Host '-- Gather RPG Backend Logs --' -ForegroundColor Yellow; go run cmd/server/main.go"

# 3. Voice Backend (Python with venv)
Write-Host "[3/4] Starting Voice Backend (FastAPI on port 8000)..." -ForegroundColor Green
if (Test-Path "$ScriptDir\voice\backend\venv") {
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$ScriptDir\voice\backend'; Write-Host '-- Voice Backend Logs --' -ForegroundColor Yellow; .\venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000"
} else {
    Write-Host "[WARNING] Python virtual environment (venv) not found in 'voice\backend\venv'. Voice service skipped." -ForegroundColor Yellow
}

# 4. Vite Frontend
Write-Host "[4/4] Starting Vite Frontend (React on port 5173)..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$ScriptDir\gather-rpg-frontend'; Write-Host '-- Vite Frontend Dev Server --' -ForegroundColor Yellow; npm run dev"

Write-Host "`n--- Startup process completed ---" -ForegroundColor Cyan
Write-Host "Monitoring logs in the opened terminals.`n"
