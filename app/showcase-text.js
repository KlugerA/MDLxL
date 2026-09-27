export const SHOWCASE_FONTS = [
  {id:'cinzeldecorative',name:'Cinzel Decorative',family:'Showcase Cinzel'},
  {id:'medievalsharp',name:'MedievalSharp',family:'Showcase Medieval'},
  {id:'uncialantiqua',name:'Uncial Antiqua',family:'Showcase Uncial'},
  {id:'pirataone',name:'Pirata One',family:'Showcase Pirata'},
  {id:'almendra',name:'Almendra',family:'Showcase Almendra'},
  {id:'imfellenglish',name:'IM Fell English',family:'Showcase Fell'},
  {id:'lato',name:'Lato',family:'Showcase Lato'},
  {id:'lora',name:'Lora',family:'Showcase Lora'},
  {id:'opensans',name:'Open Sans',family:'Showcase Open Sans'},
];
export const TEXT_EFFECTS = [
  ['solid','Solid'],['neon','Neon'],['gradient','Gradient'],['flame','Flame'],
  ['frost','Frost'],['arcane','Arcane'],['lightning','Lightning'],
  ['prism','Prism'],['wave','Wave'],['shimmer','Shimmer'],['ghost','Ghost'],
];
export const textFont = layer => SHOWCASE_FONTS.find(font=>font.id===layer.font)?.family || SHOWCASE_FONTS[0].family;
const rgb = color => [1,3,5].map(index=>parseInt(color.slice(index,index+2),16)||0);
const tint = (color,amount) => {const values=rgb(color);return 'rgb('+values.map(value=>Math.round(value+(255-value)*amount)).join(',')+')';};
const hue = color => {
  const [r,g,b]=rgb(color).map(value=>value/255),max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;
  if(!d)return 0;
  return ((max===r?(g-b)/d:max===g?2+(b-r)/d:4+(r-g)/d)*60+360)%360;
};
/** Canvas effects use the recording clock, so preview and GIF share the same animation. */
export function paintShowcaseText(context,layer,width,height,milliseconds=0) {
  if(!layer.text)return;
  const rect=layer.rect, t=milliseconds/1000, scale=width/800, size=Math.max(6,Number(layer.size)||48)*scale;
  const color=layer.color||'#ffffff',effect=layer.effect||'solid',lines=String(layer.text).split('\n');
  const x=(rect.x+rect.width/2)*width,y=(rect.y+rect.height/2)*height,lineHeight=size*1.18;
  context.save();
  context.font=(layer.italic?'italic ':'')+(layer.bold?'bold ':'')+size+'px "'+textFont(layer)+'"';
  context.textAlign='center';context.textBaseline='middle';context.lineJoin='round';
  context.fillStyle=color;context.strokeStyle='#111111';context.lineWidth=Math.max(1,size*.055);
  const pulse=.5+.5*Math.sin(t*Math.PI*2),baseHue=hue(color);
  if(effect==='neon'){context.shadowColor=color;context.shadowBlur=size*(.15+.3*pulse);context.fillStyle=tint(color,.25+.45*pulse);}
  if(effect==='flame'){context.shadowColor='#ff5c17';context.shadowBlur=size*(.25+.1*Math.sin(t*11));}
  if(effect==='frost'){context.shadowColor=tint(color,.6);context.shadowBlur=size*(.15+.1*pulse);}
  if(effect==='arcane'){context.shadowColor=color;context.shadowBlur=size*(.22+.15*pulse);}
  if(effect==='lightning'){context.shadowColor=color;context.shadowBlur=size*.32;context.fillStyle=tint(color,.45+.5*Math.pow(pulse,6));}
  function fillLine(text,cy) {
    const measured=context.measureText(text).width;
    if(['gradient','flame','frost','prism','shimmer'].includes(effect)){
      const gradient=context.createLinearGradient(x-measured/2,cy-size/2,x+measured/2,cy+size/2);
      for(let i=0;i<=4;i++){
        const phase=t*.4+i/4;
        const shade=effect==='prism'?'hsl('+((baseHue+phase*360)%360)+',90%,68%)':
          effect==='flame'?(i<2?'#fff4ba':i<4?'#ff942b':color):
          effect==='shimmer'?tint(color,Math.pow(.5+.5*Math.sin(phase*6.28),8)):
          tint(color,.2+.65*(.5+.5*Math.sin(phase*6.28)));
        gradient.addColorStop(i/4,shade);
      }
      context.fillStyle=gradient;
    }
    if(effect==='ghost'){
      for(let i=3;i>0;i--){context.save();context.globalAlpha*=.12/i;context.fillText(text,x+Math.sin(t*2-i*.4)*size*.15*i,cy+Math.cos(t*2-i*.4)*size*.035*i);context.restore();}
    }
    if(layer.outline&&effect!=='wave')context.strokeText(text,x,cy);
    if(effect==='wave'){
      const glyphs=Array.from(text),advances=glyphs.map(glyph=>context.measureText(glyph).width);
      let left=x-advances.reduce((sum,value)=>sum+value,0)/2;
      glyphs.forEach((glyph,index)=>{const gx=left+advances[index]/2,gy=cy+Math.sin(t*4-index*.55)*size*.12;if(layer.outline)context.strokeText(glyph,gx,gy);context.fillText(glyph,gx,gy);left+=advances[index];});
    } else context.fillText(text,x,cy);
    if(layer.underline){context.save();context.shadowBlur=0;context.strokeStyle=color;context.lineWidth=Math.max(1,size*.045);context.beginPath();context.moveTo(x-measured/2,cy+size*.52);context.lineTo(x+measured/2,cy+size*.52);context.stroke();context.restore();}
    if(effect==='lightning'){
      context.save();context.globalAlpha*=.25+.6*Math.pow(pulse,5);context.strokeStyle=tint(color,.8);context.lineWidth=Math.max(1,size*.025);context.beginPath();
      for(let i=0;i<=20;i++){const px=x-measured/2+measured*i/20,py=cy+size*.6+Math.sin(i*7+t*18)*size*.055;i?context.lineTo(px,py):context.moveTo(px,py);}context.stroke();context.restore();
    }
    if(effect==='frost'||effect==='arcane'){
      context.save();context.shadowBlur=size*.1;context.strokeStyle=tint(color,.8);context.lineWidth=Math.max(1,scale);
      for(let i=0;i<7;i++){
        const phase=t*(effect==='frost'?.35:.6)+i*.79,px=x+Math.sin(phase*1.7)*measured*.55,py=cy+Math.cos(phase*2.1)*size*.7;
        context.globalAlpha=(layer.opacity??1)*(.3+.6*(.5+.5*Math.sin(phase*3)));const arm=scale*(2+2*pulse);
        context.beginPath();context.moveTo(px-arm,py);context.lineTo(px+arm,py);context.moveTo(px,py-arm);context.lineTo(px,py+arm);context.stroke();
      }context.restore();
    }
  }
  lines.forEach((line,index)=>fillLine(line,y+(index-(lines.length-1)/2)*lineHeight));
  context.restore();
}
