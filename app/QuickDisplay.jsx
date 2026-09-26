import React from 'react';
import VIEW_MENU from '../src/view-menu.json';
import './portrait-view.css';

export default function QuickDisplay({ viewMode, checks, onCommand, isEnabled, onClear }) {
  return <div className="quick-display" role="group" aria-label="Quick display">
    <div className="quick-display-options">
      <button title="Remove all display options; no model data is removed" onClick={onClear}>Clear</button>
      {VIEW_MENU[viewMode].filter(([, action]) => action !== 'clearDisplay').map(([label, action]) =>
        <label key={action}><input type="checkbox" data-warmkey={action} checked={!!checks[action]} disabled={!isEnabled(action)} onChange={() => onCommand(action)}/>{label}</label>)}
    </div>
  </div>;
}
