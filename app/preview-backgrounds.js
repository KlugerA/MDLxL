export const PREVIEW_BACKGROUNDS = [
  ['01_Ruined_Citadel', 'Ruined Citadel'], ['02_Forest_Ruins', 'Forest Ruins'],
  ['03_Gothic_Crypt', 'Gothic Crypt'], ['04_Snowy_Mountain', 'Snowy Mountain'],
  ['05_Arcane_Temple', 'Arcane Temple'], ['06_Volcanic_Wasteland', 'Volcanic Wasteland'],
  ['07_Cursed_Chaos_Wastes', 'Cursed Chaos Wastes'], ['08_Underdark_Cavern', 'Underdark Cavern'],
  ['09_Demonic_Plane', 'Demonic Plane'],
].map(([id, label]) => ({ id, label, url: `./backgrounds/${id}.png` }));
