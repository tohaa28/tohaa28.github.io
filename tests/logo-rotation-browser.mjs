import assert from 'node:assert/strict';
export async function verifyRotationAndColors(frame){
 const handle=frame.locator('#logoRotateHandle');await handle.waitFor({state:'visible'});
 const size=await frame.locator('#width').inputValue();
 const start=Number(await frame.locator('#editorAngle').inputValue());
 async function drag(degrees,{shift=false,cancel=false}={}){
  await handle.scrollIntoViewIfNeeded();const box=await handle.boundingBox(),canvas=await frame.locator('#overlay').boundingBox();
  const center=await handle.evaluate(el=>({x:Number(el.dataset.centerX),y:Number(el.dataset.centerY)}));center.x+=canvas.x;center.y+=canvas.y;
  const x=box.x+box.width/2,y=box.y+box.height/2,r=Math.hypot(x-center.x,y-center.y),a=Math.atan2(y-center.y,x-center.x);
  const mouse=frame.page().mouse;await mouse.move(x,y);await mouse.down();if(shift)await frame.page().keyboard.down('Shift');
  for(let n=1;n<=10;n++){const angle=a+degrees*n/10*Math.PI/180;await mouse.move(center.x+r*Math.cos(angle),center.y+r*Math.sin(angle));}
  if(cancel)await frame.page().keyboard.press('Escape');await mouse.up();if(shift)await frame.page().keyboard.up('Shift');
  return Number(await frame.locator('#editorAngle').inputValue());
 }
 await frame.locator("#confirmErrors").check();
 const angle=await drag(90);
 assert.equal(await frame.locator("#confirmErrors").isChecked(),false);assert.ok(Math.abs(angle-(start+90)%360)<2,`Quarter turn: ${start} -> ${angle}`);
 assert.equal(await frame.locator('#width').inputValue(),size);
 const snapped=await drag(22,{shift:true});assert.equal(snapped%15,0);
 assert.equal(await drag(35,{cancel:true}),snapped);
 await handle.focus();await frame.page().keyboard.press('ArrowRight');assert.equal(Number(await frame.locator('#editorAngle').inputValue()),(snapped+1)%360);
 const evidence=await frame.evaluate(async()=>{
  const {inspectArtwork,checkLogo}=await import('https://tohaa28.github.io/gifts-layout-workbench/assets/logo-preflight.mjs?v=20260929-2');
  const result={};
  for(const [key,fill] of [['black','black'],['gray','#888'],['red','red']]){
   const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="10mm" height="10mm" viewBox="0 0 10 10"><path d="M1 1H9V9H1Z" fill="${fill}"/></svg>`;
   const root=new DOMParser().parseFromString(svg,'image/svg+xml').documentElement,image=new Image();image.src='data:image/svg+xml;base64,'+btoa(svg);await image.decode();
   const art={ext:'svg',w:10,h:10,svg:{root},image};art.preflight=await inspectArtwork(art);
   result[key]=checkLogo({art,placement:{w:10,h:10},field:{},method:'LM1'}).findings.find(f=>f.id==='monochrome');
  }
  for(const [key,color] of [['pdfBlack',PDFLib.grayscale(0)],['pdfRed',PDFLib.rgb(1,0,0)]]){
   const pdf=await PDFLib.PDFDocument.create();pdf.addPage([72,72]).drawRectangle({x:5,y:5,width:50,height:50,color});const bytes=await pdf.save();
   const doc=await pdfjsLib.getDocument({data:bytes.slice(),isEvalSupported:false}).promise;
   const art={ext:'pdf',w:25.4,h:25.4,pdfPage:await doc.getPage(1),bytes,pages:1};art.preflight=await inspectArtwork(art,pdfjsLib.OPS);
   result[key]={finding:checkLogo({art,placement:{w:25.4,h:25.4},field:{},method:'LM1'}).findings.find(f=>f.id==='monochrome'),evidence:art.preflight.vectorColors};await doc.destroy();
  }
  return result;
 });
 assert.equal(evidence.black.status,'ok');assert.equal(evidence.gray.status,'bad');assert.equal(evidence.red.status,'bad');
 assert.equal(evidence.pdfBlack.finding.status,'ok',JSON.stringify(evidence.pdfBlack));assert.equal(evidence.pdfRed.finding.status,'bad',JSON.stringify(evidence.pdfRed));
 if(process.env.ROTATION_SCREENSHOT)await frame.page().screenshot({path:process.env.ROTATION_SCREENSHOT});
 console.log('Mouse rotation: quarter turn, Shift snap, Escape, keyboard, unchanged dimensions; SVG/PDF laser colors passed');
}
