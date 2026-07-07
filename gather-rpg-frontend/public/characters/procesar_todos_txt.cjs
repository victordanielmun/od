const fs = require('fs');
const path = require('path');

const CHARS_DIR = __dirname;
const MIN_SIZE = 10;
const ROW_TOLERANCE = 40;

function parseTxt(filePath) {
    const raw = fs.readFileSync(filePath, 'utf8');
    const sprites = [];

    for (const line of raw.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;

        const parts = trimmed.split(',');
        if (parts.length < 5) continue;

        const [name, x, y, w, h] = parts.map((p, i) => i === 0 ? p.trim() : parseInt(p.trim(), 10));

        if (isNaN(x) || isNaN(y) || isNaN(w) || isNaN(h)) {
            continue;
        }
        if (w < MIN_SIZE || h < MIN_SIZE) {
            continue;
        }

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

function buildJson(sprites, filename, pngWidth, pngHeight) {
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
            app: 'procesar_todos_txt.cjs',
            version: '1.0',
            image: filename.replace('.txt', '.png'),
            size: { w: pngWidth, h: pngHeight },
            scale: 1
        }
    };
}

function getPngDimensions(filePath) {
    if (!fs.existsSync(filePath)) return { w: 2048, h: 2048 };
    const buf = fs.readFileSync(filePath);
    if (buf[0] !== 0x89 || buf[1] !== 0x50) return { w: 2048, h: 2048 };
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

function main() {
    console.log(`\n📂 Buscando archivos .txt en: ${CHARS_DIR}\n`);
    const files = fs.readdirSync(CHARS_DIR).filter(f => f.endsWith('.txt'));

    if (files.length === 0) {
        console.log('❌ No se encontraron archivos .txt');
        return;
    }

    for (const file of files) {
        console.log(`──────────────────────────────────────────────────`);
        console.log(`📄 Procesando: ${file}`);
        
        const txtPath = path.join(CHARS_DIR, file);
        const jsonPath = path.join(CHARS_DIR, file.replace('.txt', '.json'));
        const pngPath = path.join(CHARS_DIR, file.replace('.txt', '.png'));

        const sprites = parseTxt(txtPath);
        console.log(`   Sprites válidos tras filtrar ruido: ${sprites.length}`);

        if (sprites.length === 0) {
            console.log(`   ⚠️ No se encontraron sprites válidos en ${file}. Se omitirá.`);
            continue;
        }

        const ordered = sortByRowThenX(sprites);
        const { w: pngW, h: pngH } = getPngDimensions(pngPath);
        
        const json = buildJson(ordered, file, pngW, pngH);

        if (fs.existsSync(jsonPath)) {
            const backupPath = jsonPath.replace('.json', '.backup.json');
            fs.copyFileSync(jsonPath, backupPath);
            console.log(`   📦 Backup guardado: ${path.basename(backupPath)}`);
        }

        fs.writeFileSync(jsonPath, JSON.stringify(json, null, 2), 'utf8');
        console.log(`   ✅ JSON generado con ${json.frames.length} frames → ${path.basename(jsonPath)}`);
    }

    console.log(`\n🎉 Proceso completado. Se procesaron ${files.length} archivos.\n`);
}

main();
