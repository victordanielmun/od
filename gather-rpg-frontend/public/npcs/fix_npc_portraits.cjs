/**
 * fix_portraits_spatial.cjs
 * 
 * Este script ajusta los JSON de retratos (*a.json) basándose en su posición espacial (X, Y).
 * 1. Filtra frames basura (1x1).
 * 2. Ordena por fila (Y) y luego columna (X).
 * 3. Asigna nombres correlativos por emoción y número de frame.
 */

const fs = require('fs');
const path = require('path');

const NPCS_DIR = __dirname;
const EMOTIONS = [
    'idle', 'talking', 'happy', 
    'angry', 'sad', 'surprised', 
    'thinking', 'grateful', 'waiting'
];

function processPortrait(filePath) {
    console.log(`\nProcessing: ${path.basename(filePath)}`);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    // 1. Filtrar solo frames "reales" (evitar 1x1 o artefactos pequeños)
    const realFrames = data.frames.filter(f => f.frame.w > 50 && f.frame.h > 50);
    
    // 2. Ordenar espacialmente: Primero por Y (fila), luego por X (columna)
    // Usamos una tolerancia de 30px para variaciones en el eje Y
    realFrames.sort((a, b) => {
        const diffY = a.frame.y - b.frame.y;
        if (Math.abs(diffY) > 30) return diffY;
        return a.frame.x - b.frame.x;
    });

    console.log(`  Found ${realFrames.length} valid frames.`);

    // 3. Identificar estructura de filas
    const rows = [];
    let currentRow = [];
    if (realFrames.length > 0) {
        let lastY = realFrames[0].frame.y;
        realFrames.forEach(f => {
            if (Math.abs(f.frame.y - lastY) > 30) {
                rows.push(currentRow);
                currentRow = [];
                lastY = f.frame.y;
            }
            currentRow.push(f);
        });
        rows.push(currentRow);
    }

    console.log(`  Grid detected: ${rows.length} rows.`);

    // 4. Renombrar frames
    // Si hay 3 filas y 9 emociones, cada fila tiene 3 emociones (1 frame cada una)
    // Si hay 9 filas y 9 emociones, cada fila es 1 emoción (N frames cada una)
    
    if (rows.length === 3 && realFrames.length === 9) {
        // Caso 3x3: Cada celda es una emoción diferente
        console.log("  Mode: 3x3 Grid (Each cell is a unique emotion)");
        realFrames.forEach((f, i) => {
            f.filename = `${EMOTIONS[i]}_0`;
        });
    } else {
        // Caso Genérico: Cada fila es una emoción
        console.log("  Mode: Row-based (Each row is one emotion)");
        rows.forEach((row, rowIndex) => {
            const emotion = EMOTIONS[rowIndex] || `emotion${rowIndex}`;
            row.forEach((f, colIndex) => {
                f.filename = `${emotion}_${colIndex}`;
            });
        });
    }

    // 5. Limpiar el JSON de los frames basura y guardar
    data.frames = realFrames; 
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    console.log(`  ✅ Saved and cleaned ${filePath}`);
}

function main() {
    const files = fs.readdirSync(NPCS_DIR).filter(f => f.endsWith('a.json'));
    files.forEach(f => {
        processPortrait(path.join(NPCS_DIR, f));
    });
    
    console.log("\n🚀 All portraits processed. Remember to run 'node map_npc_frames.cjs' to update the game mapping.");
}

main();
