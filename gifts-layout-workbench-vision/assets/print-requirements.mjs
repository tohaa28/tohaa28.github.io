// Gifts.ru requirements, verified 2026-09-29. Units: mm at final production size.
// Null/absent thresholds mean unspecified, never a successful check.
export const REQUIREMENTS_VERSION = '2026-09-29.2';
export const SOURCES = Object.freeze({specifications:'https://gifts.ru/nanesenie-logotipa/specifications', problems:'https://gifts.ru/maket-problems'});
const rules = {};
function add(codes, name, values) {
  for (const code of codes.split(' ')) rules[code] = Object.freeze({code, name, minDpi:300, ...values});
}
add('B1 B2 B3 B4','Шелкография на текстиль',{positive:.3,negative:.4,isolated:.3,palette:'Pantone C',tintMin:20,conditions:[{when:'underbase',positive:.4},{when:'foilOrPuff',positive:.5,negative:.6},{when:'puff',maxColors:1}]});
add('D1 D2 D3 D4','Шелкография с трансфером',{positive:.3,negative:.3,isolated:.4,palette:'Pantone C',tintMin:20,conditions:[{when:'underbase',positive:.4}]});
add('SH1 SH2 SH3','Шелкография (1 цвет)',{positive:.3,negative:.3,isolated:.3,palette:'Pantone C',maxColors:1,notes:['Цветные и тёмные изделия: ограниченная палитра без подложки.']});
add('SHR','Круговая шелкография',{positive:.3,negative:.3,isolated:.3,maxColors:1,palette:'золото, серебро, прозрачный глянцевый лак'});
add('I1 I2 I3 IB1 IB2 IB3','Вышивка',{positive:1,negative:1,negativeRange:[1,1.2],letter:5,round:2,palette:'палитра ниток / Pantone C',conditions:[{when:'specialThread',positive:1.5,negative:2,letter:7}]});
add('IO1 IO2 IO3','Объёмная вышивка',{positive:2,negative:2,letter:10,round:4.5,palette:'палитра ниток / Pantone C'});
add('A0 A1 A2 A3 A4','Тампопечать',{positive:.1,negative:.15,palette:'Pantone C',notes:['Силикон: стандартные цвета без подложки, подбор Pantone недоступен.']});
add('AR1 AR2','Тампопечать на шары',{positive:.4,negative:.4,minDpi:160,recommendedDpi:300,tintMin:15,tintMax:85,palette:'Pantone C или CMYK (+ White)',conditions:[{when:'pantone',maxColors:2}],notes:['Для CMYK + White важные элементы рекомендованы от 2 мм.']});
add('H1 H2 H3','Деколь',{positive:.15,negative:.15,tintMin:20,palette:'Pantone C / Heraeus',notes:['Допуск цвета Pantone до 25%.']});
add('HC1 HC2','Холодная деколь',{positive:.2,negative:.25,tintMin:20,palette:'Pantone C'});
add('SB1 SB21 SB22 SBR1 SBR2 SB3','Сублимация',{positive:.25,negative:.3,tintMin:8,inkMax:330,palette:'CMYK'});
rules.SB3=Object.freeze({...rules.SB3,name:'Сублимация на лентах',guard:3,guardReference:'край ленты'});
add('LM1 LM2 LM3 LB1 LB2 LB3 LB4 LRM LSM','Лазерная гравировка по металлу',{positive:.1,negative:.2,palette:'цвет материала'});
add('LC1 LC2 LC3 LRC LSP LSC LUV1 LUV2 LUV3','Лазерная гравировка',{positive:.1,negative:.2,letter:2,palette:'цвет материала',conditions:[{when:'leatherFleeceNeoprene',positive:1,letter:5}]});
add('LRUV','Круговая UV-гравировка',{positive:.2,negative:.3,letter:2,palette:'цвет материала',conditions:[{when:'leatherFleeceNeoprene',positive:1,letter:5}]});
for(const code of ['LSM','LSP','LSC']) rules[code]=Object.freeze({...rules[code],guard:2,guardReference:'край шильда'});
add('T1','Тиснение бесцветное',{positive:.2,negative:.3,guard:18,guardReference:'край изделия',palette:'цвет материала',closedContours:true,noStrokes:true,noIntersections:true});
add('T2','Тиснение фольгой',{positive:.3,negative:.5,guard:18,guardReference:'край изделия',palette:'цвет материала / фольги',closedContours:true,noStrokes:true,noIntersections:true});
add('T3','Микротиснение фольгой',{textureElement:2,textureGap:.5,textureBoundary:.3,textureInset:.3,maxTextures:3,conditions:[{when:'customTexture',positive:.3,negative:.3}],notes:['Не более трёх текстур на клише по согласованию.']});
add('M1 M2 M3','Цифровая печать на вставке',{positive:.15,tintMin:10,palette:'CMYK'});
rules.M3=Object.freeze({...rules.M3,guard:5,guardReference:'край циферблата',bleed:2});
add('UV1 UV2 UV3 UVR UVP','УФ-печать',{positive:.15,negative:.15,tintMin:20,palette:'CMYK (+ White)',conditions:[{when:'softTouch',positive:.5,negative:.5},{when:'fineDetail',minDpi:600}],notes:['Для мелких элементов 600–1200 dpi.']});
add('UVRL','Круговая УФ-печать с лаком',{positive:.15,negative:.2,tintMin:20,palette:'CMYK (+ White)',conditions:[{when:'softTouch',positive:.5,negative:.5}]});
for(const [code,width] of [['F1',1],['F2',2],['F3',3]]) add(code,'Флекс',{positive:width,negative:width,isolated:3,maxColors:1,palette:'каталог плёнок'});
add('FS','Флекстран',{positive:1.5,negative:1.5,letter:5,maxColors:1,palette:'каталог'});
add('SL1 SL2 PS1','Наклейка',{positive:.15,negative:.2,tintMin:10,inkMax:330,palette:'CMYK',guard:2,guardReference:'линия реза',bleed:2,notes:['Белая основа.']});
add('DTG1 DTG2 DTG3','Печать DTG',{positive:.3,tintMin:15,palette:'CMYK (+ White)'});
add('DTF1 DTF2 DTF3 DTF4','Печать DTF',{positive:.6,negative:.6,isolated:2,tintMin:15,palette:'CMYK (+ White)',conditions:[{when:'paperCardboard',positive:1.5}],notes:['Бумага и картон: линии и отдельные элементы от 1,5 мм; более тонкие — на плашках.']});
add('DTF-F','Печать DTF с эффектами',{positive:1.2,negative:1.2,isolated:2,palette:'золото, серебро',conditions:[{when:'combinedDtf',foilOutline:4}]});
add('UV-DTF1 UV-DTF2','УФ-DTF печать',{positive:.6,negative:.6,isolated:2,tintMin:15,palette:'CMYK (+ White)'});
add('MS1 MS2','Металстикер',{positive:.1,negative:.2,palette:'чёрный — глянец; серый — матовая поверхность',notes:['Элементы менее 3 мм соединяются с соседними линией до 0,1 мм.']});
add('RP1 RP2 RP3','Печать на лентах (1 цвет)',{positive:.25,negative:.3,maxColors:1,guardLong:2,guardShort:20,guardReference:'край ленты / линия реза'});
// The strict laser mask policy is the project owner's explicit requirement.
// Gifts states that the resulting engraving color depends on the material.
for(const code of 'LM1 LM2 LM3 LB1 LB2 LB3 LB4 LRM LSM LC1 LC2 LC3 LRC LSP LSC LUV1 LUV2 LUV3 LRUV'.split(' '))rules[code]=Object.freeze({...rules[code],colorPolicy:'black-white',colorPolicySource:'project:laser-black-white-user-requirement'});
for(const [code,rule] of Object.entries(rules))if(rule.maxColors)rules[code]=Object.freeze({...rule,colorPolicy:'single-color'});
for(const code of ['T1','T2'])rules[code]=Object.freeze({...rules[code],colorPolicy:'single-color',maxColors:1,colorPolicySource:'project:single-embossing-separation'});
for(const code of ['MS1','MS2'])rules[code]=Object.freeze({...rules[code],colorPolicy:'black-gray'});
export const PRINT_REQUIREMENTS = Object.freeze(rules);
export const CONDITION_LABELS = Object.freeze({underbase:'печать с подложкой',foilOrPuff:'фольга или вспенивающаяся краска',puff:'пуфф',specialThread:'специальные нитки',pantone:'палитра Pantone',leatherFleeceNeoprene:'натуральная кожа, флис или неопрен',customTexture:'индивидуальная текстура',softTouch:'покрытие Soft Touch',fineDetail:'мелкие элементы',paperCardboard:'бумага или картон',combinedDtf:'совмещение с полноцветной DTF'});
export function resolveMethod(value) {
  const raw=String(value||'').trim();
  // Whole tokens only: UV-DTF1 must not become DTF1 or UV1; printN is never a method.
  const tokens=raw.toUpperCase().match(/[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*/g)||[];
  const codes=[...new Set(tokens.filter(code=>rules[code]))];
  const unknown=tokens.filter(code=>/\d|^(?:DTF-F|UVR|UVRL|UVP|SHR|FS|LRM|LRC|LRUV|LSM|LSC|LSP)$/.test(code)&&!/^PRINT\d+$/.test(code)&&!rules[code]);
  if(codes.length===1&&!unknown.length) return {code:codes[0],rule:rules[codes[0]],source:'code'};
  if(codes.length||unknown.length) return {code:null,rule:null,reason:codes.length>1?'ambiguous':'unknown',candidates:codes};
  const exact=Object.values(rules).filter(r=>r.name.toLocaleLowerCase('ru')===raw.toLocaleLowerCase('ru'));
  // A name shared by multiple codes is not sufficient evidence for the selected variant.
  return exact.length===1?{code:exact[0].code,rule:exact[0],source:'exact-name'}:{code:null,rule:null,reason:exact.length?'ambiguous':'unknown',candidates:exact.map(r=>r.code)};
}
export function effectiveRule(rule, context={}) {
  if(!rule)return null;
  const result={...rule,unresolvedConditions:[]};
  for(const condition of rule.conditions||[]) {
    if(context[condition.when]===true) Object.assign(result,condition);
    else if(context[condition.when]!==false) result.unresolvedConditions.push(condition);
  }
  return result;
}
