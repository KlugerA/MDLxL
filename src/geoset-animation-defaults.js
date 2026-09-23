/** GeosetAnim.Flags bit 2 enables tint; Color is a Float32Array(3) OR an
 * AnimVector { LineType, GlobalSeqId, Keys }. An animated MDX Color additionally
 * has its static RGB base in _MdxDefaults.Color. These are separate concepts.
 * Only disabled, unanimated null/absent/white Color values are format-equivalent.
 * Never apply this policy to tracks, active colors, or dormant nonwhite colors.
 */
export const hasGeosetColorTrack = anim => Array.isArray(anim?.Color?.Keys);
export const geosetTintEnabled = anim => !!(anim?.Flags & 2);
export const neutralGeosetColor = color => color == null ||
  (Array.isArray(color) || ArrayBuffer.isView(color)) && color.length === 3 && Array.from(color).every(n => n === 1);
export const defaultGeosetColor = anim => !geosetTintEnabled(anim) && !hasGeosetColorTrack(anim) && neutralGeosetColor(anim?.Color);
export const equivalentGeosetColorDefaults = (a, b) => defaultGeosetColor(a) && defaultGeosetColor(b);

export function createVisibilityGeosetAnimation(GeosetId) {
  return { GeosetId, Alpha: 1, Color: new Float32Array([1, 1, 1]), Flags: 0 };
}

/** An explicit user toggle may enable the neutral default, preserving other bits. */
export function setGeosetTintEnabled(anim, enabled) {
  if (enabled && defaultGeosetColor(anim) && anim.Color == null) anim.Color = new Float32Array([1, 1, 1]);
  anim.Flags = enabled ? anim.Flags | 2 : anim.Flags & ~2;
}

/** Export-only snapshots; do not change the live document, flags, or history. */
export function prepareGeosetAnimationColors(animations, format) {
  return animations.map(anim => {
    if (defaultGeosetColor(anim)) return { ...anim, Color: format === 'mdl' ? null : new Float32Array([1, 1, 1]) };
    return anim;
  });
}

export function geosetColorExportIssues(animations, format) {
  const issues = [];
  for (const [i, anim] of animations.entries()) {
    const path = `GeosetAnims[${i}].Color`;
    if (!hasGeosetColorTrack(anim) && !defaultGeosetColor(anim) &&
        (!(anim.Color instanceof Float32Array) || anim.Color.length !== 3 || !anim.Color.every(Number.isFinite))) {
      issues.push(`${path}: invalid static color; expected three finite RGB values.`);
    } else if (format === 'mdl' && !geosetTintEnabled(anim) && !defaultGeosetColor(anim)) {
      issues.push(`${path}: ${hasGeosetColorTrack(anim) ? 'disabled tint with a color track' : 'dormant nonwhite color'} cannot be represented in MDL without enabling tint; save as MDX to preserve it.`);
    }
  }
  return issues;
}
