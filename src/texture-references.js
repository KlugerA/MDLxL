const textureSlots = ['TextureID', 'NormalTextureID', 'ORMTextureID', 'EmissiveTextureID', 'TeamColorTextureID', 'ReflectionsTextureID'];

export function visitTextureReferences(model, visit) {
  const field = (owner, key) => {
    if (typeof owner._MdxDefaults?.[key] === 'number') visit(owner._MdxDefaults[key], next => { owner._MdxDefaults[key] = next; }, owner);
    const value = owner[key];
    if (typeof value === 'number') visit(value, next => { owner[key] = next; }, owner);
    else if (value?.Keys) for (const keyframe of value.Keys) for (const property of ['Vector', 'InTan', 'OutTan']) {
      const values = keyframe[property];
      if (values) for (let i = 0; i < values.length; i++) visit(values[i], next => { values[i] = next; }, owner);
    }
  };
  for (const material of model.Materials) for (const layer of material.Layers) for (const key of textureSlots) field(layer, key);
  for (const node of model.ParticleEmitters2 || []) field(node, 'TextureID');
}
