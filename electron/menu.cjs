const VIEW_MENU = require('../src/view-menu.json');
const VIEW_MENU_IDS = [...new Set(Object.values(VIEW_MENU).flat().map(row => row[1]))];

function normalizeMenuChecks(checks) {
  return Object.fromEntries(VIEW_MENU_IDS.map(id => [id, checks?.[id] === true]));
}
function nativeAccelerator(chord) {
  if (typeof chord !== 'string' || chord.includes(' > ')) return null;
  const parts = chord.split('+'), key = parts.pop().replace(/^Arrow(?=Left$|Right$|Up$|Down$)/, '');
  if (!/^[\x21-\x7e]$|^F(?:[1-9]|1\d|2[0-4])$/.test(key) && !['Plus', 'Space', 'Tab', 'CapsLock', 'NumLock', 'ScrollLock', 'Backspace', 'Delete', 'Insert', 'Enter', 'Up', 'Down', 'Left', 'Right', 'Home', 'End', 'PageUp', 'PageDown', 'Escape', 'PrintScreen'].includes(key)) return null;
  return [...parts, key].join('+');
}

function buildMenuTemplate(bindings, dispatch, platform = process.platform, recentFiles = [], translate = value => value, editorState = {}) {
  const item = (label, id) => {
    const keys = (bindings[id] || []).filter(key => /^[A-Za-z0-9]$|^F(?:[1-9]|1\d|2[0-4])$/.test(key) || ['Delete','Escape','Insert','Tab'].includes(key));
    const requiresEditable = id === 'particles' || id === 'GeosetAnims';
    const enabled = id === 'uv' ? !!editorState.uvEnabled : !requiresEditable || (!editorState.readOnly && !editorState.saving);
    const result = { label, click: () => { if (enabled) dispatch(id); }, ...((requiresEditable || id==='uv') ? { enabled } : {}) };
    // The renderer owns shortcuts so input fields, dialogs, and remapped keys use
    // the same rules as the browser build. Native accelerators only display them.
    const accelerator = keys.length ? nativeAccelerator(keys[0]) : null;
    if (accelerator && platform !== 'darwin') {
      result.accelerator = accelerator;
      result.registerAccelerator = false;
    } else if (keys.length) result.label += '\t' + keys[0];
    return result;
  };
  const separator = () => ({ type: 'separator' });
  const template = [
    { label: '&File', submenu: [item('&Open…', 'open'), { label:'Recent Files', submenu: recentFiles.length ? [...recentFiles.map(file=>({label:file.replaceAll('&','&&'),click:()=>dispatch({action:'openRecent',path:file}),keepLabel:true})),separator(),item('Clear Recent Files','clearRecent')] : [{label:'No recent files',enabled:false}] }, item('&Save', 'save'), item('Save as…', 'saveAs'), separator(), item('New model', 'new'), item('Recovery…', 'recovery'), separator(), item('Exit', 'exit')] },
    { label: '&Edit', submenu: [item('Undo', 'undo'), item('Redo', 'redo'), separator(), item('Select all', 'selectAll'), item('Clear selection', 'clear'), item('Copy', 'copy'), item('Paste', 'paste'), item('Paste special…', 'pasteSpecial'), separator(), item('Undo cache…', 'history'), separator(), {label:'Keyframes',submenu:[['Copy','copy'],['Copy Frame','copyPose'],['Paste','paste'],['Delete','delete'],['Clear','clear']].map(([label,id])=>item(label,'keyframe:'+id))}] },
    { label: 'Shape', submenu: ['Bend','Warp','Dome','Wrap','Taper'].map(name=>item(name,'shape:'+name.toLowerCase())) },
    { label: 'View', submenu: (VIEW_MENU[editorState.viewMode] || []).map(row=>row[1]==='clearDisplay'?item(...row):{...item(...row),type:'checkbox',checked:!!editorState.checks?.[row[1]]}) },
    { label: 'Modules', submenu: [item('Vertex editor', 'vertices'), item('Bones', 'bones'), item('UV-maps', 'uv'), item('Movement', 'animation'), item('Animations: visibility and RGB', 'animations'), item('Particle Editor…', 'particles'), item('Material and Texture Library', 'textureLibrary')] },
    { label: 'Windows', submenu: [['Material Manager…', 'Materials'], ['Texture Manager…', 'Textures'], ['Node Manager…', 'Nodes'], ['Geoset Manager…', 'Geosets'], ['Geoset Animation Manager…', 'GeosetAnims'], ['Sequence Manager…', 'Sequences'], ['Texture Animation Manager…', 'TextureAnims'], ['Global Sequence Manager…', 'GlobalSequences']].map(([label, id]) => item(label, id)) },
    { label: 'Settings', submenu: [item('Mouse and general…', 'settings'), item('Keyboard Shortcuts…', 'warmkeys'), item('Graphical settings…', 'graphics'), item('Recording and screenshots…','captureSettings'), item('Appearance…','appearanceSettings'), item('Configuration…','configurationSettings'), item('Grid…','gridSettings'), item('Warcraft III…','gameDataSettings'), separator(), item('Undo cache…', 'history'), item('Show pressed keys','pressedKeys'), item('Choose Warcraft III folder…', 'gameData'), item('Rescan game data', 'game-data-rescan')] },
    { label: 'Help', submenu: [item('Hotkeys', 'help'), item('Check model', 'diagnostics'), item('About', 'about')] },
  ];
  function localized(items){return items.map(({keepLabel,...entry})=>({...entry,...(entry.label?{label:keepLabel?entry.label:translate(entry.label)}:{}),...(entry.submenu?{submenu:localized(entry.submenu)}:{})}));}
  return localized(template);
}

module.exports = { buildMenuTemplate, nativeAccelerator, normalizeMenuChecks };
