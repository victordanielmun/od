/**
 * map_npc_frames.cjs
 * 
 * Renombra los frames de los atlas JSON de NPCs (a.json y b.json)
 * y genera un archivo de mapeo para las animaciones usando lógica de posición Y.
 * 
 * Uso: node map_npc_frames.cjs
 */

const fs = require('fs');
const path = require('path');

const NPCS_DIR = __dirname;

// Definiciones para a.json (Portrait/Avatar) - 9 estados
const PORTRAIT_STATES = [
    'idle', 'talking', 'happy', 'angry', 'sad', 'surprised', 'thinking', 'grateful', 'waiting'
];

// Definiciones para b.json (World NPC) - 6 animaciones de 6 frames cada una
const WORLD_ANIMATIONS = [
    { name: 'idle-waiting',   count: 6, frameRate: 8,  repeat: -1 },
    { name: 'talking',        count: 6, frameRate: 8,  repeat: -1 },
    { name: 'happy-grateful', count: 6, frameRate: 8,  repeat: -1 },
    { name: 'sad',            count: 6, frameRate: 8,  repeat: -1 },
    { name: 'walking',        count: 6, frameRate: 10, repeat: -1 },
    { name: 'dying',          count: 6, frameRate: 8,  repeat: 0  }
];

function loadAtlas(filePath) {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
}

function saveAtlas(filePath, atlas) {
    fs.writeFileSync(filePath, JSON.stringify(atlas), 'utf8');
}

function processPortrait(id, filePath) {
    console.log(`  Processing Portrait: ${id}a.json`);
    const atlas = loadAtlas(filePath);
    let realIdx = 0;
    const renamedFrames = [];
    
    // Para retratos, simplemente tomamos los frames reales en orden de aparición
    atlas.frames.forEach(f => {
        if (f.frame.w > 20 && f.frame.h > 20) { // Filtro para evitar placeholders
            if (realIdx < PORTRAIT_STATES.length) {
                const newName = PORTRAIT_STATES[realIdx];
                f.filename = newName;
                renamedFrames.push(newName);
                realIdx++;
            }
        }
    });
    
    saveAtlas(filePath, atlas);
    return renamedFrames;
}

function processWorld(id, filePath) {
    console.log(`  Processing World: ${id}b.json`);
    const atlas = loadAtlas(filePath);
    const animationMap = {};
    
    // 1. Filtrar frames "reales" (evitar 1x1 y artefactos como el 3x3)
    // Usamos el tamaño típico de un NPC (aprox 40-80px)
    const realFrames = atlas.frames.filter(f => f.frame.w > 10 && f.frame.h > 10);
    
    // 2. Ordenar frames por Y (fila) y luego por X (columna)
    // NOTA: Algunos atlas están ligeramente desalineados en Y, usamos una tolerancia de 20px
    realFrames.sort((a, b) => {
        const diffY = a.frame.y - b.frame.y;
        if (Math.abs(diffY) > 20) return diffY; // Si la diferencia es grande, prima el eje Y
        return a.frame.x - b.frame.x;           // Si están en la misma "fila", prima el eje X
    });

    console.log(`  Found ${realFrames.length} real frames. Mapping to ${WORLD_ANIMATIONS.length} animations.`);

    let frameCounter = 0;
    WORLD_ANIMATIONS.forEach(anim => {
        animationMap[anim.name] = {
            frames: [],
            frameRate: anim.frameRate,
            repeat: anim.repeat
        };
        
        for (let i = 0; i < anim.count; i++) {
            if (frameCounter < realFrames.length) {
                const newName = `${anim.name}_${i}`;
                realFrames[frameCounter].filename = newName;
                animationMap[anim.name].frames.push(newName);
                frameCounter++;
            }
        }
    });
    
    saveAtlas(filePath, atlas);
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
        console.error('❌ No se encontraron archivos de NPCs en:', NPCS_DIR);
        return;
    }

    console.log(`✅ NPCs detectados: ${npcIds.join(', ')}`);
    const animationsByNPC = {};

    npcIds.forEach(id => {
        console.log(`\n── NPC ${id} ──────────────────────────────`);
        const pathA = path.join(NPCS_DIR, `${id}a.json`);
        const pathB = path.join(NPCS_DIR, `${id}b.json`);

        animationsByNPC[id] = {};

        if (fs.existsSync(pathA)) {
            const portraitFrames = processPortrait(id, pathA);
            portraitFrames.forEach((name) => {
                animationsByNPC[id][`portrait-${name}`] = { type: 'portrait', frames: [name], frameRate: 1, repeat: -1 };
            });
        }

        if (fs.existsSync(pathB)) {
            const worldAnims = processWorld(id, pathB);
            Object.entries(worldAnims).forEach(([name, cfg]) => {
                animationsByNPC[id][name] = { 
                    type: 'body', // Cambiado de 'world' a 'body' para consistencia con NPCSprite
                    frames: cfg.frames, 
                    frameRate: cfg.frameRate, 
                    repeat: cfg.repeat 
                };
            });
        }
    });

    // Formatear la salida para que sea legible
    const output = [
        '// ⚙️  AUTO-GENERADO por map_npc_frames.cjs',
        '// Para regenerar: node map_npc_frames.cjs',
        'export const animationsByNPC = ' + JSON.stringify(animationsByNPC, null, 2) + ';'
    ].join('\n');

    const outFile = path.join(NPCS_DIR, '_animationsByNPC_generated.js');
    fs.writeFileSync(outFile, output, 'utf8');
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`✅ Mapeo generado en ${outFile}`);
}

main();
