import {sampleTrack} from '../src/animation.js';
import {parseEventName} from './event-preview-data.js';

const value = v => typeof v === 'number' ? v : Number(v?.[0] || 0);
const roundUp = seconds => Math.max(.02, Math.ceil(seconds * 100 - 1e-8) / 100);
const globalPeriod = (model, track) => model.GlobalSequences?.[track?.GlobalSeqId] || 0;
const localKeys = (track, sequence) => (track?.Keys || []).filter(key => key.Frame >= sequence.Interval[0] && key.Frame <= sequence.Interval[1]);

// Showcase policy, inferred from Warcraft's authored sequence names/NonLooping
// flag and Hive's emitter guidance. Channel/locomotion take precedence over Spell
// or Attack in compound names (e.g. Spell Channel, Attack Walk Stand Spin).
// https://www.hiveworkshop.com/threads/basic-animations.97548/
// https://www.hiveworkshop.com/threads/particle-emitters-2.329335/
export function finishesShowcaseEffects(sequence) {
  const words = new Set(String(sequence?.Name || '').toLowerCase().match(/[a-z]+/g) || []);
  if (['birth', 'death', 'morph', 'decay', 'dissipate'].some(word => words.has(word))) return true;
  if (['channel', 'walk', 'run', 'looping'].some(word => words.has(word))) return false;
  if (['attack', 'spell'].some(word => words.has(word))) return true;
  if (['swim', 'fly'].some(word => words.has(word))) return false;
  return !!sequence?.NonLooping;
}

// Only effects actually rendered by this preview appear in the switches.
export function showcaseEmitters(model) {
  return ['ParticleEmitters2', 'RibbonEmitters', 'EventObjects'].flatMap(kind =>
    (model[kind] || []).filter(node => kind !== 'EventObjects' || parseEventName(node.Name))
      .map(node => ({id: node.ObjectId, name: node.Name || `${kind === 'RibbonEmitters' ? 'Ribbon' : 'Emitter'} ${node.ObjectId}`, kind, node})));
}

function emitterIsAction(model, sequence, emitter) {
  const tracks = [emitter.Visibility, emitter.EmissionRate];
  const hasLocal = tracks.some(track => !globalPeriod(model, track) && localKeys(track, sequence).length);
  if (emitter.Squirt && hasLocal) return true;
  if (!hasLocal && tracks.some(track => globalPeriod(model, track))) return false;
  // A gate that changes during this action, or disables emission in other
  // animations, identifies action effects without treating constant auras as tails.
  if (tracks.some(track => !globalPeriod(model, track) && localKeys(track, sequence).some(key => value(key.Vector) <= 0) && localKeys(track, sequence).some(key => value(key.Vector) > 0))) return true;
  const continuous = (model.Sequences || []).filter(row => !finishesShowcaseEffects(row));
  if (!continuous.length) return true;
  return hasLocal && continuous.some(row => tracks.some((track, index) => {
    if (globalPeriod(model, track)) return false;
    const keys = localKeys(track, row);
    return keys.length ? keys.every(key => value(key.Vector) <= 0) : index === 1 && !!track?.Keys;
  }));
}

// Each one-shot cycle owns its action-emitter clock. This includes a local action
// gate combined with global burst visibility, such as the Knight's slam. Only
// those emission gates use this clock; global bones/materials/auras stay continuous.
// globalStart is deliberately irrelevant: identical actions must have identical
// displayed durations when reordered or recorded in a different batch position.
export function loopEffectTiming(model, index, loops = 1, speed = 1, globalStart = 0, definitions = new Map(), disabledEmitters = []) {
  const sequence = model.Sequences?.[index], requested = Number(loops);
  const count = Number.isSafeInteger(requested) && requested > 0 ? requested : 1;
  if (!sequence || !(speed > 0)) return {seconds: 0, motionSeconds: 0, emissionEnds: {}, cycleGlobalEmitters: [], finishEffects: false};
  const [start, end] = sequence.Interval, duration = Math.max(0, end - start), motion = duration / speed;
  const finishEffects = finishesShowcaseEffects(sequence), emissionEnds = {}, cycleGlobalEmitters = [];
  const disabled = new Set(disabledEmitters);
  let finish = motion;
  const sample = (track, time, fallback) => sampleTrack(track, start + Math.min(duration, time * speed), {
    interval: sequence.Interval, globalSequences: model.GlobalSequences, globalTime: time, fallback,
  });
  const timeKeys = (track, horizon) => {
    const period = globalPeriod(model, track), times = [];
    if (period) {
      for (let cycle = 0; cycle * period <= horizon; cycle++) for (const key of track.Keys || []) {
        const time = cycle * period + key.Frame;
        if (time <= horizon) times.push(time);
      }
    } else for (const key of localKeys(track, sequence)) times.push((key.Frame - start) / speed);
    return times;
  };
  if (finishEffects) for (const {id, kind, node: emitter} of showcaseEmitters(model)) {
    if (disabled.has(id)) continue;
    if (kind === 'EventObjects') {
      // Global events are ambient; local spawned effects/decals belong to the action.
      const globalId = emitter.GlobalSeqId ?? emitter.GlobalSequenceId;
      const life = definitions?.get(emitter.Name)?.lifeSpanMs;
      if (model.GlobalSequences?.[globalId] || !(life > 0)) continue;
      for (const frame of emitter.EventTrack || []) if (frame >= start && frame <= end) finish = Math.max(finish, (frame - start) / speed + life);
      continue;
    }
    if (!emitterIsAction(model, sequence, emitter)) continue;
    const lifeTrack = emitter.LifeSpan;
    const lifeKeys = globalPeriod(model, lifeTrack) ? lifeTrack.Keys || [] : localKeys(lifeTrack, sequence);
    const life = (typeof lifeTrack === 'number' ? lifeTrack : Math.max(0, ...lifeKeys.map(key => value(key.Vector)))) * 1000;
    let horizon = motion;
    for (const track of [emitter.Visibility, emitter.EmissionRate]) {
      const period = globalPeriod(model, track), keys = track?.Keys || [];
      if (period) cycleGlobalEmitters.push(id);
      if (period && keys.some(key => value(key.Vector) <= 0) && keys.some(key => value(key.Vector) > 0)) horizon = Math.max(horizon, Math.ceil(motion / period) * period);
    }
    const times = [...new Set([0, motion, horizon, ...timeKeys(emitter.Visibility, horizon), ...timeKeys(emitter.EmissionRate, horizon)])].sort((a, b) => a - b);
    const emitting = time => sample(emitter.Visibility, time, kind === 'RibbonEmitters' ? 0 : 1) > 0 && sample(emitter.EmissionRate, time, 0) > 0;
    let last = -1;
    if (emitter.Squirt && emitter.EmissionRate?.Keys) {
      for (const time of [...new Set([0, ...timeKeys(emitter.EmissionRate, horizon)])]) if (emitting(time)) last = Math.max(last, time);
    } else for (let i = 1; i < times.length; i++) if (emitting((times[i - 1] + times[i]) / 2)) last = times[i];
    emissionEnds[id] = last;
    if (last >= 0) finish = Math.max(finish, last + life);
  }
  // A complete action includes its own tail, BEFORE the next action starts.
  // Continuous loops keep the exact authored period (no per-loop rounding/holds).
  const cycleSeconds = finishEffects ? roundUp((finish + (finish > motion + 1e-6 ? 1000 / 30 : 0)) / 1000) : motion / 1000;
  return {seconds: roundUp(cycleSeconds * count), durationLoops: count, motionSeconds: motion * count / 1000,
    cycleSeconds, cycleMotionSeconds: motion / 1000, finishEffects, emissionEnds, cycleGlobalEmitters: [...new Set(cycleGlobalEmitters)]};
}

export function timeShowcasePlaylist(model, rows, definitions) {
  return rows.map(row => {
    if (!row.useDuration) return row;
    const timing = loopEffectTiming(model, row.sequence, row.durationLoops ?? 1, row.speed > 0 ? row.speed : 1, 0, definitions, row.disabledEmitters);
    const extraTime = Math.max(0, Number(row.extraTime) || 0);
    return {...row, ...timing, extraTime, seconds: Math.round((timing.seconds + extraTime) * 100) / 100};
  });
}
