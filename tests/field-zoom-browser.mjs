import assert from 'node:assert/strict';
export async function verifyFieldZoom(frame){
 const data=()=>frame.evaluate(()=>({position:document.getElementById('position').textContent,sizes:window.gwbLogoPreflight.map(r=>r.dimensionsMm),width:document.getElementById('width').value,height:document.getElementById('height').value,angle:document.getElementById('editorAngle').value}));
 if(await frame.locator('#logoDetailCheck').getAttribute('open')!==null)await frame.locator('#logoDetailCheck summary').click();assert.equal(await frame.locator('#detailOverlay').isVisible(),true);
 const extent=await frame.evaluate(()=>{const sc=document.getElementById('stageScroll'),stage=document.getElementById('stage'),css=getComputedStyle(sc);return {width:stage.getBoundingClientRect().width,available:sc.clientWidth-parseFloat(css.paddingLeft)-parseFloat(css.paddingRight)};});assert.ok(Math.abs(extent.width-extent.available)<3,JSON.stringify(extent));
 const before=await data(),canvas=frame.locator('#overlay');await frame.locator('#fieldZoomIn').click();await frame.waitForFunction(()=>document.getElementById('fieldZoomValue').value==='150%');await frame.locator('#fieldZoomIn').click();await frame.waitForFunction(()=>document.getElementById('fieldZoomValue').value==='225%');assert.deepEqual(await data(),before);
 // Panning the view must not drag the logo.
 await canvas.focus();const box=await canvas.boundingBox();await frame.page().keyboard.down('Space');await frame.page().mouse.move(box.x+box.width/2,box.y+box.height/2);await frame.page().mouse.down();await frame.page().mouse.move(box.x+box.width/2+35,box.y+box.height/2+20,{steps:4});await frame.page().mouse.up();await frame.page().keyboard.up('Space');assert.deepEqual(await data(),before);
 if(process.env.ZOOM_SCREENSHOT)await frame.page().screenshot({path:process.env.ZOOM_SCREENSHOT});
 await frame.locator('#fieldZoomFit').click();await frame.waitForFunction(()=>document.getElementById('fieldZoomValue').value==='100%');assert.deepEqual(await data(),before);
 await frame.locator('#zoomPage').click();assert.equal(await frame.locator('#fieldZoom').isVisible(),false);
 await frame.locator('#orderFieldChoice').selectOption('1');await frame.waitForFunction(()=>!document.getElementById('fieldZoom').hidden);assert.equal(await frame.locator('#fieldZoomValue').textContent(),'100%');
 console.log('Field zoom: magnification, view pan, fit reset, whole-page mode and physical logo dimensions passed');
}
