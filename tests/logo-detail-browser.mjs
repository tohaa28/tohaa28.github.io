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
 assert.equal(await frame.locator('#logoDetailCheck').getAttribute('open'),null);assert.equal(await frame.locator('#detailOverlay').isVisible(),true);await frame.locator('#logoDetailCheck summary').click();await frame.locator('#detailList button').first().click();assert.equal(await frame.locator('#detailPreview').isVisible(),true);if(process.env.DETAIL_SCREENSHOT)await frame.page().screenshot({path:process.env.DETAIL_SCREENSHOT});
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


 // Dense logo: later rows used to be discarded by the per-kind prefix cap.
 const cells=Array.from({length:400},(_,i)=>'<rect x="'+(i%20*20+4)+'" y="'+(Math.floor(i/20)*20+4)+'" width="2" height="14"/>').join('');
 await frame.locator('#artwork').setInputFiles({name:'detail-full-grid.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="40mm" height="40mm" viewBox="0 0 404 404">'+cells+'</svg>')});
 await frame.waitForFunction(()=>document.getElementById('artworkName').textContent.includes('detail-full-grid.svg'));await resize(40);await frame.locator('#editorCenter').click();await done();
 const grid=await frame.evaluate(()=>{const d=window.gwbDetailCheck;return d.entries.find(e=>e.key===d.selectedKey);});assert.equal(grid.boxes.filter(b=>b.kind==='positive').length,400);assert.ok(grid.boxes.some(b=>b.kind==='positive'&&b.cx>.9&&b.cy>.9));
 assert.ok(await frame.locator('#detailList button').count()<=101,'Only one list page should be built initially');
 while(await frame.locator('#detailList button').filter({hasText:'Показать ещё'}).count())await frame.locator('#detailList button').filter({hasText:'Показать ещё'}).click();
 assert.equal(await frame.locator('#detailList button').count(),grid.boxes.length);await frame.locator('#detailList button').last().click();assert.equal(await frame.locator('#detailPreview').isVisible(),true);
 if(process.env.COVERAGE_SCREENSHOT)await frame.page().screenshot({path:process.env.COVERAGE_SCREENSHOT});
 // Different colours may touch, but their rasterized boundary must never become a thin element or gap.
 const colourBoundary=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="20mm" height="10mm" viewBox="0 0 200 100"><path fill="#ef233c" d="M0 0H112L88 100H0Z"/><path fill="#1d4ed8" d="M112 0H200V100H88Z"/></svg>');
 await frame.locator('#artwork').setInputFiles({name:'detail-colour-boundary.svg',mimeType:'image/svg+xml',buffer:colourBoundary});
 await frame.waitForFunction(()=>document.getElementById('artworkName').textContent.includes('detail-colour-boundary.svg'));await resize(20);await frame.locator('#editorCenter').click();await done();
 const boundary=await frame.evaluate(()=>{const d=window.gwbDetailCheck;return d.entries.find(e=>e.key===d.selectedKey);});
 assert.match(boundary.algorithm,/colour-boundary-safe/);
 assert.equal(boundary.boxes.filter(b=>b.kind==='positive'||b.kind==='negative').length,0,'Colour boundary must not create thin-element or gap markers: '+JSON.stringify(boundary));
 // Exercise PDF.js rerender and native PNG decoding through real upload controls.
 const files=await frame.evaluate(async()=>{const doc=await PDFLib.PDFDocument.create();const page=doc.addPage([100,100]);page.drawRectangle({x:10,y:10,width:2,height:70});const canvas=document.createElement('canvas');canvas.width=canvas.height=100;const ctx=canvas.getContext('2d');ctx.fillRect(10,10,2,70);return {pdf:Array.from(await doc.save()),png:canvas.toDataURL().split(',')[1]};});
 for(const [ext,buffer]of [['pdf',Buffer.from(files.pdf)],['png',Buffer.from(files.png,'base64')]]){
  await frame.locator('#artwork').setInputFiles({name:'detail-source.'+ext,mimeType:ext==='pdf'?'application/pdf':'image/png',buffer});
  await frame.waitForFunction(name=>document.getElementById('artworkName').textContent.includes(name),'detail-source.'+ext);await resize(10);await done();
  const current=await frame.evaluate(()=>{const d=window.gwbDetailCheck;return d.entries.find(e=>e.key===d.selectedKey);});assert.ok(current.boxes.some(b=>b.kind==='positive'),ext+' thin feature');
 }
 console.log('PrintCheck detail browser: same-colour-only positive/negative scan, colour-boundary suppression, actual worker, preview, idle hold, rotation cache, resize, disable, size budget passed');
}
