import { recalculateExtents } from './editor-document.js';
import { sampleTrack } from './animation.js';

const MAX_FRAME = 0x7fffffff;
const isTrack = value => value && Array.isArray(value.Keys);

function wholeFrame(value, label) {
  if (!Number.isInteger(value) || value < 0 || value > MAX_FRAME) throw new Error(`${label} must be a whole frame from 0 to ${MAX_FRAME}.`);
  return value;
}

function intervalLike(current, start, end) {
  return ArrayBuffer.isView(current) ? new current.constructor([start, end]) : [start, end];
}

function extentCopy(source = {}) {
  return {
    MinimumExtent: new Float32Array(source.MinimumExtent || [0, 0, 0]),
    MaximumExtent: new Float32Array(source.MaximumExtent || [0, 0, 0]),
    BoundsRadius: Number(source.BoundsRadius) || 0,
  };
}

export function setSequenceInterval(model, sequenceIndex, start, end) {
  const sequence = model.Sequences?.[sequenceIndex];
  if (!sequence) throw new Error('Select an animation before editing its frame interval.');
  start = wholeFrame(start, 'The first frame');
  end = wholeFrame(end, 'The last frame');
  if (end < start) throw new Error('The last frame must be greater than or equal to the first frame.');
  sequence.Interval = intervalLike(sequence.Interval, start, end);
  return sequence.Interval;
}

export function setSequenceName(model, sequenceIndex, value) {
  const sequence = model.Sequences?.[sequenceIndex];
  if (!sequence) throw new Error('Select an animation before renaming it.');
  const name = String(value ?? '').replace(/[\r\n\0]/g, '').trim();
  if (!name) throw new Error('An animation name cannot be empty.');
  if (new TextEncoder().encode(name).length > 79) throw new Error('An animation name must fit in 79 UTF-8 bytes.');
  sequence.Name = name;
  return name;
}

/** MdlVis' Apply Move Speed control edits the sequence field only. MoveSpeed
 * describes ground speed to a preview/game consumer; it is not a command to
 * add displacement to a Root_Bone animation track. */
export function setSequenceMoveSpeed(model, sequenceIndex, value) {
  const sequence = model.Sequences?.[sequenceIndex];
  if (!sequence) throw new Error('Select an animation before editing move speed.');
  const speed = Number(value);
  if (!Number.isFinite(speed) || speed < 0) throw new Error('Move speed must be a number greater than or equal to 0.');
  sequence.MoveSpeed = speed;
  return speed;
}

export function setGlobalSequenceDuration(model, globalSeqId, duration) {
  if (!Number.isInteger(globalSeqId) || globalSeqId < 0 || model.GlobalSequences?.[globalSeqId] === undefined) throw new Error('Select a global sequence before editing its duration.');
  duration = wholeFrame(duration, 'The global sequence length');
  if (duration < 1) throw new Error('A global sequence must be at least one frame long.');
  model.GlobalSequences[globalSeqId] = duration;
  return duration;
}

export function createSequence(model, duration = 1000) {
  duration = wholeFrame(Number(duration), 'Sequence length');
  if (duration < 1) throw new Error('Sequence length must be at least 1 ms.');
  model.Sequences ||= [];
  const previousEnd = model.Sequences.length ? Math.max(...model.Sequences.map(sequence => Number(sequence.Interval?.[1]) || 0)) : -1000;
  const start = previousEnd + 1000, end = start + duration;
  if (end > MAX_FRAME) throw new Error('There is not enough frame space to create another sequence.');
  const taken = new Set(model.Sequences.map(sequence => sequence.Name));
  let number = model.Sequences.length + 1, name = `New Sequence ${number}`;
  while (taken.has(name)) name = `New Sequence ${++number}`;
  const sequence = {
    Name: name,
    Interval: new Uint32Array([start, end]),
    NonLooping: false,
    MoveSpeed: 0,
    Rarity: 0,
    ...extentCopy(model.Info),
  };
  const index = model.Sequences.push(sequence) - 1;
  for (const geoset of model.Geosets || []) (geoset.Anims ||= []).push(extentCopy(geoset));
  return index;
}

export function createGlobalSequence(model, duration = 1000) {
  model.GlobalSequences ||= [];
  duration = wholeFrame(duration, 'The global sequence length');
  if (duration < 1) throw new Error('A global sequence must be at least one frame long.');
  return model.GlobalSequences.push(duration) - 1;
}

export function portraitSequenceIndices(model) {
  return (model.Sequences || []).flatMap((sequence, index) => /portrait/i.test(sequence.Name || '') ? [index] : []);
}

/** Portrait is an ordinary Movement sequence. Copy only appearance channels;
 * bone motion and camera tracks must never be inherited from the source.
 * Local appearance keys are fitted to the new duration; shared global tracks
 * and static values already apply to the new sequence without modification. */
export function createPortraitSequence(model, duration, sourceIndex = -1) {
  duration = wholeFrame(Number(duration), 'Portrait length');
  if (duration < 1) throw new Error('Portrait length must be at least 1 ms.');
  const source = model.Sequences?.[sourceIndex];
  if (sourceIndex !== -1 && !source) throw new Error('Select an existing visibility/RGB source.');
  const previousEnd = Math.max(-1000, ...(model.Sequences || []).map(sequence => Number(sequence.Interval?.[1]) || 0));
  if (previousEnd + 1000 + duration > MAX_FRAME) throw new Error('There is not enough frame space for this Portrait sequence.');
  const copies = [];
  if (source) visitModel(model, {
    track(track, owner, property) {
      if (!['Alpha', 'Color', 'AmbColor', 'Visibility'].includes(property) || !track.Keys.length || Number.isInteger(track.GlobalSeqId) && track.GlobalSeqId >= 0) return;
      const [start, end] = source.Interval;
      const sample = Frame => {
        const value = sampleTrack(track, Frame, { interval: source.Interval, fallback: property === 'Color' || property === 'AmbColor' ? [1, 1, 1] : 1 });
        const Vector = new Float32Array(typeof value === 'number' ? [value] : value);
        return { Frame, Vector, ...(track.LineType >= 2 ? { InTan: track.LineType === 2 ? new Float32Array(Vector.length) : new Float32Array(Vector), OutTan: track.LineType === 2 ? new Float32Array(Vector.length) : new Float32Array(Vector) } : {}) };
      };
      const keys = track.Keys.filter(key => key.Frame >= start && key.Frame <= end).map(key => structuredClone(key));
      if (!keys.some(key => key.Frame === start)) keys.unshift(sample(start));
      if (!keys.some(key => key.Frame === end)) keys.push(sample(end));
      copies.push({ track, keys, start, end });
    },
    event() {},
  });
  const index = createSequence(model, duration), sequence = model.Sequences[index];
  sequence.Name = 'Portrait';
  sequence.Interval[1] = sequence.Interval[0] + duration;
  for (const { track, keys, start, end } of copies) {
    const fitted = new Map();
    for (const key of keys) {
      key.Frame = sequence.Interval[0] + Math.round((key.Frame - start) / Math.max(1, end - start) * duration);
      fitted.set(key.Frame, key);
    }
    track.Keys.push(...fitted.values());
    track.Keys.sort((a, b) => a.Frame - b.Frame);
  }
  return index;
}

function visitModel(model, visitor) {
  const seen = new Set();
  function visit(value, owner, property) {
    if (!value || typeof value !== 'object' || ArrayBuffer.isView(value) || seen.has(value)) return;
    seen.add(value);
    if (isTrack(value)) visitor.track(value, owner, property);
    if (value.EventTrack && (ArrayBuffer.isView(value.EventTrack) || Array.isArray(value.EventTrack))) visitor.event(value);
    for (const [key, child] of Object.entries(value)) {
      if (key === 'Keys' || key === 'EventTrack' || key === 'Interval' || key === 'Anims') continue;
      if (Array.isArray(child)) for (const item of child) visit(item, child, null);
      else visit(child, value, key);
    }
  }
  visit(model, null, null);
}

function sameGlobalId(value, id) {
  return Number.isInteger(value?.GlobalSeqId) && value.GlobalSeqId >= 0 && value.GlobalSeqId === id;
}

export function deleteSequence(model, sequenceIndex) {
  const sequence = model.Sequences?.[sequenceIndex];
  if (!sequence?.Interval) throw new Error('Select an animation before deleting it.');
  const [start, end] = sequence.Interval;
  let removedKeys = 0;
  visitModel(model, {
    track(track) {
      if (Number.isInteger(track.GlobalSeqId) && track.GlobalSeqId >= 0) return;
      const before = track.Keys.length;
      track.Keys = track.Keys.filter(key => key.Frame < start || key.Frame > end);
      removedKeys += before - track.Keys.length;
    },
    event(node) {
      if (Number.isInteger(node.GlobalSeqId) && node.GlobalSeqId >= 0) return;
      const values = Array.from(node.EventTrack), filtered = values.filter(frame => frame < start || frame > end);
      removedKeys += values.length - filtered.length;
      node.EventTrack = ArrayBuffer.isView(node.EventTrack) ? new node.EventTrack.constructor(filtered) : filtered;
    },
  });
  model.Sequences.splice(sequenceIndex, 1);
  for (const geoset of model.Geosets || []) if (Array.isArray(geoset.Anims)) geoset.Anims.splice(sequenceIndex, 1);
  if (model.Info) recalculateExtents(model);
  return removedKeys;
}

export function deleteGlobalSequence(model, globalSeqId) {
  if (!Number.isInteger(globalSeqId) || globalSeqId < 0 || model.GlobalSequences?.[globalSeqId] === undefined) throw new Error('Select a global sequence before deleting it.');
  let removedKeys = 0;
  visitModel(model, {
    track(track) {
      if (sameGlobalId(track, globalSeqId)) {
        removedKeys += track.Keys.length;
        track.Keys = [];
        track.GlobalSeqId = null;
      } else if (Number.isInteger(track.GlobalSeqId) && track.GlobalSeqId > globalSeqId) track.GlobalSeqId--;
    },
    event(node) {
      if (sameGlobalId(node, globalSeqId)) {
        removedKeys += node.EventTrack.length;
        node.EventTrack = ArrayBuffer.isView(node.EventTrack) ? new node.EventTrack.constructor() : [];
        delete node.GlobalSeqId;
      } else if (Number.isInteger(node.GlobalSeqId) && node.GlobalSeqId > globalSeqId) node.GlobalSeqId--;
    },
  });
  model.GlobalSequences.splice(globalSeqId, 1);
  if (model.Info) recalculateExtents(model);
  return removedKeys;
}
