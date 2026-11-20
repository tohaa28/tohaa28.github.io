/**
 * C3B.3.F offline helper: create an UNSIGNED, INCOMPLETE pilot manifest.
 * Never auto-asserts reviewer identity, source authenticity, physical scale
 * or sampling validity. Never auto-resolves expert conflicts.
 *
 * The output is deliberately unusable by pilot-attestation.mjs until an
 * authorized independent auditor checks evidence and signs the raw bytes.
 */
import {createHash} from 'node:crypto';
import {readFile,open,stat} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {validateReviewTask,compareIndependentReviews}
  from './review-task.mjs';

const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const HASH=/^[a-f0-9]{64}$/i;
const parse=b=>JSON.parse(Buffer.from(b).toString('utf8'));
const must=(condition,code)=>{if(!condition)throw new Error(code)};
const MAX=64*1024*1024;
function assertBytes(b){
  must((Buffer.isBuffer(b)||b instanceof Uint8Array)&&
    b.length>0&&b.length<=MAX,'SOURCE_BYTES_INVALID');
}
export function prepareUnsignedPilot(input={}){
  const {
    taskBytes,imageBytes,artworkBytes,
    sourceEvidenceBytes,calibrationEvidenceBytes,samplingEvidenceBytes,
    reviewABytes,reviewBBytes,comparisonBytes,split='test'
  }=input;
  for(const bytes of [taskBytes,imageBytes,artworkBytes,sourceEvidenceBytes,
    calibrationEvidenceBytes,samplingEvidenceBytes,
    reviewABytes,reviewBBytes,comparisonBytes])assertBytes(bytes);
  must(['train','validation','test'].includes(split),'SPLIT_UNSUPPORTED');
  const task=parse(taskBytes),v=validateReviewTask(task);
  must(v.status==='TASK_VALID'&&v.context_complete,'TASK_NOT_REVIEWABLE');
  must(sha(imageBytes)===task.source.image_sha256.toLowerCase()&&
       sha(artworkBytes)===task.context.artwork_sha256.toLowerCase(),
       'SOURCE_BYTES_DIGEST_MISMATCH');
  for(const region of task.regions){
    const expected=sha(Buffer.from(JSON.stringify([
      task.source.image_sha256.toLowerCase(),region.rect
    ])));
    must(expected===region.region_sha256.toLowerCase(),
         'ROI_FINGERPRINT_INVALID');
  }
  const consensus=compareIndependentReviews(task,sha(taskBytes),
    parse(reviewABytes),parse(reviewBBytes));
  must(consensus.status==='PROVISIONAL_CONSENSUS_ONLY',
       'INDEPENDENT_REVIEWS_INVALID');
  const comparison=parse(comparisonBytes);
  must(comparison.status==='RESEARCH_PREDICTIONS_ONLY'&&
       comparison.schema==='printcheck.vision.region-method-comparison.v1'&&
       comparison.production_approved===false&&
       comparison.region_count===task.regions.length,
       'COMPARISON_CONTRACT_INVALID');
  const regionSet=new Set(task.regions.map(x=>x.region_sha256));
  must(Array.isArray(comparison.results)&&comparison.results.length>=2&&
       comparison.results.every(m=>Array.isArray(m.predictions)&&
       m.predictions.length===task.regions.length&&
       new Set(m.predictions.map(p=>p.region_sha256)).size===regionSet.size&&
       m.predictions.every(p=>regionSet.has(p.region_sha256))),
       'COMPARISON_REGIONS_MISMATCH');
  const manifest={
    schema:'printcheck.vision.pilot-attestation.v1',
    task_sha256:sha(taskBytes),image_sha256:sha(imageBytes),
    artwork_sha256:sha(artworkBytes),
    family_sha256:task.context.family_sha256,
    technology_code:task.context.technology_code,
    split,
    review_a_sha256:sha(reviewABytes),review_b_sha256:sha(reviewBBytes),
    comparison_sha256:sha(comparisonBytes),
    source_evidence_sha256:sha(sourceEvidenceBytes),
    calibration_evidence_sha256:sha(calibrationEvidenceBytes),
    sampling_evidence_sha256:sha(samplingEvidenceBytes),
    reviewer_identities_verified:false,
    source_identity_verified:false,
    scale_evidence_checked:false,
    sampling_plan_checked:false,
    adjudicator_ref_sha256:null,
    regions:consensus.regions.map((r)=>({
      region_sha256:r.region_sha256,
      decision:r.review_agreement?r.decision:'manual',
      adjudicated:false,
      evidence_sha256:null
    }))
  };
  return {
    status:'UNSIGNED_AUDIT_DRAFT_ONLY',
    manifest,
    summary:{
      total_regions:manifest.regions.length,
      conflicts_needing_adjudication:consensus.adjudication_count,
      attestations_missing:4,
      production_quality_verdict:'NOT_PRODUCTION_APPROVED'
    }
  };
}
const direct=process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url;
if(direct){
  try{
    const args=process.argv.slice(2);
    if(args.length!==10)throw new Error('ARGS_INVALID');
    const [taskPath,imagePath,artworkPath,sourcePath,scalePath,samplingPath,
      reviewAPath,reviewBPath,comparisonPath,outPath]=args;
    const paths=[taskPath,imagePath,artworkPath,sourcePath,scalePath,
      samplingPath,reviewAPath,reviewBPath,comparisonPath];
    const bytes=await Promise.all(paths.map(async p=>{
      const s=await stat(p);
      if(!s.isFile()||s.size===0||s.size>MAX)
        throw new Error('INPUT_INVALID');
      return readFile(p);
    }));
    const draft=prepareUnsignedPilot({
      taskBytes:bytes[0],imageBytes:bytes[1],artworkBytes:bytes[2],
      sourceEvidenceBytes:bytes[3],calibrationEvidenceBytes:bytes[4],
      samplingEvidenceBytes:bytes[5],
      reviewABytes:bytes[6],reviewBBytes:bytes[7],
      comparisonBytes:bytes[8]
    });
    const file=await open(outPath,'wx',0o600);
    try{await file.writeFile(JSON.stringify(draft.manifest,null,2)+'\n')}
    finally{await file.close()}
    process.stdout.write(JSON.stringify(draft.summary)+'\n');
  }catch{
    process.stderr.write('PILOT_DRAFT_REFUSED: verify local sources and task/review integrity\n');
    process.exitCode=2;
  }
}
