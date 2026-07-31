// Versión global del arte estático servido desde /public (sprites, atlas,
// audio). SÚBELA cuando cambies el arte (p. ej. '1' → '2'): todas las URLs de
// assets cambian su query (?v=N) y el navegador re-descarga los archivos en
// lugar de servir la copia antigua de su caché HTTP.
//
// También puede fijarse por entorno con VITE_ASSET_VERSION en el .env del
// frontend (útil para CI: usar el hash del commit como versión).
export const ASSET_VERSION = import.meta.env.VITE_ASSET_VERSION || '2.1';

// Añade el cache-buster a una URL de asset. Debe aplicarse en TODOS los puntos
// que piden el mismo archivo — la precarga del dashboard (assetManifest) y los
// loaders de Phaser (CharacterConfig/EnemyConfig/BossConfig/NPCConfig/
// LobbyAssets) — porque la caché del navegador distingue por query: si una
// parte pide ?v=N y otra la ruta cruda, el archivo se descarga dos veces.
export const versioned = (url) =>
  url ? `${url}${url.includes('?') ? '&' : '?'}v=${ASSET_VERSION}` : url;
