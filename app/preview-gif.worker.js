import { createPreviewGIF } from '../src/preview-gif.js';
let recording;
self.onmessage = ({ data }) => {
  try {
    if (data.type === 'start') { recording = createPreviewGIF({ repeat: data.loop ? 0 : -1, colors: data.colors, dither: data.dither }); }
    else if (data.type === 'frame') {
      const size = recording.add(new Uint8Array(data.buffer), data.width, data.height, data.time);
      self.postMessage({ type: 'ready', limit: size >= 240 * 1024 * 1024 });
    } else if (data.type === 'finish') {
      const result = recording.finish(data.time); recording = null;
      self.postMessage({ type: 'finished', ...result }, [result.bytes.buffer]);
    }
  } catch (error) { self.postMessage({ type: 'error', message: error.message }); }
};
