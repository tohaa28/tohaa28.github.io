import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:900}});
 const url='https://gifts.ru/__personal_layout_library_test';
 await page.route(url,route=>route.fulfill({status:200,contentType:'text/html',
   body:'<!doctype html><html lang="ru"><body><div id="orderEditor"><div id="orderFieldChoiceBox"><select id="orderTemplates"><option value="0">Артикул 15637</option></select><div id="orderTemplateList"></div></div></div></body></html>'}));
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
 await lib.locator('input[aria-label="Имя профиля личной библиотеки"]').fill('Пользователь A');
 await lib.locator('input[aria-label="Имя профиля личной библиотеки"]').dispatchEvent('change');
 await lib.getByRole('button',{name:'Сохранить вариант'}).click();
 await lib.getByRole('button',{name:'Восстановить'}).waitFor();
 assert.equal(await page.evaluate(()=>window.__restored.length),0,'Saved drafts must not automatically appear in current order');
 const row=lib.locator('.gwb-lib-item');assert.equal(await row.count(),1);
 await row.getByRole('button',{name:'Восстановить'}).click();
 await page.waitForFunction(()=>window.__restored.length===1);
 assert.equal(await page.evaluate(()=>new TextDecoder().decode(window.__restored[0].items[0].artwork.bytes).includes('<svg')),true);

 // Same article, other profile: no cross-user leakage in listing.
 const input=lib.locator('input[aria-label="Имя профиля личной библиотеки"]');
 await input.fill('Пользователь B');await input.dispatchEvent('change');
 await page.waitForFunction(()=>document.querySelector('#gwbLibCount')?.textContent==='Сохранено: 0');
 assert.equal(await row.count(),0);
 await input.fill('Пользователь A');await input.dispatchEvent('change');
 await page.waitForFunction(()=>document.querySelector('#gwbLibCount')?.textContent==='Сохранено: 1');

 // Different article, same profile: saved variants remain isolated.
 await page.evaluate(()=>{window.__article='17488';window.dispatchEvent(new CustomEvent('gwb-editor-readiness-changed'))});
 await page.waitForFunction(()=>document.querySelector('#gwbLibArticle')?.textContent==='Артикул 17488');
 assert.equal(await row.count(),0);
 await page.evaluate(()=>{window.__article='15637';window.dispatchEvent(new CustomEvent('gwb-editor-readiness-changed'))});
 await page.waitForFunction(()=>document.querySelector('#gwbLibCount')?.textContent==='Сохранено: 1');
 assert.equal(await row.count(),1);
 console.log('Personal IndexedDB library: explicit restore, per-user and per-article isolation passed');
}finally{await browser.close()}
