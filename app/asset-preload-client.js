import { createThumbnailQueue, copyTextureBytes } from '../src/texture-library-session.js';

const enqueue = createThumbnailQueue({ concurrency: 2 });
const slots = [];
let serial = 0, subscription = null, consumers = 0;

function createSlot() {
  const worker = new Worker(new URL('../src/texture-thumbnail-worker.js', import.meta.url), { type: 'module' });
  const slot = { worker, pending: null };
  worker.onmessage = ({ data }) => {
    const job = slot.pending; if (!job || job.id !== data.id) return;
    slot.pending = null; data.error ? job.reject(Error(data.error)) : job.resolve(data.url);
  };
  worker.onerror = event => {
    slot.pending?.reject(Error(event.message || 'Background texture preview failed.')); slot.pending = null;
    worker.terminate(); const index = slots.indexOf(slot); if (index >= 0) slots.splice(index, 1);
  };
  slots.push(slot); return slot;
}

/** Copies bytes before worker transfer: selecting/importing an asset keeps its original bytes. */
export function backgroundThumbnail(asset, key) {
  return enqueue(key || 'decode:' + (++serial), () => {
    const slot = slots.find(item => !item.pending) || createSlot(), id = ++serial;
    const bytes = copyTextureBytes(asset.bytes);
    return new Promise((resolve, reject) => {
      slot.pending = { id, resolve, reject };
      try { slot.worker.postMessage({ id, asset: { name: asset.name, bytes } }, [bytes]); }
      catch (error) { slot.pending = null; reject(error); }
    });
  });
}

/** Register once at App mount; no asset work starts until the user confirms Preload. */
export function installTextureLibraryDecoder(desktop = window.desktop) {
  if (!desktop?.onTextureLibraryDecode) return () => {};
  consumers++;
  if (!subscription) subscription = desktop.onTextureLibraryDecode(asset => backgroundThumbnail(asset));
  return () => { consumers--; if (!consumers) { subscription?.(); subscription = null; } };
}
