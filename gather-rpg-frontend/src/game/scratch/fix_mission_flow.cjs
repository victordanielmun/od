const fs = require('fs');
const file = 'c:/Users/USUARIO/Desktop/mis proyectos/-Odyssey-main/gather-rpg-frontend/src/components/game/NPCDialogue.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add state
content = content.replace(
    'const [isMissionComplete, setIsMissionComplete] = useState(false);',
    'const [isMissionComplete, setIsMissionComplete] = useState(false);\n    const [hasPendingCompletion, setHasPendingCompletion] = useState(false);'
);

// 2. Update handleSend to set pending completion instead of immediate overlay
const oldMissionLogic = `            if (data.mission_newly_completed) {
                console.log("[NPCDialogue] Mission Completed detected!", data.mission_details);
                setCompletedMissionData(data.mission_details);
                setIsMissionComplete(true);
            }`;

const newMissionLogic = `            if (data.mission_newly_completed) {
                console.log("[NPCDialogue] Mission Completed detected!", data.mission_details);
                setCompletedMissionData(data.mission_details);
                // DELAYED: We don't show the overlay yet so the user can read the NPC's final words
                setHasPendingCompletion(true);
            }`;

content = content.replace(oldMissionLogic, newMissionLogic);

// 3. Add handleClose function and update X button
const handleCloseCode = `    const handleClose = () => {
        if (hasPendingCompletion) {
            setIsMissionComplete(true);
            setHasPendingCompletion(false);
        } else {
            onClose();
        }
    };
`;

// Insert handleClose before the return
content = content.replace('    return (', handleCloseCode + '\n    return (');

// Update X button
content = content.replace('onClick={onClose}', 'onClick={handleClose}');

// 4. (Optional but good) Add a visual indicator in the header
const headerPattern = /Misin: \{selectedMission\.title\}\<\/span\>/;
const badgeHtml = `Misin: {selectedMission.title}</span>
                                    {hasPendingCompletion && (
                                        <span className="ml-2 bg-green-600 text-white px-2 py-0.5 text-[9px] animate-bounce shadow-lg">MISIǏN FINALIZADA!</span>
                                    )}`;

if (headerPattern.test(content)) {
    content = content.replace(headerPattern, badgeHtml);
}

fs.writeFileSync(file, content);
console.log('Fixed mission completion flow in NPCDialogue.jsx');
