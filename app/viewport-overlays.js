import { Vector3 } from 'three';
import { movementNodeCategories } from './preview-overlays.js';

export function viewportOverlayOptions(props) {
  const explicit = props.overlays != null, overlays = props.overlays || {};
  const markers = !!props.showSkeleton;
  return {
    explicit,
    bones: explicit ? !!overlays.bones : markers,
    nodes: explicit ? !!overlays.nodes : markers,
    attachments: explicit ? !!overlays.attachments : markers,
    particles: explicit ? !!overlays.particles : markers,
    boneLines: explicit ? !!(overlays.skeleton ?? overlays.boneLines) : markers,
    wires: explicit ? !!overlays.wires : props.mode === 'wireframe' || props.mode === 'vertices',
    vertices: explicit ? !!overlays.vertices : props.mode === 'vertices' || !!props.showVertices,
    grid: explicit ? !!overlays.grid : !!props.showGrid,
    axes: !!(props.showAxes ?? overlays.axes ?? props.showGrid),
  };
}

export function viewportNodeLayout(model, nodes) {
  const kinds = movementNodeCategories(model), byId = new Map(nodes.map(node => [node.ObjectId, node]));
  const groups = { bones: [], nodes: [], attachments: [], particles: [] }, allLinks = [], boneLinks = [];
  for (const node of nodes) {
    const kind = kinds.get(node.ObjectId) || 'nodes';
    groups[kind].push(node);
    if (node.Parent != null && byId.has(node.Parent)) {
      allLinks.push(byId.get(node.Parent), node);
      if (kind === 'bones') boneLinks.push(byId.get(node.Parent), node);
    }
  }
  return { groups, allLinks, boneLinks };
}

/** Matrix samples are identity in bind pose and include parents in animations. */
export function updateNodeOverlayPositions(model, nodes, matrices, positions) {
  const pivot = new Vector3();
  nodes.forEach((node, index) => {
    pivot.fromArray(node.PivotPoint || model.PivotPoints?.[node.ObjectId] || [0, 0, 0]);
    const matrix = matrices?.get(node.ObjectId);
    if (matrix) pivot.applyMatrix4(matrix);
    pivot.toArray(positions, index * 3);
  });
  return positions;
}
