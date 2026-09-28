import React from 'react';

export default function OptimizeXLFixSelection({ findings, checked, onChange, onInspect, onPreview, previewing }) {
  const fixes = findings.filter(f => !f.inspectionOnly), count = fixes.filter(f => checked.has(f.id)).length;
  return <div className="ox-fix-selection">
    <details><summary>Select fixes ({count}/{fixes.length})</summary>
      <div className="ox-fix-actions"><button onClick={() => onChange(new Set(fixes.map(f => f.id)))}>Select all</button><button onClick={() => onChange(new Set())}>Clear all</button></div>
      <div className="ox-fix-list">{findings.map(f => <div className="ox-fix-row" key={f.id} data-motion-level={f.motionContext?.level}>
        <input type="checkbox" aria-label={`Select ${f.label}`} disabled={f.inspectionOnly} title={f.inspectionOnly?'Inspection only; no supported automatic correction':undefined} checked={!f.inspectionOnly&&checked.has(f.id)} onChange={event => { const next = new Set(checked); if (event.target.checked) next.add(f.id); else next.delete(f.id); onChange(next); }}/>
        <button className="ox-fix-name" title={f.motionContext?`${f.motionContext.level==='red'?'Red':'Orange'}: ${f.motionContext.summary}`:f.label} onClick={() => onInspect(f.id)}>{f.motionContext&&<span className="ox-motion-dot" aria-label={`${f.motionContext.level} inspection flag`}>● </span>}{f.label}{f.inspectionOnly&&<small> · Inspect only</small>}</button>
      </div>)}</div>
    </details>
    <button disabled={!count} onClick={onPreview}>Preview all selected fixes</button>
    {previewing && <p role="status">Previewing {count} selected fixes.</p>}
  </div>;
}
