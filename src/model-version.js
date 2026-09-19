/** Conservative conversion contract: SD content crosses versions; HD-only
 * content blocks downgrade rather than silently discarding it.
 */
export function versionConversionIssues(model, target) {
  const issues=[];
  if (![800,1000].includes(target)) return ['Choose MDX800 or MDX1000.'];
  if (![800,1000].includes(model?.Version)) return ['Only editable MDX800 and MDX1000 models can be converted.'];
  if (target===model.Version) return issues;
  if (target===800) {
    for(const key of ['ParticleEmitterPopcorns','FaceFX','BindPoses']) if(model[key]?.length)issues.push(`${key} cannot be represented in MDX800.`);
    for(const [index,g] of (model.Geosets||[]).entries()) {
      for(const key of ['SkinWeights','Tangents']) if(g[key]?.length)issues.push(`Geoset ${index+1} has ${key}.`);
      if(g.LevelOfDetail>0 || g.Name)issues.push(`Geoset ${index+1} has authored level-of-detail data.`);
    }
    for(const [index,material] of (model.Materials||[]).entries()) {
      if(material.Shader)issues.push(`Material ${index+1} uses a shader.`);
      for(const layer of material.Layers||[]) {
        for(const key of ['NormalTextureID','ORMTextureID','EmissiveTextureID','TeamColorTextureID','ReflectionsTextureID']) if(layer[key]!=null)issues.push(`Material ${index+1} uses ${key}.`);
        const nondefault=(key,def)=>layer[key]!=null && (typeof layer[key]==='object' || layer[key]!==def);
        if(nondefault('EmissiveGain',1)||nondefault('FresnelOpacity',0)||nondefault('FresnelTeamColor',0)||layer.ShaderTypeId>0)issues.push(`Material ${index+1} has Reforged lighting properties.`);
        if(layer.FresnelColor && (layer.FresnelColor.Keys || Array.from(layer.FresnelColor).some(v=>v!==1)))issues.push(`Material ${index+1} has a Fresnel color.`);
      }
    }
  }
  return [...new Set(issues)];
}
export function normalizeVersionFields(model, target) {
  model.Version=target;
  if(target===1000) for(const g of model.Geosets||[]) if(g.LevelOfDetail==null)g.LevelOfDetail=0;
  if(target===800) {
    for(const g of model.Geosets||[]) {delete g.LevelOfDetail;delete g.Name;}
    for(const material of model.Materials||[]) {
      delete material.Shader;
      for(const layer of material.Layers||[]) for(const key of ['EmissiveGain','FresnelColor','FresnelOpacity','FresnelTeamColor','ShaderTypeId'])delete layer[key];
    }
  }
}
