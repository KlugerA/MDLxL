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

export function hasGlobalEmission(model, emitter) {
  return [emitter.Visibility, emitter.EmissionRate].some(track => globalPeriod(model, track) > 0);
}

function emitterIsAction(model, sequence, emitter) {
  if (hasGlobalEmission(model, emitter)) return false;
  const tracks = [emitter.Visibility, emitter.EmissionRate];
  const hasLocal = tracks.some(track => !globalPeriod(model, track) && localKeys(track, sequence).length);
  if (emitter.Squirt && hasLocal) return true;
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

// Only local action effects contribute to duration. Global emission gates retain
// their independent clock and never create an animation tail or emission cutoff.
export function loopEffectTiming(model, index, loops = 1, speed = 1, globalStart = 0, definitions = new Map(), disabledEmitters = []) {
  const sequence = model.Sequences?.[index], requested = Number(loops);
  const count = Number.isSafeInteger(requested) && requested > 0 ? requested : 1;
  if (!sequence || !(speed > 0)) return {seconds: 0, motionSeconds: 0, emissionEnds: {}, finishEffects: false};
  const [start, end] = sequence.Interval, duration = Math.max(0, end - start), motion = duration / speed;
  const finishEffects = finishesShowcaseEffects(sequence), emissionEnds = {};
  const disabled = new Set(disabledEmitters);
  let finish = motion;
  const sample = (track, time, fallback) => sampleTrack(track, start + Math.min(duration, time * speed), {
    interval: sequence.Interval, globalSequences: model.GlobalSequences, globalTime: time, fallback,
  });
  const timeKeys = track => localKeys(track, sequence).map(key => (key.Frame - start) / speed);
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
    if (globalPeriod(model, lifeTrack)) continue;
    const lifeKeys = localKeys(lifeTrack, sequence);
    const life = (typeof lifeTrack === 'number' ? lifeTrack : Math.max(0, ...lifeKeys.map(key => value(key.Vector)))) * 1000;
    const times = [...new Set([0, motion, ...timeKeys(emitter.Visibility), ...timeKeys(emitter.EmissionRate)])].sort((a, b) => a - b);
    const emitting = time => sample(emitter.Visibility, time, kind === 'RibbonEmitters' ? 0 : 1) > 0 && sample(emitter.EmissionRate, time, 0) > 0;
    let last = -1;
    if (emitter.Squirt && emitter.EmissionRate?.Keys) {
      for (const time of [...new Set([0, ...timeKeys(emitter.EmissionRate)])]) if (emitting(time)) last = Math.max(last, time);
    } else for (let i = 1; i < times.length; i++) if (emitting((times[i - 1] + times[i]) / 2)) last = times[i];
    // A Squirt key is a trigger, not the end of its emission window. Let the
    // renderer consume the authored key before stopping emission at motion end.
    emissionEnds[id] = emitter.Squirt && last >= 0 ? motion : last;
    if (last >= 0) finish = Math.max(finish, last + life);
  }
  // A complete action includes its own tail, BEFORE the next action starts.
  // Continuous loops keep the exact authored period (no per-loop rounding/holds).
  const cycleSeconds = finishEffects ? roundUp((finish + (finish > motion + 1e-6 ? 1000 / 30 : 0)) / 1000) : motion / 1000;
  return {seconds: roundUp(cycleSeconds * count), durationLoops: count, motionSeconds: motion * count / 1000,
    cycleSeconds, cycleMotionSeconds: motion / 1000, finishEffects, emissionEnds};
}

export function timeShowcasePlaylist(model, rows, definitions) {
  return rows.map(row => {
    if (!row.useDuration) return row;
    const timing = loopEffectTiming(model, row.sequence, row.durationLoops ?? 1, row.speed > 0 ? row.speed : 1, 0, definitions, row.disabledEmitters);
    const extraTime = Math.max(0, Number(row.extraTime) || 0);
    const {cycleGlobalEmitters, ...localRow} = row;
    return {...localRow, ...timing, extraTime, seconds: Math.round((timing.seconds + extraTime) * 100) / 100};
  });
}
