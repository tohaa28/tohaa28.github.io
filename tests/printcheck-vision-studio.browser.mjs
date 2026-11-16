// Browser smoke for the isolated specialist annotation studio.
// Uses generated 1x1 pixel, no customer files or external endpoints.
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const browser = await chromium.launch({headless: true});
try {
  const page=await browser.newPage({viewport:{width:1360,height:900},acceptDownloads:true});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const html=await readFile('vision-studio.html','utf8');
  const reviewModule=await readFile('vision/dataset/review-task.mjs','utf8');
  let unapprovedRequests=0;
  await page.route('**/*',route=>{
    const url=route.request().url();
    if(url==='https://vision.local/vision-studio.html')return route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:html});
    if(url==='https://vision.local/vision/dataset/review-task.mjs')return route.fulfill({status:200,contentType:'text/javascript; charset=utf-8',body:reviewModule});
    unapprovedRequests++;return route.abort();
  });
  await page.goto('https://vision.local/vision-studio.html');
  assert.match(await page.locator('h1').innerText(),/Vision Studio/);
  assert.equal(await page.locator('#export').isDisabled(),true);
  const image=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9ZqPHXwAAAAASUVORK5CYII=','base64');
  await page.locator('#image').setInputFiles({name:'generated.png',mimeType:'image/png',buffer:image});
  await page.locator('#info').waitFor({state:'visible'});
  await page.waitForFunction(()=>document.querySelector('#info')?.textContent?.includes('generated.png'));
  await page.locator('#kind').selectOption('negative_gap');
  await page.locator('#note').fill('Экспертная метка, синтетический пример');
  const canvas=page.locator('#stage'),rect=await canvas.boundingBox();
  assert.ok(rect&&rect.width>100&&rect.height>100);
  await page.mouse.move(rect.x+rect.width*.45,rect.y+rect.height*.45);
  await page.mouse.down();
  await page.mouse.move(rect.x+rect.width*.55,rect.y+rect.height*.56,{steps:5});
  await page.mouse.up();
  assert.equal((await page.locator('#count').innerText()).trim(),'1');
  const pending=page.waitForEvent('download');
  await page.locator('#export').click();
  const download=await pending;
  const payload=JSON.parse(await readFile(await download.path(),'utf8'));
  assert.equal(payload.schema,'printcheck.vision.annotation.v1');
  assert.equal(payload.verified_by_expert,false);
  assert.equal(payload.annotations.length,1);
  assert.equal(payload.annotations[0].type,'negative_gap');

  assert.equal(await page.locator('#exportTask').isDisabled(),false);
  const taskDownload=page.waitForEvent('download');
  await page.locator('#exportTask').click();
  const exportedTask=await taskDownload;
  const task=JSON.parse(await readFile(await exportedTask.path(),'utf8'));
  assert.equal(task.schema,'printcheck.vision.review-task.v1');
  assert.equal(task.predictions_hidden,true);
  assert.equal(task.review_state,'UNVERIFIED');
  assert.equal(task.context.family_sha256,null);
  assert.equal(task.context.order_scale_verified,false);
  assert.equal(task.regions.length,1);
  assert.equal(Object.hasOwn(task.regions[0],'type'),false,'Blind task cannot show preparer labels');
  assert.match(task.regions[0].region_sha256,/^[0-9a-f]{64}$/);
  assert.ok(!JSON.stringify(task).includes('generated.png'));
  assert.ok(!JSON.stringify(task).includes('Экспертная метка'),
    'Expert notes must remain hidden from the blind task');

  for(const k of ['x','y','w','h'])assert.ok(payload.annotations[0][k]>=0&&payload.annotations[0][k]<=1);
  await page.locator('#undo').click();
  assert.equal((await page.locator('#count').innerText()).trim(),'0');
  assert.equal(unapprovedRequests,0);
  assert.deepEqual(errors,[]);
  await page.close();
  console.log('Vision Studio smoke passed');
} finally {await browser.close()}
