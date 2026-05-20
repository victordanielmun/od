const fs = require('fs');
const file = 'c:/Users/USUARIO/Desktop/mis proyectos/-Odyssey-main/gather-rpg-frontend/src/game/map/MapManager.js';
let content = fs.readFileSync(file, 'utf8');

const oldFinally = `.finally(() => {
        if (this.scene.playerManager) {
            this.scene.playerManager.createMyPlayer();
            this.scene.playerManager.handlePlayersUpdate(useGameStore.getState().players);
        }
      });`;

const newFinally = `.finally(() => {
        this.scene.isMapLoading = false;
        // Sync with store for UI components
        useGameStore.setState({ isMapLoading: false });

        if (this.scene.playerManager) {
            this.scene.playerManager.createMyPlayer();
            this.scene.playerManager.handlePlayersUpdate(useGameStore.getState().players);
        }

        // Notify React that the world is loaded and ready
        console.log('[MapManager] World fully loaded. Dispatching game-ready.');
        window.dispatchEvent(new Event('game-ready'));
      });`;

if (content.includes(oldFinally)) {
    content = content.replace(oldFinally, newFinally);
    fs.writeFileSync(file, content);
    console.log('Fixed MapManager.js: isMapLoading and game-ready event added');
} else {
    console.log('Target finally block not found.');
    // Try a more flexible match
    const regex = /\.finally\(\(\) => \{[\s\S]*?this\.scene\.playerManager\.createMyPlayer\(\);[\s\S]*?\}\);/;
    if (regex.test(content)) {
        content = content.replace(regex, newFinally);
        fs.writeFileSync(file, content);
        console.log('Fixed MapManager.js via regex');
    } else {
        console.log('Failed to find finally block.');
    }
}
