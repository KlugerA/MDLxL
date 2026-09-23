// Run with the installed RMS Java runtime and its Nashorn shell; see the report.
var File = Java.type('java.io.File');
var EditableModel = Java.type('com.hiveworkshop.wc3.mdl.EditableModel');
var model = EditableModel.read(new File('out/geoset-save/ui-saved.mdx'));
if (model.getGeosets().size() !== 48 || model.getGeosetAnims().size() !== 48) throw new Error('Unexpected RMS record counts');
var count = 0;
for each (var ga in model.getGeosetAnims()) {
  var visibility = ga.getVisibilityFlag(), times = visibility.getTimes(), values = visibility.getValues();
  var found = false;
  for (var i = 0; i < times.size(); i++) if (times.get(i) == 176667 && values.get(i) == 0) found = true;
  if (!found) throw new Error('Missing hidden key for geoset ' + ga.getGeosetId());
  count++;
}
print('RMS independently verified alpha=0 at Decay Bone start for ' + count + ' geosets.');
