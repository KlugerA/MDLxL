/** Toolbar badges show one physical key only, in at most three characters. */
export function hotkeyBadge(chord) {
  if (typeof chord !== 'string' || chord.includes('+') || chord.startsWith("'")) return '';
  if (/^[a-z0-9]$/i.test(chord) || /^F(?:[1-9]|1\d|2[0-4])$/.test(chord)) return chord.toUpperCase();
  return ({ Delete: 'DEL', Escape: 'ESC', Insert: 'INS', Tab: 'TAB', ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓' })[chord] || '';
}
