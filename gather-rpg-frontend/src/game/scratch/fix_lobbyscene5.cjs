const fs = require('fs');
const file = 'c:/Users/USUARIO/Desktop/mis proyectos/-Odyssey-main/gather-rpg-frontend/src/game/scenes/LobbyScene.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Fix playBGM logic
const oldPlayBGM = /playBGM\(trackId\) \{[\s\S]*?\n  \}/;
const newPlayBGM = `
  playBGM(trackId) {
    if (this.currentBgmTrackId === trackId) return;

    if (this.currentBgm) {
      this.currentBgm.stop();
      this.currentBgm.destroy();
      this.currentBgm = null;
    }

    this.currentBgmTrackId = trackId;

    if (trackId && trackId !== 'none') {
      if (this.cache.audio.exists(trackId)) {
        const { bgmVolume } = useAudioStore.getState();
        this.currentBgm = this.sound.add(trackId, {
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
      } else {
        console.warn(\`[LobbyScene] Audio track '\${trackId}' not found in cache.\`);
      }
    }
  }
`;
content = content.replace(oldPlayBGM, newPlayBGM);

// 2. Fix updateCameraBounds call site (if not already fixed)
if (content.includes('this.updateCameraBounds();')) {
    content = content.replace(
      'this.updateCameraBounds();',
      'this.mapManager.updateCameraBounds();'
    );
}

fs.writeFileSync(file, content);
console.log('Fixed LobbyScene.jsx: playBGM logic and updateCameraBounds call site updated');
