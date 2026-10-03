import React, { useMemo } from 'react';
import SidebarSection from './SidebarSection.jsx';
import { animationTargets } from '../src/animation-tracks.js';
import './animation-resources.css';

export default function AnimationNodes({ model, revision, selectedNodeIds, onSelectNodes }) {
  const nodes = useMemo(() => animationTargets(model, { nodeIds: model.Nodes.filter(Boolean).map(n => n.ObjectId) }).filter(t => t.property === 'Visibility').map(t => model.Nodes[t.id]), [model, revision]);
  return <SidebarSection title="Nodes" className="animation-nodes">
    <div className="animation-node-list" role="listbox" aria-label="Animation nodes" aria-multiselectable="true">
      {nodes.map(node => <label key={node.ObjectId} title={node.Name} className={selectedNodeIds.includes(node.ObjectId) ? 'selected' : ''}>
        <input type="checkbox" aria-label={`Select node ${node.Name}`} checked={selectedNodeIds.includes(node.ObjectId)} onChange={e => onSelectNodes(e.target.checked ? [...selectedNodeIds, node.ObjectId] : selectedNodeIds.filter(id => id !== node.ObjectId))}/><span translate="no">{node.Name || `Node ${node.ObjectId}`}</span>
      </label>)}
    </div>
  </SidebarSection>;
}
