import {verifyErrorOverlay} from './error-overlay-browser.mjs';
import assert from 'node:assert/strict';
export async function verifyMethodAdmin(frame){
 const dialog=frame.locator('#methodAdmin'),report=()=>frame.evaluate(()=>window.gwbLogoPreflight.find(r=>r.fieldIndex===1));
 assert.equal(await dialog.isVisible(),false);
 // Regression for order 8023221: decal H1, with a white underbase and a
 // separately named Pantone ink, was wrongly accepted as a raster original.
 const physicalOrderCheck=await frame.evaluate(async()=>{
   const {checkLogo}=await import('https://tohaa28.github.io/gifts-layout-workbench-mockups/assets/logo-preflight.mjs?v=20261015-underbase-1');
   const art={ext:'png',w:60,h:50,pixelW:1200,pixelH:1000,preflight:{artworkType:'raster',hasRaster:true,rasters:[],limitations:[]}};
   const test=(orderPlace,bindingReliable=true)=>{
     const result=checkLogo({art,placement:{w:60,h:50},field:{templateScale:1},method:'H1: Деколь,1',orderPlace,orderBindingReliable:bindingReliable,margin:1});
     return {status:result.findings.find(f=>f.id==='artwork-type')?.status,effective:result.findings.find(f=>f.id==='artwork-type')?.effectiveArtworkPolicy,reportStatus:result.status,code:result.method};
   };
   return {listed:test('напротив от ручки [подложка; пантон(Н32446/8435С)]'),
     absent:test('напротив от ручки'),unverified:test('напротив от ручки [подложка; пантон(Н32446/8435С)]',false)};
 });
 assert.deepEqual([physicalOrderCheck.listed.status,physicalOrderCheck.listed.effective,physicalOrderCheck.listed.reportStatus,physicalOrderCheck.listed.code],['bad','vector-only','bad','H1']);
 assert.deepEqual([physicalOrderCheck.absent.status,physicalOrderCheck.absent.effective],['ok','any']);
 assert.equal(physicalOrderCheck.unverified.status,'manual');
 const logo=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10mm" height="10mm" viewBox="0 0 10 10"><rect x="1" y="1" width="3" height="8" fill="red"/><rect x="6" y="1" width="3" height="8" fill="blue"/></svg>');
 await frame.locator('#artwork').setInputFiles({name:'admin-colors.svg',mimeType:'image/svg+xml',buffer:logo});await frame.waitForFunction(()=>document.getElementById('artworkName').textContent.includes('admin-colors.svg'));const scale=(await report()).templateScale;await frame.locator('#width').evaluate((el,v)=>{el.value=String(v);el.dispatchEvent(new Event('input',{bubbles:true}));},10/scale);await frame.locator('#editorCenter').click();assert.equal((await report()).findings.find(f=>f.id==='colors').status,'bad');
 const open=async()=>{await frame.locator('#overlay').focus();await frame.page().keyboard.press('Alt+KeyN');await dialog.waitFor({state:'visible'});};
 const login=async()=>{await frame.locator('#adminUser').fill('admin');await frame.locator('#adminPassword').fill('admin');await frame.locator('#adminLogin button').click();await frame.locator('#adminSettings').waitFor({state:'visible'});await frame.locator('#adminGithubToken').fill('sample');};
 const select=code=>frame.locator('#adminMethod').selectOption(code),save=async()=>{await frame.locator('#adminEdit button[type=submit]').click();await frame.waitForFunction(()=>document.querySelector('#adminMessage')?.textContent?.includes('Настройки сохранены на сервере'),null,{timeout:15000});};
 await verifyErrorOverlay(frame);
 // A multi-place order contains D1 and F1. The selected print field, not
 // the overall article's first method, determines the initial settings view.
 await frame.locator('#orderFieldChoice').selectOption('0');
 await frame.waitForFunction(()=>document.getElementById('orderFieldChoice')?.value==='0');
 await open();await login();
 assert.equal(await frame.locator('#adminMethod').inputValue(),'D1','Opening field 1 must highlight its D1 technique');
 assert.match(await frame.locator('#adminMethodName').textContent(),/^D1 · /);
 await frame.locator('#adminCancel').click();
 await frame.locator('#orderFieldChoice').selectOption('1');
 await frame.waitForFunction(()=>document.getElementById('orderFieldChoice')?.value==='1');
 await open();await frame.locator('#adminUser').fill('admin');await frame.locator('#adminPassword').fill('wrong');await frame.locator('#adminLogin button').click();await frame.waitForFunction(()=>document.getElementById('adminLoginError').textContent.includes('Неверный'));assert.equal(await frame.locator('#adminSettings').isVisible(),false);await login();
 assert.equal(await frame.locator('#adminMethod').inputValue(),'F1','Opening field 2 must highlight its F1 technique');
 assert.match(await frame.locator('#adminMethodName').textContent(),/^F1 · /);
 assert.equal(await frame.locator('#adminMethod option').count(),92);await select('F1');assert.equal(await frame.locator('#adminParam-guard').getAttribute('placeholder'),'0');
 assert.equal(await frame.locator('#adminOrderColorPolicy').inputValue(),'off');
 // The real selected order place is "сторона а [черный(403/Black)]": 1 ink.
 // Current artwork has two distinct source SVG paints.
 await frame.locator('#adminOrderColorPolicy').selectOption('match');
 assert.equal((await report()).findings.some(f=>f.id==='order-colors'),false,'Unsaved order-color draft cannot affect live reports');
 await save();
 await frame.waitForFunction(()=>window.gwbLogoPreflight?.find(r=>r.fieldIndex===1)?.findings?.some(f=>f.id==='order-colors'&&f.required===1&&f.actual===2&&f.status==='bad'),null,{timeout:12000});
 assert.equal(await frame.locator('#simpleExport').isDisabled(),true,'Order count mismatch blocks export');
 const oneColorLogo=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10mm" height="10mm"><rect x="1" y="1" width="8" height="8" fill="red"/></svg>');
 await frame.locator('#artwork').setInputFiles({name:'order-one-color.svg',mimeType:'image/svg+xml',buffer:oneColorLogo});
 await frame.waitForFunction(()=>window.gwbLogoPreflight?.find(r=>r.fieldIndex===1)?.findings?.some(f=>f.id==='order-colors'&&f.status==='ok'&&f.actual===1));
 await frame.locator('#adminOrderColorPolicy').selectOption('off');await save();
 await frame.waitForFunction(()=>!window.gwbLogoPreflight?.find(r=>r.fieldIndex===1)?.findings?.some(f=>f.id==='order-colors'));
 await frame.locator('#artwork').setInputFiles({name:'admin-colors.svg',mimeType:'image/svg+xml',buffer:logo});
 await frame.waitForFunction(()=>window.gwbLogoPreflight?.find(r=>r.fieldIndex===1)?.findings?.some(f=>f.id==='colors'&&f.status==='bad'));

 await frame.locator('#adminCheck-colors').uncheck();assert.ok((await report()).findings.some(f=>f.id==='colors'),'Draft must not change live checks');await frame.locator('#adminCancel').click();await open();await login();await select('F1');assert.equal(await frame.locator('#adminCheck-colors').isChecked(),true);
 // The separate "Maximum colors" selector edits only this printing method.
 assert.equal(await frame.locator('#adminColorLimit').inputValue(),'source');
 assert.match(await frame.locator('#adminColorLimit option').first().textContent(),/до 1/);
 assert.equal(await frame.locator('#adminColorLimit option').count(),33);
 await frame.locator('#adminColorLimit').selectOption('2');
 assert.equal((await report()).findings.find(f=>f.id==='colors').status,'bad',
   'Unsaved changes must not alter the existing one-color rule');
 await save();
 await frame.waitForFunction(()=>window.gwbLogoPreflight?.find(r=>r.fieldIndex===1)?.rule.maxColors===2);
 assert.equal((await report()).findings.find(f=>f.id==='colors').status,'ok');
 assert.equal((await report()).findings.find(f=>f.id==='colors').actual,2);
 const threeColors=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10mm" height="10mm" viewBox="0 0 10 10"><rect x="1" y="1" width="2" height="8" fill="red"/><rect x="4" y="1" width="2" height="8" fill="blue"/><rect x="7" y="1" width="2" height="8" fill="green"/></svg>');
 await frame.locator('#artwork').setInputFiles({name:'three-print-colors.svg',mimeType:'image/svg+xml',buffer:threeColors});
 await frame.waitForFunction(()=>window.gwbLogoPreflight?.find(r=>r.fieldIndex===1)?.findings?.some(f=>f.id==='colors'&&f.actual===3&&f.status==='bad'),null,{timeout:20000});
 assert.equal(await frame.locator('#simpleExport').isDisabled(),true);
 await frame.locator('#adminColorLimit').selectOption('3');await save();
 await frame.waitForFunction(()=>window.gwbLogoPreflight?.find(r=>r.fieldIndex===1)?.rule.maxColors===3);
 assert.equal((await report()).findings.find(f=>f.id==='colors').status,'ok');
 await frame.locator('#artwork').setInputFiles({name:'admin-colors.svg',mimeType:'image/svg+xml',buffer:logo});
 await frame.waitForFunction(()=>window.gwbLogoPreflight?.find(r=>r.fieldIndex===1)?.findings?.some(f=>f.id==='colors'&&f.actual===2));
 await frame.locator('#adminColorLimit').selectOption('source');await save();
 await frame.waitForFunction(()=>window.gwbLogoPreflight?.find(r=>r.fieldIndex===1)?.rule.maxColors===1);
 assert.equal((await report()).findings.find(f=>f.id==='colors').status,'bad');
 await select('D1');
 assert.equal(await frame.locator('#adminColorLimit').inputValue(),'source');
 await select('F1');
 assert.equal(await frame.locator('#adminColorLimit').inputValue(),'source');

 await frame.locator('#adminCheck-colors').uncheck();await frame.locator('#adminCheck-details').uncheck();await save();assert.equal((await report()).findings.some(f=>f.id==='colors'),false);assert.equal(await frame.locator('#simpleExport').isDisabled(),false);assert.equal(await frame.evaluate(()=>window.gwbDetailCheck.entries.some(e=>e.key===window.gwbDetailCheck.selectedKey)),false);
 // Preserve the editor's live vector/raster findings and block export when
 // the chosen print technique requires an entirely vector source.
 assert.equal(await frame.locator('#adminArtworkPolicy').inputValue(),'source');
 assert.match(await frame.locator('#adminArtworkPolicy option').first().textContent(),/Автоматически по цветам заказа/i);
 const moduleUrls=await frame.evaluate(()=>performance.getEntriesByType('resource').map(x=>x.name).filter(x=>x.includes('method-admin.mjs')));
 assert.ok(moduleUrls.some(url=>url.includes('v=20261015-auto-artwork-1')),'New print settings module must load in the test browser: '+JSON.stringify(moduleUrls));

 assert.equal((await report()).findings.find(f=>f.id==='artwork-type').effectiveArtworkPolicy,'vector-only');
 await frame.locator('#adminArtworkPolicy').selectOption('vector-only');
 assert.equal((await report()).rule.artworkPolicy,'auto-order-colors','Unsaved draft must not affect the editor');
 await save();
 await frame.waitForFunction(()=>window.gwbLogoPreflight?.find(r=>r.fieldIndex===1)?.rule.artworkPolicy==='vector-only');
 assert.equal((await report()).findings.find(f=>f.id==='artwork-type').status,'ok');
 const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
 const mixedSvg=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10mm" height="10mm" viewBox="0 0 10 10"><rect x="1" y="1" width="8" height="8" fill="red"/><image x="2" y="2" width="3" height="3" href="data:image/png;base64,'+png+'"/></svg>');
 await frame.locator('#artwork').setInputFiles({name:'raster-inside-vector.svg',mimeType:'image/svg+xml',buffer:mixedSvg});
 await frame.waitForFunction(()=>window.gwbLogoPreflight?.find(r=>r.fieldIndex===1)?.findings?.some(f=>f.id==='artwork-type'&&f.status==='bad'));
 assert.equal((await report()).findings.find(f=>f.id==='artwork-type').artworkType,'mixed');
 assert.equal(await frame.locator('#simpleExport').isDisabled(),true);
 // Returning to automatic mode does NOT whitelist mixed artwork: the order
 // explicitly lists one printing ink for the currently selected F1 field.
 await frame.locator('#adminArtworkPolicy').selectOption('source');
 await save();
 await frame.waitForFunction(()=>window.gwbLogoPreflight?.find(r=>r.fieldIndex===1)?.rule.artworkPolicy==='auto-order-colors');
 assert.equal((await report()).findings.find(f=>f.id==='artwork-type').status,'bad');
 assert.equal((await report()).findings.find(f=>f.id==='artwork-type').effectiveArtworkPolicy,'vector-only');
 // The operator can still explicitly allow raster as a saved method override.
 await frame.locator('#adminArtworkPolicy').selectOption('any');await save();
 await frame.waitForFunction(()=>window.gwbLogoPreflight?.find(r=>r.fieldIndex===1)?.rule.artworkPolicy==='any');
 assert.equal((await report()).findings.find(f=>f.id==='artwork-type').status,'ok');
 await frame.locator('#adminArtworkPolicy').selectOption('source');await save();
 await frame.waitForFunction(()=>window.gwbLogoPreflight?.find(r=>r.fieldIndex===1)?.rule.artworkPolicy==='auto-order-colors');
 await frame.locator('#artwork').setInputFiles({name:'admin-colors.svg',mimeType:'image/svg+xml',buffer:logo});
 await frame.waitForFunction(()=>window.gwbLogoPreflight?.find(r=>r.fieldIndex===1)?.findings?.some(f=>f.id==='artwork-type'&&f.artworkType==='vector'));

 await frame.locator('#adminParam-guard').fill('1000');await save();assert.equal((await report()).findings.find(f=>f.id==='guard').status,'bad');assert.equal(await frame.locator('#simpleExport').isDisabled(),true);assert.equal(await frame.evaluate(()=>window.gwbLogoPreflight.find(r=>r.fieldIndex===0).rule.guard),0);
 await frame.locator('#adminEnabled').uncheck();await save();assert.ok((await report()).findings.some(f=>f.id==='settings-disabled'));assert.equal((await report()).findings.some(f=>f.status==='bad'),false);
 await verifyErrorOverlay(frame);const stored=await frame.evaluate(()=>JSON.parse(localStorage.getItem('gwb-method-settings-v1')));assert.equal(stored.methods.F1.enabled,false);assert.equal(stored.methods.F1.values.guard,1000);
 const fresh=await frame.page().context().newPage();await fresh.route('https://gifts.ru/**',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><body>Settings persistence</body></html>'}));await fresh.goto('https://gifts.ru/');const loaded=await fresh.evaluate(async()=>{const m=await import('https://tohaa28.github.io/gifts-layout-workbench/assets/method-settings.mjs?v=20260930-1');return m.configureRule(m.PRINT_REQUIREMENTS.F1);});assert.equal(loaded.guard,1000);assert.equal(loaded.settings.enabled,false);await fresh.close();
 if(process.env.ADMIN_SCREENSHOT){await dialog.evaluate(el=>el.scrollTop=0);await frame.page().screenshot({path:process.env.ADMIN_SCREENSHOT});}
 const downloadPromise=frame.page().waitForEvent('download');await frame.locator('#adminExport').click();assert.equal((await downloadPromise).suggestedFilename(),'maketnaya-method-settings.json');
 await frame.locator('#adminImport').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{"version":1,"methods":{"F1":{"values":{"guard":-1}}}}')});await frame.waitForFunction(()=>document.getElementById('adminMessage').textContent.includes('Не удалось импортировать'));assert.equal((await report()).rule.guard,1000);
 await frame.locator('#adminImport').setInputFiles({name:'settings.json',mimeType:'application/json',buffer:Buffer.from('{"version":1,"methods":{}}')});await frame.waitForFunction(()=>document.getElementById('adminMessage').textContent.includes('загружены'));assert.equal((await report()).rule.guard,1000);await save();assert.equal((await report()).rule.guard,0);assert.ok((await report()).findings.some(f=>f.id==='colors'&&f.status==='bad'));
 await frame.page().keyboard.press('Alt+KeyN');assert.equal(await dialog.isVisible(),false);await open();assert.equal(await frame.locator('#adminLogin').isVisible(),true);await frame.page().keyboard.press('Escape');assert.equal(await dialog.isVisible(),false);
 await verifyErrorOverlay(frame);if(process.env.ERROR_SCREENSHOT)await frame.page().screenshot({path:process.env.ERROR_SCREENSHOT});
 console.log('Method admin: login, draft/cancel, per-code settings, disabled checks/worker/export, guard zero, guard override, import/export and shortcuts passed');
}
