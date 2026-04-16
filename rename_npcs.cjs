const fs = require('fs');
const path = require('path');

const NPCS_DIR = path.join(__dirname, 'gather-rpg-frontend', 'public', 'npcs');

const mappings = [
    { old: 'npc1-a.png', new: '2a.png' },
    { old: 'npc1-a.json', new: '2a.json' },
    { old: 'npc1-b.png', new: '2b.png' },
    { old: 'npc1-b.json', new: '2b.json' }
];

mappings.forEach(m => {
    const oldPath = path.join(NPCS_DIR, m.old);
    const newPath = path.join(NPCS_DIR, m.new);
    if (fs.existsSync(oldPath)) {
        fs.renameSync(oldPath, newPath);
        console.log(`✅ Renamed: ${m.old} -> ${m.new}`);
    } else {
        console.warn(`⚠ Not found: ${m.old}`);
    }
});
