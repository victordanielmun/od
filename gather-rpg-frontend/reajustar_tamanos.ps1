$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$charactersDir = Join-Path $scriptDir "public\characters"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " Reajustando escalas de los JSON de personajes... " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

Set-Location $charactersDir
node reajustar_json_escalado.cjs

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "¡Proceso de reescalado completado!" -ForegroundColor Green
    Write-Host "Nota: Puedes ejecutar 'actualizar_personajes.ps1' después si agregaste nuevos frames o quieres reconstruir el índice general." -ForegroundColor Yellow
} else {
    Write-Host ""
    Write-Host "Ocurrió un error." -ForegroundColor Red
}

Set-Location $scriptDir
