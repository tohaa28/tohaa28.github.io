import assert from 'node:assert/strict';
export async function verifyDetailCheck(frame){
 const logo=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10mm" height="10mm" viewBox="0 0 10 10"><rect x="1" y="1" width=".2" height="7"/><rect x="4" y="1" width="2" height="7"/><rect x="6.2" y="1" width="2" height="7"/></svg>');
 await frame.locator('#artwork').setInputFiles({name:'detail-lines.svg',mimeType:'image/svg+xml',buffer:logo});
 await frame.waitForFunction(()=>document.getElementById("artworkName").textContent.includes("detail-lines.svg"));
 const scale=await frame.evaluate(()=>window.gwbLogoPreflight.find(r=>r.fieldIndex===1).templateScale);
 const resize=async size=>{await frame.locator('#width').evaluate((el,v)=>{el.value=String(v);el.dispatchEvent(new Event('input',{bubbles:true}));},size/scale);};
 await resize(10);await frame.locator('#editorCenter').click();
 const done=()=>frame.waitForFunction(()=>{const d=window.gwbDetailCheck;return d?.entries.find(e=>e.key===d.selectedKey)?.state==='done';},{},{timeout:30000}).catch(async error=>{console.log("DETAIL TIMEOUT",await frame.evaluate(()=>window.gwbDetailCheck));throw error;});
 await done();let state=await frame.evaluate(()=>window.gwbDetailCheck),entry=state.entries.find(e=>e.key===state.selectedKey);
 assert.ok(entry.boxes.some(b=>b.kind==='positive'));assert.ok(entry.boxes.some(b=>b.kind==='negative'));
 await frame.locator('#detailList button').first().click();assert.equal(await frame.locator('#detailPreview').isVisible(),true);if(process.env.DETAIL_SCREENSHOT)await frame.page().screenshot({path:process.env.DETAIL_SCREENSHOT});
 const before=state.runs;await frame.locator('#editorRotateRight').click();await frame.waitForTimeout(1200);assert.equal((await frame.evaluate(()=>window.gwbDetailCheck)).runs,before,'Rotation must reuse analysis');
 // Hold a real mouse gesture longer than the debounce interval.
 const overlay=await frame.locator('#overlay').boundingBox(),center=await frame.locator('#logoRotateHandle').evaluate(e=>({x:+e.dataset.centerX,y:+e.dataset.centerY}));
 await frame.page().mouse.move(overlay.x+center.x,overlay.y+center.y);await frame.page().mouse.down();await resize(11);await frame.waitForTimeout(1200);state=await frame.evaluate(()=>window.gwbDetailCheck);assert.equal(state.holding,true);assert.equal(state.busy,false);assert.equal(state.runs,before);
 await frame.page().mouse.up();await done();state=await frame.evaluate(()=>window.gwbDetailCheck);assert.ok(state.runs>before);assert.ok(state.selectedKey.includes(',11,'));
 await frame.locator('#detailEnabled').uncheck();await resize(12);const disabledRuns=(await frame.evaluate(()=>window.gwbDetailCheck)).runs;await frame.waitForTimeout(1200);assert.equal((await frame.evaluate(()=>window.gwbDetailCheck)).runs,disabledRuns);
 await frame.locator('#detailEnabled').check();await done();
 await resize(50);const started=state.runs;await frame.waitForFunction(n=>window.gwbDetailCheck.busy&&window.gwbDetailCheck.runs>n,started);await frame.locator('#detailEnabled').uncheck();assert.equal((await frame.evaluate(()=>window.gwbDetailCheck)).busy,false);assert.ok((await frame.evaluate(()=>window.gwbDetailCheck)).cancellations>0);await resize(13);await frame.locator('#detailEnabled').check();await done();
 await resize(2000);await frame.waitForFunction(()=>{const d=window.gwbDetailCheck;return d.entries.find(e=>e.key===d.selectedKey)?.state==='error';});assert.match(await frame.locator('#detailStatus').textContent(),/слишком велика/);
 await resize(10);await done();assert.equal(await frame.locator('#detailOverlay').isVisible(),true);

 // Exercise PDF.js rerender and native PNG decoding through real upload controls.
 const files=await frame.evaluate(async()=>{const doc=await PDFLib.PDFDocument.create();const page=doc.addPage([100,100]);page.drawRectangle({x:10,y:10,width:2,height:70});const canvas=document.createElement('canvas');canvas.width=canvas.height=100;const ctx=canvas.getContext('2d');ctx.fillRect(10,10,2,70);return {pdf:Array.from(await doc.save()),png:canvas.toDataURL().split(',')[1]};});
 for(const [ext,buffer]of [['pdf',Buffer.from(files.pdf)],['png',Buffer.from(files.png,'base64')]]){
  await frame.locator('#artwork').setInputFiles({name:'detail-source.'+ext,mimeType:ext==='pdf'?'application/pdf':'image/png',buffer});
  await frame.waitForFunction(name=>document.getElementById('artworkName').textContent.includes(name),'detail-source.'+ext);await resize(10);await done();
  const current=await frame.evaluate(()=>{const d=window.gwbDetailCheck;return d.entries.find(e=>e.key===d.selectedKey);});assert.ok(current.boxes.some(b=>b.kind==='positive'),ext+' thin feature');
 }
 console.log('PrintCheck detail browser: actual worker, positive/negative markers, preview, idle hold, rotation cache, resize, disable, size budget passed');
}
