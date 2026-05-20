const fs = require('fs');
const file = 'c:/Users/USUARIO/Desktop/mis proyectos/-Odyssey-main/gather-rpg-frontend/src/game/scenes/LobbyScene.jsx';
let content = fs.readFileSync(file, 'utf8');

const regex = /if\s*\(container\.body\)\s*\{\s*container\.body\.setImmovable\(true\);\s*\/\/.*?\s*container\.body\.setCircle\(20,\s*-20,\s*-20\);\s*\/\/.*?\s*\}/;

const newBlock = `if (container.body) {
        container.body.setImmovable(true); // Don't let player push them
        // Increase collider size to ~70% of tile size for better presence
        container.body.setCircle(35, -35, -35); 
        // Ensure they don't move on collision
        container.body.setBounce(0);
        container.body.setFriction(1);
    }`;

if (regex.test(content)) {
    content = content.replace(regex, newBlock);
    fs.writeFileSync(file, content);
    console.log('Increased NPC colliders and enforced immovability via regex');
} else {
    console.log('Target NPC collider logic not found via regex.');
}
