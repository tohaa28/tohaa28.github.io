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
    "window.__vcStatus='opening';window.__vcEvents=[];window.__vcBlocked=[];window.__vcThemeAcks=[];",
    "const f=document.getElementById('vc');",
    "window.addEventListener('message',e=>{",
    " if(e.source!==f.contentWindow||e.origin!==location.origin||e.data?.token!==token)return;",
    " window.__vcEvents.push(e.data.type);",
    " if(e.data.type==='gwb-vectorcraft-ready'){",
    " const svg='<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"120mm\" height=\"80mm\" viewBox=\"0 0 120 80\"><rect x=\"12\" y=\"8\" width=\"40\" height=\"18\" fill=\"#88cc11\"/></svg>';",
    " const bytes=new TextEncoder().encode(svg).buffer;",
    " f.contentWindow.postMessage({type:'gwb-vectorcraft-open',token,name:'bridge-fixture.svg',bytes,fieldSizeMm:{w:120,h:80},fieldCanvas:true},location.origin,[bytes]);",
    " }else if(e.data.type==='gwb-vectorcraft-opened'){",
    " window.__vcStatus='editing';",
    " }else if(e.data.type==='gwb-vectorcraft-theme-applied'){window.__vcThemeAcks.push(e.data.message);}",
    " }else if(e.data.type==='gwb-vectorcraft-svg'){",
    " window.__vcResult=new TextDecoder().decode(new Uint8Array(e.data.bytes));window.__vcBounds=e.data.logoBoundsMm;window.__vcStatus='ok';",
    " }else if(e.data.type==='gwb-vectorcraft-error'){if(window.__vcExpectRejection){window.__vcBlocked.push(String(e.data.message));window.__vcExpectRejection=false;}else window.__vcStatus='error: '+e.data.message;}",
    "});",
    "f.src='"+BASE+"vectorcraft/index.html#gwb='+token;"
   ].join('\n');
   const body='<!DOCTYPE html><html><body><iframe id="vc" allow="webgpu; clipboard-read; clipboard-write" style="width:1200px;height:750px"></iframe><script>'+script+'</script></body></html>';
   await route.fulfill({status:200,contentType:'text/html',body});
 });
 await page.goto(url,{waitUntil:'load'});
 await page.waitForFunction(()=>window.__vcStatus==='editing'||window.__vcStatus.startsWith('error:'),{timeout:120000});
 assert.equal(await page.evaluate(()=>window.__vcStatus),'editing','Embedded VectorCraft must open exactly one artwork document');
 // Sample pixels from the native egui app bar, not the Maketnaya overlay.
 // A style acknowledgment alone is not enough: the Rust canvas must visibly
 // change from its native dark chrome to light gifts.ru colors.
 const barSample={x:700,y:18,width:120,height:20};
 await page.waitForTimeout(180);
 const nativePicture=await page.screenshot({clip:barSample});
 // This message is handled inside the real Rust/egui UI; neither the iframe
 // nor the document can be recreated during gifts -> native transitions.
 const changeTheme=mode=>page.evaluate(mode=>{
    const token='12345678901234567890123412345678';
    document.getElementById('vc').contentWindow.postMessage({
      type:'gwb-vectorcraft-theme',token,mode
    },location.origin);
 },mode);
 await changeTheme('gifts');
 await page.waitForFunction(()=>window.__vcThemeAcks.includes('gifts'),null,{timeout:12000});
 await page.waitForTimeout(200);
 const giftsPicture=await page.screenshot({clip:barSample});
 assert.notDeepEqual(giftsPicture,nativePicture,
     'The actual VectorCraft egui canvas must visibly change colors in gifts.ru mode');
 await changeTheme('native');
 await page.waitForFunction(()=>window.__vcThemeAcks.includes('native'),null,{timeout:12000});
 assert.deepEqual(await page.evaluate(()=>window.__vcThemeAcks),['gifts','native'],
    'egui skin switches twice without leaving the current VectorCraft document');
 // Attempt to create/open a second document via native keyboard shortcuts.
 // These must be blocked inside VectorCraft even if the menu is hidden.
 await page.frameLocator('#vc').locator('#vectorcraft_canvas').click({position:{x:250,y:210}});
 await page.keyboard.press('Control+n');
 await page.keyboard.press('Control+o');
 await page.keyboard.press('Control+Shift+n');
 // A second valid-looking postMessage must not enqueue another document.
 await page.evaluate(()=>{
   const token='12345678901234567890123412345678',f=document.getElementById('vc');
   window.__vcExpectRejection=true;
   const bytes=new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 90 90"><rect width="90" height="90"/></svg>').buffer;
   f.contentWindow.postMessage({type:'gwb-vectorcraft-open',token,name:'forbidden-second.svg',
     bytes,fieldSizeMm:{w:120,h:80},fieldCanvas:true},location.origin,[bytes]);
 });
 await page.waitForFunction(()=>window.__vcBlocked.length===1||window.__vcStatus.startsWith('error:'),{timeout:7000});
 const attempted=await page.evaluate(()=>({blocked:window.__vcBlocked,status:window.__vcStatus,events:window.__vcEvents}));
 assert.equal(attempted.blocked.length,1,'Second imported document rejected by native WASM bridge: '+JSON.stringify(attempted));
 assert.match(attempted.blocked[0],/других документов|второй документ|один документ/i);
 await page.evaluate(()=>{
   const token='12345678901234567890123412345678';
   document.getElementById('vc').contentWindow.postMessage({type:'gwb-vectorcraft-apply',token},location.origin);
 });
 await page.waitForFunction(()=>window.__vcStatus==='ok'||window.__vcStatus.startsWith('error:'),{timeout:30000});
 const data=await page.evaluate(()=>({status:window.__vcStatus,events:window.__vcEvents,svg:window.__vcResult||'',bounds:window.__vcBounds,blocked:window.__vcBlocked}));
 assert.equal(data.status,'ok',JSON.stringify({status:data.status,browserErrors}));
 assert.equal(data.blocked.length,1,'Only the original document can be opened in embedded VectorCraft');
 assert.ok(data.events.includes('gwb-vectorcraft-ready'));
 assert.ok(data.events.includes('gwb-vectorcraft-opened'));
 assert.equal(data.events.filter(e=>e==='gwb-vectorcraft-opened').length,1,'Theme switching does not re-import artwork');
 assert.ok(data.events.includes('gwb-vectorcraft-svg'));
 assert.match(data.svg,/<svg\b/);
 const documentSvg=await page.evaluate(svg=>new DOMParser().parseFromString(svg,'image/svg+xml').documentElement.localName,data.svg);
 assert.equal(documentSvg,'svg');
 const actual=await page.evaluate(svg=>{
   const root=new DOMParser().parseFromString(svg,'image/svg+xml').documentElement;
   const v=(root.getAttribute('viewBox')||'').split(/\s+/).map(Number);
   return {w:v[2]*25.4/72,h:v[3]*25.4/72};
 },data.svg);
 assert.ok(Math.abs(actual.w-40)<0.1,'Real WASM must export drawn logo, not 120mm artboard: '+actual.w);
 assert.ok(Math.abs(actual.h-18)<0.1,'Real WASM must return 18mm painted height, not 80mm field: '+actual.h);
 assert.ok(data.bounds,'WASM must send independent logo bounds in physical millimetres');
 for(const [key,expected] of Object.entries({x:12,y:8,w:40,h:18})){
   assert.ok(Math.abs(data.bounds[key]-expected)<0.1,
     'WASM must preserve visible artwork '+key+' in millimetres: '+JSON.stringify(data.bounds));
 }
 console.log('Genuine VectorCraft cropped-logo roundtrip passed:',{svgBytes:data.svg.length,events:data.events,browserErrors});
}finally{await browser.close()}
