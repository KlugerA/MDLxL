// Run after rebuilding dist: node test/appearance-contrast.electron.cjs
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {_electron}=require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');
const {buildSync}=require(path.resolve('node_modules/esbuild'));
(async()=>{
 const root=process.cwd(),out=path.join(root,'out/ui-audit');fs.mkdirSync(out,{recursive:true});
 const profile=path.join(out,'profile-'+Date.now());fs.mkdirSync(profile);
 fs.writeFileSync(path.join(profile,'settings.json'),JSON.stringify({preferences:{rendererRevision:3}}));
 const app=await _electron.launch({executablePath:path.join(root,'node_modules/electron/dist/electron.exe'),args:['--disable-backgrounding-occluded-windows',root,path.join(root,'fixtures/demo.mdx')],env:{...process.env,MDLVIS_HEADLESS:'1',MDLXL_PROFILE:profile},timeout:60000});
 const errors=[],report={contrast:[],untranslated:{},screens:0};
 try {
  const page=await app.firstWindow();page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message));
  await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.webContents.setBackgroundThrottling(false);w.setPosition(-3000,0);w.showInactive();});
  await page.locator('.classic-app').waitFor();await page.getByLabel('Select geoset 0',{exact:true}).waitFor();
  const bundle=buildSync({stdin:{contents:"export {translate} from './src/localization.js'; export {applyApplicationTheme} from './app/theme.js'; export {default as themes} from './src/application-themes.json';",resolveDir:root},bundle:true,format:'iife',globalName:'uiAudit',write:false}).outputFiles[0].text;
  await page.evaluate(bundle);
  await page.evaluate(()=>{
   window.auditText=new Set();
   window.scanUI=()=>{
    const color=s=>{const v=s.match(/[\d.]+/g)?.map(Number)||[0,0,0];return [...v.slice(0,3).map(n=>s.startsWith('color(srgb ')?n*255:n),v[3]??1];};
    const over=(a,b)=>a.slice(0,3).map((v,i)=>v*a[3]+b[i]*(1-a[3]));
    const lum=c=>c.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);
    const failures=[];
    for(const el of document.querySelectorAll('body *')){
     if(el.closest('svg,canvas,[translate=no],script,style')||!el.checkVisibility({checkOpacity:true,checkVisibilityCSS:true}))continue;
     const text=[...el.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent).join('').trim();
     for(const value of [text,...['title','aria-label','placeholder','label'].map(n=>el.getAttribute(n))])if(value&&/[A-Za-z]{2}/.test(value))auditText.add(value);
     if(!/[\p{L}\d]/u.test(text)||el.tagName==='OPTION'||el.tagName==='OPTGROUP')continue;
     const cs=getComputedStyle(el);if(cs.backgroundClip==='text'||el.closest('.showcase-effect-tile,.showcase-text-style .outline,.pressed-keys-tool,.module-icon-badge'))continue;
     let bg=[255,255,255];const chain=[];for(let p=el;p;p=p.parentElement)chain.push(p);for(const p of chain.reverse())bg=over(color(getComputedStyle(p).backgroundColor),bg);
     const fg=over(color(cs.color),bg),a=lum(fg),b=lum(bg),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
     if(ratio<4.5)failures.push({text:text.slice(0,70),tag:el.tagName,class:el.className,fg:cs.color,bg,ratio:Math.round(ratio*100)/100});
    }
    return failures;
   };
  });
  const menu=id=>app.evaluate(({BrowserWindow},id)=>BrowserWindow.getAllWindows()[0].webContents.send('menu',id),id);
  const themes=await page.evaluate(()=>Object.keys(uiAudit.themes));
  async function scan(screen){for(const theme of themes){await page.evaluate(theme=>uiAudit.applyApplicationTheme({theme}),theme);const failed=await page.evaluate(()=>scanUI());if(failed.length)report.contrast.push({screen,theme,failed});report.screens++;}}
  await page.locator('[data-warmkey="animation"]').click();await page.getByRole('button',{name:'Animations',exact:true}).click();await page.locator('.animation-controller').waitFor();await scan('animation');
  // Check native popup items even while the OS popup itself is closed.
  for(const theme of themes){await page.evaluate(theme=>uiAudit.applyApplicationTheme({theme}),theme);const state=await page.locator('.ac-sequence-combo option').first().evaluate(el=>({fg:getComputedStyle(el).color,bg:getComputedStyle(el).backgroundColor,text:getComputedStyle(document.documentElement).getPropertyValue('--ui-text')}));assert.notEqual(state.fg,'rgb(0, 0, 0)');}
  await menu('appearanceSettings');await page.getByRole('dialog',{name:'Settings'}).waitFor();await scan('settings');await page.evaluate(()=>auditText.clear());await page.getByRole('button',{name:'Close Settings',exact:true}).click();
  for(const kind of ['Materials','Textures','Nodes','Geosets','GeosetAnims','Sequences','TextureAnims','GlobalSequences']){await menu(kind);await page.locator('.re-window').waitFor();await scan(kind);await page.locator('.re-caption-close').click();}
  await page.locator('[data-warmkey="paint"]').click();await page.locator('.paint-workspace').waitFor();await scan('paint');
  await page.getByRole('button',{name:'Showcase',exact:true}).click();await page.locator('.showcase-sidebar').waitFor();await scan('showcase');
  const scope=page.locator('.showcase-sidebar');
  await scope.locator('.showcase-layer-tools').last().getByRole('button',{name:'Add',exact:true}).click();await page.getByLabel('Text content',{exact:true}).waitFor();
  await page.locator('.showcase-text-fades').evaluate(el=>el.open=true);await page.locator('.showcase-align').evaluateAll(els=>els.forEach(el=>el.open=true));await scan('showcase-text');
  await page.getByRole('button',{name:'Load Preset',exact:true}).click();await page.locator('.showcase-dialog').waitFor();await scan('showcase-presets');await page.locator('.showcase-dialog').getByRole('button',{name:'Cancel',exact:true}).click();
  await page.locator('.showcase-list li').first().click();await page.locator('.showcase-dialog').waitFor();await scan('showcase-animation');await page.locator('.showcase-dialog').getByRole('button',{name:'Cancel',exact:true}).click();
  await page.getByRole('tab',{name:'Portrait',exact:true}).click();await scan('showcase-portrait');
  report.untranslated=await page.evaluate(()=>Object.fromEntries(['ru','es','zh','mordor'].map(locale=>[locale,[...auditText].filter(s=>uiAudit.translate(s,locale)===s)])));
  // Exercise actual translated controls, not only dictionary lookup.
  for(const [locale,label] of [['ru','Russian'],['es','Spanish'],['zh','Chinese'],['mordor','The Language of Mordor']]){
   await page.locator('.language-trigger').click();await page.getByRole('option',{name:label,exact:true}).click();
   await page.getByRole('tab',{name:await page.evaluate(locale=>uiAudit.translate('Sequences',locale),locale),exact:true}).waitFor();
   await page.screenshot({path:path.join(out,locale+'.png')});
  }
  assert.deepEqual(errors,[]);assert.deepEqual(report.contrast,[], 'All audited text must meet 4.5:1 contrast');fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2));console.log('UI audit:',report.screens,'theme/screen combinations;',report.contrast.length,'contrast groups.');
 }finally{await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
