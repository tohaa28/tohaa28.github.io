/**
 * C3B.3.I -- sequential offline byte attestation of an existing signed
 * cohort. Designed for a private, local coordinator machine; no upload.
 *
 * The local file-list must order paths exactly as the signed cohort.entries
 * array. Each file is lstat-checked and read one at a time; JPEG, palette/
 * profiled/interlaced PNG and all other unsupported sources require MANUAL.
 *
 * No image filenames, source SHA values, RGB pixels or orders are printed.
 */
import {readFile,lstat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {decodeTrustedPngBytes} from './strict-png-decoder.mjs';
import {fingerprintRgba} from './visual-fingerprint.mjs';
import {verifyFrozenHoldout} from './cohort-leakage-audit.mjs';

const sha=b=>createHash('sha256').update(b).digest('hex');
const refuse=reason=>({
  schema:'printcheck.vision.private-image-audit.v1',
  status:'MANUAL',reason,production_approved:false
});
const isBytes=x=>Buffer.isBuffer(x)||x instanceof Uint8Array;
export async function verifySignedCohortImageFiles({
  cohortManifestBytes,cohortSignatureBytes,
  trustedPublicKeyPem,trustedSpkiSha256,sourcePaths
}={}){
  const signed=verifyFrozenHoldout({
    manifestBytes:cohortManifestBytes,
    signatureBytes:cohortSignatureBytes,
    trustedPublicKeyPem,trustedSpkiSha256
  });
  if(signed.status!=='SCREENED_COHORT_ONLY')
    return refuse('SIGNED_COHORT_NOT_SCREENED');
  let manifest;
  try{manifest=JSON.parse(Buffer.from(cohortManifestBytes).toString('utf8'))}
  catch{return refuse('COHORT_JSON_INVALID')}
  if(!Array.isArray(sourcePaths)||
     sourcePaths.length!==manifest.entries.length||
     sourcePaths.some(p=>typeof p!=='string'||p.length<1||p.length>4096||
       /[\r\n\0]/.test(p)))
    return refuse('LOCAL_SOURCE_PATHS_INCOMPLETE');
  let total=0,checked=0;
  for(let i=0;i<sourcePaths.length;i++){
    try{
      const st=await lstat(sourcePaths[i]);
      if(!st.isFile()||st.isSymbolicLink()||st.size<57||
         st.size>25_000_000)
        return refuse('LOCAL_IMAGE_FILE_UNSUPPORTED');
      const bytes=await readFile(sourcePaths[i]);
      if(!isBytes(bytes)||bytes.length!==st.size)
        return refuse('SOURCE_IMAGE_CHANGED_DURING_READ');
      const entry=manifest.entries[i];
      if(sha(bytes)!==entry.image_sha256.toLowerCase())
        return refuse('SIGNED_SOURCE_SHA_MISMATCH');
      const decoded=decodeTrustedPngBytes(bytes);
      if(decoded.status!=='DECODED_STRICT_PNG_ONLY')
        return refuse('LOCAL_PNG_DECODING_UNSUPPORTED');
      const fingerprint=fingerprintRgba(decoded);
      if(fingerprint.status!=='ADVISORY_SIGNATURE_ONLY'||
         JSON.stringify(fingerprint)!==
           JSON.stringify(entry.fingerprint))
        return refuse('SIGNED_FINGERPRINT_RECONSTRUCTION_MISMATCH');
      total+=bytes.length;checked++;
    }catch{return refuse('LOCAL_SOURCE_IO_OR_DECODING_FAILED')}
  }
  return {
    schema:'printcheck.vision.private-image-audit.v1',
    status:'SIGNED_COHORT_PREVIEW_BYTES_RECONSTRUCTED',
    production_approved:false,
    checked_images:checked,checked_compressed_bytes:total,
    image_bytes_verified:true,
    physical_print_scale_verified:false,
    gifts_order_provenance_verified:false,
    code_path:'strict_png_crc_hmac_free',
    warning:'Signed preview PNG pixels were verified; image source authenticity and manufacturing mm still require independent evidence'
  };
}

const direct=process.argv[1]&&
  pathToFileURL(process.argv[1]).href===import.meta.url;
if(direct){
  try{
    if(process.argv.length!==7)
      throw new Error('ARGS_INVALID');
    const [, ,manifestPath,signaturePath,keyPath,pin,listPath]=process.argv;
    const sources=[manifestPath,signaturePath,keyPath,listPath];
    const limits=[8_000_000,128,8192,256_000];
    const bytes=[];
    for(let i=0;i<sources.length;i++){
      const st=await lstat(sources[i]);
      if(!st.isFile()||st.isSymbolicLink()||
         st.size<1||st.size>limits[i])
        throw new Error('INPUT_FILE_INVALID');
      bytes.push(await readFile(sources[i]));
    }
    let list;
    try{list=JSON.parse(bytes[3].toString('utf8'))}
    catch{throw new Error('PRIVATE_FILE_LIST_INVALID')}
    if(!list||list.schema!=='printcheck.vision.preview-paths.local.v1'||
       !Array.isArray(list.ordered_paths)||
       Object.keys(list).some(k=>!['schema','ordered_paths'].includes(k)))
      throw new Error('PRIVATE_FILE_LIST_INVALID');
    const result=await verifySignedCohortImageFiles({
      cohortManifestBytes:bytes[0],cohortSignatureBytes:bytes[1],
      trustedPublicKeyPem:bytes[2].toString('utf8'),
      trustedSpkiSha256:pin,sourcePaths:list.ordered_paths
    });
    process.stdout.write(JSON.stringify(result,null,2)+'\n');
    if(result.status!=='SIGNED_COHORT_PREVIEW_BYTES_RECONSTRUCTED')
      process.exitCode=2;
  }catch{
    process.stderr.write(
      'PRIVATE_IMAGE_AUDIT_REFUSED: check local signed cohort, trust pin and ordered original PNG files\n'
    );
    process.exitCode=2;
  }
}
