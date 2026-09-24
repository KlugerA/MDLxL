const EMPTY_MAP = Object.freeze({}), EMPTY_IDS = Object.freeze([]), EMPTY_PREFERENCES = Object.freeze({});
const CLEAN_DISPLAY = Object.freeze(Object.fromEntries(['bones', 'nodes', 'attachments', 'particles', 'emitters', 'boneLines', 'wires', 'vertices', 'grid', 'axes', 'normals', 'cameras'].map(key => [key, false])));
const preferenceCache = new WeakMap();

/** Preview presentation is readonly and independent of the editing display.
 * Keep the model, animation clock, authored alpha and camera unchanged. */
export function previewPresentationProps(props) {
  if (props.presentation !== 'preview') return props;
  const original = props.preferences || EMPTY_PREFERENCES;
  if (!preferenceCache.has(original)) preferenceCache.set(original, { ...original, graphics: { ...original.graphics, textures: true }, platform: { ...original.platform, enabled: false } });
  const interactive = props.interactivePreview === true;
  const neutralBackground = !props.backgroundUrl;
  const previewMode = ['wireframe','solid','textured'].includes(props.previewMode) ? props.previewMode : 'textured';
  const vertices = props.overlays?.vertices ?? !!props.showVertices;
  const wires = previewMode === 'wireframe' || !!props.overlays?.wires;
  const grid = neutralBackground && (props.overlays?.grid ?? props.showGrid ?? true);
  const display = { ...CLEAN_DISPLAY, ...(props.overlays || {}), wires, vertices, grid, axes: neutralBackground };
  return {
    ...props, preferences: preferenceCache.get(original), mode: previewMode, shaded: true, rgbPreview: false, restPose: props.restPose ?? false,
    overlays: display, showGrid: grid, showAxes: neutralBackground,
    showNodes: display.nodes, showSkeleton: display.bones || display.nodes || display.attachments || display.particles,
    showVertices: vertices, showNormals: display.normals, showCameras: display.cameras,
    selectionByGeoset: interactive ? props.selectionByGeoset || EMPTY_MAP : EMPTY_MAP, selectedVertices: EMPTY_IDS, selectedNodeIds: EMPTY_IDS, selectableGeosets: props.selectableGeosets || EMPTY_IDS,
    hiddenGeosets: props.uvOnlySelected === true ? props.hiddenGeosets : undefined, hiddenVertices: undefined, hoveredGeoset: interactive ? props.hoveredGeoset ?? null : null,
    onNodeTransform: undefined, onVertexTransform: undefined, onTransform: undefined, onSelectNodes: undefined, onSelectionChange: interactive ? props.onSelectionChange : undefined, onSelectVertices: undefined, onSelectGeoset: undefined, onInspectGeoset: undefined,
  };
}

export function previewOverlaySettings(value) {
  return {
    mode: value?.highlightSelection ? 'selection' : value?.allMesh ? 'all' : 'none',
    interactiveSelection: value?.interactiveSelection === true,
    size: Math.max(.25, Math.min(3, Number.isFinite(Number(value?.size)) ? Number(value.size) : 1)),
    eligibleByGeoset: value?.eligibleByGeoset || EMPTY_MAP,
    selectionByGeoset: value?.selectionByGeoset || EMPTY_MAP,
    color: /^#[0-9a-f]{6}$/i.test(value?.color) ? value.color : '#ff3030',
  };
}

const validIds = (ids, count) => new Set(Array.from(ids || []).filter(id => Number.isInteger(id) && id >= 0 && id < count));

/** Pure topology selection, shared by both renderers. No triangle expansion:
 * an incident edge needs one selected endpoint and two eligible endpoints. */
export function previewOverlayGeometry(geosets, value) {
  const options = previewOverlaySettings(value);
  if (options.mode === 'none') return [];
  return geosets.flatMap(geo => {
    const count = geo.vertices.length / 3, eligible = validIds(options.eligibleByGeoset[geo.index], count);
    const selected = new Set([...validIds(options.selectionByGeoset[geo.index], count)].filter(id => eligible.has(id)));
    const points = options.mode === 'selection' ? [...selected] : [...eligible];
    if (!points.length) return [];
    const seen = new Set(), edges = [];
    for (let i = 0; i + 2 < geo.faces.length; i += 3) for (let j = 0; j < 3; j++) {
      const a = geo.faces[i + j], b = geo.faces[i + (j + 1) % 3];
      if (a === b || !eligible.has(a) || !eligible.has(b) || options.mode === 'selection' && !selected.has(a) && !selected.has(b)) continue;
      const key = Math.min(a, b) + ':' + Math.max(a, b);
      if (!seen.has(key)) { seen.add(key); edges.push([a, b]); }
    }
    return [{ ...geo, pointIndices: points, edges }];
  });
}
