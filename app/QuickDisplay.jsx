import React, { useState } from 'react';
import VIEW_MENU from '../src/view-menu.json';
import './portrait-view.css';

const HIDDEN_QUICK_ACTIONS = new Set(['cleanView', 'grid:small', 'grid:xz', 'grid:yz', 'grid:xy', 'axes', 'frame']);

export default function QuickDisplay({ checks, shadows, cleanAnimationPreview, onCommand, isEnabled, onShadows, onClear }) {
  const [expanded, setExpanded] = useState(false);
  return <div className="quick-display" data-expanded={expanded} role="group" aria-label="Quick display">
    {expanded && <div className="quick-display-options">
      <label><input type="checkbox" data-warmkey="shaded" checked={cleanAnimationPreview || shadows} disabled={cleanAnimationPreview} onChange={event => onShadows(event.target.checked)}/>Shadows</label>
      {VIEW_MENU.filter(Boolean).filter(([, action]) => !HIDDEN_QUICK_ACTIONS.has(action)).map(([label, action]) => action === 'frameSelection'
        ? <button key={action} data-warmkey={action} aria-pressed={!!checks[action]} disabled={!isEnabled(action)} onClick={() => onCommand(action)}>{label}</button>
        : <label key={action}><input type="checkbox" data-warmkey={action} checked={!!checks[action]} disabled={!isEnabled(action)} onChange={() => onCommand(action)}/>{label}</label>)}
    </div>}
    <div className="quick-display-actions">
      <button data-warmkey="frame" aria-pressed={!!checks.frame} disabled={!isEnabled('frame')} onClick={() => onCommand('frame')}>Textured View</button>
      <button title="Remove all display options; no model data is removed" onClick={onClear}>Clear</button>
      <button aria-expanded={expanded} aria-label="Reveal controls" onClick={() => setExpanded(value => !value)}>Reveal</button>
    </div>
  </div>;
}
