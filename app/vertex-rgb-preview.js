/** Resolve the animation snapshot used by the Vertex editor's RGB Preview. */
export function vertexRgbPreviewState(model, { enabled = false, sequenceIndex = -1, frame = 0, globalTime = frame } = {}) {
  const interval = enabled && Number.isInteger(sequenceIndex) ? model?.Sequences?.[sequenceIndex]?.Interval : null;
  if (!interval) return { sequenceIndex, frame, globalTime, interval: model?.Sequences?.[sequenceIndex]?.Interval };
  return { sequenceIndex, frame: interval[0], globalTime: interval[0], interval };
}
