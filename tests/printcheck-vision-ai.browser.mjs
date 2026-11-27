// Offline browser smoke: actual synthetic MLP inference on desktop and mobile.
// No gifts.ru session, no customer image or network traffic.
import {chromium} from 'playwright';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const html=await readFile('vision-ai.html','utf8');
const model=await readFile('vision/ai/synthetic-feature-model.mjs','utf8');
const worker=await readFile('vision/ai/scan-worker.mjs','utf8');
const browser=await chromium.launch({headless:true});
let outside=0;
async function pageFor(viewport){
 const page=await browser.newPage({viewport,acceptDownloads:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>{
   const url=route.request().url();
   if(url==='https://vision.local/vision-ai.html')
     return route.fulfill({status:200,contentType:'text/html;charset=utf-8',body:html});
   if(url==='https://vision.local/vision/ai/scan-worker.mjs')
     return route.fulfill({status:200,contentType:'text/javascript;charset=utf-8',body:worker});
   if(url==='https://vision.local/vision/ai/synthetic-feature-model.mjs')
     return route.fulfill({status:200,contentType:'text/javascript;charset=utf-8',body:model});
   outside++;return route.abort();
 });
 await page.goto('https://vision.local/vision-ai.html');
 return {page,errors};
}
try{
 for(const viewport of [{width:1440,height:900},{width:390,height:820}]){
   const {page,errors}=await pageFor(viewport);
   assert.equal(await page.locator('#run').isDisabled(),true);
   await page.locator('#demo').click();
   assert.equal(await page.locator('#run').isDisabled(),false);
   await page.locator('#run').click();
   await page.waitForFunction(()=>
     document.querySelector('#status')?.textContent?.includes('AI-анализ выполнен'),
     {timeout:15000});
   const result=await page.evaluate(()=>{
     const c=document.querySelector('#overlay'),ctx=c.getContext('2d');
     const flags=ctx.getImageData(0,0,c.width,c.height).data;
     let red=0,yellow=0;
     for(let i=0;i<flags.length;i+=4){
       if(flags[i+3]>0&&flags[i]>200&&flags[i+1]<100)red++;
       if(flags[i+3]>0&&flags[i]>200&&flags[i+1]>100)yellow++;
     }
     return {red,yellow,thin:document.querySelector('#thinCount').textContent,
       gap:document.querySelector('#gapCount').textContent};
   });
   assert.ok(result.red>10,JSON.stringify(result));
   assert.ok(result.yellow>10,JSON.stringify(result));
   const pending=page.waitForEvent('download');
   await page.locator('#export').click();
   const saved=await pending;
   const report=JSON.parse(await readFile(await saved.path(),'utf8'));
   assert.equal(report.schema,'printcheck.vision.ai-candidate-report.v1');
   assert.equal(report.status,'RESEARCH_AI_CANDIDATES_ONLY');
   assert.equal(report.model.realWorldAccuracyVerified,false);
   assert.equal(report.production_approved,false);
   assert.equal(report.physical_scale_verified,false);
   assert.equal(report.customer_image_bytes_in_report,false);
   const imageDownload=page.waitForEvent('download');
   await page.locator('#exportImage').click();
   const pngDownload=await imageDownload;
   const png=await readFile(await pngDownload.path());
   assert.deepEqual(Array.from(png.subarray(0,8)),[137,80,78,71,13,10,26,10]);
   assert.ok(png.byteLength>100);
   assert.ok(report.count_thin_ink_px>10);
   assert.ok(report.count_narrow_gap_px>10);
   assert.deepEqual(errors,[]);
   await page.close();
 }
 assert.equal(outside,0,'unexpected browser network request');
 console.log('Vision synthetic AI: real desktop/mobile inference, heatmaps and local report PASS');
}finally{await browser.close()}
