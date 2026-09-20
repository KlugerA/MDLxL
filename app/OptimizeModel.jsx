import React, { useEffect, useState } from 'react';
import { analyzeOptimization, formatOptimizerBytes } from '../src/model-optimizer.js';
import './optimize-model.css';

export default function OptimizeModel({ doc, onClose, onApply }) {
  const [result, setResult] = useState(null), [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      try { const next = analyzeOptimization(doc); if (!cancelled) setResult(next); }
      catch (failure) { if (!cancelled) setError(failure.message); }
    }, 0);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [doc]);
  const apply = () => { try { if (onApply(result) !== false) onClose(); } catch (failure) { setError(failure.message); } };
  return <div className="optimizer-overlay" onKeyDown={event => { event.stopPropagation(); if (event.key === 'Escape') onClose(); }}>
    <section className="optimizer-dialog" role="dialog" aria-modal="true" aria-label="Optimize Model">
      <header><h2>Optimize Model</h2><button aria-label="Close Optimize Model" onClick={onClose}>✕</button></header>
      {!result && !error && <p role="status">Analyzing a temporary copy and verifying serialized MDX…</p>}
      {error && <p role="alert" className="optimizer-error">{error}</p>}
      {result && <>
        <p role="status">{result.message}</p>
        <dl className="optimizer-sizes">
          <dt>Before</dt><dd>{formatOptimizerBytes(result.before)}</dd>
          <dt>After</dt><dd>{formatOptimizerBytes(result.after)}</dd>
          <dt>Bytes saved</dt><dd>{formatOptimizerBytes(result.saved)}</dd>
          <dt>Reduction</dt><dd>{result.reduction.toFixed(2)}%</dd>
        </dl>
        <p>Measured from the current model serialized as MDX800 before and after optimization.</p>
        {(result.originalFormat !== 'mdx' || result.originalBytes !== result.before) && <p>{`Original ${result.originalFormat.toUpperCase()} file: ${formatOptimizerBytes(result.originalBytes)}. This is separate from the optimization baseline.`}</p>}
        <p>{`Removed: ${result.counts.vertices} vertices (${result.counts.unusedVertices} unused, ${result.counts.duplicateVertices} exact duplicates), ${result.counts.transformKeys} transform keys, ${result.counts.materials} materials and ${result.counts.textures} texture entries.`}</p>
        {result.skipped.length > 0 && <ul>{result.skipped.map(text => <li key={text}>{text}</li>)}</ul>}
        <p>Apply creates one undo step. Use Save or Save As to write the result.</p>
      </>}
      <footer><button onClick={onClose}>Cancel</button><button autoFocus disabled={!result?.canApply || !!error} onClick={apply}>Apply</button></footer>
    </section>
  </div>;
}
