Write-Host "🚀 Iniciando mapeo de frames de personajes..." -ForegroundColor Cyan

# Ejecutar el mapeador desde su ubicación usando __dirname
node public/characters/map_character_frames.cjs

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Mapeo completado con éxito." -ForegroundColor Green
} else {
    Write-Host "❌ Ocurrió un error al ejecutar el mapeo de frames." -ForegroundColor Red
}
