import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,readFile,rm,stat,chmod} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {
  createReviewTask,createReviewSubmission
} from '../vision/dataset/review-task.mjs';
import {
  prepareBlindControlTask,writeBlindControlPackage
} from '../vision/dataset/prepare-blind-control-task.mjs';
import {verifyBlindSamplingPlan} from '../vision/dataset/blind-sampling-plan.mjs';

const h=n=>n.toString(16).padStart(64,'0');
const sha=b=>createHash('sha256').update(b).digest('hex');
async function initial(annotations=[{
  type:'positive_thin',x:.18,y:.2,w:.12,h:.14
}]){
  return createReviewTask({
    image_sha256:h(3),width_px:1400,height_px:900,
    artwork_sha256:h(4),family_sha256:h(5),
    technology_code:'UV1',annotations
  });
}
const options=task=>({
  candidateTask:task,seed_hex:h(11),
  grid_rows:8,grid_columns:8,control_count:3
});
test('coordinator produces one blinded task plus complete privately sampled controls',async()=>{
  const source=await initial();
  const pkg=await prepareBlindControlTask(options(source));
  assert.equal(pkg.status,'BLIND_CONTROL_PACKAGE_PREPARED');
  assert.equal(pkg.summary.preliminary_roi_count,1);
  assert.equal(pkg.summary.independent_control_count,3);
  assert.equal(pkg.summary.total_blind_regions,4);
  assert.equal(pkg.summary.control_fraction,.75);
  assert.equal(pkg.summary.quality_verdict,'NOT_PRODUCTION_APPROVED');
  assert.equal(pkg.plan.candidate_region_sha256[0],source.regions[0].region_sha256);
  assert.equal(pkg.task.regions.length,4);
  assert.ok(pkg.task.regions.every(r=>!Object.hasOwn(r,'type')));
  const check=verifyBlindSamplingPlan({
    task:pkg.task,planBytes:pkg.planBytes,
    expectedPlanSha256:sha(pkg.planBytes)
  });
  assert.equal(check.status,'PRE_REGISTERED_CONTROLS_VERIFIED');
  const labels=Object.fromEntries(pkg.task.regions.map(r=>
    [r.region_sha256,'uncertain']));
  const answer=createReviewSubmission({
    task:pkg.task,task_sha256:sha(pkg.taskBytes),
    reviewer_ref_sha256:h(333),labels
  });
  assert.equal(answer.results.length,4);
  assert.ok(!JSON.stringify(answer).includes('candidate_region_sha256'));
  assert.ok(!JSON.stringify(pkg.task).includes('seed_hex'));
});
test('same candidate task and seed produce byte-identical task and sampling plan',async()=>{
  const base=await initial();
  const a=await prepareBlindControlTask(options(base));
  const b=await prepareBlindControlTask(options(base));
  assert.deepEqual(a.taskBytes,b.taskBytes);
  assert.deepEqual(a.planBytes,b.planBytes);
});
test('a changed seed changes control ROIs without altering original artwork identity',async()=>{
  const base=await initial();
  const a=await prepareBlindControlTask(options(base));
  const b=await prepareBlindControlTask({...options(base),seed_hex:h(999)});
  assert.notDeepEqual(a.task.regions.slice(1),b.task.regions.slice(1));
  assert.equal(a.task.context.artwork_sha256,b.task.context.artwork_sha256);
  assert.equal(a.task.regions[0].region_sha256,b.task.regions[0].region_sha256);
});
test('a coordinator cannot silently approve too few controls, too many ROIs or missing source provenance',async()=>{
  const ten=Array.from({length:10},(_,i)=>({
    type:'positive_thin',x:.02+i*.09,y:.91,w:.04,h:.04
  }));
  const base=await initial(ten);
  await assert.rejects(()=>prepareBlindControlTask({
    ...options(base),control_count:1
  }),/CONTROL_COVERAGE_BELOW_25_PERCENT_OR_TOO_MANY_ROIS/);
  const missing=await createReviewTask({
    image_sha256:h(3),width_px:800,height_px:800,
    annotations:[{type:'other',x:.1,y:.1,w:.2,h:.2}]
  });
  await assert.rejects(()=>prepareBlindControlTask(options(missing)),
    /ORIGINAL_CANDIDATE_TASK_INCOMPLETE/);
});
test('mutating original ROI geometry while keeping SHA is refused before sampling',async()=>{
  const base=await initial();
  base.regions[0].rect.y=.39;
  await assert.rejects(()=>prepareBlindControlTask(options(base)),
    /ORIGINAL_ROI_GEOMETRY_UNTRUSTED/);
});
test('private files use exclusive create and 0600, with no overwrite',async()=>{
  const base=await initial(),pkg=await prepareBlindControlTask(options(base));
  const folder=await mkdtemp(join(tmpdir(),'pcv-blind-controls-test-'));
  try{
    await chmod(folder,0o700);
    const saved=await writeBlindControlPackage(pkg,folder);
    assert.equal(saved.status,'PRIVATE_BLIND_TASK_AND_PLAN_SAVED');
    for(const name of ['vision-blind-task.json','vision-sampling-plan.json']){
      const path=join(folder,name);
      const metadata=await stat(path);
      if(process.platform!=='win32')
        assert.equal(metadata.mode&0o777,0o600);
      const bytes=await readFile(path);
      assert.deepEqual(bytes,name==='vision-blind-task.json'?
        pkg.taskBytes:pkg.planBytes);
    }
    await assert.rejects(()=>writeBlindControlPackage(pkg,folder),
      /PRIVATE_OUTPUT_REFUSED_OR_ALREADY_EXISTS/);
    assert.deepEqual(await readFile(join(folder,'vision-blind-task.json')),
      pkg.taskBytes);
    if(process.platform!=='win32'){
      await chmod(folder,0o755);
      await assert.rejects(()=>writeBlindControlPackage(pkg,folder),
        /PRIVATE_DIRECTORY_0700_REQUIRED/);
    }
  }finally{
    await chmod(folder,0o700);
    await rm(folder,{recursive:true,force:true});
  }
});
