const color = (value, fallback) => /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : fallback;
const number = (value, min, max, fallback) => value !== null && value !== '' && Number.isFinite(Number(value))
  ? Math.round(Math.max(min, Math.min(max, Number(value))) * 100) / 100 : fallback;
const choice = (value, choices, fallback) => choices.includes(value) ? value : fallback;
const record = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};

const profile = value => Object.freeze({
  selectedGeoset: Object.freeze({ ...value.selectedGeoset }),
  otherGeoset: Object.freeze({ ...value.otherGeoset }),
  selectedVertex: Object.freeze({ ...value.selectedVertex }),
  unselectedVertex: Object.freeze({ ...value.unselectedVertex }),
  background: Object.freeze({ ...value.background }),
  xrayVertices: value.xrayVertices === true,
});

// The Vanilla colors are sampled from the supplied MDLVis reference: its
// viewport is #cccccc, its clean vertex markers are #0000ff and the primary
// active wire is the screenshot's pale #e5ffe5.
export const BUILT_IN_VIEWPORT_PRESETS = Object.freeze({
  'mdlvis-vanilla': Object.freeze({ id: 'mdlvis-vanilla', name: 'Lordaeron', theme: 'light', appearance: profile({
    selectedGeoset: { color: '#ffffff', thickness: 1, opacity: 1, style: 'solid', spacing: 3 },
    otherGeoset: { color: '#e5ffe5', thickness: 1, opacity: 1, style: 'solid', spacing: 3 },
    selectedVertex: { color: '#ff0000', size: 6, style: 'square' },
    unselectedVertex: { color: '#0000ff', size: 6, style: 'square' },
    background: { type: 'color', color: '#cccccc', imageData: '', imageName: '', display: 'fit', opacity: 0.7 },
    xrayVertices: false,
  }) }),
  'blender-style': Object.freeze({ id: 'blender-style', name: 'Blackrock', theme: 'dark', appearance: profile({
    selectedGeoset: { color: '#ff8a00', thickness: 1.5, opacity: 1, style: 'solid', spacing: 3 },
    otherGeoset: { color: '#707070', thickness: 1, opacity: 0.72, style: 'solid', spacing: 3 },
    selectedVertex: { color: '#ff8a00', size: 5, style: 'circle' },
    unselectedVertex: { color: '#a8a8a8', size: 4, style: 'circle' },
    background: { type: 'color', color: '#181818', imageData: '', imageName: '', display: 'fit', opacity: 0.7 },
    xrayVertices: false,
  }) }),
  'warm-graphite': Object.freeze({ id: 'warm-graphite', name: 'Ironforge', theme: 'warm-dark', appearance: profile({
    selectedGeoset: { color: '#e6bd86', thickness: 1.5, opacity: 1, style: 'solid', spacing: 3 },
    otherGeoset: { color: '#a89f91', thickness: 1, opacity: 1, style: 'solid', spacing: 3 },
    selectedVertex: { color: '#e6bd86', size: 6, style: 'square' },
    unselectedVertex: { color: '#eee8df', size: 4, style: 'square' },
    background: { type: 'color', color: '#262421', imageData: '', imageName: '', display: 'fit', opacity: 0.7 },
    xrayVertices: false,
  }) }),
  'nord': Object.freeze({ id: 'nord', name: 'Northrend', theme: 'nord', appearance: profile({
    selectedGeoset: { color: '#88c0d0', thickness: 1.5, opacity: 1, style: 'solid', spacing: 3 },
    otherGeoset: { color: '#81a1c1', thickness: 1, opacity: 1, style: 'solid', spacing: 3 },
    selectedVertex: { color: '#88c0d0', size: 6, style: 'square' },
    unselectedVertex: { color: '#d8dee9', size: 4, style: 'square' },
    background: { type: 'color', color: '#2e3440', imageData: '', imageName: '', display: 'fit', opacity: 0.7 },
    xrayVertices: false,
  }) }),
  'solarized-light': Object.freeze({ id: 'solarized-light', name: 'Silvermoon', theme: 'solarized-light', appearance: profile({
    selectedGeoset: { color: '#b34c1b', thickness: 1.5, opacity: 1, style: 'solid', spacing: 3 },
    otherGeoset: { color: '#657b83', thickness: 1, opacity: 1, style: 'solid', spacing: 3 },
    selectedVertex: { color: '#b34c1b', size: 6, style: 'square' },
    unselectedVertex: { color: '#586e75', size: 4, style: 'square' },
    background: { type: 'color', color: '#fdf6e3', imageData: '', imageName: '', display: 'fit', opacity: 0.7 },
    xrayVertices: false,
  }) }),
  'gruvbox-dark': Object.freeze({ id: 'gruvbox-dark', name: 'Durotar', theme: 'gruvbox-dark', appearance: profile({
    selectedGeoset: { color: '#fabd2f', thickness: 1.5, opacity: 1, style: 'solid', spacing: 3 },
    otherGeoset: { color: '#a89984', thickness: 1, opacity: 1, style: 'solid', spacing: 3 },
    selectedVertex: { color: '#fabd2f', size: 6, style: 'square' },
    unselectedVertex: { color: '#b8bb26', size: 4, style: 'square' },
    background: { type: 'color', color: '#282828', imageData: '', imageName: '', display: 'fit', opacity: 0.7 },
    xrayVertices: false,
  }) }),
  'catppuccin-mocha': Object.freeze({ id: 'catppuccin-mocha', name: 'Dalaran', theme: 'catppuccin-mocha', appearance: profile({
    selectedGeoset: { color: '#cba6f7', thickness: 1.5, opacity: 1, style: 'solid', spacing: 3 },
    otherGeoset: { color: '#7f849c', thickness: 1, opacity: 1, style: 'solid', spacing: 3 },
    selectedVertex: { color: '#cba6f7', size: 6, style: 'square' },
    unselectedVertex: { color: '#89b4fa', size: 4, style: 'square' },
    background: { type: 'color', color: '#1e1e2e', imageData: '', imageName: '', display: 'fit', opacity: 0.7 },
    xrayVertices: false,
  }) }),
});

export const DEFAULT_VIEWPORT_PRESET_ID = 'mdlvis-vanilla';
export const DEFAULT_VIEWPORT_APPEARANCE = BUILT_IN_VIEWPORT_PRESETS[DEFAULT_VIEWPORT_PRESET_ID].appearance;
export const VIEWPORT_WIRE_STYLES = Object.freeze(['solid', 'dashed', 'dotted']);
export const VIEWPORT_VERTEX_STYLES = Object.freeze(['square', 'circle', 'diamond']);
export const VIEWPORT_BACKGROUND_DISPLAYS = Object.freeze(['fit', 'fill', 'stretch', 'center']);
export const MAX_VIEWPORT_PRESETS = 24;
export const MAX_VIEWPORT_BACKGROUND_DATA_LENGTH = 12_000_000;

function normalizeWire(value, fallback) {
  const input = record(value);
  return {
    color: color(input.color, fallback.color),
    thickness: number(input.thickness, 0.5, 4, fallback.thickness),
    opacity: number(input.opacity, 0, 1, fallback.opacity),
    style: choice(input.style, VIEWPORT_WIRE_STYLES, fallback.style),
    spacing: number(input.spacing, 2, 32, fallback.spacing ?? 3),
  };
}

function normalizeVertex(value, fallback) {
  const input = record(value);
  return {
    color: color(input.color, fallback.color),
    size: number(input.size, 2, 16, fallback.size),
    style: choice(input.style, VIEWPORT_VERTEX_STYLES, fallback.style),
  };
}

function normalizeBackground(value, fallback) {
  const input = record(value);
  const imageData = typeof input.imageData === 'string' && input.imageData.length <= MAX_VIEWPORT_BACKGROUND_DATA_LENGTH && /^data:image\/(?:png|jpeg|webp);base64,/i.test(input.imageData) ? input.imageData : '';
  return {
    type: input.type === 'image' && imageData ? 'image' : 'color',
    color: color(input.color, fallback.color),
    imageData,
    imageName: typeof input.imageName === 'string' ? input.imageName.replace(/[\u0000-\u001f]/g, '').slice(0, 260) : '',
    display: choice(input.display, VIEWPORT_BACKGROUND_DISPLAYS, fallback.display),
    opacity: number(input.opacity, 0, 1, fallback.opacity),
  };
}

export function normalizeViewportAppearance(value, fallback = DEFAULT_VIEWPORT_APPEARANCE) {
  const input = record(value), base = record(fallback);
  return {
    selectedGeoset: normalizeWire(input.selectedGeoset, base.selectedGeoset || DEFAULT_VIEWPORT_APPEARANCE.selectedGeoset),
    otherGeoset: normalizeWire(input.otherGeoset, base.otherGeoset || DEFAULT_VIEWPORT_APPEARANCE.otherGeoset),
    selectedVertex: normalizeVertex(input.selectedVertex, base.selectedVertex || DEFAULT_VIEWPORT_APPEARANCE.selectedVertex),
    unselectedVertex: normalizeVertex(input.unselectedVertex, base.unselectedVertex || DEFAULT_VIEWPORT_APPEARANCE.unselectedVertex),
    background: normalizeBackground(input.background, base.background || DEFAULT_VIEWPORT_APPEARANCE.background),
    xrayVertices: typeof input.xrayVertices === 'boolean' ? input.xrayVertices : base.xrayVertices === true,
  };
}

export function normalizeViewportPresets(value) {
  if (!Array.isArray(value)) return [];
  const ids = new Set(), names = new Set(), output = [];
  for (const item of value) {
    if (output.length >= MAX_VIEWPORT_PRESETS || !item || typeof item !== 'object') break;
    const id = typeof item.id === 'string' && /^custom-[a-z0-9_-]{1,80}$/i.test(item.id) ? item.id : '';
    const name = typeof item.name === 'string' ? item.name.trim().replace(/[\u0000-\u001f]/g, '').slice(0, 80) : '';
    if (!id || !name || ids.has(id) || names.has(name.toLowerCase())) continue;
    ids.add(id); names.add(name.toLowerCase());
    output.push({ id, name, appearance: normalizeViewportAppearance(item.appearance) });
  }
  return output;
}

export function viewportPresetById(id, customPresets = []) {
  return BUILT_IN_VIEWPORT_PRESETS[id] || customPresets.find(preset => preset.id === id) || null;
}

export function backgroundImageRect(imageWidth, imageHeight, width, height, display = 'fit') {
  if (![imageWidth, imageHeight, width, height].every(value => Number.isFinite(value) && value > 0)) return null;
  if (display === 'stretch') return { x: 0, y: 0, width, height };
  if (display === 'center') return { x: (width - imageWidth) / 2, y: (height - imageHeight) / 2, width: imageWidth, height: imageHeight };
  const scale = display === 'fill' ? Math.max(width / imageWidth, height / imageHeight) : Math.min(width / imageWidth, height / imageHeight);
  const drawnWidth = imageWidth * scale, drawnHeight = imageHeight * scale;
  return { x: (width - drawnWidth) / 2, y: (height - drawnHeight) / 2, width: drawnWidth, height: drawnHeight };
}
