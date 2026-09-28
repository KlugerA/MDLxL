import { sampleTrack } from './animation.js';

const json = value => JSON.stringify(value, (_, v) => ArrayBuffer.isView(v) ? Array.from(v) : v);
const local = track => !track?.Keys || track.GlobalSeqId == null || track.GlobalSeqId === -1 || track.GlobalSeqId === 0xffffffff;
const alpha = (model, gi) => model.GeosetAnims.find(a => a.GeosetId === gi)?.Alpha;
const layers = (model, gi) => model.Materials[model.Geosets[gi].MaterialID]?.Layers || [];
const bones = g => [...new Set(Array.from(g.VertexGroup || []).flatMap(i => g.Groups?.[i] || []))].sort((a,b) => a-b);
const bounds = g => {
  const lo = [Infinity,Infinity,Infinity], hi = [-Infinity,-Infinity,-Infinity];
  g.Vertices.forEach((v,i) => { lo[i%3] = Math.min(lo[i%3],v); hi[i%3] = Math.max(hi[i%3],v); });
  return {lo,hi};
};
const overlap = (a,b) => a.lo.every((v,i) => v <= b.hi[i] && a.hi[i] >= b.lo[i]);
function zeroThroughout(track, interval) {
  if (typeof track === 'number') return track <= .001;
  if (!track?.Keys || !local(track)) return false;
  const keys = track.Keys.filter(k => k.Frame >= interval[0] && k.Frame <= interval[1]);
  if (!keys.length || ![0,1,2,3].includes(track.LineType)) return false;
  // A zero linear/step curve is exact. For cubics, zero controls avoid missing
  // an interior excursion that endpoint-only sampling would overlook.
  return keys.every(k => Math.abs(k.Vector[0]) <= .001 && (track.LineType < 2 ||
    Math.abs(k.InTan?.[0]) <= .001 && Math.abs(k.OutTan?.[0]) <= .001));
}
function visibleAt(model, gi, si, frame) {
  const options = { interval:model.Sequences[si].Interval, globalSequences:model.GlobalSequences, globalTime:0, fallback:1 };
  return sampleTrack(alpha(model,gi),frame,options) > .001 && layers(model,gi).some(l => sampleTrack(l.Alpha,frame,options) > .001);
}
function times(model, ids, si) {
  const [lo,hi] = model.Sequences[si].Interval, values = new Set([lo,hi,(lo+hi)/2]);
  for (const gi of ids) for (const t of [alpha(model,gi),...layers(model,gi).map(l => l.Alpha)])
    if (local(t)) for (const k of t?.Keys || []) if (k.Frame >= lo && k.Frame <= hi) values.add(k.Frame);
  const sorted = [...values].sort((a,b) => a-b);
  return [...sorted,...sorted.slice(1).map((v,i) => (v+sorted[i])/2)];
}

/** Infer attached additive geometry from skin bindings, spatial overlap and
 * repeated co-visibility. No model, texture, bone or animation names are rules. */
export function effectVisibilityProposals(model) {
  const findings = [], bindings = model.Geosets.map(bones), boxes = model.Geosets.map(bounds);
  for (let gi=0; gi<model.Geosets.length; gi++) {
    const ls = layers(model,gi);
    if (!ls.length || !ls.every(l => [3,4].includes(l.FilterMode)) || !bindings[gi].length ||
        !local(alpha(model,gi)) || ls.some(l => !local(l.Alpha))) continue;
    const carriers = model.Geosets.map((_,i) => i).filter(i => i !== gi &&
      json(bindings[i]) === json(bindings[gi]) && overlap(boxes[i],boxes[gi]) &&
      layers(model,i).some(l => [0,1,2].includes(l.FilterMode)));
    if (!carriers.length) continue;
    const together = model.Sequences.filter((_,si) => times(model,[gi,...carriers],si)
      .some(f => visibleAt(model,gi,si,f) && carriers.some(c => visibleAt(model,c,si,f)))).length;
    if (together < 2) continue;
    for (const [sequence,s] of model.Sequences.entries()) {
      const hidden = carriers.every(c => zeroThroughout(alpha(model,c),s.Interval) ||
        layers(model,c).every(l => zeroThroughout(l.Alpha,s.Interval)));
      if (!hidden || !times(model,[gi],sequence).some(f => visibleAt(model,gi,sequence,f))) continue;
      const ambiguous = model.Sequences.some((other,i) => i !== sequence && s.Interval[0] <= other.Interval[1] && s.Interval[1] >= other.Interval[0]);
      findings.push({ id:`effectVisibility:${gi}:${sequence}`, kind:'effectVisibility', geoset:gi, carriers, sequence, frame:s.Interval[0],
        ...(ambiguous ? {inspectionOnly:true} : {}),
        signature:json([model.Sequences, ...[gi,...carriers].map(i => [bindings[i],boxes[i],alpha(model,i),layers(model,i)])]),
        label:`${s.Name}: glow Geoset ${gi+1} visible without its attached geometry`,
        detail:`Geoset ${gi+1} shares bones and space with Geoset${carriers.length>1?'s':''} ${carriers.map(c=>c+1).join(', ')}. They appear together in ${together} animations, but the attached geometry is hidden throughout this one. ${ambiguous?'Overlapping intervals need manual review.':'Proposed fix hides only this glow in this animation.'}` });
    }
  }
  return findings;
}
