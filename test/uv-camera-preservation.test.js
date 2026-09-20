import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PerspectiveCamera, OrthographicCamera, Vector3 } from 'three';
import { restorePreviewCamera } from '../app/game-preview-data.js';

test('UV renderer rebuild preserves perspective and orthographic orbit, pan, zoom and projection',()=>{
  for(const type of ['perspective','ortho']) {
    const perspective=new PerspectiveCamera(39,1.4,.4,9000),ortho=new OrthographicCamera(-80,80,60,-60,.2,4000);
    for(const camera of [perspective,ortho]){
      camera.position.set(250,-120,87);camera.up.set(0,0,1);camera.lookAt(19,27,31);camera.zoom=2.75;camera.updateProjectionMatrix();camera.updateMatrixWorld();
    }
    const saved={camera:type,view:'isometric-ne',perspective:perspective.clone(),ortho:ortho.clone(),target:new Vector3(19,27,31)};
    const freshPerspective=new PerspectiveCamera(),freshOrtho=new OrthographicCamera(),controls={target:new Vector3(),object:null,update(){}};
    for(let i=0;i<3;i++){
      const restored=restorePreviewCamera(saved,freshPerspective,freshOrtho,controls);
      assert.equal(restored,type==='ortho'?freshOrtho:freshPerspective);
      assert.equal(controls.object,restored);assert.deepEqual(controls.target,saved.target);
      for(const [actual,expected]of [[freshPerspective,saved.perspective],[freshOrtho,saved.ortho]]){
        assert.deepEqual(actual.position,expected.position);assert.deepEqual(actual.quaternion.toArray(),expected.quaternion.toArray());
        assert.deepEqual(actual.up,expected.up);assert.equal(actual.zoom,expected.zoom);
        assert.deepEqual(actual.projectionMatrix,expected.projectionMatrix);
      }
    }
  }
});

test('UV opts into restoring its user view before fit, without replaying old projection presets',()=>{
  const uv=readFileSync(new URL('../app/UVWorkspace.jsx',import.meta.url),'utf8');
  const preview=readFileSync(new URL('../app/GamePreview.jsx',import.meta.url),'utf8');
  assert.match(uv,/<GamePreview[^>]*preserveCameraView=\{true\}/);
  assert.match(preview,/if \(saved && latest.current.preserveCameraView\) \{\s*camera = restorePreviewCamera/);
  assert.match(preview,/camera:camera === ortho \? 'ortho' : 'perspective'/);
  assert.match(preview,/\[props.cameraPresetRequest\?\.revision\]/);
});

test('team label stays absent and geosets fill down columns',()=>{
  const app=readFileSync(new URL('../app/App.jsx',import.meta.url),'utf8');
  const css=readFileSync(new URL('../app/styles.css',import.meta.url),'utf8');
  assert.doesNotMatch(app,/className="team-picker">Team color/);
  assert.match(app,/'--geoset-rows': Math.max\(1, Math.ceil\(model.Geosets.length \/ 4\)\)/);
  assert.match(css,/classic-geoset-list\{display:grid;grid-auto-flow:column/);
});
