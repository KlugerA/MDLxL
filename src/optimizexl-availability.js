import { openDocument } from './editor-document.js';
import { STAGES, findIrregularities, runOptimizeStage, sanityProposals, simpleSettings } from './optimizexl.js';
import { prepareNuclearReduction } from './optimizexl-geometry.js';

// Check private candidates before showing a green star. The selected stage's
// explicit review takes priority over these initial availability results.
export async function* stageAvailability(bytes, excludedGeosets = []) {
  const model = openDocument(bytes, 'availability.mdx').model;
  for (const { id: stage } of STAGES) {
    try {
      let hasChanges;
      if (stage === 'sanity') hasChanges = sanityProposals(model).some(f=>!f.inspectionOnly);
      else if (stage === 'irregularities') hasChanges = findIrregularities(model).some(f => !f.inspectionOnly);
      else if (stage === 'spheres') {
        // A different preset is a choice, not evidence of a missing sphere.
        const spheres = model.CollisionShapes.filter(s => s.Shape === 2);
        hasChanges = !spheres.length || spheres.some(s => !Number.isFinite(s.BoundsRadius) || s.BoundsRadius <= 0 || s.Vertices?.length !== 3 || !Array.from(s.Vertices).every(Number.isFinite));
      } else {
        if (stage === 'nuclear') await prepareNuclearReduction();
        const result = runOptimizeStage(bytes, stage, { ...simpleSettings(stage, 100, model), excludedGeosets });
        hasChanges = result.changed && result.saved > 0;
      }
      yield { stage, hasChanges };
    } catch (error) {
      // An unsuccessful check is not an available repair. Keep its reason
      // visible on the existing stage button rather than inventing a finding.
      yield { stage, hasChanges: false, error: error.message };
    }
  }
}
