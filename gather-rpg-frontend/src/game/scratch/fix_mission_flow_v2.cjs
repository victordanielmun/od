const fs = require('fs');
const file = 'c:/Users/USUARIO/Desktop/mis proyectos/-Odyssey-main/gather-rpg-frontend/src/components/game/NPCDialogue.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Remove the wrong handleClose
const wrongHandleClose = `    const handleClose = () => {
        if (hasPendingCompletion) {
            setIsMissionComplete(true);
            setHasPendingCompletion(false);
        } else {
            onClose();
        }
    };
`;

content = content.replace(wrongHandleClose, '');

// 2. Insert handleClose in the correct place (before the main return of NPCDialogue)
// We look for handleAcceptMissionComplete to find the right scope
const targetMarker = '    const handleAcceptMissionComplete = () => {';
if (content.includes(targetMarker)) {
    content = content.replace(targetMarker, wrongHandleClose + '\n' + targetMarker);
    console.log('Moved handleClose to correct scope');
} else {
    console.log('Could not find target scope marker');
}

fs.writeFileSync(file, content);
console.log('Cleanup finished');
