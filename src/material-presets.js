import { TEAM_COLORS } from './team-colors.js';

export const MATERIAL_PRESETS = ['Team Color Overlay', 'Color Tint', 'Team Color'];
const normalize = path => String(path || '').replaceAll('/', '\\').toLowerCase();
export const tintTexturePath = index => `ReplaceableTextures\\TeamColor\\TeamColor${String(index ?? 24).padStart(2, '0')}.blp`;
const colorIndex = texture => TEAM_COLORS.findIndex(color => !texture?.ReplaceableId && normalize(texture?.Image) === normalize(tintTexturePath(color.index)));
const texture = (model, layer) => model.Textures?.[layer?.TextureID];

export function materialPreset(model, materialID) {
  const layers = model.Materials?.[materialID]?.Layers || [];
  if (layers.length === 2 && texture(model, layers[0])?.ReplaceableId === 1 && layers[0].FilterMode === 0 && layers[1].FilterMode === 2) return { preset: 'Team Color', tint: 0 };
  if (layers.length === 3 && layers[0].FilterMode === 0 && layers[2].FilterMode === 5 &&
      JSON.stringify(layers[0].TextureID) === JSON.stringify(layers[2].TextureID) && layers[1].FilterMode === 3 && layers[0].Shading === 16 && layers[2].Shading === 16 && layers[1].Shading === 0 &&
      layers[0].Alpha === 1 && layers[2].Alpha === 1 && Math.abs(layers[1].Alpha - 0.05) < 1e-7) {
    if (texture(model, layers[1])?.ReplaceableId === 1) return { preset: 'Team Color Overlay', tint: 0 };
    const tint = colorIndex(texture(model, layers[1]));
    if (tint >= 0) return { preset: 'Color Tint', tint };
  }
  return { preset: '', tint: 0 };
}

function ensureTexture(model, definition) {
  const index = model.Textures.findIndex(item => (item.ReplaceableId || 0) === definition.ReplaceableId && normalize(item.Image) === normalize(definition.Image));
  return index >= 0 ? index : model.Textures.push(definition) - 1;
}

/** The armor stack from archer.mdx: opaque base, 5% additive color, modulated base. */
export function applyMaterialPreset(model, materialID, preset, tint = 0) {
  if (!preset) return false;
  if (!MATERIAL_PRESETS.includes(preset)) throw Error('Unknown material preset.');
  const material = model.Materials?.[materialID];
  if (!material) throw Error('Choose a material first.');
  const base = material.Layers.find(layer => {
    if (typeof layer.TextureID !== 'number') return !!layer.TextureID?.Keys;
    const info = texture(model, layer);
    return info?.Image && !info.ReplaceableId && colorIndex(info) < 0;
  });
  if (!base) throw Error('Choose a base texture for this material before applying an overlay.');
  const color = TEAM_COLORS[tint];
  if (preset === 'Color Tint' && !color) throw Error('Choose an available tint color.');
  const textureID = ensureTexture(model, preset === 'Color Tint'
    ? { Image: tintTexturePath(color.index), ReplaceableId: 0, Flags: 0 }
    : { Image: '', ReplaceableId: 1, Flags: 0 });
  if (preset === 'Team Color') {
    material.Layers = [{ FilterMode: 0, Shading: (base.Shading & 16) | 1, TextureID: textureID, CoordId: base.CoordId || 0, Alpha: 1 }, { ...structuredClone(base), FilterMode: 2 }];
  } else {
    material.Layers = [
      { ...structuredClone(base), FilterMode: 0, Shading: 16, Alpha: 1 },
      { FilterMode: 3, Shading: 0, TextureID: textureID, TVertexAnimId: null, CoordId: base.CoordId || 0, Alpha: 0.05 },
      { ...structuredClone(base), FilterMode: 5, Shading: 16, Alpha: 1 },
    ];
  }
  return true;
}
