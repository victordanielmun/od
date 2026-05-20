const fs = require('fs');
const file = 'c:/Users/USUARIO/Desktop/mis proyectos/-Odyssey-main/gather-rpg-frontend/src/components/game/NPCDialogue.jsx';
let content = fs.readFileSync(file, 'utf8');

const oldDetail = `                    detail: { 
                        targetMap: mission.scene_key,
                        targetX: 0,
                        targetY: 0
                    }`;

const newDetail = `                    detail: { 
                        targetMap: mission.scene_key,
                        targetX: null,
                        targetY: null
                    }`;

if (content.includes(oldDetail)) {
    content = content.replace(oldDetail, newDetail);
    fs.writeFileSync(file, content);
    console.log('Fixed NPCDialogue.jsx: (0, 0) teleport removed');
} else {
    console.log('Target detail block not found.');
}
