/* Version-pinned app cache. Activation is explicit when every app tab is idle. */
const VERSION = '__BUILD_VERSION__',
  ROOT = new URL('./', self.location.href).href,
  PREFIX = 'odyssey-run-v:' + new URL(ROOT).pathname + ':';
const CORE = PREFIX + VERSION + '-core';
let manifest;
const getManifest = async () =>
  manifest ||
  (manifest = await fetch(new URL('offline-manifest.json', ROOT), {cache: 'no-store'})
    .then(r => {
      if (!r.ok) throw Error('manifest');
      return r.json();
    })
    .then(m => {
      if (m.version !== VERSION) throw Error('version');
      return m;
    }));
const key = path => new URL(path, ROOT).href;
const cacheName = stage => PREFIX + VERSION + '-' + stage;
async function fetchFile(entry) {
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), 30000);
  try {
    const r = await fetch(key(entry.path), {cache: 'reload', signal: controller.signal});
    if (!r.ok || r.type === 'opaque') throw Error('download');
    const data = await r.clone().arrayBuffer(),
      hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', data)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    if (data.byteLength !== entry.bytes || hash !== entry.hash) throw Error('integrity');
    return r;
  } finally {
    clearTimeout(timer);
  }
}
self.addEventListener('install', e =>
  e.waitUntil(
    (async () => {
      const m = await getManifest(),
        c = await caches.open(CORE);
      for (const f of m.core) await c.put(key(f.path), await fetchFile(f));
      await c.put(
        key('offline-manifest.json'),
        new Response(JSON.stringify(m), {headers: {'Content-Type': 'application/json'}}),
      );
    })(),
  ),
);
// Downloaded island files whose bytes did not change survive an update instead of being fetched again.
async function carryOver(m) {
  const next = new Map(
    [['shared', m.shared], ...Object.entries(m.groups)].flatMap(([group, files]) =>
      files.map(f => [f.path, {group, f}]),
    ),
  );
  for (const name of await caches.keys()) {
    if (!name.startsWith(PREFIX) || !name.endsWith('-core') || name === CORE) continue;
    const r = await (await caches.open(name)).match(key('offline-manifest.json'));
    if (!r) continue;
    const old = await r.json(),
      base = name.slice(0, -'core'.length);
    for (const [group, files] of [['shared', old.shared], ...Object.entries(old.groups)]) {
      if (!(await caches.has(base + group))) continue;
      const from = await caches.open(base + group),
        to = await caches.open(cacheName(group));
      for (const f of files) {
        const want = next.get(f.path);
        if (
          !want ||
          want.group !== group ||
          want.f.hash !== f.hash ||
          want.f.bytes !== f.bytes ||
          (await to.match(key(f.path)))
        )
          continue;
        const hit = await from.match(key(f.path));
        if (hit) await to.put(key(f.path), hit);
      }
    }
  }
}
self.addEventListener('activate', e =>
  e.waitUntil(
    (async () => {
      const c = await caches.open(CORE);
      manifest = await (await c.match(key('offline-manifest.json'))).json();
      try {
        await carryOver(manifest);
      } catch {}
      await Promise.all(
        (await caches.keys())
          .filter(n => n.startsWith(PREFIX) && !n.startsWith(PREFIX + VERSION + '-'))
          .map(n => caches.delete(n)),
      );
      const legacyNames = (await caches.keys()).filter(n => /^odyssey-run-v[0-9]+$/.test(n));
      for (const name of legacyNames) {
        const legacy = await caches.open(name);
        for (const req of await legacy.keys()) if (req.url.startsWith(ROOT)) await legacy.delete(req);
        if (!(await legacy.keys()).length) await caches.delete(name);
      }
      await self.clients.claim();
    })(),
  ),
);
async function cached(path) {
  for (const n of [CORE, cacheName('shared'), ...['beach', 'cave', 'wind'].map(cacheName)]) {
    const hit = await (await caches.open(n)).match(path);
    if (hit) return hit;
  }
  return undefined;
}
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || !u.href.startsWith(ROOT)) return;
  e.respondWith(
    (async () => {
      if (e.request.mode === 'navigate') {
        const page = await (await caches.open(CORE)).match(key('index.html'));
        if (page) return page;
      }
      const hit = await cached(e.request);
      if (hit) return hit;
      try {
        return await fetch(e.request);
      } catch {
        return new Response('오프라인 파일이 없어요. 연결 후 설정에서 섬을 내려받아 주세요.', {
          status: 503,
          headers: {'Content-Type': 'text/plain;charset=utf-8'},
        });
      }
    })(),
  );
});
async function loadManifest() {
  if (manifest) return manifest;
  const c = await caches.open(CORE),
    r = await c.match(key('offline-manifest.json'));
  if (r) {
    manifest = await r.json();
    return manifest;
  }
  return getManifest();
}
async function stageReady(stage) {
  const m = await loadManifest(),
    c = await caches.open(cacheName(stage)),
    shared = await caches.open(cacheName('shared')),
    core = await caches.open(CORE);
  for (const f of m.core) if (!(await core.match(key(f.path)))) return false;
  for (const f of m.shared) if (!(await shared.match(key(f.path)))) return false;
  for (const f of m.groups[stage]) if (!(await c.match(key(f.path)))) return false;
  return true;
}
const downloading = new Set();
const tabIdle = client =>
  new Promise(resolve => {
    const ch = new MessageChannel(),
      timeout = setTimeout(() => {
        ch.port1.close();
        resolve(false);
      }, 2500);
    ch.port1.onmessage = e => {
      clearTimeout(timeout);
      ch.port1.close();
      resolve(e.data?.idle === true);
    };
    client.postMessage({type: 'ODYSSEY_CAN_UPDATE'}, [ch.port2]);
  });
self.addEventListener('message', e => {
  const p = e.ports[0];
  if (!p) return;
  e.waitUntil(
    (async () => {
      try {
        const m = await loadManifest();
        if (e.data?.type === 'STATUS') {
          const ready = {};
          for (const stage of ['beach', 'cave', 'wind']) ready[stage] = await stageReady(stage);
          p.postMessage({
            type: 'DONE',
            version: VERSION,
            ready,
            bytes: Object.fromEntries(
              Object.entries(m.groups).map(([id, files]) => [
                id,
                [...m.shared, ...files].reduce((n, f) => n + f.bytes, 0),
              ]),
            ),
          });
        } else if (e.data?.type === 'DOWNLOAD_STAGE') {
          const stage = e.data.stage;
          if (!['beach', 'cave', 'wind'].includes(stage) || downloading.size) throw Error('busy');
          downloading.add(stage);
          try {
            const stageCache = await caches.open(cacheName(stage)),
              shared = await caches.open(cacheName('shared')),
              files = [...m.shared, ...m.groups[stage]];
            let done = 0;
            for (const f of files) {
              const c = m.shared.includes(f) ? shared : stageCache;
              if (!(await c.match(key(f.path)))) await c.put(key(f.path), await fetchFile(f));
              p.postMessage({type: 'PROGRESS', progress: ++done / files.length});
            }
            if (!(await stageReady(stage))) throw Error('incomplete');
            p.postMessage({type: 'DONE'});
          } finally {
            downloading.delete(stage);
          }
        } else if (e.data?.type === 'APPLY_UPDATE') {
          const clients = await self.clients.matchAll({type: 'window', includeUncontrolled: true}),
            own = clients.filter(c => c.url.startsWith(ROOT));
          if (downloading.size || (await Promise.all(own.map(tabIdle))).some(idle => !idle)) throw Error('busy-tabs');
          p.postMessage({type: 'DONE'});
          await self.skipWaiting();
        } else throw Error('message');
      } catch {
        p.postMessage({
          type: 'ERROR',
          message:
            e.data?.type === 'APPLY_UPDATE'
              ? '다른 탭에서 항해 중이거나 응답하지 않아요. 항해를 끝내고 다른 게임 탭을 닫아 주세요.'
              : '다운로드를 완료하지 못했어요. 연결과 저장 공간을 확인하고 다시 시도해 주세요.',
        });
      }
    })(),
  );
});
