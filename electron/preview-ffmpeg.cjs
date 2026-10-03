const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { savePreviewCaptureFile, validateGIFFile, showcaseDirectory, joinGIFSections } = require('./preview-capture.cjs');
const { Worker, isMarkedAsUntransferable } = require('node:worker_threads');

const MAX_TEMP_BYTES = 8 * 1024 ** 3;
const DISK_RESERVE = 512 * 1024 ** 2;
const FRAME_METADATA_BYTES = 512; // Charge timestamp/path/concat bookkeeping to the recording budget.
// Keep local Showcase saves within the former Catbox encoding budget.
const LOCAL_GIF_LIMIT = 20 * 1024 * 1024;

function gifSizeLimit(exportTarget, quality, duration) {
  if (exportTarget === 'hive') return Math.max(90000, Math.floor(45_000_000 * duration / 10000));
  if (exportTarget !== undefined && exportTarget !== null) return Infinity;
  return LOCAL_GIF_LIMIT;
}

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

// One worker per recording, with the existing bounded queue providing backpressure.
function encodeFrame(job, rgba, width, height) {
  if (!job.encoder) {
    job.encoder = new Worker(path.join(__dirname, 'capture-qoi-worker.cjs'));
    job.encoder.on('error', error => { job.encoderError = error; });
  }
  if (job.encoderError) return Promise.reject(job.encoderError);
  return new Promise((resolve, reject) => {
    const worker = job.encoder;
    const cleanup = () => { worker.off('message', message); worker.off('error', failed); worker.off('exit', exited); };
    const message = result => { cleanup(); result.error ? reject(Error(result.error)) : resolve(result.bytes); };
    const failed = error => { cleanup(); reject(error); };
    const exited = code => failed(Error('Recording frame worker exited (' + code + ').'));
    worker.once('message', message); worker.once('error', failed); worker.once('exit', exited);
    // IPC supplied these bytes exclusively for this frame; no model buffers enter here.
    const pixels = rgba.byteOffset || rgba.byteLength !== rgba.buffer.byteLength || isMarkedAsUntransferable(rgba.buffer) ? new Uint8Array(rgba) : rgba;
    worker.postMessage({rgba:pixels,width,height}, [pixels.buffer]);
  });
}

function runFFmpeg(executable, args, job) {
  return new Promise((resolve, reject) => {
    if (job.phase === 'discarded') { reject(Error('Recording was discarded.')); return; }
    const child = spawn(executable, ['-hide_banner', '-loglevel', 'error', '-nostdin', '-threads', '2', '-filter_threads', '2', '-filter_complex_threads', '2', ...args], { cwd: job.directory, windowsHide: true, shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
    (job.children ||= new Set()).add(child);
    let diagnostic = '';
    child.stdout.resume();
    child.stderr.on('data', bytes => { diagnostic = (diagnostic + bytes.toString()).slice(-8000); });
    child.on('error', error => reject(Error(`Bundled FFmpeg could not start. Re-extract the complete MDLxL package. ${error.message}`)));
    child.on('close', code => {
      job.children.delete(child);
      if (code === 0) resolve(); else reject(Error(`FFmpeg GIF encoding failed (${code}). ${diagnostic.trim()}`));
    });
  });
}

class PreviewRecordingStore {
  constructor({ executable = path.join(__dirname, 'ffmpeg', 'ffmpeg.exe'), temporaryRoot = path.join(os.tmpdir(), 'MDLxL-recordings'), destination, maxTempBytes = MAX_TEMP_BYTES } = {}) {
    this.executable = executable; this.temporaryRoot = temporaryRoot; this.destination = destination;
    this.maxTempBytes = maxTempBytes; this.jobs = new Map(); this.starting = new Set();
    this.encodingQueue = Promise.resolve();
  }
  temporaryBytes() { return [...this.jobs.values()].reduce((sum, job) => sum + job.accountedBytes, 0); }
  get(owner, id) {
    const job = typeof id === 'string' && this.jobs.get(id);
    if (!job || job.owner !== owner) throw Error('This recording is no longer available.');
    return job;
  }
  async begin(owner, options) {
    const { width, height, quality, loop, modelName, exportTarget } = options || {};
    if(exportTarget!==undefined&&!['hive','hive-main'].includes(exportTarget))throw Error('Invalid export target.');
    if (![width,height].every(n => Number.isInteger(n) && n > 0 && n <= 1920) || !['low','medium','high'].includes(quality) || typeof loop !== 'boolean') throw Error('Invalid recording settings.');
    if (this.starting.has(owner) || [...this.jobs.values()].some(job => job.owner === owner && job.phase === 'recording')) throw Error('Finish capturing the current recording first.');
    this.starting.add(owner);
    try {
      await fs.access(this.executable).catch(() => { throw Error('Bundled FFmpeg is missing. Re-extract the complete MDLxL package to record GIFs.'); });
      await fs.mkdir(this.temporaryRoot, { recursive: true });
      const stat = await fs.statfs(this.temporaryRoot);
      const available = Number(stat.bavail) * Number(stat.bsize);
      const budget = Math.min(this.maxTempBytes - this.temporaryBytes(), Math.floor((available - DISK_RESERVE) / 2));
      if (budget < width * height * 4 + 54) throw Error('Not enough temporary disk space to record. Free some disk space and try again.');
      const directory = await fs.mkdtemp(path.join(this.temporaryRoot, 'recording-'));
      const id = crypto.randomBytes(18).toString('hex');
      this.jobs.set(id, { id, owner, directory, width, height, quality, loop, modelName, exportTarget, budget, bytes: 0, accountedBytes: 0, frames: [], phase: 'recording', queue: Promise.resolve(), pending: 0 });
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
      const lossless = await encodeFrame(job, rgba, width, height), size = lossless.length;
      const stat = await fs.statfs(job.directory);
      if (job.accountedBytes + size + FRAME_METADATA_BYTES > job.budget || this.temporaryBytes() + size + FRAME_METADATA_BYTES > this.maxTempBytes || Number(stat.bavail) * Number(stat.bsize) < DISK_RESERVE + size) {
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
  finish(owner, payload) {
    const job = this.get(owner, payload?.jobId);
    if (job.phase !== 'recording') throw Error('Recording has already finished.');
    job.phase = 'queued';
    // Only one GIF uses the encoder at a time. Capturing a new take remains free
    // to use the renderer and its lossless frame worker while this queue runs.
    job.finishPromise = this.encodingQueue.then(async () => {
      if (job.phase === 'discarded') throw Error('Recording was discarded.');
      job.phase = 'encoding';
      try {
        job.encodingWork = this.encode(job, payload.time);
        return await job.encodingWork;
      } catch (error) {
        if (this.jobs.has(job.id)) await this.discard(owner, job.id);
        throw error;
      }
    });
    this.encodingQueue = job.finishPromise.catch(() => {});
    return job.finishPromise;
  }
  async encode(job, time) {
    await job.queue;
    if (job.encoder) { await job.encoder.terminate(); job.encoder = null; }
    const timing = timeline(job.frames, time);
    if(['hive','hive-main'].includes(job.exportTarget)&&timing.duration>5000)throw Error('Hive does not support GIF previews longer than 5 seconds.');
    const manifest = entries => 'ffconcat version 1.0\n' + entries.map(entry => `file '${entry.file}'\noption framerate 100\nduration ${(entry.ticks / 100).toFixed(2)}\n`).join('');
    await fs.writeFile(path.join(job.directory, 'frames.ffconcat'), manifest(timing.entries), { flag: 'wx' });
    const input = name => ['-f','concat','-safe','0','-i',name];
    const colors = job.quality === 'low' ? 128 : 256;
    // Preserve the frame schedule and palette quality. Size is controlled by
    // spatial resolution, never by dropping frames or truncating the take.
    const limit = gifSizeLimit(job.exportTarget,job.quality,timing.duration);
    const target = limit * .94;
    const presetScale=job.exportTarget===undefined||job.exportTarget===null?Math.min(1,864/Math.max(job.width,job.height)):job.exportTarget==='hive'?Math.min(1,Math.sqrt(300000/(job.width*job.height))):1;
    let width=Math.max(1,Math.floor(job.width*presetScale)),height=Math.max(1,Math.floor(job.height*presetScale));
    if(job.exportTarget==='hive-main'){width=612;height=490;}
    const output = path.join(job.directory, 'capture.gif');
    const scale = () => `scale=${width}:${height}:force_original_aspect_ratio=decrease:flags=lanczos,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1`;
    const palette = () => runFFmpeg(this.executable, [...input('frames.ffconcat'), '-vf', `${scale()},palettegen=stats_mode=full:max_colors=${colors}`, '-frames:v','1','-y','palette.pam'], job);
    const encode = (name, file, last) => runFFmpeg(this.executable, [...input(name), '-i','palette.pam','-lavfi',`[0:v]${scale()}[scaled];[scaled][1:v]paletteuse=dither=${job.quality === 'low' ? 'none' : 'sierra2_4a'}:diff_mode=rectangle`,
      '-fps_mode','passthrough','-enc_time_base','1:100','-loop',job.loop ? '0' : '-1','-final_delay',String(last),'-y',file], job);
    const shrink = size => {
      const factor=Math.min(.95,Math.sqrt(target/size));
      const nextWidth=Math.max(1,Math.floor(width*factor)),nextHeight=Math.max(1,Math.floor(height*factor));
      if(nextWidth===width&&nextHeight===height)throw Error('GIF cannot fit the recording size budget.');
      width=nextWidth;height=nextHeight;
    };
    await palette();
    // Short consecutive windows spread through the take estimate actual GIF
    // compression before spending time encoding a huge full-resolution file.
    if(timing.entries.length>30&&width*height*timing.entries.length*2>limit){
      const sample=[];
      for(let group=0;group<3;group++){
        const start=Math.floor(group*(timing.entries.length-10)/2);
        sample.push(...timing.entries.slice(start,start+10));
      }
      await fs.writeFile(path.join(job.directory,'sample.ffconcat'),manifest(sample));
      await encode('sample.ffconcat','sample.gif',sample.at(-1).ticks);
      const estimate=(await validateGIFFile(path.join(job.directory,'sample.gif')))*timing.entries.length/sample.length;
      await fs.rm(path.join(job.directory,'sample.gif'));
      if(estimate>limit){shrink(estimate);await palette();}
    }
    const capacity = Math.min(4, Math.max(1, Math.floor(os.availableParallelism() / 4)));
    const parts = Math.min(capacity, Math.max(1, Math.floor(timing.entries.length / 60)));
    const sections = Array.from({ length: parts }, (_, index) => {
      const entries = timing.entries.slice(Math.floor(index * timing.entries.length / parts), Math.floor((index + 1) * timing.entries.length / parts));
      return { entries, manifest: 'part-' + index + '.ffconcat', output: 'part-' + index + '.gif' };
    });
    for(const section of sections)await fs.writeFile(path.join(job.directory,section.manifest),manifest(section.entries));
    for(;;){
      if(parts===1)await encode('frames.ffconcat','capture.gif',timing.entries.at(-1).ticks);
      else{
        const results=await Promise.allSettled(sections.map(section=>encode(section.manifest,section.output,section.entries.at(-1).ticks)));
        const failed=results.find(result=>result.status==='rejected');if(failed)throw failed.reason;
        const joined=await joinGIFSections(sections.map(section=>path.join(job.directory,section.output)),output);
        if(joined.frames!==timing.entries.length||joined.duration!==timing.duration)throw Error('GIF sections did not preserve the recording timeline.');
        for(const section of sections)await fs.rm(path.join(job.directory,section.output));
      }
      const size=await validateGIFFile(output);
      if(size<=limit)break;
      // Re-encode from the lossless captures, never from a previously quantized GIF.
      shrink(size);await fs.rm(output);await palette();
    }
    job.outputWidth=width;job.outputHeight=height;
    if (job.phase === 'discarded') throw Error('Recording was discarded.');
    job.output = output; job.duration = timing.duration;
    // Once the usable result exists, Retry Save only needs that result.
    for (const frame of job.frames) await fs.rm(path.join(job.directory, frame.file), { force: true }).catch(() => {});
    job.frames = []; job.accountedBytes = (await fs.stat(output)).size;
    job.phase = 'ready';
    return { jobId: job.id, duration: job.duration, storageBytes: job.bytes, width:job.outputWidth, height:job.outputHeight, outputBytes:job.accountedBytes };
  }
  async save(owner, id) {
    const job = this.get(owner, id);
    if (job.phase !== 'ready') throw Error('The recording is not ready to save.');
    job.phase = 'saving';
    try {
      const result = await savePreviewCaptureFile(showcaseDirectory(this.destination, job.modelName), job.output,job.exportTarget==='hive-main'?'Hive-Main-Picture':'Preview');
      await this.discard(owner, id).catch(error => console.warn(`Saved capture; temporary cleanup failed: ${error.message}`)); return result;
    } catch (error) { job.phase = 'ready'; throw error; }
  }
  discard(owner, id) {
    const job = this.get(owner, id);
    if (job.discardPromise) return job.discardPromise;
    job.phase = 'discarded';
    job.discardPromise = (async () => {
      await Promise.all([...(job.children || [])].map(child => new Promise(resolve => { child.once('close', resolve); child.kill(); })));
      await job.queue.catch(() => {});
      await job.encodingWork?.catch(() => {});
      if (job.encoder) { await job.encoder.terminate(); job.encoder = null; }
      this.jobs.delete(id);
      // Directory is created by this store, never supplied by the renderer.
      if (path.dirname(job.directory) !== this.temporaryRoot || !path.basename(job.directory).startsWith('recording-')) throw Error('Invalid recording cleanup path.');
      await fs.rm(job.directory, { recursive: true, force: true });
    })();
    return job.discardPromise;
  }
  async closeOwner(owner) {
    for (const job of [...this.jobs.values()].filter(value => value.owner === owner)) {
      try {
        if (job.phase === 'queued' || job.phase === 'encoding') await job.finishPromise;
        if (job.phase === 'recording' && job.frames.length) await this.finish(owner, { jobId: job.id, time: Math.max(20, job.lastRequestedTime || 0) });
        if (job.phase === 'ready') await this.save(owner, job.id);
      } catch (error) { console.warn(`Preview capture retained at ${job.output || job.directory}: ${error.message}`); }
      // Never discard a completed GIF on destination failure.
      if (this.jobs.has(job.id) && !job.output) await this.discard(owner, job.id);
    }
  }
}
module.exports = { PreviewRecordingStore, bitmap, timeline, gifSizeLimit, MAX_TEMP_BYTES, runFFmpeg };
