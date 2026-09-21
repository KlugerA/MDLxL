import test from 'node:test';import assert from 'node:assert/strict';
import {translate,setLanguage} from '../src/localization.js';
import {localizedCreateElement} from '../app/localized-element.js';
import {DESCRIPTORS,CONTEXTS} from '../src/texture-library/search-language.mjs';
import {EXTRA_CONTEXTS} from '../src/texture-library/ultra-vocabulary.mjs';
import {LABELS,GROUPS,KINDS} from '../src/texture-library/materials.mjs';
test('language can switch without changing stored option values, inputs or model paths',()=>{
 setLanguage('ru');
 assert.equal(translate('Settings'),'Настройки');assert.equal(translate('Save as…'),'Сохранить как…');
 const option=localizedCreateElement('option',null,'Materials');assert.equal(option.props.children,'Материалы');assert.equal(option.props.value,'Materials');
 const modelName=localizedCreateElement('input',{value:'Materials',title:'Settings'});assert.equal(modelName.props.value,'Materials');assert.equal(modelName.props.title,'Настройки');
 const path='C:\\Models\\Textures\\Head.blp';assert.equal(translate(path),path);
 assert.equal(localizedCreateElement('span',{translate:'no'},'Materials').props.children,'Materials');
 assert.equal(translate('Opened Hero.mdx'),'Открыт файл Hero.mdx');
 assert.equal(translate('Copied 1 geoset. Clipboard survives opening another model.'),'Скопировано геосетов: 1. Буфер сохранится при открытии другой модели.');
 setLanguage('en');assert.equal(localizedCreateElement('button',null,'Settings').props.children,'Settings');
});
test('Russian texture search translates the descriptive vocabulary without changing its identifiers',()=>{
 const labels=[...DESCRIPTORS.map(d=>d.label),...CONTEXTS.map(c=>c[1]),...EXTRA_CONTEXTS.map(c=>c[1]),...Object.values(LABELS),...GROUPS.flatMap(g=>[g.name,g.hint]),...Object.values(KINDS)];
 for(const label of new Set(labels))assert.notEqual(translate(label,'ru'),label,`Untranslated search label: ${label}`);
 assert.equal(LABELS['human-body'],'Human body');
});
test('Spanish, Chinese, and Mordor localize the concise editor controls',()=>{
 for(const [locale, expected] of [['es','Guardar'],['zh','保存']]){
   setLanguage(locale); assert.equal(translate('Save'),expected); assert.notEqual(translate('Settings'),'Settings');
 }
 const mordorSave = translate('Save','mordor');
 assert.notEqual(mordorSave,'Save');
 assert.match(mordorSave,/^(?:ash|nazg|durb|atulûk|gimb|krimp|burzum|ishi|agh|ghâsh|snaga|uruk|lugbúrz|nazgûl)$/);
 setLanguage('en');
});
test('Chinese UI wording matches the supplied translation review',()=>{
 const labels={
  'Open...':'打开','New model':'新建模型','Recovery...':'恢复','Exit':'退出','Paste special...':'选择性粘贴…','Indo cache...':'输入缓存…','Keyframes':'关键帧','Vertex editor':'顶点编辑器','Uv-maps':'UV贴图','Animaitons: cishilitu and RGB':'动画：透明度与RGB',
  'Material Manager...':'材质管理器…','Texture Manager...':'纹理管理器…','Geoset Manager...':'几何体集管理器…','Geoset Animation Manager...':'几何体集动画管理器…','Camera Manager...':'相机管理器…','texture Animation Manager...':'纹理动画管理器…','Global Sequence Manager...':'全局序列管理器…','Mouse and general...':'鼠标与常规…','Kegboard Shortcuts...':'键盘快捷键…','Graphical settings...':'图形设置…','Appearance...':'外观…','Configjration...':'配置…','Warcraft III':'魔兽争霸 III','undo cache...':'撤销缓存…','Rescan game data':'重新扫描游戏数据','Hotkeys':'快捷键','Check model':'检查模型','Scroll':'滚动',
  'Orthographic':'正交视图','Perspective':'透视图','Front':'前视图','Back':'后视图','Left':'左视图','Right':'右视图','Top':'顶视图','Bottom':'底视图','UV-maps':'UV贴图','Invert':'反转','Selected':'已选中','Hidden':'已隐藏','Triangles':'三角面','Citadel Paint':'城堡漆','Texture size':'贴图尺寸','256 × 256 (fast)':'256 × 256（快速）','Open preset...':'打开预设...','Begin':'开始','BitsAndParts / Clockwork':'BitsAndParts（零件组件）/ Clockwork（机械传动）','Vertex editor (F1)':'顶点编辑器（F1）',
  'Start a paint preset':'开始一个涂装预设','Paint Current Skin':'使用当前皮肤贴图','Keep the model texture as the first coat.':'将模型现有贴图作为第一层底漆。','New basecoat':'新建底漆层','Create new textures on a clean neutral miniature.':'在干净的中性微缩模型上创建全新贴图。','Save a preset to keep editable coats. Use paint on model opens Vertices with your texture already assigned.':'保存预设以保留可编辑漆层。对模型使用涂装功能时，会打开已分配贴图的顶点。','Error: This model has no paintable image layer.':'错误：该模型不存在可绘制图像图层。',
 };
 for(const [source,expected] of Object.entries(labels)) assert.equal(translate(source,'zh'),expected,source);
 for(const [index,source,expected] of [[0,'Red','红色'],[1,'Blue','蓝色'],[2,'Teal','青色'],[3,'Purple','紫色'],[4,'Yellow','黄色'],[5,'Orange','橙色'],[6,'Green','绿色'],[7,'Pink','粉红色'],[8,'Grey','灰色'],[9,'Light Blue','淡蓝色'],[10,'Dark Green','暗绿色'],[11,'Brown','棕色'],[12,'Maroon','栗色'],[13,'Navy','海军蓝'],[14,'Aqua','青绿色'],[15,'Violet','紫罗兰色'],[16,'Wheat','小麦色'],[17,'Peach','桃红色'],[18,'Mint','薄荷色'],[19,'Lavender','薰衣草色'],[20,'Coal','碳色'],[21,'Snow','雪白'],[22,'Emerald','祖母绿'],[23,'Peanut','花生色']]) assert.equal(translate(`${index} · ${source}`,'zh'),`${index} ${expected}`,source);
});
test('new language packs include the longer help and Settings guidance',()=>{
 const help='Rotate the model to the required viewpoint, or choose a standard projection plane.';
 const settings='MDLVis Vanilla is the default. Presets change only the editor viewport and never alter model geometry, materials, UVs, animations, or saved MDL/MDX data.';
 for(const locale of ['es','zh','mordor']){
   assert.notEqual(translate(help,locale),help,`${locale} projection guidance`);
   assert.notEqual(translate(settings,locale),settings,`${locale} appearance guidance`);
 }
});
test('Mordor mode ciphers otherwise untranslated UI prose into Black Speech vocabulary',()=>{
 const source='This unusual explanatory sentence is intentionally not in a translation pack.';
 const translated=translate(source,'mordor');
 assert.notEqual(translated,source);
 assert.match(translated,/^(?:ash|nazg|durb|atulûk|gimb|krimp|burzum|ishi|agh|ghâsh|snaga|uruk|lugbúrz|nazgûl)/);
});
