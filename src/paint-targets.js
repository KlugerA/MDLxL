const slash = value => String(value || '').replaceAll('/', '\\');
const baseName = value => slash(value).split('\\').at(-1) || '';

function staticTextureId(layer) {
  return Number.isInteger(layer?.TextureID) && layer.TextureID >= 0 ? layer.TextureID : null;
}

function repeatedUV(geoset, coordId) {
  const uv = geoset?.TVertices?.[coordId] || geoset?.TVertices?.[0];
  if (!uv?.length) return false;
  const seen = new Set();
  for (let index = 0; index + 1 < uv.length; index += 2) {
    const key = `${Math.round(uv[index] * 100000)}:${Math.round(uv[index + 1] * 100000)}`;
    if (seen.has(key)) return true;
    seen.add(key);
  }
  return false;
}

/** Resolve the image layers that can receive a Classic SD paint texture. */
export function enumeratePaintTargets(model) {
  const targets = new Map();
  for (let geosetIndex = 0; geosetIndex < (model?.Geosets?.length || 0); geosetIndex++) {
    const geoset = model.Geosets[geosetIndex], materialId = Number(geoset.MaterialID), material = model.Materials?.[materialId];
    for (let layerIndex = 0; layerIndex < (material?.Layers?.length || 0); layerIndex++) {
      const layer = material.Layers[layerIndex], textureId = staticTextureId(layer), texture = textureId === null ? null : model.Textures?.[textureId];
      if (typeof layer.Alpha === 'number' && layer.Alpha <= 0) continue;
      if (!texture || texture.ReplaceableId || !texture.Image) continue;
      const coordId = Number.isInteger(layer.CoordId) && layer.CoordId >= 0 ? layer.CoordId : 0;
      const id = `texture:${textureId}`;
      let target = targets.get(id);
      if (!target) {
        target = { id, textureId, texturePath: slash(texture.Image), label: baseName(texture.Image) || `Texture ${textureId + 1}`, flags: Number(texture.Flags) || 0, bindings: [], geosetIndices: [], materialIds: [], sharedUV: false };
        targets.set(id, target);
      }
      target.bindings.push({ geosetIndex, materialId, layerIndex, coordId });
      if (!target.geosetIndices.includes(geosetIndex)) target.geosetIndices.push(geosetIndex);
      if (!target.materialIds.includes(materialId)) target.materialIds.push(materialId);
      target.sharedUV ||= repeatedUV(geoset, coordId);
    }
  }
  for (const target of targets.values()) target.sharedUV ||= target.geosetIndices.length > 1 || target.bindings.length > 1;
  return [...targets.values()];
}

export function paintTargetsForGeoset(targets, geosetIndex) {
  return (targets || []).filter(target => target.geosetIndices.includes(geosetIndex));
}

export function preferredPaintTarget(targets, geosetIndex, previousId = null) {
  const candidates = paintTargetsForGeoset(targets, geosetIndex);
  return candidates.find(target => target.id === previousId) || candidates[0] || null;
}

export function findTextureAsset(assets, path) {
  if (!assets || !path) return null;
  const normalize = value => slash(value).toLowerCase();
  const map = assets instanceof Map ? assets : new Map(Object.entries(assets));
  const full = normalize(path), name = full.split('\\').at(-1);
  return map.get(full) || map.get(name) || [...map.values()].find(asset => normalize(asset?.name) === full) || null;
}

/** Add a normal image layer without replacing team-colour layers. */
export function installFreshPaintLayer(model, geosetIndex, imagePath) {
  const geoset = model?.Geosets?.[geosetIndex];
  if (!geoset) throw Error('The selected model part no longer exists.');
  const materialId = Number(geoset.MaterialID), material = model.Materials?.[materialId];
  if (!material?.Layers) throw Error('The selected model part has no editable material.');
  const normalized = slash(imagePath);
  let textureId = model.Textures.findIndex(texture => slash(texture.Image).toLowerCase() === normalized.toLowerCase());
  if (textureId < 0) textureId = model.Textures.push({ Image: normalized, ReplaceableId: 0, Flags: 0 }) - 1;
  let layerIndex = material.Layers.findIndex(layer => staticTextureId(layer) === textureId);
  if (layerIndex < 0) {
    material.Layers.push({ FilterMode: 0, Shading: 16, TextureID: textureId, TVertexAnimId: null, CoordId: 0, Alpha: 1 });
    layerIndex = material.Layers.length - 1;
  }
  return { textureId, materialId, layerIndex, coordId: 0, texturePath: normalized };
}
