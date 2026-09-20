import * as THREE from 'three';

/** A lamp is a lightweight editor handle, never a model/export node. */
export function createPaintLampObject(id){
  const group=new THREE.Group();group.userData.lampId=id;
  const housing=new THREE.MeshBasicMaterial({color:'#73787d'}),bulb=new THREE.MeshBasicMaterial({color:'#fff5cb'});
  const add=(geometry,material,x,y,z)=>{const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.userData.lampId=id;group.add(mesh);return mesh;};
  add(new THREE.BoxGeometry(.6,.15,.5),housing,0,-.7,0);
  add(new THREE.CylinderGeometry(.055,.055,.7,5),housing,0,-.3,0);
  const head=add(new THREE.CylinderGeometry(.31,.2,.38,6),housing,0,.12,.02);head.rotation.x=Math.PI/2;
  const lens=add(new THREE.CircleGeometry(.245,6),bulb,0,.12,.22);lens.material.side=THREE.DoubleSide;
  const aim=add(new THREE.ConeGeometry(.10,.28,4),housing,0,.12,.59);aim.rotation.x=Math.PI/2;
  group.userData.housing=housing;group.userData.bulb=bulb;return group;
}
export function paintLampDrag(lamp,dx,dy,camera,width,height,mode='move',fine=1){
  const position=new THREE.Vector3().fromArray(lamp.position),target=new THREE.Vector3().fromArray(lamp.target);
  if(mode==='rotate'){
    // A Warcraft torch is an omni. Turning an aim vector cannot change its
    // illumination; orbit the source around the model instead.
    const direction=position.clone().sub(target),up=new THREE.Vector3(0,1,0).applyQuaternion(camera.quaternion),right=new THREE.Vector3(1,0,0).applyQuaternion(camera.quaternion);
    direction.applyAxisAngle(up,-dx*.008*fine).applyAxisAngle(right,-dy*.008*fine);position.copy(target).add(direction);
  }else{
    const distance=Math.max(.1,position.distanceTo(camera.position)),span=camera.isPerspectiveCamera?2*distance*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))/camera.zoom:(camera.top-camera.bottom)/camera.zoom;
    const offset=mode==='depth'
      ?new THREE.Vector3(0,0,dy*span/Math.max(1,height)*fine).applyQuaternion(camera.quaternion)
      :new THREE.Vector3(dx*span/Math.max(1,height)*fine,-dy*span/Math.max(1,height)*fine,0).applyQuaternion(camera.quaternion);
    // Keep the model as the orbit/distance centre when moving the source.
    position.add(offset);
  }
  return {position:position.toArray(),target:target.toArray()};
}

export function paintLampDistance(lamp){return new THREE.Vector3().fromArray(lamp.position).distanceTo(new THREE.Vector3().fromArray(lamp.target));}
export function setPaintLampDistance(lamp,distance){
  const target=new THREE.Vector3().fromArray(lamp.target),direction=new THREE.Vector3().fromArray(lamp.position).sub(target);
  if(direction.lengthSq()<1e-10)direction.set(0,-1,1);
  return {position:target.clone().addScaledVector(direction.normalize(),Math.max(.1,distance)).toArray()};
}

/** User lamps are classic WC3 torch/omni sources. Legacy directional/intensity
 * settings do not survive as another hidden brightness control. Stock lantern
 * strength is 11; brightness changes with position using the game distance curve.
 * https://www.hiveworkshop.com/threads/light.245168/
 */
export function paintLampLight(lamp){
  const hex=lamp.color.replace('#',''),color=[0,2,4].map(i=>parseInt(hex.slice(i,i+2),16)/255*11);
  return {type:0,position:lamp.position,direction:[0,0,1],color,ambient:[0,0,0],start:80,end:200};
}
export function initialPaintLamp(pose){
  const target=new THREE.Vector3().fromArray(pose?.center||pose?.target||[0,0,50]),camera=new THREE.Vector3().fromArray(pose?.position||[150,-200,250]),radius=pose?.radius||100;
  const toward=camera.sub(target).normalize(),right=new THREE.Vector3().crossVectors(toward,new THREE.Vector3(0,0,1)).normalize();
  return {position:target.clone().addScaledVector(toward,radius*.45).addScaledVector(right,radius*.7).add(new THREE.Vector3(0,0,radius*.3)).toArray(),target:target.toArray()};
}
