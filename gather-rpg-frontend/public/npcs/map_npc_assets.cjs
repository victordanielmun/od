/**
 * map_npc_assets.cjs
 * 
 * Script unificado para procesar y mapear assets de NPCs (Portrait y World).
 * Implementa ordenamiento espacial (Y, X) para corregir errores de exportación,
 * validando que World sea 6x6 y Portrait sea 3x3, con auto-relleno y notificaciones.
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

// Definición de animaciones para Mundo (b.json) - 6 Filas (6x6)
const WORLD_ANIMATIONS_ORDER = [
    { name: 'idle-waiting',   frameRate: 8,  repeat: -1 }, // Row 0
    { name: 'talking',        frameRate: 8,  repeat: -1 }, // Row 1
    { name: 'happy-grateful', frameRate: 8,  repeat: -1 }, // Row 2
    { name: 'sad',            frameRate: 8,  repeat: -1 }, // Row 3
    { name: 'walking',        frameRate: 10, repeat: -1 }, // Row 4
    { name: 'dying',          frameRate: 8,  repeat: 0  }  // Row 5
];

/**
 * Clona el último frame de una fila para rellenar vacíos y evitar crashes
 */
function ensureFrames(rowFrames, expectedCount) {
    if (!rowFrames || rowFrames.length === 0) return [];
    if (rowFrames.length === expectedCount) return rowFrames;
    if (rowFrames.length > expectedCount) return rowFrames.slice(0, expectedCount);
    
    const res = [...rowFrames];
    const lastFrame = rowFrames[rowFrames.length - 1];
    
    while(res.length < expectedCount) {
        // Clon profundo para no sobreescribir referencias en el JSON modificado
        res.push(JSON.parse(JSON.stringify(lastFrame)));
    }
    return res;
}

function processAtlas(filePath, type) {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    // Resetear nombres temporalmente para evitar solapamientos
    data.frames.forEach(f => f.filename = `unmapped_${Math.random().toString(36).substr(2, 5)}`);

    const minSize = type === 'a' ? 50 : 20;
    const realFrames = data.frames.filter(f => f.frame.w > minSize && f.frame.h > minSize);
    
    // Ordenar por Y
    realFrames.sort((a, b) => a.frame.y - b.frame.y);

    // Agrupar filas
    const rows = [];
    const yTolerance = 60;
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

    const expectedRows = type === 'a' ? 3 : 6;
    const expectedCols = type === 'a' ? 3 : 6;
    const label = type === 'a' ? 'Portrait' : 'World';

    if (rows.length !== expectedRows && rows.length > 0) {
        console.warn(`  ⚠️  [${label}] Se detectaron ${rows.length} filas en el eje Y (Esperadas: ${expectedRows}).`);
    }

    const animationMap = {};
    const finalFrames = [];

    // ── Lógica PORTRAIT (3x3) ──
    if (type === 'a') {
        let emotionIndex = 0;
        
        for (let r = 0; r < expectedRows; r++) {
            const row = rows[r] || [];
            
            if (row.length !== expectedCols) {
                 console.warn(`  ⚠️  [${label}] Fila ${r + 1} detectada con ${row.length} sprites (Esperados: ${expectedCols}).`);
            }
            
            row.sort((a, b) => a.frame.x - b.frame.x);
            const paddedRow = ensureFrames(row, expectedCols);
            
            paddedRow.forEach(f => {
                const name = PORTRAIT_EMOTIONS[emotionIndex] || `portrait_unknown_${emotionIndex}`;
                f.filename = name;
                finalFrames.push(f);
                animationMap[name] = { type: 'portrait', frames: [name], frameRate: 1, repeat: -1 };
                emotionIndex++;
            });
        }
    } 
    // ── Lógica WORLD (6x6) ──
    else {
        for (let r = 0; r < expectedRows; r++) {
            const row = rows[r] || [];
            
            if (row.length !== expectedCols) {
                 console.warn(`  ⚠️  [${label}] Fila ${r + 1} detectada con ${row.length} sprites (Esperados: ${expectedCols}).`);
            }
            
            const config = WORLD_ANIMATIONS_ORDER[r];
            if (!config) continue;

            // Dying invertido de derecha a izquierda, el resto normal
            const isDyingRow = config.name === 'dying';
            if (isDyingRow) {
                row.sort((a, b) => b.frame.x - a.frame.x);
            } else {
                row.sort((a, b) => a.frame.x - b.frame.x);
            }

            const paddedRow = ensureFrames(row, expectedCols);
            const framesArr = [];
            
            paddedRow.forEach((f, colIndex) => {
                const frameName = `${config.name}_${colIndex}`;
                f.filename = frameName;
                finalFrames.push(f);
                framesArr.push(frameName);
            });
            
            animationMap[config.name] = { 
                type: 'body', 
                frames: framesArr, 
                frameRate: config.frameRate, 
                repeat: config.repeat 
            };
        }
    }

    // Guardar JSON actualizado con padding
    data.frames = finalFrames;
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    
    return animationMap;
}

function main() {
    console.log('🚀 Iniciando mapeo de NPCs (Validando 6x6 y 3x3)...');
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

    const output = [
        '// ⚙️  AUTO-GENERADO por map_npc_assets.cjs',
        '// Para regenerar: node map_npc_assets.cjs',
        'export const animationsByNPC = ' + JSON.stringify(globalMapping, null, 2) + ';'
    ].join('\n');

    const outPath = path.join(NPCS_DIR, '_animationsByNPC_generated.js');
    fs.writeFileSync(outPath, output, 'utf8');
    console.log(`\n✅ Mapeo global actualizado en _animationsByNPC_generated.js`);
}

main();
