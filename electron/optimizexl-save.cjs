const fs = require('node:fs/promises');
const path = require('node:path');

/** Exclusive creation is the contract: no rename-overwrite, even in a race. */
async function saveOptimizeXLPair(directory, payload, io = fs) {
  const before = Buffer.from(payload.before || []), after = Buffer.from(payload.after || []);
  for (const bytes of [before, after]) if (!bytes.length || bytes.length > 256 * 1024 * 1024 || bytes.subarray(0, 4).toString() !== 'MDLX') throw Error('OptimizeXL requires two valid MDX files under 256 MB each.');
  let stem = path.basename(String(payload.name || 'model.mdx')).replace(/\.(?:mdx|mdl)$/i, '').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/[. ]+$/g, '').slice(0, 100) || 'model';
  if (/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i.test(stem)) stem = 'model_' + stem;
  for (let suffix = 0; suffix < 100000; suffix++) {
    const tag = suffix ? '_' + suffix : '';
    const paths = [path.join(directory, `${stem}_Before${tag}.mdx`), path.join(directory, `${stem}_After${payload.nuclear ? '_NUCLEAR' : ''}${tag}.mdx`)];
    const handles = [], owned = [];
    try {
      for (const file of paths) { handles.push(await io.open(file, 'wx')); owned.push(file); }
      for (let i = 0; i < 2; i++) { await handles[i].writeFile(i ? after : before); await handles[i].sync(); }
      for (const handle of handles) await handle.close(); handles.length = 0;
      for (let i = 0; i < 2; i++) if (!(await io.readFile(paths[i])).equals(i ? after : before)) throw Error('OptimizeXL write verification failed.');
      return { before: paths[0], after: paths[1] };
    } catch (error) {
      await Promise.allSettled(handles.map(handle => handle.close()));
      const cleanup = await Promise.allSettled(owned.map(file => io.unlink(file)));
      if (cleanup.some(r => r.status === 'rejected')) throw Error('Save failed and a partial new copy could not be removed. Original files were not overwritten.');
      if (error.code === 'EEXIST') continue;
      throw error;
    }
  }
  throw Error('No free OptimizeXL output names were found.');
}
module.exports = { saveOptimizeXLPair };
