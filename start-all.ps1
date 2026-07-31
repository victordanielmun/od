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

# ---------------------------------------------------------------------------
# Base de datos: EC2 a través de un túnel SSH
# ---------------------------------------------------------------------------
# Lo que corras en local se guarda en la BD REAL de EC2. La conexión va por un
# túnel SSH y no directa, porque el security group de EC2 solo abre 22/80/443/
# 3000/8000: Postgres (5433) responde desde fuera pero Redis (6379) no, y el
# backend hace log.Fatal si no encuentra Redis. El túnel también evita exponer
# ambos puertos a internet.
#
# Por eso los .env apuntan a 127.0.0.1: ese localhost ES el túnel.
$UseLocalDatabase = $false   # $true → Postgres/Redis en Docker local (BD vacía)
$UseRemoteTunnel  = $true    # $false → si ya tienes el túnel abierto por tu cuenta

$RemoteHost = "ec2-user@3.14.9.51"
$RemoteKey  = "$ScriptDir\od3.pem"

if ($UseRemoteTunnel -and -not $UseLocalDatabase) {
    # ¿Ya hay algo escuchando en 5433? Entonces el túnel (o un Postgres local)
    # ya está arriba y abrir otro solo daría un error de puerto ocupado.
    $tunnelUp = $false
    try {
        $tunnelUp = (Test-NetConnection -ComputerName 127.0.0.1 -Port 5433 -InformationLevel Quiet -WarningAction SilentlyContinue)
    } catch { $tunnelUp = $false }

    if ($tunnelUp) {
        Write-Host "[0/4] Tunel SSH ya activo (127.0.0.1:5433 responde)." -ForegroundColor DarkGray
    } elseif (Test-Path $RemoteKey) {
        Write-Host "[0/4] Abriendo tunel SSH a EC2 (Postgres 5433 + Redis 6379)..." -ForegroundColor Green
        Start-Process powershell -ArgumentList "-NoExit", "-Command", "Write-Host '-- Tunel SSH a EC2 (dejar esta ventana abierta) --' -ForegroundColor Yellow; ssh -i '$RemoteKey' -N -L 5433:localhost:5433 -L 6379:localhost:6379 $RemoteHost"
        Start-Sleep -Seconds 4
    } else {
        Write-Host "[0/4] No se encontro la llave $RemoteKey. El backend no podra conectar." -ForegroundColor Red
    }
}

# 1. Docker Containers (Postgres, Redis & Evolution) — solo si $UseLocalDatabase
if ($UseLocalDatabase) {
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
} else {
    Write-Host "[1/4] Sin Docker local: los .env apuntan a la BD de EC2 por el tunel." -ForegroundColor Yellow
    Write-Host "      (Pon `$UseLocalDatabase = `$true si necesitas la BD local, incl. Evolution/WhatsApp)" -ForegroundColor DarkGray
    Write-Host "      OJO: lo que hagas aqui se escribe en la base REAL de produccion." -ForegroundColor Red
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
