import { visualOptions } from '../src/preferences.js';
import APPLICATION_THEMES from '../src/application-themes.json' with { type: 'json' };

/** One persisted theme also applies to React portals hosted in a second document. */
export function applyApplicationTheme(preferences, targetDocument = document) {
  const root = targetDocument?.documentElement;
  if (!root) return;
  const theme = APPLICATION_THEMES[preferences?.theme] || APPLICATION_THEMES.light;
  root.dataset.theme = theme.scheme;
  root.dataset.palette = preferences?.theme === 'warm-dark' ? 'warm' : 'classic';
  for (const [name, value] of Object.entries(theme.colors)) root.style.setProperty(`--ui-${name}`, value);
  const accent = /^#[0-9a-f]{6}$/i.test(preferences?.accent) ? preferences.accent : '#71b5f3';
  root.style.setProperty('--ui-accent', accent);
  root.style.setProperty('--panel-scale', String(preferences?.panelScale || 1));
  root.style.setProperty('--panel-width', `${preferences?.panelWidth || 164}px`);
  for (const [name, value] of Object.entries(visualOptions(preferences))) {
    const key = name.replace(/[A-Z]/g, letter => '-' + letter.toLowerCase());
    root.style.setProperty(`--visual-${key}`, typeof value === 'number' && name.endsWith('Size') ? `${value}px` : String(value));
  }
}
