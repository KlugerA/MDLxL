import {Vector3,Quaternion} from 'three';
import {createStarterRecipe} from './particle-starters.js';

/** Only complete marked polygons contribute; unrelated selected vertices do not. */
export function ribbonPolygonSelection(model,selection={}){
 const points=[],bindings=[];let polygons=0;
 for(const [index,ids] of Object.entries(selection)){
  const geo=model.Geosets[Number(index)];if(!geo)continue;
  const selected=new Set(ids),used=new Set();
  for(let i=0;i<geo.Faces.length;i+=3){const face=Array.from(geo.Faces.slice(i,i+3));if(face.length===3&&face.every(id=>selected.has(id))){polygons++;face.forEach(id=>used.add(id));}}
  for(const id of used){
   points.push(Array.from(geo.Vertices.slice(id*3,id*3+3)));
   const skin=geo.SkinWeights,group=skin?.length>=(id+1)*8?Array.from(skin.slice(id*8,id*8+4)).filter((_,i)=>skin[id*8+4+i]>0):Array.from(geo.Groups?.[geo.VertexGroup?.[id]]||[]);
   bindings.push([...new Set(group)]);
  }
 }
 const first=bindings[0]||[],rigid=bindings.length>0&&first.length<=1&&bindings.every(group=>group.length===first.length&&group[0]===first[0]);
 return {points,polygons,parent:rigid&&first.length?first[0]:null,needsBone:bindings.length>0&&!rigid};
}

/** WC3 SD ribbons are straight strips along local Y. Fit that axis to the marked back. */
export function fitRibbonToPolygons(model,selection){
 const selected=ribbonPolygonSelection(model,selection);
 if(!selected.polygons)throw Error('In Vertices, select the polygons along the weapon’s back, then open EMTR.');
 const points=[...new Map(selected.points.map(point=>[point.join(','),new Vector3(...point)])).values()];
 if(points.some(p=>![p.x,p.y,p.z].every(Number.isFinite)))throw Error('The selected polygons have invalid coordinates.');
 const center=points.reduce((sum,p)=>sum.add(p),new Vector3()).multiplyScalar(1/points.length),matrix=Array(9).fill(0);
 for(const p of points){const d=p.clone().sub(center).toArray();for(let i=0;i<3;i++)for(let j=0;j<3;j++)matrix[i*3+j]+=d[i]*d[j];}
 const multiply=v=>new Vector3(matrix[0]*v.x+matrix[1]*v.y+matrix[2]*v.z,matrix[3]*v.x+matrix[4]*v.y+matrix[5]*v.z,matrix[6]*v.x+matrix[7]*v.y+matrix[8]*v.z);
 let axis,largest=-1;
 for(const seed of [[1,0,0],[0,1,0],[0,0,1]]){let v=new Vector3(...seed);for(let i=0;i<32;i++){const next=multiply(v);if(next.lengthSq()<1e-20)break;v=next.normalize();}const variance=v.dot(multiply(v));if(variance>largest){axis=v;largest=variance;}}
 const components=axis.toArray(),dominant=components.map(Math.abs).indexOf(Math.max(...components.map(Math.abs)));if(components[dominant]<0)axis.negate();
 const distances=points.map(p=>p.clone().sub(center).dot(axis)),min=Math.min(...distances),max=Math.max(...distances),length=max-min;
 if(!(length>1e-5))throw Error('Select a longer strip of polygons along the weapon.');
 center.addScaledVector(axis,(min+max)/2);
 const recipe=createStarterRecipe('ribbon'),ribbon=recipe.native.RibbonEmitters[0];
 recipe.name='Weapon ribbon';recipe.id='weapon-ribbon';ribbon.Name='Weapon ribbon';
 // The original soft-disc picture stores falloff in alpha; AddAlpha retains that soft edge.
 recipe.native.Materials[0].Layers[0].FilterMode=4;
 ribbon.PivotPoint=new Float32Array(center.toArray());recipe.native.PivotPoints[ribbon.ObjectId]=ribbon.PivotPoint;
 ribbon.HeightAbove=ribbon.HeightBelow=length/2;
 ribbon.Rotation={LineType:0,GlobalSeqId:null,Keys:[{Frame:0,Vector:new Float32Array(new Quaternion().setFromUnitVectors(new Vector3(0,1,0),axis).toArray())}]};
 return {...selected,recipe,length,endpoints:[center.clone().addScaledVector(axis,-length/2).toArray(),center.clone().addScaledVector(axis,length/2).toArray()]};
}
