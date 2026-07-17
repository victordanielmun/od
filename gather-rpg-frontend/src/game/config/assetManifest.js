// Central asset manifest for warming the browser HTTP cache from the dashboard
// BEFORE the user enters the lobby. The lobby's Phaser scene re-downloads these
// via scene.load (see LobbyAssets.js); if we've already fetched them here, those
// loads become instant cache hits and the map paints without a cold-cache wait.
//
// Single source of truth: this file reuses the very same config objects the
// lobby loaders consume, so the warmed URLs can never drift from what Phaser
// actually requests.
import { CHARACTER_CONFIG } from './CharacterConfig';
import { ENEMY_CONFIG } from './EnemyConfig';
import { BOSS_CONFIG } from './BossConfig';
import { NPC_CONFIG } from './NPCConfig';
import { ATLASES, AUDIO_KEYS } from '../scenes/LobbyAssets';
import { versioned } from './assetVersion';

// Mirrors the "optional combo sheet" guard in loadCharacterSprites(): only warm
// an optional sheet if the character's animations actually reference it, so we
// don't fire requests that 404.
function sheetIsUsed(charId, sheetType) {
  const anims =
    CHARACTER_CONFIG.animationsByCharacter[charId] ||
    CHARACTER_CONFIG.animationsByCharacter['1'] ||
    {};
  return Object.values(anims).some((a) => a.sheetType === sheetType);
}

function sheetUrls(sheets, { charLike = false, charId } = {}) {
  const urls = [];
  sheets.forEach((sheet) => {
    if (charLike && sheet.optional && !sheetIsUsed(charId, sheet.type)) return;
    if (sheet.path) urls.push(sheet.path);
    if (sheet.json) urls.push(sheet.json);
  });
  return urls;
}

// CRITICAL — the set the lobby blocks on in preload(): map atlases plus the
// character / enemy / boss sheets. Warming these makes the first frame appear
// immediately on arrival at the lobby.
function buildCriticalUrls() {
  const urls = [];

  ATLASES.forEach(([, image, json]) => {
    urls.push(image);
    if (json) urls.push(json);
  });

  CHARACTER_CONFIG.characters.forEach((c) => {
    urls.push(...sheetUrls(c.sheets, { charLike: true, charId: c.id }));
  });

  ENEMY_CONFIG.enemies.forEach((e) => urls.push(...sheetUrls(e.sheets)));
  BOSS_CONFIG.bosses.forEach((b) => urls.push(...sheetUrls(b.sheets)));

  // versioned() al final (no en sheetUrls) para aplicarlo exactamente una vez
  // por URL, igual que hacen los loaders de Phaser en el momento de cargar.
  return [...new Set(urls)].map(versioned);
}

// DEFERRED — the heavy, non-blocking set the lobby streams in after the map is
// already visible (loadDeferredLobbyAssets): NPC sheets (~43MB) and music
// (~7MB). Warming these is optional; it removes NPC pop-in and the streaming
// indicator at the cost of more bytes up front.
function buildDeferredUrls() {
  const urls = [];

  NPC_CONFIG.npcs.forEach((n) => urls.push(...sheetUrls(n.sheets)));
  AUDIO_KEYS.forEach(([, path]) => urls.push(path));

  return [...new Set(urls)].map(versioned);
}

export const CRITICAL_ASSETS = buildCriticalUrls();
export const DEFERRED_ASSETS = buildDeferredUrls();
