const fs = require('fs');
const file = 'c:/Users/USUARIO/Desktop/mis proyectos/-Odyssey-main/gather-rpg-frontend/src/game/scenes/LobbyScene.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Fix the call to loadServerMapConfig
content = content.replace(
  'this.loadServerMapConfig();',
  'this.mapManager.loadServerMapConfig(this.currentMapKey);'
);

// 2. Add playBGM method
const playBGMCode = `
  playBGM(trackId) {
    if (this.currentBgmTrackId === trackId) return;

    if (this.currentBgm) {
      this.currentBgm.stop();
      this.currentBgm = null;
    }

    this.currentBgmTrackId = trackId;

    if (trackId && trackId !== 'none') {
      const { bgmVolume } = useAudioStore.getState();
      this.currentBgm = this.sound.add(\`bgm-\${trackId}\`, {
        loop: true,
        volume: bgmVolume / 100
      });

      if (!this.sound.locked) {
        this.currentBgm.play();
      } else {
        this.sound.once('unlocked', () => {
          if (this.currentBgm) this.currentBgm.play();
        });
      }
    }
  }
`;

// Insert playBGM after handleMissionUpdate
const handleMissionUpdatePattern = /handleMissionUpdate\(mission\) \{[\s\S]*?\n  \}/;
content = content.replace(handleMissionUpdatePattern, (match) => match + playBGMCode);

fs.writeFileSync(file, content);
console.log('Fixed LobbyScene.jsx: loadServerMapConfig call and playBGM added');
