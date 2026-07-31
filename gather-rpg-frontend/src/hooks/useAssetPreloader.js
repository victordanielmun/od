import { useEffect, useRef, useState } from 'react';
import { CRITICAL_ASSETS, DEFERRED_ASSETS } from '../game/config/assetManifest';

// Module-level guards so warming runs once per page session even if the
// dashboard mounts/unmounts repeatedly. We only re-warm URLs we haven't
// already settled.
const warmed = new Set();
let criticalEverDone = false;

const PNG_RE = /\.png(\?|$)/i;

// Tope por asset. Esto es solo calentar la caché del navegador, así que ninguna
// descarga tiene derecho a bloquear el botón de entrar: onload/onerror cubren
// el éxito y el 404, pero NO cubren una petición que se queda colgada sin
// responder nunca (un proxy o firewall que traga la conexión en lugar de
// rechazarla hace exactamente eso, y entonces "Preparing Realm…" no cambiaba
// jamás). Pasado este tiempo se abandona y la cola continúa; el asset no se
// pierde, Phaser vuelve a pedirlo al cargar el lobby.
const WARM_TIMEOUT_MS = 10000;

// Settle one URL into the browser cache. Resolves on success, on error AND on
// timeout, para que un solo archivo no pueda detener la precarga. Images go
// through the <img> path (decoded + held in the image cache); everything else
// (atlas JSON, audio) through fetch with force-cache.
function warmOne(url) {
  if (warmed.has(url)) return Promise.resolve();

  return new Promise((resolve) => {
    let settled = false;
    let timer = null;
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;

    const settle = () => {
      if (settled) return;   // onerror tras abortar, o timeout y respuesta a la vez
      settled = true;
      if (timer) clearTimeout(timer);
      warmed.add(url);
      resolve();
    };

    timer = setTimeout(() => {
      // Cortar la petición para no dejar el socket colgando.
      try { controller?.abort(); } catch { /* ya había terminado */ }
      if (import.meta.env.DEV) {
        console.warn(`[AssetPreloader] ${url} no respondió en ${WARM_TIMEOUT_MS}ms; continúo.`);
      }
      settle();
    }, WARM_TIMEOUT_MS);

    if (PNG_RE.test(url)) {
      const img = new Image();
      img.onload = settle;
      img.onerror = settle;
      img.src = url;
      return;
    }

    fetch(url, { cache: 'force-cache', signal: controller?.signal })
      .then((r) => r.blob())
      .catch(() => { /* red, 404 o abort: da igual, es solo caché */ })
      .finally(settle);
  });
}

// Runs `tasks` with bounded concurrency, invoking onTick() after each settle so
// callers can update progress. Keeps the network from being flooded by ~140
// simultaneous requests.
async function runPool(urls, concurrency, onTick) {
  let i = 0;
  const worker = async () => {
    while (i < urls.length) {
      const url = urls[i++];
      await warmOne(url);
      onTick();
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(concurrency, urls.length) }, worker)
  );
}

/**
 * Warms the lobby's assets into the browser HTTP cache.
 *
 * @param {object}  [opts]
 * @param {boolean} [opts.enabled=true]        Set false to skip warming entirely.
 * @param {boolean} [opts.includeDeferred=true] Also warm the heavy NPC/music set
 *                                               in the background once critical is done.
 * @param {number}  [opts.concurrency=6]
 * @returns {{ loaded:number, total:number, criticalDone:boolean, done:boolean }}
 */
export function useAssetPreloader(opts = {}) {
  const {
    enabled = true,
    includeDeferred = true,
    concurrency = 6,
  } = opts;

  const critical = CRITICAL_ASSETS;
  const deferred = includeDeferred ? DEFERRED_ASSETS : [];
  const total = critical.length + deferred.length;

  // If a previous mount already warmed everything, start "done".
  const allWarmed = critical.every((u) => warmed.has(u)) &&
    deferred.every((u) => warmed.has(u));

  const [loaded, setLoaded] = useState(() =>
    [...critical, ...deferred].filter((u) => warmed.has(u)).length
  );
  const [criticalDone, setCriticalDone] = useState(
    () => criticalEverDone || critical.every((u) => warmed.has(u))
  );
  const [done, setDone] = useState(() => allWarmed);

  const startedRef = useRef(false);

  useEffect(() => {
    if (!enabled || startedRef.current || allWarmed) return;
    startedRef.current = true;

    let cancelled = false;
    const tick = () => { if (!cancelled) setLoaded((n) => n + 1); };

    (async () => {
      await runPool(critical, concurrency, tick);
      if (cancelled) return;
      criticalEverDone = true;
      setCriticalDone(true);

      if (deferred.length) {
        await runPool(deferred, concurrency, tick);
        if (cancelled) return;
      }
      setDone(true);
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return { loaded, total, criticalDone, done };
}
