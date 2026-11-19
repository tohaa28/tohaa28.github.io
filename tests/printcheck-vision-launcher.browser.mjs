// Synthetic Chrome MV3 coverage: launcher appears on both test portals,
// opens ONE scanner tab and never activates on login or external websites.
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
   return route.fulfill({status:200,contentType:'text/html',
    body:isLogin?'<html><body><form name="authform"><input type="password"></form></body></html>':
    '<html><body><main id="authorized">Authorized synthetic test page</main></body></html>'});
  }
  return route.abort();
 });
 const first=await browser.newPage();
 await first.goto('http://testgifts.local/catalog');
 await first.locator('#vision-ai-scan-launcher').waitFor();
 await first.locator('#vision-ai-scan-launcher').click();
 await browser.waitForEvent('page',{predicate:p=>p.url().startsWith(
  'http://psk.testgifts.local/devorders'),timeout:12000});
 const one=browser.pages().filter(p=>p.url().startsWith(
  'http://psk.testgifts.local/devorders'));
 assert.equal(one.length,1);
 const second=await browser.newPage();
 await second.goto('http://psk.testgifts.local/catalog');
 await second.locator('#vision-ai-scan-launcher').waitFor();
 await second.locator('#vision-ai-scan-launcher').click();
 await second.waitForTimeout(350);
 assert.equal(browser.pages().filter(p=>p.url().startsWith(
  'http://psk.testgifts.local/devorders')).length,1,
  'reuses original psk tab, never opens separate scanner or queue');
 const auth=await browser.newPage();
 await auth.goto('http://testgifts.local/auth');
 assert.equal(await auth.locator('#vision-ai-scan-launcher').count(),0);
 const outside=await browser.newPage();
 await outside.goto('data:text/html,<h1>outside test portals</h1>');
 assert.equal(await outside.locator('#vision-ai-scan-launcher').count(),0);
 assert.deepEqual(errors,[]);
 console.log('Vision M3.30 cross-portal launcher, canonical tab and login guard PASS');
}finally{
 if(browser)await browser.close();
 await rm(dir,{recursive:true,force:true});
 await rm(profile,{recursive:true,force:true});
}
