import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,generateKeyPairSync,sign} from 'node:crypto';
import {fingerprintRgba} from '../vision/dataset/visual-fingerprint.mjs';
import {auditCohort,verifyFrozenHoldout} from '../vision/dataset/cohort-leakage-audit.mjs';

const h=n=>n.toString(16).padStart(64,'0');
function image(predicate,n=192){
  const data=new Uint8ClampedArray(n*n*4);
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){
    const i=(y*n+x)*4,ink=predicate(x/n,y/n);
    data[i]=data[i+1]=data[i+2]=ink?0:255;
    data[i+3]=255;
  }
  return fingerprintRgba({data,width:n,height:n});
}
const tee=(x,y)=>x>.45&&x<.55&&y>.2&&y<.83||
  x>.19&&x<.81&&y>.18&&y<.29;
const ring=(x,y)=>{const r=Math.hypot(x-.5,y-.5);return r>.22&&r<.36};
const hshape=(x,y)=>(
 ((x>.17&&x<.28)||(x>.7&&x<.8))&&y>.16&&y<.86||
 y>.45&&y<.56&&x>.2&&x<.78
);
const bar=(x,y)=>x>.24&&x<.76&&y>.43&&y<.57;
const FP={t:image(tee),ring:image(ring),h:image(hshape)};
for(const [name,fp] of Object.entries(FP))
  assert.equal(fp.status,'ADVISORY_SIGNATURE_ONLY','synthetic '+name);
const entry=(id,split,fp=FP.t,overrides={})=>({
  image_sha256:h(id),artwork_sha256:h(id+10000),
  family_sha256:h(id+20000),split,
  technology_code:'UV1',source_type:'svg',
  fingerprint:fp,...overrides
});
const manifest=(entries)=>({
  schema:'printcheck.vision.cohort.v1',predictions_hidden:true,
  frozen_for_holdout:true,sampling_plan_sha256:h(90001),entries
});
test('same image family or byte-identical artwork across train/test is hard BLOCKED',()=>{
  const a=entry(1,'train');
  const b=entry(2,'test',FP.t,{family_sha256:a.family_sha256});
  const r=auditCohort(manifest([a,b]));
  assert.equal(r.status,'BLOCKED_EXACT_CROSS_SPLIT');
  assert.ok(r.exact_conflicts.same_family>=1);
  assert.equal(r.production_approved,false);
  const c=entry(3,'test',FP.t,{image_sha256:a.image_sha256});
  assert.ok(auditCohort(manifest([a,c])).exact_conflicts.same_preview>=1);
  const d=entry(4,'test',FP.t,{artwork_sha256:a.artwork_sha256});
  assert.ok(auditCohort(manifest([a,d])).exact_conflicts.same_artwork>=1);
});
test('same T at other brightness, orientation or resize requires manual near-dup review',()=>{
  const a=entry(1,'train',FP.t);
  const rotated=image((x,y)=>tee(y,1-x));
  const b=entry(2,'test',rotated);
  const r=auditCohort(manifest([a,b]));
  assert.equal(r.status,'BLOCKED_SUSPECTED_CROSS_SPLIT',JSON.stringify(r));
  assert.ok(r.near_cross_split_count>=1);
  assert.equal(r.suspected_pairs_for_private_review[0].left_index,0);
  assert.equal(r.suspected_pairs_for_private_review[0].right_index,1);
});
test('distinct shapes can pass screening but never obtain production acceptance',()=>{
  const r=auditCohort(manifest([
    entry(1,'train',FP.t),entry(2,'test',FP.ring)
  ]));
  assert.equal(r.status,'SCREENED_COHORT_ONLY',JSON.stringify(r));
  assert.equal(r.actual_nonduplicate_guaranteed,false);
  assert.equal(r.production_approved,false);
});
test('same family within train is not split contamination; remains pending wider audit',()=>{
  const a=entry(1,'train',FP.t);
  const r=auditCohort(manifest([
    a,entry(2,'train',FP.t,{family_sha256:a.family_sha256}),
    entry(3,'test',FP.ring)
  ]));
  assert.equal(r.exact_conflicts.same_family,0);
  assert.equal(r.status,'SCREENED_COHORT_ONLY',JSON.stringify(r));
});
test('holdout requires both train and test; missing visual fingerprint refuses screening',()=>{
  assert.equal(auditCohort(manifest([
    entry(1,'train'),entry(2,'validation')
  ])).reason,'TRAIN_AND_HOLDOUT_REQUIRED');
  const unusable=entry(2,'test',FP.t,{fingerprint:{status:'MANUAL'}});
  assert.equal(auditCohort(manifest([
    entry(1,'train'),unusable
  ])).reason,'COHORT_ROW_UNVERIFIED_OR_INVALID');
});
test('full pair scan has explicit fail-closed budget on dense same-artwork signatures',()=>{
  const rows=Array.from({length:600},(_,i)=>
    entry(i+1,i%2?'train':'test',FP.t));
  const r=auditCohort(manifest(rows));
  assert.equal(r.status,'MANUAL');
  assert.equal(r.reason,'CANDIDATE_PAIR_BUDGET_EXCEEDED');
});
test('signed holdout requires independent key pin and rejects modified bytes',()=>{
  const data=Buffer.from(JSON.stringify(manifest([
    entry(1,'train',FP.t),entry(2,'test',FP.ring)
  ])));
  const {privateKey,publicKey}=generateKeyPairSync('ed25519');
  const pem=publicKey.export({type:'spki',format:'pem'});
  const pin=createHash('sha256').update(
    publicKey.export({type:'spki',format:'der'})).digest('hex');
  const signature=sign(null,data,privateKey);
  const accepted=verifyFrozenHoldout({
    manifestBytes:data,signatureBytes:signature,
    trustedPublicKeyPem:pem,trustedSpkiSha256:pin
  });
  assert.equal(accepted.status,'SCREENED_COHORT_ONLY',JSON.stringify(accepted));
  assert.equal(accepted.trust_key_pin_verified,true);
  assert.equal(accepted.signed_before_model_tuning_not_cryptographically_proven,true);
  assert.equal(verifyFrozenHoldout({
    manifestBytes:Buffer.concat([data,Buffer.from(' ')]),
    signatureBytes:signature,trustedPublicKeyPem:pem,trustedSpkiSha256:pin
  }).reason,'HOLDOUT_SIGNATURE_INVALID');
  assert.equal(verifyFrozenHoldout({
    manifestBytes:data,signatureBytes:signature,
    trustedPublicKeyPem:pem,trustedSpkiSha256:h(77)
  }).reason,'HOLDOUT_TRUST_PIN_MISMATCH');
});
test('unsupported metadata fields, missing SHA or modified frozen plan fail closed',()=>{
  const m=manifest([entry(1,'train'),entry(2,'test')]);
  m.entries[0].order_number='SENSITIVE-ORDER';
  assert.equal(auditCohort(m).reason,'COHORT_ROW_UNVERIFIED_OR_INVALID');
  delete m.entries[0].order_number;
  m.sampling_plan_sha256='';
  assert.equal(auditCohort(m).reason,'COHORT_CONTRACT_INVALID');
  m.sampling_plan_sha256=h(90001);
  m.frozen_for_holdout=false;
  assert.equal(auditCohort(m).reason,'COHORT_CONTRACT_INVALID');
});
test('invalid signature, unsupported curve and unexpected preview origin refuse',()=>{
  assert.equal(verifyFrozenHoldout({
    manifestBytes:new Uint8Array(0)
  }).reason,'MANIFEST_BYTES_INVALID');
  const a=entry(1,'train');
  const b=entry(2,'test',FP.ring,{image_sha256:'bad'});
  assert.equal(auditCohort(manifest([a,b])).status,'MANUAL');
});
