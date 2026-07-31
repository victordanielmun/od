import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// El manifiesto real arrastra Phaser y todo el arte; aquí solo interesa el
// comportamiento del precargador, así que se sustituye por dos URLs.
vi.mock('../game/config/assetManifest', () => ({
    CRITICAL_ASSETS: ['/fake/critical.json'],
    DEFERRED_ASSETS: ['/fake/deferred.json'],
}));

// El hook cachea en un Set a nivel de MÓDULO (`warmed`) para no recalentar lo
// ya descargado entre montajes. Eso hace que un test contamine al siguiente, así
// que se reimporta el módulo en cada uno.
const freshHook = async () => (await import('../hooks/useAssetPreloader')).useAssetPreloader;

describe('useAssetPreloader', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    /**
     * El caso que dejaba "Preparing Realm…" para siempre: una petición que no
     * responde nunca (un proxy que traga la conexión en vez de rechazarla).
     * onload/onerror no llegan jamás, así que sin timeout la cola se queda
     * parada y el botón nunca cambia de estado.
     */
    it('no se queda bloqueado si una descarga nunca responde', async () => {
        vi.stubGlobal('fetch', vi.fn(() => new Promise(() => { })));
        const useAssetPreloader = await freshHook();

        const { result } = renderHook(() => useAssetPreloader({ includeDeferred: false }));
        expect(result.current.criticalDone).toBe(false);

        await act(async () => { await vi.advanceTimersByTimeAsync(10_500); });

        expect(result.current.criticalDone).toBe(true);
    });

    it('aborta la peticion colgada para no dejar el socket abierto', async () => {
        const signals = [];
        vi.stubGlobal('fetch', vi.fn((_url, opts) => {
            signals.push(opts?.signal);
            return new Promise(() => { });
        }));
        const useAssetPreloader = await freshHook();

        renderHook(() => useAssetPreloader({ includeDeferred: false }));
        await act(async () => { await vi.advanceTimersByTimeAsync(10_500); });

        expect(signals[0]).toBeDefined();
        expect(signals[0].aborted).toBe(true);
    });

    it('una descarga normal no espera al timeout', async () => {
        vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ blob: () => Promise.resolve(new Blob()) })));
        const useAssetPreloader = await freshHook();

        const { result } = renderHook(() => useAssetPreloader({ includeDeferred: false }));

        // Sin avanzar hasta el tope: basta con dejar correr las microtareas.
        await act(async () => { await vi.advanceTimersByTimeAsync(50); });

        expect(result.current.criticalDone).toBe(true);
    });
});
