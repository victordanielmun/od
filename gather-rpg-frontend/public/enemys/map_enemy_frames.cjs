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
    
    // 1. Filtrar frames reales
    const realFrames = atlas.frames.filter(f => f.frame.w > 10 && f.frame.h > 10);
    
    // 2. Agrupar por filas (eje Y) con tolerancia
    const rows = [];
    const TOLERANCE = 30;

    realFrames.forEach(f => {
        let added = false;
        for (const row of rows) {
            const avgY = row.reduce((sum, rf) => sum + rf.frame.y, 0) / row.length;
            if (Math.abs(f.frame.y - avgY) < TOLERANCE) {
                row.push(f);
                added = true;
                break;
            }
        }
        if (!added) {
            rows.push([f]);
        }
    });

    // 3. Ordenar las filas por Y
    rows.sort((a, b) => {
        const avgYA = a.reduce((sum, f) => sum + f.frame.y, 0) / a.length;
        const avgYB = b.reduce((sum, f) => sum + f.frame.y, 0) / b.length;
        return avgYA - avgYB;
    });

    // 4. Ordenar frames dentro de cada fila por X (izquierda a derecha)
    rows.forEach(row => row.sort((a, b) => a.frame.x - b.frame.x));

    console.log(`  Found ${rows.length} rows of sprites.`);

    // 5. Mapear cada fila a una animación
    ENEMY_ANIMATIONS.forEach((anim, idx) => {
        if (idx < rows.length) {
            const rowFrames = rows[idx];
            animationMap[anim.name] = {
                frames: [],
                frameRate: anim.frameRate,
                repeat: anim.repeat
            };
            
            // Usamos hasta 'count' frames de la fila, o todos si hay menos
            const limit = Math.min(anim.count, rowFrames.length);
            for (let i = 0; i < limit; i++) {
                const newName = `${anim.name}_${i}`;
                rowFrames[i].filename = newName;
                animationMap[anim.name].frames.push(newName);
            }
            console.log(`    Mapped row ${idx} to '${anim.name}' with ${limit} frames.`);
        }
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
