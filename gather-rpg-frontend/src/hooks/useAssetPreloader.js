import { useEffect, useRef, useState } from 'react';
import { CRITICAL_ASSETS, DEFERRED_ASSETS } from '../game/config/assetManifest';

// Module-level guards so warming runs once per page session even if the
// dashboard mounts/unmounts repeatedly. We only re-warm URLs we haven't
// already settled.
const warmed = new Set();
let criticalEverDone = false;

const PNG_RE = /\.png(\?|$)/i;

// Settle one URL into the browser cache. Resolves on both success AND error so
// a missing optional file can never stall the progress bar. Images go through
// the <img> path (decoded + held in the image cache); everything else (atlas
// JSON, audio) through fetch with force-cache.
function warmOne(url) {
  if (warmed.has(url)) return Promise.resolve();

  const settle = (resolve) => {
    warmed.add(url);
    resolve();
  };

  if (PNG_RE.test(url)) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => settle(resolve);
      img.onerror = () => settle(resolve);
      img.src = url;
    });
  }

  return new Promise((resolve) => {
    fetch(url, { cache: 'force-cache' })
      .then((r) => r.blob())
      .catch(() => {})
      .finally(() => settle(resolve));
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
