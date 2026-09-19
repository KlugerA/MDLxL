/**
 * @typedef {object} PaintCoat
 * @property {'base'|'shade'|'detail'|'weathering'} id
 * @property {string} messageId
 * @property {string} name
 * @property {number} opacity
 * @property {boolean} visible
 * @property {{width:number,height:number,data:Uint8ClampedArray}} raster
 */

/**
 * @typedef {object} PaintTextureTarget
 * @property {string} id
 * @property {number} textureId
 * @property {string} texturePath
 * @property {number} flags
 * @property {{geosetIndex:number,materialId:number,layerIndex:number,coordId:number}[]} bindings
 * @property {PaintCoat[]} coats
 * @property {{width:number,height:number,data:Uint8ClampedArray}} alphaMask
 */

/**
 * @typedef {object} PaintStroke
 * @property {string} targetId
 * @property {string} coatId
 * @property {string} label
 * @property {{presetId:string,tipId:string|null,materialId:string|null}|null} brush
 * @property {{x:number,y:number,width:number,height:number,before:Uint8ClampedArray,after:Uint8ClampedArray,byteLength:number}} delta
 */

/** @typedef {{id:string,messageId:string,mode:'paint'|'wash'|'drybrush'|'texture'|'stamp'|'erase',size:number,hardness:number,opacity:number,flow:number,spacing:number}} BrushPresetV1 */
/** @typedef {{schema:'mdlxl-paint-assets',version:1,logicalAssetCount:number,assets:object[]}} PaintAssetManifestV1 */
/** @typedef {{schema:'mdlxl-paint-project',version:1,resolution:256|512,sourceMode:'current'|'primer',targets:PaintTextureTarget[],history:{undo:PaintStroke[],redo:PaintStroke[],usedBytes:number,budgetBytes:number,maxSteps:number}}} PaintProjectV1 */
/** @typedef {{geosetIndex:number,materialId:number,layerIndex:number,triangle:number,barycentric:number[],uv:number[],worldPosition:number[],normal:number[],depth:number,textureId:number|null,textureTarget:{textureId:number|null,texturePath:string,flags:number}}} PaintHit */

export const PAINT_PROJECT_SCHEMA = 'mdlxl-paint-project';
export const PAINT_PROJECT_VERSION = 1;
export const PAINT_ASSET_SCHEMA = 'mdlxl-paint-assets';
export const PAINT_ASSET_VERSION = 1;
export const PAINT_RESOLUTIONS = Object.freeze([256, 512]);
export const PAINT_CONTRACTS = Object.freeze({ PaintProjectV1: 1, PaintTextureTarget: 1, PaintCoat: 1, PaintStroke: 1, BrushPresetV1: 1, PaintAssetManifestV1: 1, PaintHit: 1 });

export const PAINT_COATS = Object.freeze([
  Object.freeze({ id: 'base', messageId: 'paint.coat.base', name: 'Base', opacity: 1 }),
  Object.freeze({ id: 'shade', messageId: 'paint.coat.shade', name: 'Shade', opacity: 1 }),
  Object.freeze({ id: 'detail', messageId: 'paint.coat.detail', name: 'Detail', opacity: 1 }),
  Object.freeze({ id: 'weathering', messageId: 'paint.coat.weathering', name: 'Weathering', opacity: 1 }),
]);

export const BRUSH_PRESETS = Object.freeze([
  Object.freeze({ id: 'round', messageId: 'paint.brush.round', name: 'Round', size: 28, hardness: .82, opacity: 1, flow: .72, spacing: .18, mode: 'paint' }),
  Object.freeze({ id: 'soft', messageId: 'paint.brush.soft', name: 'Soft', size: 42, hardness: .18, opacity: .55, flow: .3, spacing: .12, mode: 'paint' }),
  Object.freeze({ id: 'basecoat', messageId: 'paint.brush.basecoat', name: 'Basecoat', size: 54, hardness: .7, opacity: 1, flow: .9, spacing: .14, mode: 'paint', tipId: 'painted_bristle' }),
  Object.freeze({ id: 'wash', messageId: 'paint.brush.wash', name: 'Wash', size: 62, hardness: .08, opacity: .48, flow: .22, spacing: .1, mode: 'wash' }),
  Object.freeze({ id: 'drybrush', messageId: 'paint.brush.drybrush', name: 'Drybrush', size: 48, hardness: .62, opacity: .42, flow: .25, spacing: .2, mode: 'drybrush', tipId: 'painted_scumble' }),
  Object.freeze({ id: 'texture', messageId: 'paint.brush.texture', name: 'Texture', size: 44, hardness: .5, opacity: .7, flow: .5, spacing: .24, mode: 'texture', tipId: 'fine_grain' }),
  Object.freeze({ id: 'stamp', messageId: 'paint.brush.stamp', name: 'Stamp', size: 58, hardness: .9, opacity: 1, flow: 1, spacing: .8, mode: 'stamp', tipId: 'chipped_paint' }),
  Object.freeze({ id: 'eraser', messageId: 'paint.brush.eraser', name: 'Eraser', size: 34, hardness: .75, opacity: 1, flow: .8, spacing: .16, mode: 'erase' }),
]);

export function isPaintResolution(value) { return PAINT_RESOLUTIONS.includes(Number(value)); }
export function brushPreset(id) { return BRUSH_PRESETS.find(item => item.id === id) || BRUSH_PRESETS[0]; }
export function coatDefinition(id) { return PAINT_COATS.find(item => item.id === id) || PAINT_COATS[0]; }

export function normalizeBrushSettings(value = {}) {
  const preset = brushPreset(value.id);
  const bound = (input, min, max, fallback) => Number.isFinite(Number(input)) ? Math.max(min, Math.min(max, Number(input))) : fallback;
  return {
    id: preset.id,
    messageId: preset.messageId,
    name: preset.name,
    mode: preset.mode,
    size: bound(value.size, 1, 240, preset.size),
    hardness: bound(value.hardness, 0, 1, preset.hardness),
    opacity: bound(value.opacity, 0, 1, preset.opacity),
    flow: bound(value.flow, .01, 1, preset.flow),
    spacing: bound(value.spacing, .03, 2, preset.spacing),
    strength: bound(value.strength, 0, 1, 1),
    color: /^#[0-9a-f]{6}$/i.test(value.color) ? value.color.toLowerCase() : '#8f9f54',
    materialId: typeof value.materialId === 'string' ? value.materialId : null,
    tipId: value.tipId === null || typeof value.tipId === 'string' ? value.tipId : preset.tipId || null,
  };
}
