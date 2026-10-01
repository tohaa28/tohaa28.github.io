import assert from 'node:assert/strict';
export async function verifyErrorOverlay(frame){
 const panel=frame.locator('#logoErrorOverlay');
 const expected=await frame.evaluate(()=>window.gwbLogoPreflight.flatMap(r=>r.findings.filter(f=>f.status==='bad'||f.status==='ok'&&f.id!=='method').map(f=>({status:f.status,text:r.label+': '+f.text}))).sort((a,b)=>(a.status==='bad'?0:1)-(b.status==='bad'?0:1)).map(f=>(f.status==='ok'?'✓ ':'! ')+f.text));
 assert.deepEqual(await panel.locator('li').allTextContents(),expected);
 assert.equal(await panel.isVisible(),expected.length>0);
 if(expected.length){
  assert.equal(await panel.locator('button,input,select,a').count(),0);
  const layout=await panel.evaluate(el=>{const r=el.getBoundingClientRect(),s=document.getElementById('stageScroll').getBoundingClientRect();return {right:s.right-r.right,top:r.top-s.top,width:r.width,font:parseFloat(getComputedStyle(el).fontSize)};});
  assert.ok(layout.right>=0&&layout.right<=24,JSON.stringify(layout));assert.ok(layout.top>=0&&layout.top<=24,JSON.stringify(layout));assert.ok(layout.width<=360&&layout.font<=12);
  assert.ok(!(await frame.locator('#simpleChecks').textContent()).includes(expected[0]),'Sidebar must not duplicate the entire error list');
 }
}
