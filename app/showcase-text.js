import { styledTextRuns } from './showcase-rich-text.js';
export const SHOWCASE_FONTS = [
  {id:'cinzeldecorative',name:'Cinzel Decorative',family:'Showcase Cinzel'},
  {id:'medievalsharp',name:'MedievalSharp',family:'Showcase Medieval'},
  {id:'uncialantiqua',name:'Uncial Antiqua',family:'Showcase Uncial'},
  {id:'orbitron',name:'Orbitron',family:'Showcase Orbitron'},
  {id:'pirataone',name:'Pirata One',family:'Showcase Pirata'},
  {id:'almendra',name:'Almendra',family:'Showcase Almendra'},
  {id:'imfellenglish',name:'IM Fell English',family:'Showcase Fell'},
  {id:'oxanium',name:'Oxanium',family:'Showcase Oxanium'},
  {id:'lato',name:'Lato',family:'Showcase Lato'},
  {id:'lora',name:'Lora',family:'Showcase Lora'},
  {id:'opensans',name:'Open Sans',family:'Showcase Open Sans'},
  {id:'rajdhani',name:'Rajdhani',family:'Showcase Rajdhani'},
  {id:'cormorantsc',name:'Cormorant SC',family:'Showcase Cormorant SC'},
  {id:'grenzegotisch',name:'Grenze Gotisch',family:'Showcase Grenze Gotisch'},
  // Keep the persisted selection key so existing Showcase layers use the replacement.
  {id:'frizquadrata',name:'Marcellus',family:'Showcase Marcellus'},
];
export const TEXT_EFFECTS = [
  ['solid','Solid'],['gradient','Gradient'],['neon','Neon'],['flame','Flame'],
  ['frost','Frost'],['arcane','Arcane'],['lightning','Lightning'],
  ['prism','Prism'],['wave','Wave'],['shimmer','Shimmer'],
];
export const textFont = layer => SHOWCASE_FONTS.find(font=>font.id===layer.font)?.family || SHOWCASE_FONTS[0].family;
export const textFonts = layer => [...new Set(styledTextRuns(layer).map(run=>(run.italic?'italic ':'')+(run.bold?'700 ':'400 ')+'48px "'+textFont(run)+'"'))];
const clamp = (value,min=0,max=1) => Math.max(min,Math.min(max,value));
const smooth = value => {const t=clamp(value);return t*t*(3-2*t);};
const rgb = color => [1,3,5].map(index=>parseInt(color.slice(index,index+2),16)||0);
const mix = (a,b,t) => '#'+rgb(a).map((value,index)=>Math.round(value+(rgb(b)[index]-value)*t).toString(16).padStart(2,'0')).join('');
const emissive = (color,fallback) => {const channels=rgb(color),peak=Math.max(...channels);return peak<32?fallback:'#'+channels.map(value=>Math.min(255,Math.round(value*Math.max(1,210/peak))).toString(16).padStart(2,'0')).join('');};
const alpha = (color,opacity) => 'rgba('+rgb(color).join(',')+','+clamp(opacity)+')';
const noise = value => {const n=Math.sin(value*127.1+311.7)*43758.5453;return n-Math.floor(n);};

/** Start and duration are recording seconds. Zero duration disables that fade. */
export function textFadeOpacity(layer,milliseconds) {
  const seconds=Math.max(0,Number(milliseconds)||0);
  const fade=(start,duration)=>smooth((seconds/1000-Math.max(0,Number(start)||0))/duration);
  const fadeIn=Math.max(0,Number(layer.fadeInLength)||0),fadeOut=Math.max(0,Number(layer.fadeOutLength)||0);
  return (fadeIn?fade(layer.fadeInStart,fadeIn):1)*(fadeOut?1-fade(layer.fadeOutStart,fadeOut):1);
}

// Cache glyph masks, rather than measuring, allocating or reading pixels every frame.
// Each output canvas has its own cache, so export resolution cannot invalidate preview.
const caches = new WeakMap();
function geometry(context,layer,size) {
  let cache=caches.get(context);if(!cache){cache=new Map();caches.set(context,cache);}
  const document=context.canvas.ownerDocument||globalThis.document;
  const font=(layer.italic?'italic ':'')+(layer.bold?'700 ':'400 ')+size+'px "'+textFont(layer)+'"';
  const key=JSON.stringify([font,layer.text,!!layer.underline,layer.textAlign,document.fonts.check(font)]),id=layer.id||'text';
  const prior=cache.get(id);if(prior?.key===key)return prior;
  const lines=String(layer.text).split('\n'),measure=document.createElement('canvas').getContext('2d');measure.font=font;
  const metrics=lines.map(line=>measure.measureText(line)),padding=Math.ceil(size*.85),lineHeight=size*1.2;
  const textWidth=Math.max(1,...metrics.map(m=>Math.max(m.width,(m.actualBoundingBoxLeft||0)+(m.actualBoundingBoxRight||0))));
  const ascent=Math.max(size*.65,...metrics.map(m=>m.actualBoundingBoxAscent||0));
  const descent=Math.max(size*.15,...metrics.map(m=>m.actualBoundingBoxDescent||0));
  const textHeight=ascent+descent+(lines.length-1)*lineHeight;
  const width=Math.ceil(textWidth+padding*2),height=Math.ceil(textHeight+padding*2);
  const make=()=>{const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;return canvas;};
  const mask=make(),edge=make(),tube=make(),surface=make(),scratch=make(),frame=make();
  const x=width/2,top=(height-textHeight)/2,baseline=top+ascent,bottom=top+textHeight;
  function glyphs(ctx,stroke=false) {
    ctx.font=font;ctx.textAlign=layer.textAlign||'center';ctx.textBaseline='alphabetic';ctx.lineJoin='round';
    const origin=ctx.textAlign==='left'?x-textWidth/2:ctx.textAlign==='right'?x+textWidth/2:x;
    ctx.fillStyle=ctx.strokeStyle='#ffffff';
    lines.forEach((line,index)=>stroke?ctx.strokeText(line,origin,baseline+index*lineHeight):ctx.fillText(line,origin,baseline+index*lineHeight));
    if(layer.underline){ctx.lineWidth=size*.04;lines.forEach((line,index)=>{const y=baseline+index*lineHeight+descent*.6;ctx.beginPath();const left=ctx.textAlign==='left'?origin:ctx.textAlign==='right'?origin-metrics[index].width:origin-metrics[index].width/2;ctx.moveTo(left,y);ctx.lineTo(left+metrics[index].width,y);ctx.stroke();});}
  }
  glyphs(mask.getContext('2d'));
  const edgeContext=edge.getContext('2d');edgeContext.lineWidth=Math.max(1,size*.1);glyphs(edgeContext,true);
  edgeContext.globalCompositeOperation='destination-out';edgeContext.drawImage(mask,0,0);edgeContext.globalCompositeOperation='source-over';
  const tubeContext=tube.getContext('2d');tubeContext.lineWidth=Math.max(.7,size*.027);glyphs(tubeContext,true);
  const value={key,mask,edge,tube,surface,scratch,frame,width,height,x,top,bottom,baseline,ascent,descent,textWidth,textHeight,size,rows:lines.map((_,index)=>({top:top+index*lineHeight,bottom:top+index*lineHeight+ascent+descent})),fire:null,frost:null,conduction:null,arcs:new Map()};
  cache.delete(id);cache.set(id,value);
  // Old removed layers are evicted without retaining an unbounded set of canvases.
  while(cache.size>24)cache.delete(cache.keys().next().value);
  return value;
}
function clear(canvas) {
  const context=canvas.getContext('2d');context.setTransform(1,0,0,1,0,0);context.globalAlpha=1;
  context.globalCompositeOperation='source-over';context.shadowBlur=0;context.filter='none';context.clearRect(0,0,canvas.width,canvas.height);return context;
}
function tintMask(g,mask,paint) {
  const c=clear(g.scratch);c.fillStyle=paint;c.fillRect(0,0,g.width,g.height);
  c.globalCompositeOperation='destination-in';c.drawImage(mask,0,0);c.globalCompositeOperation='source-over';return g.scratch;
}
function drawTint(context,g,mask,color,opacity=1,blur=0,dx=0,dy=0) {
  const image=tintMask(g,mask,color);context.save();context.globalAlpha*=opacity;
  if(blur){context.shadowColor=color;context.shadowBlur=blur;}
  context.drawImage(image,dx,dy);context.restore();
}
function vertical(context,g,stops) {
  const gradient=context.createLinearGradient(0,g.top,0,g.bottom);
  stops.forEach(([at,color])=>gradient.addColorStop(at,color));return gradient;
}
function flowing(context,g,colors,time,period=8) {
  const span=Math.max(g.size*2,g.textWidth),start=g.x-g.textWidth/2-span+(time/period%1)*span;
  const gradient=context.createLinearGradient(start,g.top,start+span*3,g.bottom);
  for(let i=0;i<=9;i++)gradient.addColorStop(i/9,colors[i%3]);return gradient;
}
function sheen(context,g,time,colors,period=7,strength=.65) {
  const travel=g.textWidth+g.size*3,center=g.x-travel/2+(time/period%1)*travel,band=g.size*.9;
  const gradient=context.createLinearGradient(center-band,g.top,center+band,g.bottom);
  [[0,alpha(colors[0],0)],[.3,alpha(colors[0],strength*.45)],[.5,alpha(colors[1],strength)],[.62,alpha(colors[2],strength*.6)],[1,alpha(colors[2],0)]].forEach(([at,color])=>gradient.addColorStop(at,color));
  context.fillStyle=gradient;context.fillRect(0,0,g.width,g.height);
}
function facets(context,g,time,colors,ice=false) {
  const step=g.size*(ice?.48:.72),light=time*.5;
  for(let x=g.x-g.textWidth/2-g.size,index=0;x<g.x+g.textWidth/2+g.size;x+=step,index++){
    const middle=x+step*(.3+.45*noise(index+1)),tip=g.top+g.textHeight*(.15+.7*noise(index+9));
    const amount=.1+.18*(.5+.5*Math.sin(light+index*1.7));
    context.fillStyle=alpha(index%2?colors[1]:colors[2],amount);
    context.beginPath();context.moveTo(x,g.top-g.size*.1);context.lineTo(x+step*1.4,g.top-g.size*.1);context.lineTo(middle,tip);context.lineTo(x-step*.2,g.bottom+g.size*.1);context.closePath();context.fill();
    context.strokeStyle=alpha('#ffffff',ice?.18:.28);context.lineWidth=Math.max(.6,g.size*.012);
    context.beginPath();context.moveTo(x,g.top);context.lineTo(middle,tip);context.lineTo(x+step*.7,g.bottom);context.stroke();
  }
}
// One seamless turbulence tile is shared by all fire layers. Animation samples it
// analytically: seeking a recording frame never needs to simulate earlier frames.
let turbulence;
function turbulenceTile() {
  if(turbulence)return turbulence;
  turbulence=new Float32Array(256*256);
  for(let cells=4,weight=.5;cells<=64;cells*=2,weight*=.5){
    const lattice=Float32Array.from({length:cells*cells},(_,i)=>noise(i+cells*71));
    for(let y=0;y<256;y++){
      const py=y*cells/256,iy=Math.floor(py),fy=smooth(py-iy);
      for(let x=0;x<256;x++){
        const px=x*cells/256,ix=Math.floor(px),fx=smooth(px-ix);
        const a=lattice[iy*cells+ix],b=lattice[iy*cells+(ix+1)%cells];
        const c=lattice[((iy+1)%cells)*cells+ix],d=lattice[((iy+1)%cells)*cells+(ix+1)%cells];
        turbulence[y*256+x]+=((a+(b-a)*fx)*(1-fy)+(c+(d-c)*fx)*fy)*weight/.96875;
      }
    }
  }
  return turbulence;
}
function heatNoise(tile,x,y) {
  const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;
  const row=(iy&255)*256,next=((iy+1)&255)*256,left=ix&255,right=(ix+1)&255;
  return (tile[row+left]*(1-fx)+tile[row+right]*fx)*(1-fy)+(tile[next+left]*(1-fx)+tile[next+right]*fx)*fy;
}
function heatAt(f,x,y) {
  x=clamp(x,0,f.width-1);y=clamp(y,0,f.height-1);
  const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,right=Math.min(ix+1,f.width-1);
  const row=iy*f.width,next=Math.min(iy+1,f.height-1)*f.width;
  return (f.heat[row+ix]*(1-fx)+f.heat[row+right]*fx)*(1-fy)+(f.heat[next+ix]*(1-fx)+f.heat[next+right]*fx)*fy;
}
function fireField(g) {
  if(g.fire)return g.fire;
  // Bound the simulation surface; text itself is still drawn at full resolution.
  const scale=Math.min(1,96/g.size,960/g.width,256/g.height);
  const width=Math.max(2,Math.ceil(g.width*scale)),height=Math.max(2,Math.ceil(g.height*scale)),size=g.size*scale;
  const canvas=g.mask.ownerDocument.createElement('canvas');canvas.width=width;canvas.height=height;
  const context=canvas.getContext('2d',{willReadFrequently:true});context.drawImage(g.mask,0,0,width,height);
  const pixels=context.getImageData(0,0,width,height).data,heat=new Float32Array(width*height);
  const decay=Math.exp(-1/Math.max(1,size*.42));
  // Every part of the silhouette emits heat. Upward diffusion joins the small
  // sources into irregular sheets of flame instead of a row of flame icons.
  for(let y=height-1;y>=0;y--)for(let x=0;x<width;x++){
    const i=y*width+x,row=(y+1)*width;
    const below=y+1<height?heat[row+x]*.8+(heat[row+Math.max(0,x-1)]+heat[row+Math.min(width-1,x+1)])*.1:0;
    heat[i]=Math.max(pixels[i*4+3]/255,below*decay);
  }
  const active=[],reach=Math.ceil(size*.2);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const row=y*width;
    if(Math.max(heat[row+x],heat[row+Math.max(0,x-reach)],heat[row+Math.min(width-1,x+reach)])>.1)active.push(row+x);
  }
  const soot=g.mask.ownerDocument.createElement('canvas');soot.width=width;soot.height=height;
  const sootContext=soot.getContext('2d'),grain=sootContext.createImageData(width,height),tile=turbulenceTile();
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const i=(y*width+x)*4,value=70+heatNoise(tile,x/size*210,y/size*210)*165;
    grain.data[i]=grain.data[i+1]=grain.data[i+2]=value;grain.data[i+3]=255;
  }
  sootContext.putImageData(grain,0,0);
  g.fire={canvas,context,soot,width,height,size,heat,active:Uint32Array.from(active),image:context.createImageData(width,height),tile,paletteKey:null,palette:null,time:null};
  return g.fire;
}
function burning(g,time,colors) {
  const f=fireField(g),key=colors.join('|');
  if(f.paletteKey!==key){
    const channels=rgb(colors[0]),saturation=(Math.max(...channels)-Math.min(...channels))/255;
    const orange=mix('#ff710c',colors[0],saturation*.8);
    const stops=[[0,mix('#390704',colors[2],.08)],[.3,'#b92c06'],[.6,orange],[.82,mix('#ffbd39',colors[1],.14)],[1,mix('#fff4ca',colors[0],.2)]];
    f.palette=new Uint8ClampedArray(256*3);
    for(let i=0;i<256;i++){
      const heat=i/255,upper=stops.findIndex(([at])=>at>=heat),a=stops[Math.max(0,upper-1)],b=stops[upper];
      const value=rgb(mix(a[1],b[1],a[0]===b[0]?0:(heat-a[0])/(b[0]-a[0])));
      f.palette.set(value,i*3);
    }
    f.paletteKey=key;f.time=null;
  }
  if(f.time===time)return f;
  const pixels=f.image.data;pixels.fill(0);
  for(const index of f.active){
    const x=index%f.width,y=Math.floor(index/f.width),u=x/f.size*155,v=y/f.size*40+time*25;
    const swirl=heatNoise(f.tile,u*.43+91,v*.62),detail=heatNoise(f.tile,u+swirl*32,v+swirl*18);
    const source=heatAt(f,x+(swirl-.5)*f.size*.32,y+(detail-.5)*f.size*.07);
    // A narrow density boundary makes tongues with clear edges. Horizontal
    // turbulence is finer than vertical turbulence, stretching the rising tips.
    const density=source-.14-clamp((detail-.5)*1.8+.5)*.57;
    if(density<=0)continue;
    const heat=clamp(density*1.85);
    const at=index*4,color=Math.round(heat*255)*3;
    pixels[at]=f.palette[color];pixels[at+1]=f.palette[color+1];pixels[at+2]=f.palette[color+2];
    pixels[at+3]=255*smooth(density/.065)*smooth(source*1.7)*(.6+.4*heat);
  }
  f.context.putImageData(f.image,0,0);f.time=time;return f;
}
function fireRim(context,g,fire) {
  const rim=clear(g.scratch);rim.drawImage(fire.canvas,0,0,g.width,g.height);
  rim.globalCompositeOperation='destination-in';rim.drawImage(g.tube,0,0);rim.globalCompositeOperation='source-over';
  context.drawImage(g.scratch,0,0);
}
function conductorEdges(g) {
  if(g.conduction)return g.conduction;
  const pixels=g.mask.getContext('2d',{willReadFrequently:true}).getImageData(0,0,g.width,g.height).data;
  const step=Math.max(1,Math.round(g.size*.025));
  g.conduction=g.rows.map(row=>{
    const points=[];
    for(let y=Math.max(1,Math.floor(row.top)-1);y<Math.min(g.height-1,Math.ceil(row.bottom)+1);y+=step){
      for(let x=1;x<g.width-1;x+=step){
        const at=(y*g.width+x)*4+3;
        if(pixels[at]>128&&(pixels[at-4]<128||pixels[at+4]<128||pixels[at-g.width*4]<128||pixels[at+g.width*4]<128))points.push([x,y]);
      }
    }
    return points;
  });return g.conduction;
}
function forkedBolt(start,end,seed,amplitude) {
  let points=[start,end];
  for(let level=0;level<4;level++){
    const split=[points[0]];
    for(let index=0;index<points.length-1;index++){
      const a=points[index],b=points[index+1],dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy)||1;
      const offset=(noise(seed+level*193+index*17)-.5)*amplitude*2;
      split.push([(a[0]+b[0])/2-dy/length*offset,(a[1]+b[1])/2+dx/length*offset],b);
    }
    points=split;amplitude*=.48;
  }
  return points;
}
function electricalArc(g,edges,seed) {
  const start=edges[Math.floor(noise(seed+1)*edges.length)],direction=noise(seed+4)>.5?1:-1;
  const target=[start[0]+direction*g.size*(.45+.75*noise(seed+7)),start[1]+(noise(seed+12)-.5)*g.size*.7];
  let end=start,distance=Infinity;
  for(const point of edges){
    if(Math.hypot(point[0]-start[0],point[1]-start[1])<g.size*.25)continue;
    const d=(point[0]-target[0])**2+(point[1]-target[1])**2;
    if(d<distance){distance=d;end=point;}
  }
  if(end===start)return [];
  const points=forkedBolt(start,end,seed,g.size*.14),branches=[];
  for(let index=0;index<2;index++){
    const root=points[5+index*4],reach=g.size*(.15+.14*noise(seed+index+21));
    branches.push(forkedBolt(root,[root[0]+direction*reach,root[1]+(index?1:-1)*reach*.8],seed+index*43+81,reach*.22));
  }
  return [points,...branches];
}
function lightningArcs(context,g,time,colors) {
  const rows=conductorEdges(g),period=3.8;
  context.save();context.lineJoin='round';context.lineCap='round';
  for(let row=0;row<rows.length;row++)for(let lane=0;lane<2;lane++){
    const edges=rows[row];if(edges.length<2)continue;
    const clock=time+lane*period*.5+noise(row+2)*period,epoch=Math.floor(clock/period),age=clock-epoch*period;
    const strength=smooth(age/.2)*(1-smooth((age-.55)/1.15));if(strength<=0)continue;
    const key=row*2+lane;let event=g.arcs.get(key);
    if(event?.epoch!==epoch){event={epoch,paths:electricalArc(g,edges,epoch*109+row*37+lane*61+5)};g.arcs.set(key,event);}
    event.paths.forEach((points,index)=>{
      const amount=strength*(index?.42:1),width=Math.max(.5,g.size*.014)*(index?.65:1);
      context.beginPath();points.forEach(([x,y],i)=>i?context.lineTo(x,y):context.moveTo(x,y));
      // Wide low-energy corona, narrow coloured filament, then the white-hot core.
      context.strokeStyle=alpha(colors[2],amount*.24);context.lineWidth=width*5;context.shadowColor=colors[2];context.shadowBlur=g.size*.13;context.stroke();
      context.strokeStyle=alpha(mix(colors[0],'#9fbdff',.25),amount*.85);context.lineWidth=width*2;context.shadowBlur=g.size*.045;context.stroke();
      context.strokeStyle=alpha(mix(colors[0],'#ffffff',.86),amount);context.lineWidth=width;context.shadowBlur=0;context.stroke();
    });
  }
  context.restore();
}
function energy(context,g,time,colors) {
  context.save();context.lineCap='round';context.lineJoin='round';
  for(let row=0;row<3;row++){
    const cy=g.top+g.textHeight*(.25+row*.25),step=g.size*.12;
    context.strokeStyle=alpha(mix(colors[(row+1)%3],'#ffffff',.55),.3);
    context.lineWidth=Math.max(.6,g.size*.016);context.shadowBlur=g.size*.06;context.shadowColor=colors[1];context.beginPath();
    for(let x=g.x-g.textWidth/2,index=0;x<=g.x+g.textWidth/2;x+=step,index++){
      const dy=Math.sin(x/g.size*2.4+time*.55+row)*g.size*.12;
      index?context.lineTo(x,cy+dy):context.moveTo(x,cy+dy);
    }context.stroke();
  }context.restore();
}

// Slowly drifting condensation stays close to the glyphs, pooling underneath.
function frostFog(g,time,colors) {
  if(!g.frost){
    const scale=Math.min(1,64/g.size,640/g.width,192/g.height),width=Math.max(2,Math.ceil(g.width*scale)),height=Math.max(2,Math.ceil(g.height*scale)),size=g.size*scale;
    const canvas=g.mask.ownerDocument.createElement('canvas');canvas.width=width;canvas.height=height;
    const context=canvas.getContext('2d',{willReadFrequently:true});
    context.filter='blur('+Math.max(1,size*.13)+'px)';context.drawImage(g.mask,0,size*.05,width,height);
    context.filter='blur('+Math.max(1,size*.18)+'px)';context.drawImage(g.mask,0,size*.27,width,height);context.filter='none';
    const pixels=context.getImageData(0,0,width,height).data,mask=new Float32Array(width*height),active=[];
    for(let i=0;i<mask.length;i++){mask[i]=clamp(pixels[i*4+3]/255*3);if(mask[i]>.008)active.push(i);}
    g.frost={canvas,context,width,height,size,mask,active:Uint32Array.from(active),image:context.createImageData(width,height),tile:turbulenceTile()};
  }
  const f=g.frost,data=f.image.data,cold=rgb(mix(colors[2],'#9ddbf5',.78)),light=rgb(mix(colors[0],'#e5f9ff',.8));
  data.fill(0);
  for(const index of f.active){
    const x=index%f.width,y=Math.floor(index/f.width),u=x/f.size*105-time*8,v=y/f.size*82-time*3;
    const billow=heatNoise(f.tile,u*.6,v*.6),wisps=heatNoise(f.tile,u+billow*36,v-billow*24);
    const density=f.mask[index]*smooth((billow-.18)*2.5)*(.24+.76*wisps),i=index*4;
    data[i]=cold[0]+(light[0]-cold[0])*wisps;data[i+1]=cold[1]+(light[1]-cold[1])*wisps;data[i+2]=cold[2]+(light[2]-cold[2])*wisps;
    data[i+3]=255*density*.78;
  }
  f.context.putImageData(f.image,0,0);return f.canvas;
}
function neonPower(time) {
  const period=3.6,cycle=Math.floor(time/period),at=time-cycle*period;
  const failure=1.65+noise(cycle+144)*.3,recovery=failure+.38+noise(cycle+57)*.25;
  // Brief failed starts surround a longer outage; no frame-dependent random state.
  if(at>=failure&&at<recovery||at>=failure-.62&&at<failure-.43||at>=failure-.24&&at<failure-.08||at>=recovery+.18&&at<recovery+.34)return 0;
  return .88+.12*Math.sin(time*.9)**2;
}
const dimNeon=color=>mix(color,'#000000',.84);

/** A shared canvas painter owns preview and recording, with deterministic slow effects. */
function paintPlainText(destination,layer,width,height,milliseconds=0,cinematic,glyphs) {
  if(!layer.text)return;
  const fade=cinematic?.enabled===false?1:textFadeOpacity(layer,cinematic?.time??milliseconds);
  if(fade<=0)return;
  const rect=layer.rect,time=milliseconds/1000,size=Math.max(6,Number(layer.size)||48)*width/800;
  const g=glyphs||geometry(destination,layer,size),context=clear(g.frame),effect=layer.effect||'solid';
  const colors=[layer.color||'#ffffff',layer.color2||'#c6a46c',layer.color3||'#7895b2'],outline=layer.outlineColor||'#111111';
  const breath=.5+.5*Math.sin(time*Math.PI*2/6);
  const x=(rect.x+rect.width/2)*width,y=(rect.y+rect.height/2)*height;
  context.save();

  const fire=effect==='flame'?burning(g,time,colors):null;
  const fog=effect==='frost'?frostFog(g,time,colors):null;
  const power=effect==='neon'?neonPower(time):1,neonColor=emissive(colors[0],'#b5c8e6');
  if(fog)context.drawImage(fog,0,0,g.width,g.height);
  const luminous=['neon','frost','arcane'].includes(effect)&&power>0;
  const glow=effect==='frost'?mix(colors[0],'#9ddeff',.7):effect==='neon'?neonColor:colors[0];
  if(luminous)drawTint(context,g,g.mask,glow,effect==='neon'?.7*power:effect==='frost'?.5+.06*breath:.28+.08*breath,size*(effect==='neon'?.24:.14));
  if(layer.outline&&effect!=='wave'){
    // An emissive border stays luminous even when its chosen base color is black.
    const border=effect==='neon'?(power?emissive(outline,neonColor):dimNeon(neonColor)):outline;
    drawTint(context,g,g.edge,border,1,effect==='neon'&&power?size*.16*power:0);
  }
  if(fire)context.drawImage(fire.canvas,0,0,g.width,g.height);
  const surface=clear(g.surface);
  let fill=colors[0];
  if(effect==='gradient'||effect==='arcane')fill=flowing(surface,g,colors,time,effect==='arcane'?11:8);
  if(fire)fill=vertical(surface,g,[[0,mix(colors[0],'#38150c',.94)],[.28,mix(colors[1],'#b4783d',.75)],[.45,'#492419'],[.75,mix(colors[0],'#26100c',.94)],[1,'#9b4a1c']]);
  if(effect==='lightning')fill=vertical(surface,g,[[0,mix(colors[0],'#131b2a',.83)],[.28,mix(colors[0],'#6f8095',.4)],[.46,mix(colors[2],'#182131',.65)],[1,mix(colors[0],'#374151',.65)]]);
  if(effect==='frost')fill=vertical(surface,g,[[0,'#f0faff'],[.36,mix(colors[0],'#b5e8ff',.5)],[.5,mix(colors[0],'#397393',.72)],[.62,mix(colors[0],'#abd8ea',.4)],[1,mix(colors[0],'#ddf9ff',.65)]]);
  if(effect==='prism')fill=vertical(surface,g,[[0,mix(colors[0],'#ffffff',.7)],[.42,colors[0]],[.5,mix(colors[2],'#131925',.3)],[.64,mix(colors[0],'#ffffff',.7)],[1,colors[1]]]);
  if(effect==='neon')fill=power?mix(neonColor,'#0b101b',.42):dimNeon(neonColor);
  surface.fillStyle=fill;surface.fillRect(0,0,g.width,g.height);
  if(fire){surface.globalCompositeOperation='multiply';surface.drawImage(fire.soot,0,0,g.width,g.height);surface.globalCompositeOperation='source-over';}
  if(effect==='frost'){facets(surface,g,time,[colors[0],'#d6f4ff','#8fc7e6'],true);sheen(surface,g,time,['#bbebff','#ffffff','#c8edff'],10,.5);}
  if(effect==='arcane'){energy(surface,g,time,colors);sheen(surface,g,time,colors,9,.38);}
  if(effect==='prism'){facets(surface,g,time,colors);sheen(surface,g,time,[colors[1],'#ffffff',colors[2]],10,.8);}
  if(effect==='shimmer')sheen(surface,g,time,colors,6.5,.95);
  surface.globalCompositeOperation='destination-in';surface.drawImage(g.mask,0,0);surface.globalCompositeOperation='source-over';
  context.save();if(effect==='frost')context.globalAlpha*=.9;
  if(effect==='wave'){
    if(layer.outline){surface.globalCompositeOperation='destination-over';surface.drawImage(tintMask(g,g.edge,outline),0,0);surface.globalCompositeOperation='source-over';}
    const strip=Math.max(2,Math.ceil(size*.08));
    for(let sx=0;sx<g.width;sx+=strip){const sw=Math.min(strip,g.width-sx);context.drawImage(g.surface,sx,0,sw,g.height,sx,Math.sin(time*.9-sx/size*.55)*size*.06,sw,g.height);}
  }else context.drawImage(g.surface,0,0);
  context.restore();
  if(effect==='neon'){
    const tubeColor=power?mix(neonColor,'#ffffff',.8):dimNeon(neonColor);
    drawTint(context,g,g.tube,tubeColor,power||1,power?size*.065*power:0);
  }
  if(fire)fireRim(context,g,fire);
  if(effect==='lightning'){
    drawTint(context,g,g.tube,mix(colors[0],colors[2],.35),.2+.06*breath);
    lightningArcs(context,g,time,colors);
  }
  if(effect==='prism'){drawTint(context,g,g.tube,colors[1],.48,0,-size*.025,-size*.012);drawTint(context,g,g.tube,colors[2],.48,0,size*.025,size*.012);}
  if(fog){
    context.save();context.globalAlpha=.2;context.drawImage(fog,0,0,g.width,g.height);context.restore();
    drawTint(context,g,g.tube,mix(colors[0],'#dcf8ff',.75),.6);
  }
  if(effect==='arcane')drawTint(context,g,g.tube,flowing(context,g,[colors[1],mix(colors[0],'#ffffff',.65),colors[2]],time,11),.6);
  context.restore();
  destination.save();destination.globalAlpha*=fade;destination.translate(x,y);destination.rotate((Number(layer.rotation)||0)*Math.PI/180);destination.drawImage(g.frame,-g.width/2,-g.height/2);destination.restore();
}

// Lay out styled spans on shared baselines, then use the same effect painter for
// every span in both the viewport and export. No HTML screenshots or font fallback.
const richLayouts=new WeakMap();
function richLayout(context,layer,width){
  let cache=richLayouts.get(context);if(!cache){cache=new Map();richLayouts.set(context,cache);}
  const fonts=textFonts(layer),key=JSON.stringify([layer.text,layer.runs,width,layer.font,layer.size,layer.bold,layer.italic,layer.underline,layer.outline,layer.outlineColor,layer.color,layer.color2,layer.color3,layer.effect,layer.textAlign,fonts.map(font=>document.fonts.check(font))]);
  const previous=cache.get(layer.id);if(previous?.key===key)return previous;
  const rows=[{parts:[],width:0,ascent:0,descent:0,size:0}];
  let index=0;
  for(const run of styledTextRuns(layer)){
    const lines=run.text.split('\n');
    lines.forEach((text,line)=>{
      if(line)rows.push({parts:[],width:0,ascent:0,descent:0,size:0});
      const row=rows.at(-1),size=Math.max(6,Number(run.size)||48)*width/800;
      row.size=Math.max(row.size,size);row.ascent=Math.max(row.ascent,size*.65);row.descent=Math.max(row.descent,size*.15);
      if(!text)return;
      const part={...run,id:layer.id+':span:'+index++,text,textAlign:'center',rotation:0,runs:undefined};
      const g=geometry(context,part,size);
      row.parts.push({layer:part,g,left:row.width});row.width+=g.textWidth;
      row.ascent=Math.max(row.ascent,g.ascent);row.descent=Math.max(row.descent,g.descent);
    });
  }
  const textWidth=Math.max(1,...rows.map(row=>row.width)),parts=[];
  let textHeight=0;
  rows.forEach((row,i)=>{
    const left=layer.textAlign==='left'?0:layer.textAlign==='right'?textWidth-row.width:(textWidth-row.width)/2;
    const baseline=textHeight+row.ascent;
    for(const part of row.parts)parts.push({...part,x:left+part.left+part.g.textWidth/2,y:baseline+part.g.height/2-part.g.baseline});
    textHeight+=row.ascent+row.descent+(i<rows.length-1?row.size*.4:0);
  });
  const layout={key,parts,textWidth,textHeight};cache.set(layer.id,layout);
  while(cache.size>24)cache.delete(cache.keys().next().value);
  return layout;
}
export function paintShowcaseText(destination,layer,width,height,milliseconds=0,cinematic){
  if(!layer.runs?.length)return paintPlainText(destination,layer,width,height,milliseconds,cinematic);
  const fade=cinematic?.enabled===false?1:textFadeOpacity(layer,cinematic?.time??milliseconds);if(fade<=0)return;
  const layout=richLayout(destination,layer,width),rect=layer.rect;
  destination.save();destination.globalAlpha*=fade;
  destination.translate((rect.x+rect.width/2)*width,(rect.y+rect.height/2)*height);
  destination.rotate((Number(layer.rotation)||0)*Math.PI/180);
  destination.translate(-layout.textWidth/2,-layout.textHeight/2);
  for(const part of layout.parts)paintPlainText(destination,{...part.layer,rect:{x:part.x/width,y:part.y/height,width:0,height:0}},width,height,milliseconds,{enabled:false},part.g);
  destination.restore();
}

/** Place the visible text, including its current rotation, against the crop. */
export async function alignShowcaseText(layer,horizontal,vertical,crop,width,height){
  await Promise.all(textFonts(layer).map(font=>document.fonts.load(font)));
  const context=document.createElement('canvas').getContext('2d'),size=Math.max(6,Number(layer.size)||48)*width/800;
  const g=layer.runs?.length?richLayout(context,layer,width):geometry(context,layer,size),angle=(layer.rotation||0)*Math.PI/180,c=Math.abs(Math.cos(angle)),s=Math.abs(Math.sin(angle));
  const halfWidth=(g.textWidth*c+g.textHeight*s)/2/width,halfHeight=(g.textWidth*s+g.textHeight*c)/2/height;
  const frame=crop||{x:0,y:0,width:1,height:1},margin=.015;
  const x=horizontal===0?frame.x+halfWidth+frame.width*margin:horizontal===2?frame.x+frame.width-halfWidth-frame.width*margin:frame.x+frame.width/2;
  const y=vertical===0?frame.y+halfHeight+frame.height*margin:vertical===2?frame.y+frame.height-halfHeight-frame.height*margin:frame.y+frame.height/2;
  return {...layer.rect,x:x-layer.rect.width/2,y:y-layer.rect.height/2};
}
