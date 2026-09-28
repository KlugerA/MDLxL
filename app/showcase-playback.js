import {hasGlobalEmission} from './showcase-effects.js';
import {resetPreviewEffects} from './warcraft-preview-adapter.js';
import {showcaseAnimation, showcaseRowPose} from './showcase-timeline.js';

/** Advance effects in wall time while local pose and global tracks keep separate clocks. */
export function advanceShowcaseModel(native, model, sample, previous) {
  if (!model.Sequences?.[Math.max(0, sample.sequenceIndex)]) return sample;
  const reset = !previous || previous.revision !== sample.revision || sample.globalTime < previous.globalTime;
  const clocks = native.rendererData.globalSequencesFrames;
  const setClocks = (time, step) => { for (let i = 0; i < (model.GlobalSequences?.length || 0); i++) if (model.GlobalSequences[i] > 0) clocks[i] = ((time % model.GlobalSequences[i]) + model.GlobalSequences[i]) % model.GlobalSequences[i] - step; };
  if (reset) {
    native.setSequence(Math.max(0, sample.sequenceIndex));
    if (!previous || sample.globalTime < previous.globalTime) resetPreviewEffects(native);
    else for (const controller of [native.particlesController, native.ribbonsController]) for (const emitter of controller?.emitters || []) {
      // Restarting/seeking a local animation must not clear global effects.
      if (hasGlobalEmission(model, emitter.props)) continue;
      if (emitter.particles) emitter.particles.length = 0;
      if (emitter.creationTimes) emitter.creationTimes.length = 0;
      emitter.emission = 0; emitter.squirtFrame = -1;
    }
  }
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
    setClocks(globalTime, step);
    const disabled = new Set(pose.disabledEmitters || []);
    const restored = [];
    for (const controller of [native.particlesController, native.ribbonsController]) {
      if (!controller?.updateEmitter) continue;
      const original = controller.updateEmitter;
      restored.push([controller, original]);
      controller.updateEmitter = function (emitter, delta) {
        const props = emitter.props, id = props.ObjectId;
        const globalEmission = hasGlobalEmission(model, props);
        const muted = disabled.has(id), until = globalEmission ? undefined : pose.emissionEnds?.[id];
        const visibility = props.Visibility;
        if (muted) {
          if (emitter.particles) emitter.particles.length = 0;
          if (emitter.creationTimes) emitter.creationTimes.length = 0;
          emitter.emission = 0;
        }
        if (muted || (Number.isFinite(until) && pose.cycleTime > until + 1e-6)) props.Visibility = 0;
        // Local burst keys repeat with the animation even if visibility is global.
        if (boundary && props.Squirt && !(model.GlobalSequences?.[props.EmissionRate?.GlobalSeqId] > 0)) emitter.squirtFrame = -1;
        try { return original.call(this, emitter, delta); }
        finally { props.Visibility = visibility; }
      };
    }
    try { native.update(step); }
    finally { for (const [controller, original] of restored) controller.updateEmitter = original; }
    last = pose;
  };
  let remaining = elapsed;
  while (remaining > 1e-7) {
    let step = Math.min(20, remaining);
    const fraction = (elapsed - remaining) / elapsed, before = at(fraction), after = at(fraction + step / elapsed);
    // Visit authored emission/visibility keys, even when a short burst lies
    // between display frames. Global keys use wall time, never local cycle time.
    const globalTime = sample.globalTime - remaining;
    const sameCycle = before.segment === after.segment && before.effectCycle === after.effectCycle;
    const frameRate = sameCycle ? (after.frame - before.frame) / step : 0;
    if (!sameCycle) {
      // Land on playlist/loop boundaries before advancing the next cycle's keys.
      let low = 0, high = step;
      for (let i = 0; i < 32; i++) {
        const middle = (low + high) / 2, pose = at(fraction + middle / elapsed);
        if (pose.segment === before.segment && pose.effectCycle === before.effectCycle) low = middle;
        else high = middle;
      }
      step = Math.min(step, high + 1e-6);
    }
    for (const controller of [native.particlesController, native.ribbonsController]) for (const emitter of controller?.emitters || []) {
      for (const track of [emitter.props.Visibility, emitter.props.EmissionRate]) {
        const period = model.GlobalSequences?.[track?.GlobalSeqId];
        for (const key of track?.Keys || []) {
          let distance;
          if (period > 0) {
            const phase = ((globalTime % period) + period) % period;
            distance = key.Frame - phase;
            if (distance <= 1e-7) distance += period;
          } else if (frameRate > 0) distance = (key.Frame - before.frame) / frameRate;
          if (distance > 1e-7 && distance < step) step = Math.min(step, distance + 1e-6);
        }
      }
    }
    update(step, at(fraction + step / elapsed), globalTime + step);
    remaining -= step;
  }
  update(0, sample, sample.globalTime);
  return sample;
}
