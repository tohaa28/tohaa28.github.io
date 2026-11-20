/**
 * Private local CLI — verify signed source/PNG/mm renderer receipt.
 *
 * Requires EXACT local original bytes and a separately trusted public key
 * pin. No network requests, no files written and no order names or SHA
 * hashes in stdout/stderr. Never prints the private input file paths.
 */
import {readFile,lstat} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {verifySignedRenderCalibration}
  from './render-calibration-attestation.mjs';

const LIMITS=[64_000_000,25_000_000,8_000_000,32_768,128,8192];
const direct=process.argv[1]&&
  pathToFileURL(process.argv[1]).href===import.meta.url;
export async function verifyRenderFiles({
  sourcePath,previewPath,orderPath,receiptPath,signaturePath,
  publicKeyPath,trustedSpkiSha256
}={}){
  const paths=[sourcePath,previewPath,orderPath,
    receiptPath,signaturePath,publicKeyPath];
  if(paths.some(p=>typeof p!=='string'||p.length<1||
     p.length>4096||/[\r\n\0]/.test(p)))
    return {status:'MANUAL',reason:'RENDER_FILES_INVALID'};
  const data=[];
  for(let i=0;i<paths.length;i++){
    try{
      const info=await lstat(paths[i]);
      if(!info.isFile()||info.isSymbolicLink()||
         info.size<=0||info.size>LIMITS[i])
        return {status:'MANUAL',reason:'RENDER_FILE_UNSUPPORTED_OR_MISSING'};
      data.push(await readFile(paths[i]));
      if(data[i].length!==info.size)
        return {status:'MANUAL',reason:'RENDER_FILE_CHANGED_DURING_READ'};
    }catch{return {status:'MANUAL',reason:'RENDER_LOCAL_IO_ERROR'}}
  }
  return verifySignedRenderCalibration({
    sourceBytes:data[0],previewPngBytes:data[1],
    orderEvidenceBytes:data[2],receiptBytes:data[3],
    signatureBytes:data[4],
    trustedPublicKeyPem:data[5].toString('utf8'),trustedSpkiSha256
  });
}
if(direct){
  try{
    const args=process.argv.slice(2);
    if(args.length!==7)throw new Error('ARGS_INVALID');
    const r=await verifyRenderFiles({
      sourcePath:args[0],previewPath:args[1],orderPath:args[2],
      receiptPath:args[3],signaturePath:args[4],
      publicKeyPath:args[5],trustedSpkiSha256:args[6]
    });
    process.stdout.write(JSON.stringify(r,null,2)+'\n');
    if(r.status!=='SIGNED_SOURCE_PREVIEW_AND_MM_AFFINE_CONSISTENT_ONLY')
      process.exitCode=2;
  }catch{
    process.stderr.write(
      'RENDER_CALIBRATION_REFUSED: verify signed renderer receipt, source/PNG/field evidence and private trust pin\n'
    );
    process.exitCode=2;
  }
}
