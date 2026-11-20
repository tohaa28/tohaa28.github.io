import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TASK_SCHEMA,SUBMISSION_SCHEMA,hashBinary,
  createReviewTask,validateReviewTask,createReviewSubmission,
  validateReviewSubmission,compareIndependentReviews
} from '../vision/dataset/review-task.mjs';

const hash=n=>n.toString(16).padStart(64,'0');
const entries=[
  {type:'positive_thin',x:0.1,y:0.2,w:0.2,h:0.05},
  {type:'corner_safe',x:0.6,y:0.4,w:0.08,h:0.08}
];
const create=overrides=>createReviewTask({
  image_sha256:hash(1),width_px:1200,height_px:800,
  annotations:entries,artwork_sha256:hash(2),family_sha256:hash(3),
  technology_code:'UV1',...overrides
});
const digest=async task=>hashBinary(new TextEncoder().encode(JSON.stringify(task)));

test('the same annotated image produces exactly the same immutable blinded task',async()=>{
  const a=await create(),b=await create();
  assert.equal(a.schema,TASK_SCHEMA);
  assert.deepEqual(a,b);
  assert.equal(validateReviewTask(a).status,'TASK_VALID');
  assert.equal(a.predictions_hidden,true);
  assert.equal(a.review_state,'UNVERIFIED');
  assert.equal(a.context.order_scale_verified,false);
  assert.equal(a.regions.length,2);
  assert.ok(a.regions.every(region=>!Object.hasOwn(region,'type')));
  assert.equal(new Set(a.regions.map(x=>x.region_sha256)).size,2);
  assert.ok(!JSON.stringify(a).includes('customer-order'));
});

test('different bounding box or source digest changes the region fingerprint',async()=>{
  const a=await create(),b=await create({annotations:[
    {...entries[0],w:0.201},entries[1]
  ]});
  const c=await create({image_sha256:hash(17)});
  assert.notEqual(a.regions[0].region_sha256,b.regions[0].region_sha256);
  assert.notEqual(a.regions[0].region_sha256,c.regions[0].region_sha256);
});

test('task can be prepared without certified origin but never claims valid order scale',async()=>{
  const task=await create({artwork_sha256:null,family_sha256:null,technology_code:null});
  assert.equal(validateReviewTask(task).status,'TASK_VALID');
  assert.equal(validateReviewTask(task).context_complete,false);
  assert.equal(task.context.order_scale_verified,false);
});

test('duplicate or out-of-bounds ROIs block task creation',async()=>{
  await assert.rejects(()=>create({annotations:[entries[0],entries[0]]}),/TASK_REGION_INVALID/);
  await assert.rejects(()=>create({annotations:[{...entries[0],x:0.99}]}),/INVALID_TASK_REGION/);
  await assert.rejects(()=>create({annotations:[{...entries[0],w:0}]}),/INVALID_TASK_REGION/);
});

test('unsupported labels and unblinded or preverified tasks fail closed',async()=>{
  const task=await create();
  task.predictions_hidden=false;
  assert.equal(validateReviewTask(task).reason,'TASK_UNBLINDED_OR_PREVERIFIED');
  task.predictions_hidden=true;
  task.review_state='verified';
  assert.equal(validateReviewTask(task).reason,'TASK_UNBLINDED_OR_PREVERIFIED');
  task.review_state='UNVERIFIED';
  task.regions[0].label='defect';
  assert.equal(validateReviewTask(task).reason,'TASK_REGION_UNEXPECTED_FIELDS');
});

test('all regions require explicit labels before exporting review submission',async()=>{
  const task=await create(),taskHash=await digest(task);
  assert.throws(()=>createReviewSubmission({
    task,task_sha256:taskHash,reviewer_ref_sha256:hash(11),
    labels:{[task.regions[0].region_sha256]:'defect'}
  }),/REVIEW_LABELS_INCOMPLETE_OR_INVALID/);
  const labels=Object.fromEntries(task.regions.map(r=>[r.region_sha256,'uncertain']));
  const result=createReviewSubmission({
    task,task_sha256:taskHash,reviewer_ref_sha256:hash(11),labels
  });
  assert.equal(result.schema,SUBMISSION_SCHEMA);
  assert.equal(result.review_state,'SELF_ASSERTED_ONLY');
  assert.equal(result.blinded_to_predictions,true);
  assert.equal(validateReviewSubmission(result,task,taskHash).status,'SUBMISSION_VALID');
  assert.ok(!JSON.stringify(result).includes('artwork_sha256'));
});

test('two independent matching opinions create only provisional consensus',async()=>{
  const task=await create(),taskHash=await digest(task);
  const labels=Object.fromEntries(task.regions.map(r=>[r.region_sha256,'defect']));
  const first=createReviewSubmission({
    task,task_sha256:taskHash,reviewer_ref_sha256:hash(11),labels
  });
  const second=createReviewSubmission({
    task,task_sha256:taskHash,reviewer_ref_sha256:hash(12),labels
  });
  const result=compareIndependentReviews(task,taskHash,first,second);
  assert.equal(result.status,'PROVISIONAL_CONSENSUS_ONLY');
  assert.equal(result.agreement_count,2);
  assert.equal(result.adjudication_count,0);
  assert.equal(result.expert_identity_verified,false);
  assert.equal(result.not_production_ground_truth,true);
  assert.ok(result.regions.every(r=>r.cryptographically_authenticated===false));
});

test('reviewer disagreement or uncertain answer always requires adjudication',async()=>{
  const task=await create(),taskHash=await digest(task);
  const first=createReviewSubmission({
    task,task_sha256:taskHash,reviewer_ref_sha256:hash(11),
    labels:Object.fromEntries(task.regions.map(r=>[r.region_sha256,'defect']))
  });
  const second=createReviewSubmission({
    task,task_sha256:taskHash,reviewer_ref_sha256:hash(12),
    labels:{
      [task.regions[0].region_sha256]:'acceptable',
      [task.regions[1].region_sha256]:'uncertain'
    }
  });
  const result=compareIndependentReviews(task,taskHash,first,second);
  assert.equal(result.adjudication_count,2);
  assert.ok(result.regions.every(r=>r.decision==='requires_adjudication'));
});

test('same reviewer identifier, swapped task or duplicate result is rejected',async()=>{
  const task=await create(),taskHash=await digest(task);
  const labels=Object.fromEntries(task.regions.map(r=>[r.region_sha256,'defect']));
  const a=createReviewSubmission({task,task_sha256:taskHash,reviewer_ref_sha256:hash(11),labels});
  const b=createReviewSubmission({task,task_sha256:taskHash,reviewer_ref_sha256:hash(11),labels});
  assert.equal(compareIndependentReviews(task,taskHash,a,b).reason,'SAME_REVIEWER_REF');
  b.reviewer_ref_sha256=hash(12);
  b.task_sha256=hash(33);
  assert.equal(compareIndependentReviews(task,taskHash,a,b).reason,'SUBMISSION_TASK_DIGEST_MISMATCH');
  b.task_sha256=taskHash;
  b.results[1].region_sha256=b.results[0].region_sha256;
  assert.equal(compareIndependentReviews(task,taskHash,a,b).reason,'SUBMISSION_LABEL_INVALID');
});

test('hashBinary computes real SHA-256 on bytes and validates inputs',async()=>{
  const value=await hashBinary(new TextEncoder().encode('abc'));
  assert.equal(value,'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  await assert.rejects(()=>hashBinary('abc'),/BYTES_REQUIRED/);
});
