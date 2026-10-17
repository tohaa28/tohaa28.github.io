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
     "window.__seen=[];window.__fieldSize=null;window.__nativeTheme='native';window.__themeChanges=[];",
     "window.addEventListener('message',e=>{",
     "if(e.data?.token!==token)return;",
     "if(e.data?.type==='gwb-vectorcraft-theme'){",
     " window.__nativeTheme=e.data.mode;",
     " window.__themeChanges.push(e.data.mode);",
     " parent.postMessage({type:'gwb-vectorcraft-theme-applied',token,message:e.data.mode},'*');",
     "}",
     "if(e.data?.type==='gwb-vectorcraft-open'){",
     "window.__fieldSize=e.data.fieldSizeMm;",
     "window.__seen.push({name:e.data.name,bytes:Array.from(new Uint8Array(e.data.bytes)),fieldSize:e.data.fieldSizeMm,fieldCanvas:e.data.fieldCanvas});",
     "parent.postMessage({type:'gwb-vectorcraft-opened',token},'*');",
     "}",
     "if(e.data?.type==='gwb-vectorcraft-apply'){",
     "const b=window.__fieldSize.w===120?{x:12,y:8,w:40,h:18}:{x:5,y:4,w:22,h:12};",
     "const fw=b.w*72/25.4,fh=b.h*72/25.4;",
     "const svg='<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"'+fw+'\" height=\"'+fh+'\" viewBox=\"0 0 '+fw+' '+fh+'\"><path d=\"M0 0 L'+fw+' '+fh+' Z\" fill=\"#129932\"/></svg>';",
     "parent.postMessage({type:'gwb-vectorcraft-svg',token,bytes:new TextEncoder().encode(svg),logoBoundsMm:b},'*');",


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
   window.__placed=[{file:original,field:{x:20,y:30,w:120,h:80},placement:{x:22,y:33,w:100,h:60,rotation:30,clipToField:true}},
                    {file:different,field:{x:1,y:2,w:80,h:80},placement:{x:1,y:2,w:80,h:80,rotation:0,clipToField:false}}];
   window.__selected=0;window.__applied=[];
   window.gwbGetActiveLogoForEditor=()=>{
     const i=window.__selected;
     const item=window.__placed[i],f=item.field,p=item.placement;
     return {token:i+'|'+item.file.name,fieldIndex:i,hasArtwork:true,file:item.file,
       fieldSizeMm:{w:f.w,h:f.h},
       placementMm:{x:p.x-f.x,y:p.y-f.y,w:p.w,h:p.h,rotation:p.rotation,clipToField:p.clipToField}};
   };
   window.gwbApplyEditedLogoToActiveField=async(file,token,options)=>{
     const i=window.__selected,current=window.__placed[i];
     if(token!==i+'|'+current.file.name)throw Error('token mismatch');
     if(options.fieldSizeMm.w!==current.field.w||options.fieldSizeMm.h!==current.field.h)throw Error('Wrong field dimensions');
     const b=options.artworkBoundsMm;
     if(!b||![b.x,b.y,b.w,b.h].every(Number.isFinite))throw Error('Missing visible art bounds');
     const parsed=new DOMParser().parseFromString(await file.text(),'image/svg+xml').documentElement;
     if(parsed.getAttribute('width')!==b.w+'mm')throw Error('Artwork SVG not cropped');
     current.file=file;
     current.placement={x:current.field.x+b.x,y:current.field.y+b.y,w:b.w,h:b.h,
       rotation:0,clipToField:current.placement.clipToField};
     window.__applied.push(i);
   };
 });
 await page.addScriptTag({path:'assets/vectorcraft-field.js'});
 await page.addScriptTag({path:'assets/vectorcraft-integration.js'});
 await page.locator('#editorOpenLogoEditor').click();
 await page.getByText('VectorCraft открыл документ',{exact:false}).waitFor({timeout:15000});
 const iframe=page.frameLocator('#gwbVectorcraftHost iframe');
 const skin=page.locator('#gwbVectorcraftHost button').filter({hasText:'Стиль gifts.ru'});
 const simple=page.locator('#gwbVectorcraftHost button').filter({hasText:'Открыть прежний редактор'});
 assert.equal(await skin.count(),1,'Native theme switch is retained internally');
 assert.equal(await simple.count(),1,'Legacy editor is retained internally');
 assert.equal(await skin.isHidden(),true,'Native VectorCraft style switch is hidden');
 assert.equal(await simple.isHidden(),true,'Legacy/simple editor switch is hidden');
 assert.equal(await skin.getAttribute('aria-pressed'),'true','gifts.ru remains default');
 assert.deepEqual(await iframe.locator('body').evaluate(()=>window.__themeChanges),['gifts'],
   'Opening an embedded VectorCraft session automatically sets the actual engine to gifts.ru');
 assert.equal(await iframe.locator('body').evaluate(()=>window.__seen.length),1,
   'Hiding controls does not re-import or mutate active artwork');
 // Browser fullscreen must remove the Maketnaya header/footer yet keep the
 // same iframe, not create a second VectorCraft document.
 await page.getByRole('button',{name:'На весь экран'}).click();
 await page.waitForFunction(()=>document.fullscreenElement?.id==='gwbVectorcraftHost',{timeout:12000});
 assert.equal(await page.getByRole('button',{name:'Применить в Макетной'}).count(),0,
   'No duplicate Maketnaya Apply is rendered in fullscreen');
 assert.equal(await iframe.locator('body').evaluate(()=>window.__seen.length),1);
 await page.evaluate(()=>document.exitFullscreen());
 await page.waitForFunction(()=>!document.fullscreenElement);
 assert.equal(await page.getByRole('button',{name:'Применить в Макетной'}).count(),0,
   'No outer Apply reappears after leaving fullscreen');
 const seen=await iframe.locator('body').evaluate(()=>window.__seen);
 assert.equal(seen.length,1,'Original artwork sent as bytes exactly once');
 assert.match(seen[0].name,/art-поле\.svg/);
 assert.deepEqual(seen[0].fieldSize,{w:120,h:80});
 assert.equal(seen[0].fieldCanvas,true);
 const wrongPage=await page.evaluate(()=>{
   try{
     window.gwbVectorcraftField.normalizeExport(
       '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"/>',
       {w:120,h:80},{x:12,y:8,w:40,h:18});
     return false;
   }catch(e){return /не соответствует нарисованному логотипу/.test(e.message)}
 });
 assert.equal(wrongPage,true,'Mismatched artboard never silently stretches the edited vector');
 const noViewBox=await page.evaluate(async()=>{
   const src=new File(['<svg xmlns="http://www.w3.org/2000/svg" width="40mm" height="20mm"><rect width="100" height="50"/></svg>'],'svg-no-viewbox.svg',{type:'image/svg+xml'});
   const out=await window.gwbVectorcraftField.prepare(src,{fieldSizeMm:{w:120,h:80},placementMm:{x:4,y:2,w:40,h:20,rotation:0}});
   return await out.file.text();
 });
 assert.match(noViewBox,/<rect/,'Native vector remains editable even when viewBox was omitted');
 const sentXml=new TextDecoder().decode(new Uint8Array(seen[0].bytes));
 assert.match(sentXml,/width="120mm"/);
 assert.match(sentXml,/height="80mm"/);
 assert.match(sentXml,/rotate\(30\)/,'Original logo rotation is embedded in editable artwork');
 assert.equal(await page.locator('#gwbVectorcraftHost').isVisible(),true);
 await page.evaluate(()=>window.postMessage({type:'gwb-vectorcraft-svg',token:location.hash,bytes:new TextEncoder().encode('<svg/>')},'*'));
 assert.deepEqual(await page.evaluate(()=>window.__applied),[],'Untrusted sender did not overwrite the artwork');
 // Simulate the trusted message emitted by the only visible native egui action.
 // It must still use the exact same validated export/placement pipeline.
 await iframe.locator('body').evaluate(()=>parent.postMessage({
   type:'gwb-vectorcraft-apply-request',token:decodeURIComponent(location.hash.slice('#gwb='.length))
 },'*'));
 await page.locator('#gwbVectorcraftHost').waitFor({state:'detached'});
 const state=await page.evaluate(async()=>({
  first:await window.__placed[0].file.text(),
  second:await window.__placed[1].file.text(),
  geometry:window.__placed.map(x=>x.placement),
  applied:window.__applied
 }));
 assert.match(state.first,/<path\b/,'Returned SVG is the actual contents of the mock editor');
 assert.match(state.second,/<circle/,'Other placement is unchanged, even with identical filename');
 assert.deepEqual(state.geometry[0],{x:32,y:38,w:40,h:18,rotation:0,clipToField:true},'Artwork returns in its own 40 × 18 mm bounding box at +12,+8 mm');
 assert.match(state.first,/width="40mm"/,'SVG width is only drawn logo, not original 120 mm artboard');
 assert.match(state.first,/height="18mm"/,'SVG height is only drawn logo');
 assert.deepEqual(state.applied,[0],'Exactly one original field replaced');
 await page.locator('#editorOpenLogoEditor').click();
 await page.getByText('VectorCraft открыл документ',{exact:false}).waitFor({timeout:15000});
 const reopened=await page.frameLocator('#gwbVectorcraftHost iframe').locator('body').evaluate(()=>window.__seen);
 const reopenedSvg=new TextDecoder().decode(new Uint8Array(reopened[0].bytes));
 assert.match(reopenedSvg,/width="120mm"/,'Editor still has original field-sized workspace on reopen');
 assert.match(reopenedSvg,/translate\(32 17\) rotate\(0\) translate\(-20 -9\)/,'Returned cropped logo reopens with the same net 12 × 8 mm displacement inside its field');
 await page.getByRole('button',{name:'Закрыть без изменений'}).click();
 assert.equal(await page.locator('#gwbVectorcraftHost').count(),0);
 assert.deepEqual(await page.evaluate(()=>window.__applied),[0],'Cancel did not replace the field');
 // Native PDF/AI is handed to VectorCraft as actual original bytes, not a fake
 // raster or an SVG container. Its original placement is intentionally preserved.
 await page.evaluate(()=>{
   window.__selected=1;
   window.__placed[1].file=new File([new TextEncoder().encode('%PDF-1.4')],'original.pdf',{type:'application/pdf'});
 });
 await page.locator('#editorOpenLogoEditor').click();
 await page.getByText('VectorCraft открыл документ',{exact:false}).waitFor({timeout:15000});
 const native=await page.frameLocator('#gwbVectorcraftHost iframe').locator('body').evaluate(()=>window.__seen);
 assert.equal(native[0].name,'original.pdf');
 assert.equal(native[0].fieldCanvas,false,'Native vector format must go to the real VectorCraft import engine');
 assert.deepEqual(native[0].fieldSize,{w:80,h:80});
 assert.equal(new TextDecoder().decode(new Uint8Array(native[0].bytes.slice(0,8))),'%PDF-1.4');
 await page.frameLocator('#gwbVectorcraftHost iframe').locator('body').evaluate(()=>
   parent.postMessage({
     type:'gwb-vectorcraft-apply-request',
     token:decodeURIComponent(location.hash.slice('#gwb='.length))
   },'*'));
 await page.locator('#gwbVectorcraftHost').waitFor({state:'detached'});
 const afterPdf=await page.evaluate(async()=>({xml:await window.__placed[1].file.text(),placement:window.__placed[1].placement,applied:window.__applied}));
 assert.match(afterPdf.xml,/width="22mm"/);
 assert.deepEqual(afterPdf.placement,{x:6,y:6,w:22,h:12,rotation:0,clipToField:false},'Native PDF/AI returns only 22×12 mm artwork at the correct field offset');
 assert.deepEqual(afterPdf.applied,[0,1]);
 assert.deepEqual(errors,[],'No browser errors');
 console.log('VectorCraft in-browser handoff: original bytes / session origin / selected-field return / geometry / cancel passed');
}finally{await browser.close()}
