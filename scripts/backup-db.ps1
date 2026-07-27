<#
.SYNOPSIS
  Copia de seguridad de la base de datos PostgreSQL (gather_rpg).

.DESCRIPTION
  Lee DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME de gather-rpg-backend\.env
  (las mismas credenciales que usa el backend Go) y ejecuta pg_dump.
  Usa el pg_dump instalado en Windows si existe (v15+); si no, cae a Docker
  con la imagen postgres. Guarda dumps con timestamp y rota los antiguos.

.EXAMPLE
  .\scripts\backup-db.ps1
  .\scripts\backup-db.ps1 -OutDir D:\backups\odyssey -Keep 30
  .\scripts\backup-db.ps1 -Plain          # .sql comprimido en .zip en vez de formato custom
  .\scripts\backup-db.ps1 -EnvFile .\gather-rpg-backend\.env.ec2

.NOTES
  Restaurar (formato custom):
    pg_restore -h HOST -p PUERTO -U postgres -d gather_rpg --clean --if-exists ARCHIVO.dump
  Restaurar (plain):
    psql -h HOST -p PUERTO -U postgres -d gather_rpg -f ARCHIVO.sql
#>
[CmdletBinding()]
param(
    [string]$EnvFile     = (Join-Path $PSScriptRoot "..\gather-rpg-backend\.env"),
    [string]$OutDir      = (Join-Path $PSScriptRoot "..\backups\db"),
    [int]   $Keep        = 14,
    [switch]$Plain,
    [string]$DockerImage = "postgres:16-alpine"
)

$ErrorActionPreference = "Stop"

# --- 1. Credenciales desde el .env ---------------------------------------
if (-not (Test-Path $EnvFile)) {
    throw "No se encontro el archivo .env: $EnvFile"
}

$db = @{}
foreach ($line in Get-Content $EnvFile) {
    if ($line -match '^\s*(DB_HOST|DB_PORT|DB_USER|DB_PASSWORD|DB_NAME)\s*=\s*(.+?)\s*$') {
        $db[$Matches[1]] = $Matches[2]
    }
}
foreach ($k in 'DB_HOST','DB_PORT','DB_USER','DB_PASSWORD','DB_NAME') {
    if (-not $db.ContainsKey($k)) { throw "Falta $k en $EnvFile" }
}

Write-Host "Base de datos : $($db.DB_NAME) en $($db.DB_HOST):$($db.DB_PORT)"

# --- 2. Localizar pg_dump (v15+ para servidor postgres:15) ----------------
$pgDump = $null
$cmd = Get-Command pg_dump -ErrorAction SilentlyContinue
if ($cmd) { $pgDump = $cmd.Source }
if (-not $pgDump) {
    $candidates = Get-ChildItem "C:\Program Files\PostgreSQL\*\bin\pg_dump.exe" -ErrorAction SilentlyContinue |
        Sort-Object { [int]($_.Directory.Parent.Name) } -Descending
    if ($candidates) { $pgDump = $candidates[0].FullName }
}
if ($pgDump) {
    $verText = & $pgDump --version
    if ($verText -match '(\d+)\.') {
        $major = [int]$Matches[1]
        if ($major -lt 15) {
            Write-Warning "pg_dump $major es anterior al servidor (15); se usara Docker."
            $pgDump = $null
        }
    }
}

$useDocker = $false
if (-not $pgDump) {
    $docker = Get-Command docker -ErrorAction SilentlyContinue
    if (-not $docker) {
        throw "No hay pg_dump v15+ ni Docker disponibles. Instala PostgreSQL client tools o Docker Desktop."
    }
    $useDocker = $true
    Write-Host "Usando pg_dump via Docker ($DockerImage)"
} else {
    Write-Host "Usando pg_dump local: $pgDump"
}

# --- 3. Ejecutar el dump ---------------------------------------------------
if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Force $OutDir | Out-Null }
$OutDir = (Resolve-Path $OutDir).Path

$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
if ($Plain) { $ext = "sql" } else { $ext = "dump" }
$fileName = "$($db.DB_NAME)_$stamp.$ext"
$outFile  = Join-Path $OutDir $fileName

$common = @("-h", $db.DB_HOST, "-p", $db.DB_PORT, "-U", $db.DB_USER, "-d", $db.DB_NAME, "--no-password")
if ($Plain) { $format = @() } else { $format = @("-Fc", "-Z", "6") }

$env:PGPASSWORD = $db.DB_PASSWORD
try {
    if ($useDocker) {
        # El host de la DB visto desde el contenedor: localhost del host = host.docker.internal
        $dockerHost = $db.DB_HOST
        if ($dockerHost -in @("127.0.0.1", "localhost")) { $dockerHost = "host.docker.internal" }
        $dockerCommon = @("-h", $dockerHost) + $common[2..($common.Count - 1)]
        docker run --rm -e "PGPASSWORD=$($db.DB_PASSWORD)" -v "${OutDir}:/backup" $DockerImage `
            pg_dump @dockerCommon @format -f "/backup/$fileName"
    } else {
        & $pgDump @common @format -f $outFile
    }
    if ($LASTEXITCODE -ne 0) { throw "pg_dump termino con codigo $LASTEXITCODE" }
} finally {
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
}

# --- 4. Verificar ----------------------------------------------------------
$dump = Get-Item $outFile -ErrorAction SilentlyContinue
if (-not $dump -or $dump.Length -eq 0) {
    throw "El backup no se genero o quedo vacio: $outFile"
}

if ($Plain) {
    $zip = "$outFile.zip"
    Compress-Archive -Path $outFile -DestinationPath $zip -Force
    Remove-Item $outFile
    $dump = Get-Item $zip
}

$sizeMb = [math]::Round($dump.Length / 1MB, 2)
Write-Host "Backup OK: $($dump.FullName) ($sizeMb MB)" -ForegroundColor Green

# --- 5. Rotacion: conservar las $Keep copias mas recientes -----------------
$old = Get-ChildItem $OutDir -File -Filter "$($db.DB_NAME)_*" |
    Sort-Object LastWriteTime -Descending |
    Select-Object -Skip $Keep
if ($old) {
    $old | Remove-Item -Force
    Write-Host "Rotacion: eliminadas $($old.Count) copias antiguas (se conservan $Keep)."
}
