import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const BASE='https://tohaa28.github.io/gifts-layout-workbench-mockups/';
const url=BASE+'__vectorcraft_browser_smoke';
const browser=await chromium.launch({headless:true,args:['--enable-webgl','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1360,height:900}});
 const browserErrors=[];
 page.on('pageerror',e=>browserErrors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')browserErrors.push(m.text().slice(0,500))});
 await page.route(url,async route=>{
   const script=[
    "const token='12345678901234567890123412345678';",
    "window.__vcStatus='opening';window.__vcEvents=[];",
    "const f=document.getElementById('vc');",
    "window.addEventListener('message',e=>{",
    " if(e.source!==f.contentWindow||e.origin!==location.origin||e.data?.token!==token)return;",
    " window.__vcEvents.push(e.data.type);",
    " if(e.data.type==='gwb-vectorcraft-ready'){",
    " const svg='<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"100mm\" height=\"50mm\" viewBox=\"0 0 100 50\"><rect x=\"10\" y=\"10\" width=\"70\" height=\"50\" fill=\"#88cc11\"/></svg>';",
    " const bytes=new TextEncoder().encode(svg).buffer;",
    " f.contentWindow.postMessage({type:'gwb-vectorcraft-open',token,name:'bridge-fixture.svg',bytes,fieldSizeMm:{w:90,h:45},fieldCanvas:false},location.origin,[bytes]);",
    " }else if(e.data.type==='gwb-vectorcraft-opened'){",
    " setTimeout(()=>f.contentWindow.postMessage({type:'gwb-vectorcraft-apply',token},location.origin),2000);",
    " }else if(e.data.type==='gwb-vectorcraft-svg'){",
    " window.__vcResult=new TextDecoder().decode(new Uint8Array(e.data.bytes));window.__vcStatus='ok';",
    " }else if(e.data.type==='gwb-vectorcraft-error'){window.__vcStatus='error: '+e.data.message;}",
    "});",
    "f.src='"+BASE+"vectorcraft/index.html#gwb='+token;"
   ].join('\n');
   const body='<!DOCTYPE html><html><body><iframe id="vc" allow="webgpu; clipboard-read; clipboard-write" style="width:1200px;height:750px"></iframe><script>'+script+'</script></body></html>';
   await route.fulfill({status:200,contentType:'text/html',body});
 });
 await page.goto(url,{waitUntil:'load'});
 await page.waitForFunction(()=>window.__vcStatus==='ok'||window.__vcStatus.startsWith('error:'),{timeout:120000});
 const data=await page.evaluate(()=>({status:window.__vcStatus,events:window.__vcEvents,svg:window.__vcResult||''}));
 assert.equal(data.status,'ok',JSON.stringify({status:data.status,browserErrors}));
 assert.ok(data.events.includes('gwb-vectorcraft-ready'));
 assert.ok(data.events.includes('gwb-vectorcraft-opened'));
 assert.ok(data.events.includes('gwb-vectorcraft-svg'));
 assert.match(data.svg,/<svg\b/);
 const documentSvg=await page.evaluate(svg=>new DOMParser().parseFromString(svg,'image/svg+xml').documentElement.localName,data.svg);
 assert.equal(documentSvg,'svg');
 const actual=await page.evaluate(svg=>{
   const root=new DOMParser().parseFromString(svg,'image/svg+xml').documentElement;
   const v=(root.getAttribute('viewBox')||'').split(/\s+/).map(Number);
   return {w:v[2]*25.4/72,h:v[3]*25.4/72};
 },data.svg);
 assert.ok(Math.abs(actual.w-90)<0.1,'Real WASM must resize a 100 mm source artboard into a 90 mm imprint: '+actual.w);
 assert.ok(Math.abs(actual.h-45)<0.1,'Real WASM must resize a 50 mm source artboard into a 45 mm imprint: '+actual.h);
 console.log('Genuine VectorCraft WASM roundtrip passed:',{svgBytes:data.svg.length,events:data.events,browserErrors});
}finally{await browser.close()}
