import { createNode, NODE_TYPES } from './editor-document.js';
import { ensureDummyBone } from './dummy-bone.js';

const TEXTURE_SLOTS = ['TextureID', 'NormalTextureID', 'ORMTextureID', 'EmissiveTextureID', 'TeamColorTextureID', 'ReflectionsTextureID'];
const clone = value => structuredClone(value);
const canonical = value => Array.isArray(value) || ArrayBuffer.isView(value) ? Array.from(value, canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().filter(key => value[key] !== undefined && key !== 'PivotPoint').map(key => [key, canonical(value[key])])) : value;
const fingerprint = value => JSON.stringify(canonical(value));
const nodeType = (model, id) => Object.keys(NODE_TYPES).find(type => model[NODE_TYPES[type][0]]?.some(node => node?.ObjectId === id));

export function captureNodeSelection(model, selectedNodeIds = []) {
  const nodeIds = [...new Set(selectedNodeIds)].filter(id => Number.isInteger(id) && model.Nodes?.[id]);
  return { kind: 'nodes', model: clone(model), nodeIds };
}

/** Copy exactly the selected nodes. Selected parent/child relationships survive;
 * roots are attached to the destination's validated shared DummyBone. */
export function pasteNodesToDummy(target, clipboard) {
  const source = clipboard?.model, selected = new Set(clipboard?.nodeIds || []);
  if (!source || !selected.size) throw Error('Copy one or more nodes before pasting.');
  if (source.Version !== target.Version) throw Error('Node paste requires matching model formats. Convert a copy to the destination format first.');
  for (const id of selected) if (!source.Nodes?.[id] || !nodeType(source, id)) throw Error(`Copied node ${id} no longer exists.`);
  const dummy = ensureDummyBone(target);
  target.Textures ||= []; target.Materials ||= []; target.TextureAnims ||= []; target.GlobalSequences ||= [];
  const maps = { nodes: new Map(), textures: new Map(), materials: new Map(), textureAnims: new Map(), globals: new Map() };
  const reuse = (collection, value) => { const key = fingerprint(value), index = collection.findIndex(item => fingerprint(item) === key); return index < 0 ? collection.push(value) - 1 : index; };
  const remapGlobals = value => {
    if (!value || typeof value !== 'object' || ArrayBuffer.isView(value)) return;
    if (Number.isInteger(value.GlobalSeqId) && value.GlobalSeqId >= 0) {
      const old = value.GlobalSeqId, duration = source.GlobalSequences?.[old];
      if (!Number.isInteger(duration) || duration <= 0) throw Error(`Copied node references missing global sequence ${old}.`);
      if (!maps.globals.has(old)) maps.globals.set(old, reuse(target.GlobalSequences, duration));
      value.GlobalSeqId = maps.globals.get(old);
    }
    for (const child of Object.values(value)) remapGlobals(child);
  };
  const textureRef = old => {
    if (old == null || old === -1) return old;
    if (!source.Textures?.[old]) throw Error(`Copied node references missing texture ${old}.`);
    if (!maps.textures.has(old)) maps.textures.set(old, reuse(target.Textures, clone(source.Textures[old])));
    return maps.textures.get(old);
  };
  const materialRef = old => {
    if (old == null || old === -1) return old;
    if (!source.Materials?.[old]) throw Error(`Copied node references missing material ${old}.`);
    if (maps.materials.has(old)) return maps.materials.get(old);
    const material = clone(source.Materials[old]);
    for (const layer of material.Layers || []) {
      for (const slot of TEXTURE_SLOTS) {
        if (typeof layer[slot] === 'number') layer[slot] = textureRef(layer[slot]);
        else if (layer[slot]?.Keys) for (const key of layer[slot].Keys) for (const field of ['Vector', 'InTan', 'OutTan']) if (key[field]) key[field] = new Int32Array(Array.from(key[field], textureRef));
        if (typeof layer._MdxDefaults?.[slot] === 'number') layer._MdxDefaults[slot] = textureRef(layer._MdxDefaults[slot]);
      }
      if (Number.isInteger(layer.TVertexAnimId) && layer.TVertexAnimId >= 0) {
        const oldAnimation = layer.TVertexAnimId;
        if (!source.TextureAnims?.[oldAnimation]) throw Error(`Copied node material references missing texture animation ${oldAnimation}.`);
        if (!maps.textureAnims.has(oldAnimation)) { const animation = clone(source.TextureAnims[oldAnimation]); remapGlobals(animation); maps.textureAnims.set(oldAnimation, reuse(target.TextureAnims, animation)); }
        layer.TVertexAnimId = maps.textureAnims.get(oldAnimation);
      }
    }
    remapGlobals(material); maps.materials.set(old, reuse(target.Materials, material)); return maps.materials.get(old);
  };
  const ordered = [], visiting = new Set(), visited = new Set();
  const visit = id => {
    if (visited.has(id)) return;
    if (visiting.has(id)) throw Error('Copied node hierarchy contains a cycle.');
    visiting.add(id); const parent = source.Nodes[id].Parent;
    if (selected.has(parent)) visit(parent);
    visiting.delete(id); visited.add(id); ordered.push(id);
  };
  for (const id of selected) visit(id);
  const usedNames = new Set((target.Nodes || []).filter(Boolean).map(node => node.Name));
  const uniqueName = original => {
    if (original !== 'DummyBone' && !usedNames.has(original)) { usedNames.add(original); return original; }
    const base = `${original || 'Node'}_copy`; let name = base, number = 2;
    while (usedNames.has(name)) name = `${base}${number++}`;
    usedNames.add(name); return name;
  };
  for (const old of ordered) {
    const original = source.Nodes[old], type = nodeType(source, old), created = createNode(target, type);
    const newId = created.ObjectId, attachmentId = created.AttachmentID;
    Object.assign(created, clone(original), { ObjectId: newId, Parent: selected.has(original.Parent) ? maps.nodes.get(original.Parent) : dummy.ObjectId, Name: uniqueName(original.Name) });
    created.PivotPoint = clone(source.PivotPoints?.[old] || original.PivotPoint || new Float32Array(3)); target.PivotPoints[newId] = created.PivotPoint;
    if (type === 'Attachment') created.AttachmentID = attachmentId;
    if (type === 'Bone') { created.GeosetId = null; created.GeosetAnimId = null; }
    if (type === 'ParticleEmitter2') created.TextureID = textureRef(created.TextureID);
    if (type === 'RibbonEmitter') created.MaterialID = materialRef(created.MaterialID);
    remapGlobals(created); maps.nodes.set(old, newId);
  }
  return { nodeIds: ordered.map(id => maps.nodes.get(id)), nodeMap: Object.fromEntries(maps.nodes), dummyId: dummy.ObjectId };
}
