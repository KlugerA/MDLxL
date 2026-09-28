import React from 'react';

const changes=row=>[['vertices','vertices merged'],['groups','matrix groups merged'],['bones','equivalent bones merged'],['keys','keys removed']].filter(([key])=>row[key]).map(([key,label])=>`${row[key]} ${label}`).join(' · ');

export default function OptimizeXLReview({review,model,onInspect,onHover,onClose}) {
  const count=review.geosets.length+review.other.length;
  if(!count)return <p className="ox-review-empty">No changed geosets or animations to review at these settings.</p>;
  const animations=row=>row.animations.length?<div className="ox-review-animations">{row.animations.map(a=><button key={a.sequence} onClick={()=>onInspect(a)} title={a.keys?`${a.keys} keys removed between ${a.from} and ${a.to}${a.visible?'':' · Geoset hidden during these frames'}`:`Inspect ${model.Sequences[a.sequence].Name}`}>
    {model.Sequences[a.sequence].Name}{a.keys?` · ${a.keys} ${a.keys===1?'key':'keys'}`:''}{!a.visible?' (hidden)':''}
  </button>)}</div>:<small>{model.Sequences.length?'No visible animation sample found.':'Static model — inspect the current view.'}</small>;
  return <details className="ox-review" onToggle={event=>{if(!event.currentTarget.open){onHover(null);onClose();}}}>
    <summary>Review changes · {review.geosets.length} geosets{review.other.length?` · ${review.other.length} other tracks`:''}</summary>
    <div className="ox-review-list">
      {review.geosets.map(row=><div className="ox-review-row" key={row.index} onMouseEnter={()=>onHover(row.index)} onMouseLeave={()=>onHover(null)} onFocus={()=>onHover(row.index)} onBlur={()=>onHover(null)}>
        <strong>Geoset {row.index+1}</strong><small>{changes(row)}</small>{animations(row)}
      </div>)}
      {review.other.map((row,i)=><div className="ox-review-row" key={`other:${i}`}><strong>{row.label}</strong><small>{changes(row)}</small>{animations(row)}</div>)}
    </div>
  </details>;
}
