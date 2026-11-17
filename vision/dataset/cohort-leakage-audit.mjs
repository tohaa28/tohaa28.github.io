/**
 * C3B.3.G -- closed cohort leakage audit before any experimental accuracy
 * calculation. Does not import client files or network/image decoders.
 *
 * Input fingerprints are extracted locally from decoded RGBA by the caller.
 * SHA-256 image/artwork/family IDs are independently bound by an external
 * source auditor; strings alone are NOT proof of identity.
 *
 * Cross-split collisions (same family, original or preview SHA) BLOCK.
 * Cross-split perceptual-near matches REQUIRE human group reassignment or
 * documented adjudication; no one-click auto merge or split reassignment.
 * "Clean" only means this specific screening found no leak, never no leak.
 *
 * Complete candidate generation: 16 exact 16-bit chunks per 256-bit shape
 * signature. Any pair with <=12 shape-bit differences MUST share at least
 * one exact chunk (pigeonhole). D4 gives eight signatures per image.
 * Dense inputs exceed budget -> MANUAL rather than silently dropping pairs.
 */
import {createHash,createPublicKey,verify} from 'node:crypto';
import {visualDistance} from './visual-fingerprint.mjs';

const HEX=/^[0-9a-f]{64}$/i;
const TECH=/^[A-Z0-9_-]{1,30}$/;
const SPLITS=new Set(['train','validation','test']);
const TYPES=new Set(['pdf','svg','raster','other']);
const MAX_RECORDS=1024,MAX_CANDIDATES=160000;
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const fail=(reason,counts={})=>({
  schema:'printcheck.vision.cohort-leakage-audit.v1',
  status:'MANUAL',reason,production_approved:false,...counts
});
const hash=s=>typeof s==='string'&&HEX.test(s);
function goodVisual(fp){
  return fp?.schema==='printcheck.vision.visual-fingerprint.v1'&&
    fp.status==='ADVISORY_SIGNATURE_ONLY'&&
    Array.isArray(fp.orientations)&&fp.orientations.length===8&&
    fp.orientations.every(s=>
      /^[0-9a-f]{64}$/.test(s?.silhouette??'')&&
      /^[0-9a-f]{16}$/.test(s?.gradient??''));
}
export function auditCohort(manifest={}){
  if(!manifest||manifest.schema!=='printcheck.vision.cohort.v1'||
     manifest.predictions_hidden!==true||
     manifest.frozen_for_holdout!==true||
     !hash(manifest.sampling_plan_sha256)||
     !Array.isArray(manifest.entries)||manifest.entries.length<2||
     manifest.entries.length>MAX_RECORDS)
    return fail('COHORT_CONTRACT_INVALID');
  if(Object.keys(manifest).some(k=>![
    'schema','predictions_hidden','frozen_for_holdout',
    'sampling_plan_sha256','entries'
  ].includes(k)))return fail('COHORT_EXTRA_FIELDS');
  const imageMap=new Map(),artworkMap=new Map(),familyMap=new Map();
  const records=manifest.entries;
  let train=0,validation=0,test=0;
  for(const row of records){
    if(!row||!hash(row.image_sha256)||!hash(row.artwork_sha256)||
       !hash(row.family_sha256)||!SPLITS.has(row.split)||
       !TYPES.has(row.source_type)||!TECH.test(row.technology_code)||
       !goodVisual(row.fingerprint)||
       Object.keys(row).some(k=>![
         'image_sha256','artwork_sha256','family_sha256','split',
         'source_type','technology_code','fingerprint'
       ].includes(k)))return fail('COHORT_ROW_UNVERIFIED_OR_INVALID');
    if(row.split==='train')train++;
    else if(row.split==='validation')validation++;
    else test++;
  }
  if(test===0||train===0)return fail('TRAIN_AND_HOLDOUT_REQUIRED');
  // Exact collisions are collected in O(n) via distinct split membership,
  // independently of whether visual hashes can represent the artwork.
  const exactConflict=new Set();
  function check(map,value,split,i,kind){
    const normalized=value.toLowerCase();
    const current=map.get(normalized);
    if(current){
      if(current.split!==split)exactConflict.add(kind+':'+current.i+':'+i);
    }else map.set(normalized,{split,i});
  }
  for(let i=0;i<records.length;i++){
    const r=records[i];
    check(imageMap,r.image_sha256,r.split,i,'same_preview');
    check(artworkMap,r.artwork_sha256,r.split,i,'same_artwork');
    check(familyMap,r.family_sha256,r.split,i,'same_family');
  }
  // Perceptual short-list with *exact* pigeonhole guarantee for all shape
  // distances <= 12 bits; arbitrary near duplicates can still be missed.
  const buckets=new Map(),pairs=new Set();
  for(let i=0;i<records.length;i++){
    const fp=records[i].fingerprint;
    const keys=new Set();
    for(const sig of fp.orientations){
      for(let chunk=0;chunk<16;chunk++)
        keys.add(chunk+':'+sig.silhouette.slice(chunk*4,chunk*4+4));
    }
    for(const key of keys){
      const prior=buckets.get(key)||[];
      for(const j of prior){
        if(records[j].split===records[i].split)continue;
        const a=Math.min(i,j),b=Math.max(i,j);
        pairs.add(a+':'+b);
        if(pairs.size>MAX_CANDIDATES)
          return fail('CANDIDATE_PAIR_BUDGET_EXCEEDED',
            {screened_records:records.length});
      }
      prior.push(i);buckets.set(key,prior);
    }
  }
  const conflicts=[];
  // This is an advisory score, NOT a mathematical test for visual identity.
  // The threshold here is a screening sensitivity, not a print requirement.
  for(const key of [...pairs].sort((a,b)=>{
    const [ai,aj]=a.split(':').map(Number),[bi,bj]=b.split(':').map(Number);
    return ai-bi||aj-bj;
  })){
    const [i,j]=key.split(':').map(Number);
    const s=visualDistance(records[i].fingerprint,records[j].fingerprint);
    if(s.status!=='ADVISORY_SIMILARITY_ONLY')
      return fail('FINGERPRINT_COMPARISON_UNRELIABLE');
    if(s.silhouette_bits<=12&&s.gradient_bits<=20)
      conflicts.push({
        left_index:i,right_index:j,
        silhouette_bits:s.silhouette_bits,gradient_bits:s.gradient_bits,
        kind:'POTENTIAL_VISUAL_DUPLICATE_REQUIRES_HUMAN_REVIEW'
      });
  }
  const exactKeys=[...exactConflict].map(s=>s.split(':')[0]);
  const exactCounts={
    same_preview:exactKeys.filter(x=>x==='same_preview').length,
    same_artwork:exactKeys.filter(x=>x==='same_artwork').length,
    same_family:exactKeys.filter(x=>x==='same_family').length
  };
  return {
    schema:'printcheck.vision.cohort-leakage-audit.v1',
    status:exactConflict.size?'BLOCKED_EXACT_CROSS_SPLIT':
      conflicts.length?'BLOCKED_SUSPECTED_CROSS_SPLIT':
      'SCREENED_COHORT_ONLY',
    production_approved:false,
    test_holdout_untouched:true,
    actual_nonduplicate_guaranteed:false,
    split_sizes:{train,validation,test},
    exact_conflicts:exactCounts,
    near_cross_split_count:conflicts.length,
    pairs_evaluated:pairs.size,
    suspected_pairs_for_private_review:conflicts,
    note:'Screening only. Manual audit of near duplicates, crops, arbitrary rotations and shared provenance remains essential.'
  };
}
export function verifyFrozenHoldout({manifestBytes,signatureBytes,
  trustedPublicKeyPem,trustedSpkiSha256}={}){
  if(!(Buffer.isBuffer(manifestBytes)||manifestBytes instanceof Uint8Array)||
     manifestBytes.length===0||manifestBytes.length>8_000_000)
    return fail('MANIFEST_BYTES_INVALID');
  if(!hash(trustedSpkiSha256)||typeof trustedPublicKeyPem!=='string'||
     trustedPublicKeyPem.length>8192)
    return fail('HOLDOUT_TRUST_PIN_MISSING');
  let pub;
  try{pub=createPublicKey(trustedPublicKeyPem)}catch{
    return fail('HOLDOUT_PUBLIC_KEY_INVALID');
  }
  if(pub.asymmetricKeyType!=='ed25519')
    return fail('HOLDOUT_ED25519_REQUIRED');
  if(sha(pub.export({format:'der',type:'spki'}))!==
     trustedSpkiSha256.toLowerCase())
    return fail('HOLDOUT_TRUST_PIN_MISMATCH');
  if(!(Buffer.isBuffer(signatureBytes)||signatureBytes instanceof Uint8Array)||
     signatureBytes.length!==64||
     !verify(null,manifestBytes,pub,signatureBytes))
    return fail('HOLDOUT_SIGNATURE_INVALID');
  let manifest;
  try{manifest=JSON.parse(Buffer.from(manifestBytes).toString('utf8'))}
  catch{return fail('HOLDOUT_JSON_INVALID')}
  const audit=auditCohort(manifest);
  return {
    ...audit,
    signed_manifest_sha256:sha(manifestBytes),
    trust_key_pin_verified:true,
    no_guarantee_of_source_provenance:true,
    signed_before_model_tuning_not_cryptographically_proven:true
  };
}
