import {GROUPS,LABELS,KINDS,aliases,kindAliases} from './materials.mjs';
import {DESCRIPTORS,CONTEXTS,REWRITES,FILLER,RELATED_MATERIALS} from './search-language.mjs';
import {EXTRA_CONTEXTS} from './ultra-vocabulary.mjs';
import {inferUltraConcepts} from './ultra-concept-rules.mjs';
export {GROUPS,LABELS,KINDS};
export const norm = s => String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\\/g,'/').replace(/[^\p{L}\p{N}/ -]/gu,' ').replace(/\s+/g,' ').trim();
const words = s => norm(String(s||'').replace(/([a-z])([A-Z])/g,'$1 $2').replace(/([A-Z])([A-Z][a-z])/g,'$1 $2')).replace(/[\/_-]/g,' ').replace(/\s+/g,' ').trim();
const contains = (haystack,needle) => (' '+haystack+' ').includes(' '+needle+' ');
const unique = xs => [...new Set(xs)];
const lexicon = new Map(), definitions = new Map();
function register(d,phrases){definitions.set(d.id,d);for(const phrase of phrases){const p=words(phrase);if(p)lexicon.set(p,d);}}
const materialCanonical = new Map();
for(const [word,tags] of Object.entries({...Object.fromEntries(Object.keys(LABELS).map(k=>[k,[k]])),...aliases})){
 const key=[...tags].sort().join('|');let d=materialCanonical.get(key);
 if(!d){d={id:'material:'+key,family:'material',tags,label:LABELS[word]||word[0].toUpperCase()+word.slice(1)};materialCanonical.set(key,d);}
 register(d,[word,...(!word.endsWith('s')?[word+'s']:[])]);
}
for(const [word,kind] of Object.entries({...kindAliases,prop:'doodads',props:'doodads',icon:'icons',icons:'icons',menu:'ui',menus:'ui',ui:'ui',interface:'ui'}))register({id:'source:'+kind,family:'source',kind,label:KINDS[kind]},[word]);
for(const d of DESCRIPTORS)register({...d,id:'trait:'+d.id,trait:d.id},d.words);
for(const [id,label,aliases] of CONTEXTS)register({id:'context:'+id,family:'context',context:id,label,scope:aliases.map(words)},aliases);
// Register specific native subjects before broad archetypes. Preserve established material meanings.
for(const [id,label,aliases] of [...EXTRA_CONTEXTS].reverse()){
 const d={id:'inspiration:'+id,family:'inspiration',context:id,label,scope:aliases.map(words),requireEvidence:true};
 register(d,aliases.filter(p=>!lexicon.has(words(p))));
}
const materialPhrases = {'chain mail':'chainmail','chain armour':'chainmail','chain armor':'chainmail','plate mail':'platemail','plate armour':'plate','plate armor':'plate','scale mail':'scalemail','scale armour':'scalemail','scale armor':'scalemail','team color':'teamcolor','team colour':'teamcolor','team colored':'teamcolor','team coloured':'teamcolor','human body':'human','orc body':'orc','elf body':'elf','night elf':'nightelf','night elves':'nightelf','blood elf':'bloodelf','blood elves':'bloodelf','dead skin':'undead','human skin':'human','orc skin':'orc'};
Object.assign(materialPhrases,{'orcish':'orc','elven':'elf','elvish':'elf','demonic':'demon','dwarven':'dwarf','dwarvish':'dwarf','undead flesh':'undead','cast iron':'iron','wrought iron':'iron','stainless steel':'steel','sheet metal':'metal','metal fittings':'metal','ironwork':'iron','steelwork':'steel','chainmail armor':'chainmail','chainmail armour':'chainmail','platemail armor':'plate','platemail armour':'plate','reptilian':'scales','scaly':'scales','feathery':'feathers','furry':'fur','leathery':'leather','papery':'paper','rocky':'rock','stony':'stone','grassy':'grass','leafy':'foliage','leaves':'foliage','ivy':'foliage','vegetation':'foliage','tree roots':'wood','vines':'foliage'});
for(const [phrase,target] of Object.entries(materialPhrases)){const d=lexicon.get(target);if(d)lexicon.set(phrase,d);}
lexicon.set('chain links',lexicon.get('chain links')||{id:'material:chain-links',family:'material',tags:['chain-links'],label:'Chains & links'});
lexicon.set('chain link',lexicon.get('chain links'));
// Broad body pieces do not imply plate armour.
register({id:'trait:torso',trait:'torso',family:'surface',label:'Torso / body'},['torso','torsos']);
for(const phrase of ['stained glass','wood grain','snow covered','ice covered','dull metal']){
 const base=lexicon.get(phrase);if(base){const material=phrase==='stained glass'?'glass':phrase==='wood grain'?'wood':phrase==='snow covered'?'snow':phrase==='ice covered'?'ice':'metal';lexicon.set(phrase,{...base,also:lexicon.get(material)});}
}
// Never consume a material noun as part of an adjective phrase.
for(const p of ['torn fabric','torn cloth','rust covered metal','metal trim','dead wood','dead bark'])lexicon.delete(p);
for(const p of ['large sheets','large textures','high resolution','high res','big sheets','big textures'])register({id:'size:large',family:'size',label:'Large sheets (512px+)',size:'large'},[p]);
for(const p of ['small sheets','small textures','low resolution','low res'])register({id:'size:small',family:'size',label:'Small sheets (128px or less)',size:'small'},[p]);
register({id:'quality:reviewed',family:'quality',label:'Visually reviewed',quality:'reviewed'},['reviewed','visually reviewed','checked']);
register({id:'quality:region',family:'quality',label:'Has marked material regions',quality:'region'},['marked regions','highlighted regions']);
// These words are both valid plain nouns and ordinary filler; only consume them in phrases.
const singleFillers = new Set([...FILLER,'am','looking','look','looks','colored','coloured','color','colour','sorta','kinda','basically','ideally','covered','covering','edges','edge']);
const maxPhrase = Math.max(...[...lexicon.keys()].map(k=>k.split(' ').length));
const vocabulary = unique([...lexicon.keys()].filter(k=>!k.includes(' ')&&k.length>=4));
const correctionCaches = new WeakMap();
const bodyWords = new Set(['human','humans','orc','orcs','elf','elves','nightelf','bloodelf','undead','dwarf','dwarves','demon','demons','troll','trolls','naga','tauren','draenei','ogre','ogres']);
const colorMap = {'gold-color':'gold'};
const conditionTag = {rusty:['rust'],bloody:['blood'],mossy:[],bark:['bark'],banner:['banner'],hair:['hair'],face:['face'],eye:['eye'],rune:['rune'],emblem:['emblem'],gem:['gem','crystal'],planks:['wood'],roof:['roof','straw']};
const impliedTraits = {rusty:['old','weathered'],weathered:['old'],worn:['old'],tarnished:['old'],rotten:['old'],blighted:[],torn:['damaged'],frayed:['worn'],broken:['damaged'],cracked:['damaged'],scratched:['worn'],dented:['damaged'],burnt:['damaged'],mossy:[],ancient:['old']};
const compiledDescriptors=DESCRIPTORS.map(d=>({...d,normalized:d.words.map(words)}));
const appearanceDescriptors=compiledDescriptors.filter(d=>d.family!=='color');
const colorDescriptors=compiledDescriptors.filter(d=>d.family==='color');
const explicitTraitMap={trimmed:'trim',pale:'light',gold:'gold-color',silver:'gray',tan:'brown',mottled:'spotted',runic:'rune',bearded:'hair',ridged:'ribbed',snowy:'frosted',violet:'purple',heraldic:'emblem',branches:'roots',cyan:'teal',frozen:'frosted',mechanical:'wheel',ragged:'torn',turquoise:'teal',cloak:'cape',engraved:'carved',pointed:'spiked',bronze:'gold-color',shingles:'roof',navy:'blue',tattooed:'tattoo',scrollwork:'ornate',ocher:'yellow',flowing:'folded',tattered:'torn',twisted:'gnarled',sack:'bag',diseased:'blighted',embroidered:'ornate',copper:'gold-color',brass:'gold-color',indigo:'purple',mauve:'purple',cream:'white',magenta:'pink',corrupted:'blighted',straps:'belt',stump:'roots'};
export function distance(a,b){
 if(a===b)return 0;if(Math.abs(a.length-b.length)>2)return 3;
 let prevPrev=[],prev=Array.from({length:b.length+1},(_,i)=>i);
 for(let i=1;i<=a.length;i++){const cur=[i];for(let j=1;j<=b.length;j++){cur[j]=Math.min(prev[j]+1,cur[j-1]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));if(i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1])cur[j]=Math.min(cur[j],prevPrev[j-2]+1);}prevPrev=prev;prev=cur;}return prev[b.length];
}
function correction(word,knownWords){
 if(REWRITES[word])return REWRITES[word];if(word.length<4||knownWords?.has(word)||lexicon.has(word))return null;
 let cache=knownWords&&correctionCaches.get(knownWords);
 if(!cache&&knownWords){cache=new Map();correctionCaches.set(knownWords,cache);}
 if(cache?.has(word))return cache.get(word);
 const max=word.length>=7?2:1;
 let best=max+1,candidates=[];
 const preferred=knownWords?.nameWords;
 for(const target of unique([...vocabulary,...(preferred||[]),...(knownWords||[])])){
  if(target.length<4||Math.abs(word.length-target.length)>max)continue;
  const n=distance(word,target);if(n<best){best=n;candidates=[target]}else if(n===best)candidates.push(target);
 }
 // Preserve ambiguous real words. A unique filename spelling may break an otherwise ambiguous typo tie.
 let concepts=unique(candidates.map(x=>lexicon.get(x)?.id||x));
 if(concepts.length>1&&preferred){const names=candidates.filter(x=>preferred.has(x));if(names.length===1){candidates=names;concepts=names;}}
 const answer=best<=max&&concepts.length===1?candidates.sort((a,b)=>a.length-b.length)[0]:null;
 cache?.set(word,answer);return answer;
}
const exactFile = input => /(?:\\|\.(?:blp|tga|png|mdx)\b|^(?:textures|units|buildings|doodads|ui|terrainart|replaceabletextures|abilities|objects|environment|sharedmodels)\/)/i.test(input)&&!/^\w+:/.test(input.trim().replace(/^[a-z]:[\\/]/i,''));
function scanQuery(input,knownWords){
 const raw=String(input||'').trim().replace(/\bi['’]m\b/gi,'i am').replace(/\bi['’]d\b/gi,'i would');
 if(exactFile(raw)&&!/(?:\s(?:or|and|without|not)\s|\s-\w)/i.test(raw)&&!/^\w+:/.test(raw))return [{id:'path:'+norm(raw),word:norm(raw).replace(/\s+/g,' '),label:raw,family:'literal',field:'path',literal:true,exclude:false,exact:true}];
 // Quoted phrases, exclusions, and field prefixes survive tokenization.
 const tokens=raw.normalize('NFKD').replace(/[“”]/g,'"').replace(/[‘’]/g,"'").match(/-?(?:(?:name|path|source|material|color|colour|context):)?"[^"]+"|\b\d+\s*[x×]\s*\d+\b|[^\s,;()]+/gi)||[];
 const flat=[];
 for(let token of tokens){
  const quoted=token.includes('"');let field=token.match(/^-?(name|path|source|material|colou?r|context):/i)?.[1]?.toLowerCase();
  const exclude=token.startsWith('-');if(exclude)token=token.slice(1);if(field)token=token.slice(token.indexOf(':')+1);
  if(quoted||field==='path'||field==='name'||/^\d+\s*[x×]\s*\d+$/.test(token)){flat.push({raw:token.replace(/"/g,''),quoted,field,exclude});continue;}
  if(token==='|'||token.toLowerCase()==='or'){flat.push({op:'or'});continue;}
  if(token.includes('/')&&!token.includes('.')){const parts=token.split('/');parts.forEach((part,i)=>{if(i)flat.push({op:'or'});flat.push({raw:words(part),field,exclude});});continue;}
  words(token).split(' ').filter(Boolean).forEach(w=>flat.push({raw:w,field,exclude}));
 }
 const found=[];let excluding=false,negateNext=false;
 for(let i=0;i<flat.length;){let t=flat[i];if(t.op){found.push(t);i++;continue;}
  if(['without','except','excluding','exclude','minus'].includes(t.raw)){excluding=true;i++;continue;}
  if(['not','no'].includes(t.raw)){negateNext=true;i++;continue;}
  if(['with','but','plus','including'].includes(t.raw)){excluding=false;i++;continue;}
  const exclude=!!(t.exclude||excluding||negateNext);
  if(/^\d+\s*[x×]\s*\d+$/.test(t.raw)){const [width,height]=t.raw.split(/[x×]/).map(Number);found.push({id:`size:${width}x${height}`,family:'size',label:`${width} × ${height}`,word:t.raw,width,height,exclude});negateNext=false;i++;continue;}
  if(t.field==='path'||t.field==='name'){found.push({id:'literal:'+t.raw,word:norm(t.raw),label:t.raw,family:'literal',literal:true,field:t.field,exact:true,exclude});negateNext=false;i++;continue;}
  let matched=null,consumed=1,original=t.raw,fixed=null;
  for(let n=Math.min(maxPhrase,flat.length-i);n>0;n--){const slice=flat.slice(i,i+n);if(slice.some((x,j)=>x.op||j>0&&(x.exclude||x.field||x.quoted)))continue;const phrase=words(slice.map(x=>x.raw).join(' '));if(lexicon.has(phrase)){matched=lexicon.get(phrase);consumed=n;original=phrase;break;}}
  if(!matched&&!t.quoted&&singleFillers.has(t.raw)){i++;continue;}
  if(!matched&&!t.quoted){fixed=correction(t.raw,knownWords);if(fixed){matched=lexicon.get(words(fixed));if(!matched&&fixed.includes(' ')){flat.splice(i,1,...fixed.split(' ').map(w=>({raw:w,exclude})));continue;}}}
  if(!matched&&singleFillers.has(t.raw)){i++;continue;}
  if(matched){let d={...matched};if(t.field==='color'||t.field==='colour'){const col=DESCRIPTORS.find(x=>x.family==='color'&&(x.id===t.raw||x.words.includes(t.raw)||t.raw==='gold'&&x.id==='gold-color'||t.raw==='silver'&&x.id==='gray'));if(col)d={...col,trait:col.id,id:'trait:'+col.id};}
   found.push({...d,word:original,field:t.field,exclude,correction:fixed&&fixed!==original?{from:original,to:fixed}:null});
   if(d.also)found.push({...d.also,word:d.also.label.toLowerCase(),exclude});
  }else found.push({id:'literal:'+norm(fixed||t.raw),word:norm(fixed||t.raw),label:fixed||t.raw,family:'literal',literal:true,exact:!!t.quoted,exclude,unknown:!knownWords?.has(fixed||t.raw),correction:fixed?{from:t.raw,to:fixed}:null});
  negateNext=false;i+=consumed;
 }
 return found;
}
export function parseQuery(input,knownWords){
 const parsed=scanQuery(input,knownWords);
 // A faction next to an explicit non-character source means that source's faction.
 const nonBody=parsed.some(p=>!p.exclude&&(p.kind&&['buildings','ui','doodads','terrain','icons'].includes(p.kind)||['ship','boat','banner'].includes(p.trait)));
 for(const p of parsed){if(nonBody&&bodyWords.has(p.word)){p.family='context';p.context='faction';p.scope=[p.word.replace(/s$/,'')];p.label=(p.word[0].toUpperCase()+p.word.slice(1))+' source context';delete p.tags;}
  if(['nightelf','night elf','night elves'].includes(p.word))p.scope=['nightelf','night elf','purple elf'];
  if(['bloodelf','blood elf','blood elves'].includes(p.word))p.scope=['bloodelf','blood elf','blood elf'];
 }
 // Adjacent alternatives of one facet: (red OR blue) fabric. Whole clauses remain OR branches.
 const merged=[];
 for(let i=0;i<parsed.length;i++){const p=parsed[i];if(p.op==='or'&&merged.length&&parsed[i+1]&&!parsed[i+1].op){const left=merged.at(-1),right=parsed[i+1];const fam=left.options?.[0]?.family||left.family;
   if((fam===right.family||left.exclude&&right.exclude)&&left.exclude===right.exclude){const options=[...(left.options||[left]),right];merged[merged.length-1]={id:options.map(x=>x.id).join('|'),word:options.map(x=>x.word).join(' or '),label:options.map(x=>x.label).join(' or '),family:fam,options,exclude:left.exclude};i++;continue;}}
  merged.push(p);
 }
 const seen=new Set();return merged.filter(p=>{if(p.op==='or'){seen.clear();return true;}const key=p.id+':'+p.exclude;if(seen.has(key))return false;seen.add(key);return true;});
}
function positiveNotes(notes){
 return String(notes||'').split(/[.;]/).filter(s=>!/(?:campaign footman offers|\b(?:see|use|try) (?:the |a )?(?:other|campaign)|\bcounterpart\b|\belsewhere\b)/i.test(s)).map(s=>s.split(/\b(?:no|not|without|rather than|instead of)\b/i)[0]).join('. ');
}
export function prepare(items){
 const allWords=new Set(),nameWords=new Set();
 const prepared=items.map(t=>{
  const own=words([t.name,t.path,t.context,...(t.races||[])].join(' ')),note=words(positiveNotes(t.notes)),models=words((t.models||[]).join(' '));
  const item={...t,_text:norm([t.name,t.path,...(t.tags||[]),...(t.races||[]),...(t.models||[]),t.notes||''].join(' ')),_own:own,_note:note,_models:models,_name:words(t.name),_leaf:words(String(t.path||'').split(/[\\/]/).at(-1).replace(/\.[^.]+$/,'')),_path:norm(t.path),_tags:new Set(t.tags||[]),_traits:new Map(),_words:new Set((own+' '+note).split(' ').filter(Boolean))};
  for(const w of (item._name+' '+item._leaf).split(' '))if(w.length>=3&&!/^\d+$/.test(w))nameWords.add(w);
  for(const name of [item._name,item._leaf]){const compact=name.replace(/ /g,'');if(compact.length>=5)nameWords.add(compact);}
  const reviewedEvidence=t.searchHints?.evidence?.find(e=>e.type==='reviewed-image')?.text||t.searchHints?.evidence?.[0]?.text||'Reviewed description';
  if(t.searchIndex?.version===4){for(const [id,strength,source,related] of t.searchIndex.traits){const evidence=source==='=note'?'Description: '+t.notes:source==='=review'?reviewedEvidence:source;item._traits.set(id,{strength,evidence,related:!!related});}for(const w of item._words)allWords.add(w);return item;}
  const record=(id,strength,evidence)=>{if(!item._traits.has(id)||item._traits.get(id).strength<strength)item._traits.set(id,{strength,evidence});};
  for(const [id,tags] of Object.entries(conditionTag))if(tags.some(x=>item._tags.has(x)))record(id,1,'Material annotation');
  const traits=t.searchHints?.concepts||t.descriptors||[];
  for(const original of traits){const id=explicitTraitMap[original]||lexicon.get(words(original))?.trait||original;record(id,1,reviewedEvidence);}
  if(t.tags?.some(x=>x.endsWith('-body')||x==='skin'))record('torso',.9,'Body material annotation');
  for(const d of appearanceDescriptors){
   if(d.normalized.some(p=>contains(note,p)))record(d.id,.95,'Description: '+t.notes);
   // Object / location names can identify an object; appearance is never borrowed from all model references.
   if(d.family==='object'&&d.normalized.some(p=>contains(own,p)))record(d.id,.85,'Texture name or path');
   if(d.family==='condition'&&!['old','ancient','clean','polished','rotten'].includes(d.id)&&d.normalized.filter(p=>p.length>3).some(p=>contains(own,p)))record(d.id,.8,'Texture name or path');
  }
  const colors=t.searchColors?.coverage||{};
  for(const d of colorDescriptors){
   const key=colorMap[d.id]||d.id;if(colors[key]>=.04)record(d.id,.8,`${Math.round(colors[key]*100)}% of measured sheet colour`);
   if(d.normalized.some(p=>contains(note,p)))record(d.id,1,'Colour in reviewed description');
  }
  if(t.alpha)record('transparent',1,'Alpha channel present');
  if(t.kinds?.includes('terrain'))record('seamless',.65,'Terrain tile candidate; check the edges');
  for(const [id,ev] of [...item._traits])for(const broader of impliedTraits[id]||[])record(broader,ev.strength*.96,ev.evidence);
  for(const {id,...ev} of inferUltraConcepts(item)){const previous=item._traits.get(id);if(!previous||previous.related&&!ev.related||!!previous.related===!!ev.related&&ev.strength>previous.strength)item._traits.set(id,ev);}
  for(const w of item._words)allWords.add(w);
  return item;
 });
 Object.defineProperty(allWords,'nameWords',{value:nameWords});
 Object.defineProperty(prepared,'vocabulary',{value:allWords});return prepared;
}
function literalMatch(t,p){
 const target=p.field==='path'?t._path:p.field==='name'?t._name:t._own+' '+t._note;
 if(p.field==='path')return target===p.word?1:target.includes(p.word)?.9:0;
 if(contains(target,words(p.word)))return t._name===words(p.word)?1:.9;
 if(p.exact)return 0;
 // Native filenames such as Grunt.blp also match their humanised names; no substring matching for materials.
 if(p.word.length>=3&&unique(words(p.word).split(' ')).every(w=>[...t._words].some(tw=>tw.startsWith(w))))return .7;
 return 0;
}
// A name is a separate retrieval route: aliases must never hide an actual native filename.
function nameTerm(t,p){
 if(p.options)return Math.max(0,...p.options.map(option=>nameTerm(t,option)));
 if(p.field&&p.field!=='name')return 0;
 const needle=words(p.correction?.to||p.word),targets=[t._name,t._leaf];
 if(!needle)return 0;
 if(targets.includes(needle))return 4;
 if(targets.some(s=>contains(s,needle)))return 3;
 const compact=needle.replace(/ /g,'');
 if(compact.length>=4&&targets.some(s=>s.replace(/ /g,'').includes(compact)))return 2;
 // Ordinary plurals of a named subject still lead with that subject.
 if(needle.endsWith('s')&&needle.length>4&&targets.some(s=>contains(s,needle.slice(0,-1))))return 2;
 return 0;
}
function namedOutcome(t,terms,options={}){
 const positive=terms.filter(p=>!p.exclude),excluded=terms.filter(p=>p.exclude);
 if(excluded.some(p=>testTerm(t,p,true).strength>0||nameTerm(t,p)))return null;
 const characterRequest=options.kind==='units'||positive.some(p=>p.kind==='units');
 const forcedConstraint=p=>(p.field&&p.field!=='name')||['source','size','quality'].includes(p.family)||(characterRequest&&p.family==='material'&&bodyWords.has(p.word));
 const names=positive.filter(p=>!forcedConstraint(p)&&nameTerm(t,p));
 const constraints=positive.filter(p=>!names.includes(p));
 if(!names.length||constraints.some(p=>!testTerm(t,p).strength)||names.some(p=>!nameTerm(t,p)||(p.field==='name'&&!literalMatch(t,p))))return null;
 const phrase=words(names.map(p=>p.correction?.to||p.word).join(' '));
 const rank=names.length===1?nameTerm(t,names[0]):[t._name,t._leaf].includes(phrase)?4:[t._name,t._leaf].some(s=>contains(s,phrase))?3:2;
 return {all:true,ratio:1,relevance:40*names.length,nameRank:rank,nameMatch:rank===4?'Exact name':'Name contains your search',regionColor:false,matched:[{label:'Native filename',family:'literal',evidence:t.path},...constraints.map(p=>({label:p.label,family:p.family,evidence:testTerm(t,p).evidence}))],missing:[],related:[]};
}
function contextMatch(t,p){
 const scopes=p.scope||[p.context];let source=t._own+' '+t._models;
 if(p.context==='faction')return scopes.some(x=>contains(source,x)||source.includes('/'+x+'/'))?1:0;
 if(p.context==='forest')return /\b(forest|ashenvale|felwood|lordaeron|tree|trees|woods|woodland)\b/.test(source)?1:0;
 if(p.context==='desert')return /\b(desert|barrens)\b/.test(source)?1:0;
 if(p.context==='swamp')return /\b(swamp|marsh|bog|sunken ruins)\b/.test(source)?1:0;
 return scopes.some(x=>contains(source,x)||source.replace(/ /g,'').includes(x.replace(/ /g,'')))?1:0;
}
function testTerm(t,p,allowRelated=false){
 if(p.options){let best={strength:0};for(const option of p.options){const m=testTerm(t,option,allowRelated);if(m.strength>best.strength)best=m;}return best;}
 if(p.family==='source')return {strength:t.kinds.includes(p.kind)?1:0,evidence:'Native source'};
 if(p.family==='material')return {strength:p.tags.some(tag=>t._tags.has(tag))&&(!p.scope||p.scope.some(s=>(t._own+' '+t._models+' '+t._note).includes(s)))?1:0,evidence:'Material tags'};
 if(p.family==='context')return {strength:contextMatch(t,p),evidence:'Native path / source context'};
 if(p.family==='inspiration'){
  if(!allowRelated)return {strength:0};
  const own=t._name+' '+t._leaf;
  const anchor=p.scope.find(s=>contains(own,s)||(s.replace(/ /g,'').length>=5&&own.replace(/ /g,'').includes(s.replace(/ /g,''))));
  const body=t.tags.some(tag=>tag.endsWith('-body')||['face','skin','scales','fur','bone','chitin','wing'].includes(tag));
  const strength=body?.95:t.kinds.includes('icons')?.65:.72;
  return anchor?{strength,evidence:`Related native subject: ${t.name} (${p.label})`,related:true}:{strength:0};
 }
 if(p.family==='size')return {strength:(p.width?t.width===p.width&&t.height===p.height:p.size==='large'?Math.max(t.width,t.height)>=512:Math.max(t.width,t.height)<=128)?1:0,evidence:'Image dimensions'};
 if(p.family==='quality')return {strength:(p.quality==='reviewed'?t.reviewed:t.regions?.length>0)?1:0,evidence:'Catalogue review'};
 if(p.literal)return {strength:literalMatch(t,p),evidence:p.field==='path'?'Native path':'Name or description'};
 const ev=t._traits.get(p.trait);if(ev&&(!ev.related||allowRelated))return ev;
 if(allowRelated){let best={strength:0};for(const id of p.related||[]){const ev=t._traits.get(id);const material=RELATED_MATERIALS[id]?.some(x=>t._tags.has(x));if(ev&&ev.strength*.5>best.strength)best={strength:ev.strength*.5,evidence:`Related: ${id}`,related:true};else if(material&&!best.strength)best={strength:.4,evidence:`Related: ${id}`,related:true};}return best;}
 return {strength:0};
}
function branchesOf(parsed){const branches=[[]];for(const p of parsed){if(p.op==='or'){if(branches.at(-1).length)branches.push([]);}else branches.at(-1).push(p);}return branches.filter(x=>x.length);}
const hard = p => ['material','source','context','size','quality','literal','object'].includes(p.family);
function evaluate(t,terms){
 const positive=terms.filter(p=>!p.exclude),excluded=terms.filter(p=>p.exclude);
 if(excluded.some(p=>testTerm(t,p,true).strength>0||(!p.field&&nameTerm(t,p))))return null;
 const matches=positive.map(p=>({term:p,...testTerm(t,p)}));
 const missing=matches.filter(m=>!m.strength);
 const all=missing.length===0;
 if(!all&&missing.some(m=>hard(m.term)))return null;
 const related=missing.map(m=>({...m,...testTerm(t,m.term,true)}));
 // A subjective/fantasy idea needs a real connection, even when its accompanying material matches.
 if(related.some(m=>m.term.requireEvidence&&!m.strength))return null;
 // With only descriptive words, require actual evidence for one of them or a documented related trait.
 if(!all&&!matches.some(m=>m.strength)&&!related.some(m=>m.strength))return null;
 const weights={condition:28,color:22,surface:25,object:32,literal:40,material:22,context:25,source:12,size:10,quality:10};
 let relevance=matches.reduce((n,m)=>n+(weights[m.term.family]||20)*m.strength,0)+related.reduce((n,m)=>n+(weights[m.term.family]||20)*m.strength*.75,0);
 const expected=positive.reduce((n,p)=>n+(weights[p.family]||20),0)||1;
 // Matching a colour in the requested material's annotated UV region is stronger than a whole-sheet colour.
 const wantedColors=positive.filter(p=>p.family==='color').flatMap(p=>(p.options||[p]).map(x=>colorMap[x.trait]||x.trait));
 const wantedTags=positive.filter(p=>p.tags).flatMap(p=>p.tags);
 const regionColor=!!wantedColors.length&&!!wantedTags.length&&(t.searchColors?.regions||[]).some(r=>wantedTags.includes(r.tag)&&wantedColors.some(c=>r.coverage?.[c]>=.04));
 if(regionColor)relevance+=12;
 return {all,ratio:relevance/expected,relevance,regionColor,matched:matches.filter(m=>m.strength).map(m=>({label:m.term.label,evidence:m.evidence,family:m.term.family})),missing:missing.map(m=>m.term.label),related:related.filter(m=>m.strength).map(m=>m.evidence)};
}
function baseFilter(t,options,groupTags,savedSet){const {kind='all',tag='',savedOnly=false}=options;return !(kind!=='all'&&!t.kinds.includes(kind)||tag&&!t._tags.has(tag)||!tag&&groupTags&&!groupTags.some(x=>t._tags.has(x))||savedOnly&&!savedSet.has(t.id));}
function baseScore(t,tag,terms){const tags=unique([tag,...terms.flatMap(p=>p.tags||[])].filter(Boolean));return (t.priority||0)+Math.max(0,...(t.regions||[]).filter(r=>tags.includes(r.tag)).map(r=>r.w*r.h*200));}
function suggestionsFor(parsed){
 const terms=parsed.filter(p=>!p.op);const suggestions=[];
 if(terms.some(p=>!p.exclude&&!hard(p)))suggestions.push({label:'Keep the material & source',query:terms.filter(p=>p.exclude||hard(p)).map(p=>(p.exclude?'-':'')+p.word).join(' ')});
 return suggestions.filter(s=>s.query);
}
export function searchDetailed(items,options={}){
 const {query='',group='',tag='',saved=[],sort='useful',includeClose=true}=options;
 const parsed=parseQuery(query,items.vocabulary),branches=branchesOf(parsed),groupTags=GROUPS.find(g=>g.id===group)?.tags,savedSet=new Set(saved);
 const exact=[],close=[];
 for(const t of items){if(!baseFilter(t,options,groupTags,savedSet))continue;
  const outcomes=branches.length?branches.flatMap(b=>[namedOutcome(t,b,options),evaluate(t,b)]).filter(Boolean):[{all:true,relevance:0,ratio:1,matched:[],missing:[]}];
  if(!outcomes.length)continue;outcomes.sort((a,b)=>(b.nameRank||0)-(a.nameRank||0)||Number(b.all)-Number(a.all)||b.ratio-a.ratio);const match=outcomes[0];
  const exactPath=parsed.some(p=>p.field==='path'&&t._path===p.word);
  if(exactPath){match.nameRank=5;match.nameMatch='Exact native path';}
  const score=match.relevance*10+baseScore(t,tag,parsed)+(exactPath?100000:0);
  const result={t,score,match};if(match.all)exact.push(result);else if(includeClose&&match.ratio>=.25)close.push(result);
 }
 const within=(a,b)=>sort==='name'?a.t.name.localeCompare(b.t.name):sort==='size'?(b.t.width*b.t.height-a.t.width*a.t.height)||b.score-a.score:b.score-a.score||a.t.name.localeCompare(b.t.name);
 const compare=(a,b)=>(b.match.nameRank||0)-(a.match.nameRank||0)||within(a,b);
 exact.sort(compare);close.sort((a,b)=>a.match.missing.length-b.match.missing.length||b.match.ratio-a.match.ratio||compare(a,b));
 // Suggestions remain available after named and complete matches, including broad fantasy queries.
 const relevantClose=includeClose?close.slice(0,120):[];
 const results=[...exact,...relevantClose].map(({t,match,score})=>({...t,_match:{...match,score,type:match.all?'exact':'close'}}));
 const corrections=unique(parsed.flatMap(p=>(p.options||[p]).filter(x=>x.correction).map(x=>JSON.stringify(x.correction)))).map(x=>JSON.parse(x));
 const nameCount=exact.filter(r=>r.match.nameRank).length;
 const unknown=unique(parsed.filter(p=>p.unknown&&!items.vocabulary?.has(p.word)&&!exact.some(r=>nameTerm(r.t,p))).map(p=>p.word));
 return {items:results,nameCount,descriptionCount:exact.length-nameCount,exactCount:exact.length,closeCount:relevantClose.length,parsed,corrections,unknown,meanings:meanings(query,items.vocabulary),suggestions:exact.length?[]:suggestionsFor(parsed)};
}
export function search(items,options={}){return searchDetailed(items,{...options,includeClose:options.includeClose??false}).items;}
export function meanings(query,knownWords){return parseQuery(query,knownWords).map(p=>p.op?'OR':(p.exclude?'Without ':'')+(p.label||p.word));}
export const SEARCH_EXAMPLES=['ugly face','disgusting nasty stuff','skeleton','eldritch horror','rusted looking, old metal','torn fabric','feldwood rotten wood','red or blue cloth without icons','human units with plate armour','512x512 metal'];
export const SEARCH_VOCABULARY = {phrases:lexicon.size,concepts:definitions.size};
