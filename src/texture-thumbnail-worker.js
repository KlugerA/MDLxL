import { decodeTextureThumbnail } from './texture-thumbnail.js';
self.onmessage = async ({ data }) => {
  try { self.postMessage({ id: data.id, url: await decodeTextureThumbnail(data.asset) }); }
  catch (error) { self.postMessage({ id: data.id, error: error.message || 'Texture preview could not be decoded.' }); }
};
