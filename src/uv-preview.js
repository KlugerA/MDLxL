import { sampleTrack } from './animation.js';

const normal = value => String(value || '').replaceAll('/', '\\').toLowerCase();
const copyUV = geoset => (geoset.TVertices || []).map(values => new Float32Array(values));

export function getUVPreviewSelection(model, selection) {
  const indices = typeof selection === 'number' ? [selection] : Array.from(selection || []);
  const geosetIndices = [...new Set(indices)];
  const result = { enabled: false, reason: '', geosetIndices, materialID: null };
  if (!geosetIndices.length) return { ...result, reason: 'Check one geoset, or geosets using the same material, to preview a texture.' };
  if (geosetIndices.some(index => !Number.isSafeInteger(index) || index < 0 || !model.Geosets[index])) return { ...result, reason: 'The geoset selection changed. Select the geosets again.' };
  const materialID = model.Geosets[geosetIndices[0]].MaterialID;
  if (geosetIndices.some(index => model.Geosets[index].MaterialID !== materialID)) return { ...result, reason: 'Selected geosets use different materials. Select geosets using the same material.' };
  if (!Number.isSafeInteger(materialID) || materialID < 0 || !model.Materials[materialID]) return { ...result, reason: 'The selected geosets need a valid material before previewing a texture.' };
  return { ...result, materialID, enabled: true };
}

// UVs should show an actual image, never a procedural replaceable/team-colour
// layer. Sampling the texture track keeps the UV image in step with playback.
export function imageTextureLayers(model, geosetIndex, time = 0, sequenceIndex = -1) {
  const geoset = model.Geosets[geosetIndex], material = model.Materials[geoset?.MaterialID];
  const interval = model.Sequences?.[sequenceIndex]?.Interval;
  return (material?.Layers || []).flatMap((layer, layerIndex) => {
    const sampled = sampleTrack(layer.TextureID, time, { interval, globalSequences: model.GlobalSequences, fallback: -1 });
    const textureID = Math.round(Number(sampled)), texture = model.Textures[textureID];
    if (!texture || texture.ReplaceableId || !String(texture.Image || '').trim()) return [];
    const coordId = Number.isSafeInteger(layer.CoordId) && layer.CoordId >= 0 ? layer.CoordId : 0;
    const path = texture.Image, leaf = path.split(/[\\/]/).at(-1);
    return [{ layerIndex, textureID, path, coordId, label: `Layer ${layerIndex + 1} · ${leaf}` }];
  });
}

export function chooseUVImageLayer(model, geosetIndex, selectedLayer, time = 0, sequenceIndex = -1) {
  const layers = imageTextureLayers(model, geosetIndex, time, sequenceIndex);
  return layers.find(layer => layer.layerIndex === selectedLayer) || layers[0] || null;
}

function layerHasImage(model, layer) {
  const value = layer?.TextureID;
  const ids = typeof value === 'number' ? [value] : Array.isArray(value) || ArrayBuffer.isView(value) ? Array.from(value) : (value?.Keys || []).flatMap(key => Array.from(key.Vector || []));
  return ids.some(id => { const texture = model.Textures[Math.round(id)]; return texture && !texture.ReplaceableId && String(texture.Image || '').trim(); });
}

function previewLayerIndex(model, geoset, requested) {
  const layers = model.Materials[geoset.MaterialID]?.Layers || [];
  // With no image layer, append one. The procedural team-colour layer survives.
  if (requested == null) { const found = layers.findIndex(layer => layerHasImage(model, layer)); return found < 0 ? layers.length : found; }
  if (!Number.isSafeInteger(requested) || requested < 0 || requested > layers.length) throw Error('The selected image layer no longer exists. Choose an image layer again.');
  if (requested < layers.length && !layerHasImage(model, layers[requested])) throw Error('Choose an image layer. Replaceable and team-colour layers are preserved.');
  return requested;
}

// UV edits live in the normal undo history. Only the texture assignment is
// provisional; the first UV snapshot survives subsequent texture choices.
export function beginUVPreview(model, drafts, selection, asset, layerIndex = null) {
  const checked = getUVPreviewSelection(model, selection);
  if (!checked.enabled) throw Error(checked.reason);
  if (!asset?.name || !asset.bytes?.byteLength) throw Error('Choose a readable texture.');
  const pending = checked.geosetIndices.map(geosetIndex => {
    const geoset = model.Geosets[geosetIndex], previous = drafts[geosetIndex];
    if (previous) validateUVPreview(model, previous);
    return { geosetIndex, geoset, previous, layerIndex: previewLayerIndex(model, geoset, layerIndex) };
  });
  const next = { ...drafts };
  for (const {geosetIndex, geoset, previous, layerIndex} of pending) next[geosetIndex] = {
    ...(previous || { geosetIndex, geosetCount: model.Geosets.length, vertexCount: geoset.Vertices.length / 3,
      faces: new Uint32Array(geoset.Faces), originalUV: copyUV(geoset) }),
    layerIndex,
    asset: { name: asset.name, bytes: new Uint8Array(asset.bytes), source: asset.source || 'library' },
  };
  return next;
}

export function validateUVPreview(model, draft) {
  const geoset = model.Geosets[draft.geosetIndex];
  if (!geoset || draft.geosetCount != null && model.Geosets.length !== draft.geosetCount ||
      geoset.Vertices.length / 3 !== draft.vertexCount || geoset.Faces.length !== draft.faces.length ||
      geoset.Faces.some((value, index) => value !== draft.faces[index]))
    throw Error(`Geoset ${draft.geosetIndex + 1} changed structure during texture preview. Undo that geometry change before saving or reverting this preview.`);
  return geoset;
}

// This short-lived guard also catches replacing or reordering meshes with the
// same topology. References are intentionally not stored in recoverable drafts.
export function captureUVPreviewGuard(model, drafts) {
  return Object.keys(drafts || {}).length ? model.Geosets.slice() : null;
}

export function validateUVPreviewGuard(model, drafts, beforeGeosets = null) {
  if (!Object.keys(drafts || {}).length) return;
  if (beforeGeosets && (beforeGeosets.length !== model.Geosets.length ||
      beforeGeosets.some((geoset, index) => model.Geosets[index] !== geoset)))
    throw Error('Save or Revert the temporary UV textures before adding, deleting, replacing, or reordering geosets.');
  for (const draft of Object.values(drafts)) validateUVPreview(model, draft);
}

export function addLibraryTexture(model, asset) {
  if (!asset?.name) throw Error('The texture has no model path.');
  const found = model.Textures.findIndex(texture => !texture.ReplaceableId && normal(texture.Image) === normal(asset.name));
  if (found >= 0) return found;
  model.Textures.push({ Image: asset.name.replaceAll('/', '\\'), ReplaceableId: 0, Flags: 3 });
  return model.Textures.length - 1;
}

export function applyUVPreviews(model, drafts) {
  const pending = Object.values(drafts);
  const layerIndices = new Map(), clonedMaterials = new Map();
  for (const draft of pending) {
    const geoset = validateUVPreview(model, draft);
    layerIndices.set(draft, previewLayerIndex(model, geoset, draft.layerIndex));
  }
  for (const draft of pending) {
    const geoset = model.Geosets[draft.geosetIndex];
    const layerIndex = layerIndices.get(draft), textureID = addLibraryTexture(model, draft.asset);
    const replacementKey = `${geoset.MaterialID}|${layerIndex}|${textureID}`;
    if (clonedMaterials.has(replacementKey)) { geoset.MaterialID = clonedMaterials.get(replacementKey); continue; }
    const material = structuredClone(model.Materials[geoset.MaterialID] || {
      PriorityPlane: 0, RenderMode: 0, Layers: [{ FilterMode: 0, Alpha: 1, Shading: 0, CoordId: 0 }],
    });
    material.Layers ||= [];
    if (layerIndex === material.Layers.length) material.Layers.push({ FilterMode: material.Layers.length ? 1 : 0, Alpha: 1, Shading: 0, CoordId: 0 });
    material.Layers[layerIndex].TextureID = textureID;
    // Checked geosets with the same replacement stay together. Other users of
    // the old material retain their texture and any animated texture track.
    geoset.MaterialID = model.Materials.length;
    clonedMaterials.set(replacementKey, geoset.MaterialID);
    model.Materials.push(material);
  }
  return pending.length;
}

export function revertUVPreviews(model, drafts) {
  for (const draft of Object.values(drafts)) validateUVPreview(model, draft);
  for (const draft of Object.values(drafts)) model.Geosets[draft.geosetIndex].TVertices = draft.originalUV.map(values => new Float32Array(values));
}

export function uvPreviewModel(model, drafts, liveUV = null) {
  const liveChanges = Array.isArray(liveUV) ? liveUV : liveUV ? [liveUV] : [];
  if (!Object.keys(drafts).length && !liveChanges.length) return model;
  const preview = { ...model, Geosets: model.Geosets.slice() };
  if (Object.keys(drafts).length) { preview.Textures = model.Textures.slice(); preview.Materials = model.Materials.slice(); }
  const validDrafts = {};
  for (const draft of Object.values(drafts)) {
    // A topology edit must not accidentally paint a different geoset. Saving
    // and reverting give an explicit error until the geometry is restored.
    try { const geoset = validateUVPreview(model, draft); previewLayerIndex(model, geoset, draft.layerIndex); } catch { continue; }
    preview.Geosets[draft.geosetIndex] = { ...model.Geosets[draft.geosetIndex] };
    validDrafts[draft.geosetIndex] = draft;
  }
  if (Object.keys(validDrafts).length) applyUVPreviews(preview, validDrafts);
  for (const live of liveChanges) if (preview.Geosets[live?.geosetIndex]?.TVertices?.[live.uvSet] && live.values?.length === preview.Geosets[live.geosetIndex].TVertices[live.uvSet].length) {
    const geoset = { ...preview.Geosets[live.geosetIndex] };
    geoset.TVertices = geoset.TVertices.slice(); geoset.TVertices[live.uvSet] = live.values;
    preview.Geosets[live.geosetIndex] = geoset;
  }
  return preview;
}

export function restoreUVPreviews(model, drafts) {
  const restored = {};
  for (const [index, draft] of Object.entries(drafts || {})) {
    if (!draft || !Number.isSafeInteger(draft.geosetIndex) || draft.geosetIndex < 0 ||
        draft.layerIndex != null && (!Number.isSafeInteger(draft.layerIndex) || draft.layerIndex < 0) ||
        Number(index) !== draft.geosetIndex || !Number.isSafeInteger(draft.vertexCount) || draft.vertexCount < 0 ||
        draft.geosetCount != null && (!Number.isSafeInteger(draft.geosetCount) || draft.geosetCount <= draft.geosetIndex) ||
        !Array.isArray(draft.originalUV) || !draft.asset?.name || !(draft.asset.bytes instanceof Uint8Array) || !draft.asset.bytes.byteLength ||
        !(Array.isArray(draft.faces) || ArrayBuffer.isView(draft.faces)) || !Number.isSafeInteger(draft.faces.length) || draft.faces.length % 3 ||
        Array.from(draft.faces).some(value => !Number.isSafeInteger(value) || value < 0 || value >= draft.vertexCount))
      throw Error('Invalid cached UV preview.');
    if (draft.originalUV.some(values => !(Array.isArray(values) || ArrayBuffer.isView(values)) || values.length !== draft.vertexCount * 2 || Array.from(values).some(value => !Number.isFinite(value)))) throw Error('Invalid cached UV coordinates.');
    // Old recovery can contain geometry edits made during a preview. Recover
    // the document and snapshot together so Undo can repair that mismatch;
    // applying/reverting and rendering still validate against the live mesh.
    restored[index] = structuredClone(draft);
  }
  return restored;
}
