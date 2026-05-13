/**
 * map_npc_assets.cjs
 * 
 * Script unificado para procesar y mapear assets de NPCs (Portrait y World).
 * Implementa ordenamiento espacial (Y, X) para corregir errores de exportación.
 * 
 * Uso: node map_npc_assets.cjs
 */

const fs = require('fs');
const path = require('path');

const NPCS_DIR = __dirname;

// Definición de emociones para Retratos (a.json) - Grilla 3x3
const PORTRAIT_EMOTIONS = [
    'portrait-idle', 'portrait-talking', 'portrait-happy', 
    'portrait-angry', 'portrait-sad', 'portrait-surprised', 
    'portrait-thinking', 'portrait-grateful', 'portrait-waiting'
];

// Definición de animaciones para Mundo (b.json) - 6 Filas en orden específico
const WORLD_ANIMATIONS_ORDER = [
    { name: 'idle-waiting',   frameRate: 8,  repeat: -1 }, // Row 0: B-Idle
    { name: 'talking',        frameRate: 8,  repeat: -1 }, // Row 1: B-Talk
    { name: 'happy-grateful', frameRate: 8,  repeat: -1 }, // Row 2: B-Happy
    { name: 'sad',            frameRate: 8,  repeat: -1 }, // Row 3: B-Sad
    { name: 'walking',        frameRate: 10, repeat: -1 }, // Row 4: B-Walk
    { name: 'dying',          frameRate: 8,  repeat: 0  }  // Row 5: B-Die
];

function processAtlas(filePath, type) {
    console.log(`\nProcessing ${type.toUpperCase()}: ${path.basename(filePath)}`);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    // 1. Filtrar frames basura (1x1 o muy pequeños)
    // Los retratos suelen ser > 100px, los del mundo > 30px
    const yTolerance = 60;
    
    // 0. Resetear nombres para evitar duplicados de ejecuciones previas
    data.frames.forEach(f => f.filename = `unmapped_${Math.random().toString(36).substr(2, 5)}`);

    const minSize = type === 'a' ? 50 : 20;
    const realFrames = data.frames.filter(f => f.frame.w > minSize && f.frame.h > minSize);
    
    // 2. Ordenar por Y primero (para agrupar por filas)
    realFrames.sort((a, b) => a.frame.y - b.frame.y);

    console.log(`  Found ${realFrames.length} real frames.`);

    // 3. Agrupar por filas usando la tolerancia yTolerance
    const rows = [];
    if (realFrames.length > 0) {
        let currentRow = [realFrames[0]];
        for (let i = 1; i < realFrames.length; i++) {
            const f = realFrames[i];
            const lastY = currentRow[0].frame.y;
            if (Math.abs(f.frame.y - lastY) > yTolerance) {
                rows.push(currentRow);
                currentRow = [f];
            } else {
                currentRow.push(f);
            }
        }
        rows.push(currentRow);
    }

    // 4. Ordenar cada fila individualmente por X
    rows.forEach((row, rowIndex) => {
        const config = type === 'b' ? WORLD_ANIMATIONS_ORDER[rowIndex] : null;
        // El usuario pide que la última fila de mundo (Die) sea de Derecha a Izquierda
        const isDyingRow = config && config.name === 'dying';
        
        if (isDyingRow) {
            // Derecha a Izquierda (X descendente)
            row.sort((a, b) => b.frame.x - a.frame.x);
        } else {
            // Izquierda a Derecha (X ascendente)
            row.sort((a, b) => a.frame.x - b.frame.x);
        }
    });

    const animationMap = {};

    if (type === 'a') {
        // Lógica de Retrato: Mapeo a 9 emociones
        if (rows.length === 3 && realFrames.length === 9) {
            // Caso especial: Grilla 3x3 de emociones individuales
            realFrames.forEach((f, i) => {
                const name = PORTRAIT_EMOTIONS[i];
                f.filename = name;
                animationMap[name] = { type: 'portrait', frames: [name], frameRate: 1, repeat: -1 };
            });
        } else {
            // Caso: Cada fila es una emoción (puede tener múltiples frames de animación)
            rows.forEach((row, rowIndex) => {
                const emotion = PORTRAIT_EMOTIONS[rowIndex] || `emotion_${rowIndex}`;
                const frames = [];
                row.forEach((f, colIndex) => {
                    const frameName = `${emotion}_${colIndex}`;
                    f.filename = frameName;
                    frames.push(frameName);
                });
                animationMap[emotion] = { type: 'portrait', frames, frameRate: 4, repeat: -1 };
            });
        }
    } else {
        // Lógica de Mundo: Mapeo según WORLD_ANIMATIONS_ORDER
        const usedFilenames = new Set();
        rows.forEach((row, rowIndex) => {
            const config = WORLD_ANIMATIONS_ORDER[rowIndex];
            if (!config) return;

            const frames = [];
            row.forEach((f, colIndex) => {
                let frameName = `${config.name}_${colIndex}`;
                // Garantizar unicidad (por si acaso hay solapamiento de filas)
                if (usedFilenames.has(frameName)) {
                    frameName = `${config.name}_v2_${colIndex}`;
                }
                f.filename = frameName;
                usedFilenames.add(frameName);
                frames.push(frameName);
            });
            
            animationMap[config.name] = { 
                type: 'body', 
                frames, 
                frameRate: config.frameRate, 
                repeat: config.repeat 
            };
        });
    }

    // Guardar JSON limpio
    data.frames = realFrames;
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    
    return animationMap;
}

function main() {
    const files = fs.readdirSync(NPCS_DIR);
    const npcIds = [...new Set(
        files
            .filter(f => /^\d+[ab]\.json$/.test(f))
            .map(f => f.replace(/[ab]\.json$/, ''))
    )].sort((a, b) => Number(a) - Number(b));

    if (npcIds.length === 0) {
        console.error('❌ No se encontraron NPCs.');
        return;
    }

    const globalMapping = {};

    npcIds.forEach(id => {
        console.log(`\n── NPC ${id} ──────────────────────────────`);
        const pathA = path.join(NPCS_DIR, `${id}a.json`);
        const pathB = path.join(NPCS_DIR, `${id}b.json`);
        
        globalMapping[id] = {};

        if (fs.existsSync(pathA)) {
            const animsA = processAtlas(pathA, 'a');
            Object.assign(globalMapping[id], animsA);
        }

        if (fs.existsSync(pathB)) {
            const animsB = processAtlas(pathB, 'b');
            Object.assign(globalMapping[id], animsB);
        }
    });

    // Generar archivo JS para el frontend
    const output = [
        '// ⚙️  AUTO-GENERADO por map_npc_assets.cjs',
        '// Para regenerar: node map_npc_assets.cjs',
        'export const animationsByNPC = ' + JSON.stringify(globalMapping, null, 2) + ';'
    ].join('\n');

    fs.writeFileSync(path.join(NPCS_DIR, '_animationsByNPC_generated.js'), output, 'utf8');
    console.log(`\n✅ Mapeo global actualizado en _animationsByNPC_generated.js`);
}

main();
