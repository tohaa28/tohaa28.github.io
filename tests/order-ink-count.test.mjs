import {test} from 'node:test';
import assert from 'node:assert/strict';
import {orderInkCountFromPlace,compareOrderInkCount} from '../assets/order-ink-count.mjs';
import {vectorColorEvidence} from '../assets/logo-color.mjs';

test('reads ink count from EXACT selected application in an order, not product or method description',()=>{
 const cases=[
  ['сторона b [черный(Black); белый(White)]',2],
  ['сторона а [черный(403/Black)]',1],
  ['спинка [синий(Pantone 286 C); красный(Pantone 485 C); белый(White)]',3],
  ['лицо [золото; серебро]',2],
  ['рукав, количество цветов: 2',2],
  ['крышка, 3 цвета',3],
  ['сторона а [черный(Black), белый(White)]',2]
 ];
 for(const [text,count] of cases)assert.equal(orderInkCountFromPlace(text).count,count,text);
 for(const text of ['лицо','кружка черная','сторона а [подложка; черный]','купол [подложка; черный]','лицо [CMYK]','сторона а [размер 30x20 мм]','футболка белая'])
   assert.equal(orderInkCountFromPlace(text).count,null,text);
});
test('checks exact equalities per selected field; a global maximum is a separate rule',()=>{
 const rule={orderColorPolicy:'match'};
 const facts={vectorColors:vectorColorEvidence(['rgb(255,0,0)','rgb(0,0,255)']),artworkType:'vector'};
 const one=compareOrderInkCount(rule,facts,'сторона а [черный(403/Black)]')[0];
 const two=compareOrderInkCount(rule,facts,'сторона b [черный(Black); белый(White)]')[0];
 const three=compareOrderInkCount(rule,facts,'сторона c [красный; синий; белый]')[0];
 assert.deepEqual([one.status,two.status,three.status],['bad','ok','bad']);
 assert.equal(one.required,1);assert.equal(two.required,2);assert.equal(three.required,3);
 assert.equal(two.actual,2);
 assert.deepEqual(compareOrderInkCount({orderColorPolicy:'off'},facts,'сторона а [черный]'),[]);
 assert.equal(compareOrderInkCount(rule,facts,'сторона b [черный; белый]',{bindingReliable:false})[0].status,'manual');
});
test('unclear order and unknown PDF/raster separations never get a false OK',()=>{
 const rule={orderColorPolicy:'match'};
 const vector={vectorColors:vectorColorEvidence(['rgb(0,0,0)','rgb(255,255,255)']),artworkType:'vector'};
 assert.equal(compareOrderInkCount(rule,vector,'лицо')[0].status,'manual');
 assert.equal(compareOrderInkCount(rule,vector,'лицо [черный; подложка]')[0].status,'manual');
 const pdf={vectorColors:{...vector.vectorColors,separationsComplete:false},artworkType:'vector'};
 assert.equal(compareOrderInkCount(rule,pdf,'лицо [черный; белый]')[0].status,'manual');
 const raster={pixelColors:{count:8,provenInkCount:3,visible:120},artworkType:'raster'};
 assert.equal(compareOrderInkCount(rule,raster,'лицо [красный; синий]')[0].status,'bad');
 assert.equal(compareOrderInkCount(rule,raster,'лицо [красный; синий; зеленый]')[0].status,'manual');
});
