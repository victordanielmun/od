<#
.SYNOPSIS
Script para automatizar la extrusión de Texture Atlases de Phaser.
Añade un margen de 1px duplicando los bordes de cada sprite en un spritesheet,
y actualiza automáticamente el JSON de coordenadas.

.DESCRIPTION
Este script instala las dependencias de Node (Jimp) si faltan, y luego ejecuta
el script de extrusión "extrude_atlas.js" sobre todos los JSON de la lista.
Puedes añadir más elementos a la matriz $atlases a medida que tu proyecto crezca.
#>

$ErrorActionPreference = "Stop"

# Verifica e instala Jimp si no existe
$npmList = npm list jimp --depth=0 2>$null
if ($npmList -match "empty" -or $LASTEXITCODE -ne 0) {
    Write-Host "Instalando dependencia 'jimp'..." -ForegroundColor Cyan
    npm install jimp@0.22.10
}

# --- LISTA DE ATLASES A EXTRUIR ---
# Añade más rutas relativas aquí según vayas añadiendo elementos al juego.
$atlases = @(
    "public\terrain\terrain-sprites.json"
    #"public\wall\wall-sprites.json"
    #"public\forest\forest-sprites.json"
    #"public\store\tiles.json"
)

Write-Host "`nIniciando proceso de extrusión de Atlases...`n" -ForegroundColor Green

foreach ($atlasJson in $atlases) {
    if (Test-Path $atlasJson) {
        Write-Host "Procesando: $atlasJson" -ForegroundColor Yellow
        node extrude_atlas.cjs $atlasJson
    } else {
        Write-Host "Advertencia: Archivo no encontrado - $atlasJson" -ForegroundColor Red
    }
}

Write-Host "`n=== PROCESO COMPLETADO ===" -ForegroundColor Green
Write-Host "Revisa los archivos generados con el sufijo '_extruido' y actualiza Phaser."
