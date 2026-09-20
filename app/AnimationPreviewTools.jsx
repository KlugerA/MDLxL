import React, { useEffect, useRef, useState } from 'react';
import { PREVIEW_BACKGROUNDS } from './preview-backgrounds.js';
import './preview-tools.css';
import { createRecordingScheduler } from './recording-scheduler.js';
import { CAPTURE_QUALITIES, normalizeCapture } from '../src/capture-settings.js';
import { createNativePreviewRecorder } from './native-preview-recorder.js';

export default function AnimationPreviewTools({ active, sessionId, captureAPI, background, onBackground, backgrounds = PREVIEW_BACKGROUNDS, onRefreshBackgrounds, onBackgroundFolder, backgroundLoading = false, loop, onStatus, preferences }) {
  const captureSettings = normalizeCapture(preferences?.capture);
  const latest = useRef(); latest.current = { captureAPI, onStatus, active, sessionId };
  const job = useRef(null), retained = useRef(null), mounted = useRef(true), phase = useRef('idle'), closing = useRef(false);
  const [state, setState] = useState('idle'), [seconds, setSeconds] = useState(0), [error, setError] = useState('');
  const report = (message, failed = false) => latest.current.onStatus?.(message, failed);
  const update = value => { phase.current = value; if (mounted.current) setState(value); };
  async function saveCapture(payload) {
    retained.current = payload; update('saving');
    try {
      if (window.desktop?.saveCapture) {
        const result = payload.nativeJobId ? await window.desktop.savePreviewRecording(payload.nativeJobId) : await window.desktop.saveCapture(payload);
        report(`Saved ${result.path}`);
      } else {
        const url = URL.createObjectURL(new Blob([payload.bytes], { type: payload.format === 'gif' ? 'image/gif' : 'image/png' }));
        const a = document.createElement('a'); a.href = url; a.download = `Preview-${Date.now()}.${payload.format}`; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 10000); report('Preview downloaded.');
      }
      retained.current = null; if (mounted.current) setError(''); update('idle');
    } catch (cause) { if (mounted.current) setError(cause.message); update('retry'); report(`${payload.nativeJobId ? 'Capture kept on disk.' : 'Capture kept in memory.'} Save failed: ${cause.message}`, true); }
  }
  function finish() {
    const current = job.current;
    if (!current || current.finishing) return;
    current.finishing = true; clearInterval(current.timer); current.scheduler?.stop(); update('finishing');
    // Worker messages are ordered: every accepted frame finishes before this.
    current.worker.postMessage({ type: 'finish', time: performance.now() - current.started });
  }
  async function start() {
    if (job.current || retained.current) return;
    setError(''); update('starting');
    try {
      const api = latest.current.captureAPI;
      if (!api) throw Error('The animation preview is still loading.');
      await api.whenReady();
      if (closing.current || !latest.current.active || latest.current.sessionId !== sessionId) { update('idle'); return; }
      const quality = CAPTURE_QUALITIES[captureSettings.recordingQuality];
      const first = api.captureFrame({ maxDimension: quality.gifSize }), scale = Math.min(1, quality.gifSize / Math.max(first.width, first.height));
      const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(first.width * scale)); canvas.height = Math.max(1, Math.round(first.height * scale));
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (window.desktop && !window.desktop.beginPreviewRecording) throw Error('The native GIF bridge is unavailable. Restart the updated MDLxL package.');
      const worker = window.desktop ? createNativePreviewRecorder(window.desktop, { width: canvas.width, height: canvas.height, quality: captureSettings.recordingQuality }) : new Worker(new URL('./preview-gif.worker.js', import.meta.url), { type: 'module' });
      const current = { worker, canvas, context, ready: false, first, started: performance.now(), finishing: false };
      job.current = current; setSeconds(0);
      function captureFrame() {
        if (current.finishing) return;
        try {
          const api = latest.current.captureAPI;
          // Editing a bone or toggling effects rebuilds the native renderer.
          // Wait through that transition; actual timestamps retain its duration.
          if (!current.first && !api) return;
          if (!current.first && !api.isReady) {
            if (current.waitingAPI !== api) {
              current.waitingAPI = api;
              api.whenReady().then(() => { if (job.current === current) current.waitingAPI = null; }).catch(cause => {
                if (job.current === current && latest.current.captureAPI === api && latest.current.active && !current.finishing) { setError(cause.message); finish(); }
              });
            }
            return;
          }
          const frame = current.first || api.captureFrame({ maxDimension: quality.gifSize }); current.first = null;
          // Retain initial dimensions if the preview window is resized.
          const fit = Math.min(canvas.width / frame.width, canvas.height / frame.height);
          context.imageSmoothingEnabled = true; context.imageSmoothingQuality = 'high';
          context.fillStyle = '#ccc'; context.fillRect(0, 0, canvas.width, canvas.height);
          context.drawImage(frame, (canvas.width - frame.width * fit) / 2, (canvas.height - frame.height * fit) / 2, frame.width * fit, frame.height * fit);
          const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
          return { type: 'frame', buffer: pixels.data.buffer, width: canvas.width, height: canvas.height, time: performance.now() - current.started };
        } catch (cause) { setError(cause.message); finish(); }
      }
      worker.onmessage = ({ data }) => {
        if (data.type === 'ready') { current.ready = true; if (data.limit) { report(data.reason || 'Recording reached the GIF size limit; saving the captured preview.'); finish(); } else current.scheduler?.ready(); }
        else if (data.type === 'finished') { clearInterval(current.timer); job.current = null; worker.terminate(); saveCapture(data.nativeJobId ? { format: 'gif', nativeJobId: data.nativeJobId } : { format: 'gif', bytes: data.bytes }); }
        else if (data.type === 'error') fail(data.message);
      };
      function fail(message) { clearInterval(current.timer); current.scheduler?.stop({ flush: false }); worker.terminate(); job.current = null; setError(message); update('idle'); report(message, true); }
      worker.onerror = event => fail(event.message || 'GIF recording failed.');
      worker.postMessage({ type: 'start', loop, colors: quality.colors, dither: quality.dither });
      current.scheduler = createRecordingScheduler({ fps: captureSettings.fps, capture: captureFrame, send: frame => worker.postMessage(frame, [frame.buffer]) });
      current.timer = setInterval(() => { if (mounted.current) setSeconds((performance.now() - current.started) / 1000); }, 250);
      update('recording');
    } catch (cause) { setError(cause.message); update('idle'); report(cause.message, true); }
  }
  async function screenshot() {
    setError(''); update('saving');
    try {
      const api = latest.current.captureAPI;
      if (!api) throw Error('The animation preview is still loading.');
      await api.whenReady();
      const canvas = api.captureFrame({ maxDimension: CAPTURE_QUALITIES[captureSettings.screenshotQuality].screenshotSize });
      const blob = await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(Error('Screenshot could not be created.')), 'image/png'));
      await saveCapture({ format: 'png', bytes: new Uint8Array(await blob.arrayBuffer()) });
    } catch (cause) { setError(cause.message); update('idle'); report(cause.message, true); }
  }
  useEffect(() => { if (!active) finish(); }, [active]);
  useEffect(() => {
    const flush = event => event.detail.push((async () => {
      closing.current = true;
      try {
        finish();
        while (job.current || ['starting','finishing','saving'].includes(phase.current)) {
          finish(); await new Promise(resolve => setTimeout(resolve, 50));
        }
        if (retained.current) {
          await saveCapture(retained.current);
          if (retained.current) throw Error('The preview capture could not be saved. Use Retry Save before closing.');
        }
      } finally { closing.current = false; }
    })());
    window.addEventListener('mdlvis-flush-captures', flush);
    return () => window.removeEventListener('mdlvis-flush-captures', flush);
  }, []);
  useEffect(() => { window.desktop?.setCaptureBusy?.(state !== 'idle'); }, [state]);
  useEffect(() => () => finish(), [sessionId]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; finish(); }; }, []);
  if (!active && state !== 'retry') return null;
  const busy = !['idle', 'recording', 'retry'].includes(state);
  return <>
    <div className="animation-preview-tools" aria-label="Animation preview tools">
      <label>Select Background <select aria-label="Select Background" value={background} disabled={state === 'recording' || busy} onFocus={onRefreshBackgrounds} onPointerDown={onRefreshBackgrounds} onChange={event => onBackground(event.target.value)}><option value="">None</option>{backgrounds.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
      {onBackgroundFolder && <button onClick={onBackgroundFolder} title="Add PNG, JPG, WebP, BMP or GIF files here. Their filenames appear in Select Background.">Backgrounds Folder</button>}
      <button disabled={busy || state === 'retry' || (backgroundLoading && state !== 'recording') || (!captureAPI && state !== 'recording')} aria-pressed={state === 'recording'} onClick={state === 'recording' ? finish : start}>{state === 'recording' ? 'Finish' : state === 'finishing' ? 'Finishing…' : 'Record'}</button>
      <button disabled={busy || backgroundLoading || state === 'recording' || state === 'retry' || !captureAPI} onClick={screenshot}>Screenshot</button><span title="Change recording FPS and image quality in Settings → Capture">{captureSettings.fps} FPS · {captureSettings.recordingQuality}</span>
      {state === 'retry' && <button onClick={() => saveCapture(retained.current)}>Retry Save</button>}
      {busy && <span role="status">{state === 'starting' ? 'Preparing…' : state === 'finishing' ? 'Creating GIF…' : 'Saving…'}</span>}
      {error && <span className="capture-error" role="alert">{error}</span>}
    </div>
    {state === 'recording' && <div className="preview-recording-timer" role="timer" aria-label="Recording elapsed time">● {Math.floor(seconds / 60).toString().padStart(2, '0')}:{Math.floor(seconds % 60).toString().padStart(2, '0')}</div>}
  </>;
}
