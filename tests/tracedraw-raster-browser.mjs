import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setContent('<!doctype html><html><body></body></html>');
 await page.addScriptTag({path:'assets/vectorcraft-field.js'});
 await page.addScriptTag({path:'assets/tracedraw-raster-bridge.js'});
 const r=await page.evaluate(async()=>{
   const field={fieldSizeMm:{w:70,h:40},
     placementMm:{x:8,y:6,w:22,h:12,rotation:12}};
   const c=document.createElement('canvas');c.width=8;c.height=6;
   const ctx=c.getContext('2d');
   ctx.fillStyle='#e03441';ctx.fillRect(0,0,4,6);
   ctx.fillStyle='#2a75c3';ctx.fillRect(4,0,4,6);
   const jpeg=await new Promise(resolve=>c.toBlob(resolve,'image/jpeg',.95));
   const webp=await new Promise(resolve=>c.toBlob(resolve,'image/webp',.95));
   const prepare=async blob=>{
     const input=new File([blob],'raster.'+(blob.type.includes('webp')?'webp':'jpg'),{type:blob.type});
     const a=await window.gwbVectorcraftField.prepare(input,field);
     const raw=await a.file.text();
     const out=await window.gwbTraceDrawRasterBridge.normalize(a);
     const xml=new DOMParser().parseFromString(await out.file.text(),'image/svg+xml');
     const image=xml.querySelector('image');
     return {initialType:raw.match(/data:image\/(jpeg|webp)/)?.[1],
       converted:out.convertedRasterCount,embedded:out.embeddedRasterCount,
       href:image?.getAttribute('href')?.slice(0,22),
       width:image?.getAttribute('width'),height:image?.getAttribute('height'),
       rotate:image?.getAttribute('transform'),view:xml.documentElement.getAttribute('viewBox')};
   };
   const j=await prepare(jpeg),w=await prepare(webp);
   const original='<svg xmlns="http://www.w3.org/2000/svg" width="70mm" height="40mm" viewBox="0 0 70 40">'+
     '<path d="M1 2L12 2L12 8Z" fill="#017a3c"/>'+
     '<image x="21" y="8" width="8" height="6" href="'+c.toDataURL('image/jpeg',.98)+'"/></svg>';
   const mixed=await window.gwbTraceDrawRasterBridge.normalize({
     file:new File([original],'composite.svg',{type:'image/svg+xml'}),
     fieldSizeMm:{w:70,h:40},fieldCanvas:true
   });
   const svg=new DOMParser().parseFromString(await mixed.file.text(),'image/svg+xml');
   const png=await window.gwbTraceDrawRasterBridge.normalize({
     file:new File([original.replace(/data:image\/jpeg;base64,[^"]+/,c.toDataURL('image/png'))],
       'already-png.svg',{type:'image/svg+xml'}),fieldSizeMm:{w:70,h:40}
   });
   let externalRejected=false;
   try{
     await window.gwbTraceDrawRasterBridge.normalize({file:new File([
       '<svg xmlns="http://www.w3.org/2000/svg"><image href="https://example.com/r.png"/></svg>'
     ],'remote.svg')});
   }catch(e){externalRejected=/внешнее изображение/.test(e.message)}
   const pdf=new File(['%PDF-1.7'],'already.pdf',{type:'application/pdf'});
   const same=await window.gwbTraceDrawRasterBridge.normalize({file:pdf});
   return {j,w,mixed:{converted:mixed.convertedRasterCount,
      raster:svg.querySelector('image')?.getAttribute('href')?.startsWith('data:image/png;base64,'),
      vector:svg.querySelector('path')?.getAttribute('d'),
      fill:svg.querySelector('path')?.getAttribute('fill'),
      view:svg.documentElement.getAttribute('viewBox')},
     pngUnchanged:png.convertedRasterCount===0,externalRejected,pdfUnchanged:same.file===pdf};
 });
 for(const fmt of [r.j,r.w]){
   assert.equal(fmt.converted,1,'JPEG/WebP bitmap must actually become a PNG image');
   assert.equal(fmt.embedded,1);
   assert.equal(fmt.href,'data:image/png;base64,');
   assert.equal(fmt.width,'22');
   assert.equal(fmt.height,'12');
   assert.match(fmt.rotate,/rotate\(12/);
   assert.equal(fmt.view,'0 0 70 40');
 }
 assert.equal(r.j.initialType,'jpeg');
 assert.equal(r.w.initialType,'webp');
 assert.deepEqual(r.mixed,{converted:1,raster:true,
   vector:'M1 2L12 2L12 8Z',fill:'#017a3c',view:'0 0 70 40'});
 assert.equal(r.pngUnchanged,true,'Native PNG can remain unmodified');
 assert.equal(r.pdfUnchanged,true,'Original PDF route never rasterized');
 assert.equal(r.externalRejected,true,'No remote image dependencies allowed');
 assert.deepEqual(errors,[]);
 console.log('TraceDraw raster compatibility: JPEG, WebP, mixed SVG, intact placement/PDF — PASS');
}finally{await browser.close()}
