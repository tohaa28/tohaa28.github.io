import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import fs from 'node:fs';
assert.ok(fs.readFileSync('assets/vectorcraft-integration.js','utf8').includes('gwbApplyEditedLogoToActiveField'));
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1360,height:880}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 page.on('dialog',d=>d.accept());
 await page.route('https://tohaa28.github.io/gifts-layout-workbench-mockups/vectorcraft/index.html*',async route=>{
   const body=[
     '<!DOCTYPE html><html><body><h1>Mock VectorCraft WASM I/O</h1><script>',
     "const token=decodeURIComponent(location.hash.slice('#gwb='.length));",
     "window.__seen=[];",
     "window.addEventListener('message',e=>{",
     "if(e.data?.token!==token)return;",
     "if(e.data?.type==='gwb-vectorcraft-open'){",
     "window.__seen.push({name:e.data.name,bytes:Array.from(new Uint8Array(e.data.bytes))});",
     "parent.postMessage({type:'gwb-vectorcraft-opened',token},'*');",
     "}",
     "if(e.data?.type==='gwb-vectorcraft-apply'){",
     "const svg='<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 100 80\"><path d=\"M10 10 L80 70 Z\" fill=\"#129932\"/></svg>';",
     "parent.postMessage({type:'gwb-vectorcraft-svg',token,bytes:new TextEncoder().encode(svg)},'*');",
     "}",
     "});",
     "parent.postMessage({type:'gwb-vectorcraft-ready',token},'*');",
     '</script></body></html>'
   ].join('\n');
   await route.fulfill({status:200,contentType:'text/html',body});
 });
 await page.setContent('<!doctype html><html><body><button id="editorOpenLogoEditor">Редактор логотипа</button><div id="status"></div></body></html>');
 await page.evaluate(()=>{
   const original=new File(['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12"><rect width="12" height="12"/></svg>'],'art.svg',{type:'image/svg+xml'});
   const different=new File(['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12"><circle r="5"/></svg>'],'art.svg',{type:'image/svg+xml'});
   window.__placed=[{file:original,placement:{x:22,y:33,w:100,h:60,rotation:30,clipToField:true}},
                    {file:different,placement:{x:1,y:2,w:80,h:80,rotation:0,clipToField:false}}];
   window.__selected=0;window.__applied=[];
   window.gwbGetActiveLogoForEditor=()=>{
     const i=window.__selected;
     return {token:i+'|'+window.__placed[i].file.name,fieldIndex:i,hasArtwork:true,file:window.__placed[i].file};
   };
   window.gwbApplyEditedLogoToActiveField=async(file,token)=>{
     const i=window.__selected,current=window.__placed[i];
     if(token!==i+'|'+current.file.name)throw Error('token mismatch');
     current.file=file;window.__applied.push(i);
   };
 });
 await page.addScriptTag({path:'assets/vectorcraft-integration.js'});
 await page.locator('#editorOpenLogoEditor').click();
 await page.getByText('Логотип передан в VectorCraft.',{exact:false}).waitFor({timeout:15000});
 const iframe=page.frameLocator('#gwbVectorcraftHost iframe');
 const seen=await iframe.locator('body').evaluate(()=>window.__seen);
 assert.equal(seen.length,1,'Original artwork sent as bytes exactly once');
 assert.equal(seen[0].name,'art.svg');
 assert.equal(String.fromCharCode(...seen[0].bytes.slice(0,4)),'<svg');
 assert.equal(await page.locator('#gwbVectorcraftHost').isVisible(),true);
 await page.evaluate(()=>window.postMessage({type:'gwb-vectorcraft-svg',token:location.hash,bytes:new TextEncoder().encode('<svg/>')},'*'));
 assert.deepEqual(await page.evaluate(()=>window.__applied),[],'Untrusted sender did not overwrite the artwork');
 await page.getByRole('button',{name:'Применить в Макетной'}).click();
 await page.locator('#gwbVectorcraftHost').waitFor({state:'detached'});
 const state=await page.evaluate(async()=>({
  first:await window.__placed[0].file.text(),
  second:await window.__placed[1].file.text(),
  geometry:window.__placed.map(x=>x.placement),
  applied:window.__applied
 }));
 assert.match(state.first,/<path\b/,'Returned SVG is the actual contents of the mock editor');
 assert.match(state.second,/<circle/,'Other placement is unchanged, even with identical filename');
 assert.deepEqual(state.geometry[0],{x:22,y:33,w:100,h:60,rotation:30,clipToField:true},'Position/angle/crop preserved');
 assert.deepEqual(state.applied,[0],'Exactly one original field replaced');
 await page.locator('#editorOpenLogoEditor').click();
 await page.getByText('Логотип передан в VectorCraft.',{exact:false}).waitFor({timeout:15000});
 await page.getByRole('button',{name:'Закрыть без изменений'}).click();
 assert.equal(await page.locator('#gwbVectorcraftHost').count(),0);
 assert.deepEqual(await page.evaluate(()=>window.__applied),[0],'Cancel did not replace the field');
 assert.deepEqual(errors,[],'No browser errors');
 console.log('VectorCraft in-browser handoff: original bytes / session origin / selected-field return / geometry / cancel passed');
}finally{await browser.close()}
