// C3B.3.R: real headless Chromium + packaged local-only MV3 extension.
// No actual LAN access, customers, sessions or real test artwork in CI.
// Verifies cross-origin background service worker with exact test permissions.
import assert from 'node:assert/strict';
import {mkdtemp,cp,readFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {chromium} from 'playwright';
const extDir=await mkdtemp(path.join(os.tmpdir(),'vision-lan-mv3-'));
const profileDir=await mkdtemp(path.join(os.tmpdir(),'vision-lan-profile-'));
const files=['manifest.json','content-transport.js','service-worker.js'];
for(const file of files)
 await cp(path.resolve('vision/orders/extension',file),path.join(extDir,file));
await cp(path.resolve('vision-order-overlay.js'),path.join(extDir,'vision-order-overlay.js'));
const table='http://psk.testgifts.local';
const mirror='http://testgifts.local';
const listing='<!doctype html><html><head><meta charset="utf-8"></head><body>'+
 '<table><thead><tr><th>Заказ</th><th>Статус</th></tr></thead><tbody>'+
 '<tr><td><a href="'+mirror+'/private/order/8001111">8001111</a></td><td>140</td></tr>'+
 '</tbody></table></body></html>';
const order='<html><div id="j_cart_host" data-orderid="771"></div></html>';
const popup=JSON.stringify({html:'<div><h2>Загрузка макетов</h2>'+
 '<div class="flex-item flex-main"><a data-maket="true" href="/cart/act/mda?oid=771&id=42">synthetic.svg</a>'+
 '<span title="Исходное имя закачанного файла">Исходный  файл.SvG</span></div>'+
 '<a href="/drawing?action=getOrderItemPdf&orderitemid=4">reference.pdf</a></div>'});
const svg='<svg xmlns="http://www.w3.org/2000/svg" width="100mm" height="80mm" viewBox="0 0 100 80">'+
 '<path d="M10 20 H13 V65 H10 Z" fill="#123456"/>'+
 '<path d="M13.12 20 H16.12 V65 H13.12 Z" fill="#123456"/></svg>';
let context;
try{
 context=await chromium.launchPersistentContext(profileDir,{
  channel:'chromium',headless:true,acceptDownloads:true,
  args:['--disable-extensions-except='+extDir,'--load-extension='+extDir]
 });
 const workers=context.serviceWorkers();
 const worker=workers.find(w=>w.url().startsWith('chrome-extension://'))||
  await context.waitForEvent('serviceworker',{timeout:12000});
 assert.match(worker.url(),/^chrome-extension:\/\//);
 const requests=[];
 await context.route('**/*',route=>{
  const url=route.request().url();
  const method=route.request().method();
  if(url===table+'/devorders?status=140')
   return route.fulfill({status:200,contentType:'text/html;charset=utf-8',body:listing});
  if(url===mirror+'/private/order/8001111'){
   requests.push({kind:'order',method});
   return route.fulfill({status:200,contentType:'text/html;charset=utf-8',
    headers:{'Cache-Control':'no-store'},body:order});
  }
  if(url===mirror+'/ajax/gifts/order?action=makets_popup&oid=771'){
   requests.push({kind:'popup',method});
   return route.fulfill({status:200,contentType:'application/json',
    headers:{'Cache-Control':'no-store'},body:popup});
  }
  if(url===mirror+'/cart/act/mda?oid=771&id=42'){
   requests.push({kind:'artwork',method});
   return route.fulfill({status:200,contentType:'application/octet-stream',
    headers:{'Cache-Control':'no-store'},body:svg});
  }
  if(url.startsWith('chrome-extension:'))return route.continue();
  requests.push({kind:'unexpected',method});
  return route.abort();
 });
 const page=await context.newPage();
 const errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 await page.goto(table+'/devorders?status=140');
 await page.locator('[data-vision-order-cell]').waitFor({timeout:15000});
 assert.equal(await page.locator('[data-vision-order-cell]').count(),1);
 assert.equal(requests.length,0,'Extension must not fetch any order without explicit click');
 await page.locator('[data-vision-order-cell] button').click();
 await page.waitForFunction(()=>
  !!document.querySelector('.vision-order-result-cell .vlo-label')?.textContent
    ?.includes('исследованы'),null,{timeout:15000});
 const cell=await page.locator('[data-vision-order-cell]').innerText();
 assert.match(cell,/1 клиентских файлов, 1 конструкторов/);
 assert.match(cell,/SVG:/);
 assert.deepEqual(requests.map(x=>x.kind),['order','popup','artwork']);
 assert.ok(requests.every(x=>x.method==='GET'));
 assert.equal(page.url(),table+'/devorders?status=140');
 const saved=page.waitForEvent('download');
 await page.locator('#vision-local-order-overlay button').filter({hasText:'Отчёт JSON'}).click();
 const feedback=JSON.parse(await readFile(await (await saved).path(),'utf8'));
 assert.equal(feedback.rows[0].artifacts[0].type,'svg');
 assert.equal(JSON.stringify(feedback).includes('Исходный  файл.SvG'),false);
 assert.match(await page.locator('[data-vision-order-cell]').innerText(),/Исходный  файл.SvG/);
 assert.equal(feedback.rows[0].artifacts[0].status,'RESEARCH_ONLY');
 assert.equal(feedback.rows[0].artifacts[0].production_approved,false);
 assert.equal(JSON.stringify(feedback).includes('8001111'),false);
 // The private ZIP must use the same MV3 transport, not the page's
 // cross-origin browser fetch; its original UTF-8 basename is unchanged.
 await page.locator('[data-vision-order-cell] select').selectOption('expert_clear');
 page.once('dialog',async dialog=>dialog.accept());
 const localZip=page.waitForEvent('download');
 await page.locator('#vision-local-order-overlay button')
  .filter({hasText:'Локальные примеры ZIP'}).click();
 const zipBytes=await readFile(await (await localZip).path());
 assert.ok(zipBytes.includes(Buffer.from('samples/0001/Исходный  файл.SvG','utf8')));
 assert.deepEqual(requests.map(x=>x.kind),['order','popup','artwork','artwork']);
 assert.deepEqual(errors,[]);
 console.log('MV3 extension Chromium end-to-end: separate test origin order->popup->original SVG via restricted background fetch, anonymous report PASS');
}finally{
 if(context)await context.close();
 await rm(extDir,{force:true,recursive:true});
 await rm(profileDir,{force:true,recursive:true});
}
