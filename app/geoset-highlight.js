import { Vector3 } from 'three';

export function configureGeosetHighlightMaterial(meshMaterial, pointMaterial, appearance) {
  const filled = appearance.type === 'fill';
  meshMaterial.color.set(appearance.color);
  pointMaterial.color.set(appearance.color);
  if (meshMaterial.wireframe === filled) { meshMaterial.wireframe = !filled; meshMaterial.needsUpdate = true; }
  meshMaterial.opacity = filled ? .55 : 1;
}

/** Screen-space overlay stays above textured animation without altering selection. */
export function drawGeosetHighlight(context, faces, positions, camera, width, height, appearance = {}) {
  context.clearRect(0,0,width,height);
  const projected=[], point=new Vector3();
  for(let i=0;i<positions.length;i+=3) {
    point.fromArray(positions,i).project(camera);
    projected.push(point.z>=-1&&point.z<=1?[(point.x+1)*width/2,(1-point.y)*height/2]:null);
  }
  context.strokeStyle=context.fillStyle=appearance.color || '#39ff14'; context.lineWidth=1.5;
  context.beginPath();
  for(let i=0;i<faces.length;i+=3) {
    const a=projected[faces[i]],b=projected[faces[i+1]],c=projected[faces[i+2]];
    if(!a||!b||!c)continue;
    context.moveTo(...a); context.lineTo(...b); context.lineTo(...c); context.closePath();
  }
  if (appearance.type === 'fill') { context.globalAlpha=.55; context.fill(); context.globalAlpha=1; }
  else context.stroke();
  if (!appearance.type || appearance.type === 'wire-vertices') for(const p of projected)if(p)context.fillRect(p[0]-2.5,p[1]-2.5,5,5);
}
