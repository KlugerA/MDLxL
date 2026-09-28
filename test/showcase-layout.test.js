import test from 'node:test';
import assert from 'node:assert/strict';
import {containRect,recordingDimensions,cropPresetRect,SHOWCASE_CROP_PRESETS} from '../app/showcase-crop.js';
import {remapShowcasePlaylist,remapShowcaseTake} from '../app/showcase-model.js';
import {showcaseExportPreferences,validateShowcaseExport} from '../app/showcase-export.js';
test('all showcase ratios use a uniform scale across viewport and output sizes',()=>{
 for(const [w,h] of [[1670,902],[834,612],[300,900]])for(const [preset,aspect] of Object.entries(SHOWCASE_CROP_PRESETS)){
  const crop=cropPresetRect(w,h,aspect),output=recordingDimensions(w*2,h*2,crop,preset==='hiveMain'?612:1920,aspect);
  assert.ok(Math.abs(output.width/output.height-aspect)<.004);
  const fit=containRect(crop.width*w,crop.height*h,output.width,output.height);
  assert.ok(Math.abs(fit.width/(crop.width*w)-fit.height/(crop.height*h))<1e-10);
  assert.ok(fit.width<=output.width+1e-8&&fit.height<=output.height+1e-8);
 }
 assert.deepEqual(recordingDimensions(1670,902,cropPresetRect(1670,902,612/490),612,612/490),{width:612,height:490});
});
test('unselected profiles retain original quality, FPS and duration',()=>{
 const preferences={capture:{fps:50,recordingQuality:'high'}};
 assert.deepEqual(showcaseExportPreferences(preferences,null),preferences);
 assert.doesNotThrow(()=>validateShowcaseExport(null,30,[{seconds:30}]));
 assert.throws(()=>validateShowcaseExport('hive-main',6),/5 seconds/);
});
test('model replacement remaps by name, removes missing entries and retains every other setting',()=>{
 const a={Sequences:[{Name:'Stand'},{Name:'Walk'},{Name:'Portrait Talk'}]},b={Sequences:[{Name:'Portrait Talk'},{Name:'Stand'}]};
 const rows=[{sequence:0,seconds:4,speed:.75},{sequence:1,seconds:2,speed:1}];
 assert.deepEqual(remapShowcasePlaylist(rows,a,b),[{sequence:1,seconds:4,speed:.75}]);
 const take={id:'one',setup:{sequencePlaylist:rows,portraitPlaylist:[{sequence:2,seconds:3}],mode:'sequences',sequenceLength:4,cropPreset:'classic',color:'#123456',layers:[{text:'Megazord'}],view:{zoom:2}}};
 const mapped=remapShowcaseTake(take,a,b);assert.equal(mapped.id,'one');assert.equal(mapped.setup.portraitPlaylist[0].sequence,0);assert.equal(mapped.setup.color,'#123456');assert.deepEqual(mapped.setup.layers,take.setup.layers);assert.deepEqual(mapped.setup.view,take.setup.view);assert.equal(take.setup.sequencePlaylist.length,2);
});
