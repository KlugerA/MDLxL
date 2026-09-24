import React, { useState } from 'react';
import VIEW_MENU from '../src/view-menu.json';
import './portrait-view.css';

export default function QuickDisplay({ checks, shadows, cleanAnimationPreview, onCommand, isEnabled, onShadows, onClear }) {
  const [expanded, setExpanded] = useState(false);
  return <div className="quick-display" data-expanded={expanded} role="group" aria-label="Quick display">
    {expanded && <>
      <label><input type="checkbox" data-warmkey="shaded" checked={cleanAnimationPreview || shadows} disabled={cleanAnimationPreview} onChange={event => onShadows(event.target.checked)}/>Shadows</label>
      {VIEW_MENU.filter(Boolean).map(([label, action]) => ['frame', 'frameSelection'].includes(action)
        ? <button key={action} data-warmkey={action} aria-pressed={!!checks[action]} disabled={!isEnabled(action)} onClick={() => onCommand(action)}>{label}</button>
        : <label key={action}><input type="checkbox" data-warmkey={action} checked={!!checks[action]} disabled={!isEnabled(action)} onChange={() => onCommand(action)}/>{label}</label>)}
    </>}
    <button title="Turn off quick-display options; no model data is removed" onClick={onClear}>Clear all</button>
    <button aria-expanded={expanded} aria-label="View controls" onClick={() => setExpanded(value => !value)}>View</button>
  </div>;
}
