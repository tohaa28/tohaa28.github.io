import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,stat,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createReviewTask,createReviewSubmission,hashBinary}
  from '../vision/dataset/review-task.mjs';
import {analyzeReviews,compareFiles} from '../vision/dataset/compare-reviews.mjs';

const hash=n=>n.toString(16).padStart(64,'0');
async function fixture(){
  const task=await createReviewTask({
    image_sha256:hash(1),width_px:100,height_px:100,
    annotations:[
      {type:'corner_safe',x:.1,y:.1,w:.2,h:.2},
      {type:'negative_gap',x:.5,y:.5,w:.2,h:.2}
    ]
  });
  const taskBuf=Buffer.from(JSON.stringify(task));
  const sha=await hashBinary(taskBuf);
  const a=createReviewSubmission({
    task,task_sha256:sha,reviewer_ref_sha256:hash(11),
    labels:Object.fromEntries(task.regions.map(r=>[r.region_sha256,'defect']))
  });
  const b=createReviewSubmission({
    task,task_sha256:sha,reviewer_ref_sha256:hash(12),
    labels:{
      [task.regions[0].region_sha256]:'defect',
      [task.regions[1].region_sha256]:'acceptable'
    }
  });
  return [taskBuf,Buffer.from(JSON.stringify(a)),Buffer.from(JSON.stringify(b))];
}
test('aggregate summary never exposes region, reviewer or artwork fingerprints',async()=>{
  const [t,a,b]=await fixture();
  const r=await analyzeReviews(t,a,b);
  assert.equal(r.summary.quality_verdict,'NOT_PRODUCTION_APPROVED');
  assert.equal(r.summary.expert_identity_authenticated,false);
  assert.equal(r.summary.total_regions,2);
  assert.equal(r.summary.consensus_agreement,1);
  assert.equal(r.summary.requires_adjudication,1);
  assert.equal(r.summary.group_context_complete,false);
  assert.equal(r.detail.status,'PROVISIONAL_CONSENSUS_ONLY');
  const text=JSON.stringify(r.summary);
  for(const digest of [hash(1),hash(11),hash(12)])assert.ok(!text.includes(digest));
});
test('local private report is created once, permissions 0600 on Linux and never overwritten',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'pc-review-synthetic-'));
  try{
    const buffers=await fixture(),paths=[];
    for(let i=0;i<3;i++){
      const path=join(dir,'synthetic'+i+'.json');
      await writeFile(path,buffers[i]);paths.push(path);
    }
    const output=join(dir,'provisional-report.json');
    const summary=await compareFiles(paths,output);
    assert.equal(summary.total_regions,2);
    const detail=JSON.parse(await readFile(output,'utf8'));
    assert.equal(detail.status,'PROVISIONAL_CONSENSUS_ONLY');
    if(process.platform!=='win32')
      assert.equal((await stat(output)).mode&0o777,0o600);
    await assert.rejects(()=>compareFiles(paths,output),/EEXIST/);
    assert.equal(JSON.parse(await readFile(output,'utf8')).status,
      'PROVISIONAL_CONSENSUS_ONLY');
  }finally{await rm(dir,{recursive:true,force:true})}
});
test('modified task bytes invalidate the two independent reviews',async()=>{
  const [t,a,b]=await fixture();
  const changed=Buffer.from(t.toString('utf8')+'\n');
  await assert.rejects(()=>analyzeReviews(changed,a,b),
    /SUBMISSION_TASK_DIGEST_MISMATCH/);
});
test('malformed review or wrong reviewer fingerprint is rejected',async()=>{
  const [t,a,b]=await fixture();
  const different=JSON.parse(b.toString('utf8'));
  different.reviewer_ref_sha256=JSON.parse(a.toString('utf8')).reviewer_ref_sha256;
  await assert.rejects(()=>analyzeReviews(t,a,Buffer.from(JSON.stringify(different))),
    /SAME_REVIEWER_REF/);
});
