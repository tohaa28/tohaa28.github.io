import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1200,height:900}});
 const url='https://gifts.ru/__tracedraw_maketnaya_placement';
 await page.route(url,r=>r.fulfill({status:200,contentType:'text/html; charset=utf-8',
   body:'<!doctype html><html><body><div id="app">Макетная</div></body></html>'}));
 await page.route('https://tohaa28.github.io/gifts-layout-workbench-mockups/tracedraw/index.html?**',r=>r.fulfill({
   status:200,contentType:'text/html; charset=utf-8',body:"<html><body><button id=\"transfer\">Перенести на шаблон артикула</button><script>\nconst token=new URLSearchParams(location.hash.slice(1)).get('gwb');let opened=false;\nwindow.addEventListener('message',event=>{\n if(event.source!==window.parent||event.data?.token!==token)return;\n if(event.data.type==='gwb-tracedraw-open'){opened=true;parent.postMessage({type:'gwb-tracedraw-opened',token},'*')}\n});\ndocument.getElementById('transfer').onclick=()=>{\n if(!opened)return;\n parent.postMessage({type:'gwb-tracedraw-svg',token,\n svg:'<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"16mm\" height=\"8mm\" viewBox=\"3 4 16 8\"><path d=\"M3 4h16v8H3z\"/></svg>',\n logoBoundsMm:{x:3,y:4,w:16,h:8},pdfBytes:Uint8Array.from([...new TextEncoder().encode('%PDF-1.7 CMYK fixture'),...new Array(160).fill(32)]),colorSpace:'CMYK',nativePdf:true},'*');\n};\nparent.postMessage({type:'gwb-tracedraw-ready',token},'*');\n</script></body></html>"
 }));
 await page.goto(url);
 await page.evaluate(()=>{
   window.__result=null;window.__visibility=[];
   window.__returnGate=new Promise(resolve=>{window.__completeTransfer=resolve});
   window.gwbCmykRoundtrip={cropFieldPdf:async(bytes,field,bounds)=>{
     if(new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-'||field.w!==60||bounds.w!==16)throw Error('Invalid CMYK PDF bounds');
     return new Uint8Array(bytes);
   }};
   window.gwbReportLogoEditorVisibility=visible=>window.__visibility.push(visible);
   window.gwbGetActiveLogoForEditor=()=>({
     fieldSizeMm:{w:60,h:35},placementMm:{x:3,y:4,w:16,h:8,rotation:0},
     file:new File(['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 8"><rect width="16" height="8"/></svg>'],
       'logo.svg',{type:'image/svg+xml'}),
     token:'0|0|0|logo.svg',fieldIndex:0
   });
   window.gwbVectorcraftField={
     fieldInfo:()=>({w:60,h:35}),
     prepare:async file=>({file,fieldSizeMm:{w:60,h:35},fieldCanvas:true})
   };
   window.gwbApplyEditedLogoToActiveField=async(file,token,options)=>{
     options.onProgress?.(78,'Считываем большой PDF в Макетной…');
     await window.__returnGate;
     options.onProgress?.(94,'Устанавливаем макет в поле…');
     window.__result={name:file.name,token,options:{...options,onProgress:null},pdf:await file.text()};
     return {fieldIndex:0};
   };
 });
 await page.addScriptTag({path:'assets/editor-return-progress.js'});
 await page.addScriptTag({path:'assets/tracedraw-integration.js'});
 // A field already being edited in VectorCraft must not open in TraceDraw.
 await page.evaluate(()=>{
   const blocker=document.createElement('div');
   blocker.id='gwbVectorcraftHost';
   document.body.append(blocker);
 });
 await page.evaluate(()=>window.gwbTraceDrawHost.open());
 assert.equal(await page.locator('#gwbTraceDrawHost').count(),0,
  'Existing VectorCraft session prevents conflicting TraceDraw overlay');
 await page.evaluate(()=>document.getElementById('gwbVectorcraftHost').remove());
 await page.evaluate(()=>window.gwbTraceDrawHost.open());
 const overlay=page.locator('#gwbTraceDrawHost');
 await overlay.waitFor();
 const iframe=page.frameLocator('#gwbTraceDrawHost iframe');
 await page.getByText('Редактируется поле',{exact:false}).waitFor({timeout:15000});
 await iframe.locator('#transfer').click();
 const progress=page.locator('#gwbTraceDrawHost .gwb-return-progress');
 await progress.waitFor({state:'visible'});
 await page.waitForFunction(()=>document.querySelector('#gwbTraceDrawHost .gwb-return-meter')?.value>=78);
 assert.equal(await page.locator('#gwbTraceDrawHost .gwb-return-percent').textContent(),'78%');
 assert.equal(await page.locator('#gwbTraceDrawHost iframe').evaluate(el=>el.inert),true,
   'TraceDraw iframe is locked while Maketnaya parses the exported PDF');
 assert.equal(await page.locator('#gwbTraceDrawHost button').filter({hasText:'Закрыть без изменений'}).isDisabled(),true,
   'Closing while transfer is running is blocked');
 await page.evaluate(()=>window.gwbTraceDrawHost.close());
 assert.equal(await page.locator('#gwbTraceDrawHost').count(),1,
   'Programmatic Close cannot discard an in-flight application');
 assert.equal(await page.evaluate(()=>window.__result),null,'Commit is not announced before completion');
 await page.evaluate(()=>window.__completeTransfer());
 await page.waitForFunction(()=>window.__result!==null);
 const result=await page.evaluate(()=>window.__result);
 assert.equal(result.token,'0|0|0|logo.svg');
 assert.deepEqual(result.options.artworkBoundsMm,{x:3,y:4,w:16,h:8});
 assert.deepEqual(result.options.fieldSizeMm,{w:60,h:35});
 assert.match(result.pdf,/^%PDF-1\.7/);
 assert.equal(result.options.nativePdfCmyk,true);
 assert.equal(result.options.colorSpace,'CMYK');
 assert.match(result.name,/tracedraw-cmyk\.pdf$/);
 await page.waitForFunction(()=>document.getElementById('gwbTraceDrawHost')===null);
 assert.deepEqual(await page.evaluate(()=>window.__visibility),[true,false]);
 console.log('TraceDraw iframe handoff: exact field and source, real art bounds, application guard and closing');
}finally{await browser.close()}
