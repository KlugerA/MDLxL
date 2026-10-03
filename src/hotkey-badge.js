/** Toolbar badges show one physical key only, in at most three characters. */
export function hotkeyBadge(chord) {
  if (typeof chord !== 'string' || chord.includes('+') || chord.startsWith("'")) return '';
  if (/^[a-z0-9]$/i.test(chord) || /^F(?:[1-9]|1\d|2[0-4])$/.test(chord)) return chord.toUpperCase();
  return ({ Delete: 'DEL', Escape: 'ESC', Insert: 'INS', Tab: 'TAB', ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓' })[chord] || '';
}

/** RVL shows a direct key or one modifier plus a key, never a leader sequence. */
export function accessibleHotkey(chord) {
  if (typeof chord !== 'string' || chord.includes('>')) return '';
  const parts = chord.split('+');
  if (parts.length > 2 || parts.length === 2 && !['Ctrl', 'Alt', 'Shift', 'Meta'].includes(parts[0])) return '';
  const key = parts.at(-1);
  const label = hotkeyBadge(key) || ({ Space: 'Space', Enter: 'Enter', Backspace: 'Bksp', Home: 'Home', End: 'End', PageUp: 'PgUp', PageDown: 'PgDn', Plus: '+' })[key] || (key.length === 1 ? key : '');
  return label ? [...parts.slice(0, -1).map(value => value === 'Meta' ? 'Win' : value), label].join('+') : '';
}

/** Paint's paired brush controls are alternatives, each requiring at most two keys. */
export function accessiblePaintHotkey(value) {
  if (typeof value !== 'string') return '';
  const paired = { '[ ]': '[ / ]', '− +': '− / +', ', .': ', / .', 'Shift+[ ]': 'Shift+[ / Shift+]' };
  return paired[value] || accessibleHotkey(value.replace('↵', 'Enter')) || (['Ctrl', 'Shift'].includes(value) ? value : '');
}
