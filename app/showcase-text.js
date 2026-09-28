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
];
export const TEXT_EFFECTS = [
  ['solid','Solid'],['gradient','Gradient'],['neon','Neon'],['flame','Flame'],
  ['frost','Frost'],['arcane','Arcane'],['lightning','Lightning'],
  ['prism','Prism'],['wave','Wave'],['shimmer','Shimmer'],['ghost','Ghost'],
];
export const textFont = layer => SHOWCASE_FONTS.find(font=>font.id===layer.font)?.family || SHOWCASE_FONTS[0].family;
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
  const key=JSON.stringify([font,layer.text,!!layer.underline,document.fonts.check(font)]),id=layer.id||'text';
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
    ctx.font=font;ctx.textAlign='center';ctx.textBaseline='alphabetic';ctx.lineJoin='round';
    ctx.fillStyle=ctx.strokeStyle='#ffffff';
    lines.forEach((line,index)=>stroke?ctx.strokeText(line,x,baseline+index*lineHeight):ctx.fillText(line,x,baseline+index*lineHeight));
    if(layer.underline){ctx.lineWidth=size*.04;lines.forEach((line,index)=>{const y=baseline+index*lineHeight+descent*.6;ctx.beginPath();ctx.moveTo(x-metrics[index].width/2,y);ctx.lineTo(x+metrics[index].width/2,y);ctx.stroke();});}
  }
  glyphs(mask.getContext('2d'));
  const edgeContext=edge.getContext('2d');edgeContext.lineWidth=Math.max(1,size*.1);glyphs(edgeContext,true);
  edgeContext.globalCompositeOperation='destination-out';edgeContext.drawImage(mask,0,0);edgeContext.globalCompositeOperation='source-over';
  const tubeContext=tube.getContext('2d');tubeContext.lineWidth=Math.max(.7,size*.027);glyphs(tubeContext,true);
  const value={key,mask,edge,tube,surface,scratch,frame,width,height,x,top,bottom,textWidth,textHeight,size,rows:lines.map((_,index)=>({top:top+index*lineHeight,bottom:top+index*lineHeight+ascent+descent})),flames:null};
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
function glyphTops(g) {
  if(!g.flames){
    const data=g.mask.getContext('2d',{willReadFrequently:true}).getImageData(0,0,g.width,g.height).data,points=[];
    for(let x=Math.floor(g.x-g.textWidth/2+g.size*.1);x<g.x+g.textWidth/2;x+=Math.max(3,Math.round(g.size*.26))){
      for(const row of g.rows)for(let y=Math.floor(row.top);y<row.bottom;y++)if(data[(y*g.width+x)*4+3]>170){points.push([x,y]);break;}
    }g.flames=points;
  }
  return g.flames;
}
function flameTips(context,g,time,main,accent) {
  glyphTops(g).forEach(([x,y],index)=>{
    const phase=index*1.93,breath=.5+.5*Math.sin(time*1.15+phase),height=g.size*(.18+.22*breath),half=g.size*(.045+.025*noise(index)),bend=Math.sin(time*.85+phase)*g.size*.07;
    const heat=mix(main,'#f77935',.74),core=mix(accent,'#fff0b6',.65),gradient=context.createLinearGradient(x,y,x+bend,y-height);
    gradient.addColorStop(0,alpha(heat,.72));gradient.addColorStop(.45,alpha(core,.6));gradient.addColorStop(1,alpha(heat,0));
    context.save();context.fillStyle=gradient;context.shadowColor=heat;context.shadowBlur=g.size*.055;
    context.beginPath();context.moveTo(x-half,y+g.size*.05);
    context.bezierCurveTo(x-half*1.7,y-height*.32,x+bend-half,y-height*.67,x+bend,y-height);
    context.bezierCurveTo(x+bend+half*.4,y-height*.58,x+half*1.6,y-height*.2,x+half,y+g.size*.05);
    context.closePath();context.fill();context.restore();
  });
}

function electricTrace(context,g,time,colors) {
  const center=g.x-g.textWidth/2-g.size+(time/7%1)*(g.textWidth+g.size*2),reach=g.size*.85;
  const points=glyphTops(g).filter(([x])=>Math.abs(x-center)<reach);
  if(points.length<2)return;
  const light=mix(colors[0],'#ffffff',.8),gradient=context.createLinearGradient(center-reach,0,center+reach,0);
  gradient.addColorStop(0,alpha(light,0));gradient.addColorStop(.5,alpha(light,.9));gradient.addColorStop(1,alpha(light,0));
  context.save();context.strokeStyle=gradient;context.lineWidth=Math.max(.65,g.size*.018);context.lineJoin='round';
  context.shadowColor=colors[0];context.shadowBlur=g.size*.07;
  for(const row of g.rows){
    const contour=points.filter(([,y])=>y>=row.top-1&&y<row.bottom);if(contour.length<2)continue;
    context.beginPath();contour.forEach(([x,y],index)=>{const lift=g.size*(.045+.045*noise(index+4));index?context.lineTo(x,y-lift):context.moveTo(x,y-lift);});context.stroke();
  }
  context.restore();
}
function energy(context,g,time,colors,lightning) {
  const breath=.5+.5*Math.sin(time*(lightning?1.05:.7));
  context.save();context.lineCap='round';context.lineJoin='round';
  for(let row=0;row<(lightning?2:3);row++){
    const cy=g.top+g.textHeight*(.25+row*(lightning?.45:.25)),step=g.size*(lightning?.14:.12);
    context.strokeStyle=alpha(mix(colors[(row+1)%3],'#ffffff',.55),lightning?.2+.65*Math.pow(breath,3):.3);
    context.lineWidth=Math.max(.6,g.size*(lightning?.022:.016));context.shadowBlur=g.size*.06;context.shadowColor=colors[1];context.beginPath();
    for(let x=g.x-g.textWidth/2,index=0;x<=g.x+g.textWidth/2;x+=step,index++){
      const dy=lightning?(noise(index+row*41)-.5)*g.size*.26+Math.sin(time*.6+index)*g.size*.025:Math.sin(x/g.size*2.4+time*.55+row)*g.size*.12;
      index?context.lineTo(x,cy+dy):context.moveTo(x,cy+dy);
    }context.stroke();
  }context.restore();
}

/** A shared canvas painter owns preview and recording, with deterministic slow effects. */
export function paintShowcaseText(destination,layer,width,height,milliseconds=0,cinematic) {
  if(!layer.text)return;
  const fade=cinematic?.enabled===false?1:textFadeOpacity(layer,cinematic?.time??milliseconds);
  if(fade<=0)return;
  const rect=layer.rect,time=milliseconds/1000,size=Math.max(6,Number(layer.size)||48)*width/800;
  const g=geometry(destination,layer,size),context=clear(g.frame),effect=layer.effect||'solid';
  const colors=[layer.color||'#ffffff',layer.color2||'#c6a46c',layer.color3||'#7895b2'],outline=layer.outlineColor||'#111111';
  const breath=.5+.5*Math.sin(time*Math.PI*2/6);
  const x=(rect.x+rect.width/2)*width,y=(rect.y+rect.height/2)*height;
  context.save();

  // Effects behind the glyph silhouette cannot cover the letter interiors.
  if(effect==='ghost'){
    const drift=Math.sin(time*.65)*size*.06;
    drawTint(context,g,g.mask,colors[2],.3,size*.06,-size*.22+drift,-size*.1);
    drawTint(context,g,g.mask,colors[1],.38,size*.045,size*.17+drift,-size*.055);
  }
  if(effect==='flame')flameTips(context,g,time,colors[0],colors[1]);
  const luminous=['neon','frost','arcane','lightning'].includes(effect);
  const glow=effect==='frost'?mix(colors[0],'#9ddeff',.7):colors[0];
  if(luminous)drawTint(context,g,g.mask,glow,effect==='neon'?.55+.1*breath:effect==='frost'?.44+.06*breath:.28+.08*breath,size*(effect==='neon'?.24:.14));
  if(layer.outline&&effect!=='wave'){
    // An emissive border stays luminous even when its chosen base color is black.
    const border=effect==='neon'?emissive(outline,colors[0]):effect==='lightning'?mix(outline,colors[0],.5):outline;
    drawTint(context,g,g.edge,border,1,effect==='neon'?size*.16:0);
  }
  const surface=clear(g.surface);
  let fill=colors[0];
  if(effect==='gradient'||effect==='arcane')fill=flowing(surface,g,colors,time,effect==='arcane'?11:8);
  if(effect==='flame')fill=vertical(surface,g,[[0,mix(colors[0],'#ffe6b5',.6)],[.55,colors[0]],[1,mix(colors[0],'#b85b2b',.35)]]);
  if(effect==='frost')fill=vertical(surface,g,[[0,'#f0faff'],[.36,mix(colors[0],'#b5e8ff',.5)],[.5,mix(colors[0],'#397393',.72)],[.62,mix(colors[0],'#abd8ea',.4)],[1,mix(colors[0],'#ddf9ff',.65)]]);
  if(effect==='prism')fill=vertical(surface,g,[[0,mix(colors[0],'#ffffff',.7)],[.42,colors[0]],[.5,mix(colors[2],'#131925',.3)],[.64,mix(colors[0],'#ffffff',.7)],[1,colors[1]]]);
  if(effect==='neon')fill=mix(colors[0],'#0b101b',.42);
  surface.fillStyle=fill;surface.fillRect(0,0,g.width,g.height);
  if(effect==='frost'){facets(surface,g,time,[colors[0],'#d6f4ff','#8fc7e6'],true);sheen(surface,g,time,['#bbebff','#ffffff','#c8edff'],10,.5);}
  if(effect==='arcane'){energy(surface,g,time,colors,false);sheen(surface,g,time,colors,9,.38);}
  if(effect==='lightning')energy(surface,g,time,colors,true);
  if(effect==='prism'){facets(surface,g,time,colors);sheen(surface,g,time,[colors[1],'#ffffff',colors[2]],10,.8);}
  if(effect==='shimmer')sheen(surface,g,time,colors,6.5,.95);
  surface.globalCompositeOperation='destination-in';surface.drawImage(g.mask,0,0);surface.globalCompositeOperation='source-over';
  context.save();if(effect==='ghost')context.globalAlpha*=.7+.12*breath;if(effect==='frost')context.globalAlpha*=.9;
  if(effect==='wave'){
    if(layer.outline){surface.globalCompositeOperation='destination-over';surface.drawImage(tintMask(g,g.edge,outline),0,0);surface.globalCompositeOperation='source-over';}
    const strip=Math.max(2,Math.ceil(size*.08));
    for(let sx=0;sx<g.width;sx+=strip){const sw=Math.min(strip,g.width-sx);context.drawImage(g.surface,sx,0,sw,g.height,sx,Math.sin(time*.9-sx/size*.55)*size*.06,sw,g.height);}
  }else context.drawImage(g.surface,0,0);
  context.restore();
  if(effect==='neon'){
    const tubeColor=mix(colors[0],'#ffffff',.8);
    drawTint(context,g,g.tube,tubeColor,.85+.12*breath,size*.065);
  }
  if(effect==='lightning')electricTrace(context,g,time,colors);
  if(effect==='prism'){drawTint(context,g,g.tube,colors[1],.48,0,-size*.025,-size*.012);drawTint(context,g,g.tube,colors[2],.48,0,size*.025,size*.012);}
  if(effect==='frost')drawTint(context,g,g.tube,mix(colors[0],'#dcf8ff',.75),.4);
  if(effect==='arcane')drawTint(context,g,g.tube,flowing(context,g,[colors[1],mix(colors[0],'#ffffff',.65),colors[2]],time,11),.6);
  context.restore();
  destination.save();destination.globalAlpha*=fade;destination.translate(x,y);destination.rotate((Number(layer.rotation)||0)*Math.PI/180);destination.drawImage(g.frame,-g.width/2,-g.height/2);destination.restore();
}
