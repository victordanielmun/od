const fs = require('fs');
const file = 'c:/Users/USUARIO/Desktop/mis proyectos/-Odyssey-main/gather-rpg-frontend/src/game/scenes/LobbyScene.jsx';
let content = fs.readFileSync(file, 'utf8');

const oldCollider = `    if (container.body) {
        container.body.setImmovable(true); // Don't let player push them
        container.body.setCircle(20, -20, -20); // Collision circle
    }`;

const newCollider = `    if (container.body) {
        container.body.setImmovable(true); // Don't let player push them
        // Increase collider size to ~80% of tile size for better presence
        container.body.setCircle(35, -35, -35); 
        // Ensure they don't bounce or move on collision
        container.body.setBounce(0);
        container.body.setFriction(1);
    }`;

if (content.includes(oldCollider)) {
    content = content.replace(oldCollider, newCollider);
    fs.writeFileSync(file, content);
    console.log('Increased NPC colliders and enforced immovability');
} else {
    console.log('Target NPC collider logic not found.');
}
