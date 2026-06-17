/**
 * map_character_frames.cjs
 * 
 * Lee los JSON de atlas de cada personaje, filtra los frames reales (w>10, h>10),
 * los agrupa espacialmente por fila (eje Y) y genera el bloque animationsByCharacter.
 * Notifica si hay más o menos de 6 sprites por fila.
 * 
 * Uso:  node map_character_frames.cjs
 */

const fs = require('fs');
const path = require('path');

// ── Configuración ──────────────────────────────────────────────────────────
const CHARACTERS_DIR = __dirname;

// Animaciones en ORDEN de aparición en cada sheet (de arriba a abajo)
const BASE_ANIM_NAMES = ['idle', 'walk', 'hurt', 'die', 'block', 'potion'];
const COMBAT_ANIM_NAMES = ['combo1', 'combo2', 'combo3_finisher', 'special', 'projectile'];
const COMBO_ANIM_NAMES  = ['combo1', 'combo2', 'combo3_finisher', 'kick', 'strong', 'block_combo'];
const AVATAR_ANIM_NAMES = [
    'avatar-idle', 'avatar-hurt', 'avatar-low-health', 'avatar-dead',
    'avatar-special', 'avatar-help', 'avatar-angry', 'avatar-happy',
    'avatar-surprised', 'avatar-thinking', 'avatar-poisoned', 'avatar-stunned'
];

// frameRate y repeat por animación
const ANIM_SETTINGS = {
    walk: { frameRate: 10, repeat: -1 },
    idle: { frameRate: 8, repeat: -1 },
    hurt: { frameRate: 10, repeat: 0 },
    die: { frameRate: 8, repeat: 0 },
    stun: { frameRate: 10, repeat: -1 },
    poison: { frameRate: 8, repeat: -1 },
    slash: { frameRate: 12, repeat: 0 },
    special: { frameRate: 12, repeat: 0 },
    potion: { frameRate: 10, repeat: 0 },
    projectile: { frameRate: 12, repeat: 0 },
    block: { frameRate: 10, repeat: 0 },
    // Combo Sheet (1d)
    combo1:           { frameRate: 14, repeat: 0 },
    combo2:           { frameRate: 13, repeat: 0 },
    combo3_finisher:  { frameRate: 11, repeat: 0 },
    kick:             { frameRate: 12, repeat: 0 },
    strong:           { frameRate: 10, repeat: 0 },
    block_combo:      { frameRate: 10, repeat: 0 },
    // Avatars
    portrait: { frameRate: 1, repeat: -1 }
};

const FRAMES_PER_ACTION = 6;

// ── Helpers ────────────────────────────────────────────────────────────────
function loadAtlas(filePath) {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
}

/** 
 * Lee los frames del JSON en ORDEN SECUENCIAL (ya ordenados por leshy_to_json.cjs)
 * y los agrupa de FRAMES_PER_ACTION en FRAMES_PER_ACTION.
 * 
 * NOTA: El JSON ya viene ordenado correctamente (fila por fila, izquierda a derecha),
 * por lo que NO necesitamos reagrupar por posición Y — simplemente chunkeamos.
 */
function groupFramesByRow(atlas, expectedCount, sheetLabel) {
    if (!atlas) return [];
    
    // 1. Filtrar ruido manteniendo el orden original del JSON
    const realFrames = atlas.frames.filter(f => f.frame.w > 10 && f.frame.h > 10);
    
    if (realFrames.length === 0) return [];

    // 2. Agrupar secuencialmente de expectedCount en expectedCount
    //    El JSON ya está ordenado por fila Y, luego X — respetamos ese orden.
    const rows = [];
    for (let i = 0; i < realFrames.length; i += expectedCount) {
        const chunk = realFrames.slice(i, i + expectedCount);
        if (chunk.length !== expectedCount) {
            console.warn(`  ⚠️  [${sheetLabel}] Último grupo con ${chunk.length} frames (Esperados: ${expectedCount}). Se completará con el último frame.`);
        }
        rows.push(chunk.map(f => f.filename));
    }

    console.log(`  📋 [${sheetLabel}] ${realFrames.length} frames → ${rows.length} grupos de ${expectedCount}`);

    return rows;
}

/**
 * Para los avatares (c.json), solo necesitamos extraer los frames planos válidos
 */
function getFlatFrames(atlas) {
    if (!atlas) return [];
    return atlas.frames
        .filter(f => f.frame.w > 10 && f.frame.h > 10)
        .map(f => f.filename);
}

/** 
 * Rellena o recorta un array a exactamente n elementos para evitar crashes 
 * en el frontend si un sprite faltó.
 */
function ensureFrames(frames, n, animName) {
    if (!frames || frames.length === 0) return [];
    if (frames.length === n) return frames;

    if (frames.length > n) {
        return frames.slice(0, n);
    }
    const result = [...frames];
    while (result.length < n) result.push(frames[frames.length - 1]);
    return result;
}

/** Genera el bloque de animaciones para UN personaje */
function buildAnimBlock(charId, baseAtlas, combatAtlas, avatarAtlas, comboAtlas) {
    const anims = {};

    // ── Base Sheet (b.json) ──
    const baseRows = groupFramesByRow(baseAtlas, FRAMES_PER_ACTION, 'Base Sheet');
    BASE_ANIM_NAMES.forEach((name, i) => {
        const rawRow = baseRows[i] ?? [];
        if (rawRow.length === 0 && baseRows.length > 0) {
            console.warn(`  ⚠️  [Base] No se encontró la fila ${i} para la animación '${name}'`);
        }
        const frames = ensureFrames(rawRow, FRAMES_PER_ACTION, name);
        const { frameRate, repeat } = ANIM_SETTINGS[name] ?? { frameRate: 10, repeat: 0 };
        if (frames.length > 0) {
            anims[name] = { sheetType: 'base', frames, frameRate, repeat };
        }
    });

    // ── Combat Sheet (a.json) ──
    const combatRows = groupFramesByRow(combatAtlas, FRAMES_PER_ACTION, 'Combat Sheet');
    COMBAT_ANIM_NAMES.forEach((name, i) => {
        const rawRow = combatRows[i] ?? [];
        if (rawRow.length === 0 && combatRows.length > 0) {
            console.warn(`  ⚠️  [Combat] No se encontró la fila ${i} para la animación '${name}'`);
        }
        const frames = ensureFrames(rawRow, FRAMES_PER_ACTION, name);
        const { frameRate, repeat } = ANIM_SETTINGS[name] ?? { frameRate: 10, repeat: 0 };
        if (frames.length > 0) {
            anims[name] = { sheetType: 'combat', frames, frameRate, repeat };
        }
    });

    // ── Avatar Sheet (c.json) ──
    if (avatarAtlas) {
        const avatarFrames = getFlatFrames(avatarAtlas);
        if (avatarFrames.length !== AVATAR_ANIM_NAMES.length) {
            console.warn(`  ⚠️  [Avatar] Se detectaron ${avatarFrames.length} frames (Esperados: ${AVATAR_ANIM_NAMES.length})`);
        }
        AVATAR_ANIM_NAMES.forEach((name, i) => {
            const frame = avatarFrames[i] ? [avatarFrames[i]] : [avatarFrames[avatarFrames.length - 1]];
            if (frame[0]) {
                anims[name] = { sheetType: 'avatar', frames: frame, frameRate: 1, repeat: -1 };
            }
        });
    }

    // ── Combo Sheet (d.json) ──
    if (comboAtlas) {
        const comboRows = groupFramesByRow(comboAtlas, FRAMES_PER_ACTION, 'Combo Sheet');
        COMBO_ANIM_NAMES.forEach((name, i) => {
            const rawRow = comboRows[i] ?? [];
            if (rawRow.length === 0 && comboRows.length > 0) {
                console.warn(`  ⚠️  [Combo] No se encontró la fila ${i} para la animación '${name}'`);
            }
            const frames = ensureFrames(rawRow, FRAMES_PER_ACTION, name);
            const { frameRate, repeat } = ANIM_SETTINGS[name] ?? { frameRate: 12, repeat: 0 };
            if (frames.length > 0) {
                anims[name] = { sheetType: 'combo', frames, frameRate, repeat };
            }
        });
    }

    return anims;
}

/** Convierte un objeto de anims a string JavaScript indentado */
function animsToString(charId, anims, indent = '    ') {
    const lines = [`${indent}'${charId}': {`];

    let lastSheetType = null;
    for (const [name, cfg] of Object.entries(anims)) {
        if (cfg.sheetType !== lastSheetType) {
            let label = '';
            if (cfg.sheetType === 'base') label = 'Base Sheet';
            else if (cfg.sheetType === 'combat') label = 'Combat Sheet';
            else if (cfg.sheetType === 'avatar') label = 'Avatar Sheet';
            else if (cfg.sheetType === 'combo') label = 'Combo Sheet';
            
            lines.push(`${indent}  // --- ${label} ---`);
            lastSheetType = cfg.sheetType;
        }
        const framesStr = cfg.frames.map(f => `'${f}'`).join(', ');
        const pad = ' '.repeat(Math.max(0, 15 - name.length));
        lines.push(`${indent}  '${name}':${pad}{ sheetType: '${cfg.sheetType}', frames: [${framesStr}], frameRate: ${cfg.frameRate}, repeat: ${cfg.repeat} },`);
    }

    lines.push(`${indent}},`);
    return lines.join('\n');
}

// ── Main ───────────────────────────────────────────────────────────────────
function main() {
    console.log('🚀 Iniciando mapeo de personajes con lógica espacial...');
    
    // Detectar automáticamente todos los personajes (archivos Xa.json y Xb.json)
    const files = fs.readdirSync(CHARACTERS_DIR);
    const charIds = [...new Set(
        files
            .filter(f => /^\d+[ab]\.json$/.test(f))
            .map(f => f.replace(/[ab]\.json$/, ''))
    )].sort((a, b) => Number(a) - Number(b));

    if (charIds.length === 0) {
        console.error('❌ No se encontraron archivos de personajes en:', CHARACTERS_DIR);
        process.exit(1);
    }

    console.log(`✅ Personajes detectados: ${charIds.join(', ')}`);

    const blocks = [];

    for (const id of charIds) {
        try {
            const basePath = path.join(CHARACTERS_DIR, `${id}b.json`);
            const combatPath = path.join(CHARACTERS_DIR, `${id}a.json`);
            const avatarPath = path.join(CHARACTERS_DIR, `${id}c.json`);
            const comboPath = path.join(CHARACTERS_DIR, `${id}d.json`);

            if (!fs.existsSync(basePath) || !fs.existsSync(combatPath)) {
                console.warn(`  🛑 Personaje ${id}: falta ${basePath} o ${combatPath}, saltando.`);
                continue;
            }

            console.log(`\n📦 Procesando Personaje ${id}...`);
            
            const baseAtlas = loadAtlas(basePath);
            const combatAtlas = loadAtlas(combatPath);
            const avatarAtlas = fs.existsSync(avatarPath) ? loadAtlas(avatarPath) : null;
            const comboAtlas = fs.existsSync(comboPath) ? loadAtlas(comboPath) : null;
            
            if (comboAtlas) console.log(`  🗻 Combo sheet (${id}d.json) detectado.`);

            const anims = buildAnimBlock(id, baseAtlas, combatAtlas, avatarAtlas, comboAtlas);
            blocks.push(animsToString(id, anims));
            console.log(`  ✨ Mapeo completado.`);

        } catch (error) {
            console.error(`  ❌ Error procesando Personaje ${id}:`, error.message);
        }
    }

    const output = [
        '// ⚙️  AUTO-GENERADO por map_character_frames.cjs',
        '// Para regenerar: node map_character_frames.cjs',
        'export const animationsByCharacter = {',
        blocks.join('\n\n'),
        '};'
    ].join('\n');

    try {
        const outFile = path.join(CHARACTERS_DIR, '_animationsByCharacter_generated.js');
        fs.writeFileSync(outFile, output, 'utf8');
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`✅ ¡Éxito! Archivo generado en: ${outFile}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    } catch (error) {
        console.error('❌ Error al escribir el archivo de salida:', error.message);
    }
}

main();
