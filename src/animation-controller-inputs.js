/** Preserve an unfinished numeric entry, but immediately cap values above the
 * percentage range so the controlled Alpha field visibly rewrites to 100. */
export function clampAlphaPercentText(value) {
  const text = String(value ?? '');
  return text !== '' && Number(text) > 100 ? '100' : text;
}

export function setSequenceToggle(state, sequenceIndex, checked) {
  if (!Number.isInteger(sequenceIndex) || sequenceIndex < 0) return state;
  return { ...state, [sequenceIndex]: !!checked };
}

export function removeSequenceToggle(state, sequenceIndex) {
  const next = {};
  for (const [key, checked] of Object.entries(state || {})) {
    const index = Number(key);
    if (index < sequenceIndex) next[index] = checked;
    else if (index > sequenceIndex) next[index - 1] = checked;
  }
  return next;
}

