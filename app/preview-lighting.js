export { previewLighting } from '../src/preview-lighting.js';

/** Values are linear intensity multipliers; saved textures remain sRGB. */
export function configurePreviewLights(ambient, key, config) {
  if (config.preset === 'legacy' && ambient.isHemisphereLight) {
    ambient.color.set(0xd4e7ff); ambient.groundColor.set(0x52514a); ambient.intensity = 2.2;
    key.color.set(0xffeed7); key.intensity = 2.8;
  } else {
    // Phong's Lambert BRDF divides incoming irradiance by PI for both lights.
    ambient.color.setRGB(...config.ambient); ambient.groundColor?.setRGB(...config.ambient); ambient.intensity = Math.PI;
    key.color.setRGB(...config.diffuse); key.intensity = Math.PI;
  }
}

export function applyPreviewMaterialLighting(material, config) {
  if (!material.specular) return;
  material.specular.setRGB(...config.specular); material.shininess = config.power;
}
