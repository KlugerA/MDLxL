import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePreferences } from '../src/preferences.js';
import { coincidentUVSelection, DEFAULT_UV_GRID, normalizeUVGrid, snapUVCoordinates, UV_GRID_SPACING_MIN, uvGridSpacingFromSlider, uvGridSpacingSliderValue, visibleUVGridLines } from '../src/uv-grid.js';

const closeTo = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} should equal ${expected}`);

test('UV grid preferences are bounded, canonical and persist with editor preferences', () => {
  assert.deepEqual(normalizeUVGrid(), DEFAULT_UV_GRID);
  const preferences = normalizePreferences({ uvGrid: { enabled: true, snap: true, spacing: 0.01, thickness: 2.5, color: '#AbCdEf', opacity: 0.6 } });
  assert.deepEqual(preferences.uvGrid, { enabled: true, snap: true, spacing: 0.01, thickness: 2.5, color: '#abcdef', opacity: 0.6 });
  assert.deepEqual(normalizeUVGrid({ spacing: 0, thickness: 99, color: 'red', opacity: -4 }), { ...DEFAULT_UV_GRID, spacing: UV_GRID_SPACING_MIN, thickness: 6, opacity: 0 });
  assert.equal(normalizeUVGrid({ spacing: 99 }).spacing, 0.02);
});

test('UV grid size slider is logarithmic and stays within 0.003 to 0.020', () => {
  closeTo(uvGridSpacingSliderValue(UV_GRID_SPACING_MIN), Math.log10(0.003));
  closeTo(uvGridSpacingFromSlider(-4), 0.003);
  closeTo(uvGridSpacingFromSlider(-1), 0.02);
  assert.ok(uvGridSpacingFromSlider(-2.01) > 0.0097 && uvGridSpacingFromSlider(-2.01) < 0.0098, 'one slider step changes spacing by only about two percent');
});

test('UV grid lines stay anchored to the global UV origin', () => {
  assert.deepEqual(visibleUVGridLines(-0.006, 0.016, 0.005), [-0.005, 0, 0.005, 0.01, 0.015]);
  assert.deepEqual(visibleUVGridLines(-100, 100, 0.003, 100), [], 'an unreadably dense grid is not drawn');
});

test('snap to grid rounds one dragged vertex to an intersection', () => {
  const values = new Float32Array([0.024, 0.026, 0.63, 0.61]);
  const snapped = snapUVCoordinates(values, [0], { snap: true, spacing: 0.01 });
  closeTo(snapped[0], 0.02); closeTo(snapped[1], 0.03);
  closeTo(snapped[2], 0.63); closeTo(snapped[3], 0.61);
});

test('snap to grid moves coincident vertices together to the exact crossing', () => {
  const values = new Float32Array([0.024, 0.026, 0.024, 0.026, 0.63, 0.61]);
  assert.equal(coincidentUVSelection(values, [0, 1]), true);
  const snapped = snapUVCoordinates(values, [0, 1], { snap: true, spacing: 0.01 });
  closeTo(snapped[0], 0.02); closeTo(snapped[1], 0.03);
  closeTo(snapped[2], 0.02); closeTo(snapped[3], 0.03);
  closeTo(snapped[4], 0.63); closeTo(snapped[5], 0.61);
});

test('snap to grid never changes a spread-out multi-vertex transform', () => {
  const values = new Float32Array([0.24, 0.26, 0.63, 0.61]);
  assert.equal(coincidentUVSelection(values, [0, 1]), false);
  assert.deepEqual(snapUVCoordinates(values, [0, 1], { snap: true, spacing: 0.01 }), values);
  assert.deepEqual(snapUVCoordinates(values, [0], { snap: false, spacing: 0.01 }), values);
});
