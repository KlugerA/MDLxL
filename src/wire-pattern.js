const boundedSpacing = value => Math.max(2, Math.min(32, Number(value) || 3));

/** Pixel-space dash definitions shared by the Appearance preview and canvas overlays. */
export function wireDashArray(wire = {}, scale = 1) {
  const spacing = boundedSpacing(wire.spacing) * scale;
  if (wire.style === 'dotted') return [Math.max(1, (Number(wire.thickness) || 1) * scale), spacing];
  if (wire.style === 'dashed' || wire.style === 'striped') return [spacing * 2, spacing];
  return [];
}

/** Preserve the existing WebGL pattern at the default spacing while making spacing adjustable. */
export function configureWideWirePattern(material, wire = {}) {
  const factor = boundedSpacing(wire.spacing) / 3;
  material.dashScale = 1;
  material.dashSize = wire.style === 'dotted' ? .6 : 4 * factor;
  material.gapSize = (wire.style === 'dotted' ? 2.2 : 2.5) * factor;
  return material;
}
