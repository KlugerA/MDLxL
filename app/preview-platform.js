import * as THREE from 'three';

export function previewPlatformOptions(preferences) {
  const p = preferences?.platform || {};
  return { enabled: p.enabled === true, shape: ['square', 'disc', 'hexagon'].includes(p.shape) ? p.shape : 'square',
    size: Number.isFinite(Number(p.size)) ? Math.max(.1, Math.min(10, Number(p.size))) : 1.5,
    height: Number.isFinite(Number(p.height)) ? Number(p.height) : 0,
    color: /^#[0-9a-f]{6}$/i.test(p.color) ? p.color : '#303030', textureUrl: typeof p.textureUrl === 'string' ? p.textureUrl : '' };
}

export function platformGeometry(options, center, radius, floor = 0) {
  const count = options.shape === 'square' ? 4 : options.shape === 'hexagon' ? 6 : 64;
  const size = Math.max(.001, radius) * options.size;
  const vertices = [], uvs = [];
  const point = i => { const a = i * Math.PI * 2 / count + (count === 4 ? Math.PI / 4 : 0); return [Math.cos(a), Math.sin(a)]; };
  for (let i = 0; i < count; i++) for (const [x, y] of [[0, 0], point(i), point(i + 1)]) {
    vertices.push(center.x + x * size, center.y + y * size, floor + options.height - Math.max(.001, radius * .0001));
    uvs.push(x * .5 + .5, .5 - y * .5);
  }
  return { vertices: new Float32Array(vertices), uvs: new Float32Array(uvs) };
}

export function createPreviewPlatform(invalidate = () => {}) {
  const group = new THREE.Group(); let signature = '', textureUrl = '', texture = null, generation = 0;
  const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), material); group.add(mesh);
  group.update = (preferences, center, radius, floor) => {
    const config = previewPlatformOptions(preferences); group.visible = config.enabled;
    const key = JSON.stringify([config.shape, config.size, config.height, center.toArray(), radius, floor]);
    if (key !== signature) {
      signature = key; const data = platformGeometry(config, center, radius, floor);
      mesh.geometry.dispose(); mesh.geometry = new THREE.BufferGeometry();
      mesh.geometry.setAttribute('position', new THREE.BufferAttribute(data.vertices, 3));
      mesh.geometry.setAttribute('uv', new THREE.BufferAttribute(data.uvs, 2));
    }
    material.color.set(config.color);
    if (textureUrl !== config.textureUrl) {
      textureUrl = config.textureUrl; const token = ++generation;
      texture?.dispose(); texture = null; material.map = null; material.needsUpdate = true;
      if (textureUrl) new THREE.TextureLoader().load(textureUrl, loaded => {
        if (generation !== token) { loaded.dispose(); return; }
        texture = loaded; loaded.flipY = false; loaded.colorSpace = THREE.SRGBColorSpace; material.map = loaded; material.needsUpdate = true; invalidate();
      }, undefined, () => invalidate());
    }
  };
  group.dispose = () => { generation++; texture?.dispose(); mesh.geometry.dispose(); material.dispose(); };
  return group;
}
