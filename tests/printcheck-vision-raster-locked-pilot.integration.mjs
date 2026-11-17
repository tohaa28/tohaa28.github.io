/**
 * C3B.3.K end-to-end security integration with three independent Ed25519
 * signers: expert adjudication, frozen cohort and renderer evidence.
 * A live Rust resvg replay, not a caller-supplied boolean, must lift the
 * research metric gate. All source images and labels synthetic.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,generateKeyPairSync,sign} from 'node:crypto';
import {createReviewTask,createReviewSubmission}
  from '../vision/dataset/review-task.mjs';
import {deriveBlindControlRegions}
  from '../vision/dataset/blind-sampling-plan.mjs';
import {fingerprintRgba} from '../vision/dataset/visual-fingerprint.mjs';
import {decodeTrustedPngBytes} from '../vision/dataset/strict-png-decoder.mjs';
import {verifyLockedPilot,verifyLockedPilotWithReplay}
  from '../vision/dataset/locked-pilot-gate.mjs';
import {makeSyntheticPng} from './helpers/synthetic-png.mjs';

const sha=b=>createHash('sha256').update(b).digest('hex');
const h=n=>n.toString(16).padStart(64,'0');
const json=o=>Buffer.from(JSON.stringify(o,null,2)+'\n');
const png=makeSyntheticPng(144,72,(_x,_y,px,py)=>
  (px>=48&&px<96&&py>=10&&py<18)||
  (px>=68&&px<76&&py>=18&&py<60)
);
const trainPng=makeSyntheticPng(144,72,(_x,_y,px,py)=>{
  const d=Math.hypot((px-72)/144,(py-36)/72);
  return d>.25&&d<.35;
});
const svg=Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="144mm" height="72mm" viewBox="0 0 144 72">'+
  '<path d="M48 10L96 10L96 18L48 18Z" fill="#000000"/>'+
  '<path d="M68 18L76 18L76 60L68 60Z" fill="#000000"/></svg>'
);
const order=Buffer.from('synthetic order print field evidence');
const calibration=Buffer.from('synthetic external scale evidence');
const fingerprint=bytes=>{
  const decoded=decodeTrustedPngBytes(bytes);
  assert.equal(decoded.status,'DECODED_STRICT_PNG_ONLY');
  const f=fingerprintRgba(decoded);
  assert.equal(f.status,'ADVISORY_SIGNATURE_ONLY',f.reason);
  return f;
};
function key(){
  const p=generateKeyPairSync('ed25519');
  return {
    sign:bytes=>sign(null,bytes,p.privateKey),
    pem:p.publicKey.export({format:'pem',type:'spki'}),
    pin:sha(p.publicKey.export({format:'der',type:'spki'}))
  };
}
async function fixture(){
  const selected=deriveBlindControlRegions({
    source_image_sha256:sha(png),seed_hex:h(11),
    grid_rows:4,grid_columns:4,control_count:1
  });
  const task=await createReviewTask({
    image_sha256:sha(png),artwork_sha256:sha(svg),
    family_sha256:h(12),technology_code:'UV1',
    width_px:144,height_px:72,
    annotations:[
      {type:'positive_thin',x:.15,y:.15,w:.2,h:.2},
      {type:'other',...selected.regions[0].rect}
    ]
  });
  const taskBytes=json(task),id=sha(taskBytes);
  const plan={
    schema:'printcheck.vision.blind-sampling-plan.v1',
    source_image_sha256:sha(png),artwork_sha256:sha(svg),
    family_sha256:task.context.family_sha256,technology_code:'UV1',
    seed_hex:h(11),grid_rows:4,grid_columns:4,control_count:1,
    candidate_region_sha256:[task.regions[0].region_sha256]
  };
  const planBytes=json(plan);
  const labels=Object.fromEntries(task.regions.map((r,i)=>
    [r.region_sha256,i?'acceptable':'defect']));
  const response=(index)=>json(createReviewSubmission({
    task,task_sha256:id,reviewer_ref_sha256:h(index),labels
  }));
  const reviewABytes=response(21),reviewBBytes=response(22);
  const comparisonBytes=json({
    schema:'printcheck.vision.region-method-comparison.v1',
    status:'RESEARCH_PREDICTIONS_ONLY',production_approved:false,
    physical_scale_independently_proven:false,region_count:2,
    results:['parallel','normal'].map((algorithm_id,i)=>({
      algorithm_id,revision:'test-only-raster.v1',
      predictions:task.regions.map((r,j)=>({
        region_sha256:r.region_sha256,
        state:i===0&&j===0?'candidate':'none'
      }))
    }))
  });
  const first=key();
  const adjudication={
    schema:'printcheck.vision.pilot-attestation.v1',
    task_sha256:id,image_sha256:sha(png),artwork_sha256:sha(svg),
    family_sha256:task.context.family_sha256,
    technology_code:'UV1',split:'test',
    review_a_sha256:sha(reviewABytes),
    review_b_sha256:sha(reviewBBytes),
    comparison_sha256:sha(comparisonBytes),
    source_evidence_sha256:sha(order),
    calibration_evidence_sha256:sha(calibration),
    sampling_evidence_sha256:sha(planBytes),
    reviewer_identities_verified:true,
    source_identity_verified:true,
    scale_evidence_checked:true,sampling_plan_checked:true,
    adjudicator_ref_sha256:h(22+1),
    regions:task.regions.map((r,i)=>({
      region_sha256:r.region_sha256,decision:i?'acceptable':'defect',
      adjudicated:false,evidence_sha256:h(40+i)
    }))
  };
  const attestationBytes=json(adjudication);
  const pilotInput={
    taskBytes,imageBytes:png,artworkBytes:svg,
    sourceEvidenceBytes:order,calibrationEvidenceBytes:calibration,
    samplingEvidenceBytes:planBytes,
    reviewABytes,reviewBBytes,comparisonBytes,
    attestationBytes,signatureBytes:first.sign(attestationBytes),
    trustedPublicKeyPem:first.pem,trustedSpkiSha256:first.pin
  };
  const cohort={
    schema:'printcheck.vision.cohort.v1',
    predictions_hidden:true,frozen_for_holdout:true,
    sampling_plan_sha256:sha(planBytes),
    entries:[
      {image_sha256:sha(trainPng),artwork_sha256:h(124),
       family_sha256:h(125),split:'train',technology_code:'UV1',
       source_type:'svg',fingerprint:fingerprint(trainPng)},
      {image_sha256:sha(png),artwork_sha256:sha(svg),
       family_sha256:task.context.family_sha256,split:'test',
       technology_code:'UV1',source_type:'svg',
       fingerprint:fingerprint(png)}
    ]
  };
  const second=key(),cohortManifestBytes=json(cohort);
  const coords=[[0,0],[144,0],[0,72],[144,72],[72,36]];
  const third=key(),receipt={
    schema:'printcheck.vision.render-calibration.v1',
    source_sha256:sha(svg),preview_sha256:sha(png),
    order_evidence_sha256:sha(order),
    source_format:'svg',page_index:0,
    render_engine:{
      engine_id:'test-only-original-renderer',
      engine_version:'v0.0.1',
      engine_binary_sha256:sha(Buffer.from('synthetic source renderer'))
    },
    preview_pixel_dimensions:[144,72],source_page_box:[0,0,144,72],
    pdf_user_unit:null,page_rotation_degrees:0,
    source_document_size_mm:[144,72],field_size_mm:[144,72],
    source_to_preview_px:[1,0,0,1,0,0],
    source_to_field_mm:[1,0,0,1,0,0],
    mirror_authorized:false,
    color_pipeline:{
      source_color_state:'explicit_srgb',output_encoding:'unprofiled_rgb8',
      conversion_profile_sha256:sha(Buffer.from('synthetic rgb policy'))
    },
    anchors:coords.map(source_xy=>({
      source_xy,preview_xy:source_xy.slice(),
      field_mm_xy:source_xy.slice()
    }))
  };
  const receiptBytes=json(receipt);
  return {
    cohortManifestBytes,cohortSignatureBytes:second.sign(cohortManifestBytes),
    cohortPublicKeyPem:second.pem,cohortSpkiSha256:second.pin,
    cohortImageBytes:[trainPng,png],
    pilotInput,
    renderCalibrationInput:{
      sourceBytes:svg,previewPngBytes:png,orderEvidenceBytes:order,
      receiptBytes,signatureBytes:third.sign(receiptBytes),
      trustedPublicKeyPem:third.pem,trustedSpkiSha256:third.pin
    }
  };
}
test('receipt-only legacy path no longer permits research evaluation',async()=>{
  const input=await fixture();
  const r=verifyLockedPilot(input);
  assert.equal(r.status,'SIGNED_HOLDOUT_SCREENED_PENDING_RASTER_REPLAY',r.reason);
  assert.equal(r.evaluation_allowed,false);
  assert.equal(r.independent_pixel_rerender_required,true);
});
test('all three signatures, blind holdout and real resvg pixels grant RESEARCH ONLY',async()=>{
  const input=await fixture();
  const r=await verifyLockedPilotWithReplay(input);
  assert.equal(r.status,'REPLAY_VERIFIED_RESEARCH_HOLDOUT_ONLY',r.reason);
  assert.equal(r.evaluation_allowed,true);
  assert.equal(r.independent_exact_rgba_replay_proven,true);
  assert.equal(r.production_approved,false);
  assert.equal(r.icc_color_proven,false);
  assert.equal(r.spot_color_separations_proven,false);
  assert.equal(r.independent_pixel_rerender_required,false);
});
test('forged in-memory success flag cannot bypass physical source-byte replay',async()=>{
  const input=await fixture();
  input.replayResult={status:'EXACT_INDEPENDENT_RGBA_REPLAY_RESEARCH_ONLY'};
  input.renderCalibrationInput.signatureBytes=Buffer.alloc(64);
  const r=await verifyLockedPilotWithReplay(input);
  assert.equal(r.status,'MANUAL');
  assert.equal(r.evaluation_allowed,false);
});
