export const EDITOR_DISPLAY_MODES = Object.freeze(['vertices', 'bones', 'animation']);
export const SHARED_DISPLAY_KEYS = Object.freeze(['bones', 'wires', 'nodes', 'attachments', 'particles', 'vertices', 'grid', 'cameras', 'normals']);

// Clear display helpers, not model data, selections, grid or camera navigation.
export function clearQuickDisplay(overlays, mode) {
  let next = overlays;
  for (const key of ['vertices', 'wires', 'nodes', 'attachments', 'particles', 'bones']) next = setEditorDisplay(next, mode, key, false);
  return next;
}

/** Vertices, Bones, Movement, and Animations are views of one editor scene.
 * Keep their display switches as one state while leaving the UV workspace
 * independent. The Vertices state is the migration authority for profiles
 * written by releases that accidentally stored one copy per tab. */
export function synchronizeEditorDisplay(overlays) {
  const next = Object.fromEntries(Object.entries(overlays || {}).map(([mode, value]) => [mode, { ...value }]));
  const source = next.vertices || {};
  for (const mode of EDITOR_DISPLAY_MODES) {
    next[mode] ||= {};
    for (const key of SHARED_DISPLAY_KEYS) if (typeof source[key] === 'boolean') next[mode][key] = source[key];
  }
  return next;
}

export function setEditorDisplay(overlays, mode, key, value) {
  const current = overlays?.[mode] || {};
  const resolved = typeof value === 'function' ? value(current[key]) : value;
  const next = Object.fromEntries(Object.entries(overlays || {}).map(([name, state]) => [name, { ...state }]));
  if (EDITOR_DISPLAY_MODES.includes(mode) && SHARED_DISPLAY_KEYS.includes(key)) {
    for (const name of EDITOR_DISPLAY_MODES) next[name] = { ...(next[name] || {}), [key]: !!resolved };
  } else next[mode] = { ...current, [key]: !!resolved };
  return next;
}

/** Movement opens with its two required rig layers enabled. The user's other
 * View switches remain untouched and can still be changed after entry. */
export function enterMovementDisplay(overlays) {
  return { ...(overlays || {}), bones: true, attachments: true };
}

/** Movement never paints idle vertex squares; Animations is a clean mesh and
 * emitted-particle view with every node/emitter marker suppressed. */
export function animationPanelDisplay(overlays, panel = 'movement') {
  const current = { ...(overlays || {}) };
  if (panel === 'animations') return { ...current, bones: false, nodes: false, attachments: false, particles: false, boneLines: false, vertices: false, selectedVerticesOnly: false, cameras: false };
  return { ...current, vertices: false, selectedVerticesOnly: true };
}
