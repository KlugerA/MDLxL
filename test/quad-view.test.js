import test from 'node:test';
import assert from 'node:assert/strict';
import { OrthographicCamera, Vector3 } from 'three';
import { QUAD_VIEWS, viewWorkplane, viewportRects } from '../app/quad-view.js';
import { applyViewPreset, projectedPlaneTranslation } from '../app/viewport-math.js';
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
  for (const {view} of QUAD_VIEWS.slice(0, 3)) {
    const camera = new OrthographicCamera(-200,200,130,-130,.1,2000), pivot = new Vector3(17,29,43);
    applyViewPreset(camera,view,new Vector3(),600);
    const plane = viewWorkplane(view), axes = planeAxes(plane), depth = [0,1,2].find(axis => !axes.includes(axis));
    const project = point => {const p=point.clone().project(camera);return [(p.x+1)*400,(1-p.y)*260];};
    const center=project(pivot), basis=axes.map(axis=>{const p=pivot.clone();p.setComponent(axis,p.getComponent(axis)+1);return project(p).map((v,i)=>v-center[i]);});
    for (const shift of [false,true]) {
      const delta=projectedPlaneTranslation(plane,basis,31,-19,shift);
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
