import { describe, it, expect, vi } from 'vitest';
import { ensureItemSprite, itemSpriteKey, itemSpriteUrl } from '../game/systems/itemSprites';

/** Escena de Phaser mínima: solo el registro de texturas y el loader. */
function fakeScene({ existing = [] } = {}) {
    const textures = new Set(existing);
    const handlers = {};
    const queued = [];

    return {
        textures: { exists: (k) => textures.has(k) },
        load: {
            isLoading: () => false,
            image: (key, url) => queued.push({ key, url }),
            start: vi.fn(),
            once: (evt, cb) => { handlers[evt] = cb; },
            on: (evt, cb) => { handlers[evt] = cb; },
            off: (evt) => { delete handlers[evt]; },
        },
        // helpers del test
        _queued: queued,
        _finish(key) { textures.add(key); handlers[`filecomplete-image-${key}`]?.(); },
        _fail(key) { handlers['loaderror']?.({ key }); },
    };
}

describe('itemSprites', () => {
    it('deriva clave y URL del icon_key', () => {
        expect(itemSpriteKey('Item-11.png')).toBe('item-sprite-Item-11.png');
        expect(itemSpriteUrl('Item-11.png')).toBe('/Items/sprites/Item-11.png');
        // El icon_key puede venir sin extensión
        expect(itemSpriteUrl('Item-11')).toBe('/Items/sprites/Item-11.png');
        expect(itemSpriteKey('')).toBeNull();
    });

    it('si ya está cargada, avisa de inmediato y no encola nada', () => {
        const scene = fakeScene({ existing: ['item-sprite-a.png'] });
        const onReady = vi.fn();

        const ready = ensureItemSprite(scene, 'a.png', onReady);

        expect(ready).toBe(true);
        expect(onReady).toHaveBeenCalledWith('item-sprite-a.png');
        expect(scene._queued).toHaveLength(0);
    });

    it('encola la carga y avisa al completarse', () => {
        const scene = fakeScene();
        const onReady = vi.fn();

        const ready = ensureItemSprite(scene, 'b.png', onReady);

        expect(ready).toBe(false);
        expect(scene._queued).toEqual([{ key: 'item-sprite-b.png', url: '/Items/sprites/b.png' }]);
        expect(onReady).not.toHaveBeenCalled();

        scene._finish('item-sprite-b.png');
        expect(onReady).toHaveBeenCalledWith('item-sprite-b.png');
    });

    /**
     * Dos pickups del mismo item en el mapa pedían la misma textura dos veces;
     * encolar la clave repetida hace que Phaser avise por duplicado.
     */
    it('comparte una sola descarga entre peticiones simultáneas', () => {
        const scene = fakeScene();
        const a = vi.fn();
        const b = vi.fn();

        ensureItemSprite(scene, 'c.png', a);
        ensureItemSprite(scene, 'c.png', b);

        expect(scene._queued).toHaveLength(1);

        scene._finish('item-sprite-c.png');
        expect(a).toHaveBeenCalledWith('item-sprite-c.png');
        expect(b).toHaveBeenCalledWith('item-sprite-c.png');
    });

    it('si la carga falla no avisa: el llamador conserva su alternativa', () => {
        const scene = fakeScene();
        const onReady = vi.fn();

        ensureItemSprite(scene, 'roto.png', onReady);
        scene._fail('item-sprite-roto.png');

        expect(onReady).not.toHaveBeenCalled();
    });
});
