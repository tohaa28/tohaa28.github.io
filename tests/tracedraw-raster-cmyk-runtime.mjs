import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
const BASE='https://tohaa28.github.io/gifts-layout-workbench-mockups/';
const TOKEN='bc'.repeat(24),URL=BASE+'__tracedraw_cmyk_runtime';
const browser=await chromium.launch({headless:true,args:[
  '--enable-webgl','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader'
]});
try {
  const page=await browser.newPage({viewport:{width:1420,height:900}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  if(!process.env.TRACE_CMYK_ALLOW_BASELINE){
    const revision=await (await page.request.get(BASE+'tracedraw/RASTER_CMYK_REVISION?verify='+Date.now())).text();
    assert.match(revision,/^raster-cmyk-v1\nsource=[0-9a-f]{40}/,'The patched WASM build must be deployed first');
  }
  await page.route(URL,route=>route.fulfill({contentType:'text/html',body:`<!doctype html><body style="margin:8px">
    <iframe id="tr" style="width:1400px;height:860px;border:0"></iframe><script>
    const token='${TOKEN}',frame=document.getElementById('tr');
    window.state='boot';window.pdf=null;window.bounds=null;
    window.addEventListener('message',e=>{
      if(e.source!==frame.contentWindow||e.origin!==location.origin||e.data?.token!==token)return;
      const d=e.data;
      if(d.type==='gwb-tracedraw-ready'){
        const c=document.createElement('canvas');c.width=8;c.height=6;
        const ctx=c.getContext('2d');ctx.fillStyle='#ef3245';ctx.fillRect(0,0,4,6);
        ctx.fillStyle='rgba(25,100,210,0.5)';ctx.fillRect(4,0,4,6);ctx.clearRect(7,5,1,1);
        const svg='<svg xmlns="http://www.w3.org/2000/svg" width="60mm" height="35mm" viewBox="0 0 60 35">'+
          '<image x="5" y="5" width="30" height="15" href="'+c.toDataURL('image/png')+'"/></svg>';
        const bytes=new TextEncoder().encode(svg).buffer;
        frame.contentWindow.postMessage({type:'gwb-tracedraw-open',token,name:'raster-alpha.svg',bytes,w:60,h:35},location.origin,[bytes]);
      } else if(d.type==='gwb-tracedraw-opened')window.state='editing';
      else if(d.type==='gwb-tracedraw-error')window.state='error:'+d.message;
      else if(d.type==='gwb-tracedraw-svg'){
        window.pdf=d.pdfBytes;window.bounds=d.logoBoundsMm;window.svg=d.svg;window.state='returned';
      }
    });frame.src='${BASE}tracedraw/index.html?verify=raster-cmyk-v1#gwb='+token;
    </script>`}));
  await page.goto(URL);
  await page.waitForFunction(()=>window.state==='editing'||window.state.startsWith('error:'),null,{timeout:100000});
  assert.equal(await page.evaluate(()=>window.state),'editing');
  await page.addScriptTag({path:'vendor/pdf-lib.min.js'});
  const canvas=page.frameLocator('#tr').locator('#tracedraw');
  const select=async()=>{await canvas.click({position:{x:650,y:420}});await page.keyboard.press('Control+a');};
  async function returned(){
    await page.evaluate(()=>{window.state='waiting';window.pdf=null;});
    await page.frameLocator('#tr').locator('#gwb-tracedraw-transfer').click({timeout:25000});
    await page.waitForFunction(()=>window.state==='returned'||window.state.startsWith('error:'),null,{timeout:30000});
    assert.equal(await page.evaluate(()=>window.state),'returned');
    return page.evaluate(async()=>{
      const lib=PDFLib,doc=await lib.PDFDocument.load(window.pdf);
      const images=[];
      for(const [,o] of doc.context.enumerateIndirectObjects()){
        if(!(o instanceof lib.PDFRawStream)||String(o.dict.get(lib.PDFName.of('Subtype')))!=='/Image')continue;
        images.push({model:String(o.dict.get(lib.PDFName.of('ColorSpace'))),
          w:o.dict.get(lib.PDFName.of('Width')).asNumber(),h:o.dict.get(lib.PDFName.of('Height')).asNumber(),
          bytes:Array.from(lib.decodePDFRawStream(o).decode())});
      }
      return {images,bounds:window.bounds,svg:window.svg};
    });
  }
  async function mode(cmyk){
    await select();
    // Fixed 1420x900 viewport. These are the real egui menu entries, not
    // simulated engine messages or an injected conversion API.
    await page.mouse.click(420,18);
    await page.mouse.move(360,185);
    await page.waitForTimeout(350);
    await page.mouse.move(610,185);
    await page.mouse.click(650,cmyk?312:270);
    await page.waitForTimeout(200);
  }
  const baseline=await returned();
  assert.ok(baseline.images.some(i=>i.model==='/DeviceRGB'),'A CMYK workspace must not silently convert imported RGB');
  const baselineAlpha=baseline.images.find(i=>i.model==='/DeviceGray');
  assert.ok(baselineAlpha,'Input alpha must reach the native PDF soft mask');
  await mode(true);
  const converted=await returned();
  const cmyk=converted.images.find(i=>i.model==='/DeviceCMYK');
  assert.ok(cmyk,'Actual Bitmaps > Mode > CMYK must export a CMYK image, not RGB');
  assert.equal(cmyk.bytes.length,cmyk.w*cmyk.h*4,'Four real samples per pixel');
  assert.ok(!converted.images.some(i=>i.model==='/DeviceRGB'));
  assert.deepEqual(converted.images.find(i=>i.model==='/DeviceGray'),baselineAlpha,'Alpha samples unchanged');
  assert.deepEqual(converted.bounds,baseline.bounds,'Physical placement unchanged');
  assert.match(converted.svg,/<image\b/,'Bitmap retained in editable SVG preview');
  fs.mkdirSync('test-results',{recursive:true});
  await page.screenshot({path:'test-results/tracedraw-raster-cmyk.png'});
  await mode(false);
  const rgb=await returned();
  assert.deepEqual(rgb.images,baseline.images,'RGB restores original channels without a lossy round trip');
  await select();await page.keyboard.press('Control+z');
  assert.ok((await returned()).images.some(i=>i.model==='/DeviceCMYK'),'Undo restores CMYK export');
  await select();await page.keyboard.press('Control+y');
  assert.deepEqual((await returned()).images,baseline.images,'Redo restores RGB export');
  assert.deepEqual(errors,[]);
  console.log('LIVE TraceDraw native menu: RGB -> CMYK -> RGB, 4-channel PDF, alpha, bounds, undo/redo — PASS');
} finally {await browser.close();}
