/** Select New temporarily gives pointer ownership to the live 3D preview. */
export function uvToolState({ readOnly = false, selectingNew = false, selectionCount = 0, draftCount = 0 } = {}) {
  const editable = !readOnly && !selectingNew, selected = Math.max(0, Number(selectionCount) || 0);
  return {
    move: editable,
    rotate: editable,
    scale: editable,
    mirror: editable && selected > 0,
    collapse: editable && selected > 1,
    uncouple: editable && selected > 0 && !draftCount,
    fold: editable && selected > 1,
  };
}
