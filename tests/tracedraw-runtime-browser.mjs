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
   "window.__traceState='boot';window.__traceEvents=[];window.__traceBounds=null;window.__traceSvg=null;",
   "const frame=document.getElementById('tr');",
   "window.addEventListener('message',e=>{",
   " if(e.source!==frame.contentWindow||e.origin!==location.origin||e.data?.token!==token)return;",
   " const d=e.data;window.__traceEvents.push(d.type);",
   " if(d.type==='gwb-tracedraw-ready'){",
   " const bytes=new TextEncoder().encode(svg).buffer;",
   " frame.contentWindow.postMessage({type:'gwb-tracedraw-open',token,name:'logo.svg',bytes,w:60,h:35},location.origin,[bytes]);",
   " }else if(d.type==='gwb-tracedraw-opened'){window.__traceState='editing';}",
   " else if(d.type==='gwb-tracedraw-error'){window.__traceState='error:'+d.message;}",
   " else if(d.type==='gwb-tracedraw-svg'){window.__traceState='ok';window.__traceSvg=d.svg;window.__traceBounds=d.logoBoundsMm;}",
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
 const out=await page.evaluate(()=>({state:window.__traceState,events:window.__traceEvents,bounds:window.__traceBounds,svg:window.__traceSvg}));
 assert.equal(out.state,'ok','Native egui SVG export failed '+JSON.stringify({out,errors}));
 assert.ok(out.events.includes('gwb-tracedraw-opened'));
 assert.ok(out.events.includes('gwb-tracedraw-svg'));
 assert.match(out.svg,/<rect|<path/);
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
 console.log('LIVE TraceDraw WASM: real Rust import, current-field size, native egui transfer and cropped SVG passed');
}finally{await browser.close()}
