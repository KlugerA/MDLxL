import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { previewLighting, configurePreviewLights, applyPreviewMaterialLighting } from './preview-lighting.js';
import { cameraLeftLight } from './viewport-quality.js';
import { visualOptions } from '../src/preferences.js';

export default function ForgePreview({ geosets = [], image = null, wire = false, checker = false, trimColor = '#cca64d', shapeHandle = null, preferences }) {
  const host = useRef(), state = useRef(), drag = useRef();
  const latest = useRef(preferences); latest.current = preferences;
  const fit = (view = 'front') => { const s = state.current; if (!s || !s.group.children.length) return; const box = new THREE.Box3().setFromObject(s.group), center = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3()).length() || 100; s.controls.target.copy(center); const direction = view === 'side' ? new THREE.Vector3(1, 0, 0) : view === 'oblique' ? new THREE.Vector3(.7, .45, 1).normalize() : new THREE.Vector3(0, 0, 1); s.camera.position.copy(center).addScaledVector(direction, size * 1.7); s.controls.update(); s.render(); };
  useEffect(() => {
    const scene = new THREE.Scene(); scene.background = new THREE.Color('#182028');
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false }); } catch { return; }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.outputColorSpace = THREE.SRGBColorSpace;
    const camera = new THREE.PerspectiveCamera(38, 1, .01, 10000); camera.up.set(0, 1, 0);
    host.current.appendChild(renderer.domElement); const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = false;
    const ambient = new THREE.HemisphereLight(0xffffff, 0x505864, 2); scene.add(ambient); const light = new THREE.DirectionalLight(0xffffff, 2); light.position.set(100, 150, 200); scene.add(light, light.target);
    const group = new THREE.Group(); scene.add(group);
    const render = () => { const config = previewLighting(latest.current); configurePreviewLights(ambient, light, config); light.position.copy(cameraLeftLight(camera, controls.target, Math.max(1, camera.position.distanceTo(controls.target))).position); light.target.position.copy(controls.target); scene.background.set(visualOptions(latest.current).background); group.traverse(object => { if (object.material) applyPreviewMaterialLighting(object.material, config); }); renderer.render(scene, camera); };
    controls.addEventListener('change', render);
    const element = host.current;
    const observer = new ResizeObserver(() => { if (host.current !== element || !element.isConnected) return; const { width, height } = element.getBoundingClientRect(); renderer.setSize(width, height); camera.aspect = width / Math.max(1, height); camera.updateProjectionMatrix(); render(); }); observer.observe(element);
    state.current = { scene, renderer, camera, controls, group, render, fit: false };
    return () => { observer.disconnect(); controls.dispose(); group.traverse(o => { o.geometry?.dispose(); if (o.material) { o.material.map?.dispose(); o.material.dispose(); } }); renderer.dispose(); renderer.domElement.remove(); state.current = null; };
  }, []);
  useEffect(() => {
    const s = state.current; if (!s) return;
    for (const child of [...s.group.children]) { child.geometry?.dispose(); child.material?.map?.dispose(); child.material?.dispose(); s.group.remove(child); }
    let map = null;
    if (checker) {
      const w = 64, h = Math.max(8, Math.round(64 * (image ? image.height / image.width : 1))), data = new Uint8Array(w * h * 4);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data.set((Math.floor(x / 8) + Math.floor(y / 8)) % 2 ? [44, 111, 163, 255] : [238, 239, 219, 255], (y * w + x) * 4);
      map = new THREE.DataTexture(data, w, h, THREE.RGBAFormat); map.wrapS = map.wrapT = THREE.RepeatWrapping;
    } else if (image) map = new THREE.DataTexture(new Uint8Array(image.data), image.width, image.height, THREE.RGBAFormat);
    if (map) { map.flipY = false; map.colorSpace = THREE.SRGBColorSpace; map.magFilter = THREE.LinearFilter; map.minFilter = THREE.LinearMipmapLinearFilter; map.generateMipmaps = true; map.anisotropy = Math.min(8, s.renderer.capabilities.getMaxAnisotropy()); map.needsUpdate = true; }
    geosets.forEach((g, i) => {
      const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(g.Vertices, 3)); geometry.setAttribute('normal', new THREE.BufferAttribute(g.Normals, 3)); if (g.TVertices?.[0]) geometry.setAttribute('uv', new THREE.BufferAttribute(g.TVertices[0], 2)); geometry.setIndex(new THREE.BufferAttribute(g.Faces, 1));
      const material = new THREE.MeshPhongMaterial({ map: i === 0 || checker ? map : null, color: checker ? '#ffffff' : i === 0 ? map ? '#ffffff' : '#dddddd' : trimColor, side: THREE.DoubleSide, alphaTest: .1, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }); s.group.add(new THREE.Mesh(geometry, material));
      if (wire) { const wires = new THREE.LineSegments(new THREE.WireframeGeometry(geometry), new THREE.LineBasicMaterial({ color: 0xccedff, transparent: true, opacity: .58 })); s.group.add(wires); }
    });
    if (geosets.length) {
      const box = new THREE.Box3().setFromObject(s.group), center = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3()).length() || 100;
      s.camera.near = Math.max(.001, size / 1000); s.camera.far = size * 100; s.camera.updateProjectionMatrix();
      if (!s.fit) { s.controls.target.copy(center); s.camera.position.copy(center).add(new THREE.Vector3(0, 0, size * 1.7)); s.controls.update(); s.fit = true; }
    }
    s.render();
  }, [geosets, image, wire, checker, trimColor]);
  useEffect(() => { state.current?.render(); }, [preferences]);
  return <div ref={host} className="forge-preview-canvas" aria-label="3D mesh preview"><div className="forge-preview-views"><button onClick={() => fit('front')}>Front / fit</button><button onClick={() => fit('side')}>Side</button><button onClick={() => fit('oblique')}>Oblique</button></div>{shapeHandle && <button className="forge-shape-handle" title="Drag to shape" aria-label="Drag to shape" onPointerDown={e => { e.stopPropagation(); e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); drag.current = { y: e.clientY, amount: shapeHandle.amount }; }} onPointerMove={e => { if (drag.current) { e.stopPropagation(); shapeHandle.onChange(drag.current.amount + drag.current.y - e.clientY); } }} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onKeyDown={e => { if (['ArrowUp', 'ArrowDown'].includes(e.key)) { e.preventDefault(); e.stopPropagation(); shapeHandle.onChange(shapeHandle.amount + (e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 10 : 1)); } }}>↕</button>}</div>;
}
