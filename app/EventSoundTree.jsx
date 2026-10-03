import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Folder, FolderOpen, Volume2, ChevronDown, ChevronRight } from 'lucide-react';

const colors = {Human:'#83bdff', Orc:'#df9f79', Undead:'#b2a1ed', NightElf:'#99d197', Naga:'#74d4d2', Demon:'#ef9598', Creeps:'#e4c486', Abilities:'#c7a4f2', Sound:'#88d8b6', Unavailable:'#b5bdc8'};
const folderLabel = value => ({NightElf:'Night Elf', UI:'UI', AI:'AI'}[value] || value.replace(/([a-z])([A-Z])/g, '$1 $2'));
export function soundFolders(row) {
  return row.files?.[0]?.split(':').at(-1).split(/[\\/]+/).filter(Boolean).slice(0, -1) || ['Unavailable'];
}

export default function EventSoundTree({ rows, selectedId, query, onSelect }) {
  const [expanded, setExpanded] = useState(new Set());
  const tree = useRef(null);
  const selected = rows.find(row => row.id === selectedId);
  useEffect(() => {
    const folders = selected ? soundFolders(selected) : [];
    setExpanded(previous => new Set([...previous, ...folders.map((_, index) => folders.slice(0, index + 1).join('/'))]));
  }, [selected]);
  useEffect(() => {
    if (!query.trim()) tree.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({block:'nearest'});
  }, [expanded, selectedId, query]);
  const root = useMemo(() => {
    const root = {folders:new Map(), sounds:[]}, search = query.trim().toLowerCase();
    for (const row of rows) {
      const folders = soundFolders(row);
      if (search && !`${row.label} ${folders.join(' ')}`.toLowerCase().includes(search)) continue;
      let branch = root;
      for (const name of folders) { if (!branch.folders.has(name)) branch.folders.set(name, {folders:new Map(), sounds:[]}); branch = branch.folders.get(name); }
      branch.sounds.push(row);
    }
    return root;
  }, [rows, query]);
  const render = (branch, parent = '', level = 0, color = '#88d8b6') => <>
    {[...branch.folders].sort(([a], [b]) => a.localeCompare(b)).map(([name, folder]) => {
      const path = parent ? `${parent}/${name}` : name, open = !!query.trim() || expanded.has(path), tint = colors[name] || color;
      const Icon = open ? FolderOpen : Folder, Chevron = open ? ChevronDown : ChevronRight;
      return <div key={path} role="treeitem" aria-label={folderLabel(name)} aria-expanded={open}>
        <button type="button" className="re-sound-folder" style={{paddingLeft:5 + level * 14, color:tint}} onClick={() => setExpanded(previous => { const next = new Set(previous); if (open) next.delete(path); else next.add(path); return next; })}><Chevron/><Icon/><span>{folderLabel(name)}</span></button>
        {open && <div role="group">{render(folder, path, level + 1, tint)}</div>}
      </div>;
    })}
    {branch.sounds.map(row => <button type="button" role="treeitem" aria-selected={row.id === selectedId} aria-label={row.label} data-sound-id={row.id} key={row.id} className="re-sound-item" style={{paddingLeft:19 + level * 14}} onClick={() => onSelect(row.id)}><Volume2 style={{color}}/><span>{row.label.split(' · ')[0]}</span><small>{row.id}</small></button>)}
  </>;
  return <div ref={tree} className="re-sound-tree" role="tree" aria-label="Sound categories">{render(root)}</div>;
}
