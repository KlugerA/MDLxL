import {paintUVTriangles,paintUVCoverage,paintUVFilterCoverage,forEachPaintUVTexel,forEachPaintUVEdgeTexel} from './paint-uv-coverage.js';
import { blendPaintPixel, rgbaColor } from './paint-raster.js';

const positionKey = (value, offset) => `${Math.round(value[offset] * 1000)}:${Math.round(value[offset + 1] * 1000)}:${Math.round(value[offset + 2] * 1000)}`;

export function projectPaintVertex(matrix, position, offset, width, height) {
  const x = position[offset], y = position[offset + 1], z = position[offset + 2];
  const clipX = matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12];
  const clipY = matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13];
  const clipZ = matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14];
  const clipW = matrix[3] * x + matrix[7] * y + matrix[11] * z + matrix[15];
  if (!Number.isFinite(clipW) || Math.abs(clipW) < 1e-9) return null;
  const nx = clipX / clipW, ny = clipY / clipW, nz = clipZ / clipW;
  return { x: (nx + 1) * width / 2, y: (1 - ny) * height / 2, z: nz, w: clipW };
}

function faceNormal(vertices, a, b, c) {
  const ax = vertices[b * 3] - vertices[a * 3], ay = vertices[b * 3 + 1] - vertices[a * 3 + 1], az = vertices[b * 3 + 2] - vertices[a * 3 + 2];
  const bx = vertices[c * 3] - vertices[a * 3], by = vertices[c * 3 + 1] - vertices[a * 3 + 1], bz = vertices[c * 3 + 2] - vertices[a * 3 + 2];
  const x = ay * bz - az * by, y = az * bx - ax * bz, z = ax * by - ay * bx, length = Math.hypot(x, y, z) || 1;
  return [x / length, y / length, z / length];
}

function targetBindings(target) {
  const unique = new Map();
  for (const binding of target?.bindings || []) unique.set(`${binding.geosetIndex}:${binding.coordId}`, binding);
  return [...unique.values()];
}

function projectedTriangles(model, bindings, matrix, width, height, requireUV = true) {
  const result = [];
  for (const binding of bindings) {
    const geoset = model.Geosets?.[binding.geosetIndex], vertices = geoset?.Vertices, faces = geoset?.Faces, uv = geoset?.TVertices?.[binding.coordId] || geoset?.TVertices?.[0];
    if (!vertices?.length || !faces?.length || requireUV && !uv?.length) continue;
    for (let faceOffset = 0; faceOffset + 2 < faces.length; faceOffset += 3) {
      const ids = [faces[faceOffset], faces[faceOffset + 1], faces[faceOffset + 2]], screen = ids.map(id => projectPaintVertex(matrix, vertices, id * 3, width, height));
      if (screen.some(value => !value) || screen.every(value => value.z < -1 || value.z > 1)) continue;
      result.push({ geosetIndex: binding.geosetIndex, materialId: binding.materialId, layerIndex: binding.layerIndex, coordId: binding.coordId, faceIndex: faceOffset / 3, ids, screen, uv: uv?.length ? ids.map(id => ({ x: uv[id * 2], y: uv[id * 2 + 1] })) : null, normal: faceNormal(vertices, ...ids) });
    }
  }
  return result;
}

// Pair UV discontinuities by their position on the model, not by UV proximity.
// A shoulder can put one side of a welded edge several pixels away in the
// texture. Both sides must sample the same visible 3D edge when the view turns.
function projectedSeams(model,triangles){
  const edges=new Map(),seams=[];
  for(const triangle of triangles){
    const vertices=model.Geosets[triangle.geosetIndex].Vertices;
    for(let side=0;side<3;side++){
      const next=(side+1)%3,first=positionKey(vertices,triangle.ids[side]*3),last=positionKey(vertices,triangle.ids[next]*3);
      if(first===last)continue;
      const forward=first<last,a=forward?side:next,b=forward?next:side,key=`${triangle.geosetIndex}:${triangle.coordId}:${forward?first+'|'+last:last+'|'+first}`;
      let entries=edges.get(key);if(!entries)edges.set(key,entries=[]);
      entries.push({uv:[triangle.uv[a],triangle.uv[b]],screen:[triangle.screen[a],triangle.screen[b]]});
    }
  }
  for(const entries of edges.values()){
    if(entries.length<2)continue;
    const [a,b]=entries[0].uv;
    if(entries.some(({uv:[c,d]})=>Math.abs(a.x-c.x)+Math.abs(a.y-c.y)+Math.abs(b.x-d.x)+Math.abs(b.y-d.y)>1e-5))seams.push(...entries);
  }
  return seams;
}

function indexPaintDepth(triangles,width,height){
  const tileSize=32,columns=Math.ceil(width/tileSize),rows=Math.ceil(height/tileSize),bins=new Map();
  for (const triangle of triangles) {
    const [a,b,c]=triangle.screen,denominator=(b.y-c.y)*(a.x-c.x)+(c.x-b.x)*(a.y-c.y);
    if(Math.abs(denominator)<1e-9)continue;
    const minX=Math.max(0,Math.floor(Math.min(a.x,b.x,c.x)/tileSize)),maxX=Math.min(columns-1,Math.floor(Math.max(a.x,b.x,c.x)/tileSize));
    const minY=Math.max(0,Math.floor(Math.min(a.y,b.y,c.y)/tileSize)),maxY=Math.min(rows-1,Math.floor(Math.max(a.y,b.y,c.y)/tileSize));
    const values=[c.x,c.y,(b.y-c.y)/denominator,(c.x-b.x)/denominator,(c.y-a.y)/denominator,(a.x-c.x)/denominator,a.z,b.z,c.z];
    for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){
      const key=y*columns+x;let bin=bins.get(key);if(!bin)bins.set(key,bin=[]);bin.push(...values);
    }
  }
  for(const [key,values] of bins)bins.set(key,new Float64Array(values));
  return {tileSize,columns,bins};
}

/** Build screen tiles once per camera/part change. The former depth-resolution
 * argument remains for callers; visibility now uses exact triangle depth. */
export function preparePaintProjection(model, target, viewProjectionMatrix, width, height, _maxDepthDimension = 384, hiddenGeosets = new Set()) {
  if (!Array.isArray(viewProjectionMatrix) && !ArrayBuffer.isView(viewProjectionMatrix)) throw Error('Paint projection needs a camera matrix.');
  const matrix = Array.from(viewProjectionMatrix), allBindings = (model?.Geosets || []).map((geoset, geosetIndex) => ({ geosetIndex, materialId: geoset.MaterialID, layerIndex: 0, coordId: 0 }));
  const sceneTriangles = projectedTriangles(model, allBindings.filter(binding => !hiddenGeosets.has(binding.geosetIndex)), matrix, width, height, false), triangles = projectedTriangles(model, targetBindings(target).filter(binding => !hiddenGeosets.has(binding.geosetIndex)), matrix, width, height, true);
  return { width, height, matrix, triangles, seams:projectedSeams(model,triangles), uvCoverage:paintUVTriangles(model,target.coverageBindings||target.bindings), depth:indexPaintDepth(sceneTriangles,width,height) };
}

function sampleDepth(depth, x, y) {
  const bin=depth.bins.get(Math.floor(y/depth.tileSize)*depth.columns+Math.floor(x/depth.tileSize));let nearest=Infinity;
  if(bin)for(let i=0;i<bin.length;i+=9){
    const dx=x-bin[i],dy=y-bin[i+1],u=bin[i+2]*dx+bin[i+3]*dy,v=bin[i+4]*dx+bin[i+5]*dy;
    if(u< -1e-7||v< -1e-7||u+v>1.0000001)continue;
    const z=u*bin[i+6]+v*bin[i+7]+(1-u-v)*bin[i+8];if(z>=-1&&z<=1&&z<nearest)nearest=z;
  }
  return nearest;
}

function sourcePixel(material,u,v,output){
  if(!material?.data?.length||u<0||v<0||u>1||v>1){output.fill(0);return output;}
  const x=u*material.width-.5,y=v*material.height-.5,ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;
  const x0=(ix+material.width)%material.width,y0=(iy+material.height)%material.height,x1=(x0+1)%material.width,y1=(y0+1)%material.height;
  for(let channel=0;channel<4;channel++){
    const a=material.data[(y0*material.width+x0)*4+channel]*(1-fx)+material.data[(y0*material.width+x1)*4+channel]*fx;
    const b=material.data[(y1*material.width+x0)*4+channel]*(1-fx)+material.data[(y1*material.width+x1)*4+channel]*fx;
    output[channel]=Math.round(a*(1-fy)+b*fy);
  }
  return output;
}

/** Source scale is measured in screen pixels, independently of brush diameter,
 * model units and destination UVs. At 100%, one source pixel is one screen
 * pixel. A larger brush reveals more of the repeating source, never stretches it. */
export function samplePaintSource(material,dx,dy,{zoom=1,filterColor='#ffffff',motion=null}={}){
  const scale=Math.max(.01,Math.min(64,Number(zoom)||1)),tint=rgbaColor(filterColor),samples=motion&&Math.hypot(motion.x||0,motion.y||0)>.001?5:1,total=[0,0,0,0],pixel=[0,0,0,0];
  const wrap=value=>((value%1)+1)%1;
  for(let index=0;index<samples;index++){
    const amount=samples===1?0:index/(samples-1),u=wrap((dx-(motion?.x||0)*amount)/(material.width*scale)+.5),v=wrap((dy-(motion?.y||0)*amount)/(material.height*scale)+.5);
    sourcePixel(material,u,v,pixel);for(let channel=0;channel<4;channel++)total[channel]+=pixel[channel];
  }
  return [Math.round(total[0]/samples*tint[0]/255),Math.round(total[1]/samples*tint[1]/255),Math.round(total[2]/samples*tint[2]/255),Math.round(total[3]/samples)];
}

/** Project visible texel centers once per camera/part/size, then bin them in
 * 32px screen tiles. Dabs visit only nearby samples, with no triangle scans or
 * barycentric allocations. The caller retains one projection between strokes.
 */
export function preparePaintSurface(projection, raster, flags = 0) {
  const key = `${raster.width}:${raster.height}:${flags}`;
  if (projection.surface?.key === key) return projection.surface;
  const tileSize = 32, columns = Math.ceil(projection.width / tileSize), bins = new Map(), cellSamples = new Map();
  const coverage=paintUVCoverage(projection.uvCoverage||projection.triangles.map(t=>t.uv),raster.width,raster.height,flags);
  const selectedCoverage=paintUVFilterCoverage(projection.triangles.map(t=>t.uv),raster.width,raster.height,flags);
  const addSample=(sx,sy,sz,pixel,cellSample=1)=>{
    if(sx<0||sy<0||sx>=projection.width||sy>=projection.height||sz< -1||sz>1||sz>sampleDepth(projection.depth,sx,sy)+1e-7)return;
    const bin=Math.floor(sy/tileSize)*columns+Math.floor(sx/tileSize);let values=bins.get(bin);if(!values){bins.set(bin,values=[]);cellSamples.set(bin,[]);}values.push(sx,sy,pixel);cellSamples.get(bin).push(cellSample);
  };
  for(const triangle of projection.triangles){
    const [p,q,r]=triangle.screen;
    forEachPaintUVTexel(triangle.uv,raster.width,raster.height,flags,(x,y,u,v,w,gutter)=>{
      const pixel=y*raster.width+x;if(gutter&&coverage[pixel]&&!selectedCoverage[pixel])return;
      const clipW=u*p.w+v*q.w+w*r.w;if(clipW<=1e-9)return;
      const sx=(u*p.x*p.w+v*q.x*q.w+w*r.x*r.w)/clipW,sy=(u*p.y*p.w+v*q.y*q.w+w*r.y*r.w)/clipW,sz=(u*p.z*p.w+v*q.z*q.w+w*r.z*r.w)/clipW;
      // Interior pixels use their own face projection, not a neighbouring
      // triangle's padded edge. Keep actual island gutters for seam filtering.
      addSample(sx,sy,sz,pixel,gutter&&coverage[pixel]?0:1);
    },Math.SQRT2);
  }
  if(projection.seams?.length){
    for(const seam of projection.seams){
      const [a,b]=seam.screen;
      forEachPaintUVEdgeTexel(...seam.uv,raster.width,raster.height,flags,(x,y,from,to)=>{
        const pixel=y*raster.width+x;if(coverage[pixel]&&!selectedCoverage[pixel])return;
        const first=(1-from)*a.w,last=from*b.w,w=first+last,endFirst=(1-to)*a.w,endLast=to*b.w,endW=endFirst+endLast;if(w<=1e-9||endW<=1e-9)return;
        const sx=(first*a.x+last*b.x)/w,sy=(first*a.y+last*b.y)/w,sz=(first*a.z+last*b.z)/w;
        const dx=(endFirst*a.x+endLast*b.x)/endW-sx,dy=(endFirst*a.y+endLast*b.y)/endW-sy,dz=(endFirst*a.z+endLast*b.z)/endW-sz;
        const steps=Math.max(1,Math.ceil(Math.hypot(dx,dy)/.75));
        // These extended filter intervals are retained for the smart tools and
        // decals. Normal/eraser use texel cells, including the gutters above.
        for(let step=0;step<=steps;step++){const t=step/steps;addSample(sx+dx*t,sy+dy*t,sz+dz*t,pixel,0);}
      });
    }
  }
  for (const [bin, values] of bins) {bins.set(bin, new Float32Array(values));cellSamples.set(bin,new Uint8Array(cellSamples.get(bin)));}
  return projection.surface = { key, tileSize, columns, bins, cellSamples, sampledTiles:new Set() };
}

/** Resolve magnified texture pixels where the brush actually touches the face.
 * Texel centres alone leave blind spots on narrow/overlapping/collapsed UVs.
 * Screen tiles are sampled lazily and reused across dabs; rotating the camera
 * does no extra pixel work until the next stroke. Texture-space samples above
 * retain coverage when many texture pixels fit into one screen pixel. */
export function paintSurfaceTile(projection,raster,flags,tx,ty){
  const surface=preparePaintSurface(projection,raster,flags),{tileSize,columns,bins,sampledTiles}=surface,key=ty*columns+tx;
  if(!sampledTiles||sampledTiles.has(key))return bins.get(key);
  sampledTiles.add(key);
  const x0=tx*tileSize,y0=ty*tileSize,x1=Math.min(projection.width,x0+tileSize),y1=Math.min(projection.height,y0+tileSize),points=Array.from(bins.get(key)||[]),cellSamples=Array.from(surface.cellSamples.get(key)||[]);
  const address=(value,size,wrap)=>wrap?(value%size+size)%size:Math.max(0,Math.min(size-1,value));
  for(const triangle of projection.triangles){
    const [a,b,c]=triangle.screen,denominator=(b.y-c.y)*(a.x-c.x)+(c.x-b.x)*(a.y-c.y);
    if(Math.abs(denominator)<1e-9||[a,b,c].some(p=>p.w<=0))continue;
    const left=Math.max(x0,Math.floor(Math.min(a.x,b.x,c.x))),right=Math.min(x1-1,Math.ceil(Math.max(a.x,b.x,c.x))),top=Math.max(y0,Math.floor(Math.min(a.y,b.y,c.y))),bottom=Math.min(y1-1,Math.ceil(Math.max(a.y,b.y,c.y)));
    if(left>right||top>bottom)continue;
    const [p,q,r]=triangle.uv;
    const collapsedUV=Math.abs((q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x))<1e-12;
    for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++){
      const sx=x+.5,sy=y+.5,u=((b.y-c.y)*(sx-c.x)+(c.x-b.x)*(sy-c.y))/denominator,v=((c.y-a.y)*(sx-c.x)+(a.x-c.x)*(sy-c.y))/denominator,w=1-u-v;
      if(u<0||v<0||w<0)continue;
      const z=u*a.z+v*b.z+w*c.z;if(z< -1||z>1||z>sampleDepth(projection.depth,sx,sy)+1e-7)continue;
      const iw=u/a.w+v/b.w+w/c.w,tu=(u*p.x/a.w+v*q.x/b.w+w*r.x/c.w)/iw*raster.width-.5,tv=(u*p.y/a.w+v*q.y/b.w+w*r.y/c.w)/iw*raster.height-.5,ix=Math.floor(tu),iy=Math.floor(tv);
      for(let j=0;j<2;j++)for(let i=0;i<2;i++){
        const weight=(i?tu-ix:1-tu+ix)*(j?tv-iy:1-tv+iy);if(weight<1e-7)continue;
        points.push(sx,sy,address(iy+j,raster.height,flags&2)*raster.width+address(ix+i,raster.width,flags&1));
        // Normal deposits into the texel cell, not the larger bilinear display
        // footprint. A touched cell receives the chosen brush opacity; display
        // filtering must not enlarge the dab to all four neighbouring cells.
        // Collapsed UVs have no separable surface pixels; retain their shared
        // colour behaviour when editing an existing texture.
        cellSamples.push(collapsedUV||i===Math.round(tu)-ix&&j===Math.round(tv)-iy?1:0);
      }
    }
  }
  if(points.length){bins.set(key,new Float32Array(points));surface.cellSamples.set(key,new Uint8Array(cellSamples));}
  return bins.get(key);
}

/** Texture view uses image-pixel coordinates, so there is no geometry/depth work. */
export function prepareTexturePaintProjection(size) {
  const tileSize=32,columns=Math.ceil(size/tileSize),bins=new Map();
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){const key=Math.floor(y/tileSize)*columns+Math.floor(x/tileSize);let list=bins.get(key);if(!list){list=[];bins.set(key,list);}list.push(x+.5,y+.5,y*size+x);}
  for(const [key,list] of bins)bins.set(key,new Float32Array(list));
  return {width:size,height:size,surface:{key:`${size}:${size}:0`,tileSize,columns,bins}};
}

export function stampProjectedBrush(raster, projection, center, brush, options = {}) {
  const radius = Math.max(.5, Number(brush.size) / 2), color = rgbaColor(brush.color), inner = Math.max(0, Math.min(.995, Number(brush.hardness))) * radius;
  const mask = options.mask, material = options.materialRaster, tip = options.tipRaster;
  const radiusX=radius,radiusY=radius;
  const surface = preparePaintSurface(projection, raster, options.flags), { tileSize, columns, bins } = surface;
  const minTileX = Math.max(0, Math.floor((center.x - radiusX) / tileSize)), maxTileX = Math.min(columns - 1, Math.floor((center.x + radiusX) / tileSize));
  const minTileY = Math.max(0, Math.floor((center.y - radiusY) / tileSize)), maxTileY = Math.min(Math.ceil(projection.height / tileSize) - 1, Math.floor((center.y + radiusY) / tileSize));
  const opacity = Number(brush.opacity) * (options.dragging?Number(brush.flow):1) * Number(brush.strength ?? 1);
  // Shared/mirrored triangles must not apply the same dab repeatedly to a
  // texel. Keep its strongest sample, including the gutter, then blend once.
  const scratch=surface.scratch||= {amount:new Float32Array(raster.width*raster.height),source:new Uint8ClampedArray(raster.width*raster.height*4),pixels:[]};
  const touched=scratch.pixels;touched.length=0;
  let changed = 0;
  for (let ty = minTileY; ty <= maxTileY; ty++) for (let tx = minTileX; tx <= maxTileX; tx++) {
    const samples = paintSurfaceTile(projection,raster,options.flags,tx,ty); if (!samples) continue;
    const cellSamples=brush.mode==='paint'||brush.mode==='erase'?surface.cellSamples?.get(ty*columns+tx):null;
    for (let i = 0; i < samples.length; i += 3) {
      if(cellSamples&&!cellSamples[i/3])continue;
      const dx = samples[i] - center.x, dy = samples[i + 1] - center.y,localX=dx/radiusX,localY=dy/radiusY;
      if(Math.abs(localX)>1||Math.abs(localY)>1)continue;
      const pixel = samples[i + 2],distanceSquared=dx*dx+dy*dy;
      if(distanceSquared>radius*radius)continue;
      const distance=Math.sqrt(distanceSquared);
      let falloff=distance<=inner?1:1-(distance-inner)/Math.max(.001,radius-inner),source=null;
      falloff=falloff*falloff*(3-2*falloff);
      if(material?.data?.length){
        source=samplePaintSource(material,dx,dy,{zoom:brush.zoom,filterColor:brush.filterColor,motion:options.motion});
        if(!source[3])continue;
      }
      if (!material?.data?.length&&tip?.data?.length) {
        const tipX = Math.max(0, Math.min(tip.width - 1, Math.floor((localX * .5 + .5) * tip.width))), tipY = Math.max(0, Math.min(tip.height - 1, Math.floor((localY * .5 + .5) * tip.height)));
        falloff *= tip.data[(tipY * tip.width + tipX) * 4 + 3] / 255;
      }
      if (mask) falloff *= mask[pixel] / 255;
      const amount=opacity*falloff;if(amount<=0)continue;
      if(!scratch.amount[pixel])touched.push(pixel);
      if(amount>scratch.amount[pixel]){scratch.amount[pixel]=amount;if(source)scratch.source.set(source,pixel*4);}
    }
  }
  for(const pixel of touched){
    const appliedColor=material?.data?.length?scratch.source.subarray(pixel*4,pixel*4+4):color;
    if(blendPaintPixel(raster.data,pixel*4,appliedColor,scratch.amount[pixel],brush.mode==='erase'?'erase':'paint')){
      changed++;if(options.dirtyRows){const x=pixel%raster.width,row=Math.floor(pixel/raster.width)*2;options.dirtyRows[row]=Math.min(options.dirtyRows[row],x);options.dirtyRows[row+1]=Math.max(options.dirtyRows[row+1],x);}
    }
    scratch.amount[pixel]=0;
  }
  return changed;
}

export function interpolatePaintStroke(previous, next, brush) {
  if (!previous) return [next];
  const distance = Math.hypot(next.x - previous.x, next.y - previous.y), step = Math.max(1, Number(brush.size) * Math.max(.03, Number(brush.spacing)));
  const count = Math.max(1, Math.ceil(distance / step)), result = [];
  for (let index = 1; index <= count; index++) { const amount = index / count; result.push({ x: previous.x + (next.x - previous.x) * amount, y: previous.y + (next.y - previous.y) * amount }); }
  return result;
}

function triangleUVRaster(triangle, size, callback) {
  forEachPaintUVTexel(triangle.uv,size,size,0,(x,y,u,v,w)=>callback(x,y,[u,v,w]),Math.SQRT2);
}

/** Geometry-derived broad cavity and narrow exposed-edge masks. */
export function buildSmartPaintMasks(model, target, size) {
  const wash = new Uint8ClampedArray(size * size), drybrush = new Uint8ClampedArray(size * size), triangles = [];
  for (const binding of targetBindings(target)) {
    const geoset = model.Geosets?.[binding.geosetIndex], uv = geoset?.TVertices?.[binding.coordId] || geoset?.TVertices?.[0];
    if (!geoset?.Faces?.length || !uv?.length) continue;
    for (let offset = 0; offset < geoset.Faces.length; offset += 3) { const ids = [geoset.Faces[offset], geoset.Faces[offset + 1], geoset.Faces[offset + 2]]; triangles.push({ geoset, ids, uv: ids.map(id => ({ x: uv[id * 2], y: uv[id * 2 + 1] })), normal: faceNormal(geoset.Vertices, ...ids), edges: [0, 0, 0] }); }
  }
  const edges = new Map();
  for (const [triangleIndex, triangle] of triangles.entries()) for (let opposite = 0; opposite < 3; opposite++) {
    const a = triangle.ids[(opposite + 1) % 3] * 3, b = triangle.ids[(opposite + 2) % 3] * 3, keys = [positionKey(triangle.geoset.Vertices, a), positionKey(triangle.geoset.Vertices, b)].sort(), key = keys.join('|');
    const list = edges.get(key) || []; list.push({ triangleIndex, opposite }); edges.set(key, list);
  }
  for (const list of edges.values()) {
    if (list.length === 1) triangles[list[0].triangleIndex].edges[list[0].opposite] = 1;
    else for (const item of list) { const other = list.find(value => value !== item), a = triangles[item.triangleIndex].normal, b = triangles[other.triangleIndex].normal, crease = Math.max(0, Math.min(1, (1 - (a[0] * b[0] + a[1] * b[1] + a[2] * b[2])) * 1.8)); triangles[item.triangleIndex].edges[item.opposite] = crease; }
  }
  for (const triangle of triangles) triangleUVRaster(triangle, size, (x, y, b) => {
    let narrow = 0, broad = 0;
    for (let edgeIndex = 0; edgeIndex < 3; edgeIndex++) { const strength = triangle.edges[edgeIndex], distance = Math.max(0, b[edgeIndex]); narrow = Math.max(narrow, strength * Math.exp(-distance * 42)); broad = Math.max(broad, strength * Math.exp(-distance * 13)); }
    const facing = Math.max(0, triangle.normal[2]), away = Math.max(0, -triangle.normal[2]), index = y * size + x;
    drybrush[index] = Math.max(drybrush[index], Math.round(Math.min(1, narrow * .88 + facing * .12) * 255));
    wash[index] = Math.max(wash[index], Math.round(Math.min(1, broad * .78 + away * .22) * 255));
  });
  return { wash, drybrush };
}
