import { scanMotion } from '../src/motion-inspector.js';
import { motionSignature } from '../src/motion-decisions.js';

self.onmessage = async ({ data }) => {
  try {
    let reported = 0;
    const result = scanMotion(data.model, { ...data.options, onProgress: progress => {
      if (progress.completed === progress.total || performance.now() - reported > 100) { reported = performance.now(); self.postMessage({ progress }); }
    } });
    for (const finding of result.findings) { finding.signature = await motionSignature(finding); delete finding.state; }
    self.postMessage({ result });
  } catch (error) { self.postMessage({ error: error.message }); }
};
