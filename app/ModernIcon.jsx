import React from 'react';
import { Bone, Box, ClipboardPaste, Copy, Crosshair, FilePlus2, FlipHorizontal2, FolderOpen, Link2, Maximize2, Move, MousePointer2, Orbit, Play, Redo2, RefreshCw, RotateCw, Save, Search, Sparkles, Square, Triangle, Undo2, Unlink2, X } from 'lucide-react';

const icons = Object.freeze({
  'new-document': FilePlus2, sb_open: FolderOpen, sb_save: Save, sb_select: MousePointer2,
  sb_move: Move, sb_rot: RotateCw, sb_zoom: Search, sb_cross: Crosshair,
  sb_undo: Undo2, sb_redo: Redo2, sb_copy: Copy, sb_paste: ClipboardPaste,
  sb_del: X, sb_mirror: FlipHorizontal2, b_extrude: Box, b_detach: Unlink2,
  sb_triangle: Triangle, sb_deltr: X, sb_uncouple: Unlink2, sb_nrot: Orbit,
  sb_nsmooth: Sparkles, sb_nrestore: RefreshCw, sb_selbone: Bone, sb_bonemove: Move,
  sb_bonerot: RotateCw, sb_bonescale: Maximize2, sb_play: Play, sb_stop: Square,
  sb_begattach: Link2, sb_vattach: Link2, sb_endattach: Unlink2, sb_vdetach: Unlink2,
  sb_animcopy: Copy, sb_animpaste: ClipboardPaste,
});

export function hasModernIcon(name) { return !!icons[name]; }

export default function ModernIcon({ name, flip = false }) {
  const resolved = flip && name === 'sb_undo' ? 'sb_redo' : name, Icon = icons[resolved];
  if (!Icon) return null;
  const tone = /del|detach|uncouple/.test(resolved) ? 'danger' : /triangle|extrude|paste|save|open/.test(resolved) ? 'gold' : 'blue';
  return <Icon aria-hidden="true" className={`modern-retro-icon modern-retro-${tone}`} strokeWidth={2.25}/>;
}
