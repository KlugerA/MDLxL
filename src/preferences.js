import { normalizePreviewLighting } from './preview-lighting.js';
import APPLICATION_THEMES from './application-themes.json' with { type: 'json' };
export { APPLICATION_THEMES };
import { DEFAULT_PAINT_APPEARANCE, normalizePaintAppearance } from './paint-appearance.js';
/** Shared, DOM-free preference validation and Hotkeys rules. */
import { normalizeWarmKeySequence, WARMKEY_LEADER } from './warmkey-defaults.js';
import { DEFAULT_CAPTURE, normalizeCapture } from './capture-settings.js';
import { DEFAULT_UV_PREVIEW_DISPLAY, normalizeUVPreviewDisplay } from './uv-preview-display.js';
import { DEFAULT_UV_GRID, normalizeUVGrid } from './uv-grid.js';
import { BUILT_IN_VIEWPORT_PRESETS, DEFAULT_VIEWPORT_APPEARANCE, DEFAULT_VIEWPORT_PRESET_ID, normalizeViewportAppearance, normalizeViewportPresets, viewportPresetById } from './viewport-appearance.js';
export const DEFAULT_VISUALS = Object.freeze({
  background: '#cccccc', vertex: '#167bff', selectedVertex: '#ff0000', occludedVertex: '#8cacd0',
  wireframe: '#eeeeee', occludedWireframe: '#67717f', selectedGeometry: '#ff9d36',
  gridMinor: '#808080', gridMajor: '#000000', axisX: '#ff0000', axisY: '#008000', axisZ: '#0000ff',
  keyframe: '#0000ff', activeKeyframe: '#ff0000', bone: '#4cff59', node: '#b2b2ff', particle: '#4cff59', event: '#ff9800', selection: '#67c9ff', uvSelection: '#ff3030',
  vertexSize: 6, keyframeSize: 10, lineWidth: 1, helperSize: 6, occludedOpacity: 1,
});
export const DEFAULT_GRID = Object.freeze({ spacing: 8, majorEvery: 8, extent: 256, followWorkplane: false, small: true,
  planes: Object.freeze({ xy: true, xz: false, yz: false }), axes: Object.freeze({ x: true, y: true, z: true }), opacity: 1, majorOpacity: 1 });
export const GRID_PRESETS = Object.freeze({
  classic: DEFAULT_GRID,
  fine: Object.freeze({ ...DEFAULT_GRID, spacing: 2, majorEvery: 8, extent: 128 }),
  world: Object.freeze({ ...DEFAULT_GRID, spacing: 32, majorEvery: 4, extent: 1024 }),
  xyz: Object.freeze({ ...DEFAULT_GRID, followWorkplane: false, planes: Object.freeze({ xy: true, xz: true, yz: true }) }),
});
export const CAMERA_PRESETS = Object.freeze({
  classic: Object.freeze({ cameraBindings: Object.freeze({ right: 'pan', middle: 'toggle' }), pointerSensitivity: 1, scrollSensitivity: 2, fineSensitivity: 0.2, wheelMode: 'rotate', rightScrollAdjust: true }),
  orbit: Object.freeze({ cameraBindings: Object.freeze({ right: 'rotate', middle: 'pan' }), pointerSensitivity: 1, scrollSensitivity: 1, fineSensitivity: 0.2, wheelMode: 'rotate', rightScrollAdjust: false }),
});
export const DEFAULT_PREFERENCES = Object.freeze({
  rendererRevision: 3,
  citadelPaint: DEFAULT_PAINT_APPEARANCE,
  uvPreviewDisplay: DEFAULT_UV_PREVIEW_DISPLAY,
  uvGrid: DEFAULT_UV_GRID,
  language: 'en', showPressedKeys: false, capture: DEFAULT_CAPTURE,
  scrollSensitivity: 2,
  wheelMode: 'rotate',
  pointerSensitivity: 1,
  rightScrollAdjust: true,
  highlightSelection: false,
  theme: 'light', accent: '#71b5f3', panelScale: 1, panelWidth: 164, newModelVersion: 800, uvRepeat: false, uvSensitivity: 1, fineSensitivity: 0.2,
  cameraBindings: CAMERA_PRESETS.classic.cameraBindings,
  visuals: DEFAULT_VISUALS, grid: DEFAULT_GRID,
  viewportPreset: DEFAULT_VIEWPORT_PRESET_ID, viewportAppearance: DEFAULT_VIEWPORT_APPEARANCE, viewportPresets: Object.freeze([]),
  graphics: Object.freeze({ pixelRatio: 1.5, antialias: false, maxFps: 60, textures: true, lighting: true, particles: true, pauseWhenHidden: true }),
  lighting: normalizePreviewLighting(), platform: Object.freeze({enabled:false,shape:"square",size:1.5,height:0,color:"#303030",textureUrl:""}),
  hotkeys: Object.freeze({}),
});

const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const record = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const boolean = (value, fallback) => typeof value === 'boolean' ? value : fallback;
const choice = (value, options, fallback) => options.includes(Number(value)) ? Number(value) : fallback;
const bounded = (value, min, max, fallback) => value !== null && value !== '' && Number.isFinite(Number(value)) ? Math.round(Math.max(min, Math.min(max, Number(value))) * 100) / 100 : fallback;
function legacyVisualOptions(preferences) {
  const input = record(preferences?.visuals), output = {};
  for (const [key, fallback] of Object.entries(DEFAULT_VISUALS)) if (typeof fallback === 'string') output[key] = /^#[0-9a-f]{6}$/i.test(input[key]) ? input[key].toLowerCase() : fallback;
  for (const [key, min, max] of [['vertexSize', 2, 16], ['keyframeSize', 4, 24], ['lineWidth', 0.5, 4], ['helperSize', 3, 18], ['occludedOpacity', 0, 1]]) output[key] = bounded(input[key], min, max, DEFAULT_VISUALS[key]);
  return output;
}
function appearanceFromLegacy(visual) {
  return normalizeViewportAppearance({
    selectedGeoset: { color: visual.wireframe, thickness: visual.lineWidth, opacity: 1, style: 'solid' },
    otherGeoset: { color: visual.occludedWireframe, thickness: visual.lineWidth, opacity: visual.occludedOpacity, style: 'solid' },
    selectedVertex: { color: visual.selectedVertex, size: visual.vertexSize, style: 'square' },
    unselectedVertex: { color: visual.vertex, size: visual.vertexSize, style: 'square' },
    background: { type: 'color', color: visual.background, display: 'fit', opacity: 0.7 },
  });
}
function customizedLegacyVisuals(value) {
  if (!value || typeof value !== 'object') return false;
  const normalized = legacyVisualOptions({ visuals: value });
  return Object.keys(DEFAULT_VISUALS).some(key => normalized[key] !== DEFAULT_VISUALS[key]);
}
export function viewportAppearanceOptions(preferences) {
  const fallback = !preferences?.viewportAppearance && customizedLegacyVisuals(preferences?.visuals) ? appearanceFromLegacy(legacyVisualOptions(preferences)) : DEFAULT_VIEWPORT_APPEARANCE;
  return normalizeViewportAppearance(preferences?.viewportAppearance, fallback);
}
export function visualOptions(preferences) {
  const legacy = legacyVisualOptions(preferences), appearance = viewportAppearanceOptions(preferences);
  return { ...legacy,
    background: appearance.background.color,
    vertex: appearance.unselectedVertex.color,
    selectedVertex: appearance.selectedVertex.color,
    wireframe: appearance.selectedGeoset.color,
    vertexSize: appearance.unselectedVertex.size,
    lineWidth: appearance.selectedGeoset.thickness,
  };
}
export function gridOptions(preferences) {
  const input = record(preferences?.grid), planes = record(input.planes), axes = record(input.axes);
  return { spacing: bounded(input.spacing, 0.1, 4096, DEFAULT_GRID.spacing), majorEvery: Math.round(bounded(input.majorEvery, 2, 32, DEFAULT_GRID.majorEvery)),
    extent: bounded(input.extent, 1, 16384, DEFAULT_GRID.extent), followWorkplane: false, small: boolean(input.small, true),
    planes: Object.fromEntries(Object.entries(DEFAULT_GRID.planes).map(([key, value]) => [key, boolean(planes[key], value)])),
    axes: Object.fromEntries(Object.keys(DEFAULT_GRID.axes).map(key => [key, boolean(axes[key], true)])),
    opacity: bounded(input.opacity, 0, 1, DEFAULT_GRID.opacity), majorOpacity: bounded(input.majorOpacity, 0, 1, DEFAULT_GRID.majorOpacity) };
}
export function cameraBindings(preferences) {
  const input = record(preferences?.cameraBindings);
  return { right: ['pan', 'rotate', 'zoom', 'none'].includes(input.right) ? input.right : 'pan', middle: ['toggle', 'pan', 'rotate', 'zoom', 'none'].includes(input.middle) ? input.middle : 'toggle' };
}
/** UV coordinates use an independent multiplier, captured once at gesture start. */
export function uvTransformSensitivity(preferences) { return bounded(preferences?.uvSensitivity, 0.01, 4, DEFAULT_PREFERENCES.uvSensitivity); }
// Nested resource, section, track, and vector identities remain intact when persisted.
export const MAX_WARMKEY_ID_LENGTH = 2048;
/** Adopt the requested follow-up raster/grid defaults once for older profiles.
 * Later explicit settings remain user-controlled; lighting is never migrated. */
export function migrateFollowupPreferences(value = {}) {
  const input = record(value);
  if (input.rendererRevision === 3) return input;
  const visuals = {...record(input.visuals)}, grid = {...record(input.grid)};
  if (input.rendererRevision !== 1) {
    if (visuals.gridMajor === '#404958') visuals.gridMajor = '#000000';
    if (grid.opacity === 0.65) grid.opacity = 1;
    if (grid.majorOpacity === 0.9) grid.majorOpacity = 1;
    grid.followWorkplane = false;
  }
  if (!visuals.keyframe || visuals.keyframe.toLowerCase() === '#ffb74d') visuals.keyframe = '#0000ff';
  if (!visuals.activeKeyframe || visuals.activeKeyframe.toLowerCase() === '#42c6ff') visuals.activeKeyframe = '#ff0000';
  // Revision 2 accidentally shipped MDLVis Vanilla nodes/helpers as orange.
  // Preserve genuinely customized colors while migrating that exact value.
  if (!visuals.node || visuals.node.toLowerCase() === '#e8c46a') visuals.node = '#b2b2ff';
  if (visuals.occludedOpacity == null || visuals.occludedOpacity === 0.35) visuals.occludedOpacity = 1;
  return {...input, rendererRevision:3, visuals, grid,
    ...(input.viewportPreset === 'mdlvis-vanilla' ? {viewportAppearance: BUILT_IN_VIEWPORT_PRESETS['mdlvis-vanilla'].appearance} : {}),
    ...(input.rendererRevision !== 1 && input.panelWidth === 178 ? {panelWidth:164} : {}),
    ...(input.rendererRevision !== 1 ? {graphics:{...record(input.graphics),antialias:false}} : {})};
}
export function normalizePreferences(value = {}) {
  const input = migrateFollowupPreferences(value), graphic = record(input.graphics), defaults = DEFAULT_PREFERENCES.graphics;
  const sensitivity = Number(input.scrollSensitivity);
  const pointer = Number(input.pointerSensitivity);
  const hotkeys = {};
  for (const [id, keys] of Object.entries(record(input.hotkeys))) {
    if (!id || id.length > MAX_WARMKEY_ID_LENGTH || ['__proto__', 'constructor', 'prototype'].includes(id) || !Array.isArray(keys)) continue;
    hotkeys[id] = [...new Set(keys.map(normalizeChord).filter(Boolean))].slice(0, 8);
  }
  const legacyVisuals = legacyVisualOptions(input), legacyCustomized = !input.viewportAppearance && customizedLegacyVisuals(input.visuals);
  const viewportPresets = normalizeViewportPresets(input.viewportPresets);
  const viewportAppearance = normalizeViewportAppearance(input.viewportAppearance, legacyCustomized ? appearanceFromLegacy(legacyVisuals) : DEFAULT_VIEWPORT_APPEARANCE);
  const requestedPreset = typeof input.viewportPreset === 'string' ? input.viewportPreset : '';
  const viewportPreset = requestedPreset === 'custom' || viewportPresetById(requestedPreset, viewportPresets) ? requestedPreset : legacyCustomized ? 'custom' : DEFAULT_VIEWPORT_PRESET_ID;
  return {
    rendererRevision: 3,
    uvPreviewDisplay: normalizeUVPreviewDisplay(input.uvPreviewDisplay),
    uvGrid: normalizeUVGrid(input.uvGrid),
    language: ['ru', 'es', 'zh', 'mordor'].includes(input.language) ? input.language : 'en', showPressedKeys: boolean(input.showPressedKeys, false), capture: normalizeCapture(input.capture),
    scrollSensitivity: Number.isFinite(sensitivity) && input.scrollSensitivity !== null ? Math.round(Math.min(10, Math.max(0.1, sensitivity)) * 100) / 100 : DEFAULT_PREFERENCES.scrollSensitivity,
    wheelMode: ['rotate', 'scroll', 'pointer'].includes(input.wheelMode) ? input.wheelMode : DEFAULT_PREFERENCES.wheelMode,
    pointerSensitivity: Number.isFinite(pointer) && input.pointerSensitivity !== null ? Math.round(Math.min(4, Math.max(0.01, pointer)) * 100) / 100 : DEFAULT_PREFERENCES.pointerSensitivity,
    highlightSelection: boolean(input.highlightSelection, false),
    theme: Object.hasOwn(APPLICATION_THEMES, input.theme) ? input.theme : 'light',
    accent: /^#[0-9a-f]{6}$/i.test(input.accent) ? input.accent.toLowerCase() : '#71b5f3',
    panelScale: bounded(input.panelScale, 1, 1.75, 1), panelWidth: bounded(input.panelWidth, 162, 420, 164),
    newModelVersion: input.newModelVersion === 1000 ? 1000 : 800, uvRepeat: boolean(input.uvRepeat, false),
    uvSensitivity: uvTransformSensitivity(input), fineSensitivity: bounded(input.fineSensitivity, 0.01, 1, DEFAULT_PREFERENCES.fineSensitivity),
    cameraBindings: cameraBindings(input), visuals: legacyVisuals, grid: gridOptions(input),
    viewportPreset, viewportAppearance, viewportPresets, citadelPaint: normalizePaintAppearance(input.citadelPaint),
    rightScrollAdjust: boolean(input.rightScrollAdjust, DEFAULT_PREFERENCES.rightScrollAdjust),
    graphics: {
      pixelRatio: choice(graphic.pixelRatio, [1, 1.5, 2], defaults.pixelRatio),
      antialias: boolean(graphic.antialias, defaults.antialias),
      maxFps: choice(graphic.maxFps, [30, 60, 120], defaults.maxFps),
      textures: boolean(graphic.textures, defaults.textures), lighting: boolean(graphic.lighting, defaults.lighting),
      particles: boolean(graphic.particles, defaults.particles), pauseWhenHidden: boolean(graphic.pauseWhenHidden, defaults.pauseWhenHidden),
    }, lighting: normalizePreviewLighting(input.lighting), platform: {enabled:input.platform?.enabled===true,shape:["square","disc","hexagon"].includes(input.platform?.shape)?input.platform.shape:"square",size:bounded(input.platform?.size,.1,10,1.5),height:bounded(input.platform?.height,-100000,100000,0),color:/^#[0-9a-f]{6}$/i.test(input.platform?.color)?input.platform.color:"#303030",textureUrl:typeof input.platform?.textureUrl==="string" && /^data:image\/(png|jpeg|webp);base64,/i.test(input.platform.textureUrl) && input.platform.textureUrl.length<3000000 ? input.platform.textureUrl:""}, hotkeys,
  };
}

const modifierAliases = { ctrl: 'Ctrl', control: 'Ctrl', alt: 'Alt', option: 'Alt', shift: 'Shift', meta: 'Meta', cmd: 'Meta', command: 'Meta', win: 'Meta', windows: 'Meta' };
const keyAliases = { ' ': 'Space', space: 'Space', spacebar: 'Space', esc: 'Escape', escape: 'Escape', del: 'Delete', delete: 'Delete', return: 'Enter', enter: 'Enter', backspace: 'Backspace', tab: 'Tab', left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown', arrowleft: 'ArrowLeft', arrowright: 'ArrowRight', arrowup: 'ArrowUp', arrowdown: 'ArrowDown', home: 'Home', end: 'End', pageup: 'PageUp', pagedown: 'PageDown', insert: 'Insert', '+': 'Plus', plus: 'Plus', minus: '-', comma: ',', period: '.', capslock: 'CapsLock', numlock: 'NumLock', scrolllock: 'ScrollLock', pause: 'Pause', printscreen: 'PrintScreen', contextmenu: 'ContextMenu' };
const modifiers = ['Ctrl', 'Alt', 'Shift', 'Meta'];
export function normalizeChord(value) {
  if (typeof value !== 'string' || value.length > 100) return '';
  if (value.includes('>')) return normalizeWarmKeySequence(value);
  const normalized = value === ' ' ? 'Space' : value.trim().replace(/\+\+$/, '+Plus');
  const parts = normalized === '+' ? ['Plus'] : normalized.split('+').map(part => part.trim());
  const held = new Set(); let key = '';
  for (const part of parts) {
    if (!part) return '';
    const lower = part.toLowerCase(), modifier = modifierAliases[lower];
    if (modifier) { held.add(modifier); continue; }
    if (key) return '';
    key = keyAliases[lower] || (/^f(?:[1-9]|1\d|2[0-4])$/i.test(part) ? part.toUpperCase() : part.length === 1 ? part.toUpperCase() : '');
    if (!key) return '';
  }
  return key ? [...modifiers.filter(modifier => held.has(modifier)), key].join('+') : '';
}
export function chordFromEvent(event) {
  if (!event || event.isComposing || event.keyCode === 229 || event.getModifierState?.('AltGraph')) return '';
  // Shortcuts describe physical letter/digit positions consistently across EN/RU layouts.
  const physical = /^Key[A-Z]$/.test(event.code || '') ? event.code.slice(3) : /^Digit[0-9]$/.test(event.code || '') ? event.code.slice(5) : event.key;
  const key = physical === '+' ? 'Plus' : physical === ' ' ? 'Space' : physical;
  if (typeof key !== 'string' || modifierAliases[key.toLowerCase()] || ['Dead', 'Unidentified', 'Process'].includes(key)) return '';
  return normalizeChord([event.ctrlKey && 'Ctrl', event.altKey && 'Alt', event.shiftKey && 'Shift', event.metaKey && 'Meta', key].filter(Boolean).join('+'));
}
export function formatChord(chord) { return normalizeChord(chord).replaceAll('Meta', 'Win').replaceAll('Arrow', '').replaceAll('Plus', '+'); }
export function effectiveBindings(catalog = [], overrides = {}) {
  const result = {};
  for (const action of catalog) {
    if (!action?.id) continue;
    const keys = own(overrides, action.id) ? overrides[action.id] : action.defaultKeys || action.keys || [];
    result[action.id] = [...new Set((Array.isArray(keys) ? keys : []).map(normalizeChord).filter(Boolean))];
  }
  for (const [id, keys] of Object.entries(record(overrides))) if (!own(result, id)) result[id] = [...new Set((Array.isArray(keys) ? keys : []).map(normalizeChord).filter(Boolean))];
  return result;
}
export function hotkeyConflicts(catalog, overrides, actionId, chord) {
  const key = normalizeChord(chord); if (!key) return [];
  // Keep assignments unique across scopes as well, so opening a dialog cannot silently change their meaning.
  return Object.entries(effectiveBindings(catalog, overrides)).filter(([id, keys]) => id !== actionId && keys.includes(key)).map(([id]) => id);
}
export function assignHotkey(overrides, catalog, actionId, chord, { replace = false } = {}) {
  const key = normalizeChord(chord), hotkeys = { ...record(overrides) };
  if (key === WARMKEY_LEADER) return { ok: false, hotkeys, conflicts: [], error: 'Ctrl+Alt+Space starts a Hotkeys sequence. Follow it with a three-character code, or choose another shortcut.' };
  if (!key || !actionId) return { ok: false, hotkeys, conflicts: [], error: 'Press a key, optionally with Ctrl, Alt, Shift, or Win.' };
  const bindings = effectiveBindings(catalog, hotkeys), conflicts = hotkeyConflicts(catalog, hotkeys, actionId, key);
  if (conflicts.length && !replace) return { ok: false, hotkeys, conflicts, error: 'This shortcut is already assigned.' };
  for (const id of conflicts) hotkeys[id] = (bindings[id] || []).filter(value => value !== key);
  hotkeys[actionId] = [...new Set([...(bindings[actionId] || []), key])];
  return { ok: true, hotkeys, conflicts: [] };
}
export function isTextEditingTarget(target) {
  if (!target) return false;
  if (target.isContentEditable || target.closest?.('[contenteditable="true"], [role="textbox"], [data-warmkey-recording]')) return true;
  const tag = String(target.tagName || '').toLowerCase();
  if (tag === 'input') return !['checkbox', 'radio', 'button', 'submit', 'reset', 'image'].includes(String(target.type || 'text').toLowerCase());
  return ['textarea', 'select'].includes(tag);
}
function isNativeControlKey(event, chord) {
  const target = event.target;
  const tag = String(target?.tagName || '').toLowerCase(), type = String(target?.type || '').toLowerCase();
  const inputControl = tag === 'input' && ['checkbox', 'radio', 'button', 'submit', 'reset', 'image'].includes(type);
  const buttonControl = tag === 'button' || !!target?.closest?.('button, [role="button"]');
  if ((inputControl || buttonControl) && ['Space', 'Enter'].includes(chord)) return true;
  return tag === 'input' && type === 'radio' && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(chord);
}
export function canHandleHotkeyEvent(event, action = {}) {
  const chord = chordFromEvent(event);
  if (!chord || event.defaultPrevented || event.repeat && !action.repeat) return false;
  // A focused toggle remains shortcut-addressable, while its native activation/navigation keys keep their usual meaning.
  if (isNativeControlKey(event, chord)) return false;
  if (isTextEditingTarget(event.target) && !action.allowInInput) return false;
  return action.enabled !== false && (typeof action.enabled !== 'function' || action.enabled());
}
export const GRAPHICS_PRESETS = Object.freeze({
  fast: Object.freeze({ pixelRatio: 1, antialias: false, maxFps: 30, textures: false, lighting: false, particles: false, pauseWhenHidden: true }),
  balanced: DEFAULT_PREFERENCES.graphics,
  quality: Object.freeze({ pixelRatio: 2, antialias: true, maxFps: 60, textures: true, lighting: true, particles: true, pauseWhenHidden: true }),
});
