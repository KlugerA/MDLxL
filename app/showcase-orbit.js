import * as THREE from 'three';

const axis = new THREE.Vector3(0, 0, 1);
const clamp = value => Math.max(0, Math.min(100, Number(value) || 0));

/** The old apparent orbit was the XY offset between the bounds center and model origin. */
export function showcaseOrbitRadius(center, size, percent) {
  const previousRadius = Math.max(Math.hypot(center.x, center.y), Math.hypot(size.x, size.y) / 8);
  return previousRadius * 4 * clamp(percent) / 100;
}

/** Inverse of T(offset) * Rz(angle), applied only to the render camera. */
export function setShowcaseOrbitCamera(source, display, angle, radius, rotation, offset) {
  rotation.setFromAxisAngle(axis, -angle);
  offset.set(radius * (Math.cos(angle) - 1), radius * Math.sin(angle), 0);
  display.copy(source);
  display.position.sub(offset).applyQuaternion(rotation);
  display.quaternion.premultiply(rotation);
  display.updateMatrixWorld();
  return display;
}

/** Largest projection zoom that fits a frozen pose while its unit anchor stays
 * at the crop center. A full orbit uses each vertex's exact circular sweep:
 * max(n dot Rz(theta)p) = hypot(n.x,n.y) * hypot(p.x,p.y) + n.z*p.z.
 * Thus long weapons constrain zoom, never the centering point, and no angle
 * between sampled views can escape the crop. */
export function showcaseFraming(camera, points, anchor, { crop, width, height, angle = 0, radius = 0, fullOrbit = false } = {}) {
  const selection=crop || {x:0,y:0,width:1,height:1};
  const tx=(selection.x+selection.width/2)*2-1,ty=1-(selection.y+selection.height/2)*2;
  const halfX=Math.max(1e-6,selection.width-2/width),halfY=Math.max(1e-6,selection.height-2/height);
  camera.updateMatrixWorld();camera.updateProjectionMatrix();
  const right=new THREE.Vector3(1,0,0).applyQuaternion(camera.quaternion);
  const up=new THREE.Vector3(0,1,0).applyQuaternion(camera.quaternion);
  const back=new THREE.Vector3(0,0,1).applyQuaternion(camera.quaternion);
  const matrix=camera.projectionMatrix.elements,sx=matrix[0]/camera.zoom,sy=matrix[5]/camera.zoom,ox=matrix[8],oy=matrix[9];
  const cos=Math.cos(angle),sin=Math.sin(angle);
  const cloud=points.map(p=>fullOrbit
    ? [Math.hypot(p.x+radius,p.y),p.z]
    : [(p.x+radius)*cos-p.y*sin-radius-anchor.x,(p.x+radius)*sin+p.y*cos-anchor.y,p.z-anchor.z]);
  const support=n=>{
    let maximum=-Infinity;
    if(fullOrbit){
      const horizontal=Math.hypot(n.x,n.y),offset=-radius*n.x-n.dot(anchor);
      for(const [r,z] of cloud)maximum=Math.max(maximum,horizontal*r+n.z*z+offset);
    }else for(const [x,y,z] of cloud)maximum=Math.max(maximum,n.x*x+n.y*y+n.z*z);
    return maximum;
  };
  const depth=anchor.clone().sub(camera.position).dot(back.clone().negate());
  const minimumDepth=Math.max(.001,support(back)+camera.near);
  const planes=[
    [right,sx,tx+halfX+ox,halfX], [right,-sx,-(tx-halfX+ox),halfX],
    [up,sy,ty+halfY+oy,halfY], [up,-sy,-(ty-halfY+oy),halfY],
  ];
  const requiredDepth=zoom=>{
    let result=minimumDepth;
    for(const [axis,scale,edge,half] of planes)result=Math.max(result,support(axis.clone().multiplyScalar(scale*zoom).addScaledVector(back,edge))/half);
    return result;
  };
  // Retain the camera distance too, unless even minimum projection zoom would
  // intersect the near plane or be unable to fit an offset crop.
  const fittedDepth=Math.max(depth,requiredDepth(.02));
  let low=.02,high=fullOrbit?100:camera.zoom;
  if(requiredDepth(high)<=fittedDepth)low=high;
  else for(let step=0;step<40;step++){
    const middle=(low+high)/2;
    if(requiredDepth(middle)<=fittedDepth)low=middle;else high=middle;
  }
  return {zoom:low,retreat:Math.max(0,fittedDepth-depth),back};
}
