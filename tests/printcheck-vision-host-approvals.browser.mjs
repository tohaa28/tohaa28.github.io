// Synthetic explicit TXT list: one old approved ID, unapproved, missing and errors.
// No real customer data or external hosts.
import assert from 'node:assert/strict';
import {mkdtemp,cp,readFile,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {chromium} from 'playwright';
import {createServer} from 'node:http';

const ext=await mkdtemp(path.join(os.tmpdir(),'vision-file-list-ext-'));
const profile=await mkdtemp(path.join(os.tmpdir(),'vision-file-list-profile-'));
for(const name of ['manifest.json','service-worker.js','content-transport.js','vision-order-launcher.js','archive-registry.js','scanner-host.html','scanner-transport.js','zip-offscreen.html','zip-offscreen.js'])
 await cp(path.resolve('vision/orders/extension',name),path.join(ext,name));
for(const name of ['scanner-host.js','vision-order-approval.js'])
 await cp(path.resolve(name),path.join(ext,name));
const list='http://psk.testgifts.local/devorders?status=140';
const first='http://testgifts.local/private/order/2999999';
const second='http://testgifts.local/private/order/3200000';
const third='http://testgifts.local/private/order/3200001';
const fourth='http://testgifts.local/private/order/3200002';
const fifth='http://testgifts.local/private/order/3200003';
const image='http://files.testgifts.local/maketadjusting/11313/2999999/77/capture.png';
const listing='<html><body><table><tbody><tr><td>'+
 '<a href="'+first+'">2999999</a></td></tr></tbody></table></body></html>';
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
 if(new URL(url).pathname==='/catalog'){type='catalog';status=200;body=Buffer.from('<html><body>Authorized synthetic catalog</body></html>')}
 else if(url===list){type='list';status=200;body=Buffer.from(listing)}
 else if(url===first){
  type='approved';status=200;body=Buffer.from(html('2999999',true))
 }else if(url===second){
  type='unchecked';status=200;body=Buffer.from(html('3200000',false))
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
 const portal=await browser.newPage();
 await portal.goto('http://psk.testgifts.local/catalog');
 await portal.locator('#vision-ai-scan-launcher').waitFor({timeout:15000});
 await portal.locator('#vision-ai-scan-launcher').click();
 let page=null;
 for(let i=0;i<100;i++){
  page=browser.pages().find(p=>p.url().includes('/scanner-host.html'));
  if(page)break;
  await portal.waitForTimeout(150);
 }
 assert.ok(page,'One extension-origin scanner host must be created');
 await page.locator('.vlo-file-list').waitFor({timeout:15000});
 const settings=await page.evaluate(()=>chrome.runtime.sendMessage({
  op:'vision-archive-settings-v1',action:'set',
  payload:{mode:'downloads',folder:'VisionAI'}
 }));
 assert.equal(settings?.status,'VISION_ARCHIVE_SETTINGS_SAVED');
 const input=page.locator('.vlo-file-list input[type=file]');
 const numbers='2999999\n3200000\n3200001\n3200002\n3200003\n2999999\n';
 await input.setInputFiles({name:'orders.txt',mimeType:'text/plain',
  buffer:Buffer.from(numbers)});
 await page.waitForFunction(()=>(
  document.querySelector('.vlo-file-list p:last-child')?.textContent||''
 ).includes('Уникальных номеров: 5'),null,{timeout:10000});
 const progress=page.locator('.vlo-file-list p:last-child');
 assert.match(await progress.innerText(),/удалено повторов: 1/);
 const rate=page.locator('.vlo-file-list input[type=number]');
 await rate.fill('1000');
 await page.locator('.vlo-file-list button')
  .filter({hasText:'Старт / продолжить по списку'}).click();
 await page.waitForFunction(()=>(
  document.querySelector('.vlo-file-list p:last-child')?.textContent||''
 ).includes('Последний проверенный номер: 3200001'),null,{timeout:25000});
 const stateBefore=await page.evaluate(()=>new Promise((resolve,reject)=>{
  const r=indexedDB.open('vision-ai-approved-file-list-v1');
  r.onerror=()=>reject(Error('IDB open'));
  r.onsuccess=()=>{
   const db=r.result,tx=db.transaction(['queue','state','pending'],'readonly');
   const q=tx.objectStore('queue').get('active');
   const s=tx.objectStore('state').get('active');
   const p=tx.objectStore('pending').getAll();
   tx.oncomplete=()=>{
    resolve({queue:[...q.result.numbers],state:s.result,
     pending:p.result.map(x=>({id:x.id,parts:x.transfers.length}))});
    db.close();
   };
   tx.onerror=()=>reject(Error('IDB transaction'));
  };
 }));
 assert.deepEqual(stateBefore.queue,
  [2999999,3200000,3200001,3200002,3200003]);
 assert.equal(stateBefore.state.index,3);
 assert.equal(stateBefore.state.mode,'running');
 assert.equal(stateBefore.state.archive_count,1,
  'v0.2.1 must save one approved order immediately, not wait for 100');
 assert.deepEqual(stateBefore.pending.map(x=>x.id),[],
  'once Chrome confirms a ZIP its payload leaves pending IDB');
 await page.reload();
 await page.locator('.vlo-file-list').waitFor({timeout:15000});
 await page.waitForFunction(()=>(
  document.querySelector('.vlo-file-list p:last-child')?.textContent||''
 ).includes('Список полностью проверен.'),null,{timeout:40000}).catch(async e=>{
  console.log('FILE_LIST_DEBUG',JSON.stringify({
   panel:await page.locator('.vlo-file-list').innerText(),
   req:requests.map(r=>r.type),
   downloads:downloads.map(x=>x.suggestedFilename())
  }));throw e;
 });
 const finalText=await progress.innerText();
 assert.match(finalText,/обработано: 5/);
 assert.match(finalText,/найдено и архивировано: 1/);
 assert.equal(requests.filter(r=>r.type==='approved').length,2,
  'approved item preflight + native GET, no duplicate from reload');
 assert.equal(requests.filter(r=>r.type==='unchecked').length,1);
 assert.equal(requests.filter(r=>r.type==='not-found').length,1);
 assert.equal(requests.filter(r=>r.type==='server-failed').length,4,
  'one initial HTTP 502 + three bounded retries, then next order');
 assert.equal(requests.filter(r=>r.type==='unreadable').length,1);
 assert.ok(requests.some(r=>r.type==='image'));
 assert.ok(requests.every(r=>r.method==='GET'&&r.type!=='unexpected'));
 const swForZip=browser.serviceWorkers().find(w=>w.url().endsWith('service-worker.js'));
 assert.ok(swForZip);
 const completed=await swForZip.evaluate(async()=>(
  await chrome.downloads.search({})
 ).filter(x=>x.state==='complete'&&x.mime==='application/zip'&&
   x.url.startsWith('blob:chrome-extension://')).map(x=>({
    filename:x.filename,id:x.id,url:x.url
   })));
 assert.equal(completed.length,1,'single extension-owned ZIP');
 const entries=readZip(new Uint8Array(await readFile(completed[0].filename)));
 const manifest=JSON.parse(Buffer.from(entries.get('manifest.json')).toString());
 assert.equal(manifest.counts.orders,1);
 assert.equal(manifest.counts.verified_files,1);
 const thread=JSON.parse(Buffer.from(
  entries.get('orders/2999999/threads/77.json')).toString());
 assert.equal(thread.history[0].author_name,'Дизайнер Тестовый');
 assert.equal(thread.current_problems.length,1);
 assert.ok(entries.has('orders/2999999/source/evidence.json'),
  'Original private order conversation must be inside the archive');
 console.log('Vision v0.2.1 host approved conversation, attachment, resume, ZIP PASS');
}finally{
 if(browser)await browser.close();
 await new Promise(resolve=>proxy.close(resolve));
 await rm(ext,{recursive:true,force:true});
 await rm(profile,{recursive:true,force:true});
}
