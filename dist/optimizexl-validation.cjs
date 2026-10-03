var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// electron/optimizexl-validation.js
var optimizexl_validation_exports = {};
__export(optimizexl_validation_exports, {
  validateOptimizeXLCopies: () => validateOptimizeXLCopies
});
module.exports = __toCommonJS(optimizexl_validation_exports);

// src/model-version.js
function versionConversionIssues(model, target) {
  const issues = [];
  if (![800, 1e3].includes(target)) return ["Choose MDX800 or MDX1000."];
  if (![800, 1e3].includes(model?.Version)) return ["Only editable MDX800 and MDX1000 models can be converted."];
  if (target === model.Version) return issues;
  if (target === 800) {
    for (const key of ["ParticleEmitterPopcorns", "FaceFX", "BindPoses"]) if (model[key]?.length) issues.push(`${key} cannot be represented in MDX800.`);
    for (const [index2, g] of (model.Geosets || []).entries()) {
      for (const key of ["SkinWeights", "Tangents"]) if (g[key]?.length) issues.push(`Geoset ${index2 + 1} has ${key}.`);
      if (g.LevelOfDetail > 0 || g.Name) issues.push(`Geoset ${index2 + 1} has authored level-of-detail data.`);
    }
    for (const [index2, material] of (model.Materials || []).entries()) {
      if (material.Shader) issues.push(`Material ${index2 + 1} uses a shader.`);
      for (const layer of material.Layers || []) {
        for (const key of ["NormalTextureID", "ORMTextureID", "EmissiveTextureID", "TeamColorTextureID", "ReflectionsTextureID"]) if (layer[key] != null) issues.push(`Material ${index2 + 1} uses ${key}.`);
        const nondefault = (key, def) => layer[key] != null && (typeof layer[key] === "object" || layer[key] !== def);
        if (nondefault("EmissiveGain", 1) || nondefault("FresnelOpacity", 0) || nondefault("FresnelTeamColor", 0) || layer.ShaderTypeId > 0) issues.push(`Material ${index2 + 1} has Reforged lighting properties.`);
        if (layer.FresnelColor && (layer.FresnelColor.Keys || Array.from(layer.FresnelColor).some((v) => v !== 1))) issues.push(`Material ${index2 + 1} has a Fresnel color.`);
      }
    }
  }
  return [...new Set(issues)];
}
function normalizeVersionFields(model, target) {
  model.Version = target;
  if (target === 1e3) {
    for (const g of model.Geosets || []) if (g.LevelOfDetail == null) g.LevelOfDetail = 0;
  }
  if (target === 800) {
    for (const g of model.Geosets || []) {
      delete g.LevelOfDetail;
      delete g.Name;
    }
    for (const material of model.Materials || []) {
      delete material.Shader;
      for (const layer of material.Layers || []) for (const key of ["EmissiveGain", "FresnelColor", "FresnelOpacity", "FresnelTeamColor", "ShaderTypeId"]) delete layer[key];
    }
  }
}

// src/editor-document.js
var import_buffer9 = require("buffer");

// ../../../../../ChatGPT/MDLxL/node_modules/.pnpm/war3-model@4.0.1/node_modules/war3-model/dist/es/war3-model.mjs
var TextureFlags = /* @__PURE__ */ (function(TextureFlags2) {
  TextureFlags2[TextureFlags2["WrapWidth"] = 1] = "WrapWidth";
  TextureFlags2[TextureFlags2["WrapHeight"] = 2] = "WrapHeight";
  return TextureFlags2;
})({});
var FilterMode = /* @__PURE__ */ (function(FilterMode2) {
  FilterMode2[FilterMode2["None"] = 0] = "None";
  FilterMode2[FilterMode2["Transparent"] = 1] = "Transparent";
  FilterMode2[FilterMode2["Blend"] = 2] = "Blend";
  FilterMode2[FilterMode2["Additive"] = 3] = "Additive";
  FilterMode2[FilterMode2["AddAlpha"] = 4] = "AddAlpha";
  FilterMode2[FilterMode2["Modulate"] = 5] = "Modulate";
  FilterMode2[FilterMode2["Modulate2x"] = 6] = "Modulate2x";
  return FilterMode2;
})({});
var LineType = /* @__PURE__ */ (function(LineType2) {
  LineType2[LineType2["DontInterp"] = 0] = "DontInterp";
  LineType2[LineType2["Linear"] = 1] = "Linear";
  LineType2[LineType2["Hermite"] = 2] = "Hermite";
  LineType2[LineType2["Bezier"] = 3] = "Bezier";
  return LineType2;
})({});
var LayerShading = /* @__PURE__ */ (function(LayerShading2) {
  LayerShading2[LayerShading2["Unshaded"] = 1] = "Unshaded";
  LayerShading2[LayerShading2["SphereEnvMap"] = 2] = "SphereEnvMap";
  LayerShading2[LayerShading2["TwoSided"] = 16] = "TwoSided";
  LayerShading2[LayerShading2["Unfogged"] = 32] = "Unfogged";
  LayerShading2[LayerShading2["NoDepthTest"] = 64] = "NoDepthTest";
  LayerShading2[LayerShading2["NoDepthSet"] = 128] = "NoDepthSet";
  return LayerShading2;
})({});
var MaterialRenderMode = /* @__PURE__ */ (function(MaterialRenderMode2) {
  MaterialRenderMode2[MaterialRenderMode2["ConstantColor"] = 1] = "ConstantColor";
  MaterialRenderMode2[MaterialRenderMode2["SortPrimsFarZ"] = 16] = "SortPrimsFarZ";
  MaterialRenderMode2[MaterialRenderMode2["FullResolution"] = 32] = "FullResolution";
  return MaterialRenderMode2;
})({});
var GeosetAnimFlags = /* @__PURE__ */ (function(GeosetAnimFlags2) {
  GeosetAnimFlags2[GeosetAnimFlags2["DropShadow"] = 1] = "DropShadow";
  GeosetAnimFlags2[GeosetAnimFlags2["Color"] = 2] = "Color";
  return GeosetAnimFlags2;
})({});
var NodeFlags = /* @__PURE__ */ (function(NodeFlags2) {
  NodeFlags2[NodeFlags2["DontInheritTranslation"] = 1] = "DontInheritTranslation";
  NodeFlags2[NodeFlags2["DontInheritRotation"] = 2] = "DontInheritRotation";
  NodeFlags2[NodeFlags2["DontInheritScaling"] = 4] = "DontInheritScaling";
  NodeFlags2[NodeFlags2["Billboarded"] = 8] = "Billboarded";
  NodeFlags2[NodeFlags2["BillboardedLockX"] = 16] = "BillboardedLockX";
  NodeFlags2[NodeFlags2["BillboardedLockY"] = 32] = "BillboardedLockY";
  NodeFlags2[NodeFlags2["BillboardedLockZ"] = 64] = "BillboardedLockZ";
  NodeFlags2[NodeFlags2["CameraAnchored"] = 128] = "CameraAnchored";
  return NodeFlags2;
})({});
var NodeType = /* @__PURE__ */ (function(NodeType2) {
  NodeType2[NodeType2["Helper"] = 0] = "Helper";
  NodeType2[NodeType2["Bone"] = 256] = "Bone";
  NodeType2[NodeType2["Light"] = 512] = "Light";
  NodeType2[NodeType2["EventObject"] = 1024] = "EventObject";
  NodeType2[NodeType2["Attachment"] = 2048] = "Attachment";
  NodeType2[NodeType2["ParticleEmitter"] = 4096] = "ParticleEmitter";
  NodeType2[NodeType2["CollisionShape"] = 8192] = "CollisionShape";
  NodeType2[NodeType2["RibbonEmitter"] = 16384] = "RibbonEmitter";
  return NodeType2;
})({});
var CollisionShapeType = /* @__PURE__ */ (function(CollisionShapeType2) {
  CollisionShapeType2[CollisionShapeType2["Box"] = 0] = "Box";
  CollisionShapeType2[CollisionShapeType2["Sphere"] = 2] = "Sphere";
  return CollisionShapeType2;
})({});
var ParticleEmitterFlags = /* @__PURE__ */ (function(ParticleEmitterFlags2) {
  ParticleEmitterFlags2[ParticleEmitterFlags2["EmitterUsesMDL"] = 32768] = "EmitterUsesMDL";
  ParticleEmitterFlags2[ParticleEmitterFlags2["EmitterUsesTGA"] = 65536] = "EmitterUsesTGA";
  return ParticleEmitterFlags2;
})({});
var ParticleEmitter2Flags = /* @__PURE__ */ (function(ParticleEmitter2Flags2) {
  ParticleEmitter2Flags2[ParticleEmitter2Flags2["Unshaded"] = 32768] = "Unshaded";
  ParticleEmitter2Flags2[ParticleEmitter2Flags2["SortPrimsFarZ"] = 65536] = "SortPrimsFarZ";
  ParticleEmitter2Flags2[ParticleEmitter2Flags2["LineEmitter"] = 131072] = "LineEmitter";
  ParticleEmitter2Flags2[ParticleEmitter2Flags2["Unfogged"] = 262144] = "Unfogged";
  ParticleEmitter2Flags2[ParticleEmitter2Flags2["ModelSpace"] = 524288] = "ModelSpace";
  ParticleEmitter2Flags2[ParticleEmitter2Flags2["XYQuad"] = 1048576] = "XYQuad";
  return ParticleEmitter2Flags2;
})({});
var ParticleEmitter2FilterMode = /* @__PURE__ */ (function(ParticleEmitter2FilterMode2) {
  ParticleEmitter2FilterMode2[ParticleEmitter2FilterMode2["Blend"] = 0] = "Blend";
  ParticleEmitter2FilterMode2[ParticleEmitter2FilterMode2["Additive"] = 1] = "Additive";
  ParticleEmitter2FilterMode2[ParticleEmitter2FilterMode2["Modulate"] = 2] = "Modulate";
  ParticleEmitter2FilterMode2[ParticleEmitter2FilterMode2["Modulate2x"] = 3] = "Modulate2x";
  ParticleEmitter2FilterMode2[ParticleEmitter2FilterMode2["AlphaKey"] = 4] = "AlphaKey";
  return ParticleEmitter2FilterMode2;
})({});
var ParticleEmitter2FramesFlags = /* @__PURE__ */ (function(ParticleEmitter2FramesFlags2) {
  ParticleEmitter2FramesFlags2[ParticleEmitter2FramesFlags2["Head"] = 1] = "Head";
  ParticleEmitter2FramesFlags2[ParticleEmitter2FramesFlags2["Tail"] = 2] = "Tail";
  return ParticleEmitter2FramesFlags2;
})({});
var LightType = /* @__PURE__ */ (function(LightType2) {
  LightType2[LightType2["Omnidirectional"] = 0] = "Omnidirectional";
  LightType2[LightType2["Directional"] = 1] = "Directional";
  LightType2[LightType2["Ambient"] = 2] = "Ambient";
  return LightType2;
})({});
var ParticleEmitterPopcornFlags = /* @__PURE__ */ (function(ParticleEmitterPopcornFlags2) {
  ParticleEmitterPopcornFlags2[ParticleEmitterPopcornFlags2["Unshaded"] = 32768] = "Unshaded";
  ParticleEmitterPopcornFlags2[ParticleEmitterPopcornFlags2["SortPrimsFarZ"] = 65536] = "SortPrimsFarZ";
  ParticleEmitterPopcornFlags2[ParticleEmitterPopcornFlags2["Unfogged"] = 262144] = "Unfogged";
  return ParticleEmitterPopcornFlags2;
})({});
var LAYER_TEXTURE_NAME_MAP = {
  "TextureID": 0,
  "NormalTextureID": 1,
  "ORMTextureID": 2,
  "EmissiveTextureID": 3,
  "TeamColorTextureID": 4,
  "ReflectionsTextureID": 5
};
var LAYER_TEXTURE_ID_MAP = [
  "TextureID",
  "NormalTextureID",
  "ORMTextureID",
  "EmissiveTextureID",
  "TeamColorTextureID",
  "ReflectionsTextureID"
];
var State$1 = class {
  constructor(str2) {
    this.str = str2;
    this.pos = 0;
  }
  char() {
    if (this.pos >= this.str.length) throwError(this, "incorrect model data");
    return this.str[this.pos];
  }
};
function throwError(state, str2 = "") {
  throw new Error(`SyntaxError, near ${state.pos}` + (str2 ? ", " + str2 : ""));
}
function parseComment(state) {
  if (state.char() === "/" && state.str[state.pos + 1] === "/") {
    state.pos += 2;
    while (state.pos < state.str.length && state.str[++state.pos] !== "\n") ;
    ++state.pos;
    return true;
  }
  return false;
}
var spaceRE = /\s/i;
function parseSpace(state) {
  while (state.pos < state.str.length && spaceRE.test(state.char())) ++state.pos;
}
var keywordFirstCharRE = /[a-z]/i;
var keywordOtherCharRE = /[a-z0-9]/i;
function parseKeyword(state) {
  if (!keywordFirstCharRE.test(state.char())) return null;
  let keyword = state.char();
  ++state.pos;
  while (keywordOtherCharRE.test(state.char())) keyword += state.str[state.pos++];
  parseSpace(state);
  return keyword;
}
function parseSymbol(state, symbol) {
  if (state.char() === symbol) {
    ++state.pos;
    parseSpace(state);
  }
}
function strictParseSymbol(state, symbol) {
  if (state.char() !== symbol) throwError(state, `extected ${symbol}`);
  ++state.pos;
  parseSpace(state);
}
function parseString(state) {
  if (state.char() === '"') {
    const start = ++state.pos;
    while (state.char() !== '"') ++state.pos;
    ++state.pos;
    const res = state.str.substring(start, state.pos - 1);
    parseSpace(state);
    return res;
  }
  return null;
}
var numberFirstCharRE = /[-0-9]/;
var numberOtherCharRE = /[-+.0-9e]/i;
function parseNumber(state) {
  if (numberFirstCharRE.test(state.char())) {
    const start = state.pos;
    ++state.pos;
    while (numberOtherCharRE.test(state.char())) ++state.pos;
    const res = parseFloat(state.str.substring(start, state.pos));
    parseSpace(state);
    return res;
  }
  return null;
}
function parseArray(state, arr, pos) {
  if (state.char() !== "{") return null;
  if (!arr) {
    arr = [];
    pos = 0;
  }
  strictParseSymbol(state, "{");
  while (state.char() !== "}") {
    const num = parseNumber(state);
    if (num === null) throwError(state, "expected number");
    arr[pos++] = num;
    parseSymbol(state, ",");
  }
  strictParseSymbol(state, "}");
  return arr;
}
function parseArrayCounted(state, arr, pos) {
  if (state.char() !== "{") return 0;
  const start = pos;
  strictParseSymbol(state, "{");
  while (state.char() !== "}") {
    const num = parseNumber(state);
    if (num === null) throwError(state, "expected number");
    arr[pos++] = num;
    parseSymbol(state, ",");
  }
  strictParseSymbol(state, "}");
  return pos - start;
}
function parseArrayOrSingleItem(state, arr) {
  if (state.char() !== "{") {
    arr[0] = parseNumber(state);
    return arr;
  }
  let pos = 0;
  strictParseSymbol(state, "{");
  while (state.char() !== "}") {
    const num = parseNumber(state);
    if (num === null) throwError(state, "expected number");
    arr[pos++] = num;
    parseSymbol(state, ",");
  }
  strictParseSymbol(state, "}");
  return arr;
}
function parseObject(state) {
  let prefix = null;
  const obj = {};
  if (state.char() !== "{") {
    prefix = parseString(state);
    if (prefix === null) prefix = parseNumber(state);
    if (prefix === null) throwError(state, "expected string or number");
  }
  strictParseSymbol(state, "{");
  while (state.char() !== "}") {
    const keyword = parseKeyword(state);
    if (!keyword) throwError(state);
    if (keyword === "Interval") obj[keyword] = parseArray(state, new Uint32Array(2), 0);
    else if (keyword === "MinimumExtent" || keyword === "MaximumExtent") obj[keyword] = parseArray(state, new Float32Array(3), 0);
    else {
      obj[keyword] = parseArray(state) || parseString(state);
      if (obj[keyword] === null) obj[keyword] = parseNumber(state);
    }
    parseSymbol(state, ",");
  }
  strictParseSymbol(state, "}");
  return [prefix, obj];
}
function parseVersion$1(state, model) {
  const [_unused, obj] = parseObject(state);
  if (obj.FormatVersion) model.Version = obj.FormatVersion;
}
function parseModelInfo$1(state, model) {
  const [name, obj] = parseObject(state);
  model.Info = obj;
  model.Info.Name = name;
}
function parseSequences$1(state, model) {
  parseNumber(state);
  strictParseSymbol(state, "{");
  const res = [];
  while (state.char() !== "}") {
    parseKeyword(state);
    const [name, obj] = parseObject(state);
    obj.Name = name;
    obj.NonLooping = "NonLooping" in obj;
    obj.MoveSpeed = obj.MoveSpeed || 0;
    obj.Rarity = obj.Rarity || 0;
    res.push(obj);
  }
  strictParseSymbol(state, "}");
  model.Sequences = res;
}
function parseTextures$1(state, model) {
  const res = [];
  parseNumber(state);
  strictParseSymbol(state, "{");
  while (state.char() !== "}") {
    parseKeyword(state);
    const [_unused, obj] = parseObject(state);
    obj.Flags = 0;
    if ("WrapWidth" in obj) {
      obj.Flags += TextureFlags.WrapWidth;
      delete obj.WrapWidth;
    }
    if ("WrapHeight" in obj) {
      obj.Flags += TextureFlags.WrapHeight;
      delete obj.WrapHeight;
    }
    res.push(obj);
  }
  strictParseSymbol(state, "}");
  model.Textures = res;
}
var AnimVectorType$2 = /* @__PURE__ */ (function(AnimVectorType2) {
  AnimVectorType2[AnimVectorType2["INT1"] = 0] = "INT1";
  AnimVectorType2[AnimVectorType2["FLOAT1"] = 1] = "FLOAT1";
  AnimVectorType2[AnimVectorType2["FLOAT3"] = 2] = "FLOAT3";
  AnimVectorType2[AnimVectorType2["FLOAT4"] = 3] = "FLOAT4";
  return AnimVectorType2;
})(AnimVectorType$2 || {});
var animVectorSize$2 = {
  [AnimVectorType$2.INT1]: 1,
  [AnimVectorType$2.FLOAT1]: 1,
  [AnimVectorType$2.FLOAT3]: 3,
  [AnimVectorType$2.FLOAT4]: 4
};
function parseAnimKeyframe(state, frame, type, lineType) {
  const res = {
    Frame: frame,
    Vector: null
  };
  const Vector = type === AnimVectorType$2.INT1 ? Int32Array : Float32Array;
  const itemCount = animVectorSize$2[type];
  res.Vector = parseArrayOrSingleItem(state, new Vector(itemCount));
  strictParseSymbol(state, ",");
  if (lineType === LineType.Hermite || lineType === LineType.Bezier) {
    parseKeyword(state);
    res.InTan = parseArrayOrSingleItem(state, new Vector(itemCount));
    strictParseSymbol(state, ",");
    parseKeyword(state);
    res.OutTan = parseArrayOrSingleItem(state, new Vector(itemCount));
    strictParseSymbol(state, ",");
  }
  return res;
}
function parseAnimVector(state, type) {
  const animVector = {
    LineType: LineType.DontInterp,
    GlobalSeqId: null,
    Keys: []
  };
  parseNumber(state);
  strictParseSymbol(state, "{");
  const lineType = parseKeyword(state);
  if (lineType === "DontInterp" || lineType === "Linear" || lineType === "Hermite" || lineType === "Bezier") animVector.LineType = LineType[lineType];
  strictParseSymbol(state, ",");
  while (state.char() !== "}") {
    const keyword = parseKeyword(state);
    if (keyword === "GlobalSeqId") {
      animVector[keyword] = parseNumber(state);
      strictParseSymbol(state, ",");
    } else {
      const frame = parseNumber(state);
      if (frame === null) throwError(state, "expected frame number or GlobalSeqId");
      strictParseSymbol(state, ":");
      animVector.Keys.push(parseAnimKeyframe(state, frame, type, animVector.LineType));
    }
  }
  strictParseSymbol(state, "}");
  return animVector;
}
function parseLayer(state, model) {
  const res = {
    Alpha: null,
    TVertexAnimId: null,
    Shading: 0,
    CoordId: 0
  };
  strictParseSymbol(state, "{");
  while (state.char() !== "}") {
    let keyword = parseKeyword(state);
    let isStatic = false;
    if (!keyword) throwError(state);
    if (keyword === "static") {
      isStatic = true;
      keyword = parseKeyword(state);
    }
    if (!isStatic && (keyword === "TextureID" || model.Version >= 1100 && keyword in LAYER_TEXTURE_NAME_MAP)) res[keyword] = parseAnimVector(state, AnimVectorType$2.INT1);
    else if (!isStatic && keyword === "Alpha") res[keyword] = parseAnimVector(state, AnimVectorType$2.FLOAT1);
    else if (keyword === "Unshaded" || keyword === "SphereEnvMap" || keyword === "TwoSided" || keyword === "Unfogged" || keyword === "NoDepthTest" || keyword === "NoDepthSet") res.Shading |= LayerShading[keyword];
    else if (keyword === "FilterMode") {
      const val = parseKeyword(state);
      if (val === "None" || val === "Transparent" || val === "Blend" || val === "Additive" || val === "AddAlpha" || val === "Modulate" || val === "Modulate2x") res.FilterMode = FilterMode[val];
    } else if (keyword === "TVertexAnimId") res.TVertexAnimId = parseNumber(state);
    else if (model.Version >= 900 && keyword === "EmissiveGain") if (isStatic) res[keyword] = parseNumber(state);
    else res[keyword] = parseAnimVector(state, AnimVectorType$2.FLOAT1);
    else if (model.Version >= 1e3 && keyword === "FresnelColor") if (isStatic) res[keyword] = parseArray(state, new Float32Array(3), 0);
    else res[keyword] = parseAnimVector(state, AnimVectorType$2.FLOAT3);
    else if (model.Version >= 1e3 && (keyword === "FresnelOpacity" || keyword === "FresnelTeamColor")) if (isStatic) res[keyword] = parseNumber(state);
    else res[keyword] = parseAnimVector(state, AnimVectorType$2.FLOAT1);
    else {
      let val = parseNumber(state);
      if (val === null) val = parseKeyword(state);
      res[keyword] = val;
    }
    parseSymbol(state, ",");
    parseComment(state);
    parseSpace(state);
  }
  strictParseSymbol(state, "}");
  return res;
}
function parseMaterials$1(state, model) {
  const res = [];
  parseNumber(state);
  strictParseSymbol(state, "{");
  while (state.char() !== "}") {
    const obj = {
      RenderMode: 0,
      Layers: []
    };
    parseKeyword(state);
    strictParseSymbol(state, "{");
    while (state.char() !== "}") {
      const keyword = parseKeyword(state);
      if (!keyword) throwError(state);
      if (keyword === "Layer") obj.Layers.push(parseLayer(state, model));
      else if (keyword === "PriorityPlane" || keyword === "RenderMode") obj[keyword] = parseNumber(state);
      else if (keyword === "ConstantColor" || keyword === "SortPrimsFarZ" || keyword === "FullResolution") obj.RenderMode |= MaterialRenderMode[keyword];
      else if (model.Version >= 900 && model.Version <= 1100 && keyword === "Shader") obj[keyword] = parseString(state);
      else throw new Error("Unknown material property " + keyword);
      parseSymbol(state, ",");
    }
    strictParseSymbol(state, "}");
    res.push(obj);
  }
  strictParseSymbol(state, "}");
  model.Materials = res;
}
var GeosetPartType = /* @__PURE__ */ (function(GeosetPartType2) {
  GeosetPartType2[GeosetPartType2["INT"] = 0] = "INT";
  GeosetPartType2[GeosetPartType2["FLOAT"] = 1] = "FLOAT";
  return GeosetPartType2;
})(GeosetPartType || {});
function parseGeosetPart(state, countPerObj, type) {
  const count = parseNumber(state);
  const arr = new (type === GeosetPartType.FLOAT ? Float32Array : Uint8Array)(count * countPerObj);
  strictParseSymbol(state, "{");
  for (let index2 = 0; index2 < count; ++index2) {
    parseArray(state, arr, index2 * countPerObj);
    strictParseSymbol(state, ",");
  }
  strictParseSymbol(state, "}");
  return arr;
}
function parseGeoset(state, model) {
  const res = {
    Vertices: null,
    Normals: null,
    TVertices: [],
    VertexGroup: new Uint8Array(0),
    Faces: null,
    Groups: null,
    TotalGroupsCount: null,
    MinimumExtent: null,
    MaximumExtent: null,
    BoundsRadius: 0,
    Anims: [],
    MaterialID: null,
    SelectionGroup: null,
    Unselectable: false
  };
  strictParseSymbol(state, "{");
  while (state.char() !== "}") {
    const keyword = parseKeyword(state);
    if (!keyword) throwError(state);
    if (keyword === "Vertices" || keyword === "Normals" || keyword === "TVertices") {
      let countPerObj = 3;
      if (keyword === "TVertices") countPerObj = 2;
      const arr = parseGeosetPart(state, countPerObj, GeosetPartType.FLOAT);
      if (keyword === "TVertices") res.TVertices.push(arr);
      else res[keyword] = arr;
    } else if (keyword === "VertexGroup") {
      res[keyword] = new Uint8Array(res.Vertices.length / 3);
      parseArray(state, res[keyword], 0);
    } else if (keyword === "Faces") {
      const groupCount = parseNumber(state);
      const indexCount = parseNumber(state);
      let pos = 0;
      res.Faces = new Uint16Array(indexCount);
      strictParseSymbol(state, "{");
      if (parseKeyword(state) !== "Triangles") throwError(state, "unexpected faces type");
      strictParseSymbol(state, "{");
      for (let g = 0; g < groupCount; ++g) {
        const count = parseArrayCounted(state, res.Faces, pos);
        if (!count) throwError(state, "expected array");
        pos += count;
        parseSymbol(state, ",");
      }
      if (pos !== indexCount || indexCount % 3 !== 0) throwError(state, "mismatched faces array");
      strictParseSymbol(state, "}");
      strictParseSymbol(state, "}");
    } else if (keyword === "Groups") {
      const groups = [];
      parseNumber(state);
      res.TotalGroupsCount = parseNumber(state);
      strictParseSymbol(state, "{");
      while (state.char() !== "}") {
        parseKeyword(state);
        groups.push(parseArray(state));
        parseSymbol(state, ",");
      }
      strictParseSymbol(state, "}");
      res.Groups = groups;
    } else if (keyword === "MinimumExtent" || keyword === "MaximumExtent") {
      res[keyword] = parseArray(state, new Float32Array(3), 0);
      strictParseSymbol(state, ",");
    } else if (keyword === "BoundsRadius" || keyword === "MaterialID" || keyword === "SelectionGroup") {
      res[keyword] = parseNumber(state);
      strictParseSymbol(state, ",");
    } else if (keyword === "Anim") {
      const [_unused, obj] = parseObject(state);
      if (obj.Alpha === void 0) obj.Alpha = 1;
      res.Anims.push(obj);
    } else if (keyword === "Unselectable") {
      res.Unselectable = true;
      strictParseSymbol(state, ",");
    } else if (model.Version >= 900) {
      if (keyword === "LevelOfDetail") {
        res.LevelOfDetail = parseNumber(state);
        strictParseSymbol(state, ",");
      } else if (keyword === "Name") {
        res.Name = parseString(state);
        strictParseSymbol(state, ",");
      } else if (keyword === "Tangents") res.Tangents = parseGeosetPart(state, 4, GeosetPartType.FLOAT);
      else if (keyword === "SkinWeights") res.SkinWeights = parseGeosetPart(state, 8, GeosetPartType.INT);
    }
  }
  strictParseSymbol(state, "}");
  model.Geosets.push(res);
}
function parseGeosetAnim(state, model) {
  const res = {
    GeosetId: -1,
    Alpha: 1,
    Color: null,
    Flags: 0
  };
  strictParseSymbol(state, "{");
  while (state.char() !== "}") {
    let keyword = parseKeyword(state);
    let isStatic = false;
    if (!keyword) throwError(state);
    if (keyword === "static") {
      isStatic = true;
      keyword = parseKeyword(state);
    }
    if (keyword === "Alpha") if (isStatic) res.Alpha = parseNumber(state);
    else res.Alpha = parseAnimVector(state, AnimVectorType$2.FLOAT1);
    else if (keyword === "Color") if (isStatic) {
      res.Color = parseArray(state, new Float32Array(3), 0);
      res.Color.reverse();
    } else {
      res.Color = parseAnimVector(state, AnimVectorType$2.FLOAT3);
      for (const key of res.Color.Keys) {
        key.Vector.reverse();
        if (key.InTan) {
          key.InTan.reverse();
          key.OutTan.reverse();
        }
      }
    }
    else if (keyword === "DropShadow") res.Flags |= GeosetAnimFlags[keyword];
    else res[keyword] = parseNumber(state);
    parseSymbol(state, ",");
  }
  strictParseSymbol(state, "}");
  model.GeosetAnims.push(res);
}
function parseNode$1(state, type, model) {
  const node = {
    Name: parseString(state),
    ObjectId: null,
    Parent: null,
    PivotPoint: null,
    Flags: NodeType[type]
  };
  strictParseSymbol(state, "{");
  while (state.char() !== "}") {
    const keyword = parseKeyword(state);
    if (!keyword) throwError(state);
    if (keyword === "Translation" || keyword === "Rotation" || keyword === "Scaling" || keyword === "Visibility") {
      let vectorType = AnimVectorType$2.FLOAT3;
      if (keyword === "Rotation") vectorType = AnimVectorType$2.FLOAT4;
      else if (keyword === "Visibility") vectorType = AnimVectorType$2.FLOAT1;
      node[keyword] = parseAnimVector(state, vectorType);
    } else if (keyword === "BillboardedLockZ" || keyword === "BillboardedLockY" || keyword === "BillboardedLockX" || keyword === "Billboarded" || keyword === "CameraAnchored") node.Flags |= NodeFlags[keyword];
    else if (keyword === "DontInherit") {
      strictParseSymbol(state, "{");
      const val = parseKeyword(state);
      if (val === "Translation") node.Flags |= NodeFlags.DontInheritTranslation;
      else if (val === "Rotation") node.Flags |= NodeFlags.DontInheritRotation;
      else if (val === "Scaling") node.Flags |= NodeFlags.DontInheritScaling;
      strictParseSymbol(state, "}");
    } else if (keyword === "Path") node[keyword] = parseString(state);
    else {
      let val = parseKeyword(state) || parseNumber(state);
      if (keyword === "GeosetId" && val === "Multiple" || keyword === "GeosetAnimId" && val === "None") val = null;
      node[keyword] = val;
    }
    parseSymbol(state, ",");
    parseComment(state);
    parseSpace(state);
  }
  strictParseSymbol(state, "}");
  model.Nodes[node.ObjectId] = node;
  return node;
}
function parseBone(state, model) {
  const node = parseNode$1(state, "Bone", model);
  model.Bones.push(node);
}
function parseHelper(state, model) {
  const node = parseNode$1(state, "Helper", model);
  model.Helpers.push(node);
}
function parseAttachment(state, model) {
  const node = parseNode$1(state, "Attachment", model);
  model.Attachments.push(node);
}
function parsePivotPoints$1(state, model) {
  const count = parseNumber(state);
  const res = [];
  strictParseSymbol(state, "{");
  for (let i = 0; i < count; ++i) {
    res.push(parseArray(state, new Float32Array(3), 0));
    strictParseSymbol(state, ",");
  }
  strictParseSymbol(state, "}");
  model.PivotPoints = res;
}
function parseEventObject(state, model) {
  const res = {
    Name: parseString(state),
    ObjectId: null,
    Parent: null,
    PivotPoint: null,
    EventTrack: null,
    Flags: NodeType.EventObject
  };
  strictParseSymbol(state, "{");
  while (state.char() !== "}") {
    const keyword = parseKeyword(state);
    if (!keyword) throwError(state);
    if (keyword === "EventTrack") {
      const count = parseNumber(state);
      res.EventTrack = parseArray(state, new Uint32Array(count), 0);
    } else if (keyword === "Translation" || keyword === "Rotation" || keyword === "Scaling") res[keyword] = parseAnimVector(state, keyword === "Rotation" ? AnimVectorType$2.FLOAT4 : AnimVectorType$2.FLOAT3);
    else res[keyword] = parseNumber(state);
    parseSymbol(state, ",");
  }
  strictParseSymbol(state, "}");
  model.EventObjects.push(res);
  model.Nodes[res.ObjectId] = res;
}
function parseCollisionShape(state, model) {
  const res = {
    Name: parseString(state),
    ObjectId: null,
    Parent: null,
    PivotPoint: null,
    Shape: CollisionShapeType.Box,
    Vertices: null,
    Flags: NodeType.CollisionShape
  };
  strictParseSymbol(state, "{");
  while (state.char() !== "}") {
    const keyword = parseKeyword(state);
    if (!keyword) throwError(state);
    if (keyword === "Sphere") res.Shape = CollisionShapeType.Sphere;
    else if (keyword === "Box") res.Shape = CollisionShapeType.Box;
    else if (keyword === "Vertices") {
      const count = parseNumber(state);
      const vertices = new Float32Array(count * 3);
      strictParseSymbol(state, "{");
      for (let i = 0; i < count; ++i) {
        parseArray(state, vertices, i * 3);
        strictParseSymbol(state, ",");
      }
      strictParseSymbol(state, "}");
      res.Vertices = vertices;
    } else if (keyword === "Translation" || keyword === "Rotation" || keyword === "Scaling") res[keyword] = parseAnimVector(state, keyword === "Rotation" ? AnimVectorType$2.FLOAT4 : AnimVectorType$2.FLOAT3);
    else res[keyword] = parseNumber(state);
    parseSymbol(state, ",");
  }
  strictParseSymbol(state, "}");
  model.CollisionShapes.push(res);
  model.Nodes[res.ObjectId] = res;
}
function parseGlobalSequences$1(state, model) {
  const res = [];
  const count = parseNumber(state);
  strictParseSymbol(state, "{");
  for (let i = 0; i < count; ++i) {
    if (parseKeyword(state) === "Duration") res.push(parseNumber(state));
    parseSymbol(state, ",");
  }
  strictParseSymbol(state, "}");
  model.GlobalSequences = res;
}
function parseUnknownBlock(state) {
  let opened;
  while (state.char() !== void 0 && state.char() !== "{") ++state.pos;
  opened = 1;
  ++state.pos;
  while (state.char() !== void 0 && opened > 0) {
    if (state.char() === "{") ++opened;
    else if (state.char() === "}") --opened;
    ++state.pos;
  }
  parseSpace(state);
}
function parseParticleEmitter(state, model) {
  const res = {
    ObjectId: null,
    Parent: null,
    Name: null,
    Flags: 0
  };
  res.Name = parseString(state);
  strictParseSymbol(state, "{");
  while (state.char() !== "}") {
    let keyword = parseKeyword(state);
    let isStatic = false;
    if (!keyword) throwError(state);
    if (keyword === "static") {
      isStatic = true;
      keyword = parseKeyword(state);
    }
    if (keyword === "ObjectId" || keyword === "Parent") res[keyword] = parseNumber(state);
    else if (keyword === "EmitterUsesMDL" || keyword === "EmitterUsesTGA") res.Flags |= ParticleEmitterFlags[keyword];
    else if (!isStatic && (keyword === "Visibility" || keyword === "Translation" || keyword === "Rotation" || keyword === "Scaling" || keyword === "EmissionRate" || keyword === "Gravity" || keyword === "Longitude" || keyword === "Latitude")) {
      let type = AnimVectorType$2.FLOAT3;
      if (keyword === "Visibility" || keyword === "EmissionRate" || keyword === "Gravity" || keyword === "Longitude" || keyword === "Latitude") type = AnimVectorType$2.FLOAT1;
      else if (keyword === "Rotation") type = AnimVectorType$2.FLOAT4;
      res[keyword] = parseAnimVector(state, type);
    } else if (keyword === "Particle") {
      strictParseSymbol(state, "{");
      while (state.char() !== "}") {
        let keyword2 = parseKeyword(state);
        let isStatic2 = false;
        if (keyword2 === "static") {
          isStatic2 = true;
          keyword2 = parseKeyword(state);
        }
        if (!isStatic2 && (keyword2 === "LifeSpan" || keyword2 === "InitVelocity")) res[keyword2] = parseAnimVector(state, AnimVectorType$2.FLOAT1);
        else if (keyword2 === "LifeSpan" || keyword2 === "InitVelocity") res[keyword2] = parseNumber(state);
        else if (keyword2 === "Path") res.Path = parseString(state);
        parseSymbol(state, ",");
      }
      strictParseSymbol(state, "}");
    } else res[keyword] = parseNumber(state);
    parseSymbol(state, ",");
  }
  strictParseSymbol(state, "}");
  model.ParticleEmitters.push(res);
}
function parseParticleEmitter2(state, model) {
  const res = {
    Name: parseString(state),
    ObjectId: null,
    Parent: null,
    PivotPoint: null,
    Flags: NodeType.ParticleEmitter,
    FrameFlags: 0
  };
  strictParseSymbol(state, "{");
  while (state.char() !== "}") {
    let keyword = parseKeyword(state);
    let isStatic = false;
    if (!keyword) throwError(state);
    if (keyword === "static") {
      isStatic = true;
      keyword = parseKeyword(state);
    }
    if (!isStatic && (keyword === "Speed" || keyword === "Latitude" || keyword === "Visibility" || keyword === "EmissionRate" || keyword === "Width" || keyword === "Length" || keyword === "Translation" || keyword === "Rotation" || keyword === "Scaling" || keyword === "Gravity" || keyword === "Variation")) {
      let type = AnimVectorType$2.FLOAT3;
      switch (keyword) {
        case "Rotation":
          type = AnimVectorType$2.FLOAT4;
          break;
        case "Speed":
        case "Latitude":
        case "Visibility":
        case "EmissionRate":
        case "Width":
        case "Length":
        case "Gravity":
        case "Variation":
          type = AnimVectorType$2.FLOAT1;
          break;
      }
      res[keyword] = parseAnimVector(state, type);
    } else if (keyword === "Variation" || keyword === "Gravity" || keyword === "ReplaceableId" || keyword === "PriorityPlane") res[keyword] = parseNumber(state);
    else if (keyword === "SortPrimsFarZ" || keyword === "Unshaded" || keyword === "LineEmitter" || keyword === "Unfogged" || keyword === "ModelSpace" || keyword === "XYQuad") res.Flags |= ParticleEmitter2Flags[keyword];
    else if (keyword === "Both") res.FrameFlags |= ParticleEmitter2FramesFlags.Head | ParticleEmitter2FramesFlags.Tail;
    else if (keyword === "Head" || keyword === "Tail") res.FrameFlags |= ParticleEmitter2FramesFlags[keyword];
    else if (keyword === "Squirt") res[keyword] = true;
    else if (keyword === "DontInherit") {
      strictParseSymbol(state, "{");
      const val = parseKeyword(state);
      if (val === "Translation") res.Flags |= NodeFlags.DontInheritTranslation;
      else if (val === "Rotation") res.Flags |= NodeFlags.DontInheritRotation;
      else if (val === "Scaling") res.Flags |= NodeFlags.DontInheritScaling;
      strictParseSymbol(state, "}");
    } else if (keyword === "SegmentColor") {
      const colors = [];
      strictParseSymbol(state, "{");
      while (state.char() !== "}") {
        parseKeyword(state);
        const colorArr = new Float32Array(3);
        parseArray(state, colorArr, 0);
        const temp = colorArr[0];
        colorArr[0] = colorArr[2];
        colorArr[2] = temp;
        colors.push(colorArr);
        parseSymbol(state, ",");
      }
      strictParseSymbol(state, "}");
      res.SegmentColor = colors;
    } else if (keyword === "Alpha") {
      res.Alpha = new Uint8Array(3);
      parseArray(state, res.Alpha, 0);
    } else if (keyword === "ParticleScaling") {
      res[keyword] = new Float32Array(3);
      parseArray(state, res[keyword], 0);
    } else if (keyword === "LifeSpanUVAnim" || keyword === "DecayUVAnim" || keyword === "TailUVAnim" || keyword === "TailDecayUVAnim") {
      res[keyword] = new Uint32Array(3);
      parseArray(state, res[keyword], 0);
    } else if (keyword === "Transparent" || keyword === "Blend" || keyword === "Additive" || keyword === "AlphaKey" || keyword === "Modulate" || keyword === "Modulate2x") res.FilterMode = ParticleEmitter2FilterMode[keyword];
    else res[keyword] = parseNumber(state);
    parseSymbol(state, ",");
  }
  strictParseSymbol(state, "}");
  model.ParticleEmitters2.push(res);
  model.Nodes[res.ObjectId] = res;
}
function parseCamera(state, model) {
  const res = {
    Name: null,
    Position: null,
    FieldOfView: 0,
    NearClip: 0,
    FarClip: 0,
    TargetPosition: null
  };
  res.Name = parseString(state);
  strictParseSymbol(state, "{");
  while (state.char() !== "}") {
    const keyword = parseKeyword(state);
    if (!keyword) throwError(state);
    if (keyword === "Position") {
      res.Position = new Float32Array(3);
      parseArray(state, res.Position, 0);
    } else if (keyword === "FieldOfView" || keyword === "NearClip" || keyword === "FarClip") res[keyword] = parseNumber(state);
    else if (keyword === "Target") {
      strictParseSymbol(state, "{");
      while (state.char() !== "}") {
        const keyword2 = parseKeyword(state);
        if (keyword2 === "Position") {
          res.TargetPosition = new Float32Array(3);
          parseArray(state, res.TargetPosition, 0);
        } else if (keyword2 === "Translation") res.TargetTranslation = parseAnimVector(state, AnimVectorType$2.FLOAT3);
        parseSymbol(state, ",");
      }
      strictParseSymbol(state, "}");
    } else if (keyword === "Translation" || keyword === "Rotation") res[keyword] = parseAnimVector(state, keyword === "Rotation" ? AnimVectorType$2.FLOAT1 : AnimVectorType$2.FLOAT3);
    parseSymbol(state, ",");
  }
  strictParseSymbol(state, "}");
  model.Cameras.push(res);
}
function parseLight(state, model) {
  const res = {
    Name: parseString(state),
    ObjectId: null,
    Parent: null,
    PivotPoint: null,
    Flags: NodeType.Light,
    LightType: 0
  };
  strictParseSymbol(state, "{");
  while (state.char() !== "}") {
    let keyword = parseKeyword(state);
    let isStatic = false;
    if (!keyword) throwError(state);
    if (keyword === "static") {
      isStatic = true;
      keyword = parseKeyword(state);
    }
    if (!isStatic && (keyword === "Visibility" || keyword === "Color" || keyword === "Intensity" || keyword === "AmbIntensity" || keyword === "AmbColor" || keyword === "Translation" || keyword === "Rotation" || keyword === "Scaling" || keyword === "AttenuationStart" || keyword === "AttenuationEnd")) {
      let type = AnimVectorType$2.FLOAT3;
      switch (keyword) {
        case "Rotation":
          type = AnimVectorType$2.FLOAT4;
          break;
        case "Visibility":
        case "Intensity":
        case "AmbIntensity":
        case "AttenuationStart":
        case "AttenuationEnd":
          type = AnimVectorType$2.FLOAT1;
          break;
      }
      res[keyword] = parseAnimVector(state, type);
      if (keyword === "Color" || keyword === "AmbColor") for (const key of res[keyword].Keys) {
        key.Vector.reverse();
        if (key.InTan) {
          key.InTan.reverse();
          key.OutTan.reverse();
        }
      }
    } else if (keyword === "Omnidirectional" || keyword === "Directional" || keyword === "Ambient") res.LightType = LightType[keyword];
    else if (keyword === "Color" || keyword === "AmbColor") {
      const color2 = new Float32Array(3);
      parseArray(state, color2, 0);
      const temp = color2[0];
      color2[0] = color2[2];
      color2[2] = temp;
      res[keyword] = color2;
    } else res[keyword] = parseNumber(state);
    parseSymbol(state, ",");
  }
  strictParseSymbol(state, "}");
  model.Lights.push(res);
  model.Nodes[res.ObjectId] = res;
}
function parseTextureAnims$1(state, model) {
  const res = [];
  parseNumber(state);
  strictParseSymbol(state, "{");
  while (state.char() !== "}") {
    const obj = {};
    parseKeyword(state);
    strictParseSymbol(state, "{");
    while (state.char() !== "}") {
      const keyword = parseKeyword(state);
      if (!keyword) throwError(state);
      if (keyword === "Translation" || keyword === "Rotation" || keyword === "Scaling") obj[keyword] = parseAnimVector(state, keyword === "Rotation" ? AnimVectorType$2.FLOAT4 : AnimVectorType$2.FLOAT3);
      else throw new Error("Unknown texture anim property " + keyword);
      parseSymbol(state, ",");
    }
    strictParseSymbol(state, "}");
    res.push(obj);
  }
  strictParseSymbol(state, "}");
  model.TextureAnims = res;
}
function parseRibbonEmitter(state, model) {
  const res = {
    Name: parseString(state),
    ObjectId: null,
    Parent: null,
    PivotPoint: null,
    Flags: NodeType.RibbonEmitter,
    HeightAbove: null,
    HeightBelow: null,
    Alpha: null,
    Color: null,
    LifeSpan: null,
    TextureSlot: null,
    EmissionRate: null,
    Rows: null,
    Columns: null,
    MaterialID: 0,
    Gravity: null,
    Visibility: null
  };
  strictParseSymbol(state, "{");
  while (state.char() !== "}") {
    let keyword = parseKeyword(state);
    let isStatic = false;
    if (!keyword) throwError(state);
    if (keyword === "static") {
      isStatic = true;
      keyword = parseKeyword(state);
    }
    if (!isStatic && (keyword === "Visibility" || keyword === "HeightAbove" || keyword === "HeightBelow" || keyword === "Translation" || keyword === "Rotation" || keyword === "Scaling" || keyword === "Alpha" || keyword === "TextureSlot")) {
      let type = AnimVectorType$2.FLOAT3;
      switch (keyword) {
        case "Rotation":
          type = AnimVectorType$2.FLOAT4;
          break;
        case "Visibility":
        case "HeightAbove":
        case "HeightBelow":
        case "Alpha":
          type = AnimVectorType$2.FLOAT1;
          break;
        case "TextureSlot":
          type = AnimVectorType$2.INT1;
          break;
      }
      res[keyword] = parseAnimVector(state, type);
    } else if (keyword === "Color") {
      const color2 = new Float32Array(3);
      parseArray(state, color2, 0);
      const temp = color2[0];
      color2[0] = color2[2];
      color2[2] = temp;
      res[keyword] = color2;
    } else res[keyword] = parseNumber(state);
    parseSymbol(state, ",");
  }
  strictParseSymbol(state, "}");
  model.RibbonEmitters.push(res);
  model.Nodes[res.ObjectId] = res;
}
function parseFaceFX$1(state, model) {
  if (model.Version < 900) throwError(state, "Unexpected model chunk FaceFX");
  const res = {
    Name: parseString(state),
    Path: ""
  };
  strictParseSymbol(state, "{");
  while (state.char() !== "}") {
    const keyword = parseKeyword(state);
    if (!keyword) throwError(state);
    if (keyword === "Path") res.Path = parseString(state);
    parseSymbol(state, ",");
  }
  strictParseSymbol(state, "}");
  model.FaceFX = model.FaceFX || [];
  model.FaceFX.push(res);
}
function parseBindPose$1(state, model) {
  if (model.Version < 900) throwError(state, "Unexpected model chunk BindPose");
  const res = { Matrices: [] };
  strictParseSymbol(state, "{");
  parseKeyword(state);
  const count = parseNumber(state);
  strictParseSymbol(state, "{");
  for (let i = 0; i < count; ++i) {
    const matrix = new Float32Array(12);
    parseArray(state, matrix, 0);
    parseSymbol(state, ",");
    res.Matrices.push(matrix);
  }
  strictParseSymbol(state, "}");
  strictParseSymbol(state, "}");
  model.BindPoses = model.BindPoses || [];
  model.BindPoses.push(res);
}
function parseParticleEmitterPopcorn$1(state, model) {
  if (model.Version < 900) throwError(state, "Unexpected model chunk ParticleEmitterPopcorn");
  const res = {
    Name: parseString(state),
    ObjectId: null,
    Parent: null,
    PivotPoint: null,
    Flags: NodeType.ParticleEmitter
  };
  strictParseSymbol(state, "{");
  while (state.char() !== "}") {
    let keyword = parseKeyword(state);
    let isStatic = false;
    if (!keyword) throwError(state);
    if (keyword === "static") {
      isStatic = true;
      keyword = parseKeyword(state);
    }
    if (!isStatic && (keyword === "LifeSpan" || keyword === "EmissionRate" || keyword === "Speed" || keyword === "Color" || keyword === "Alpha" || keyword === "Visibility" || keyword === "Rotation" || keyword === "Scaling" || keyword === "Translation")) {
      let type = AnimVectorType$2.FLOAT3;
      switch (keyword) {
        case "LifeSpan":
        case "EmissionRate":
        case "Speed":
        case "Alpha":
        case "Visibility":
          type = AnimVectorType$2.FLOAT1;
          break;
      }
      res[keyword] = parseAnimVector(state, type);
    } else if (keyword === "LifeSpan" || keyword === "EmissionRate" || keyword === "Speed" || keyword === "Alpha") res[keyword] = parseNumber(state);
    else if (keyword === "Color") res[keyword] = parseArray(state, new Float32Array(3), 0);
    else if (keyword === "ReplaceableId") res[keyword] = parseNumber(state);
    else if (keyword === "Path" || keyword === "AnimVisibilityGuide") res[keyword] = parseString(state);
    else if (keyword === "Unshaded" || keyword === "SortPrimsFarZ" || keyword === "Unfogged") {
      if (keyword === "Unshaded") res.Flags |= ParticleEmitterPopcornFlags.Unshaded;
      else if (keyword === "Unfogged") res.Flags |= ParticleEmitterPopcornFlags.Unfogged;
      else if (keyword === "SortPrimsFarZ") res.Flags |= ParticleEmitterPopcornFlags.SortPrimsFarZ;
    } else res[keyword] = parseNumber(state);
    parseSymbol(state, ",");
  }
  strictParseSymbol(state, "}");
  model.ParticleEmitterPopcorns = model.ParticleEmitterPopcorns || [];
  model.ParticleEmitterPopcorns.push(res);
  model.Nodes[res.ObjectId] = res;
}
var parsers$1 = {
  Version: parseVersion$1,
  Model: parseModelInfo$1,
  Sequences: parseSequences$1,
  Textures: parseTextures$1,
  Materials: parseMaterials$1,
  Geoset: parseGeoset,
  GeosetAnim: parseGeosetAnim,
  Bone: parseBone,
  Helper: parseHelper,
  Attachment: parseAttachment,
  PivotPoints: parsePivotPoints$1,
  EventObject: parseEventObject,
  CollisionShape: parseCollisionShape,
  GlobalSequences: parseGlobalSequences$1,
  ParticleEmitter: parseParticleEmitter,
  ParticleEmitter2: parseParticleEmitter2,
  Camera: parseCamera,
  Light: parseLight,
  TextureAnims: parseTextureAnims$1,
  RibbonEmitter: parseRibbonEmitter,
  FaceFX: parseFaceFX$1,
  BindPose: parseBindPose$1,
  ParticleEmitterPopcorn: parseParticleEmitterPopcorn$1
};
function parse(str2) {
  const state = new State$1(str2);
  const model = {
    Version: 800,
    Info: {
      Name: "",
      MinimumExtent: null,
      MaximumExtent: null,
      BoundsRadius: 0,
      BlendTime: 150
    },
    Sequences: [],
    GlobalSequences: [],
    Textures: [],
    Materials: [],
    TextureAnims: [],
    Geosets: [],
    GeosetAnims: [],
    Bones: [],
    Helpers: [],
    Attachments: [],
    EventObjects: [],
    ParticleEmitters: [],
    ParticleEmitters2: [],
    Cameras: [],
    Lights: [],
    RibbonEmitters: [],
    CollisionShapes: [],
    PivotPoints: [],
    Nodes: []
  };
  while (state.pos < state.str.length) {
    while (parseComment(state)) ;
    const keyword = parseKeyword(state);
    if (keyword) if (keyword in parsers$1) parsers$1[keyword](state, model);
    else parseUnknownBlock(state);
    else break;
  }
  for (let i = 0; i < model.Nodes.length; ++i) if (model.PivotPoints[i]) model.Nodes[i].PivotPoint = model.PivotPoints[i];
  return model;
}
var BIG_ENDIAN$1 = true;
var NONE$1 = -1;
var AnimVectorType$1 = /* @__PURE__ */ (function(AnimVectorType2) {
  AnimVectorType2[AnimVectorType2["INT1"] = 0] = "INT1";
  AnimVectorType2[AnimVectorType2["FLOAT1"] = 1] = "FLOAT1";
  AnimVectorType2[AnimVectorType2["FLOAT3"] = 2] = "FLOAT3";
  AnimVectorType2[AnimVectorType2["FLOAT4"] = 3] = "FLOAT4";
  return AnimVectorType2;
})(AnimVectorType$1 || {});
var animVectorSize$1 = {
  [AnimVectorType$1.INT1]: 1,
  [AnimVectorType$1.FLOAT1]: 1,
  [AnimVectorType$1.FLOAT3]: 3,
  [AnimVectorType$1.FLOAT4]: 4
};
var State = class {
  constructor(arrayBuffer2) {
    this.ab = arrayBuffer2;
    this.pos = 0;
    this.length = arrayBuffer2.byteLength;
    this.view = new DataView(this.ab);
    this.uint = new Uint8Array(this.ab);
  }
  keyword() {
    const res = String.fromCharCode(this.uint[this.pos], this.uint[this.pos + 1], this.uint[this.pos + 2], this.uint[this.pos + 3]);
    this.pos += 4;
    return res;
  }
  expectKeyword(keyword, errorText) {
    if (this.keyword() !== keyword) throw new Error(errorText);
  }
  uint8() {
    return this.view.getUint8(this.pos++);
  }
  uint16() {
    const res = this.view.getUint16(this.pos, BIG_ENDIAN$1);
    this.pos += 2;
    return res;
  }
  int32() {
    const res = this.view.getInt32(this.pos, BIG_ENDIAN$1);
    this.pos += 4;
    return res;
  }
  float32() {
    const res = this.view.getFloat32(this.pos, BIG_ENDIAN$1);
    this.pos += 4;
    return res;
  }
  float32Array(len2) {
    const res = new Float32Array(len2);
    for (let i = 0; i < len2; ++i) res[i] = this.float32();
    return res;
  }
  uint8Array(len2) {
    const res = new Uint8Array(len2);
    for (let i = 0; i < len2; ++i) res[i] = this.uint8();
    return res;
  }
  str(length) {
    let stringLength = length;
    while (this.uint[this.pos + stringLength - 1] === 0 && stringLength > 0) --stringLength;
    const res = String.fromCharCode.apply(String, this.uint.slice(this.pos, this.pos + stringLength));
    this.pos += length;
    return res;
  }
  animVector(type) {
    const res = { Keys: [] };
    const isInt = type === AnimVectorType$1.INT1;
    const vectorSize = animVectorSize$1[type];
    const keysCount = this.int32();
    res.LineType = this.int32();
    res.GlobalSeqId = this.int32();
    if (res.GlobalSeqId === NONE$1) res.GlobalSeqId = null;
    for (let i = 0; i < keysCount; ++i) {
      const animKeyFrame = {};
      animKeyFrame.Frame = this.int32();
      if (isInt) animKeyFrame.Vector = new Int32Array(vectorSize);
      else animKeyFrame.Vector = new Float32Array(vectorSize);
      for (let j = 0; j < vectorSize; ++j) if (isInt) animKeyFrame.Vector[j] = this.int32();
      else animKeyFrame.Vector[j] = this.float32();
      if (res.LineType === LineType.Hermite || res.LineType === LineType.Bezier) for (const part of ["InTan", "OutTan"]) {
        animKeyFrame[part] = new Float32Array(vectorSize);
        for (let j = 0; j < vectorSize; ++j) if (isInt) animKeyFrame[part][j] = this.int32();
        else animKeyFrame[part][j] = this.float32();
      }
      res.Keys.push(animKeyFrame);
    }
    return res;
  }
};
function parseExtent(obj, state) {
  obj.BoundsRadius = state.float32();
  for (const key of ["MinimumExtent", "MaximumExtent"]) {
    obj[key] = new Float32Array(3);
    for (let i = 0; i < 3; ++i) obj[key][i] = state.float32();
  }
}
function parseVersion(model, state) {
  model.Version = state.int32();
}
var MODEL_NAME_LENGTH$1 = 336;
function parseModelInfo(model, state) {
  model.Info.Name = state.str(MODEL_NAME_LENGTH$1);
  state.int32();
  parseExtent(model.Info, state);
  model.Info.BlendTime = state.int32();
}
var MODEL_SEQUENCE_NAME_LENGTH$1 = 80;
function parseSequences(model, state, size) {
  const startPos = state.pos;
  while (state.pos < startPos + size) {
    const name = state.str(MODEL_SEQUENCE_NAME_LENGTH$1);
    const sequence = {};
    sequence.Name = name;
    const interval = new Uint32Array(2);
    interval[0] = state.int32();
    interval[1] = state.int32();
    sequence.Interval = interval;
    sequence.MoveSpeed = state.float32();
    sequence.NonLooping = state.int32() > 0;
    sequence.Rarity = state.float32();
    state.int32();
    parseExtent(sequence, state);
    model.Sequences.push(sequence);
  }
}
function parseMaterials(model, state, size) {
  const startPos = state.pos;
  while (state.pos < startPos + size) {
    state.int32();
    const material = { Layers: [] };
    material.PriorityPlane = state.int32();
    material.RenderMode = state.int32();
    if (model.Version >= 900 && model.Version < 1100) material.Shader = state.str(80);
    state.expectKeyword("LAYS", "Incorrect materials format");
    const layersCount = state.int32();
    for (let i = 0; i < layersCount; ++i) {
      const startPos2 = state.pos;
      const size2 = state.int32();
      const layer = {};
      layer.FilterMode = state.int32();
      layer.Shading = state.int32();
      layer.TextureID = state.int32();
      layer.TVertexAnimId = state.int32();
      if (layer.TVertexAnimId === NONE$1) layer.TVertexAnimId = null;
      layer.CoordId = state.int32();
      layer.Alpha = state.float32();
      if (model.Version >= 900) {
        layer.EmissiveGain = state.float32();
        if (model.Version >= 1e3) {
          layer.FresnelColor = state.float32Array(3);
          layer.FresnelOpacity = state.float32();
          layer.FresnelTeamColor = state.float32();
        }
      }
      if (model.Version >= 1100) {
        layer.ShaderTypeId = state.int32();
        const textureCount = state.int32();
        for (let j = 0; j < textureCount; ++j) {
          const textureId = state.int32();
          state.int32();
          const textureType = j;
          if (state.keyword() === "KMTF") layer[LAYER_TEXTURE_ID_MAP[textureType]] = state.animVector(AnimVectorType$1.INT1);
          else {
            layer[LAYER_TEXTURE_ID_MAP[textureType]] = textureId;
            state.pos -= 4;
          }
        }
      }
      while (state.pos < startPos2 + size2) {
        const keyword = state.keyword();
        if (keyword === "KMTA") layer.Alpha = state.animVector(AnimVectorType$1.FLOAT1);
        else if (keyword === "KMTF") layer.TextureID = state.animVector(AnimVectorType$1.INT1);
        else if (keyword === "KMTE" && model.Version >= 900) layer.EmissiveGain = state.animVector(AnimVectorType$1.FLOAT1);
        else if (keyword === "KFC3" && model.Version >= 1e3) layer.FresnelColor = state.animVector(AnimVectorType$1.FLOAT3);
        else if (keyword === "KFCA" && model.Version >= 1e3) layer.FresnelOpacity = state.animVector(AnimVectorType$1.FLOAT1);
        else if (keyword === "KFTC" && model.Version >= 1e3) layer.FresnelTeamColor = state.animVector(AnimVectorType$1.FLOAT1);
        else throw new Error("Unknown layer chunk data " + keyword);
      }
      material.Layers.push(layer);
    }
    model.Materials.push(material);
  }
}
var MODEL_TEXTURE_PATH_LENGTH$1 = 256;
function parseTextures(model, state, size) {
  const startPos = state.pos;
  while (state.pos < startPos + size) {
    const texture = {};
    texture.ReplaceableId = state.int32();
    texture.Image = state.str(MODEL_TEXTURE_PATH_LENGTH$1);
    state.int32();
    texture.Flags = state.int32();
    model.Textures.push(texture);
  }
}
function parseGeosets(model, state, size) {
  const startPos = state.pos;
  while (state.pos < startPos + size) {
    const geoset = {};
    state.int32();
    state.expectKeyword("VRTX", "Incorrect geosets format");
    const verticesCount = state.int32();
    geoset.Vertices = new Float32Array(verticesCount * 3);
    for (let i = 0; i < verticesCount * 3; ++i) geoset.Vertices[i] = state.float32();
    state.expectKeyword("NRMS", "Incorrect geosets format");
    const normalsCount = state.int32();
    geoset.Normals = new Float32Array(normalsCount * 3);
    for (let i = 0; i < normalsCount * 3; ++i) geoset.Normals[i] = state.float32();
    state.expectKeyword("PTYP", "Incorrect geosets format");
    const primitiveCount = state.int32();
    for (let i = 0; i < primitiveCount; ++i) if (state.int32() !== 4) throw new Error("Incorrect geosets format");
    state.expectKeyword("PCNT", "Incorrect geosets format");
    const faceGroupCount = state.int32();
    for (let i = 0; i < faceGroupCount; ++i) state.int32();
    state.expectKeyword("PVTX", "Incorrect geosets format");
    const indicesCount = state.int32();
    geoset.Faces = new Uint16Array(indicesCount);
    for (let i = 0; i < indicesCount; ++i) geoset.Faces[i] = state.uint16();
    state.expectKeyword("GNDX", "Incorrect geosets format");
    const verticesGroupCount = state.int32();
    geoset.VertexGroup = new Uint8Array(verticesGroupCount);
    for (let i = 0; i < verticesGroupCount; ++i) geoset.VertexGroup[i] = state.uint8();
    state.expectKeyword("MTGC", "Incorrect geosets format");
    const groupsCount = state.int32();
    geoset.Groups = [];
    for (let i = 0; i < groupsCount; ++i) geoset.Groups[i] = new Array(state.int32());
    state.expectKeyword("MATS", "Incorrect geosets format");
    geoset.TotalGroupsCount = state.int32();
    let groupIndex = 0;
    let groupCounter = 0;
    for (let i = 0; i < geoset.TotalGroupsCount; ++i) {
      if (groupIndex >= geoset.Groups[groupCounter].length) {
        groupIndex = 0;
        groupCounter++;
      }
      geoset.Groups[groupCounter][groupIndex++] = state.int32();
    }
    geoset.MaterialID = state.int32();
    geoset.SelectionGroup = state.int32();
    geoset.Unselectable = state.int32() > 0;
    if (model.Version >= 900) {
      geoset.LevelOfDetail = state.int32();
      geoset.Name = state.str(80);
    }
    parseExtent(geoset, state);
    const geosetAnimCount = state.int32();
    geoset.Anims = [];
    for (let i = 0; i < geosetAnimCount; ++i) {
      const geosetAnim = {};
      parseExtent(geosetAnim, state);
      geoset.Anims.push(geosetAnim);
    }
    let keyword = state.keyword();
    if (model.Version >= 900) while (1) {
      if (state.pos >= state.length) throw new Error("Unexpected EOF");
      if (keyword === "TANG") {
        if (geoset.Tangents) throw new Error("Incorrect geoset, multiple Tangents");
        const len2 = state.int32();
        geoset.Tangents = state.float32Array(len2 * 4);
      } else if (keyword === "SKIN") {
        if (geoset.SkinWeights) throw new Error("Incorrect geoset, multiple SkinWeights");
        const len2 = state.int32();
        geoset.SkinWeights = state.uint8Array(len2);
      } else if (keyword === "UVAS") break;
      keyword = state.keyword();
    }
    else if (keyword !== "UVAS") throw new Error("Incorrect geosets format");
    const textureChunkCount = state.int32();
    geoset.TVertices = [];
    for (let i = 0; i < textureChunkCount; ++i) {
      state.expectKeyword("UVBS", "Incorrect geosets format");
      const textureCoordsCount = state.int32();
      const tvertices = new Float32Array(textureCoordsCount * 2);
      for (let j = 0; j < textureCoordsCount * 2; ++j) tvertices[j] = state.float32();
      geoset.TVertices.push(tvertices);
    }
    model.Geosets.push(geoset);
  }
}
function parseGeosetAnims(model, state, size) {
  const startPos = state.pos;
  while (state.pos < startPos + size) {
    const animStartPos = state.pos;
    const animSize = state.int32();
    const geosetAnim = {};
    geosetAnim.Alpha = state.float32();
    geosetAnim.Flags = state.int32();
    geosetAnim.Color = new Float32Array(3);
    for (let i = 0; i < 3; ++i) geosetAnim.Color[i] = state.float32();
    geosetAnim.GeosetId = state.int32();
    if (geosetAnim.GeosetId === NONE$1) geosetAnim.GeosetId = null;
    while (state.pos < animStartPos + animSize) {
      const keyword = state.keyword();
      if (keyword === "KGAO") geosetAnim.Alpha = state.animVector(AnimVectorType$1.FLOAT1);
      else if (keyword === "KGAC") geosetAnim.Color = state.animVector(AnimVectorType$1.FLOAT3);
      else throw new Error("Incorrect GeosetAnim chunk data " + keyword);
    }
    model.GeosetAnims.push(geosetAnim);
  }
}
var MODEL_NODE_NAME_LENGTH$1 = 80;
function parseNode(model, node, state) {
  const startPos = state.pos;
  const size = state.int32();
  node.Name = state.str(MODEL_NODE_NAME_LENGTH$1);
  node.ObjectId = state.int32();
  if (node.ObjectId === NONE$1) node.ObjectId = null;
  node.Parent = state.int32();
  if (node.Parent === NONE$1) node.Parent = null;
  node.Flags = state.int32();
  while (state.pos < startPos + size) {
    const keyword = state.keyword();
    if (keyword === "KGTR") node.Translation = state.animVector(AnimVectorType$1.FLOAT3);
    else if (keyword === "KGRT") node.Rotation = state.animVector(AnimVectorType$1.FLOAT4);
    else if (keyword === "KGSC") node.Scaling = state.animVector(AnimVectorType$1.FLOAT3);
    else throw new Error("Incorrect node chunk data " + keyword);
  }
  model.Nodes[node.ObjectId] = node;
}
function parseBones(model, state, size) {
  const startPos = state.pos;
  while (state.pos < startPos + size) {
    const bone = {};
    parseNode(model, bone, state);
    bone.GeosetId = state.int32();
    if (bone.GeosetId === NONE$1) bone.GeosetId = null;
    bone.GeosetAnimId = state.int32();
    if (bone.GeosetAnimId === NONE$1) bone.GeosetAnimId = null;
    model.Bones.push(bone);
  }
}
function parseHelpers(model, state, size) {
  const startPos = state.pos;
  while (state.pos < startPos + size) {
    const helper = {};
    parseNode(model, helper, state);
    model.Helpers.push(helper);
  }
}
var MODEL_ATTACHMENT_PATH_LENGTH$1 = 256;
function parseAttachments(model, state, size) {
  const startPos = state.pos;
  while (state.pos < startPos + size) {
    const attachmentStart = state.pos;
    const attachmentSize = state.int32();
    const attachment = {};
    parseNode(model, attachment, state);
    attachment.Path = state.str(MODEL_ATTACHMENT_PATH_LENGTH$1);
    state.int32();
    attachment.AttachmentID = state.int32();
    if (state.pos < attachmentStart + attachmentSize) {
      state.expectKeyword("KATV", "Incorrect attachment chunk data");
      attachment.Visibility = state.animVector(AnimVectorType$1.FLOAT1);
    }
    model.Attachments.push(attachment);
  }
}
function parsePivotPoints(model, state, size) {
  const pointsCount = size / 12;
  for (let i = 0; i < pointsCount; ++i) {
    model.PivotPoints[i] = new Float32Array(3);
    model.PivotPoints[i][0] = state.float32();
    model.PivotPoints[i][1] = state.float32();
    model.PivotPoints[i][2] = state.float32();
  }
}
function parseEventObjects(model, state, size) {
  const startPos = state.pos;
  while (state.pos < startPos + size) {
    const eventObject = {};
    parseNode(model, eventObject, state);
    state.expectKeyword("KEVT", "Incorrect EventObject chunk data");
    const eventTrackCount = state.int32();
    eventObject.EventTrack = new Uint32Array(eventTrackCount);
    state.int32();
    for (let i = 0; i < eventTrackCount; ++i) eventObject.EventTrack[i] = state.int32();
    model.EventObjects.push(eventObject);
  }
}
function parseCollisionShapes(model, state, size) {
  const startPos = state.pos;
  while (state.pos < startPos + size) {
    const collisionShape = {};
    parseNode(model, collisionShape, state);
    collisionShape.Shape = state.int32();
    if (collisionShape.Shape === CollisionShapeType.Box) collisionShape.Vertices = new Float32Array(6);
    else collisionShape.Vertices = new Float32Array(3);
    for (let i = 0; i < collisionShape.Vertices.length; ++i) collisionShape.Vertices[i] = state.float32();
    if (collisionShape.Shape === CollisionShapeType.Sphere) collisionShape.BoundsRadius = state.float32();
    model.CollisionShapes.push(collisionShape);
  }
}
function parseGlobalSequences(model, state, size) {
  const startPos = state.pos;
  model.GlobalSequences = [];
  while (state.pos < startPos + size) model.GlobalSequences.push(state.int32());
}
var MODEL_PARTICLE_EMITTER_PATH_LENGTH$1 = 256;
function parseParticleEmitters(model, state, size) {
  const startPos = state.pos;
  while (state.pos < startPos + size) {
    const emitterStart = state.pos;
    const emitterSize = state.int32();
    const emitter = {};
    parseNode(model, emitter, state);
    emitter.EmissionRate = state.float32();
    emitter.Gravity = state.float32();
    emitter.Longitude = state.float32();
    emitter.Latitude = state.float32();
    emitter.Path = state.str(MODEL_PARTICLE_EMITTER_PATH_LENGTH$1);
    state.int32();
    emitter.LifeSpan = state.float32();
    emitter.InitVelocity = state.float32();
    while (state.pos < emitterStart + emitterSize) {
      const keyword = state.keyword();
      if (keyword === "KPEV") emitter.Visibility = state.animVector(AnimVectorType$1.FLOAT1);
      else if (keyword === "KPEE") emitter.EmissionRate = state.animVector(AnimVectorType$1.FLOAT1);
      else if (keyword === "KPEG") emitter.Gravity = state.animVector(AnimVectorType$1.FLOAT1);
      else if (keyword === "KPLN") emitter.Longitude = state.animVector(AnimVectorType$1.FLOAT1);
      else if (keyword === "KPLT") emitter.Latitude = state.animVector(AnimVectorType$1.FLOAT1);
      else if (keyword === "KPEL") emitter.LifeSpan = state.animVector(AnimVectorType$1.FLOAT1);
      else if (keyword === "KPES") emitter.InitVelocity = state.animVector(AnimVectorType$1.FLOAT1);
      else throw new Error("Incorrect particle emitter chunk data " + keyword);
    }
    model.ParticleEmitters.push(emitter);
  }
}
function parseParticleEmitters2(model, state, size) {
  const startPos = state.pos;
  while (state.pos < startPos + size) {
    const emitterStart = state.pos;
    const emitterSize = state.int32();
    const emitter = {};
    parseNode(model, emitter, state);
    emitter.Speed = state.float32();
    emitter.Variation = state.float32();
    emitter.Latitude = state.float32();
    emitter.Gravity = state.float32();
    emitter.LifeSpan = state.float32();
    emitter.EmissionRate = state.float32();
    emitter.Width = state.float32();
    emitter.Length = state.float32();
    emitter.FilterMode = state.int32();
    emitter.Rows = state.int32();
    emitter.Columns = state.int32();
    const frameFlags = state.int32();
    emitter.FrameFlags = 0;
    if (frameFlags === 0 || frameFlags === 2) emitter.FrameFlags |= ParticleEmitter2FramesFlags.Head;
    if (frameFlags === 1 || frameFlags === 2) emitter.FrameFlags |= ParticleEmitter2FramesFlags.Tail;
    emitter.TailLength = state.float32();
    emitter.Time = state.float32();
    emitter.SegmentColor = [];
    for (let i = 0; i < 3; ++i) {
      emitter.SegmentColor[i] = new Float32Array(3);
      for (let j = 0; j < 3; ++j) emitter.SegmentColor[i][j] = state.float32();
    }
    emitter.Alpha = new Uint8Array(3);
    for (let i = 0; i < 3; ++i) emitter.Alpha[i] = state.uint8();
    emitter.ParticleScaling = new Float32Array(3);
    for (let i = 0; i < 3; ++i) emitter.ParticleScaling[i] = state.float32();
    for (const part of [
      "LifeSpanUVAnim",
      "DecayUVAnim",
      "TailUVAnim",
      "TailDecayUVAnim"
    ]) {
      emitter[part] = new Uint32Array(3);
      for (let i = 0; i < 3; ++i) emitter[part][i] = state.int32();
    }
    emitter.TextureID = state.int32();
    if (emitter.TextureID === NONE$1) emitter.TextureID = null;
    emitter.Squirt = state.int32() > 0;
    emitter.PriorityPlane = state.int32();
    emitter.ReplaceableId = state.int32();
    while (state.pos < emitterStart + emitterSize) {
      const keyword = state.keyword();
      if (keyword === "KP2V") emitter.Visibility = state.animVector(AnimVectorType$1.FLOAT1);
      else if (keyword === "KP2E") emitter.EmissionRate = state.animVector(AnimVectorType$1.FLOAT1);
      else if (keyword === "KP2W") emitter.Width = state.animVector(AnimVectorType$1.FLOAT1);
      else if (keyword === "KP2N") emitter.Length = state.animVector(AnimVectorType$1.FLOAT1);
      else if (keyword === "KP2S") emitter.Speed = state.animVector(AnimVectorType$1.FLOAT1);
      else if (keyword === "KP2L") emitter.Latitude = state.animVector(AnimVectorType$1.FLOAT1);
      else if (keyword === "KP2G") emitter.Gravity = state.animVector(AnimVectorType$1.FLOAT1);
      else if (keyword === "KP2R") emitter.Variation = state.animVector(AnimVectorType$1.FLOAT1);
      else throw new Error("Incorrect particle emitter2 chunk data " + keyword);
    }
    model.ParticleEmitters2.push(emitter);
  }
}
var MODEL_CAMERA_NAME_LENGTH$1 = 80;
function parseCameras(model, state, size) {
  const startPos = state.pos;
  while (state.pos < startPos + size) {
    const cameraStart = state.pos;
    const cameraSize = state.int32();
    const camera = {};
    camera.Name = state.str(MODEL_CAMERA_NAME_LENGTH$1);
    camera.Position = new Float32Array(3);
    camera.Position[0] = state.float32();
    camera.Position[1] = state.float32();
    camera.Position[2] = state.float32();
    camera.FieldOfView = state.float32();
    camera.FarClip = state.float32();
    camera.NearClip = state.float32();
    camera.TargetPosition = new Float32Array(3);
    camera.TargetPosition[0] = state.float32();
    camera.TargetPosition[1] = state.float32();
    camera.TargetPosition[2] = state.float32();
    while (state.pos < cameraStart + cameraSize) {
      const keyword = state.keyword();
      if (keyword === "KCTR") camera.Translation = state.animVector(AnimVectorType$1.FLOAT3);
      else if (keyword === "KTTR") camera.TargetTranslation = state.animVector(AnimVectorType$1.FLOAT3);
      else if (keyword === "KCRL") camera.Rotation = state.animVector(AnimVectorType$1.FLOAT1);
      else throw new Error("Incorrect camera chunk data " + keyword);
    }
    model.Cameras.push(camera);
  }
}
function parseLights(model, state, size) {
  const startPos = state.pos;
  while (state.pos < startPos + size) {
    const lightStart = state.pos;
    const lightSize = state.int32();
    const light = {};
    parseNode(model, light, state);
    light.LightType = state.int32();
    light.AttenuationStart = state.float32();
    light.AttenuationEnd = state.float32();
    light.Color = new Float32Array(3);
    for (let j = 0; j < 3; ++j) light.Color[j] = state.float32();
    light.Intensity = state.float32();
    light.AmbColor = new Float32Array(3);
    for (let j = 0; j < 3; ++j) light.AmbColor[j] = state.float32();
    light.AmbIntensity = state.float32();
    while (state.pos < lightStart + lightSize) {
      const keyword = state.keyword();
      if (keyword === "KLAV") light.Visibility = state.animVector(AnimVectorType$1.FLOAT1);
      else if (keyword === "KLAC") light.Color = state.animVector(AnimVectorType$1.FLOAT3);
      else if (keyword === "KLAI") light.Intensity = state.animVector(AnimVectorType$1.FLOAT1);
      else if (keyword === "KLBC") light.AmbColor = state.animVector(AnimVectorType$1.FLOAT3);
      else if (keyword === "KLBI") light.AmbIntensity = state.animVector(AnimVectorType$1.FLOAT1);
      else if (keyword === "KLAS") light.AttenuationStart = state.animVector(AnimVectorType$1.INT1);
      else if (keyword === "KLAE") light.AttenuationEnd = state.animVector(AnimVectorType$1.INT1);
      else throw new Error("Incorrect light chunk data " + keyword);
    }
    model.Lights.push(light);
  }
}
function parseTextureAnims(model, state, size) {
  const startPos = state.pos;
  while (state.pos < startPos + size) {
    const animStart = state.pos;
    const animSize = state.int32();
    const anim = {};
    while (state.pos < animStart + animSize) {
      const keyword = state.keyword();
      if (keyword === "KTAT") anim.Translation = state.animVector(AnimVectorType$1.FLOAT3);
      else if (keyword === "KTAR") anim.Rotation = state.animVector(AnimVectorType$1.FLOAT4);
      else if (keyword === "KTAS") anim.Scaling = state.animVector(AnimVectorType$1.FLOAT3);
      else throw new Error("Incorrect light chunk data " + keyword);
    }
    model.TextureAnims.push(anim);
  }
}
function parseRibbonEmitters(model, state, size) {
  const startPos = state.pos;
  while (state.pos < startPos + size) {
    const emitterStart = state.pos;
    const emitterSize = state.int32();
    const emitter = {};
    parseNode(model, emitter, state);
    emitter.HeightAbove = state.float32();
    emitter.HeightBelow = state.float32();
    emitter.Alpha = state.float32();
    emitter.Color = new Float32Array(3);
    for (let j = 0; j < 3; ++j) emitter.Color[j] = state.float32();
    emitter.LifeSpan = state.float32();
    emitter.TextureSlot = state.int32();
    emitter.EmissionRate = state.int32();
    emitter.Rows = state.int32();
    emitter.Columns = state.int32();
    emitter.MaterialID = state.int32();
    emitter.Gravity = state.float32();
    while (state.pos < emitterStart + emitterSize) {
      const keyword = state.keyword();
      if (keyword === "KRVS") emitter.Visibility = state.animVector(AnimVectorType$1.FLOAT1);
      else if (keyword === "KRHA") emitter.HeightAbove = state.animVector(AnimVectorType$1.FLOAT1);
      else if (keyword === "KRHB") emitter.HeightBelow = state.animVector(AnimVectorType$1.FLOAT1);
      else if (keyword === "KRAL") emitter.Alpha = state.animVector(AnimVectorType$1.FLOAT1);
      else if (keyword === "KRTX") emitter.TextureSlot = state.animVector(AnimVectorType$1.INT1);
      else throw new Error("Incorrect ribbon emitter chunk data " + keyword);
    }
    model.RibbonEmitters.push(emitter);
  }
}
function parseFaceFX(model, state, size) {
  if (model.Version < 900) throw new Error("Mismatched version chunk");
  const startPos = state.pos;
  model.FaceFX = model.FaceFX || [];
  while (state.pos < startPos + size) {
    const faceFX = {
      Name: "",
      Path: ""
    };
    faceFX.Name = state.str(80);
    faceFX.Path = state.str(260);
    model.FaceFX.push(faceFX);
  }
}
function parseBindPose(model, state, size) {
  if (model.Version < 900) throw new Error("Mismatched version chunk");
  const startPos = state.pos;
  model.BindPoses = model.BindPoses || [];
  const len2 = state.int32();
  const bindPose = { Matrices: [] };
  for (let i = 0; i < len2; ++i) {
    const matrix = state.float32Array(12);
    bindPose.Matrices.push(matrix);
  }
  model.BindPoses.push(bindPose);
  if (state.pos !== startPos + size) throw new Error("Mismatched BindPose data");
}
function parseParticleEmitterPopcorn(model, state, size) {
  if (model.Version < 900) throw new Error("Mismatched version chunk");
  const startPos = state.pos;
  model.ParticleEmitterPopcorns = model.ParticleEmitterPopcorns || [];
  while (state.pos < startPos + size) {
    const emitterStart = state.pos;
    const emitterSize = state.int32();
    const emitter = {};
    parseNode(model, emitter, state);
    emitter.LifeSpan = state.float32();
    emitter.EmissionRate = state.float32();
    emitter.Speed = state.float32();
    emitter.Color = state.float32Array(3);
    emitter.Alpha = state.float32();
    emitter.ReplaceableId = state.int32();
    emitter.Path = state.str(260);
    emitter.AnimVisibilityGuide = state.str(260);
    while (state.pos < emitterStart + emitterSize) {
      const keyword = state.keyword();
      if (keyword === "KPPA") emitter.Alpha = state.animVector(AnimVectorType$1.FLOAT1);
      else if (keyword === "KPPC") emitter.Color = state.animVector(AnimVectorType$1.FLOAT3);
      else if (keyword === "KPPE") emitter.EmissionRate = state.animVector(AnimVectorType$1.FLOAT1);
      else if (keyword === "KPPL") emitter.LifeSpan = state.animVector(AnimVectorType$1.FLOAT1);
      else if (keyword === "KPPS") emitter.Speed = state.animVector(AnimVectorType$1.FLOAT1);
      else if (keyword === "KPPV") emitter.Visibility = state.animVector(AnimVectorType$1.FLOAT1);
      else throw new Error("Incorrect particle emitter popcorn chunk data " + keyword);
    }
    model.ParticleEmitterPopcorns.push(emitter);
  }
}
var parsers = {
  VERS: parseVersion,
  MODL: parseModelInfo,
  SEQS: parseSequences,
  MTLS: parseMaterials,
  TEXS: parseTextures,
  GEOS: parseGeosets,
  GEOA: parseGeosetAnims,
  BONE: parseBones,
  HELP: parseHelpers,
  ATCH: parseAttachments,
  PIVT: parsePivotPoints,
  EVTS: parseEventObjects,
  CLID: parseCollisionShapes,
  GLBS: parseGlobalSequences,
  PREM: parseParticleEmitters,
  PRE2: parseParticleEmitters2,
  CAMS: parseCameras,
  LITE: parseLights,
  TXAN: parseTextureAnims,
  RIBB: parseRibbonEmitters,
  FAFX: parseFaceFX,
  BPOS: parseBindPose,
  CORN: parseParticleEmitterPopcorn
};
function parse$1(arrayBuffer2) {
  const state = new State(arrayBuffer2);
  if (state.keyword() !== "MDLX") throw new Error("Not a mdx model");
  const model = {
    Version: 800,
    Info: {
      Name: "",
      MinimumExtent: null,
      MaximumExtent: null,
      BoundsRadius: 0,
      BlendTime: 150
    },
    Sequences: [],
    GlobalSequences: [],
    Textures: [],
    Materials: [],
    TextureAnims: [],
    Geosets: [],
    GeosetAnims: [],
    Bones: [],
    Helpers: [],
    Attachments: [],
    EventObjects: [],
    ParticleEmitters: [],
    ParticleEmitters2: [],
    Cameras: [],
    Lights: [],
    RibbonEmitters: [],
    CollisionShapes: [],
    PivotPoints: [],
    Nodes: []
  };
  while (state.pos < state.length) {
    const keyword = state.keyword();
    const size = state.int32();
    if (keyword in parsers) parsers[keyword](model, state, size);
    else state.pos += size;
  }
  for (let i = 0; i < model.Nodes.length; ++i) if (model.Nodes[i] && model.PivotPoints[i]) model.Nodes[i].PivotPoint = model.PivotPoints[i];
  model.Info.NumGeosets = model.Geosets.length;
  model.Info.NumGeosetAnims = model.GeosetAnims.length;
  model.Info.NumBones = model.Bones.length;
  model.Info.NumLights = model.Lights.length;
  model.Info.NumAttachments = model.Attachments.length;
  model.Info.NumEvents = model.EventObjects.length;
  model.Info.NumParticleEmitters = model.ParticleEmitters.length;
  model.Info.NumParticleEmitters2 = model.ParticleEmitters2.length;
  model.Info.NumRibbonEmitters = model.RibbonEmitters.length;
  return model;
}
var FLOAT_PRESICION = 6;
var EPSILON$1 = 1e-6;
function isNotEmptyVec3(vec, val = 0) {
  return Math.abs(vec[0] - val) > EPSILON$1 || Math.abs(vec[1] - val) > EPSILON$1 || Math.abs(vec[2] - val) > EPSILON$1;
}
function generateTab(tabSize = 1) {
  if (tabSize === 0) return "";
  let res = "	";
  for (let i = 1; i < tabSize; ++i) res += "	";
  return res;
}
function generateWrappedString(val) {
  return `"${val}"`;
}
function generateWrappedStringOrNumber(val) {
  if (typeof val === "number") return String(val);
  return generateWrappedString(val);
}
function generateBlockStart(blockName, subInfo = null, tabSize = 0) {
  return generateTab(tabSize) + blockName + " " + (subInfo !== null ? generateWrappedStringOrNumber(subInfo) + " " : "") + "{\n";
}
function generateBlockEnd(tabSize = 0) {
  return generateTab(tabSize) + "}\n";
}
var trailingZeroRegExp = /(\..+?)0+$/;
var trailingZeroRegExp2 = /\.0+$/;
var negativeZeroRegExp = /^-0$/;
function generateNumber(val) {
  return val.toFixed(FLOAT_PRESICION).replace(trailingZeroRegExp, "$1").replace(trailingZeroRegExp2, "").replace(negativeZeroRegExp, "0");
}
function generateArray(arr, reverse = false) {
  let middle = "";
  if (reverse) for (let i = arr.length - 1; i >= 0; --i) {
    if (i < arr.length - 1) middle += ", ";
    middle += generateNumber(arr[i]);
  }
  else for (let i = 0; i < arr.length; ++i) {
    if (i > 0) middle += ", ";
    middle += generateNumber(arr[i]);
  }
  return "{ " + middle + " }";
}
function generateUIntArray(arr) {
  let middle = "";
  for (let i = 0; i < arr.length; ++i) {
    if (i > 0) middle += ", ";
    middle += String(arr[i]);
  }
  return "{ " + middle + " }";
}
function generateStatic(isStatic) {
  return isStatic ? "static " : "";
}
function generateProp(name, val, isStatic, tabSize = 1) {
  return `${generateTab(tabSize) + generateStatic(isStatic) + name} ${val},
`;
}
function generateIntProp(name, val, isStatic = null, tabSize = 1) {
  return generateProp(name, String(val), isStatic, tabSize);
}
function generateFloatProp(name, val, isStatic = null, tabSize = 1) {
  return generateProp(name, generateNumber(val), isStatic, tabSize);
}
function generateStringProp(name, val, isStatic = null, tabSize = 1) {
  return generateProp(name, val, isStatic, tabSize);
}
function generateWrappedStringProp(name, val, isStatic = null, tabSize = 1) {
  return generateProp(name, generateWrappedString(val), isStatic, tabSize);
}
function generateFloatArrayProp(name, val, isStatic = null, tabSize = 1) {
  return generateProp(name, generateArray(val), isStatic, tabSize);
}
function generateUIntArrayProp(name, val, isStatic = null, tabSize = 1) {
  return generateProp(name, generateUIntArray(val), isStatic, tabSize);
}
function generateBooleanProp(name, tabSize = 1) {
  return generateTab(tabSize) + name + ",\n";
}
function generateIntPropIfNotEmpty(name, val, defaultVal = 0, isStatic = null, tabSize = 1) {
  if (val !== defaultVal && val !== null && val !== void 0) return generateIntProp(name, val, isStatic, tabSize);
  return "";
}
function generateFloatPropIfNotEmpty(name, val, defaultVal = 0, isStatic = null, tabSize = 1) {
  if (Math.abs(val - defaultVal) > EPSILON$1) return generateFloatProp(name, val, isStatic, tabSize);
  return "";
}
function generateLineType(lineType) {
  switch (lineType) {
    case LineType.DontInterp:
      return "DontInterp";
    case LineType.Linear:
      return "Linear";
    case LineType.Bezier:
      return "Bezier";
    case LineType.Hermite:
      return "Hermite";
  }
  return "";
}
function generateAnimKeyFrame(key, tabSize = 2, reverse = false) {
  let res = generateTab(tabSize) + key.Frame + ": " + (key.Vector.length === 1 ? generateNumber(key.Vector[0]) : generateArray(key.Vector, reverse)) + ",\n";
  if (key.InTan) {
    res += generateTab(tabSize + 1) + "InTan " + (key.InTan.length === 1 ? generateNumber(key.InTan[0]) : generateArray(key.InTan, reverse)) + ",\n";
    res += generateTab(tabSize + 1) + "OutTan " + (key.OutTan.length === 1 ? generateNumber(key.OutTan[0]) : generateArray(key.OutTan, reverse)) + ",\n";
  }
  return res;
}
function generateAnimVectorProp(name, val, defaultVal = 0, tabSize = 1, reverse = false) {
  if (val === null || val === void 0) return "";
  if (typeof val === "number") if (typeof defaultVal === "number" && Math.abs(val - defaultVal) < EPSILON$1) return "";
  else return generateFloatProp(name, val, true, tabSize);
  else return generateBlockStart(name, val.Keys.length, tabSize) + generateBooleanProp(generateLineType(val.LineType), tabSize + 1) + (val.GlobalSeqId !== null ? generateIntProp("GlobalSeqId", val.GlobalSeqId, null, tabSize + 1) : "") + val.Keys.map((key) => generateAnimKeyFrame(key, tabSize + 1, reverse)).join("") + generateBlockEnd(tabSize);
}
function generateVersion$1(model) {
  return generateBlockStart("Version") + generateIntProp("FormatVersion", model.Version) + generateBlockEnd();
}
function generateModel(model) {
  return generateBlockStart("Model", model.Info.Name) + generateIntPropIfNotEmpty("NumGeosets", model.Geosets.length) + generateIntPropIfNotEmpty("NumGeosetAnims", model.GeosetAnims.length) + generateIntPropIfNotEmpty("NumHelpers", model.Helpers.length) + generateIntPropIfNotEmpty("NumBones", model.Bones.length) + (model.Lights.length ? generateIntPropIfNotEmpty("NumLights", model.Lights.length) : "") + generateIntPropIfNotEmpty("NumAttachments", model.Attachments.length) + generateIntPropIfNotEmpty("NumEvents", model.EventObjects.length) + generateIntPropIfNotEmpty("NumParticleEmitters", model.ParticleEmitters.length) + (model.ParticleEmitters2.length ? generateIntPropIfNotEmpty("NumParticleEmitters2", model.ParticleEmitters2.length) : "") + (model.RibbonEmitters.length ? generateIntPropIfNotEmpty("NumRibbonEmitters", model.RibbonEmitters.length) : "") + generateIntProp("BlendTime", model.Info.BlendTime) + generateFloatArrayProp("MinimumExtent", model.Info.MinimumExtent) + generateFloatArrayProp("MaximumExtent", model.Info.MaximumExtent) + generateFloatPropIfNotEmpty("BoundsRadius", model.Info.BoundsRadius) + generateBlockEnd();
}
function generateSequences$1(model) {
  return generateBlockStart("Sequences", model.Sequences.length) + model.Sequences.map(generateSequenceChunk).join("") + generateBlockEnd();
}
function generateSequenceChunk(sequence) {
  return generateBlockStart("Anim", sequence.Name, 1) + generateUIntArrayProp("Interval", sequence.Interval, null, 2) + generateFloatPropIfNotEmpty("Rarity", sequence.Rarity, 0, null, 2) + generateFloatPropIfNotEmpty("MoveSpeed", sequence.MoveSpeed, 0, null, 2) + (sequence.NonLooping ? generateBooleanProp("NonLooping", 2) : "") + generateFloatArrayProp("MinimumExtent", sequence.MinimumExtent, null, 2) + generateFloatArrayProp("MaximumExtent", sequence.MaximumExtent, null, 2) + generateFloatPropIfNotEmpty("BoundsRadius", sequence.BoundsRadius, 0, null, 2) + generateBlockEnd(1);
}
function generateGlobalSequences$1(model) {
  if (!model.GlobalSequences || !model.GlobalSequences.length) return "";
  return generateBlockStart("GlobalSequences", model.GlobalSequences.length) + model.GlobalSequences.map((duration) => generateIntProp("Duration", duration)).join("") + generateBlockEnd();
}
function generateTextures$1(model) {
  if (!model.Textures.length) return "";
  return generateBlockStart("Textures", model.Textures.length) + model.Textures.map(generateTextureChunk).join("") + generateBlockEnd();
}
function generateTextureChunk(texture) {
  return generateBlockStart("Bitmap", null, 1) + generateWrappedStringProp("Image", texture.Image, null, 2) + generateIntPropIfNotEmpty("ReplaceableId", texture.ReplaceableId, 0, null, 2) + (texture.Flags & TextureFlags.WrapWidth ? generateBooleanProp("WrapWidth", 2) : "") + (texture.Flags & TextureFlags.WrapHeight ? generateBooleanProp("WrapHeight", 2) : "") + generateBlockEnd(1);
}
function generateMaterials$1(model) {
  if (!model.Materials.length) return "";
  return generateBlockStart("Materials", model.Materials.length) + model.Materials.map((it) => generateMaterialChunk(model, it)).join("") + generateBlockEnd();
}
function generateMaterialChunk(model, material) {
  let shader = "";
  if (model.Version >= 900 && model.Version < 1100 && material.Shader) shader = generateWrappedStringProp("Shader", material.Shader, false, 2);
  return generateBlockStart("Material", null, 1) + (material.RenderMode & MaterialRenderMode.ConstantColor ? generateBooleanProp("ConstantColor", 2) : "") + (material.RenderMode & MaterialRenderMode.SortPrimsFarZ ? generateBooleanProp("SortPrimsFarZ", 2) : "") + (material.RenderMode & MaterialRenderMode.FullResolution ? generateBooleanProp("FullResolution", 2) : "") + generateIntPropIfNotEmpty("PriorityPlane", material.PriorityPlane, 0, null, 2) + generateIntPropIfNotEmpty("RenderMode", material.RenderMode, 0, null, 2) + shader + material.Layers.map((it) => generateLayerChunk(model, it)).join("") + generateBlockEnd(1);
}
function generateFilterMode(filterMode) {
  switch (filterMode) {
    case FilterMode.None:
      return "None";
    case FilterMode.Transparent:
      return "Transparent";
    case FilterMode.Blend:
      return "Blend";
    case FilterMode.Additive:
      return "Additive";
    case FilterMode.AddAlpha:
      return "AddAlpha";
    case FilterMode.Modulate:
      return "Modulate";
    case FilterMode.Modulate2x:
      return "Modulate2x";
  }
  return "";
}
function generateLayerChunk(model, layer) {
  let middle = "";
  if (model.Version >= 900) {
    middle += layer.EmissiveGain !== void 0 ? generateAnimVectorProp("EmissiveGain", layer.EmissiveGain, 1, 3) : "";
    if (model.Version >= 1e3) {
      middle += layer.FresnelColor !== void 0 ? generateColorProp("FresnelColor", layer.FresnelColor, true, 3) : "";
      middle += layer.FresnelOpacity !== void 0 ? generateAnimVectorProp("FresnelOpacity", layer.FresnelOpacity, 0, 3) : "";
      middle += layer.FresnelTeamColor !== void 0 ? generateAnimVectorProp("FresnelTeamColor", layer.FresnelTeamColor, 0, 3) : "";
    }
  }
  if (model.Version >= 1100) {
    middle += generateIntProp("ShaderTypeId", layer.ShaderTypeId || 0, null, 3);
    LAYER_TEXTURE_ID_MAP.slice(1).forEach((name) => {
      const val = layer[name];
      if (val !== void 0) middle += generateAnimVectorProp(name, val, null, 3);
    });
  }
  return generateBlockStart("Layer", null, 2) + generateStringProp("FilterMode", generateFilterMode(layer.FilterMode), null, 3) + (layer.Alpha !== void 0 ? generateAnimVectorProp("Alpha", layer.Alpha, 1, 3) : "") + (layer.TextureID !== void 0 ? generateAnimVectorProp("TextureID", layer.TextureID, null, 3) : "") + (layer.Shading & LayerShading.TwoSided ? generateBooleanProp("TwoSided", 3) : "") + (layer.Shading & LayerShading.Unshaded ? generateBooleanProp("Unshaded", 3) : "") + (layer.Shading & LayerShading.Unfogged ? generateBooleanProp("Unfogged", 3) : "") + (layer.Shading & LayerShading.SphereEnvMap ? generateBooleanProp("SphereEnvMap", 3) : "") + (layer.Shading & LayerShading.NoDepthTest ? generateBooleanProp("NoDepthTest", 3) : "") + (layer.Shading & LayerShading.NoDepthSet ? generateBooleanProp("NoDepthSet", 3) : "") + generateIntPropIfNotEmpty("CoordId", layer.CoordId, 0, null, 3) + generateIntPropIfNotEmpty("TVertexAnimId", layer.TVertexAnimId, null, null, 3) + middle + generateBlockEnd(2);
}
function generateTextureAnims$1(model) {
  if (!model.TextureAnims.length) return "";
  return generateBlockStart("TextureAnims", model.TextureAnims.length) + model.TextureAnims.map(generateTextureAnimChunk).join("") + generateBlockEnd();
}
function generateTextureAnimChunk(textureAnim) {
  return generateBlockStart("TVertexAnim", null, 1) + (textureAnim.Translation ? generateAnimVectorProp("Translation", textureAnim.Translation, null, 2) : "") + (textureAnim.Rotation ? generateAnimVectorProp("Rotation", textureAnim.Rotation, null, 2) : "") + (textureAnim.Scaling ? generateAnimVectorProp("Scaling", textureAnim.Scaling, null, 2) : "") + generateBlockEnd(1);
}
function generateGeosets$1(model) {
  if (!model.Geosets.length) return "";
  return model.Geosets.map((it) => generateGeosetChunk(model, it)).join("");
}
function generateGeosetChunk(model, geoset) {
  let middle = "";
  if (model.Version >= 900) middle += (geoset.LevelOfDetail !== void 0 ? generateIntProp("LevelOfDetail", geoset.LevelOfDetail) : "") + (geoset.Name ? generateWrappedStringProp("Name", geoset.Name) : "") + (geoset.Tangents ? generateGeosetArray("Tangents", geoset.Tangents, 4) : "") + (geoset.SkinWeights ? generateGeosetArray("SkinWeights", geoset.SkinWeights, 8) : "");
  return generateBlockStart("Geoset") + generateGeosetArray("Vertices", geoset.Vertices, 3) + generateGeosetArray("Normals", geoset.Normals, 3) + generateGeosetArray("TVertices", geoset.TVertices[0], 2) + generateGeosetVertexGroup(geoset.VertexGroup) + generateGeosetFaces(geoset.Faces) + generateGeosetGroups(geoset.Groups) + generateFloatArrayProp("MinimumExtent", geoset.MinimumExtent) + generateFloatArrayProp("MaximumExtent", geoset.MaximumExtent) + generateFloatPropIfNotEmpty("BoundsRadius", geoset.BoundsRadius) + generateGeosetAnimInfos(geoset.Anims) + generateIntProp("MaterialID", geoset.MaterialID) + generateIntProp("SelectionGroup", geoset.SelectionGroup) + (geoset.Unselectable ? generateBooleanProp("Unselectable") : "") + middle + generateBlockEnd();
}
function generateGeosetArray(name, arr, elemLength) {
  let middle = "";
  const elemCount = arr.length / elemLength;
  for (let i = 0; i < elemCount; ++i) middle += generateTab(2) + generateArray(arr.slice(i * elemLength, (i + 1) * elemLength)) + ",\n";
  return generateBlockStart(name, elemCount, 1) + middle + generateBlockEnd(1);
}
function generateGeosetVertexGroup(arr) {
  if (!arr.length) return "";
  let middle = "";
  for (let i = 0; i < arr.length; ++i) middle += generateTab(2) + arr[i] + ",\n";
  return generateBlockStart("VertexGroup", null, 1) + middle + generateBlockEnd(1);
}
function generateGeosetFaces(arr) {
  return generateBlockStart(`Faces 1 ${arr.length}`, null, 1) + generateBlockStart("Triangles", null, 2) + generateTab(3) + generateUIntArray(arr) + ",\n" + generateBlockEnd(2) + generateBlockEnd(1);
}
function generateGeosetGroups(groups) {
  let totalMatrices = 0;
  let middle = "";
  for (const group of groups) {
    totalMatrices += group.length;
    middle += generateTab(2) + "Matrices " + generateUIntArray(group) + ",\n";
  }
  return generateBlockStart(`Groups ${groups.length} ${totalMatrices}`, null, 1) + middle + generateBlockEnd(1);
}
function generateGeosetAnimInfos(anims) {
  if (!anims) return "";
  return anims.map(generateGeosetAnimInfoChunk).join("");
}
function generateGeosetAnimInfoChunk(anim) {
  return generateBlockStart("Anim", null, 1) + generateFloatArrayProp("MinimumExtent", anim.MinimumExtent, null, 2) + generateFloatArrayProp("MaximumExtent", anim.MaximumExtent, null, 2) + generateFloatPropIfNotEmpty("BoundsRadius", anim.BoundsRadius, 0, null, 2) + generateBlockEnd(1);
}
function generateGeosetAnims$1(model) {
  if (!model.GeosetAnims.length) return "";
  return model.GeosetAnims.map(generateGeosetAnimChunk).join("");
}
function generateColorProp(name, color2, isStatic, tabSize = 1) {
  if (color2) if (color2 instanceof Float32Array) {
    if (!isStatic || isNotEmptyVec3(color2, 1)) {
      let middle = "";
      for (let i = 2; i >= 0; --i) {
        if (i < 2) middle += ", ";
        middle += generateNumber(color2[i]);
      }
      return `${generateTab(tabSize)}${isStatic ? "static " : ""}${name} { ${middle} },
`;
    }
  } else return generateAnimVectorProp(name, color2, null, tabSize, true);
  return "";
}
function generateGeosetAnimChunk(geosetAnim) {
  return generateBlockStart("GeosetAnim") + generateIntProp("GeosetId", geosetAnim.GeosetId) + generateAnimVectorProp("Alpha", geosetAnim.Alpha, 1) + generateColorProp("Color", geosetAnim.Color, true) + (geosetAnim.Flags & GeosetAnimFlags.DropShadow ? generateBooleanProp("DropShadow") : "") + generateBlockEnd();
}
function generateNodeProps(node) {
  return generateIntProp("ObjectId", node.ObjectId) + generateIntPropIfNotEmpty("Parent", node.Parent, null) + generateNodeDontInherit(node.Flags) + (node.Flags & NodeFlags.Billboarded ? generateBooleanProp("Billboarded") : "") + (node.Flags & NodeFlags.BillboardedLockX ? generateBooleanProp("BillboardedLockX") : "") + (node.Flags & NodeFlags.BillboardedLockY ? generateBooleanProp("BillboardedLockY") : "") + (node.Flags & NodeFlags.BillboardedLockZ ? generateBooleanProp("BillboardedLockZ") : "") + (node.Flags & NodeFlags.CameraAnchored ? generateBooleanProp("CameraAnchored") : "") + (node.Translation !== void 0 ? generateAnimVectorProp("Translation", node.Translation) : "") + (node.Rotation !== void 0 ? generateAnimVectorProp("Rotation", node.Rotation) : "") + (node.Scaling !== void 0 ? generateAnimVectorProp("Scaling", node.Scaling) : "");
}
function generateNodeDontInherit(flags) {
  const flagsStrs = [];
  if (flags & NodeFlags.DontInheritTranslation) flagsStrs.push("Translation");
  if (flags & NodeFlags.DontInheritRotation) flagsStrs.push("Rotation");
  if (flags & NodeFlags.DontInheritScaling) flagsStrs.push("Scaling");
  if (!flagsStrs.length) return "";
  return generateTab(1) + "DontInherit { " + flagsStrs.join(", ") + " },\n";
}
function generateBones$1(model) {
  if (!model.Bones.length) return "";
  return model.Bones.map(generateBoneChunk).join("");
}
function generateBoneChunk(bone) {
  return generateBlockStart("Bone", bone.Name) + generateNodeProps(bone) + (bone.GeosetId !== null ? generateIntProp("GeosetId", bone.GeosetId) : generateStringProp("GeosetId", "Multiple")) + (bone.GeosetAnimId !== null ? generateIntProp("GeosetAnimId", bone.GeosetAnimId) : generateStringProp("GeosetAnimId", "None")) + generateBlockEnd();
}
function generateLights$1(model) {
  if (!model.Lights.length) return "";
  return model.Lights.map(generateLightChunk).join("");
}
function generateLightChunk(light) {
  return generateBlockStart("Light", light.Name) + generateNodeProps(light) + generateBooleanProp(generateLightType(light.LightType)) + generateAnimVectorProp("AttenuationStart", light.AttenuationStart) + generateAnimVectorProp("AttenuationEnd", light.AttenuationEnd) + generateColorProp("Color", light.Color, true) + generateAnimVectorProp("Intensity", light.Intensity, null) + generateColorProp("AmbColor", light.AmbColor, true) + generateAnimVectorProp("AmbIntensity", light.AmbIntensity, null) + generateAnimVectorProp("Visibility", light.Visibility, 1) + generateBlockEnd();
}
function generateLightType(lightType) {
  switch (lightType) {
    case LightType.Omnidirectional:
      return "Omnidirectional";
    case LightType.Directional:
      return "Directional";
    case LightType.Ambient:
      return "Ambient";
  }
  return "";
}
function generateHelpers$1(model) {
  return model.Helpers.map(generateHelperChunk).join("");
}
function generateHelperChunk(helper) {
  return generateBlockStart("Helper", helper.Name) + generateNodeProps(helper) + generateBlockEnd();
}
function generateAttachments$1(model) {
  return model.Attachments.map(generateAttachmentChunk).join("");
}
function generateAttachmentChunk(attachment) {
  return generateBlockStart("Attachment", attachment.Name) + generateNodeProps(attachment) + generateIntProp("AttachmentID", attachment.AttachmentID) + (attachment.Path ? generateWrappedStringProp("Path", attachment.Path) : "") + generateAnimVectorProp("Visibility", attachment.Visibility, 1) + generateBlockEnd();
}
function generatePivotPoints$1(model) {
  return generateBlockStart("PivotPoints", model.PivotPoints.length) + model.PivotPoints.map((point) => `${generateTab()}${generateArray(point)},
`).join("") + generateBlockEnd();
}
function generateParticleEmitters$1(model) {
  return model.ParticleEmitters.map(generateParticleEmitterChunk).join("");
}
function generateParticleEmitterChunk(emitter) {
  return generateBlockStart("ParticleEmitter", emitter.Name) + generateNodeProps(emitter) + (emitter.Flags & ParticleEmitterFlags.EmitterUsesMDL ? generateBooleanProp("EmitterUsesMDL") : "") + (emitter.Flags & ParticleEmitterFlags.EmitterUsesTGA ? generateBooleanProp("EmitterUsesTGA") : "") + generateAnimVectorProp("EmissionRate", emitter.EmissionRate) + generateAnimVectorProp("Gravity", emitter.Gravity) + generateAnimVectorProp("Longitude", emitter.Longitude) + generateAnimVectorProp("Latitude", emitter.Latitude) + generateAnimVectorProp("Visibility", emitter.Visibility) + generateBlockStart("Particle", null, 1) + generateAnimVectorProp("LifeSpan", emitter.LifeSpan, null, 2) + generateAnimVectorProp("InitVelocity", emitter.InitVelocity, null, 2) + generateWrappedStringProp("Path", emitter.Path, false, 2) + generateBlockEnd(1) + generateBlockEnd();
}
function generateParticleEmitters2$1(model) {
  return model.ParticleEmitters2.map(generateParticleEmitter2Chunk).join("");
}
function generateParticleEmitters2FilterMode(filterMode) {
  switch (filterMode) {
    case ParticleEmitter2FilterMode.Blend:
      return "Blend";
    case ParticleEmitter2FilterMode.Additive:
      return "Additive";
    case ParticleEmitter2FilterMode.Modulate:
      return "Modulate";
    case ParticleEmitter2FilterMode.Modulate2x:
      return "Modulate2x";
    case ParticleEmitter2FilterMode.AlphaKey:
      return "AlphaKey";
  }
  return "";
}
function generateSegmentColor(colors) {
  return generateBlockStart("SegmentColor", null, 1) + colors.map((color2) => generateColorProp("Color", color2, false, 2)).join("") + generateTab() + "},\n";
}
function generateParticleEmitter2FrameFlags(frameFlags) {
  if (frameFlags & ParticleEmitter2FramesFlags.Head && frameFlags & ParticleEmitter2FramesFlags.Tail) return "Both";
  else if (frameFlags & ParticleEmitter2FramesFlags.Head) return "Head";
  else if (frameFlags & ParticleEmitter2FramesFlags.Tail) return "Tail";
  return "";
}
function generateParticleEmitter2Chunk(particleEmitter2) {
  return generateBlockStart("ParticleEmitter2", particleEmitter2.Name) + generateNodeProps(particleEmitter2) + generateBooleanProp(generateParticleEmitters2FilterMode(particleEmitter2.FilterMode)) + generateAnimVectorProp("Speed", particleEmitter2.Speed, null) + generateAnimVectorProp("Variation", particleEmitter2.Variation, null) + generateAnimVectorProp("Latitude", particleEmitter2.Latitude, null) + generateAnimVectorProp("Gravity", particleEmitter2.Gravity, null) + generateAnimVectorProp("EmissionRate", particleEmitter2.EmissionRate, null) + generateAnimVectorProp("Width", particleEmitter2.Width, null) + generateAnimVectorProp("Length", particleEmitter2.Length, null) + generateAnimVectorProp("Visibility", particleEmitter2.Visibility, 1) + generateSegmentColor(particleEmitter2.SegmentColor) + generateUIntArrayProp("Alpha", particleEmitter2.Alpha) + generateFloatArrayProp("ParticleScaling", particleEmitter2.ParticleScaling) + generateFloatArrayProp("LifeSpanUVAnim", particleEmitter2.LifeSpanUVAnim) + generateFloatArrayProp("DecayUVAnim", particleEmitter2.DecayUVAnim) + generateFloatArrayProp("TailUVAnim", particleEmitter2.TailUVAnim) + generateFloatArrayProp("TailDecayUVAnim", particleEmitter2.TailDecayUVAnim) + generateIntPropIfNotEmpty("Rows", particleEmitter2.Rows, 0) + generateIntPropIfNotEmpty("Columns", particleEmitter2.Columns, 0) + generateIntProp("TextureID", particleEmitter2.TextureID) + generateIntPropIfNotEmpty("Time", particleEmitter2.Time, 0) + generateIntPropIfNotEmpty("LifeSpan", particleEmitter2.LifeSpan, 0) + generateIntPropIfNotEmpty("TailLength", particleEmitter2.TailLength, 0) + generateIntPropIfNotEmpty("PriorityPlane", particleEmitter2.PriorityPlane, 0) + generateIntPropIfNotEmpty("ReplaceableId", particleEmitter2.ReplaceableId, null) + (particleEmitter2.Flags & ParticleEmitter2Flags.SortPrimsFarZ ? generateBooleanProp("SortPrimsFarZ") : "") + (particleEmitter2.Flags & ParticleEmitter2Flags.LineEmitter ? generateBooleanProp("LineEmitter") : "") + (particleEmitter2.Flags & ParticleEmitter2Flags.ModelSpace ? generateBooleanProp("ModelSpace") : "") + (particleEmitter2.Flags & ParticleEmitter2Flags.Unshaded ? generateBooleanProp("Unshaded") : "") + (particleEmitter2.Flags & ParticleEmitter2Flags.Unfogged ? generateBooleanProp("Unfogged") : "") + (particleEmitter2.Flags & ParticleEmitter2Flags.XYQuad ? generateBooleanProp("XYQuad") : "") + (particleEmitter2.Squirt ? generateBooleanProp("Squirt") : "") + generateBooleanProp(generateParticleEmitter2FrameFlags(particleEmitter2.FrameFlags)) + generateBlockEnd();
}
function generateRibbonEmitters$1(model) {
  return model.RibbonEmitters.map(generateRibbonEmitterChunk).join("");
}
function generateRibbonEmitterChunk(ribbonEmitter) {
  return generateBlockStart("RibbonEmitter", ribbonEmitter.Name) + generateNodeProps(ribbonEmitter) + generateAnimVectorProp("HeightAbove", ribbonEmitter.HeightAbove, null) + generateAnimVectorProp("HeightBelow", ribbonEmitter.HeightBelow, null) + generateAnimVectorProp("Alpha", ribbonEmitter.Alpha, null) + generateColorProp("Color", ribbonEmitter.Color, true) + generateAnimVectorProp("TextureSlot", ribbonEmitter.TextureSlot, null) + generateAnimVectorProp("Visibility", ribbonEmitter.Visibility, 1) + generateIntProp("EmissionRate", ribbonEmitter.EmissionRate) + generateIntProp("LifeSpan", ribbonEmitter.LifeSpan) + generateIntPropIfNotEmpty("Gravity", ribbonEmitter.Gravity, 0) + generateIntProp("Rows", ribbonEmitter.Rows) + generateIntProp("Columns", ribbonEmitter.Columns) + generateIntProp("MaterialID", ribbonEmitter.MaterialID) + generateBlockEnd();
}
function generateEventObjects$1(model) {
  return model.EventObjects.map(generateEventObjectChunk).join("");
}
function generateEventTrack(eventTrack) {
  let middle = "";
  for (let i = 0; i < eventTrack.length; ++i) middle += generateTab(2) + eventTrack[i] + ",\n";
  return generateBlockStart("EventTrack", eventTrack.length, 1) + middle + generateBlockEnd(1);
}
function generateEventObjectChunk(eventObject) {
  return generateBlockStart("EventObject", eventObject.Name) + generateNodeProps(eventObject) + generateEventTrack(eventObject.EventTrack) + generateBlockEnd();
}
function generateCameras$1(model) {
  return model.Cameras.map(generateCameraChunk).join("");
}
function generateCameraChunk(camera) {
  return generateBlockStart("Camera", camera.Name) + generateFloatProp("FieldOfView", camera.FieldOfView) + generateFloatProp("FarClip", camera.FarClip) + generateFloatProp("NearClip", camera.NearClip) + generateFloatArrayProp("Position", camera.Position) + generateAnimVectorProp("Translation", camera.Translation) + generateAnimVectorProp("Rotation", camera.Rotation) + generateBlockStart("Target", null, 1) + generateFloatArrayProp("Position", camera.TargetPosition, null, 2) + generateAnimVectorProp("Translation", camera.TargetTranslation, null, 2) + generateBlockEnd(1) + generateBlockEnd();
}
function generateCollisionShapes$1(model) {
  return model.CollisionShapes.map(generateCollisionShapeChunk).join("");
}
function generateCollisionShapeChunk(collisionShape) {
  let middle;
  if (collisionShape.Shape === CollisionShapeType.Box) {
    middle = generateBooleanProp("Box");
    middle += generateBlockStart("Vertices", 2, 1) + generateTab(2) + generateArray(collisionShape.Vertices.slice(0, 3)) + ",\n" + generateTab(2) + generateArray(collisionShape.Vertices.slice(3, 6)) + ",\n" + generateBlockEnd(1);
  } else {
    middle = generateBooleanProp("Sphere");
    middle += generateBlockStart("Vertices", 1, 1) + generateTab(2) + generateArray(collisionShape.Vertices) + ",\n" + generateBlockEnd(1) + generateFloatProp("BoundsRadius", collisionShape.BoundsRadius);
  }
  return generateBlockStart("CollisionShape", collisionShape.Name) + generateNodeProps(collisionShape) + middle + generateBlockEnd();
}
function generateFaceFX$1(model) {
  if (model.Version < 900 || !model.FaceFX) return "";
  return model.FaceFX.map(generateFaceFXChunk).join("");
}
function generateFaceFXChunk(faceFX) {
  return generateBlockStart("FaceFX", faceFX.Name) + generateWrappedStringProp("Path", faceFX.Path) + generateBlockEnd();
}
function generateBindPose(model) {
  if (model.Version < 900 || !model.BindPoses) return "";
  return model.BindPoses.map(generateBindPoseChunk).join("");
}
function generateBindPoseChunk(bindPose) {
  const middle = generateBlockStart("Matrices", bindPose.Matrices.length, 1) + bindPose.Matrices.map((item) => {
    return generateTab(2) + generateArray(item) + ",";
  }).join("\n") + "\n" + generateBlockEnd(1);
  return generateBlockStart("BindPose") + middle + generateBlockEnd();
}
function generateParticleEmitterPopcorn(model) {
  if (model.Version < 900 || !model.ParticleEmitterPopcorns) return "";
  return model.ParticleEmitterPopcorns.map(generateParticleEmitterPopcornChunk).join("");
}
function generateParticleEmitterPopcornChunk(emitter) {
  return generateBlockStart("ParticleEmitterPopcorn", emitter.Name) + generateNodeProps(emitter) + (emitter.Flags & ParticleEmitterPopcornFlags.Unshaded ? generateBooleanProp("Unshaded") : "") + (emitter.Flags & ParticleEmitterPopcornFlags.SortPrimsFarZ ? generateBooleanProp("SortPrimsFarZ") : "") + (emitter.Flags & ParticleEmitterPopcornFlags.Unfogged ? generateBooleanProp("Unfogged") : "") + generateAnimVectorProp("LifeSpan", emitter.LifeSpan, null) + generateAnimVectorProp("EmissionRate", emitter.EmissionRate, 0) + generateAnimVectorProp("Speed", emitter.Speed, 0) + generateColorProp("Color", emitter.Color, true) + generateAnimVectorProp("Alpha", emitter.Alpha, 1) + generateIntPropIfNotEmpty("ReplaceableId", emitter.ReplaceableId, 0, null) + generateWrappedStringProp("Path", emitter.Path, false) + generateWrappedStringProp("AnimVisibilityGuide", emitter.AnimVisibilityGuide, false) + generateAnimVectorProp("Visibility", emitter.Visibility) + generateBlockEnd();
}
var generators$1 = [
  generateVersion$1,
  generateModel,
  generateSequences$1,
  generateGlobalSequences$1,
  generateTextures$1,
  generateMaterials$1,
  generateTextureAnims$1,
  generateGeosets$1,
  generateGeosetAnims$1,
  generateBones$1,
  generateLights$1,
  generateHelpers$1,
  generateAttachments$1,
  generatePivotPoints$1,
  generateParticleEmitters$1,
  generateParticleEmitters2$1,
  generateRibbonEmitters$1,
  generateEventObjects$1,
  generateCameras$1,
  generateCollisionShapes$1,
  generateFaceFX$1,
  generateBindPose,
  generateParticleEmitterPopcorn
];
function generate(model) {
  let res = "";
  for (const generator of generators$1) res += generator(model);
  return res;
}
var BIG_ENDIAN = true;
var NONE = -1;
var Stream = class {
  constructor(arrayBuffer2) {
    this.ab = arrayBuffer2;
    this.uint = new Uint8Array(this.ab);
    this.view = new DataView(this.ab);
    this.pos = 0;
  }
  keyword(keyword) {
    this.uint[this.pos] = keyword.charCodeAt(0);
    this.uint[this.pos + 1] = keyword.charCodeAt(1);
    this.uint[this.pos + 2] = keyword.charCodeAt(2);
    this.uint[this.pos + 3] = keyword.charCodeAt(3);
    this.pos += 4;
  }
  uint8(num) {
    this.view.setUint8(this.pos, num);
    this.pos += 1;
  }
  uint16(num) {
    this.view.setUint16(this.pos, num, BIG_ENDIAN);
    this.pos += 2;
  }
  int32(num) {
    this.view.setInt32(this.pos, num, BIG_ENDIAN);
    this.pos += 4;
  }
  uint32(num) {
    this.view.setUint32(this.pos, num, BIG_ENDIAN);
    this.pos += 4;
  }
  float32(num) {
    this.view.setFloat32(this.pos, num, BIG_ENDIAN);
    this.pos += 4;
  }
  float32Array(arr) {
    for (let i = 0; i < arr.length; ++i) this.float32(arr[i]);
  }
  uint8Array(arr) {
    for (let i = 0; i < arr.length; ++i) this.uint8(arr[i]);
  }
  uint16Array(arr) {
    for (let i = 0; i < arr.length; ++i) this.uint16(arr[i]);
  }
  int32Array(arr) {
    for (let i = 0; i < arr.length; ++i) this.int32(arr[i]);
  }
  uint32Array(arr) {
    for (let i = 0; i < arr.length; ++i) this.uint32(arr[i]);
  }
  str(str2, len2) {
    for (let i = 0; i < len2; ++i, ++this.pos) this.uint[this.pos] = i < str2.length ? str2.charCodeAt(i) : 0;
  }
  animVector(animVector, type) {
    const isInt = type === AnimVectorType.INT1;
    this.int32(animVector.Keys.length);
    this.int32(animVector.LineType);
    this.int32(animVector.GlobalSeqId !== null ? animVector.GlobalSeqId : NONE);
    for (const keyFrame of animVector.Keys) {
      this.int32(keyFrame.Frame);
      if (isInt) this.int32Array(keyFrame.Vector);
      else this.float32Array(keyFrame.Vector);
      if (animVector.LineType === LineType.Hermite || animVector.LineType === LineType.Bezier) if (isInt) {
        this.int32Array(keyFrame.InTan);
        this.int32Array(keyFrame.OutTan);
      } else {
        this.float32Array(keyFrame.InTan);
        this.float32Array(keyFrame.OutTan);
      }
    }
  }
};
function generateExtent(obj, stream) {
  stream.float32(obj.BoundsRadius || 0);
  for (const key of ["MinimumExtent", "MaximumExtent"]) stream.float32Array(obj[key]);
}
var AnimVectorType = /* @__PURE__ */ (function(AnimVectorType2) {
  AnimVectorType2[AnimVectorType2["INT1"] = 0] = "INT1";
  AnimVectorType2[AnimVectorType2["FLOAT1"] = 1] = "FLOAT1";
  AnimVectorType2[AnimVectorType2["FLOAT3"] = 2] = "FLOAT3";
  AnimVectorType2[AnimVectorType2["FLOAT4"] = 3] = "FLOAT4";
  return AnimVectorType2;
})(AnimVectorType || {});
var animVectorSize = {
  [AnimVectorType.INT1]: 1,
  [AnimVectorType.FLOAT1]: 1,
  [AnimVectorType.FLOAT3]: 3,
  [AnimVectorType.FLOAT4]: 4
};
function byteLengthAnimVector(animVector, type) {
  return 12 + animVector.Keys.length * (4 + 4 * animVectorSize[type] * (animVector.LineType === LineType.Hermite || animVector.LineType === LineType.Bezier ? 3 : 1));
}
function sum(arr) {
  return arr.reduce((a, b) => {
    return a + b;
  }, 0);
}
function byteLengthVersion() {
  return 12;
}
function generateVersion(model, stream) {
  stream.keyword("VERS");
  stream.int32(4);
  stream.int32(model.Version);
}
var MODEL_NAME_LENGTH = 336;
function byteLengthModelInfo() {
  return 8 + MODEL_NAME_LENGTH + 4 + 28 + 4;
}
function generateModelInfo(model, stream) {
  stream.keyword("MODL");
  stream.int32(byteLengthModelInfo() - 8);
  stream.str(model.Info.Name, MODEL_NAME_LENGTH);
  stream.int32(0);
  generateExtent(model.Info, stream);
  stream.int32(model.Info.BlendTime);
}
var MODEL_SEQUENCE_NAME_LENGTH = 80;
function byteLengthSequence() {
  return MODEL_SEQUENCE_NAME_LENGTH + 8 + 4 + 4 + 4 + 4 + 28;
}
function byteLengthSequences(model) {
  if (!model.Sequences.length) return 0;
  return 8 + sum(model.Sequences.map(byteLengthSequence));
}
function generateSequences(model, stream) {
  if (!model.Sequences.length) return;
  stream.keyword("SEQS");
  stream.int32(byteLengthSequences(model) - 8);
  for (const sequence of model.Sequences) {
    stream.str(sequence.Name, MODEL_SEQUENCE_NAME_LENGTH);
    stream.int32(sequence.Interval[0]);
    stream.int32(sequence.Interval[1]);
    stream.float32(sequence.MoveSpeed);
    stream.int32(sequence.NonLooping ? 1 : 0);
    stream.float32(sequence.Rarity);
    stream.int32(0);
    generateExtent(sequence, stream);
  }
}
function byteLengthGlobalSequences(model) {
  if (!model.GlobalSequences || !model.GlobalSequences.length) return 0;
  return 8 + 4 * model.GlobalSequences.length;
}
function generateGlobalSequences(model, stream) {
  if (!model.GlobalSequences || !model.GlobalSequences.length) return;
  stream.keyword("GLBS");
  stream.int32(model.GlobalSequences.length * 4);
  for (const duration of model.GlobalSequences) stream.int32(duration);
}
function byteLengthLayer(model, layer) {
  return 28 + (model.Version >= 900 ? 4 : 0) + (model.Version >= 1e3 ? 20 : 0) + (model.Version >= 1100 ? 8 + LAYER_TEXTURE_ID_MAP.reduce((acc, name) => {
    return acc + (typeof layer[name] !== "undefined" ? 8 + (typeof layer[name] === "object" ? 4 + byteLengthAnimVector(layer[name], AnimVectorType.INT1) : 0) : 0);
  }, 0) : 0) + (layer.Alpha !== null && typeof layer.Alpha !== "number" ? 4 + byteLengthAnimVector(layer.Alpha, AnimVectorType.FLOAT1) : 0) + (model.Version < 1100 && layer.TextureID !== null && typeof layer.TextureID !== "number" ? 4 + byteLengthAnimVector(layer.TextureID, AnimVectorType.INT1) : 0) + (model.Version >= 900 && layer.EmissiveGain !== void 0 && layer.EmissiveGain !== null && typeof layer.EmissiveGain !== "number" ? 4 + byteLengthAnimVector(layer.EmissiveGain, AnimVectorType.FLOAT1) : 0) + (model.Version >= 1e3 && layer.FresnelColor !== void 0 && layer.FresnelColor !== null && !(layer.FresnelColor instanceof Float32Array) ? 4 + byteLengthAnimVector(layer.FresnelColor, AnimVectorType.FLOAT3) : 0) + (model.Version >= 1e3 && layer.FresnelOpacity !== void 0 && layer.FresnelOpacity !== null && typeof layer.FresnelOpacity !== "number" ? 4 + byteLengthAnimVector(layer.FresnelOpacity, AnimVectorType.FLOAT1) : 0) + (model.Version >= 1e3 && layer.FresnelTeamColor !== void 0 && layer.FresnelTeamColor !== null && typeof layer.FresnelTeamColor !== "number" ? 4 + byteLengthAnimVector(layer.FresnelTeamColor, AnimVectorType.FLOAT1) : 0);
}
function byteLengthMaterial(model, material) {
  return 20 + (model.Version >= 900 && model.Version < 1100 ? 80 : 0) + sum(material.Layers.map((layer) => byteLengthLayer(model, layer)));
}
function byteLengthMaterials(model) {
  if (!model.Materials.length) return 0;
  return 8 + sum(model.Materials.map((material) => byteLengthMaterial(model, material)));
}
function generateMaterials(model, stream) {
  if (!model.Materials.length) return;
  stream.keyword("MTLS");
  stream.int32(byteLengthMaterials(model) - 8);
  for (const material of model.Materials) {
    stream.int32(byteLengthMaterial(model, material));
    stream.int32(material.PriorityPlane);
    stream.int32(material.RenderMode);
    if (model.Version >= 900 && model.Version < 1100) stream.str(material.Shader || "", 80);
    stream.keyword("LAYS");
    stream.int32(material.Layers.length);
    for (const layer of material.Layers) {
      stream.int32(byteLengthLayer(model, layer));
      stream.int32(layer.FilterMode);
      stream.int32(layer.Shading);
      stream.int32(model.Version < 1100 && typeof layer.TextureID === "number" ? layer.TextureID : 0);
      stream.int32(layer.TVertexAnimId !== null ? layer.TVertexAnimId : NONE);
      stream.int32(layer.CoordId);
      stream.float32(typeof layer.Alpha === "number" ? layer.Alpha : 1);
      if (model.Version >= 900) {
        stream.float32(typeof layer.EmissiveGain === "number" ? layer.EmissiveGain : 1);
        if (model.Version >= 1e3) {
          stream.float32Array(layer.FresnelColor instanceof Float32Array ? layer.FresnelColor : new Float32Array([
            1,
            1,
            1
          ]));
          stream.float32(typeof layer.FresnelOpacity === "number" ? layer.FresnelOpacity : 0);
          stream.float32(typeof layer.FresnelTeamColor === "number" ? layer.FresnelTeamColor : 0);
        }
      }
      if (model.Version >= 1100) {
        stream.int32(layer.ShaderTypeId || 0);
        const textures = LAYER_TEXTURE_ID_MAP.filter((name) => layer[name] !== void 0).length;
        stream.int32(textures);
        for (let i = 0; i < LAYER_TEXTURE_ID_MAP.length; ++i) {
          const id = layer[LAYER_TEXTURE_ID_MAP[i]];
          if (id === void 0) continue;
          stream.int32(typeof id === "number" ? id : 0);
          stream.int32(typeof id === "number" ? i : 0);
          if (typeof id === "object") {
            stream.keyword("KMTF");
            stream.animVector(id, AnimVectorType.INT1);
          }
        }
      }
      if (layer.Alpha && typeof layer.Alpha !== "number") {
        stream.keyword("KMTA");
        stream.animVector(layer.Alpha, AnimVectorType.FLOAT1);
      }
      if (model.Version < 1100 && layer.TextureID && typeof layer.TextureID !== "number") {
        stream.keyword("KMTF");
        stream.animVector(layer.TextureID, AnimVectorType.INT1);
      }
      if (model.Version >= 900 && layer.EmissiveGain && typeof layer.EmissiveGain !== "number") {
        stream.keyword("KMTE");
        stream.animVector(layer.EmissiveGain, AnimVectorType.FLOAT1);
      }
      if (model.Version >= 1e3 && layer.FresnelColor && !(layer.FresnelColor instanceof Float32Array)) {
        stream.keyword("KFC3");
        stream.animVector(layer.FresnelColor, AnimVectorType.FLOAT3);
      }
      if (model.Version >= 1e3 && layer.FresnelOpacity && typeof layer.FresnelOpacity !== "number") {
        stream.keyword("KFCA");
        stream.animVector(layer.FresnelOpacity, AnimVectorType.FLOAT1);
      }
      if (model.Version >= 1e3 && layer.FresnelTeamColor && typeof layer.FresnelTeamColor !== "number") {
        stream.keyword("KFTC");
        stream.animVector(layer.FresnelTeamColor, AnimVectorType.FLOAT1);
      }
    }
  }
}
var MODEL_TEXTURE_PATH_LENGTH = 256;
function byteLengthTexture() {
  return 4 + MODEL_TEXTURE_PATH_LENGTH + 4 + 4;
}
function byteLengthTextures(model) {
  if (!model.Textures.length) return 0;
  return 8 + sum(model.Textures.map((_texture) => byteLengthTexture()));
}
function generateTextures(model, stream) {
  if (!model.Textures.length) return;
  stream.keyword("TEXS");
  stream.int32(byteLengthTextures(model) - 8);
  for (const texture of model.Textures) {
    stream.int32(texture.ReplaceableId);
    stream.str(texture.Image, MODEL_TEXTURE_PATH_LENGTH);
    stream.int32(0);
    stream.int32(texture.Flags);
  }
}
function byteLengthTextureAnim(anim) {
  return 4 + (anim.Translation ? 4 + byteLengthAnimVector(anim.Translation, AnimVectorType.FLOAT3) : 0) + (anim.Rotation ? 4 + byteLengthAnimVector(anim.Rotation, AnimVectorType.FLOAT4) : 0) + (anim.Scaling ? 4 + byteLengthAnimVector(anim.Scaling, AnimVectorType.FLOAT3) : 0);
}
function byteLengthTextureAnims(model) {
  if (!model.TextureAnims || !model.TextureAnims.length) return 0;
  return 8 + sum(model.TextureAnims.map((anim) => byteLengthTextureAnim(anim)));
}
function generateTextureAnims(model, stream) {
  if (!model.TextureAnims || !model.TextureAnims.length) return;
  stream.keyword("TXAN");
  stream.int32(byteLengthTextureAnims(model) - 8);
  for (const anim of model.TextureAnims) {
    stream.int32(byteLengthTextureAnim(anim));
    if (anim.Translation) {
      stream.keyword("KTAT");
      stream.animVector(anim.Translation, AnimVectorType.FLOAT3);
    }
    if (anim.Rotation) {
      stream.keyword("KTAR");
      stream.animVector(anim.Rotation, AnimVectorType.FLOAT4);
    }
    if (anim.Scaling) {
      stream.keyword("KTAS");
      stream.animVector(anim.Scaling, AnimVectorType.FLOAT3);
    }
  }
}
function byteLengthGeoset(model, geoset) {
  return 12 + 4 * geoset.Vertices.length + 4 + 4 + 4 * geoset.Normals.length + 4 + 4 + 4 + 4 + 4 + 4 + 4 + 4 + 2 * geoset.Faces.length + 4 + 4 + geoset.VertexGroup.length + 4 + 4 + 4 * geoset.Groups.length + 4 + 4 + 4 * geoset.TotalGroupsCount + 4 + 4 + 4 + (model.Version >= 900 ? 84 : 0) + (model.Version >= 900 && geoset.Tangents?.length ? 8 + 4 * geoset.Tangents.length : 0) + (model.Version >= 900 && geoset.SkinWeights?.length ? 8 + geoset.SkinWeights.length : 0) + 28 + 4 + 28 * geoset.Anims.length + 4 + 4 + sum(geoset.TVertices.map((tvertices) => 8 + 4 * tvertices.length));
}
function byteLengthGeosets(model) {
  if (!model.Geosets.length) return 0;
  return 8 + sum(model.Geosets.map((geoset) => byteLengthGeoset(model, geoset)));
}
function generateGeosets(model, stream) {
  if (!model.Geosets.length) return;
  stream.keyword("GEOS");
  stream.int32(byteLengthGeosets(model) - 8);
  for (const geoset of model.Geosets) {
    stream.int32(byteLengthGeoset(model, geoset));
    stream.keyword("VRTX");
    stream.int32(geoset.Vertices.length / 3);
    stream.float32Array(geoset.Vertices);
    stream.keyword("NRMS");
    stream.int32(geoset.Normals.length / 3);
    stream.float32Array(geoset.Normals);
    stream.keyword("PTYP");
    stream.int32(1);
    stream.int32(4);
    stream.keyword("PCNT");
    stream.int32(1);
    stream.int32(geoset.Faces.length);
    stream.keyword("PVTX");
    stream.int32(geoset.Faces.length);
    stream.uint16Array(geoset.Faces);
    stream.keyword("GNDX");
    stream.int32(geoset.VertexGroup.length);
    stream.uint8Array(geoset.VertexGroup);
    stream.keyword("MTGC");
    stream.int32(geoset.Groups.length);
    for (let i = 0; i < geoset.Groups.length; ++i) stream.int32(geoset.Groups[i].length);
    stream.keyword("MATS");
    stream.int32(geoset.TotalGroupsCount);
    for (const group of geoset.Groups) for (const index2 of group) stream.int32(index2);
    stream.int32(geoset.MaterialID);
    stream.int32(geoset.SelectionGroup);
    stream.int32(geoset.Unselectable ? 4 : 0);
    if (model.Version >= 900) {
      stream.int32(typeof geoset.LevelOfDetail === "number" ? geoset.LevelOfDetail : -1);
      stream.str(geoset.Name || "", 80);
    }
    generateExtent(geoset, stream);
    stream.int32(geoset.Anims.length);
    for (const anim of geoset.Anims) generateExtent(anim, stream);
    if (model.Version >= 900) {
      if (geoset.Tangents && geoset.Tangents.length) {
        stream.keyword("TANG");
        stream.int32(geoset.Tangents.length / 4);
        stream.float32Array(geoset.Tangents);
      }
      if (geoset.SkinWeights && geoset.SkinWeights.length) {
        stream.keyword("SKIN");
        stream.int32(geoset.SkinWeights.length);
        stream.uint8Array(geoset.SkinWeights);
      }
    }
    stream.keyword("UVAS");
    stream.int32(geoset.TVertices.length);
    for (const tvertices of geoset.TVertices) {
      stream.keyword("UVBS");
      stream.int32(tvertices.length / 2);
      stream.float32Array(tvertices);
    }
  }
}
function byteLengthGeosetAnim(anim) {
  return 28 + (typeof anim.Alpha !== "number" ? 4 + byteLengthAnimVector(anim.Alpha, AnimVectorType.FLOAT1) : 0) + (anim.Color && !(anim.Color instanceof Float32Array) ? 4 + byteLengthAnimVector(anim.Color, AnimVectorType.FLOAT3) : 0);
}
function byteLengthGeosetAnims(model) {
  if (!model.GeosetAnims.length) return 0;
  return 8 + sum(model.GeosetAnims.map((anim) => byteLengthGeosetAnim(anim)));
}
function generateGeosetAnims(model, stream) {
  if (!model.GeosetAnims.length) return;
  stream.keyword("GEOA");
  stream.int32(byteLengthGeosetAnims(model) - 8);
  for (const anim of model.GeosetAnims) {
    stream.int32(byteLengthGeosetAnim(anim));
    stream.float32(typeof anim.Alpha === "number" ? anim.Alpha : 1);
    stream.int32(anim.Flags);
    if (anim.Color && anim.Color instanceof Float32Array) {
      stream.float32(anim.Color[0]);
      stream.float32(anim.Color[1]);
      stream.float32(anim.Color[2]);
    } else {
      stream.float32(1);
      stream.float32(1);
      stream.float32(1);
    }
    stream.int32(anim.GeosetId !== null ? anim.GeosetId : NONE);
    if (anim.Alpha !== null && typeof anim.Alpha !== "number") {
      stream.keyword("KGAO");
      stream.animVector(anim.Alpha, AnimVectorType.FLOAT1);
    }
    if (anim.Color && !(anim.Color instanceof Float32Array)) {
      stream.keyword("KGAC");
      stream.animVector(anim.Color, AnimVectorType.FLOAT3);
    }
  }
}
var MODEL_NODE_NAME_LENGTH = 80;
function byteLengthNode(node) {
  return 4 + MODEL_NODE_NAME_LENGTH + 4 + 4 + 4 + (node.Translation ? 4 + byteLengthAnimVector(node.Translation, AnimVectorType.FLOAT3) : 0) + (node.Rotation ? 4 + byteLengthAnimVector(node.Rotation, AnimVectorType.FLOAT4) : 0) + (node.Scaling ? 4 + byteLengthAnimVector(node.Scaling, AnimVectorType.FLOAT3) : 0);
}
function byteLengthBone(bone) {
  return byteLengthNode(bone) + 4 + 4;
}
function byteLengthBones(model) {
  if (!model.Bones.length) return 0;
  return 8 + sum(model.Bones.map(byteLengthBone));
}
function generateNode(node, stream) {
  stream.int32(byteLengthNode(node));
  stream.str(node.Name, MODEL_NODE_NAME_LENGTH);
  stream.int32(node.ObjectId !== null ? node.ObjectId : NONE);
  stream.int32(node.Parent !== null ? node.Parent : NONE);
  stream.int32(node.Flags);
  if (node.Translation) {
    stream.keyword("KGTR");
    stream.animVector(node.Translation, AnimVectorType.FLOAT3);
  }
  if (node.Rotation) {
    stream.keyword("KGRT");
    stream.animVector(node.Rotation, AnimVectorType.FLOAT4);
  }
  if (node.Scaling) {
    stream.keyword("KGSC");
    stream.animVector(node.Scaling, AnimVectorType.FLOAT3);
  }
}
function generateBones(model, stream) {
  if (!model.Bones.length) return;
  stream.keyword("BONE");
  stream.int32(byteLengthBones(model) - 8);
  for (const bone of model.Bones) {
    generateNode(bone, stream);
    stream.int32(bone.GeosetId !== null ? bone.GeosetId : NONE);
    stream.int32(bone.GeosetAnimId !== null ? bone.GeosetAnimId : NONE);
  }
}
function byteLengthLight(light) {
  return 4 + byteLengthNode(light) + 4 + 4 + 4 + 12 + 4 + 12 + 4 + (light.Visibility ? 4 + byteLengthAnimVector(light.Visibility, AnimVectorType.FLOAT1) : 0) + (light.Color && !(light.Color instanceof Float32Array) ? 4 + byteLengthAnimVector(light.Color, AnimVectorType.FLOAT3) : 0) + (light.Intensity && typeof light.Intensity !== "number" ? 4 + byteLengthAnimVector(light.Intensity, AnimVectorType.FLOAT1) : 0) + (light.AttenuationStart && typeof light.AttenuationStart !== "number" ? 4 + byteLengthAnimVector(light.AttenuationStart, AnimVectorType.FLOAT1) : 0) + (light.AttenuationEnd && typeof light.AttenuationEnd !== "number" ? 4 + byteLengthAnimVector(light.AttenuationEnd, AnimVectorType.FLOAT1) : 0) + (light.AmbColor && !(light.AmbColor instanceof Float32Array) ? 4 + byteLengthAnimVector(light.AmbColor, AnimVectorType.FLOAT3) : 0) + (light.AmbIntensity && typeof light.AmbIntensity !== "number" ? 4 + byteLengthAnimVector(light.AmbIntensity, AnimVectorType.FLOAT1) : 0);
}
function byteLengthLights(model) {
  if (!model.Lights.length) return 0;
  return 8 + sum(model.Lights.map(byteLengthLight));
}
function generateLights(model, stream) {
  if (!model.Lights.length) return;
  stream.keyword("LITE");
  stream.int32(byteLengthLights(model) - 8);
  for (const light of model.Lights) {
    stream.int32(byteLengthLight(light));
    generateNode(light, stream);
    stream.int32(light.LightType);
    stream.float32(typeof light.AttenuationStart === "number" ? light.AttenuationStart : 0);
    stream.float32(typeof light.AttenuationEnd === "number" ? light.AttenuationEnd : 0);
    if (light.Color instanceof Float32Array) {
      stream.float32(light.Color[0]);
      stream.float32(light.Color[1]);
      stream.float32(light.Color[2]);
    } else {
      stream.float32(1);
      stream.float32(1);
      stream.float32(1);
    }
    stream.float32(typeof light.Intensity === "number" ? light.Intensity : 0);
    if (light.AmbColor instanceof Float32Array) {
      stream.float32(light.AmbColor[0]);
      stream.float32(light.AmbColor[1]);
      stream.float32(light.AmbColor[2]);
    } else {
      stream.float32(1);
      stream.float32(1);
      stream.float32(1);
    }
    stream.float32(typeof light.AmbIntensity === "number" ? light.AmbIntensity : 0);
    if (light.Intensity && typeof light.Intensity !== "number") {
      stream.keyword("KLAI");
      stream.animVector(light.Intensity, AnimVectorType.FLOAT1);
    }
    if (light.Visibility) {
      stream.keyword("KLAV");
      stream.animVector(light.Visibility, AnimVectorType.FLOAT1);
    }
    if (light.Color && !(light.Color instanceof Float32Array)) {
      stream.keyword("KLAC");
      stream.animVector(light.Color, AnimVectorType.FLOAT3);
    }
    if (light.AmbColor && !(light.AmbColor instanceof Float32Array)) {
      stream.keyword("KLBC");
      stream.animVector(light.AmbColor, AnimVectorType.FLOAT3);
    }
    if (light.AmbIntensity && typeof light.AmbIntensity !== "number") {
      stream.keyword("KLBI");
      stream.animVector(light.AmbIntensity, AnimVectorType.FLOAT1);
    }
    if (light.AttenuationStart && typeof light.AttenuationStart !== "number") {
      stream.keyword("KLAS");
      stream.animVector(light.AttenuationStart, AnimVectorType.INT1);
    }
    if (light.AttenuationEnd && typeof light.AttenuationEnd !== "number") {
      stream.keyword("KLAE");
      stream.animVector(light.AttenuationEnd, AnimVectorType.INT1);
    }
  }
}
function byteLengthHelpers(model) {
  if (model.Helpers.length === 0) return 0;
  return 8 + sum(model.Helpers.map(byteLengthNode));
}
function generateHelpers(model, stream) {
  if (model.Helpers.length === 0) return;
  stream.keyword("HELP");
  stream.int32(byteLengthHelpers(model) - 8);
  for (const helper of model.Helpers) generateNode(helper, stream);
}
var MODEL_ATTACHMENT_PATH_LENGTH = 256;
function byteLengthAttachment(attachment) {
  return 4 + byteLengthNode(attachment) + MODEL_ATTACHMENT_PATH_LENGTH + 4 + 4 + (attachment.Visibility ? 4 + byteLengthAnimVector(attachment.Visibility, AnimVectorType.FLOAT1) : 0);
}
function byteLengthAttachments(model) {
  if (model.Attachments.length === 0) return 0;
  return 8 + sum(model.Attachments.map(byteLengthAttachment));
}
function generateAttachments(model, stream) {
  if (model.Attachments.length === 0) return;
  stream.keyword("ATCH");
  stream.int32(byteLengthAttachments(model) - 8);
  for (const attachment of model.Attachments) {
    stream.int32(byteLengthAttachment(attachment));
    generateNode(attachment, stream);
    stream.str(attachment.Path || "", MODEL_ATTACHMENT_PATH_LENGTH);
    stream.int32(0);
    stream.int32(attachment.AttachmentID);
    if (attachment.Visibility) {
      stream.keyword("KATV");
      stream.animVector(attachment.Visibility, AnimVectorType.FLOAT1);
    }
  }
}
function byteLengthPivotPoints(model) {
  if (!model.PivotPoints.length) return 0;
  return 8 + 12 * model.PivotPoints.length;
}
function generatePivotPoints(model, stream) {
  if (!model.PivotPoints.length) return;
  stream.keyword("PIVT");
  stream.int32(model.PivotPoints.length * 4 * 3);
  for (const point of model.PivotPoints) stream.float32Array(point);
}
var MODEL_PARTICLE_EMITTER_PATH_LENGTH = 256;
function byteLengthParticleEmitter(emitter) {
  return 4 + byteLengthNode(emitter) + 4 + 4 + 4 + 4 + MODEL_PARTICLE_EMITTER_PATH_LENGTH + 4 + 4 + 4 + (emitter.Visibility && typeof emitter.Visibility !== "number" ? 4 + byteLengthAnimVector(emitter.Visibility, AnimVectorType.FLOAT1) : 0) + (emitter.EmissionRate && typeof emitter.EmissionRate !== "number" ? 4 + byteLengthAnimVector(emitter.EmissionRate, AnimVectorType.FLOAT1) : 0) + (emitter.Gravity && typeof emitter.Gravity !== "number" ? 4 + byteLengthAnimVector(emitter.Gravity, AnimVectorType.FLOAT1) : 0) + (emitter.Longitude && typeof emitter.Longitude !== "number" ? 4 + byteLengthAnimVector(emitter.Longitude, AnimVectorType.FLOAT1) : 0) + (emitter.Latitude && typeof emitter.Latitude !== "number" ? 4 + byteLengthAnimVector(emitter.Latitude, AnimVectorType.FLOAT1) : 0) + (emitter.LifeSpan && typeof emitter.LifeSpan !== "number" ? 4 + byteLengthAnimVector(emitter.LifeSpan, AnimVectorType.FLOAT1) : 0) + (emitter.InitVelocity && typeof emitter.InitVelocity !== "number" ? 4 + byteLengthAnimVector(emitter.InitVelocity, AnimVectorType.FLOAT1) : 0);
}
function byteLengthParticleEmitters(model) {
  if (!model.ParticleEmitters.length) return 0;
  return 8 + sum(model.ParticleEmitters.map(byteLengthParticleEmitter));
}
function generateParticleEmitters(model, stream) {
  if (!model.ParticleEmitters.length) return;
  stream.keyword("PREM");
  stream.int32(byteLengthParticleEmitters(model) - 8);
  for (const emitter of model.ParticleEmitters) {
    stream.int32(byteLengthParticleEmitter(emitter));
    generateNode(emitter, stream);
    stream.float32(typeof emitter.EmissionRate === "number" ? emitter.EmissionRate : 0);
    stream.float32(typeof emitter.Gravity === "number" ? emitter.Gravity : 0);
    stream.float32(typeof emitter.Longitude === "number" ? emitter.Longitude : 0);
    stream.float32(typeof emitter.Latitude === "number" ? emitter.Latitude : 0);
    stream.str(emitter.Path, MODEL_PARTICLE_EMITTER_PATH_LENGTH);
    stream.int32(0);
    stream.float32(typeof emitter.LifeSpan === "number" ? emitter.LifeSpan : 0);
    stream.float32(typeof emitter.InitVelocity === "number" ? emitter.InitVelocity : 0);
    if (emitter.Visibility && typeof emitter.Visibility !== "number") {
      stream.keyword("KPEV");
      stream.animVector(emitter.Visibility, AnimVectorType.FLOAT1);
    }
    if (emitter.EmissionRate && typeof emitter.EmissionRate !== "number") {
      stream.keyword("KPEE");
      stream.animVector(emitter.EmissionRate, AnimVectorType.FLOAT1);
    }
    if (emitter.Gravity && typeof emitter.Gravity !== "number") {
      stream.keyword("KPEG");
      stream.animVector(emitter.Gravity, AnimVectorType.FLOAT1);
    }
    if (emitter.Longitude && typeof emitter.Longitude !== "number") {
      stream.keyword("KPLN");
      stream.animVector(emitter.Longitude, AnimVectorType.FLOAT1);
    }
    if (emitter.Latitude && typeof emitter.Latitude !== "number") {
      stream.keyword("KPLT");
      stream.animVector(emitter.Latitude, AnimVectorType.FLOAT1);
    }
    if (emitter.LifeSpan && typeof emitter.LifeSpan !== "number") {
      stream.keyword("KPEL");
      stream.animVector(emitter.LifeSpan, AnimVectorType.FLOAT1);
    }
    if (emitter.InitVelocity && typeof emitter.InitVelocity !== "number") {
      stream.keyword("KPES");
      stream.animVector(emitter.InitVelocity, AnimVectorType.FLOAT1);
    }
  }
}
function byteLengthParticleEmitter2(emitter) {
  return 4 + byteLengthNode(emitter) + 4 + 4 + 4 + 4 + 4 + 4 + 4 + 4 + 4 + 4 + 4 + 4 + 4 + 4 + 36 + 3 + 12 + 12 + 12 + 12 + 12 + 4 + 4 + 4 + 4 + (emitter.Visibility && typeof emitter.Visibility !== "number" ? 4 + byteLengthAnimVector(emitter.Visibility, AnimVectorType.FLOAT1) : 0) + (emitter.EmissionRate && typeof emitter.EmissionRate !== "number" ? 4 + byteLengthAnimVector(emitter.EmissionRate, AnimVectorType.FLOAT1) : 0) + (emitter.Width && typeof emitter.Width !== "number" ? 4 + byteLengthAnimVector(emitter.Width, AnimVectorType.FLOAT1) : 0) + (emitter.Length && typeof emitter.Length !== "number" ? 4 + byteLengthAnimVector(emitter.Length, AnimVectorType.FLOAT1) : 0) + (emitter.Speed && typeof emitter.Speed !== "number" ? 4 + byteLengthAnimVector(emitter.Speed, AnimVectorType.FLOAT1) : 0) + (emitter.Latitude && typeof emitter.Latitude !== "number" ? 4 + byteLengthAnimVector(emitter.Latitude, AnimVectorType.FLOAT1) : 0) + (emitter.Gravity && typeof emitter.Gravity !== "number" ? 4 + byteLengthAnimVector(emitter.Gravity, AnimVectorType.FLOAT1) : 0) + (emitter.Variation && typeof emitter.Variation !== "number" ? 4 + byteLengthAnimVector(emitter.Variation, AnimVectorType.FLOAT1) : 0);
}
function byteLengthParticleEmitters2(model) {
  if (!model.ParticleEmitters2.length) return 0;
  return 8 + sum(model.ParticleEmitters2.map(byteLengthParticleEmitter2));
}
function generateParticleEmitters2(model, stream) {
  if (!model.ParticleEmitters2.length) return;
  stream.keyword("PRE2");
  stream.int32(byteLengthParticleEmitters2(model) - 8);
  for (const emitter of model.ParticleEmitters2) {
    stream.int32(byteLengthParticleEmitter2(emitter));
    generateNode(emitter, stream);
    stream.float32(typeof emitter.Speed === "number" ? emitter.Speed : 0);
    stream.float32(typeof emitter.Variation === "number" ? emitter.Variation : 0);
    stream.float32(typeof emitter.Latitude === "number" ? emitter.Latitude : 0);
    stream.float32(typeof emitter.Gravity === "number" ? emitter.Gravity : 0);
    stream.float32(emitter.LifeSpan);
    stream.float32(typeof emitter.EmissionRate === "number" ? emitter.EmissionRate : 0);
    stream.float32(typeof emitter.Width === "number" ? emitter.Width : 0);
    stream.float32(typeof emitter.Length === "number" ? emitter.Length : 0);
    stream.int32(emitter.FilterMode);
    stream.int32(emitter.Rows);
    stream.int32(emitter.Columns);
    if (emitter.FrameFlags & ParticleEmitter2FramesFlags.Head && emitter.FrameFlags & ParticleEmitter2FramesFlags.Tail) stream.int32(2);
    else if (emitter.FrameFlags & ParticleEmitter2FramesFlags.Tail) stream.int32(1);
    else if (emitter.FrameFlags & ParticleEmitter2FramesFlags.Head) stream.int32(0);
    stream.float32(emitter.TailLength);
    stream.float32(emitter.Time);
    for (let i = 0; i < 3; ++i) for (let j = 0; j < 3; ++j) stream.float32(emitter.SegmentColor[i][j]);
    for (let i = 0; i < 3; ++i) stream.uint8(emitter.Alpha[i]);
    for (let i = 0; i < 3; ++i) stream.float32(emitter.ParticleScaling[i]);
    for (const part of [
      "LifeSpanUVAnim",
      "DecayUVAnim",
      "TailUVAnim",
      "TailDecayUVAnim"
    ]) for (let i = 0; i < 3; ++i) stream.int32(emitter[part][i]);
    stream.int32(emitter.TextureID !== null ? emitter.TextureID : NONE);
    stream.int32(emitter.Squirt ? 1 : 0);
    stream.int32(emitter.PriorityPlane);
    stream.int32(emitter.ReplaceableId);
    if (emitter.Speed && typeof emitter.Speed !== "number") {
      stream.keyword("KP2S");
      stream.animVector(emitter.Speed, AnimVectorType.FLOAT1);
    }
    if (emitter.Latitude && typeof emitter.Latitude !== "number") {
      stream.keyword("KP2L");
      stream.animVector(emitter.Latitude, AnimVectorType.FLOAT1);
    }
    if (emitter.EmissionRate && typeof emitter.EmissionRate !== "number") {
      stream.keyword("KP2E");
      stream.animVector(emitter.EmissionRate, AnimVectorType.FLOAT1);
    }
    if (emitter.Visibility && typeof emitter.Visibility !== "number") {
      stream.keyword("KP2V");
      stream.animVector(emitter.Visibility, AnimVectorType.FLOAT1);
    }
    if (emitter.Length && typeof emitter.Length !== "number") {
      stream.keyword("KP2N");
      stream.animVector(emitter.Length, AnimVectorType.FLOAT1);
    }
    if (emitter.Width && typeof emitter.Width !== "number") {
      stream.keyword("KP2W");
      stream.animVector(emitter.Width, AnimVectorType.FLOAT1);
    }
    if (emitter.Gravity && typeof emitter.Gravity !== "number") {
      stream.keyword("KP2G");
      stream.animVector(emitter.Gravity, AnimVectorType.FLOAT1);
    }
    if (emitter.Variation && typeof emitter.Variation !== "number") {
      stream.keyword("KP2R");
      stream.animVector(emitter.Variation, AnimVectorType.FLOAT1);
    }
  }
}
function byteLengthRibbonEmitter(emitter) {
  return 4 + byteLengthNode(emitter) + 4 + 4 + 4 + 12 + 4 + 4 + 4 + 4 + 4 + 4 + 4 + (emitter.Visibility ? 4 + byteLengthAnimVector(emitter.Visibility, AnimVectorType.FLOAT1) : 0) + (typeof emitter.HeightAbove !== "number" ? 4 + byteLengthAnimVector(emitter.HeightAbove, AnimVectorType.FLOAT1) : 0) + (typeof emitter.HeightBelow !== "number" ? 4 + byteLengthAnimVector(emitter.HeightBelow, AnimVectorType.FLOAT1) : 0) + (typeof emitter.Alpha !== "number" ? 4 + byteLengthAnimVector(emitter.Alpha, AnimVectorType.FLOAT1) : 0) + (typeof emitter.TextureSlot !== "number" ? 4 + byteLengthAnimVector(emitter.TextureSlot, AnimVectorType.FLOAT1) : 0);
}
function byteLengthRibbonEmitters(model) {
  if (!model.RibbonEmitters.length) return 0;
  return 8 + sum(model.RibbonEmitters.map(byteLengthRibbonEmitter));
}
function generateRibbonEmitters(model, stream) {
  if (!model.RibbonEmitters.length) return;
  stream.keyword("RIBB");
  stream.int32(byteLengthRibbonEmitters(model) - 8);
  for (const emitter of model.RibbonEmitters) {
    stream.int32(byteLengthRibbonEmitter(emitter));
    generateNode(emitter, stream);
    stream.float32(typeof emitter.HeightAbove === "number" ? emitter.HeightAbove : 0);
    stream.float32(typeof emitter.HeightBelow === "number" ? emitter.HeightBelow : 0);
    stream.float32(typeof emitter.Alpha === "number" ? emitter.Alpha : 0);
    if (emitter.Color) stream.float32Array(emitter.Color);
    else {
      stream.float32(1);
      stream.float32(1);
      stream.float32(1);
    }
    stream.float32(emitter.LifeSpan);
    stream.int32(typeof emitter.TextureSlot === "number" ? emitter.TextureSlot : 0);
    stream.int32(emitter.EmissionRate);
    stream.int32(emitter.Rows);
    stream.int32(emitter.Columns);
    stream.int32(emitter.MaterialID);
    stream.float32(emitter.Gravity);
    if (emitter.Visibility) {
      stream.keyword("KRVS");
      stream.animVector(emitter.Visibility, AnimVectorType.FLOAT1);
    }
    if (typeof emitter.HeightAbove !== "number") {
      stream.keyword("KRHA");
      stream.animVector(emitter.HeightAbove, AnimVectorType.FLOAT1);
    }
    if (typeof emitter.HeightBelow !== "number") {
      stream.keyword("KRHB");
      stream.animVector(emitter.HeightBelow, AnimVectorType.FLOAT1);
    }
    if (typeof emitter.Alpha !== "number") {
      stream.keyword("KRAL");
      stream.animVector(emitter.Alpha, AnimVectorType.FLOAT1);
    }
    if (typeof emitter.TextureSlot !== "number") {
      stream.keyword("KRTX");
      stream.animVector(emitter.TextureSlot, AnimVectorType.INT1);
    }
  }
}
var MODEL_CAMERA_NAME_LENGTH = 80;
function byteLengthCamera(camera) {
  return 4 + MODEL_CAMERA_NAME_LENGTH + 12 + 4 + 4 + 4 + 12 + (camera.Translation ? 4 + byteLengthAnimVector(camera.Translation, AnimVectorType.FLOAT3) : 0) + (camera.TargetTranslation ? 4 + byteLengthAnimVector(camera.TargetTranslation, AnimVectorType.FLOAT3) : 0) + (camera.Rotation ? 4 + byteLengthAnimVector(camera.Rotation, AnimVectorType.FLOAT1) : 0);
}
function byteLengthCameras(model) {
  if (!model.Cameras.length) return 0;
  return 8 + sum(model.Cameras.map(byteLengthCamera));
}
function generateCameras(model, stream) {
  if (!model.Cameras.length) return;
  stream.keyword("CAMS");
  stream.int32(byteLengthCameras(model) - 8);
  for (const camera of model.Cameras) {
    stream.int32(byteLengthCamera(camera));
    stream.str(camera.Name, MODEL_CAMERA_NAME_LENGTH);
    stream.float32Array(camera.Position);
    stream.float32(camera.FieldOfView);
    stream.float32(camera.FarClip);
    stream.float32(camera.NearClip);
    stream.float32Array(camera.TargetPosition);
    if (camera.Translation) {
      stream.keyword("KCTR");
      stream.animVector(camera.Translation, AnimVectorType.FLOAT3);
    }
    if (camera.Rotation) {
      stream.keyword("KCRL");
      stream.animVector(camera.Rotation, AnimVectorType.FLOAT1);
    }
    if (camera.TargetTranslation) {
      stream.keyword("KTTR");
      stream.animVector(camera.TargetTranslation, AnimVectorType.FLOAT3);
    }
  }
}
function byteLengthEventObject(eventObject) {
  return byteLengthNode(eventObject) + 4 + 4 + 4 + 4 * eventObject.EventTrack.length;
}
function byteLengthEventObjects(model) {
  if (model.EventObjects.length === 0) return 0;
  return 8 + sum(model.EventObjects.map(byteLengthEventObject));
}
function generateEventObjects(model, stream) {
  if (model.EventObjects.length === 0) return;
  stream.keyword("EVTS");
  stream.int32(byteLengthEventObjects(model) - 8);
  for (const eventObject of model.EventObjects) {
    generateNode(eventObject, stream);
    stream.keyword("KEVT");
    stream.int32(eventObject.EventTrack.length);
    stream.int32(NONE);
    stream.uint32Array(eventObject.EventTrack);
  }
}
function byteLengthCollisionShape(collisionShape) {
  return byteLengthNode(collisionShape) + 4 + (collisionShape.Shape === CollisionShapeType.Box ? 6 : 3) * 4 + (collisionShape.Shape === CollisionShapeType.Sphere ? 4 : 0);
}
function byteLengthCollisionShapes(model) {
  if (model.CollisionShapes.length === 0) return 0;
  return 8 + sum(model.CollisionShapes.map(byteLengthCollisionShape));
}
function generateCollisionShapes(model, stream) {
  if (model.CollisionShapes.length === 0) return;
  stream.keyword("CLID");
  stream.int32(byteLengthCollisionShapes(model) - 8);
  for (const collisionShape of model.CollisionShapes) {
    generateNode(collisionShape, stream);
    stream.int32(collisionShape.Shape);
    stream.float32Array(collisionShape.Vertices);
    if (collisionShape.Shape === CollisionShapeType.Sphere) stream.float32(collisionShape.BoundsRadius);
  }
}
function byteLengthFaceFX(model) {
  if (model.Version < 900 || !model.FaceFX) return 0;
  return 8 + 340 * model.FaceFX.length;
}
function generateFaceFX(model, stream) {
  if (model.Version < 900 || !model.FaceFX) return;
  stream.keyword("FAFX");
  stream.int32(byteLengthFaceFX(model) - 8);
  for (const faceFx of model.FaceFX) {
    stream.str(faceFx.Name, 80);
    stream.str(faceFx.Path, 260);
  }
}
function byteLengthBindPoseObject(bindPose) {
  return 48 * bindPose.Matrices.length;
}
function byteLengthBindPoses(model) {
  if (model.Version < 900 || !model.BindPoses) return 0;
  return 12 + sum(model.BindPoses.map(byteLengthBindPoseObject));
}
function generateBindPoses(model, stream) {
  if (model.Version < 900 || !model.BindPoses?.length) return;
  stream.keyword("BPOS");
  stream.int32(byteLengthBindPoses(model) - 8);
  const totalCount = model.BindPoses.reduce((acc, bindPose) => {
    return acc + bindPose.Matrices.length;
  }, 0);
  stream.int32(totalCount);
  for (const bindPose of model.BindPoses) for (const matrix of bindPose.Matrices) stream.float32Array(matrix);
}
function byteLengthParticleEmitterPopcorn(emitter) {
  return 4 + byteLengthNode(emitter) + 4 + 4 + 4 + 12 + 4 + 4 + 260 + 260 + (emitter.Alpha && typeof emitter.Alpha !== "number" ? 4 + byteLengthAnimVector(emitter.Alpha, AnimVectorType.FLOAT1) : 0) + (emitter.Visibility && typeof emitter.Visibility !== "number" ? 4 + byteLengthAnimVector(emitter.Visibility, AnimVectorType.FLOAT1) : 0) + (emitter.EmissionRate && typeof emitter.EmissionRate !== "number" ? 4 + byteLengthAnimVector(emitter.EmissionRate, AnimVectorType.FLOAT1) : 0) + (emitter.Color && !(emitter.Color instanceof Float32Array) ? 4 + byteLengthAnimVector(emitter.Color, AnimVectorType.FLOAT3) : 0) + (emitter.LifeSpan && typeof emitter.LifeSpan !== "number" ? 4 + byteLengthAnimVector(emitter.LifeSpan, AnimVectorType.FLOAT1) : 0) + (emitter.Speed && typeof emitter.Speed !== "number" ? 4 + byteLengthAnimVector(emitter.Speed, AnimVectorType.FLOAT1) : 0);
}
function byteLengthParticleEmitterPopcorns(model) {
  if (model.Version < 900 || !model.ParticleEmitterPopcorns?.length) return 0;
  return 8 + sum(model.ParticleEmitterPopcorns.map(byteLengthParticleEmitterPopcorn));
}
function generateParticleEmitterPopcorns(model, stream) {
  if (model.Version < 900 || !model.ParticleEmitterPopcorns?.length) return;
  stream.keyword("CORN");
  stream.int32(byteLengthParticleEmitterPopcorns(model) - 8);
  for (const emitter of model.ParticleEmitterPopcorns) {
    stream.int32(byteLengthParticleEmitterPopcorn(emitter));
    generateNode(emitter, stream);
    stream.float32(typeof emitter.LifeSpan === "number" ? emitter.LifeSpan : 0);
    stream.float32(typeof emitter.EmissionRate === "number" ? emitter.EmissionRate : 1);
    stream.float32(typeof emitter.Speed === "number" ? emitter.Speed : 0);
    if (emitter.Color instanceof Float32Array) {
      stream.float32(emitter.Color[0]);
      stream.float32(emitter.Color[1]);
      stream.float32(emitter.Color[2]);
    } else {
      stream.float32(1);
      stream.float32(1);
      stream.float32(1);
    }
    stream.float32(typeof emitter.Alpha === "number" ? emitter.Alpha : 1);
    stream.int32(typeof emitter.ReplaceableId === "number" ? emitter.ReplaceableId : 0);
    stream.str(emitter.Path, 260);
    stream.str(emitter.AnimVisibilityGuide, 260);
    if (emitter.Alpha && typeof emitter.Alpha !== "number") {
      stream.keyword("KPPA");
      stream.animVector(emitter.Alpha, AnimVectorType.FLOAT1);
    }
    if (emitter.Color && !(emitter.Color instanceof Float32Array)) {
      stream.keyword("KPPC");
      stream.animVector(emitter.Color, AnimVectorType.FLOAT3);
    }
    if (emitter.EmissionRate && typeof emitter.EmissionRate !== "number") {
      stream.keyword("KPPE");
      stream.animVector(emitter.EmissionRate, AnimVectorType.FLOAT1);
    }
    if (emitter.LifeSpan && typeof emitter.LifeSpan !== "number") {
      stream.keyword("KPPL");
      stream.animVector(emitter.LifeSpan, AnimVectorType.FLOAT1);
    }
    if (emitter.Speed && typeof emitter.Speed !== "number") {
      stream.keyword("KPPS");
      stream.animVector(emitter.Speed, AnimVectorType.FLOAT1);
    }
    if (emitter.Visibility && typeof emitter.Visibility !== "number") {
      stream.keyword("KPPV");
      stream.animVector(emitter.Visibility, AnimVectorType.FLOAT1);
    }
  }
}
var byteLength = [
  byteLengthVersion,
  byteLengthModelInfo,
  byteLengthSequences,
  byteLengthGlobalSequences,
  byteLengthMaterials,
  byteLengthTextures,
  byteLengthTextureAnims,
  byteLengthGeosets,
  byteLengthGeosetAnims,
  byteLengthBones,
  byteLengthLights,
  byteLengthHelpers,
  byteLengthAttachments,
  byteLengthPivotPoints,
  byteLengthParticleEmitters,
  byteLengthParticleEmitters2,
  byteLengthParticleEmitterPopcorns,
  byteLengthRibbonEmitters,
  byteLengthCameras,
  byteLengthEventObjects,
  byteLengthCollisionShapes,
  byteLengthFaceFX,
  byteLengthBindPoses
];
var generators = [
  generateVersion,
  generateModelInfo,
  generateSequences,
  generateGlobalSequences,
  generateMaterials,
  generateTextures,
  generateTextureAnims,
  generateGeosets,
  generateGeosetAnims,
  generateBones,
  generateLights,
  generateHelpers,
  generateAttachments,
  generatePivotPoints,
  generateParticleEmitters,
  generateParticleEmitters2,
  generateParticleEmitterPopcorns,
  generateRibbonEmitters,
  generateCameras,
  generateEventObjects,
  generateCollisionShapes,
  generateFaceFX,
  generateBindPoses
];
function generate$1(model) {
  let totalLength = 4;
  for (const lenFunc of byteLength) totalLength += lenFunc(model);
  const res = new ArrayBuffer(totalLength);
  const stream = new Stream(res);
  stream.keyword("MDLX");
  for (const generator of generators) generator(model, stream);
  return res;
}
var JpegImage = (function jpegImage() {
  "use strict";
  var dctZigZag = new Int32Array([
    0,
    1,
    8,
    16,
    9,
    2,
    3,
    10,
    17,
    24,
    32,
    25,
    18,
    11,
    4,
    5,
    12,
    19,
    26,
    33,
    40,
    48,
    41,
    34,
    27,
    20,
    13,
    6,
    7,
    14,
    21,
    28,
    35,
    42,
    49,
    56,
    57,
    50,
    43,
    36,
    29,
    22,
    15,
    23,
    30,
    37,
    44,
    51,
    58,
    59,
    52,
    45,
    38,
    31,
    39,
    46,
    53,
    60,
    61,
    54,
    47,
    55,
    62,
    63
  ]);
  var dctCos1 = 4017;
  var dctSin1 = 799;
  var dctCos3 = 3406;
  var dctSin3 = 2276;
  var dctCos6 = 1567;
  var dctSin6 = 3784;
  var dctSqrt2 = 5793;
  var dctSqrt1d2 = 2896;
  function constructor() {
  }
  function buildHuffmanTable(codeLengths, values) {
    var k = 0, code = [], i, j, length = 16;
    while (length > 0 && !codeLengths[length - 1]) length--;
    code.push({
      children: [],
      index: 0
    });
    var p = code[0], q;
    for (i = 0; i < length; i++) {
      for (j = 0; j < codeLengths[i]; j++) {
        p = code.pop();
        p.children[p.index] = values[k];
        while (p.index > 0) p = code.pop();
        p.index++;
        code.push(p);
        while (code.length <= i) {
          code.push(q = {
            children: [],
            index: 0
          });
          p.children[p.index] = q.children;
          p = q;
        }
        k++;
      }
      if (i + 1 < length) {
        code.push(q = {
          children: [],
          index: 0
        });
        p.children[p.index] = q.children;
        p = q;
      }
    }
    return code[0].children;
  }
  function getBlockBufferOffset(component, row, col) {
    return 64 * ((component.blocksPerLine + 1) * row + col);
  }
  function decodeScan(data, offset, frame, components, resetInterval, spectralStart, spectralEnd, successivePrev, successive) {
    frame.precision;
    frame.samplesPerLine;
    frame.scanLines;
    var mcusPerLine = frame.mcusPerLine;
    var progressive = frame.progressive;
    frame.maxH;
    frame.maxV;
    var startOffset = offset, bitsData = 0, bitsCount = 0;
    function readBit() {
      if (bitsCount > 0) {
        bitsCount--;
        return bitsData >> bitsCount & 1;
      }
      bitsData = data[offset++];
      if (bitsData == 255) {
        var nextByte = data[offset++];
        if (nextByte) throw "unexpected marker: " + (bitsData << 8 | nextByte).toString(16);
      }
      bitsCount = 7;
      return bitsData >>> 7;
    }
    function decodeHuffman(tree) {
      var node = tree;
      var bit;
      while ((bit = readBit()) !== null) {
        node = node[bit];
        if (typeof node === "number") return node;
        if (typeof node !== "object") throw "invalid huffman sequence";
      }
      return null;
    }
    function receive(length) {
      var n2 = 0;
      while (length > 0) {
        var bit = readBit();
        if (bit === null) return;
        n2 = n2 << 1 | bit;
        length--;
      }
      return n2;
    }
    function receiveAndExtend(length) {
      var n2 = receive(length);
      if (n2 >= 1 << length - 1) return n2;
      return n2 + (-1 << length) + 1;
    }
    function decodeBaseline(component2, offset2) {
      var t = decodeHuffman(component2.huffmanTableDC);
      var diff = t === 0 ? 0 : receiveAndExtend(t);
      component2.blockData[offset2] = component2.pred += diff;
      var k2 = 1;
      while (k2 < 64) {
        var rs = decodeHuffman(component2.huffmanTableAC);
        var s = rs & 15, r = rs >> 4;
        if (s === 0) {
          if (r < 15) break;
          k2 += 16;
          continue;
        }
        k2 += r;
        var z = dctZigZag[k2];
        component2.blockData[offset2 + z] = receiveAndExtend(s);
        k2++;
      }
    }
    function decodeDCFirst(component2, offset2) {
      var t = decodeHuffman(component2.huffmanTableDC);
      var diff = t === 0 ? 0 : receiveAndExtend(t) << successive;
      component2.blockData[offset2] = component2.pred += diff;
    }
    function decodeDCSuccessive(component2, offset2) {
      component2.blockData[offset2] |= readBit() << successive;
    }
    var eobrun = 0;
    function decodeACFirst(component2, offset2) {
      if (eobrun > 0) {
        eobrun--;
        return;
      }
      var k2 = spectralStart, e = spectralEnd;
      while (k2 <= e) {
        var rs = decodeHuffman(component2.huffmanTableAC);
        var s = rs & 15, r = rs >> 4;
        if (s === 0) {
          if (r < 15) {
            eobrun = receive(r) + (1 << r) - 1;
            break;
          }
          k2 += 16;
          continue;
        }
        k2 += r;
        var z = dctZigZag[k2];
        component2.blockData[offset2 + z] = receiveAndExtend(s) * (1 << successive);
        k2++;
      }
    }
    var successiveACState = 0, successiveACNextValue;
    function decodeACSuccessive(component2, offset2) {
      var k2 = spectralStart, e = spectralEnd, r = 0;
      while (k2 <= e) {
        var z = dctZigZag[k2];
        switch (successiveACState) {
          case 0:
            var rs = decodeHuffman(component2.huffmanTableAC);
            var s = rs & 15, r = rs >> 4;
            if (s === 0) if (r < 15) {
              eobrun = receive(r) + (1 << r);
              successiveACState = 4;
            } else {
              r = 16;
              successiveACState = 1;
            }
            else {
              if (s !== 1) throw "invalid ACn encoding";
              successiveACNextValue = receiveAndExtend(s);
              successiveACState = r ? 2 : 3;
            }
            continue;
          case 1:
          case 2:
            if (component2.blockData[offset2 + z]) component2.blockData[offset2 + z] += readBit() << successive;
            else {
              r--;
              if (r === 0) successiveACState = successiveACState == 2 ? 3 : 0;
            }
            break;
          case 3:
            if (component2.blockData[offset2 + z]) component2.blockData[offset2 + z] += readBit() << successive;
            else {
              component2.blockData[offset2 + z] = successiveACNextValue << successive;
              successiveACState = 0;
            }
            break;
          case 4:
            if (component2.blockData[offset2 + z]) component2.blockData[offset2 + z] += readBit() << successive;
            break;
        }
        k2++;
      }
      if (successiveACState === 4) {
        eobrun--;
        if (eobrun === 0) successiveACState = 0;
      }
    }
    function decodeMcu(component2, decode, mcu2, row, col) {
      var mcuRow = mcu2 / mcusPerLine | 0;
      var mcuCol = mcu2 % mcusPerLine;
      decode(component2, getBlockBufferOffset(component2, mcuRow * component2.v + row, mcuCol * component2.h + col));
    }
    function decodeBlock(component2, decode, mcu2) {
      decode(component2, getBlockBufferOffset(component2, mcu2 / component2.blocksPerLine | 0, mcu2 % component2.blocksPerLine));
    }
    var componentsLength = components.length;
    var component, i, j, k, n;
    var decodeFn;
    if (progressive) if (spectralStart === 0) decodeFn = successivePrev === 0 ? decodeDCFirst : decodeDCSuccessive;
    else decodeFn = successivePrev === 0 ? decodeACFirst : decodeACSuccessive;
    else decodeFn = decodeBaseline;
    var mcu = 0, marker;
    var mcuExpected;
    if (componentsLength == 1) mcuExpected = components[0].blocksPerLine * components[0].blocksPerColumn;
    else mcuExpected = mcusPerLine * frame.mcusPerColumn;
    if (!resetInterval) resetInterval = mcuExpected;
    var h, v;
    while (mcu < mcuExpected) {
      for (i = 0; i < componentsLength; i++) components[i].pred = 0;
      eobrun = 0;
      if (componentsLength == 1) {
        component = components[0];
        for (n = 0; n < resetInterval; n++) {
          decodeBlock(component, decodeFn, mcu);
          mcu++;
        }
      } else for (n = 0; n < resetInterval; n++) {
        for (i = 0; i < componentsLength; i++) {
          component = components[i];
          h = component.h;
          v = component.v;
          for (j = 0; j < v; j++) for (k = 0; k < h; k++) decodeMcu(component, decodeFn, mcu, j, k);
        }
        mcu++;
      }
      bitsCount = 0;
      marker = data[offset] << 8 | data[offset + 1];
      if (marker <= 65280) throw "marker was not found";
      if (marker >= 65488 && marker <= 65495) offset += 2;
      else break;
    }
    return offset - startOffset;
  }
  function quantizeAndInverse(component, blockBufferOffset, p) {
    var qt = component.quantizationTable;
    var v0, v1, v2, v3, v4, v5, v6, v7, t;
    var i;
    for (i = 0; i < 64; i++) p[i] = component.blockData[blockBufferOffset + i] * qt[i];
    for (i = 0; i < 8; ++i) {
      var row = 8 * i;
      if (p[1 + row] == 0 && p[2 + row] == 0 && p[3 + row] == 0 && p[4 + row] == 0 && p[5 + row] == 0 && p[6 + row] == 0 && p[7 + row] == 0) {
        t = dctSqrt2 * p[0 + row] + 512 >> 10;
        p[0 + row] = t;
        p[1 + row] = t;
        p[2 + row] = t;
        p[3 + row] = t;
        p[4 + row] = t;
        p[5 + row] = t;
        p[6 + row] = t;
        p[7 + row] = t;
        continue;
      }
      v0 = dctSqrt2 * p[0 + row] + 128 >> 8;
      v1 = dctSqrt2 * p[4 + row] + 128 >> 8;
      v2 = p[2 + row];
      v3 = p[6 + row];
      v4 = dctSqrt1d2 * (p[1 + row] - p[7 + row]) + 128 >> 8;
      v7 = dctSqrt1d2 * (p[1 + row] + p[7 + row]) + 128 >> 8;
      v5 = p[3 + row] << 4;
      v6 = p[5 + row] << 4;
      t = v0 - v1 + 1 >> 1;
      v0 = v0 + v1 + 1 >> 1;
      v1 = t;
      t = v2 * dctSin6 + v3 * dctCos6 + 128 >> 8;
      v2 = v2 * dctCos6 - v3 * dctSin6 + 128 >> 8;
      v3 = t;
      t = v4 - v6 + 1 >> 1;
      v4 = v4 + v6 + 1 >> 1;
      v6 = t;
      t = v7 + v5 + 1 >> 1;
      v5 = v7 - v5 + 1 >> 1;
      v7 = t;
      t = v0 - v3 + 1 >> 1;
      v0 = v0 + v3 + 1 >> 1;
      v3 = t;
      t = v1 - v2 + 1 >> 1;
      v1 = v1 + v2 + 1 >> 1;
      v2 = t;
      t = v4 * dctSin3 + v7 * dctCos3 + 2048 >> 12;
      v4 = v4 * dctCos3 - v7 * dctSin3 + 2048 >> 12;
      v7 = t;
      t = v5 * dctSin1 + v6 * dctCos1 + 2048 >> 12;
      v5 = v5 * dctCos1 - v6 * dctSin1 + 2048 >> 12;
      v6 = t;
      p[0 + row] = v0 + v7;
      p[7 + row] = v0 - v7;
      p[1 + row] = v1 + v6;
      p[6 + row] = v1 - v6;
      p[2 + row] = v2 + v5;
      p[5 + row] = v2 - v5;
      p[3 + row] = v3 + v4;
      p[4 + row] = v3 - v4;
    }
    for (i = 0; i < 8; ++i) {
      var col = i;
      if (p[8 + col] == 0 && p[16 + col] == 0 && p[24 + col] == 0 && p[32 + col] == 0 && p[40 + col] == 0 && p[48 + col] == 0 && p[56 + col] == 0) {
        t = dctSqrt2 * p[i + 0] + 8192 >> 14;
        p[0 + col] = t;
        p[8 + col] = t;
        p[16 + col] = t;
        p[24 + col] = t;
        p[32 + col] = t;
        p[40 + col] = t;
        p[48 + col] = t;
        p[56 + col] = t;
        continue;
      }
      v0 = dctSqrt2 * p[0 + col] + 2048 >> 12;
      v1 = dctSqrt2 * p[32 + col] + 2048 >> 12;
      v2 = p[16 + col];
      v3 = p[48 + col];
      v4 = dctSqrt1d2 * (p[8 + col] - p[56 + col]) + 2048 >> 12;
      v7 = dctSqrt1d2 * (p[8 + col] + p[56 + col]) + 2048 >> 12;
      v5 = p[24 + col];
      v6 = p[40 + col];
      t = v0 - v1 + 1 >> 1;
      v0 = v0 + v1 + 1 >> 1;
      v1 = t;
      t = v2 * dctSin6 + v3 * dctCos6 + 2048 >> 12;
      v2 = v2 * dctCos6 - v3 * dctSin6 + 2048 >> 12;
      v3 = t;
      t = v4 - v6 + 1 >> 1;
      v4 = v4 + v6 + 1 >> 1;
      v6 = t;
      t = v7 + v5 + 1 >> 1;
      v5 = v7 - v5 + 1 >> 1;
      v7 = t;
      t = v0 - v3 + 1 >> 1;
      v0 = v0 + v3 + 1 >> 1;
      v3 = t;
      t = v1 - v2 + 1 >> 1;
      v1 = v1 + v2 + 1 >> 1;
      v2 = t;
      t = v4 * dctSin3 + v7 * dctCos3 + 2048 >> 12;
      v4 = v4 * dctCos3 - v7 * dctSin3 + 2048 >> 12;
      v7 = t;
      t = v5 * dctSin1 + v6 * dctCos1 + 2048 >> 12;
      v5 = v5 * dctCos1 - v6 * dctSin1 + 2048 >> 12;
      v6 = t;
      p[0 + col] = v0 + v7;
      p[56 + col] = v0 - v7;
      p[8 + col] = v1 + v6;
      p[48 + col] = v1 - v6;
      p[16 + col] = v2 + v5;
      p[40 + col] = v2 - v5;
      p[24 + col] = v3 + v4;
      p[32 + col] = v3 - v4;
    }
    for (i = 0; i < 64; ++i) {
      var index2 = blockBufferOffset + i;
      var q = p[i];
      q = q <= -2056 ? 0 : q >= 2024 ? 255 : q + 2056 >> 4;
      component.blockData[index2] = q;
    }
  }
  function buildComponentData(frame, component) {
    var blocksPerLine = component.blocksPerLine;
    var blocksPerColumn = component.blocksPerColumn;
    blocksPerLine << 3;
    var computationBuffer = new Int32Array(64);
    for (var blockRow = 0; blockRow < blocksPerColumn; blockRow++) for (var blockCol = 0; blockCol < blocksPerLine; blockCol++) quantizeAndInverse(component, getBlockBufferOffset(component, blockRow, blockCol), computationBuffer);
    return component.blockData;
  }
  function clampToUint8(a) {
    return a <= 0 ? 0 : a >= 255 ? 255 : a | 0;
  }
  constructor.prototype = {
    load: function load(path) {
      var xhr = new XMLHttpRequest();
      xhr.open("GET", path, true);
      xhr.responseType = "arraybuffer";
      xhr.onload = (function() {
        var data = new Uint8Array(xhr.response || xhr.mozResponseArrayBuffer);
        this.parse(data);
        if (this.onload) this.onload();
      }).bind(this);
      xhr.send(null);
    },
    loadFromBuffer: function loadFromBuffer(arrayBuffer2) {
      this.parse(arrayBuffer2);
      if (this.onload) this.onload();
    },
    parse: function parse2(data) {
      function readUint16() {
        var value = data[offset] << 8 | data[offset + 1];
        offset += 2;
        return value;
      }
      function readDataBlock() {
        var length = readUint16();
        var array = data.subarray(offset, offset + length - 2);
        offset += array.length;
        return array;
      }
      function prepareComponents(frame2) {
        var mcusPerLine = Math.ceil(frame2.samplesPerLine / 8 / frame2.maxH);
        var mcusPerColumn = Math.ceil(frame2.scanLines / 8 / frame2.maxV);
        for (var i2 = 0; i2 < frame2.components.length; i2++) {
          component = frame2.components[i2];
          var blocksPerLine = Math.ceil(Math.ceil(frame2.samplesPerLine / 8) * component.h / frame2.maxH);
          var blocksPerColumn = Math.ceil(Math.ceil(frame2.scanLines / 8) * component.v / frame2.maxV);
          var blocksPerLineForMcu = mcusPerLine * component.h;
          var blocksBufferSize = 64 * (mcusPerColumn * component.v) * (blocksPerLineForMcu + 1);
          component.blockData = new Int16Array(blocksBufferSize);
          component.blocksPerLine = blocksPerLine;
          component.blocksPerColumn = blocksPerColumn;
        }
        frame2.mcusPerLine = mcusPerLine;
        frame2.mcusPerColumn = mcusPerColumn;
      }
      var offset = 0;
      data.length;
      var jfif = null;
      var adobe = null;
      var frame, resetInterval;
      var quantizationTables = [];
      var huffmanTablesAC = [], huffmanTablesDC = [];
      var fileMarker = readUint16();
      if (fileMarker != 65496) throw "SOI not found";
      fileMarker = readUint16();
      while (fileMarker != 65497) {
        var i, j, l;
        switch (fileMarker) {
          case 65504:
          case 65505:
          case 65506:
          case 65507:
          case 65508:
          case 65509:
          case 65510:
          case 65511:
          case 65512:
          case 65513:
          case 65514:
          case 65515:
          case 65516:
          case 65517:
          case 65518:
          case 65519:
          case 65534:
            var appData = readDataBlock();
            if (fileMarker === 65504) {
              if (appData[0] === 74 && appData[1] === 70 && appData[2] === 73 && appData[3] === 70 && appData[4] === 0) jfif = {
                version: {
                  major: appData[5],
                  minor: appData[6]
                },
                densityUnits: appData[7],
                xDensity: appData[8] << 8 | appData[9],
                yDensity: appData[10] << 8 | appData[11],
                thumbWidth: appData[12],
                thumbHeight: appData[13],
                thumbData: appData.subarray(14, 14 + 3 * appData[12] * appData[13])
              };
            }
            if (fileMarker === 65518) {
              if (appData[0] === 65 && appData[1] === 100 && appData[2] === 111 && appData[3] === 98 && appData[4] === 101 && appData[5] === 0) adobe = {
                version: appData[6],
                flags0: appData[7] << 8 | appData[8],
                flags1: appData[9] << 8 | appData[10],
                transformCode: appData[11]
              };
            }
            break;
          case 65499:
            var quantizationTablesEnd = readUint16() + offset - 2;
            while (offset < quantizationTablesEnd) {
              var quantizationTableSpec = data[offset++];
              var tableData = new Int32Array(64);
              if (quantizationTableSpec >> 4 === 0) for (j = 0; j < 64; j++) {
                var z = dctZigZag[j];
                tableData[z] = data[offset++];
              }
              else if (quantizationTableSpec >> 4 === 1) for (j = 0; j < 64; j++) {
                var z = dctZigZag[j];
                tableData[z] = readUint16();
              }
              else throw "DQT: invalid table spec";
              quantizationTables[quantizationTableSpec & 15] = tableData;
            }
            break;
          case 65472:
          case 65473:
          case 65474:
            if (frame) throw "Only single frame JPEGs supported";
            readUint16();
            frame = {};
            frame.extended = fileMarker === 65473;
            frame.progressive = fileMarker === 65474;
            frame.precision = data[offset++];
            frame.scanLines = readUint16();
            frame.samplesPerLine = readUint16();
            frame.components = [];
            frame.componentIds = {};
            var componentsCount = data[offset++], componentId;
            var maxH = 0, maxV = 0;
            for (i = 0; i < componentsCount; i++) {
              componentId = data[offset];
              var h = data[offset + 1] >> 4;
              var v = data[offset + 1] & 15;
              if (maxH < h) maxH = h;
              if (maxV < v) maxV = v;
              var qId = data[offset + 2];
              var l = frame.components.push({
                h,
                v,
                quantizationTable: quantizationTables[qId]
              });
              frame.componentIds[componentId] = l - 1;
              offset += 3;
            }
            frame.maxH = maxH;
            frame.maxV = maxV;
            prepareComponents(frame);
            break;
          case 65476:
            var huffmanLength = readUint16();
            for (i = 2; i < huffmanLength; ) {
              var huffmanTableSpec = data[offset++];
              var codeLengths = new Uint8Array(16);
              var codeLengthSum = 0;
              for (j = 0; j < 16; j++, offset++) codeLengthSum += codeLengths[j] = data[offset];
              var huffmanValues = new Uint8Array(codeLengthSum);
              for (j = 0; j < codeLengthSum; j++, offset++) huffmanValues[j] = data[offset];
              i += 17 + codeLengthSum;
              (huffmanTableSpec >> 4 === 0 ? huffmanTablesDC : huffmanTablesAC)[huffmanTableSpec & 15] = buildHuffmanTable(codeLengths, huffmanValues);
            }
            break;
          case 65501:
            readUint16();
            resetInterval = readUint16();
            break;
          case 65498:
            readUint16();
            var selectorsCount = data[offset++];
            var components = [], component;
            for (i = 0; i < selectorsCount; i++) {
              var componentIndex = frame.componentIds[data[offset++]];
              component = frame.components[componentIndex];
              var tableSpec = data[offset++];
              component.huffmanTableDC = huffmanTablesDC[tableSpec >> 4];
              component.huffmanTableAC = huffmanTablesAC[tableSpec & 15];
              components.push(component);
            }
            var spectralStart = data[offset++];
            var spectralEnd = data[offset++];
            var successiveApproximation = data[offset++];
            var processed = decodeScan(data, offset, frame, components, resetInterval, spectralStart, spectralEnd, successiveApproximation >> 4, successiveApproximation & 15);
            offset += processed;
            break;
          default:
            if (data[offset - 3] == 255 && data[offset - 2] >= 192 && data[offset - 2] <= 254) {
              offset -= 3;
              break;
            }
            throw "unknown JPEG marker " + fileMarker.toString(16);
        }
        fileMarker = readUint16();
      }
      this.width = frame.samplesPerLine;
      this.height = frame.scanLines;
      this.jfif = jfif;
      this.adobe = adobe;
      this.components = [];
      for (var i = 0; i < frame.components.length; i++) {
        var component = frame.components[i];
        this.components.push({
          output: buildComponentData(frame, component),
          scaleX: component.h / frame.maxH,
          scaleY: component.v / frame.maxV,
          blocksPerLine: component.blocksPerLine,
          blocksPerColumn: component.blocksPerColumn
        });
      }
    },
    getData: function getData(imageData, width, height) {
      var scaleX = this.width / width, scaleY = this.height / height;
      var component, componentScaleX, componentScaleY;
      var x, y, i;
      var offset = 0;
      var numComponents = this.components.length;
      width * height * numComponents;
      var data = imageData.data;
      var lineData = new Uint8Array((this.components[0].blocksPerLine << 3) * this.components[0].blocksPerColumn * 8);
      for (i = 0; i < numComponents; i++) {
        component = this.components[i < 3 ? 2 - i : i];
        var blocksPerLine = component.blocksPerLine;
        var blocksPerColumn = component.blocksPerColumn;
        var samplesPerLine = blocksPerLine << 3, j, k;
        var lineOffset = 0;
        for (var blockRow = 0; blockRow < blocksPerColumn; blockRow++) {
          var scanLine = blockRow << 3;
          for (var blockCol = 0; blockCol < blocksPerLine; blockCol++) {
            var bufferOffset = getBlockBufferOffset(component, blockRow, blockCol);
            var offset = 0, sample = blockCol << 3;
            for (j = 0; j < 8; j++) {
              var lineOffset = (scanLine + j) * samplesPerLine;
              for (k = 0; k < 8; k++) lineData[lineOffset + sample + k] = component.output[bufferOffset + offset++];
            }
          }
        }
        componentScaleX = component.scaleX * scaleX;
        componentScaleY = component.scaleY * scaleY;
        offset = i;
        var cx, cy;
        var index2;
        for (y = 0; y < height; y++) for (x = 0; x < width; x++) {
          cy = 0 | y * componentScaleY;
          cx = 0 | x * componentScaleX;
          index2 = cy * samplesPerLine + cx;
          data[offset] = lineData[index2];
          offset += numComponents;
        }
      }
      return data;
    },
    copyToImageData: function copyToImageData(imageData) {
      var width = imageData.width, height = imageData.height;
      var imageDataBytes = width * height * 4;
      var imageDataArray = imageData.data;
      var data = this.getData(width, height);
      var i = 0, j = 0, k0, k1;
      var Y, K, C, M, R, G, B;
      switch (this.components.length) {
        case 1:
          while (j < imageDataBytes) {
            Y = data[i++];
            imageDataArray[j++] = Y;
            imageDataArray[j++] = Y;
            imageDataArray[j++] = Y;
            imageDataArray[j++] = 255;
          }
          break;
        case 3:
          while (j < imageDataBytes) {
            R = data[i++];
            G = data[i++];
            B = data[i++];
            imageDataArray[j++] = R;
            imageDataArray[j++] = G;
            imageDataArray[j++] = B;
            imageDataArray[j++] = 255;
          }
          break;
        case 4:
          while (j < imageDataBytes) {
            C = data[i++];
            M = data[i++];
            Y = data[i++];
            K = data[i++];
            k0 = 255 - K;
            k1 = k0 / 255;
            R = clampToUint8(k0 - C * k1);
            G = clampToUint8(k0 - M * k1);
            B = clampToUint8(k0 - Y * k1);
            imageDataArray[j++] = R;
            imageDataArray[j++] = G;
            imageDataArray[j++] = B;
            imageDataArray[j++] = 255;
          }
          break;
        default:
          throw "Unsupported color mode";
      }
    }
  };
  return constructor;
})();
var ARRAY_TYPE = typeof Float32Array !== "undefined" ? Float32Array : Array;
Math.PI / 180;
if (!Math.hypot) Math.hypot = function() {
  var y = 0, i = arguments.length;
  while (i--) y += arguments[i] * arguments[i];
  return Math.sqrt(y);
};
function create$4() {
  var out = new ARRAY_TYPE(9);
  if (ARRAY_TYPE != Float32Array) {
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;
    out[5] = 0;
    out[6] = 0;
    out[7] = 0;
  }
  out[0] = 1;
  out[4] = 1;
  out[8] = 1;
  return out;
}
function create$3() {
  var out = new ARRAY_TYPE(16);
  if (ARRAY_TYPE != Float32Array) {
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;
    out[4] = 0;
    out[6] = 0;
    out[7] = 0;
    out[8] = 0;
    out[9] = 0;
    out[11] = 0;
    out[12] = 0;
    out[13] = 0;
    out[14] = 0;
  }
  out[0] = 1;
  out[5] = 1;
  out[10] = 1;
  out[15] = 1;
  return out;
}
function create$2() {
  var out = new ARRAY_TYPE(3);
  if (ARRAY_TYPE != Float32Array) {
    out[0] = 0;
    out[1] = 0;
    out[2] = 0;
  }
  return out;
}
function length$2(a) {
  var x = a[0];
  var y = a[1];
  var z = a[2];
  return Math.hypot(x, y, z);
}
function fromValues$2(x, y, z) {
  var out = new ARRAY_TYPE(3);
  out[0] = x;
  out[1] = y;
  out[2] = z;
  return out;
}
function normalize$2(out, a) {
  var x = a[0];
  var y = a[1];
  var z = a[2];
  var len2 = x * x + y * y + z * z;
  if (len2 > 0) len2 = 1 / Math.sqrt(len2);
  out[0] = a[0] * len2;
  out[1] = a[1] * len2;
  out[2] = a[2] * len2;
  return out;
}
function dot$2(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
function cross(out, a, b) {
  var ax = a[0], ay = a[1], az = a[2];
  var bx = b[0], by = b[1], bz = b[2];
  out[0] = ay * bz - az * by;
  out[1] = az * bx - ax * bz;
  out[2] = ax * by - ay * bx;
  return out;
}
var len = length$2;
(function() {
  var vec = create$2();
  return function(a, stride, offset, count, fn, arg) {
    var i, l;
    if (!stride) stride = 3;
    if (!offset) offset = 0;
    if (count) l = Math.min(count * stride + offset, a.length);
    else l = a.length;
    for (i = offset; i < l; i += stride) {
      vec[0] = a[i];
      vec[1] = a[i + 1];
      vec[2] = a[i + 2];
      fn(vec, vec, arg);
      a[i] = vec[0];
      a[i + 1] = vec[1];
      a[i + 2] = vec[2];
    }
    return a;
  };
})();
function create$1() {
  var out = new ARRAY_TYPE(4);
  if (ARRAY_TYPE != Float32Array) {
    out[0] = 0;
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;
  }
  return out;
}
function fromValues$1(x, y, z, w) {
  var out = new ARRAY_TYPE(4);
  out[0] = x;
  out[1] = y;
  out[2] = z;
  out[3] = w;
  return out;
}
function normalize$1(out, a) {
  var x = a[0];
  var y = a[1];
  var z = a[2];
  var w = a[3];
  var len2 = x * x + y * y + z * z + w * w;
  if (len2 > 0) len2 = 1 / Math.sqrt(len2);
  out[0] = x * len2;
  out[1] = y * len2;
  out[2] = z * len2;
  out[3] = w * len2;
  return out;
}
(function() {
  var vec = create$1();
  return function(a, stride, offset, count, fn, arg) {
    var i, l;
    if (!stride) stride = 4;
    if (!offset) offset = 0;
    if (count) l = Math.min(count * stride + offset, a.length);
    else l = a.length;
    for (i = offset; i < l; i += stride) {
      vec[0] = a[i];
      vec[1] = a[i + 1];
      vec[2] = a[i + 2];
      vec[3] = a[i + 3];
      fn(vec, vec, arg);
      a[i] = vec[0];
      a[i + 1] = vec[1];
      a[i + 2] = vec[2];
      a[i + 3] = vec[3];
    }
    return a;
  };
})();
function create() {
  var out = new ARRAY_TYPE(4);
  if (ARRAY_TYPE != Float32Array) {
    out[0] = 0;
    out[1] = 0;
    out[2] = 0;
  }
  out[3] = 1;
  return out;
}
function setAxisAngle(out, axis, rad) {
  rad = rad * 0.5;
  var s = Math.sin(rad);
  out[0] = s * axis[0];
  out[1] = s * axis[1];
  out[2] = s * axis[2];
  out[3] = Math.cos(rad);
  return out;
}
function slerp(out, a, b, t) {
  var ax = a[0], ay = a[1], az = a[2], aw = a[3];
  var bx = b[0], by = b[1], bz = b[2], bw = b[3];
  var omega, cosom = ax * bx + ay * by + az * bz + aw * bw, sinom, scale0, scale1;
  if (cosom < 0) {
    cosom = -cosom;
    bx = -bx;
    by = -by;
    bz = -bz;
    bw = -bw;
  }
  if (1 - cosom > 1e-6) {
    omega = Math.acos(cosom);
    sinom = Math.sin(omega);
    scale0 = Math.sin((1 - t) * omega) / sinom;
    scale1 = Math.sin(t * omega) / sinom;
  } else {
    scale0 = 1 - t;
    scale1 = t;
  }
  out[0] = scale0 * ax + scale1 * bx;
  out[1] = scale0 * ay + scale1 * by;
  out[2] = scale0 * az + scale1 * bz;
  out[3] = scale0 * aw + scale1 * bw;
  return out;
}
function fromMat3(out, m) {
  var fTrace = m[0] + m[4] + m[8];
  var fRoot;
  if (fTrace > 0) {
    fRoot = Math.sqrt(fTrace + 1);
    out[3] = 0.5 * fRoot;
    fRoot = 0.5 / fRoot;
    out[0] = (m[5] - m[7]) * fRoot;
    out[1] = (m[6] - m[2]) * fRoot;
    out[2] = (m[1] - m[3]) * fRoot;
  } else {
    var i = 0;
    if (m[4] > m[0]) i = 1;
    if (m[8] > m[i * 3 + i]) i = 2;
    var j = (i + 1) % 3;
    var k = (i + 2) % 3;
    fRoot = Math.sqrt(m[i * 3 + i] - m[j * 3 + j] - m[k * 3 + k] + 1);
    out[i] = 0.5 * fRoot;
    fRoot = 0.5 / fRoot;
    out[3] = (m[j * 3 + k] - m[k * 3 + j]) * fRoot;
    out[j] = (m[j * 3 + i] + m[i * 3 + j]) * fRoot;
    out[k] = (m[k * 3 + i] + m[i * 3 + k]) * fRoot;
  }
  return out;
}
var fromValues = fromValues$1;
var normalize = normalize$1;
var rotationTo = (function() {
  var tmpvec3 = create$2();
  var xUnitVec3 = fromValues$2(1, 0, 0);
  var yUnitVec3 = fromValues$2(0, 1, 0);
  return function(out, a, b) {
    var dot = dot$2(a, b);
    if (dot < -0.999999) {
      cross(tmpvec3, xUnitVec3, a);
      if (len(tmpvec3) < 1e-6) cross(tmpvec3, yUnitVec3, a);
      normalize$2(tmpvec3, tmpvec3);
      setAxisAngle(out, tmpvec3, Math.PI);
      return out;
    } else if (dot > 0.999999) {
      out[0] = 0;
      out[1] = 0;
      out[2] = 0;
      out[3] = 1;
      return out;
    } else {
      cross(tmpvec3, a, b);
      out[0] = tmpvec3[0];
      out[1] = tmpvec3[1];
      out[2] = tmpvec3[2];
      out[3] = 1 + dot;
      return normalize(out, out);
    }
  };
})();
var sqlerp = (function() {
  var temp1 = create();
  var temp2 = create();
  return function(out, a, b, c, d, t) {
    slerp(temp1, a, d, t);
    slerp(temp2, b, c, t);
    slerp(out, temp1, temp2, 2 * t * (1 - t));
    return out;
  };
})();
(function() {
  var matr = create$4();
  return function(out, view, right, up) {
    matr[0] = right[0];
    matr[3] = right[1];
    matr[6] = right[2];
    matr[1] = up[0];
    matr[4] = up[1];
    matr[7] = up[2];
    matr[2] = -view[0];
    matr[5] = -view[1];
    matr[8] = -view[2];
    return normalize(out, fromMat3(out, matr));
  };
})();
var rotateCenter = fromValues$2(0, 0, 0);
var firstColor = create$1();
var secondColor = create$1();
var color = create$1();
var tailPos = create$2();
var tailCross = create$2();
var sdHardwareSkinning_vs_default = "attribute vec3 aVertexPosition;\nattribute vec3 aNormal;\nattribute vec2 aTextureCoord;\nattribute vec4 aGroup;\n\nuniform mat4 uMVMatrix;\nuniform mat4 uPMatrix;\nuniform mat4 uNodesMatrices[${MAX_NODES}];\n\nvarying vec3 vNormal;\nvarying vec2 vTextureCoord;\n\nvoid main(void) {\n    vec4 position = vec4(aVertexPosition, 1.0);\n    int count = 1;\n    vec4 sum = uNodesMatrices[int(aGroup[0])] * position;\n\n    if (aGroup[1] < ${MAX_NODES}.) {\n        sum += uNodesMatrices[int(aGroup[1])] * position;\n        count += 1;\n    }\n    if (aGroup[2] < ${MAX_NODES}.) {\n        sum += uNodesMatrices[int(aGroup[2])] * position;\n        count += 1;\n    }\n    if (aGroup[3] < ${MAX_NODES}.) {\n        sum += uNodesMatrices[int(aGroup[3])] * position;\n        count += 1;\n    }\n    sum.xyz /= float(count);\n    sum.w = 1.;\n    position = sum;\n\n    gl_Position = uPMatrix * uMVMatrix * position;\n    vTextureCoord = aTextureCoord;\n    vNormal = aNormal;\n}";
var hdHardwareSkinningOld_vs_default = "attribute vec3 aVertexPosition;\nattribute vec3 aNormal;\nattribute vec2 aTextureCoord;\nattribute vec4 aSkin;\nattribute vec4 aBoneWeight;\nattribute vec4 aTangent;\n\nuniform mat4 uMVMatrix;\nuniform mat4 uPMatrix;\nuniform mat4 uNodesMatrices[${MAX_NODES}];\n\nvarying vec3 vNormal;\nvarying vec3 vTangent;\nvarying vec3 vBinormal;\nvarying vec2 vTextureCoord;\nvarying mat3 vTBN;\nvarying vec3 vFragPos;\n\nvoid main(void) {\n    vec4 position = vec4(aVertexPosition, 1.0);\n    mat4 sum;\n\n    // sum += uNodesMatrices[int(aSkin[0])] * 1.;\n    sum += uNodesMatrices[int(aSkin[0])] * aBoneWeight[0];\n    sum += uNodesMatrices[int(aSkin[1])] * aBoneWeight[1];\n    sum += uNodesMatrices[int(aSkin[2])] * aBoneWeight[2];\n    sum += uNodesMatrices[int(aSkin[3])] * aBoneWeight[3];\n\n    mat3 rotation = mat3(sum);\n\n    position = sum * position;\n    position.w = 1.;\n\n    gl_Position = uPMatrix * uMVMatrix * position;\n    vTextureCoord = aTextureCoord;\n\n    vec3 normal = aNormal;\n    vec3 tangent = aTangent.xyz;\n\n    // https://learnopengl.com/Advanced-Lighting/Normal-Mapping\n    tangent = normalize(tangent - dot(tangent, normal) * normal);\n\n    vec3 binormal = cross(normal, tangent) * aTangent.w;\n\n    normal = normalize(rotation * normal);\n    tangent = normalize(rotation * tangent);\n    binormal = normalize(rotation * binormal);\n\n    vNormal = normal;\n    vTangent = tangent;\n    vBinormal = binormal;\n\n    vTBN = mat3(tangent, binormal, normal);\n\n    vFragPos = position.xyz;\n}";
var hdHardwareSkinningNew_vs_default = "#version 300 es\nin vec3 aVertexPosition;\nin vec3 aNormal;\nin vec2 aTextureCoord;\nin vec4 aSkin;\nin vec4 aBoneWeight;\nin vec4 aTangent;\n\nuniform mat4 uMVMatrix;\nuniform mat4 uPMatrix;\nuniform mat4 uNodesMatrices[${MAX_NODES}];\n\nout vec3 vNormal;\nout vec3 vTangent;\nout vec3 vBinormal;\nout vec2 vTextureCoord;\nout mat3 vTBN;\nout vec3 vFragPos;\n\nvoid main(void) {\n    vec4 position = vec4(aVertexPosition, 1.0);\n    mat4 sum;\n\n    // sum += uNodesMatrices[int(aSkin[0])] * 1.;\n    sum += uNodesMatrices[int(aSkin[0])] * aBoneWeight[0];\n    sum += uNodesMatrices[int(aSkin[1])] * aBoneWeight[1];\n    sum += uNodesMatrices[int(aSkin[2])] * aBoneWeight[2];\n    sum += uNodesMatrices[int(aSkin[3])] * aBoneWeight[3];\n\n    mat3 rotation = mat3(sum);\n\n    position = sum * position;\n    position.w = 1.;\n\n    gl_Position = uPMatrix * uMVMatrix * position;\n    vTextureCoord = aTextureCoord;\n\n    vec3 normal = aNormal;\n    vec3 tangent = aTangent.xyz;\n\n    // https://learnopengl.com/Advanced-Lighting/Normal-Mapping\n    tangent = normalize(tangent - dot(tangent, normal) * normal);\n\n    vec3 binormal = cross(normal, tangent) * aTangent.w;\n\n    normal = normalize(rotation * normal);\n    tangent = normalize(rotation * tangent);\n    binormal = normalize(rotation * binormal);\n\n    vNormal = normal;\n    vTangent = tangent;\n    vBinormal = binormal;\n\n    vTBN = mat3(tangent, binormal, normal);\n\n    vFragPos = position.xyz;\n}";
var hdNew_fs_default = "#version 300 es\nprecision mediump float;\n\nin vec2 vTextureCoord;\nin vec3 vNormal;\nin vec3 vTangent;\nin vec3 vBinormal;\nin mat3 vTBN;\nin vec3 vFragPos;\n\nout vec4 FragColor;\n\nuniform sampler2D uSampler;\nuniform sampler2D uNormalSampler;\nuniform sampler2D uOrmSampler;\nuniform vec3 uReplaceableColor;\nuniform float uDiscardAlphaLevel;\nuniform mat3 uTVertexAnim;\nuniform vec3 uLightPos;\nuniform vec3 uLightColor;\nuniform vec3 uCameraPos;\nuniform vec3 uShadowParams;\nuniform sampler2D uShadowMapSampler;\nuniform mat4 uShadowMapLightMatrix;\nuniform bool uHasEnv;\nuniform samplerCube uIrradianceMap;\nuniform samplerCube uPrefilteredEnv;\nuniform sampler2D uBRDFLUT;\nuniform float uWireframe;\n\nconst float PI = 3.14159265359;\nconst float gamma = 2.2;\nconst float MAX_REFLECTION_LOD = ${MAX_ENV_MIP_LEVELS};\n\nfloat distributionGGX(vec3 normal, vec3 halfWay, float roughness) {\n    float a = roughness * roughness;\n    float a2 = a * a;\n    float nDotH = max(dot(normal, halfWay), 0.0);\n    float nDotH2 = nDotH * nDotH;\n\n    float num = a2;\n    float denom = (nDotH2 * (a2 - 1.0) + 1.0);\n    denom = PI * denom * denom;\n\n    return num / denom;\n}\n\nfloat geometrySchlickGGX(float nDotV, float roughness) {\n    float r = roughness + 1.;\n    float k = r * r / 8.;\n    // float k = roughness * roughness / 2.;\n\n    float num = nDotV;\n    float denom = nDotV * (1. - k) + k;\n\n    return num / denom;\n}\n\nfloat geometrySmith(vec3 normal, vec3 viewDir, vec3 lightDir, float roughness) {\n    float nDotV = max(dot(normal, viewDir), .0);\n    float nDotL = max(dot(normal, lightDir), .0);\n    float ggx2  = geometrySchlickGGX(nDotV, roughness);\n    float ggx1  = geometrySchlickGGX(nDotL, roughness);\n\n    return ggx1 * ggx2;\n}\n\nvec3 fresnelSchlick(float lightFactor, vec3 f0) {\n    return f0 + (1. - f0) * pow(clamp(1. - lightFactor, 0., 1.), 5.);\n}\n\nvec3 fresnelSchlickRoughness(float lightFactor, vec3 f0, float roughness) {\n    return f0 + (max(vec3(1.0 - roughness), f0) - f0) * pow(clamp(1.0 - lightFactor, 0.0, 1.0), 5.0);\n}\n\nvoid main(void) {\n    if (uWireframe > 0.) {\n        FragColor = vec4(1.);\n        return;\n    }\n\n    vec2 texCoord = (uTVertexAnim * vec3(vTextureCoord.s, vTextureCoord.t, 1.)).st;\n\n    vec4 orm = texture(uOrmSampler, texCoord);\n\n    float occlusion = orm.r;\n    float roughness = orm.g;\n    float metallic = orm.b;\n    float teamColorFactor = orm.a;\n\n    vec4 baseColor = texture(uSampler, texCoord);\n    vec3 teamColor = baseColor.rgb * uReplaceableColor;\n    baseColor.rgb = mix(baseColor.rgb, teamColor, teamColorFactor);\n    baseColor.rgb = pow(baseColor.rgb, vec3(gamma));\n\n    vec3 normal = texture(uNormalSampler, texCoord).rgb;\n    normal = normal * 2.0 - 1.0;\n    normal.x = -normal.x;\n    normal.y = -normal.y;\n    if (!gl_FrontFacing) {\n        normal = -normal;\n    }\n    normal = normalize(vTBN * -normal);\n\n    vec3 viewDir = normalize(uCameraPos - vFragPos);\n    vec3 reflected = reflect(-viewDir, normal);\n\n    vec3 lightDir = normalize(uLightPos - vFragPos);\n    float lightFactor = max(dot(normal, lightDir), .0);\n    vec3 radiance = uLightColor;\n\n    vec3 f0 = vec3(.04);\n    f0 = mix(f0, baseColor.rgb, metallic);\n\n    vec3 totalLight = vec3(0.);\n    vec3 halfWay = normalize(viewDir + lightDir);\n    float ndf = distributionGGX(normal, halfWay, roughness);\n    float g = geometrySmith(normal, viewDir, lightDir, roughness);\n    vec3 f = fresnelSchlick(max(dot(halfWay, viewDir), 0.), f0);\n\n    vec3 kS = f;\n    vec3 kD = vec3(1.);// - kS;\n    if (uHasEnv) {\n        kD *= 1.0 - metallic;\n    }\n    vec3 num = ndf * g * f;\n    float denom = 4. * max(dot(normal, viewDir), 0.) * max(dot(normal, lightDir), 0.) + .0001;\n    vec3 specular = num / denom;\n\n    totalLight = (kD * baseColor.rgb / PI + specular) * radiance * lightFactor;\n\n    if (uShadowParams[0] > .5) {\n        float shadowBias = uShadowParams[1];\n        float shadowStep = uShadowParams[2];\n        vec4 fragInLightPos = uShadowMapLightMatrix * vec4(vFragPos, 1.);\n        vec3 shadowMapCoord = fragInLightPos.xyz / fragInLightPos.w;\n        shadowMapCoord.xyz = (shadowMapCoord.xyz + 1.0) * .5;\n\n        int passes = 5;\n        float step = 1. / float(passes);\n\n        float lightDepth = texture(uShadowMapSampler, shadowMapCoord.xy).r;\n        float lightDepth0 = texture(uShadowMapSampler, vec2(shadowMapCoord.x + shadowStep, shadowMapCoord.y)).r;\n        float lightDepth1 = texture(uShadowMapSampler, vec2(shadowMapCoord.x, shadowMapCoord.y + shadowStep)).r;\n        float lightDepth2 = texture(uShadowMapSampler, vec2(shadowMapCoord.x, shadowMapCoord.y - shadowStep)).r;\n        float lightDepth3 = texture(uShadowMapSampler, vec2(shadowMapCoord.x - shadowStep, shadowMapCoord.y)).r;\n        float currentDepth = shadowMapCoord.z;\n\n        float visibility = 0.;\n        if (lightDepth > currentDepth - shadowBias) {\n            visibility += step;\n        }\n        if (lightDepth0 > currentDepth - shadowBias) {\n            visibility += step;\n        }\n        if (lightDepth1 > currentDepth - shadowBias) {\n            visibility += step;\n        }\n        if (lightDepth2 > currentDepth - shadowBias) {\n            visibility += step;\n        }\n        if (lightDepth3 > currentDepth - shadowBias) {\n            visibility += step;\n        }\n\n        totalLight *= visibility;\n    }\n\n    vec3 color;\n\n    if (uHasEnv) {\n        vec3 f = fresnelSchlickRoughness(max(dot(normal, viewDir), 0.0), f0, roughness);\n        vec3 kS = f;\n        vec3 kD = vec3(1.0) - kS;\n        kD *= 1.0 - metallic;\n\n        vec3 diffuse = texture(uIrradianceMap, normal).rgb * baseColor.rgb;\n        vec3 prefilteredColor = textureLod(uPrefilteredEnv, reflected, roughness * MAX_REFLECTION_LOD).rgb;\n        vec2 envBRDF = texture(uBRDFLUT, vec2(max(dot(normal, viewDir), 0.0), roughness)).rg;\n        specular = prefilteredColor * (f * envBRDF.x + envBRDF.y);\n\n        vec3 ambient = (kD * diffuse + specular) * occlusion;\n        color = ambient + totalLight;\n    } else {\n        vec3 ambient = vec3(.03);\n        ambient *= baseColor.rgb * occlusion;\n        color = ambient + totalLight;\n    }\n\n    color = color / (vec3(1.) + color);\n    color = pow(color, vec3(1. / gamma));\n\n    FragColor = vec4(color, baseColor.a);\n\n    // hand-made alpha-test\n    if (FragColor[3] < uDiscardAlphaLevel) {\n        discard;\n    }\n}\n";
var sd_default = "struct VSUniforms {\n    mvMatrix: mat4x4f,\n    pMatrix: mat4x4f,\n    nodesMatrices: array<mat4x4f, ${MAX_NODES}>,\n}\n\nstruct FSUniforms {\n    replaceableColor: vec3f,\n    replaceableType: u32,\n    discardAlphaLevel: f32,\n    wireframe: u32,\n    tVertexAnim: mat3x3f,\n}\n\n@group(0) @binding(0) var<uniform> vsUniforms: VSUniforms;\n@group(1) @binding(0) var<uniform> fsUniforms: FSUniforms;\n@group(1) @binding(1) var fsUniformSampler: sampler;\n@group(1) @binding(2) var fsUniformTexture: texture_2d<f32>;\n\nstruct VSIn {\n    @location(0) vertexPosition: vec3f,\n    @location(1) normal: vec3f,\n    @location(2) textureCoord: vec2f,\n    @location(3) group: vec4<u32>,\n}\n\nstruct VSOut {\n    @builtin(position) position: vec4f,\n    @location(0) normal: vec3f,\n    @location(1) textureCoord: vec2f,\n}\n\n@vertex fn vs(\n    in: VSIn\n) -> VSOut {\n    var position: vec4f = vec4f(in.vertexPosition, 1.0);\n    var count: i32 = 1;\n    var sum: vec4f = vsUniforms.nodesMatrices[in.group[0]] * position;\n\n    if (in.group[1] < ${MAX_NODES}) {\n        sum += vsUniforms.nodesMatrices[in.group[1]] * position;\n        count += 1;\n    }\n    if (in.group[2] < ${MAX_NODES}) {\n        sum += vsUniforms.nodesMatrices[in.group[2]] * position;\n        count += 1;\n    }\n    if (in.group[3] < ${MAX_NODES}) {\n        sum += vsUniforms.nodesMatrices[in.group[3]] * position;\n        count += 1;\n    }\n    sum /= f32(count);\n    sum.w = 1.;\n    position = sum;\n\n    var out: VSOut;\n    out.position = vsUniforms.pMatrix * vsUniforms.mvMatrix * position;\n    out.textureCoord = in.textureCoord;\n    out.normal = in.normal;\n    return out;\n}\n\nfn hypot(z: vec2f) -> f32 {\n    var t: f32 = 0;\n    var x: f32 = abs(z.x);\n    let y: f32 = abs(z.y);\n    t = min(x, y);\n    x = max(x, y);\n    t = t / x;\n    if (z.x == 0.0 && z.y == 0.0) {\n        return 0.0;\n    }\n    return x * sqrt(1.0 + t * t);\n}\n\n@fragment fn fs(\n    in: VSOut\n) -> @location(0) vec4f {\n    if (fsUniforms.wireframe > 0) {\n        return vec4f(1);\n    }\n\n    let texCoord: vec2f = (fsUniforms.tVertexAnim * vec3f(in.textureCoord.x, in.textureCoord.y, 1.)).xy;\n    var color: vec4f = vec4f(0.0);\n\n    if (fsUniforms.replaceableType == 0) {\n        color = textureSample(fsUniformTexture, fsUniformSampler, texCoord);\n    } else if (fsUniforms.replaceableType == 1) {\n        color = vec4f(fsUniforms.replaceableColor, 1.0);\n    } else if (fsUniforms.replaceableType == 2) {\n        let dist: f32 = hypot(texCoord - vec2(0.5, 0.5)) * 2.;\n        let truncateDist: f32 = clamp(1. - dist * 1.4, 0., 1.);\n        let alpha: f32 = sin(truncateDist);\n        color = vec4f(fsUniforms.replaceableColor * alpha, 1.0);\n    }\n\n    // hand-made alpha-test\n    if (color.a < fsUniforms.discardAlphaLevel) {\n        discard;\n    }\n\n    return color;\n}\n";
var hd_default = "struct VSUniforms {\n    mvMatrix: mat4x4f,\n    pMatrix: mat4x4f,\n    nodesMatrices: array<mat4x4f, ${MAX_NODES}>,\n}\n\nstruct FSUniforms {\n    replaceableColor: vec3f,\n    // replaceableType: u32,\n    discardAlphaLevel: f32,\n    tVertexAnim: mat3x3f,\n    lightPos: vec3f,\n    hasEnv: u32,\n    lightColor: vec3f,\n    wireframe: u32,\n    cameraPos: vec3f,\n    shadowParams: vec3f,\n    shadowMapLightMatrix: mat4x4f,\n}\n\n@group(0) @binding(0) var<uniform> vsUniforms: VSUniforms;\n@group(1) @binding(0) var<uniform> fsUniforms: FSUniforms;\n@group(1) @binding(1) var fsUniformDiffuseSampler: sampler;\n@group(1) @binding(2) var fsUniformDiffuseTexture: texture_2d<f32>;\n@group(1) @binding(3) var fsUniformNormalSampler: sampler;\n@group(1) @binding(4) var fsUniformNormalTexture: texture_2d<f32>;\n@group(1) @binding(5) var fsUniformOrmSampler: sampler;\n@group(1) @binding(6) var fsUniformOrmTexture: texture_2d<f32>;\n@group(1) @binding(7) var fsUniformShadowSampler: sampler_comparison;\n@group(1) @binding(8) var fsUniformShadowTexture: texture_depth_2d;\n@group(1) @binding(9) var irradienceMapSampler: sampler;\n@group(1) @binding(10) var irradienceMapTexture: texture_cube<f32>;\n@group(1) @binding(11) var prefilteredEnvSampler: sampler;\n@group(1) @binding(12) var prefilteredEnvTexture: texture_cube<f32>;\n@group(1) @binding(13) var brdfLutSampler: sampler;\n@group(1) @binding(14) var brdfLutTexture: texture_2d<f32>;\n\nstruct VSIn {\n    @location(0) vertexPosition: vec3f,\n    @location(1) normal: vec3f,\n    @location(2) textureCoord: vec2f,\n    @location(3) tangent: vec4f,\n    @location(4) skin: vec4<u32>,\n    @location(5) boneWeight: vec4f,\n}\n\nstruct VSOut {\n    @builtin(position) position: vec4f,\n    @location(0) normal: vec3f,\n    @location(1) textureCoord: vec2f,\n    @location(2) tangent: vec3f,\n    @location(3) binormal: vec3f,\n    @location(4) fragPos: vec3f,\n}\n\n@vertex fn vs(\n    in: VSIn\n) -> VSOut {\n    var position: vec4f = vec4f(in.vertexPosition, 1.0);\n    var sum: mat4x4f;\n\n    sum += vsUniforms.nodesMatrices[in.skin[0]] * in.boneWeight[0];\n    sum += vsUniforms.nodesMatrices[in.skin[1]] * in.boneWeight[1];\n    sum += vsUniforms.nodesMatrices[in.skin[2]] * in.boneWeight[2];\n    sum += vsUniforms.nodesMatrices[in.skin[3]] * in.boneWeight[3];\n\n    let rotation: mat3x3f = mat3x3f(sum[0].xyz, sum[1].xyz, sum[2].xyz);\n\n    position = sum * position;\n    position.w = 1;\n\n    var out: VSOut;\n    out.position = vsUniforms.pMatrix * vsUniforms.mvMatrix * position;\n    out.textureCoord = in.textureCoord;\n    out.normal = in.normal;\n\n    var normal: vec3f = in.normal;\n    var tangent: vec3f = in.tangent.xyz;\n\n    // https://learnopengl.com/Advanced-Lighting/Normal-Mapping\n    tangent = normalize(tangent - dot(tangent, normal) * normal);\n\n    var binormal: vec3f = cross(normal, tangent) * in.tangent.w;\n\n    normal = normalize(rotation * normal);\n    tangent = normalize(rotation * tangent);\n    binormal = normalize(rotation * binormal);\n\n    out.normal = normal;\n    out.tangent = tangent;\n    out.binormal = binormal;\n\n    out.fragPos = position.xyz;\n\n    return out;\n}\n\nfn hypot(z: vec2f) -> f32 {\n    var t: f32 = 0;\n    var x: f32 = abs(z.x);\n    let y: f32 = abs(z.y);\n    t = min(x, y);\n    x = max(x, y);\n    t = t / x;\n    if (z.x == 0.0 && z.y == 0.0) {\n        return 0.0;\n    }\n    return x * sqrt(1.0 + t * t);\n}\n\nconst PI: f32 = 3.14159265359;\nconst gamma: f32 = 2.2;\nconst MAX_REFLECTION_LOD: f32 = ${MAX_ENV_MIP_LEVELS};\n\nfn distributionGGX(normal: vec3f, halfWay: vec3f, roughness: f32) -> f32 {\n    let a: f32 = roughness * roughness;\n    let a2: f32 = a * a;\n    let nDotH: f32 = max(dot(normal, halfWay), 0.0);\n    let nDotH2: f32 = nDotH * nDotH;\n\n    let num: f32 = a2;\n    var denom: f32 = (nDotH2 * (a2 - 1.0) + 1.0);\n    denom = PI * denom * denom;\n\n    return num / denom;\n}\n\nfn geometrySchlickGGX(nDotV: f32, roughness: f32) -> f32 {\n    let r: f32 = roughness + 1.;\n    let k: f32 = r * r / 8.;\n    // float k = roughness * roughness / 2.;\n\n    let num: f32 = nDotV;\n    let denom: f32 = nDotV * (1. - k) + k;\n\n    return num / denom;\n}\n\nfn geometrySmith(normal: vec3f, viewDir: vec3f, lightDir: vec3f, roughness: f32) -> f32 {\n    let nDotV: f32 = max(dot(normal, viewDir), .0);\n    let nDotL: f32 = max(dot(normal, lightDir), .0);\n    let ggx2: f32  = geometrySchlickGGX(nDotV, roughness);\n    let ggx1: f32  = geometrySchlickGGX(nDotL, roughness);\n\n    return ggx1 * ggx2;\n}\n\nfn fresnelSchlick(lightFactor: f32, f0: vec3f) -> vec3f {\n    return f0 + (1. - f0) * pow(clamp(1. - lightFactor, 0., 1.), 5.);\n}\n\nfn fresnelSchlickRoughness(lightFactor: f32, f0: vec3f, roughness: f32) -> vec3f {\n    return f0 + (max(vec3(1.0 - roughness), f0) - f0) * pow(clamp(1.0 - lightFactor, 0.0, 1.0), 5.0);\n}\n\n@fragment fn fs(\n    in: VSOut,\n    @builtin(front_facing) isFront: bool\n) -> @location(0) vec4f {\n    if (fsUniforms.wireframe > 0) {\n        return vec4f(1);\n    }\n\n    let texCoord: vec2f = (fsUniforms.tVertexAnim * vec3f(in.textureCoord.x, in.textureCoord.y, 1.)).xy;\n    var baseColor: vec4f = textureSample(fsUniformDiffuseTexture, fsUniformDiffuseSampler, texCoord);\n\n    // hand-made alpha-test\n    if (baseColor.a < fsUniforms.discardAlphaLevel) {\n        discard;\n    }\n\n    let orm: vec4f = textureSample(fsUniformOrmTexture, fsUniformOrmSampler, texCoord);\n\n    let occlusion: f32 = orm.r;\n    let roughness: f32 = orm.g;\n    let metallic: f32 = orm.b;\n    let teamColorFactor: f32 = orm.a;\n\n    var teamColor: vec3f = baseColor.rgb * fsUniforms.replaceableColor;\n    baseColor = vec4(mix(baseColor.rgb, teamColor, teamColorFactor), baseColor.a);\n    baseColor = vec4(pow(baseColor.rgb, vec3f(gamma)), baseColor.a);\n\n    let TBN: mat3x3f = mat3x3f(in.tangent, in.binormal, in.normal);\n\n    var normal: vec3f = textureSample(fsUniformNormalTexture, fsUniformNormalSampler, texCoord).xyz;\n    normal = normal * 2 - 1;\n    normal.x = -normal.x;\n    normal.y = -normal.y;\n    if (!isFront) {\n        normal = -normal;\n    }\n    normal = normalize(TBN * -normal);\n\n    let viewDir: vec3f = normalize(fsUniforms.cameraPos - in.fragPos);\n    let reflected = reflect(-viewDir, normal);\n\n    let lightDir: vec3f = normalize(fsUniforms.lightPos - in.fragPos);\n    let lightFactor: f32 = max(dot(normal, lightDir), 0);\n    let radiance: vec3f = fsUniforms.lightColor;\n\n    var f0 = vec3f(.04);\n    f0 = mix(f0, baseColor.rgb, metallic);\n\n    var totalLight: vec3f = vec3f(0);\n    let halfWay: vec3f = normalize(viewDir + lightDir);\n    let ndf: f32 = distributionGGX(normal, halfWay, roughness);\n    let g: f32 = geometrySmith(normal, viewDir, lightDir, roughness);\n    let f: vec3f = fresnelSchlick(max(dot(halfWay, viewDir), 0), f0);\n\n    let kS = f;\n    var kD = vec3f(1);// - kS;\n    if (fsUniforms.hasEnv > 0) {\n        kD *= 1 - metallic;\n    }\n    let num: vec3f = ndf * g * f;\n    let denom: f32 = 4. * max(dot(normal, viewDir), 0.) * max(dot(normal, lightDir), 0.) + .0001;\n    var specular: vec3f = num / denom;\n\n    totalLight = (kD * baseColor.rgb / PI + specular) * radiance * lightFactor;\n\n    if (fsUniforms.shadowParams[0] > .5) {\n        let shadowBias: f32 = fsUniforms.shadowParams[1];\n        let shadowStep: f32 = fsUniforms.shadowParams[2];\n        let fragInLightPos: vec4f = fsUniforms.shadowMapLightMatrix * vec4f(in.fragPos, 1.);\n        var shadowMapCoord: vec3f = fragInLightPos.xyz / fragInLightPos.w;\n        shadowMapCoord = vec3f((shadowMapCoord.xy + 1) * .5, shadowMapCoord.z);\n        shadowMapCoord.y = 1 - shadowMapCoord.y;\n\n        let passes: u32 = 5;\n        let step: f32 = 1. / f32(passes);\n\n        let currentDepth: f32 = shadowMapCoord.z;\n        var lightDepth: f32 = textureSampleCompare(fsUniformShadowTexture, fsUniformShadowSampler, shadowMapCoord.xy, currentDepth - shadowBias);\n        let lightDepth0: f32 = textureSampleCompare(fsUniformShadowTexture, fsUniformShadowSampler, vec2f(shadowMapCoord.x + shadowStep, shadowMapCoord.y), currentDepth - shadowBias);\n        let lightDepth1: f32 = textureSampleCompare(fsUniformShadowTexture, fsUniformShadowSampler, vec2f(shadowMapCoord.x, shadowMapCoord.y + shadowStep), currentDepth - shadowBias);\n        let lightDepth2: f32 = textureSampleCompare(fsUniformShadowTexture, fsUniformShadowSampler, vec2f(shadowMapCoord.x, shadowMapCoord.y - shadowStep), currentDepth - shadowBias);\n        let lightDepth3: f32 = textureSampleCompare(fsUniformShadowTexture, fsUniformShadowSampler, vec2f(shadowMapCoord.x - shadowStep, shadowMapCoord.y), currentDepth - shadowBias);\n\n        var visibility: f32 = 0.;\n        if (lightDepth > .5) {\n            visibility += step;\n        }\n        if (lightDepth0 > .5) {\n            visibility += step;\n        }\n        if (lightDepth1 > .5) {\n            visibility += step;\n        }\n        if (lightDepth2 > .5) {\n            visibility += step;\n        }\n        if (lightDepth3 > .5) {\n            visibility += step;\n        }\n\n        totalLight *= visibility;\n    }\n\n    var color: vec3f = vec3f(0.0);\n\n    if (fsUniforms.hasEnv > 0) {\n        let f: vec3f = fresnelSchlickRoughness(max(dot(normal, viewDir), 0.0), f0, roughness);\n        let kS: vec3f = f;\n        var kD: vec3f = vec3f(1.0) - kS;\n        kD *= 1.0 - metallic;\n\n        let diffuse: vec3f = textureSample(irradienceMapTexture, irradienceMapSampler, normal).rgb * baseColor.rgb;\n        let prefilteredColor: vec3f = textureSampleLevel(prefilteredEnvTexture, prefilteredEnvSampler, reflected, roughness * MAX_REFLECTION_LOD).rgb;\n        let envBRDF: vec2f = textureSample(brdfLutTexture, brdfLutSampler, vec2f(max(dot(normal, viewDir), 0.0), roughness)).rg;\n        specular = prefilteredColor * (f * envBRDF.x + envBRDF.y);\n\n        let ambient: vec3f = (kD * diffuse + specular) * occlusion;\n        color = ambient + totalLight;\n    } else {\n        var ambient: vec3f = vec3(.03);\n        ambient *= baseColor.rgb * occlusion;\n        color = ambient + totalLight;\n    }\n\n    color = color / (vec3f(1) + color);\n    color = pow(color, vec3f(1 / gamma));\n\n    return vec4f(color, baseColor.a);\n}\n";
var depth_default = "struct VSUniforms {\n    mvMatrix: mat4x4f,\n    pMatrix: mat4x4f,\n    nodesMatrices: array<mat4x4f, ${MAX_NODES}>,\n}\n\nstruct FSUniforms {\n    replaceableColor: vec3f,\n    // replaceableType: u32,\n    discardAlphaLevel: f32,\n    tVertexAnim: mat3x3f,\n    lightPos: vec3f,\n    lightColor: vec3f,\n    cameraPos: vec3f,\n    shadowParams: vec3f,\n    shadowMapLightMatrix: mat4x4f,\n    // env\n}\n\n@group(0) @binding(0) var<uniform> vsUniforms: VSUniforms;\n@group(1) @binding(0) var<uniform> fsUniforms: FSUniforms;\n@group(1) @binding(1) var fsUniformDiffuseSampler: sampler;\n@group(1) @binding(2) var fsUniformDiffuseTexture: texture_2d<f32>;\n@group(1) @binding(3) var fsUniformNormalSampler: sampler;\n@group(1) @binding(4) var fsUniformNormalTexture: texture_2d<f32>;\n@group(1) @binding(5) var fsUniformOrmSampler: sampler;\n@group(1) @binding(6) var fsUniformOrmTexture: texture_2d<f32>;\n@group(1) @binding(7) var fsUniformShadowSampler: sampler_comparison;\n// @group(1) @binding(7) var fsUniformShadowSampler: sampler;\n@group(1) @binding(8) var fsUniformShadowTexture: texture_depth_2d;\n\nstruct VSIn {\n    @location(0) vertexPosition: vec3f,\n    @location(1) normal: vec3f,\n    @location(2) textureCoord: vec2f,\n    @location(3) tangent: vec4f,\n    @location(4) skin: vec4<u32>,\n    @location(5) boneWeight: vec4f,\n}\n\nstruct VSOut {\n    @builtin(position) position: vec4f,\n    @location(0) textureCoord: vec2f,\n    @location(1) depth: f32,\n}\n\n@vertex fn vs(\n    in: VSIn\n) -> VSOut {\n    var position: vec4f = vec4f(in.vertexPosition, 1.0);\n    var sum: mat4x4f;\n\n    sum += vsUniforms.nodesMatrices[in.skin[0]] * in.boneWeight[0];\n    sum += vsUniforms.nodesMatrices[in.skin[1]] * in.boneWeight[1];\n    sum += vsUniforms.nodesMatrices[in.skin[2]] * in.boneWeight[2];\n    sum += vsUniforms.nodesMatrices[in.skin[3]] * in.boneWeight[3];\n\n    position = sum * position;\n    position.w = 1;\n\n    var out: VSOut;\n    out.position = vsUniforms.pMatrix * vsUniforms.mvMatrix * position;\n    out.textureCoord = in.textureCoord;\n\n    out.depth = out.position.z / out.position.w;\n\n    return out;\n}\n\nstruct FSOut {\n    @builtin(frag_depth) depth: f32,\n    @location(0) color: vec4f\n}\n\n@fragment fn fs(\n    in: VSOut,\n    @builtin(front_facing) isFront: bool\n) -> FSOut {\n    let texCoord: vec2f = (fsUniforms.tVertexAnim * vec3f(in.textureCoord.x, in.textureCoord.y, 1.)).xy;\n    var baseColor: vec4f = textureSample(fsUniformDiffuseTexture, fsUniformDiffuseSampler, texCoord);\n\n    // hand-made alpha-test\n    if (baseColor.a < fsUniforms.discardAlphaLevel) {\n        discard;\n    }\n\n    var out: FSOut;\n    out.color = vec4f(1, 1, 1, 1);\n    out.depth = in.depth;\n    return out;\n}\n";
var MAX_NODES = 254;
var MAX_ENV_MIP_LEVELS = 8;
var vertexShaderHardwareSkinning = /* @__PURE__ */ sdHardwareSkinning_vs_default.replace(/\$\{MAX_NODES}/g, String(MAX_NODES));
var vertexShaderHDHardwareSkinningOld = /* @__PURE__ */ hdHardwareSkinningOld_vs_default.replace(/\$\{MAX_NODES}/g, String(MAX_NODES));
var vertexShaderHDHardwareSkinningNew = /* @__PURE__ */ hdHardwareSkinningNew_vs_default.replace(/\$\{MAX_NODES}/g, String(MAX_NODES));
var fragmentShaderHDNew = /* @__PURE__ */ hdNew_fs_default.replace(/\$\{MAX_ENV_MIP_LEVELS}/g, String(MAX_ENV_MIP_LEVELS.toFixed(1)));
var sdShader = /* @__PURE__ */ sd_default.replace(/\$\{MAX_NODES}/g, String(MAX_NODES));
var hdShader = /* @__PURE__ */ hd_default.replace(/\$\{MAX_NODES}/g, String(MAX_NODES)).replace(/\$\{MAX_ENV_MIP_LEVELS}/g, String(MAX_ENV_MIP_LEVELS.toFixed(1)));
var depthShader = /* @__PURE__ */ depth_default.replace(/\$\{MAX_NODES}/g, String(MAX_NODES));
var translation = create$2();
var rotation = create();
var scaling = create$2();
var defaultTranslation = fromValues$2(0, 0, 0);
var defaultRotation = fromValues(0, 0, 0, 1);
var defaultScaling = fromValues$2(1, 1, 1);
var tempParentRotationQuat = create();
var tempParentRotationMat = create$3();
var tempCameraMat = create$3();
var tempTransformedPivotPoint = create$2();
var tempAxis = create$2();
var tempLockQuat = create();
var tempLockMat = create$3();
var tempXAxis = create$2();
var tempCameraVec = create$2();
var tempCross0 = create$2();
var tempCross1 = create$2();
var tempPos = create$2();
var tempSum = create$2();
var tempVec3 = create$2();
var identifyMat3 = create$4();
var texCoordMat4 = create$3();
var texCoordMat3 = create$4();

// src/mdx-compatibility.js
var import_buffer2 = require("buffer");

// src/mdx-container.js
var import_buffer = require("buffer");

// src/diagnostic.js
function diagnostic(severity, code, message, offset, details = {}) {
  return Object.freeze({ severity, code, message, offset, ...details });
}

// src/mdx-container.js
var MDX_MAGIC = import_buffer.Buffer.from("MDLX", "ascii");
var SUPPORTED_FORMAT_VERSIONS = Object.freeze([800, 900, 1e3, 1100, 1200, 1300, 1400, 1600, 1800]);
function asBuffer(input) {
  if (import_buffer.Buffer.isBuffer(input)) return import_buffer.Buffer.from(input);
  if (input instanceof Uint8Array) {
    return import_buffer.Buffer.from(input.buffer, input.byteOffset, input.byteLength);
  }
  throw new TypeError("Expected a Buffer or Uint8Array");
}
function tagText(bytes) {
  return bytes.toString("latin1");
}
var MdxDocument = class {
  #original;
  constructor(original, chunks, trailingBytes, diagnostics, version) {
    this.#original = original;
    this.chunks = chunks;
    this.trailingBytes = trailingBytes;
    this.diagnostics = diagnostics;
    this.version = version;
  }
  get hasErrors() {
    return this.diagnostics.some((item) => item.severity === "error");
  }
  /** Return the exact input bytes. No canonicalization occurs. */
  toBytes() {
    return import_buffer.Buffer.from(this.#original);
  }
  summary() {
    return {
      format: "mdx",
      byteLength: this.#original.length,
      magic: this.#original.subarray(0, 4).toString("latin1"),
      version: this.version,
      supportedVersion: SUPPORTED_FORMAT_VERSIONS.includes(this.version),
      chunks: this.chunks.map((chunk) => ({
        tag: chunk.tag,
        offset: chunk.offset,
        declaredSize: chunk.declaredSize,
        actualSize: chunk.data.length,
        complete: chunk.complete
      })),
      trailingByteLength: this.trailingBytes.length,
      diagnostics: this.diagnostics
    };
  }
};
function parseMdx(input) {
  const bytes = asBuffer(input);
  const diagnostics = [];
  const chunks = [];
  if (bytes.length < 4 || !bytes.subarray(0, 4).equals(MDX_MAGIC)) {
    diagnostics.push(diagnostic(
      "error",
      "MDX_INVALID_MAGIC",
      "Expected the four-byte MDLX signature.",
      0,
      { actual: bytes.subarray(0, Math.min(4, bytes.length)).toString("hex") }
    ));
    return new MdxDocument(bytes, chunks, bytes.subarray(Math.min(4, bytes.length)), diagnostics, null);
  }
  let cursor = 4;
  let trailingBytes = import_buffer.Buffer.alloc(0);
  while (cursor < bytes.length) {
    const remaining = bytes.length - cursor;
    if (remaining < 8) {
      trailingBytes = bytes.subarray(cursor);
      diagnostics.push(diagnostic(
        "error",
        "MDX_TRUNCATED_CHUNK_HEADER",
        `A top-level chunk header needs 8 bytes; only ${remaining} remain.`,
        cursor,
        { remaining }
      ));
      break;
    }
    const tagBytes = bytes.subarray(cursor, cursor + 4);
    const declaredSize = bytes.readUInt32LE(cursor + 4);
    const payloadOffset = cursor + 8;
    const available = bytes.length - payloadOffset;
    const actualSize = Math.min(declaredSize, available);
    const complete = actualSize === declaredSize;
    const data = bytes.subarray(payloadOffset, payloadOffset + actualSize);
    chunks.push(Object.freeze({
      tag: tagText(tagBytes),
      tagBytes: import_buffer.Buffer.from(tagBytes),
      offset: cursor,
      payloadOffset,
      declaredSize,
      data: import_buffer.Buffer.from(data),
      complete,
      known: isKnownTopLevelChunk(tagText(tagBytes))
    }));
    if (!complete) {
      diagnostics.push(diagnostic(
        "error",
        "MDX_TRUNCATED_CHUNK_PAYLOAD",
        `Chunk ${JSON.stringify(tagText(tagBytes))} declares ${declaredSize} bytes but only ${available} remain.`,
        cursor,
        { tag: tagText(tagBytes), declaredSize, available }
      ));
      cursor = bytes.length;
      break;
    }
    cursor = payloadOffset + declaredSize;
  }
  const versionChunks = chunks.filter((chunk) => chunk.tag === "VERS");
  let version = null;
  if (versionChunks.length === 0) {
    diagnostics.push(diagnostic("warning", "MDX_MISSING_VERSION", "No VERS chunk was found.", 4));
  } else {
    if (versionChunks.length > 1) {
      diagnostics.push(diagnostic(
        "warning",
        "MDX_DUPLICATE_VERSION",
        `Found ${versionChunks.length} VERS chunks; the first complete value is reported.`,
        versionChunks[1].offset,
        { count: versionChunks.length }
      ));
    }
    const usable = versionChunks.find((chunk) => chunk.data.length >= 4);
    for (const chunk of versionChunks.filter((item) => item.data.length < 4)) {
      diagnostics.push(diagnostic(
        "error",
        "MDX_SHORT_VERSION_CHUNK",
        "A VERS chunk must contain at least a 32-bit version value.",
        chunk.payloadOffset,
        { actualSize: chunk.data.length }
      ));
    }
    if (usable) version = usable.data.readUInt32LE(0);
  }
  if (version !== null && !SUPPORTED_FORMAT_VERSIONS.includes(version)) {
    diagnostics.push(diagnostic(
      "warning",
      "MDX_UNSUPPORTED_VERSION",
      `Format version ${version} is retained but has no semantic decoder yet.`,
      versionChunks.find((chunk) => chunk.data.length >= 4).payloadOffset,
      { version, supportedVersions: SUPPORTED_FORMAT_VERSIONS }
    ));
  }
  return new MdxDocument(bytes, chunks, trailingBytes, diagnostics, version);
}
function isKnownTopLevelChunk(tag) {
  return (/* @__PURE__ */ new Set([
    "VERS",
    "MODL",
    "SEQS",
    "GLBS",
    "MTLS",
    "TEXS",
    "TXAN",
    "GEOS",
    "GEOA",
    "BONE",
    "LITE",
    "HELP",
    "ATCH",
    "PIVT",
    "PREM",
    "PRE2",
    "RIBB",
    "CAMS",
    "EVTS",
    "CLID",
    "FAFX",
    "BPOS",
    "CORN",
    "DILG",
    "SNDS",
    "SNEM",
    "MDVI"
  ])).has(tag);
}

// src/mdx-compatibility.js
var TEXTURE_SLOTS = ["TextureID", "NormalTextureID", "ORMTextureID", "EmissiveTextureID", "TeamColorTextureID", "ReflectionsTextureID"];
var arrayBuffer = (bytes) => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
var u32 = (value) => {
  const b = import_buffer2.Buffer.alloc(4);
  b.writeUInt32LE(value >>> 0);
  return b;
};
var f32 = (value) => {
  const b = import_buffer2.Buffer.alloc(4);
  b.writeFloatLE(value);
  return b;
};
var floats = (values) => import_buffer2.Buffer.concat(Array.from(values, f32));
var str = (value, length) => {
  const b = import_buffer2.Buffer.alloc(length);
  b.write(value || "", 0, length, "latin1");
  return b;
};
var readString = (b, at, length) => b.subarray(at, at + length).toString("latin1").split("\0")[0];
var vector = (b, at, count = 3) => Float32Array.from({ length: count }, (_, i) => b.readFloatLE(at + i * 4));
var sized = (parts) => {
  const b = import_buffer2.Buffer.concat([u32(0), ...parts]);
  b.writeUInt32LE(b.length);
  return b;
};
var mdxChunk = (tag, payload) => import_buffer2.Buffer.concat([import_buffer2.Buffer.from(tag), u32(payload.length), payload]);
function mdxRecords(payload, tag) {
  const records = [];
  for (let p = 0; p < payload.length; ) {
    let size;
    if (tag === "MODL") size = 372;
    else if (tag === "SEQS") size = 132;
    else if (tag === "TEXS") size = 268;
    else if (tag === "PIVT") size = 12;
    else if (tag === "GLBS" || tag === "DILG") size = 4;
    else {
      if (p + 4 > payload.length) throw new Error(`Truncated ${tag} record.`);
      size = payload.readUInt32LE(p);
      if (tag === "CAMS") size &= 16777215;
      if (tag === "BONE") size += 8;
      if (tag === "EVTS") {
        if (size < 96 || p + size + 12 > payload.length || payload.toString("ascii", p + size, p + size + 4) !== "KEVT") throw new Error("Invalid event record.");
        size += 12 + payload.readUInt32LE(p + size + 4) * 4;
      }
      if (tag === "CLID") {
        const shape = payload.readUInt32LE(p + size);
        if (shape > 3) throw new Error(`Unsupported collision shape ${shape}.`);
        size += 4 + (shape === 2 ? 12 : 24) + (shape >= 2 ? 4 : 0);
      }
    }
    if (size < 4 || p + size > payload.length) throw new Error(`Invalid ${tag} record size.`);
    records.push(payload.subarray(p, p + size));
    p += size;
  }
  return records;
}
function readTrack(b, at, width = 1, integer = false) {
  if (at + 16 > b.length) throw new Error("Truncated animation header.");
  const count = b.readUInt32LE(at + 4), LineType2 = b.readUInt32LE(at + 8), global = b.readInt32LE(at + 12);
  if (LineType2 > 3) throw new Error("Invalid animation interpolation.");
  const size = 16 + count * (4 + width * 4 * (LineType2 >= 2 ? 3 : 1));
  if (at + size > b.length) throw new Error("Truncated animation keys.");
  let p = at + 16;
  const Keys = [];
  for (let i = 0; i < count; i++) {
    const key = { Frame: b.readInt32LE(p) };
    p += 4;
    for (const field of LineType2 >= 2 ? ["Vector", "InTan", "OutTan"] : ["Vector"]) {
      const Type = integer ? Int32Array : Float32Array;
      key[field] = Type.from({ length: width }, () => {
        const n = integer ? b.readInt32LE(p) : b.readFloatLE(p);
        p += 4;
        return n;
      });
    }
    Keys.push(key);
  }
  return { track: { LineType: LineType2, GlobalSeqId: global < 0 ? null : global, Keys }, size };
}
function writeTrack(tag, track, integer = false) {
  if (!track?.Keys) return import_buffer2.Buffer.alloc(0);
  return import_buffer2.Buffer.concat([import_buffer2.Buffer.from(tag), u32(track.Keys.length), u32(track.LineType), u32(track.GlobalSeqId ?? -1), ...track.Keys.flatMap((k) => [u32(k.Frame), ...(track.LineType >= 2 ? [k.Vector, k.InTan, k.OutTan] : [k.Vector]).map((v) => import_buffer2.Buffer.concat(Array.from(v, integer ? u32 : f32)))])]);
}
var materialTracks = { KMTA: ["Alpha", 1], KMTF: ["TextureID", 1, true], KMTE: ["EmissiveGain", 1], KFC3: ["FresnelColor", 3], KFCA: ["FresnelOpacity", 1], KFTC: ["FresnelTeamColor", 1] };
var lightTracks = { KLAS: ["AttenuationStart", 1], KLAE: ["AttenuationEnd", 1], KLAC: ["Color", 3], KLAI: ["Intensity", 1], KLBC: ["AmbColor", 3], KLBI: ["AmbIntensity", 1], KLAV: ["Visibility", 1], KLSS: ["ShadowCastingStart", 1], KLSE: ["ShadowCastingEnd", 1], KLQF: ["QuadraticFalloff", 1], KLLF: ["LinearFalloff", 1], KLDA: ["Damping", 1] };
var ribbonTracks = { KRHA: ["HeightAbove", 1], KRHB: ["HeightBelow", 1], KRAL: ["Alpha", 1], KRCO: ["Color", 3], KRTX: ["TextureSlot", 1, true], KRVS: ["Visibility", 1] };
var cameraTracks = { KCTR: ["Translation", 3], KCRL: ["Rotation", 1], KTTR: ["TargetTranslation", 3], KCVS: ["Visibility", 1], IDUF: ["FocusDistance", 1], ELAF: ["FocalLength", 1], PTSF: ["FStop", 1] };
var emitterBases = {
  PREM: { key: "ParticleEmitters", fields: [["EmissionRate", 0], ["Gravity", 4], ["Longitude", 8], ["Latitude", 12], ["LifeSpan", 276], ["InitVelocity", 280]] },
  PRE2: { key: "ParticleEmitters2", fields: [["Speed", 0], ["Variation", 4], ["Latitude", 8], ["Gravity", 12], ["EmissionRate", 20], ["Length", 24], ["Width", 28]] },
  CORN: { key: "ParticleEmitterPopcorns", fields: [["LifeSpan", 0], ["EmissionRate", 4], ["Speed", 8], ["Color", 12, 3], ["Alpha", 24]] }
};
var bgrTracks = /* @__PURE__ */ new Set(["KLAC", "KLBC", "KRCO"]);
function colorTrack(track) {
  if (!track?.Keys) return track;
  return { ...track, Keys: track.Keys.map((key) => {
    const result = { ...key };
    for (const field of ["Vector", "InTan", "OutTan"]) if (key[field]) result[field] = Float32Array.of(key[field][2], key[field][1], key[field][0]);
    return result;
  }) };
}
function readTracks(b, at, owner, schema) {
  for (let p = at; p < b.length; ) {
    const tag = b.toString("ascii", p, p + 4), def = schema[tag];
    if (!def) throw new Error(`Unsupported animation ${tag}.`);
    const [key, width, integer] = def;
    const { track, size } = readTrack(b, p, width, integer);
    if (owner[key]?.Keys) throw new Error(`Duplicate animation ${tag}.`);
    if (owner[key] != null) (owner._MdxDefaults ||= {})[key] = owner[key];
    owner[key] = bgrTracks.has(tag) ? colorTrack(track) : track;
    p += size;
  }
}
var writeTracks = (owner, schema) => Object.entries(schema).map(([tag, [key, , integer]]) => writeTrack(tag, bgrTracks.has(tag) ? colorTrack(owner[key]) : owner[key], integer));
var base = (owner, key, fallback = 0) => owner[key]?.Keys ? owner._MdxDefaults?.[key] ?? fallback : owner[key] ?? fallback;
function readMaterials(payload, version) {
  return mdxRecords(payload, "MTLS").map((b) => {
    const m = { PriorityPlane: b.readInt32LE(4), RenderMode: b.readUInt32LE(8), Layers: [] };
    let p = 12;
    if (version >= 900 && version < 1100) {
      m.Shader = readString(b, p, 80);
      p += 80;
    }
    if (b.toString("ascii", p, p + 4) !== "LAYS") throw new Error("Missing material layers.");
    const count = b.readUInt32LE(p + 4);
    p += 8;
    for (let i = 0; i < count; i++) {
      const size = b.readUInt32LE(p), l = b.subarray(p, p + size);
      if (size < 28 || p + size > b.length) throw new Error("Invalid layer size.");
      const layer = { FilterMode: l.readUInt32LE(4), Shading: l.readUInt32LE(8), TextureID: l.readInt32LE(12), TVertexAnimId: l.readInt32LE(16), CoordId: l.readUInt32LE(20), Alpha: l.readFloatLE(24) };
      if (layer.TVertexAnimId === -1) layer.TVertexAnimId = null;
      let q = 28;
      if (version >= 900) {
        layer.EmissiveGain = l.readFloatLE(q);
        q += 4;
      }
      if (version >= 1e3) {
        layer.FresnelColor = vector(l, q);
        layer.FresnelOpacity = l.readFloatLE(q + 12);
        layer.FresnelTeamColor = l.readFloatLE(q + 16);
        q += 20;
      }
      if (version >= 1100) {
        layer._MdxTextureId = layer.TextureID;
        delete layer.TextureID;
        layer.ShaderTypeId = l.readUInt32LE(q);
        const slots = l.readUInt32LE(q + 4);
        q += 8;
        layer._MdxSlots = [];
        for (let j = 0; j < slots; j++) {
          const id = l.readInt32LE(q), slot = l.readUInt32LE(q + 4), key = TEXTURE_SLOTS[slot];
          q += 8;
          if (!key || layer._MdxSlots.includes(slot)) throw new Error(`Unsupported or duplicate texture slot ${slot}.`);
          layer._MdxSlots.push(slot);
          layer[key] = id;
          if (q + 4 <= l.length && l.toString("ascii", q, q + 4) === "KMTF") {
            const { track, size: n } = readTrack(l, q, 1, true);
            (layer._MdxDefaults ||= {})[key] = id;
            layer[key] = track;
            q += n;
          }
        }
      }
      readTracks(l, q, layer, materialTracks);
      m.Layers.push(layer);
      p += size;
    }
    if (p !== b.length) throw new Error("Unrecognized material tail.");
    return m;
  });
}
function writeMaterials(materials, version) {
  return import_buffer2.Buffer.concat(materials.map((m) => sized([u32(m.PriorityPlane), u32(m.RenderMode), ...version >= 900 && version < 1100 ? [str(m.Shader, 80)] : [], import_buffer2.Buffer.from("LAYS"), u32(m.Layers.length), ...m.Layers.map((l) => {
    const parts = [u32(l.FilterMode), u32(l.Shading), u32(version >= 1100 ? l._MdxTextureId ?? 0 : base(l, "TextureID")), u32(l.TVertexAnimId ?? -1), u32(l.CoordId), f32(base(l, "Alpha", 1))];
    if (version >= 900) parts.push(f32(base(l, "EmissiveGain", 1)));
    if (version >= 1e3) parts.push(floats(base(l, "FresnelColor", [1, 1, 1])), f32(base(l, "FresnelOpacity")), f32(base(l, "FresnelTeamColor")));
    if (version >= 1100) {
      const slots = [.../* @__PURE__ */ new Set([...l._MdxSlots || [], ...TEXTURE_SLOTS.map((_, i) => i)])].filter((i) => l[TEXTURE_SLOTS[i]] != null);
      parts.push(u32(l.ShaderTypeId), u32(slots.length));
      for (const slot of slots) {
        const key = TEXTURE_SLOTS[slot];
        parts.push(u32(base(l, key)), u32(slot), writeTrack("KMTF", l[key], true));
      }
    }
    parts.push(...writeTracks(l, Object.fromEntries(Object.entries(materialTracks).filter(([tag]) => tag !== "KMTF" || version < 1100))));
    return sized(parts);
  })])));
}
function geosetLayout(b, version) {
  const spans = {};
  let p = 4;
  const take = (tag, width) => {
    if (b.toString("ascii", p, p + 4) !== tag) throw new Error(`Missing geoset ${tag}.`);
    const start = p, count = b.readUInt32LE(p + 4);
    p += 8 + count * width;
    if (p > b.length) throw new Error(`Truncated geoset ${tag}.`);
    spans[tag] = { start, end: p, count };
  };
  for (const [tag, width] of [["VRTX", 12], ["NRMS", 12], ["PTYP", 4], ["PCNT", 4], ["PVTX", 2], ["GNDX", 1], ["MTGC", 4], ["MATS", 4]]) take(tag, width);
  spans.selection = p + 8;
  p += 12 + (version >= 900 ? 84 : 0) + 28;
  const anims = b.readUInt32LE(p);
  p += 4 + anims * 28;
  while (p < b.length) {
    const tag = b.toString("ascii", p, p + 4);
    if (tag === "TANG") take(tag, 16);
    else if (tag === "SKIN") take(tag, version >= 1400 ? 2 : 1);
    else if (tag === "UVAS") break;
    else throw new Error(`Unsupported geoset subchunk ${tag}.`);
  }
  return spans;
}
function replaceSpans(b, changes) {
  const out = [];
  let p = 0;
  for (const { start, end, data } of changes.sort((a, b2) => a.start - b2.start)) {
    out.push(b.subarray(p, start), data);
    p = end;
  }
  out.push(b.subarray(p));
  return import_buffer2.Buffer.concat(out);
}
function readSpecialNode(b, tag, version, node) {
  let p = 4 + b.readUInt32LE(4);
  const n = node || {};
  const read = (key, width = 1, integer = false) => {
    n[key] = width === 3 ? vector(b, p) : integer ? b.readUInt32LE(p) : b.readFloatLE(p);
    p += width * 4;
  };
  if (tag === "LITE") {
    read("LightType", 1, true);
    if (version >= 1300) read("ShadowCasting", 1, true);
    read("AttenuationStart");
    read("AttenuationEnd");
    read("Color", 3);
    read("Intensity");
    read("AmbColor", 3);
    read("AmbIntensity");
    if (version >= 1200) read("ShadowIntensity");
    if (version >= 1300) {
      read("ShadowCastingStart");
      read("ShadowCastingEnd");
    }
    if (version >= 1600) {
      read("QuadraticFalloff");
      read("LinearFalloff");
      read("Damping");
    }
    readTracks(b, p, n, lightTracks);
  } else {
    for (const [key, width, int] of [["HeightAbove", 1], ["HeightBelow", 1], ["Alpha", 1], ["Color", 3], ["LifeSpan", 1], ["TextureSlot", 1, true], ["EmissionRate", 1, true], ["Rows", 1, true], ["Columns", 1, true], ["MaterialID", 1, true], ["Gravity", 1]]) read(key, width, int);
    readTracks(b, p, n, ribbonTracks);
  }
  return n;
}
function writeSpecialNode(b, n, tag, version) {
  const parts = [b.subarray(4, 4 + b.readUInt32LE(4))];
  const write = (key, width = 1, integer = false, fallback = 0) => parts.push(width === 3 ? floats(base(n, key, [1, 1, 1])) : integer ? u32(base(n, key, fallback)) : f32(base(n, key, fallback)));
  if (tag === "LITE") {
    write("LightType", 1, true);
    if (version >= 1300) write("ShadowCasting", 1, true);
    write("AttenuationStart");
    write("AttenuationEnd");
    write("Color", 3);
    write("Intensity");
    write("AmbColor", 3);
    write("AmbIntensity");
    if (version >= 1200) write("ShadowIntensity");
    if (version >= 1300) {
      write("ShadowCastingStart");
      write("ShadowCastingEnd");
    }
    if (version >= 1600) {
      write("QuadraticFalloff", 1, false, 5e-4);
      write("LinearFalloff");
      write("Damping", 1, false, 1e-5);
    }
    parts.push(...writeTracks(n, lightTracks));
  } else {
    for (const [key, width, int] of [["HeightAbove", 1], ["HeightBelow", 1], ["Alpha", 1], ["Color", 3], ["LifeSpan", 1], ["TextureSlot", 1, true], ["EmissionRate", 1, true], ["Rows", 1, true], ["Columns", 1, true], ["MaterialID", 1, true], ["Gravity", 1]]) write(key, width, int);
    parts.push(...writeTracks(n, ribbonTracks));
  }
  return sized(parts);
}
function readCamera(b) {
  const Variant = b.readUInt32LE(0) >>> 24, extra = Variant === 1 || Variant === 2;
  const c = { Variant, Name: readString(b, 4, 80), Position: vector(b, 84), FieldOfView: b.readFloatLE(96), FarClip: b.readFloatLE(100), NearClip: b.readFloatLE(104), TargetPosition: vector(b, extra ? 120 : 108) };
  if (extra) c.VariantData = new Uint8Array(b.subarray(108, 120));
  readTracks(b, extra ? 132 : 120, c, cameraTracks);
  return c;
}
function writeCamera(c) {
  const variant = c.Variant || 0;
  const b = sized([str(c.Name, 80), floats(c.Position), f32(c.FieldOfView), f32(c.FarClip), f32(c.NearClip), ...[1, 2].includes(variant) ? [import_buffer2.Buffer.from(c.VariantData || new Uint8Array(12))] : [], floats(c.TargetPosition), ...writeTracks(c, cameraTracks)]);
  if (b.length > 16777215) throw new Error("Camera exceeds its 24-bit size field.");
  b.writeUInt32LE((b.length | variant << 24) >>> 0);
  return b;
}
function parseCompatibleMdx(input) {
  const bytes = import_buffer2.Buffer.from(input), container = parseMdx(bytes), version = container.version;
  if (container.chunks.some((c) => c.tag === "SNEM")) throw new Error("Sound-emitter nodes are not supported; preserving the original file is required to retain their node and pivot references");
  if (container.chunks.filter((c) => c.tag === "VERS").length > 1) throw new Error("Repeated version chunks cannot be edited safely");
  const originals = /* @__PURE__ */ new Map(), parts = [import_buffer2.Buffer.from("MDLX"), mdxChunk("VERS", u32(version))];
  for (const c of container.chunks) {
    const payload = bytes.subarray(c.payloadOffset, c.payloadOffset + c.declaredSize);
    if (c.tag === "VERS") continue;
    if (originals.has(c.tag)) throw new Error(`Duplicate ${c.tag} chunks cannot be edited safely.`);
    originals.set(c.tag, payload);
    if (["MTLS", "LITE", "RIBB", "CAMS", "CLID"].includes(c.tag)) {
      if (["LITE", "RIBB", "CLID"].includes(c.tag)) {
        const nodes = mdxRecords(payload, c.tag).map((b) => {
          const at = c.tag === "CLID" ? 0 : 4;
          return b.subarray(at, at + b.readUInt32LE(at));
        });
        parts.push(mdxChunk("HELP", import_buffer2.Buffer.concat(nodes)));
      }
      continue;
    }
    if (c.tag === "GEOS") {
      const gs = mdxRecords(payload, "GEOS").map((b) => {
        const spans = geosetLayout(b, version), changes = [];
        if (version >= 1400 && spans.SKIN) {
          const s = spans.SKIN, data = import_buffer2.Buffer.alloc(8 + s.count);
          b.copy(data, 0, s.start, s.start + 8);
          for (let i = 0; i < s.count; i++) data[8 + i] = b.readUInt16LE(s.start + 8 + i * 2) & 255;
          changes.push({ ...s, data });
        }
        const out = replaceSpans(b, changes);
        out.writeUInt32LE(out.length);
        return out;
      });
      parts.push(mdxChunk("GEOS", import_buffer2.Buffer.concat(gs)));
      continue;
    }
    parts.push(mdxChunk(c.tag, payload));
  }
  const model = parse$1(arrayBuffer(import_buffer2.Buffer.concat(parts)));
  if (originals.has("DILG")) model.Gliders = mdxRecords(originals.get("DILG"), "DILG").map((b) => ({ GeosetId: b.readUInt32LE(0) }));
  if (originals.has("MTLS")) model.Materials = readMaterials(originals.get("MTLS"), version);
  for (const [tag, key] of [["LITE", "Lights"], ["RIBB", "RibbonEmitters"], ["CLID", "CollisionShapes"]]) if (originals.has(tag)) {
    model[key] = mdxRecords(originals.get(tag), tag).map((b) => {
      const at = tag === "CLID" ? 0 : 4, id = b.readInt32LE(at + 84), n = model.Nodes[id];
      model.Helpers = model.Helpers.filter((h) => h !== n);
      if (tag !== "CLID") return readSpecialNode(b, tag, version, n);
      let p = b.readUInt32LE(0);
      n.Shape = b.readUInt32LE(p);
      p += 4;
      const count = n.Shape === 2 ? 3 : 6;
      n.Vertices = vector(b, p, count);
      p += count * 4;
      if (n.Shape >= 2) n.BoundsRadius = b.readFloatLE(p);
      return n;
    });
  }
  if (originals.has("CAMS")) model.Cameras = mdxRecords(originals.get("CAMS"), "CAMS").map(readCamera);
  const info = originals.get("MODL");
  if (info) {
    model.Info.Name = readString(info, 0, 80);
    model.Info.AnimationFile = readString(info, 80, 260);
  }
  for (const [i, b] of mdxRecords(originals.get("SEQS") || import_buffer2.Buffer.alloc(0), "SEQS").entries()) {
    model.Sequences[i].SyncPoint = b.readUInt32LE(100);
    model.Sequences[i].Flags = b.readUInt32LE(92);
    model.Sequences[i].NonLooping = !!(model.Sequences[i].Flags & 1);
  }
  for (const [i, b] of mdxRecords(originals.get("TEXS") || import_buffer2.Buffer.alloc(0), "TEXS").entries()) model.Textures[i].Image = readString(b, 4, 260);
  for (const [tag, key, offset] of [["ATCH", "Attachments", 0], ["PREM", "ParticleEmitters", 16]]) {
    for (const [i, b] of mdxRecords(originals.get(tag) || import_buffer2.Buffer.alloc(0), tag).entries()) model[key][i].Path = readString(b, 4 + b.readUInt32LE(4) + offset, 260);
  }
  for (const event of model.EventObjects) event.EventTrack = Int32Array.from(event.EventTrack);
  for (const [i, b] of mdxRecords(originals.get("GEOS") || import_buffer2.Buffer.alloc(0), "GEOS").entries()) {
    const g = model.Geosets[i], s = geosetLayout(b, version);
    g.PrimitiveTypes = Uint32Array.from({ length: s.PTYP.count }, (_, j) => b.readUInt32LE(s.PTYP.start + 8 + j * 4));
    g.PrimitiveCounts = Uint32Array.from({ length: s.PCNT.count }, (_, j) => b.readUInt32LE(s.PCNT.start + 8 + j * 4));
    g.SelectionFlags = b.readUInt32LE(s.selection);
    g.Unselectable = !!(g.SelectionFlags & 4);
    if (version >= 1400 && s.SKIN) g.SkinWeights = Uint16Array.from({ length: s.SKIN.count }, (_, j) => b.readUInt16LE(s.SKIN.start + 8 + j * 2));
  }
  for (const [i, b] of mdxRecords(originals.get("GEOA") || import_buffer2.Buffer.alloc(0), "GEOA").entries()) {
    const a = model.GeosetAnims[i];
    if (a.Alpha?.Keys) (a._MdxDefaults ||= {}).Alpha = b.readFloatLE(4);
    if (a.Color?.Keys) (a._MdxDefaults ||= {}).Color = vector(b, 12);
  }
  for (const [tag, { key, fields }] of Object.entries(emitterBases)) for (const [i, b] of mdxRecords(originals.get(tag) || import_buffer2.Buffer.alloc(0), tag).entries()) {
    const owner = model[key][i], at = 4 + b.readUInt32LE(4);
    for (const [field, offset, width] of fields) {
      const value = width === 3 ? vector(b, at + offset) : b.readFloatLE(at + offset);
      if (owner[field]?.Keys) (owner._MdxDefaults ||= {})[field] = value;
      else if (tag === "PRE2" && (field === "Length" || field === "Width")) owner[field] = value;
    }
  }
  return model;
}
function generateCompatibleMdx(inputModel) {
  const model = { ...inputModel };
  for (const key of ["Attachments", "Lights", "ParticleEmitters", "ParticleEmitters2", "RibbonEmitters", "ParticleEmitterPopcorns", "Cameras"]) model[key] = (model[key] || []).map((n) => {
    if (typeof n.Visibility !== "number") return n;
    const frames = [.../* @__PURE__ */ new Set([0, ...(model.Sequences || []).flatMap((s) => Array.from(s.Interval))])].sort((a, b) => a - b);
    return { ...n, Visibility: { LineType: 0, GlobalSeqId: null, Keys: frames.map((Frame) => ({ Frame, Vector: Float32Array.of(n.Visibility) })) } };
  });
  const safe = { ...model, Materials: [], Lights: model.Lights.map((n) => ({ ...n, AttenuationStart: 0, AttenuationEnd: 0 })), RibbonEmitters: model.RibbonEmitters.map((n) => ({ ...n, Color: new Float32Array([1, 1, 1]) })), Cameras: [], CollisionShapes: model.CollisionShapes.map((n) => ({ ...n, Shape: 0, Vertices: new Float32Array(6) })), BindPoses: model.BindPoses?.length ? model.BindPoses : void 0 };
  const bytes = import_buffer2.Buffer.from(generate$1(safe)), container = parseMdx(bytes), parts = [import_buffer2.Buffer.from("MDLX")];
  if (container.hasErrors) throw new Error("Invalid generated MDX structure.");
  const emitted = /* @__PURE__ */ new Set();
  for (const c of container.chunks) {
    let payload = import_buffer2.Buffer.from(bytes.subarray(c.payloadOffset, c.payloadOffset + c.declaredSize));
    emitted.add(c.tag);
    if (c.tag === "MODL") {
      str(model.Info.Name, 80).copy(payload, 0);
      str(model.Info.AnimationFile, 260).copy(payload, 80);
    }
    if (c.tag === "SEQS") model.Sequences.forEach((s, i) => {
      payload.writeUInt32LE(s.SyncPoint || 0, i * 132 + 100);
      payload.writeUInt32LE(((s.Flags || 0) & ~1 | (s.NonLooping ? 1 : 0)) >>> 0, i * 132 + 92);
    });
    if (c.tag === "TEXS") model.Textures.forEach((t, i) => str(t.Image, 260).copy(payload, i * 268 + 4));
    if (c.tag === "CAMS") payload = import_buffer2.Buffer.concat(model.Cameras.map(writeCamera));
    if (["LITE", "RIBB", "CLID", "ATCH", "PREM", "PRE2", "CORN", "GEOS", "GEOA"].includes(c.tag)) {
      const key = { LITE: "Lights", RIBB: "RibbonEmitters", CLID: "CollisionShapes", ATCH: "Attachments", PREM: "ParticleEmitters", PRE2: "ParticleEmitters2", CORN: "ParticleEmitterPopcorns", GEOS: "Geosets", GEOA: "GeosetAnims" }[c.tag];
      payload = import_buffer2.Buffer.concat(mdxRecords(payload, c.tag).map((b, i) => {
        const n = model[key][i];
        if (emitterBases[c.tag]) {
          const at = 4 + b.readUInt32LE(4);
          if (c.tag === "PRE2") {
            b.writeFloatLE(base(n, "Length"), at + 24);
            b.writeFloatLE(base(n, "Width"), at + 28);
          }
          for (const [field, offset, width] of emitterBases[c.tag].fields) if (n[field]?.Keys && n._MdxDefaults?.[field] != null) {
            const value = n._MdxDefaults[field];
            if (width === 3) floats(value).copy(b, at + offset);
            else b.writeFloatLE(value, at + offset);
          }
          if (c.tag !== "PREM") return b;
        }
        if (c.tag === "LITE" || c.tag === "RIBB") return writeSpecialNode(b, n, c.tag, model.Version);
        if (c.tag === "CLID") return import_buffer2.Buffer.concat([b.subarray(0, b.readUInt32LE(0)), u32(n.Shape), floats(n.Vertices), ...n.Shape >= 2 ? [f32(n.BoundsRadius)] : []]);
        if (c.tag === "ATCH" || c.tag === "PREM") {
          str(n.Path, 260).copy(b, 4 + b.readUInt32LE(4) + (c.tag === "PREM" ? 16 : 0));
          return b;
        }
        if (c.tag === "GEOA") {
          if (n.Alpha?.Keys) b.writeFloatLE(base(n, "Alpha", 1), 4);
          if (n.Color?.Keys) floats(base(n, "Color", [1, 1, 1])).copy(b, 12);
          return b;
        }
        const s = geosetLayout(b, Math.min(model.Version, 1100)), changes = [];
        b.writeUInt32LE(((n.SelectionFlags || 0) & ~4 | (n.Unselectable ? 4 : 0)) >>> 0, s.selection);
        if (n.PrimitiveCounts && Array.from(n.PrimitiveCounts).reduce((a, v) => a + v, 0) === n.Faces.length) {
          for (const [tag, values] of [["PTYP", n.PrimitiveTypes], ["PCNT", n.PrimitiveCounts]]) changes.push({ ...s[tag], data: import_buffer2.Buffer.concat([import_buffer2.Buffer.from(tag), u32(values.length), ...Array.from(values, u32)]) });
        }
        if (model.Version >= 1400 && s.SKIN) {
          const data = import_buffer2.Buffer.alloc(8 + n.SkinWeights.length * 2);
          data.write("SKIN");
          data.writeUInt32LE(n.SkinWeights.length, 4);
          n.SkinWeights.forEach((v, j) => data.writeUInt16LE(v, 8 + j * 2));
          changes.push({ ...s.SKIN, data });
        }
        const out = replaceSpans(b, changes);
        out.writeUInt32LE(out.length);
        return out;
      }));
    }
    parts.push(mdxChunk(c.tag, payload));
  }
  if (model.Materials.length) parts.push(mdxChunk("MTLS", writeMaterials(model.Materials, model.Version)));
  if (!emitted.has("CAMS") && model.Cameras.length) parts.push(mdxChunk("CAMS", import_buffer2.Buffer.concat(model.Cameras.map(writeCamera))));
  if (model.Gliders?.length) parts.push(mdxChunk("DILG", import_buffer2.Buffer.concat(model.Gliders.map((g) => u32(g.GeosetId)))));
  return import_buffer2.Buffer.concat(parts);
}

// src/mdl-compatibility.js
var import_buffer4 = require("buffer");

// src/mdl-lossless.js
var import_buffer3 = require("buffer");
var isWhitespace = (byte) => byte === 32 || byte === 9 || byte === 10 || byte === 13 || byte === 12;
var isDigit = (byte) => byte >= 48 && byte <= 57;
var isIdentStart = (byte) => byte >= 65 && byte <= 90 || byte >= 97 && byte <= 122 || byte === 95 || byte === 36;
var isIdentPart = (byte) => isIdentStart(byte) || isDigit(byte) || byte === 46;
var isNumberStart = (bytes, index2) => {
  const byte = bytes[index2];
  if (isDigit(byte)) return true;
  if (byte === 46) return isDigit(bytes[index2 + 1]);
  if (byte === 43 || byte === 45) {
    return isDigit(bytes[index2 + 1]) || bytes[index2 + 1] === 46 && isDigit(bytes[index2 + 2]);
  }
  return false;
};
function asBuffer2(input) {
  if (typeof input === "string") return import_buffer3.Buffer.from(input, "utf8");
  if (import_buffer3.Buffer.isBuffer(input)) return import_buffer3.Buffer.from(input);
  if (input instanceof Uint8Array) {
    return import_buffer3.Buffer.from(input.buffer, input.byteOffset, input.byteLength);
  }
  throw new TypeError("Expected a string, Buffer, or Uint8Array");
}
function token(kind, bytes, start, end) {
  return Object.freeze({ kind, start, end, raw: import_buffer3.Buffer.from(bytes.subarray(start, end)) });
}
function isTrivia(item) {
  return item.kind === "whitespace" || item.kind === "line-comment" || item.kind === "block-comment";
}
function mdlStringEnd(bytes, start) {
  const end = bytes.indexOf(34, start + 1);
  return end < 0 ? -1 : end + 1;
}
function tokenAscii(item) {
  return item.raw.toString("ascii");
}
var MdlDocument = class {
  #original;
  constructor(original, tokens, diagnostics, version) {
    this.#original = original;
    this.tokens = tokens;
    this.diagnostics = diagnostics;
    this.version = version;
  }
  get hasErrors() {
    return this.diagnostics.some((item) => item.severity === "error");
  }
  /** Return the exact input bytes. No formatting or repairs are applied. */
  toBytes() {
    return import_buffer3.Buffer.from(this.#original);
  }
  summary() {
    const counts = {};
    for (const item of this.tokens) counts[item.kind] = (counts[item.kind] ?? 0) + 1;
    return {
      format: "mdl",
      byteLength: this.#original.length,
      version: this.version,
      supportedVersion: SUPPORTED_FORMAT_VERSIONS.includes(this.version),
      tokenCount: this.tokens.length,
      tokenKinds: counts,
      diagnostics: this.diagnostics
    };
  }
};
function parseMdl(input) {
  const bytes = asBuffer2(input);
  const diagnostics = [];
  const tokens = [];
  let cursor = 0;
  while (cursor < bytes.length) {
    const start = cursor;
    const byte = bytes[cursor];
    if (isWhitespace(byte)) {
      cursor += 1;
      while (cursor < bytes.length && isWhitespace(bytes[cursor])) cursor += 1;
      tokens.push(token("whitespace", bytes, start, cursor));
      continue;
    }
    if (byte === 47 && bytes[cursor + 1] === 47) {
      cursor += 2;
      while (cursor < bytes.length && bytes[cursor] !== 10 && bytes[cursor] !== 13) cursor += 1;
      tokens.push(token("line-comment", bytes, start, cursor));
      continue;
    }
    if (byte === 34) {
      const end = mdlStringEnd(bytes, cursor);
      const terminated = end >= 0;
      cursor = terminated ? end : bytes.length;
      tokens.push(token("string", bytes, start, cursor));
      if (!terminated) {
        diagnostics.push(diagnostic("error", "MDL_UNTERMINATED_STRING", "String reaches end of file without a closing quote.", start));
      }
      continue;
    }
    if (byte === 47 && bytes[cursor + 1] === 42) {
      const end = bytes.indexOf(import_buffer3.Buffer.from("*/"), cursor + 2);
      cursor = end < 0 ? bytes.length : end + 2;
      tokens.push(token("block-comment", bytes, start, cursor));
      if (end < 0) diagnostics.push(diagnostic("error", "MDL_UNTERMINATED_BLOCK_COMMENT", "Block comment reaches end of file without a closing */.", start));
      continue;
    }
    if (isIdentStart(byte)) {
      cursor += 1;
      while (cursor < bytes.length && isIdentPart(bytes[cursor])) cursor += 1;
      tokens.push(token("identifier", bytes, start, cursor));
      continue;
    }
    if (isNumberStart(bytes, cursor)) {
      cursor += 1;
      while (cursor < bytes.length) {
        const current = bytes[cursor];
        if (isDigit(current) || current === 46 || current === 101 || current === 69 || current === 43 || current === 45) {
          cursor += 1;
        } else {
          break;
        }
      }
      tokens.push(token("number", bytes, start, cursor));
      continue;
    }
    if (byte === 123 || byte === 125 || byte === 44 || byte === 58) {
      cursor += 1;
      tokens.push(token("symbol", bytes, start, cursor));
      continue;
    }
    cursor += 1;
    tokens.push(token("other", bytes, start, cursor));
  }
  const significant = tokens.filter((item) => !isTrivia(item));
  let version = null;
  for (let index2 = 0; index2 < significant.length - 1; index2 += 1) {
    if (significant[index2].kind === "identifier" && tokenAscii(significant[index2]) === "FormatVersion") {
      const candidate = significant[index2 + 1];
      if (candidate.kind === "number") {
        const parsed = Number.parseInt(tokenAscii(candidate), 10);
        if (Number.isFinite(parsed)) version = parsed;
      }
      break;
    }
  }
  if (version === null) {
    diagnostics.push(diagnostic("warning", "MDL_MISSING_VERSION", "No FormatVersion value was found.", 0));
  } else if (!SUPPORTED_FORMAT_VERSIONS.includes(version)) {
    diagnostics.push(diagnostic(
      "warning",
      "MDL_UNSUPPORTED_VERSION",
      `Format version ${version} is retained but has no semantic decoder yet.`,
      0,
      { version, supportedVersions: SUPPORTED_FORMAT_VERSIONS }
    ));
  }
  return new MdlDocument(bytes, tokens, diagnostics, version);
}

// src/mdl-compatibility.js
var trivia = /* @__PURE__ */ new Set(["whitespace", "line-comment", "block-comment"]);
var raw = (t) => t?.raw.toString("utf8");
var numeric = (t) => /^(?:[+-]?(?:\d|\.)|[+-]?(?:nan|inf(?:inity)?)$)/i.test(raw(t) || "");
var number = (t) => /^[-+]?nan$/i.test(raw(t)) ? NaN : /^[+]?inf(?:inity)?$/i.test(raw(t)) ? Infinity : /^-inf(?:inity)?$/i.test(raw(t)) ? -Infinity : Number(raw(t));
var spelling = (n) => Number.isNaN(n) ? "nan" : n === Infinity ? "inf" : n === -Infinity ? "-inf" : Object.is(n, -0) ? "-0" : String(n);
function mdlMembers(input) {
  const bytes = import_buffer4.Buffer.from(input), tokens = parseMdl(bytes).tokens.filter((t) => !trivia.has(t.kind));
  for (let i = tokens.length - 2; i >= 0; i--) if (raw(tokens[i]) === "-" && /^inf(?:inity)?$/i.test(raw(tokens[i + 1]))) tokens.splice(i, 2, { ...tokens[i], end: tokens[i + 1].end, raw: import_buffer4.Buffer.from("-inf") });
  let at = 0;
  function list(stop = false) {
    const out = [];
    while (at < tokens.length && (!stop || raw(tokens[at]) !== "}")) {
      if (raw(tokens[at]) === ",") {
        at++;
        continue;
      }
      const first = at, header = [];
      while (at < tokens.length && !["{", "}", ","].includes(raw(tokens[at]))) header.push(tokens[at++]);
      let children = null, open = null, close = null;
      if (raw(tokens[at]) === "{") {
        open = tokens[at++];
        children = list(true);
        close = tokens[at++];
        if (raw(close) !== "}") throw new Error("Unterminated MDL member.");
      } else if (raw(tokens[at]) === "}") {
        if (at === first) break;
      }
      if (raw(tokens[at]) === ",") at++;
      if (at === first) throw new Error("Invalid MDL member.");
      const isStatic = raw(header[0]) === "static", name = raw(header[isStatic ? 1 : 0]) || "";
      out.push({ name, isStatic, header, children, open, close, start: tokens[first].start, end: tokens[at - 1].end, tokens: tokens.slice(first, at) });
    }
    return out;
  }
  return { bytes, members: list() };
}
var valueTokens = (m) => m.tokens.filter((t) => numeric(t));
var numbers = (m) => valueTokens(m).map(number);
function property(m, integer = false, reverse = false) {
  if (!m.children) {
    const string = m.header.find((t) => t.kind === "string");
    return string ? raw(string).slice(1, -1) : number(m.header[m.isStatic ? 2 : 1]);
  }
  const line = m.children.find((c) => ["DontInterp", "Linear", "Hermite", "Bezier"].includes(c.name));
  const Type = integer ? Int32Array : Float32Array;
  if (!line) {
    const v = Type.from(numbers({ ...m, tokens: m.tokens.filter((t) => t.start > m.open.start) }));
    return reverse ? v.reverse() : v;
  }
  const track = { LineType: ["DontInterp", "Linear", "Hermite", "Bezier"].indexOf(line.name), GlobalSeqId: null, Keys: [] };
  for (const c of m.children) {
    if (c.name === "GlobalSeqId") track.GlobalSeqId = property(c);
    else if (c.header.some((t) => raw(t) === ":")) {
      const colon = c.header.find((t) => raw(t) === ":");
      const vals = numbers({ ...c, tokens: c.tokens.filter((t) => t.start > (c.open?.start ?? colon.start)) }), v = Type.from(vals);
      track.Keys.push({ Frame: number(c.header[0]), Vector: reverse ? v.reverse() : v });
    } else if (["InTan", "OutTan"].includes(c.name) && track.Keys.length) {
      const v = Type.from(numbers(c));
      track.Keys.at(-1)[c.name] = reverse ? v.reverse() : v;
    }
  }
  return track;
}
function replace(bytes, edits) {
  const parts = [];
  let p = 0;
  for (const e of edits.sort((a, b) => a.start - b.start || b.end - a.end)) {
    if (e.start < p) continue;
    parts.push(bytes.subarray(p, e.start), import_buffer4.Buffer.from(e.text));
    p = e.end;
  }
  parts.push(bytes.subarray(p));
  return import_buffer4.Buffer.concat(parts);
}
var rootKeys = { Model: "Info", Sequences: "Sequences", GlobalSequences: "GlobalSequences", Textures: "Textures", Materials: "Materials", TextureAnims: "TextureAnims", Geoset: "Geosets", GeosetAnim: "GeosetAnims", Bone: "Bones", Helper: "Helpers", Light: "Lights", Attachment: "Attachments", EventObject: "EventObjects", CollisionShape: "CollisionShapes", ParticleEmitter: "ParticleEmitters", ParticleEmitter2: "ParticleEmitters2", RibbonEmitter: "RibbonEmitters", ParticleEmitterPopcorn: "ParticleEmitterPopcorns", Camera: "Cameras", PivotPoints: "PivotPoints", FaceFX: "FaceFX", BindPose: "BindPoses" };
var containers = { Sequences: "Anim", Textures: "Bitmap", Materials: "Material", TextureAnims: "TVertexAnim" };
function owners(members, model, visit) {
  const indices = {};
  for (const m of members) {
    const key = rootKeys[m.name];
    if (!key) continue;
    if (containers[m.name]) (m.children || []).filter((c) => c.name === containers[m.name]).forEach((c, i) => visitOwner(c, model[key]?.[i], visit));
    else if (["Model", "PivotPoints"].includes(m.name)) visitOwner(m, model[key], visit);
    else if (m.name !== "GlobalSequences") {
      const i = indices[key] || 0;
      indices[key] = i + 1;
      visitOwner(m, model[key]?.[i], visit);
    }
  }
}
function visitOwner(m, owner, visit) {
  if (!owner) return;
  visit(m, owner);
  if (m.name === "Material") (m.children || []).filter((c) => c.name === "Layer").forEach((c, i) => visitOwner(c, owner.Layers?.[i], visit));
  if (m.name === "Geoset") (m.children || []).filter((c) => c.name === "Anim").forEach((c, i) => visitOwner(c, owner.Anims?.[i], visit));
  if (m.name === "ParticleEmitter") {
    for (const c of m.children || []) if (c.name === "Particle") visit(c, owner);
  }
  if (m.name === "Camera") {
    for (const c of m.children || []) if (c.name === "Target") visit(c, { Position: owner.TargetPosition, Translation: owner.TargetTranslation });
  }
}
var layerFlags = { WrapWidth: 4, WrapHeight: 8, Unlit: 256, BackFacesForShadows: 512, AmbientOcclusion: 1024 };
var materialFlags = { SortPrimsNearZ: 8, TwoSided: 2 };
var nodeFlags = { DontInheritTranslation: 1, DontInheritRotation: 2, DontInheritScaling: 4, Billboarded: 8, BillboardedLockX: 16, BillboardedLockY: 32, BillboardedLockZ: 64, CameraAnchored: 128 };
var shaderIds = { shader_sd_legacy: 0, shader_hd_defaultunit: 1, shader_sd_fixedfunction: 2, shader_hd_crystal: 24 };
var extensionFields = /* @__PURE__ */ new Set(["SyncPoint", "SelectionFlags", "ShadowIntensity", "ShadowCasting", "ShadowCastingStart", "ShadowCastingEnd", "QuadraticFalloff", "LinearFalloff", "Damping"]);
var cameraFields = { DOFDistance: "FocusDistance", FocusDistanceKeys: "FocusDistance", FocalLength: "FocalLength", FocalLengthKeys: "FocalLength", FStop: "FStop", FStopKeys: "FStop" };
var fieldVersions = { ShadowIntensity: 1200, ShadowCasting: 1300, ShadowCastingStart: 1300, ShadowCastingEnd: 1300, QuadraticFalloff: 1600, LinearFalloff: 1600, Damping: 1600 };
function prepareCompatibleMdl(input) {
  const tree = mdlMembers(input), edits = [];
  function walk(m, parent) {
    const remove = () => edits.push({ start: m.start, end: m.end, text: "" });
    if (m.name === "Glider") {
      remove();
      return;
    }
    if (m.name === "Visibility" && m.isStatic && !m.children) {
      remove();
      return;
    }
    if (parent === "ParticleEmitter" && ["Path", "LifeSpan", "InitVelocity"].includes(m.name)) {
      edits.push({ start: m.start, end: m.end, text: `Particle { ${tree.bytes.subarray(m.start, m.end).toString("utf8")} }` });
      return;
    }
    if (m.name === "DontInherit") {
      remove();
      return;
    }
    if (m.name in nodeFlags && m.name.startsWith("DontInherit")) {
      remove();
      return;
    }
    if (m.name === "SortPrimitives") edits.push({ start: m.header[0].start, end: m.header[0].end, text: "SortPrimsFarZ" });
    if (m.name === "LevelOfDetailName") edits.push({ start: m.header[0].start, end: m.header[0].end, text: "Name" });
    if (m.name === "EmitterUsesMdl" || m.name === "EmitterUsesTga") edits.push({ start: m.header[0].start, end: m.header[0].end, text: m.name === "EmitterUsesMdl" ? "EmitterUsesMDL" : "EmitterUsesTGA" });
    if (extensionFields.has(m.name) || parent === "Layer" && m.name in layerFlags || parent === "Material" && (m.name in materialFlags || m.name === "Unfogged") || m.name === "PopcornScaling") {
      remove();
      return;
    }
    if (parent === "Layer" && m.name === "Shader") {
      const name = property(m).toLowerCase();
      if (!(name in shaderIds)) throw new Error(`Unknown layer shader ${name}.`);
      edits.push({ start: m.start, end: m.end, text: `ShaderTypeId ${shaderIds[name]},` });
      return;
    }
    if (parent === "RibbonEmitter" && m.name === "Color" && !m.isStatic && m.children?.some((c) => ["DontInterp", "Linear", "Hermite", "Bezier"].includes(c.name))) {
      remove();
      return;
    }
    if (parent === "Camera" && (m.name === "Visibility" || m.name in cameraFields)) {
      remove();
      return;
    }
    if (m.name === "Plane" || m.name === "Cylinder") edits.push({ start: m.start, end: m.end, text: "Box," });
    if (m.name === "SkinWeights" && m.children) {
      const vals = numbers({ ...m, tokens: m.tokens.filter((t) => t.start > m.open.start) }), rows = [];
      if (vals.length % 8) throw new Error("SkinWeights requires eight values per vertex.");
      for (let i = 0; i < vals.length; i += 8) rows.push(`{ ${vals.slice(i, i + 8).map((v) => v & 255).join(", ")} },`);
      edits.push({ start: m.open.end, end: m.close.start, text: rows.join("\n") });
      return;
    }
    if (m.name === "TextureID") {
      const designator = m.tokens.findIndex((t) => raw(t) === "<");
      if (designator >= 0) {
        const slot = number(m.tokens[designator + 2]), key = TEXTURE_SLOTS[slot];
        if (!key) throw new Error(`Unsupported texture slot ${slot}.`);
        const nameToken = m.header[m.isStatic ? 1 : 0];
        edits.push({ start: nameToken.start, end: nameToken.end, text: key });
        edits.push({ start: m.tokens[designator].start, end: m.tokens[designator + 2].end, text: "" });
      }
    }
    for (const c of m.children || []) walk(c, m.name);
  }
  for (const m of tree.members) walk(m, null);
  for (const t of parseMdl(tree.bytes).tokens) if (t.kind === "line-comment" || t.kind === "block-comment") edits.push({ start: t.start, end: t.end, text: " " });
  for (const t of parseMdl(tree.bytes).tokens) if (t.kind !== "string" && /^[-+]?(?:nan|inf(?:inity)?)$/i.test(raw(t))) edits.push({ start: t.start, end: t.end, text: "0" });
  return { text: replace(tree.bytes, edits).toString("utf8"), restore(model) {
    restoreValues(tree.members, model);
  } };
}
function restoreValues(members, model) {
  model.Gliders = members.filter((m) => m.name === "Glider").map((m) => ({ GeosetId: property(m.children.find((c) => c.name === "GeosetId")) }));
  owners(members, model, (m, o) => {
    if (m.name === "PivotPoints") return;
    if (m.name === "Anim" && !m.header.some((t) => t.kind === "string")) {
      for (const key of ["Alpha", "Color", "Flags", "GeosetId"]) if (!m.children.some((c) => c.name === key)) delete o[key];
    }
    if (m.name === "ParticleEmitterPopcorn") o.Flags &= ~393216;
    let uv = 0;
    for (const c of m.children || []) {
      let key = c.name === "LevelOfDetailName" ? "Name" : c.name;
      if (["FilterMode", "Shape", "LightType", "Groups"].includes(key)) continue;
      if (key === "Faces" && m.name === "Geoset") {
        const groups = (c.children || []).flatMap((x) => (x.children || []).filter((y) => y.children));
        o.PrimitiveTypes = Uint32Array.from(groups, () => 4);
        o.PrimitiveCounts = Uint32Array.from(groups, (g) => numbers(g).length);
        continue;
      }
      if (key === "TextureID") {
        const j = c.tokens.findIndex((t) => raw(t) === "<");
        if (j >= 0) key = TEXTURE_SLOTS[number(c.tokens[j + 2])];
      }
      if (m.name === "Layer" && key in layerFlags) {
        o.Shading |= layerFlags[key];
        continue;
      }
      if (m.name === "Material" && key in materialFlags) {
        o.RenderMode |= materialFlags[key];
        continue;
      }
      if (m.name === "Material" && key === "Unfogged") {
        o.Unfogged = true;
        continue;
      }
      if (m.name === "Light" && key === "ShadowCasting") {
        o.ShadowCasting = 1;
        continue;
      }
      if (m.name === "Camera" && key in cameraFields) {
        const value = property(c);
        o[cameraFields[key]] = typeof value === "number" ? { LineType: 0, GlobalSeqId: null, Keys: [{ Frame: 0, Vector: Float32Array.of(value) }] } : value;
        continue;
      }
      if ("ObjectId" in o && key in nodeFlags) {
        o.Flags |= nodeFlags[key];
        delete o[key];
        continue;
      }
      if (key === "DontInherit") {
        for (const flag of c.children || []) o.Flags |= nodeFlags["DontInherit" + flag.name] || 0;
        continue;
      }
      if (m.name === "ParticleEmitterPopcorn" && key === "Unfogged") {
        o.Flags |= 131072;
        continue;
      }
      if (m.name === "ParticleEmitterPopcorn" && key === "PopcornScaling") {
        o.Flags |= 262144;
        continue;
      }
      if (key === "Plane" || key === "Cylinder") {
        o.Shape = key === "Plane" ? 1 : 3;
        continue;
      }
      if (key === "SkinWeights") {
        o.SkinWeights = (model.Version >= 1400 ? Uint16Array : Uint8Array).from(numbers({ ...c, tokens: c.tokens.filter((t) => t.start > c.open.start) }));
        continue;
      }
      if (["Interval", "LifeSpanUVAnim", "DecayUVAnim", "TailUVAnim", "TailDecayUVAnim"].includes(key)) {
        o[key] = Uint32Array.from(numbers(c));
        continue;
      }
      if (key === "TVertices") {
        o.TVertices[uv++] = property(c);
        continue;
      }
      if (["Vertices", "Normals", "Tangents", "VertexGroup", "EventTrack"].includes(key)) {
        const Type = key === "EventTrack" ? Int32Array : key === "VertexGroup" ? Uint8Array : Float32Array;
        o[key] = Type.from(numbers({ ...c, tokens: c.tokens.filter((t) => t.start > c.open.start) }));
        continue;
      }
      if (extensionFields.has(key) || key in o && (typeof o[key] === "number" || typeof o[key] === "string" || ArrayBuffer.isView(o[key]) || o[key]?.Keys) || key === "Visibility" && "ObjectId" in o || ["Color", "Visibility"].includes(key) && ["RibbonEmitter", "Camera"].includes(m.name)) {
        if (["ObjectId", "Parent"].includes(key) || !c.header[1] && !c.children) continue;
        const reverse = ["Color", "AmbColor"].includes(key) && m.name !== "ParticleEmitterPopcorn";
        const previous = o[key], value = property(c, TEXTURE_SLOTS.includes(key) || key === "TextureSlot", reverse);
        if (value?.Keys && previous != null && !previous.Keys && (m.children || []).some((x) => x !== c && x.name === c.name && x.isStatic)) (o._MdxDefaults ||= {})[key] = previous;
        o[key] = value;
      }
    }
    if (m.name === "Geoset" && o.SelectionFlags != null) o.Unselectable = !!(o.SelectionFlags & 4);
  });
  for (const e of model.EventObjects || []) e.EventTrack = Int32Array.from(e.EventTrack);
}
var tuple = (v, reverse = false) => `{ ${Array.from(v, spelling)[reverse ? "reverse" : "slice"]().join(", ")} }`;
var keyValue = (v, reverse) => v.length === 1 ? spelling(v[0]) : tuple(v, reverse);
function mdlProperty(name, value, reverse = false, isStatic = false) {
  if (value?.Keys) {
    const rows = [["DontInterp", "Linear", "Hermite", "Bezier"][value.LineType] + ","];
    if (value.GlobalSeqId != null) rows.push(`GlobalSeqId ${value.GlobalSeqId},`);
    for (const k of value.Keys) {
      rows.push(`${k.Frame}: ${keyValue(k.Vector, reverse)},`);
      if (value.LineType >= 2) for (const field of ["InTan", "OutTan"]) rows.push(`${field} ${keyValue(k[field], reverse)},`);
    }
    return `${name} ${value.Keys.length} {
${rows.join("\n")}
}`;
  }
  return `${isStatic ? "static " : ""}${name} ${typeof value === "string" ? `"${value}"` : typeof value === "number" ? spelling(value) : tuple(value, reverse)},`;
}
function finishCompatibleMdl(input, model) {
  const tree = mdlMembers(input), edits = [];
  owners(tree.members, model, (m, o) => {
    const extra = [];
    let uv = 0;
    if (m.name === "PivotPoints") {
      edits.push({ start: m.open.end, end: m.close.start, text: "\n" + o.map((v) => tuple(v) + ",").join("\n") + "\n" });
      return;
    }
    if (m.name === "BindPose") {
      const matrices = m.children.find((c) => c.name === "Matrices");
      if (matrices) edits.push({ start: matrices.open.end, end: matrices.close.start, text: "\n" + o.Matrices.map((v) => tuple(v) + ",").join("\n") + "\n" });
      return;
    }
    const represented = /* @__PURE__ */ new Set();
    for (const c of m.children || []) {
      const key = c.name;
      represented.add(key);
      let value = o[key];
      if (m.name === "Material" && key === "SortPrimsFarZ") {
        edits.push({ start: c.start, end: c.end, text: "SortPrimitives," });
        continue;
      }
      if (key === "Faces" && o.PrimitiveCounts && Array.from(o.PrimitiveCounts).reduce((a, n) => a + n, 0) === o.Faces.length) {
        let at = 0;
        const groups = Array.from(o.PrimitiveCounts, (n) => {
          const row = tuple(o.Faces.subarray(at, at + n));
          at += n;
          return row + ",";
        });
        edits.push({ start: c.start, end: c.end, text: `Faces ${groups.length} ${o.Faces.length} { Triangles { ${groups.join("\n")} } }` });
        continue;
      }
      if (key === "TVertices") value = o.TVertices[uv++];
      if (key === "SegmentColor" && o.SegmentColor) {
        edits.push({ start: c.open.end, end: c.close.start, text: o.SegmentColor.map((v) => mdlProperty("Color", v, true)).join("\n") });
        continue;
      }
      if (key === "TVertices" && !value) {
        edits.push({ start: c.start, end: c.end, text: "" });
        continue;
      }
      if (key === "DontInherit") {
        edits.push({ start: c.start, end: c.end, text: (c.children || []).map((x) => `DontInherit { ${x.name} },`).join("\n") });
        continue;
      }
      if (["Vertices", "Normals", "Tangents", "TVertices", "VertexGroup", "EventTrack", "SkinWeights"].includes(key) && ArrayBuffer.isView(value)) {
        const width = { Vertices: 3, Normals: 3, Tangents: 4, TVertices: 2, VertexGroup: 1, EventTrack: 1, SkinWeights: 8 }[key], rows = [];
        for (let i = 0; i < value.length; i += width) rows.push(width === 1 ? spelling(value[i]) + "," : tuple(value.subarray(i, i + width)) + ",");
        edits.push({ start: c.open.end, end: c.close.start, text: "\n" + rows.join("\n") + "\n" });
        continue;
      }
      if (value == null || typeof value === "boolean" || ["ObjectId", "Parent", "Flags", "Shape", "LightType", "FilterMode", "RenderMode", "Shading", "Rows", "Columns", "Faces", "Groups"].includes(key)) continue;
      if (typeof value === "number" || typeof value === "string" || ArrayBuffer.isView(value) || value.Keys) {
        const reverse = ["Color", "AmbColor"].includes(key) && m.name !== "ParticleEmitterPopcorn";
        const baseline = o._MdxDefaults?.[key];
        const prefix = value.Keys && baseline != null ? mdlProperty(key, baseline, reverse, true) + "\n" : "";
        edits.push({ start: c.start, end: c.end, text: prefix + mdlProperty(m.name === "Geoset" && key === "Name" ? "LevelOfDetailName" : key, value, reverse, c.isStatic) });
      }
    }
    for (const key of extensionFields) if (o[key] != null && !represented.has(key) && key !== "ShadowCasting" && model.Version >= (fieldVersions[key] || 0)) {
      const value = key === "SelectionFlags" ? (o.SelectionFlags & ~4 | (o.Unselectable ? 4 : 0)) >>> 0 : o[key];
      extra.push(mdlProperty(key, value, false, !!value?.Keys ? false : ["ShadowIntensity", "ShadowCastingStart", "ShadowCastingEnd", "QuadraticFalloff", "LinearFalloff", "Damping"].includes(key)));
    }
    if (m.name === "Light" && o.ShadowCasting && model.Version >= 1300) extra.push("ShadowCasting,");
    if (m.name === "Camera") {
      for (const key of ["FocusDistance", "FocalLength", "FStop"]) if (o[key]) extra.push(mdlProperty(key + "Keys", o[key]));
    }
    if (m.name === "Layer") {
      for (const [key, bit] of Object.entries(layerFlags)) if (o.Shading & bit) extra.push(key + ",");
    }
    if (m.name === "Material") {
      for (const [key, bit] of Object.entries(materialFlags)) if (o.RenderMode & bit) extra.push(key + ",");
    }
    if (m.name === "Material" && o.Unfogged) extra.push("Unfogged,");
    if ("ObjectId" in o) {
      for (const [key, bit] of Object.entries(nodeFlags)) if (o.Flags & bit && !represented.has(key) && !key.startsWith("DontInherit")) extra.push(key + ",");
    }
    if (m.name === "ParticleEmitterPopcorn") {
      for (const c of m.children || []) if (c.name === "Unfogged") edits.push({ start: c.start, end: c.end, text: "" });
      if (o.Flags & 131072) extra.push("Unfogged,");
      if (o.Flags & 262144) extra.push("PopcornScaling,");
      for (const key of ["LifeSpan", "EmissionRate", "Speed", "Alpha"]) if (o[key] != null && !represented.has(key)) extra.push(mdlProperty(key, o[key], false, true));
    }
    if (m.name === "CollisionShape" && [1, 3].includes(o.Shape)) {
      const c = m.children.find((c2) => ["Box", "Sphere"].includes(c2.name));
      if (c) edits.push({ start: c.start, end: c.end, text: o.Shape === 1 ? "Plane," : "Cylinder," });
      if (o.Shape === 3 && !represented.has("BoundsRadius")) extra.push(mdlProperty("BoundsRadius", o.BoundsRadius));
    }
    for (const key of ["Color", "Visibility"]) if (o[key]?.Keys && !represented.has(key)) extra.push(mdlProperty(key, o[key], key === "Color"));
    if (typeof o.Visibility === "number" && !represented.has("Visibility")) extra.push(mdlProperty("Visibility", o.Visibility, false, true));
    if (m.name === "GeosetAnim" && o.Flags & 2 && !represented.has("Color") && o.Color) extra.push(mdlProperty("Color", o.Color, true, true));
    if (m.name === "Light") {
      for (const key of ["Color", "AmbColor"]) if (o[key] && !represented.has(key)) extra.push(mdlProperty(key, o[key], true, true));
    }
    for (const key of ["BoundsRadius", "MinimumExtent", "MaximumExtent"]) if (o[key] != null && !represented.has(key)) extra.push(mdlProperty(key, o[key]));
    if (extra.length) edits.push({ start: m.close.start, end: m.close.start, text: "\n" + extra.join("\n") + "\n" });
  });
  const gliders = (model.Gliders || []).map((g) => `
Glider { GeosetId ${g.GeosetId}, }
`).join("");
  return import_buffer4.Buffer.concat([replace(tree.bytes, edits), import_buffer4.Buffer.from(gliders)]);
}
function formatGeneratedMdl(input) {
  const { bytes, members } = mdlMembers(input);
  function render(member, depth) {
    const indent = "	".repeat(depth);
    if (!member.children) return indent + bytes.subarray(member.start, member.end).toString("utf8").trim();
    const header = bytes.subarray(member.start, member.open.start).toString("utf8").trim();
    const suffix = bytes.subarray(member.close.end, member.end).toString("utf8").trim();
    const inline = member.name === "DontInherit" || !["VertexGroup", "EventTrack", "GlobalSequences"].includes(member.name) && member.children.length > 0 && member.children.every((child) => !child.children && child.header.every(numeric));
    const prefix = header ? header + " " : "";
    if (inline) return indent + prefix + "{ " + member.children.map((child) => render(child, 0)).join(" ") + " }" + suffix;
    return indent + prefix + "{\n" + member.children.map((child) => render(child, depth + 1)).join("\n") + (member.children.length ? "\n" : "") + indent + "}" + suffix;
  }
  return import_buffer4.Buffer.from(members.map((member) => render(member, 0)).join("\n") + "\n");
}
function readMdlPivotPoints(input) {
  const m = mdlMembers(input).members[0], values = numbers({ ...m, tokens: m.tokens.filter((t) => t.start > m.open.start) }), count = number(m.header[1]);
  if (values.length !== count * 3) throw new Error("PivotPoints count does not match its coordinates.");
  return Array.from({ length: count }, (_, i) => Float32Array.from(values.slice(i * 3, i * 3 + 3)));
}

// src/node-id-order.js
var SERIALIZED_NODE_COLLECTIONS = Object.freeze([
  "Bones",
  "Lights",
  "Helpers",
  "Attachments",
  "ParticleEmitters",
  "ParticleEmitters2",
  "ParticleEmitterPopcorns",
  "RibbonEmitters",
  "EventObjects",
  "CollisionShapes"
]);
var serializedNodes = (model) => SERIALIZED_NODE_COLLECTIONS.flatMap((collection) => model[collection] || []);
function canonicalizeSerializedNodeOrder(model, { preserveUnusedPivots = false } = {}) {
  const nodes = serializedNodes(model), ids = /* @__PURE__ */ new Set();
  for (const node of nodes) {
    if (!Number.isInteger(node?.ObjectId) || node.ObjectId < 0 || ids.has(node.ObjectId)) throw Error("The model has invalid or duplicate node object IDs.");
    ids.add(node.ObjectId);
  }
  const map = new Map(nodes.map((node, index2) => [node.ObjectId, index2]));
  const parentIds = nodes.map((node) => {
    if (node.Parent == null || node.Parent === -1) return node.Parent;
    if (!map.has(node.Parent)) throw Error(`Node ${node.Name || node.ObjectId} references missing parent ${node.Parent}.`);
    return map.get(node.Parent);
  });
  const pivots = nodes.map((node) => {
    const pivot = model.PivotPoints?.[node.ObjectId] || node.PivotPoint;
    if (!pivot || pivot.length !== 3 || Array.from(pivot).some((value) => !Number.isFinite(value))) throw Error(`Node ${node.Name || node.ObjectId} has an invalid pivot reference.`);
    return pivot;
  });
  if (preserveUnusedPivots) model.PivotPoints?.forEach((pivot, index2) => {
    if (!ids.has(index2)) pivots.push(pivot);
  });
  const groupPlans = (model.Geosets || []).map((geoset, geosetIndex) => (geoset.Groups || []).map((group) => group.map((id) => {
    if (!map.has(id)) throw Error(`Geoset ${geosetIndex} references missing node ${id}.`);
    return map.get(id);
  })));
  const skinPlans = (model.Geosets || []).map((geoset, geosetIndex) => {
    if (!geoset.SkinWeights?.length) return null;
    const weights = new geoset.SkinWeights.constructor(geoset.SkinWeights), maximum = model.Version >= 1400 ? 65535 : 255;
    for (let offset = 0; offset < weights.length; offset += 8) for (let influence = 0; influence < 4; influence++) {
      if (!weights[offset + 4 + influence]) {
        weights[offset + influence] = 0;
        continue;
      }
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
    const matrices = nodes.map((node) => {
      const matrix = pose.Matrices[node.ObjectId];
      if (!matrix || node.ObjectId >= cameraStart) throw Error(`Bind pose ${poseIndex} is missing matrix ${node.ObjectId}.`);
      return matrix;
    });
    return matrices.concat(pose.Matrices.slice(cameraStart));
  });
  nodes.forEach((node, index2) => {
    node.ObjectId = index2;
    node.Parent = parentIds[index2];
    node.PivotPoint = pivots[index2];
  });
  for (let index2 = 0; index2 < (model.Geosets || []).length; index2++) {
    model.Geosets[index2].Groups = groupPlans[index2];
    model.Geosets[index2].TotalGroupsCount = groupPlans[index2].reduce((total, group) => total + group.length, 0);
    if (skinPlans[index2]) model.Geosets[index2].SkinWeights = skinPlans[index2];
  }
  (model.BindPoses || []).forEach((pose, index2) => {
    pose.Matrices = bindPosePlans[index2];
  });
  model.PivotPoints = pivots;
  model.Nodes = [];
  nodes.forEach((node) => {
    model.Nodes[node.ObjectId] = node;
  });
  return map;
}

// src/geoset-animation-defaults.js
var hasGeosetColorTrack = (anim) => Array.isArray(anim?.Color?.Keys);
var geosetTintEnabled = (anim) => !!(anim?.Flags & 2);
var neutralGeosetColor = (color2) => color2 == null || (Array.isArray(color2) || ArrayBuffer.isView(color2)) && color2.length === 3 && Array.from(color2).every((n) => n === 1);
var defaultGeosetColor = (anim) => !geosetTintEnabled(anim) && !hasGeosetColorTrack(anim) && neutralGeosetColor(anim?.Color);
var equivalentGeosetColorDefaults = (a, b) => defaultGeosetColor(a) && defaultGeosetColor(b);
function prepareGeosetAnimationColors(animations, format) {
  return animations.map((anim) => {
    if (defaultGeosetColor(anim)) return { ...anim, Color: format === "mdl" ? null : new Float32Array([1, 1, 1]) };
    return anim;
  });
}
function geosetColorExportIssues(animations, format) {
  const issues = [];
  for (const [i, anim] of animations.entries()) {
    const path = `GeosetAnims[${i}].Color`;
    if (!hasGeosetColorTrack(anim) && !defaultGeosetColor(anim) && (!(anim.Color instanceof Float32Array) || anim.Color.length !== 3 || !anim.Color.every(Number.isFinite))) {
      issues.push(`${path}: invalid static color; expected three finite RGB values.`);
    } else if (format === "mdl" && !geosetTintEnabled(anim) && !defaultGeosetColor(anim)) {
      issues.push(`${path}: ${hasGeosetColorTrack(anim) ? "disabled tint with a color track" : "dormant nonwhite color"} cannot be represented in MDL without enabling tint; save as MDX to preserve it.`);
    }
  }
  return issues;
}

// src/save-equivalence.js
var ignored = /* @__PURE__ */ new Set(["Nodes", "PivotPoint", "TotalGroupsCount", "NumGeosets", "NumGeosetAnims", "NumBones", "NumHelpers", "NumLights", "NumAttachments", "NumEvents", "NumParticleEmitters", "NumParticleEmitters2", "NumRibbonEmitters"]);
var defaults = { AnimationFile: "", Path: "", PriorityPlane: 0, Gravity: 0, SyncPoint: 0, Flags: 0, SelectionFlags: 0, Variant: 0, Shader: "", Name: "", LevelOfDetail: 0, Alpha: 1, EmissiveGain: 1, FresnelOpacity: 0, FresnelTeamColor: 0, ShaderTypeId: 0, ShadowIntensity: 0, ShadowCasting: 0, ShadowCastingStart: 0, ShadowCastingEnd: 0, QuadraticFalloff: 5e-4, LinearFalloff: 0, Damping: 1e-5, _MdxTextureId: 0 };
var equalNumber = (a, b) => Object.is(a, b) || Object.is(Math.fround(a), Math.fround(b));
var integerFields = /* @__PURE__ */ new Set(["Version", "Frame", "Flags", "RenderMode", "Shading", "SelectionFlags", "SyncPoint", "ObjectId", "Parent", "GeosetId", "GeosetAnimId", "MaterialID", "TextureID", "NormalTextureID", "ORMTextureID", "EmissiveTextureID", "TeamColorTextureID", "ReflectionsTextureID", "TextureSlot", "TVertexAnimId", "CoordId", "GlobalSeqId", "LineType", "AttachmentID", "ReplaceableId", "FilterMode", "LightType", "Shape", "Rows", "Columns", "PriorityPlane", "SelectionGroup", "LevelOfDetail", "ShaderTypeId", "Variant", "BlendTime", "_MdxTextureId"]);
function absentEquivalent(value, key) {
  if (value == null) return true;
  if (key in defaults) return typeof value === "number" ? equalNumber(value, defaults[key]) : value === defaults[key];
  if (key === "FresnelColor") return Array.from(value).every((n) => n === 1);
  return false;
}
function modelDifferenceReport(expected, actual, { keys = Object.keys(expected), limit = 12 } = {}) {
  const differences = [];
  let total = 0;
  const add = (path) => {
    total++;
    if (differences.length < limit) differences.push(path);
  };
  function walk(a, b, path, key, integer = false) {
    if (ignored.has(key)) return;
    if (key === "_MdxSlots") return;
    if (key === "Visibility" && typeof a === "number" && b?.Keys && b.LineType === 0 && b.GlobalSeqId == null) {
      const constant = b.Keys.length > 0 && b.Keys.every((k) => k.Vector.length === 1 && equalNumber(a, k.Vector[0]));
      const covers = (expected.Sequences || []).every((s) => b.Keys.some((k) => k.Frame >= s.Interval[0] && k.Frame <= s.Interval[1]));
      if (constant && covers) return;
    }
    if (a == null || b == null) {
      if (a == null && b == null || absentEquivalent(a ?? b, key)) return;
      add(path);
      return;
    }
    if (typeof a === "number" && typeof b === "number") {
      if (integer || integerFields.has(key) ? a !== b : !equalNumber(a, b)) add(path);
      return;
    }
    if (typeof a !== "object" || typeof b !== "object") {
      if (a !== b) add(path);
      return;
    }
    if (ArrayBuffer.isView(a) || Array.isArray(a)) {
      if (a.length !== b.length) {
        add(path + ".length");
        return;
      }
      const intArray = ArrayBuffer.isView(a) && !(a instanceof Float32Array) && !(a instanceof Float64Array);
      for (let i = 0; i < a.length; i++) walk(a[i], b[i], `${path}[${i}]`, String(i), intArray);
      return;
    }
    for (const k of /* @__PURE__ */ new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (k === "Color" && /^GeosetAnims\[\d+\]$/.test(path) && equivalentGeosetColorDefaults(a, b)) continue;
      if (k === "BoundsRadius" && "Shape" in a && a.Shape < 2) continue;
      if (k === "Flags" && "NonLooping" in a) {
        walk((a.Flags || 0) & ~1, (b.Flags || 0) & ~1, path + ".Flags", k);
        continue;
      }
      if (k === "SelectionFlags") {
        walk((a[k] || 0) & ~4, (b[k] || 0) & ~4, path + "." + k, k);
        continue;
      }
      if ((k === "PrimitiveTypes" || k === "PrimitiveCounts") && (!a[k] || !b[k])) {
        const types = a.PrimitiveTypes || b.PrimitiveTypes, counts = a.PrimitiveCounts || b.PrimitiveCounts;
        if (types?.length === 1 && types[0] === 4 && counts?.length === 1 && counts[0] === (a.Faces || b.Faces)?.length) continue;
      }
      if (k === "_MdxDefaults") {
        for (const field of Object.keys(a[k] || {})) walk(a[k][field], b[k]?.[field], `${path}.${k}.${field}`, field);
        continue;
      }
      walk(a[k], b[k], `${path}.${k}`, k);
    }
  }
  for (const key of keys) walk(expected[key], actual[key], key, key);
  return { total, differences };
}
function formatSaveIssues(label, issues, limit = 12) {
  return `${label} (${issues.length} issue${issues.length === 1 ? "" : "s"}): ${issues.slice(0, limit).join(" ")}${issues.length > limit ? ` ${issues.length - limit} more.` : ""}`;
}
function assertModelEquivalent(expected, actual, options) {
  const { total, differences } = modelDifferenceReport(expected, actual, options);
  if (total) {
    const start = performance.now();
    const error = new Error(`Save verification failed: serialization changed ${total} field${total === 1 ? "" : "s"}: ${differences.join(", ")}${total > differences.length ? `; ${total - differences.length} more` : ""}.`);
    if (options?.timings) options.timings.errorFormattingMs = performance.now() - start;
    throw error;
  }
}

// src/record-preservation.js
var import_buffer5 = require("buffer");
var fingerprint = (value) => JSON.stringify(value, (key, v) => key === "PivotPoint" ? void 0 : ArrayBuffer.isView(v) ? Array.from(v) : typeof v === "number" && !Number.isFinite(v) ? String(v) : v);
var recordTags = /* @__PURE__ */ new Set(["SEQS", "TEXS", "MTLS", "TXAN", "GEOS", "GEOA", "BONE", "HELP", "ATCH", "LITE", "PREM", "PRE2", "RIBB", "CORN", "CAMS", "CLID", "EVTS", "PIVT", "GLBS"]);
function matches(before, after) {
  const pool = /* @__PURE__ */ new Map();
  before.forEach((v, i) => {
    const f = fingerprint(v);
    if (!pool.has(f)) pool.set(f, []);
    pool.get(f).push(i);
  });
  return after.map((v) => pool.get(fingerprint(v))?.shift());
}
function preserveMdxRecords(original, generated, before, after, sections) {
  const oldBytes = import_buffer5.Buffer.from(original), newBytes = import_buffer5.Buffer.from(generated), oldChunks = new Map(parseMdx(oldBytes).chunks.map((c) => [c.tag, c]));
  const keys = new Map(Object.entries(sections).map(([key, [, tag]]) => [tag, key]));
  return import_buffer5.Buffer.concat([import_buffer5.Buffer.from("MDLX"), ...parseMdx(newBytes).chunks.map((c) => {
    const key = keys.get(c.tag), old = oldChunks.get(c.tag), payload = newBytes.subarray(c.payloadOffset, c.payloadOffset + c.declaredSize);
    if (!recordTags.has(c.tag) || !old || !Array.isArray(before[key]) || !Array.isArray(after[key])) return mdxChunk(c.tag, payload);
    const previous = mdxRecords(oldBytes.subarray(old.payloadOffset, old.payloadOffset + old.declaredSize), c.tag), fresh = mdxRecords(payload, c.tag), indices = matches(before[key], after[key]);
    if (previous.length !== before[key].length || fresh.length !== after[key].length) throw new Error(`Cannot match ${c.tag} source records safely.`);
    return mdxChunk(c.tag, import_buffer5.Buffer.concat(fresh.map((b, i) => indices[i] === void 0 ? b : previous[indices[i]])));
  })]);
}
var containers2 = { Sequences: "Anim", Textures: "Bitmap", Materials: "Material", TextureAnims: "TVertexAnim" };
function preserveMdlRecords(original, generated, before, after, sections) {
  const oldTree = mdlMembers(original), newTree = mdlMembers(generated), edits = [];
  for (const [key, [name]] of Object.entries(sections)) {
    if (!Array.isArray(before[key]) || !Array.isArray(after[key]) || ["PivotPoints", "GlobalSequences", "BindPoses"].includes(key)) continue;
    const collect = (tree) => tree.members.filter((m) => m.name === name).flatMap((m) => containers2[name] ? (m.children || []).filter((c) => c.name === containers2[name]) : [m]);
    const previous = collect(oldTree), fresh = collect(newTree), indices = matches(before[key], after[key]);
    if (previous.length !== before[key].length || fresh.length !== after[key].length) continue;
    fresh.forEach((m, i) => {
      if (indices[i] !== void 0) {
        const old = previous[indices[i]];
        edits.push({ start: m.start, end: m.end, bytes: oldTree.bytes.subarray(old.start, old.end) });
      }
    });
  }
  const parts = [];
  let p = 0;
  for (const e of edits.sort((a, b) => a.start - b.start)) {
    parts.push(newTree.bytes.subarray(p, e.start), e.bytes);
    p = e.end;
  }
  parts.push(newTree.bytes.subarray(p));
  return import_buffer5.Buffer.concat(parts);
}

// src/selection-history.js
var index = (value) => Number.isInteger(value) && value >= 0 && value <= 4294967295;
function validSelectionHistory(value) {
  const validIds = (values) => values instanceof Uint32Array;
  const onlyKeys = (value2, keys) => Object.keys(value2).every((key) => keys.includes(key));
  const validMap = (value2) => !!value2 && typeof value2 === "object" && !Array.isArray(value2) && Object.entries(value2).every(([gi, values]) => index(Number(gi)) && validIds(values));
  const validSnapshot = (value2) => !!value2 && validIds(value2.selectable) && validMap(value2.selection) && validMap(value2.hidden) && (value2.activeGeoset === -1 || index(value2.activeGeoset)) && index(value2.uvSet) && (value2.selectedNodeIds === void 0 || validIds(value2.selectedNodeIds)) && onlyKeys(value2, ["selectable", "selection", "hidden", "activeGeoset", "uvSet", "selectedNodeIds"]);
  return value?.version === 1 && validSnapshot(value.before) && validSnapshot(value.after) && onlyKeys(value, ["version", "before", "after"]);
}

// src/history-store.js
var DEFAULT_HISTORY_OPTIONS = Object.freeze({ budgetBytes: 512 * 1024 * 1024, maxSteps: 1e4 });
var copy = (value) => structuredClone(value);
var forbidden = /* @__PURE__ */ new Set(["__proto__", "prototype", "constructor"]);
var own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
function byteView(value) {
  return value instanceof ArrayBuffer ? new Uint8Array(value) : new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
}
function retainedBytes(value, seen = /* @__PURE__ */ new Set()) {
  if (value == null) return 8;
  if (typeof value === "string") return 24 + value.length * 2;
  if (typeof value !== "object") return 16;
  if (seen.has(value)) return 8;
  seen.add(value);
  if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) return 80 + value.byteLength;
  return 64 + Object.entries(value).reduce((sum2, [key, child]) => sum2 + 16 + key.length * 2 + retainedBytes(child, seen), 0);
}
function createChanges(before, after, { ignore = () => false } = {}) {
  const changes = [];
  const active = /* @__PURE__ */ new Set();
  const path = [];
  function same(left, right, path2) {
    if (ignore(path2) || Object.is(left, right)) return true;
    if (!left || !right || typeof left !== "object" || typeof right !== "object" || left.constructor !== right.constructor) return false;
    if (ArrayBuffer.isView(left) || left instanceof ArrayBuffer) {
      if (left.byteLength !== right.byteLength) return false;
      if (equalTypedValues(left, right)) return true;
      const a = byteView(left), b = byteView(right);
      for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
      return true;
    }
    if (Array.isArray(left) && left.length !== right.length) return false;
    const keys = Object.keys(left);
    return keys.length === Object.keys(right).length && keys.every((key) => own(right, key) && same(left[key], right[key], [...path2, key]));
  }
  function replace2(left, right, leftExists, rightExists) {
    changes.push({ kind: "value", path: [...path], beforeExists: leftExists, afterExists: rightExists, before: copy(left), after: copy(right) });
  }
  function child(left, right, key, existsBefore, existsAfter) {
    if (forbidden.has(key)) throw new Error(`Unsafe document property: ${key}.`);
    if (existsBefore === existsAfter && Object.is(left[key], right[key])) return;
    path.push(key);
    visit(left[key], right[key], existsBefore, existsAfter);
    path.pop();
  }
  function visit(left, right, leftExists = true, rightExists = true) {
    if (ignore(path) || leftExists === rightExists && Object.is(left, right)) return;
    if (!leftExists || !rightExists || !left || !right || typeof left !== "object" || typeof right !== "object" || left.constructor !== right.constructor) {
      replace2(left, right, leftExists, rightExists);
      return;
    }
    if (ArrayBuffer.isView(left) || left instanceof ArrayBuffer) {
      if (left.byteLength !== right.byteLength) {
        replace2(left, right, leftExists, rightExists);
        return;
      }
      if (equalTypedValues(left, right)) return;
      const a = byteView(left), b = byteView(right);
      let start = -1, last = -1;
      const flush = () => {
        if (start >= 0) changes.push({ kind: "bytes", path: [...path], offset: start, before: a.slice(start, last + 1), after: b.slice(start, last + 1) });
      };
      for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) {
          if (start < 0) start = i;
          last = i;
        } else if (start >= 0 && i - last > 32) {
          flush();
          start = -1;
        }
      }
      flush();
      return;
    }
    if (Array.isArray(left) && left.length !== right.length) {
      let start = 0, end = 0;
      while (start < Math.min(left.length, right.length) && same(left[start], right[start], [...path, String(start)])) start++;
      while (end < Math.min(left.length, right.length) - start && same(left[left.length - end - 1], right[right.length - end - 1], [...path, String(left.length - end - 1)])) end++;
      changes.push({ kind: "splice", path: [...path], index: start, before: copy(left.slice(start, left.length - end)), after: copy(right.slice(start, right.length - end)) });
      return;
    }
    if (path.at(-1) === "Keys" && Array.isArray(left) && equalAnimationKeys(left, right)) return;
    if (active.has(right)) throw new Error("Document history cannot store a cyclic model value.");
    active.add(right);
    for (const key in left) if (own(left, key)) child(left, right, key, true, own(right, key));
    for (const key in right) if (own(right, key) && !own(left, key)) child(left, right, key, false, true);
    active.delete(right);
  }
  for (const key of /* @__PURE__ */ new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (forbidden.has(key)) throw new Error(`Unsafe document property: ${key}.`);
    path.push(key);
    visit(before[key], after[key], own(before, key), own(after, key));
    path.pop();
  }
  return changes;
}
function equalTypedValues(left, right) {
  if (left.length === void 0 || left.length !== right.length) return false;
  for (let i = 0; i < left.length; i++) if (!Object.is(left[i], right[i]) || left[i] !== left[i]) return false;
  return true;
}
function equalAnimationKeys(left, right) {
  let present = 0;
  for (let i = 0; i < left.length; i++) {
    if (own(left, i) !== own(right, i)) return false;
    if (own(left, i)) present++;
    const a = left[i], b = right[i];
    if (Object.is(a, b)) continue;
    if (!a || !b || typeof a !== "object" || typeof b !== "object" || a.constructor !== b.constructor) return false;
    for (const key in a) if (own(a, key)) {
      if (forbidden.has(key) || !own(b, key)) return false;
      if (Object.is(a[key], b[key])) continue;
      if (!ArrayBuffer.isView(a[key]) || a[key].constructor !== b[key]?.constructor || !equalTypedValues(a[key], b[key])) return false;
    }
    for (const key in b) if (own(b, key) && !own(a, key)) return false;
  }
  return Object.keys(left).length === present && Object.keys(right).length === present;
}
function validateChange(change) {
  if (!change || !Array.isArray(change.path) || !change.path.length || change.path.length > 128 || change.path.some((key) => typeof key !== "string" || forbidden.has(key))) throw new Error("Invalid recovery history path.");
  if (change.kind === "bytes") {
    if (!Number.isSafeInteger(change.offset) || change.offset < 0 || !(change.before instanceof Uint8Array) || !(change.after instanceof Uint8Array) || change.before.length !== change.after.length) throw new Error("Invalid recovery history byte range.");
  } else if (change.kind === "splice") {
    if (!Number.isSafeInteger(change.index) || change.index < 0 || !Array.isArray(change.before) || !Array.isArray(change.after)) throw new Error("Invalid recovery history array range.");
  } else if (change.kind !== "value" || typeof change.beforeExists !== "boolean" || typeof change.afterExists !== "boolean") throw new Error("Invalid recovery history change.");
}
function applyChanges(model, changes, direction = "after") {
  if (!["before", "after"].includes(direction)) throw new Error("Invalid history direction.");
  const writes = changes.map((change) => {
    validateChange(change);
    let parent = model;
    for (const key2 of change.path.slice(0, -1)) {
      if (!parent || typeof parent !== "object" || !own(parent, key2)) throw new Error("History no longer matches this document.");
      parent = parent[key2];
    }
    if (!parent || typeof parent !== "object") throw new Error("History no longer matches this document.");
    const key = change.path.at(-1);
    if (change.kind === "bytes") {
      const value = parent[key];
      if (!(ArrayBuffer.isView(value) || value instanceof ArrayBuffer) || change.offset + change[direction].length > value.byteLength) throw new Error("History byte range no longer matches this document.");
      return { bytes: byteView(value), offset: change.offset, value: change[direction] };
    }
    if (change.kind === "splice") {
      const value = parent[key], remove = change[direction === "after" ? "before" : "after"].length;
      if (!Array.isArray(value) || change.index + remove > value.length) throw new Error("History array range no longer matches this document.");
      return { parent, key, exists: true, value: value.slice(0, change.index).concat(copy(change[direction]), value.slice(change.index + remove)) };
    }
    return { parent, key, exists: change[`${direction}Exists`], value: copy(change[direction]) };
  });
  for (const write of writes) {
    if (write.bytes) write.bytes.set(write.value, write.offset);
    else if (write.exists) write.parent[write.key] = write.value;
    else delete write.parent[write.key];
  }
}
var HistoryStore = class _HistoryStore {
  constructor(options = {}) {
    this.undoEntries = [];
    this.redoEntries = [];
    this.usedBytes = 0;
    this.evictedSteps = 0;
    this.lastEntryRetained = true;
    this.configure(options);
  }
  configure(options = {}) {
    const budgetBytes = options.budgetBytes ?? this.budgetBytes ?? DEFAULT_HISTORY_OPTIONS.budgetBytes;
    const maxSteps = options.maxSteps ?? this.maxSteps ?? DEFAULT_HISTORY_OPTIONS.maxSteps;
    if (!Number.isSafeInteger(budgetBytes) || budgetBytes < 0 || !Number.isSafeInteger(maxSteps) || maxSteps < 0) throw new Error("Undo cache limits must be nonnegative integers.");
    this.budgetBytes = budgetBytes;
    this.maxSteps = maxSteps;
    this._trim();
    return this.stats;
  }
  _trim() {
    while (this.usedBytes > this.budgetBytes || this.undoEntries.length + this.redoEntries.length > this.maxSteps) {
      const entry = this.undoEntries.length ? this.undoEntries.shift() : this.redoEntries.shift();
      if (!entry) break;
      this.usedBytes -= entry.bytes;
      this.evictedSteps++;
    }
    this.usedBytes = Math.max(0, this.usedBytes);
  }
  prepare({ label, sections, changes }) {
    const entry = { label: String(label), sections: [...sections], changes };
    entry.bytes = retainedBytes(entry);
    return entry;
  }
  push(change) {
    return change.changes.length ? this.commit(this.prepare(change)) : false;
  }
  commit(entry) {
    for (const entry2 of this.redoEntries) this.usedBytes -= entry2.bytes;
    this.redoEntries = [];
    this.undoEntries.push(entry);
    this.usedBytes += entry.bytes;
    this._trim();
    this.lastEntryRetained = this.undoEntries.at(-1) === entry;
    return this.lastEntryRetained;
  }
  setSelection(entry, selection) {
    if (!this.undoEntries.includes(entry) && !this.redoEntries.includes(entry)) return false;
    if (!validSelectionHistory(selection)) throw new Error("Invalid selection history.");
    const { bytes, selection: previous, ...documentEntry } = entry;
    const saved = copy(selection), nextBytes = retainedBytes({ ...documentEntry, selection: saved });
    entry.selection = saved;
    entry.bytes = nextBytes;
    this.usedBytes += nextBytes - bytes;
    this._trim();
    const retained = this.undoEntries.includes(entry) || this.redoEntries.includes(entry);
    if (!retained) this.lastEntryRetained = false;
    return retained;
  }
  undo(mutator) {
    const entry = this.undoEntries.at(-1);
    if (!entry) return null;
    mutator(entry.changes, "before");
    this.undoEntries.pop();
    this.redoEntries.push(entry);
    return entry;
  }
  redo(mutator) {
    const entry = this.redoEntries.at(-1);
    if (!entry) return null;
    mutator(entry.changes, "after");
    this.redoEntries.pop();
    this.undoEntries.push(entry);
    return entry;
  }
  get stats() {
    return {
      undoSteps: this.undoEntries.length,
      redoSteps: this.redoEntries.length,
      usedBytes: this.usedBytes,
      budgetBytes: this.budgetBytes,
      maxSteps: this.maxSteps,
      evictedSteps: this.evictedSteps,
      undoLabel: this.undoEntries.at(-1)?.label || "",
      redoLabel: this.redoEntries.at(-1)?.label || "",
      lastEntryRetained: this.lastEntryRetained
    };
  }
  capture() {
    return copy(this._recoveryState());
  }
  _recoveryState() {
    return {
      version: 1,
      budgetBytes: this.budgetBytes,
      maxSteps: this.maxSteps,
      evictedSteps: this.evictedSteps,
      lastEntryRetained: this.lastEntryRetained,
      undoEntries: this.undoEntries,
      redoEntries: this.redoEntries
    };
  }
  static restore(state) {
    if (state?.version !== 1 || !Array.isArray(state.undoEntries) || !Array.isArray(state.redoEntries)) throw new Error("Invalid recovery history.");
    const store = new _HistoryStore(state);
    for (const key of ["undoEntries", "redoEntries"]) {
      store[key] = state[key].map((entry) => {
        if (typeof entry.label !== "string" || !Array.isArray(entry.sections) || !Array.isArray(entry.changes)) throw new Error("Invalid recovery history entry.");
        entry.changes.forEach(validateChange);
        const result = copy({
          label: entry.label,
          sections: entry.sections,
          changes: entry.changes,
          ...validSelectionHistory(entry.selection) ? { selection: entry.selection } : {}
        });
        result.bytes = retainedBytes(result);
        store.usedBytes += result.bytes;
        return result;
      });
    }
    store.evictedSteps = Number.isSafeInteger(state.evictedSteps) && state.evictedSteps >= 0 ? state.evictedSteps : 0;
    store.lastEntryRetained = state.lastEntryRetained !== false;
    store._trim();
    return store;
  }
};

// src/event-object-codec.js
var import_buffer6 = require("buffer");
function eventTrackTokens(input) {
  const bytes = import_buffer6.Buffer.from(input), tokens = parseMdl(bytes).tokens.filter((token2) => !["whitespace", "line-comment", "block-comment"].includes(token2.kind));
  const raw2 = (token2) => token2?.raw.toString("utf8");
  let objectId = null, globalSeqId = null, trackOpen = null, remove = null, depth = 0;
  for (let i = 0; i < tokens.length; i++) {
    const token2 = tokens[i], value = raw2(token2);
    if (value === "{") depth++;
    if (value === "}") depth--;
    if (depth === 1 && value === "ObjectId") objectId = Number(raw2(tokens[i + 1]));
    if (depth === 1 && value === "EventTrack" && raw2(tokens[i + 2]) === "{") {
      trackOpen = tokens[i + 2];
      for (let j = i + 3; j < tokens.length && raw2(tokens[j]) !== "}"; j++) if (raw2(tokens[j]) === "GlobalSeqId") {
        if (remove) throw new Error("EventTrack contains more than one GlobalSeqId.");
        const id = Number(raw2(tokens[j + 1]));
        if (!Number.isInteger(id) || id < 0 || id > 2147483647 || raw2(tokens[j + 2]) !== ",") throw new Error("EventTrack GlobalSeqId must be a non-negative integer.");
        globalSeqId = id;
        remove = { start: tokens[j].start, end: tokens[j + 2].end };
      }
    }
  }
  return { bytes, objectId, globalSeqId, trackOpen, remove };
}
function prepareMdlEventObject(input) {
  const { bytes, objectId, globalSeqId, remove } = eventTrackTokens(input);
  return { objectId, globalSeqId, bytes: remove ? import_buffer6.Buffer.concat([bytes.subarray(0, remove.start), import_buffer6.Buffer.from(" "), bytes.subarray(remove.end)]) : bytes };
}
function writeMdlEventGlobalSequences(generated, sections, model) {
  const bytes = import_buffer6.Buffer.from(generated), byId = new Map((model.EventObjects || []).map((event) => [event.ObjectId, event]));
  const parts = [];
  let cursor = 0;
  for (const section of sections) {
    if (section.key !== "EventObjects") continue;
    const block = bytes.subarray(section.start, section.end), { objectId, trackOpen } = eventTrackTokens(block);
    const id = byId.get(objectId)?.GlobalSeqId;
    if (!Number.isInteger(id) || id < 0 || !trackOpen) continue;
    const position = section.start + trackOpen.end;
    parts.push(bytes.subarray(cursor, position), import_buffer6.Buffer.from(`
		GlobalSeqId ${id},`));
    cursor = position;
  }
  parts.push(bytes.subarray(cursor));
  return import_buffer6.Buffer.concat(parts);
}
function visitMdxEventTracks(bytes, visitor) {
  for (const chunk of parseMdx(bytes).chunks) if (chunk.tag === "EVTS") {
    const end = chunk.payloadOffset + chunk.declaredSize;
    for (let cursor = chunk.payloadOffset; cursor < end; ) {
      if (cursor + 96 > end) throw new Error("Truncated EventObject node.");
      const nodeSize = bytes.readUInt32LE(cursor), track = cursor + nodeSize;
      if (nodeSize < 96 || track + 12 > end || bytes.toString("ascii", track, track + 4) !== "KEVT") throw new Error("Invalid EventObject track layout.");
      const count = bytes.readUInt32LE(track + 4), next = track + 12 + count * 4;
      if (next > end) throw new Error("Truncated EventObject track.");
      visitor({ objectId: bytes.readInt32LE(cursor + 84), globalSeqId: bytes.readInt32LE(track + 8), offset: track + 8 });
      cursor = next;
    }
  }
}
function restoreMdxEventGlobalSequences(input, model) {
  const bytes = import_buffer6.Buffer.from(input), byId = new Map((model.EventObjects || []).map((event) => [event.ObjectId, event]));
  visitMdxEventTracks(bytes, ({ objectId, globalSeqId }) => {
    const event = byId.get(objectId);
    if (event && globalSeqId >= 0) event.GlobalSeqId = globalSeqId;
  });
}
function writeMdxEventGlobalSequences(input, model) {
  const bytes = import_buffer6.Buffer.from(input), byId = new Map((model.EventObjects || []).map((event) => [event.ObjectId, event]));
  visitMdxEventTracks(bytes, ({ objectId, offset }) => {
    const id = byId.get(objectId)?.GlobalSeqId;
    bytes.writeInt32LE(Number.isInteger(id) && id >= 0 ? id : -1, offset);
  });
  return bytes;
}

// src/popcorn-rotation-codec.js
var import_buffer7 = require("buffer");
function restoreMdlPopcornRotations(input, sections, model) {
  const bytes = import_buffer7.Buffer.from(input), owners2 = new Map((model.ParticleEmitterPopcorns || []).map((node) => [node.ObjectId, node]));
  if (!owners2.size) return;
  for (const section of sections) {
    if (section.key !== "ParticleEmitterPopcorns") continue;
    const block = bytes.subarray(section.start, section.end);
    const tokens = parseMdl(block).tokens.filter((token2) => !["whitespace", "line-comment", "block-comment"].includes(token2.kind));
    const raw2 = (token2) => token2?.raw.toString("utf8");
    let depth = 0, objectId = null, rotation2 = null;
    for (let i = 0; i < tokens.length; i++) {
      const value = raw2(tokens[i]);
      if (value === "{") depth++;
      if (value === "}") depth--;
      if (depth === 1 && value === "ObjectId") objectId = Number(raw2(tokens[i + 1]));
      if (depth === 1 && value === "Rotation" && raw2(tokens[i + 2]) === "{") {
        if (rotation2) throw new Error("Popcorn emitter contains duplicate rotation controllers.");
        let nested = 0, end = -1;
        for (let j = i + 2; j < tokens.length; j++) {
          if (raw2(tokens[j]) === "{") nested++;
          if (raw2(tokens[j]) === "}" && --nested === 0) {
            end = tokens[j].end;
            break;
          }
        }
        if (end < 0) throw new Error("Popcorn rotation controller is incomplete.");
        rotation2 = block.subarray(tokens[i].start, end).toString("utf8").replace(/\/\*[\s\S]*?\*\//g, " ");
      }
    }
    if (rotation2 && owners2.has(objectId)) {
      const decoded = parse(`Version { FormatVersion 800, } Helper "PopcornRotation" { ObjectId 0, ${rotation2} }`);
      owners2.get(objectId).Rotation = decoded.Helpers[0].Rotation;
    }
  }
}
function prepareMdlPopcornColors(emitters = []) {
  return emitters.map((emitter) => {
    const color2 = structuredClone(emitter.Color);
    if (color2?.Keys) for (const key of color2.Keys) for (const property2 of ["Vector", "InTan", "OutTan"]) key[property2]?.reverse();
    else if (Array.isArray(color2) || ArrayBuffer.isView(color2)) color2.reverse();
    return { ...emitter, Color: color2 };
  });
}

// src/uv-coordinate-codec.js
var import_buffer8 = require("buffer");
function writeMdlUVSets(input, sections, model) {
  const bytes = import_buffer8.Buffer.from(input), parts = [];
  let cursor = 0, geosetIndex = 0;
  for (const section of sections) {
    if (section.key !== "Geosets") continue;
    const sets = model.Geosets[geosetIndex++]?.TVertices || [];
    if (sets.length < 2) continue;
    const tokens = parseMdl(bytes.subarray(section.start, section.end)).tokens.filter((token2) => !["whitespace", "line-comment", "block-comment"].includes(token2.kind));
    let depth = 0, existing = 0, close = null;
    for (const token2 of tokens) {
      const value = token2.raw.toString("ascii");
      if (value === "{") depth++;
      if (depth === 1 && value === "TVertices" && token2.kind !== "string") existing++;
      if (value === "}") {
        depth--;
        if (depth === 0) close = token2;
      }
    }
    if (!close || existing >= sets.length) continue;
    const blocks = sets.slice(existing).map((values) => {
      if (values.length % 2 || Array.from(values).some((value) => !Number.isFinite(value))) throw new Error("Cannot write invalid UV coordinates.");
      const rows = [];
      for (let offset = 0; offset < values.length; offset += 2) rows.push(`		{ ${values[offset]}, ${values[offset + 1]} },`);
      return `	TVertices ${values.length / 2} {
${rows.join("\n")}
	}
`;
    }).join("");
    const position = section.start + close.start;
    parts.push(bytes.subarray(cursor, position), import_buffer8.Buffer.from(blocks));
    cursor = position;
  }
  parts.push(bytes.subarray(cursor));
  return import_buffer8.Buffer.concat(parts);
}

// src/geoset-color-codec.js
function convertMdxGeosetColorTracks(animations = []) {
  return animations.map((animation) => {
    if (!animation.Color?.Keys) return animation;
    return { ...animation, Color: { ...animation.Color, Keys: animation.Color.Keys.map((key) => {
      const converted = { ...key };
      for (const field of ["Vector", "InTan", "OutTan"]) if (key[field]) {
        converted[field] = new Float32Array([key[field][2], key[field][1], key[field][0]]);
      }
      return converted;
    }) } };
  });
}

// src/editor-document.js
var V3 = (x = 0, y = 0, z = 0) => new Float32Array([x, y, z]);
var clone = (value) => structuredClone(value);
var NODE_TYPES = Object.freeze({
  Bone: ["Bones", "BONE", 256],
  Helper: ["Helpers", "HELP", 0],
  Attachment: ["Attachments", "ATCH", 2048],
  Light: ["Lights", "LITE", 512],
  EventObject: ["EventObjects", "EVTS", 1024],
  CollisionShape: ["CollisionShapes", "CLID", 8192],
  ParticleEmitter: ["ParticleEmitters", "PREM", 4096],
  ParticleEmitter2: ["ParticleEmitters2", "PRE2", 4096],
  RibbonEmitter: ["RibbonEmitters", "RIBB", 16384],
  ParticleEmitterPopcorn: ["ParticleEmitterPopcorns", "CORN", 4096]
});
var SECTION_TYPES = {
  Version: ["Version", "VERS"],
  Info: ["Model", "MODL"],
  Sequences: ["Sequences", "SEQS"],
  GlobalSequences: ["GlobalSequences", "GLBS"],
  Materials: ["Materials", "MTLS"],
  Textures: ["Textures", "TEXS"],
  TextureAnims: ["TextureAnims", "TXAN"],
  Geosets: ["Geoset", "GEOS"],
  GeosetAnims: ["GeosetAnim", "GEOA"],
  PivotPoints: ["PivotPoints", "PIVT"],
  Cameras: ["Camera", "CAMS"],
  FaceFX: ["FaceFX", "FAFX"],
  BindPoses: ["BindPose", "BPOS"],
  Gliders: ["Glider", "DILG"],
  ...Object.fromEntries(Object.entries(NODE_TYPES).map(([name, [key, tag]]) => [key, [name, tag]]))
};
var MDL_TO_KEY = Object.fromEntries(Object.entries(SECTION_TYPES).map(([k, v]) => [v[0], k]));
var TEXTURE_SLOTS2 = ["TextureID", "NormalTextureID", "ORMTextureID", "EmissiveTextureID", "TeamColorTextureID", "ReflectionsTextureID"];
var nodeCollections = (model) => Object.values(NODE_TYPES).flatMap(([key]) => model[key] || []);
var fingerprint2 = (value) => JSON.stringify(value, (key, val) => {
  if (ArrayBuffer.isView(val)) return { $type: val.constructor.name, $data: Array.from(val) };
  if (typeof val === "number" && !Number.isFinite(val)) return { $number: String(val) };
  return val;
});
var nodeCollectionKeys = new Set(Object.values(NODE_TYPES).map(([key]) => key));
var ignoreHistoryAlias = (path) => path[0] === "Nodes" || path.length === 3 && nodeCollectionKeys.has(path[0]) && path[2] === "PivotPoint";
var pickSections = (model, keys) => Object.fromEntries([...keys].filter((key) => key !== "Nodes").map((key) => [key, model[key]]));
function emptyModel(version = 800, name = "Untitled") {
  const model = {
    Version: version,
    Info: { Name: name, MinimumExtent: V3(), MaximumExtent: V3(), BoundsRadius: 0, BlendTime: 150 },
    Nodes: []
  };
  for (const key of Object.keys(SECTION_TYPES)) if (!(key in model) && key !== "Version") model[key] = [];
  return model;
}
function scanMdlSections(input) {
  const bytes = import_buffer9.Buffer.from(input);
  const sections = [];
  let start = -1, name = "", depth = 0, i = 0;
  while (i < bytes.length) {
    const c = bytes[i];
    if (c === 47 && bytes[i + 1] === 47) {
      i += 2;
      while (i < bytes.length && bytes[i] !== 10 && bytes[i] !== 13) i++;
    } else if (c === 47 && bytes[i + 1] === 42) {
      const end = bytes.indexOf(import_buffer9.Buffer.from("*/"), i + 2);
      if (end < 0) throw new Error("Unterminated MDL block comment.");
      i = end + 2;
    } else if (c === 34) {
      const end = mdlStringEnd(bytes, i);
      if (end < 0) throw new Error("Unterminated MDL string.");
      i = end;
    } else if (c === 123) {
      depth++;
      i++;
    } else if (c === 125) {
      if (--depth < 0) throw new Error("Unmatched MDL closing brace.");
      i++;
      if (depth === 0 && start >= 0) {
        sections.push({ name, key: MDL_TO_KEY[name], start, end: i });
        start = -1;
      }
    } else if (depth === 0 && start < 0 && (c >= 65 && c <= 90 || c >= 97 && c <= 122 || c === 95)) {
      start = i++;
      while (i < bytes.length && /[A-Za-z0-9_]/.test(String.fromCharCode(bytes[i]))) i++;
      name = bytes.subarray(start, i).toString("ascii");
    } else i++;
  }
  if (depth !== 0) throw new Error("Unterminated MDL section.");
  if (start >= 0) throw new Error(`Incomplete MDL section ${name}.`);
  return sections;
}
function stripBlockComments(text) {
  return text.replace(/"[^"]*"|\/\*[\s\S]*?\*\//g, (match) => match.startsWith("/*") ? " " : match);
}
function emptyFaceGroups(text) {
  return text.replace(/"(?:\\.|[^"\\])*"|Faces\s+1\s+0\s*\{\s*Triangles\s*\{\s*\{\s*\},?\s*\}\s*\}/g, (match) => match.startsWith('"') ? match : "Faces 0 0 { Triangles { } }");
}
function decodeMdl(bytes, sections) {
  const eventGlobals = /* @__PURE__ */ new Map();
  const body = sections.filter((s) => s.key && s.key !== "PivotPoints").map((s) => {
    let source = bytes.subarray(s.start, s.end);
    if (s.key === "EventObjects") {
      const prepared = prepareMdlEventObject(source);
      source = prepared.bytes;
      if (prepared.globalSeqId != null) eventGlobals.set(prepared.objectId, prepared.globalSeqId);
    }
    return stripBlockComments(source.toString("utf8"));
  }).join("\n");
  const compatible = prepareCompatibleMdl(emptyFaceGroups(body));
  const model = parse(compatible.text);
  compatible.restore(model);
  for (const node of model.ParticleEmitters || []) node.Flags |= 4096;
  restoreMdlPopcornRotations(bytes, sections, model);
  for (const event of model.EventObjects || []) if (eventGlobals.has(event.ObjectId)) event.GlobalSeqId = eventGlobals.get(event.ObjectId);
  for (const anim of model.GeosetAnims || []) if (anim.Color != null) anim.Flags = (anim.Flags || 0) | 2;
  const pivots = sections.filter((s) => s.key === "PivotPoints");
  if (pivots.length) {
    model.PivotPoints = readMdlPivotPoints(bytes.subarray(pivots.at(-1).start, pivots.at(-1).end));
  }
  normalizeModel(model);
  return model;
}
function normalizeModel(model, previous) {
  for (const key of Object.keys(SECTION_TYPES)) {
    if (key !== "Version" && key !== "Info" && model[key] == null) model[key] = [];
  }
  model.Nodes = [];
  for (const node of nodeCollections(model)) {
    const id = node.ObjectId;
    if (!Number.isInteger(id) || id < 0 || id > 1e6) continue;
    if (node.Parent === void 0) node.Parent = null;
    const previousNode = previous?.Nodes?.[id];
    const oldPivot = previous?.PivotPoints?.[id];
    const nodePivotChanged = previousNode && fingerprint2(previousNode.PivotPoint) !== fingerprint2(node.PivotPoint);
    const arrayPivotChanged = oldPivot && fingerprint2(oldPivot) !== fingerprint2(model.PivotPoints[id]);
    if (nodePivotChanged && !arrayPivotChanged) model.PivotPoints[id] = node.PivotPoint;
    if (!model.PivotPoints[id]) model.PivotPoints[id] = node.PivotPoint || V3();
    node.PivotPoint = model.PivotPoints[id];
    model.Nodes[id] = node;
  }
  for (let i = 0; i < model.PivotPoints.length; i++) model.PivotPoints[i] ||= V3();
  const visited = /* @__PURE__ */ new Set();
  function normalizeTracks(value) {
    if (!value || typeof value !== "object" || ArrayBuffer.isView(value) || visited.has(value)) return;
    visited.add(value);
    if (Array.isArray(value.Keys)) {
      if (value.GlobalSeqId === void 0) value.GlobalSeqId = null;
      return;
    }
    for (const child of Object.values(value)) normalizeTracks(child);
  }
  normalizeTracks(model);
  for (const material of model.Materials) for (const layer of material.Layers || []) {
    if (layer.TVertexAnimId === void 0) layer.TVertexAnimId = null;
    layer.CoordId ??= 0;
    layer.FilterMode ??= 0;
    layer.Shading ??= 0;
  }
  for (const node of model.Bones) {
    node.GeosetId ??= null;
    node.GeosetAnimId ??= null;
  }
  for (const node of model.Lights) {
    node.QuadraticFalloff ??= 5e-4;
    node.LinearFalloff ??= 0;
    node.Damping ??= 1e-5;
  }
  for (const [i, geoset] of model.Geosets.entries()) {
    if (previous && fingerprint2(previous.Geosets[i]?.Faces) !== fingerprint2(geoset.Faces) && geoset.PrimitiveCounts && Array.from(geoset.PrimitiveCounts).reduce((sum2, n) => sum2 + n, 0) !== geoset.Faces.length) {
      geoset.PrimitiveTypes = Uint32Array.of(4);
      geoset.PrimitiveCounts = Uint32Array.of(geoset.Faces.length);
    }
  }
  for (const node of model.ParticleEmitters2) for (const field of ["TailLength", "Time", "LifeSpan", "PriorityPlane", "ReplaceableId", "Rows", "Columns"]) node[field] ??= 0;
  for (const node of model.ParticleEmitters) for (const field of ["EmissionRate", "Gravity", "Longitude", "Latitude", "LifeSpan", "InitVelocity"]) node[field] ??= 0;
  for (const node of model.ParticleEmitterPopcorns) {
    for (const field of ["LifeSpan", "EmissionRate", "Speed", "Alpha"]) node[field] ??= 1;
    node.ReplaceableId ??= 0;
    node.Path ??= "";
    node.AnimVisibilityGuide ??= "";
    node.Color ??= V3(1, 1, 1);
  }
  for (const node of model.RibbonEmitters) {
    node.HeightAbove ??= 0;
    node.HeightBelow ??= 0;
    node.Alpha ??= 1;
    node.TextureSlot ??= 0;
  }
  for (const item of [model.Info, ...model.Sequences, ...model.Geosets, ...model.Geosets.flatMap((g) => g.Anims || [])]) if (item) {
    item.MinimumExtent ||= V3();
    item.MaximumExtent ||= V3();
    item.BoundsRadius ??= 0;
  }
  if (model.Info) model.Info.BlendTime ??= 0;
  for (const texture of model.Textures) {
    texture.Image ??= "";
    texture.ReplaceableId ??= 0;
    texture.Flags ??= 0;
  }
  for (const node of model.ParticleEmitters2) node.Squirt = !!node.Squirt;
  updateCounts(model);
}
function surgicalMdl(original, sections, generated, keys) {
  const fresh = scanMdlSections(generated);
  const replacements = /* @__PURE__ */ new Map();
  for (const key of keys) replacements.set(key, import_buffer9.Buffer.concat(fresh.filter((s) => s.key === key).flatMap((s) => [generated.subarray(s.start, s.end), import_buffer9.Buffer.from("\n")])));
  const parts = [];
  const inserted = /* @__PURE__ */ new Set();
  let cursor = 0;
  for (const section of sections) {
    if (!replacements.has(section.key)) continue;
    parts.push(original.subarray(cursor, section.start));
    if (!inserted.has(section.key)) {
      parts.push(replacements.get(section.key));
      inserted.add(section.key);
    }
    cursor = section.end;
  }
  parts.push(original.subarray(cursor));
  for (const [key, bytes] of replacements) if (!inserted.has(key) && bytes.length) parts.push(import_buffer9.Buffer.from("\n"), bytes);
  const output = import_buffer9.Buffer.concat(parts);
  return orderMdlNodes(output);
}
function orderMdlNodes(output) {
  const nodes = scanMdlSections(output).filter((section) => nodeCollectionKeys.has(section.key));
  const ordered = [...nodes].sort((a, b) => SERIALIZED_NODE_COLLECTIONS.indexOf(a.key) - SERIALIZED_NODE_COLLECTIONS.indexOf(b.key));
  const reordered = [];
  let cursor = 0;
  nodes.forEach((section, index2) => {
    const from = ordered[index2];
    reordered.push(output.subarray(cursor, section.start), output.subarray(from.start, from.end));
    cursor = section.end;
  });
  reordered.push(output.subarray(cursor));
  return import_buffer9.Buffer.concat(reordered);
}
function surgicalMdx(original, container, generated, keys) {
  const fresh = parseMdx(generated);
  if (fresh.hasErrors) throw new Error("Generated MDX has an invalid chunk structure.");
  const tags = new Set(keys.map((key) => SECTION_TYPES[key][1]));
  const replacements = new Map([...tags].map((tag) => [tag, import_buffer9.Buffer.concat(fresh.chunks.filter((chunk) => chunk.tag === tag).map((chunk) => generated.subarray(chunk.offset, chunk.payloadOffset + chunk.declaredSize)))]));
  const inserted = /* @__PURE__ */ new Set();
  const parts = [original.subarray(0, 4)];
  for (const chunk of container.chunks) {
    if (!tags.has(chunk.tag)) parts.push(original.subarray(chunk.offset, chunk.payloadOffset + chunk.declaredSize));
    else if (!inserted.has(chunk.tag)) {
      parts.push(replacements.get(chunk.tag));
      inserted.add(chunk.tag);
    }
  }
  for (const [tag, bytes] of replacements) if (!inserted.has(tag)) parts.push(bytes);
  parts.push(container.trailingBytes);
  return import_buffer9.Buffer.concat(parts);
}
var EditorDocument = class _EditorDocument {
  constructor(input, name = "Untitled.mdl", options = {}) {
    this.name = name;
    this.revision = 0;
    this.history = [];
    this._historyStore = new HistoryStore(options.history);
    this._serializedStates = /* @__PURE__ */ new WeakMap();
    this._loadSource(input);
    this.model = emptyModel(this.version || 800, name);
    this.readOnly = this._sourceErrors.length > 0 || !SUPPORTED_FORMAT_VERSIONS.includes(this.version);
    if (!this.readOnly) {
      try {
        this.model = this.format === "mdx" ? parseCompatibleMdx(this._original) : decodeMdl(this._original, this._sections);
        if (this.format === "mdx") {
          restoreMdxEventGlobalSequences(this._original, this.model);
          this.model.GeosetAnims = convertMdxGeosetColorTracks(this.model.GeosetAnims);
        }
        normalizeModel(this.model);
      } catch (error) {
        this.readOnly = true;
        this._sourceErrors.push({ severity: "error", code: "SEMANTIC_DECODE_FAILED", message: `Editing unavailable: ${error.message}. The original file can still be copied exactly.` });
      }
    }
    this._savedModel = clone(this.model);
    this._committedModel = clone(this.model);
    this._dirtyCandidates = new Set(Object.keys(this.model));
    this._trackedModel = this.model;
    this._recoverySavedChanges = [];
  }
  _loadSource(input) {
    this._original = typeof input === "string" ? import_buffer9.Buffer.from(input, "utf8") : import_buffer9.Buffer.from(input instanceof ArrayBuffer ? new Uint8Array(input) : input);
    this.format = this._original.subarray(0, 4).toString("ascii") === "MDLX" ? "mdx" : "mdl";
    this._container = this.format === "mdx" ? parseMdx(this._original) : parseMdl(this._original);
    this.version = this._container.version;
    this._sourceErrors = this._container.diagnostics.filter((d) => d.severity === "error");
    this._sourceWarnings = this._container.diagnostics.filter((d) => d.severity !== "error");
    this._sections = [];
    if (this.format === "mdl") {
      try {
        this._sections = scanMdlSections(this._original);
      } catch (error) {
        this._sourceErrors.push({ severity: "error", code: "MDL_STRUCTURE", message: error.message });
      }
    }
  }
  get originalBytes() {
    return new Uint8Array(this._original);
  }
  _candidateKeys() {
    if (this.model !== this._trackedModel) {
      this._dirtyCandidates = /* @__PURE__ */ new Set([...Object.keys(this._savedModel), ...Object.keys(this.model)]);
      this._trackedModel = this.model;
      this._changeCache = null;
    }
    return this._dirtyCandidates;
  }
  _changedKeys() {
    const candidates = this._candidateKeys();
    if (this._changeCache?.revision !== this.revision) {
      const changes = createChanges(pickSections(this._savedModel, candidates), pickSections(this.model, candidates), { ignore: ignoreHistoryAlias });
      this._dirtyCandidates = new Set(changes.map((change) => change.path[0]));
      this._changeCache = { revision: this.revision, keys: [...new Set(changes.map((change) => change.path[0]).filter((key) => key in SECTION_TYPES))] };
    }
    return this._changeCache.keys;
  }
  get dirty() {
    return this._changedKeys().length > 0;
  }
  get canUndo() {
    return this._historyStore.stats.undoSteps > 0;
  }
  get canRedo() {
    return this._historyStore.stats.redoSteps > 0;
  }
  get historyStats() {
    return this._historyStore.stats;
  }
  configureHistory(options) {
    return this._historyStore.configure(options);
  }
  _recordHistory(entry) {
    this.history.push(entry);
    const limit = Math.max(1, this.historyStats.maxSteps);
    if (this.history.length > limit) this.history.splice(0, this.history.length - limit);
  }
  get diagnostics() {
    if (this._diagnosticCache?.revision === this.revision) return this._diagnosticCache.diagnostics;
    const diagnostics = [...this._sourceErrors, ...this._sourceWarnings];
    if (!this.readOnly) diagnostics.push(...validateModel(this.model));
    const opaque = this._unknownSections();
    if (opaque.length) diagnostics.push({ severity: "info", code: "OPAQUE_DATA_PRESERVED", message: `Unrecognized source data is retained: ${opaque.join(", ")}.` });
    this._diagnosticCache = { revision: this.revision, diagnostics };
    return diagnostics;
  }
  _unknownSections() {
    const known = new Set(Object.values(SECTION_TYPES).map((s) => s[1]));
    return this.format === "mdx" ? [...new Set(this._container.chunks.filter((c) => !known.has(c.tag)).map((c) => c.tag))] : [...new Set(this._sections.filter((s) => !s.key).map((s) => s.name))];
  }
  convertVersion(target) {
    if (this.readOnly) throw new Error("This document is read-only.");
    if (target === this.model.Version) return false;
    const issues = versionConversionIssues(this.model, target);
    if (this._unknownSections().length) issues.push("Unrecognized source sections prevent safe version conversion.");
    if (issues.length) throw new Error(issues.join("\n"));
    const candidate = clone(this.model);
    normalizeVersionFields(candidate, target);
    const bytes = writeMdxEventGlobalSequences(generateCompatibleMdx({ ...candidate, GeosetAnims: convertMdxGeosetColorTracks(candidate.GeosetAnims), BindPoses: candidate.BindPoses?.length ? candidate.BindPoses : void 0 }), candidate);
    const check = openDocument(bytes, "converted.mdx");
    if (check.readOnly || check.version !== target || check.diagnostics.some((d) => d.severity === "error")) throw new Error("Target format verification failed. The model was kept.");
    assertModelEquivalent(candidate, check.model, { keys: Object.keys(SECTION_TYPES) });
    for (const key of Object.keys(SECTION_TYPES)) if (Array.isArray(candidate[key]) && candidate[key].length !== check.model[key]?.length) throw new Error("Target conversion changed " + key + " count.");
    this._versionConversion = true;
    try {
      return this.apply("Convert to MDX" + target, ["Version", "Materials", "Geosets"], (model) => normalizeVersionFields(model, target));
    } finally {
      this._versionConversion = false;
    }
  }
  apply(label, sections, mutator) {
    if (this.readOnly) throw new Error(`This document is read-only (format ${this.version ?? "unknown"} or unsupported data).`);
    if (typeof mutator !== "function") throw new TypeError("apply requires a model mutator function.");
    if (this._applying) throw new Error("Nested document edits are not supported.");
    const before = this._committedModel, next = this.model;
    this._candidateKeys();
    let result, changes, changed, historyEntry;
    this._applying = true;
    try {
      result = mutator(next);
      if (result && typeof result.then === "function") throw new Error("Document edits must be synchronous.");
      if (next.Version !== before.Version && !this._versionConversion) throw new Error("Changing the model version is not supported; no automatic downgrades are performed.");
      normalizeModel(next, before);
      changes = createChanges(before, next, { ignore: ignoreHistoryAlias });
      changed = [...new Set(changes.map((change) => change.path[0]).filter((key) => key in SECTION_TYPES))];
      const previousDiagnostics = this._committedDiagnostics ||= validateModel(before);
      const existingErrors = this._committedErrors ||= new Set(previousDiagnostics.filter((d) => d.severity === "error").map((d) => `${d.code}:${d.path}`));
      const numericSections = changed.includes("GlobalSequences") ? null : new Set(changes.map((change) => change.path[0]));
      if (numericSections && (numericSections.has("PivotPoints") || changed.some((key) => nodeCollectionKeys.has(key)))) {
        numericSections.add("PivotPoints");
        for (const key of nodeCollectionKeys) numericSections.add(key);
      }
      const nextDiagnostics = validateModel(next, { numericSections, previousDiagnostics });
      const errors = nextDiagnostics.filter((d) => d.severity === "error" && !existingErrors.has(`${d.code}:${d.path}`));
      if (errors.length) throw new Error(errors.slice(0, 4).map((d) => d.message).join("\n"));
      if (changes.length) historyEntry = this._historyStore.prepare({ label, sections: changed, changes });
      applyChanges(before, changes);
      normalizeModel(before);
      this._committedErrors = new Set(nextDiagnostics.filter((d) => d.severity === "error").map((d) => `${d.code}:${d.path}`));
      this._committedDiagnostics = nextDiagnostics;
    } catch (error) {
      this.model = clone(before);
      this._trackedModel = this.model;
      throw error;
    } finally {
      this._applying = false;
    }
    if (!changes.length) return false;
    this._historyStore.commit(historyEntry);
    this.model = next;
    for (const change of changes) this._dirtyCandidates.add(change.path[0]);
    this.version = this.model.Version;
    this.revision++;
    this._recordHistory({ label, sections: changed, requestedSections: [...sections || []], revision: this.revision });
    return result === void 0 ? true : result;
  }
  undo() {
    if (this._applying) throw new Error("Cannot undo inside a document edit.");
    const state = this._historyStore.undo((changes, direction) => this._applyHistory(changes, direction));
    if (!state) return false;
    if (state.changes.length) this.revision++;
    this._recordHistory({ label: `Undo: ${state.label}`, sections: state.sections, revision: this.revision });
    return true;
  }
  redo() {
    if (this._applying) throw new Error("Cannot redo inside a document edit.");
    const state = this._historyStore.redo((changes, direction) => this._applyHistory(changes, direction));
    if (!state) return false;
    if (state.changes.length) this.revision++;
    this._recordHistory({ label: `Redo: ${state.label}`, sections: state.sections, revision: this.revision });
    return true;
  }
  _applyHistory(changes, direction) {
    applyChanges(this._committedModel, changes, direction);
    normalizeModel(this._committedModel);
    try {
      applyChanges(this.model, changes, direction);
      normalizeModel(this.model);
    } catch {
      this.model = clone(this._committedModel);
    }
    this.version = this.model.Version;
    this._committedErrors = null;
    this._committedDiagnostics = null;
    for (const change of changes) this._dirtyCandidates.add(change.path[0]);
    this._trackedModel = this.model;
  }
  captureRecoveryState({ includeHistory = true, compact = false } = {}) {
    if (this._applying) throw new Error("Cannot capture recovery inside a document edit.");
    if (compact) {
      this._candidateKeys();
      return clone({
        schema: "mdlvis-document-recovery",
        version: 2,
        name: this.name,
        originalBytes: new Uint8Array(this._original.buffer, this._original.byteOffset, this._original.byteLength),
        savedChanges: this._recoverySavedChanges,
        // Checkpoints also capture direct in-place draft changes, even when
        // no document transaction or revision has been committed yet.
        modelChanges: createChanges(this._savedModel, this.model, { ignore: ignoreHistoryAlias }),
        revision: this.revision,
        history: includeHistory ? this._historyStore._recoveryState() : null,
        activity: this.history
      });
    }
    return clone({
      schema: "mdlvis-document-recovery",
      version: 1,
      name: this.name,
      originalBytes: new Uint8Array(this._original.buffer, this._original.byteOffset, this._original.byteLength),
      model: this.model,
      savedModel: this._savedModel,
      revision: this.revision,
      history: includeHistory ? this._historyStore._recoveryState() : null,
      activity: this.history
    });
  }
  static restoreRecoveryState(state) {
    if (state?.schema !== "mdlvis-document-recovery" || ![1, 2].includes(state.version) || !(state.originalBytes instanceof Uint8Array) || typeof state.name !== "string" || (state.version === 1 ? !state.model : !Array.isArray(state.savedChanges) || !Array.isArray(state.modelChanges))) throw new Error("Invalid document recovery data.");
    const doc = new _EditorDocument(state.originalBytes, state.name);
    let savedModel, recovered;
    if (state.version === 2) {
      savedModel = clone(doc.model);
      applyChanges(savedModel, state.savedChanges);
      normalizeModel(savedModel);
      recovered = clone(savedModel);
      applyChanges(recovered, state.modelChanges);
    } else {
      savedModel = state.savedModel;
      recovered = clone(state.model);
    }
    if (!savedModel || savedModel.Version !== doc.version || ![800, 1e3, doc.version].includes(recovered.Version)) throw new Error("Recovery model version does not match its original file.");
    normalizeModel(recovered);
    const existingErrors = new Set(validateModel(doc.model).filter((d) => d.severity === "error").map((d) => `${d.code}:${d.path}`));
    const errors = validateModel(recovered).filter((d) => d.severity === "error" && !existingErrors.has(`${d.code}:${d.path}`));
    if (errors.length) throw new Error(`Recovery model is invalid: ${errors[0].message}`);
    doc.model = recovered;
    doc.version = recovered.Version;
    doc._committedModel = clone(recovered);
    doc._recoverySavedChanges = state.version === 2 ? clone(state.savedChanges) : createChanges(doc._savedModel, savedModel, { ignore: ignoreHistoryAlias });
    doc._savedModel = clone(savedModel);
    normalizeModel(doc._savedModel);
    doc._dirtyCandidates = new Set(Object.keys(recovered));
    doc._trackedModel = recovered;
    if (state.history) doc._historyStore = HistoryStore.restore(state.history);
    doc.revision = Number.isSafeInteger(state.revision) && state.revision >= 0 ? state.revision : 0;
    doc.history = Array.isArray(state.activity) ? clone(state.activity.slice(-Math.max(1, doc.historyStats.maxSteps))) : [];
    return doc;
  }
  saveImpact(format = this.format) {
    format = format.toLowerCase();
    const conversion = format !== this.format || this.model.Version !== this._container.version;
    const changed = this._changedKeys();
    const warnings = [];
    if (conversion) warnings.push("Format conversion regenerates the entire file. Unknown chunks, unknown MDL sections, comments and unsupported fields cannot be carried into the other format.");
    else if (changed.length) warnings.push("Changed sections are regenerated. Their formatting, comments and unsupported subfields may change; all other source sections remain byte-for-byte intact.");
    if (this.version === 900) warnings.push("Version 900 support in the parser library is experimental.");
    if (this.readOnly && conversion) warnings.push("This document cannot be converted because its version or source data is unsupported.");
    if (conversion && this.model.Geosets?.some((g) => g.SkinWeights?.length) && format === "mdl") warnings.push("Weighted HD geometry requires a compatible Reforged MDL consumer.");
    const stringIssues = (conversion || changed.length) && !this.readOnly ? serializationStringIssues(this.model, format, conversion ? Object.keys(SECTION_TYPES) : changed) : [];
    warnings.push(...stringIssues);
    const unknown = this._unknownSections();
    if (conversion && unknown.length) warnings.push(`Cannot convert unrecognized source data: ${unknown.join(", ")}.`);
    return { format, conversion, exact: !conversion && changed.length === 0, readOnly: this.readOnly, changedSections: changed.map((key) => key === "Info" ? "Model" : key), preservedUnknown: unknown, warnings, canSave: ["mdl", "mdx"].includes(format) && (!this.readOnly || !conversion && !changed.length) && !stringIssues.length && !(conversion && unknown.length) };
  }
  serialize(format = this.format, { timings = {} } = {}) {
    Object.assign(timings, { serializationMs: 0, reparsingMs: 0, verificationMs: 0, errorFormattingMs: 0 });
    let stage = "serializationMs", start = performance.now();
    const nextStage = (next) => {
      const now = performance.now();
      timings[stage] += now - start;
      stage = next;
      start = now;
    };
    try {
      format = format.toLowerCase();
      const impact = this.saveImpact(format);
      if (!impact.canSave) throw new Error(`This document cannot be saved in that format. ${impact.warnings.at(-1) || "An exact copy in its original format is available."}`);
      const remember = (data) => {
        const bytes = new Uint8Array(data);
        this._serializedStates.set(bytes, { model: clone(this.model), revision: this.revision });
        return bytes;
      };
      if (impact.exact) return remember(this._original);
      let saveModel = this.model;
      if (serializedNodes(saveModel).some((node, index2) => node.ObjectId !== index2)) {
        saveModel = clone(saveModel);
        canonicalizeSerializedNodeOrder(saveModel, { preserveUnusedPivots: true });
      }
      const colorIssues = geosetColorExportIssues(this.model.GeosetAnims, format);
      if (colorIssues.length) {
        nextStage("errorFormattingMs");
        throw new Error(formatSaveIssues("Cannot export geoset colors", colorIssues));
      }
      const animations = prepareGeosetAnimationColors(saveModel.GeosetAnims, format);
      const exportModel = format === "mdl" ? { ...saveModel, ParticleEmitterPopcorns: prepareMdlPopcornColors(saveModel.ParticleEmitterPopcorns), GeosetAnims: animations } : { ...saveModel, GeosetAnims: convertMdxGeosetColorTracks(animations), BindPoses: saveModel.BindPoses?.length ? saveModel.BindPoses : void 0 };
      const mdlModel = format === "mdl" ? { ...exportModel, Geosets: exportModel.Geosets.map((g) => ({ ...g, TVertices: g.TVertices.length ? g.TVertices : [new Float32Array()] })), CollisionShapes: exportModel.CollisionShapes.map((n) => [1, 3].includes(n.Shape) ? { ...n, Shape: 0 } : n) } : null;
      let generated = format === "mdl" ? finishCompatibleMdl(import_buffer9.Buffer.from(emptyFaceGroups(generate(mdlModel)), "utf8"), { ...saveModel, GeosetAnims: animations }) : import_buffer9.Buffer.from(generateCompatibleMdx(exportModel));
      if (format === "mdl") generated = writeMdlUVSets(generated, scanMdlSections(generated), exportModel);
      generated = format === "mdl" ? writeMdlEventGlobalSequences(generated, scanMdlSections(generated), exportModel) : writeMdxEventGlobalSequences(generated, exportModel);
      if (format === "mdl") generated = orderMdlNodes(formatGeneratedMdl(generated));
      const sourceModel = this._recoverySavedChanges.length ? openDocument(this._original, this.name).model : this._savedModel;
      if (!impact.conversion) generated = format === "mdx" ? preserveMdxRecords(this._original, generated, sourceModel, saveModel, SECTION_TYPES) : preserveMdlRecords(this._original, generated, sourceModel, saveModel, SECTION_TYPES);
      const keys = saveModel !== this.model || this._recoverySavedChanges.length ? Object.keys(SECTION_TYPES).filter((key) => fingerprint2(sourceModel[key]) !== fingerprint2(saveModel[key])) : this._changedKeys();
      const output = impact.conversion ? generated : format === "mdl" ? surgicalMdl(this._original, this._sections, generated, keys) : surgicalMdx(this._original, this._container, generated, keys);
      nextStage("reparsingMs");
      const reopened = openDocument(output, `validation.${format}`);
      nextStage("verificationMs");
      if (reopened.readOnly) {
        nextStage("errorFormattingMs");
        throw new Error(formatSaveIssues("Save verification failed", reopened.diagnostics.filter((d) => d.severity === "error").map((d) => d.message)));
      }
      if (reopened.version !== this.version) throw new Error("Save verification failed: model version changed.");
      assertModelEquivalent(saveModel, reopened.model, { keys: Object.keys(SECTION_TYPES), timings });
      for (const key of Object.keys(SECTION_TYPES)) if (Array.isArray(this.model[key]) && this.model[key].length !== reopened.model[key]?.length) throw new Error(`Save verification failed: ${key} count changed during serialization.`);
      for (let index2 = 0; index2 < this.model.Geosets.length; index2++) if (this.model.Geosets[index2].TVertices.length !== reopened.model.Geosets[index2].TVertices.length) throw new Error(`Save verification failed: Geoset ${index2} UV set count changed during serialization.`);
      const existingErrors = new Set(validateModel(this.model).filter((d) => d.severity === "error").map((d) => `${d.code}:${d.path}`));
      const newErrors = reopened.diagnostics.filter((d) => d.severity === "error" && !existingErrors.has(`${d.code}:${d.path}`));
      if (newErrors.length) {
        nextStage("errorFormattingMs");
        throw new Error(formatSaveIssues("Save verification failed", newErrors.map((d) => d.message)));
      }
      return remember(output);
    } finally {
      timings[stage] += performance.now() - start;
      if (stage === "verificationMs") timings.verificationMs -= timings.errorFormattingMs;
      this.lastSaveTimings = { ...timings };
    }
  }
  rememberSerializedSnapshot(bytes, model, revision = this.revision) {
    this._serializedStates.set(bytes, { model: clone(model), revision });
  }
  markSaved(bytes, name = this.name) {
    const savedBytes = bytes || this.serialize();
    const savedState = this._serializedStates.get(savedBytes);
    const savedModel = savedState ? savedState.model : openDocument(savedBytes, name).model;
    this.name = name;
    this._loadSource(savedBytes);
    this.version = this.model.Version;
    this._savedModel = clone(savedModel);
    this._recoverySavedChanges = createChanges(openDocument(savedBytes, name).model, savedModel, { ignore: ignoreHistoryAlias });
    this._dirtyCandidates = /* @__PURE__ */ new Set([...Object.keys(this._savedModel), ...Object.keys(this.model)]);
    this._trackedModel = this.model;
    this.revision++;
  }
};
function openDocument(bytes, name, options) {
  return new EditorDocument(bytes, name, options);
}
function serializationStringIssues(model, format, keys) {
  const issues = [], seen = /* @__PURE__ */ new Set();
  function walk(value, path, key) {
    if (typeof value === "string") {
      if (format === "mdl" && (/["\0]/.test(value) || key !== "AnimVisibilityGuide" && /[\r\n]/.test(value))) issues.push(`${path} contains a quote, newline or NUL that this MDL writer cannot safely encode.`);
      if (format === "mdx") {
        if ([...value].some((char) => char.charCodeAt(0) > 255)) issues.push(`${path} contains Unicode characters that this MDX writer cannot encode. Save as MDL or use a compatible name.`);
        const limit = ["Image", "Path", "AnimationFile", "AnimVisibilityGuide"].includes(key) ? 260 : ["Name", "Shader"].includes(key) ? 80 : null;
        if (limit && value.length > limit) issues.push(`${path} exceeds its ${limit}-byte MDX field; saving would truncate it.`);
      }
      return;
    }
    if (!value || typeof value !== "object" || ArrayBuffer.isView(value) || seen.has(value)) return;
    seen.add(value);
    for (const [name, child] of Object.entries(value)) walk(child, `${path}.${name}`, name);
  }
  for (const key of keys) walk(model[key], key, key);
  return issues;
}
function validateModel(model, { numericSections = null, previousDiagnostics = [] } = {}) {
  const diagnostics = [];
  const add = (severity, code, message, path) => diagnostics.push({ severity, code, message, path });
  if (!model) return [{ severity: "error", code: "NO_MODEL", message: "No model is loaded." }];
  const nodes = nodeCollections(model), ids = /* @__PURE__ */ new Map();
  for (const node of nodes) {
    const path = `Nodes[${node.ObjectId}]`;
    if (!Number.isInteger(node.ObjectId) || node.ObjectId < 0 || node.ObjectId > 1e6) add("error", "NODE_ID", `Node ${node.Name} has an invalid object ID.`, path);
    if (ids.has(node.ObjectId)) add("error", "DUPLICATE_NODE_ID", `Object ID ${node.ObjectId} is used by more than one node.`, path);
    ids.set(node.ObjectId, node);
    if (!node.PivotPoint || node.PivotPoint.length !== 3) add("error", "NODE_PIVOT", `Node ${node.Name} has no valid pivot point.`, path);
  }
  for (const node of nodes) {
    const path = `Nodes[${node.ObjectId}]`;
    if (node.Parent != null && node.Parent !== -1 && !ids.has(node.Parent)) add("error", "NODE_PARENT", `Node ${node.Name} references missing parent ${node.Parent}.`, path);
    const seen = /* @__PURE__ */ new Set([node.ObjectId]);
    let cursor = node;
    while (cursor && cursor.Parent != null && cursor.Parent !== -1) {
      if (seen.has(cursor.Parent)) {
        add("error", "HIERARCHY_CYCLE", `Node ${node.Name} would create a hierarchy cycle.`, path);
        break;
      }
      seen.add(cursor.Parent);
      cursor = ids.get(cursor.Parent);
    }
  }
  for (const [gi, g] of (model.Geosets || []).entries()) {
    const path = `Geosets[${gi}]`, count = (g.Vertices?.length || 0) / 3;
    if (!Number.isInteger(count) || !count) add("error", "VERTEX_COUNT", `Geoset ${gi} has invalid or empty vertex data.`, path);
    if (count > 65536) add("error", "FACE_INDEX_LIMIT", `Geoset ${gi} exceeds MDX's 16-bit face index capacity; split it into geosets.`, path);
    if (g.Normals?.length !== g.Vertices?.length) add("error", "NORMAL_COUNT", `Geoset ${gi} normals do not match its vertices.`, path);
    if (!ArrayBuffer.isView(g.Faces) || g.Faces.length % 3) add("error", "TRIANGLE_COUNT", `Geoset ${gi} has invalid triangle data.`, path);
    if (g.Faces?.some((index2) => index2 >= count || index2 < 0 || !Number.isInteger(index2))) add("error", "FACE_REFERENCE", `Geoset ${gi} contains a face with a missing vertex.`, path);
    if (!Number.isInteger(g.MaterialID) || !model.Materials?.[g.MaterialID]) add("error", "MATERIAL_REFERENCE", `Geoset ${gi} references missing material ${g.MaterialID}.`, path);
    if (!g.TVertices?.length) add("warning", "MISSING_UV", `Geoset ${gi} has no texture coordinates.`, path);
    if (g.TVertices?.length > 16) add("error", "UV_SET_LIMIT", `Geoset ${gi} exceeds the 16 UV set limit.`, path);
    for (const [uv, values] of (g.TVertices || []).entries()) if (values.length !== count * 2) add("error", "UV_COUNT", `Geoset ${gi} UV set ${uv} has a mismatched vertex count.`, `${path}.TVertices[${uv}]`);
    if (g.VertexGroup?.length !== count) add("error", "VERTEX_GROUP_COUNT", `Geoset ${gi} vertex groups do not match its vertices.`, path);
    if (g.VertexGroup?.some((index2) => index2 >= (g.Groups?.length || 0))) add("error", "GROUP_REFERENCE", `Geoset ${gi} references a missing matrix group.`, path);
    for (const id of new Set((g.Groups || []).flat())) if (!ids.has(id)) add("error", "BONE_REFERENCE", `Geoset ${gi} references missing matrix node ${id}.`, `${path}.Groups[${id}]`);
    if (g.SkinWeights?.length) {
      if (g.SkinWeights.length !== count * 8) add("error", "SKIN_COUNT", `Geoset ${gi} skin weights do not match its vertices.`, path);
      if (g.SkinWeights.some((value, index2) => !Number.isInteger(value) || value < 0 || value > (index2 % 8 < 4 && model.Version >= 1400 ? 65535 : 255))) add("error", "SKIN_VALUE_RANGE", `Geoset ${gi} skin indices or weights exceed their format range.`, path);
      const missing = /* @__PURE__ */ new Set();
      let invalidWeights = false;
      for (let i = 0; i < g.SkinWeights.length; i += 8) {
        let total = 0;
        for (let j = 0; j < 4; j++) {
          const weight = g.SkinWeights[i + 4 + j];
          total += weight;
          if (weight && !ids.has(g.SkinWeights[i + j])) missing.add(g.SkinWeights[i + j]);
        }
        if (total !== 255) invalidWeights = true;
      }
      for (const id of missing) add("error", "SKIN_BONE_REFERENCE", `Geoset ${gi} weights reference missing node ${id}.`, `${path}.SkinWeights[${id}]`);
      if (invalidWeights) add("warning", "SKIN_WEIGHT_SUM", `Geoset ${gi} has vertex weights that do not total 255.`, path);
    }
    if (g.Tangents?.length && g.Tangents.length !== count * 4) add("error", "TANGENT_COUNT", `Geoset ${gi} tangents do not match its vertices.`, path);
    let degenerate = 0;
    for (let i = 0; i < (g.Faces?.length || 0); i += 3) if (g.Faces[i] === g.Faces[i + 1] || g.Faces[i] === g.Faces[i + 2] || g.Faces[i + 1] === g.Faces[i + 2]) degenerate++;
    if (degenerate) add("warning", "DEGENERATE_FACES", `Geoset ${gi} has ${degenerate} triangles with repeated vertices.`, path);
  }
  const checkTexture = (id, path) => {
    if (id != null && id !== -1 && (!Number.isInteger(id) || !model.Textures?.[id])) add("error", "TEXTURE_REFERENCE", `${path} references missing texture ${id}.`, path);
  };
  for (const [mi, material] of (model.Materials || []).entries()) {
    if (!material.Layers?.length) add("error", "EMPTY_MATERIAL", `Material ${mi} needs at least one layer.`, `Materials[${mi}]`);
    for (const [li, layer] of (material.Layers || []).entries()) {
      const path = `Materials[${mi}].Layers[${li}]`;
      for (const slot of TEXTURE_SLOTS2) if (typeof layer[slot] === "number") checkTexture(layer[slot], `${path}.${slot}`);
      else if (layer[slot]?.Keys) for (const key of layer[slot].Keys) for (const id of key.Vector) checkTexture(id, `${path}.${slot}`);
      if (layer.TVertexAnimId != null && layer.TVertexAnimId !== -1 && !model.TextureAnims?.[layer.TVertexAnimId]) add("error", "TEXTURE_ANIM_REFERENCE", `${path} references a missing texture animation.`, path);
      if (typeof layer.Alpha === "number" && (layer.Alpha < 0 || layer.Alpha > 1)) add("warning", "ALPHA_RANGE", `${path} alpha is outside 0\u20131.`, path);
    }
  }
  for (const [i, anim] of (model.GeosetAnims || []).entries()) if (!model.Geosets?.[anim.GeosetId]) add("error", "GEOSET_ANIM_REFERENCE", `Geoset animation ${i} references missing geoset ${anim.GeosetId}.`, `GeosetAnims[${i}]`);
  for (const [i, glider] of (model.Gliders || []).entries()) if (!model.Geosets?.[glider.GeosetId]) add("error", "GLIDER_REFERENCE", `Glider ${i} references missing geoset ${glider.GeosetId}.`, `Gliders[${i}]`);
  for (const node of model.Bones || []) {
    if (node.GeosetId != null && node.GeosetId !== -1 && !model.Geosets?.[node.GeosetId]) add("error", "BONE_GEOSET_REFERENCE", `Bone ${node.Name} references missing geoset ${node.GeosetId}.`, `Nodes[${node.ObjectId}].GeosetId`);
    if (node.GeosetAnimId != null && node.GeosetAnimId !== -1 && !model.GeosetAnims?.[node.GeosetAnimId]) add("error", "BONE_GEOSET_ANIM_REFERENCE", `Bone ${node.Name} references a missing geoset animation.`, `Nodes[${node.ObjectId}].GeosetAnimId`);
  }
  for (const node of model.ParticleEmitters2 || []) checkTexture(node.TextureID, `Nodes[${node.ObjectId}].TextureID`);
  for (const node of model.RibbonEmitters || []) if (!model.Materials?.[node.MaterialID]) add("error", "RIBBON_MATERIAL_REFERENCE", `Ribbon ${node.Name} references a missing material.`, `Nodes[${node.ObjectId}].MaterialID`);
  for (const [i, sequence] of (model.Sequences || []).entries()) if (!sequence.Interval || sequence.Interval.length !== 2 || sequence.Interval[0] >= sequence.Interval[1]) add("error", "SEQUENCE_INTERVAL", `Sequence ${sequence.Name || i} must end after it starts.`, `Sequences[${i}]`);
  for (const [i, duration] of (model.GlobalSequences || []).entries()) if (!Number.isInteger(duration) || duration <= 0) add("error", "GLOBAL_SEQUENCE_DURATION", `Global sequence ${i} needs a positive integer duration.`, `GlobalSequences[${i}]`);
  for (const event of model.EventObjects || []) if (event.GlobalSeqId != null && event.GlobalSeqId !== -1 && (!Number.isInteger(event.GlobalSeqId) || event.GlobalSeqId < 0 || model.GlobalSequences?.[event.GlobalSeqId] === void 0)) add("error", "GLOBAL_SEQUENCE_REFERENCE", `Event ${event.Name} references missing global sequence ${event.GlobalSeqId}.`, `Nodes[${event.ObjectId}].GlobalSeqId`);
  const visited = /* @__PURE__ */ new Set();
  const valuePath = ["Model"];
  const location = () => valuePath.join(".");
  function walk(value) {
    if (typeof value === "number") {
      if (!Number.isFinite(value)) {
        const path = location();
        add("error", "NON_FINITE_NUMBER", `${path} contains a non-finite number.`, path);
      }
      return;
    }
    if (!value || typeof value !== "object" || visited.has(value)) return;
    visited.add(value);
    if (ArrayBuffer.isView(value)) {
      for (let i = 0; i < value.length; i++) if (!Number.isFinite(value[i])) {
        const path = location();
        add("error", "NON_FINITE_NUMBER", `${path} contains a non-finite coordinate.`, path);
        break;
      }
      return;
    }
    if (value.Keys) {
      const path = location();
      if (!Number.isInteger(value.LineType) || value.LineType < 0 || value.LineType > 3) add("error", "KEYFRAME_INTERPOLATION", `${path} has an invalid interpolation mode.`, path);
      if (value.GlobalSeqId != null && value.GlobalSeqId !== -1 && model.GlobalSequences?.[value.GlobalSeqId] === void 0) add("error", "GLOBAL_SEQUENCE_REFERENCE", `${path} references missing global sequence ${value.GlobalSeqId}.`, path);
      let previous = -Infinity;
      const property2 = valuePath.at(-1);
      const width = property2 === "Rotation" ? valuePath.includes("Cameras") ? 1 : 4 : ["Translation", "Scaling", "Color", "AmbColor", "FresnelColor", "TargetTranslation"].includes(property2) ? 3 : 1;
      for (const key of value.Keys) {
        if (!Number.isInteger(key.Frame) || key.Frame < -2147483648 || key.Frame > 2147483647 || key.Frame < previous) add("error", "KEYFRAME_ORDER", `${path} keyframes must use signed 32-bit integer frames in increasing order.`, path);
        previous = key.Frame;
        if (!key.Vector?.length) add("error", "KEYFRAME_VECTOR", `${path} has a keyframe without a value.`, path);
        else if (key.Vector.length !== width) add("error", "KEYFRAME_DIMENSIONS", `${path} keyframes need ${width} values.`, path);
        if (value.LineType >= 2 && (!key.InTan || !key.OutTan || key.InTan.length !== key.Vector?.length || key.OutTan.length !== key.Vector?.length)) add("error", "KEYFRAME_TANGENTS", `${path} spline keyframes need matching in/out tangents.`, path);
      }
    }
    for (const key in value) if (key !== "Nodes" && Object.prototype.hasOwnProperty.call(value, key)) {
      valuePath.push(key);
      walk(value[key]);
      valuePath.pop();
    }
  }
  if (numericSections) {
    for (const key of Object.keys(model)) if (key !== "Nodes" && numericSections.has(key)) {
      valuePath.push(key);
      walk(model[key]);
      valuePath.pop();
    }
    diagnostics.push(...previousDiagnostics.filter((issue) => issue.path?.startsWith("Model.") && !numericSections.has(issue.path.split(".")[1])));
  } else walk(model);
  return diagnostics;
}
function updateCounts(model) {
  for (const [field, key] of Object.entries({ NumGeosets: "Geosets", NumGeosetAnims: "GeosetAnims", NumBones: "Bones", NumHelpers: "Helpers", NumLights: "Lights", NumAttachments: "Attachments", NumEvents: "EventObjects", NumParticleEmitters: "ParticleEmitters", NumParticleEmitters2: "ParticleEmitters2", NumRibbonEmitters: "RibbonEmitters" })) model.Info[field] = model[key]?.length || 0;
}

// electron/optimizexl-validation.js
function validateOptimizeXLCopies(payload) {
  for (const bytes of [payload.before, payload.after]) {
    const doc = openDocument(new Uint8Array(bytes), "copy.mdx");
    if (doc.readOnly || doc.model.Version !== 800) throw Error("An OptimizeXL copy could not be reopened.");
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  validateOptimizeXLCopies
});
