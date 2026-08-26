<#
.SYNOPSIS
  Construye y/o publica el mundo "Mundo 2: Pronombres" contra la API de
  produccion (ver PLAN_CLONACION_MAPAS_MISION.md).

.DESCRIPTION
  Wrapper de los scripts Python en scripts\world-builder\ (stdlib, sin
  dependencias). Cada etapa es idempotente -- segura de re-correr.

    build    Clona 5 mapas + crea misiones/NPCs/tareas/challenges en
             status=draft / world_id=NULL (invisible para jugadores), y
             repara los huecos ya detectados en World 1 (mundo_1).
    validate Solo lectura: confirma el estado actual de mapas, misiones,
             NPCs, tareas y challenges.
    publish  Crea el World "mundo_2" y pasa las 5 misiones a
             world_id + status=active -- HACE VISIBLE el mundo a
             jugadores reales. Correr solo despues de validar el build.
    adjust   Ajustes post-publicacion: pistas de respuesta en Mochi,
             pronoun_village_2/pronoun_square pasan de introducir gramatica
             nueva a REPETIR pronombres sujeto en contextos nuevos, y
             re-etiqueta/completa los challenges acorde (ver README.md).
    adjust2  Corrige el patron greeting/instructions de 14 NPCs: el
             saludo ya no mezcla contenido de la leccion, e instructions
             pasa a un patron explicito de 2 frases + 2 frases mas con
             invitacion a repetir (ver README.md).
    all      build, luego validate (no publica solo -- ver -Confirm).

.PARAMETER Step
  build | validate | publish | all

.PARAMETER AdminEmail
  Email del admin para /auth/login. Por defecto el admin sembrado por
  SeedAdminUser() (gather-rpg-backend/internal/database/seed.go).

.PARAMETER AdminPassword
  Password del admin. Mismo default que AdminEmail.

.EXAMPLE
  .\scripts\mundo2-pronombres.ps1 -Step validate
  .\scripts\mundo2-pronombres.ps1 -Step build
  .\scripts\mundo2-pronombres.ps1 -Step publish

.NOTES
  Las credenciales por defecto (admin@odyssey.dev / Admin123!) ya estan en
  claro en el codigo del seed -- no son un secreto nuevo. Si en algun
  momento se crea un admin dedicado para estos scripts, pasar
  -AdminEmail/-AdminPassword o setear ODYSSEY_ADMIN_EMAIL/ODYSSEY_ADMIN_PASSWORD.
#>
[CmdletBinding()]
param(
    [ValidateSet("build", "validate", "publish", "adjust", "adjust2", "all")]
    [string]$Step = "validate",

    [string]$AdminEmail    = $env:ODYSSEY_ADMIN_EMAIL,
    [string]$AdminPassword = $env:ODYSSEY_ADMIN_PASSWORD,
    [string]$ApiBase       = $env:ODYSSEY_API_BASE
)

$ErrorActionPreference = "Stop"
$scriptDir = Join-Path $PSScriptRoot "world-builder"

if ($AdminEmail)    { $env:ODYSSEY_ADMIN_EMAIL = $AdminEmail }
if ($AdminPassword) { $env:ODYSSEY_ADMIN_PASSWORD = $AdminPassword }
if ($ApiBase)       { $env:ODYSSEY_API_BASE = $ApiBase }

function Invoke-Step([string]$name) {
    Write-Host "`n=== $name ===" -ForegroundColor Cyan
    Push-Location $scriptDir
    try {
        python "mundo2_pronombres_$name.py"
        if ($LASTEXITCODE -ne 0) { throw "$name termino con codigo $LASTEXITCODE" }
    } finally {
        Pop-Location
    }
}

switch ($Step) {
    "build"    { Invoke-Step "build" }
    "validate" { Invoke-Step "validate" }
    "publish"  {
        Write-Host "Este paso hace visible Mundo 2 a jugadores reales." -ForegroundColor Yellow
        Invoke-Step "publish"
    }
    "adjust"   { Invoke-Step "adjust" }
    "adjust2"  { Invoke-Step "adjust2" }
    "all"      { Invoke-Step "build"; Invoke-Step "validate" }
}
