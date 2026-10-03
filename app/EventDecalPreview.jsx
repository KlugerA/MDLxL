import React, { useEffect, useRef, useState } from 'react';
import { Matrix4, OrthographicCamera } from 'three';
import { textureFromAsset } from './Viewport.jsx';
import { createDecalRenderer } from './event-preview-runtime.js';

export default function EventDecalPreview({ definition, modelPath }) {
  const canvas = useRef(null), clock = useRef({age:0, playing:true});
  const [playing, setPlaying] = useState(true), [age, setAge] = useState(0), [error, setError] = useState('');
  useEffect(() => {
    let disposed = false, request, texture, renderer, previous, report = 0;
    const surface = canvas.current, gl = surface.getContext('webgl2', {alpha:false, antialias:true});
    clock.current = {age:0, playing:true}; setAge(0); setPlaying(true); setError('');
    if (!gl) { setError('WebGL 2 is unavailable.'); return; }
    const camera = new OrthographicCamera(-2, 2, 1, -1, .1, 10), world = new Matrix4();
    camera.position.set(0, 0, 2); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
    const preview = {...definition, scale:.9}, duration = Math.max(1, definition.lifeSpanMs);
    const draw = now => {
      if (disposed) return;
      if (previous != null && clock.current.playing) clock.current.age = (clock.current.age + now - previous) % duration;
      previous = now;
      gl.viewport(0, 0, surface.width, surface.height); gl.clearColor(.55, .55, .55, 1); gl.clearDepth(1); gl.depthMask(true); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      renderer.render(texture, {definition:preview, ageMs:clock.current.age}, world, camera);
      if (now - report > 50) { report = now; setAge(clock.current.age); }
      request = requestAnimationFrame(draw);
    };
    (async () => {
      const records = await window.desktop.resolveEventResources({names:[definition.resourcePath], path:modelPath});
      const asset = records.find(record => record.name === definition.resourcePath && record.bytes?.length);
      if (!asset) throw Error(`Texture not found: ${definition.resourcePath}`);
      const decoded = await textureFromAsset(asset, {Image:definition.resourcePath});
      try {
        if (disposed) return;
        const image = decoded.image?.data ? new ImageData(new Uint8ClampedArray(decoded.image.data), decoded.image.width, decoded.image.height) : decoded.image;
        texture = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        for (const parameter of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) gl.texParameteri(gl.TEXTURE_2D, parameter, gl.LINEAR);
        for (const parameter of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T]) gl.texParameteri(gl.TEXTURE_2D, parameter, gl.CLAMP_TO_EDGE);
        renderer = createDecalRenderer(gl); request = requestAnimationFrame(draw);
      } finally { decoded.dispose(); }
    })().catch(cause => { if (!disposed) setError(cause.message); });
    return () => { disposed = true; cancelAnimationFrame(request); renderer?.dispose(); if (texture) gl.deleteTexture(texture); };
  }, [definition, modelPath]);
  return <div className="re-decal-preview">
    <canvas ref={canvas} width="512" height="256" aria-label="Blood splat animation preview"/>
    {error ? <p className="field-error" role="alert">{error}</p> : <div><button type="button" aria-label={playing ? 'Pause splat preview' : 'Play splat preview'} onClick={() => { clock.current.playing = !playing; setPlaying(!playing); }}>{playing ? 'Pause' : 'Play'}</button><input type="range" aria-label="Splat preview time" min="0" max={definition.lifeSpanMs || 1} step="1" value={age} onChange={event => { const value = Number(event.target.value); clock.current.age = value; setAge(value); }}/></div>}
  </div>;
}
