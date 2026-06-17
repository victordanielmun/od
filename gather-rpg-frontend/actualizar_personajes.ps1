$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$charactersDir = Join-Path $scriptDir "public\characters"

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host " Generando animaciones de personajes... " -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

Set-Location $charactersDir
node map_character_frames.cjs

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "¡Proceso completado exitosamente!" -ForegroundColor Green
    Write-Host "Los personajes se han actualizado automáticamente en el juego." -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "Ocurrió un error al generar las animaciones." -ForegroundColor Red
}

Set-Location $scriptDir
