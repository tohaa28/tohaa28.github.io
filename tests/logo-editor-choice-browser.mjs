import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1200,height:760}});
 await page.route('https://gifts.ru/__editor_choice_test',route=>route.fulfill({
   status:200,contentType:'text/html; charset=utf-8',
   body:'<!doctype html><html><body><button id="editorOpenLogoEditor" type="button">Редактор логотипа</button></body></html>'
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
 assert.match(await menu.textContent(),/SVG\/PDF/,'Only genuinely supported embedded TraceDraw formats are advertised');
 await menu.getByRole('button',{name:/TraceDraw/}).click();
 assert.deepEqual(await page.evaluate(()=>window.__opened),['tracedraw']);
 assert.equal(await menu.isVisible(),false);
 await page.getByRole('button',{name:'Редактор логотипа'}).click();
 await menu.getByRole('button',{name:/VectorCraft/}).click();
 assert.deepEqual(await page.evaluate(()=>window.__opened),['tracedraw','vectorcraft']);
 await page.getByRole('button',{name:'Редактор логотипа'}).click();
 await page.keyboard.press('Escape');
 assert.equal(await menu.isVisible(),false);
 console.log('Two real editor entrypoints selectable, one at a time; previous VectorCraft kept.');
}finally{await browser.close()}
