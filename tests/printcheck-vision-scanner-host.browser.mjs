// Vision 0.2.0 — scanner host works without a /devorders page.
// All network traffic is routed to a synthetic proxy; no LAN accounts touched.
import assert from 'node:assert/strict';
import {mkdtemp,cp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {chromium} from 'playwright';
import {makeLocalStoredZip} from '../vision/orders/local-training-zip.mjs';
import {createServer} from 'node:http';

const ext=await mkdtemp(path.join(os.tmpdir(),'vision-ext-host-'));
const profile=await mkdtemp(path.join(os.tmpdir(),'vision-ext-profile-'));
for(const filename of ['manifest.json','service-worker.js','content-transport.js',
 'vision-order-launcher.js','scanner-host.html','scanner-transport.js',
 'archive-registry.js','zip-offscreen.html','zip-offscreen.js','README_RU.md'])
 await cp(path.resolve('vision/orders/extension',filename),path.join(ext,filename));
for(const filename of ['scanner-host.js','vision-order-approval.js'])
 await cp(path.resolve(filename),path.join(ext,filename));

const proxy=createServer((request,response)=>{
 let url;
 try{url=new URL(request.url)}catch{response.writeHead(400);response.end();return}
 if(!['http://testgifts.local','http://psk.testgifts.local'].includes(url.origin)){
  response.writeHead(403);response.end();return;
 }
 const status=url.pathname==='/private/order/9999999'?404:200;
 const html=url.pathname.startsWith('/auth')?
  '<form name="authform"><input type="password"></form>':
  '<main id="authorized">Synthetic authorized test page</main>';
 response.writeHead(status,{'Content-Type':'text/html; charset=utf-8'});
 response.end(html);
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
 const errors=[];
 browser.on('page',page=>page.on('pageerror',error=>errors.push(error.message)));
 await browser.route('**/*',route=>{
  const url=new URL(route.request().url());
  if(url.protocol==='chrome-extension:')return route.continue();
  if(['http://testgifts.local','http://psk.testgifts.local'].includes(url.origin)){
   const auth=/^\/auth\/?$/.test(url.pathname);
   return route.fulfill({
    status:url.pathname==='/private/order/9999999'?404:200,
    contentType:'text/html',body:auth?
     '<form name="authform"><input type="password"></form>':
     '<main id="authorized">Synthetic authorized test page</main>'
   });
  }
  return route.abort();
 });
 const page=await browser.newPage();
 await page.goto('http://testgifts.local/catalog');
 await page.locator('#vision-ai-scan-launcher').waitFor();
 await page.locator('#vision-ai-scan-launcher').click();
 await page.locator('#vision-ai-scanner-remote').waitFor({state:'visible'});
 let host;
 for(let i=0;i<90;i++){
  host=browser.pages().find(p=>p.url().includes('/scanner-host.html'));
  if(host)break;
  await page.waitForTimeout(150);
 }
 assert.ok(host,'extension-owned host must exist');
 assert.ok(host.url().startsWith('chrome-extension://'));
 assert.equal(browser.pages().some(p=>p.url().includes('/devorders')),false,
  'scanning must not open the test-order table');
 await host.locator('#vision-scanner-host .vlo-file-list').waitFor();
 // UI v0.2.4: status indicators and controls are meaningfully separate.
 const compact=page.locator('#vision-ai-scanner-remote');
 assert.equal(await compact.locator('.vai-section').count(),5,
  'compact panel must separate status, TXT, scan, ZIP and service');
 assert.equal(await compact.locator('.vai-metric').count(),6,
  'six independent readable status indicators');
 assert.equal(await compact.locator('.vai-details').count(),1,
  'advanced network details should be collapsible');
 assert.equal(await compact.locator('.vai-section')
  .filter({hasText:'Управление проверкой'}).getByRole('button',
   {name:'Старт / продолжить'}).count(),1);
 assert.equal(await compact.locator('.vai-section')
  .filter({hasText:'Сохранение и архивы'}).getByRole('button',
   {name:'Сохранить неполную партию ZIP'}).count(),1);
 assert.equal(await compact.locator('.vai-section')
  .filter({hasText:'Обслуживание'}).getByRole('button',
   {name:'Сбросить прогресс'}).count(),1);
 assert.equal(await host.locator('.vlo-group').count(),3,
  'detailed scanner has separated scan/archive/reset button groups');
 assert.equal(await host.locator('.vlo-metric').count(),6);
 const modeOptions=await page.locator('#vision-ai-scanner-remote select').allTextContents();
 assert.equal(modeOptions.some(x=>x.includes('Диапазон номеров')),false);
 const files=page.locator('#vision-ai-scanner-remote input[type=file]');
 await files.setInputFiles({name:'list.txt',mimeType:'text/plain',
  buffer:Buffer.from('9999999\n9999999\n')});
 await page.getByRole('button',{name:'Импортировать список'}).click();
 await page.waitForFunction(()=>
  document.querySelector('#vision-ai-scanner-remote-status')?.textContent.includes('Файл: list.txt'),
  null,{timeout:15000});
 await page.getByRole('button',{name:'Старт / продолжить'}).click();
 await page.waitForFunction(()=>
  document.querySelector('#vision-ai-scanner-remote-status')?.textContent.includes('VISION_ARCHIVE_FOLDER_NOT_CONFIGURED'),
  null,{timeout:15000});
 const choose=page.locator('#vision-ai-scanner-remote select').last();
 await choose.selectOption('downloads');
 await page.locator('#vision-ai-scanner-remote input[placeholder="Имя подпапки"]')
  .fill('VisionAI-Lab');
 await page.getByRole('button',{name:'Применить',exact:true}).last().click();
 await page.waitForFunction(()=>
  document.querySelector('#vision-ai-scanner-remote-status')?.textContent.includes('VISION_ARCHIVE_SETTINGS_SAVED')||
  document.querySelector('#vision-ai-scanner-remote-status')?.textContent.includes('Папка задана'),
  null,{timeout:8000}).catch(()=>{});
 await page.getByRole('button',{name:'Старт / продолжить'}).click();
 await page.waitForFunction(()=>
  document.querySelector('#vision-ai-scanner-remote-status')?.textContent.includes('Проверено: 1 / 1'),
  null,{timeout:20000});
 assert.equal(page.url(),'http://testgifts.local/catalog');
 assert.match(await compact.locator('.vai-metric').first().innerText(),/1\s*\/\s*1/,
  'checked count must update in independent metric');
 const meter=await compact.locator('[role=progressbar]').getAttribute('aria-valuenow');
 assert.equal(meter,'100','visible progress bar reflects completed TXT queue');
 await page.setViewportSize({width:390,height:760});
 const bounds=await compact.evaluate(e=>{
  const r=e.getBoundingClientRect();
  return {width:r.width,left:r.left,right:r.right,viewport:window.innerWidth,
   sections:[...e.querySelectorAll('.vai-section')].map(x=>{
    const box=x.getBoundingClientRect();
    return {left:box.left,right:box.right};
   })};
 });
 assert.ok(bounds.left>=0&&bounds.right<=bounds.viewport,
  'compact panel stays inside the narrow viewport');
 assert.ok(bounds.sections.every(x=>x.left>=0&&x.right<=bounds.viewport),
  'all grouped controls remain inside narrow viewport');

 const settings=await page.locator('#vision-ai-scanner-remote select').last();
 await settings.selectOption('downloads');
 await page.locator('#vision-ai-scanner-remote input[placeholder="Имя подпапки"]')
  .fill('VisionAI-Lab');
 await page.getByRole('button',{name:'Применить',exact:true}).last().click();
 await page.getByRole('button',{name:'Список сохранённых ZIP'}).click();
 await page.locator('#vision-ai-scanner-remote').getByText(/Сохранённых или ожидающих ZIP пока нет/)
  .waitFor({timeout:10000});
 // Test a REAL completed Chrome download, not merely a click on Save.
 // Create a 100%-synthetic ZIP and transfer it through the same MV3 offscreen
 // chunk protocol as an approved-order batch. No real LAN data is used.
 const testZip=makeLocalStoredZip([
  {name:'manifest.json',bytes:new TextEncoder().encode(JSON.stringify({
   schema:'vision.ai.synthetic-registry-test.v1',training_ready:false,
   note:'Synthetic ZIP contains no customer data',padding:'x'.repeat(200)
  }))},
  {name:'samples/0001.bin',bytes:new TextEncoder().encode('Synthetic fixture\\n')}
 ]);
 const encoded=Buffer.from(await testZip.arrayBuffer()).toString('base64');
 const archiveName='vision-ai-list-part-00001-9999999-9999999.zip';
 const initiated=await host.evaluate(async ({raw,name,size})=>{
  const job='1234567890abcdef1234567890abcdef';
  const send=(action,extra={})=>chrome.runtime.sendMessage({
   op:'vision-zip-secure-message-v1',action,job,...extra
  });
  const begin=await send('begin',{filename:name,size});
  if(begin?.status!=='ZIP_READY_FOR_CHUNK')return begin;
  const written=await send('chunk',{sequence:0,base64:raw});
  if(written?.status!=='ZIP_CHUNK_ACCEPTED')return written;
  return send('finish',{chunks:1});
 },{raw:encoded,name:archiveName,size:testZip.size});
 assert.equal(initiated?.status,'ZIP_DOWNLOAD_STARTED',
  'archive must be submitted to native Chrome Downloads');
 let saved=null;
 for(let i=0;i<60;i++){
  const history=await host.evaluate(()=>chrome.runtime.sendMessage({
   op:'vision-archive-settings-v1',action:'list'
  }));
  saved=history?.items?.find(row=>row.expected_name===
   'vision-ai-list-part-00001-9999999-9999999.zip');
  if(saved?.state==='saved')break;
  await page.waitForTimeout(250);
 }
 assert.equal(saved?.state,'saved','Chrome-completed ZIP must enter archive registry');
 assert.equal(saved?.expected_bytes,testZip.size);
 assert.ok(saved.local_path,'registry must retain Chrome actual local path');
 await page.getByRole('button',{name:'Список сохранённых ZIP'}).click();
 await page.locator('#vision-ai-scanner-remote').getByText(/СОХРАНЁН/).waitFor();

 const second=await browser.newPage();
 await second.goto('http://psk.testgifts.local/catalog');
 await second.locator('#vision-ai-scan-launcher').waitFor();
 await second.locator('#vision-ai-scan-launcher').click();
 await second.waitForFunction(()=>
  document.querySelector('#vision-ai-scanner-remote-status')?.textContent.includes('Файл: list.txt'),
  null,{timeout:12000});
 assert.equal(browser.pages().filter(p=>p.url().includes('/scanner-host.html')).length,1);
 assert.equal(browser.pages().some(p=>p.url().includes('/devorders')),false);
 const dialogPromise=second.waitForEvent('dialog');
 await second.getByRole('button',{name:'Сбросить прогресс'}).click();
 const dialog=await dialogPromise;await dialog.accept();
 await second.waitForFunction(()=>
  document.querySelector('#vision-ai-scanner-remote-status')?.textContent.includes('Проверено: 0 / 0'),
  null,{timeout:12000});
 const login=await browser.newPage();
 await login.goto('http://testgifts.local/auth');
 assert.equal(await login.locator('#vision-ai-scan-launcher').count(),0);
 assert.deepEqual(errors,[]);
 console.log('Vision v0.2.0 extension host TXT / both portals / no devorders / preferences / reset PASS');
}finally{
 if(browser)await browser.close();
 await new Promise(resolve=>proxy.close(resolve));
 await rm(ext,{recursive:true,force:true});
 await rm(profile,{recursive:true,force:true});
}
