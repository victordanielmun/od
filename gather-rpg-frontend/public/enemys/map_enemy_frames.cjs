const fs = require('fs');
const path = require('path');

const ENEMYS_DIR = __dirname;

const ENEMY_ANIMATIONS = [
    { name: 'idle',    count: 6, frameRate: 8,  repeat: -1 },
    { name: 'walking', count: 6, frameRate: 10, repeat: -1 },
    { name: 'attack',  count: 6, frameRate: 12, repeat: 0  },
    { name: 'hurt',    count: 6, frameRate: 10, repeat: 0  },
    { name: 'knocked', count: 6, frameRate: 10, repeat: 0  },
    { name: 'dying',   count: 6, frameRate: 8,  repeat: 0  }
];

function loadAtlas(filePath) {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
}

function saveAtlas(filePath, atlas) {
    fs.writeFileSync(filePath, JSON.stringify(atlas), 'utf8');
}

function processEnemy(id, filePath) {
    console.log(`  Processing Enemy: ${id}a.json`);
    const atlas = loadAtlas(filePath);
    const animationMap = {};
    
    // 1. Filtrar frames reales (descarta marcadores 1x1 / 2x1 del exportador).
    const realFrames = atlas.frames.filter(f => f.frame.w > 10 && f.frame.h > 10);

    // 2. Ordenar globalmente de arriba a abajo (Y) y, a igual Y, de izq. a der. (X).
    //    Las hojas son una cuadrícula de N animaciones × M frames donde cada fila
    //    ocupa una banda de Y propia (siempre hay un hueco entre filas). NO usamos
    //    agrupamiento por tolerancia de Y: sprites altos como 'knocked'/'dying'
    //    varían >180px dentro de su misma fila y la tolerancia los partía en trozos,
    //    rompiendo el mapeo de los enemigos 2 y 4.
    realFrames.sort((a, b) => (a.frame.y - b.frame.y) || (a.frame.x - b.frame.x));

    const expectedTotal = ENEMY_ANIMATIONS.reduce((sum, a) => sum + a.count, 0);
    console.log(`  ${realFrames.length} real frames (expected ${expectedTotal}).`);
    if (realFrames.length !== expectedTotal) {
        console.warn(`  ⚠️  El nº de frames no coincide con el esperado; el corte por filas puede desalinearse.`);
    }

    // 3. Cortar la lista ordenada por Y en filas contiguas de 'count' frames y
    //    mapear cada fila a su animación.
    let cursor = 0;
    ENEMY_ANIMATIONS.forEach(anim => {
        const limit = Math.min(anim.count, realFrames.length - cursor);
        if (limit <= 0) return;

        const rowFrames = realFrames.slice(cursor, cursor + limit);
        cursor += limit;

        // Orden izquierda → derecha dentro de la fila.
        rowFrames.sort((a, b) => a.frame.x - b.frame.x);

        animationMap[anim.name] = {
            frames: [],
            frameRate: anim.frameRate,
            repeat: anim.repeat
        };
        rowFrames.forEach((f, i) => {
            const newName = `${anim.name}_${i}`;
            f.filename = newName;
            animationMap[anim.name].frames.push(newName);
        });
        console.log(`    Mapped '${anim.name}' with ${limit} frames.`);
    });

    saveAtlas(filePath, atlas);
    return animationMap;
}

function main() {
    const files = fs.readdirSync(ENEMYS_DIR);
    const enemyIds = [...new Set(
        files
            .filter(f => /^\d+a\.json$/.test(f))
            .map(f => f.replace(/a\.json$/, ''))
    )].sort((a, b) => Number(a) - Number(b));

    if (enemyIds.length === 0) {
        console.error('❌ No enemy files found in:', ENEMYS_DIR);
        return;
    }

    console.log(`✅ Enemies detected: ${enemyIds.join(', ')}`);
    const animationsByEnemy = {};

    enemyIds.forEach(id => {
        console.log(`\n── Enemy ${id} ──────────────────────────────`);
        const pathA = path.join(ENEMYS_DIR, `${id}a.json`);

        if (fs.existsSync(pathA)) {
            const anims = processEnemy(id, pathA);
            animationsByEnemy[id] = {};
            Object.entries(anims).forEach(([name, cfg]) => {
                animationsByEnemy[id][name] = { 
                    type: 'body',
                    frames: cfg.frames, 
                    frameRate: cfg.frameRate, 
                    repeat: cfg.repeat 
                };
            });
        }
    });

    const output = [
        '// ⚙️ AUTO-GENERADO por map_enemy_frames.cjs',
        'export const animationsByEnemy = ' + JSON.stringify(animationsByEnemy, null, 2) + ';'
    ].join('\n');

    const outFile = path.join(ENEMYS_DIR, '_animationsByEnemy_generated.js');
    fs.writeFileSync(outFile, output, 'utf8');
    console.log(`\n✅ Mapping generated in ${outFile}`);
}

main();
