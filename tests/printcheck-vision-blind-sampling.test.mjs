import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createReviewTask} from '../vision/dataset/review-task.mjs';
import {
  deriveBlindControlRegions,verifyBlindSamplingPlan
} from '../vision/dataset/blind-sampling-plan.mjs';

const h=n=>n.toString(16).padStart(64,'0');
const sha=b=>createHash('sha256').update(b).digest('hex');
const candidate={type:'positive_thin',x:.27,y:.31,w:.12,h:.08};
const options={
  source_image_sha256:h(1),seed_hex:h(23),
  grid_rows:6,grid_columns:8,control_count:4
};
async function fixture(moreCandidates=[]){
  const controls=deriveBlindControlRegions(options);
  assert.equal(controls.status,'DETERMINISTIC_CONTROLS_ONLY');
  const task=await createReviewTask({
    image_sha256:h(1),width_px:1024,height_px:768,
    artwork_sha256:h(2),family_sha256:h(3),technology_code:'UV1',
    annotations:[
      candidate,...moreCandidates,
      ...controls.regions.map(r=>({type:'other',...r.rect}))
    ]
  });
  const candidateCount=1+moreCandidates.length;
  const plan={
    schema:'printcheck.vision.blind-sampling-plan.v1',
    source_image_sha256:h(1),artwork_sha256:h(2),family_sha256:h(3),
    technology_code:'UV1',seed_hex:options.seed_hex,
    grid_rows:options.grid_rows,grid_columns:options.grid_columns,
    control_count:options.control_count,
    candidate_region_sha256:task.regions.slice(0,candidateCount)
      .map(r=>r.region_sha256)
  };
  return {task,plan,controls};
}
function check(task,plan){
  const bytes=Buffer.from(JSON.stringify(plan)+'\n');
  return verifyBlindSamplingPlan({
    task,planBytes:bytes,expectedPlanSha256:sha(bytes)
  });
}

test('fixed seed and source image produce identical control rectangles and SHA across runs',()=>{
  const a=deriveBlindControlRegions(options);
  const b=deriveBlindControlRegions(options);
  assert.deepEqual(a,b);
  assert.equal(a.control_count,4);
  assert.equal(new Set(a.regions.map(r=>r.region_sha256)).size,4);
  for(const {rect} of a.regions){
    assert.ok(rect.x>=0&&rect.y>=0);
    assert.ok(rect.x+rect.w<=1);
    assert.ok(rect.y+rect.h<=1);
  }
});
test('different image digest or seed changes HMAC sampling for the same grid',()=>{
  const a=deriveBlindControlRegions(options).regions.map(r=>r.region_sha256);
  const seedChanged=deriveBlindControlRegions({...options,seed_hex:h(24)})
    .regions.map(r=>r.region_sha256);
  const imageChanged=deriveBlindControlRegions({
    ...options,source_image_sha256:h(99)
  }).regions.map(r=>r.region_sha256);
  assert.notDeepEqual(a,seedChanged);
  assert.notDeepEqual(a,imageChanged);
});
test('signed bytes, original artwork, all candidate and control ROIs have full coverage',async()=>{
  const {task,plan}=await fixture();
  const r=check(task,plan);
  assert.equal(r.status,'PRE_REGISTERED_CONTROLS_VERIFIED',r.reason);
  assert.equal(r.production_approved,false);
  assert.equal(r.candidate_roi_count,1);
  assert.equal(r.independently_derived_control_count,4);
  assert.equal(r.control_fraction,0.8);
  assert.equal(r.sample_selected_before_tuning_proven,false);
});
test('reformatted or silently modified plan bytes cannot pass previous cohort commitment',async()=>{
  const {task,plan}=await fixture();
  const signed=Buffer.from(JSON.stringify(plan)+'\n');
  const changed=Buffer.from(JSON.stringify(plan));
  const r=verifyBlindSamplingPlan({
    task,planBytes:changed,expectedPlanSha256:sha(signed)
  });
  assert.equal(r.reason,'SIGNED_PLAN_BYTES_MISMATCH');
});
test('different seed cannot relocate controls while keeping task unchanged',async()=>{
  const {task,plan}=await fixture();
  plan.seed_hex=h(99);
  assert.equal(check(task,plan).reason,'PRE_REGISTERED_ROI_NOT_FOUND');
});
test('changing actual ROI coordinates without changing region SHA is rejected',async()=>{
  const {task,plan}=await fixture();
  task.regions[1].rect.x+=0.001;
  assert.equal(check(task,plan).reason,'TASK_ROI_GEOMETRY_FINGERPRINT_INVALID');
});
test('claiming a control ROI as detector-suggested is rejected',async()=>{
  const {task,plan}=await fixture();
  plan.candidate_region_sha256.push(task.regions[1].region_sha256);
  assert.equal(check(task,plan).reason,'CONTROL_OR_CANDIDATE_COVERAGE_INVALID');
});
test('dropping registered detector ROI cannot silently claim a clean sampled cohort',async()=>{
  const {task,plan}=await fixture();
  plan.candidate_region_sha256=[];
  assert.equal(check(task,plan).reason,'CONTROL_OR_CANDIDATE_COVERAGE_INVALID');
});
test('minimum 25 percent independent controls is enforced',async()=>{
  const extra=Array.from({length:16},(_,i)=>({
    type:'positive_thin',
    x:Number((.005+i*.056).toFixed(8)),y:.90,
    w:.024,h:.045
  }));
  const {task,plan}=await fixture(extra);
  assert.equal(check(task,plan).reason,'CONTROL_FRACTION_TOO_SMALL');
});
test('context mismatches and malformed seeds, grids or unknown properties refuse',async()=>{
  const {task,plan}=await fixture();
  const changed={...plan,technology_code:'DTF1'};
  assert.equal(check(task,changed).reason,'SAMPLING_PLAN_SOURCE_MISMATCH');
  const extra={...plan,client_order_number:'PRIVATE'};
  assert.equal(check(task,extra).reason,'SAMPLING_PLAN_CONTRACT_INVALID');
  assert.equal(deriveBlindControlRegions({...options,seed_hex:'short'}).status,'MANUAL');
  assert.equal(deriveBlindControlRegions({...options,grid_rows:65}).status,'MANUAL');
  assert.equal(deriveBlindControlRegions({...options,control_count:1024}).status,'MANUAL');
});
test('different control ROI ordering in task is permitted; chosen locations remain stable',async()=>{
  const {task,plan}=await fixture();
  task.regions.reverse();
  assert.equal(check(task,plan).status,'PRE_REGISTERED_CONTROLS_VERIFIED');
});
