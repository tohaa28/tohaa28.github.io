/**
 * C3B.3.H -- deterministic, blinded, pre-registered control ROI sampling.
 *
 * Sampling controls are derived ONLY from the image digest, a secret local
 * seed and grid dimensions: never from model predictions, detector candidates
 * or labels. All grid cells are HMAC-SHA256 ranked: O(G log G), G <= 4096.
 *
 * The resulting region SHA is identical to review-task.mjs, using normalized
 * rectangles with 8 decimal places. This module runs only in trusted offline
 * Node processes. No browser upload, network, user identity or production OK.
 *
 * Signing the resulting plan and cohort can prove their INTEGRITY, but not
 * that they were created before model tuning or from authentic Gifts orders.
 */
import {createHash,createHmac} from 'node:crypto';
import {validateReviewTask} from './review-task.mjs';

const HASH=/^[0-9a-f]{64}$/i;
const FMT=/^[A-Z0-9_-]{1,30}$/;
const KEYS=['schema','source_image_sha256','artwork_sha256',
  'family_sha256','technology_code','seed_hex','grid_rows',
  'grid_columns','control_count','candidate_region_sha256'];
const fail=(reason)=>({
  schema:'printcheck.vision.blind-sampling-check.v1',
  status:'MANUAL',reason,production_approved:false
});
const hex=x=>typeof x==='string'&&HASH.test(x);
const sha=b=>createHash('sha256').update(b).digest('hex');
const isInt=(v,low,high)=>Number.isSafeInteger(v)&&v>=low&&v<=high;
const normalized=n=>Number(n.toFixed(8));
const exactKeys=(obj,keys)=>obj&&typeof obj==='object'&&!Array.isArray(obj)&&
  Object.keys(obj).length===keys.length&&
  Object.keys(obj).every(k=>keys.includes(k));
function controls(options={}){
  const {source_image_sha256,seed_hex,grid_rows,
    grid_columns,control_count}=options;
  if(!hex(source_image_sha256)||!hex(seed_hex)||
     !isInt(grid_rows,2,64)||!isInt(grid_columns,2,64)||
     grid_rows*grid_columns>4096||
     !isInt(control_count,1,250)||
     control_count>grid_rows*grid_columns)
    return fail('CONTROL_GRID_OR_SEED_INVALID');
  const seed=Buffer.from(seed_hex,'hex');
  const domain='printcheck.vision.control-grid.v1\0'+
    source_image_sha256.toLowerCase()+'\0'+grid_rows+'x'+grid_columns+'\0';
  const cells=[];
  for(let id=0;id<grid_rows*grid_columns;id++){
    const score=createHmac('sha256',seed).update(domain+id).digest('hex');
    cells.push({id,score});
  }
  cells.sort((a,b)=>a.score.localeCompare(b.score)||a.id-b.id);
  const regions=[];
  for(const {id} of cells.slice(0,control_count)){
    const col=id%grid_columns,row=Math.floor(id/grid_columns);
    // Center half of each equal-area cell; avoids unstable edge overlap.
    const rect={
      x:normalized((col+0.25)/grid_columns),
      y:normalized((row+0.25)/grid_rows),
      w:normalized(0.5/grid_columns),
      h:normalized(0.5/grid_rows)
    };
    const region_sha256=sha(Buffer.from(JSON.stringify([
      source_image_sha256.toLowerCase(),rect
    ]),'utf8'));
    regions.push({region_sha256,rect});
  }
  return {
    schema:'printcheck.vision.derived-controls.v1',
    status:'DETERMINISTIC_CONTROLS_ONLY',
    regions,
    control_count:regions.length,
    note:'controls sampled independently of detector predictions, but seed timing requires external audit'
  };
}
export function deriveBlindControlRegions(options={}){
  return controls(options);
}
/**
 * Validates exactly the bytes committed by the separately signed cohort.
 * The private plan must list all *noncontrol* ROIs, so none can be hidden
 * from the expert task by relabeling a detector proposal as random control.
 */
export function verifyBlindSamplingPlan({
  task,planBytes,expectedPlanSha256
}={}){
  const v=validateReviewTask(task);
  if(v.status!=='TASK_VALID'||v.context_complete!==true)
    return fail('BLIND_TASK_NOT_READY');
  if(!(Buffer.isBuffer(planBytes)||planBytes instanceof Uint8Array)||
     planBytes.length<16||planBytes.length>65536||
     !hex(expectedPlanSha256)||sha(planBytes)!==
       expectedPlanSha256.toLowerCase())
    return fail('SIGNED_PLAN_BYTES_MISMATCH');
  let plan;
  try{plan=JSON.parse(Buffer.from(planBytes).toString('utf8'))}
  catch{return fail('SAMPLING_PLAN_INVALID_JSON')}
  if(!exactKeys(plan,KEYS)||plan.schema!==
     'printcheck.vision.blind-sampling-plan.v1'||
     !hex(plan.source_image_sha256)||
     !hex(plan.artwork_sha256)||!hex(plan.family_sha256)||
     !FMT.test(plan.technology_code||'')||
     !Array.isArray(plan.candidate_region_sha256)||
     !plan.candidate_region_sha256.every(hex))
    return fail('SAMPLING_PLAN_CONTRACT_INVALID');
  if(plan.source_image_sha256.toLowerCase()!==
       task.source.image_sha256.toLowerCase()||
     plan.artwork_sha256.toLowerCase()!==
       task.context.artwork_sha256.toLowerCase()||
     plan.family_sha256.toLowerCase()!==
       task.context.family_sha256.toLowerCase()||
     plan.technology_code!==task.context.technology_code)
    return fail('SAMPLING_PLAN_SOURCE_MISMATCH');
  const sampled=controls(plan);
  if(sampled.status!=='DETERMINISTIC_CONTROLS_ONLY')return sampled;
  const controlIds=new Set(sampled.regions.map(x=>x.region_sha256));
  if(controlIds.size!==sampled.regions.length)
    return fail('SAMPLING_CONTROL_COLLISION');
  const sourceSet=new Map();
  for(const roi of task.regions){
    // Exactly match the review-task digest; refuse swapped coordinates
    // even if a syntactically valid region ID was copied.
    const expected=sha(Buffer.from(JSON.stringify([
      task.source.image_sha256.toLowerCase(),roi.rect
    ]),'utf8'));
    if(roi.region_sha256.toLowerCase()!==expected)
      return fail('TASK_ROI_GEOMETRY_FINGERPRINT_INVALID');
    const id=roi.region_sha256.toLowerCase();
    if(sourceSet.has(id))return fail('DUPLICATE_ROI');
    sourceSet.set(id,roi);
  }
  const otherIds=plan.candidate_region_sha256.map(x=>x.toLowerCase());
  const candidateIds=new Set(otherIds);
  if(otherIds.length===0||candidateIds.size!==otherIds.length||
     [...candidateIds].some(id=>controlIds.has(id))||
     controlIds.size+candidateIds.size!==task.regions.length)
    return fail('CONTROL_OR_CANDIDATE_COVERAGE_INVALID');
  if([...controlIds,...candidateIds].some(id=>!sourceSet.has(id)))
    return fail('PRE_REGISTERED_ROI_NOT_FOUND');
  for(const sampledRegion of sampled.regions){
    const actual=sourceSet.get(sampledRegion.region_sha256);
    if(JSON.stringify(actual.rect)!==JSON.stringify(sampledRegion.rect))
      return fail('CONTROL_ROI_COORDINATES_MISMATCH');
  }
  if(sampled.control_count<Math.ceil(task.regions.length*0.25))
    return fail('CONTROL_FRACTION_TOO_SMALL');
  return {
    schema:'printcheck.vision.blind-sampling-check.v1',
    status:'PRE_REGISTERED_CONTROLS_VERIFIED',
    production_approved:false,
    candidate_roi_count:candidateIds.size,
    independently_derived_control_count:controlIds.size,
    control_fraction:controlIds.size/task.regions.length,
    source_digest_bound:true,
    plan_bytes_bound_to_signed_cohort:true,
    sample_selected_before_tuning_proven:false,
    warning:'control positions are deterministic but unbiasedness of entire human-curated artwork cohort requires external audit'
  };
}
