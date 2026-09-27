import React, { useEffect, useRef, useState } from 'react';
import { CAPTURE_QUALITIES, normalizeCapture } from '../src/capture-settings.js';
import { recordingTimeline } from './showcase-timeline.js';
import './preview-tools.css';

export default function AnimationPreviewTools({ active, sessionId, captureAPI, modelName, loop, onStatus, onBusy, preferences }) {
  const [length, setLength] = useState(10), [state, setState] = useState('idle'), [seconds, setSeconds] = useState(0), [error, setError] = useState('');
  const latest = useRef(); latest.current = { captureAPI, onStatus, onBusy, active, sessionId };
  const running = useRef(null), retained = useRef(null), mounted = useRef(true);
  const settings = normalizeCapture(preferences?.capture);
  function status(next) { if (mounted.current) setState(next); latest.current.onBusy?.(next !== 'idle'); }
  async function save(payload) {
    retained.current = payload; status('saving');
    try {
      if (window.desktop) {
        const result = payload.nativeJobId ? await window.desktop.savePreviewRecording(payload.nativeJobId) : await window.desktop.saveCapture(payload);
        latest.current.onStatus?.(`Saved ${result.path}`);
      } else {
        const url = URL.createObjectURL(new Blob([payload.bytes], { type: payload.format === 'gif' ? 'image/gif' : 'image/png' }));
        const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${modelName || 'Model'}-${Date.now()}.${payload.format}`; anchor.click();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
      }
      retained.current = null; status('idle');
    } catch (cause) { if (mounted.current) setError(cause.message); status('retry'); latest.current.onStatus?.(`Capture retained. Save failed: ${cause.message}`, true); }
  }
  function stop() { if (running.current) running.current.stop = true; }
  async function start() {
    if (running.current || retained.current) return;
    const job = { stop: false, promise: null, api: captureAPI }; running.current = job;
    setError(''); setSeconds(0); status('starting');
    job.promise = (async () => {
      let worker, jobId;
      try {
        const timing = recordingTimeline(length, settings.fps), api = job.api;
        if (!api) throw Error('The Showcase preview is still loading.');
        await api.whenReady();
        if (job.stop) return;
        api.beginRecording();
        const quality = CAPTURE_QUALITIES[settings.recordingQuality];
        const first = api.recordingFrame(0, { maxDimension: quality.gifSize });
        const canvas = document.createElement('canvas'); canvas.width = first.width; canvas.height = first.height;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        let request;
        if (window.desktop) {
          if (!window.desktop.beginPreviewRecording) throw Error('Restart the complete updated MDLxL package to record GIFs.');
          ({ jobId } = await window.desktop.beginPreviewRecording({ width: canvas.width, height: canvas.height, quality: settings.recordingQuality, loop: !!loop, modelName }));
          request = message => window.desktop.writePreviewRecordingFrame({ jobId, ...message });
        } else {
          worker = new Worker(new URL('./preview-gif.worker.js', import.meta.url), { type: 'module' });
          worker.postMessage({ type: 'start', loop, colors: quality.colors, dither: quality.dither });
          request = message => new Promise((resolve, reject) => {
            worker.onmessage = ({ data }) => data.type === 'error' ? reject(Error(data.message)) : resolve(data);
            worker.onerror = event => reject(Error(event.message || 'GIF encoding failed.'));
            worker.postMessage(message, message.buffer ? [message.buffer] : []);
          });
        }
        status('recording');
        let count = 0;
        for (let index = 0; index < timing.frames && (!job.stop || index === 0); index++) {
          const frame = index === 0 ? first : api.recordingFrame(timing.time(index), { maxDimension: quality.gifSize });
          const fit = Math.min(canvas.width / frame.width, canvas.height / frame.height);
          context.fillStyle = '#000'; context.fillRect(0, 0, canvas.width, canvas.height);
          context.imageSmoothingEnabled = true; context.imageSmoothingQuality = 'high';
          context.drawImage(frame, (canvas.width - frame.width * fit) / 2, (canvas.height - frame.height * fit) / 2, frame.width * fit, frame.height * fit);
          const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
          const result = await request({ type: 'frame', width: canvas.width, height: canvas.height, time: timing.time(index), buffer: pixels.data.buffer });
          if (result.limit) throw Error(result.reason || 'Recording reached the GIF size limit. Reduce length or quality.');
          count++;
          if (mounted.current) setSeconds(Math.min(timing.duration, timing.time(count)) / 1000);
          // Let React and the native window process stop/close and portrait layout.
          await new Promise(resolve => setTimeout(resolve, 0));
        }
        const duration = Math.min(timing.duration, timing.time(count)); status('finishing');
        if (jobId) {
          await window.desktop.finishPreviewRecording({ jobId, time: duration });
          await save({ format: 'gif', nativeJobId: jobId, modelName }); jobId = null;
        } else {
          const result = await request({ type: 'finish', time: duration });
          await save({ format: 'gif', bytes: result.bytes, modelName });
        }
      } catch (cause) {
        if (jobId) await window.desktop.discardPreviewRecording(jobId);
        if (mounted.current) setError(cause.message); status('idle'); latest.current.onStatus?.(cause.message, true);
      } finally {
        worker?.terminate(); job.api?.endRecording(); running.current = null;
        if (job.stop && !retained.current) status('idle');
      }
    })();
    await job.promise;
  }
  async function screenshot() {
    setError(''); status('saving');
    try {
      if (!captureAPI) throw Error('The Showcase preview is still loading.');
      await captureAPI.whenReady();
      const canvas = captureAPI.captureFrame({ maxDimension: CAPTURE_QUALITIES[settings.screenshotQuality].screenshotSize });
      const blob = await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(Error('Screenshot could not be created.')), 'image/png'));
      await save({ format: 'png', modelName, bytes: new Uint8Array(await blob.arrayBuffer()) });
    } catch (cause) { setError(cause.message); status('idle'); latest.current.onStatus?.(cause.message, true); }
  }
  useEffect(() => { window.desktop?.setCaptureBusy?.(state !== 'idle'); }, [state]);
  useEffect(() => {
    const flush = event => event.detail.push((async () => { stop(); await running.current?.promise; if (retained.current) { await save(retained.current); if (retained.current) throw Error('Capture could not be saved. Use Retry Save before closing.'); } })());
    window.addEventListener('mdlvis-flush-captures', flush);
    return () => window.removeEventListener('mdlvis-flush-captures', flush);
  }, []);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; stop(); }; }, [sessionId]);
  useEffect(() => { if (!active) stop(); }, [active]);
  const busy = state !== 'idle';
  return <div className="animation-preview-tools" aria-label="Showcase recording">
    <label>Length (seconds)<input aria-label="Record length seconds" type="number" min="0.02" step="0.01" value={length} disabled={busy} onChange={event => setLength(event.target.value)}/></label>
    <button disabled={busy || !captureAPI} onClick={start}>Record</button>
    <button disabled={busy || !captureAPI} onClick={screenshot}>Screenshot</button>
    {state === 'recording' && <button onClick={stop}>Stop &amp; save</button>}
    {state === 'retry' && <button onClick={() => save(retained.current)}>Retry Save</button>}
    {busy && <div role="status">{state === 'starting' ? 'Preparing…' : state === 'finishing' ? 'Creating GIF…' : state === 'saving' ? 'Saving…' : state === 'recording' ? `${seconds.toFixed(2)} / ${Number(length).toFixed(2)} seconds` : 'Save needs retry'}</div>}
    {error && <div className="capture-error" role="alert">{error}</div>}
  </div>;
}
