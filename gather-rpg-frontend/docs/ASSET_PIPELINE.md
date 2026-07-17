# Pipeline de assets: precarga desde el Dashboard y versionado del arte

Cómo funciona la carga de sprites/atlas/audio del juego, por qué el canvas abre
rápido, y qué tocar cuando cambies el arte.

## El problema que resuelve

El lobby (Phaser) necesita descargar ~150 archivos (atlas de mapas, hojas de
sprites de personajes/enemigos/bosses/NPCs, música) antes de pintar. En una
visita con caché fría eso dejaba el canvas en negro varios segundos.

La solución tiene dos partes:

1. **Precarga (cache warming):** mientras el jugador está en el Dashboard, se
   descargan esos archivos a la caché HTTP del navegador. Cuando Phaser los pide
   después en el lobby, son *cache hits* instantáneos.
2. **Versionado (`?v=N`):** todas las URLs de assets llevan una versión. Al
   cambiar el arte se sube la versión y el navegador re-descarga todo en lugar
   de servir la copia vieja de su caché.

## Flujo completo

```
Dashboard (React)                          Lobby (Phaser)
─────────────────                          ──────────────
useAssetPreloader()
  │
  ├─ CRITICAL_ASSETS  ──────────┐          LobbyScene.preload()
  │  (atlas de mapa, personajes,│            ├─ preloadLobbyAssets()
  │   enemigos, bosses)         │            │    · loadCharacterSprites()
  │                             ▼            │    · loadEnemySprites()
  │                    ┌─────────────┐       │    · loadBossSprites()
  ├─ DEFERRED_ASSETS ─►│  Caché HTTP │◄──────┤    · atlas de LobbyAssets
  │  (NPCs ~43MB,      │  del        │       │
  │   música ~7MB)     │  navegador  │       └─ (tras pintar el mapa)
  │                    └─────────────┘          loadDeferredLobbyAssets()
  │                                               · loadNPCSprites()
  └─ barra de progreso                            · música
     "Caching world assets…"
     luego "✓ World assets cached (N) · art vX"
```

Ambos lados piden **exactamente las mismas URLs** (con el mismo `?v=N`), así
que lo que el Dashboard calentó, Phaser lo encuentra en caché.

## Archivos y responsabilidades

| Archivo | Rol |
|---|---|
| `src/game/config/assetVersion.js` | `ASSET_VERSION` (la versión del arte) y el helper `versioned(url)` que añade `?v=N`. |
| `src/game/config/assetManifest.js` | Construye `CRITICAL_ASSETS` y `DEFERRED_ASSETS` **reutilizando los mismos configs** que consume Phaser, para que las listas nunca se desincronicen. |
| `src/hooks/useAssetPreloader.js` | Hook que descarga el manifiesto con concurrencia limitada (6) y expone `{ loaded, total, criticalDone, done }` para la UI. |
| `src/pages/Dashboard.jsx` | Monta el hook y muestra la barra de progreso bajo el botón "Enter Lobby Realm". |
| `src/game/scenes/LobbyAssets.js` | `preloadLobbyAssets()` (bloqueante, set crítico) y `loadDeferredLobbyAssets()` (en segundo plano, NPCs + música). Exporta `ATLASES` y `AUDIO_KEYS`. |
| `src/game/config/{Character,Enemy,Boss,NPC}Config.js` | Loaders `load*Sprites(scene)` que encolan cada hoja en el loader de Phaser, ya con `versioned()`. |

## Cómo funciona la precarga

- `useAssetPreloader` corre al montar el Dashboard. Primero calienta el set
  **crítico** (lo que bloquea el primer frame del lobby) y luego el **diferido**
  (NPCs y música, que el lobby igualmente streamea después de pintar).
- Los PNG se calientan con `new Image()` (quedan decodificados en la caché de
  imágenes); JSON de atlas y MP3 con `fetch(..., { cache: 'force-cache' })`.
- Errores no bloquean: un archivo opcional que dé 404 cuenta como "resuelto"
  para que la barra nunca se atasque.
- Un `Set` a nivel de módulo evita repetir descargas si el Dashboard se
  monta/desmonta varias veces en la misma sesión de página.
- **La precarga no bloquea el botón de entrar:** el jugador puede ir al lobby en
  cualquier momento; simplemente encontrará menos archivos ya calientes.

> **"La barra no aparece / termina al instante"** → no está rota: con la caché
> HTTP caliente los ~150 archivos se resuelven en milisegundos. La línea
> `✓ World assets cached (N) · art vX` bajo el botón confirma que corrió y con
> qué versión.

## Cómo funciona el versionado

`versioned(url)` convierte `/characters/1.png` en `/characters/1.png?v=1`. Para
la caché del navegador una URL con query distinta es **otro archivo**, así que
subir la versión invalida todas las copias cacheadas de golpe.

La versión sale de `ASSET_VERSION` en `src/game/config/assetVersion.js`:

```js
export const ASSET_VERSION = import.meta.env.VITE_ASSET_VERSION || '1';
```

- Por defecto es la constante `'1'` del archivo.
- Se puede sobreescribir por entorno con `VITE_ASSET_VERSION` en el `.env` del
  frontend (útil en CI: usar el hash del commit como versión).

### Regla de oro

**Toda URL de asset debe pasar por `versioned()` exactamente una vez, en el
punto de carga.** Si un punto la pide con `?v=` y otro con la ruta cruda, el
navegador descarga el archivo dos veces (una por cada URL). Hoy los puntos son:

- los 4 loaders de `*Config.js`
- `ATLASES` y `AUDIO_KEYS` al encolarse en `LobbyAssets.js`
- las listas finales de `assetManifest.js`

## Cambié el arte, ¿qué hago?

1. Reemplaza los archivos en `public/` (sprites, atlas, JSON, música).
2. Sube la versión en `src/game/config/assetVersion.js`:
   ```js
   export const ASSET_VERSION = import.meta.env.VITE_ASSET_VERSION || '2';
   ```
   (o define `VITE_ASSET_VERSION=2` en el `.env` y haz build).
3. Despliega. Cada navegador verá URLs nuevas (`?v=2`) y re-descargará todo;
   en el Dashboard la barra de precarga volverá a correr de verdad y la línea
   de confirmación mostrará `art v2`.

No hace falta que los jugadores borren caché ni hagan hard-refresh.

## ¿Y si agrego un asset nuevo?

- **Personaje / enemigo / boss / NPC / atlas de mapa / pista de música:** basta
  con añadirlo a su config (`CHARACTER_CONFIG`, `ENEMY_CONFIG`, `BOSS_CONFIG`,
  `NPC_CONFIG`, `ATLASES`, `AUDIO_KEYS`). El manifiesto de precarga se genera
  desde esos mismos objetos, así que se calienta solo — no hay lista aparte que
  mantener.
- **Un punto de carga nuevo** (otra escena que haga `scene.load.*`, u otro
  componente que haga fetch de un asset del juego): envuelve la ruta con
  `versioned()` de `assetVersion.js`, o romperás la regla de oro de arriba.
