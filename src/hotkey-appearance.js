export const DEFAULT_HOTKEY_APPEARANCE = Object.freeze({ color: '#39ff14', fontSize: 10, placement: 'below' });
export function normalizeHotkeyAppearance(value = {}) {
  const input = value && typeof value === 'object' ? value : {};
  const size = Number(input.fontSize);
  return {
    color: /^#[0-9a-f]{6}$/i.test(input.color) ? input.color.toLowerCase() : DEFAULT_HOTKEY_APPEARANCE.color,
    fontSize: input.fontSize !== null && input.fontSize !== '' && Number.isFinite(size) ? Math.round(Math.max(8, Math.min(24, size))) : DEFAULT_HOTKEY_APPEARANCE.fontSize,
    placement: ['above', 'below', 'left', 'right'].includes(input.placement) ? input.placement : DEFAULT_HOTKEY_APPEARANCE.placement,
  };
}
