$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$charactersDir = Join-Path $scriptDir "public\characters"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  Generador inteligente de JSON por contenido de sprites  " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

# Pedir el ID del personaje
$charId = Read-Host "Introduce el ID del personaje a procesar (ej: 2)"
if (-not $charId -or $charId.Trim() -eq "") {
    Write-Host "❌ ID no válido." -ForegroundColor Red
    exit 1
}
$charId = $charId.Trim()

$pngPath = Join-Path $charactersDir "${charId}b.png"
if (-not (Test-Path $pngPath)) {
    Write-Host "❌ No existe el archivo: $pngPath" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🔍 Procesando personaje $charId..." -ForegroundColor Yellow
Set-Location $charactersDir
node generar_json_b.cjs $charId

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "Regenerando índice de animaciones..." -ForegroundColor Yellow
    Set-Location $scriptDir
    node public/characters/map_character_frames.cjs

    Write-Host ""
    Write-Host "✅ ¡Todo listo! El personaje $charId ha sido actualizado." -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "❌ Ocurrió un error al generar el JSON." -ForegroundColor Red
}

Set-Location $scriptDir
