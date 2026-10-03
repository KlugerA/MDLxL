import themes from './application-themes.json' with { type: 'json' };

export const TREE_COLORS = Object.freeze([
  ['background', 'List background'], ['text', 'List text'], ['muted', 'Type and ID text'],
  ['border', 'List border'], ['guide', 'Hierarchy lines'], ['hover', 'Hovered row'],
  ['selected', 'Selected row'], ['selectedText', 'Selected row text'], ['accent', 'Selection edge'],
]);
export const NODE_COLORS = Object.freeze([
  ['bone', 'Bones'], ['helper', 'Helpers'], ['attachment', 'Attachments'], ['light', 'Lights'],
  ['emitter', 'Emitters'], ['sound', 'Sounds'], ['splat', 'Blood splats'], ['footprint', 'Footprints'],
  ['ubersplat', 'Ubersplats'], ['spawn', 'Spawn objects'], ['collision', 'Collision shapes'],
]);
export const FOLDER_COLORS = Object.freeze([
  ['default', 'Other folders'], ['Human', 'Human'], ['Orc', 'Orc'], ['Undead', 'Undead'],
  ['NightElf', 'Night Elf'], ['Naga', 'Naga'], ['Demon', 'Demon'], ['Creeps', 'Creeps'],
  ['Abilities', 'Abilities'], ['Sound', 'Sound'], ['Unavailable', 'Unavailable'],
]);

// Each palette follows its application theme, including readable colors on the
// light presets. Order: gold, neutral, blue, yellow, violet, green, red, orange, teal.
const hues = {
  light: ['#795c10','#596575','#236290','#796000','#78529d','#267447','#a32a40','#935322','#1b7178'],
  dark: ['#dfbc85','#b6b6b6','#88b7d5','#e8d075','#b99acf','#90c69c','#e99994','#e8af79','#80c3bf'],
  'warm-dark': ['#e6bd86','#bcb2a5','#9cbed0','#e5d39b','#c7a4c9','#adc79c','#e5a294','#dcb084','#9ac7ba'],
  nord: ['#ebcb8b','#d8dee9','#81a1c1','#e8d49e','#b9a4c9','#a3be8c','#de939b','#d9a28e','#8fbcbb'],
  'solarized-light': ['#806900','#586e75','#086fa0','#786c00','#795aa6','#457314','#b44542','#a75019','#167b75'],
  'gruvbox-dark': ['#fabd2f','#bdae93','#83a598','#e9d080','#d3869b','#b8bb26','#fb9983','#feaa55','#8ec07c'],
  'catppuccin-mocha': ['#f9e2af','#bac2de','#89b4fa','#f5e0b4','#cba6f7','#a6e3a1','#f38ba8','#fab387','#94e2d5'],
};
export function treeAppearanceForTheme(id = 'light') {
  const theme = themes[id] || themes.light, c = theme.colors;
  const [gold, neutral, blue, yellow, violet, green, red, orange, teal] = hues[id] || hues.light;
  return {
    background: c.field, text: c.text, muted: c.muted, border: c.border, guide: c.border,
    hover: c.hover, selected: c.selected, selectedText: c['selected-text'], accent: theme.accent, fontSize: 12,
    nodes: { bone: gold, helper: neutral, attachment: blue, light: yellow, emitter: violet, sound: green, splat: red, footprint: orange, ubersplat: gold, spawn: teal, collision: neutral },
    folders: { default: c.link, Human: blue, Orc: orange, Undead: violet, NightElf: green, Naga: teal, Demon: red, Creeps: gold, Abilities: violet, Sound: teal, Unavailable: neutral },
  };
}

const record = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const color = (value, fallback) => /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : fallback;
export function normalizeTreeAppearance(value, fallback = treeAppearanceForTheme()) {
  const input = record(value), output = {};
  for (const [key] of TREE_COLORS) output[key] = color(input[key], fallback[key]);
  const size = input.fontSize;
  output.fontSize = size != null && size !== '' && Number.isFinite(Number(size)) ? Math.round(Math.max(10, Math.min(20, Number(size)))) : fallback.fontSize;
  for (const [group, keys] of [['nodes', NODE_COLORS], ['folders', FOLDER_COLORS]]) {
    output[group] = {};
    for (const [key] of keys) output[group][key] = color(record(input[group])[key], fallback[group][key]);
  }
  return output;
}
