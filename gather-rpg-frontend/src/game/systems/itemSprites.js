// Carga diferida de los iconos de item (los PNG de /Items/sprites) como texturas
// de Phaser.
//
// El arte de items no se precarga con el mapa: son decenas de archivos y solo
// hacen falta los pocos que aparezcan en la partida. Por eso cada consumidor los
// pedía a mano, y el que se olvidó de hacerlo —los pickups del mapa— dibujaba su
// fallback (un cuadrado amarillo) para siempre. Este módulo centraliza la carga
// para que eso no dependa de recordarlo en cada sitio.

/** Clave de textura para un icon_key. Null si no hay icono. */
export const itemSpriteKey = (iconKey) => (iconKey ? `item-sprite-${iconKey}` : null);

/** URL del PNG. El icon_key de la BD ya suele traer la extensión. */
export const itemSpriteUrl = (iconKey) =>
    (iconKey.endsWith('.png') ? `/Items/sprites/${iconKey}` : `/Items/sprites/${iconKey}.png`);

/**
 * Garantiza que la textura del icono esté disponible y ejecuta onReady(key).
 *
 * - Si ya está cargada, llama a onReady de inmediato (síncrono) y devuelve true.
 * - Si no, la encola, devuelve false y llama a onReady cuando llegue.
 * - Si la carga falla, onReady no se llama nunca: el llamador se queda con lo
 *   que hubiera pintado como alternativa.
 *
 * Varias llamadas para el mismo icono mientras está en vuelo comparten la misma
 * descarga: encolar dos veces la misma clave hace que Phaser avise por duplicado.
 *
 * @returns {boolean} true si la textura ya estaba lista.
 */
export function ensureItemSprite(scene, iconKey, onReady) {
    const key = itemSpriteKey(iconKey);
    if (!key || !scene?.textures) return false;

    if (scene.textures.exists(key)) {
        onReady?.(key);
        return true;
    }

    // Registro de cargas en vuelo, por escena: al reiniciarla se va con ella.
    if (!scene._itemSpriteWaiters) scene._itemSpriteWaiters = new Map();
    const waiters = scene._itemSpriteWaiters;

    if (waiters.has(key)) {
        if (onReady) waiters.get(key).push(onReady);
        return false;
    }
    waiters.set(key, onReady ? [onReady] : []);

    const finish = () => {
        const callbacks = waiters.get(key) || [];
        waiters.delete(key);
        if (!scene.textures.exists(key)) return;   // cargó mal: sin sustitución
        callbacks.forEach(cb => {
            try { cb(key); } catch (e) { console.warn('[itemSprites] callback falló:', e); }
        });
    };

    const onError = (file) => {
        if (file?.key !== key) return;
        console.warn(`[itemSprites] no se pudo cargar ${itemSpriteUrl(iconKey)}`);
        scene.load.off('loaderror', onError);
        waiters.delete(key);
    };

    scene.load.once(`filecomplete-image-${key}`, () => {
        scene.load.off('loaderror', onError);
        finish();
    });
    scene.load.on('loaderror', onError);

    scene.load.image(key, itemSpriteUrl(iconKey));
    // El loader ya en marcha recoge lo añadido; si estaba parado hay que arrancarlo.
    if (!scene.load.isLoading()) scene.load.start();

    return false;
}
