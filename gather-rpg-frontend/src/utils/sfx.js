import { useAudioStore } from '../store/audioStore';

// SFX de UI y stingers (muerte/misión completada) reproducidos vía HTMLAudioElement:
// no dependen de que la escena Phaser esté montada/activa.
const FILES = {
  menu_selection: 'Menu_selection',
  button_1: 'button_1',
  close: 'close',
  game_over: 'game_over',
  level_win: 'level_win',
};

const cache = {};

export function playSfx(name) {
  const file = FILES[name];
  if (!file) return;

  const { masterVolume, sfxVolume } = useAudioStore.getState();
  const volume = masterVolume * sfxVolume;
  if (volume <= 0) return;

  if (!cache[name]) cache[name] = new Audio(`/effects/${file}.mp3`);
  // clonar permite solapar reproducciones si se dispara rápido (p.ej. toggles)
  const instance = cache[name].cloneNode();
  instance.volume = Math.min(1, volume);
  instance.play().catch(() => {});
}
