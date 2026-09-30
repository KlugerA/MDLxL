/** Portable, bounded data encoding. No constructors, paths or code from input are executed. */
const types = { Float32Array, Float64Array, Uint8Array, Uint8ClampedArray, Uint16Array, Uint32Array, Int8Array, Int16Array, Int32Array };
export const PARTICLE_DATA_LIMIT = 16 * 1024 * 1024;
export function stringifyParticleData(value) {
  return JSON.stringify(value, (key, item) => {
    if (ArrayBuffer.isView(item)) {
      if (!Object.hasOwn(types, item.constructor.name)) throw Error('Unsupported typed array.');
      return { $array: item.constructor.name, values: Array.from(item) };
    }
    if (typeof item === 'number' && !Number.isFinite(item)) throw Error('Preset contains a non-finite number.');
    return item;
  });
}
export function parseParticleData(text) {
  if (typeof text !== 'string' || text.length > PARTICLE_DATA_LIMIT) throw Error('Preset exceeds 16 MiB.');
  // Check nesting before JSON.parse invokes its recursive reviver. Quoted braces are data.
  let depth=0,quoted=false,escaped=false;
  for(const character of text){
    if(quoted){if(escaped)escaped=false;else if(character==='\\')escaped=true;else if(character==='"')quoted=false;}
    else if(character==='"')quoted=true;
    else if(character==='{'||character==='['){if(++depth>40)throw Error('Preset is nested too deeply.');}
    else if(character==='}'||character===']')depth--;
  }
  let count = 0;
  const value = JSON.parse(text, (key, item) => {
    if (++count > 1000000) throw Error('Preset exceeds its data limit.');
    if (['__proto__', 'prototype', 'constructor'].includes(key)) throw Error('Unsafe preset property.');
    if (typeof item === 'number' && !Number.isFinite(item)) throw Error('Preset contains a non-finite number.');
    if (item && typeof item === 'object' && Object.hasOwn(item, '$array')) {
      const Type = types[item.$array];
      if (!Object.hasOwn(types, item.$array) || !Array.isArray(item.values) || item.values.length > 300000 ||
          item.values.some(n => typeof n !== 'number' || !Number.isFinite(n))) throw Error('Invalid preset array.');
      const out = new Type(item.values);
      if(out.some(n=>!Number.isFinite(n)))throw Error('Preset array exceeds finite native values.');
      if (!item.$array.startsWith('Float') && out.some((n, i) => n !== item.values[i])) throw Error('Integer array is outside its native domain.');
      return out;
    }
    return item;
  });
  const walk = (item, depth = 0) => {
    if (depth > 40) throw Error('Preset is nested too deeply.');
    if (item && typeof item === 'object' && !ArrayBuffer.isView(item)) for (const child of Object.values(item)) walk(child, depth + 1);
  };
  walk(value);
  return value;
}
export function safeParticlePath(value) {
  if (typeof value !== 'string' || value.length > 260 || /[\x00-\x1f]/.test(value)) return false;
  // CASC module prefixes are identities, never local filesystem drive prefixes.
  const logical = value.replace(/^(?:[\w.-]+\.w3mod:)+/i, '').replaceAll('\\', '/');
  return !logical.startsWith('/') && !/^[a-z]:/i.test(logical) && !logical.split('/').includes('..');
}
