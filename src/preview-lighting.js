export const LIGHTING_PRESETS = Object.freeze({
  requested: Object.freeze({ ambient: [128, 128, 128], diffuse: [192, 192, 192], specular: [0, 0, 0], power: 1 }),
  legacy: Object.freeze({ ambient: [140.25, 140.25, 140.25], diffuse: [114.75, 114.75, 114.75], specular: [28, 36, 45], power: 9 }),
});

export function normalizePreviewLighting(value = {}) {
  const preset = ['requested', 'legacy', 'custom'].includes(value?.preset) ? value.preset : 'requested';
  const defaults = LIGHTING_PRESETS[preset] || LIGHTING_PRESETS.requested;
  const rgb = key => Array.from({ length: 3 }, (_, i) => preset !== 'custom' ? defaults[key][i] : Number.isFinite(Number(value?.[key]?.[i])) ? Math.max(0, Math.min(255, Number(value[key][i]))) : defaults[key][i]);
  const power = preset !== 'custom' ? defaults.power : Number.isFinite(Number(value?.power)) ? Math.max(0, Number(value.power)) : defaults.power;
  return { preset, ambient: rgb('ambient'), diffuse: rgb('diffuse'), specular: rgb('specular'), power };
}

export function previewLighting(preferences) {
  const config = normalizePreviewLighting(preferences?.lighting);
  return { ...config, ambient: config.ambient.map(v => v / 255), diffuse: config.diffuse.map(v => v / 255), specular: config.specular.map(v => v / 255) };
}
