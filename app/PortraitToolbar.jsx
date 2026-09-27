import React from 'react';

export default function PortraitToolbar({ model, active, cameraIndex, disabled, controlModel, controlGroups = [], controlModelGroup = 'all', onToggle, onCameraIndex, onSetView, onSnap, onControlModel, onControlModelGroup }) {
  const cameras = model.Cameras || [];
  return <div className="portrait-toolbar" aria-label="Movement view">
    <div className="portrait-view-buttons">
      <button onClick={onToggle}>{active ? 'Full Model View' : 'Portrait Frame View'}</button>
      {active && <button onClick={onSnap}>Snap to Camera</button>}
      {active && <button disabled={disabled} aria-pressed={controlModel} onClick={onControlModel}>Control Model</button>}
      {active && controlGroups.length > 1 && <select aria-label="Control Model group" value={controlModelGroup} disabled={disabled} onChange={event => onControlModelGroup(event.target.value)}>
        <option value="all">All</option>
        {controlGroups.map((group, index) => <option key={group.ids.join(',')} value={index}>Group {index + 1}</option>)}
      </select>}
    </div>
    <select aria-label="Portrait camera" title="Portrait camera" disabled={!cameras.length} value={cameras[cameraIndex] ? cameraIndex : ''} onChange={event => onCameraIndex(Number(event.target.value))}>
      {!cameras.length && <option value="">No camera</option>}
      {cameras.map((camera, index) => <option key={index} value={index}>{camera.Name || `Camera ${index + 1}`}</option>)}
    </select>
    <button disabled={disabled} onClick={onSetView} title="Create or update the selected camera from the current viewport; calculate extents">Set Current View</button>
  </div>;
}
