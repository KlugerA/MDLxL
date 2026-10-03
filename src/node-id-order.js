// Retera collects MDX nodes in this type order (including CORN before RIBB).
// Use it for exported IDs and MDL encounter order so index-based readers also
// resolve parents, matrices, pivots and bind poses to the intended objects.
export const SERIALIZED_NODE_COLLECTIONS = Object.freeze([
  'Bones', 'Lights', 'Helpers', 'Attachments', 'ParticleEmitters',
  'ParticleEmitters2', 'ParticleEmitterPopcorns', 'RibbonEmitters', 'EventObjects', 'CollisionShapes',
]);

export const serializedNodes = model => SERIALIZED_NODE_COLLECTIONS.flatMap(collection => model[collection] || []);

export function hasCanonicalSerializedNodeOrder(model) {
  const nodes = serializedNodes(model);
  return nodes.every((node, index) => node?.ObjectId === index) && (model.PivotPoints?.length || 0) === nodes.length;
}

export function hasMonotonicSerializedNodeOrder(model) {
  const nodes = serializedNodes(model);
  return nodes.every((node, index) => Number.isInteger(node?.ObjectId) && node.ObjectId >= 0 && (!index || nodes[index - 1].ObjectId < node.ObjectId));
}

/**
 * Warcraft tools resolve geoset matrix IDs through the order of serialized
 * node sections. Keep that order identical to ObjectId order and remap every
 * model-owned node reference as one atomic plan before mutating the model.
 */
export function canonicalizeSerializedNodeOrder(model, { preserveUnusedPivots = false } = {}) {
  const nodes = serializedNodes(model), ids = new Set();
  for (const node of nodes) {
    if (!Number.isInteger(node?.ObjectId) || node.ObjectId < 0 || ids.has(node.ObjectId)) throw Error('The model has invalid or duplicate node object IDs.');
    ids.add(node.ObjectId);
  }
  const map = new Map(nodes.map((node, index) => [node.ObjectId, index]));
  const parentIds = nodes.map(node => {
    if (node.Parent == null || node.Parent === -1) return node.Parent;
    if (!map.has(node.Parent)) throw Error(`Node ${node.Name || node.ObjectId} references missing parent ${node.Parent}.`);
    return map.get(node.Parent);
  });
  const pivots = nodes.map(node => {
    const pivot = model.PivotPoints?.[node.ObjectId] || node.PivotPoint;
    if (!pivot || pivot.length !== 3 || Array.from(pivot).some(value => !Number.isFinite(value))) throw Error(`Node ${node.Name || node.ObjectId} has an invalid pivot reference.`);
    return pivot;
  });
  if (preserveUnusedPivots) model.PivotPoints?.forEach((pivot, index) => { if (!ids.has(index)) pivots.push(pivot); });
  const groupPlans = (model.Geosets || []).map((geoset, geosetIndex) => (geoset.Groups || []).map(group => group.map(id => {
    if (!map.has(id)) throw Error(`Geoset ${geosetIndex} references missing node ${id}.`);
    return map.get(id);
  })));
  const skinPlans = (model.Geosets || []).map((geoset, geosetIndex) => {
    if (!geoset.SkinWeights?.length) return null;
    const weights = new geoset.SkinWeights.constructor(geoset.SkinWeights), maximum = model.Version >= 1400 ? 65535 : 255;
    for (let offset = 0; offset < weights.length; offset += 8) for (let influence = 0; influence < 4; influence++) {
      if (!weights[offset + 4 + influence]) { weights[offset + influence] = 0; continue; }
      const old = weights[offset + influence], replacement = map.get(old);
      if (replacement == null) throw Error(`Geoset ${geosetIndex} skin weights reference missing node ${old}.`);
      if (replacement > maximum) throw Error(`Geoset ${geosetIndex} cannot represent remapped node ${replacement} in its skin-weight format.`);
      weights[offset + influence] = replacement;
    }
    return weights;
  });
  const bindPosePlans = (model.BindPoses || []).map((pose, poseIndex) => {
    if (!Array.isArray(pose.Matrices)) throw Error(`Bind pose ${poseIndex} has invalid matrices.`);
    const cameraStart = pose.Matrices.length - (model.Cameras?.length || 0);
    const matrices = nodes.map(node => {
      const matrix = pose.Matrices[node.ObjectId];
      if (!matrix || node.ObjectId >= cameraStart) throw Error(`Bind pose ${poseIndex} is missing matrix ${node.ObjectId}.`);
      return matrix;
    });
    // BPOS also carries camera matrices after the node slots. They are not
    // node references and must survive the node permutation unchanged.
    return matrices.concat(pose.Matrices.slice(cameraStart));
  });

  nodes.forEach((node, index) => { node.ObjectId = index; node.Parent = parentIds[index]; node.PivotPoint = pivots[index]; });
  for (let index = 0; index < (model.Geosets || []).length; index++) {
    model.Geosets[index].Groups = groupPlans[index];
    model.Geosets[index].TotalGroupsCount = groupPlans[index].reduce((total, group) => total + group.length, 0);
    if (skinPlans[index]) model.Geosets[index].SkinWeights = skinPlans[index];
  }
  (model.BindPoses || []).forEach((pose, index) => { pose.Matrices = bindPosePlans[index]; });
  model.PivotPoints = pivots;
  model.Nodes = [];
  nodes.forEach(node => { model.Nodes[node.ObjectId] = node; });
  return map;
}

export function repairLegacyAppendedDummyBoneOrder(model, dummy) {
  if (hasCanonicalSerializedNodeOrder(model)) return false;
  const nodes = serializedNodes(model), withoutDummy = nodes.filter(node => node !== dummy);
  const exactLegacyShape = dummy?.ObjectId === nodes.length - 1 && withoutDummy.length === nodes.length - 1 && withoutDummy.every((node, index) => node.ObjectId === index);
  if (!exactLegacyShape) throw Error('The model node sections are not in safe ObjectId order. Repair that ordering before using DummyBone imports.');
  canonicalizeSerializedNodeOrder(model);
  return true;
}
