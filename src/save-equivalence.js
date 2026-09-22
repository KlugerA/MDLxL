import { equivalentGeosetColorDefaults } from './geoset-animation-defaults.js';

// Compare values the user actually owns, not just record counts. Float32 is
// the file format's precision; no decimal epsilon may hide changed key values.
const ignored = new Set(['Nodes','PivotPoint','TotalGroupsCount','NumGeosets','NumGeosetAnims','NumBones','NumHelpers','NumLights','NumAttachments','NumEvents','NumParticleEmitters','NumParticleEmitters2','NumRibbonEmitters']);
const defaults = { AnimationFile:'',Path:'',PriorityPlane:0,Gravity:0,SyncPoint:0,Flags:0,SelectionFlags:0,Variant:0,Shader:'',Name:'',LevelOfDetail:0,Alpha:1,EmissiveGain:1,FresnelOpacity:0,FresnelTeamColor:0,ShaderTypeId:0,ShadowIntensity:0,ShadowCasting:0,ShadowCastingStart:0,ShadowCastingEnd:0,QuadraticFalloff:0.0005,LinearFalloff:0,Damping:0.00001,_MdxTextureId:0 };
const equalNumber = (a,b) => Object.is(a,b) || Object.is(Math.fround(a),Math.fround(b));
const integerFields = new Set(['Version','Frame','Flags','RenderMode','Shading','SelectionFlags','SyncPoint','ObjectId','Parent','GeosetId','GeosetAnimId','MaterialID','TextureID','NormalTextureID','ORMTextureID','EmissiveTextureID','TeamColorTextureID','ReflectionsTextureID','TextureSlot','TVertexAnimId','CoordId','GlobalSeqId','LineType','AttachmentID','ReplaceableId','FilterMode','LightType','Shape','Rows','Columns','PriorityPlane','SelectionGroup','LevelOfDetail','ShaderTypeId','Variant','BlendTime','_MdxTextureId']);
function absentEquivalent(value,key) {
  if(value==null)return true;
  if(key in defaults)return typeof value==='number'?equalNumber(value,defaults[key]):value===defaults[key];
  if(key==='FresnelColor')return Array.from(value).every(n=>n===1);
  return false;
}
export function modelDifferenceReport(expected,actual,{keys=Object.keys(expected),limit=12}={}) {
  const differences=[];
  let total = 0;
  const add = path => { total++; if (differences.length < limit) differences.push(path); };
  function walk(a,b,path,key,integer=false) {
    if(ignored.has(key))return;
    // Layout caches do not change model meaning. Static bases DO and are checked.
    if(key==='_MdxSlots')return;
    if(key==='Visibility'&&typeof a==='number'&&b?.Keys&&b.LineType===0&&b.GlobalSeqId==null) {
      const constant=b.Keys.length>0&&b.Keys.every(k=>k.Vector.length===1&&equalNumber(a,k.Vector[0]));
      const covers=(expected.Sequences||[]).every(s=>b.Keys.some(k=>k.Frame>=s.Interval[0]&&k.Frame<=s.Interval[1]));
      if(constant&&covers)return;
    }
    if(a==null||b==null) {if(a==null&&b==null || absentEquivalent(a??b,key))return;add(path);return;}
    if(typeof a==='number'&&typeof b==='number'){if(integer||integerFields.has(key)?a!==b:!equalNumber(a,b))add(path);return;}
    if(typeof a!=='object'||typeof b!=='object'){if(a!==b)add(path);return;}
    if(ArrayBuffer.isView(a)||Array.isArray(a)) {
      if(a.length!==b.length){add(path+'.length');return;}
      const intArray=ArrayBuffer.isView(a)&&!(a instanceof Float32Array)&&!(a instanceof Float64Array);
      for(let i=0;i<a.length;i++)walk(a[i],b[i],`${path}[${i}]`,String(i),intArray);return;
    }
    for(const k of new Set([...Object.keys(a),...Object.keys(b)])) {
      if(k==='Color' && /^GeosetAnims\[\d+\]$/.test(path) && equivalentGeosetColorDefaults(a,b))continue;
      if(k==='BoundsRadius' && 'Shape'in a && a.Shape<2)continue;
      // Raw flags mirror these public boolean fields; compare unknown bits too.
      if(k==='Flags'&&'NonLooping'in a){walk((a.Flags||0)&~1,(b.Flags||0)&~1,path+'.Flags',k);continue;}
      if(k==='SelectionFlags'){walk((a[k]||0)&~4,(b[k]||0)&~4,path+'.'+k,k);continue;}
      if((k==='PrimitiveTypes'||k==='PrimitiveCounts') && (!a[k]||!b[k])) {
        const types=a.PrimitiveTypes||b.PrimitiveTypes,counts=a.PrimitiveCounts||b.PrimitiveCounts;
        if(types?.length===1&&types[0]===4&&counts?.length===1&&counts[0]===(a.Faces||b.Faces)?.length)continue;
      }
      if(k==='_MdxDefaults') {
        // A writer may materialize an implicit static base. Compare authored
        // bases if both contain them; absent bases are checked by the caller's
        // serialization contract rather than against arbitrary editor defaults.
        for(const field of Object.keys(a[k]||{}))walk(a[k][field],b[k]?.[field],`${path}.${k}.${field}`,field);
        continue;
      }
      walk(a[k],b[k],`${path}.${k}`,k);
    }
  }
  for(const key of keys)walk(expected[key],actual[key],key,key);
  return { total, differences };
}
export function modelDifferences(expected,actual,options) {
  return modelDifferenceReport(expected,actual,options).differences;
}
export function formatSaveIssues(label, issues, limit = 12) {
  return `${label} (${issues.length} issue${issues.length===1?'':'s'}): ${issues.slice(0,limit).join(' ')}${issues.length>limit?` ${issues.length-limit} more.`:''}`;
}
export function assertModelEquivalent(expected,actual,options) {
  const {total,differences}=modelDifferenceReport(expected,actual,options);
  if(total) {
    const start=performance.now();
    const error=new Error(`Save verification failed: serialization changed ${total} field${total===1?'':'s'}: ${differences.join(', ')}${total>differences.length?`; ${total-differences.length} more`:''}.`);
    if(options?.timings)options.timings.errorFormattingMs=performance.now()-start;
    throw error;
  }
}
