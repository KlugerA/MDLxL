import { showcaseAnimation } from './showcase-timeline.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const mix = (a, b, t) => a + (b - a) * t;
export const shotCount = value => clamp(Math.round(Number(value) || 1), 1, 20);
export const SHOWCASE_QUALITY = {
  low: { pixelRatio: 1, antialias: false, anisotropy: 1, textureFiltering: 'bilinear' },
  medium: { pixelRatio: 1.5, antialias: true, anisotropy: 4, textureFiltering: 'trilinear' },
  high: { pixelRatio: 2, antialias: true, anisotropy: 16, textureFiltering: 'trilinear' },
};
export function centeredView(view, center) {
  return { ...view, position: [...view.position], target: [...center] };
}
/** Axis passes through the model's bounds center, including off-origin models. */
export function orbitModelView(view, degrees, axis = 'z', center = view.target) {
  const v = view.position.map((value, i) => value - center[i]), a = degrees * Math.PI / 180;
  const c = Math.cos(a), s = Math.sin(a), [x,y,z] = v;
  const offset = axis === 'x' ? [x,y*c-z*s,y*s+z*c] : axis === 'y' ? [x*c+z*s,y,-x*s+z*c] : [x*c-y*s,x*s+y*c,z];
  return { ...view, target: [...center], position: offset.map((value,i) => value + center[i]) };
}
/** Shared path duration; speed changes traversal time, then holds the final view. */
export function cameraPathView(points, seconds, length, { speed = 100, curve = 'arc', smoothness = 50 } = {}, center) {
  if (!points.length) return null;
  const progress = clamp(seconds / Math.max(.02, Number(length)) * Number(speed) / 100, 0, 1) * (points.length - 1);
  const index = Math.min(points.length - 1, Math.floor(progress)), a = centeredView(points[index].view, center);
  if (index === points.length - 1) return a;
  const b = centeredView(points[index + 1].view, center);
  const raw = progress - index, t = mix(raw, raw*raw*(3-2*raw), clamp(smoothness / 100,0,1));
  const view = { ...a, position: a.position.map((v,i) => mix(v,b.position[i],t)) };
  for (const key of ['roll','fieldOfView','near','far']) view[key] = mix(a[key],b[key],t);
  if (curve === 'arc') {
    const from = a.position.map((v,i) => v-center[i]), to = b.position.map((v,i) => v-center[i]);
    const radiusA = Math.hypot(...from), radiusB = Math.hypot(...to);
    if (radiusA > 0 && radiusB > 0) {
      const u = from.map(v => v/radiusA), v = to.map(v => v/radiusB), dot = clamp(u.reduce((sum,n,i)=>sum+n*v[i],0),-1,1);
      const angle = Math.acos(dot), sin = Math.sin(angle);
      let direction;
      if (dot < -.9999) {
        const basis = Math.abs(u[2]) < .9 ? [0,0,1] : [0,1,0];
        const cross = [u[1]*basis[2]-u[2]*basis[1],u[2]*basis[0]-u[0]*basis[2],u[0]*basis[1]-u[1]*basis[0]];
        const size = Math.hypot(...cross);
        direction = u.map((n,i)=>n*Math.cos(Math.PI*t)+cross[i]/size*Math.sin(Math.PI*t));
      } else direction = sin > .0001 ? u.map((n,i)=>(n*Math.sin((1-t)*angle)+v[i]*Math.sin(t*angle))/sin) : u.map((n,i)=>mix(n,v[i],t));
      const radius = mix(radiusA,radiusB,t);
      view.position = direction.map((n,i)=>center[i]+n*radius);
    }
  }
  return view;
}
export function overflowEntries(playlist, length) {
  let end = 0;
  return playlist.map(row => (end += Math.max(.02, Number(row.seconds) || 3)) > Number(length) + 1e-8);
}
export function screenshotPlan(model, playlist, base, { viewpoint = 'frontal', axis = 'z', random = Math.random } = {}) {
  return playlist.flatMap((row, entry) => {
    const sequence = model.Sequences?.[row.sequence];
    if (!sequence) return [];
    const takes = shotCount(row.shots), [start,end] = sequence.Interval;
    const radius = Math.hypot(...base.position.map((value,i)=>value-base.target[i]));
    return Array.from({length:takes},(_,index) => {
      const pose = (index + .5) / takes;
      let camera = { ...base, position: [base.target[0]+radius,base.target[1],base.target[2]+radius*.12] };
      if (viewpoint === 'orbital') camera = orbitModelView(base,360*index/takes,axis);
      if (viewpoint === 'zoom') {
        const direction = axis === 'x' ? [1,0,0] : axis === 'y' ? [0,-1,0] : [0,0,1];
        const distance = radius * mix(1.25,.6,takes === 1 ? .5 : index/(takes-1));
        camera = { ...base, position: direction.map((v,i)=>base.target[i]+v*distance) };
      }
      if (viewpoint === 'free') {
        const azimuth = (index / takes * 360 + random()*45) * Math.PI / 180, elevation = (8+random()*32)*Math.PI/180;
        const distance = radius * (.85+random()*.3);
        camera = { ...base, position: [Math.cos(azimuth)*Math.cos(elevation),Math.sin(azimuth)*Math.cos(elevation),Math.sin(elevation)].map((v,i)=>base.target[i]+v*distance) };
      }
      const localTime = (end-start)*pose;
      return { entry, index, animationName: sequence.Name, camera, sequenceIndex: row.sequence, frame: start+localTime, localTime, globalTime: localTime, segment: entry, portrait: /portrait/i.test(sequence.Name || '') };
    });
  });
}
/** Wall time owns live recording; encoder throughput never changes animation speed. */
export function createShowcaseDirector(getSettings, now = () => performance.now()) {
  const clock = { seconds: 0, revision: 0, recording: false, live: false, baseView: null, center: [0,0,0], shot: null };
  return {
    clock,
    get playing() { return clock.live || getSettings().playing && !clock.recording; },
    get recording() { return clock.recording; },
    sample(delta = 0) {
      const settings = getSettings();
      if (clock.live) clock.seconds = Math.min(clock.duration, Math.max(0,now()-clock.started)) / 1000;
      else if (settings.playing && !clock.recording) clock.seconds += delta/1000;
      if (clock.shot) return { ...clock.shot, revision: clock.revision, presentationTime: clock.seconds*1000 };
      const animation = showcaseAnimation(settings.model,settings.playlist,clock.seconds,false);
      const animateCamera = settings.playing || clock.recording;
      const time = settings.playing && !clock.recording ? clock.seconds % Math.max(.02,Number(settings.length)) : clock.seconds;
      const camera = animateCamera && settings.cameraMode === 'sequence'
        ? cameraPathView(settings.points,time,settings.length,settings.motion,clock.center)
        : animateCamera && settings.cameraMode === 'orbit' && (settings.orbitBase || clock.baseView)
          ? orbitModelView(settings.orbitBase || clock.baseView,360*time/Math.max(.02,Number(settings.length)),settings.orbitAxis,clock.center) : null;
      return { ...animation, camera, revision: clock.revision, presentationTime: clock.seconds*1000 };
    },
    reset(view, center) { Object.assign(clock,{seconds:0,revision:clock.revision+1,baseView:view,center,shot:null}); },
    begin(view, options = {}) {
      Object.assign(clock,{seconds:0,revision:clock.revision+1,recording:true,live:!!options.live,started:now(),duration:options.duration,baseView:view,center:options.center || view.target,shot:null});
    },
    seekRecording(milliseconds) { clock.seconds = milliseconds/1000; },
    setShot(shot) { clock.shot = shot; clock.seconds = shot.localTime/1000; clock.revision++; },
    freeze(milliseconds) { clock.live = false; clock.seconds = milliseconds/1000; },
    end() { clock.recording = false; clock.live = false; clock.shot = null; },
  };
}
