/**
 * C3B.3.I -- verify exact local PNG bytes against every claimed visual
 * fingerprint in the already signed cohort. No trust in supplied JSON
 * fingerprint alone, no network, no upload, no production acceptance.
 *
 * Source image bytes are supplied in the exact same order as cohort.entries.
 * Each byte SHA must equal the corresponding source image SHA. PNG decoding
 * is deliberately narrow; unsupported formats cause MANUAL for the cohort.
 */
import {createHash} from 'node:crypto';
import {decodeTrustedPngBytes} from './strict-png-decoder.mjs';
import {fingerprintRgba} from './visual-fingerprint.mjs';

const sha=b=>createHash('sha256').update(b).digest('hex');
const err=reason=>({
  schema:'printcheck.vision.image-provenance-check.v1',
  status:'MANUAL',reason,production_approved:false
});
export function verifyCohortImageBindings({
  cohortManifestBytes,imageBytesList
}={}){
  if(!(Buffer.isBuffer(cohortManifestBytes)||
       cohortManifestBytes instanceof Uint8Array)||
     cohortManifestBytes.length===0||
     cohortManifestBytes.length>8_000_000)
    return err('COHORT_MANIFEST_BYTES_INVALID');
  let manifest;
  try{manifest=JSON.parse(Buffer.from(cohortManifestBytes).toString('utf8'))}
  catch{return err('COHORT_MANIFEST_JSON_INVALID')}
  if(manifest?.schema!=='printcheck.vision.cohort.v1'||
     !Array.isArray(manifest.entries)||manifest.entries.length<2||
     manifest.entries.length>1024||!Array.isArray(imageBytesList)||
     imageBytesList.length!==manifest.entries.length)
    return err('COHORT_SOURCE_COVERAGE_INCOMPLETE');
  let seen=0,total=0;
  for(let i=0;i<manifest.entries.length;i++){
    const entry=manifest.entries[i],bytes=imageBytesList[i];
    if(!(Buffer.isBuffer(bytes)||bytes instanceof Uint8Array)||
       bytes.length===0||bytes.length>25_000_000)
      return err('SOURCE_IMAGE_BYTES_MISSING_OR_TOO_LARGE');
    if(typeof entry?.image_sha256!=='string'||
       !/^[a-f0-9]{64}$/i.test(entry.image_sha256)||
       sha(bytes)!==entry.image_sha256.toLowerCase())
      return err('COHORT_IMAGE_SHA_MISMATCH');
    const decoded=decodeTrustedPngBytes(bytes);
    if(decoded.status!=='DECODED_STRICT_PNG_ONLY')
      return err('IMAGE_DECODER_UNSUPPORTED_OR_DAMAGED');
    const reconstructed=fingerprintRgba({
      data:decoded.data,width:decoded.width,height:decoded.height
    });
    if(reconstructed.status!=='ADVISORY_SIGNATURE_ONLY')
      return err('FINGERPRINT_NOT_RECONSTRUCTIBLE');
    // We compare the ENTIRE deterministic contract, not merely silhouette.
    // An attacker must not smuggle a different gradient, crop or dimensions
    // while retaining one plausible orientation hash.
    if(!entry.fingerprint||
       JSON.stringify(entry.fingerprint)!==JSON.stringify(reconstructed))
      return err('SIGNED_FINGERPRINT_NOT_FROM_SOURCE_IMAGE');
    seen++;
    total+=bytes.length;
  }
  return {
    schema:'printcheck.vision.image-provenance-check.v1',
    status:'ALL_PREVIEW_FINGERPRINTS_RECONSTRUCTED',
    production_approved:false,
    verified_image_count:seen,
    input_bytes_checked:total,
    source_sha256_verified:true,
    source_image_pixels_redecoded:true,
    original_artwork_proven:false,
    external_gifts_order_proven:false,
    color_profile_supported:false,
    unsupported_formats_fail_closed:true,
    warning:'PNG byte integrity is verified; visual fingerprints remain approximate and are not production metrology'
  };
}
