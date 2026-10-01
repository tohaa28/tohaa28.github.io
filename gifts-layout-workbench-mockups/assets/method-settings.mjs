import {PRINT_REQUIREMENTS} from './print-requirements.mjs?v=20260929-2';
export {PRINT_REQUIREMENTS};
export const SETTINGS_KEY='gwb-method-settings-v1';
export const CHECKS={text:'Шрифты в кривых',effects:'Прозрачность и эффекты',hidden:'Скрытые объекты',resolution:'Разрешение растра',colors:'Цветность и цветовая модель',positive:'Тонкие печатные элементы',negative:'Пробелы и выворотки',isolated:'Отдельные мелкие объекты',details:'Фоновый поиск PrintCheck',boundary:'Выход за поле',guard:'Охранное поле',bleed:'Вылеты',contours:'Обводки и замкнутость контуров',advisory:'Дополнительные требования и условия'};
export const PARAMETERS={guard:['Охранное поле, мм',0,1000],positive:['Минимальная линия, мм',0,100],negative:['Минимальный пробел, мм',0,100],isolated:['Отдельный объект, мм',0,100],minDpi:['Разрешение, dpi',1,9600],maxColors:['Максимум цветов',1,32],bleed:['Вылет, мм',0,100],letter:['Высота букв, мм',0,100],inkMax:['Сумма CMYK, %',0,400],tintMin:['Минимальная плотность, %',0,100],tintMax:['Максимальная плотность, %',0,100]};
export function validateSettings(value){
 if(!value||value.version!==1||!value.methods||typeof value.methods!=='object'||Array.isArray(value.methods))throw Error('Неверный формат настроек.');
 const out={version:1,methods:{}};
 for(const [code,v]of Object.entries(value.methods)){
  if(!Object.hasOwn(PRINT_REQUIREMENTS,code))throw Error('Неизвестное нанесение: '+code);
  if(!v||typeof v!=='object'||Array.isArray(v))throw Error('Неверная запись '+code);
  for(const k of ['checks','values'])if(v[k]!==undefined&&(!v[k]||typeof v[k]!=='object'||Array.isArray(v[k])))throw Error('Неверная структура '+code+'.'+k);
  const m={enabled:true,checks:{},values:{}};
  if(v.enabled!==undefined){if(typeof v.enabled!=='boolean')throw Error('Неверный переключатель '+code);m.enabled=v.enabled;}
  for(const [k,b]of Object.entries(v.checks||{})){if(!Object.hasOwn(CHECKS,k)||typeof b!=='boolean')throw Error('Неверная проверка '+code+'.'+k);m.checks[k]=b;}
  for(const [k,n]of Object.entries(v.values||{})){const p=Object.hasOwn(PARAMETERS,k)?PARAMETERS[k]:null;if(!p||typeof n!=='number'||!Number.isFinite(n)||n<p[1]||n>p[2]||k==='maxColors'&&!Number.isInteger(n))throw Error('Недопустимое значение '+code+'.'+k);m.values[k]=n;}
  if(v.palette!==undefined){if(typeof v.palette!=='string'||v.palette.length>200)throw Error('Неверная палитра');m.palette=v.palette;}
  if(v.colorPolicy!==undefined){if(!['','black-white','single-color','black-gray'].includes(v.colorPolicy))throw Error('Неверный режим цветности');m.colorPolicy=v.colorPolicy;}
  out.methods[code]=m;
 }return out;
}
let configuration={version:1,methods:{}},storageError='';
try{const raw=globalThis.localStorage?.getItem(SETTINGS_KEY);if(raw)configuration=validateSettings(JSON.parse(raw));}catch{storageError='Сохранённые настройки недоступны или повреждены. Применены исходные параметры с охранным полем 0 мм.';}
export const settingsProblem=()=>storageError;
export const getSettings=()=>JSON.parse(JSON.stringify(configuration));
export function saveSettings(value){const next=validateSettings(value);globalThis.localStorage.setItem(SETTINGS_KEY,JSON.stringify(next));configuration=next;storageError='';globalThis.dispatchEvent?.(new Event('gwb-method-settings-change'));}
export function configureRule(rule,settings=configuration){
 if(!rule)return null;const override=settings.methods[rule.code]||{},checks=Object.fromEntries(Object.keys(CHECKS).map(k=>[k,override.checks?.[k]!==false]));
 const out={...rule,guard:0,guardLong:0,guardShort:0,...override.values,settings:{enabled:override.enabled!==false,checks,custom:!!settings.methods[rule.code]}};
 if(override.palette!==undefined)out.palette=override.palette;
 if(override.colorPolicy!==undefined)out.colorPolicy=override.colorPolicy||undefined;
 if(Object.hasOwn(override.values||{},'negative'))delete out.negativeRange;
 if(out.unresolvedConditions)out.unresolvedConditions=out.unresolvedConditions.map(c=>Object.fromEntries(Object.entries(c).filter(([k])=>k==='when'||!Object.hasOwn(override.values||{},k)))).filter(c=>Object.keys(c).length>1);
 // Explicit overrides take precedence over conditional source thresholds.
 return out;
}
export function checkEnabled(rule,id){if(!rule?.settings)return true;const {enabled,checks}=rule.settings;if(!enabled)return id==='method';
 const group=id.startsWith('condition-')?'advisory':({ 'outlined-text':'text',effects:'effects','raster-alpha':'effects','hidden-content':'hidden','raster-dpi':'resolution',palette:'colors','rgb-color-model':'colors','ink-limit':'colors',monochrome:'colors','engraving-cmyk':'colors',colors:'colors','metalsticker-colors':'colors',ink:'colors',positive:'positive','positive-coverage':'positive',negative:'negative','detail-scan':'details','detail-coverage':'details','field-boundary':'boundary',guard:'guard',bleed:'bleed',strokes:'contours','closed-contours':'contours',intersections:'contours',letter:'advisory','method-note':'advisory','article-specific':'advisory'})[id];return !group||checks[group];}
export function detailRule(rule){if(!rule)return null;return {...rule,positive:checkEnabled(rule,'positive')?rule.positive:0,negative:checkEnabled(rule,'negative')?rule.negative:0,isolated:rule.settings?.enabled!==false&&rule.settings?.checks.isolated!==false?rule.isolated:0};}
