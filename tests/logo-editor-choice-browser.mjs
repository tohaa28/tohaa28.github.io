import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1200,height:760}});
 await page.route('https://gifts.ru/__editor_choice_test',route=>route.fulfill({
   status:200,contentType:'text/html; charset=utf-8',
   body:'<!doctype html><html><body><button id="editorOpenLogoEditor" type="button">Редактор логотипа</button><div id="status"></div></body></html>'
 }));
 await page.goto('https://gifts.ru/__editor_choice_test');
 await page.evaluate(()=>{
   window.__opened=[];
   window.gwbVectorcraftHost={open:()=>window.__opened.push('vectorcraft')};
   window.gwbTraceDrawHost={open:()=>window.__opened.push('tracedraw')};
 });
 await page.addScriptTag({path:'assets/logo-editor-choice.js'});
 await page.getByRole('button',{name:'Редактор логотипа'}).click();
 const menu=page.locator('#gwbEditorChoice');
 assert.equal(await menu.isVisible(),true);
 assert.equal(await menu.getByRole('button',{name:/VectorCraft/}).count(),1);
 assert.equal(await menu.getByRole('button',{name:/TraceDraw/}).count(),1);
 assert.match(await menu.textContent(),/ЧЁРТИК/,'Devil is identified');
 assert.match(await menu.textContent(),/АНГЕЛ/,'Angel is identified');
 assert.match(await menu.textContent(),/Аналог Adobe Illustrator/);
 assert.match(await menu.textContent(),/Аналог CorelDRAW/);
 assert.equal(await menu.getAttribute('role'),'dialog');
 const characterImages=menu.locator('.gwb-choice-art img[aria-hidden="true"]');
 assert.equal(await characterImages.count(),2,'Both approved characters use PNG illustrations');
 await page.waitForFunction(()=>[...document.querySelectorAll('.gwb-choice-art img')].every(img=>img.complete&&img.naturalWidth>0));
 assert.equal(await menu.locator('.gwb-choice-role').first().isVisible(),false,'Angel and devil text labels are hidden');
 assert.match(await characterImages.first().getAttribute('src'),/^data:image\/png;base64,iVBORw0KGgo/);
 assert.equal(await menu.locator('.gwb-choice-art--devil').evaluate(el=>getComputedStyle(el).animationName.includes('gwbDevil')),true);
 assert.equal(await menu.locator('.gwb-choice-art--angel').evaluate(el=>getComputedStyle(el).animationName.includes('gwbAngel')),true);
 assert.equal(await menu.evaluate(el=>el.classList.contains('is-active')),true,'Entrance animation starts on opening');
 await page.locator('#status').evaluate(el=>el.textContent='Из VectorCraft возвращён только нарисованный логотип с его габаритами и положением.');
 await page.waitForFunction(()=>document.getElementById('status').textContent==='');
 await page.locator('#status').evaluate(el=>el.textContent='Остальные проверки остаются видимыми.');
 await page.waitForTimeout(20);
 assert.equal(await page.locator('#status').textContent(),'Остальные проверки остаются видимыми.');
 await menu.getByRole('button',{name:/TraceDraw/}).click();
 assert.deepEqual(await page.evaluate(()=>window.__opened),['tracedraw']);
 assert.equal(await menu.isVisible(),false);
 await page.getByRole('button',{name:'Редактор логотипа'}).click();
 await menu.getByRole('button',{name:/VectorCraft/}).click();
 assert.deepEqual(await page.evaluate(()=>window.__opened),['tracedraw','vectorcraft']);
 await page.getByRole('button',{name:'Редактор логотипа'}).click();
 await page.keyboard.press('Escape');
 assert.equal(await menu.isVisible(),false);
 // Reopening must replay the character entrance, not reuse stale CSS state.
 await page.getByRole('button',{name:'Редактор логотипа'}).click();
 assert.equal(await menu.isVisible(),true);
 assert.equal(await menu.evaluate(el=>el.classList.contains('is-active')),true);
 await menu.getByRole('button',{name:'Закрыть выбор редактора'}).click();
 assert.equal(await menu.isVisible(),false);
 console.log('Animated devil/angel chooser, both real entrypoints, keyboard dismissal and obsolete status suppression passed.');
}finally{await browser.close()}
