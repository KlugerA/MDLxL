import { runOptimizeStage } from '../src/optimizexl.js';
import { prepareNuclearReduction } from '../src/optimizexl-geometry.js';
import { stageAvailability } from '../src/optimizexl-availability.js';
self.onmessage = async ({ data }) => {
  try {
    if(data.operation==='availability') {
      for await (const availability of stageAvailability(data.bytes,data.excludedGeosets)) self.postMessage({availability});
      self.postMessage({complete:true});return;
    }
    if(data.stage==='nuclear')await prepareNuclearReduction();const result = runOptimizeStage(data.bytes, data.stage, data.settings, data.fix); self.postMessage({ result }, [result.bytes.buffer]);
  }
  catch (error) { self.postMessage({ error: error.message }); }
};
