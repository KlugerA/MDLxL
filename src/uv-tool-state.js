/** UV tools operate on the selection captured when the wrapper opened. */
export function uvToolState({ readOnly = false, selectionCount = 0, draftCount = 0 } = {}) {
  const editable = !readOnly, selected = Math.max(0, Number(selectionCount) || 0);
  return {
    move: editable,
    rotate: editable,
    scale: editable,
    mirror: editable && selected > 0,
    uncouple: editable && selected > 0 && !draftCount,
    fold: editable && selected > 1,
  };
}
