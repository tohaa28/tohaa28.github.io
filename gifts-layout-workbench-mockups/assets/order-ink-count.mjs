// Compare print separations in an ORIGINAL logo with the inks selected for a
// specific application/place in a gifts.ru order. Never infer inks from the
// product colour, a CMYK screen preview, an unbound field or an unknown note.
const tokens=/\b(?:black|white|red|green|blue|yellow|cyan|magenta|orange|purple|violet|brown|gray|grey|gold|silver|pantone|ral|spot|ink|color|colour)\b|(?:черн|чёрн|бел|красн|син|голуб|зелен|зелён|желт|жёлт|оранж|фиолет|пурпур|бирюз|коричнев|сер|золот|серебр|бронз|розов|бордов|бежев|малинов|прозрачн.{0,15}лак|пантон|краск|цвет(?:а|ов|ом|\s*№|\s*#|\s*\d))/i;
const notInks=/(?:подложк|основ[аы]|фон\b|подложка\s*под|цвет\s*издел|\bcmyk\b|\brgb\b|полноцвет|градиент|микс|разноцвет|цветность)/i;
const clean=x=>String(x||'').replace(/\s+/g,' ').trim();
const validInk=part=>{
 const t=clean(part);
 if(!t||notInks.test(t)||/^\d+(?:[.,]\d+)?\s*(?:мм|mm|см|cm)$/i.test(t))return false;
 return tokens.test(t)||/^(?:#(?:[\da-f]{3}|[\da-f]{6})|pms\s*\d{2,4}|\d{2,4}\s*[cuh])$/i.test(t);
};
export function orderInkCountFromPlace(place){
 const text=clean(place);
 const explicit=text.match(/(?:количество\s*(?:цветов|красок)|(?:цветов|красок)\s*в\s*нанесении)\s*[:=–-]\s*(\d{1,2})\b/i);
 const digits=text.match(/(?:^|[^\d])(\d{1,2})\s*(?:цвет(?:а|ов)?|краск(?:а|и|ок))(?=$|[^\p{L}])/iu);
 const number=explicit||digits;
 if(number&&Number(number[1])>=1&&Number(number[1])<=32)
   return {count:Number(number[1]),source:'order-explicit-count',raw:number[0],colors:[]};
 const brackets=[...text.matchAll(/\[([^\[\]]+)\]/g)];
 for(const m of brackets){
   const raw=clean(m[1]),parts=raw.split(/\s*[;,]\s*/).filter(Boolean);
   if(parts.length&&parts.every(validInk))
     return {count:parts.length,source:'order-place-inks',raw,colors:parts};
   if(parts.some(validInk)||notInks.test(raw))
     return {count:null,source:'ambiguous-order-colors',raw,colors:[],reason:'В списке заказа есть непонятные обозначения красок/подложки.'};
 }
 return {count:null,source:'order-colors-absent',raw:text,colors:[],reason:'В выбранном месте заказа нет однозначного списка или количества красок.'};
}
export function compareOrderInkCount(rule,facts,place,{bindingReliable=true}={}){
 if(rule?.orderColorPolicy!=='match')return [];
 const order=orderInkCountFromPlace(place);
 const base={id:'order-colors',required:order.count,orderColors:order.colors,orderSource:order.source,orderText:order.raw,source:'gifts.ru: выбранное место нанесения'};
 const finding=(status,text,extra={})=>[{...base,status,text,...extra}];
 if(!bindingReliable)return finding('manual','Не удалось надёжно сопоставить поле с местом нанесения заказа. Количество цветов заказа не подтверждено.');
 if(order.count===null)return finding('manual','Количество цветов заказа не определено: '+order.reason+' Выберите правильное место нанесения и проверьте заказ.');
 const vector=facts?.vectorColors,pixel=facts?.pixelColors;
 const completeVector=!!vector?.complete&&vector.separationsComplete!==false&&!facts?.hasRaster&&!(facts?.rasters||[]).length&&facts?.artworkType!=='mixed'&&facts?.artworkType!=='raster';
 const actual=Number(vector?.count)||0,minimum=Number(pixel?.provenInkCount)||0;
 if(completeVector&&actual>0)
   return finding(actual===order.count?'ok':'bad',
     `Цвета логотипа: ${actual}; в заказе для этого места: ${order.count}. ${actual===order.count?'Количество совпадает.':'Количество не совпадает с заказом.'}`,
     {actual,certainty:'vector-source'});
 if(minimum>order.count)
   return finding('bad',`В макете найдено не менее ${minimum} разных цветовых групп, а в заказе для места «${clean(place)}» указано ${order.count}. Требуется исправление цветоделений.`,
     {actual:minimum,certainty:'proven-minimum'});
 return finding('manual',`В заказе указано ${order.count} ${order.count===1?'краска':order.count<5?'краски':'красок'}, но точное количество исходных печатных цветов ${facts?.artworkType==='raster'||facts?.hasRaster?'растрового':'PDF/смешанного'} макета автоматически не подтверждено. Сверьте цветоделения.`,
   {actual:actual||pixel?.count||null,certainty:'unverified'});
}

/**
 * Order-driven artwork rule. Only an actual, enumerated list of printing inks
 * (such as "[черный(Black); белый(White)]") triggers the vector-only gate.
 * A count like "2 цвета" does not enumerate inks. Neither an item's product
 * color nor another field's order note is suitable evidence.
 */
export function orderArtworkRequirement(place,{bindingReliable=true}={}){
 const ink=orderInkCountFromPlace(place);
 if(ink.source==='order-place-inks'&&ink.count>0){
   if(!bindingReliable)return {policy:'unknown',reason:'binding-unverified',inks:ink};
   return {policy:'vector-only',reason:'order-inks-listed',inks:ink};
 }
 if(ink.source==='ambiguous-order-colors')
   return {policy:'unknown',reason:'order-inks-ambiguous',inks:ink};
 return {policy:'any',reason:ink.source==='order-explicit-count'?'count-without-ink-list':'no-ink-list',inks:ink};
}
