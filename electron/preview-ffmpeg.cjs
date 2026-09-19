const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { savePreviewCaptureFile, validateGIFFile } = require('./preview-capture.cjs');
const { encodeCaptureQOI } = require('./capture-qoi.cjs');

const MAX_TEMP_BYTES = 8 * 1024 ** 3;
const DISK_RESERVE = 512 * 1024 ** 2;
const FRAME_METADATA_BYTES = 512; // Charge timestamp/path/concat bookkeeping to the recording budget.

function bitmap(rgba, width, height) {
  const bytes = Buffer.allocUnsafe(54 + width * height * 4);
  bytes.fill(0, 0, 54); bytes.write('BM'); bytes.writeUInt32LE(bytes.length, 2);
  bytes.writeUInt32LE(54, 10); bytes.writeUInt32LE(40, 14);
  bytes.writeInt32LE(width, 18); bytes.writeInt32LE(-height, 22);
  bytes.writeUInt16LE(1, 26); bytes.writeUInt16LE(32, 28);
  bytes.writeUInt32LE(width * height * 4, 34);
  // BMP BI_RGB is B,G,R,unused. Captures are already composited and opaque.
  for (let i = 0; i < rgba.length; i += 4) {
    bytes[54+i] = rgba[i+2]; bytes[55+i] = rgba[i+1]; bytes[56+i] = rgba[i]; bytes[57+i] = 255;
  }
  return bytes;
}

function timeline(frames, end) {
  if (!frames.length || !Number.isFinite(end) || end < frames.at(-1).time) throw Error('Invalid recording finish timestamp.');
  const total = Math.max(2, Math.round(end / 10));
  const entries = [];
  let start = 0;
  for (let i = 0; i < frames.length; i++) {
    const boundary = i + 1 < frames.length ? Math.min(total, Math.round(frames[i+1].time / 10)) : total;
    let duration = boundary - start;
    while (duration > 0) {
      const ticks = Math.min(65535, duration);
      entries.push({ file: frames[i].file, ticks }); duration -= ticks;
    }
    start = Math.max(start, boundary);
  }
  return { entries, duration: total * 10 };
}

function runFFmpeg(executable, args, job) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, ['-hide_banner', '-loglevel', 'error', '-nostdin', ...args], { cwd: job.directory, windowsHide: true, shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
    job.child = child;
    let diagnostic = '';
    child.stdout.resume();
    child.stderr.on('data', bytes => { diagnostic = (diagnostic + bytes.toString()).slice(-8000); });
    child.on('error', error => reject(Error(`Bundled FFmpeg could not start. Re-extract the complete MDLxL package. ${error.message}`)));
    child.on('close', code => {
      if (job.child === child) job.child = null;
      if (code === 0) resolve(); else reject(Error(`FFmpeg GIF encoding failed (${code}). ${diagnostic.trim()}`));
    });
  });
}

class PreviewRecordingStore {
  constructor({ executable = path.join(__dirname, 'ffmpeg', 'ffmpeg.exe'), temporaryRoot = path.join(os.tmpdir(), 'MDLxL-recordings'), destination, maxTempBytes = MAX_TEMP_BYTES } = {}) {
    this.executable = executable; this.temporaryRoot = temporaryRoot; this.destination = destination;
    this.maxTempBytes = maxTempBytes; this.jobs = new Map(); this.starting = new Set();
  }
  get(owner, id) {
    const job = typeof id === 'string' && this.jobs.get(id);
    if (!job || job.owner !== owner) throw Error('This recording is no longer available.');
    return job;
  }
  async begin(owner, options) {
    const { width, height, quality, loop } = options || {};
    if (![width,height].every(n => Number.isInteger(n) && n > 0 && n <= 1920) || !['low','medium','high'].includes(quality) || typeof loop !== 'boolean') throw Error('Invalid recording settings.');
    if (this.starting.has(owner) || [...this.jobs.values()].some(job => job.owner === owner)) throw Error('Finish and save the previous recording first.');
    this.starting.add(owner);
    try {
      await fs.access(this.executable).catch(() => { throw Error('Bundled FFmpeg is missing. Re-extract the complete MDLxL package to record GIFs.'); });
      await fs.mkdir(this.temporaryRoot, { recursive: true });
      const stat = await fs.statfs(this.temporaryRoot);
      const available = Number(stat.bavail) * Number(stat.bsize);
      const budget = Math.min(this.maxTempBytes, Math.floor((available - DISK_RESERVE) / 2));
      if (budget < width * height * 4 + 54) throw Error('Not enough temporary disk space to record. Free some disk space and try again.');
      const directory = await fs.mkdtemp(path.join(this.temporaryRoot, 'recording-'));
      const id = crypto.randomBytes(18).toString('hex');
      this.jobs.set(id, { id, owner, directory, width, height, quality, loop, budget, bytes: 0, accountedBytes: 0, frames: [], phase: 'recording', queue: Promise.resolve(), pending: 0 });
      return { jobId: id, storageBudget: budget };
    } finally { this.starting.delete(owner); }
  }
  frame(owner, payload) {
    const job = this.get(owner, payload?.jobId);
    const { width, height, time, buffer } = payload || {};
    const rgba = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : ArrayBuffer.isView(buffer) ? new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength) : null;
    if (job.phase !== 'recording' || job.pending >= 2 || width !== job.width || height !== job.height || !rgba || rgba.byteLength !== width * height * 4 || !Number.isFinite(time) || time < 0 || time < (job.lastRequestedTime ?? 0)) throw Error('Invalid recording frame or operation order.');
    job.lastRequestedTime = time; job.pending++;
    const operation = job.queue.then(async () => {
      if (job.limit) return { limit: true, reason: job.limit, accepted: false };
      const lossless = encodeCaptureQOI(rgba, width, height), size = lossless.length;
      const stat = await fs.statfs(job.directory);
      if (job.accountedBytes + size + FRAME_METADATA_BYTES > job.budget || Number(stat.bavail) * Number(stat.bsize) < DISK_RESERVE + size) {
        job.limit = 'Recording reached the temporary storage budget; saving the accepted frames.';
        return { limit: true, reason: job.limit, accepted: false };
      }
      const file = `frame-${String(job.frames.length).padStart(6, '0')}.qoi`;
      try { await fs.writeFile(path.join(job.directory, file), lossless, { flag: 'wx' }); }
      catch (error) {
        if (job.frames.length && ['ENOSPC','EDQUOT'].includes(error.code)) {
          await fs.rm(path.join(job.directory, file), { force: true });
          job.limit = 'Temporary disk space ran out; saving the accepted frames.';
          return { limit: true, reason: job.limit, accepted: false };
        }
        throw error;
      }
      job.frames.push({ file, time }); job.bytes += size; job.accountedBytes += size + FRAME_METADATA_BYTES;
      return { accepted: true, bytes: job.bytes };
    }).finally(() => { job.pending--; });
    job.queue = operation; return operation;
  }
  async finish(owner, payload) {
    const job = this.get(owner, payload?.jobId);
    if (job.phase !== 'recording') throw Error('Recording has already finished.');
    job.phase = 'encoding';
    try {
      await job.queue;
      const timing = timeline(job.frames, payload.time);
      const manifest = 'ffconcat version 1.0\n' + timing.entries.map(entry => `file '${entry.file}'\noption framerate 100\nduration ${(entry.ticks / 100).toFixed(2)}\n`).join('');
      await fs.writeFile(path.join(job.directory, 'frames.ffconcat'), manifest, { flag: 'wx' });
      const input = ['-f','concat','-safe','0','-i','frames.ffconcat'];
      const colors = job.quality === 'low' ? 128 : 256;
      await runFFmpeg(this.executable, [...input, '-vf', `palettegen=stats_mode=full:max_colors=${colors}`, '-frames:v','1','-y','palette.pam'], job);
      await runFFmpeg(this.executable, [...input, '-i','palette.pam','-lavfi',`paletteuse=dither=${job.quality === 'low' ? 'none' : 'sierra2_4a'}`,
        '-fps_mode','passthrough','-enc_time_base','1:100','-loop',job.loop ? '0' : '-1','-final_delay',String(timing.entries.at(-1).ticks),'-y','capture.gif'], job);
      job.output = path.join(job.directory, 'capture.gif');
      await validateGIFFile(job.output);
      job.phase = 'ready'; job.duration = timing.duration;
      // Once the usable result exists, Retry Save only needs that result.
      for (const frame of job.frames) await fs.rm(path.join(job.directory, frame.file), { force: true }).catch(() => {});
      job.frames = [];
      return { jobId: job.id, duration: job.duration, storageBytes: job.bytes };
    } catch (error) { await this.discard(owner, job.id); throw error; }
  }
  async save(owner, id) {
    const job = this.get(owner, id);
    if (job.phase !== 'ready') throw Error('The recording is not ready to save.');
    job.phase = 'saving';
    try {
      const result = await savePreviewCaptureFile(this.destination, job.output);
      await this.discard(owner, id).catch(error => console.warn(`Saved capture; temporary cleanup failed: ${error.message}`)); return result;
    } catch (error) { job.phase = 'ready'; throw error; }
  }
  async discard(owner, id) {
    const job = this.get(owner, id);
    job.phase = 'discarded';
    if (job.child) {
      const child = job.child;
      await new Promise(resolve => { child.once('close', resolve); child.kill(); });
    }
    await job.queue.catch(() => {});
    this.jobs.delete(id);
    // Directory is created by this store, never supplied by the renderer.
    if (path.dirname(job.directory) !== this.temporaryRoot || !path.basename(job.directory).startsWith('recording-')) throw Error('Invalid recording cleanup path.');
    await fs.rm(job.directory, { recursive: true, force: true });
  }
  async closeOwner(owner) {
    for (const job of [...this.jobs.values()].filter(value => value.owner === owner)) {
      try {
        if (job.phase === 'recording' && job.frames.length) await this.finish(owner, { jobId: job.id, time: Math.max(20, job.lastRequestedTime || 0) });
        if (job.phase === 'ready') await this.save(owner, job.id);
      } catch (error) { console.warn(`Preview capture retained at ${job.output || job.directory}: ${error.message}`); }
      // Never discard a completed GIF on destination failure.
      if (this.jobs.has(job.id) && !job.output) await this.discard(owner, job.id);
    }
  }
}
module.exports = { PreviewRecordingStore, bitmap, timeline, MAX_TEMP_BYTES, runFFmpeg };
