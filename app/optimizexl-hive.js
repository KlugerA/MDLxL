let loading;
export function flattenHiveFindings(nodes, path = '') {
  return nodes.flatMap(node => {
    if (node.type !== 'node') return [{ ...node, path }];
    const location = path + '/' + node.name;
    return [...(node.uses === 0 ? [{ type: 'unused', path: location, message: 'Unused object' }] : []), ...flattenHiveFindings(node.nodes || [], location)];
  });
}
export async function hiveSanity(bytes) {
  loading ||= new Promise((resolve, reject) => {
    if (window.ModelViewer) { resolve(window.ModelViewer); return; }
    const script = document.createElement('script');
    // The public directory is copied verbatim; resolve relative to index.html,
    // rather than a hashed application chunk under assets/.
    script.src = new URL('vendor/hive-viewer-5.12.0.js', document.baseURI).href;
    script.onload = () => resolve(window.ModelViewer);
    script.onerror = () => { loading = null; script.remove(); reject(Error('The bundled Hive checker could not load.')); };
    document.head.appendChild(script);
  });
  const viewer = await loading;
  const model = new viewer.parsers.mdlx.Model();
  model.load(new Uint8Array(bytes).buffer);
  const result = viewer.utils.mdlx.sanityTest(model);
  return { ...result, findings: flattenHiveFindings(result.nodes), checker: 'Hive / mdx-m3-viewer 5.12.0' };
}
