import { Buffer } from 'buffer';
import { parseMDX, generateMDX } from 'war3-model';
import { parseMdx } from './mdx-container.js';

// Boundary repairs for war3-model 4.0.1. The library still owns the model and
// ordinary chunks. Keep fields it cannot express beside their actual owner.
export const TEXTURE_SLOTS = ['TextureID', 'NormalTextureID', 'ORMTextureID', 'EmissiveTextureID', 'TeamColorTextureID', 'ReflectionsTextureID'];
const arrayBuffer = bytes => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
const u32 = value => { const b = Buffer.alloc(4); b.writeUInt32LE(value >>> 0); return b; };
const f32 = value => { const b = Buffer.alloc(4); b.writeFloatLE(value); return b; };
const floats = values => Buffer.concat(Array.from(values, f32));
const str = (value, length) => { const b = Buffer.alloc(length); b.write(value || '', 0, length, 'latin1'); return b; };
const readString = (b, at, length) => b.subarray(at, at + length).toString('latin1').split('\0')[0];
const vector = (b, at, count = 3) => Float32Array.from({ length: count }, (_, i) => b.readFloatLE(at + i * 4));
const sized = parts => { const b = Buffer.concat([u32(0), ...parts]); b.writeUInt32LE(b.length); return b; };
export const mdxChunk = (tag, payload) => Buffer.concat([Buffer.from(tag), u32(payload.length), payload]);

export function mdxRecords(payload, tag) {
  const records = [];
  for (let p = 0; p < payload.length;) {
    let size;
    if (tag === 'MODL') size = 372;
    else if (tag === 'SEQS') size = 132;
    else if (tag === 'TEXS') size = 268;
    else if (tag === 'PIVT') size = 12;
    else if (tag === 'GLBS' || tag === 'DILG') size = 4;
    else {
      if (p + 4 > payload.length) throw new Error(`Truncated ${tag} record.`);
      size = payload.readUInt32LE(p);
      if (tag === 'CAMS') size &= 0xffffff;
      if (tag === 'BONE') size += 8;
      if (tag === 'EVTS') {
        if (size < 96 || p + size + 12 > payload.length || payload.toString('ascii', p + size, p + size + 4) !== 'KEVT') throw new Error('Invalid event record.');
        size += 12 + payload.readUInt32LE(p + size + 4) * 4;
      }
      if (tag === 'CLID') {
        const shape = payload.readUInt32LE(p + size);
        if (shape > 3) throw new Error(`Unsupported collision shape ${shape}.`);
        size += 4 + (shape === 2 ? 12 : 24) + (shape >= 2 ? 4 : 0);
      }
    }
    if (size < 4 || p + size > payload.length) throw new Error(`Invalid ${tag} record size.`);
    records.push(payload.subarray(p, p + size)); p += size;
  }
  return records;
}

export function readTrack(b, at, width = 1, integer = false) {
  if (at + 16 > b.length) throw new Error('Truncated animation header.');
  const count = b.readUInt32LE(at + 4), LineType = b.readUInt32LE(at + 8), global = b.readInt32LE(at + 12);
  if (LineType > 3) throw new Error('Invalid animation interpolation.');
  const size = 16 + count * (4 + width * 4 * (LineType >= 2 ? 3 : 1));
  if (at + size > b.length) throw new Error('Truncated animation keys.');
  let p = at + 16;
  const Keys = [];
  for (let i = 0; i < count; i++) {
    const key = { Frame: b.readInt32LE(p) }; p += 4;
    for (const field of LineType >= 2 ? ['Vector', 'InTan', 'OutTan'] : ['Vector']) {
      const Type = integer ? Int32Array : Float32Array;
      key[field] = Type.from({ length: width }, () => { const n = integer ? b.readInt32LE(p) : b.readFloatLE(p); p += 4; return n; });
    }
    Keys.push(key);
  }
  return { track: { LineType, GlobalSeqId: global < 0 ? null : global, Keys }, size };
}
export function writeTrack(tag, track, integer = false) {
  if (!track?.Keys) return Buffer.alloc(0);
  return Buffer.concat([Buffer.from(tag), u32(track.Keys.length), u32(track.LineType), u32(track.GlobalSeqId ?? -1), ...track.Keys.flatMap(k => [u32(k.Frame), ...((track.LineType >= 2) ? [k.Vector, k.InTan, k.OutTan] : [k.Vector]).map(v => Buffer.concat(Array.from(v, integer ? u32 : f32)))])]);
}
const materialTracks = { KMTA: ['Alpha', 1], KMTF: ['TextureID', 1, true], KMTE: ['EmissiveGain', 1], KFC3: ['FresnelColor', 3], KFCA: ['FresnelOpacity', 1], KFTC: ['FresnelTeamColor', 1] };
const lightTracks = { KLAS: ['AttenuationStart', 1], KLAE: ['AttenuationEnd', 1], KLAC: ['Color', 3], KLAI: ['Intensity', 1], KLBC: ['AmbColor', 3], KLBI: ['AmbIntensity', 1], KLAV: ['Visibility', 1], KLSS: ['ShadowCastingStart', 1], KLSE: ['ShadowCastingEnd', 1], KLQF: ['QuadraticFalloff', 1], KLLF: ['LinearFalloff', 1], KLDA: ['Damping', 1] };
const ribbonTracks = { KRHA: ['HeightAbove', 1], KRHB: ['HeightBelow', 1], KRAL: ['Alpha', 1], KRCO: ['Color', 3], KRTX: ['TextureSlot', 1, true], KRVS: ['Visibility', 1] };
const cameraTracks = { KCTR: ['Translation', 3], KCRL: ['Rotation', 1], KTTR: ['TargetTranslation', 3], KCVS: ['Visibility', 1], IDUF: ['FocusDistance', 1], ELAF: ['FocalLength', 1], PTSF: ['FStop', 1] };
const emitterBases = {
  PREM: {key:'ParticleEmitters',fields:[['EmissionRate',0],['Gravity',4],['Longitude',8],['Latitude',12],['LifeSpan',276],['InitVelocity',280]]},
  PRE2: {key:'ParticleEmitters2',fields:[['Speed',0],['Variation',4],['Latitude',8],['Gravity',12],['EmissionRate',20],['Width',24],['Length',28]]},
  CORN: {key:'ParticleEmitterPopcorns',fields:[['LifeSpan',0],['EmissionRate',4],['Speed',8],['Color',12,3],['Alpha',24]]},
};
function readTracks(b, at, owner, schema) {
  for (let p = at; p < b.length;) {
    const tag = b.toString('ascii', p, p + 4), def = schema[tag];
    if (!def) throw new Error(`Unsupported animation ${tag}.`);
    const [key, width, integer] = def;
    const { track, size } = readTrack(b, p, width, integer);
    if (owner[key]?.Keys) throw new Error(`Duplicate animation ${tag}.`);
    if (owner[key] != null) (owner._MdxDefaults ||= {})[key] = owner[key];
    owner[key] = track; p += size;
  }
}
const writeTracks = (owner, schema) => Object.entries(schema).map(([tag, [key, , integer]]) => writeTrack(tag, owner[key], integer));
const base = (owner, key, fallback = 0) => owner[key]?.Keys ? (owner._MdxDefaults?.[key] ?? fallback) : (owner[key] ?? fallback);

function readMaterials(payload, version) {
  return mdxRecords(payload, 'MTLS').map(b => {
    const m = { PriorityPlane: b.readInt32LE(4), RenderMode: b.readUInt32LE(8), Layers: [] };
    let p = 12;
    if (version >= 900 && version < 1100) { m.Shader = readString(b, p, 80); p += 80; }
    if (b.toString('ascii', p, p + 4) !== 'LAYS') throw new Error('Missing material layers.');
    const count = b.readUInt32LE(p + 4); p += 8;
    for (let i = 0; i < count; i++) {
      const size = b.readUInt32LE(p), l = b.subarray(p, p + size);
      if (size < 28 || p + size > b.length) throw new Error('Invalid layer size.');
      const layer = { FilterMode: l.readUInt32LE(4), Shading: l.readUInt32LE(8), TextureID: l.readInt32LE(12), TVertexAnimId: l.readInt32LE(16), CoordId: l.readUInt32LE(20), Alpha: l.readFloatLE(24) };
      if (layer.TVertexAnimId === -1) layer.TVertexAnimId = null;
      let q = 28;
      if (version >= 900) { layer.EmissiveGain = l.readFloatLE(q); q += 4; }
      if (version >= 1000) { layer.FresnelColor = vector(l, q); layer.FresnelOpacity = l.readFloatLE(q + 12); layer.FresnelTeamColor = l.readFloatLE(q + 16); q += 20; }
      if (version >= 1100) {
        layer._MdxTextureId = layer.TextureID; delete layer.TextureID;
        layer.ShaderTypeId = l.readUInt32LE(q); const slots = l.readUInt32LE(q + 4); q += 8;
        layer._MdxSlots = [];
        for (let j = 0; j < slots; j++) {
          const id = l.readInt32LE(q), slot = l.readUInt32LE(q + 4), key = TEXTURE_SLOTS[slot]; q += 8;
          if (!key || layer._MdxSlots.includes(slot)) throw new Error(`Unsupported or duplicate texture slot ${slot}.`);
          layer._MdxSlots.push(slot); layer[key] = id;
          if (q + 4 <= l.length && l.toString('ascii', q, q + 4) === 'KMTF') {
            const { track, size: n } = readTrack(l, q, 1, true); (layer._MdxDefaults ||= {})[key] = id; layer[key] = track; q += n;
          }
        }
      }
      readTracks(l, q, layer, materialTracks); m.Layers.push(layer); p += size;
    }
    if (p !== b.length) throw new Error('Unrecognized material tail.');
    return m;
  });
}
function writeMaterials(materials, version) {
  return Buffer.concat(materials.map(m => sized([u32(m.PriorityPlane), u32(m.RenderMode), ...(version >= 900 && version < 1100 ? [str(m.Shader, 80)] : []), Buffer.from('LAYS'), u32(m.Layers.length), ...m.Layers.map(l => {
    const parts = [u32(l.FilterMode), u32(l.Shading), u32(version >= 1100 ? l._MdxTextureId ?? 0 : base(l, 'TextureID')), u32(l.TVertexAnimId ?? -1), u32(l.CoordId), f32(base(l, 'Alpha', 1))];
    if (version >= 900) parts.push(f32(base(l, 'EmissiveGain', 1)));
    if (version >= 1000) parts.push(floats(base(l, 'FresnelColor', [1, 1, 1])), f32(base(l, 'FresnelOpacity')), f32(base(l, 'FresnelTeamColor')));
    if (version >= 1100) {
      const slots = [...new Set([...(l._MdxSlots || []), ...TEXTURE_SLOTS.map((_, i) => i)])].filter(i => l[TEXTURE_SLOTS[i]] != null);
      parts.push(u32(l.ShaderTypeId), u32(slots.length));
      for (const slot of slots) { const key = TEXTURE_SLOTS[slot]; parts.push(u32(base(l, key)), u32(slot), writeTrack('KMTF', l[key], true)); }
    }
    parts.push(...writeTracks(l, Object.fromEntries(Object.entries(materialTracks).filter(([tag]) => tag !== 'KMTF' || version < 1100))));
    return sized(parts);
  })])));
}

function geosetLayout(b, version) {
  const spans = {}; let p = 4;
  const take = (tag, width) => {
    if (b.toString('ascii', p, p + 4) !== tag) throw new Error(`Missing geoset ${tag}.`);
    const start = p, count = b.readUInt32LE(p + 4); p += 8 + count * width;
    if (p > b.length) throw new Error(`Truncated geoset ${tag}.`);
    spans[tag] = { start, end: p, count };
  };
  for (const [tag, width] of [['VRTX',12],['NRMS',12],['PTYP',4],['PCNT',4],['PVTX',2],['GNDX',1],['MTGC',4],['MATS',4]]) take(tag, width);
  spans.selection = p + 8; p += 12 + (version >= 900 ? 84 : 0) + 28;
  const anims = b.readUInt32LE(p); p += 4 + anims * 28;
  while (p < b.length) {
    const tag = b.toString('ascii', p, p + 4);
    if (tag === 'TANG') take(tag, 16);
    else if (tag === 'SKIN') take(tag, version >= 1400 ? 2 : 1);
    else if (tag === 'UVAS') break;
    else throw new Error(`Unsupported geoset subchunk ${tag}.`);
  }
  return spans;
}
function replaceSpans(b, changes) {
  const out = []; let p = 0;
  for (const { start, end, data } of changes.sort((a,b) => a.start-b.start)) { out.push(b.subarray(p, start), data); p = end; }
  out.push(b.subarray(p)); return Buffer.concat(out);
}
function readSpecialNode(b, tag, version, node) {
  let p = 4 + b.readUInt32LE(4);
  const n = node || {};
  const read = (key, width = 1, integer = false) => { n[key] = width === 3 ? vector(b, p) : integer ? b.readUInt32LE(p) : b.readFloatLE(p); p += width * 4; };
  if (tag === 'LITE') {
    read('LightType', 1, true); if (version >= 1300) read('ShadowCasting', 1, true);
    read('AttenuationStart'); read('AttenuationEnd'); read('Color', 3); read('Intensity'); read('AmbColor', 3); read('AmbIntensity');
    if (version >= 1200) read('ShadowIntensity');
    if (version >= 1300) { read('ShadowCastingStart'); read('ShadowCastingEnd'); }
    if (version >= 1600) { read('QuadraticFalloff'); read('LinearFalloff'); read('Damping'); }
    readTracks(b, p, n, lightTracks);
  } else {
    for (const [key, width, int] of [['HeightAbove',1],['HeightBelow',1],['Alpha',1],['Color',3],['LifeSpan',1],['TextureSlot',1,true],['EmissionRate',1,true],['Rows',1,true],['Columns',1,true],['MaterialID',1,true],['Gravity',1]]) read(key,width,int);
    readTracks(b, p, n, ribbonTracks);
  }
  return n;
}
function writeSpecialNode(b, n, tag, version) {
  const parts = [b.subarray(4, 4 + b.readUInt32LE(4))];
  const write = (key, width = 1, integer = false, fallback = 0) => parts.push(width === 3 ? floats(base(n,key,[1,1,1])) : integer ? u32(base(n,key,fallback)) : f32(base(n,key,fallback)));
  if (tag === 'LITE') {
    write('LightType',1,true); if (version >= 1300) write('ShadowCasting',1,true);
    write('AttenuationStart'); write('AttenuationEnd'); write('Color',3); write('Intensity'); write('AmbColor',3); write('AmbIntensity');
    if (version >= 1200) write('ShadowIntensity');
    if (version >= 1300) { write('ShadowCastingStart'); write('ShadowCastingEnd'); }
    if (version >= 1600) { write('QuadraticFalloff',1,false,0.0005); write('LinearFalloff'); write('Damping',1,false,0.00001); }
    parts.push(...writeTracks(n,lightTracks));
  } else {
    for (const [key,width,int] of [['HeightAbove',1],['HeightBelow',1],['Alpha',1],['Color',3],['LifeSpan',1],['TextureSlot',1,true],['EmissionRate',1,true],['Rows',1,true],['Columns',1,true],['MaterialID',1,true],['Gravity',1]]) write(key,width,int);
    parts.push(...writeTracks(n,ribbonTracks));
  }
  return sized(parts);
}
function readCamera(b) {
  const Variant = b.readUInt32LE(0) >>> 24, extra = Variant === 1 || Variant === 2;
  const c = { Variant, Name: readString(b,4,80), Position: vector(b,84), FieldOfView: b.readFloatLE(96), FarClip: b.readFloatLE(100), NearClip: b.readFloatLE(104), TargetPosition: vector(b,extra ? 120 : 108) };
  if (extra) c.VariantData = new Uint8Array(b.subarray(108,120));
  readTracks(b, extra ? 132 : 120, c, cameraTracks); return c;
}
function writeCamera(c) {
  const variant = c.Variant || 0;
  const b = sized([str(c.Name,80),floats(c.Position),f32(c.FieldOfView),f32(c.FarClip),f32(c.NearClip), ...([1,2].includes(variant) ? [Buffer.from(c.VariantData || new Uint8Array(12))] : []),floats(c.TargetPosition),...writeTracks(c,cameraTracks)]);
  if (b.length > 0xffffff) throw new Error('Camera exceeds its 24-bit size field.');
  b.writeUInt32LE((b.length | variant << 24) >>> 0); return b;
}

export function parseCompatibleMdx(input) {
  const bytes = Buffer.from(input), container = parseMdx(bytes), version = container.version;
  if(container.chunks.some(c=>c.tag==='SNEM'))throw new Error('Sound-emitter nodes are not supported; preserving the original file is required to retain their node and pivot references');
  if(container.chunks.filter(c=>c.tag==='VERS').length>1)throw new Error('Repeated version chunks cannot be edited safely');
  const originals = new Map(), parts = [Buffer.from('MDLX'), mdxChunk('VERS', u32(version))];
  for (const c of container.chunks) {
    const payload = bytes.subarray(c.payloadOffset, c.payloadOffset+c.declaredSize);
    if (c.tag === 'VERS') continue;
    if (originals.has(c.tag)) throw new Error(`Duplicate ${c.tag} chunks cannot be edited safely.`);
    originals.set(c.tag,payload);
    if (['MTLS','LITE','RIBB','CAMS','CLID'].includes(c.tag)) {
      if (['LITE','RIBB','CLID'].includes(c.tag)) {
        const nodes = mdxRecords(payload,c.tag).map(b => { const at = c.tag === 'CLID' ? 0 : 4; return b.subarray(at,at+b.readUInt32LE(at)); });
        parts.push(mdxChunk('HELP',Buffer.concat(nodes)));
      }
      continue;
    }
    if (c.tag === 'GEOS') {
      const gs = mdxRecords(payload,'GEOS').map(b => {
        const spans = geosetLayout(b,version), changes = [];
        if (version >= 1400 && spans.SKIN) {
          const s = spans.SKIN, data = Buffer.alloc(8+s.count); b.copy(data,0,s.start,s.start+8);
          for (let i=0;i<s.count;i++) data[8+i] = b.readUInt16LE(s.start+8+i*2) & 255;
          changes.push({...s,data});
        }
        const out = replaceSpans(b,changes); out.writeUInt32LE(out.length); return out;
      });
      parts.push(mdxChunk('GEOS',Buffer.concat(gs))); continue;
    }
    parts.push(mdxChunk(c.tag,payload));
  }
  const model = parseMDX(arrayBuffer(Buffer.concat(parts)));
  if(originals.has('DILG'))model.Gliders=mdxRecords(originals.get('DILG'),'DILG').map(b=>({GeosetId:b.readUInt32LE(0)}));
  if (originals.has('MTLS')) model.Materials = readMaterials(originals.get('MTLS'),version);
  for (const [tag,key] of [['LITE','Lights'],['RIBB','RibbonEmitters'],['CLID','CollisionShapes']]) if (originals.has(tag)) {
    model[key] = mdxRecords(originals.get(tag),tag).map(b => {
      const at = tag === 'CLID' ? 0 : 4, id = b.readInt32LE(at+84), n = model.Nodes[id];
      model.Helpers = model.Helpers.filter(h => h !== n);
      if (tag !== 'CLID') return readSpecialNode(b,tag,version,n);
      let p = b.readUInt32LE(0); n.Shape = b.readUInt32LE(p); p += 4;
      const count = n.Shape === 2 ? 3 : 6; n.Vertices = vector(b,p,count); p += count*4;
      if (n.Shape >= 2) n.BoundsRadius = b.readFloatLE(p); return n;
    });
  }
  if (originals.has('CAMS')) model.Cameras = mdxRecords(originals.get('CAMS'),'CAMS').map(readCamera);
  const info = originals.get('MODL');
  if (info) { model.Info.Name = readString(info,0,80); model.Info.AnimationFile = readString(info,80,260); }
  for (const [i,b] of mdxRecords(originals.get('SEQS') || Buffer.alloc(0),'SEQS').entries()) { model.Sequences[i].SyncPoint = b.readUInt32LE(100); model.Sequences[i].Flags = b.readUInt32LE(92); model.Sequences[i].NonLooping = !!(model.Sequences[i].Flags & 1); }
  for (const [i,b] of mdxRecords(originals.get('TEXS') || Buffer.alloc(0),'TEXS').entries()) model.Textures[i].Image = readString(b,4,260);
  for (const [tag,key,offset] of [['ATCH','Attachments',0],['PREM','ParticleEmitters',16]]) {
    for (const [i,b] of mdxRecords(originals.get(tag) || Buffer.alloc(0),tag).entries()) model[key][i].Path = readString(b,4+b.readUInt32LE(4)+offset,260);
  }
  for (const event of model.EventObjects) event.EventTrack = Int32Array.from(event.EventTrack);
  for (const [i,b] of mdxRecords(originals.get('GEOS') || Buffer.alloc(0),'GEOS').entries()) {
    const g = model.Geosets[i], s = geosetLayout(b,version);
    g.PrimitiveTypes = Uint32Array.from({length:s.PTYP.count},(_,j)=>b.readUInt32LE(s.PTYP.start+8+j*4));
    g.PrimitiveCounts = Uint32Array.from({length:s.PCNT.count},(_,j)=>b.readUInt32LE(s.PCNT.start+8+j*4));
    g.SelectionFlags = b.readUInt32LE(s.selection); g.Unselectable = !!(g.SelectionFlags & 4);
    if (version >= 1400 && s.SKIN) g.SkinWeights = Uint16Array.from({length:s.SKIN.count},(_,j)=>b.readUInt16LE(s.SKIN.start+8+j*2));
  }
  // Retain the otherwise overwritten static bases behind animated properties.
  for (const [i,b] of mdxRecords(originals.get('GEOA') || Buffer.alloc(0),'GEOA').entries()) {
    const a = model.GeosetAnims[i];
    if (a.Alpha?.Keys) (a._MdxDefaults ||= {}).Alpha = b.readFloatLE(4);
    if (a.Color?.Keys) (a._MdxDefaults ||= {}).Color = vector(b,12);
  }
  for(const [tag,{key,fields}]of Object.entries(emitterBases))for(const [i,b]of mdxRecords(originals.get(tag)||Buffer.alloc(0),tag).entries()){
    const owner=model[key][i],at=4+b.readUInt32LE(4);
    for(const [field,offset,width]of fields)if(owner[field]?.Keys)(owner._MdxDefaults||={})[field]=width===3?vector(b,at+offset):b.readFloatLE(at+offset);
  }
  return model;
}

export function generateCompatibleMdx(inputModel) {
  const model={...inputModel};
  // MDL permits static visibility; MDX has only a visibility track. Materialize
  // it only for binary export, leaving the authored MDL and editor value alone.
  for(const key of ['Attachments','Lights','ParticleEmitters','ParticleEmitters2','RibbonEmitters','ParticleEmitterPopcorns','Cameras'])model[key]=(model[key]||[]).map(n=>{
    if(typeof n.Visibility!=='number')return n;
    const frames=[...new Set([0,...(model.Sequences||[]).flatMap(s=>Array.from(s.Interval))])].sort((a,b)=>a-b);
    return {...n,Visibility:{LineType:0,GlobalSeqId:null,Keys:frames.map(Frame=>({Frame,Vector:Float32Array.of(n.Visibility)}))}};
  });
  // Unsupported library fields are handled below, never fed to a wrong codec.
  const safe = { ...model, Materials: [], Lights: model.Lights.map(n=>({...n,AttenuationStart:0,AttenuationEnd:0})), RibbonEmitters: model.RibbonEmitters.map(n=>({...n,Color:new Float32Array([1,1,1])})), Cameras: [], CollisionShapes: model.CollisionShapes.map(n=>({...n,Shape:0,Vertices:new Float32Array(6)})), BindPoses:model.BindPoses?.length ? model.BindPoses : undefined };
  const bytes = Buffer.from(generateMDX(safe)), container = parseMdx(bytes), parts = [Buffer.from('MDLX')];
  if (container.hasErrors) throw new Error('Invalid generated MDX structure.');
  const emitted = new Set();
  for (const c of container.chunks) {
    let payload = Buffer.from(bytes.subarray(c.payloadOffset,c.payloadOffset+c.declaredSize)); emitted.add(c.tag);
    if (c.tag === 'MODL') { str(model.Info.Name,80).copy(payload,0); str(model.Info.AnimationFile,260).copy(payload,80); }
    if (c.tag === 'SEQS') model.Sequences.forEach((s,i)=>{payload.writeUInt32LE(s.SyncPoint || 0,i*132+100);payload.writeUInt32LE((((s.Flags || 0)&~1)|(s.NonLooping?1:0))>>>0,i*132+92);});
    if (c.tag === 'TEXS') model.Textures.forEach((t,i)=>str(t.Image,260).copy(payload,i*268+4));
    if (c.tag === 'CAMS') payload = Buffer.concat(model.Cameras.map(writeCamera));
    if (['LITE','RIBB','CLID','ATCH','PREM','PRE2','CORN','GEOS','GEOA'].includes(c.tag)) {
      const key = {LITE:'Lights',RIBB:'RibbonEmitters',CLID:'CollisionShapes',ATCH:'Attachments',PREM:'ParticleEmitters',PRE2:'ParticleEmitters2',CORN:'ParticleEmitterPopcorns',GEOS:'Geosets',GEOA:'GeosetAnims'}[c.tag];
      payload = Buffer.concat(mdxRecords(payload,c.tag).map((b,i)=>{
        const n = model[key][i];
        if(emitterBases[c.tag]){
          const at=4+b.readUInt32LE(4);
          for(const [field,offset,width]of emitterBases[c.tag].fields)if(n[field]?.Keys&&n._MdxDefaults?.[field]!=null){const value=n._MdxDefaults[field];if(width===3)floats(value).copy(b,at+offset);else b.writeFloatLE(value,at+offset);}
          if(c.tag!=='PREM')return b;
        }
        if (c.tag === 'LITE' || c.tag === 'RIBB') return writeSpecialNode(b,n,c.tag,model.Version);
        if (c.tag === 'CLID') return Buffer.concat([b.subarray(0,b.readUInt32LE(0)),u32(n.Shape),floats(n.Vertices),...(n.Shape>=2?[f32(n.BoundsRadius)]:[])]);
        if (c.tag === 'ATCH' || c.tag === 'PREM') { str(n.Path,260).copy(b,4+b.readUInt32LE(4)+(c.tag === 'PREM'?16:0)); return b; }
        if (c.tag === 'GEOA') {
          if (n.Alpha?.Keys) b.writeFloatLE(base(n,'Alpha',1),4);
          if (n.Color?.Keys) floats(base(n,'Color',[1,1,1])).copy(b,12);
          return b;
        }
        const s = geosetLayout(b,Math.min(model.Version,1100)), changes = [];
        b.writeUInt32LE((((n.SelectionFlags || 0)&~4)|(n.Unselectable?4:0))>>>0,s.selection);
        if (n.PrimitiveCounts && Array.from(n.PrimitiveCounts).reduce((a,v)=>a+v,0) === n.Faces.length) {
          for (const [tag,values] of [['PTYP',n.PrimitiveTypes],['PCNT',n.PrimitiveCounts]]) changes.push({...s[tag],data:Buffer.concat([Buffer.from(tag),u32(values.length),...Array.from(values,u32)])});
        }
        if (model.Version >= 1400 && s.SKIN) {
          const data = Buffer.alloc(8+n.SkinWeights.length*2); data.write('SKIN'); data.writeUInt32LE(n.SkinWeights.length,4);
          n.SkinWeights.forEach((v,j)=>data.writeUInt16LE(v,8+j*2)); changes.push({...s.SKIN,data});
        }
        const out = replaceSpans(b,changes); out.writeUInt32LE(out.length); return out;
      }));
    }
    parts.push(mdxChunk(c.tag,payload));
  }
  if (model.Materials.length) parts.push(mdxChunk('MTLS',writeMaterials(model.Materials,model.Version)));
  if (!emitted.has('CAMS') && model.Cameras.length) parts.push(mdxChunk('CAMS',Buffer.concat(model.Cameras.map(writeCamera))));
  if(model.Gliders?.length)parts.push(mdxChunk('DILG',Buffer.concat(model.Gliders.map(g=>u32(g.GeosetId)))));
  return Buffer.concat(parts);
}
