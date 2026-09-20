import { Buffer } from 'buffer';
import { parseMdl } from './mdl-lossless.js';
import { TEXTURE_SLOTS } from './mdx-compatibility.js';

const trivia = new Set(['whitespace','line-comment','block-comment']);
const raw = t => t?.raw.toString('utf8');
const numeric = t => /^(?:[+-]?(?:\d|\.)|[+-]?(?:nan|inf(?:inity)?)$)/i.test(raw(t) || '');
const number = t => /^[-+]?nan$/i.test(raw(t)) ? NaN : /^[+]?inf(?:inity)?$/i.test(raw(t)) ? Infinity : /^-inf(?:inity)?$/i.test(raw(t)) ? -Infinity : Number(raw(t));
const spelling = n => Number.isNaN(n) ? 'nan' : n === Infinity ? 'inf' : n === -Infinity ? '-inf' : Object.is(n,-0) ? '-0' : String(n);

// Syntax-only member tree. Quoted paths and comments are never searched as code.
export function mdlMembers(input) {
  const bytes = Buffer.from(input), tokens = parseMdl(bytes).tokens.filter(t=>!trivia.has(t.kind));
  // The lossless lexer intentionally treats '-' and 'inf' separately.
  for (let i=tokens.length-2;i>=0;i--) if (raw(tokens[i]) === '-' && /^inf(?:inity)?$/i.test(raw(tokens[i+1]))) tokens.splice(i,2,{...tokens[i],end:tokens[i+1].end,raw:Buffer.from('-inf')});
  let at = 0;
  function list(stop = false) {
    const out = [];
    while (at < tokens.length && (!stop || raw(tokens[at]) !== '}')) {
      if (raw(tokens[at]) === ',') { at++; continue; }
      const first = at, header = [];
      while (at < tokens.length && !['{','}',','].includes(raw(tokens[at]))) header.push(tokens[at++]);
      let children = null, open = null, close = null;
      if (raw(tokens[at]) === '{') { open = tokens[at++]; children = list(true); close=tokens[at++]; if (raw(close)!=='}') throw new Error('Unterminated MDL member.'); }
      else if (raw(tokens[at]) === '}') { if (at === first) break; }
      if (raw(tokens[at]) === ',') at++;
      if (at === first) throw new Error('Invalid MDL member.');
      const isStatic = raw(header[0]) === 'static', name = raw(header[isStatic?1:0]) || '';
      out.push({name,isStatic,header,children,open,close,start:tokens[first].start,end:tokens[at-1].end,tokens:tokens.slice(first,at)});
    }
    return out;
  }
  return { bytes, members:list() };
}
const valueTokens = m => m.tokens.filter(t=>numeric(t));
const numbers = m => valueTokens(m).map(number);
function property(m, integer = false, reverse = false) {
  if (!m.children) {
    const string = m.header.find(t=>t.kind==='string');
    return string ? raw(string).slice(1,-1) : number(m.header[m.isStatic?2:1]);
  }
  const line = m.children.find(c=>['DontInterp','Linear','Hermite','Bezier'].includes(c.name));
  const Type = integer ? Int32Array : Float32Array;
  if (!line) { const v = Type.from(numbers({...m,tokens:m.tokens.filter(t=>t.start>m.open.start)})); return reverse ? v.reverse() : v; }
  const track = {LineType:['DontInterp','Linear','Hermite','Bezier'].indexOf(line.name),GlobalSeqId:null,Keys:[]};
  for (const c of m.children) {
    if (c.name==='GlobalSeqId') track.GlobalSeqId = property(c);
    else if (c.header.some(t=>raw(t)===':')) {
      const colon=c.header.find(t=>raw(t)===':');
      const vals = numbers({...c,tokens:c.tokens.filter(t=>t.start>(c.open?.start ?? colon.start))}), v = Type.from(vals);
      track.Keys.push({Frame:number(c.header[0]),Vector:reverse?v.reverse():v});
    } else if (['InTan','OutTan'].includes(c.name) && track.Keys.length) {
      const v = Type.from(numbers(c)); track.Keys.at(-1)[c.name] = reverse?v.reverse():v;
    }
  }
  return track;
}
function replace(bytes, edits) {
  const parts=[]; let p=0;
  for (const e of edits.sort((a,b)=>a.start-b.start || b.end-a.end)) { if(e.start<p) continue; parts.push(bytes.subarray(p,e.start),Buffer.from(e.text)); p=e.end; }
  parts.push(bytes.subarray(p)); return Buffer.concat(parts);
}
const rootKeys = {Model:'Info',Sequences:'Sequences',GlobalSequences:'GlobalSequences',Textures:'Textures',Materials:'Materials',TextureAnims:'TextureAnims',Geoset:'Geosets',GeosetAnim:'GeosetAnims',Bone:'Bones',Helper:'Helpers',Light:'Lights',Attachment:'Attachments',EventObject:'EventObjects',CollisionShape:'CollisionShapes',ParticleEmitter:'ParticleEmitters',ParticleEmitter2:'ParticleEmitters2',RibbonEmitter:'RibbonEmitters',ParticleEmitterPopcorn:'ParticleEmitterPopcorns',Camera:'Cameras',PivotPoints:'PivotPoints',FaceFX:'FaceFX',BindPose:'BindPoses'};
const containers = {Sequences:'Anim',Textures:'Bitmap',Materials:'Material',TextureAnims:'TVertexAnim'};
function owners(members,model,visit) {
  const indices={};
  for(const m of members) {
    const key=rootKeys[m.name]; if(!key)continue;
    if(containers[m.name]) (m.children||[]).filter(c=>c.name===containers[m.name]).forEach((c,i)=>visitOwner(c,model[key]?.[i],visit));
    else if(['Model','PivotPoints'].includes(m.name)) visitOwner(m,model[key],visit);
    else if(m.name!=='GlobalSequences') { const i=indices[key]||0;indices[key]=i+1;visitOwner(m,model[key]?.[i],visit); }
  }
}
function visitOwner(m,owner,visit) {
  if(!owner)return; visit(m,owner);
  if(m.name==='Material') (m.children||[]).filter(c=>c.name==='Layer').forEach((c,i)=>visitOwner(c,owner.Layers?.[i],visit));
  if(m.name==='Geoset') (m.children||[]).filter(c=>c.name==='Anim').forEach((c,i)=>visitOwner(c,owner.Anims?.[i],visit));
  if(m.name==='ParticleEmitter') for(const c of m.children||[]) if(c.name==='Particle') visit(c,owner);
  if(m.name==='Camera') for(const c of m.children||[]) if(c.name==='Target') visit(c,{Position:owner.TargetPosition,Translation:owner.TargetTranslation});
}
const layerFlags = {WrapWidth:4,WrapHeight:8,Unlit:0x100,BackFacesForShadows:0x200,AmbientOcclusion:0x400};
const materialFlags = {SortPrimsNearZ:8,TwoSided:2};
const nodeFlags = {DontInheritTranslation:1,DontInheritRotation:2,DontInheritScaling:4,Billboarded:8,BillboardedLockX:16,BillboardedLockY:32,BillboardedLockZ:64,CameraAnchored:128};
const shaderIds = {shader_sd_legacy:0,shader_hd_defaultunit:1,shader_sd_fixedfunction:2,shader_hd_crystal:24};
const extensionFields = new Set(['SyncPoint','SelectionFlags','ShadowIntensity','ShadowCasting','ShadowCastingStart','ShadowCastingEnd','QuadraticFalloff','LinearFalloff','Damping']);
const cameraFields={DOFDistance:'FocusDistance',FocusDistanceKeys:'FocusDistance',FocalLength:'FocalLength',FocalLengthKeys:'FocalLength',FStop:'FStop',FStopKeys:'FStop'};
const fieldVersions={ShadowIntensity:1200,ShadowCasting:1300,ShadowCastingStart:1300,ShadowCastingEnd:1300,QuadraticFalloff:1600,LinearFalloff:1600,Damping:1600};

export function prepareCompatibleMdl(input) {
  const tree=mdlMembers(input), edits=[];
  function walk(m,parent) {
    const remove=()=>edits.push({start:m.start,end:m.end,text:''});
    if(m.name==='Glider'){remove();return;}
    if(m.name==='Visibility' && m.isStatic && !m.children){remove();return;}
    if(parent==='ParticleEmitter' && ['Path','LifeSpan','InitVelocity'].includes(m.name)) {
      edits.push({start:m.start,end:m.end,text:`Particle { ${tree.bytes.subarray(m.start,m.end).toString('utf8')} }`});return;
    }
    if(m.name==='DontInherit') {
      remove();return;
    }
    if(m.name in nodeFlags && m.name.startsWith('DontInherit')) {remove();return;}
    if(m.name==='SortPrimitives') edits.push({start:m.header[0].start,end:m.header[0].end,text:'SortPrimsFarZ'});
    if(m.name==='LevelOfDetailName') edits.push({start:m.header[0].start,end:m.header[0].end,text:'Name'});
    if(m.name==='EmitterUsesMdl'||m.name==='EmitterUsesTga') edits.push({start:m.header[0].start,end:m.header[0].end,text:m.name==='EmitterUsesMdl'?'EmitterUsesMDL':'EmitterUsesTGA'});
    if(extensionFields.has(m.name) || parent==='Layer' && m.name in layerFlags || parent==='Material' && (m.name in materialFlags || m.name==='Unfogged') || m.name==='PopcornScaling') {remove();return;}
    if(parent==='Layer' && m.name==='Shader') {
      const name=property(m).toLowerCase(); if(!(name in shaderIds)) throw new Error(`Unknown layer shader ${name}.`);
      edits.push({start:m.start,end:m.end,text:`ShaderTypeId ${shaderIds[name]},`});return;
    }
    if(parent==='RibbonEmitter' && m.name==='Color' && !m.isStatic && m.children?.some(c=>['DontInterp','Linear','Hermite','Bezier'].includes(c.name))) {remove();return;}
    if(parent==='Camera' && (m.name==='Visibility'||m.name in cameraFields)) {remove();return;}
    if(m.name==='Plane'||m.name==='Cylinder') edits.push({start:m.start,end:m.end,text:'Box,'});
    if(m.name==='SkinWeights' && m.children) {
      const vals=numbers({...m,tokens:m.tokens.filter(t=>t.start>m.open.start)}), rows=[];
      if(vals.length%8)throw new Error('SkinWeights requires eight values per vertex.');
      for(let i=0;i<vals.length;i+=8)rows.push(`{ ${vals.slice(i,i+8).map(v=>v&255).join(', ')} },`);
      edits.push({start:m.open.end,end:m.close.start,text:rows.join('\n')});return;
    }
    if(m.name==='TextureID') {
      const designator=m.tokens.findIndex(t=>raw(t)==='<');
      if(designator>=0) {
        const slot=number(m.tokens[designator+2]), key=TEXTURE_SLOTS[slot];if(!key)throw new Error(`Unsupported texture slot ${slot}.`);
        const nameToken=m.header[m.isStatic?1:0];edits.push({start:nameToken.start,end:nameToken.end,text:key});
        edits.push({start:m.tokens[designator].start,end:m.tokens[designator+2].end,text:''});
      }
    }
    for(const c of m.children||[])walk(c,m.name);
  }
  for(const m of tree.members)walk(m,null);
  for(const t of parseMdl(tree.bytes).tokens) if(t.kind==='line-comment'||t.kind==='block-comment')edits.push({start:t.start,end:t.end,text:' '});
  // Semantic values are restored from the untouched syntax tree below.
  for(const t of parseMdl(tree.bytes).tokens) if(t.kind!=='string' && /^[-+]?(?:nan|inf(?:inity)?)$/i.test(raw(t))) edits.push({start:t.start,end:t.end,text:'0'});
  return {text:replace(tree.bytes,edits).toString('utf8'),restore(model){restoreValues(tree.members,model);}};
}

function restoreValues(members,model) {
  model.Gliders=members.filter(m=>m.name==='Glider').map(m=>({GeosetId:property(m.children.find(c=>c.name==='GeosetId'))}));
  owners(members,model,(m,o)=>{
    if(m.name==='PivotPoints')return;
    // The dependency reuses its GEOA parser for a GEOS extent block and adds
    // phantom tint fields. They are not part of the authored extent.
    if(m.name==='Anim' && !m.header.some(t=>t.kind==='string'))for(const key of ['Alpha','Color','Flags','GeosetId'])if(!m.children.some(c=>c.name===key))delete o[key];
    if(m.name==='ParticleEmitterPopcorn')o.Flags&=~0x60000;
    let uv=0;
    for(const c of m.children||[]) {
      let key=c.name==='LevelOfDetailName'?'Name':c.name;
      if(['FilterMode','Shape','LightType','Groups'].includes(key))continue;
      if(key==='Faces' && m.name==='Geoset') {
        const groups=(c.children||[]).flatMap(x=>(x.children||[]).filter(y=>y.children));
        o.PrimitiveTypes=Uint32Array.from(groups,()=>4);o.PrimitiveCounts=Uint32Array.from(groups,g=>numbers(g).length);continue;
      }
      if(key==='TextureID') { const j=c.tokens.findIndex(t=>raw(t)==='<');if(j>=0)key=TEXTURE_SLOTS[number(c.tokens[j+2])]; }
      if(m.name==='Layer' && key in layerFlags) {o.Shading|=layerFlags[key];continue;}
      if(m.name==='Material' && key in materialFlags) {o.RenderMode|=materialFlags[key];continue;}
      if(m.name==='Material' && key==='Unfogged') {o.Unfogged=true;continue;}
      if(m.name==='Light' && key==='ShadowCasting') {o.ShadowCasting=1;continue;}
      if(m.name==='Camera' && key in cameraFields) {
        const value=property(c);o[cameraFields[key]]=typeof value==='number'?{LineType:0,GlobalSeqId:null,Keys:[{Frame:0,Vector:Float32Array.of(value)}]}:value;continue;
      }
      if('ObjectId' in o && key in nodeFlags) {o.Flags|=nodeFlags[key];delete o[key];continue;}
      if(key==='DontInherit') {for(const flag of c.children||[])o.Flags|=nodeFlags['DontInherit'+flag.name]||0;continue;}
      if(m.name==='ParticleEmitterPopcorn' && key==='Unfogged') {o.Flags|=0x20000;continue;}
      if(m.name==='ParticleEmitterPopcorn' && key==='PopcornScaling') {o.Flags|=0x40000;continue;}
      if(key==='Plane'||key==='Cylinder') {o.Shape=key==='Plane'?1:3;continue;}
      if(key==='SkinWeights') {o.SkinWeights=(model.Version>=1400?Uint16Array:Uint8Array).from(numbers({...c,tokens:c.tokens.filter(t=>t.start>c.open.start)}));continue;}
      if(['Interval','LifeSpanUVAnim','DecayUVAnim','TailUVAnim','TailDecayUVAnim'].includes(key)) {o[key]=Uint32Array.from(numbers(c));continue;}
      if(key==='TVertices') {o.TVertices[uv++]=property(c);continue;}
      if(['Vertices','Normals','Tangents','VertexGroup','EventTrack'].includes(key)) {
        const Type=key==='EventTrack'?Int32Array:key==='VertexGroup'?Uint8Array:Float32Array;
        o[key]=Type.from(numbers({...c,tokens:c.tokens.filter(t=>t.start>c.open.start)}));continue;
      }
      if(extensionFields.has(key) || key in o && (typeof o[key]==='number'||typeof o[key]==='string'||ArrayBuffer.isView(o[key])||o[key]?.Keys) || key==='Visibility' && 'ObjectId'in o || ['Color','Visibility'].includes(key) && ['RibbonEmitter','Camera'].includes(m.name)) {
        if(['ObjectId','Parent'].includes(key)||!c.header[1]&&!c.children)continue;
        const reverse=['Color','AmbColor'].includes(key) && m.name!=='ParticleEmitterPopcorn';
        const previous=o[key], value=property(c,TEXTURE_SLOTS.includes(key)||key==='TextureSlot',reverse);
        if(value?.Keys && previous!=null && !previous.Keys && (m.children||[]).some(x=>x!==c&&x.name===c.name&&x.isStatic)) (o._MdxDefaults||={})[key]=previous;
        o[key]=value;
      }
    }
    if(m.name==='Geoset' && o.SelectionFlags!=null)o.Unselectable=!!(o.SelectionFlags&4);
  });
  for(const e of model.EventObjects||[])e.EventTrack=Int32Array.from(e.EventTrack);
}
const tuple=(v,reverse=false)=>`{ ${Array.from(v,spelling)[reverse?'reverse':'slice']().join(', ')} }`;
const keyValue=(v,reverse)=>v.length===1?spelling(v[0]):tuple(v,reverse);
export function mdlProperty(name,value,reverse=false,isStatic=false) {
  if(value?.Keys) {
    const rows=[['DontInterp','Linear','Hermite','Bezier'][value.LineType]+','];
    if(value.GlobalSeqId!=null)rows.push(`GlobalSeqId ${value.GlobalSeqId},`);
    for(const k of value.Keys) {rows.push(`${k.Frame}: ${keyValue(k.Vector,reverse)},`);if(value.LineType>=2)for(const field of ['InTan','OutTan'])rows.push(`${field} ${keyValue(k[field],reverse)},`);}
    return `${name} ${value.Keys.length} {\n${rows.join('\n')}\n}`;
  }
  return `${isStatic?'static ':''}${name} ${typeof value==='string'?`"${value}"`:typeof value==='number'?spelling(value):tuple(value,reverse)},`;
}

export function finishCompatibleMdl(input,model) {
  const tree=mdlMembers(input),edits=[];
  owners(tree.members,model,(m,o)=>{
    const extra=[];let uv=0;
    if(m.name==='PivotPoints') {
      edits.push({start:m.open.end,end:m.close.start,text:'\n'+o.map(v=>tuple(v)+',').join('\n')+'\n'});return;
    }
    if(m.name==='BindPose') {
      const matrices=m.children.find(c=>c.name==='Matrices');
      if(matrices)edits.push({start:matrices.open.end,end:matrices.close.start,text:'\n'+o.Matrices.map(v=>tuple(v)+',').join('\n')+'\n'});
      return;
    }
    const represented=new Set();
    for(const c of m.children||[]) {
      const key=c.name;represented.add(key);let value=o[key];
      if(m.name==='Material' && key==='SortPrimsFarZ') {edits.push({start:c.start,end:c.end,text:'SortPrimitives,'});continue;}
      if(key==='Faces' && o.PrimitiveCounts && Array.from(o.PrimitiveCounts).reduce((a,n)=>a+n,0)===o.Faces.length) {
        let at=0;const groups=Array.from(o.PrimitiveCounts,n=>{const row=tuple(o.Faces.subarray(at,at+n));at+=n;return row+',';});
        edits.push({start:c.start,end:c.end,text:`Faces ${groups.length} ${o.Faces.length} { Triangles { ${groups.join('\n')} } }`});continue;
      }
      if(key==='TVertices')value=o.TVertices[uv++];
      if(key==='SegmentColor' && o.SegmentColor) {
        edits.push({start:c.open.end,end:c.close.start,text:o.SegmentColor.map(v=>mdlProperty('Color',v,true)).join('\n')});continue;
      }
      if(key==='TVertices' && !value) {edits.push({start:c.start,end:c.end,text:''});continue;}
      if(key==='DontInherit') {edits.push({start:c.start,end:c.end,text:(c.children||[]).map(x=>`DontInherit { ${x.name} },`).join('\n')});continue;}
      if(['Vertices','Normals','Tangents','TVertices','VertexGroup','EventTrack','SkinWeights'].includes(key) && ArrayBuffer.isView(value)) {
        const width={Vertices:3,Normals:3,Tangents:4,TVertices:2,VertexGroup:1,EventTrack:1,SkinWeights:8}[key],rows=[];
        for(let i=0;i<value.length;i+=width)rows.push(width===1?spelling(value[i])+',':tuple(value.subarray(i,i+width))+',');
        // Event GlobalSeqId is written by the existing event adapter afterward.
        edits.push({start:c.open.end,end:c.close.start,text:'\n'+rows.join('\n')+'\n'});continue;
      }
      if(value==null || typeof value==='boolean' || ['ObjectId','Parent','Flags','Shape','LightType','FilterMode','RenderMode','Shading','Rows','Columns','Faces','Groups'].includes(key))continue;
      if(typeof value==='number'||typeof value==='string'||ArrayBuffer.isView(value)||value.Keys) {
        const reverse=['Color','AmbColor'].includes(key) && m.name!=='ParticleEmitterPopcorn';
        const baseline=o._MdxDefaults?.[key];
        const prefix=value.Keys && baseline!=null ? mdlProperty(key,baseline,reverse,true)+'\n' : '';
        edits.push({start:c.start,end:c.end,text:prefix+mdlProperty(m.name==='Geoset'&&key==='Name'?'LevelOfDetailName':key,value,reverse,c.isStatic)});
      }
    }
    for(const key of extensionFields) if(o[key]!=null && !represented.has(key) && key!=='ShadowCasting' && model.Version>=(fieldVersions[key]||0)) {
      const value=key==='SelectionFlags'?(((o.SelectionFlags&~4)|(o.Unselectable?4:0))>>>0):o[key];
      extra.push(mdlProperty(key,value,false,!!value?.Keys?false:['ShadowIntensity','ShadowCastingStart','ShadowCastingEnd','QuadraticFalloff','LinearFalloff','Damping'].includes(key)));
    }
    if(m.name==='Light' && o.ShadowCasting && model.Version>=1300)extra.push('ShadowCasting,');
    if(m.name==='Camera')for(const key of ['FocusDistance','FocalLength','FStop'])if(o[key])extra.push(mdlProperty(key+'Keys',o[key]));
    if(m.name==='Layer')for(const [key,bit]of Object.entries(layerFlags))if(o.Shading&bit)extra.push(key+',');
    if(m.name==='Material')for(const [key,bit]of Object.entries(materialFlags))if(o.RenderMode&bit)extra.push(key+',');
    if(m.name==='Material' && o.Unfogged)extra.push('Unfogged,');
    if('ObjectId'in o)for(const [key,bit]of Object.entries(nodeFlags))if(o.Flags&bit && !represented.has(key) && !key.startsWith('DontInherit'))extra.push(key+',');
    if(m.name==='ParticleEmitterPopcorn') {
      for(const c of m.children||[])if(c.name==='Unfogged')edits.push({start:c.start,end:c.end,text:''});
      if(o.Flags&0x20000)extra.push('Unfogged,');if(o.Flags&0x40000)extra.push('PopcornScaling,');
    }
    if(m.name==='CollisionShape' && [1,3].includes(o.Shape)) {
      const c=m.children.find(c=>['Box','Sphere'].includes(c.name));if(c)edits.push({start:c.start,end:c.end,text:o.Shape===1?'Plane,':'Cylinder,'});
      if(o.Shape===3 && !represented.has('BoundsRadius'))extra.push(mdlProperty('BoundsRadius',o.BoundsRadius));
    }
    for(const key of ['Color','Visibility'])if(o[key]?.Keys && !represented.has(key))extra.push(mdlProperty(key,o[key],key==='Color'));
    if(typeof o.Visibility==='number' && !represented.has('Visibility'))extra.push(mdlProperty('Visibility',o.Visibility,false,true));
    // White is a meaningful enabled GEOA color; the dependency omits it.
    if(m.name==='GeosetAnim' && (o.Flags&2) && !represented.has('Color') && o.Color)extra.push(mdlProperty('Color',o.Color,true,true));
    if(m.name==='Light')for(const key of ['Color','AmbColor'])if(o[key] && !represented.has(key))extra.push(mdlProperty(key,o[key],true,true));
    for(const key of ['BoundsRadius','MinimumExtent','MaximumExtent'])if(o[key]!=null && !represented.has(key))extra.push(mdlProperty(key,o[key]));
    if(extra.length)edits.push({start:m.close.start,end:m.close.start,text:'\n'+extra.join('\n')+'\n'});
  });
  const gliders=(model.Gliders||[]).map(g=>`\nGlider { GeosetId ${g.GeosetId}, }\n`).join('');
  return Buffer.concat([replace(tree.bytes,edits),Buffer.from(gliders)]);
}

export function readMdlPivotPoints(input) {
  const m=mdlMembers(input).members[0],values=numbers({...m,tokens:m.tokens.filter(t=>t.start>m.open.start)}),count=number(m.header[1]);
  if(values.length!==count*3)throw new Error('PivotPoints count does not match its coordinates.');
  return Array.from({length:count},(_,i)=>Float32Array.from(values.slice(i*3,i*3+3)));
}
