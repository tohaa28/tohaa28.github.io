// Real Chromium integration of Maketnaya-equivalent test-site order route:
// listing row -> /private/order/<number> -> data-orderid -> makets_popup
// -> a[data-maket=true] /cart/act/mda, never drawing/template/delete/upload.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const bundle=await readFile('vision-order-overlay.js','utf8');
const src='https://tohaa28.github.io/gifts-layout-workbench-vision/vision-order-overlay.js';
const local='http://psk.testgifts.local';
const other='http://testgifts.local';
const svg='<svg xmlns="http://www.w3.org/2000/svg" width="100mm" height="80mm" viewBox="0 0 100 80">'+
 '<path d="M10 20 H13 V65 H10 Z" fill="#123456"/>'+
 '<path d="M13.12 20 H16.12 V65 H13.12 Z" fill="#123456"/></svg>';
const listing='<html><head><meta charset="utf-8"></head><body>'+
 '<table id="orders"><thead><tr><th>Заказ</th><th>Статус</th></tr></thead><tbody>'+
 '<tr><td><a href="/private/order/8001111">8001111</a></td><td>140</td></tr>'+
 '<tr><td><a href="'+other+'/private/order/8002222">8002222</a></td><td>140</td></tr>'+
 '<tr onclick="location.href=\u0027/private/order/8003333\u0027"><td>8003333</td><td>140</td></tr>'+
 '</tbody></table></body></html>';
const order='<html><body><section id="j_cart_host" data-orderid="771">'+
 '<li data-itemid="17"><span class="cart-tbl-name">16535.66</span></li>'+
 '</section></body></html>';
const popup='<div id="maketsPopup">'+
 '<h2>Загрузка макетов</h2>'+
 '<a data-maket="true" href="/cart/act/mda?oid=771&id=42">client-logo.svg</a>'+
 '<a data-maket="true" href="/cart/act/mda?oid=771&id=43">second.pdf</a>'+
 '<a data-maket="true" href="/cart/act/mda?oid=999&id=44">wrong-order.pdf</a>'+
 '<h2>Шаблоны макетов для выбранных нанесений</h2>'+
 '<a href="/drawing?action=getOrderItemPdf&orderitemid=909">template.pdf</a>'+
 '</div>';
const browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext({acceptDownloads:true});
 const page=await context.newPage();
 const requests=[];let forbidden=0;
 await page.route('**/*',route=>{
  const u=route.request().url();
  if(u===local+'/devorders?status=140')
   return route.fulfill({status:200,contentType:'text/html;charset=utf-8',body:listing});
  if(u===src)return route.fulfill({status:200,contentType:'application/javascript;charset=utf-8',body:bundle});
  if(u===local+'/private/order/8001111'){
   requests.push({u,method:route.request().method()});
   return route.fulfill({status:200,contentType:'text/html;charset=utf-8',body:order});
  }
  if(u===local+'/ajax/gifts/order?action=makets_popup&oid=771'){
   requests.push({u,method:route.request().method()});
   return route.fulfill({status:200,contentType:'application/json',
     body:JSON.stringify({html:popup})});
  }
  if(u===local+'/cart/act/mda?oid=771&id=42'){
   requests.push({u,method:route.request().method()});
   return route.fulfill({status:200,contentType:'application/octet-stream',body:svg});
  }
  if(u===local+'/cart/act/mda?oid=771&id=43'){
   requests.push({u,method:route.request().method()});
   return route.fulfill({status:200,contentType:'application/pdf',
     body:'%PDF-1.4\n'+('0'.repeat(125))});
  }
  if(u===other+'/private/order/8002222'){
   // Real cross-subdomain CORS failure simulated: no ACAO/ACAC headers.
   requests.push({u,method:route.request().method()});
   return route.fulfill({status:200,contentType:'text/html;charset=utf-8',
     body:order});
  }
  if(u===local+'/private/order/8003333'){
   requests.push({u,method:route.request().method()});
   return route.fulfill({status:200,contentType:'text/html;charset=utf-8',
     body:'<html><body>no internal id</body></html>'});
  }
  forbidden++;return route.abort();
 });
 await page.goto(local+'/devorders?status=140');
 await page.addScriptTag({url:src});
 assert.equal(await page.locator('[data-vision-order-cell]').count(),3);
 const first=page.locator('[data-vision-order-cell]').nth(0);
 assert.match(await first.locator('.vlo-detail').textContent(),/карточки заказа/);
 assert.equal(requests.length,0,'No order gets fetched automatically');
 await first.locator('button').click();
 await page.waitForFunction(()=>document.querySelectorAll('[data-vision-order-cell]')[0]
   ?.querySelector('.vlo-label')?.textContent?.includes('ручной проверки'),null,{timeout:15000});
 assert.match(await first.innerText(),/2 клиентских файлов, 1 конструкторов/);
 assert.match(await first.innerText(),/SVG: [1-9]/);
 assert.match(await first.innerText(),/PDF: ручная проверка/);
 assert.equal(requests.length,4);
 assert.ok(requests.every(r=>r.method==='GET'));
 assert.ok(requests.every(r=>!r.u.includes('drawing')&&!r.u.includes('upload')&&
  !r.u.includes('delete')&&!r.u.includes('oid=999')));
 await page.locator('[data-vision-order-cell]').nth(1).locator('button').click();
 await page.waitForFunction(()=>document.querySelectorAll('[data-vision-order-cell]')[1]
   ?.querySelector('.vlo-label')?.textContent?.includes('ручная проверка'),
   null,{timeout:15000});
 assert.match(await page.locator('[data-vision-order-cell]').nth(1).innerText(),
   /ORDER_DETAIL_FETCH_OR_CORS_FAILURE/);
 await page.locator('[data-vision-order-cell]').nth(2).locator('button').click();
 await page.waitForFunction(()=>document.querySelectorAll('[data-vision-order-cell]')[2]
   ?.querySelector('.vlo-label')?.textContent?.includes('ручная проверка'),
   null,{timeout:15000});
 assert.match(await page.locator('[data-vision-order-cell]').nth(2).innerText(),
   /ORDER_INTERNAL_ID_NOT_FOUND/);
 assert.equal(page.url(),local+'/devorders?status=140',
   'Vision inline controls must not bubble to order row navigation');
 await first.locator('select').selectOption('confirmed_defect');
 page.once('dialog',async d=>d.accept());
 const pending=page.waitForEvent('download');
 await page.locator('#vision-local-order-overlay button')
   .filter({hasText:'Локальные примеры ZIP'}).click();
 const zip=await readFile(await (await pending).path());
 assert.ok(zip.includes(Buffer.from('samples/0001.svg')));
 assert.ok(zip.includes(Buffer.from('samples/0002.pdf')));
 assert.ok(!zip.includes(Buffer.from('wrong-order.pdf')));
 assert.ok(!zip.includes(Buffer.from('template.pdf')));
 assert.equal(forbidden,0,'No cross-site request, untrusted upload or production Gifts URL');
 const late=requests.slice(4);
 assert.ok(late.every(r=>r.method==='GET'&&r.u.includes('/cart/act/mda?oid=771&id=')));
 await context.close();
 console.log('Order-detail first: row -> Maketnaya internal-id/popup -> original customer files, skip constructor, CORS MANUAL, private ZIP PASS');
}finally{await browser.close()}
