const fs = require('fs');
const file = 'c:/Users/USUARIO/Desktop/mis proyectos/-Odyssey-main/gather-rpg-frontend/src/game/scenes/LobbyScene.jsx';
let content = fs.readFileSync(file, 'utf8');

const oldVolLogic = `        const { bgmVolume } = useAudioStore.getState();
        this.currentBgm = this.sound.add(trackId, {
          loop: true,
          volume: bgmVolume / 100
        });`;

const newVolLogic = `        const { bgmVolume } = useAudioStore.getState();
        const volume = (typeof bgmVolume === 'number' && isFinite(bgmVolume)) ? bgmVolume / 100 : 0.5;
        this.currentBgm = this.sound.add(trackId, {
          loop: true,
          volume: volume
        });`;

if (content.includes(oldVolLogic)) {
    content = content.replace(oldVolLogic, newVolLogic);
    fs.writeFileSync(file, content);
    console.log('Fixed playBGM volume logic');
} else {
    console.log('Target volume logic not found. Trying alternative match...');
    // Fallback regex match if formatting slightly different
    const regex = /const \{ bgmVolume \} = useAudioStore\.getState\(\);\s+this\.currentBgm = this\.sound\.add\(trackId, \{\s+loop: true,\s+volume: bgmVolume \/ 100\s+\}\);/;
    if (regex.test(content)) {
        content = content.replace(regex, newVolLogic);
        fs.writeFileSync(file, content);
        console.log('Fixed playBGM volume logic via regex');
    } else {
        console.log('Failed to find volume logic target.');
    }
}
