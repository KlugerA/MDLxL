export function viewportPointIndices(count, selection = [], hidden = []) {
  const selected = new Set(selection), invisible = new Set(hidden);
  if (!selected.size && !invisible.size) return { unselected: null, selected: [] };
  const chosen = [], other = [];
  for (let index = 0; index < count; index++) {
    if (invisible.has(index)) continue;
    (selected.has(index) ? chosen : other).push(index);
  }
  return { unselected: other, selected: chosen };
}

export function viewportPointDepth(pureWireframe, xrayVertices) {
  return { depthTest: !pureWireframe, showHidden: !pureWireframe && !!xrayVertices };
}
