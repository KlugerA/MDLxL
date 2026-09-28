const json = value => JSON.stringify(value, (_, v) => ArrayBuffer.isView(v) ? Array.from(v) : v);
const resolve = (model, path) => path.reduce((value, key) => value?.[key], model);
const local = track => track.GlobalSeqId == null || track.GlobalSeqId === -1 || track.GlobalSeqId === 0xffffffff;

/** Match Hive's missing-opening rule. Do not invent motion in empty sequences,
 * constant/step channels, globals, or ambiguous overlapping intervals. */
export function openingTrackProposals(model, entries) {
  const findings = [];
  for (const { track, path } of entries) {
    if (!local(track) || ![1, 2, 3].includes(track.LineType)) continue;
    const property = path.at(-1), owner = resolve(model, path.slice(0, -1));
    for (const [sequence, animation] of model.Sequences.entries()) {
      const [start, end] = animation.Interval;
      if (!(end > start) || model.Sequences.some((s, i) => i !== sequence && start <= s.Interval[1] && end >= s.Interval[0])) continue;
      const keys = track.Keys.filter(k => k.Frame >= start && k.Frame <= end);
      if (keys.length < 2 || keys[0].Frame === start || !keys[0].Vector?.length) continue;
      if (!keys.every((k, i) => k.Vector?.length === keys[0].Vector.length && Array.from(k.Vector).every(Number.isFinite) && (!i || k.Frame > keys[i - 1].Frame))) continue;
      if (!keys[0].Vector.some((v, i) => v !== keys.at(-1).Vector[i])) continue;
      if (track.LineType >= 2 && !keys.every(k => ['InTan', 'OutTan'].every(p => k[p]?.length === k.Vector.length && Array.from(k[p]).every(Number.isFinite)))) continue;
      findings.push({ id: `opening:${path.join('.')}:${sequence}`, kind: 'openingTrack', path, sequence, frame: start,
        signature: json(track), label: `${owner?.Name || path.slice(0, -1).join('.')}: missing opening ${property} in ${animation.Name}`,
        detail: `Add the missing ${property.toLowerCase()} key at the start of ${animation.Name}, holding its first authored value until the existing first key. Preserve the animation's remaining motion and all keys outside it.` });
    }
  }
  return findings;
}

export function applyOpeningTrack(model, fix) {
  const track = resolve(model, fix.path), [start, end] = model.Sequences[fix.sequence].Interval;
  const first = track.Keys.find(k => k.Frame >= start && k.Frame <= end);
  const opening = { Frame: start, Vector: structuredClone(first.Vector) };
  if (track.LineType >= 2) {
    // Before its first local key, native playback holds that first value.
    // Its incoming handle was unused. Neutralize only that handle to keep the
    // new lead-in constant; copying it would introduce a Bezier/Hermite jerk.
    const control = track.LineType === 2 && fix.path.at(-1) !== 'Rotation' ? new Float32Array(first.Vector.length) : structuredClone(first.Vector);
    opening.InTan = structuredClone(control); opening.OutTan = structuredClone(control);
    first.InTan = structuredClone(control);
  }
  track.Keys.push(opening); track.Keys.sort((a, b) => a.Frame - b.Frame);
}
