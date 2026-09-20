import React from 'react';

export default function PortraitToolbar({ model, active, cameraIndex, disabled, onToggle, onCameraIndex, onSetView, onSnap }) {
  const cameras = model.Cameras || [];
  return <div className="portrait-toolbar" aria-label="Movement view">
    <div className="portrait-view-buttons">
      <button onClick={onToggle}>{active ? 'Full Model View' : 'Portrait Frame View'}</button>
      {active && <button onClick={onSnap}>Snap to Camera</button>}
    </div>
    <select aria-label="Portrait camera" title="Portrait camera" disabled={!cameras.length} value={cameras[cameraIndex] ? cameraIndex : ''} onChange={event => onCameraIndex(Number(event.target.value))}>
      {!cameras.length && <option value="">No camera</option>}
      {cameras.map((camera, index) => <option key={index} value={index}>{camera.Name || `Camera ${index + 1}`}</option>)}
    </select>
    <button disabled={disabled} onClick={onSetView} title="Create or update the selected camera from the current viewport; calculate extents">Set Current View</button>
  </div>;
}
