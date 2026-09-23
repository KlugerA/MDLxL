// Private editor storage, alongside existing mdlvis-* preferences. This module
// has no model mutators, document transactions, or MDL/MDX serialization hooks.
const prefix = 'mdlxl-motion-v1:';
const bytesOf = bytes => bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
export async function motionDigest(bytes) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytesOf(bytes))), b => b.toString(16).padStart(2, '0')).join('');
}
export async function motionModelKey(bytes, path, name) {
  const content = await motionDigest(bytes);
  return motionDigest(new TextEncoder().encode(JSON.stringify([path ? String(path).replaceAll('\\', '/').toLowerCase() : `browser:${name}`, content])));
}
function canonical(value, property = '') {
  if (value == null || typeof value !== 'object') return typeof value === 'number' ? Number(value.toFixed(6)) : value;
  if (Array.isArray(value) || ArrayBuffer.isView(value)) {
    let values = Array.from(value);
    if (property === 'Rotation' && values.length === 4 && values.every(Number.isFinite)) {
      const length = Math.hypot(...values) || 1, sign = values.findLast(v => Math.abs(v) > 1e-9) < 0 ? -1 : 1;
      values = values.map(v => v / length * sign);
    }
    return values.map(v => canonical(v, property));
  }
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key], key === 'Rotation' ? key : property)]));
}
export async function motionSignature(finding) {
  return motionDigest(new TextEncoder().encode(JSON.stringify(canonical(finding.state))));
}
const read = (storage, key) => {
  const text = storage.getItem(prefix + key);
  if (!text) return null;
  const value = JSON.parse(text);
  if (!value || value.version !== 1) throw Error('Motion Inspector decisions could not be read.');
  return value;
};
export function motionDecisionStore(storage, modelKey) {
  let id = read(storage, 'model:' + modelKey)?.id || modelKey;
  const readDecisions = () => read(storage, 'decisions:' + id)?.desired || {};
  return {
    desired: readDecisions,
    mark(finding, desired) {
      if (!finding.signature) throw Error('Rescan before marking this movement Desired.');
      const decisions = readDecisions();
      if (desired) decisions[finding.signature] = { nodeId: finding.nodeId, property: finding.property, start: finding.start, end: finding.end, kind: finding.kind };
      else delete decisions[finding.signature];
      storage.setItem(prefix + 'decisions:' + id, JSON.stringify({ version: 1, desired: decisions }));
      return decisions;
    },
    alias(savedKey) {
      // Only called after an explicit successful model save/download. A different
      // file at the same location cannot inherit this identity by path alone.
      storage.setItem(prefix + 'model:' + savedKey, JSON.stringify({ version: 1, id }));
    },
  };
}

export function sessionMotionStore(session, storage = localStorage) {
  if (!session.motionStorePromise) {
    const { path, doc } = session;
    session.motionStorePromise = motionModelKey(doc.originalBytes, path, doc.name).then(key => motionDecisionStore(storage, key));
    session.motionStorePromise.catch(() => { delete session.motionStorePromise; });
  }
  return session.motionStorePromise;
}
export async function rememberMotionSave(session, bytes, path, name) {
  if (session.motionStorePromise) (await session.motionStorePromise).alias(await motionModelKey(bytes, path, name));
}
