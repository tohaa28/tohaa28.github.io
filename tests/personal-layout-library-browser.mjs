import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {readFileSync} from 'node:fs';
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:900}});
 const url='https://gifts.ru/__personal_layout_library_test';
 await page.route(url,route=>route.fulfill({status:200,contentType:'text/html',
   body:'<!doctype html><html lang="ru"><body><header><g-droper><a href="/private/cabinet">Личный кабинет</a><g-drop><div class="drop--padding"><span class="opacity-half">Пользователь A</span></div></g-drop></g-droper></header><div id="orderEditor"><div id="orderFieldChoiceBox"><select id="orderTemplates"><option value="0">Артикул 15637</option></select><div id="orderTemplateList"></div></div><canvas id="templateCanvas" width="100" height="100"></canvas><canvas id="overlay" width="100" height="100"></canvas></div></body></html>'}));
 await page.goto(url);
 await page.evaluate(()=>{
   window.__article='15637';window.__restored=[];window.__captured=0;
   window.gwbCurrentLibraryArticle=()=>window.__article;
   window.gwbCapturePersonalLayout=()=>{window.__captured++;return{
     schema:'gwb-personal-layout/v1',article:window.__article,createdAt:new Date().toISOString(),
     fields:[{x:0,y:0,w:100,h:50,page:0}],
     items:[{fieldIndex:0,page:0,placement:{x:6,y:8,w:20,h:12,rotation:0,clipToField:false},
       artwork:{name:'logo.svg',mime:'image/svg+xml',
       bytes:new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><rect width="20" height="12"/></svg>')}}]
   }};
   window.gwbRestorePersonalLayout=async data=>{
     window.__restored.push(data);return {article:window.__article,count:data.items.length};
   };
   window.prompt=()=> 'Вариант для артикула';
   window.confirm=()=>true;
 });
 await page.addScriptTag({path:'assets/personal-layout-library.js'});
 const lib=page.locator('#gwbPersonalLibrary');await lib.waitFor();
 assert.equal(await lib.isVisible(),true);
 await page.waitForFunction(()=>document.querySelector('#gwbLibAuthenticatedUser')?.textContent==='Пользователь gifts.ru: Пользователь A');
 await lib.getByRole('button',{name:'Сохранить вариант'}).click();
 await lib.getByRole('button',{name:'Восстановить'}).waitFor();
 assert.equal(await page.evaluate(()=>window.__restored.length),0,'Saved drafts must not automatically appear in current order');
 const row=lib.locator('.gwb-lib-item');assert.equal(await row.count(),1);
 await row.getByRole('button',{name:'Восстановить'}).click();
 await page.waitForFunction(()=>window.__restored.length===1);
 assert.equal(await page.evaluate(()=>new TextDecoder().decode(window.__restored[0].items[0].artwork.bytes).includes('<svg')),true);

 // Same article, other profile: no cross-user leakage in listing.
 await page.evaluate(()=>document.querySelector('header g-drop .opacity-half').textContent='Пользователь B');
 await page.waitForFunction(()=>document.querySelector('#gwbLibCount')?.textContent==='Сохранено: 0');
 assert.equal(await row.count(),0);
 await page.evaluate(()=>document.querySelector('header g-drop .opacity-half').textContent='Пользователь A');
 await page.waitForFunction(()=>document.querySelector('#gwbLibCount')?.textContent==='Сохранено: 1');

 // Different article, same profile: saved variants remain isolated.
 await page.evaluate(()=>{window.__article='17488';window.dispatchEvent(new CustomEvent('gwb-editor-readiness-changed'))});
 await page.waitForFunction(()=>document.querySelector('#gwbLibArticle')?.textContent==='Артикул 17488');
 assert.equal(await row.count(),0);
 await page.evaluate(()=>{window.__article='15637';window.dispatchEvent(new CustomEvent('gwb-editor-readiness-changed'))});
 await page.waitForFunction(()=>document.querySelector('#gwbLibCount')?.textContent==='Сохранено: 1');
 assert.equal(await row.count(),1);
 assert.equal(await row.locator('img.gwb-lib-preview').count(),1,
   'Saved artwork should display a visual thumbnail without exposing it to the server');
 const pending=page.waitForEvent('download');
 await row.getByRole('button',{name:'Копия JSON'}).click();
 const downloaded=await pending;
 assert.match(downloaded.suggestedFilename(),/maketnaya-15637-/);
 const backup=readFileSync(await downloaded.path());
 const parsed=JSON.parse(backup.toString());
 assert.equal(parsed.layout.items[0].artwork.bytes.length>20,true);
 await lib.locator('input[type=file]').setInputFiles({
   name:'restored-layout.json',mimeType:'application/json',buffer:backup
 });
 await page.waitForFunction(()=>document.querySelector('#gwbLibCount')?.textContent==='Сохранено: 2');
 assert.equal(await page.evaluate(()=>window.__restored.length),1,
   'Import must add a draft but never apply it to an open order');

 // Verify persistence after a full browser reload of the SAME gifts.ru origin.
 await page.reload();
 await page.evaluate(()=>{
   window.__article='15637';window.__restored=[];
   window.gwbCurrentLibraryArticle=()=>window.__article;
   window.gwbRestorePersonalLayout=async data=>{
      window.__restored.push(data);return{article:window.__article,count:data.items.length};
   };
   window.confirm=()=>true;
 });
 await page.addScriptTag({path:'assets/personal-layout-library.js'});
 const reopened=page.locator('#gwbPersonalLibrary');
 await page.waitForFunction(()=>document.querySelector('#gwbLibCount')?.textContent==='Сохранено: 2');
 assert.equal(await page.evaluate(()=>window.__restored.length),0,
    'Reload never automatically restores drafts into a new order');
 await reopened.getByRole('button',{name:'Восстановить'}).first().click();
 await page.waitForFunction(()=>window.__restored.length===1);
 assert.equal(await page.evaluate(()=>window.__restored[0].article),'15637');
 console.log('Personal IndexedDB: thumbnails, profiles, articles, backup round-trip, reload persistence and explicit restore passed');
}finally{await browser.close()}
