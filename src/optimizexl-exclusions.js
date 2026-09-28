import { allNodes } from './animation.js';

export const GEOSET_REDUCTION_STAGES = new Set(['duplicates', 'animation', 'unused', 'nuclear']);

export function excludedGeosets(model, settings = {}) {
  return new Set(Array.from(settings.excludedGeosets || []).filter(i => Number.isInteger(i) && i >= 0 && i < model.Geosets.length));
}

// A shared ancestor or material can affect several geosets. Preserve the
// whole dependency when any excluded geoset uses it, including animated UVs.
export function protectedGeosetData(model, settings = {}) {
  const geosets = excludedGeosets(model, settings), nodes = new Set(), materials = new Set(), textureAnims = new Set();
  const byId = new Map(allNodes(model).map(n => [n.ObjectId, n]));
  for (const i of geosets) {
    const g = model.Geosets[i];
    materials.add(g.MaterialID);
    for (const id of g.Groups.flat()) {
      let n = byId.get(id);
      while (n && !nodes.has(n.ObjectId)) { nodes.add(n.ObjectId); n = byId.get(n.Parent); }
    }
    for (const layer of model.Materials[g.MaterialID]?.Layers || []) if (Number.isInteger(layer.TVertexAnimId)) textureAnims.add(layer.TVertexAnimId);
  }
  return { geosets, nodes, materials, textureAnims };
}
