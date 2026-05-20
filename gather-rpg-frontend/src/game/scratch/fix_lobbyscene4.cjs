const fs = require('fs');
const file = 'c:/Users/USUARIO/Desktop/mis proyectos/-Odyssey-main/gather-rpg-frontend/src/game/scenes/LobbyScene.jsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  'this.updateCameraBounds();',
  'this.mapManager.updateCameraBounds();'
);

fs.writeFileSync(file, content);
console.log('Fixed LobbyScene.jsx: updateCameraBounds call site updated');
