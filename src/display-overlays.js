export const EDITOR_DISPLAY_MODES = Object.freeze(['vertices', 'bones', 'movement', 'animations']);

export function defaultEditorDisplay() {
  const base = { shaded: true, vertices: true, bones: false, skeleton: false, nodes: false, attachments: false, particles: false, wires: false, normals: false, grid: false, cameras: false };
  return {
    vertices: { ...base },
    bones: { ...base },
    movement: { ...base },
    animations: { ...base, shaded: false, vertices: false },
    uv: { ...base },
    paint: { ...base, shaded: false, vertices: false },
  };
}

export function setEditorDisplay(overlays, mode, key, value) {
  const current = overlays?.[mode] || {};
  const resolved = typeof value === 'function' ? value(current[key]) : value;
  return { ...overlays, [mode]: { ...current, [key]: !!resolved } };
}

// Clear the active editor's visible options without changing the model or selection.
export function clearQuickDisplay(overlays, mode) {
  return { ...overlays, [mode]: Object.fromEntries(Object.keys(overlays[mode] || {}).map(key => [key, false])) };
}
