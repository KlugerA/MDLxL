import React, { lazy, useMemo, useRef, useState, Suspense } from 'react';
import AnimationPreviewTools from './AnimationPreviewTools.jsx';
import { orbitView, showcaseAnimation, showcaseCamera } from './showcase-timeline.js';
import './showcase.css';

const GamePreview = lazy(() => import('./GamePreview.jsx'));

const CLEAN = Object.fromEntries(['bones','nodes','attachments','particles','boneLines','wires','vertices','grid','axes','normals','cameras'].map(key => [key, false]));
const point = view => ({ view, hold: 0, seconds: 2, curve: 'smooth', path: 'pan', turns: 0 });
function NumberField({ label, value, onChange, min, max, step = .01 }) {
  return <label>{label}<input aria-label={label} type="number" value={value} min={min} max={max} step={step} onChange={event => onChange(event.target.value === '' ? '' : Number(event.target.value))}/></label>;
}

export default function ShowcaseWorkspace({ model, modelName, modelPath, revision, textureAssets, preferences, teamColor, sessionId, background, backgroundLibrary, onBackground, onStatus }) {
  const [api, setAPI] = useState(null), [playing, setPlaying] = useState(false), [busy, setBusy] = useState(false);
  const [playlist, setPlaylist] = useState(() => model.Sequences?.length ? [{ sequence: 0, seconds: 3, speed: 1, loop: true }] : []);
  const [selection, setSelection] = useState(0), [frequency, setFrequency] = useState(3), [repeat, setRepeat] = useState(true);
  const [points, setPoints] = useState([]), [cameraMode, setCameraMode] = useState('free'), [orbitSpeed, setOrbitSpeed] = useState(30), [elevation, setElevation] = useState(15);
  const [quality, setQuality] = useState('high'), [fps, setFPS] = useState(30), [antialias, setAntialias] = useState(true), [resolution, setResolution] = useState(2);
  const [cameraIndex, setCameraIndex] = useState(0), [tool, setTool] = useState('rotate');
  const clock = useRef({ seconds: 0, revision: 0, recording: false, baseView: null });
  const current = useRef(); current.current = { model, playlist, repeat, points, cameraMode, orbitSpeed, elevation, playing };
  const director = useMemo(() => ({
    get playing() { return current.current.playing && !clock.current.recording; },
    get recording() { return clock.current.recording; },
    sample(delta = 0) {
      const settings = current.current, state = clock.current;
      if (settings.playing && !state.recording) state.seconds += delta / 1000;
      const animation = showcaseAnimation(settings.model, settings.playlist, state.seconds, settings.repeat);
      const animateCamera = settings.playing || state.recording;
      const camera = animateCamera && settings.cameraMode === 'sequence' ? showcaseCamera(settings.points, state.seconds) : animateCamera && settings.cameraMode === 'orbit' && state.baseView ? orbitView(state.baseView, state.seconds * settings.orbitSpeed, settings.elevation) : null;
      return { ...animation, camera, revision: state.revision };
    },
    begin(view) { clock.current = { ...clock.current, seconds: 0, revision: clock.current.revision + 1, recording: true, baseView: view }; },
    seekRecording(milliseconds) { clock.current.seconds = milliseconds / 1000; },
    end() { clock.current.recording = false; },
  }), []);
  function restart() { clock.current.seconds = 0; clock.current.revision++; clock.current.baseView = api?.cameraView(); api?.invalidate(); }
  function updatePlaylist(next) { setPlaylist(next); clock.current.seconds = 0; clock.current.revision++; api?.invalidate(); }
  function updatePoint(index, patch) { setPlaying(false); setPoints(rows => rows.map((row, i) => i === index ? { ...row, ...patch } : row)); }
  const localPreferences = useMemo(() => ({ ...preferences, graphics: { ...preferences.graphics, textures: true, lighting: true, particles: true, antialias, pixelRatio: resolution, maxFps: 60 },
    platform: { enabled: false }, capture: { fps, recordingQuality: quality, screenshotQuality: quality } }), [preferences, fps, quality, antialias, resolution]);
  return <div className="showcase-workspace">
    <aside className="showcase-sidebar" aria-label="Showcase controls">
      <fieldset><legend>Record</legend><AnimationPreviewTools active sessionId={sessionId} modelName={modelName} captureAPI={api} preferences={localPreferences} loop={repeat} onStatus={onStatus} onBusy={setBusy}/></fieldset>
      <fieldset disabled={busy}><legend>Model settings</legend>
        <label>Graphics quality<select aria-label="Graphics quality" value={quality} onChange={event => setQuality(event.target.value)}><option value="low">Low · 720 GIF / 1280 PNG</option><option value="medium">Medium · 1280 GIF / 1920 PNG</option><option value="high">Highest · 1920 GIF / 3840 PNG</option></select></label>
        <label><input type="checkbox" checked={antialias} onChange={event => setAntialias(event.target.checked)}/>Antialiasing</label>
        <label>Preview sampling<select aria-label="Preview sampling" value={resolution} onChange={event => setResolution(Number(event.target.value))}>{[1, 1.5, 2].map(value => <option key={value} value={value}>{value}×</option>)}</select></label>
        <label>Recording FPS<select aria-label="Recording FPS" value={fps} onChange={event => setFPS(Number(event.target.value))}>{[10,15,20,24,25,30,50].map(value => <option key={value}>{value}</option>)}</select></label>
        <small>Classic SD · full texture resolution · trilinear filtering · up to 16× anisotropy. GIF uses up to 256 colours; PNG preserves full colour.</small>
      </fieldset>
      <fieldset disabled={busy}><legend>Animations</legend>
        <label>Animation<select aria-label="Showcase animation" value={selection} onChange={event => setSelection(Number(event.target.value))}>{model.Sequences.map((row, index) => <option key={index} value={index}>{row.Name}</option>)}</select></label>
        <NumberField label="Change every (seconds)" min={.01} value={frequency} onChange={value => { setFrequency(value); if (value > 0) updatePlaylist(playlist.map(row => ({ ...row, seconds: value }))); }}/>
        <button disabled={!model.Sequences[selection]} onClick={() => updatePlaylist([...playlist, { sequence: selection, seconds: Number(frequency) > 0 ? Number(frequency) : 3, speed: 1, loop: true }])}>Add animation</button>
        <ol className="showcase-list">{playlist.map((row, index) => <li key={index}><strong>{index + 1}. {model.Sequences[row.sequence]?.Name}</strong>
          <NumberField label={`Animation ${index + 1} seconds`} min={.01} value={row.seconds} onChange={seconds => updatePlaylist(playlist.map((item, i) => i === index ? { ...item, seconds } : item))}/>
          <NumberField label={`Animation ${index + 1} speed`} min={.01} step={.1} value={row.speed} onChange={speed => updatePlaylist(playlist.map((item, i) => i === index ? { ...item, speed } : item))}/>
          <label><input type="checkbox" checked={row.loop && !model.Sequences[row.sequence]?.NonLooping} disabled={!!model.Sequences[row.sequence]?.NonLooping} onChange={event => updatePlaylist(playlist.map((item, i) => i === index ? { ...item, loop: event.target.checked } : item))}/>Loop animation</label>
          <button disabled={index === 0} onClick={() => { const rows = [...playlist]; [rows[index - 1], rows[index]] = [rows[index], rows[index - 1]]; updatePlaylist(rows); }}>Move up</button><button onClick={() => updatePlaylist(playlist.filter((_, i) => i !== index))}>Remove</button>
        </li>)}</ol>
        <label><input type="checkbox" checked={repeat} onChange={event => setRepeat(event.target.checked)}/>Repeat sequence / GIF</label>
        <button onClick={() => { if (!playing) clock.current.baseView ||= api?.cameraView(); setPlaying(!playing); }}>{playing ? 'Pause' : 'Play'}</button><button onClick={restart}>Restart</button>
        {!!model.Cameras?.length && <label>Portrait camera<select aria-label="Showcase portrait camera" value={cameraIndex} onChange={event => setCameraIndex(Number(event.target.value))}>{model.Cameras.map((camera, index) => <option key={index} value={index}>{camera.Name}</option>)}</select></label>}
      </fieldset>
      <fieldset disabled={busy}><legend>Camera</legend>
        <div>{['rotate','pan','zoom'].map(value => <button key={value} aria-pressed={tool === value} onClick={() => { setPlaying(false); setTool(value); }}>{value[0].toUpperCase() + value.slice(1)}</button>)}<button onClick={() => api?.fit()}>Fit</button></div>
        <label>Camera movement<select aria-label="Camera movement" value={cameraMode} onChange={event => { clock.current.baseView = api?.cameraView(); setCameraMode(event.target.value); }}><option value="free">My viewpoint</option><option value="orbit">Orbit model</option><option value="sequence">Camera sequence</option></select></label>
        {cameraMode === 'orbit' && <><NumberField label="Orbit degrees per second" value={orbitSpeed} step={1} onChange={setOrbitSpeed}/><NumberField label="Orbit elevation" value={elevation} min={-90} max={90} step={1} onChange={setElevation}/></>}
        <button disabled={!api} onClick={() => { setPlaying(false); setPoints([point(api.cameraView())]); setCameraMode('free'); }}>Set Camera Sequence</button>
        <button disabled={!api || !points.length} onClick={() => { setPlaying(false); setPoints([...points, point(api.cameraView())]); }}>Add viewpoint</button>
        <ol className="showcase-list">{points.map((row, index) => <li key={index}><strong>Viewpoint {index + 1}</strong>
          <button onClick={() => { setPlaying(false); setCameraMode('free'); api?.setCameraView(row.view); }}>View</button><button onClick={() => updatePoint(index, { view: api.cameraView() })}>Update viewpoint</button>
          <NumberField label={`Viewpoint ${index + 1} hold seconds`} min={0} value={row.hold} onChange={hold => updatePoint(index, { hold })}/>
          {index < points.length - 1 && <><NumberField label={`Viewpoint ${index + 1} travel seconds`} min={.01} value={row.seconds} onChange={seconds => updatePoint(index, { seconds })}/>
            <label>Path<select aria-label={`Viewpoint ${index + 1} path`} value={row.path} onChange={event => updatePoint(index, { path: event.target.value })}><option value="pan">Pan</option><option value="orbit">Orbit</option></select></label>
            {row.path === 'orbit' && <NumberField label={`Viewpoint ${index + 1} extra turns`} step={1} value={row.turns} onChange={turns => updatePoint(index, { turns: Math.trunc(turns) })}/>}
            <label>Curve<select aria-label={`Viewpoint ${index + 1} curve`} value={row.curve} onChange={event => updatePoint(index, { curve: event.target.value })}>{['linear','smooth','ease-in','ease-out'].map(value => <option key={value}>{value}</option>)}</select></label></>}
          <button onClick={() => setPoints(points.filter((_, i) => i !== index))}>Remove viewpoint</button>
        </li>)}</ol>
        {!!points.length && <button onClick={() => { setCameraMode('sequence'); restart(); setPlaying(true); }}>Play camera sequence</button>}
      </fieldset>
      <fieldset disabled={busy}><legend>Background</legend><label>Select Background<select aria-label="Select Background" value={background} onFocus={backgroundLibrary.refresh} onChange={event => onBackground(event.target.value)}><option value="">None</option>{backgroundLibrary.items.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><button onClick={backgroundLibrary.openFolder}>Backgrounds Folder</button></fieldset>
    </aside>
    <section className="showcase-preview" aria-label="Showcase preview"><Suspense fallback={<div className="classic-empty-view">Loading model preview…</div>}><GamePreview showcase={director} presentation="preview" previewMode="textured" mode="textured" overlays={CLEAN} showGrid={false} showAxes={false} showParticles={true} playing={false} sequenceIndex={0} time={model.Sequences?.[0]?.Interval?.[0] || 0} model={model} revision={revision} modelPath={modelPath} textureAssets={textureAssets} preferences={localPreferences} teamColor={teamColor} view="perspective" cameraMode={tool} portraitCameraIndex={cameraIndex} preparePortraitFrame={playlist.some(row => /portrait/i.test(model.Sequences[row.sequence]?.Name || ''))} onCaptureReady={setAPI} backgroundUrl={backgroundLibrary.url} backgroundType={backgroundLibrary.type} preserveCameraView showcasePlaying={playing} showcaseConfig={[playlist, repeat, cameraMode, points, orbitSpeed, elevation]}/></Suspense></section>
  </div>;
}
