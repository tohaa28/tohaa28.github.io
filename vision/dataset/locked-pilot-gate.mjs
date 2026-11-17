/**
 * C3B.3.G -- bind an already verified C3B.3.F pilot to a separately signed,
 * visually screened, frozen cohort manifest BEFORE research accuracy review.
 *
 * The holdout signature is independent of the pilot auditor's attestation.
 * Both signed packages refer to the same original image/artwork/family and
 * exactly the same sampling plan bytes. No test metric is calculated here.
 */
import {createHash} from 'node:crypto';
import {verifyFrozenHoldout} from './cohort-leakage-audit.mjs';
import {buildAttestedPilot} from './pilot-attestation.mjs';
import {verifyBlindSamplingPlan} from './blind-sampling-plan.mjs';
import {verifyCohortImageBindings} from './cohort-image-provenance.mjs';

const sha=b=>createHash('sha256').update(b).digest('hex');
const refuse=reason=>({
  schema:'printcheck.vision.locked-pilot-gate.v1',
  status:'MANUAL',reason,production_approved:false,
  evaluation_allowed:false
});
export function verifyLockedPilot({
  cohortManifestBytes,cohortSignatureBytes,
  cohortPublicKeyPem,cohortSpkiSha256,
  cohortImageBytes,
  pilotInput
}={}){
  const lock=verifyFrozenHoldout({
    manifestBytes:cohortManifestBytes,
    signatureBytes:cohortSignatureBytes,
    trustedPublicKeyPem:cohortPublicKeyPem,
    trustedSpkiSha256:cohortSpkiSha256
  });
  if(lock.status!=='SCREENED_COHORT_ONLY')
    return refuse('SIGNED_COHORT_NOT_CLEAN_OR_NOT_VERIFIED');
  // Fail closed: signed self-reported fingerprints are not evidence that
  // the local preview bytes really generated those features.
  const imageBinding=verifyCohortImageBindings({
    cohortManifestBytes,imageBytesList:cohortImageBytes
  });
  if(imageBinding.status!=='ALL_PREVIEW_FINGERPRINTS_RECONSTRUCTED')
    return refuse('SIGNED_COHORT_IMAGE_FINGERPRINTS_UNVERIFIED');
  let pilot;
  try{pilot=buildAttestedPilot(pilotInput)}
  catch{return refuse('SIGNED_PILOT_REQUIRED')}
  const taskBytes=pilotInput.taskBytes;
  const samplingEvidenceBytes=pilotInput.samplingEvidenceBytes;
  let task,cohort;
  try{
    task=JSON.parse(Buffer.from(taskBytes).toString('utf8'));
    cohort=JSON.parse(Buffer.from(cohortManifestBytes).toString('utf8'));
  }catch{return refuse('PILOT_OR_COHORT_INVALID_JSON')}
  if(sha(samplingEvidenceBytes)!==
      cohort.sampling_plan_sha256.toLowerCase())
    return refuse('COHORT_SAMPLING_PLAN_NOT_PILOT_PLAN');
  const controls=verifyBlindSamplingPlan({
    task,planBytes:samplingEvidenceBytes,
    expectedPlanSha256:cohort.sampling_plan_sha256
  });
  if(controls.status!=='PRE_REGISTERED_CONTROLS_VERIFIED')
    return refuse('BLIND_CONTROL_COVERAGE_NOT_VERIFIED');
  if(task?.schema!=='printcheck.vision.review-task.v1'||
     !task?.source||!task?.context)
    return refuse('PILOT_TASK_INVALID');
  const matching=cohort.entries.filter(e=>
    e.image_sha256.toLowerCase()===task.source.image_sha256.toLowerCase()&&
    e.artwork_sha256.toLowerCase()===task.context.artwork_sha256?.toLowerCase()&&
    e.family_sha256.toLowerCase()===task.context.family_sha256?.toLowerCase()&&
    e.technology_code===task.context.technology_code);
  if(matching.length!==1)
    return refuse('PILOT_NOT_UNIQUELY_PRE_REGISTERED');
  const selected=matching[0];
  if(selected.split!=='test')
    return refuse('PILOT_IS_NOT_LOCKED_TEST_HOLDOUT');
  if(pilot?.summary?.status!=='ATTESTED_RESEARCH_LABELS_ONLY'||
     pilot?.summary?.production_quality_verdict!=='NOT_PRODUCTION_APPROVED'||
     !Array.isArray(pilot.evaluations)||pilot.evaluations.length<2)
    return refuse('SIGNED_PILOT_REQUIRED');
  const regionIDs=new Set(task.regions?.map(r=>r.region_sha256.toLowerCase())??[]);
  if(regionIDs.size===0)
    return refuse('PILOT_REGIONS_INVALID');
  for(const result of pilot.evaluations){
    const document=result?.document,rows=document?.regions;
    if(document?.schema!=='printcheck.vision.expert-regions.v1'||
       !Array.isArray(rows))return refuse('PILOT_RESEARCH_DOCUMENT_INVALID');
    const seen=new Set();
    for(const row of rows){
      if(row.split!=='test'||row.artwork_sha256.toLowerCase()!==
         selected.artwork_sha256.toLowerCase()||
         row.family_sha256.toLowerCase()!==
         selected.family_sha256.toLowerCase()||
         row.technology_code!==selected.technology_code||
         !regionIDs.has(row.region_sha256.toLowerCase())||
         seen.has(row.region_sha256.toLowerCase()))
        return refuse('PILOT_RESEARCH_ROWS_MISMATCH_COHORT');
      seen.add(row.region_sha256.toLowerCase());
    }
  }
  return {
    schema:'printcheck.vision.locked-pilot-gate.v1',
    status:'SIGNED_HOLDOUT_SCREENED_FOR_RESEARCH_ONLY',
    production_approved:false,
    evaluation_allowed:true,
    source_original_cryptographically_proven:false,
    lock_signed_before_tuning_independently_proven:false,
    no_undetected_near_duplicates_guaranteed:false,
    signing_key_pinned:true,
    method_count:pilot.evaluations.length,
    evaluated_regions:pilot.evaluations.map(x=>x.document.regions.length),
    locked_cohort_count:cohort.entries.length,
    fingerprint_source_images_redecoded:imageBinding.verified_image_count,
    preview_sha256_cryptographically_bound:true,
    independently_derived_control_count:controls.independently_derived_control_count,
    pre_registered_candidate_count:controls.candidate_roi_count,
    control_fraction:controls.control_fraction,
    control_seed_timing_proven:false,
    warning:'Independent expert provenance and sampling timing require external audit.'
  };
}
