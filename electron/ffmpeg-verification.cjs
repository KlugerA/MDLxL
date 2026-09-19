const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { promisify } = require('node:util');
const execFile = promisify(require('node:child_process').execFile);

async function verifyFFmpegBundle(directory) {
  const provenance = JSON.parse(await fs.readFile(path.join(directory, 'PROVENANCE.json'), 'utf8'));
  const required = ['ffmpeg.exe','libvpl-2.dll','libwinpthread-1.dll','libgcc_s_seh-1.dll','libstdc++-6.dll','libopenh264-7.dll',
    'COPYING.LGPLv2.1','LIBVPL-LICENSE.txt','LIBWINPTHREAD-LICENSE.txt','LIBOPENH264-LICENSE.txt','GCC-LICENSE.txt','GCC-RUNTIME-LIBRARY-EXCEPTION.txt','SOURCE.txt','REDISTRIBUTION.md'];
  for (const name of required) {
    const expected = provenance.files?.[name];
    if (!expected) throw Error(`Pinned FFmpeg file missing from provenance: ${name}`);
    const hash = crypto.createHash('sha256').update(await fs.readFile(path.join(directory,name))).digest('hex');
    if (hash !== expected) throw Error(`Pinned FFmpeg file differs: ${name}`);
  }
  const binary=path.join(directory,'ffmpeg.exe');
  const options={windowsHide:true,maxBuffer:4*1024*1024};
  const version=await execFile(binary,['-version'],options);
  const configuration=version.stdout.split(/\r?\n/).find(line=>line.startsWith('configuration:'));
  if (!version.stdout.includes('ffmpeg version 8.1.2 ') || !configuration || /--enable-(gpl|nonfree|version3)(?:\s|$)/.test(configuration)
    || !['gpl','nonfree','version3','autodetect'].every(flag=>configuration.includes(`--disable-${flag}`))) throw Error('FFmpeg is not the verified LGPL-only build.');
  const filters=await execFile(binary,['-hide_banner','-filters'],options);
  const encoders=await execFile(binary,['-hide_banner','-encoders'],options);
  const decoders=await execFile(binary,['-hide_banner','-decoders'],options);
  for(const filter of ['palettegen','paletteuse'])if(!new RegExp(`\\b${filter}\\b`).test(filters.stdout))throw Error(`FFmpeg filter missing: ${filter}`);
  for(const encoder of ['gif','pam'])if(!new RegExp(`\\b${encoder}\\b`).test(encoders.stdout))throw Error(`FFmpeg encoder missing: ${encoder}`);
  for(const decoder of ['qoi','pam'])if(!new RegExp(`\\b${decoder}\\b`).test(decoders.stdout))throw Error(`FFmpeg decoder missing: ${decoder}`);
  return { version:provenance.version, binarySha256:provenance.files['ffmpeg.exe'], files:required.length };
}
module.exports={verifyFFmpegBundle};
