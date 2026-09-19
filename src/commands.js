import { coreWarmKeyDefaults } from './warmkey-defaults.js';

// Stable command IDs shared by the renderer, Settings and the native menu.
const group = (category, rows) => rows.map(([id, label, ...defaultKeys]) => ({ id, label, category, defaultKeys, scope: 'editor' }));
export const COMMANDS = coreWarmKeyDefaults([
  ...group('Shape', ['Bend','Warp','Dome','Wrap','Taper'].map(name=>['shape:'+name.toLowerCase(),name])),
  ...group('Modules', [['forge','Forge'],['pressedKeys','Show pressed keys'],['captureSettings','Recording and screenshots']]),
  ...group('File', [['new','New model','Ctrl+N'],['open','Open model','Ctrl+O'],['save','Save model','Ctrl+S'],['saveAs','Save model as','Ctrl+Shift+S'],['recovery','Recovery'],['gameData','Game data folder'],['importTextures','Load texture files'],['textureFolder','Resolve textures from folder']]),
  ...group('Edit', [['undo','Undo','Ctrl+Z'],['redo','Redo','Ctrl+Y','Ctrl+Shift+Z'],['copy','Copy geometry','Ctrl+C'],['paste','Paste geometry','Ctrl+V'],['pasteSpecial','Special paste','Ctrl+Shift+V'],['selectAll','Select all vertices','Ctrl+A'],['clear','Clear vertex selection','Escape'],['invertSelection','Invert vertex selection'],['hide','Hide selected vertices'],['show','Show hidden vertices'],['history','Undo cache settings']]),
  ...group('Tools', [['select','Selection tool','A'],['translate','Move vertices','M','Q'],['rotate','Rotate vertices','R'],['scale','Resize vertices','Z'],['normalRotate','Rotate normals dialog'],['Delete vertices','Delete vertices','Delete'],['Create triangle','Create triangle','T'],['Delete triangles','Delete selected triangles'],['Uncouple','Uncouple vertices','U'],['Collapse','Collapse selected vertices','C'],['Weld','Weld selected vertices','B'],['Mirror','Mirror in workplane'],['Extrude','Extrude selected faces'],['Detach','Detach selected faces'],['Reverse normals','Reverse selected normals'],['Smooth normals','Average selected normals'],['Restore normals','Recalculate geoset normals']]),
  ...group('View', [['vertices','Vertex editor','F1'],['uv','UV editor','F2'],['animation','Movement editor','F3'],['cameraToggle','Toggle work / camera rotation','W'],['camera:work','Work mode'],['camera:zoom','Zoom tool'],['camera:rotate','Camera rotation'],['camera:move','Move camera'],['frame','Textured View','F','`'],['frameSelection','Surface','S'],['fit','Fit model'],['fitSelection','Fit selection'],['grid','Toggle grid visibility'],['shaded','Toggle lighting'],['showVertices','Toggle vertex overlay'],...['perspective','front','back','left','right','top','bottom'].map(v=>[v,`${v[0].toUpperCase()+v.slice(1)} view`]),...['xy','xz','yz'].map(v=>[`plane:${v}`,`${v.toUpperCase()} workplane`])]),
  ...group('Geosets', [['geosetsAll','Check all geosets'],['geosetsClear','Uncheck all geosets'],['geosetsInvert','Invert checked geosets'],['showAllGeosets','Toggle showing unchecked geosets'],['nextGeoset','Next geoset'],['previousGeoset','Previous geoset']]),
  ...group('UV', [['uv:flip-u','Flip UV horizontally','X'],['uv:flip-v','Flip UV vertically','Y'],['uv:rotate','Rotate UV 90 degrees'],['uv:fold','Fold selected UV vertices','G'],['uv:select-connected','Select connected UV vertices'],['uv:select-invert','Invert UV selection'],['nextUV','Next UV coordinate set']]),
  ...group('Animation', [['play','Play / stop animation','Space'],['nextSequence','Next sequence'],['previousSequence','Previous sequence'],['firstFrame','Go to sequence start'],['lastFrame','Go to sequence end'],['nextFrame','Advance one frame'],['previousFrame','Go back one frame']]),
  ...group('Resources', ['Materials','Textures','Nodes','Geosets','Sequences','TextureAnims','GlobalSequences'].map(id=>[id,({TextureAnims:'Texture Animation',GlobalSequences:'Global Sequence'})[id] || id.replace(/s$/,'')+' Manager'])),
  ...group('Settings', [['settings','Mouse and general settings','Ctrl+,'],['warmkeys','Keyboard Shortcuts','Ctrl+K'],['graphics','Graphical settings'],['appearanceSettings','Appearance settings'],['configurationSettings','Configuration settings'],['gridSettings','Grid settings'],['gameDataSettings','Warcraft III settings'],['sensitivityUp','Increase scroll sensitivity'],['sensitivityDown','Decrease scroll sensitivity']]),
  ...group('File', [['exit','Exit MDLxL']]),
  ...group('Help', [['help','Help'],['diagnostics','Model diagnostics'],['about','About MDLxL']]),
  ...group('Mouse', [['wheel:rotate','Normal wheel zoom / middle-button camera rotation'],['wheel:scroll','Peon: wheel adjusts scroll sensitivity','Ctrl+Alt+P'],['wheel:pointer','Wisp: left click + wheel activates and adjusts mouse DPI','Ctrl+Alt+I'],['pointerUp','Increase mouse DPI'],['pointerDown','Decrease mouse DPI']]),
  ...group('File', [['game-data-rescan','Search for Warcraft III game archives again']]),
  ...group('Modules', [['animations','Animations: visibility and RGB'],['textureLibrary','Material and Texture Library']]),
  ...group('Frames', [['keyframe:copy','Copy keyframes'],['keyframe:copyPose','Copy Frame'],['keyframe:paste','Paste keyframes'],['keyframe:delete','Delete keyframes'],['keyframe:clear','Clear keyframes','Ctrl+D']]),
  // Append new actions so established generated core shortcut codes stay stable.
  ...group('Modules', [['bitsAndParts','BitsAndParts'],['particles','Particle Editor'],['convertVersion','Convert MDX800 / MDX1000']]),
  ...group('View', [['normals','Show normals','N'],['orthographic','Orthographic view']]),
  ...group('Resources', [['GeosetAnims','Geoset Animation Manager']]),
  ...group('View', [['bones','Bones rest-pose workspace'],['grid:small','Small grid'],['grid:xz','XZ-grid'],['grid:yz','YZ-grid'],['grid:xy','XY-grid'],['axes','Axis guides'],['wireframe','Wireframe'],['workplaneEnabled','Constrain to workplane']]),
  ...group('Modules', [['optimizeModel','Optimize Model']]),
  ...group('Tools', [['anchorSelect','Choose Zoom anchor','1']]),
  ...group('Modules', [['paint','Citadel Paint']]),
  ...group('Citadel Paint', [['paint:select','Select geoset or light'],['paint:draw','Paint / draw']]),
]).map(action=>action.id.startsWith('paint:')?{...action,scope:'paint'}:action);
