import { Color, LinearFilter, LinearMipmapLinearFilter, Vector3 } from 'three';

// The native SD shader consumes encoded colors; Three materials consume linear.
export const nativeTeamColor = hex => { const value = new Color(hex).getHex(); return [value >> 16 & 255, value >> 8 & 255, value & 255].map(channel => channel / 255); };
export const viewportPixelRatio = (graphics, device = 1, lowPower = false) => lowPower ? 1 : graphics.antialias ? Math.min(device || 1, graphics.pixelRatio) : device || 1;

export function configureEditorTexture(texture, anisotropy = 1) {
  // DataTexture defaults to nearest filtering and no generated mipmaps.
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = Math.max(1, Math.min(16, anisotropy));
  texture.needsUpdate = true;
  return texture;
}

export function cameraLeftLight(camera, target, radius) {
  const direction = new Vector3(-.65, .55, 1).normalize().applyQuaternion(camera.quaternion);
  return { direction, position: target.clone().addScaledVector(direction, Math.max(1, radius) * 5) };
}

/** WebGL2 generates the complete mip chain for decoded BLP/TGA/DDS top levels. */
export function improveNativeTexture(gl, native, path) {
  const texture = native.rendererData?.textures?.[path];
  if (!texture) return;
  const previous = gl.getParameter(gl.TEXTURE_BINDING_2D);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  const ext = native.anisotropicExt;
  if (ext) gl.texParameterf(gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(16, gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
  gl.bindTexture(gl.TEXTURE_2D, previous);
}

export function captureDimensions(width, height, maxDimension, limit = 8192) {
  const edge = Number(maxDimension);
  const scale = Number.isFinite(edge) && edge > 0 ? Math.min(edge, limit) / Math.max(width, height) : 1;
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}
