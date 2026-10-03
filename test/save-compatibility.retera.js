// Run with Retera's own Java/Nashorn classpath; arguments: corpus directory,
// optional manifest filename, optional results filename. No MDLxL decoder is
// used here. Expected JSON describes the live model before serialization.
var File = Java.type('java.io.File');
var Files = Java.type('java.nio.file.Files');
var Paths = Java.type('java.nio.file.Paths');
var EditableModel = Java.type('com.hiveworkshop.wc3.mdl.EditableModel');
var root = arguments[0];
var manifest = JSON.parse(String(new java.lang.String(Files.readAllBytes(Paths.get(root, arguments[1]||'cases.json')), 'UTF-8')));
var results = [];
function readJSON(file) { return JSON.parse(String(new java.lang.String(Files.readAllBytes(Paths.get(file)), 'UTF-8'))); }
function names(list) { var a=[]; for(var i=0;i<list.size();i++)a.push(String(list.get(i).getName()));return a; }
function vector(value) {if(typeof value==='number'||value instanceof java.lang.Number)return [Number(value)];if(value===null)return null;if(value instanceof Java.type('com.hiveworkshop.wc3.mdl.QuaternionRotation'))return [value.a,value.b,value.c,value.d];return value.z===undefined?[value.x,value.y]:[value.x,value.y,value.z];}
function numericValues(value){return Object.keys(value).map(function(k){return Number(value[k]);});}
function sameNumbers(expected,actual){if(actual===null||expected.length!==actual.length)return false;for(var i=0;i<expected.length;i++)if(!isFinite(actual[i])||Math.abs(expected[i]-actual[i])>0.0001)return false;return true;}
function compareStatic(e,n,label,issues,format,notes){
 var type=String(n.getClass().getSimpleName());
 var fields={ParticleEmitter:['EmissionRate','Gravity','Longitude','Latitude','LifeSpan','InitVelocity','Path'],ParticleEmitter2:['Speed','Variation','Latitude','Gravity','LifeSpan','EmissionRate','Width','Length','Rows','Columns','TailLength','Time','PriorityPlane','ReplaceableId','TextureID'],RibbonEmitter:['HeightAbove','HeightBelow','Alpha','LifeSpan','TextureSlot','EmissionRate','Rows','Columns','Gravity'],Light:['AttenuationStart','AttenuationEnd','Intensity','AmbIntensity'],Attachment:['AttachmentID','Path'],ParticleEmitterPopcorn:['LifeSpan','EmissionRate','Speed','Alpha','ReplaceableId','Path','AnimVisibilityGuide']}[type]||[];
 for(var k=0;k<fields.length;k++){var key=fields[k],value=e[key];if(value==null||value.Keys)continue;var actual=n['get'+key]();if(typeof value==='string'?String(actual==null?'':actual)!==value:Math.abs(Number(actual)-value)>0.0001)issues.push('Static '+label+'.'+key);}
 var vectors=type==='ParticleEmitter2'?{Alpha:'getAlpha',ParticleScaling:'getParticleScaling',LifeSpanUVAnim:'getLifeSpanUVAnim',DecayUVAnim:'getDecayUVAnim',TailUVAnim:'getTailUVAnim',TailDecayUVAnim:'getTailDecayUVAnim'}:type==='Light'?{Color:'getStaticColor',AmbColor:'getStaticAmbColor'}:type==='RibbonEmitter'?{Color:'getStaticColor'}:type==='ParticleEmitterPopcorn'?{Color:'getColor'}:{};
 for(var key in vectors)if(e[key]&&!e[key].Keys){var values=numericValues(e[key]);
  // Retera ParticleEmitterPopcorn's MDX constructor reverses RGB but its
  // MDL reader keeps the literal RGB vector. Both source files specify RGB.
  // Report the reader difference; do not silently declare render parity.
  var popcornMdl=type==='ParticleEmitterPopcorn'&&format==='mdl'&&key==='Color';
  if((key==='Color'||key==='AmbColor')&&!popcornMdl)values.reverse();
  if(popcornMdl)notes.push('Retera stores Popcorn MDL color as RGB, but MDX as BGR; rendering/re-export parity is not certified.');
  if(!sameNumbers(values,vector(n[vectors[key]]())))issues.push('Static '+label+'.'+key);
 }
 if(type==='ParticleEmitter2'){
  var colors=n.getSegmentColors();for(var ci=0;ci<3;ci++)if(!sameNumbers(numericValues(e.SegmentColor[ci]).reverse(),vector(colors[ci])))issues.push('Segment color '+label+'/'+ci);
  if(n.isSquirt()!==!!e.Squirt||n.isHead()!==!!(e.FrameFlags&1)||n.isTail()!==!!(e.FrameFlags&2)||n.getFilterModeReallyBadReallySlow().ordinal()!==e.FilterMode)issues.push('Particle flags '+label);
 }
 if(type==='RibbonEmitter'&&n.getMaterialId()!==e.MaterialID)issues.push('Ribbon material '+label);
 if(type==='CollisionShape'){
  var verts=n.getVertices();for(var vi=0;vi<verts.size();vi++)if(!sameNumbers([e.Vertices[vi*3],e.Vertices[vi*3+1],e.Vertices[vi*3+2]],vector(verts.get(vi))))issues.push('Collision vertices '+label);
  if(e.Shape===2&&Math.abs(n.getExtents().getBoundsRadius()-e.BoundsRadius)>0.0001)issues.push('Collision radius '+label);
 }
 var flags=n.getFlags(),nodeFlags={DontInheritTranslation:1,DontInheritRotation:2,DontInheritScaling:4,Billboarded:8,BillboardedLockX:16,BillboardedLockY:32,BillboardedLockZ:64,CameraAnchored:128};
 for(var flag in nodeFlags)if(flags.contains(flag)!==!!(e.Flags&nodeFlags[flag]))issues.push('Node flag '+label+'.'+flag);
}
function compareTracks(e,flags,label,issues,rgbColor){
 for(var key in e)if(e[key]&&e[key].Keys){var track=e[key],found=null;for(var fi=0;fi<flags.size();fi++)if(String(flags.get(fi).getName())===key){found=flags.get(fi);break;}
 if(!found){issues.push('Missing track '+label+'.'+key);continue;}
 if(found.getInterpType()!==track.LineType)issues.push('Track interpolation '+label+'.'+key);
 if(found.getGlobalSeqId()!==(track.GlobalSeqId==null?-1:track.GlobalSeqId))issues.push('Global sequence reference '+label+'.'+key);
 var times=found.getTimes(),values=found.getValues();if(times.size()!==track.Keys.length)issues.push('Track key count '+label+'.'+key);
 for(var ki=0;ki<Math.min(times.size(),track.Keys.length);ki++){var k=track.Keys[ki],expectedValue=numericValues(k.Vector);if(!rgbColor&&(key==='Color'||key==='AmbColor'))expectedValue.reverse();if(Number(times.get(ki))!==k.Frame||!sameNumbers(expectedValue,vector(values.get(ki)))){issues.push('Track values '+label+'.'+key);break;}
 if(track.LineType>=2){var ins=numericValues(k.InTan),outs=numericValues(k.OutTan);if(!rgbColor&&(key==='Color'||key==='AmbColor')){ins.reverse();outs.reverse();}if(!sameNumbers(ins,vector(found.getInTans().get(ki)))||!sameNumbers(outs,vector(found.getOutTans().get(ki)))){issues.push('Track tangents '+label+'.'+key);break;}}}
 }
}
for (var c=0;c<manifest.cases.length;c++) {
  var record=manifest.cases[c];
  for (var f=0;f<record.files.length;f++) {
    var file=record.files[f],result={id:record.id,file:file,issues:[],notes:[]};
    try {
      var expected=readJSON(root+'/evidence/'+record.id+'-expected.json').model;
      var model=EditableModel.read(new File(file));
      if(model===null)throw Error('Retera returned no model');
      var nodes=model.getIdObjects(),byName={};result.nodes=nodes.size();
      var expectedNodes=expected.Nodes.filter(function(n){return n!==null;});
      if(nodes.size()!==expectedNodes.length)result.issues.push('Node count mismatch');
      for(var i=0;i<nodes.size();i++){var n=nodes.get(i);byName[String(n.getName())]=n;}
      for(var i=0;i<expectedNodes.length;i++) {
        var e=expectedNodes[i],n=byName[e.Name];
        if(!n){result.issues.push('Missing node '+e.Name);continue;}
        var expectedParent=e.Parent==null||e.Parent===-1?null:expected.Nodes[e.Parent];
        var actualParent=n.getParent();
        if(expectedParent?actualParent===null||String(actualParent.getName())!==expectedParent.Name:actualParent!==null)result.issues.push('Parent identity '+e.Name);
        var p=n.getPivotPoint(),v=e.PivotPoint;
        if(p===null||Math.abs(p.x-v[0])>0.00001||Math.abs(p.y-v[1])>0.00001||Math.abs(p.z-v[2])>0.00001)result.issues.push('Pivot '+e.Name);
        compareTracks(e,n.getAnimFlags(),e.Name,result.issues,String(n.getClass().getSimpleName())==='ParticleEmitterPopcorn');
        compareStatic(e,n,e.Name,result.issues,file.slice(-3),result.notes);
        if(expected.BindPoses.length&&!sameNumbers(numericValues(expected.BindPoses[0].Matrices[e.ObjectId]),Java.from(n.getBindPose())))result.issues.push('Node bind pose '+e.Name);
        if(e.EventTrack){var eventTimes=n.getEventTrack();if(!sameNumbers(numericValues(e.EventTrack),Java.from(eventTimes)))result.issues.push('Event times '+e.Name);if(n.getGlobalSeqId()!==(e.GlobalSeqId==null?-1:e.GlobalSeqId))result.issues.push('Event global sequence '+e.Name);}
      }
      var geosets=model.getGeosets();result.geosets=geosets.size();result.matrixGroups=0;
      if(geosets.size()!==expected.Geosets.length)result.issues.push('Geoset count mismatch');
      for(var gi=0;gi<Math.min(geosets.size(),expected.Geosets.length);gi++){
        var g=geosets.get(gi),eg=expected.Geosets[gi],matrices=g.getMatrix();
        if(g.getVertices().size()!==Object.keys(eg.Vertices).length/3)result.issues.push('Vertex count '+gi);
        if(g.getTriangles().size()!==Object.keys(eg.Faces).length/3)result.issues.push('Face count '+gi);
        if(g.getMaterialID()!==eg.MaterialID)result.issues.push('Geoset material '+gi);
        var vertices=g.getVertices();for(var vi=0;vi<vertices.size();vi++){var vertex=vertices.get(vi);if(!sameNumbers([eg.Vertices[vi*3],eg.Vertices[vi*3+1],eg.Vertices[vi*3+2]],vector(vertex))){result.issues.push('Vertex coordinates '+gi);break;}}
        for(var fi=0;fi<g.getTriangles().size();fi++)if(!sameNumbers([eg.Faces[fi*3],eg.Faces[fi*3+1],eg.Faces[fi*3+2]],Java.from(g.getTriangles().get(fi).getVertIds()))){result.issues.push('Triangle indices '+gi);break;}
        for(var vi=0;vi<vertices.size();vi++)if(vertices.get(vi).getVertexGroup()!==eg.VertexGroup[vi]){result.issues.push('Vertex group assignment '+gi);break;}
        if(eg.SkinWeights)for(var vi=0;vi<vertices.size();vi++){
          var links=vertices.get(vi).getLinks(),want=[],got=[];
          for(var si=0;si<4;si++)if(eg.SkinWeights[vi*8+4+si])want.push([expected.Nodes[eg.SkinWeights[vi*8+si]].Name,eg.SkinWeights[vi*8+4+si]]);
          for(var si=0;si<links.size();si++)got.push([String(links.get(si).bone.getName()),Number(links.get(si).weight)]);
          if(JSON.stringify(want)!==JSON.stringify(got)){result.issues.push('HD skin identities/weights '+gi+'/'+vi);break;}
        }
        if(eg.Tangents)for(var vi=0;vi<vertices.size();vi++)if(!sameNumbers([eg.Tangents[vi*4],eg.Tangents[vi*4+1],eg.Tangents[vi*4+2],eg.Tangents[vi*4+3]],Java.from(vertices.get(vi).getTangent()))){result.issues.push('HD tangents '+gi);break;}
        for(var vi=0;vi<vertices.size();vi++){var vertex=vertices.get(vi);if(!sameNumbers([eg.Normals[vi*3],eg.Normals[vi*3+1],eg.Normals[vi*3+2]],vector(vertex.getNormal()))){result.issues.push('Normals '+gi);break;}}
        for(var ui=0;ui<eg.TVertices.length;ui++){var mismatch=false;for(var vi=0;vi<vertices.size();vi++){var uv=vertices.get(vi).getTverts();if(uv.size()<=ui||!sameNumbers([eg.TVertices[ui][vi*2],eg.TVertices[ui][vi*2+1]],vector(uv.get(ui)))){mismatch=true;break;}}if(mismatch)result.issues.push('UV coordinates '+gi+'/'+ui);}
        if(matrices.size()!==eg.Groups.length)result.issues.push('Matrix group count '+gi);
        for(var j=0;j<Math.min(matrices.size(),eg.Groups.length);j++){
          var actualNames=names(matrices.get(j).getBones()),expectedNames=eg.Groups[j].map(function(id){return expected.Nodes[id].Name;});
          if(JSON.stringify(actualNames)!==JSON.stringify(expectedNames))result.issues.push('Matrix identities '+gi+'/'+j+': '+JSON.stringify(actualNames)+' != '+JSON.stringify(expectedNames));
          result.matrixGroups++;
        }
      }
      var geoAnims=model.getGeosetAnims();if(geoAnims.size()!==expected.GeosetAnims.length)result.issues.push('Geoset animation count');for(var ai=0;ai<Math.min(geoAnims.size(),expected.GeosetAnims.length);ai++){var anim=geoAnims.get(ai),ea=expected.GeosetAnims[ai];if(anim.getGeosetId()!==ea.GeosetId)result.issues.push('Geoset animation reference '+ai);compareTracks(ea,anim.getAnimFlags(),'GeosetAnims['+ai+']',result.issues);if(typeof ea.Alpha==='number'&&Math.abs(anim.getStaticAlpha()-ea.Alpha)>0.0001)result.issues.push('Geoset static alpha '+ai);if((ea.Flags&2)&&ea.Color&&!ea.Color.Keys&&!sameNumbers(numericValues(ea.Color).reverse(),(anim.getStaticColor()===null?[1,1,1]:vector(anim.getStaticColor()))))result.issues.push('Geoset color '+ai);}
      var textures=model.getTextures();if(textures.size()!==expected.Textures.length)result.issues.push('Texture count');for(var ti=0;ti<Math.min(textures.size(),expected.Textures.length);ti++){var t=textures.get(ti),et=expected.Textures[ti];if(String(t.getPath())!==et.Image||Math.max(0,t.getReplaceableId())!==(et.ReplaceableId||0)||t.getWrapStyle()!==(et.Flags||0))result.issues.push('Texture data '+ti);}
      var materials=model.getMaterials();if(materials.size()!==expected.Materials.length)result.issues.push('Material count');for(var mi=0;mi<Math.min(materials.size(),expected.Materials.length);mi++){var mat=materials.get(mi),em=expected.Materials[mi],layers=mat.getLayers();if(mat.getPriorityPlane()!==(em.PriorityPlane||0))result.issues.push('Material priority '+mi);if(layers.size()!==em.Layers.length)result.issues.push('Material layer count '+mi);for(var li=0;li<Math.min(layers.size(),em.Layers.length);li++){var l=layers.get(li),el=em.Layers[li];compareTracks(el,l.getAnims(),'Materials['+mi+'].Layers['+li+']',result.issues);if(l.getFilterMode().ordinal()!==(el.FilterMode||0))result.issues.push('Material filter '+mi+'/'+li);if(l.getCoordId()!==(el.CoordId||0))result.issues.push('Material UV set '+mi+'/'+li);if(l.getTVertexAnimId()!==(el.TVertexAnimId==null?-1:el.TVertexAnimId))result.issues.push('Material UV animation '+mi+'/'+li);if(typeof el.TextureID==='number'&&l.firstTexture()!==textures.get(el.TextureID))result.issues.push('Material texture '+mi+'/'+li);if(typeof el.Alpha==='number'&&Math.abs((l.getStaticAlpha()<0?1:l.getStaticAlpha())-el.Alpha)>0.0001)result.issues.push('Material alpha '+mi+'/'+li);if(l.isTwoSided()!==!!(el.Shading&16)||l.isUnshaded()!==!!(el.Shading&1))result.issues.push('Material shading '+mi+'/'+li);}}
      var sequences=model.getAnims();if(sequences.size()!==expected.Sequences.length)result.issues.push('Sequence count');for(var si=0;si<Math.min(sequences.size(),expected.Sequences.length);si++){var seq=sequences.get(si),es=expected.Sequences[si];if(String(seq.getName())!==es.Name||seq.getStart()!==es.Interval[0]||seq.getEnd()!==es.Interval[1]||Math.abs(seq.getMoveSpeed()-(es.MoveSpeed||0))>0.0001||seq.isNonLooping()!==!!es.NonLooping)result.issues.push('Sequence data '+si);}
      var globalSequences=model.getGlobalSeqs();if(!sameNumbers(expected.GlobalSequences,Java.from(globalSequences)))result.issues.push('Global sequence durations');
      var cameras=model.getCameras();if(cameras.size()!==expected.Cameras.length)result.issues.push('Camera count');
      for(var ci=0;ci<cameras.size();ci++){
       var cam=cameras.get(ci),ec=expected.Cameras[ci];if(String(cam.getName())!==ec.Name)result.issues.push('Camera name '+ci);
       for(var ck=0;ck<3;ck++){var field=['FieldOfView','NearClip','FarClip'][ck];if(Math.abs(cam['get'+field]()-ec[field])>0.0001)result.issues.push('Camera '+field+' '+ci);}
       if(!sameNumbers(numericValues(ec.Position),vector(cam.getPosition()))||!sameNumbers(numericValues(ec.TargetPosition),vector(cam.getTargetPosition())))result.issues.push('Camera positions '+ci);
       compareTracks({Translation:ec.Translation,Rotation:ec.Rotation},cam.getAnimFlags(),'Camera '+ci,result.issues);compareTracks({Translation:ec.TargetTranslation},cam.getTargetAnimFlags(),'Camera target '+ci,result.issues);
       if(expected.BindPoses.length){var bp=expected.BindPoses[0].Matrices;if(!sameNumbers(numericValues(bp[bp.length-expected.Cameras.length+ci]),Java.from(cam.getBindPose())))result.issues.push('Camera bind pose '+ci);}
      }
      var textureAnims=model.getTexAnims();if(textureAnims.size()!==expected.TextureAnims.length)result.issues.push('Texture animation count');for(var tai=0;tai<Math.min(textureAnims.size(),expected.TextureAnims.length);tai++)compareTracks(expected.TextureAnims[tai],textureAnims.get(tai).getAnimFlags(),'TextureAnims['+tai+']',result.issues);
      result.version=model.getFormatVersion();result.status=result.issues.length?'FAIL':'PASS';
    } catch(e) {result.status='ERROR';result.issues.push(String(e));}
    results.push(result); print(JSON.stringify(result));
  }
}
Files.write(Paths.get(root,'evidence',arguments[2]||'retera-results.json'),new java.lang.String(JSON.stringify(results,null,2)).getBytes('UTF-8'));
if(results.some(function(result){return result.status!=='PASS';}))java.lang.System.exit(1);
