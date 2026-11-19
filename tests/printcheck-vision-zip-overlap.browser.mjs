// Synthetic MV3 regression: a 100-order ZIP remains PENDING while two later
// order cards are still probed. Reload at the boundary must recover both.
import assert from 'node:assert/strict';
import {mkdtemp,cp,readFile,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {chromium} from 'playwright';
import {createServer} from 'node:http';
const ext=await mkdtemp(path.join(os.tmpdir(),'vision-overlap-ext-'));
const profile=await mkdtemp(path.join(os.tmpdir(),'vision-overlap-profile-'));
for(const file of ['manifest.json','service-worker.js','content-transport.js',
 'vision-order-launcher.js','zip-offscreen.html','zip-offscreen.js'])
 await cp(path.resolve('vision/orders/extension',file),path.join(ext,file));
for(const file of ['vision-order-overlay.js','vision-order-approval.js'])
 await cp(path.resolve(file),path.join(ext,file));
// This test-only MV3 service-worker copy deliberately withholds the
// completion acknowledgement for eight seconds. Production code unchanged.
const worker=path.join(ext,'service-worker.js');
let src=await readFile(worker,'utf8');
src=src.replace("const RANGE_DOWNLOAD_AUDIT='vision-range-download-audit-v1';",
 "let syntheticPendingUntil=0;\n"+
 "const RANGE_DOWNLOAD_AUDIT='vision-range-download-audit-v1';");
src=src.replace("   if(phase==='baseline'){\n", 
 "   if(phase==='baseline'){\n    syntheticPendingUntil=Date.now()+8000;\n");
src=src.replace("   respond({status,matched:matching.length});",
 "   respond({status:Date.now()<syntheticPendingUntil?"+
 "'RANGE_DOWNLOAD_PENDING':status,matched:matching.length});");
if(!src.includes("syntheticPendingUntil=Date.now()+8000"))
 throw Error('SYNTHETIC_AUDIT_PATCH_MISSING');
await writeFile(worker,src);
const BASE='http://psk.testgifts.local';
const SOURCE='http://testgifts.local';
const ids=Array.from({length:102},(_,i)=>3000000+i);
const orders=[],requests=[],downloads=[],errors=[];
const proxy=createServer((req,res)=>{
 let u;
 try{u=new URL(req.url)}catch{res.writeHead(400);res.end();return}
 if(u.href===SOURCE+'/private/order/3000100'||
  u.href===SOURCE+'/private/order/3000101'){
  orders.push(u.href);
  res.writeHead(404,{'Content-Type':'text/html'});res.end('<html>404</html>');
  return;
 }
 if(u.origin===BASE&&u.pathname==='/devorders'){
  res.writeHead(200,{'Content-Type':'text/html'});
  res.end('<html><body>Authorized synthetic devorders page</body></html>');
  return;
 }
 res.writeHead(403);res.end();
});
await new Promise(resolve=>proxy.listen(0,'127.0.0.1',resolve));
let browser;
try{
 browser=await chromium.launchPersistentContext(profile,{
  channel:'chromium',headless:true,acceptDownloads:true,
  args:['--disable-extensions-except='+ext,'--load-extension='+ext,
   '--proxy-server=http://127.0.0.1:'+proxy.address().port,
   '--proxy-bypass-list=<-loopback>']
 });
 browser.on('page',p=>{
  p.on('pageerror',e=>errors.push(e.message));
  p.on('download',d=>downloads.push(d));
 });
 await browser.route('**/*',route=>{
  const url=route.request().url();
  requests.push(url);
  if(url.startsWith('chrome-extension:'))return route.continue();
  if(url.startsWith(BASE+'/devorders'))
   return route.fulfill({status:200,contentType:'text/html',
    body:'<html><body><h1>Authorization checked — test fixture</h1></body></html>'});
  if(url===SOURCE+'/private/order/3000100'||
   url===SOURCE+'/private/order/3000101'){
   orders.push(url);return route.fulfill({status:404,contentType:'text/html',
    body:'<html><body>404</body></html>'});
  }
  return route.abort();
 });
 const page=await browser.newPage();
 await page.goto(BASE+'/devorders');
 await page.locator('.vlo-file-list').waitFor({timeout:15000});
 await page.locator('.vlo-file-list input[type=file]').setInputFiles({
  name:'synthetic-102.txt',mimeType:'text/plain',buffer:Buffer.from(ids.join('\n'))});
 await page.waitForFunction(()=>document.querySelector('.vlo-file-list')?.
  textContent.includes('Уникальных номеров: 102'),null,{timeout:10000});
 await page.evaluate(async()=>{
  const db=await new Promise((resolve,reject)=>{
   const r=indexedDB.open('vision-ai-approved-file-list-v1');
   r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
  });
  await new Promise((resolve,reject)=>{
   const tx=db.transaction(['state','pending'],'readwrite');
   tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
   const stateStore=tx.objectStore('state');
   const req=stateStore.get('active');
   req.onsuccess=()=>{
    const state=req.result;state.index=100;state.mode='paused';
    stateStore.put(state);
    for(let i=0;i<100;i++){
     const id=String(3000000+i);
     const report={schema:'printcheck.vision.private-approval-collection.v1',
      order_number:id,articles:[],training_ready:false,production_approved:false};
     const data=new TextEncoder().encode(JSON.stringify(report));
     tx.objectStore('pending').put({
      id,order_number:id,status:'TZ_APPROVED',collected_at:new Date().toISOString(),
      native_status_id:'59',eligible_articles:0,verified_articles:0,files:0,
      transfers:[{type:'evidence',stage:'final',part:0,total:1,
       data,report,manifest:null}]
     });
    }
   };
  });
  db.close();
 });
 await page.reload();
 await page.locator('.vlo-file-list').waitFor();
 await page.locator('.vlo-file-list button').filter({
  hasText:'Старт / продолжить по списку'}).click();
 // Confirmation is intentionally PENDING. At least one next order must have
 // been examined before that completion. The old ZIP must remain durable.
 await page.waitForFunction(async()=>{
  const db=await new Promise((resolve,reject)=>{
   const r=indexedDB.open('vision-ai-approved-file-list-v1');
   r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
  });
  return new Promise(resolve=>{
   const tx=db.transaction(['state','pending'],'readonly');
   const s=tx.objectStore('state').get('active');
   const p=tx.objectStore('pending').getAllKeys();
   tx.oncomplete=()=>{
    resolve(s.result?.index>=101&&s.result?.download?.order_ids?.length===100&&
     s.result.archive_count===0&&p.result.length===100);
    db.close();
   };
  });
 },null,{timeout:17000});
 console.log('OVERLAP_AT_SCAN',JSON.stringify({orders,requests:requests.slice(-15),progress:await page.locator('.vlo-file-list').innerText()}));
 assert.ok(orders.includes(SOURCE+'/private/order/3000100'),
  'scan continues even while Chrome reports ZIP pending');
 await page.reload();
 await page.locator('.vlo-file-list').waitFor();
 await page.waitForFunction(()=>(
  document.querySelector('.vlo-file-list p:last-child')?.textContent||''
 ).includes('Список полностью проверен.'),null,{timeout:25000}).catch(async e=>{
  console.log('OVERLAP_DEBUG',await page.locator('.vlo-file-list').innerText());
  throw e;
 });
 const final=await page.evaluate(async()=>{
  const db=await new Promise((resolve,reject)=>{
   const r=indexedDB.open('vision-ai-approved-file-list-v1');
   r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
  });
  return new Promise(resolve=>{
   const tx=db.transaction(['state','pending','success'],'readonly');
   const s=tx.objectStore('state').get('active');
   const p=tx.objectStore('pending').getAll();
   const yes=tx.objectStore('success').getAllKeys();
   tx.oncomplete=()=>{
    resolve({state:s.result,pending:p.result.length,success:yes.result.length});
    db.close();
   };
  });
 });
 assert.equal(final.state.index,102);
 assert.equal(final.state.archive_count,1);
 assert.equal(final.state.found_committed,100);
 assert.equal(final.pending,0);
 assert.equal(final.success,100);
 assert.equal(orders.filter(x=>x.endsWith('3000100')).length,1);
 assert.equal(orders.filter(x=>x.endsWith('3000101')).length,1);
 const swForZip=browser.serviceWorkers().find(w=>w.url().endsWith('service-worker.js'));
 assert.ok(swForZip);
 const completed=await swForZip.evaluate(async()=>(
  await chrome.downloads.search({})
 ).filter(x=>x.state==='complete'&&x.mime==='application/zip'&&
   x.url.startsWith('blob:chrome-extension://')));
 assert.equal(completed.length,1,'one extension-origin ZIP');
 assert.deepEqual(errors,[]);
 console.log('Vision M3.30 two-batch buffering: scan during ZIP PENDING and reload PASS');
}finally{
 if(browser)await browser.close();
 await new Promise(resolve=>proxy.close(resolve));
 await rm(ext,{recursive:true,force:true});
 await rm(profile,{recursive:true,force:true});
}
