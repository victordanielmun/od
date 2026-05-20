const fs = require('fs');

// 1. Update InteractionSystem.js
const systemFile = 'c:/Users/USUARIO/Desktop/mis proyectos/-Odyssey-main/gather-rpg-frontend/src/game/interactions/InteractionSystem.js';
if (fs.existsSync(systemFile)) {
    let content = fs.readFileSync(systemFile, 'utf8');
    content = content.replace(
        "if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;",
        "if (this.scene.isTyping && this.scene.isTyping()) return;"
    );
    fs.writeFileSync(systemFile, content);
    console.log('Updated InteractionSystem.js listener');
}

// 2. Fix LobbyScene.jsx
const lobbyFile = 'c:/Users/USUARIO/Desktop/mis proyectos/-Odyssey-main/gather-rpg-frontend/src/game/scenes/LobbyScene.jsx';
let lobbyContent = fs.readFileSync(lobbyFile, 'utf8');

// Remove the _onInteractKeyDown block from create()
const createListenerBlock = /this\._interactPressed = false;\s+this\._onInteractKeyDown = \(e\) => \{[\s\S]*?\};\s+window\.addEventListener\('keydown', this\._onInteractKeyDown\);/;
lobbyContent = lobbyContent.replace(createListenerBlock, "");

// Remove the removal from shutdown()
lobbyContent = lobbyContent.replace("window.removeEventListener('keydown', this._onInteractKeyDown);", "");
// Note: there might be multiple occurrences (shutdown and cleanup events), the regex above might only catch one if not global.
// We want to remove all references to this._onInteractKeyDown listener management since InteractionSystem handles its own.

lobbyContent = lobbyContent.split('\n').filter(line => !line.includes('this._onInteractKeyDown')).join('\n');

fs.writeFileSync(lobbyFile, lobbyContent);
console.log('Removed redundant interaction listener from LobbyScene.jsx');
