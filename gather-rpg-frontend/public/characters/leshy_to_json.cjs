/**
 * leshy_to_json.cjs
 *
 * Convierte el formato CSV de Leshy SpriteSheet Tool a un Atlas JSON de Phaser.
 *
 * Formato de entrada (una línea por sprite):
 *   spriteName,x,y,w,h
 *
 * Ejemplo:
 *   sprite1,731,42,351,293
 *   sprite2,1472,42,297,300
 *
 * Uso:
 *   node leshy_to_json.cjs <id_personaje> <tipo: a|b|c|d>
 *   ej: node leshy_to_json.cjs 2 b
 *
 * El script busca el archivo:  <id><tipo>.txt  (ej: 2b.txt)
 * y genera el archivo:         <id><tipo>.json (ej: 2b.json)
 *
 * ──────────────────────────────────────────────────────────────────────────
 * FILTROS APLICADOS:
 *   • Se descartan sprites con w < 10 o h < 10 (ruido / marcadores de Leshy)
 *
 * ORDEN DE FRAMES:
 *   • Ordena por fila (Y), luego por columna (X) dentro de la misma fila.
 *   • Tolerancia de agrupación de fila: ROW_TOLERANCE px (default 30).
 *     Si dos sprites difieren en Y menos de ese valor, se consideran
 *     de la misma fila.
 * ──────────────────────────────────────────────────────────────────────────
 */

const fs   = require('fs');
const path = require('path');

const CHARS_DIR      = __dirname;
const MIN_SIZE       = 10;   // Descartar sprites menores a esto en w o h
const ROW_TOLERANCE  = 40;   // px de tolerancia para agrupar en la misma fila

// ─────────────────────────────────────────────────────────────────────────────

function parseTxt(filePath) {
    const raw  = fs.readFileSync(filePath, 'utf8');
    const sprites = [];

    for (const line of raw.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue; // comentarios o vacíos

        const parts = trimmed.split(',');
        if (parts.length < 5) continue;

        const [name, x, y, w, h] = parts.map((p, i) => i === 0 ? p.trim() : parseInt(p.trim(), 10));

        if (isNaN(x) || isNaN(y) || isNaN(w) || isNaN(h)) {
            console.warn(`  ⚠️  Línea ignorada (no es número): ${line}`);
            continue;
        }
        if (w < MIN_SIZE || h < MIN_SIZE) {
            console.log(`  🗑  Descartado (ruido): ${name} → ${w}×${h}`);
            continue;
        }

        sprites.push({ name, x, y, w, h });
    }

    return sprites;
}

/**
 * Agrupa sprites por fila según tolerancia Y, luego ordena dentro de cada
 * fila por X ascendente.
 */
function sortByRowThenX(sprites) {
    const getSpriteNumber = (name) => {
        const match = name.match(/\d+/);
        return match ? parseInt(match[0], 10) : 0;
    };
    const ordered = [...sprites].sort((a, b) => getSpriteNumber(a.name) - getSpriteNumber(b.name));
    console.log(`\n📊 Sprites ordenados por índice original de exportación (nombre).`);
    return ordered;
}

function buildJson(sprites, charId, sheetType, pngWidth, pngHeight) {
    const frames = sprites.map((s, idx) => ({
        filename: `frame_${String(idx).padStart(3, '0')}`,
        frame: { x: s.x, y: s.y, w: s.w, h: s.h },
        rotated: false,
        trimmed: true,
        spriteSourceSize: { x: 0, y: 0, w: s.w, h: s.h },
        sourceSize: { w: s.w, h: s.h }
    }));

    return {
        frames,
        meta: {
            app: 'leshy_to_json.cjs',
            version: '1.0',
            image: `${charId}${sheetType}.png`,
            size: { w: pngWidth, h: pngHeight },
            scale: 1
        }
    };
}

function getPngDimensions(filePath) {
    if (!fs.existsSync(filePath)) return { w: 2048, h: 2048 }; // fallback
    const buf = fs.readFileSync(filePath);
    if (buf[0] !== 0x89 || buf[1] !== 0x50) return { w: 2048, h: 2048 };
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

// ─────────────────────────────────────────────────────────────────────────────

function main() {
    const [,, charId, sheetType] = process.argv;

    if (!charId || !sheetType) {
        console.error('❌ Uso: node leshy_to_json.cjs <id_personaje> <tipo: a|b|c|d>');
        console.error('   ej: node leshy_to_json.cjs 2 b');
        process.exit(1);
    }

    const txtPath  = path.join(CHARS_DIR, `${charId}${sheetType}.txt`);
    const jsonPath = path.join(CHARS_DIR, `${charId}${sheetType}.json`);
    const pngPath  = path.join(CHARS_DIR, `${charId}${sheetType}.png`);

    if (!fs.existsSync(txtPath)) {
        console.error(`❌ No se encontró: ${txtPath}`);
        console.error(`   Crea un archivo de texto con el formato de Leshy y guárdalo como ${charId}${sheetType}.txt`);
        process.exit(1);
    }

    console.log(`\n🔍 Leyendo: ${txtPath}`);
    const sprites = parseTxt(txtPath);
    console.log(`   Sprites válidos tras filtrar ruido: ${sprites.length}`);

    if (sprites.length === 0) {
        console.error('❌ No se encontraron sprites válidos en el archivo.');
        process.exit(1);
    }

    const ordered = sortByRowThenX(sprites);

    const { w: pngW, h: pngH } = getPngDimensions(pngPath);
    console.log(`\n🖼  Dimensiones del PNG: ${pngW} × ${pngH}`);

    const json = buildJson(ordered, charId, sheetType, pngW, pngH);

    // Backup del json anterior
    if (fs.existsSync(jsonPath)) {
        const backupPath = jsonPath.replace('.json', '.backup.json');
        fs.copyFileSync(jsonPath, backupPath);
        console.log(`📦 Backup guardado: ${backupPath}`);
    }

    fs.writeFileSync(jsonPath, JSON.stringify(json, null, 2), 'utf8');

    console.log(`\n✅ JSON generado con ${json.frames.length} frames → ${jsonPath}`);
    console.log('\n▶ Ahora ejecuta: node map_character_frames.cjs  (o el .ps1 de actualizar)\n');
}

main();
