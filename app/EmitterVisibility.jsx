import React from 'react';
import {effectNodes} from '../src/particle-recipes.js';
import {sampleAnimationProperty,readAnimationTrack,setAnimationKey,setAnimationInlineValues} from '../src/animation-tracks.js';
export default function EmitterVisibility({model,selectedNodeIds,frame,sequenceIndex,globalSeqId,restPose,disabled,onEdit,onOpen,onPause}) {
 const effects=effectNodes(model).filter(({node})=>selectedNodeIds.includes(node.ObjectId));
 if(!effects.length)return null;
 const targets=effects.map(({node})=>({kind:'node',id:node.ObjectId,property:'Visibility'})),global=!restPose&&Number.isInteger(globalSeqId)&&globalSeqId>=0?globalSeqId:null;
 const animated=!restPose&&(sequenceIndex>=0||global!==null),blocked=!animated&&targets.some(target=>readAnimationTrack(model,target)?.Keys);
 const values=targets.map(target=>Number(sampleAnimationProperty(model,target,frame,sequenceIndex,global))),mixed=values.some(value=>value!==values[0]);
 return <div className="movement-emitter-controls"><label title={blocked?'Choose an animation to edit keyed visibility.':undefined}><input aria-label="Emitter visible at current frame" type="checkbox" checked={values.every(v=>v>0)} ref={el=>{if(el)el.indeterminate=mixed;}} disabled={disabled||blocked} onChange={event=>{onPause?.(false);const value=event.target.checked?1:0;onEdit('Set emitter visibility',['Nodes'],current=>animated?setAnimationKey(current,targets,frame,value,sequenceIndex,global):setAnimationInlineValues(current,targets,value));}}/>Visible</label><button onClick={()=>onOpen?.(effects[0].node.ObjectId)}>Edit effect</button></div>;
}
