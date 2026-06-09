/**
 * map_character_frames.cjs
 * 
 * Lee los JSON de atlas de cada personaje, filtra los frames reales (w>1, h>1),
 * los agrupa en bloques de 6 por acción y genera el bloque animationsByCharacter
 * listo para pegar en CharacterConfig.js
 * 
 * Uso:  node map_character_frames.cjs
 */

const fs = require('fs');
const path = require('path');

// ── Configuración ──────────────────────────────────────────────────────────
const CHARACTERS_DIR = __dirname;

// Configuración de Normalización
const GLOBAL_BASELINE = 91; 

/**
 * Normaliza verticalmente los frames de un atlas JSON para evitar jitter
 * y asegurar que todos los personajes tengan el mismo "suelo".
 */
function normalizeAtlas(filePath) {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    let modified = false;

    data.frames.forEach(f => {
        if (f.frame.w > 1 && f.frame.h > 1) {
            const rowNumber = Math.round(f.frame.y / 82);
            const rowStart = rowNumber * 82;
            const currentBottomInRow = (f.frame.y + f.frame.h) - rowStart;
            
            const targetBottomInRow = 81; 
            const diff = targetBottomInRow - currentBottomInRow;

            if (diff !== 0) {
                f.spriteSourceSize.y = (f.spriteSourceSize.y || 0) + diff;
                f.sourceSize.h = Math.max(f.sourceSize.h, f.frame.h + f.spriteSourceSize.y);
                modified = true;
            }
        }
    });

    if (modified) {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        return true;
    }
    return false;
}

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
    combo1:           { frameRate: 14, repeat: 0 },  // Jab rápido
    combo2:           { frameRate: 13, repeat: 0 },  // Cross
    combo3_finisher:  { frameRate: 11, repeat: 0 },  // Uppercut/remate (más lento = más peso)
    kick:             { frameRate: 12, repeat: 0 },  // Patada
    strong:           { frameRate: 10, repeat: 0 },  // Golpe cargado
    block_combo:      { frameRate: 10, repeat: 0 },  // Bloqueo
    // Avatars (static frames)
    portrait: { frameRate: 1, repeat: -1 }
};

const FRAMES_PER_ACTION = 6;

// ── Helpers ────────────────────────────────────────────────────────────────
function loadAtlas(filePath) {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
}

/** Filtra frames reales (descarta placeholders y ruido) y devuelve sus nombres en orden */
function realFrames(atlas) {
    return atlas.frames
        .filter(f => f.frame.w > 10 && f.frame.h > 10)
        .map(f => f.filename);
}

/** Divide un array en chunks de tamaño n */
function chunk(arr, n) {
    const result = [];
    for (let i = 0; i < arr.length; i += n) {
        result.push(arr.slice(i, i + n));
    }
    return result;
}

/** Rellena o recorta un array a exactamente n elementos */
function normalizeChunk(frames, n, animName) {
    if (frames.length === n) return frames;

    if (frames.length > n) {
        console.warn(`  ⚠  ${animName}: tiene ${frames.length} frames, usando primeros ${n}`);
        return frames.slice(0, n);
    }

    // Menos frames: repetir el último hasta completar
    const result = [...frames];
    while (result.length < n) result.push(frames[frames.length - 1]);
    console.warn(`  ⚠  ${animName}: tiene ${frames.length} frames, rellenando hasta ${n} repitiendo el último`);
    return result;
}

/** Genera el bloque de animaciones para UN personaje */
function buildAnimBlock(charId, baseAtlas, combatAtlas, avatarAtlas, comboAtlas) {
    const baseFrames = realFrames(baseAtlas);
    const combatFrames = realFrames(combatAtlas);

    console.log(`\n── Personaje ${charId} ────────────────────────────`);
    console.log(`  base   frames reales : ${baseFrames.length}`);
    console.log(`  combat frames reales : ${combatFrames.length}`);
    if (avatarAtlas) {
        console.log(`  avatar frames reales : ${realFrames(avatarAtlas).length}`);
    }
    if (comboAtlas) {
        console.log(`  combo  frames reales : ${realFrames(comboAtlas).length}`);
    }

    const baseChunks = chunk(baseFrames, FRAMES_PER_ACTION);
    const combatChunks = chunk(combatFrames, FRAMES_PER_ACTION);

    const anims = {};

    BASE_ANIM_NAMES.forEach((name, i) => {
        const raw = baseChunks[i] ?? [];
        const frames = normalizeChunk(raw, FRAMES_PER_ACTION, name);
        const { frameRate, repeat } = ANIM_SETTINGS[name];
        anims[name] = { sheetType: 'base', frames, frameRate, repeat };
    });

    COMBAT_ANIM_NAMES.forEach((name, i) => {
        const raw = combatChunks[i] ?? [];
        const frames = normalizeChunk(raw, FRAMES_PER_ACTION, name);
        const { frameRate, repeat } = ANIM_SETTINGS[name];
        anims[name] = { sheetType: 'combat', frames, frameRate, repeat };
    });

    if (avatarAtlas) {
        const avatarFrames = realFrames(avatarAtlas);
        AVATAR_ANIM_NAMES.forEach((name, i) => {
            const frame = avatarFrames[i] ? [avatarFrames[i]] : [avatarFrames[avatarFrames.length - 1]];
            anims[name] = { sheetType: 'avatar', frames: frame, frameRate: 1, repeat: -1 };
        });
    }

    // Combo sheet (Xd.json) — nuevo en esta versión
    if (comboAtlas) {
        const comboFrames = realFrames(comboAtlas);
        const comboChunks = chunk(comboFrames, FRAMES_PER_ACTION);
        COMBO_ANIM_NAMES.forEach((name, i) => {
            const raw = comboChunks[i] ?? [];
            const frames = normalizeChunk(raw, FRAMES_PER_ACTION, name);
            const { frameRate, repeat } = ANIM_SETTINGS[name] ?? { frameRate: 12, repeat: 0 };
            anims[name] = { sheetType: 'combo', frames, frameRate, repeat };
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
            
            lines.push(`${indent}  // --- ${label} ---`);
            lastSheetType = cfg.sheetType;
        }
        const framesStr = cfg.frames.map(f => `'${f}'`).join(', ');
        const pad = ' '.repeat(Math.max(0, 12 - name.length));
        lines.push(`${indent}  '${name}':${pad}{ sheetType: '${cfg.sheetType}', frames: [${framesStr}], frameRate: ${cfg.frameRate}, repeat: ${cfg.repeat} },`);
    }

    lines.push(`${indent}},`);
    return lines.join('\n');
}

// ── Main ───────────────────────────────────────────────────────────────────
function main() {
    console.log('🚀 Iniciando mapeo de personajes...');
    
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

            if (!fs.existsSync(basePath) || !fs.existsSync(combatPath)) {
                console.warn(`  🛑 Personaje ${id}: falta ${basePath} o ${combatPath}, saltando.`);
                continue;
            }

            console.log(`\n📦 Procesando Personaje ${id}...`);
            
            // Paso 1: Normalización de Alineación
            // Omitido para evitar corromper el posicionamiento original en hojas grandes sin trim
            const comboPath = path.join(CHARACTERS_DIR, `${id}d.json`);
            const comboExists = fs.existsSync(comboPath);
            const normBase = false;
            const normCombat = false;
            const normCombo = false;

            // Paso 2: Mapeo de Animaciones
            const baseAtlas = loadAtlas(basePath);
            const combatAtlas = loadAtlas(combatPath);
            const avatarAtlas = fs.existsSync(avatarPath) ? loadAtlas(avatarPath) : null;
            const comboAtlas = comboExists ? loadAtlas(comboPath) : null;
            if (comboAtlas) console.log(`  🗻  Combo sheet (${id}d.json) detectado.`);

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
