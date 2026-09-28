import { Vector3, Matrix4 } from 'three';
/** Project collision outlines onto an existing preview overlay. No model edits. */
export function drawCollisionSpheres(ctx, model, camera, renderer, width, height) {
  ctx.save(); ctx.strokeStyle = '#51d7ff'; ctx.lineWidth = 1.3;
  for (const shape of model.CollisionShapes || []) {
    if (shape.Shape !== 2 || !(shape.BoundsRadius > 0)) continue;
    const matrix = renderer.rendererData.nodes[shape.ObjectId]?.matrix;
    const transform = matrix ? new Matrix4().fromArray(matrix) : new Matrix4();
    for (let plane = 0; plane < 3; plane++) {
      ctx.beginPath(); let connected = false;
      for (let i = 0; i <= 64; i++) {
        const angle = i / 64 * Math.PI * 2, p = Array.from(shape.Vertices.slice(0, 3));
        p[plane] += Math.cos(angle) * shape.BoundsRadius; p[(plane + 1) % 3] += Math.sin(angle) * shape.BoundsRadius;
        const v = new Vector3(...p).applyMatrix4(transform).project(camera);
        if (v.z < -1 || v.z > 1) { connected = false; continue; }
        const x = (v.x + 1) * width / 2, y = (1 - v.y) * height / 2;
        if (connected) ctx.lineTo(x,y); else ctx.moveTo(x,y); connected = true;
      }
      ctx.stroke();
    }
  }
  ctx.restore();
}
