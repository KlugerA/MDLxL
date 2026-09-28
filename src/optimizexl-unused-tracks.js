const json = value => JSON.stringify(value, (_, v) => ArrayBuffer.isView(v) ? Array.from(v) : v);
const resolve = (model, path) => path.reduce((value, key) => value?.[key], model);
const local = track => track.GlobalSeqId == null || track.GlobalSeqId === -1 || track.GlobalSeqId === 0xffffffff;

export function unusedTrackProposals(model, entries) {
  const findings = [];
  for (const { track, path } of entries) {
    if (!local(track) || !model.Sequences.length) continue;
    const active = key => model.Sequences.some(s => key.Frame >= s.Interval[0] && key.Frame <= s.Interval[1]);
    // Hive exempts frame zero (the setup key). Match its unused-key diagnostic
    // rather than deleting setup data simply because sequences start later.
    const frames = track.Keys.filter(k => k.Frame !== 0 && !active(k)).map(k => k.Frame);
    // Retain wholly unassigned tracks: removing the track requires a separate
    // static/base-value decision. Here only keys ignored by local playback go.
    if (!frames.length || !track.Keys.some(active)) continue;
    const owner = resolve(model, path.slice(0, -1));
    findings.push({ id: `unusedLocal:${path.join('.')}`, kind: 'unusedLocalKeys', path, frames, signature: json(track),
      sequence: 0, frame: model.Sequences[0].Interval[0],
      label: `${owner?.Name || path.slice(0, -1).join('.')}: ${frames.length} unused ${path.at(-1)} key${frames.length === 1 ? '' : 's'}`,
      detail: 'Remove keys outside every animation. Keep all in-animation keys and global-sequence motion.' });
  }
  return findings;
}

export function applyUnusedTrack(model, fix) {
  const track = resolve(model, fix.path), removed = new Set(fix.frames);
  track.Keys = track.Keys.filter(k => !removed.has(k.Frame));
}
