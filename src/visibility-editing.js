import { sampleTrack } from './animation.js';

export const visibilityGlobal = value => Number.isInteger(value?.GlobalSeqId) && value.GlobalSeqId >= 0 ? value.GlobalSeqId : null;
export function visibilityInterval(model, value, sequenceIndex) {
  const global = visibilityGlobal(value);
  return global === null ? model.Sequences?.[sequenceIndex]?.Interval : [0, model.GlobalSequences?.[global]];
}
export function visibilityAt(value, frame, interval, fallback = 1) {
  // The final key of a global loop is editable, even though playback wraps there.
  return Number(sampleTrack(value?.Keys ? { ...value, GlobalSeqId: null } : value, frame, { interval, fallback }));
}
const vector = value => new Float32Array([value]);
function key(frame, value, line) {
  return { Frame: frame, Vector: vector(value), ...(line >= 2 ? { InTan: vector(line === 2 ? 0 : value), OutTan: vector(line === 2 ? 0 : value) } : {}) };
}
const lerp = (a, b, t) => a + (b - a) * t;

/** Insert a boundary without changing the curve on either side. Cubic controls
 * are subdivided, rather than replacing their tangents with guessed values. */
function split(track, frame, interval, fallback) {
  if (track.Keys.some(k => k.Frame === frame)) return;
  const keys = track.Keys.filter(k => k.Frame >= interval[0] && k.Frame <= interval[1]);
  const left = keys.filter(k => k.Frame < frame).at(-1), right = keys.find(k => k.Frame > frame);
  const added = key(frame, visibilityAt(track, frame, interval, fallback), track.LineType);
  if (track.LineType >= 2 && left && right) {
    const t = (frame - left.Frame) / (right.Frame - left.Frame), a = left.Vector[0], d = right.Vector[0];
    const b = track.LineType === 2 ? a + left.OutTan[0] / 3 : left.OutTan[0];
    const c = track.LineType === 2 ? d - right.InTan[0] / 3 : right.InTan[0];
    const ab = lerp(a, b, t), bc = lerp(b, c, t), cd = lerp(c, d, t);
    const abc = lerp(ab, bc, t), bcd = lerp(bc, cd, t), value = lerp(abc, bcd, t);
    added.Vector = vector(value);
    left.OutTan = vector(track.LineType === 2 ? 3 * (ab - a) : ab);
    added.InTan = vector(track.LineType === 2 ? 3 * (value - abc) : abc);
    added.OutTan = vector(track.LineType === 2 ? 3 * (bcd - value) : bcd);
    right.InTan = vector(track.LineType === 2 ? 3 * (d - cd) : cd);
  } else if (track.LineType >= 2) {
    // Outside the first/last key the native sampler holds a constant value.
    if (right) right.InTan = vector(track.LineType === 2 ? 0 : right.Vector[0]);
    if (left) left.OutTan = vector(track.LineType === 2 ? 0 : left.Vector[0]);
  }
  track.Keys.push(added); track.Keys.sort((a, b) => a.Frame - b.Frame);
}

/** A single undoable caller owns the result. No track clock or interpolation is
 * silently converted. Range edits preserve every other sequence and the curve
 * outside the inclusive millisecond range (with one-ms switch boundaries). */
export function editVisibility(value, model, { sequenceIndex = 0, range, frames, amount, fallback = 1 } = {}) {
  if (!Number.isFinite(amount) || amount < 0 || amount > 1) throw Error('Choose an opacity between 0% and 100%.');
  const interval = visibilityInterval(model, value, sequenceIndex);
  if (!interval || !interval.every(n => Number.isInteger(n) && n >= 0 && n <= 0x7fffffff) || interval[1] < interval[0]) throw Error('Choose an animation with a valid time range.');
  const inside = n => Number.isInteger(n) && n >= interval[0] && n <= interval[1];
  const track = value?.Keys ? structuredClone(value) : { LineType: 0, Keys: [] };
  if (!value?.Keys) {
    // Static values must stay the same in all the other animations.
    for (const seq of model.Sequences || []) for (const at of seq.Interval || []) {
      if (!track.Keys.some(k => k.Frame === at)) track.Keys.push(key(at, Number(value ?? fallback), 0));
    }
    track.Keys.sort((a, b) => a.Frame - b.Frame);
  }
  if (frames) {
    if (!frames.length || frames.some(at => !inside(at) || !track.Keys.some(k => k.Frame === at))) throw Error('Select existing keys in this animation.');
    for (const k of track.Keys) if (frames.includes(k.Frame)) {
      const delta = amount - k.Vector[0]; k.Vector = vector(amount);
      if (track.LineType === 3) { k.InTan = vector(k.InTan[0] + delta); k.OutTan = vector(k.OutTan[0] + delta); }
    }
    return track;
  }
  if (!range || range.length !== 2 || range.some(at => !inside(at)) || range[1] < range[0]) throw Error('Select a range inside this animation.');
  const [start, end] = range;
  // Anchors prevent the first/last authored value extending into untouched time.
  for (const at of [interval[0], interval[1], start - 1, end + 1]) if (inside(at)) split(track, at, interval, fallback);
  track.Keys = track.Keys.filter(k => k.Frame < start || k.Frame > end);
  track.Keys.push(key(start, amount, track.LineType));
  if (end !== start) track.Keys.push(key(end, amount, track.LineType));
  track.Keys.sort((a, b) => a.Frame - b.Frame);
  return track;
}
