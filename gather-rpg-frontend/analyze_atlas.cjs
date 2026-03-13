const fs = require('fs');

function analyze(path) {
    try {
        const content = fs.readFileSync(path, 'utf8');
        const data = JSON.parse(content);
        const validFrames = data.frames.filter(f => f.frame.w > 20 && f.frame.h > 20).map(f => f.filename);
        console.log(`\nAnalysis for ${path}:`);
        console.log(`Total Frames found (w>20, h>20): ${validFrames.length}`);
        console.log(JSON.stringify(validFrames));
    } catch (e) {
        console.error(`Error reading ${path}:`, e.message);
    }
}

analyze('public/characters/1a-sprites.json');
analyze('public/characters/1b-sprites.json');
