/**
 * Offline two-review comparison CLI. No network, no artwork parsing.
 * stdout contains aggregate counts only, NEVER region/image/reviewer hashes.
 * Optional full provisional disagreement report is written locally with
 * atomic exclusive create (0600) and cannot become verified ground truth.
 *
 * Usage: node vision/dataset/compare-reviews.mjs task.json A.json B.json
 *        node vision/dataset/compare-reviews.mjs task.json A.json B.json output.json
 */
import {readFile,open} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {
  hashBinary,validateReviewTask,compareIndependentReviews
} from './review-task.mjs';

const INPUT_LIMIT=1_000_000;
const parseFile=async path=>{
  const bytes=await readFile(path);
  if(bytes.length>INPUT_LIMIT)throw new Error('REVIEW_FILE_TOO_LARGE');
  return {bytes,data:JSON.parse(bytes.toString('utf8'))};
};
export async function analyzeReviews(taskBytes,aBytes,bBytes){
  if(![taskBytes,aBytes,bBytes].every(x=>
    Buffer.isBuffer(x)||x instanceof Uint8Array))
    throw new Error('REVIEW_BYTES_REQUIRED');
  if([taskBytes,aBytes,bBytes].some(x=>x.length>INPUT_LIMIT))
    throw new Error('REVIEW_FILE_TOO_LARGE');
  const task=JSON.parse(Buffer.from(taskBytes).toString('utf8'));
  const left=JSON.parse(Buffer.from(aBytes).toString('utf8'));
  const right=JSON.parse(Buffer.from(bBytes).toString('utf8'));
  const v=validateReviewTask(task);
  if(v.status!=='TASK_VALID')throw new Error(v.reason);
  const digest=await hashBinary(taskBytes);
  const compared=compareIndependentReviews(task,digest,left,right);
  if(compared.status!=='PROVISIONAL_CONSENSUS_ONLY')
    throw new Error(compared.reason);
  const contextComplete=v.context_complete;
  const summary={
    schema:'printcheck.vision.review-audit-summary.v1',
    quality_verdict:'NOT_PRODUCTION_APPROVED',
    expert_identity_authenticated:false,
    group_context_complete:contextComplete,
    total_regions:compared.regions.length,
    consensus_agreement:compared.agreement_count,
    requires_adjudication:compared.adjudication_count,
    agreement_rate:compared.regions.length?
      compared.agreement_count/compared.regions.length:null,
    evaluable_for_accuracy:false,
    note:'Provisional self-asserted labels, no authenticated expert or measured physical scale'
  };
  return {summary,detail:compared};
}
export async function compareFiles(paths,output=null){
  if(!Array.isArray(paths)||paths.length!==3||
     paths.some(p=>typeof p!=='string'||!p))
    throw new Error('INPUT_PATHS_REQUIRED');
  const files=await Promise.all(paths.map(parseFile));
  const result=await analyzeReviews(...files.map(f=>f.bytes));
  if(output){
    const file=await open(output,'wx',0o600);
    try{
      await file.writeFile(JSON.stringify(result.detail,null,2)+'\n','utf8');
    }finally{await file.close()}
  }
  return result.summary;
}
const direct=process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url;
if(direct){
  try{
    if(process.argv.length<5||process.argv.length>6)
      throw new Error('ARGS_INVALID');
    const summary=await compareFiles(process.argv.slice(2,5),process.argv[5]??null);
    process.stdout.write(JSON.stringify(summary,null,2)+'\n');
  }catch{
    // Do not leak any private filenames, IDs or JSON parser excerpts.
    process.stderr.write('REVIEW_COMPARISON_REFUSED: check task SHA, labels and reviewer independence\n');
    process.exitCode=2;
  }
}
