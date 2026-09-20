export const DEFAULT_UV_GRID = Object.freeze({
  enabled: false,
  snap: false,
  spacing: 0.125,
  thickness: 1,
  color: '#ffffff',
  opacity: 0.35,
});

// At the editor's maximum zoom, denser cells than this are no longer useful.
export const UV_GRID_SPACING_MIN = 0.0006;
export const UV_GRID_SPACING_MAX = 8;

const record = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const bounded = (value, minimum, maximum, fallback) => value !== null && value !== '' && Number.isFinite(Number(value))
  ? Math.round(Math.max(minimum, Math.min(maximum, Number(value))) * 1000000) / 1000000
  : fallback;

export function normalizeUVGrid(value = {}) {
  const input = record(value);
  return {
    enabled: input.enabled === true,
    snap: input.snap === true,
    spacing: bounded(input.spacing, UV_GRID_SPACING_MIN, UV_GRID_SPACING_MAX, DEFAULT_UV_GRID.spacing),
    thickness: bounded(input.thickness, 0.5, 6, DEFAULT_UV_GRID.thickness),
    color: /^#[0-9a-f]{6}$/i.test(input.color) ? input.color.toLowerCase() : DEFAULT_UV_GRID.color,
    opacity: bounded(input.opacity, 0, 1, DEFAULT_UV_GRID.opacity),
  };
}

/** A logarithmic slider keeps both sub-pixel UV steps and large cells precise. */
export function uvGridSpacingSliderValue(spacing) {
  return Math.log10(bounded(spacing, UV_GRID_SPACING_MIN, UV_GRID_SPACING_MAX, DEFAULT_UV_GRID.spacing));
}

export function uvGridSpacingFromSlider(value) {
  return bounded(10 ** Number(value), UV_GRID_SPACING_MIN, UV_GRID_SPACING_MAX, DEFAULT_UV_GRID.spacing);
}

export function coincidentUVSelection(values, selectedVertices, epsilon = 1e-6) {
  const selected = Array.from(selectedVertices || []);
  if (!selected.length) return false;
  const first = selected[0] * 2;
  if (first < 0 || first + 1 >= (values?.length || 0)) return false;
  const u = values[first], v = values[first + 1];
  return selected.every(index => {
    const offset = index * 2;
    return offset >= 0 && offset + 1 < values.length && Math.abs(values[offset] - u) <= epsilon && Math.abs(values[offset + 1] - v) <= epsilon;
  });
}

/** GIMP-style UV grid intersections are fixed to the global UV origin. */
export function snapUVCoordinates(values, selectedVertices, value = {}) {
  const result = new Float32Array(values || []), selected = Array.from(selectedVertices || []), grid = normalizeUVGrid(value);
  if (!grid.snap || !coincidentUVSelection(result, selected)) return result;
  const first = selected[0] * 2;
  const snappedU = Math.round(result[first] / grid.spacing) * grid.spacing;
  const snappedV = Math.round(result[first + 1] / grid.spacing) * grid.spacing;
  const deltaU = snappedU - result[first], deltaV = snappedV - result[first + 1];
  for (const index of selected) {
    const offset = index * 2;
    result[offset] += deltaU; result[offset + 1] += deltaV;
  }
  return result;
}

export function visibleUVGridLines(minimum, maximum, spacing, maximumLines = 4096) {
  const step = bounded(spacing, UV_GRID_SPACING_MIN, UV_GRID_SPACING_MAX, DEFAULT_UV_GRID.spacing);
  if (!Number.isFinite(minimum) || !Number.isFinite(maximum) || maximum < minimum) return [];
  const first = Math.ceil((minimum - step * 1e-9) / step), last = Math.floor((maximum + step * 1e-9) / step);
  if (last - first + 1 > maximumLines) return [];
  return Array.from({ length: Math.max(0, last - first + 1) }, (_, index) => Number(((first + index) * step).toPrecision(12)));
}
