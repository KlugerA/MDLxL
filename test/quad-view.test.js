import test from 'node:test';
import assert from 'node:assert/strict';
import { OrthographicCamera, Vector3 } from 'three';
import { QUAD_VIEWS, QUAD_VIEW_OPTIONS, viewWorkplane, viewportRects } from '../app/quad-view.js';
import { VIEW_PRESETS, applyViewPreset, quadProjectedPlaneTranslation } from '../app/viewport-math.js';
import { quadGridLayout } from '../app/quad-grid.js';
import { BUILT_IN_VIEWPORT_PRESETS, normalizeViewportAppearance } from '../src/viewport-appearance.js';
import { exportConfiguration, importConfiguration } from '../src/portable-settings.js';
import { planeAxes } from '../app/classic-gestures.js';
import { transformVertices } from '../src/editor-commands.js';

test('quad editing planes follow Warcraft view presets, including reverse views', () => {
  assert.deepEqual(QUAD_VIEWS.map(pane => viewWorkplane(pane.view)), ['yz', 'xy', 'xz', null]);
  assert.equal(viewWorkplane('back'), 'yz');
  assert.equal(viewWorkplane('left'), 'xz');
  assert.equal(viewWorkplane('bottom'), 'xy');
  assert.equal(viewWorkplane('orthographic'), null);
});

test('existing plane solver and transform commit preserve exact depth in all orthographic panes', () => {
  for (const [view] of QUAD_VIEW_OPTIONS.filter(([view]) => viewWorkplane(view))) {
    const camera = new OrthographicCamera(-200,200,130,-130,.1,2000), pivot = new Vector3(17,29,43);
    applyViewPreset(camera,view,new Vector3(),600);
    const plane = viewWorkplane(view), axes = planeAxes(plane), depth = [0,1,2].find(axis => !axes.includes(axis));
    const project = point => {const p=point.clone().project(camera);return [(p.x+1)*400,(1-p.y)*260];};
    const center=project(pivot), basis=axes.map(axis=>{const p=pivot.clone();p.setComponent(axis,p.getComponent(axis)+1);return project(p).map((v,i)=>v-center[i]);});
    for (const shift of [false,true]) {
      const delta=quadProjectedPlaneTranslation(plane,basis,31,-19,shift);
      assert.equal(delta[depth],0);
      const geoset={Vertices:new Float32Array([17,29,43,101,103,107])};
      transformVertices(geoset,[0],delta,[1,1,1],[0,0,0],pivot.toArray());
      assert.equal(geoset.Vertices[depth],pivot.getComponent(depth));
      assert.deepEqual(Array.from(geoset.Vertices.slice(3)),[101,103,107]);
      assert.ok(axes.some(axis=>geoset.Vertices[axis]!==pivot.getComponent(axis)));
    }
  }
});

test('quad rectangles tile odd window sizes without gaps or overlaps', () => {
  for(const [w,h] of [[1757,879],[643,401],[1000,720]]){
    const rects=viewportRects(w,h,true);
    assert.equal(rects.reduce((sum,r)=>sum+r.width*r.height,0),w*h);
    assert.equal(rects[0].width,rects[1].left);
    assert.equal(rects[0].height,rects[2].top);
    assert.deepEqual(viewportRects(w,h,false),[{left:0,top:0,width:w,height:h}]);
  }
});

test('quad commands expose only the fixed planes and perspective, with horizontal and vertical Shift drags', () => {
  assert.deepEqual(QUAD_VIEW_OPTIONS.map(([view])=>view),['front','back','right','left','top','bottom','perspective']);
  for(const [view] of QUAD_VIEW_OPTIONS.filter(([view])=>viewWorkplane(view))) {
    const camera=new OrthographicCamera(-200,200,130,-130,.1,4000),pivot=new Vector3(17,29,43);
    applyViewPreset(camera,view,new Vector3(),600);
    const project=p=>{const q=p.clone().project(camera);return [(q.x+1)*400,(1-q.y)*260];};
    const center=project(pivot),plane=viewWorkplane(view);
    for(const [dx,dy] of [[30,11],[-30,-11],[11,30],[-11,-30]]){
      const basis=planeAxes(plane).map(axis=>{const p=pivot.clone();p.setComponent(axis,p.getComponent(axis)+1);return project(p).map((v,i)=>v-center[i]);});
      const delta=new Vector3().fromArray(quadProjectedPlaneTranslation(plane,basis,dx,dy,true));
      const moved=project(pivot.clone().add(delta)),locked=Math.abs(dx)>Math.abs(dy)?1:0;
      assert.ok(Math.abs(moved[locked]-center[locked])<1e-8,view+' screen lock');
      assert.ok(Math.abs(delta.dot(camera.getWorldDirection(new Vector3())))<1e-8,view+' depth');
    }
  }
});

test('adaptive grids cover each orthographic plane while zooming and panning, with stable world spacing', () => {
  const settings=BUILT_IN_VIEWPORT_PRESETS.nord.appearance.quadView.grid;
  for(const view of Object.keys(VIEW_PRESETS)) {
    const camera=new OrthographicCamera(-200,200,130,-130,.1,4000),target=new Vector3(333,-287,53);
    applyViewPreset(camera,view,target,600);
    const steps=[];
    for(const zoom of [.02,.1,1,10,100]){
      camera.zoom=zoom;camera.updateProjectionMatrix();
      const layout=quadGridLayout(camera,target,800,520,settings),pixels=layout.step*520*zoom/260;
      assert.ok(pixels>=settings.spacing&&pixels<settings.spacing*2);
      assert.ok(layout.segments.length>10&&layout.segments.length<200);
      const endpoints=layout.segments.flatMap(line=>[line.a,line.b]).map(p=>new Vector3().fromArray(p).applyQuaternion(layout.quaternion).add(layout.origin).project(camera));
      for(const axis of ['x','y']){assert.ok(Math.min(...endpoints.map(p=>p[axis]))<=-1);assert.ok(Math.max(...endpoints.map(p=>p[axis]))>=1);}
      steps.push(layout.step);
    }
    assert.ok(steps.every((step,index)=>!index||step<steps[index-1]));
  }
});

test('all appearance bundles and custom exports retain dedicated Quadview settings', () => {
  for(const preset of Object.values(BUILT_IN_VIEWPORT_PRESETS)){
    const quad=preset.appearance.quadView;
    assert.equal(quad.background.color,preset.appearance.background.color);
    assert.notEqual(quad.grid.minorColor,quad.background.color);
    const appearance=normalizeViewportAppearance({...preset.appearance,quadView:{background:{...quad.background,color:'#123456'},grid:{...quad.grid,spacing:37,thickness:2,majorEvery:7}}});
    const restored=importConfiguration(JSON.stringify(exportConfiguration({rendererRevision:3,viewportPreset:'custom',viewportAppearance:appearance,viewportPresets:[{id:'custom-quad',name:'Quad colors',appearance}]})));
    assert.deepEqual(restored.viewportAppearance.quadView,appearance.quadView);
    assert.deepEqual(restored.viewportPresets[0].appearance.quadView,appearance.quadView);
    assert.equal(restored.viewportAppearance.background.color,preset.appearance.background.color);
    const {quadView:removed,...legacy}=preset.appearance;
    assert.deepEqual(normalizeViewportAppearance(legacy).quadView,quad);
  }
});
