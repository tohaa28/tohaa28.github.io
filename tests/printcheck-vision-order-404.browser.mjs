// Offline Chromium reproduction: two 404 artwork GETs lead to ONE popup
// recheck, different anonymous reference states, no retry/download fallback.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const bundle=await readFile('vision-order-overlay.js','utf8');
const local='http://psk.testgifts.local';
const script='https://tohaa28.github.io/gifts-layout-workbench-vision/vision-order-overlay.js';
const row='<table><thead><tr><th>Заказ</th></tr></thead><tbody>'+
  '<tr><td><a href="/private/order/8001555">8001555</a></td></tr>'+
  '</tbody></table>';
const original='<div id="j_cart_host" data-orderid="771"></div>';
const full='<div><div class="flex-item flex-main"><a data-maket="true" href="/cart/act/mda?oid=771&id=42">a.pdf</a><span title="Исходное имя закачанного файла">Private A.pdf</span></div>'+
  '<div class="flex-item flex-main"><a data-maket="true" href="/cart/act/mda?oid=771&id=43">b.pdf</a><span title="Исходное имя закачанного файла">Private B.pdf</span></div></div>';
const still='<div><div class="flex-item flex-main"><a data-maket="true" href="/cart/act/mda?oid=771&id=42">a.pdf</a></div></div>';
const browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext({acceptDownloads:true});
 const page=await context.newPage();
 let cards=0,popups=0,files=0;
 const forbidden=[];
 await page.route('**/*',route=>{
  const u=route.request().url();
  if(u===local+'/devorders?status=140')
   return route.fulfill({status:200,contentType:'text/html',body:row});
  if(u===script)
   return route.fulfill({status:200,contentType:'application/javascript',body:bundle});
  if(u===local+'/private/order/8001555'){
   cards++;return route.fulfill({status:200,contentType:'text/html',body:original});
  }
  if(u===local+'/ajax/gifts/order?action=makets_popup&oid=771'){
   popups++;
   return route.fulfill({status:200,contentType:'application/json',
     body:JSON.stringify({html:popups===1?full:still})});
  }
  if(u===local+'/cart/act/mda?oid=771&id=42'||
     u===local+'/cart/act/mda?oid=771&id=43'){
   files++;
   return route.fulfill({status:404,contentType:'text/html',body:'SECRET CUSTOMER ERROR'});
  }
  forbidden.push(u);return route.abort();
 });
 await page.goto(local+'/devorders?status=140');
 await page.addScriptTag({url:script});
 assert.equal(cards+files+popups,0,'No implicit file requests before explicit action');
 await page.locator('[data-vision-order-cell] button').click();
 await page.waitForFunction(()=>document.querySelector('[data-vision-order-cell] .vlo-label')
    ?.textContent?.includes('2 требуют ручной проверки'),null,{timeout:15000});
 assert.equal(cards,1);
 assert.equal(popups,2,'Initial popup and exactly one fresh reference recheck');
 assert.equal(files,2,'No retry of original 404s or guessed alternative endpoints');
 const downloaded=page.waitForEvent('download');
 await page.locator('#vision-local-order-overlay button').filter({hasText:'Отчёт JSON'}).click();
 const report=JSON.parse(await readFile(await (await downloaded).path(),'utf8'));
 const artifacts=report.rows[0].artifacts;
 assert.deepEqual(artifacts.map(x=>x.reference_state),
   ['STILL_LISTED_IN_POPUP','MISSING_FROM_POPUP']);
 assert.deepEqual(artifacts.map(x=>x.http_status),[404,404]);
 assert.ok(artifacts.every(x=>x.reason==='ARTWORK_HTTP_ERROR'));
 const safe=JSON.stringify(report);
 assert.equal(safe.includes('Private A.pdf'),false);
 assert.equal(safe.includes('Private B.pdf'),false);
 assert.equal(safe.includes('/cart/act/mda'),false);
 assert.equal(safe.includes('SECRET CUSTOMER ERROR'),false);
 assert.equal(safe.includes('8001555'),false);
 assert.deepEqual(forbidden,[]);
 await context.close();
 console.log('Vision 404 reference recheck: one popup, zero retry, categorical private JSON PASS');
}finally{await browser.close()}
