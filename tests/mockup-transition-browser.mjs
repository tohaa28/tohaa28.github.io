import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';

const browser=await chromium.launch({headless:true});
const editor=fs.readFileSync('editor.html','utf8');
const bridge=[...editor.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.includes('const open=document.getElementById("mockupModeButton")'));
assert.ok(bridge,'Test the actual production iframe integration');
const html=editor.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,'').replace(/<link\b[^>]*>/g,'').replace(/(<iframe id="mockupFrame"[^>]*?)src="[^"]*"/,'$1src="about:blank"');
try{
 for(const [name,viewport,reducedMotion] of [['desktop',{width:1440,height:900},'no-preference'],['mobile',{width:360,height:780},'no-preference'],['reduced',{width:1024,height:768},'reduce']]){
  const context=await browser.newContext({viewport,reducedMotion});const page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setContent(html);
  await page.addStyleTag({content:fs.readFileSync('assets/index-CdEUuUA7.css','utf8')});
  await page.addStyleTag({content:fs.readFileSync('assets/editor-mockup-transition.css','utf8')});
  await page.evaluate(()=>{
   window.fetch=async()=>({ok:true,json:async()=>({schema:'gifts-mockup-profile-registry/v1',profiles:[]})});
   window.__hold=false;window.__calls=0;
   window.gwbGetMockupState=()=>({templateReady:true,templateFieldCount:1,article:'TEST-777',logoCount:1,exportDisabled:false});
   window.gwbBuildMockupHandoff=async()=>({article:'TEST-777',place:'лицо',fieldRect:{x:.1,y:.2,w:.3,h:.4},photoDataUrl:'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600"><rect width="600" height="600" fill="white"/><rect x="140" y="120" width="260" height="330" rx="28" fill="#81b315"/></svg>')});
   document.querySelector('#mockupFrame').contentWindow.gwbApplyMockupHandoff=async payload=>{window.__calls++;while(window.__hold)await new Promise(r=>setTimeout(r,20));window.__last=payload};
   const c=document.querySelector('#templateCanvas');c.width=500;c.height=400;const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,500,400);ctx.fillStyle='#81b315';ctx.fillRect(170,110,160,150);
   document.documentElement.style.overflow='auto';document.body.style.overflow='visible';
   document.querySelector('#article').value='TEST-777';document.querySelector('#rotation').value='37';document.querySelector('#stageScroll').scrollTop=0;
  });
  await page.addScriptTag({content:fs.readFileSync('assets/editor-mockup-transition.js','utf8')});
  await page.addScriptTag({content:bridge});
  const open=page.locator('#mockupModeButton'),scene=page.locator('#gwbMockupTransition'),shell=page.locator('#mockupShell');
  // This test deliberately starts on the list of orders with a cached ready
  // template. Only entering the real template workspace may reveal the button.
  await page.waitForFunction(()=>document.querySelector('#mockupModeButton')?.hidden===true);
  await page.evaluate(()=>{
    document.querySelector('#orderEditor').hidden=false;
    document.querySelector('#orderWaitingWorkspace').hidden=true;
    const workspace=document.querySelector('.workspace');
    workspace.classList.remove('order-waiting');workspace.dataset.orderState='open';
  });
  await page.waitForFunction(()=>document.querySelector('#mockupModeButton')?.hidden===false);
  const navHeight=await open.evaluate(el=>el.getBoundingClientRect().height);
  assert.ok(navHeight>=27&&navHeight<=32,'Mockup navigation height must stay compact: '+navHeight);
  await open.click();
  await page.waitForFunction(()=>document.querySelector('#mockupShell').hidden===false&&document.querySelector('#gwbMockupTransition').hidden);
  assert.equal(await page.evaluate(()=>document.querySelector('.app').inert),true);
  assert.equal(await page.evaluate(()=>document.activeElement.id),'mockupBackButton');
  assert.equal(await page.evaluate(()=>window.__last.article),'TEST-777');
  assert.deepEqual(await page.evaluate(()=>window.__last.fieldRect),{x:.1,y:.2,w:.3,h:.4});
  await page.locator('#mockupBackButton').click();await shell.waitFor({state:'hidden'});
  await page.waitForFunction(()=>!document.querySelector('.app').inert);
  assert.equal(await page.evaluate(()=>document.activeElement.id),'mockupModeButton');
  assert.equal(await page.inputValue('#rotation'),'37');
  assert.deepEqual(await page.evaluate(()=>[document.documentElement.style.overflow,document.body.style.overflow]),['auto','visible']);

  // A slow handoff keeps the scene alive; cancelling does not allow a late completion to reopen it.
  await page.evaluate(()=>{window.__hold=true});await open.click();
  await page.waitForFunction(()=>document.querySelector('#gwbMockupTransition').classList.contains('gmt-waiting'));
  assert.equal(await scene.isVisible(),true);
  assert.equal(await scene.evaluate(el=>getComputedStyle(el).opacity),'1','Repeated opening is not transparent');
  assert.match(await scene.innerText(),/Подготавливаем мокап/);
  const bounds=await scene.locator('.gmt-card').first().boundingBox();
  assert.ok(bounds.width>0&&bounds.x>=0&&bounds.x+bounds.width<=viewport.width+2,'Card fits viewport');
  fs.mkdirSync('test-results',{recursive:true});await page.screenshot({path:`test-results/mockup-transition-${name}.png`});
  await page.keyboard.press('Escape');await page.waitForFunction(()=>document.querySelector('#mockupShell').hidden&&!document.querySelector('.app').inert);
  await page.evaluate(()=>{window.__hold=false});await page.waitForTimeout(150);
  assert.equal(await shell.isHidden(),true);assert.equal(await scene.isHidden(),true);

  // Duplicate open requests are ignored and repeated cycles restore focus and scrolling.
  const before=await page.evaluate(()=>window.__calls);
  await page.evaluate(()=>{document.querySelector('#mockupModeButton').click();document.querySelector('#mockupModeButton').click()});
  await page.waitForFunction(()=>!document.querySelector('#mockupShell').hidden&&document.querySelector('#gwbMockupTransition').hidden);
  assert.equal(await page.evaluate(()=>window.__calls),before+1);
  await page.locator('#mockupBackButton').click();await page.waitForFunction(()=>!document.querySelector('.app').inert);
  // Return to the list while keeping a cached ready template; the entry must hide.
  await page.evaluate(()=>{
    document.querySelector('#orderEditor').hidden=true;
    document.querySelector('#orderWaitingWorkspace').hidden=false;
    const workspace=document.querySelector('.workspace');
    workspace.classList.add('order-waiting');workspace.dataset.orderState='waiting';
  });
  await page.waitForFunction(()=>document.querySelector('#mockupModeButton')?.hidden===true);
  assert.deepEqual(errors,[]);
  console.log(`Mockup transition ${name}: template-only visibility, handoff, loading, cancel, repeat, focus and scroll passed`);
  await context.close();
 }
}finally{await browser.close()}
