import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setContent('<!doctype html><html><body>CMYK transfer test</body></html>');
 await page.addScriptTag({path:'vendor/pdf-lib.min.js'});
 await page.addScriptTag({path:'assets/cmyk-roundtrip.js'});
 const report=await page.evaluate(async()=>{
   const lib=window.PDFLib,v=window.gwbCmykRoundtrip;
   if(!lib?.PDFDocument||!v?.verifyPdf)throw Error('Missing PDF validator');
   async function fixture(color){
     const d=await lib.PDFDocument.create();const p=d.addPage([200,100]);
     p.drawRectangle({x:20,y:10,width:70,height:40,color});
     return await d.save({useObjectStreams:false});
   }
   const mm=25.4/72;
   const cm=await fixture(lib.cmyk(.75,.2,.1,.4));
   const rgb=await fixture(lib.rgb(.75,.2,.1));
   const bounds={x:0,y:0,w:200*mm,h:100*mm};
   const verified=await v.verifyPdf(cm,bounds);
   let rgbRejected=false;
   try{await v.verifyPdf(rgb,bounds)}catch(err){rgbRejected=/RGB/.test(err.message)}
   let boundsRejected=false;
   try{await v.verifyPdf(cm,{...bounds,w:100})}catch(err){boundsRejected=/габаритам/.test(err.message)}
   const field={w:200*mm,h:100*mm};
   const original={x:20*mm,y:50*mm,w:70*mm,h:40*mm};
   const cropped=await v.cropFieldPdf(cm,field,original);
   const croppedReport=await v.verifyPdf(cropped,original);
   // The PDF still contains native CMYK paint after page box crop.
   const kept=await lib.PDFDocument.load(cropped);
   const rectangle=kept.getPage(0).getCropBox();
   const cropOrigin=rectangle.x*mm;
   return {verifiedModel:verified.model,processColors:verified.cmyk,
     rgbRejected,boundsRejected,croppedModel:croppedReport.model,
     croppedColors:croppedReport.cmyk,
     cropWidthMm:rectangle.width*mm,cropOrigin};
 });
 assert.equal(report.verifiedModel,'CMYK','CMYK color operators kept');
 assert.ok(report.processColors>=1,'Found a real CMYK PDF paint operator');
 assert.equal(report.rgbRejected,true,'No false CMYK certification for RGB artwork');
 assert.equal(report.boundsRejected,true,'Reject wrong artwork dimensions');
 assert.equal(report.croppedModel,'CMYK');
 assert.ok(report.croppedColors>=1,'Cropping the page retains the original CMYK color');
 assert.ok(Math.abs(report.cropWidthMm-70*25.4/72)<.002);
 assert.ok(Math.abs(report.cropOrigin-20*25.4/72)<.002);
 assert.deepEqual(errors,[]);
 console.log('CMYK PDF roundtrip: ink operators, RGB refusal, bounds and lossless crop passed');
}finally{await browser.close()}
