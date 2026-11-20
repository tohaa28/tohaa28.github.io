/**
 * C3B.3.H -- offline preparation of a complete blind review task.
 *
 * Converts a coordinator's PRELIMINARY ROI task into a fresh task containing
 * both pre-selected ROIs and HMAC-derived independent controls. The old task
 * MUST NOT already have been distributed to reviewers. The private seed,
 * original artwork IDs and output JSON never enter public CI.
 *
 * Outputs are created exclusively in an existing private directory.
 */
import {createHash} from 'node:crypto';
import {open,readFile,lstat,stat,unlink} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {
  validateReviewTask,createReviewTask
} from './review-task.mjs';
import {
  deriveBlindControlRegions,verifyBlindSamplingPlan
} from './blind-sampling-plan.mjs';

const HASH=/^[a-f0-9]{64}$/i;
const sha=b=>createHash('sha256').update(b).digest('hex');
const refuses=reason=>{throw new Error(reason)};
export async function prepareBlindControlTask({
  candidateTask,seed_hex,grid_rows,grid_columns,control_count
}={}){
  const original=validateReviewTask(candidateTask);
  if(original.status!=='TASK_VALID'||original.context_complete!==true)
    refuses('ORIGINAL_CANDIDATE_TASK_INCOMPLETE');
  for(const region of candidateTask.regions){
    const expected=sha(Buffer.from(JSON.stringify([
      candidateTask.source.image_sha256.toLowerCase(),region.rect
    ])));
    if(region.region_sha256.toLowerCase()!==expected)
      refuses('ORIGINAL_ROI_GEOMETRY_UNTRUSTED');
  }
  const sampled=deriveBlindControlRegions({
    source_image_sha256:candidateTask.source.image_sha256,
    seed_hex,grid_rows,grid_columns,control_count
  });
  if(sampled.status!=='DETERMINISTIC_CONTROLS_ONLY')
    refuses(sampled.reason);
  const originalCount=candidateTask.regions.length;
  const mergedCount=originalCount+sampled.regions.length;
  if(mergedCount>250||sampled.regions.length<Math.ceil(0.25*mergedCount))
    refuses('CONTROL_COVERAGE_BELOW_25_PERCENT_OR_TOO_MANY_ROIS');
  const annotations=[
    ...candidateTask.regions.map(r=>({type:'other',...r.rect})),
    ...sampled.regions.map(r=>({type:'other',...r.rect}))
  ];
  const task=await createReviewTask({
    image_sha256:candidateTask.source.image_sha256,
    width_px:candidateTask.source.width_px,
    height_px:candidateTask.source.height_px,
    artwork_sha256:candidateTask.context.artwork_sha256,
    family_sha256:candidateTask.context.family_sha256,
    technology_code:candidateTask.context.technology_code,
    annotations
  });
  const plan={
    schema:'printcheck.vision.blind-sampling-plan.v1',
    source_image_sha256:task.source.image_sha256,
    artwork_sha256:task.context.artwork_sha256,
    family_sha256:task.context.family_sha256,
    technology_code:task.context.technology_code,
    seed_hex:seed_hex.toLowerCase(),
    grid_rows,grid_columns,control_count,
    candidate_region_sha256:candidateTask.regions.map(r=>
      r.region_sha256.toLowerCase())
  };
  const taskBytes=Buffer.from(JSON.stringify(task,null,2)+'\n');
  const planBytes=Buffer.from(JSON.stringify(plan,null,2)+'\n');
  const verification=verifyBlindSamplingPlan({
    task,planBytes,expectedPlanSha256:sha(planBytes)
  });
  if(verification.status!=='PRE_REGISTERED_CONTROLS_VERIFIED')
    refuses('CONTROL_PACKAGE_VALIDATION_FAILED');
  return {
    status:'BLIND_CONTROL_PACKAGE_PREPARED',
    task,plan,taskBytes,planBytes,
    summary:{
      preliminary_roi_count:originalCount,
      independent_control_count:sampled.regions.length,
      total_blind_regions:mergedCount,
      control_fraction:verification.control_fraction,
      quality_verdict:'NOT_PRODUCTION_APPROVED',
      reviewer_predictions_hidden:true
    }
  };
}
export async function writeBlindControlPackage(packageResult,directory){
  if(packageResult?.status!=='BLIND_CONTROL_PACKAGE_PREPARED'||
     typeof directory!=='string'||!directory)
    refuses('PRIVATE_EXPORT_INVALID');
  const dir=await lstat(directory);
  if(!dir.isDirectory()||dir.isSymbolicLink()||
     process.platform!=='win32'&&(dir.mode&0o077)!==0)
    refuses('PRIVATE_DIRECTORY_0700_REQUIRED');
  const names=['vision-blind-task.json','vision-sampling-plan.json'];
  const handles=[],created=[];
  try{
    // Both exclusive creates must succeed before writing either payload.
    for(const name of names){
      const path=join(directory,name);
      const handle=await open(path,'wx',0o600);
      handles.push(handle);
      created.push(path);
    }
    await handles[0].writeFile(packageResult.taskBytes);
    await handles[1].writeFile(packageResult.planBytes);
  }catch{
    for(const handle of handles)await handle.close().catch(()=>{});
    for(const path of created)await unlink(path).catch(()=>{});
    refuses('PRIVATE_OUTPUT_REFUSED_OR_ALREADY_EXISTS');
  }
  for(const handle of handles)await handle.close();
  return {
    status:'PRIVATE_BLIND_TASK_AND_PLAN_SAVED',
    file_count:2,
    control_count:packageResult.summary.independent_control_count
  };
}
const direct=process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url;
if(direct){
  try{
    const args=process.argv.slice(2);
    if(args.length!==6)refuses('ARGS_INVALID');
    const [taskPath,seedPath,rows,columns,count,outputDir]=args;
    const taskMeta=await stat(taskPath),seedMeta=await stat(seedPath);
    if(!taskMeta.isFile()||taskMeta.size>1_000_000||
       !seedMeta.isFile()||seedMeta.size>128)
      refuses('INPUT_FILES_INVALID');
    const candidateTask=JSON.parse(await readFile(taskPath,'utf8'));
    const seed_hex=(await readFile(seedPath,'utf8')).trim();
    if(!HASH.test(seed_hex))refuses('SEED_HEX_INVALID');
    const result=await prepareBlindControlTask({
      candidateTask,seed_hex,
      grid_rows:Number(rows),grid_columns:Number(columns),
      control_count:Number(count)
    });
    await writeBlindControlPackage(result,outputDir);
    process.stdout.write(JSON.stringify(result.summary)+'\n');
  }catch{
    // No filenames, image hashes, order IDs, seed or reviewer data in logs.
    process.stderr.write('BLIND_CONTROL_PREPARATION_REFUSED: verify original task, private seed, ROI budget and output permissions\n');
    process.exitCode=2;
  }
}
