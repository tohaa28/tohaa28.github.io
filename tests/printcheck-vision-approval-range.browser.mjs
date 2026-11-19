// Fully synthetic 3-number range: approved, unchecked, nonexistent.
// Real customer data and production servers are never accessed.
import assert from 'node:assert/strict';
import {mkdtemp,cp,readFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {chromium} from 'playwright';
import {createServer} from 'node:http';

const ext=await mkdtemp(path.join(os.tmpdir(),'vision-range-ext-'));
const profile=await mkdtemp(path.join(os.tmpdir(),'vision-range-profile-'));
for(const name of ['manifest.json','service-worker.js','content-transport.js','vision-order-launcher.js','zip-offscreen.html','zip-offscreen.js'])
 await cp(path.resolve('vision/orders/extension',name),path.join(ext,name));
for(const name of ['vision-order-overlay.js','vision-order-approval.js'])
 await cp(path.resolve(name),path.join(ext,name));
const list='http://psk.testgifts.local/devorders?status=140';
const first='http://testgifts.local/private/order/3200000';
const second='http://testgifts.local/private/order/3200001';
const third='http://testgifts.local/private/order/3200002';
const fourth='http://testgifts.local/private/order/3200003';
const fifth='http://testgifts.local/private/order/3200004';
const image='http://files.testgifts.local/maketadjusting/11313/3200000/77/capture.png';
const listing='<html><body><table><tbody><tr><td>'+
 '<a href="'+first+'">3200000</a></td></tr></tbody></table></body></html>';
const png=Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0,0,0,0,0]);
const html=(num,approved)=>'<html><body>'+
 '<div id="j_cart_host" data-orderid="550">'+
 '<ul class="cart-header"><li class="cart-header-number">Заказ №'+
 '<span data-clipboard-text="'+num+'">'+num+'</span>'+
 '<div class="note">Клиент Тестовый</div></li></ul>'+
 '<ul class="cart-log"><li><label><input type="checkbox" '+
 'class="j_toggle_status" data-id="59" disabled hidden '+
 (approved?'checked ':'')+'>'+
 '<span class="btn btn--toggle"><span class="on">ТЗ утверждено</span>'+
 '<span class="off">ТЗ утверждено</span></span></label></li></ul>'+
 '<li data-itemid="77"><div class="cart-tbl-id">'+
 '<a class="cart-tbl-name" href="http://testgifts.local/id/121">Артикул TEST.21</a>'+
 '<div class="cart-tbl-lbl vsbl-dk-lg">Синтетическая медаль</div></div>'+
 '<div class="cart-tbl-imp">UV2 0,15 мм</div>'+
 '<a class="j_maketadjusting"><span class="gifts-badge">2</span></a></li>'+
 '</div><script>'+
 'window.nativeClicks=0;window.approved='+JSON.stringify(approved)+';'+
 "document.querySelector('a.j_maketadjusting').addEventListener('click',event=>{"+
 "event.preventDefault();window.nativeClicks++;"+
 "const modal=document.createElement('g-modal');"+
 "modal.innerHTML='<form id=\"j_maketAdjustingForm\">"+
 "<input type=\"hidden\" name=\"oiid\" value=\"77\">"+
 "<label><input type=\"checkbox\" name=\"ma_problem[]\" value=\"55\" checked>Тонкие линии</label></form>"+
 "<div id=\"j_maketadjustingcomments_counter\">2</div>"+
 "<ul id=\"j_maketadjusting_comments_list\">"+
 "<li><div class=\"comment_wrap\"><div class=\"flex-main\">"+
 "Синтетический дефект <g-gallery></g-gallery></div>"+
 "<div class=\"comment_info\">Дизайнер Тестовый</div></div></li>"+
 "<li><div class=\"comment_wrap\"><div class=\"flex-main\">"+
 "Синтетический ответ.</div>"+
 "<div class=\"comment_info\">Менеджер Тестовый</div></div></li></ul>';"+
 "document.body.append(modal);"+
 "const gallery=modal.querySelector('g-gallery');"+
 "gallery.attachShadow({mode:'open'}).innerHTML='<section><picture>"+
 "<img src=\""+image+"\"></picture></section>';"+
 "modal.setAttribute('visible','');});"+
 '</script></body></html>';
const requests=[];
const proxy=createServer((req,res)=>{
 const url=req.url.startsWith('http://')?req.url:
  'http://'+req.headers.host+req.url;
 let status=404,type='unexpected',body=Buffer.from('not found'),mime='text/html; charset=utf-8';
 if(new URL(url).pathname==='/favicon.ico'){
  res.writeHead(204);res.end();return;
 }
 if(url===list){type='list';status=200;body=Buffer.from(listing)}
 else if(url===first){
  type='approved';status=200;body=Buffer.from(html('3200000',true))
 }else if(url===second){
  type='unchecked';status=200;body=Buffer.from(html('3200001',false))
 }else if(url===third){type='not-found';status=404}
 else if(url===fourth){type='server-failed';status=502}
 else if(url===fifth){type='unreadable';status=200;
  body=Buffer.from('<html><body>Missing cart</body></html>')}
 else if(url===image){
  type='image';status=200;body=png;mime='image/png'
 }
 requests.push({type,method:req.method,url,at:Date.now()});
 res.writeHead(status,{'content-type':mime,'content-length':body.length,
  'cache-control':'no-store'});res.end(body);
});
await new Promise(resolve=>proxy.listen(0,'127.0.0.1',resolve));
const readZip=bytes=>{
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 let offset=0;const files=new Map();
 while(offset+30<=bytes.length&&view.getUint32(offset,true)===0x04034b50){
  const size=view.getUint32(offset+18,true);
  const n=view.getUint16(offset+26,true),extra=view.getUint16(offset+28,true);
  const name=new TextDecoder().decode(bytes.subarray(offset+30,offset+30+n));
  const start=offset+30+n+extra;
  files.set(name,bytes.subarray(start,start+size));
  offset=start+size;
 }
 return files;
};
let browser;
try{
 browser=await chromium.launchPersistentContext(profile,{
  channel:'chromium',headless:true,acceptDownloads:true,
  args:['--disable-extensions-except='+ext,'--load-extension='+ext,
   '--proxy-server=http://127.0.0.1:'+proxy.address().port,
   '--proxy-bypass-list=<-loopback>']
 });
 const downloads=[],errors=[];
 browser.on('serviceworker',w=>{
  w.on('console',m=>console.log('MV3_ZIP_WORKER',m.type(),m.text()));
  w.on('close',()=>console.log('MV3_ZIP_WORKER_CLOSED'));
 });
 browser.on('page',p=>{
  p.on('download',d=>downloads.push(d));
  p.on('pageerror',e=>errors.push(String(e)));
 });
 const page=await browser.newPage();
 await page.goto(list);
 await page.locator('.vlo-range').waitFor({timeout:15000});
 const inputs=page.locator('.vlo-range input');
 await inputs.nth(0).fill('3200000');
 await inputs.nth(1).fill('3200004');
 await inputs.nth(2).fill('1000');
 await page.locator('.vlo-range button').filter({hasText:'Старт / продолжить'}).click();
 // Change rate *after* scanning starts. The next request must respect it
 // without resetting the cursor, losing the original ZIP or restarting.
 await page.waitForFunction(()=>
  (document.querySelector('.vlo-range p:last-child')?.textContent||'')
   .includes('Последняя проверка: 3200000'),null,{timeout:20000});
 await inputs.nth(2).fill('2300');
 await page.waitForFunction(()=>
  (document.querySelector('.vlo-range p:last-child')?.textContent||'')
   .includes('Новая задержка 2300 мс'),null,{timeout:5000});
 await page.waitForFunction(()=>
  (document.querySelector('.vlo-range p:last-child')?.textContent||'')
   .includes('Последняя проверка: 3200001'),null,{timeout:12000});
 await inputs.nth(2).fill('1500');
 await page.waitForFunction(()=>
  (document.querySelector('.vlo-range p:last-child')?.textContent||'')
   .includes('Новая задержка 1500 мс'),null,{timeout:5000});
 // Reload after the approved article and two skipped numbers, BEFORE its
 // ZIP has been downloaded. The binary image, private discussion and cursor
 // must survive because the website refreshes the list every five minutes.
 await page.waitForFunction(()=>
  (document.querySelector('.vlo-range p:last-child')?.textContent||'')
   .includes('Последняя проверка: 3200002'),null,{timeout:15000});
 const journalBefore=await page.evaluate(()=>new Promise((resolve,reject)=>{
  const req=indexedDB.open('vision-ai-approved-range-pending-v1');
  req.onerror=()=>reject(Error('IDB open failed'));
  req.onsuccess=()=>{
   const db=req.result,tx=db.transaction(['journal','orders'],'readonly');
   const state=tx.objectStore('journal').get('active');
   const orders=tx.objectStore('orders').getAll();
   tx.oncomplete=()=>{
    resolve({cursor:state.result?.cursor,mode:state.result?.mode,
     pending:state.result?.pending_registry?.length,
     orders:orders.result?.length,
     binary_parts:orders.result?.[0]?.transfers?.length});
    db.close();
   };
   tx.onerror=()=>reject(Error('IDB read failed'));
  };
 }));
 assert.equal(journalBefore.cursor,3200003);
 assert.equal(journalBefore.mode,'running');
 assert.equal(journalBefore.pending,1);
 assert.equal(journalBefore.orders,1);
 assert.ok(journalBefore.binary_parts>=2,'final evidence and screenshot persist');
 await page.reload();
 await page.locator('.vlo-range').waitFor({timeout:15000});
 // No user click: running journal automatically resumes after the reload.
 await page.waitForFunction(()=>{
  const t=document.querySelector('.vlo-range p:last-child')?.textContent||'';
  return t.includes('Диапазон полностью проверен.')||t.includes('Ошибка:');
 },null,{timeout:18000}).catch(async(error)=>{
  const info={panel:await page.locator('.vlo-range').innerText(),
   requests:requests.map(x=>({type:x.type,method:x.method})),
   downloads:downloads.map(x=>x.suggestedFilename())};
  try{
   const worker=browser.serviceWorkers().find(w=>w.url().endsWith('/service-worker.js'));
   info.downloadStates=worker?await worker.evaluate(async()=>(
    await chrome.downloads.search({})
   ).filter(x=>x.id).map(x=>({
    id:x.id,name:String(x.filename||'').split(/[\\/]/).at(-1),
    mime:x.mime,url:x.url,state:x.state,
    totalBytes:x.totalBytes,fileSize:x.fileSize
   }))):'NO_WORKER';
  }catch(e){info.downloadDebugError=String(e)}
  console.log('VISION_RANGE_REFRESH_DEBUG',JSON.stringify(info));
  throw error;
 });
 const progress=await page.locator('.vlo-range').innerText();
 assert.match(progress,/Диапазон полностью проверен\./,progress);
 assert.equal(requests.filter(x=>x.type==='approved').length,2,
  'approved card GET preflight + native approved order');
 assert.equal(requests.filter(x=>x.type==='unchecked').length,1,
  'unapproved order only one GET, no modal or hidden page');
 assert.equal(requests.filter(x=>x.type==='not-found').length,1);
 assert.equal(requests.filter(x=>x.type==='server-failed').length,1,
  'HTTP 502 did not halt enumeration');
 assert.equal(requests.filter(x=>x.type==='unreadable').length,1,
  'HTML without order card also did not halt enumeration');
 const tOf=kind=>requests.find(x=>x.type===kind)?.at;
 assert.ok(tOf('unchecked')-tOf('image')>=1950,
  'live 2300ms delay must be reflected between approved and next order');
 assert.ok(tOf('not-found')-tOf('unchecked')>=1250,
  'live 1500ms delay must be reflected between next two probes');
 assert.ok(requests.some(x=>x.type==='image'));
 assert.ok(requests.every(x=>x.method==='GET'&&x.type!=='unexpected'));
 const swForZip=browser.serviceWorkers().find(w=>w.url().endsWith('service-worker.js'));
 assert.ok(swForZip);
 // ZIP is now created and downloaded by the extension service worker, not a
 // web page anchor. Playwright page.on('download') deliberately does not see
 // extension-owned downloads; Chrome Downloads API is authoritative instead.
 const completed=await swForZip.evaluate(async()=>(
  await chrome.downloads.search({})
 ).filter(x=>x.state==='complete'&&x.mime==='application/zip'&&
   x.url.startsWith('blob:chrome-extension://')).map(x=>({
   filename:x.filename,id:x.id,bytes:x.fileSize,danger:x.danger
 })));
 assert.equal(completed.length,1,'one verified extension-owned ZIP');
 const files=readZip(new Uint8Array(await readFile(completed[0].filename)));
 const manifest=JSON.parse(Buffer.from(files.get('manifest.json')).toString());
 assert.equal(manifest.counts.orders,1);
 assert.equal(manifest.counts.verified_files,1);
 const thread=JSON.parse(Buffer.from(
  files.get('orders/3200000/threads/77.json')).toString());
 assert.equal(thread.history[0].author_name,'Дизайнер Тестовый');
 assert.equal(thread.current_problems.length,1);
 const sw=browser.serviceWorkers().find(w=>w.url().endsWith('service-worker.js'));
 assert.ok(sw);
 const checkpoint=await sw.evaluate(async()=>(
  await chrome.storage.local.get('vision-ai-approved-range-checkpoint-v1')
 )['vision-ai-approved-range-checkpoint-v1']);
 assert.equal(checkpoint.committed_next,3200005);
 assert.equal(checkpoint.config.delay_ms,1500,
  'changed time persisted without clearing checkpoint or registry');
 assert.equal(checkpoint.checked_committed,5);
 assert.equal(checkpoint.found_committed,1);
 assert.equal(checkpoint.registry[0].order_number,'3200000');
 assert.deepEqual(checkpoint.failed_orders.map(row=>[row.order_number,row.reason]),[
  ['3200003','MANUAL_ORDER_HTTP_STATUS'],
  ['3200004','MANUAL_ORDER_CARD_MISSING']
 ]);
 // Later edit while idle must also persist, without forcing a range reset.
 await inputs.nth(2).fill('3100');
 await page.waitForFunction(()=>(
  document.querySelector('.vlo-range p:last-child')?.textContent||''
 ).includes('Новая задержка 3100 мс'),null,{timeout:5000});
 let edited;
 for(let retry=0;retry<20;retry++){
  edited=await sw.evaluate(async()=>(
   await chrome.storage.local.get('vision-ai-approved-range-checkpoint-v1')
  )['vision-ai-approved-range-checkpoint-v1']);
  if(edited?.config?.delay_ms===3100)break;
  await new Promise(resolve=>setTimeout(resolve,100));
 }
 assert.equal(edited.config.delay_ms,3100,
  'idle change persists without reset');
 assert.equal(edited.committed_next,3200005);
 assert.equal(edited.registry.length,1);
 assert.deepEqual(errors,[]);
 console.log('Vision M3.28 reload with unarchived binary, auto-resume and pacing PASS');
}finally{
 if(browser)await browser.close();
 await new Promise(resolve=>proxy.close(resolve));
 await rm(ext,{recursive:true,force:true});
 await rm(profile,{recursive:true,force:true});
}
