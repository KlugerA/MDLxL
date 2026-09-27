import { runOptimizeStage } from '../src/optimizexl.js';
self.onmessage = ({ data }) => {
  try { const result = runOptimizeStage(data.bytes, data.stage, data.settings, data.fix); self.postMessage({ result }, [result.bytes.buffer]); }
  catch (error) { self.postMessage({ error: error.message }); }
};
