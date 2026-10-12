import {chromium,firefox} from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const motion=fs.readFileSync('assets/workbench-flow.js','utf8');
for(const [name,type] of [['Chromium',chromium],['Firefox',firefox]]) {
 const browser=await type.launch({headless:true});
 try {
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.setContent('<style>*{box-sizing:border-box}body{font:14px Arial}details{border:1px solid;padding:12px;width:320px}summary{min-height:25px}label{display:block;padding:15px}input{width:100%;padding:10px}</style><details id="logoPreflight"><summary>Проверка</summary><label>Размер<input id="savedValue" value="45.5"></label><p id="preexistingInert" inert>Недоступная часть</p></details><div id="testWindow"><input value="Сохранённые данные"></div>');
  await page.addScriptTag({content:motion});
  const summary=page.locator('#logoPreflight summary');
  const settled=()=>page.waitForFunction(()=>!document.getElementById('logoPreflight').getAnimations().some(animation=>animation.playState==='running'));
  const initial=await page.locator('#logoPreflight').boundingBox();
  await summary.click();await settled();
  assert.equal(await page.locator('#logoPreflight').evaluate(node=>node.open),true);
  assert.ok((await page.locator('#logoPreflight').boundingBox()).height>initial.height+30);
  await page.locator('#savedValue').fill('73.2');
  await summary.click();
  assert.equal(await page.locator('#logoPreflight').evaluate(node=>node.open),true,'Content remains laid out until the closing animation completes');
  await settled();
  assert.equal(await page.locator('#logoPreflight').evaluate(node=>node.open),false);
  assert.equal(await page.locator('#savedValue').inputValue(),'73.2');
  assert.equal(await page.locator('#preexistingInert').evaluate(node=>node.inert),true);
  assert.equal(await page.locator('#logoPreflight').evaluate(node=>node.style.height+node.style.overflow),'');
  await page.evaluate(()=>{const node=document.querySelector('#logoPreflight summary');node.click();node.click();node.click()});
  await settled();assert.equal(await page.locator('#logoPreflight').evaluate(node=>node.open),true);
  await page.evaluate(()=>{document.querySelector('#logoPreflight summary').click();document.querySelector('#logoPreflight summary').click();document.getElementById('logoPreflight').open=false});
  await settled();assert.equal(await page.locator('#logoPreflight').evaluate(node=>node.open),false,'A programmatic close must cancel an unfinished reveal');
  const close=await page.evaluate(async()=>{
   const node=document.getElementById('testWindow');let calls=0;
   const finish=()=>{calls++;node.hidden=true};
   const a=window.gwbMotion.closeWindow(node,finish),b=window.gwbMotion.closeWindow(node,finish);
   const during={inert:node.inert,closing:window.gwbMotion.isClosing(node)};
   await Promise.all([a,b]);return {during,calls,hidden:node.hidden,inert:node.inert};
  });
  assert.deepEqual(close,{during:{inert:true,closing:true},calls:1,hidden:true,inert:false});
  const reopened=await page.evaluate(async()=>{
   const node=document.getElementById('testWindow');node.hidden=false;let calls=0;
   const promise=window.gwbMotion.closeWindow(node,()=>{calls++;node.hidden=true});
   window.gwbMotion.cancelClose(node);await promise;
   return {calls,hidden:node.hidden,inert:node.inert,closing:window.gwbMotion.isClosing(node)};
  });
  assert.deepEqual(reopened,{calls:0,hidden:false,inert:false,closing:false});
  await page.emulateMedia({reducedMotion:'reduce'});
  await summary.click();assert.equal(await page.locator('#logoPreflight').evaluate(node=>node.open),true);
  await summary.click();assert.equal(await page.locator('#logoPreflight').evaluate(node=>node.open),false);
  const reduced=await page.evaluate(()=>{const node=document.getElementById('testWindow');let calls=0;window.gwbMotion.closeWindow(node,()=>{calls++;node.hidden=true});return{calls,hidden:node.hidden,closing:window.gwbMotion.isClosing(node)}});
  assert.deepEqual(reduced,{calls:1,hidden:true,closing:false});
  assert.deepEqual(errors,[]);
  console.log(name+' motion: disclosure height, preserved inputs/inert state, rapid reversal, programmatic close, single window close, cancelled reopening, reduced motion passed');
 } finally {await browser.close()}
}
