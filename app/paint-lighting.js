import {Vector3,Vector4} from 'three';

export function createPaintLightUniforms() {
  return {uCitadelCount:{value:0},uCitadelFlat:{value:1},uCitadelPositions:{value:Array.from({length:8},()=>new Vector4())},uCitadelDirections:{value:Array.from({length:8},()=>new Vector3())},uCitadelColors:{value:Array.from({length:8},()=>new Vector3())},uCitadelAmbient:{value:Array.from({length:8},()=>new Vector3())},uCitadelRanges:{value:Array.from({length:8},()=>new Vector3())}};
}
export function updatePaintLights(uniforms,settings) {
  const lights=settings?.lights||[];uniforms.uCitadelCount.value=Math.min(8,lights.length);uniforms.uCitadelFlat.value=settings?.flat===false?0:1;
  for(let i=0;i<Math.min(8,lights.length);i++){const light=lights[i];uniforms.uCitadelPositions.value[i].set(...light.position,light.type);uniforms.uCitadelDirections.value[i].fromArray(light.direction);uniforms.uCitadelColors.value[i].fromArray(light.color);uniforms.uCitadelAmbient.value[i].fromArray(light.ambient);uniforms.uCitadelRanges.value[i].set(light.start,light.end,0);}
}
/** Classic vertex lighting: diffuse + ambient, clamped before texture modulation.
 * The distance curve follows the Warsmash reconstruction of WC3 unit lights:
 * https://github.com/Retera/WarsmashModEngine/blob/master/core/src/com/etheller/warsmash/viewer5/Shaders.java
 * No specular/PBR, postprocessing, baked pixels, or shadow maps.
 */
export function applyPaintLightShader(shader,uniforms,unshaded) {
  Object.assign(shader.uniforms,uniforms);
  shader.vertexShader=`varying vec3 vCitadelLight;
uniform int uCitadelCount;
uniform float uCitadelFlat;
uniform vec4 uCitadelPositions[8];
uniform vec3 uCitadelDirections[8],uCitadelColors[8],uCitadelAmbient[8],uCitadelRanges[8];
`+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
vCitadelLight=vec3(${unshaded?'1.0':'uCitadelFlat'});
${unshaded?'':`
vec3 citadelPoint=(modelMatrix*vec4(position,1.0)).xyz;
vec3 citadelNormal=normalize(mat3(modelMatrix)*normal);
for(int lamp=0;lamp<8;lamp++){
  if(lamp>=uCitadelCount)break;
  float type=uCitadelPositions[lamp].w;
  vec3 toward=uCitadelPositions[lamp].xyz-citadelPoint;
  float distanceToLight=length(toward),weight=1.0;
  vec3 axis=uCitadelDirections[lamp];
  if(type<0.5){axis=toward/max(distanceToLight,0.0001);float units=1.0+distanceToLight/64.0;weight=1.0/(units*units);}
  if(type>1.5){weight=distanceToLight<=uCitadelRanges[lamp].y?1.0/max(0.001,min(distanceToLight-uCitadelRanges[lamp].x,uCitadelRanges[lamp].y-uCitadelRanges[lamp].x)):0.0;vCitadelLight+=uCitadelAmbient[lamp]*weight;}
  else{vec3 diffuse=clamp(uCitadelColors[lamp]*max(0.0,dot(citadelNormal,axis))*weight,0.0,1.0);vCitadelLight+=diffuse+uCitadelAmbient[lamp]*weight;}
}
vCitadelLight=clamp(vCitadelLight,0.0,1.0);
`}`);
  shader.fragmentShader='varying vec3 vCitadelLight;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <colorspace_fragment>','#include <colorspace_fragment>\ngl_FragColor.rgb *= vCitadelLight;');
}
