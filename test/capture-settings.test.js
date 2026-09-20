import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizePreferences} from '../src/preferences.js';
import {captureDimensions,CAPTURE_QUALITIES} from '../src/capture-settings.js';
import {createPreviewGIF} from '../src/preview-gif.js';
test('capture defaults are medium at 30 FPS and survive preference roundtrip',()=>{
  const prefs=normalizePreferences();assert.deepEqual(prefs.capture,{fps:30,recordingQuality:'medium',screenshotQuality:'medium'});
  const saved=normalizePreferences(JSON.parse(JSON.stringify({...prefs,language:'ru',showPressedKeys:true,capture:{fps:25,recordingQuality:'high',screenshotQuality:'low'}})));
  assert.equal(saved.language,'ru');assert.equal(saved.showPressedKeys,true);assert.deepEqual(saved.capture,{fps:25,recordingQuality:'high',screenshotQuality:'low'});
  assert.deepEqual(normalizePreferences({capture:{fps:999,recordingQuality:'bad'}}).capture,prefs.capture);
});
test('capture resolution presets preserve aspect ratio and meaningful quality differences',()=>{
  assert.deepEqual(captureDimensions(800,600,1920),{width:1920,height:1440});
  assert.deepEqual(captureDimensions(400,800,1280),{width:640,height:1280});
  assert.ok(CAPTURE_QUALITIES.high.screenshotSize>CAPTURE_QUALITIES.medium.screenshotSize);
  assert.throws(()=>captureDimensions(0,2,3));
});
test('30 FPS GIF timestamps retain one second with GIF centisecond rounding',()=>{
 const recorder=createPreviewGIF({dither:true});const frame=new Uint8Array(4*8*8);for(let i=0;i<frame.length;i+=4){frame[i]=i%256;frame[i+1]=80;frame[i+2]=140;frame[i+3]=255;}
 for(let i=0;i<30;i++)recorder.add(frame,8,8,i*1000/30);
 const result=recorder.finish(1000);assert.equal(result.duration,1000);assert.equal(result.frames,30);assert.equal(result.bytes.at(-1),0x3b);
});
