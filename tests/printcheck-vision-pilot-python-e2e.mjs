/**
 * C3B.3.F integration: signed researcher-only ROI labels through Node
 * Ed25519 verifier into real Python evaluator. All inputs synthetic.
 * Tests exact independent keys, no private customer data, no Internet.
 */
import {createHash,generateKeyPairSync,sign} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {mkdtemp,readFile,rm,stat,chmod} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import assert from 'node:assert/strict';
import {createReviewTask,createReviewSubmission}
  from '../vision/dataset/review-task.mjs';
import {prepareUnsignedPilot} from '../vision/dataset/prepare-pilot-signoff.mjs';
import {buildAttestedPilot,exportPilotEvaluations}
  from '../vision/dataset/pilot-attestation.mjs';

const h=b=>createHash('sha256').update(b).digest('hex');
const buf=o=>Buffer.from(JSON.stringify(o,null,2)+'\n');
const fake=n=>n.toString(16).padStart(64,'0');
const raster=Buffer.from('test-only preview binary data');
const original=Buffer.from('test-only actual SVG bytes');
const sourceEvidence=Buffer.from('test-only official order snapshot');
const calibrationEvidence=Buffer.from('test-only scale auditor report');
const samplingEvidence=Buffer.from('test-only cohort selection manifest');
const annotations=Array.from({length:6},(_,i)=>({
  type:'other',x:0.04+i*0.15,y:0.2,w:0.1,h:0.1
}));
const task=await createReviewTask({
  image_sha256:h(raster),width_px:1200,height_px:800,
  artwork_sha256:h(original),family_sha256:fake(333),
  technology_code:'UV1',annotations
});
const taskBytes=buf(task),digest=h(taskBytes);
const reviewer=(num,labels)=>buf(createReviewSubmission({
  task,task_sha256:digest,reviewer_ref_sha256:fake(num),
  labels:Object.fromEntries(task.regions.map((r,i)=>[r.region_sha256,labels[i]]))
}));
const reviews=[
  reviewer(21,['defect','acceptable','defect','acceptable','defect','acceptable']),
  reviewer(22,['defect','acceptable','acceptable','acceptable','defect','acceptable'])
];
const comparison={
  schema:'printcheck.vision.region-method-comparison.v1',
  status:'RESEARCH_PREDICTIONS_ONLY',production_approved:false,
  physical_scale_independently_proven:false,region_count:6,
  results:['parallel','normal'].map((id,algorithm)=>({
    algorithm_id:id,revision:'c3b3f.synthetic.v1',
    predictions:task.regions.map((r,i)=>({
      region_sha256:r.region_sha256,
      state:algorithm===0?
        ['candidate','none','none','candidate','candidate','manual'][i]:
        ['candidate','none','candidate','none','none','manual'][i]
    }))
  }))
};
const input={
  taskBytes,imageBytes:raster,artworkBytes:original,
  sourceEvidenceBytes:sourceEvidence,calibrationEvidenceBytes:calibrationEvidence,
  samplingEvidenceBytes:samplingEvidence,
  reviewABytes:reviews[0],reviewBBytes:reviews[1],
  comparisonBytes:buf(comparison)
};
const {manifest}=prepareUnsignedPilot(input);
assert.equal(manifest.reviewer_identities_verified,false);
manifest.reviewer_identities_verified=true;
manifest.source_identity_verified=true;
manifest.scale_evidence_checked=true;
manifest.sampling_plan_checked=true;
manifest.adjudicator_ref_sha256=fake(23);
for(const r of manifest.regions){
  if(r.decision==='manual'){r.adjudicated=true;r.decision='defect'}
  r.evidence_sha256=h(Buffer.from('synthetic adjudication evidence '+r.region_sha256));
}
const {privateKey,publicKey}=generateKeyPairSync('ed25519');
const attestationBytes=buf(manifest);
const result=buildAttestedPilot({
  ...input,attestationBytes,
  signatureBytes:sign(null,attestationBytes,privateKey),
  trustedPublicKeyPem:publicKey.export({type:'spki',format:'pem'}),
  trustedSpkiSha256:h(publicKey.export({type:'spki',format:'der'}))
});
assert.equal(result.summary.status,'ATTESTED_RESEARCH_LABELS_ONLY');
assert.equal(result.summary.included_regions,6);
const dir=await mkdtemp(join(tmpdir(),'pcv-e2e-synthetic-'));
try{
  await chmod(dir,0o700);
  await exportPilotEvaluations(result,dir);
  for(const name of ['parallel','normal']){
    const file=join(dir,'vision-research-'+name+'.json');
    const statResult=await stat(file);
    if(process.platform!=='win32')assert.equal(statResult.mode&0o777,0o600);
    const processResult=spawnSync('python3',[
      'vision/dataset/evaluate.py',file,'--split','test'
    ],{encoding:'utf8',maxBuffer:400000,timeout:10000});
    assert.equal(processResult.status,0,'Synthetic Python evaluation must succeed');
    const report=JSON.parse(processResult.stdout);
    assert.equal(report.schema,'printcheck.vision.eval-summary.v1');
    assert.equal(report.overall.expert_regions,6);
    assert.equal(report.overall.manual_abstentions,1);
    assert.equal(report.overall.resolved_regions,5);
    assert.equal(report.quality_verdict,'NOT_PRODUCTION_APPROVED');
    assert.equal(report.expert_identity_cryptographically_authenticated,false,
      'The generic evaluator must not independently claim signature verification');
    const text=JSON.stringify(report);
    assert.ok(!text.includes(task.context.family_sha256));
    assert.ok(!text.includes(task.context.artwork_sha256));
  }
  console.log('Signed synthetic pilot -> segregated private files -> Python research metrics: PASS');
}finally{
  await rm(dir,{recursive:true,force:true});
}
