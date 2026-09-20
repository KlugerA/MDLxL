import React from 'react';
import './portrait-view.css';

export default function QuickDisplay({ overlays, shadows, particles, cleanAnimationPreview, onOverlay, onShadows, onParticles, onClear }) {
  return <div className="quick-display" role="group" aria-label="Quick display">
    <label><input type="checkbox" data-warmkey="shaded" checked={cleanAnimationPreview || shadows} disabled={cleanAnimationPreview} onChange={event => onShadows(event.target.checked)}/>Shadows</label>
    {[['vertices', 'Vertices', 'showVertices'], ['wires', 'Wireframe', 'display:wires'], ['nodes', 'Nodes', 'display:nodes'], ['particles', 'Emitters', 'display:particles']].map(([key, label, action]) =>
      <label key={key}><input type="checkbox" data-warmkey={action} checked={!!overlays[key]} disabled={cleanAnimationPreview} onChange={event => onOverlay(key, event.target.checked)}/>{label}</label>)}
    <label><input type="checkbox" data-warmkey="showParticles" checked={particles} onChange={event => onParticles(event.target.checked)}/>Particles</label>
    <label><input type="checkbox" data-warmkey="display:bones" checked={!!overlays.bones} disabled={cleanAnimationPreview} onChange={event => onOverlay('bones', event.target.checked)}/>Bones</label>
    <button title="Turn off quick-display options; no model data is removed" onClick={onClear}>Clear all</button>
  </div>;
}
