import { resetPreviewEffects } from './warcraft-preview-adapter.js';

/** One simulation clock for live preview and offline recording. No model writes. */
export function advanceShowcaseModel(native, model, sample, previous) {
  const index = Math.max(0, sample.sequenceIndex), sequence = model.Sequences[index];
  const reset = !previous || previous.revision !== sample.revision || previous.segment !== sample.segment || sample.globalTime < previous.globalTime;
  const clocks = native.rendererData.globalSequencesFrames;
  const setClocks = time => { for (let i = 0; i < (model.GlobalSequences?.length || 0); i++) if (model.GlobalSequences[i] > 0) clocks[i] = time % model.GlobalSequences[i]; };
  const setFrame = frame => { native.setFrame(frame); native.rendererData.animation = index; native.rendererData.animationInfo = sequence; native.rendererData.frame = frame; };
  if (reset) { native.setSequence(index); setFrame(sequence.Interval[0]); resetPreviewEffects(native); }
  let remaining = reset ? sample.localTime || 0 : Math.max(0, sample.globalTime - previous.globalTime);
  let clock = sample.globalTime - remaining;
  setClocks(clock);
  while (remaining > 1e-7) {
    if (native.getFrame() >= sequence.Interval[1]) setFrame(sequence.Interval[0]);
    const step = Math.min(20, remaining, sequence.Interval[1] - native.getFrame());
    if (!(step > 0)) break;
    native.update(step); remaining -= step; clock += step; setClocks(clock);
  }
  setFrame(sample.sequenceIndex < 0 ? sequence.Interval[0] : sample.frame);
  setClocks(sample.globalTime); native.update(0);
  return sample;
}
