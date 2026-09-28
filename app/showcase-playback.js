import {resetPreviewEffects} from './warcraft-preview-adapter.js';
import {showcaseAnimation, showcaseRowPose} from './showcase-timeline.js';

/** Advance effects in wall time while local pose and global tracks keep separate clocks. */
export function advanceShowcaseModel(native, model, sample, previous) {
  if (!model.Sequences?.[Math.max(0, sample.sequenceIndex)]) return sample;
  const reset = !previous || previous.revision !== sample.revision || sample.globalTime < previous.globalTime;
  const clocks = native.rendererData.globalSequencesFrames;
  const setClocks = time => { for (let i = 0; i < (model.GlobalSequences?.length || 0); i++) if (model.GlobalSequences[i] > 0) clocks[i] = ((time % model.GlobalSequences[i]) + model.GlobalSequences[i]) % model.GlobalSequences[i]; };
  if (reset) { native.setSequence(Math.max(0, sample.sequenceIndex)); resetPreviewEffects(native); }
  const elapsed = reset ? 0 : Math.max(0, sample.globalTime - previous.globalTime);
  let last = reset ? null : previous;
  const at = fraction => {
    // Sample the same playlist as the displayed frame at every simulation step.
    // Interpolating local pose times would run backwards across loop/tail boundaries.
    const timeline = sample.timeline;
    if (timeline && previous?.timeline) {
      const seconds = previous.timeline.seconds + (timeline.seconds - previous.timeline.seconds) * fraction;
      const cycle = timeline.repeat ? Math.floor(seconds / timeline.length) : 0;
      const next = showcaseAnimation(model, timeline.playlist, timeline.repeat ? seconds % timeline.length : seconds, false);
      next.segment += cycle * timeline.playlist.filter(row => model.Sequences?.[row.sequence]).length;
      return next;
    }
    if (sample.animationRow) {
      const from = previous?.segment === sample.segment ? previous.clipTime : Math.max(0, sample.clipTime - elapsed);
      const clipTime = from + (sample.clipTime - from) * fraction;
      return {...sample, ...showcaseRowPose(model.Sequences[sample.sequenceIndex], sample.animationRow, clipTime), clipTime};
    }
    return sample;
  };
  const update = (step, pose, globalTime) => {
    const index = Math.max(0, pose.sequenceIndex), sequence = model.Sequences[index];
    if (!sequence) return;
    const boundary = !last || last.segment !== pose.segment || last.effectCycle !== pose.effectCycle;
    if (last && last.segment !== pose.segment) native.setSequence(index);
    native.rendererData.animation = index;
    native.rendererData.animationInfo = sequence;
    // Upstream adds delta before evaluating nodes. Effects still age at a held pose.
    native.rendererData.frame = (pose.sequenceIndex < 0 ? sequence.Interval[0] : pose.frame) - step;
    setClocks(globalTime - step);
    const disabled = new Set(pose.disabledEmitters || []), cycleGlobals = new Set(pose.cycleGlobalEmitters || []);
    const restored = [];
    for (const controller of [native.particlesController, native.ribbonsController]) {
      if (!controller?.updateEmitter) continue;
      const original = controller.updateEmitter;
      restored.push([controller, original]);
      controller.updateEmitter = function (emitter, delta) {
        const props = emitter.props, id = props.ObjectId;
        const muted = disabled.has(id), until = pose.emissionEnds?.[id];
        const visibility = props.Visibility, savedClocks = [];
        if (muted) {
          if (emitter.particles) emitter.particles.length = 0;
          if (emitter.creationTimes) emitter.creationTimes.length = 0;
          emitter.emission = 0;
        }
        if (muted || (Number.isFinite(until) && pose.cycleTime > until + 1e-6)) props.Visibility = 0;
        const rateGlobal = props.EmissionRate?.GlobalSeqId;
        if (boundary && props.Squirt && (!(model.GlobalSequences?.[rateGlobal] > 0) || cycleGlobals.has(id))) emitter.squirtFrame = -1;
        if (cycleGlobals.has(id)) for (const track of [visibility, props.EmissionRate]) {
          const globalId = track?.GlobalSeqId, period = model.GlobalSequences?.[globalId];
          if (period > 0 && !savedClocks.some(([id]) => id === globalId)) {
            savedClocks.push([globalId, clocks[globalId]]);
            clocks[globalId] = ((pose.cycleTime % period) + period) % period;
          }
        }
        try { return original.call(this, emitter, delta); }
        finally { props.Visibility = visibility; for (const [id, value] of savedClocks) clocks[id] = value; }
      };
    }
    try { native.update(step); }
    finally { for (const [controller, original] of restored) controller.updateEmitter = original; }
    last = pose;
  };
  let remaining = elapsed;
  while (remaining > 1e-7) {
    const step = Math.min(20, remaining), fraction = (elapsed - remaining + step) / elapsed;
    update(step, at(fraction), sample.globalTime - remaining + step);
    remaining -= step;
  }
  update(0, sample, sample.globalTime);
  return sample;
}
