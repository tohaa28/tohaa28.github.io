/**
 * C3B.3.K private offline replay CLI.
 * Usage: node vision/raster/verify-replay-files.mjs
 *   source.pdf|svg preview.png order-evidence.bin
 *   receipt.json receipt.sig renderer-public.pem TRUSTED_SPKI_SHA256
 *
 * Exact bytes, existing signatures and independent replay required.
 * Never logs private file paths, SHA or customer data.
 */
import {readFile,lstat} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {verifyIndependentRasterReplay}
  from './verify-independent-replay.mjs';

const MAX=[16_000_000,25_000_000,8_000_000,32_768,128,8192];
const error=reason=>({
  schema:'printcheck.vision.independent-raster-replay.v1',
  status:'MANUAL',reason,production_approved:false
});
export async function verifyReplayFiles({
  sourcePath,previewPath,orderPath,receiptPath,signaturePath,
  publicKeyPath,trustedSpkiSha256
}={}){
  const paths=[sourcePath,previewPath,orderPath,
    receiptPath,signaturePath,publicKeyPath];
  if(paths.some(p=>typeof p!=='string'||p.length<1||
     p.length>4096||/[\r\n\0]/.test(p)))
    return error('PRIVATE_REPLAY_INPUT_PATHS_INVALID');
  const files=[];
  for(let i=0;i<paths.length;i++){
    try{
      const info=await lstat(paths[i]);
      if(!info.isFile()||info.isSymbolicLink()||
         info.size<=0||info.size>MAX[i])
        return error('PRIVATE_REPLAY_SOURCE_UNSUPPORTED');
      files.push(await readFile(paths[i]));
      if(files[i].length!==info.size)
        return error('PRIVATE_REPLAY_SOURCE_CHANGED');
    }catch{return error('PRIVATE_REPLAY_READ_FAILED')}
  }
  return verifyIndependentRasterReplay({
    sourceBytes:files[0],previewPngBytes:files[1],
    orderEvidenceBytes:files[2],receiptBytes:files[3],
    signatureBytes:files[4],
    trustedPublicKeyPem:files[5].toString('utf8'),
    trustedSpkiSha256
  });
}
const direct=process.argv[1]&&
  pathToFileURL(process.argv[1]).href===import.meta.url;
if(direct){
  try{
    const args=process.argv.slice(2);
    if(args.length!==7)throw new Error('CLI_ARGUMENT_COUNT_INVALID');
    const result=await verifyReplayFiles({
      sourcePath:args[0],previewPath:args[1],orderPath:args[2],
      receiptPath:args[3],signaturePath:args[4],
      publicKeyPath:args[5],trustedSpkiSha256:args[6]
    });
    process.stdout.write(JSON.stringify(result,null,2)+'\n');
    if(result.status!=='EXACT_INDEPENDENT_RGBA_REPLAY_RESEARCH_ONLY')
      process.exitCode=2;
  }catch{
    process.stderr.write('PRIVATE_REPLAY_REFUSED: verify local signed source, preview, color scope and raster engine\n');
    process.exitCode=2;
  }
}
