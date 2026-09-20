/** war3-model's MDL reader exposes RGB, but its MDX reader/writer leaves
 * static GEOA and animated KGAC values in file BGR order.
 * Normalize colors, keys and spline tangents at the MDX boundary. All editor,
 * preview, import and animation operations continue to use RGB internally. */
export function convertMdxGeosetColorTracks(animations = []) {
  return animations.map(animation => {
    if (animation._MdxDefaults?.Color) animation = { ...animation, _MdxDefaults: { ...animation._MdxDefaults, Color: new Float32Array([...animation._MdxDefaults.Color].reverse()) } };
    if (!animation.Color?.Keys) return animation.Color ? { ...animation, Color: new Float32Array([animation.Color[2], animation.Color[1], animation.Color[0]]) } : animation;
    return { ...animation, Color: { ...animation.Color, Keys: animation.Color.Keys.map(key => {
      const result = { ...key };
      for (const field of ['Vector', 'InTan', 'OutTan']) if (key[field]) {
        result[field] = new Float32Array([key[field][2], key[field][1], key[field][0]]);
      }
      return result;
    }) } };
  });
}
