const fields = ['Vector', 'InTan', 'OutTan'];

/** Warcraft MDX stores affected colour triples as B, G, R. UI and renderers use R, G, B. */
export function warcraftColorToRgb(value) {
  if (value == null) return value;
  const color = Array.from(value);
  if (color.length !== 3) throw new Error('Warcraft colours must contain exactly three channels.');
  return new Float32Array([color[2], color[1], color[0]]);
}

/** Convert a human-facing R, G, B triple back to Warcraft MDX B, G, R storage order. */
export const rgbToWarcraftColor = warcraftColorToRgb;

function convertTrack(value) {
  if (value == null || !value.Keys) return warcraftColorToRgb(value);
  return {
    ...value,
    Keys: value.Keys.map(key => {
      const converted = { ...key };
      for (const field of fields) if (key[field]) converted[field] = warcraftColorToRgb(key[field]);
      return converted;
    }),
  };
}

/** Return a detached RGB view of a static colour or animated colour track. */
export const warcraftColorTrackToRgb = convertTrack;

/** Return a detached Warcraft-order copy of a human-facing RGB value or track. */
export const rgbTrackToWarcraftColor = convertTrack;
