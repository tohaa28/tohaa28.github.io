import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1200,height:900}});
 const url='https://gifts.ru/__tracedraw_maketnaya_placement';
 await page.route(url,r=>r.fulfill({status:200,contentType:'text/html; charset=utf-8',
   body:'<!doctype html><html><body><div id="app">Макетная</div></body></html>'}));
 await page.route('https://tohaa28.github.io/gifts-layout-workbench-mockups/tracedraw/index.html?**',r=>r.fulfill({
   status:200,contentType:'text/html; charset=utf-8',body:"<html><body><button id=\"transfer\">Перенести на шаблон артикула</button><script>\nconst token=new URLSearchParams(location.hash.slice(1)).get('gwb');let opened=false;\nwindow.addEventListener('message',event=>{\n if(event.source!==window.parent||event.data?.token!==token)return;\n if(event.data.type==='gwb-tracedraw-open'){opened=true;parent.postMessage({type:'gwb-tracedraw-opened',token},'*')}\n});\ndocument.getElementById('transfer').onclick=()=>{\n if(!opened)return;\n parent.postMessage({type:'gwb-tracedraw-svg',token,\n svg:'<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"16mm\" height=\"8mm\" viewBox=\"3 4 16 8\"><path d=\"M3 4h16v8H3z\"/></svg>',\n logoBoundsMm:{x:3,y:4,w:16,h:8}},'*');\n};\nparent.postMessage({type:'gwb-tracedraw-ready',token},'*');\n</script></body></html>"
 }));
 await page.goto(url);
 await page.evaluate(()=>{
   window.__result=null;window.__visibility=[];
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
     window.__result={name:file.name,token,options,svg:await file.text()};
     return {fieldIndex:0};
   };
 });
 await page.addScriptTag({path:'assets/tracedraw-integration.js'});
 await page.evaluate(()=>window.gwbTraceDrawHost.open());
 const overlay=page.locator('#gwbTraceDrawHost');
 await overlay.waitFor();
 const iframe=page.frameLocator('#gwbTraceDrawHost iframe');
 await page.getByText('Редактируется поле',{exact:false}).waitFor({timeout:15000});
 await iframe.locator('#transfer').click();
 await page.waitForFunction(()=>window.__result!==null);
 const result=await page.evaluate(()=>window.__result);
 assert.equal(result.token,'0|0|0|logo.svg');
 assert.deepEqual(result.options.artworkBoundsMm,{x:3,y:4,w:16,h:8});
 assert.deepEqual(result.options.fieldSizeMm,{w:60,h:35});
 assert.match(result.svg,/<path /);
 await page.waitForFunction(()=>document.getElementById('gwbTraceDrawHost')===null);
 assert.deepEqual(await page.evaluate(()=>window.__visibility),[true,false]);
 console.log('TraceDraw iframe handoff: exact field and source, real art bounds, application guard and closing');
}finally{await browser.close()}
