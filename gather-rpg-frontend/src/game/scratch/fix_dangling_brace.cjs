const fs = require('fs');
const file = 'c:/Users/USUARIO/Desktop/mis proyectos/-Odyssey-main/gather-rpg-frontend/src/game/scenes/LobbyScene.jsx';
let content = fs.readFileSync(file, 'utf8');

// The problematic area looks like:
//    // Clean up window listeners
//    }
//    if (this.onChatMsg) {

content = content.replace(
    /\/\/ Clean up window listeners\s+\}\s+if \(this\.onChatMsg\)/,
    "// Clean up window listeners\n    if (this.onChatMsg)"
);

fs.writeFileSync(file, content);
console.log('Fixed dangling brace in LobbyScene.jsx');
