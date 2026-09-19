/** Renderer-only reuse. Native lookup paths never become preview-cache paths. */
export function copyTextureBytes(input) {
  if (input instanceof ArrayBuffer) return input.slice(0);
  if (ArrayBuffer.isView(input)) return input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength);
  throw Error('Texture has no image data.');
}

export function createTextureAssetCache({ resolve, maxBytes = 48 * 1024 * 1024, maxItems = 96 }) {
  const assets = new Map(), pending = new Map();
  let bytes = 0;
  return async function load(item, modelPath) {
    const key = item.cacheKey;
    if (assets.has(key)) { const asset = assets.get(key); assets.delete(key); assets.set(key, asset); return asset; }
    if (pending.has(key)) return pending.get(key);
    const request = (async () => {
      const records = await resolve({ path: modelPath, names: [item.lookupName] });
      if (!records?.length) throw Error('This texture is not available in the selected Warcraft installation or model folder.');
      const asset = { ...records[0], name: item.path, source: item.source, libraryKey: key };
      assets.set(key, asset); bytes += asset.bytes?.byteLength || 0;
      while ((bytes > maxBytes || assets.size > maxItems) && assets.size > 1) {
        const first = assets.keys().next().value; bytes -= assets.get(first).bytes?.byteLength || 0; assets.delete(first);
      }
      return asset;
    })();
    pending.set(key, request);
    try { return await request; } finally { pending.delete(key); }
  };
}

/** Warm remounts reuse the last catalogue/results while fresh native metadata validates it. */
export function createTextureLibrarySessions({ maxEntries = 4, maxResults = 24 } = {}) {
  const sessions = new Map(), pending = new Map();
  const keyFor = path => String(path || '');
  const ensure = path => {
    const key = keyFor(path), value = sessions.get(key) || { catalog: null, results: new Map() };
    sessions.delete(key); sessions.set(key, value);
    while (sessions.size > maxEntries) sessions.delete(sessions.keys().next().value);
    return value;
  };
  return {
    peek: path => sessions.get(keyFor(path))?.catalog || null,
    async load(path, loader) {
      const key = keyFor(path);
      if (pending.has(key)) return pending.get(key);
      const request = Promise.resolve().then(loader).then(catalog => {
        const session = ensure(path);
        if (session.catalog?.signature !== catalog.signature) session.results.clear();
        session.catalog = catalog; return catalog;
      });
      pending.set(key, request);
      try { return await request; } finally { pending.delete(key); }
    },
    result(path, signature, options) {
      const session = sessions.get(keyFor(path));
      return session?.catalog && session.catalog.signature === signature ? session.results.get(JSON.stringify(options)) || null : null;
    },
    remember(path, signature, options, result) {
      const session = ensure(path);
      if (!session.catalog || session.catalog.signature !== signature) return;
      const key = JSON.stringify(options); session.results.delete(key); session.results.set(key, result);
      while (session.results.size > maxResults) session.results.delete(session.results.keys().next().value);
    },
    invalidate() { sessions.clear(); }
  };
}

/** Explicit preload can prepare the same initial search used by a later library mount. */
export async function warmTextureLibrarySession({ sessions, modelPath, loadCatalog, search, canWarm = () => true, vibe = true }) {
  const catalog = await sessions.load(modelPath, loadCatalog);
  if (!canWarm()) return catalog;
  const options = { query:'', vibe, folder:'', variant:catalog.items.some(item => item.variant === 'classic') ? 'classic' : 'all', kind:'all', limit:120 };
  if (!sessions.result(modelPath, catalog.signature, options)) {
    const result = await search(catalog, options);
    sessions.remember(modelPath, catalog.signature, options, result);
  }
  return catalog;
}

/** Limits expensive thumbnail work and shares the same pending key across tiles/details. */
export function createThumbnailQueue({ concurrency = 2 } = {}) {
  const pending = new Map(), queue = [];
  let active = 0;
  const drain = () => {
    while (active < concurrency && queue.length) {
      const { key, operation, resolve, reject } = queue.shift(); active++;
      Promise.resolve().then(operation).then(resolve, reject).finally(() => { active--; pending.delete(key); drain(); });
    }
  };
  return (key, operation) => {
    if (pending.has(key)) return pending.get(key);
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    pending.set(key, promise); queue.push({ key, operation, resolve, reject }); drain(); return promise;
  };
}

/** Coalesce visible tiles into a bounded IPC read; never cache misses across preload jobs. */
export function createThumbnailLookup(read, { maxBatch = 128 } = {}) {
  const waiting = new Map(), pending = new Map(); let scheduled = false;
  const flush = async () => {
    scheduled = false;
    const batch = [...waiting.entries()].slice(0, maxBatch);
    for (const [key] of batch) waiting.delete(key);
    if (waiting.size) { scheduled = true; setTimeout(flush, 0); }
    try {
      const records = await read({ keys: batch.map(([key]) => key) });
      const found = new Map((records || []).map(item => [item.key, item.url]));
      for (const [key, request] of batch) request.resolve(found.get(key) || null);
    } catch (error) { for (const [, request] of batch) request.reject(error); }
    finally { for (const [key] of batch) pending.delete(key); }
  };
  return key => {
    if (pending.has(key)) return pending.get(key);
    let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    pending.set(key,promise);waiting.set(key, { promise, resolve, reject });
    if (!scheduled) { scheduled = true; setTimeout(flush, 4); }
    return promise;
  };
}
