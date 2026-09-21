import {Vector3} from 'three';
import {parseMDL} from 'war3-model';
import {sampleNodeMatrices,sampleTrack} from './animation.js';

export const WC3_DNC_ENVIRONMENTS=['Lordaeron','Ashenvale','Dalaran','Dungeon','Felwood','Underground'];
export const wc3DncPath=name=>`Environment\\DNC\\DNC${name}\\DNC${name}Unit\\DNC${name}Unit.mdx`;

/** Read only the DNC's light/animation data, including the extra scalar in 1200
 * light records. The installed general model parser stops before that field.
 * No game/model data is rewritten or bundled by this reader.
 */
export function readWarcraftDnc(input,name='dnc.mdx') {
  const bytes=input instanceof Uint8Array?input:new Uint8Array(input);
  if(/\.mdl$/i.test(name)){const model=parseMDL(new TextDecoder().decode(bytes));if(!model.Lights?.length)throw Error('The selected model has no Warcraft light nodes.');return model;}
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),decoder=new TextDecoder();let offset=0;
  const need=n=>{if(offset+n>bytes.length)throw Error('The DNC model is truncated.');};
  const uint=()=>{need(4);const n=view.getUint32(offset,true);offset+=4;return n;},float=()=>{need(4);const n=view.getFloat32(offset,true);offset+=4;return n;};
  const string=n=>{need(n);const result=decoder.decode(bytes.subarray(offset,offset+n)).replace(/\0.*$/s,'');offset+=n;return result;};
  if(string(4)!=='MDLX')throw Error('Choose a Warcraft DNC MDL or MDX model.');
  const model={Version:800,Sequences:[],GlobalSequences:[],Nodes:[],Lights:[],PivotPoints:[]};
  const tracks={KGTR:['Translation',3],KGRT:['Rotation',4],KGSC:['Scaling',3],KLAV:['Visibility',1],KLAC:['Color',3],KLAI:['Intensity',1],KLBC:['AmbColor',3],KLBI:['AmbIntensity',1],KLAS:['AttenuationStart',1],KLAE:['AttenuationEnd',1]};
  const anim=(target,end)=>{
    while(offset<end){const tag=string(4),definition=tracks[tag];if(!definition)throw Error('Unsupported DNC animation track: '+tag);
      const [key,components]=definition,count=uint(),LineType=uint(),global=uint(),track={LineType,GlobalSeqId:global===0xffffffff?null:global,Keys:[]};
      if(count>100000||LineType>3)throw Error('Invalid DNC animation track.');
      for(let i=0;i<count;i++){const item={Frame:uint(),Vector:Array.from({length:components},float)};if(LineType>1){item.InTan=Array.from({length:components},float);item.OutTan=Array.from({length:components},float);}track.Keys.push(item);}
      target[key]=track;
    }
    if(offset!==end)throw Error('Invalid DNC record length.');
  };
  const node=()=>{
    const start=offset,size=uint(),end=start+size;if(size<96||end>bytes.length)throw Error('Invalid DNC node.');
    const result={Name:string(80),ObjectId:uint(),Parent:uint(),Flags:uint()};if(result.Parent===0xffffffff)result.Parent=null;
    anim(result,end);model.Nodes.push(result);return result;
  };
  while(offset<bytes.length){
    const tag=string(4),size=uint(),end=offset+size;if(end>bytes.length)throw Error('The DNC chunk is truncated.');
    if(tag==='VERS')model.Version=uint();
    else if(tag==='SEQS'){if(size%132)throw Error('Invalid DNC sequence length.');while(offset<end){const start=offset,Name=string(80),Interval=[uint(),uint()];model.Sequences.push({Name,Interval});offset=start+132;}}
    else if(tag==='GLBS')while(offset<end)model.GlobalSequences.push(uint());
    else if(tag==='PIVT')while(offset<end)model.PivotPoints.push([float(),float(),float()]);
    else if(tag==='HELP')while(offset<end)node();
    else if(tag==='LITE')while(offset<end){
      const start=offset,length=uint(),last=start+length,light=node();if(last>end||last<=offset)throw Error('Invalid DNC light.');
      light.LightType=uint();light.AttenuationStart=float();light.AttenuationEnd=float();light.Color=[float(),float(),float()];light.Intensity=float();light.AmbColor=[float(),float(),float()];light.AmbIntensity=float();
      if(model.Version>=1200)light.PreviewUnusedScalar=float();
      anim(light,last);model.Lights.push(light);
    }
    if(['VERS','SEQS','GLBS','PIVT','HELP','LITE'].includes(tag)&&offset!==end)throw Error('Invalid DNC chunk length.');offset=end;
  }
  if(!model.Lights.length)throw Error('The selected model has no Warcraft light nodes.');
  for(const node of model.Nodes)node.PivotPoint=model.PivotPoints[node.ObjectId]||[0,0,0];
  return model;
}

/** Game time maps over the authored Stand interval (a stock DNC spans 60 s).
 * Warcraft stores light colours in BGR order. Light directions use local +Z
 * toward the source; the emitter's beam travels along local -Z.
 */
export function sampleWarcraftDnc(model,hour=12) {
  const sequenceIndex=Math.max(0,model.Sequences.findIndex(s=>/^stand/i.test(s.Name))),interval=model.Sequences[sequenceIndex]?.Interval||[0,60000];
  const frame=interval[0]+(((hour%24)+24)%24)/24*(interval[1]-interval[0]),options={interval,globalSequences:model.GlobalSequences,globalTime:frame};
  const matrices=sampleNodeMatrices(model,frame,sequenceIndex,frame);
  return model.Lights.map(light=>{
    const sample=(key,fallback)=>sampleTrack(light[key],frame,{...options,fallback}),matrix=matrices.get(light.ObjectId);
    const position=new Vector3().fromArray(light.PivotPoint||[0,0,0]),direction=new Vector3(0,0,1);if(matrix){position.applyMatrix4(matrix);direction.transformDirection(matrix);}
    const visibility=sample('Visibility',1),rgb=key=>Array.from(sample(key,[1,1,1])).reverse();
    return {type:light.LightType,position:position.toArray(),direction:direction.toArray(),color:rgb('Color').map(c=>Math.max(0,c*sample('Intensity',1)*visibility)),ambient:rgb('AmbColor').map(c=>Math.max(0,c*sample('AmbIntensity',0)*visibility)),start:sample('AttenuationStart',80),end:sample('AttenuationEnd',200)};
  });
}
