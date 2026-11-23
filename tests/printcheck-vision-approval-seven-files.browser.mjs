// Synthetic regression modeled on the known markup of order 8084489.
// Uses GENERATED IDs/names/bytes, never original order data or real LAN requests.
// The reference HTML has 13 human messages and 7 file links (1 PSD + 6 PDFs).
import assert from 'node:assert/strict';
import {mkdtemp,cp,rm,readFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {chromium} from 'playwright';
import {createServer} from 'node:http';

const BASE='http://testgifts.local';
const APPROVED='7991001', NOT_APPROVED='7991002', ITEM='10020003';
const attachmentSpec=[
 {id:'301',filename:'layout_1920x1080.psd',type:'psd'},
 {id:'302',filename:'proof_original.pdf',type:'pdf'},
 {id:'303',filename:'proof_new.pdf',type:'pdf'},
 {id:'304',filename:'proof_new2.pdf',type:'pdf'},
 {id:'305',filename:'proof_revision3.pdf',type:'pdf'},
 {id:'306',filename:'proof_revision3.pdf',type:'pdf'},
 {id:'307',filename:'proof_revision4.pdf',type:'pdf'}
];
const originalBytes=new Map(attachmentSpec.map(({id,type})=>[
 id,type==='psd'?
 Buffer.concat([Buffer.from('8BPS','ascii'),Buffer.alloc(100,Number(id)%251)]):
 Buffer.from('%PDF-1.7\n'+id+'\n1 0 obj\n<<>>\nendobj\n%%EOF\n','ascii')
]));
function fixture(num,approved){
 const comments=Array.from({length:13},(_,index)=>{
  const doc=attachmentSpec[index];
  const link=doc?
   '<div class="margin-top--sm size--xs"><a href="'+BASE+'/private/order/'+num+'#" '+
    'target="_blank" class="btn btn--outline color--brand j_maketadjusting_attachment" '+
    'data-id="'+doc.id+'">'+doc.filename+'</a></div>':'';
  return '<li><div class="comment_wrap flex" id="maketadjusting_commentid_'+(9000+index)+'">'+
   '<div class="flex-item flex-main">Synthetic message '+(index+1)+link+'</div>'+
   '<div class="flex-item vlgnb"><div class="comment_info">'+
    '<div class="name">Synthetic Designer</div> 11.11.26 12:30</div></div>'+
   '</div></li>';
 }).join('');
 const modal='<form id="j_maketAdjustingForm">'+
  '<input type="hidden" name="oiid" value="'+ITEM+'">'+
  '<label><input type="checkbox" name="ma_problem[]" value="66" checked>Review print size</label>'+
  '</form><div id="j_maketadjustingcomments_counter">13</div>'+
  '<ul id="j_maketadjusting_comments_list">'+comments+'</ul>';
 return '<!doctype html><html><body><div id="j_cart_host" data-orderid="100">'+
  '<ul class="cart-header"><li class="cart-header-number">Order '+num+
   '<span data-clipboard-text="'+num+'">'+num+'</span></li></ul>'+
  '<ul class="cart-log"><li><label><input type="checkbox" autocomplete="off" '+
   'disabled data-id="59" class="j_toggle_status" hidden '+
   (approved?'checked ':'')+'><span class="btn btn--toggle">'+
   '<span class="on">ТЗ утверждено</span><span class="off">ТЗ утверждено</span>'+
   '</span></label></li></ul>'+
  '<li data-itemid="'+ITEM+'"><div class="cart-tbl-id">'+
   '<a class="cart-tbl-name" href="'+BASE+'/id/321">Article SAMPLE</a>'+
   '<div class="cart-tbl-lbl vsbl-dk-lg">Synthetic product</div></div>'+
   '<div class="cart-tbl-imp">UV2</div>'+
   '<a class="hint j_maketadjusting gifts-badge-parent" href="'+
    BASE+'/private/order/'+num+'#">'+
    '<span class="gifts-badge">13</span></a></li></div>'+
  '<script>document.querySelector("a.j_maketadjusting").addEventListener('+
   '"click",event=>{event.preventDefault();'+
   'const old=document.querySelector("g-modal");if(old)old.remove();'+
   'const modal=document.createElement("g-modal");'+
   'modal.innerHTML='+JSON.stringify(modal)+';'+
   'document.body.append(modal);modal.setAttribute("visible","");'+
   '});</script></body></html>';
}
const ext=await mkdtemp(path.join(os.tmpdir(),'vision-seven-attachments-ext-'));
const profile=await mkdtemp(path.join(os.tmpdir(),'vision-seven-attachments-prof-'));
for(const name of ['manifest.json','service-worker.js','content-transport.js',
 'vision-order-launcher.js','scanner-host.html','scanner-transport.js',
 'archive-registry.js','zip-offscreen.html','zip-offscreen.js','README_RU.md'])
 await cp(path.resolve('vision/orders/extension',name),path.join(ext,name));
for(const name of ['scanner-host.js','vision-order-approval.js'])
 await cp(path.resolve(name),path.join(ext,name));

const requests=[];
const proxy=createServer((req,res)=>{
 let target;
 try{target=new URL(req.url?.startsWith('http:')?req.url:
   'http://'+req.headers.host+req.url)}catch{
  res.writeHead(400);res.end();return;
 }
 if(target.pathname==='/favicon.ico'){res.writeHead(204);res.end();return}
 const key=target.searchParams.get('id');
 let body=Buffer.from('Not found'),status=404,type='text/plain',kind='other';
 if(target.origin==='http://psk.testgifts.local'&&target.pathname==='/catalog'){
  body=Buffer.from('<html><body>Authorized synthetic portal</body></html>');
  status=200;type='text/html';kind='portal';
 }else if(target.origin===BASE&&target.pathname==='/private/order/'+NOT_APPROVED){
  body=Buffer.from(fixture(NOT_APPROVED,false));status=200;type='text/html';kind='unchecked';
 }else if(target.origin===BASE&&target.pathname==='/private/order/'+APPROVED){
  body=Buffer.from(fixture(APPROVED,true));status=200;type='text/html';kind='approved';
 }else if(target.origin===BASE&&target.pathname==='/ajax/gifts/order'&&
  target.searchParams.size===2&&
  target.searchParams.get('action')==='download_maketadjusting_attachment'&&
  originalBytes.has(key)){
  body=originalBytes.get(key);status=200;type='application/octet-stream';kind='attachment';
 }
 requests.push({kind,method:req.method,id:key});
 res.writeHead(status,{'Content-Type':type,'Content-Length':body.length,
  'Cache-Control':'no-store'});
 res.end(body);
});
await new Promise(resolve=>proxy.listen(0,'127.0.0.1',resolve));

function readZip(buffer){
 const bytes=new Uint8Array(buffer),view=new DataView(bytes.buffer);
 const entries=new Map();let i=0;
 while(i+30<=bytes.length&&view.getUint32(i,true)===0x04034b50){
  const size=view.getUint32(i+18,true),nameLength=view.getUint16(i+26,true),
   extra=view.getUint16(i+28,true);
  const name=new TextDecoder().decode(bytes.subarray(i+30,i+30+nameLength));
  const off=i+30+nameLength+extra;
  assert.ok(off+size<=bytes.length,'ZIP entry bounded');
  assert.ok(!entries.has(name),'ZIP entry names unique');
  entries.set(name,Buffer.from(bytes.subarray(off,off+size)));
  i=off+size;
 }
 return entries;
}
let browser;
try{
 browser=await chromium.launchPersistentContext(profile,{
  channel:'chromium',headless:true,acceptDownloads:true,
  args:['--disable-extensions-except='+ext,'--load-extension='+ext,
   '--proxy-server=http://127.0.0.1:'+proxy.address().port,
   '--proxy-bypass-list=<-loopback>']
 });
 const errors=[];
 browser.on('page',page=>page.on('pageerror',err=>errors.push(err.message)));
 const rawPage=await browser.newPage();
 await rawPage.goto(BASE+'/private/order/'+APPROVED);
 const native=await rawPage.evaluate(()=>{
  const root=document.querySelector('#j_cart_host[data-orderid]');
  const fields=root?[...root.querySelectorAll(
   '.cart-log label input.j_toggle_status[data-id="59"][type="checkbox"]')]:[];
  const input=fields[0],label=input?.closest('label');
  return {root:!!root,fields:fields.length,checked:input?.checked,
   displayed:root?.querySelector('.cart-header-number [data-clipboard-text]')?.
    getAttribute('data-clipboard-text'),
   labelTexts:[...(label?.querySelectorAll('.btn--toggle .on,.btn--toggle .off')||[])]
    .map(x=>x.textContent),
   triggers:document.querySelectorAll('li[data-itemid] a.j_maketadjusting').length
  };
 });
 console.log('SEVEN_FIXTURE_NATIVE_PREVIEW',JSON.stringify(native));
 await rawPage.close();
 const portal=await browser.newPage();
 await portal.goto('http://psk.testgifts.local/catalog');
 await portal.locator('#vision-ai-scan-launcher').waitFor({timeout:15000});
 await portal.locator('#vision-ai-scan-launcher').click();
 let engine;
 for(let i=0;i<100;i++){
  engine=browser.pages().find(p=>p.url().includes('/scanner-host.html'));
  if(engine)break;
  await portal.waitForTimeout(120);
 }
 assert.ok(engine,'scanner-host tab created without devorders');
 await engine.locator('.vlo-file-list input[type=file]').waitFor();
 const settings=await engine.evaluate(()=>chrome.runtime.sendMessage({
  op:'vision-archive-settings-v1',action:'set',
  payload:{mode:'downloads',folder:'VisionAI'}
 }));
 assert.equal(settings?.status,'VISION_ARCHIVE_SETTINGS_SAVED');
 const input=engine.locator('.vlo-file-list input[type=file]');
 await input.setInputFiles({name:'synthetic_orders.txt',mimeType:'text/plain',
  buffer:Buffer.from(NOT_APPROVED+'\n'+APPROVED+'\n')});
 await engine.waitForFunction(()=>(
  document.querySelector('.vlo-file-list p:last-child')?.textContent||''
 ).includes('Уникальных номеров: 2'),null,{timeout:15000});
 await engine.locator('.vlo-file-list button')
  .filter({hasText:'Старт / продолжить по списку'}).click();
 await engine.waitForFunction(()=>(
  document.querySelector('.vlo-file-list p:last-child')?.textContent||''
 ).includes('Список полностью проверен.'),null,{timeout:65000});
 const worker=browser.serviceWorkers().find(w=>w.url().endsWith('service-worker.js'));
 assert.ok(worker);
 const completed=await worker.evaluate(async()=>{
  const items=await chrome.downloads.search({});
  return items.filter(x=>x.state==='complete'&&x.mime==='application/zip'&&
   x.url.startsWith('blob:chrome-extension://'))
   .map(x=>({file:x.filename,id:x.id}));
 });
 if(completed.length!==1){
  const panel=await engine.locator('.vlo-file-list').innerText();
  const allDownloads=await worker.evaluate(async()=>(
   await chrome.downloads.search({})
  ).map(x=>({id:x.id,state:x.state,mime:x.mime,
   danger:x.danger,totalBytes:x.totalBytes})));
  const journal=await engine.evaluate(()=>new Promise((resolve,reject)=>{
   const req=indexedDB.open('vision-ai-approved-file-list-v1');
   req.onerror=()=>reject(Error('DEBUG_IDB_OPEN_FAILED'));
   req.onsuccess=()=>{
    const db=req.result,tx=db.transaction(['failures','state'],'readonly');
    const failures=tx.objectStore('failures').getAll();
    const state=tx.objectStore('state').get('active');
    tx.oncomplete=()=>{resolve({failures:failures.result,
     state:{index:state.result?.index,archive_count:state.result?.archive_count,
      failed_count:state.result?.failed_count}});db.close()};
    tx.onerror=()=>reject(Error('DEBUG_IDB_READ_FAILED'));
   };
  }));
  console.log('SEVEN_FIXTURE_DIAGNOSTIC',JSON.stringify({
   panel,requests,allDownloads,errors,journal
  }));
 }
 assert.equal(completed.length,1,'only one TZ-approved order must yield ZIP');
 const entries=readZip(await readFile(completed[0].file));
 const manifest=JSON.parse(entries.get('manifest.json').toString('utf8'));
 assert.equal(manifest.counts.orders,1);
 assert.equal(manifest.counts.verified_files,7,'all 7 original files fetched');
 assert.equal(manifest.counts.missing_files,0,'no missing attachment');
 const folder='orders/'+APPROVED+'/';
 const thread=JSON.parse(entries.get(folder+'threads/'+ITEM+'.json').toString('utf8'));
 assert.equal(thread.history.filter(m=>m.kind==='human').length,13);
 assert.equal(thread.current_problems.length,1);
 const indexed=JSON.parse(entries.get(folder+'files-index.json').toString('utf8'));
 assert.equal(indexed.length,7);
 assert.deepEqual(indexed.map(x=>x.attachment_id),attachmentSpec.map(x=>x.id));
 assert.deepEqual(indexed.map(x=>x.original_filename),
  attachmentSpec.map(x=>x.filename));
 assert.equal(new Set(indexed.map(x=>x.asset_path)).size,7,
  'equal names with different file IDs and bytes must remain distinct');
 for(const row of indexed){
  assert.ok(row.asset_path,'all seven binaries inside ZIP');
  assert.deepEqual(entries.get(row.asset_path),originalBytes.get(row.attachment_id));
 }
 const attempted=requests.filter(r=>r.kind==='attachment');
 assert.deepEqual(attempted.map(x=>x.id).sort(),attachmentSpec.map(x=>x.id).sort());
 assert.ok(requests.every(r=>r.method==='GET'&&r.kind!=='other'));
 assert.equal(requests.filter(r=>r.kind==='unchecked').length,1);
 assert.ok(!browser.pages().some(p=>p.url().includes('/devorders')),
  'scanner must not require order table');
 assert.deepEqual(errors,[]);
 console.log('Vision 13-message 7-link native approvals: 1 PSD + 6 PDF, bytes and comment mapping PASS');
 console.log('Vision unchecked TZ gate: skipped before native file download PASS');
}finally{
 if(browser)await browser.close();
 await new Promise(resolve=>proxy.close(resolve));
 await rm(ext,{recursive:true,force:true});
 await rm(profile,{recursive:true,force:true});
}
