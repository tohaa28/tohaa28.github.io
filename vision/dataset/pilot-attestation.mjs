/**
 * C3B.3.F -- offline, fail-closed cryptographic sign-off of blinded expert ROIs.
 *
 * A reviewer's free-form hash is NOT authentication. The independent auditor
 * must verify reviewer identity, original artwork, order/technology evidence,
 * calibration and ROI sampling outside this module, then SIGN the exact raw
 * attestation bytes with an Ed25519 key whose SPKI hash was pinned separately.
 *
 * This module verifies raw bytes, every cross-document digest, all ROI
 * decisions and algorithm prediction coverage. It can assemble a research
 * evaluation dataset, never a production manufacturability verdict.
 *
 * No remote requests, no private keys, no default trust key, no public data.
 */
import {createHash,createPublicKey,verify} from 'node:crypto';
import {readFile,open,stat,lstat} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {validateReviewTask,compareIndependentReviews} from './review-task.mjs';

const HASH=/^[0-9a-f]{64}$/i;
const TECH=/^[A-Z0-9_-]{1,30}$/;
const REV=/^[A-Za-z0-9._-]{1,64}$/;
const SPLITS=new Set(['train','validation','test']);
const DECISIONS=new Set(['defect','acceptable','manual']);
const STATES=new Set(['candidate','none','manual']);
const MAX_JSON=2*1024*1024,MAX_SOURCE=64*1024*1024;
const hash=b=>createHash('sha256').update(b).digest('hex');
const isHash=s=>typeof s==='string'&&HASH.test(s);
const lower=s=>s.toLowerCase();
const reject=code=>{throw new Error(code)};
function parse(bytes,label,max=MAX_JSON){
  if(!Buffer.isBuffer(bytes)&&!(bytes instanceof Uint8Array))
    reject(label+'_BYTES_REQUIRED');
  if(bytes.length===0||bytes.length>max)reject(label+'_SIZE_UNSUPPORTED');
  try{return JSON.parse(Buffer.from(bytes).toString('utf8'))}
  catch{reject(label+'_JSON_INVALID')}
}
function fixedKeys(obj,keys){
  return obj&&typeof obj==='object'&&!Array.isArray(obj)&&
    Object.keys(obj).every(k=>keys.includes(k))&&
    keys.every(k=>Object.hasOwn(obj,k));
}
function digestMatches(value,bytes){return isHash(value)&&lower(value)===hash(bytes)}
function expectedRegionHash(task,region){
  return hash(Buffer.from(JSON.stringify([
    lower(task.source.image_sha256),region.rect
  ]),'utf8'));
}
function validateTask(task){
  const validation=validateReviewTask(task);
  if(validation.status!=='TASK_VALID'||!validation.context_complete)
    reject('BLIND_TASK_CONTEXT_INCOMPLETE');
  if(new Set(task.regions.map(r=>r.region_sha256.toLowerCase())).size!==
     task.regions.length)reject('DUPLICATE_REGION_ID');
  for(const r of task.regions){
    if(expectedRegionHash(task,r)!==lower(r.region_sha256))
      reject('ROI_GEOMETRY_FINGERPRINT_INVALID');
  }
}
function verifier(attBytes,signature,spkiPem,pin){
  if(!isHash(pin))reject('TRUST_PIN_REQUIRED');
  if(typeof spkiPem!=='string'||spkiPem.length>8192)
    reject('TRUSTED_PUBLIC_KEY_INVALID');
  let key;
  try{key=createPublicKey(spkiPem)}catch{reject('TRUSTED_PUBLIC_KEY_INVALID')}
  if(key.asymmetricKeyType!=='ed25519')reject('TRUSTED_KEY_NOT_ED25519');
  const keyHash=hash(key.export({format:'der',type:'spki'}));
  if(keyHash!==lower(pin))reject('TRUST_PIN_MISMATCH');
  const sig=Buffer.from(signature);
  if(sig.length!==64||!verify(null,attBytes,key,sig))
    reject('ADJUDICATION_SIGNATURE_INVALID');
  return keyHash;
}
function validateBlindReviewShape(review){
  const fields=['schema','task_sha256','reviewer_ref_sha256',
                'review_state','blinded_to_predictions','results'];
  if(!fixedKeys(review,fields)||!Array.isArray(review.results)||
     review.results.some(row=>!fixedKeys(row,['region_sha256','label'])))
    reject('REVIEW_UNEXPECTED_HINT_FIELDS');
}
function validateComparison(task,comparison){
  if(!comparison||comparison.schema!=='printcheck.vision.region-method-comparison.v1'||
     comparison.status!=='RESEARCH_PREDICTIONS_ONLY'||
     comparison.production_approved!==false||
     comparison.physical_scale_independently_proven!==false||
     comparison.region_count!==task.regions.length||
     !Array.isArray(comparison.results)||comparison.results.length<2||
     comparison.results.length>8)
    reject('RESEARCH_COMPARISON_INVALID');
  const ids=task.regions.map(r=>r.region_sha256);
  const algorithmNames=new Set();
  for(const method of comparison.results){
    if(typeof method.algorithm_id!=='string'||
       !/^[A-Za-z0-9_-]{1,40}$/.test(method.algorithm_id)||
       algorithmNames.has(method.algorithm_id)||
       !REV.test(method.revision)||
       !Array.isArray(method.predictions)||
       method.predictions.length!==ids.length)
      reject('RESEARCH_METHOD_INVALID');
    algorithmNames.add(method.algorithm_id);
    const rows=new Map();
    for(const row of method.predictions){
      if(!row||!isHash(row.region_sha256)||!STATES.has(row.state)||
         rows.has(lower(row.region_sha256)))reject('RESEARCH_ROI_INVALID');
      rows.set(lower(row.region_sha256),row);
    }
    if(ids.some(id=>!rows.has(lower(id))))
      reject('RESEARCH_ROI_SET_MISMATCH');
  }
  return comparison.results;
}
function checkManifest(att,task,raw,consensus){
  const keys=['schema','task_sha256','image_sha256','artwork_sha256',
    'family_sha256','technology_code','split','review_a_sha256',
    'review_b_sha256','comparison_sha256','source_evidence_sha256',
    'calibration_evidence_sha256','sampling_evidence_sha256',
    'reviewer_identities_verified','source_identity_verified',
    'scale_evidence_checked','sampling_plan_checked',
    'adjudicator_ref_sha256','regions'];
  if(!fixedKeys(att,keys)||
     att.schema!=='printcheck.vision.pilot-attestation.v1'||
     !SPLITS.has(att.split)||!TECH.test(att.technology_code)||
     !isHash(att.adjudicator_ref_sha256))
    reject('ADJUDICATION_SCHEMA_INVALID');
  const checks={
    task_sha256:raw.task,
    image_sha256:raw.image,
    artwork_sha256:raw.artwork,
    review_a_sha256:raw.reviewA,
    review_b_sha256:raw.reviewB,
    comparison_sha256:raw.comparison,
    source_evidence_sha256:raw.sourceEvidence,
    calibration_evidence_sha256:raw.calibrationEvidence,
    sampling_evidence_sha256:raw.samplingEvidence
  };
  for(const [key,expected] of Object.entries(checks)){
    if(!isHash(att[key])||lower(att[key])!==expected)
      reject('ADJUDICATION_INPUT_DIGEST_MISMATCH');
  }
  if(lower(att.artwork_sha256)!==lower(task.context.artwork_sha256)||
     lower(att.family_sha256)!==lower(task.context.family_sha256)||
     att.technology_code!==task.context.technology_code)
    reject('ADJUDICATION_ARTWORK_TECHNOLOGY_MISMATCH');
  // These are accountable attestations signed by a trusted external auditor,
  // not independently verified facts of the physical manufacturing process.
  for(const key of ['reviewer_identities_verified','source_identity_verified',
                    'scale_evidence_checked','sampling_plan_checked']){
    if(att[key]!==true)reject('AUDIT_PROOF_GATE_NOT_ATTESTED');
  }
  const agreed=new Map(consensus.regions.map(r=>
    [lower(r.region_sha256),r.decision]));
  if(!Array.isArray(att.regions)||
     att.regions.length!==task.regions.length)
    reject('ADJUDICATION_REGIONS_INCOMPLETE');
  const seen=new Set(),rows=[];
  for(const entry of att.regions){
    if(!fixedKeys(entry,['region_sha256','decision','adjudicated',
                         'evidence_sha256'])||
       !isHash(entry.region_sha256)||!DECISIONS.has(entry.decision)||
       typeof entry.adjudicated!=='boolean'||
       !isHash(entry.evidence_sha256))
      reject('ADJUDICATION_REGION_INVALID');
    const id=lower(entry.region_sha256);
    if(seen.has(id)||!agreed.has(id))reject('ADJUDICATION_REGION_SET_MISMATCH');
    seen.add(id);
    const peer=agreed.get(id);
    if(peer==='requires_adjudication'){
      if(!entry.adjudicated)reject('CONFLICT_NOT_ADJUDICATED');
    }else if(entry.decision!==peer||entry.adjudicated)
      reject('UNJUSTIFIED_CONSENSUS_OVERRIDE');
    rows.push({id,label:entry.decision});
  }
  return rows;
}
export function buildAttestedPilot(input={}){
  const {
    taskBytes,imageBytes,artworkBytes,
    sourceEvidenceBytes,calibrationEvidenceBytes,samplingEvidenceBytes,
    reviewABytes,reviewBBytes,
    comparisonBytes,attestationBytes,signatureBytes,
    trustedPublicKeyPem,trustedSpkiSha256
  }=input;
  const task=parse(taskBytes,'TASK'),image=parseBinary(imageBytes,'IMAGE'),
    artwork=parseBinary(artworkBytes,'ARTWORK'),
    sourceEvidence=parseBinary(sourceEvidenceBytes,'SOURCE_EVIDENCE'),
    calibrationEvidence=parseBinary(calibrationEvidenceBytes,'CALIBRATION_EVIDENCE'),
    samplingEvidence=parseBinary(samplingEvidenceBytes,'SAMPLING_EVIDENCE'),
    reviewA=parse(reviewABytes,'REVIEW_A'),
    reviewB=parse(reviewBBytes,'REVIEW_B'),
    comparison=parse(comparisonBytes,'COMPARISON'),
    attestation=parse(attestationBytes,'ATTESTATION');
  validateTask(task);
  if(!digestMatches(task.source.image_sha256,image)||
     !digestMatches(task.context.artwork_sha256,artwork))
    reject('ORIGINAL_SOURCE_BYTES_MISMATCH');
  const taskDigest=hash(taskBytes);
  validateBlindReviewShape(reviewA);
  validateBlindReviewShape(reviewB);
  const consensus=compareIndependentReviews(task,taskDigest,reviewA,reviewB);
  if(consensus.status!=='PROVISIONAL_CONSENSUS_ONLY')
    reject('TWO_INDEPENDENT_REVIEWS_REQUIRED');
  const methods=validateComparison(task,comparison);
  const fingerprints={
    task:taskDigest,image:hash(image),artwork:hash(artwork),
    sourceEvidence:hash(sourceEvidence),calibrationEvidence:hash(calibrationEvidence),
    samplingEvidence:hash(samplingEvidence),
    reviewA:hash(reviewABytes),reviewB:hash(reviewBBytes),
    comparison:hash(comparisonBytes)
  };
  // Validate signed bytes BEFORE trusting any asserted audit state.
  const signerKeySha=verifier(Buffer.from(attestationBytes),
    signatureBytes,trustedPublicKeyPem,trustedSpkiSha256);
  const regionLabels=checkManifest(attestation,task,fingerprints,consensus);
  const byRegion=new Map(regionLabels.map(r=>[r.id,r.label]));
  // Keep algorithm views strictly separate even when revisions coincide.
  // eval.py expects a single prediction per ROI and rejects duplicates.
  const evaluations=methods.map(method=>({
    algorithm_id:method.algorithm_id,
    document:{
      schema:'printcheck.vision.expert-regions.v1',
      regions:method.predictions.flatMap(pred=>{
        const label=byRegion.get(lower(pred.region_sha256));
        // Unresolved expert regions must be excluded, never marked acceptable.
        if(label==='manual')return [];
        return [{
          artwork_sha256:task.context.artwork_sha256,
          family_sha256:task.context.family_sha256,
          region_sha256:lower(pred.region_sha256),
          split:attestation.split,
          technology_code:task.context.technology_code,
          expert:{
            state:'verified',label,
            annotation_sha256:hash(attestationBytes),
            reviewer_ref_sha256:attestation.adjudicator_ref_sha256
          },
          detection:{state:pred.state,revision:method.revision}
        }];
      })
    }
  }));
  const summary={
    schema:'printcheck.vision.pilot-audit-summary.v1',
    status:'ATTESTED_RESEARCH_LABELS_ONLY',
    production_quality_verdict:'NOT_PRODUCTION_APPROVED',
    authenticated_signoff_key_sha256:signerKeySha,
    initial_reviewers:selfAssertedCount(consensus),
    expert_review_regions:task.regions.length,
    included_regions:regionLabels.filter(r=>r.label!=='manual').length,
    abstained_regions:regionLabels.filter(r=>r.label==='manual').length,
    conflict_resolutions:consensus.adjudication_count,
    comparisons:evaluations.map(x=>({
      algorithm_id:x.algorithm_id,reported_regions:x.document.regions.length
    })),
    trust_boundary:'Signature proves trusted auditor assertion, not independent manufacturing fitness'
  };
  return {summary,evaluations};
}
function parseBinary(bytes,label){
  if(!Buffer.isBuffer(bytes)&&!(bytes instanceof Uint8Array))
    reject(label+'_BYTES_REQUIRED');
  if(bytes.length===0||bytes.length>MAX_SOURCE)
    reject(label+'_SIZE_UNSUPPORTED');
  return bytes;
}
function selfAssertedCount(){return 2}
/**
 * Explicitly writes research datasets to a PRE-EXISTING private directory.
 * Does not create/upload any artwork. Never overwrites an existing file.
 * All labels are region-level, signed auditor assertions, not print approval.
 */
export async function exportPilotEvaluations(result,folder){
  if(typeof folder!=='string'||folder.length===0)
    reject('PRIVATE_OUTPUT_DIRECTORY_REQUIRED');
  const info=await lstat(folder);
  if(!info.isDirectory()||info.isSymbolicLink()||
     (process.platform!=='win32'&&(info.mode&0o077)!==0))
    reject('OUTPUT_DIRECTORY_NOT_PRIVATE');
  if(result?.summary?.status!=='ATTESTED_RESEARCH_LABELS_ONLY'||
     !Array.isArray(result.evaluations)||
     result.summary.included_regions<=0)
    reject('NO_ATTESTED_EXPERT_REGIONS_TO_EXPORT');
  const names=new Set();
  for(const e of result.evaluations){
    if(typeof e.algorithm_id!=='string'||
       !/^[A-Za-z0-9_-]{1,40}$/.test(e.algorithm_id)||
       names.has(e.algorithm_id))
      reject('OUTPUT_ALGORITHM_ID_UNSAFE');
    names.add(e.algorithm_id);
  }
  const written=[];
  for(const e of result.evaluations){
    const filePath=join(folder,'vision-research-'+e.algorithm_id+'.json');
    const file=await open(filePath,'wx',0o600);
    try{
      await file.writeFile(JSON.stringify(e.document,null,2)+'\n','utf8');
      written.push(e.algorithm_id);
    }finally{await file.close()}
  }
  return {status:'PRIVATE_RESEARCH_DATASETS_SAVED',
    algorithm_count:written.length,regions_per_method:result.summary.included_regions};
}
const direct=process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url;
if(direct){
  try{
    const args=process.argv.slice(2);
    if(args.length!==13&&args.length!==14)reject('ARGS_INVALID');
    const [taskPath,imagePath,artworkPath,
      sourceEvidencePath,calibrationEvidencePath,samplingEvidencePath,
      reviewAPath,reviewBPath,comparisonPath,attPath,sigPath,pubPath,
      spkiPin,privateOutputDir]=args;
    // Input files are local and limited before reading into process memory.
    const paths=[taskPath,imagePath,artworkPath,
      sourceEvidencePath,calibrationEvidencePath,samplingEvidencePath,
      reviewAPath,reviewBPath,comparisonPath,attPath,sigPath,pubPath];
    const bytes=await Promise.all(paths.map(async(p,i)=>{
      const s=await stat(p),max=(i>=1&&i<=5)?MAX_SOURCE:MAX_JSON;
      if(!s.isFile()||s.size===0||s.size>max)
        reject('PILOT_INPUT_INVALID');
      return readFile(p);
    }));
    const result=buildAttestedPilot({
      taskBytes:bytes[0],imageBytes:bytes[1],artworkBytes:bytes[2],
      sourceEvidenceBytes:bytes[3],calibrationEvidenceBytes:bytes[4],
      samplingEvidenceBytes:bytes[5],
      reviewABytes:bytes[6],reviewBBytes:bytes[7],
      comparisonBytes:bytes[8],attestationBytes:bytes[9],
      signatureBytes:bytes[10],
      trustedPublicKeyPem:bytes[11].toString('utf8'),
      trustedSpkiSha256:spkiPin
    });
    // Verified datasets are written only when a PRIVATE output directory
    // is explicitly supplied. Without it, stdout contains aggregates only.
    if(privateOutputDir)await exportPilotEvaluations(result,privateOutputDir);
    process.stdout.write(JSON.stringify(result.summary,null,2)+'\n');
  }catch{
    process.stderr.write('PILOT_ATTESTATION_REFUSED: check source bytes, signature and independent trust pin\n');
    process.exitCode=2;
  }
}
