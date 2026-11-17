import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,generateKeyPairSync,sign} from 'node:crypto';
import {createReviewTask,createReviewSubmission} from '../vision/dataset/review-task.mjs';
import {fingerprintRgba} from '../vision/dataset/visual-fingerprint.mjs';
import {verifyLockedPilot} from '../vision/dataset/locked-pilot-gate.mjs';
import {decodeTrustedPngBytes} from '../vision/dataset/strict-png-decoder.mjs';
import {makeSyntheticPng,syntheticT,syntheticO} from './helpers/synthetic-png.mjs';
import {deriveBlindControlRegions} from '../vision/dataset/blind-sampling-plan.mjs';

const hash=b=>createHash('sha256').update(b).digest('hex');
const h=n=>n.toString(16).padStart(64,'0');
const json=o=>Buffer.from(JSON.stringify(o,null,2)+'\n');
function fp(pattern){
  const n=192,data=new Uint8ClampedArray(n*n*4);
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){
    const on=pattern(x/n,y/n);
    const k=4*(y*n+x);
    data[k]=data[k+1]=data[k+2]=on?0:255;
    data[k+3]=255;
  }
  return fingerprintRgba({data,width:n,height:n});
}
const tPng=makeSyntheticPng(192,192,syntheticT);
const oPng=makeSyntheticPng(192,192,syntheticO);
const fromPng=bytes=>{
  const decoded=decodeTrustedPngBytes(bytes);
  assert.equal(decoded.status,'DECODED_STRICT_PNG_ONLY');
  return fingerprintRgba(decoded);
};
const T=fromPng(tPng),O=fromPng(oPng);
assert.equal(T.status,'ADVISORY_SIGNATURE_ONLY');
assert.equal(O.status,'ADVISORY_SIGNATURE_ONLY');
async function fixture(){
  const imageBytes=tPng;
  const artworkBytes=Buffer.from('synthetic original artwork bytes');
  const sourceEvidenceBytes=Buffer.from('synthetic official Gifts order evidence');
  const calibrationEvidenceBytes=Buffer.from('synthetic official mm calibration evidence');
  const controlOptions={
    source_image_sha256:hash(imageBytes),seed_hex:h(773),
    grid_rows:4,grid_columns:4,control_count:1
  };
  const controls=deriveBlindControlRegions(controlOptions);
  assert.equal(controls.status,'DETERMINISTIC_CONTROLS_ONLY');
  const task=await createReviewTask({
    image_sha256:hash(imageBytes),width_px:200,height_px:200,
    artwork_sha256:hash(artworkBytes),family_sha256:h(12),
    technology_code:'UV1',
    annotations:[
      {type:'positive_thin',x:.1,y:.1,w:.2,h:.2},
      {type:'other',...controls.regions[0].rect}
    ]
  });
  const samplingPlan={
    schema:'printcheck.vision.blind-sampling-plan.v1',
    source_image_sha256:hash(imageBytes),
    artwork_sha256:hash(artworkBytes),
    family_sha256:task.context.family_sha256,
    technology_code:'UV1',
    seed_hex:controlOptions.seed_hex,
    grid_rows:controlOptions.grid_rows,
    grid_columns:controlOptions.grid_columns,
    control_count:controlOptions.control_count,
    candidate_region_sha256:[task.regions[0].region_sha256]
  };
  const samplingEvidenceBytes=json(samplingPlan);
  const taskBytes=json(task),taskSha=hash(taskBytes);
  const labels=Object.fromEntries(task.regions.map((x,i)=>
    [x.region_sha256,i?'acceptable':'defect']));
  const A=json(createReviewSubmission({
    task,task_sha256:taskSha,reviewer_ref_sha256:h(20),labels
  }));
  const B=json(createReviewSubmission({
    task,task_sha256:taskSha,reviewer_ref_sha256:h(21),labels
  }));
  const comparison=json({
    schema:'printcheck.vision.region-method-comparison.v1',
    status:'RESEARCH_PREDICTIONS_ONLY',
    production_approved:false,physical_scale_independently_proven:false,
    region_count:2,
    results:['parallel','normal'].map((id,i)=>({
      algorithm_id:id,revision:'synthetic.v1',
      predictions:task.regions.map((r,j)=>({
        region_sha256:r.region_sha256,
        state:i===0&&j===0?'candidate':'none'
      }))
    }))
  });
  const att={
    schema:'printcheck.vision.pilot-attestation.v1',
    task_sha256:taskSha,image_sha256:hash(imageBytes),
    artwork_sha256:hash(artworkBytes),
    family_sha256:task.context.family_sha256,technology_code:'UV1',
    split:'test',review_a_sha256:hash(A),review_b_sha256:hash(B),
    comparison_sha256:hash(comparison),
    source_evidence_sha256:hash(sourceEvidenceBytes),
    calibration_evidence_sha256:hash(calibrationEvidenceBytes),
    sampling_evidence_sha256:hash(samplingEvidenceBytes),
    reviewer_identities_verified:true,source_identity_verified:true,
    scale_evidence_checked:true,sampling_plan_checked:true,
    adjudicator_ref_sha256:h(22),
    regions:task.regions.map((r,i)=>({
      region_sha256:r.region_sha256,
      decision:i?'acceptable':'defect',
      adjudicated:false,evidence_sha256:h(30+i)
    }))
  };
  const auditor=generateKeyPairSync('ed25519');
  const attestationBytes=json(att);
  const pilotInput={
    taskBytes,imageBytes,artworkBytes,
    sourceEvidenceBytes,calibrationEvidenceBytes,samplingEvidenceBytes,
    reviewABytes:A,reviewBBytes:B,comparisonBytes:comparison,
    attestationBytes,
    signatureBytes:sign(null,attestationBytes,auditor.privateKey),
    trustedPublicKeyPem:auditor.publicKey.export({format:'pem',type:'spki'}),
    trustedSpkiSha256:hash(auditor.publicKey.export({format:'der',type:'spki'}))
  };
  const cohort={
    schema:'printcheck.vision.cohort.v1',
    predictions_hidden:true,frozen_for_holdout:true,
    sampling_plan_sha256:hash(samplingEvidenceBytes),
    entries:[
      {image_sha256:h(123),artwork_sha256:h(124),family_sha256:h(125),
       split:'train',technology_code:'UV1',source_type:'svg',fingerprint:O},
      {image_sha256:hash(imageBytes),artwork_sha256:hash(artworkBytes),
       family_sha256:task.context.family_sha256,split:'test',
       technology_code:'UV1',source_type:'svg',fingerprint:T}
    ]
  };
  const signer=generateKeyPairSync('ed25519');
  const pack=(overrideCohort=cohort)=>{
    const cohortManifestBytes=json(overrideCohort);
    return {
      cohortManifestBytes,
      cohortSignatureBytes:sign(null,cohortManifestBytes,signer.privateKey),
      cohortPublicKeyPem:signer.publicKey.export({type:'spki',format:'pem'}),
      cohortSpkiSha256:hash(signer.publicKey.export({type:'spki',format:'der'})),
      cohortImageBytes:[oPng,tPng],
      pilotInput
    };
  };
  return {task,att,pilotInput,cohort,pack};
}
test('separately signed and perceptually screened holdout matches attested pilot',async()=>{
  const {pack}=await fixture(),r=verifyLockedPilot(pack());
  assert.equal(r.status,'SIGNED_HOLDOUT_SCREENED_FOR_RESEARCH_ONLY',r.reason);
  assert.equal(r.evaluation_allowed,true);
  assert.equal(r.method_count,2);
  assert.deepEqual(r.evaluated_regions,[2,2]);
  assert.equal(r.independently_derived_control_count,1);
  assert.equal(r.pre_registered_candidate_count,1);
  assert.equal(r.control_fraction,0.5);
  assert.equal(r.control_seed_timing_proven,false);
  assert.equal(r.production_approved,false);
  assert.equal(r.lock_signed_before_tuning_independently_proven,false);
  assert.equal(r.fingerprint_source_images_redecoded,2);
  assert.equal(r.preview_sha256_cryptographically_bound,true);
});
test('known near duplicate across train/test blocks even when different SHA/family',async()=>{
  const {cohort,pack}=await fixture();
  cohort.entries[0].fingerprint=T;
  const r=verifyLockedPilot(pack(cohort));
  assert.equal(r.status,'MANUAL');
  assert.equal(r.reason,'SIGNED_COHORT_NOT_CLEAN_OR_NOT_VERIFIED');
});
test('source hashes reused across train/test block holdout even with distinct appearance',async()=>{
  const {cohort,pack}=await fixture();
  cohort.entries[0].artwork_sha256=cohort.entries[1].artwork_sha256;
  assert.equal(verifyLockedPilot(pack(cohort)).status,'MANUAL');
});
test('a signed pilot alone is insufficient without matching signed sampling evidence',async()=>{
  const {cohort,pack}=await fixture();
  cohort.sampling_plan_sha256=h(99);
  assert.equal(verifyLockedPilot(pack(cohort)).reason,
    'COHORT_SAMPLING_PLAN_NOT_PILOT_PLAN');
});
test('training rows cannot be passed off as locked test holdout',async()=>{
  const {cohort,pack}=await fixture();
  cohort.entries[0].split='test';
  cohort.entries[1].split='train';
  const r=verifyLockedPilot(pack(cohort));
  assert.equal(r.status,'MANUAL');
});
test('unsigned, substituted or forged pilot input cannot pass holdout gate',async()=>{
  const {pack}=await fixture();
  const bundle=pack();
  bundle.pilotInput.signatureBytes=Buffer.alloc(64);
  assert.equal(verifyLockedPilot(bundle).reason,'SIGNED_PILOT_REQUIRED');
});
test('changing the frozen cohort signature or its independent pin is fatal',async()=>{
  const {pack}=await fixture();
  const a=pack();
  assert.equal(verifyLockedPilot({
    ...a,cohortSignatureBytes:Buffer.alloc(64)
  }).status,'MANUAL');
  assert.equal(verifyLockedPilot({
    ...a,cohortSpkiSha256:h(88)
  }).status,'MANUAL');
});

test('a signed cohort with forged visual fingerprints is refused even when signatures are valid',async()=>{
  const {cohort,pack}=await fixture();
  // Rewrite train fingerprint into a different valid signature. The test
  // signer signs the attacker's rewritten cohort to expose the trust gap.
  cohort.entries[0].fingerprint=T;
  const result=verifyLockedPilot(pack(cohort));
  assert.equal(result.status,'MANUAL');
  assert.equal(result.evaluation_allowed,false);
});
test('a missing or byte-substituted original PNG is refused despite valid signed cohort',async()=>{
  const {pack}=await fixture(),packageData=pack();
  const missing=verifyLockedPilot({...packageData,cohortImageBytes:undefined});
  assert.equal(missing.reason,'SIGNED_COHORT_IMAGE_FINGERPRINTS_UNVERIFIED');
  const replaced=verifyLockedPilot({
    ...packageData,cohortImageBytes:[tPng,tPng]
  });
  assert.equal(replaced.reason,'SIGNED_COHORT_IMAGE_FINGERPRINTS_UNVERIFIED');
});
