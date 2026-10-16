/* Real VectorCraft WASM browser end-to-end smoke test. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright';
const root=path.resolve(process.argv[2]||'../vectorcraft/dist/web');
assert.ok(fs.existsSync(path.join(root,'index.html')),'Real WASM build missing');
const entries=fs.readdirSync(root);
const wasm=entries.find(x=>x.endsWith('.wasm'));
assert.ok(wasm,'WebAssembly file missing');
assert.ok(fs.statSync(path.join(root,wasm)).size>1_000_000,'WASM unexpectedly tiny');
const base='https://tohaa28.github.io/gifts-layout-workbench-mockups/vectorcraft/';
const token='vectorcraft-wasm-ci-bridge-session';
const browser=await chromium.launch({headless:true,args:[
  '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader',
  '--enable-webgl','--disable-gpu-sandbox'
]});
try{
 const page=await browser.newPage({viewport:{width:1365,height:890}});
 const events=[];
 page.on('console',m=>{if(events.length<80)events.push(m.type()+': '+m.text().slice(0,360))});
 page.on('pageerror',e=>events.push('PAGEERROR: '+e.message));
 page.on('crash',()=>events.push('PAGE CRASH'));
 await page.route(base+'**',async route=>{
   const url=new URL(route.request().url());
   let file=url.pathname.slice(new URL(base).pathname.length);
   if(!file||file.endsWith('/'))file='index.html';
   if(file.includes('..')||path.isAbsolute(file))return route.fulfill({status:404,body:'Invalid asset'});
   const target=path.resolve(root,file);
   if(!target.startsWith(root+path.sep)&&target!==path.join(root,'index.html'))
     return route.fulfill({status:403,body:'Forbidden'});
   if(!fs.existsSync(target)||!fs.statSync(target).isFile())
     return route.fulfill({status:404,body:'Not Found: '+file});
   const mime=file.endsWith('.wasm')?'application/wasm':file.endsWith('.js')?'text/javascript':
     file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':
     file.endsWith('.woff2')?'font/woff2':'application/octet-stream';
   await route.fulfill({status:200,contentType:mime,body:fs.readFileSync(target)});
 });
 const parentURL='https://tohaa28.github.io/gwb-vectorcraft-test-parent.html';
 const html=[
  '<!DOCTYPE html><html><body>',
  '<iframe id="child" style="width:1300px;height:780px" src="'+base+'?webgl#gwb='+token+'"></iframe>',
  '<script>',
  'window.__io={messages:[],ready:false,opened:false,returned:null,errors:[]};',
  "const iframe=document.getElementById('child'),expected="+JSON.stringify(token)+";",
  "window.addEventListener('message',event=>{",
  "if(event.origin!==location.origin||event.source!==iframe.contentWindow)return;",
  "const data=event.data||{};if(data.token!==expected)return;",
  "window.__io.messages.push(data.type);",
  "if(data.type==='gwb-vectorcraft-ready'){",
  "window.__io.ready=true;",
  'const source=\'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80"><path d="M 10 10 L 100 10 L 100 65 Z" fill="#12ad34"/></svg>\';',
  "const bytes=new TextEncoder().encode(source);",
  "iframe.contentWindow.postMessage({type:'gwb-vectorcraft-open',token:expected,name:'artwork.svg',bytes:bytes.buffer},location.origin,[bytes.buffer]);",
  "}",
  "if(data.type==='gwb-vectorcraft-opened'){",
  "window.__io.opened=true;",
  "iframe.contentWindow.postMessage({type:'gwb-vectorcraft-apply',token:expected},location.origin);",
  "}",
  "if(data.type==='gwb-vectorcraft-error'){window.__io.errors.push(data.message);}",
  "if(data.type==='gwb-vectorcraft-svg'){",
  "window.__io.returned=new TextDecoder().decode(new Uint8Array(data.bytes));",
  "window.__io.warnings=String(data.message||'');",
  "}",
  "});",
  '</script></body></html>'
 ].join('\n');
 await page.route(parentURL,route=>route.fulfill({status:200,contentType:'text/html',body:html}));
 await page.goto(parentURL,{waitUntil:'domcontentloaded',timeout:30000});
 try{
   await page.waitForFunction(()=>window.__io.returned!==null||window.__io.errors.length>0,null,{timeout:110000});
 }catch(e){
   const state=await page.evaluate(()=>window.__io);
   throw Error('Real WASM handshake did not complete: '+JSON.stringify(state)+'\n'+events.join('\n'));
 }
 const state=await page.evaluate(()=>window.__io);
 assert.deepEqual(state.errors,[],'VectorCraft open/export errors');
 assert.equal(state.ready,true,'Real VectorCraft booted');
 assert.equal(state.opened,true,'VectorCraft actually loaded original SVG');
 assert.match(state.returned,/<svg\b/,'Returned actual SVG');
 assert.match(state.returned,/<path\b/,'Original vector path preserved by real VectorCraft');
 assert.equal(await page.frameLocator('#child').locator('#vectorcraft_canvas').count(),1,'Real editor canvas mounted');
 console.log('REAL VectorCraft WASM smoke passed:',JSON.stringify({
   ready:state.ready,opened:state.opened,returnBytes:state.returned.length,
   messages:state.messages,warnings:state.warnings||'',console:events.slice(-8)
 }));
}finally{await browser.close()}
