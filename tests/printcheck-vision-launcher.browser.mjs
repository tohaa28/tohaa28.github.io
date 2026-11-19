// Full scanner UI on any authorized test portal page. The browser stays on
// the source page while the canonical devorders engine runs in a background tab.
import assert from 'node:assert/strict';
import {mkdtemp,cp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {chromium} from 'playwright';
const dir=await mkdtemp(path.join(os.tmpdir(),'vision-launcher-ext-'));
const profile=await mkdtemp(path.join(os.tmpdir(),'vision-launcher-profile-'));
for(const f of ['manifest.json','content-transport.js','service-worker.js',
  'vision-order-launcher.js'])
 await cp(path.resolve('vision/orders/extension',f),path.join(dir,f));
for(const f of ['vision-order-overlay.js','vision-order-approval.js'])
 await cp(path.resolve(f),path.join(dir,f));
let browser;
try{
 browser=await chromium.launchPersistentContext(profile,{
  channel:'chromium',headless:true,acceptDownloads:true,
  args:['--disable-extensions-except='+dir,'--load-extension='+dir]
 });
 const errors=[];
 browser.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
 await browser.route('**/*',route=>{
  const url=new URL(route.request().url());
  if(url.protocol==='chrome-extension:')return route.continue();
  if(url.origin==='http://testgifts.local'||
   url.origin==='http://psk.testgifts.local'){
   const isLogin=/^\/auth\/?$/.test(url.pathname);
   const isMissing=/^\/private\/order\/9999999$/.test(url.pathname);
   return route.fulfill({status:isMissing?404:200,contentType:'text/html',
    body:isLogin?'<html><body><form name="authform"><input type="password"></form></body></html>':
    '<html><body><main id="authorized">Authorized synthetic test page</main></body></html>'});
  }
  return route.abort();
 });
 const first=await browser.newPage();
 await first.goto('http://testgifts.local/catalog');
 await first.locator('#vision-ai-scan-launcher').waitFor();
 const opened=browser.waitForEvent('page',{timeout:15000});
 await first.locator('#vision-ai-scan-launcher').click();
 await first.locator('#vision-ai-scanner-remote').waitFor({state:'visible'});
 assert.equal(first.url(),'http://testgifts.local/catalog',
  'remote panel must not navigate away from the user page');
 const scanner=await opened;
 await scanner.waitForURL('http://psk.testgifts.local/devorders',{timeout:15000});
 assert.equal(browser.pages().filter(p=>p.url().startsWith(
  'http://psk.testgifts.local/devorders')).length,1);
 const input=first.locator('#vision-ai-scanner-remote input[type=file]');
 await input.setInputFiles({name:'list.txt',mimeType:'text/plain',
  buffer:Buffer.from('9999999\n9999999\n')});
 await first.getByRole('button',{name:'Импортировать список'}).click();
 await first.locator('#vision-ai-scanner-remote-status').getByText(/Файл: list.txt/)
  .waitFor({timeout:10000}).catch(async e=>{
   console.log('REMOTE_DIAGNOSTIC',await first.locator('#vision-ai-scanner-remote').innerText());
   throw e;
  });
 await first.getByRole('button',{name:'Старт / продолжить'}).click();
 await first.waitForFunction(()=>document.querySelector(
  '#vision-ai-scanner-remote-status')?.textContent.includes('Проверено: 1 / 1'),
  null,{timeout:12000});
 const second=await browser.newPage();
 await second.goto('http://psk.testgifts.local/catalog');
 await second.locator('#vision-ai-scan-launcher').waitFor();
 await second.locator('#vision-ai-scan-launcher').click();
 await second.waitForFunction(()=>document.querySelector(
  '#vision-ai-scanner-remote-status')?.textContent.includes('Файл: list.txt'),
  null,{timeout:12000});
 assert.equal(browser.pages().filter(p=>p.url().startsWith(
  'http://psk.testgifts.local/devorders')).length,1,
  'remote panel must reuse original engine and IndexedDB');
 assert.equal(await second.locator('#vision-ai-scanner-remote').isVisible(),true);
 const auth=await browser.newPage();
 await auth.goto('http://testgifts.local/auth');
 assert.equal(await auth.locator('#vision-ai-scan-launcher').count(),0);
 const outside=await browser.newPage();
 await outside.goto('data:text/html,<h1>outside test portals</h1>');
 assert.equal(await outside.locator('#vision-ai-scan-launcher').count(),0);
 assert.deepEqual(errors,[]);
 console.log('Vision M3.31 inline remote panel, TXT import, scan, cross-portal status and login guard PASS');
}finally{
 if(browser)await browser.close();
 await rm(dir,{recursive:true,force:true});
 await rm(profile,{recursive:true,force:true});
}
