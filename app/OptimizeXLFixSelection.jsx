import React from 'react';

export default function OptimizeXLFixSelection({ findings, checked, onChange, onInspect, onPreview, previewing }) {
  const count = findings.filter(f => checked.has(f.id)).length;
  return <div className="ox-fix-selection">
    <details><summary>Select fixes ({count}/{findings.length})</summary>
      <div className="ox-fix-actions"><button onClick={() => onChange(new Set(findings.map(f => f.id)))}>Select all</button><button onClick={() => onChange(new Set())}>Clear all</button></div>
      <div className="ox-fix-list">{findings.map(f => <div className="ox-fix-row" key={f.id}>
        <input type="checkbox" aria-label={`Select ${f.label}`} checked={checked.has(f.id)} onChange={event => { const next = new Set(checked); if (event.target.checked) next.add(f.id); else next.delete(f.id); onChange(next); }}/>
        <button className="ox-fix-name" title={f.label} onClick={() => onInspect(f.id)}>{f.label}</button>
      </div>)}</div>
    </details>
    <button disabled={!count} onClick={onPreview}>Preview all selected fixes</button>
    {previewing && <p role="status">Previewing {count} selected fixes.</p>}
  </div>;
}
