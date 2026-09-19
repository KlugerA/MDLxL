import { allNodes } from './animation.js';

/** Stable rows include hidden descendants so collapse never changes selection. */
export function nodeHierarchyRows(model, tree = true) {
  const nodes = allNodes(model), byId = new Map(nodes.map(node => [node.ObjectId, node]));
  const children = new Map();
  for (const node of nodes) {
    const parent = byId.has(node.Parent) && node.Parent !== node.ObjectId ? node.Parent : null;
    if (!children.has(parent)) children.set(parent, []);
    children.get(parent).push(node);
  }
  if (!tree) return nodes.map(item => ({ item, index: item.ObjectId, depth: 0, ancestors: [], continuations: [], hasChildren: false }));
  const rows = [], visited = new Set();
  const visit = (root, continuations = []) => {
    const pending = [{ node: root, ancestors: [], continuations }];
    while (pending.length) {
      const current = pending.pop(), { node, ancestors } = current;
      if (visited.has(node.ObjectId)) continue;
      visited.add(node.ObjectId);
      const branch = children.get(node.ObjectId) || [];
      rows.push({ item: node, index: node.ObjectId, depth: ancestors.length, ancestors, continuations: current.continuations, hasChildren: branch.some(child => !visited.has(child.ObjectId)) });
      for (let i = branch.length - 1; i >= 0; i--) pending.push({ node: branch[i], ancestors: [...ancestors, node.ObjectId], continuations: [...current.continuations, i < branch.length - 1] });
    }
  };
  for (const root of children.get(null) || []) visit(root);
  // Malformed cyclic/orphan graphs stay navigable without recursive overflow.
  for (const node of nodes) if (!visited.has(node.ObjectId)) visit(node);
  return rows;
}

export function visibleNodeRows(rows, collapsed = new Set()) {
  return rows.filter(row => !row.ancestors.some(id => collapsed.has(id)));
}

export function relatedResourceIndices(model, geosetIndex, kind) {
  const geoset = model?.Geosets?.[geosetIndex];
  if (!geoset) return [];
  if (kind === 'Geosets') return [geosetIndex];
  if (kind === 'Materials') return model.Materials?.[geoset.MaterialID] ? [geoset.MaterialID] : [];
  if (kind === 'GeosetAnims') return (model.GeosetAnims || []).flatMap((anim, index) => anim.GeosetId === geosetIndex ? [index] : []);
  return [];
}
