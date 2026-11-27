// Synthetic end-to-end blind review smoke. No real customer image or session.
import {chromium} from 'playwright';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {
  createReviewTask,hashBinary,compareIndependentReviews
} from '../vision/dataset/review-task.mjs';

const png=Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9ZqPHXwAAAAASUVORK5CYII=',
  'base64'
);
const srcHash=await hashBinary(png);
const h=n=>n.toString(16).padStart(64,'0');
const task=await createReviewTask({
  image_sha256:srcHash,width_px:1,height_px:1,
  annotations:[
    {type:'corner_safe',x:0.1,y:0.1,w:0.3,h:0.3},
    {type:'negative_gap',x:0.5,y:0.5,w:0.3,h:0.3}
  ],family_sha256:h(21),artwork_sha256:h(22),technology_code:'UV1'
});
const taskBuffer=Buffer.from(JSON.stringify(task,null,2)+'\n');
const taskHash=await hashBinary(taskBuffer);
const html=await readFile('vision-review.html','utf8');
const moduleJs=await readFile('vision/dataset/review-task.mjs','utf8');
const browser=await chromium.launch({headless:true});
let forbiddenNetworkRequests=0;
const createPage=async viewport=>{
  const page=await browser.newPage({viewport,acceptDownloads:true});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>{
    const url=route.request().url();
    if(url==='https://vision.local/vision-review.html')
      return route.fulfill({status:200,contentType:'text/html;charset=utf-8',body:html});
    if(url==='https://vision.local/vision/dataset/review-task.mjs')
      return route.fulfill({status:200,contentType:'text/javascript;charset=utf-8',body:moduleJs});
    forbiddenNetworkRequests++;return route.abort();
  });
  await page.goto('https://vision.local/vision-review.html');
  return {page,errors};
};
async function runReviewer(viewport,reviewer,states){
  const {page,errors}=await createPage(viewport);
  await page.locator('#taskFile').setInputFiles({
    name:'private-task.json',mimeType:'application/json',buffer:taskBuffer
  });
  await page.locator('#imageFile').setInputFiles({
    name:'local-only.png',mimeType:'image/png',buffer:png
  });
  await page.waitForFunction(()=>
    document.querySelector('#reviewState')?.textContent?.includes('совпадает с заданием'));
  assert.equal(await page.locator('#exportReview').isDisabled(),true);
  assert.equal(await page.locator('#regions button').count(),2);
  await page.locator('#reviewerRef').fill(h(reviewer));
  for(let i=0;i<states.length;i++){
    if(i>0)await page.locator('#nextRegion').click();
    await page.locator('input[name=verdict][value='+states[i]+']').check();
  }
  assert.equal(await page.locator('#exportReview').isDisabled(),false);
  const pending=page.waitForEvent('download');
  await page.locator('#exportReview').click();
  const download=await pending;
  const result=JSON.parse(await readFile(await download.path(),'utf8'));
  assert.equal(result.schema,'printcheck.vision.review-submission.v1');
  assert.equal(result.task_sha256,taskHash);
  assert.equal(result.review_state,'SELF_ASSERTED_ONLY');
  assert.equal(result.results.length,2);
  assert.ok(!JSON.stringify(result).includes('local-only.png'));
  assert.equal(errors.length,0,JSON.stringify(errors));
  await page.close();
  return result;
}
try{
  const first=await runReviewer({width:1366,height:900},1,['acceptable','defect']);
  const second=await runReviewer({width:410,height:850},2,['acceptable','uncertain']);
  const consensus=compareIndependentReviews(task,taskHash,first,second);
  assert.equal(consensus.status,'PROVISIONAL_CONSENSUS_ONLY');
  assert.equal(consensus.agreement_count,1);
  assert.equal(consensus.adjudication_count,1);
  assert.equal(consensus.expert_identity_verified,false);

  // The exact source image digest is mandatory; task substitution must
  // disable the export and not show a visually plausible different image.
  const {page,errors}=await createPage({width:1200,height:780});
  const incorrect={...task,source:{...task.source,image_sha256:h(123)}};
  await page.locator('#taskFile').setInputFiles({
    name:'bad-task.json',mimeType:'application/json',
    buffer:Buffer.from(JSON.stringify(incorrect))
  });
  await page.locator('#imageFile').setInputFiles({
    name:'local-only.png',mimeType:'image/png',buffer:png
  });
  await page.waitForFunction(()=>
    document.querySelector('#reviewState')?.textContent?.includes('не совпадает'));
  assert.equal(await page.locator('#exportReview').isDisabled(),true);
  assert.deepEqual(errors,[]);
  await page.close();
  assert.equal(forbiddenNetworkRequests,0);
  console.log('Blind region review browser: two independent responses, adjudication and digest mismatch passed');
}finally{await browser.close()}
