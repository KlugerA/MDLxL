import {validateParticleAssets} from './particle-assets.js';
import {generateCompatibleMdx} from './mdx-compatibility.js';
import { createNode, NODE_TYPES, validateModel, openDocument } from './editor-document.js';
import { sampleTrack } from './animation.js';
import { stringifyParticleData, safeParticlePath } from './particle-data.js';

export const EFFECT_FAMILIES = ['ParticleEmitters2', 'RibbonEmitters', 'ParticleEmitters', 'ParticleEmitterPopcorns'];
const clone = value => structuredClone(value);
const textureSlots = ['TextureID', 'NormalTextureID', 'ORMTextureID', 'EmissiveTextureID', 'TeamColorTextureID', 'ReflectionsTextureID'];
export function emptyParticleModel(version = 800) {
  const model = { Version: version, Info: { Name: 'Particle Lab', MinimumExtent: new Float32Array([-64,-64,-16]), MaximumExtent: new Float32Array([64,64,128]), BoundsRadius: 120, BlendTime: 150 }, Nodes: [] };
  for (const key of ['Sequences','GlobalSequences','Textures','Materials','TextureAnims','Geosets','GeosetAnims','PivotPoints','Cameras','FaceFX','BindPoses','Gliders', ...Object.values(NODE_TYPES).map(v => v[0])]) model[key] = [];
  return model;
}
export function effectNodes(model) { return EFFECT_FAMILIES.flatMap(family => (model[family] || []).map(node => ({ family, node }))); }

/** Shared with extraction and insertion. Only ancestors and referenced resources are copied. */
export function copyEffectGraph(target, source, ids, { parent = null, sourceInterval, targetInterval, fit = false } = {}) {
  if (target.Version !== source.Version) throw Error('Effect placement requires matching native model versions.');
  if (source.BindPoses?.length || target.BindPoses?.length) throw Error('Effect placement with bind-pose matrices is not yet supported.');
  if (parent != null && !target.Nodes?.[parent]) throw Error('The attachment node no longer exists.');
  const selected = new Set(ids), visiting = new Set(), needed = new Set();
  const byId = new Map(Object.values(NODE_TYPES).flatMap(([key]) => source[key] || []).map(node => [node.ObjectId, node]));
  for (const id of selected) if (!effectNodes(source).some(item => item.node.ObjectId === id)) throw Error('Selected effect no longer exists.');
  function requireNode(id) {
    if (needed.has(id)) return;
    if (visiting.has(id)) throw Error('Effect hierarchy contains a cycle.');
    const node = byId.get(id); if (!node) throw Error('Missing effect parent ' + id);
    visiting.add(id);
    if (node.Parent != null && node.Parent !== -1) requireNode(node.Parent);
    visiting.delete(id); needed.add(id);
  }
  ids.forEach(requireNode);
  const maps = { nodes: new Map(), textures: new Map(), materials: new Map(), textureAnims: new Map(), globals: new Map() };
  function tracks(value) {
    if (!value || typeof value !== 'object' || ArrayBuffer.isView(value)) return;
    if (value.GlobalSeqId != null && value.GlobalSeqId !== -1) {
      const id = value.GlobalSeqId;
      if (!maps.globals.has(id)) {
        if (!Number.isFinite(source.GlobalSequences[id]) || source.GlobalSequences[id] < 0) throw Error('Missing global sequence.');
        maps.globals.set(id, target.GlobalSequences.push(source.GlobalSequences[id]) - 1);
      }
      value.GlobalSeqId = maps.globals.get(id);
    } else if (value.Keys && sourceInterval && targetInterval) {
      const [a,b] = sourceInterval, [c,d] = targetInterval;
      if (!(b > a && d > c)) throw Error('Choose valid source and target intervals.');
      const keys = value.Keys.filter(key => key.Frame >= a && key.Frame <= b);
      if (keys.length !== value.Keys.length) {
        // Explicit clip mapping isolates the chosen source clip. Add evaluated boundaries
        // only when there is no authored boundary, retaining all interior tangents.
        for (const Frame of [a,b]) if (!keys.some(key => key.Frame === Frame)) keys.push({ Frame, Vector: new Float32Array(sampleTrack(value, Frame, { interval: sourceInterval, globalSequences: source.GlobalSequences, globalTime: Frame, fallback: value.Keys[0]?.Vector || [0], quaternion: value.Keys[0]?.Vector?.length === 4 })) });
      }
      const ratio = fit ? (d-c)/(b-a) : 1;
      value.Keys = keys.sort((x,y) => x.Frame-y.Frame).map(key => ({ ...key, Frame: Math.round(c + (key.Frame-a)*ratio) }));
      if (value.Keys.some((key,i) => key.Frame > d || i && key.Frame <= value.Keys[i-1].Frame)) throw Error('The target interval cannot contain these source keys; choose Fit timing or a longer interval.');
      if (value.LineType >= 2) for (const key of value.Keys) { key.InTan ??= clone(key.Vector); key.OutTan ??= clone(key.Vector); }
    }
    for (const child of Object.values(value)) tracks(child);
  }
  function texture(id) {
    if (id == null || id === -1) return id;
    if (!source.Textures[id]) throw Error('Missing effect texture ' + id);
    if (!maps.textures.has(id)) {
      // Filename equality is not evidence of content equality. Preserve distinct resources.
      maps.textures.set(id, target.Textures.push(clone(source.Textures[id])) - 1);
    }
    return maps.textures.get(id);
  }
  function material(id) {
    if (!source.Materials[id]) throw Error('Missing ribbon material.');
    if (!maps.materials.has(id)) {
      const next = clone(source.Materials[id]);
      for (const layer of next.Layers || []) {
        for (const slot of textureSlots) {
          if (typeof layer[slot] === 'number') layer[slot] = texture(layer[slot]);
          else if (layer[slot]?.Keys) for (const key of layer[slot].Keys) for (const part of ['Vector','InTan','OutTan']) if (key[part]) key[part] = new Int32Array(Array.from(key[part], texture));
          if (typeof layer._MdxDefaults?.[slot] === 'number') layer._MdxDefaults[slot] = texture(layer._MdxDefaults[slot]);
        }
        const aid = layer.TVertexAnimId;
        if (aid != null && aid !== -1) {
          if (!source.TextureAnims[aid]) throw Error('Missing texture animation.');
          if (!maps.textureAnims.has(aid)) { const anim = clone(source.TextureAnims[aid]); tracks(anim); maps.textureAnims.set(aid, target.TextureAnims.push(anim)-1); }
          layer.TVertexAnimId = maps.textureAnims.get(aid);
        }
      }
      tracks(next); maps.materials.set(id, target.Materials.push(next)-1);
    }
    return maps.materials.get(id);
  }
  for (const id of needed) {
    const original = byId.get(id);
    const type = selected.has(id) ? Object.keys(NODE_TYPES).find(key => source[NODE_TYPES[key][0]]?.some(node => node.ObjectId === id)) : 'Helper';
    // A parent bone contributes its transform, not its geoset binding or unrelated effects.
    const props = selected.has(id) ? clone(original) : Object.fromEntries(['Name','Flags','Translation','Rotation','Scaling','PivotPoint'].filter(key => original[key] !== undefined).map(key => [key, clone(original[key])]));
    if (!selected.has(id)) props.Flags = (props.Flags || 0) & 255;
    if (type === 'ParticleEmitter2') props.TextureID = texture(props.TextureID);
    if (type === 'RibbonEmitter') props.MaterialID = material(props.MaterialID);
    const node = createNode(target, type), newId = node.ObjectId;
    maps.nodes.set(id, newId);
    Object.assign(node, props, { ObjectId: newId, Parent: original.Parent == null || original.Parent === -1 ? parent : maps.nodes.get(original.Parent) });
    node.PivotPoint = clone(source.PivotPoints[id] || original.PivotPoint || new Float32Array(3));
    target.PivotPoints[newId] = node.PivotPoint;
    tracks(node);
  }
  return { ids: ids.map(id => maps.nodes.get(id)), maps };
}
export function extractParticleRecipe(model, ids, metadata = {}) {
  const native = emptyParticleModel(model.Version);
  native.Info = clone(model.Info);
  native.Sequences = clone(model.Sequences || []);
  const { ids: ingredientIds } = copyEffectGraph(native, model, ids);
  const ingredients = effectNodes(native).filter(item => ingredientIds.includes(item.node.ObjectId)).map(item => ({ id: 'ingredient-' + item.node.ObjectId, family: item.family, objectId: item.node.ObjectId }));
  const unsupported = ingredients.filter(item => ['ParticleEmitters','ParticleEmitterPopcorns'].includes(item.family)).map(item => ({ id: item.id, reason: item.family === 'ParticleEmitters' ? 'External model emitter preview is not implemented by the pinned renderer.' : 'Popcorn/HD authoring is outside the classic library.' }));
  const dependencies = [
    ...native.Textures.map((texture,index) => ({ kind: 'texture', index, path: texture.Image, replaceableId: texture.ReplaceableId || 0 })),
    ...native.ParticleEmitters.filter(node => node.Path).map(node => ({ kind: 'model', path: node.Path }))
  ];
  for(const dependency of dependencies){const prior=metadata.dependencies?.find(d=>d.kind===dependency.kind&&d.path===dependency.path);if(prior)Object.assign(dependency,clone(prior),dependency.index==null?{}:{index:dependency.index});}
  return { schema: 'mdlxl-particle-recipe', version: 1, id: metadata.id || 'draft', name: metadata.name || 'Particle effect', categories: metadata.categories || ['Other'], tags: metadata.tags || [], aliases: metadata.aliases || [], naming: { state: 'review-needed' }, sources: metadata.sources || [], ...(metadata.grouping?{grouping:clone(metadata.grouping)}:{}), ingredients, native, dependencies, anchor: { position: [0,0,0] }, defaultSequence: metadata.defaultSequence ?? 0, compatibility: { preview: unsupported.length ? 'incomplete' : 'unverified', insertion: 'unverified', unsupported } };
}
export function validateParticleRecipe(recipe) {
  if (recipe?.schema !== 'mdlxl-particle-recipe' || recipe.version !== 1) throw Error('Unsupported particle preset version.');
  if (typeof recipe.name !== 'string' || !recipe.name.trim() || recipe.name.length > 120 || typeof recipe.id !== 'string' || recipe.id.length > 120) throw Error('Invalid preset identity.');
  if (!recipe.native || !Array.isArray(recipe.ingredients) || recipe.ingredients.length < 1 || recipe.ingredients.length > 256) throw Error('Invalid effect ingredients.');
  const model = recipe.native;
  if ((model.Nodes?.length || 0) > 10000 || (model.Textures?.length || 0) > 1024 || (model.Sequences?.length || 0) > 2048) throw Error('Preset exceeds native resource limits.');

  const nodes=Object.values(NODE_TYPES).flatMap(([family])=>model[family]||[]);
  if(nodes.length>10000||nodes.some(n=>!Number.isInteger(n.ObjectId)||n.ObjectId<0||n.ObjectId>10000))throw Error('Preset exceeds node identity limits.');
  const effects=effectNodes(model);
  if(effects.length!==recipe.ingredients.length||new Set(recipe.ingredients.map(i=>i.objectId)).size!==effects.length)throw Error('Every native effect needs one ingredient identity.');
  const finiteNative=value=>{if(typeof value==='number'&&(!Number.isFinite(value)||Math.abs(value)>3.4028234663852886e38))throw Error('Preset exceeds finite native numeric values.');if(value&&typeof value==='object')for(const child of Object.values(value))finiteNative(child);};
  finiteNative(model);
  for (const dep of recipe.dependencies || []) if (dep.path && !safeParticlePath(dep.path)) throw Error('Preset dependency needs a portable logical path.');
  for (const texture of model.Textures || []) if (texture.Image && !safeParticlePath(texture.Image)) throw Error('Invalid texture dependency path.');
  for (const node of [...(model.ParticleEmitters || []), ...(model.ParticleEmitterPopcorns || [])]) if (node.Path && !safeParticlePath(node.Path)) throw Error('Invalid external effect path.');
  for (const item of recipe.ingredients) if (!EFFECT_FAMILIES.includes(item.family) || !model[item.family]?.some(node => node.ObjectId === item.objectId)) throw Error('Missing native ingredient.');
  validateParticleAssets(recipe);
  const errors = validateModel(model).filter(item => item.severity === 'error');
  if (errors.length) throw Error(errors.slice(0,3).map(item => item.message).join('\n'));
  stringifyParticleData(recipe);
  return recipe;
}
export function particleModelDocument(model) {
  const doc = openDocument(generateCompatibleMdx({...model,BindPoses:model.BindPoses?.length?model.BindPoses:undefined}), 'Particle-Lab.mdx');
  if (doc.readOnly) throw Error('Unsupported native model version.');
  const state = doc.captureRecoveryState({includeHistory:false});
  state.model = clone(model); state.savedModel = clone(model);
  return doc.constructor.restoreRecoveryState(state);
}
export function particleRecipeDocument(recipe) { validateParticleRecipe(recipe); return particleModelDocument(recipe.native); }
export function placeParticleRecipe(target, recipe, options = {}) {
  validateParticleRecipe(recipe);
  if (recipe.compatibility?.unsupported?.length) throw Error('This effect has unsupported ingredients; placement is not yet available.');
  let source=recipe.native;
  if(source.Version!==target.Version){
    // Prove this dependency graph can retain every authored field at the target
    // version before touching the target; never upgrade the model version.
    const candidate=clone(source);candidate.Version=target.Version;
    const proof=particleModelDocument(candidate);
    proof.serialize('mdx');
    source=candidate;
  }
  const wrapper = createNode(target, 'Helper');
  wrapper.Name = recipe.name; wrapper.Parent = options.parent ?? null;
  const position = options.position || [0,0,0];
  if (position.length !== 3 || position.some(n => !Number.isFinite(n))) throw Error('Invalid effect anchor.');
  if (position.some(n => n !== 0)) wrapper.Translation = { LineType: 0, GlobalSeqId: null, Keys: [{ Frame: options.targetInterval?.[0] || 0, Vector: new Float32Array(position) }] };
  const result = copyEffectGraph(target, source, recipe.ingredients.map(item => item.objectId), { ...options, parent: wrapper.ObjectId });
  if(options.motion==='target')for(const [originalId,newId]of result.maps.nodes)if(!recipe.ingredients.some(item=>item.objectId===originalId)){const node=target.Nodes[newId];delete node.Translation;delete node.Rotation;delete node.Scaling;}
  
  return { ...result, anchorId: wrapper.ObjectId };
}
