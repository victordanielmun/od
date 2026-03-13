import fs from 'fs';
import path from 'path';

const filePath = path.resolve('src/game/scenes/LobbyScene.js');

try {
    let content = fs.readFileSync(filePath, 'utf8');
    if (content.charCodeAt(0) === 0xFEFF) {
        console.log('BOM detected. Removing...');
        content = content.slice(1);
        fs.writeFileSync(filePath, content, 'utf8');
        console.log('BOM removed successfully.');
    } else {
        console.log('No BOM found at start of file.');
        // Check for other hidden characters
        console.log('First char code:', content.charCodeAt(0));
        if (content.charCodeAt(0) !== 105) { // 'i' is 105
            console.log('First char is not "i". stripping until "i"...');
            const iIndex = content.indexOf('import');
            if (iIndex !== -1) {
                content = content.slice(iIndex);
                fs.writeFileSync(filePath, content, 'utf8');
                console.log('Stripped leading garbage.');
            }
        }
    }
} catch (err) {
    console.error('Error:', err);
}
