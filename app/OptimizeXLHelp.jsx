import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const explanations={
 'Position tolerance':'How close two vertices may be before they can merge, in model units. Higher values can change the shape. Zero requires identical positions.',
 'UV tolerance':'How close texture coordinates may be before vertices can merge. Higher values can shift texture details. Zero preserves exact texture coordinates.',
 'Normal angle (degrees)':'The largest difference between surface directions that may merge. Higher angles can soften sharp edges. Zero requires identical normals.',
 'Merge equivalent leaf bones':'Merge bones with identical transforms, pivots and parents when they have no children. Vertices keep the same movement.',
 'Translation tolerance':'Maximum sampled difference in a movement track, in model units. Higher values remove more keys. Zero removes only proven redundant keys.',
 'Rotation tolerance (degrees)':'Maximum sampled difference in a rotation track, in degrees. Supports curved animation tracks. Higher values remove more keys; review the changed animations.',
 'Scale tolerance':'Maximum sampled difference in a scale track. A value of 0.01 is about one percent on one axis. Higher values allow more key removal.',
 'Unreferenced vertices':'Delete vertices that no triangle uses, along with bone groups that no remaining vertex uses. Excluded geosets are preserved.',
 'Unused materials, textures and globals':'Remove resources that no retained model data uses, and merge identical texture records. Referenced animation and effect resources remain.',
 'Unused bones and helpers':'Remove rig nodes that influence no geometry, retained child, attachment or effect. Shared ancestors are kept.',
 'Target polygons':'The triangle count to aim for. Lower values remove more detail. Protection settings may prevent reaching this number.',
 'Shape/texture error (%)':'How much shape and texture deviation the polygon reducer may accept. Higher values allow more reduction; inspect the silhouette and texture details.',
 'Sharp-edge angle':'With Protect sharp edges enabled, edges with a larger difference between normals are protected from reduction.',
 'Protect UV seams and boundaries':'Keep texture seams and open mesh borders. Disabling this allows more reduction but can damage texture alignment and edges.',
 'Protect sharp edges':'Keep edges where surface normals differ by more than the Sharp-edge angle. Helps preserve hard armor edges.',
 'Protect skinning boundaries':'Protect vertices where bone bindings differ. Helps preserve joints during animation.',
 'Preset':'Choose a collision-sphere arrangement. It replaces the current collision shapes only after approval.',
 'Size':'Scale the preset sphere positions and radii together. It changes click/selection bounds, not the visible model.',
 'Add sphere':'Add one more collision sphere to this proposal. Adjust its position and radius, then review before approving.',
 'Static gravity':'Use one gravity value for this particle emitter in every animation. This clears the animated-gravity warning but can change particle motion.',
 'Use the destination pose as the reference instead':'Reverse this endpoint repair: use the destination pose to correct the source endpoint. Interior animation keys remain.',
};
function explanation(label){
 if(explanations[label])return explanations[label];
 if(/^Radius \d+$/.test(label))return 'Distance from the sphere center to its surface, in model units. Larger values enlarge the collision area.';
 if(/^[XYZ] \d+$/.test(label))return `Move this sphere along the ${label[0]} axis, in model units. Z controls height.`;
 if(/^Remove sphere/.test(label))return 'Remove this collision sphere from the proposal. The change is kept only after approval.';
 return '';
}
export default function OptimizeXLHelp({label,children}){
 const anchor=useRef(null),tip=useRef(null),[open,setOpen]=useState(false),[pinned,setPinned]=useState(false),[position,setPosition]=useState({});
 const text=explanation(label);
 function show(){const r=anchor.current.getBoundingClientRect(),w=anchor.current.ownerDocument.defaultView;setPosition({left:Math.max(8,Math.min(w.innerWidth-258,r.left)),top:Math.max(8,Math.min(w.innerHeight-150,r.bottom+6))});setOpen(true);}
 useEffect(()=>{if(!open)return;const doc=anchor.current.ownerDocument;const close=e=>{if(e.type==='keydown'&&e.key!=='Escape')return;if(e.type==='pointerdown'&&(anchor.current.contains(e.target)||tip.current?.contains(e.target)))return;setOpen(false);setPinned(false);};doc.addEventListener('pointerdown',close);doc.addEventListener('keydown',close,true);return()=>{doc.removeEventListener('pointerdown',close);doc.removeEventListener('keydown',close,true);};},[open]);
 if(!text)return children||label;
 return <span ref={anchor} className="ox-help" onMouseEnter={show} onMouseLeave={()=>{if(!pinned)setOpen(false);}} onFocus={show} onBlur={e=>{if(!pinned&&!e.currentTarget.contains(e.relatedTarget))setOpen(false);}}>
  {children||label}<button type="button" className="ox-help-info" aria-label={`About ${label}`} onClick={e=>{e.preventDefault();e.stopPropagation();setPinned(!pinned);if(pinned)setOpen(false);else show();}}>i</button>
  {open&&createPortal(<span ref={tip} role="tooltip" className="ox-tooltip" style={position}>{text}</span>,anchor.current.ownerDocument.body)}
 </span>;
}
