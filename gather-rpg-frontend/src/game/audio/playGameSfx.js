import { useAudioStore } from '../../store/audioStore';

// Reproduce un efecto de sonido de mundo (combate/pickups) precargado en
// SFX_KEYS (ver LobbyAssets.js). El volumen maestro ya se aplica globalmente
// vía scene.sound.volume (LobbyScene.jsx), así que aquí solo hace falta el
// canal de sfxVolume.
export function playGameSfx(scene, key) {
  const { sfxVolume } = useAudioStore.getState();
  if (sfxVolume <= 0 || !scene?.sound) return;
  if (!scene.cache.audio.exists(key)) return;
  scene.sound.play(key, { volume: sfxVolume });
}
