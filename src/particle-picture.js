export const particleFrameGroups=[['Early sprites','LifeSpanUVAnim'],['Late sprites','DecayUVAnim'],['Early streaks','TailUVAnim'],['Late streaks','TailDecayUVAnim']];
export const particleBlendNames=['Blend','Additive','Modulate','Modulate 2×','Alpha Key'];
export function particleGridChange(emitter,rows,columns,{correct=false}={}){
 if(!Number.isInteger(rows)||!Number.isInteger(columns)||rows<1||columns<1||rows>65535||columns>65535)throw Error('Use positive grid dimensions up to 65,535.');
 const last=rows*columns-1,invalid=particleFrameGroups.filter(([,field])=>(emitter[field]?.[0]>last||emitter[field]?.[1]>last+1));
 const values={Rows:rows,Columns:columns};
 if(correct)for(const [,field]of invalid){const value=new Uint32Array(emitter[field]);value[0]=Math.min(value[0],last);value[1]=Math.min(value[1],last+1);values[field]=value;}
 return {values,invalid:invalid.map(([label])=>label),last};
}
export function particleCellAt(x,y,width,height,rows,columns){
 if(!(rows>0&&columns>0&&width>0&&height>0))return null;
 const column=Math.min(columns-1,Math.max(0,Math.floor(x/width*columns))),row=Math.min(rows-1,Math.max(0,Math.floor(y/height*rows)));
 return row*columns+column;
}
