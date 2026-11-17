// True Chromium vector geometry test: real DOMParser + source Bézier/paths,
// millimetre scale, local SVG export and fail-closed unsupported content.
import {chromium} from 'playwright';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';

const files=new Map();
for(const file of [
 'vision-vector.html','vision/geometry/svg-local-vector.mjs',
 'vision/geometry/svg-dom-vector-bridge.mjs',
 'vision/geometry/svg-viewport.mjs',
 'vision/geometry/svg-path-subset.mjs',
 'vision/geometry/vector-corridors.mjs',
 'vision/geometry/curved-normal-probes.mjs'
])files.set('https://vision.local/'+file,await readFile(file,'utf8'));
const browser=await chromium.launch({headless:true});
let forbidden=0;
const create=async viewport=>{
 const page=await browser.newPage({viewport,acceptDownloads:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>{
   const url=route.request().url(),file=files.get(url);
   if(file!==undefined)return route.fulfill({
     status:200,contentType:url.endsWith('.html')?
     'text/html;charset=utf-8':'text/javascript;charset=utf-8',body:file});
   forbidden++;return route.abort();
 });
 await page.goto('https://vision.local/vision-vector.html');
 return {page,errors};
};
const svg=(elements,rootExtra='')=>
 '<svg xmlns="http://www.w3.org/2000/svg" width="100mm" height="80mm" viewBox="0 0 100 80"'+rootExtra+'>'+elements+'</svg>';
const positive='<path d="M10 20 H13 V65 H10 Z" fill="#123456"/>';
try{
 for(const viewport of [{width:1440,height:900},{width:390,height:820}]){
   const {page,errors}=await create(viewport);
   assert.equal(await page.locator('#run').isDisabled(),true);
   await page.locator('#demo').click();
   await page.locator('#run').click();
   await page.waitForFunction(()=>document.querySelector('#status')?.textContent
     .includes('Вектор обработан'),{timeout:12000});
   const stats=await page.evaluate(()=>({
     paths:document.querySelector('#paths').textContent,
     points:document.querySelector('#points').textContent,
     count:document.querySelector('#count').textContent
   }));
   assert.equal(stats.paths,'3',JSON.stringify(stats));
   assert.ok(Number(stats.count)>0,JSON.stringify(stats));
   let dl=page.waitForEvent('download');
   await page.locator('#json').click();
   let report=JSON.parse(await readFile(await (await dl).path(),'utf8'));
   assert.equal(report.status,'RESEARCH_VECTOR_CANDIDATES_ONLY');
   assert.equal(report.source_format,'SVG');
   assert.equal(report.print_scale_proven,false);
   assert.equal(report.actual_artwork_placement_scale_proven,false);
   assert.equal(report.production_approved,false);
   assert.equal(report.report_contains_vector_source,false);
   assert.equal(JSON.stringify(report).includes('M10 20 H13'),false,
     'Raw customer paths must not be exported into JSON diagnostics');
   const gaps=report.candidates.filter(x=>x.kind==='negative_gap_mm');
   assert.ok(gaps.some(g=>Math.abs(g.measured_mm-.12)<.01),
     'Real raw SVG gap 0.12mm must be measured without rasterization');
   dl=page.waitForEvent('download');
   await page.locator('#annotated').click();
   const output=await readFile(await (await dl).path(),'utf8');
   assert.match(output,/xmlns="http:\/\/www.w3.org\/2000\/svg"/);
   assert.match(output,/<path d="M10 20 H13 V65 H10 Z"/);
   assert.match(output,/<circle cx="/);
   // No external element, script, CSS, stroke or unrelated XML may be silently ignored.
   for(const payload of [
     svg(positive+'<script>alert(1)</script>'),
     svg(positive+'<path d="M1 1 H3 V2 H1 Z" fill="#123456" stroke="#111111"/>'),
     '<!DOCTYPE svg [<!ENTITY leak SYSTEM "https://example.com/x">]>'+svg(positive),
     svg(positive+'<image href="https://example.com/track.svg"/>'),
     svg('<text x="1" y="2">unsafe</text>'),
     svg(positive,' style="fill:red"')
   ]){
     await page.locator('#vectorFile').setInputFiles({
       name:'bad.svg',mimeType:'image/svg+xml',buffer:Buffer.from(payload)
     });
     await page.locator('#run').click();
     assert.match(await page.locator('#status').textContent(),/MANUAL:/);
     assert.equal(await page.locator('#json').isDisabled(),true);
   }
   assert.deepEqual(errors,[]);
   await page.close();
 }
 assert.equal(forbidden,0,'No network requests may leave local SVG analysis');
 console.log('Vector SVG browser: desktop/mobile exact mm corridors, editable annotated SVG, source safety PASS');
}finally{await browser.close()}
