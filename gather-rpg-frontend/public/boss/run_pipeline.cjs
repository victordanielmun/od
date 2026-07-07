/**
 * run_pipeline.cjs
 *
 * Orquestador del pipeline completo de personajes Odyssey.
 *
 * FLUJO:
 *   1) Encuentra todos los .txt en este directorio
 *   2) Convierte cada .txt → .json  (via lógica de leshy_to_json)
 *   3) Lee todos los .json generados → genera _animationsByCharacter_generated.js
 *
 * USO:
 *   node run_pipeline.cjs              → procesa TODOS los .txt
 *   node run_pipeline.cjs 1 a         → procesa SOLO el personaje 1, sheet a (1a.txt)
 *   node run_pipeline.cjs --only-map  → salta el paso 1, solo regenera el .js
 *
 * Equivale a ejecutar en secuencia:
 *   node procesar_todos_txt.cjs
 *   node map_character_frames.cjs
 */

'use strict';
const fs   = require('fs');
const path = require('path');

const DIR           = __dirname;
const MIN_SIZE      = 10;
const ROW_TOLERANCE = 40;
const FRAMES_PER_ACTION = 6;

const BASE_ANIM_NAMES   = ['idle', 'walk', 'hurt', 'die', 'block', 'potion'];
const COMBAT_ANIM_NAMES = ['combo1', 'combo2', 'combo3_finisher', 'special', 'projectile'];
const COMBO_ANIM_NAMES  = ['combo1', 'combo2', 'combo3_finisher', 'kick', 'strong', 'block_combo'];
const AVATAR_ANIM_NAMES = [
    'avatar-idle', 'avatar-hurt', 'avatar-low-health', 'avatar-dead',
    'avatar-special', 'avatar-help', 'avatar-angry', 'avatar-happy',
    'avatar-surprised', 'avatar-thinking', 'avatar-poisoned', 'avatar-stunned'
];
const ANIM_SETTINGS = {
    walk: { frameRate: 10, repeat: -1 }, idle: { frameRate: 8, repeat: -1 },
    hurt: { frameRate: 10, repeat: 0 },  die:  { frameRate: 8, repeat: 0 },
    potion: { frameRate: 10, repeat: 0 }, block: { frameRate: 10, repeat: 0 },
    special: { frameRate: 12, repeat: 0 }, projectile: { frameRate: 12, repeat: 0 },
    combo1: { frameRate: 14, repeat: 0 }, combo2: { frameRate: 13, repeat: 0 },
    combo3_finisher: { frameRate: 11, repeat: 0 }, kick: { frameRate: 12, repeat: 0 },
    strong: { frameRate: 10, repeat: 0 }, block_combo: { frameRate: 10, repeat: 0 },
};

// ─── Colores ANSI ──────────────────────────────────────────────────────────────
const C = {
    reset: '\x1b[0m', bold: '\x1b[1m',
    green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m',
    cyan:  '\x1b[36m', gray:   '\x1b[90m', blue: '\x1b[34m',
};
const ok  = (s) => `${C.green}✅${C.reset} ${s}`;
const err = (s) => `${C.red}❌${C.reset} ${s}`;
const inf = (s) => `${C.cyan}ℹ${C.reset}  ${s}`;
const wrn = (s) => `${C.yellow}⚠️${C.reset}  ${s}`;

// ─── PASO 1: TXT → JSON ────────────────────────────────────────────────────────
function parseTxt(filePath) {
    const raw = fs.readFileSync(filePath, 'utf8');
    const sprites = [];
    for (const line of raw.split(/\r?\n/)) {
        const t = line.trim();
        if (!t || t.startsWith('#')) continue;
        const parts = t.split(',');
        if (parts.length < 5) continue;
        const [name, x, y, w, h] = parts.map((p, i) => i === 0 ? p.trim() : parseInt(p.trim(), 10));
        if (isNaN(x) || isNaN(y) || isNaN(w) || isNaN(h)) continue;
        if (w < MIN_SIZE || h < MIN_SIZE) continue;
        sprites.push({ name, x, y, w, h });
    }
    return sprites;
}

function sortByRowThenX(sprites) {
    const getSpriteNumber = (name) => {
        const match = name.match(/\d+/);
        return match ? parseInt(match[0], 10) : 0;
    };
    return [...sprites].sort((a, b) => getSpriteNumber(a.name) - getSpriteNumber(b.name));
}

function getPngDimensions(p) {
    if (!fs.existsSync(p)) return { w: 2048, h: 2048 };
    const buf = fs.readFileSync(p);
    if (buf[0] !== 0x89 || buf[1] !== 0x50) return { w: 2048, h: 2048 };
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

function buildAtlasJson(sprites, imgName, pngW, pngH) {
    return {
        frames: sprites.map((s, idx) => ({
            filename: `frame_${String(idx).padStart(3, '0')}`,
            frame: { x: s.x, y: s.y, w: s.w, h: s.h },
            rotated: false, trimmed: true,
            spriteSourceSize: { x: 0, y: 0, w: s.w, h: s.h },
            sourceSize: { w: s.w, h: s.h }
        })),
        meta: { app: 'run_pipeline.cjs', version: '1.0', image: imgName, size: { w: pngW, h: pngH }, scale: 1 }
    };
}

function paso1_txtToJson(targetFiles) {
    console.log(`\n${C.bold}━━━ PASO 1: TXT → JSON ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${C.reset}`);
    let ok_count = 0, err_count = 0;

    for (const file of targetFiles) {
        const txtPath  = path.join(DIR, file);
        const jsonPath = path.join(DIR, file.replace('.txt', '.json'));
        const pngPath  = path.join(DIR, file.replace('.txt', '.png'));

        try {
            const sprites = parseTxt(txtPath);
            if (sprites.length === 0) {
                console.log(wrn(`${file}: sin sprites válidos, se omite.`));
                continue;
            }
            const ordered = sortByRowThenX(sprites);
            const { w, h } = getPngDimensions(pngPath);
            const json = buildAtlasJson(ordered, file.replace('.txt', '.png'), w, h);

            // Backup si existe
            if (fs.existsSync(jsonPath)) {
                fs.copyFileSync(jsonPath, jsonPath.replace('.json', '.backup.json'));
            }
            fs.writeFileSync(jsonPath, JSON.stringify(json, null, 2), 'utf8');
            console.log(ok(`${file.padEnd(10)} → ${path.basename(jsonPath).padEnd(12)} (${sprites.length} sprites)`));
            ok_count++;
        } catch (e) {
            console.log(err(`${file}: ${e.message}`));
            err_count++;
        }
    }
    console.log(inf(`Paso 1 completo: ${ok_count} OK, ${err_count} errores.\n`));
    return err_count === 0;
}

// ─── PASO 2: JSON → _animationsByCharacter_generated.js ───────────────────────
function groupFramesByRow(atlas, n, label) {
    if (!atlas) return [];
    const real = atlas.frames.filter(f => f.frame.w > 10 && f.frame.h > 10);
    if (real.length === 0) return [];
    const rows = [];
    for (let i = 0; i < real.length; i += n) {
        rows.push(real.slice(i, i + n).map(f => f.filename));
    }
    const expected = Math.ceil(real.length / n);
    if (rows.length !== expected) console.log(wrn(`[${label}] grupos: ${rows.length}`));
    return rows;
}

function ensureFrames(frames, n) {
    if (!frames || frames.length === 0) return [];
    if (frames.length >= n) return frames.slice(0, n);
    const r = [...frames];
    while (r.length < n) r.push(frames[frames.length - 1]);
    return r;
}

function buildAnimBlock(id, baseAtlas, combatAtlas, avatarAtlas, comboAtlas) {
    const anims = {};

    const baseRows = groupFramesByRow(baseAtlas, FRAMES_PER_ACTION, 'Base');
    BASE_ANIM_NAMES.forEach((name, i) => {
        const frames = ensureFrames(baseRows[i] ?? [], FRAMES_PER_ACTION);
        const { frameRate, repeat } = ANIM_SETTINGS[name] ?? { frameRate: 10, repeat: 0 };
        if (frames.length > 0) anims[name] = { sheetType: 'base', frames, frameRate, repeat };
    });

    const combatRows = groupFramesByRow(combatAtlas, FRAMES_PER_ACTION, 'Combat');
    COMBAT_ANIM_NAMES.forEach((name, i) => {
        const frames = ensureFrames(combatRows[i] ?? [], FRAMES_PER_ACTION);
        const { frameRate, repeat } = ANIM_SETTINGS[name] ?? { frameRate: 10, repeat: 0 };
        if (frames.length > 0) anims[name] = { sheetType: 'combat', frames, frameRate, repeat };
    });

    if (avatarAtlas) {
        const avFrames = avatarAtlas.frames
            .filter(f => f.frame.w > 10 && f.frame.h > 10)
            .map(f => f.filename);
        AVATAR_ANIM_NAMES.forEach((name, i) => {
            const frame = avFrames[i] ? [avFrames[i]] : [avFrames[avFrames.length - 1]];
            if (frame[0]) anims[name] = { sheetType: 'avatar', frames: frame, frameRate: 1, repeat: -1 };
        });
    }

    if (comboAtlas) {
        const comboRows = groupFramesByRow(comboAtlas, FRAMES_PER_ACTION, 'Combo');
        COMBO_ANIM_NAMES.forEach((name, i) => {
            const frames = ensureFrames(comboRows[i] ?? [], FRAMES_PER_ACTION);
            const { frameRate, repeat } = ANIM_SETTINGS[name] ?? { frameRate: 12, repeat: 0 };
            if (frames.length > 0) anims[name] = { sheetType: 'combo', frames, frameRate, repeat };
        });
    }

    return anims;
}

function animsToString(charId, anims, indent = '    ') {
    const lines = [`${indent}'${charId}': {`];
    let lastSheet = null;
    for (const [name, cfg] of Object.entries(anims)) {
        if (cfg.sheetType !== lastSheet) {
            const labels = { base: 'Base Sheet', combat: 'Combat Sheet', avatar: 'Avatar Sheet', combo: 'Combo Sheet' };
            lines.push(`${indent}  // --- ${labels[cfg.sheetType] ?? cfg.sheetType} ---`);
            lastSheet = cfg.sheetType;
        }
        const framesStr = cfg.frames.map(f => `'${f}'`).join(', ');
        const pad = ' '.repeat(Math.max(0, 15 - name.length));
        lines.push(`${indent}  '${name}':${pad}{ sheetType: '${cfg.sheetType}', frames: [${framesStr}], frameRate: ${cfg.frameRate}, repeat: ${cfg.repeat} },`);
    }
    lines.push(`${indent}},`);
    return lines.join('\n');
}

function paso2_jsonToJs() {
    console.log(`${C.bold}━━━ PASO 2: JSON → _animationsByCharacter_generated.js ━━━${C.reset}`);
    const files = fs.readdirSync(DIR);
    const charIds = [...new Set(
        files.filter(f => /^\d+[ab]\.json$/.test(f)).map(f => f.replace(/[ab]\.json$/, ''))
    )].sort((a, b) => Number(a) - Number(b));

    if (charIds.length === 0) {
        console.log(err('No se encontraron archivos Xa.json / Xb.json.'));
        return false;
    }
    console.log(inf(`Personajes detectados: ${charIds.join(', ')}`));

    const blocks = [];
    for (const id of charIds) {
        try {
            const basePath   = path.join(DIR, `${id}b.json`);
            const combatPath = path.join(DIR, `${id}a.json`);
            const avatarPath = path.join(DIR, `${id}c.json`);
            const comboPath  = path.join(DIR, `${id}d.json`);

            if (!fs.existsSync(basePath) || !fs.existsSync(combatPath)) {
                console.log(wrn(`Personaje ${id}: falta ${id}a.json o ${id}b.json, saltando.`));
                continue;
            }

            const baseAtlas   = JSON.parse(fs.readFileSync(basePath, 'utf8'));
            const combatAtlas = JSON.parse(fs.readFileSync(combatPath, 'utf8'));
            const avatarAtlas = fs.existsSync(avatarPath) ? JSON.parse(fs.readFileSync(avatarPath, 'utf8')) : null;
            const comboAtlas  = fs.existsSync(comboPath)  ? JSON.parse(fs.readFileSync(comboPath, 'utf8'))  : null;

            const anims = buildAnimBlock(id, baseAtlas, combatAtlas, avatarAtlas, comboAtlas);
            blocks.push(animsToString(id, anims));
            const animCount = Object.keys(anims).length;
            console.log(ok(`Personaje ${id}: ${animCount} animaciones mapeadas${comboAtlas ? ' + combo' : ''}${avatarAtlas ? ' + avatar' : ''}`));
        } catch (e) {
            console.log(err(`Personaje ${id}: ${e.message}`));
        }
    }

    const output = [
        '// ⚙️  AUTO-GENERADO por run_pipeline.cjs',
        `// Generado: ${new Date().toISOString()}`,
        '// Para regenerar: node run_pipeline.cjs',
        'export const animationsByCharacter = {',
        blocks.join('\n\n'),
        '};'
    ].join('\n');

    const outFile = path.join(DIR, '_animationsByCharacter_generated.js');
    fs.writeFileSync(outFile, output, 'utf8');
    console.log(ok(`Archivo generado: _animationsByCharacter_generated.js`));
    return true;
}

// ─── MAIN ──────────────────────────────────────────────────────────────────────
function main() {
    const args = process.argv.slice(2);
    const onlyMap = args.includes('--only-map');

    console.log(`\n${C.bold}${C.blue}🎮 ODYSSEY — Pipeline de Personajes${C.reset}`);
    console.log(`${C.gray}   Directorio: ${DIR}${C.reset}\n`);

    // Modo: procesar un solo personaje
    // node run_pipeline.cjs 1 a   →  solo 1a.txt
    if (!onlyMap && args.length >= 2 && !args[0].startsWith('--')) {
        const [charId, sheetType] = args;
        const file = `${charId}${sheetType}.txt`;
        const txtPath = path.join(DIR, file);
        if (!fs.existsSync(txtPath)) {
            console.log(err(`No se encontró: ${txtPath}`));
            process.exit(1);
        }
        paso1_txtToJson([file]);
        paso2_jsonToJs();
        console.log(`\n${C.bold}${C.green}🎉 Pipeline completado (personaje ${charId} sheet ${sheetType})${C.reset}\n`);
        return;
    }

    // Modo: procesar todos
    if (!onlyMap) {
        const txtFiles = fs.readdirSync(DIR).filter(f => f.endsWith('.txt'));
        if (txtFiles.length === 0) {
            console.log(err('No se encontraron archivos .txt en el directorio.'));
            process.exit(1);
        }
        paso1_txtToJson(txtFiles);
    } else {
        console.log(inf('Modo --only-map: saltando Paso 1, leyendo JSON existentes.\n'));
    }

    paso2_jsonToJs();
    console.log(`\n${C.bold}${C.green}🎉 Pipeline completado correctamente${C.reset}\n`);
}

main();
