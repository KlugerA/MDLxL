const positive = (value, fallback) => Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : fallback;
const mix = (a, b, t) => a + (b - a) * t;
const easing = (t, curve) => curve === 'smooth' ? t * t * (3 - 2 * t) : curve === 'ease-in' ? t * t : curve === 'ease-out' ? 1 - (1 - t) ** 2 : t;

/** Times are presentation seconds. Global time only accrues while a local
 * animation advances, including each entry's independent playback speed. */
export function showcaseAnimation(model, playlist, seconds, repeat = true) {
  const rows = playlist.filter(row => model.Sequences?.[row.sequence]);
  if (!rows.length) return { sequenceIndex: -1, frame: 0, globalTime: 0, active: false, segment: -1 };
  const length = row => positive(row.seconds, 3);
  const activeTime = (row, elapsed) => {
    const sequence = model.Sequences[row.sequence], duration = Math.max(0, sequence.Interval[1] - sequence.Interval[0]);
    const amount = elapsed * 1000 * (Number.isFinite(Number(row.speed)) ? Math.max(0, Math.min(2, Number(row.speed))) : 1);
    return row.loop === false || sequence.NonLooping ? Math.min(duration, amount) : duration > 0 ? amount : 0;
  };
  const total = rows.reduce((sum, row) => sum + length(row), 0);
  const time = Math.max(0, seconds), cycles = repeat ? Math.floor(time / total) : 0;
  let remaining = repeat ? time % total : Math.min(time, total), globalTime = cycles * rows.reduce((sum, row) => sum + activeTime(row, length(row)), 0);
  for (let index = 0; index < rows.length; index++) {
    const row = rows[index], span = length(row);
    if (remaining < span || index === rows.length - 1) {
      const sequence = model.Sequences[row.sequence], [start, end] = sequence.Interval;
      const elapsed = activeTime(row, remaining), duration = end - start;
      const looping = row.loop !== false && !sequence.NonLooping;
      return { sequenceIndex: row.sequence, frame: start + (looping && duration > 0 ? elapsed % duration : Math.min(duration, elapsed)), localTime: elapsed, globalTime: globalTime + elapsed,
        active: duration > 0 && (looping || elapsed < duration) && (repeat || time < total), segment: cycles * rows.length + index,
        portrait: /portrait/i.test(sequence.Name || '') };
    }
    remaining -= span; globalTime += activeTime(row, span);
  }
}

export function orbitView(view, degrees, elevation) {
  const offset = view.position.map((v, i) => v - view.target[i]);
  const radius = Math.hypot(...offset), azimuth = Math.atan2(offset[1], offset[0]) + degrees * Math.PI / 180;
  const angle = elevation == null ? Math.atan2(offset[2], Math.hypot(offset[0], offset[1])) : elevation * Math.PI / 180;
  return { ...view, position: [view.target[0] + radius * Math.cos(angle) * Math.cos(azimuth), view.target[1] + radius * Math.cos(angle) * Math.sin(azimuth), view.target[2] + radius * Math.sin(angle)] };
}

export function showcaseCamera(points, seconds) {
  if (!points.length) return null;
  let time = Math.max(0, seconds);
  for (let i = 0; i < points.length; i++) {
    const point = points[i], hold = Math.max(0, Number(point.hold) || 0), next = points[i + 1];
    if (time <= hold || !next) return point.view;
    time -= hold;
    const duration = positive(point.seconds, 2);
    if (time <= duration) {
      const t = easing(time / duration, point.curve);
      const a = point.view, b = next.view;
      const view = { ...a, position: a.position.map((v, j) => mix(v, b.position[j], t)), target: a.target.map((v, j) => mix(v, b.target[j], t)) };
      for (const key of ['roll', 'fieldOfView', 'near', 'far']) view[key] = mix(a[key], b[key], t);
      if (point.path === 'orbit') {
        const from = a.position.map((v, j) => v - a.target[j]), to = b.position.map((v, j) => v - b.target[j]);
        const start = Math.atan2(from[1], from[0]), end = Math.atan2(to[1], to[0]);
        const shortest = Math.atan2(Math.sin(end - start), Math.cos(end - start));
        const angle = start + (shortest + (Number(point.turns) || 0) * Math.PI * 2) * t;
        const elevation = mix(Math.atan2(from[2], Math.hypot(from[0], from[1])), Math.atan2(to[2], Math.hypot(to[0], to[1])), t);
        const radius = mix(Math.hypot(...from), Math.hypot(...to), t);
        view.position = [view.target[0] + radius * Math.cos(elevation) * Math.cos(angle), view.target[1] + radius * Math.cos(elevation) * Math.sin(angle), view.target[2] + radius * Math.sin(elevation)];
      }
      return view;
    }
    time -= duration;
  }
}

export function recordingTimeline(seconds, fps) {
  const ticks = Math.round(Number(seconds) * 100);
  if (!Number.isFinite(ticks) || ticks < 2) throw Error('Record length must be at least 0.02 seconds.');
  if (![10, 15, 20, 24, 25, 30, 50].includes(Number(fps))) throw Error('Choose a supported recording FPS.');
  return { duration: ticks * 10, frames: Math.ceil(ticks / 100 * fps), time: index => index * 1000 / fps };
}
