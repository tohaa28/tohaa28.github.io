/**
 * PrintCheck Vision C3B.3.E: blinded image region review contract.
 * Browser/Node, no network, no file APIs, no automatic approval.
 *
 * A task is immutable once exported. Two human reviews must use the exact
 * same task file (SHA-256 of bytes) and matching source image digest. A
 * reviewer fingerprint is supplied by the private coordinator, NOT proven
 * here. Consensus never becomes trusted ground truth automatically.
 */
export const TASK_SCHEMA='printcheck.vision.review-task.v1';
export const SUBMISSION_SCHEMA='printcheck.vision.review-submission.v1';
const HASH=/^[a-f0-9]{64}$/i;
const TYPES=new Set(['positive_thin','negative_gap','island','corner_safe','other']);
const LABELS=new Set(['defect','acceptable','uncertain']);
const fail=(reason)=>({status:'MANUAL',reason});
const isHash=x=>typeof x==='string'&&HASH.test(x);
const validNum=x=>typeof x==='number'&&Number.isFinite(x);
const normalizedRect=r=>r&&['x','y','w','h'].every(k=>validNum(r[k]))&&
  r.x>=0&&r.y>=0&&r.w>0&&r.h>0&&r.x+r.w<=1+1e-9&&r.y+r.h<=1+1e-9;
const positiveInteger=x=>Number.isSafeInteger(x)&&x>=1&&x<=200000;
const asHex=bytes=>Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
export async function hashBinary(bytes){
  if(!(bytes instanceof ArrayBuffer)&&!ArrayBuffer.isView(bytes))
    throw new TypeError('BYTES_REQUIRED');
  const view=ArrayBuffer.isView(bytes)?
    bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength):bytes;
  return asHex(await crypto.subtle.digest('SHA-256',view));
}
export function validateReviewTask(task){
  if(!task||task.schema!==TASK_SCHEMA)return fail('TASK_SCHEMA_INVALID');
  const source=task.source,ctx=task.context;
  if(!source||!isHash(source.image_sha256)||
      !positiveInteger(source.width_px)||!positiveInteger(source.height_px))
    return fail('TASK_IMAGE_PROVENANCE_INVALID');
  if(!ctx||typeof ctx!=='object')
    return fail('TASK_CONTEXT_INVALID');
  if(Object.keys(source).some(k=>!['image_sha256','width_px','height_px'].includes(k)))
    return fail('TASK_SOURCE_UNEXPECTED_FIELDS');
  if(Object.keys(ctx).some(k=>![
    'artwork_sha256','family_sha256','technology_code','order_scale_verified'
  ].includes(k)))return fail('TASK_CONTEXT_UNEXPECTED_FIELDS');
  for(const key of ['artwork_sha256','family_sha256']){
    if(ctx[key]!==null&&!isHash(ctx[key]))return fail('TASK_CONTEXT_HASH_INVALID');
  }
  if(ctx.technology_code!==null&&
     !(typeof ctx.technology_code==='string'&&
       /^[A-Z0-9_-]{1,30}$/.test(ctx.technology_code)))
    return fail('TASK_TECHNOLOGY_INVALID');
  if(ctx.order_scale_verified!==false)
    return fail('TASK_SCALE_CERTIFICATION_FORBIDDEN');
  if(task.predictions_hidden!==true||task.review_state!=='UNVERIFIED')
    return fail('TASK_UNBLINDED_OR_PREVERIFIED');
  if(!Array.isArray(task.regions)||task.regions.length<1||
     task.regions.length>250)return fail('TASK_REGION_COUNT_INVALID');
  const ids=new Set();
  for(const region of task.regions){
    if(!region||!isHash(region.region_sha256)||
       !normalizedRect(region.rect)||ids.has(region.region_sha256))
      return fail('TASK_REGION_INVALID');
    if(Object.keys(region).some(k=>!['region_sha256','rect'].includes(k)))
      return fail('TASK_REGION_UNEXPECTED_FIELDS');
    ids.add(region.region_sha256);
  }
  if(Object.keys(task).some(k=>![
    'schema','source','context','predictions_hidden','review_state','regions'
  ].includes(k)))return fail('TASK_UNEXPECTED_FIELDS');
  return {status:'TASK_VALID',count:task.regions.length,
    context_complete:isHash(ctx.artwork_sha256)&&isHash(ctx.family_sha256)&&
      typeof ctx.technology_code==='string'};
}
export async function createReviewTask({image_sha256,width_px,height_px,
  annotations,artwork_sha256=null,family_sha256=null,technology_code=null}={}){
  if(!isHash(image_sha256)||!positiveInteger(width_px)||
     !positiveInteger(height_px)||!Array.isArray(annotations)||
     annotations.length<1||annotations.length>250)
    throw new Error('INVALID_TASK_SOURCE');
  if((artwork_sha256!==null&&!isHash(artwork_sha256))||
     (family_sha256!==null&&!isHash(family_sha256))||
     (technology_code!==null&&!/^[A-Z0-9_-]{1,30}$/.test(technology_code)))
    throw new Error('INVALID_TASK_CONTEXT');
  const regions=[];
  for(const annotation of annotations){
    if(!TYPES.has(annotation.type)||!normalizedRect(annotation))
      throw new Error('INVALID_TASK_REGION');
    const rect=Object.fromEntries(['x','y','w','h'].map(k=>[
      k,Number(annotation[k].toFixed(8))
    ]));
    if(!normalizedRect(rect))throw new Error('INVALID_ROUNDED_REGION');
    const region_sha256=await hashBinary(new TextEncoder().encode(
      JSON.stringify([image_sha256.toLowerCase(),rect])
    ));
    regions.push({region_sha256,rect});
  }
  const task={
    schema:TASK_SCHEMA,
    source:{image_sha256:image_sha256.toLowerCase(),width_px,height_px},
    context:{
      artwork_sha256:artwork_sha256?.toLowerCase()??null,
      family_sha256:family_sha256?.toLowerCase()??null,
      technology_code:technology_code??null,
      order_scale_verified:false
    },
    predictions_hidden:true,review_state:'UNVERIFIED',regions
  };
  const status=validateReviewTask(task);
  if(status.status!=='TASK_VALID')throw new Error(status.reason);
  return task;
}
export function createReviewSubmission({task,task_sha256,reviewer_ref_sha256,
  labels}={}){
  const v=validateReviewTask(task);
  if(v.status!=='TASK_VALID')throw new Error(v.reason);
  if(!isHash(task_sha256)||!isHash(reviewer_ref_sha256))
    throw new Error('REVIEW_FINGERPRINT_INVALID');
  if(!labels||typeof labels!=='object')
    throw new Error('REVIEW_LABELS_REQUIRED');
  const expected=new Set(task.regions.map(r=>r.region_sha256));
  const keys=Object.keys(labels);
  if(keys.length!==expected.size||keys.some(k=>!expected.has(k)||
     !LABELS.has(labels[k])))
    throw new Error('REVIEW_LABELS_INCOMPLETE_OR_INVALID');
  return {
    schema:SUBMISSION_SCHEMA,
    task_sha256:task_sha256.toLowerCase(),
    reviewer_ref_sha256:reviewer_ref_sha256.toLowerCase(),
    review_state:'SELF_ASSERTED_ONLY',
    blinded_to_predictions:true,
    results:task.regions.map(r=>({
      region_sha256:r.region_sha256,
      label:labels[r.region_sha256]
    }))
  };
}
export function validateReviewSubmission(submission,task,task_sha256){
  if(!submission||submission.schema!==SUBMISSION_SCHEMA||
     !isHash(task_sha256)||submission.task_sha256!==task_sha256.toLowerCase())
    return fail('SUBMISSION_TASK_DIGEST_MISMATCH');
  if(!isHash(submission.reviewer_ref_sha256)||
     submission.review_state!=='SELF_ASSERTED_ONLY'||
     submission.blinded_to_predictions!==true)
    return fail('SUBMISSION_NOT_INDEPENDENTLY_CERTIFIED');
  if(!Array.isArray(submission.results)||
     submission.results.length!==task.regions.length)
    return fail('SUBMISSION_REGIONS_MISMATCH');
  const expected=new Set(task.regions.map(r=>r.region_sha256));
  const observed=new Set();
  for(const row of submission.results){
    if(!row||!isHash(row.region_sha256)||!expected.has(row.region_sha256)||
       !LABELS.has(row.label)||observed.has(row.region_sha256))
      return fail('SUBMISSION_LABEL_INVALID');
    observed.add(row.region_sha256);
  }
  return {status:'SUBMISSION_VALID'};
}
export function compareIndependentReviews(task,task_sha256,left,right){
  if(validateReviewTask(task).status!=='TASK_VALID')
    return fail('TASK_INVALID');
  for(const submission of [left,right]){
    const v=validateReviewSubmission(submission,task,task_sha256);
    if(v.status!=='SUBMISSION_VALID')return v;
  }
  if(left.reviewer_ref_sha256.toLowerCase()===
     right.reviewer_ref_sha256.toLowerCase())
    return fail('SAME_REVIEWER_REF');
  const lookup=new Map(right.results.map(x=>[x.region_sha256,x.label]));
  const regions=left.results.map(row=>{
    const other=lookup.get(row.region_sha256);
    const agreed=row.label===other&&row.label!=='uncertain';
    return {
      region_sha256:row.region_sha256,
      decision:agreed?row.label:'requires_adjudication',
      review_agreement:agreed,
      // Does NOT establish independent identity of either signer.
      cryptographically_authenticated:false
    };
  });
  return {
    schema:'printcheck.vision.review-consensus-draft.v1',
    status:'PROVISIONAL_CONSENSUS_ONLY',
    expert_identity_verified:false,not_production_ground_truth:true,
    agreement_count:regions.filter(r=>r.review_agreement).length,
    adjudication_count:regions.filter(r=>!r.review_agreement).length,
    regions
  };
}
