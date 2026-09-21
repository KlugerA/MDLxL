/** war3-model's MDL reader exposes RGB, while its MDX reader/writer leaves
 * animated KGAC values in file BGR order. Static GEOA values are already RGB.
 * Normalize keys and spline tangents at the MDX boundary. All editor,
 * preview, import and animation operations continue to use RGB internally. */
export function convertMdxGeosetColorTracks(animations = []) {
  return animations.map(animation => {
    if (!animation.Color?.Keys) return animation;
    return { ...animation, Color: { ...animation.Color, Keys: animation.Color.Keys.map(key => {
      const result = { ...key };
      for (const field of ['Vector', 'InTan', 'OutTan']) if (key[field]) {
        result[field] = new Float32Array([key[field][2], key[field][1], key[field][0]]);
      }
      return result;
    }) } };
  });
}
