import { runOptimizeStage } from '../src/optimizexl.js';
import { prepareNuclearReduction } from '../src/optimizexl-geometry.js';
self.onmessage = async ({ data }) => {
  try { if(data.stage==='nuclear')await prepareNuclearReduction();const result = runOptimizeStage(data.bytes, data.stage, data.settings, data.fix); self.postMessage({ result }, [result.bytes.buffer]); }
  catch (error) { self.postMessage({ error: error.message }); }
};
