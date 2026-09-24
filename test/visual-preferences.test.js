import test from 'node:test';
import assert from 'node:assert/strict';
import { CAMERA_PRESETS, DEFAULT_PREFERENCES, DEFAULT_VISUALS, GRID_PRESETS, cameraBindings, gridOptions, normalizePreferences, uvTransformSensitivity, visualOptions } from '../src/preferences.js';
import { applyApplicationTheme } from '../app/theme.js';
import { pointerDragPoint } from '../app/viewport-performance.js';
import { backgroundImageRect, BUILT_IN_VIEWPORT_PRESETS, DEFAULT_VIEWPORT_PRESET_ID } from '../src/viewport-appearance.js';
import { wireDashArray } from '../src/wire-pattern.js';

test('MDLVis Vanilla is the default and uses colors sampled from the supplied reference', () => {
  const prefs = normalizePreferences();
  assert.equal(prefs.viewportPreset, DEFAULT_VIEWPORT_PRESET_ID);
  assert.equal(prefs.viewportAppearance.background.color, '#cccccc');
  assert.equal(prefs.viewportAppearance.selectedGeoset.color, '#ffffff');
  assert.equal(prefs.viewportAppearance.otherGeoset.color, '#e5ffe5');
  assert.equal(prefs.viewportAppearance.selectedGeoset.thickness, 1);
  assert.equal(prefs.viewportAppearance.selectedGeoset.spacing, 3);
  assert.equal(prefs.viewportAppearance.otherGeoset.opacity, 1);
  assert.equal(prefs.viewportAppearance.otherGeoset.spacing, 3);
  assert.equal(prefs.viewportAppearance.unselectedVertex.color, '#0000ff');
  assert.equal(prefs.viewportAppearance.selectedVertex.color, '#ff0000');
  assert.equal(prefs.viewportAppearance.unselectedVertex.size, 6);
  assert.equal(prefs.visuals.keyframe, '#0000ff');
  assert.equal(prefs.visuals.activeKeyframe, '#ff0000');
  assert.equal(prefs.visuals.node, '#b2b2ff');
  assert.equal(prefs.visuals.particle, '#4cff59');
  assert.equal(prefs.visuals.event, '#ff9800');
  assert.equal(prefs.visuals.uvSelection, '#ff3030');
  assert.equal(prefs.visuals.occludedOpacity, 1);
  assert.equal(prefs.viewportAppearance.xrayVertices, false);
  assert.ok(BUILT_IN_VIEWPORT_PRESETS['blender-style']);
});

test('the approved Vanilla revision migrates an existing built-in profile to the new canonical values', () => {
  const prefs = normalizePreferences({ rendererRevision: 1, viewportPreset: 'mdlvis-vanilla', viewportAppearance: {
    selectedGeoset: { color: '#e5ffe5', thickness: 1, opacity: 1, style: 'solid' }, otherGeoset: { color: '#aebcba', thickness: .75, opacity: .48, style: 'solid' },
    selectedVertex: { color: '#ff0000', size: 5, style: 'square' }, unselectedVertex: { color: '#0000ff', size: 5, style: 'square' }, background: { type: 'color', color: '#cccccc' }
  }, visuals: { keyframe: '#ffb74d', activeKeyframe: '#42c6ff', occludedOpacity: .35 } });
  assert.equal(prefs.rendererRevision, 3);
  assert.deepEqual(prefs.viewportAppearance, BUILT_IN_VIEWPORT_PRESETS['mdlvis-vanilla'].appearance);
  assert.equal(prefs.visuals.keyframe, '#0000ff'); assert.equal(prefs.visuals.activeKeyframe, '#ff0000'); assert.equal(prefs.visuals.occludedOpacity, 1);
});

test('revision 2 orange node regression migrates to MDLVis light blue without overwriting custom colors', () => {
  assert.equal(normalizePreferences({ rendererRevision: 2, visuals: { node: '#e8c46a' } }).visuals.node, '#b2b2ff');
  assert.equal(normalizePreferences({ rendererRevision: 2, visuals: { node: '#123456' } }).visuals.node, '#123456');
});

test('custom viewport presets and image presentation survive preference round trips', () => {
  const imageData = 'data:image/png;base64,AA==';
  const appearance = { ...BUILT_IN_VIEWPORT_PRESETS['blender-style'].appearance,
    selectedGeoset: { color: '#123456', thickness: 2.25, opacity: .7, style: 'dashed', spacing: 13 },
    otherGeoset: { color: '#654321', thickness: 1.5, opacity: .5, style: 'dotted', spacing: 9 },
    selectedVertex: { color: '#abcdef', size: 9, style: 'diamond' },
    background: { type: 'image', color: '#202122', imageData, imageName: 'reference.png', display: 'center', opacity: .35 }, xrayVertices: true };
  const source = normalizePreferences({ viewportPreset: 'custom-theme', viewportAppearance: appearance, viewportPresets: [{ id: 'custom-theme', name: 'My Theme', appearance }] });
  const restored = normalizePreferences(JSON.parse(JSON.stringify(source)));
  assert.deepEqual(restored.viewportAppearance, source.viewportAppearance);
  assert.deepEqual(restored.viewportPresets, source.viewportPresets);
  assert.equal(restored.viewportPreset, 'custom-theme');
  assert.equal(restored.viewportAppearance.background.imageData, imageData);
  assert.equal(restored.viewportAppearance.selectedGeoset.spacing, 13);
  assert.equal(restored.viewportAppearance.otherGeoset.spacing, 9);
});

test('wire spacing is bounded and produces predictable preview patterns', () => {
  assert.deepEqual(wireDashArray({ style: 'solid', spacing: 8, thickness: 1 }), []);
  assert.deepEqual(wireDashArray({ style: 'dotted', spacing: 6, thickness: 2 }), [2, 6]);
  assert.deepEqual(wireDashArray({ style: 'dashed', spacing: 7, thickness: 1 }), [14, 7]);
  const prefs = normalizePreferences({ viewportPreset: 'custom', viewportAppearance: { selectedGeoset: { spacing: 900 } } });
  assert.equal(prefs.viewportAppearance.selectedGeoset.spacing, 32);
  const independent = normalizePreferences({ viewportPreset: 'custom', viewportAppearance: { selectedGeoset: { spacing: 4 }, otherGeoset: { spacing: 11 } } });
  assert.equal(independent.viewportAppearance.selectedGeoset.spacing, 4);
  assert.equal(independent.viewportAppearance.otherGeoset.spacing, 11);
});

test('background image display modes calculate fit, fill, stretch and actual-size rectangles', () => {
  assert.deepEqual(backgroundImageRect(200, 100, 100, 100, 'fit'), { x: 0, y: 25, width: 100, height: 50 });
  assert.deepEqual(backgroundImageRect(200, 100, 100, 100, 'fill'), { x: -50, y: 0, width: 200, height: 100 });
  assert.deepEqual(backgroundImageRect(200, 100, 100, 100, 'stretch'), { x: 0, y: 0, width: 100, height: 100 });
  assert.deepEqual(backgroundImageRect(200, 100, 100, 100, 'center'), { x: -50, y: 0, width: 200, height: 100 });
});

test('older preference profiles gain independent visual and camera defaults', () => {
  const prefs = normalizePreferences({ pointerSensitivity: 3.5, graphics: { textures: false }, hotkeys: { selectAll: ['Ctrl+A'] } });
  assert.equal(prefs.theme, 'light');
  assert.equal(prefs.uvSensitivity, 1);
  assert.equal(prefs.pointerSensitivity, 3.5);
  assert.equal(prefs.graphics.textures, false);
  assert.deepEqual(prefs.hotkeys.selectAll, ['Ctrl+A']);
  assert.deepEqual(prefs.visuals, DEFAULT_VISUALS);
  assert.deepEqual(prefs.cameraBindings, { right: 'pan', middle: 'toggle' });
});

test('appearance, grid planes, sizes and UV sensitivity survive the existing profile round trip', () => {
  const source = normalizePreferences({ theme: 'dark', uvSensitivity: 0.35, fineSensitivity: 0.08,
    cameraBindings: { right: 'zoom', middle: 'rotate' },
    grid: { spacing: 3.5, extent: 700, majorEvery: 5, opacity: 0, followWorkplane: false, planes: { xy: false, xz: true, yz: true }, axes: { x: false, y: true, z: false } },
    visuals: { background: '#273342', keyframe: '#abcdEF', activeKeyframe: '#019933', keyframeSize: 17, vertexSize: 9, occludedOpacity: 0 } });
  const restored = normalizePreferences(JSON.parse(JSON.stringify(source)));
  assert.deepEqual(restored, source);
  assert.equal(restored.visuals.keyframe, '#abcdef');
  assert.equal(restored.grid.opacity, 0);
  assert.equal(restored.visuals.occludedOpacity, 0);
  assert.equal(restored.grid.planes.xy, false);
  assert.equal(restored.grid.axes.z, false);
});

test('invalid visual/profile input is bounded without accepting CSS or corrupting defaults', () => {
  const input = normalizePreferences({ theme: 'unknown', uvSensitivity: null, fineSensitivity: 'bad',
    cameraBindings: { right: 'toggle', middle: 'javascript' },
    grid: { spacing: -12, majorEvery: Infinity, extent: 999999, opacity: 99, planes: { xy: 'false' } },
    visuals: { background: 'url(https://invalid.test)', vertex: '#abc', vertexSize: -8, keyframeSize: 9999, lineWidth: null } });
  assert.equal(input.theme, 'light');
  assert.equal(input.uvSensitivity, 1);
  assert.equal(input.fineSensitivity, 0.2);
  assert.deepEqual(cameraBindings(input), DEFAULT_PREFERENCES.cameraBindings);
  assert.equal(input.grid.spacing, 0.1);
  assert.equal(input.grid.extent, 16384);
  assert.equal(input.grid.majorEvery, 8);
  assert.equal(input.grid.opacity, 1);
  assert.equal(input.grid.planes.xy, true);
  assert.equal(input.visuals.background, DEFAULT_VISUALS.background);
  assert.equal(input.visuals.vertexSize, 2);
  assert.equal(input.visuals.keyframeSize, 24);
  assert.equal(input.visuals.lineWidth, 1);
  input.grid.axes.x = false;
  input.visuals.vertex = '#000000';
  assert.equal(gridOptions().axes.x, true);
  assert.equal(visualOptions().vertex, BUILT_IN_VIEWPORT_PRESETS['mdlvis-vanilla'].appearance.unselectedVertex.color);
});

test('camera presets only change navigation, retaining independently chosen UV and colors', () => {
  const base = normalizePreferences({ uvSensitivity: 0.4, visuals: { vertex: '#112233' }, theme: 'dark' });
  const orbit = normalizePreferences({ ...base, ...CAMERA_PRESETS.orbit });
  assert.deepEqual(orbit.cameraBindings, { right: 'rotate', middle: 'pan' });
  assert.equal(orbit.uvSensitivity, 0.4);
  assert.equal(orbit.visuals.vertex, '#112233');
  assert.equal(orbit.theme, 'dark');
  assert.equal(normalizePreferences({ ...orbit, ...CAMERA_PRESETS.classic }).cameraBindings.middle, 'toggle');
  assert.deepEqual(gridOptions({ grid: GRID_PRESETS.xyz }).planes, { xy: true, xz: true, yz: true });
});

test('camera DPI changes never change UV displacement, and texture-relative movement stays proportional', () => {
  const origin = { x: 100, y: 60 }, pointer = { x: 140, y: 80 };
  const uvDisplacement = (prefs, displayedTextureSize) => {
    const end = pointerDragPoint(origin, pointer, uvTransformSensitivity(prefs));
    return [(end.x - origin.x) / displayedTextureSize, (end.y - origin.y) / displayedTextureSize];
  };
  for (const pointerSensitivity of [0.01, 0.5, 1, 2, 4]) {
    assert.deepEqual(uvDisplacement(normalizePreferences({ pointerSensitivity }), 200), [0.2, 0.1]);
    assert.deepEqual(uvDisplacement(normalizePreferences({ pointerSensitivity, uvSensitivity: 0.25 }), 200), [0.05, 0.025]);
  }
  assert.deepEqual(uvDisplacement(normalizePreferences(), 400), [0.1, 0.05]);
});

test('theme applies to each owning document and leaves viewport background unchanged on theme toggles', () => {
  function documentMock() {
    const variables = new Map();
    return { documentElement: { dataset: {}, style: { setProperty: (key, value) => variables.set(key, value) } }, variables };
  }
  const main = documentMock(), uv = documentMock();
  const prefs = normalizePreferences({ theme: 'dark', visuals: { background: '#808a90', keyframeSize: 14 } });
  for (const target of [main, uv]) {
    applyApplicationTheme(prefs, target);
    assert.equal(target.documentElement.dataset.theme, 'dark');
    assert.equal(target.variables.get('--visual-background'), '#808a90');
    assert.equal(target.variables.get('--visual-keyframe-size'), '14px');
    assert.equal(target.variables.get('--visual-active-keyframe'), DEFAULT_VISUALS.activeKeyframe);
    applyApplicationTheme({ ...prefs, theme: 'light' }, target);
    assert.equal(target.documentElement.dataset.theme, 'light');
    assert.equal(target.variables.get('--visual-background'), '#808a90');
  }
});

test('geoset highlight is opt-in and keeps at least one hover source', () => {
  const fresh = normalizePreferences();
  assert.equal(fresh.highlightSelection, false);
  assert.deepEqual(fresh.viewportAppearance.geosetHighlight, { color: '#39ff14', type: 'wire-vertices', viaView: true, viaSelection: true });
  const selected = normalizePreferences({ highlightSelection: true, viewportAppearance: { geosetHighlight: { color: '#bada55', type: 'fill', viaView: false, viaSelection: true } } });
  assert.equal(selected.highlightSelection, true);
  assert.deepEqual(selected.viewportAppearance.geosetHighlight, { color: '#bada55', type: 'fill', viaView: false, viaSelection: true });
  assert.deepEqual(normalizePreferences({ viewportAppearance: { geosetHighlight: { viaView: false, viaSelection: false } } }).viewportAppearance.geosetHighlight,
    { color: '#39ff14', type: 'wire-vertices', viaView: true, viaSelection: false });
});
