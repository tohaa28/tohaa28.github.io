import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,generateKeyPairSync,sign} from 'node:crypto';
import {createReviewTask,createReviewSubmission} from '../vision/dataset/review-task.mjs';
import {buildAttestedPilot} from '../vision/dataset/pilot-attestation.mjs';

const hash=data=>createHash('sha256').update(data).digest('hex');
const syntheticHash=n=>n.toString(16).padStart(64,'0');
const json=obj=>Buffer.from(JSON.stringify(obj,null,2)+'\n');
const expectedErr=(fn,re)=>assert.throws(fn,re);

async function fixture(){
  const imageBytes=Buffer.from('synthetic private raster bytes');
  const artworkBytes=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg>');
  const task=await createReviewTask({
    image_sha256:hash(imageBytes),width_px:100,height_px:100,
    artwork_sha256:hash(artworkBytes),family_sha256:syntheticHash(100),
    technology_code:'UV1',
    annotations:[
      {type:'corner_safe',x:.1,y:.1,w:.14,h:.1},
      {type:'positive_thin',x:.4,y:.1,w:.14,h:.1},
      {type:'negative_gap',x:.7,y:.1,w:.14,h:.1}
    ]
  });
  const taskBytes=json(task);
  const ha=hash(taskBytes);
  const reviewerA=createReviewSubmission({
    task,task_sha256:ha,reviewer_ref_sha256:syntheticHash(11),
    labels:{
      [task.regions[0].region_sha256]:'acceptable',
      [task.regions[1].region_sha256]:'defect',
      [task.regions[2].region_sha256]:'uncertain'
    }
  });
  const reviewerB=createReviewSubmission({
    task,task_sha256:ha,reviewer_ref_sha256:syntheticHash(12),
    labels:{
      [task.regions[0].region_sha256]:'acceptable',
      [task.regions[1].region_sha256]:'acceptable',
      [task.regions[2].region_sha256]:'uncertain'
    }
  });
  const reviewABytes=json(reviewerA),reviewBBytes=json(reviewerB);
  const comparison={
    schema:'printcheck.vision.region-method-comparison.v1',
    status:'RESEARCH_PREDICTIONS_ONLY',
    production_approved:false,
    physical_scale_independently_proven:false,
    region_count:task.regions.length,
    results:[
      {algorithm_id:'parallel',revision:'research-v1',
       predictions:task.regions.map((r,i)=>({
         region_sha256:r.region_sha256,
         state:['none','candidate','manual'][i]
       }))},
      {algorithm_id:'normal',revision:'research-v1',
       predictions:task.regions.map((r,i)=>({
         region_sha256:r.region_sha256,
         state:['candidate','none','manual'][i]
       }))}
    ]
  };
  const comparisonBytes=json(comparison);
  const att={
    schema:'printcheck.vision.pilot-attestation.v1',
    task_sha256:hash(taskBytes),
    image_sha256:hash(imageBytes),
    artwork_sha256:hash(artworkBytes),
    family_sha256:task.context.family_sha256,
    technology_code:task.context.technology_code,
    split:'test',
    review_a_sha256:hash(reviewABytes),
    review_b_sha256:hash(reviewBBytes),
    comparison_sha256:hash(comparisonBytes),
    source_evidence_sha256:syntheticHash(21),
    calibration_evidence_sha256:syntheticHash(22),
    sampling_evidence_sha256:syntheticHash(23),
    reviewer_identities_verified:true,
    source_identity_verified:true,
    scale_evidence_checked:true,
    sampling_plan_checked:true,
    adjudicator_ref_sha256:syntheticHash(24),
    regions:[
      {region_sha256:task.regions[0].region_sha256,
       decision:'acceptable',adjudicated:false,evidence_sha256:syntheticHash(31)},
      {region_sha256:task.regions[1].region_sha256,
       decision:'defect',adjudicated:true,evidence_sha256:syntheticHash(32)},
      {region_sha256:task.regions[2].region_sha256,
       decision:'manual',adjudicated:true,evidence_sha256:syntheticHash(33)}
    ]
  };
  const {privateKey,publicKey}=generateKeyPairSync('ed25519');
  const trustedPublicKeyPem=publicKey.export({type:'spki',format:'pem'});
  const trustedSpkiSha256=hash(publicKey.export({type:'spki',format:'der'}));
  const assemble=(overrides={})=>{
    const at=overrides.att??att,attestationBytes=overrides.attestationBytes??json(at);
    const signatureBytes=overrides.signatureBytes??
      sign(null,attestationBytes,privateKey);
    return {
      taskBytes,imageBytes,artworkBytes,
      reviewABytes,reviewBBytes,comparisonBytes,
      attestationBytes,signatureBytes,
      trustedPublicKeyPem,trustedSpkiSha256,
      ...overrides,att:undefined
    };
  };
  return {task,att,assemble,privateKey,publicKey};
}

test('trusted signed pilot produces per-detector research-only rows with abstentions',async()=>{
  const {task,assemble}=await fixture();
  const result=buildAttestedPilot(assemble());
  assert.equal(result.summary.status,'ATTESTED_RESEARCH_LABELS_ONLY');
  assert.equal(result.summary.production_quality_verdict,'NOT_PRODUCTION_APPROVED');
  assert.equal(result.summary.expert_review_regions,3);
  assert.equal(result.summary.included_regions,2);
  assert.equal(result.summary.abstained_regions,1);
  assert.equal(result.summary.conflict_resolutions,2);
  assert.equal(result.evaluations.length,2);
  for(const e of result.evaluations){
    assert.equal(e.document.schema,'printcheck.vision.expert-regions.v1');
    assert.equal(e.document.regions.length,2);
    assert.equal(e.document.regions[0].expert.label,'acceptable');
    assert.equal(e.document.regions[1].expert.label,'defect');
    assert.equal(e.document.regions[0].expert.state,'verified');
    assert.equal(e.document.regions[0].split,'test');
    assert.equal(e.document.regions[0].region_sha256,task.regions[0].region_sha256);
  }
  assert.notDeepEqual(result.evaluations[0].document.regions.map(r=>r.detection.state),
    result.evaluations[1].document.regions.map(r=>r.detection.state));
  assert.equal(result.evaluations[0].document.regions[0].detection.revision,
    result.evaluations[1].document.regions[0].detection.revision);
  assert.ok(!JSON.stringify(result.summary).includes(task.source.image_sha256));
});

test('signature tamper or substitution is rejected without a key fallback',async()=>{
  const {assemble}=await fixture();
  const input=assemble(),tampered=Buffer.from(input.attestationBytes);
  tampered[tampered.length-3]^=0x01;
  expectedErr(()=>buildAttestedPilot({...input,attestationBytes:tampered}),
    /ADJUDICATION_SIGNATURE_INVALID|ATTESTATION_JSON_INVALID/);
  const badSig=Buffer.alloc(64);
  expectedErr(()=>buildAttestedPilot({...input,signatureBytes:badSig}),
    /ADJUDICATION_SIGNATURE_INVALID/);
  expectedErr(()=>buildAttestedPilot({...input,trustedPublicKeyPem:null}),
    /TRUSTED_PUBLIC_KEY_INVALID/);
});
test('pin mismatch prevents a newly generated attacker Ed25519 key from becoming trusted',async()=>{
  const {assemble}=await fixture(),input=assemble();
  const {privateKey,publicKey}=generateKeyPairSync('ed25519');
  const attackerKey=publicKey.export({type:'spki',format:'pem'});
  const attackerSig=sign(null,input.attestationBytes,privateKey);
  expectedErr(()=>buildAttestedPilot({
    ...input,trustedPublicKeyPem:attackerKey,signatureBytes:attackerSig
  }),/TRUST_PIN_MISMATCH/);
});
test('actual image and original vector bytes must match independently',async()=>{
  const {assemble}=await fixture(),input=assemble();
  expectedErr(()=>buildAttestedPilot({...input,
    imageBytes:Buffer.from('synthetic altered preview')
  }),/ORIGINAL_SOURCE_BYTES_MISMATCH/);
  expectedErr(()=>buildAttestedPilot({...input,
    artworkBytes:Buffer.from('synthetic altered original svg')
  }),/ORIGINAL_SOURCE_BYTES_MISMATCH/);
});
test('signed provenance/scale/sampling/reviewer gates cannot be false',async()=>{
  const {assemble,att}=await fixture();
  for(const key of ['reviewer_identities_verified','source_identity_verified',
                     'scale_evidence_checked','sampling_plan_checked']){
    const modified=structuredClone(att);modified[key]=false;
    expectedErr(()=>buildAttestedPilot(assemble({att:modified})),
      /AUDIT_PROOF_GATE_NOT_ATTESTED/);
  }
});
test('signer must account for every conflicting or uncertain expert region',async()=>{
  const {assemble,att}=await fixture();
  const modified=structuredClone(att);
  modified.regions[1].adjudicated=false;
  expectedErr(()=>buildAttestedPilot(assemble({att:modified})),
    /CONFLICT_NOT_ADJUDICATED/);
  const missing=structuredClone(att);
  missing.regions.pop();
  expectedErr(()=>buildAttestedPilot(assemble({att:missing})),
    /ADJUDICATION_REGIONS_INCOMPLETE/);
  const duplicate=structuredClone(att);
  duplicate.regions[2].region_sha256=duplicate.regions[0].region_sha256;
  expectedErr(()=>buildAttestedPilot(assemble({att:duplicate})),
    /ADJUDICATION_REGION_SET_MISMATCH/);
});
test('cannot change a review consensus without an explicit conflict',async()=>{
  const {assemble,att}=await fixture();
  const modified=structuredClone(att);
  modified.regions[0].decision='defect';
  expectedErr(()=>buildAttestedPilot(assemble({att:modified})),
    /UNJUSTIFIED_CONSENSUS_OVERRIDE/);
  modified.regions[0].decision='acceptable';
  modified.regions[0].adjudicated=true;
  expectedErr(()=>buildAttestedPilot(assemble({att:modified})),
    /UNJUSTIFIED_CONSENSUS_OVERRIDE/);
});
test('manifest must bind same exact task/reviews/comparison bytes and technology',async()=>{
  const {assemble,att}=await fixture();
  for(const key of ['review_a_sha256','review_b_sha256','task_sha256',
                    'comparison_sha256','image_sha256']){
    const modified=structuredClone(att);modified[key]=syntheticHash(777);
    expectedErr(()=>buildAttestedPilot(assemble({att:modified})),
      /ADJUDICATION_INPUT_DIGEST_MISMATCH/);
  }
  const wrongTech=structuredClone(att);wrongTech.technology_code='DTF';
  expectedErr(()=>buildAttestedPilot(assemble({att:wrongTech})),
    /ADJUDICATION_ARTWORK_TECHNOLOGY_MISMATCH/);
});
test('fake ROI geometry fingerprints are rejected even if syntactically valid',async()=>{
  const {assemble}=await fixture(),input=assemble();
  const task=JSON.parse(input.taskBytes.toString());
  task.regions[0].region_sha256=syntheticHash(777);
  expectedErr(()=>buildAttestedPilot({...input,taskBytes:json(task)}),
    /ROI_GEOMETRY_FINGERPRINT_INVALID/);
});
test('research comparison ROI substitution, duplicate or unsupported state is blocked',async()=>{
  const {assemble}=await fixture(),input=assemble();
  for(const variant of ['missing','duplicate','production']){
    const cmp=JSON.parse(input.comparisonBytes.toString());
    if(variant==='missing')cmp.results[0].predictions.pop();
    if(variant==='duplicate')
      cmp.results[0].predictions[1].region_sha256=
        cmp.results[0].predictions[0].region_sha256;
    if(variant==='production')cmp.production_approved=true;
    expectedErr(()=>buildAttestedPilot({
      ...input,comparisonBytes:json(cmp)
    }),/RESEARCH_METHOD_INVALID|RESEARCH_ROI_INVALID|RESEARCH_COMPARISON_INVALID/);
  }
});
