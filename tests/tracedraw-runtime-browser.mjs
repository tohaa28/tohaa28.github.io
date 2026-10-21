import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const BASE='https://tohaa28.github.io/gifts-layout-workbench-mockups/';
const TOKEN='a0'.repeat(24);
const url=BASE+'__tracedraw_runtime_test';
const browser=await chromium.launch({headless:true,
 args:['--enable-webgl','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1420,height:900}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text().slice(0,300))});
 const svg='<svg xmlns="http://www.w3.org/2000/svg" width="60mm" height="35mm" viewBox="0 0 60 35"><rect x="3" y="4" width="16" height="8" fill="#448811"/></svg>';
 const parentScript=[
   'const token='+JSON.stringify(TOKEN)+';',
   'const svg='+JSON.stringify(svg)+';',
   "window.__traceState='boot';window.__traceEvents=[];window.__traceBounds=null;window.__traceSvg=null;window.__tracePdf=null;window.__traceColorSpace=null;window.__traceHasImage=false;",
   "const frame=document.getElementById('tr');",
   "window.addEventListener('message',e=>{",
   " if(e.source!==frame.contentWindow||e.origin!==location.origin||e.data?.token!==token)return;",
   " const d=e.data;window.__traceEvents.push(d.type);",
   " if(d.type==='gwb-tracedraw-ready'){",
   " const bytes=new TextEncoder().encode(svg).buffer;",
   " frame.contentWindow.postMessage({type:'gwb-tracedraw-open',token,name:'logo.svg',bytes,w:60,h:35},location.origin,[bytes]);",
   " }else if(d.type==='gwb-tracedraw-opened'){window.__traceState='editing';}",
   " else if(d.type==='gwb-tracedraw-error'){window.__traceState='error:'+d.message;}",
   " else if(d.type==='gwb-tracedraw-svg'){window.__traceState='ok';window.__traceSvg=d.svg;window.__traceBounds=d.logoBoundsMm;window.__tracePdf=d.pdfBytes instanceof Uint8Array?new TextDecoder().decode(d.pdfBytes.slice(0,5)):'missing';window.__traceColorSpace=d.colorSpace;window.__traceHasImage=d.pdfBytes instanceof Uint8Array&&new TextDecoder('latin1').decode(d.pdfBytes).includes('/Subtype /Image');}",
   "});",
   "frame.src="+JSON.stringify(BASE+'tracedraw/index.html')+"+'#gwb='+token;"
 ].join('\n');
 const html='<!doctype html><html><body style="margin:0"><iframe id="tr" style="width:1400px;height:860px;border:0" allow="fullscreen; clipboard-read; clipboard-write"></iframe><script>'+
   parentScript+'</script></body></html>';
 await page.route(url,r=>r.fulfill({status:200,contentType:'text/html',body:html}));
 await page.goto(url);
 try{
   await page.waitForFunction(()=>window.__traceState==='editing'||String(window.__traceState).startsWith('error:'),null,{timeout:100000});
 }catch(e){
   throw Error('Native TraceDraw WASM did not load/open: '+JSON.stringify({
     state:await page.evaluate(()=>({state:window.__traceState,events:window.__traceEvents})),errors})+' '+e.message);
 }
 const state=await page.evaluate(()=>window.__traceState);
 assert.equal(state,'editing','WASM must open original artwork, not fake iframe: '+JSON.stringify({state,errors}));
 const canvas=page.frameLocator('#tr').locator('#tracedraw');
 const rect=await canvas.boundingBox();assert.ok(rect&&rect.width>1100,'Real TraceDraw canvas not present');
 // The real self-hosted TraceDraw iframe control requests export directly
 // from wasm_bindgen, with no simulated engine messages or test-only fallback.
 const apply=page.frameLocator('#tr').locator('#gwb-tracedraw-transfer');
 await apply.waitFor({state:'visible',timeout:25000});
 await apply.click();
 await page.waitForFunction(()=>window.__traceState==='ok'||String(window.__traceState).startsWith('error:'),null,{timeout:20000});
 const out=await page.evaluate(()=>({state:window.__traceState,events:window.__traceEvents,bounds:window.__traceBounds,svg:window.__traceSvg,pdfHeader:window.__tracePdf,colorSpace:window.__traceColorSpace}));
 assert.equal(out.state,'ok','Native egui SVG export failed '+JSON.stringify({out,errors}));
 assert.ok(out.events.includes('gwb-tracedraw-opened'));
 assert.ok(out.events.includes('gwb-tracedraw-svg'));
 assert.match(out.svg,/<rect|<path/);
 assert.equal(out.pdfHeader,'%PDF-','Native TraceDraw must return printable PDF');
 assert.equal(out.colorSpace,'CMYK');
 assert.ok(out.bounds,'Shape bounds must come from actual Rust drawing engine');
 for(const [k,v] of Object.entries({x:3,y:4,w:16,h:8})){
   assert.ok(Math.abs(out.bounds[k]-v)<0.75,'Incorrect physical '+k+': '+JSON.stringify(out.bounds));
 }
 const root=await page.evaluate(svg=>{
  const d=new DOMParser().parseFromString(svg,'image/svg+xml').documentElement;
  return {width:d.getAttribute('width'),viewBox:d.getAttribute('viewBox')};
 },out.svg);
 assert.match(root.width,/mm$/);
 assert.ok(out.bounds.w<60&&out.bounds.h<35,'Must transfer only the artwork not whole field');
 // Real engine regression: same document contains both vector paths and an
 // embedded PNG bitmap. Import and export MUST retain its RGB image XObject,
 // not just the vector geometry. No simulated WASM messages are involved.
 const bitmapPng='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aC8cAAAAASUVORK5CYII=';
 const combined='<svg xmlns="http://www.w3.org/2000/svg" width="60mm" height="35mm" viewBox="0 0 60 35">'+
   '<path d="M3 4h16v8H3z" fill="#2371ae"/>'+
   '<image x="26" y="12" width="11" height="9" href="data:image/png;base64,'+bitmapPng+'"/></svg>';
 const rasterPage=await browser.newPage({viewport:{width:1420,height:900}});
 const rasterScript=parentScript.replace('const svg='+JSON.stringify(svg)+';',
   'const svg='+JSON.stringify(combined)+';');
 const rasterHtml='<!doctype html><html><body style="margin:0"><iframe id="tr" style="width:1400px;height:860px;border:0" allow="fullscreen"></iframe><script>'+
    rasterScript+'</script></body></html>';
 await rasterPage.route(url,route=>route.fulfill({status:200,contentType:'text/html',body:rasterHtml}));
 await rasterPage.goto(url);
 await rasterPage.waitForFunction(()=>window.__traceState==='editing'||String(window.__traceState).startsWith('error:'),null,{timeout:100000});
 assert.equal(await rasterPage.evaluate(()=>window.__traceState),'editing',
   'Raster+vector original must open in TraceDraw engine');
 await rasterPage.frameLocator('#tr').locator('#gwb-tracedraw-transfer').click({timeout:25000});
 await rasterPage.waitForFunction(()=>window.__traceState==='ok'||String(window.__traceState).startsWith('error:'),null,{timeout:25000});
 const combinedOutput=await rasterPage.evaluate(()=>({
   state:window.__traceState,svg:window.__traceSvg,hasPdfImage:window.__traceHasImage,
   colorSpace:window.__traceColorSpace
 }));
 assert.equal(combinedOutput.state,'ok','TraceDraw failed to export mixed raster+vector file');
 assert.match(combinedOutput.svg,/<image\b/,'Original bitmap retained in SVG editor export');
 assert.match(combinedOutput.svg,/<path\b/,'Original vector retained in SVG editor export');
 assert.equal(combinedOutput.hasPdfImage,true,'Printable TraceDraw PDF must include bitmap XObject');
 assert.equal(combinedOutput.colorSpace,'CMYK','Mixed RGB paint may exist inside CMYK workspace');
 await rasterPage.close();
 console.log('LIVE TraceDraw WASM: PNG raster + vector, embedded PDF image XObject and field placement — PASS');
 console.log('LIVE TraceDraw WASM: real Rust import, current-field size, native egui transfer and cropped SVG passed');
}finally{await browser.close()}
