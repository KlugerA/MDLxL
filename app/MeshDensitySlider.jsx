import React, { useEffect, useState } from 'react';
import { changeGeosetDensity } from '../src/mesh-density.js';
import './mesh-density.css';

export default function MeshDensitySlider({ geoset, value, onChange, onResult, disabled = false, compact = false }) {
  const [status, setStatus] = useState({ updating: false, error: '', result: null });
  useEffect(() => {
    let cancelled = false;
    if (!geoset) { setStatus({ updating: false, error: 'Choose a geoset.', result: null }); onResult?.(null); return; }
    setStatus(previous => ({ ...previous, updating: true, error: '' })); onResult?.(null);
    const timer = setTimeout(() => changeGeosetDensity(geoset, value).then(result => {
      if (cancelled) return;
      setStatus({ updating: false, error: '', result }); onResult?.(result);
    }).catch(error => {
      if (cancelled) return;
      setStatus({ updating: false, error: error.message, result: null }); onResult?.(null);
    }), 80);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [geoset, value]);
  const result = status.result, direction = value > 0 ? 'More' : value < 0 ? 'Less' : 'Original';
  return <div className={`mesh-density-control${compact ? ' compact' : ''}`}>
    <div className="mesh-density-labels"><span>Less triangles</span><strong>{direction}</strong><span>More triangles</span></div>
    <input aria-label="Triangle density" type="range" min="-100" max="100" step="1" value={value} disabled={disabled || !geoset} onChange={event => onChange(Number(event.target.value))}/>
    <div className="mesh-density-counts" aria-live="polite">{status.updating ? 'Updating wireframe…' : result ? <><strong>{result.trianglesAfter.toLocaleString()}</strong> triangles · {result.verticesAfter.toLocaleString()} vertices{result.constrained ? ' · minimum safe density reached' : ''}</> : 'Choose a geoset.'}</div>
    {status.error && <div className="mesh-density-error" role="alert">{status.error}</div>}
  </div>;
}
