/**
 * PrintCheck Vision C3B.3.E -- compare research detectors on EXACT SAME ROIs.
 *
 * A coordinate transform from physical mm to normalized image coordinates
 * must be explicit and tied to the immutable artwork/image digests. A list of
 * per-method candidate points is matched to pre-registered, blinded regions.
 *
 * No production proof, ground truth or expert labels enter this function.
 * "none" means no local candidate found by THIS detector inside the ROI,
 * never "artwork passed". Unknown scale, invalid threshold, truncated results,
 * near-boundary candidate or incomplete research data => MANUAL.
 */
import {validateReviewTask} from './review-task.mjs';

const HASH=/^[0-9a-f]{64}$/i;
const FINITE=x=>typeof x==='number'&&Number.isFinite(x);
const VALID_STATUS='RESEARCH_CANDIDATES_ONLY';
const VALID_KIND=new Set(['positive_width_mm','negative_gap_mm']);
const REFUSE=(reason)=>({
  schema:'printcheck.vision.region-method-comparison.v1',
  status:'MANUAL',reason,production_approved:false,results:[]
});
function matrixValid(m){
  if(!Array.isArray(m)||m.length!==6||!m.every(FINITE)||
     m.some(x=>Math.abs(x)>1e6))return false;
  const determinant=m[0]*m[3]-m[1]*m[2];
  return Math.abs(determinant)>1e-14;
}
const project=(p,m)=>({x:m[0]*p.x+m[2]*p.y+m[4],
                         y:m[1]*p.x+m[3]*p.y+m[5]});
function inside(rect,p,imageWidth,imageHeight){
  const threshold=Math.max(1/imageWidth,1/imageHeight)*0.5;
  const dx=Math.min(p.x-rect.x,rect.x+rect.w-p.x);
  const dy=Math.min(p.y-rect.y,rect.y+rect.h-p.y);
  const dist=Math.min(dx,dy);
  if(dist < -threshold)return 'outside';
  if(dist <= threshold)return 'ambiguous';
  return 'inside';
}
function classifyRegion(rect,candidates,thresholds,m,imageWidth,imageHeight){
  let found=false,uncertain=false;
  for(const c of candidates){
    const point=project(c.at_mm,m);
    if(!FINITE(point.x)||!FINITE(point.y))return 'manual';
    const relation=inside(rect,point,imageWidth,imageHeight);
    if(relation==='outside')continue;
    if(relation==='ambiguous'){uncertain=true;continue}
    const minimum=thresholds[c.kind],lo=c.measured_mm-c.uncertainty_mm;
    const hi=c.measured_mm+c.uncertainty_mm;
    if(hi < minimum)found=true;
    else if(lo <= minimum)uncertain=true;
  }
  // An unambiguous very thin observation is retained even if another
  // measurement at the edge of the ROI is uncertain; review is still needed.
  if(found)return 'candidate';
  return uncertain?'manual':'none';
}
/**
 * @param {{
 * task:object, calibration:{
 *   mm_to_image_normalized:number[],
 *   source_image_sha256:string,
 *   artwork_sha256:string, state:"research_only"
 * },
 * limits_mm:{positive_width_mm:number,negative_gap_mm:number},
 * algorithms:Array<{id:string,source_artwork_sha256:string,
 *   revision:string,report:object}>
 * }} input
 */
export function compareRegionMethods(input={}){
  const task=input.task,v=validateReviewTask(task);
  if(v.status!=='TASK_VALID')return REFUSE('INVALID_BLIND_TASK');
  if(!v.context_complete)
    return REFUSE('ARTWORK_FAMILY_TECHNOLOGY_CONTEXT_REQUIRED');
  const calib=input.calibration;
  if(!calib||calib.state!=='research_only'||
     calib.source_image_sha256!==task.source.image_sha256||
     calib.artwork_sha256!==task.context.artwork_sha256||
     !matrixValid(calib.mm_to_image_normalized))
    return REFUSE('RESEARCH_COORDINATE_CALIBRATION_REQUIRED');
  const thresholds=input.limits_mm;
  if(!thresholds||Object.keys(thresholds).some(k=>!VALID_KIND.has(k))||
     [...VALID_KIND].some(k=>!FINITE(thresholds[k])||
       thresholds[k]<=0||thresholds[k]>10))
    return REFUSE('EXPERIMENTAL_LIMITS_MM_REQUIRED');
  const algorithms=input.algorithms;
  if(!Array.isArray(algorithms)||algorithms.length<2||algorithms.length>8)
    return REFUSE('AT_LEAST_TWO_DETECTORS_REQUIRED');
  const seen=new Set(),results=[];
  for(const algorithm of algorithms){
    if(!algorithm||typeof algorithm.id!=='string'||
       !/^[A-Za-z0-9_-]{1,40}$/.test(algorithm.id)||
       seen.has(algorithm.id)||
       typeof algorithm.revision!=='string'||
       !/^[A-Za-z0-9._-]{1,64}$/.test(algorithm.revision))
      return REFUSE('ALGORITHM_IDENTITY_INVALID');
    seen.add(algorithm.id);
    if(!HASH.test(algorithm.source_artwork_sha256||'')||
       algorithm.source_artwork_sha256!==task.context.artwork_sha256)
      return REFUSE('ALGORITHM_ARTWORK_MISMATCH');
    const report=algorithm.report;
    let detections=null;
    if(report?.status===VALID_STATUS&&report.truncated!==true&&
       Array.isArray(report.candidates)&&report.candidates.length<=10000){
      detections=report.candidates;
      if(detections.some(c=>!c||!VALID_KIND.has(c.kind)||
         !FINITE(c.measured_mm)||c.measured_mm<0||
         !FINITE(c.uncertainty_mm)||c.uncertainty_mm<0||
         c.uncertainty_mm>10||!c.at_mm||
         !FINITE(c.at_mm.x)||!FINITE(c.at_mm.y)))
        detections=null;
    }
    const predictions=task.regions.map(region=>({
      region_sha256:region.region_sha256,
      state:detections?classifyRegion(region.rect,detections,thresholds,
        calib.mm_to_image_normalized,task.source.width_px,
        task.source.height_px):'manual'
    }));
    results.push({
      algorithm_id:algorithm.id,revision:algorithm.revision,predictions,
      manual_count:predictions.filter(x=>x.state==='manual').length,
      candidate_count:predictions.filter(x=>x.state==='candidate').length,
      no_candidate_count:predictions.filter(x=>x.state==='none').length
    });
  }
  return {
    schema:'printcheck.vision.region-method-comparison.v1',
    status:'RESEARCH_PREDICTIONS_ONLY',
    production_approved:false,
    expert_labels_included:false,
    physical_scale_independently_proven:false,
    region_count:task.regions.length,
    result_scope:'no_candidate_found_is_not_artwork_acceptable',
    results
  };
}
