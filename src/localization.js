import core from './locales/ru-core.json' with { type: 'json' };
import editor from './locales/ru-editor.json' with { type: 'json' };
import engine from './locales/ru-engine.json' with { type: 'json' };
import additions from './locales/ru-additions.json' with { type: 'json' };
import forge from './locales/ru-forge.json' with { type: 'json' };
import descriptors from './locales/ru-descriptors.json' with { type: 'json' };
import materials from './locales/ru-materials.json' with { type: 'json' };
import previewCache from './locales/ru-preview-cache.json' with { type: 'json' };
import optimizer from './locales/ru-optimizer.json' with { type: 'json' };
import reviewedRussian from './locales/ru-reviewed.json' with { type: 'json' };
import reviewedSpanish from './locales/es-reviewed.json' with { type: 'json' };
import { chinese, mordor, spanish } from './locales/short-ui-locales.js';
import { broadChinese, broadMordor, broadSpanish } from './locales/broad-ui-locales.js';

export const russian = Object.freeze({ ...core, ...editor, ...engine, ...additions, ...forge, ...descriptors, ...materials, ...previewCache, ...optimizer, ...reviewedRussian });
export const LANGUAGES = Object.freeze([
  Object.freeze({ id: 'en', label: 'English', nativeLabel: 'English' }),
  Object.freeze({ id: 'ru', label: 'Russian', nativeLabel: 'Русский' }),
  Object.freeze({ id: 'es', label: 'Spanish', nativeLabel: 'Español' }),
  Object.freeze({ id: 'zh', label: 'Chinese', nativeLabel: '中文' }),
  Object.freeze({ id: 'mordor', label: 'The Language of Mordor', nativeLabel: 'The Language of Mordor' }),
]);
// Tolkien published only a small Black Speech corpus. Mordor mode is therefore
// deliberately a non-semantic Black Speech cipher for interface prose: it
// keeps the joke consistently unreadable without falsely presenting invented
// sentences as canonical Tolkien text.
const blackSpeechWords = Object.freeze(['ash', 'nazg', 'durb', 'atulûk', 'gimb', 'krimp', 'burzum', 'ishi', 'agh', 'ghâsh', 'snaga', 'uruk', 'lugbúrz', 'nazgûl']);
// Keep recognizable formats, axes, shortcuts, and file paths useful in joke mode.
const blackSpeechLiterals = new Set(['MDLxL','MDLVis','MdlVis','Warcraft','III','RGB','UV','XYZ','XYZW','XY','XZ','ZX','YZ','DPI','MDL','MDX','BLP','DDS','DXT','PNG','JPG','JPEG','GIF','WebP','BMP','CASC','MPQ','JSON','API','UTF','Ctrl','Alt','Shift','Win','Enter','Escape','Delete','Backspace','Tab','Space','Page','Up','Down','Home','End','MB','MiB','KB','KiB','ID','IDs','GPU','FPS','ms','px']);
function blackSpeechCipher(text) {
  if (/^[A-Za-z]:[\\/]/.test(text)) return text;
  return text.replace(/(?:[\w.-]+[\\/])+[\w.-]+|\b[\w-]+\.(?:mdl|mdx|blp|dds|png|jpe?g|gif|webp|bmp|json|zip|txt|wav|mp3|w3x|w3m)\b|[A-Za-z]{2,}/gi, word => {
    if (/[\\/.]/.test(word) || blackSpeechLiterals.has(word)) return word;
    let hash = 0;
    for (const letter of word.toLowerCase()) hash = (hash * 31 + letter.charCodeAt(0)) >>> 0;
    return blackSpeechWords[hash % blackSpeechWords.length];
  });
}
const mordorKeys = Object.freeze({ ...russian, ...reviewedSpanish, ...mordor, ...broadMordor });
const blackSpeech = Object.freeze(Object.fromEntries(Object.keys(mordorKeys).map(key => [key, blackSpeechCipher(key)])));
const dictionaries = Object.freeze({
  ru: russian,
  es: Object.freeze({ ...spanish, ...broadSpanish, ...reviewedSpanish }),
  zh: Object.freeze({ ...chinese, ...broadChinese }),
  mordor: blackSpeech,
});
let language = 'en';
export function isLanguage(value) { return LANGUAGES.some(item => item.id === value); }
export function setLanguage(value) { language = isLanguage(value) ? value : 'en'; }
export function getLanguage() { return language; }
const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const patternCache = new Map();
function patternsFor(locale) {
  if (patternCache.has(locale)) return patternCache.get(locale);
  const patterns = Object.entries(dictionaries[locale] || {}).filter(([key]) => /\{\d+\}/.test(key)).map(([key,value]) => {
  const parts=key.split(/(\{\d+\})/), ids=[];
  const source=parts.map(part=>/^\{\d+\}$/.test(part)?(ids.push(part),'(.*?)'):escape(part)).join('');
  return { regex:new RegExp('^'+source+'$'), value, ids, weight:key.replace(/\{\d+\}/g,'').length };
  }).filter(p=>p.weight>2).sort((a,b)=>b.weight-a.weight);
  patternCache.set(locale, patterns); return patterns;
}

/** Translate presentation text only; model fields and file bytes never pass here. */
export function translate(text, locale = language, depth = 0) {
  if (locale === 'en' || !dictionaries[locale] || typeof text !== 'string' || !/[a-z]/i.test(text)) return text;
  const trimmed=text.trim(), before=text.slice(0,text.indexOf(trimmed)), after=text.slice(text.indexOf(trimmed)+trimmed.length);
  let translated=dictionaries[locale][trimmed];
  // A complete reviewed label beats a generic template such as "Material {0}".
  // Keep the community Chinese lookup behavior exactly as supplied.
  if (translated === undefined && (locale === 'ru' || locale === 'es')) {
    const decorated = /^(.*?)(:|…|\.\.\.)$/.exec(trimmed);
    const label = decorated && dictionaries[locale][decorated[1]];
    if (label !== undefined && label !== null) translated = label + decorated[2];
  }
  if(translated===undefined && depth<3) for(const pattern of patternsFor(locale)){
    const match=pattern.regex.exec(trimmed);if(!match)continue;
    translated=pattern.value.replace(/\{\d+\}/g,id=>{const index=pattern.ids.indexOf(id);return index<0?id:translate(match[index+1],locale,depth+1);});break;
  }
  // Labels commonly carry a trailing colon, ellipsis, or a native menu mnemonic.
  if(translated===undefined && depth<3){
    if(trimmed.startsWith('&')) translated=translate(trimmed.slice(1),locale,depth+1);
    else { const match=/^(.*?)(:|…|\.\.\.)$/.exec(trimmed);if(match){const value=translate(match[1],locale,depth+1);if(value!==match[1])translated=value+match[2];} }
  }
  if (translated === undefined && locale === 'mordor') translated = blackSpeechCipher(trimmed);
  return translated===undefined?text:before+translated+after;
}
