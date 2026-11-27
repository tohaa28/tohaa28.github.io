import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,generateKeyPairSync,sign} from 'node:crypto';
import {mkdtemp,writeFile,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {decodeTrustedPngBytes} from '../vision/dataset/strict-png-decoder.mjs';
import {fingerprintRgba} from '../vision/dataset/visual-fingerprint.mjs';
import {verifySignedCohortImageFiles}
  from '../vision/dataset/verify-cohort-images.mjs';
import {makeSyntheticPng,syntheticO,syntheticT}
  from './helpers/synthetic-png.mjs';

const sha=b=>createHash('sha256').update(b).digest('hex');
const h=n=>n.toString(16).padStart(64,'0');
const pngA=makeSyntheticPng(128,128,syntheticO);
const pngB=makeSyntheticPng(128,128,syntheticT);
const fingerprint=b=>fingerprintRgba(decodeTrustedPngBytes(b));
const obj=(a,b)=>({
  schema:'printcheck.vision.cohort.v1',
  predictions_hidden:true,frozen_for_holdout:true,
  sampling_plan_sha256:h(313),
  entries:[
    {image_sha256:sha(a),artwork_sha256:h(10),family_sha256:h(11),
     split:'train',source_type:'svg',technology_code:'UV1',
     fingerprint:fingerprint(pngA)},
    {image_sha256:sha(b),artwork_sha256:h(12),family_sha256:h(13),
     split:'test',source_type:'svg',technology_code:'UV1',
     fingerprint:fingerprint(pngB)}
  ]
});
const audit=async (folder,work)=>{
  const aPath=join(folder,'a.png'),bPath=join(folder,'b.png');
  await writeFile(aPath,pngA);await writeFile(bPath,pngB);
  const cohort=obj(pngA,pngB),signer=generateKeyPairSync('ed25519');
  const pack=(custom=cohort)=> {
    const cohortManifestBytes=Buffer.from(JSON.stringify(custom));
    return {
      cohortManifestBytes,
      cohortSignatureBytes:sign(null,cohortManifestBytes,signer.privateKey),
      trustedPublicKeyPem:signer.publicKey.export({type:'spki',format:'pem'}),
      trustedSpkiSha256:sha(signer.publicKey.export({type:'spki',format:'der'})),
      sourcePaths:[aPath,bPath]
    };
  };
  return work({pack,cohort,aPath,bPath});
};
const privateFixture=async fn=>{
  const dir=await mkdtemp(join(tmpdir(),'pcv-verified-raw-png-'));
  try{return await audit(dir,fn)}
  finally{await rm(dir,{recursive:true,force:true})}
};
test('sequential private verifier checks both signed cohort PNG files exactly',()=>privateFixture(async({pack})=>{
  const result=await verifySignedCohortImageFiles(pack());
  assert.equal(result.status,'SIGNED_COHORT_PREVIEW_BYTES_RECONSTRUCTED',result.reason);
  assert.equal(result.checked_images,2);
  assert.equal(result.checked_compressed_bytes,pngA.length+pngB.length);
  assert.equal(result.production_approved,false);
  assert.equal(result.gifts_order_provenance_verified,false);
  assert.equal(result.physical_print_scale_verified,false);
  assert.ok(!JSON.stringify(result).includes(h(10)));
}));
test('swapping original files fails exact SHA even with correct signed manifest',()=>privateFixture(async({pack})=>{
  const args=pack();args.sourcePaths.reverse();
  const result=await verifySignedCohortImageFiles(args);
  assert.equal(result.reason,'SIGNED_SOURCE_SHA_MISMATCH');
}));
test('original source modification fails with unchanged valid signature',()=>privateFixture(async({pack,aPath})=>{
  await writeFile(aPath,pngB);
  const result=await verifySignedCohortImageFiles(pack());
  assert.equal(result.reason,'SIGNED_SOURCE_SHA_MISMATCH');
}));
test('modified visual gradient in a newly signed manifest still fails source reconstruction',()=>privateFixture(async({pack,cohort})=>{
  const changed=structuredClone(cohort);
  changed.entries[0].fingerprint.orientations[0].gradient='ffffffffffffffff';
  const result=await verifySignedCohortImageFiles(pack(changed));
  assert.equal(result.reason,'SIGNED_FINGERPRINT_RECONSTRUCTION_MISMATCH');
}));
test('unsupported source type with valid original SHA is MANUAL not silently skipped',()=>privateFixture(async({pack,cohort,bPath})=>{
  const bad=Buffer.from([0xff,0xd8,0xff,0xe0,1,2,3,4,5]);
  await writeFile(bPath,bad);
  const changed=structuredClone(cohort);
  changed.entries[1].image_sha256=sha(bad);
  const result=await verifySignedCohortImageFiles(pack(changed));
  assert.equal(result.reason,'LOCAL_IMAGE_FILE_UNSUPPORTED');
}));
test('missing file, extra file or link to another directory is rejected',()=>privateFixture(async({pack,aPath,bPath})=>{
  let args=pack();args.sourcePaths=[aPath];
  assert.equal((await verifySignedCohortImageFiles(args)).reason,
    'LOCAL_SOURCE_PATHS_INCOMPLETE');
  args=pack();args.sourcePaths=[aPath,bPath,'unexpected.png'];
  assert.equal((await verifySignedCohortImageFiles(args)).reason,
    'LOCAL_SOURCE_PATHS_INCOMPLETE');
  args=pack();args.sourcePaths[0]='does-not-exist.png';
  assert.equal((await verifySignedCohortImageFiles(args)).reason,
    'LOCAL_SOURCE_IO_OR_DECODING_FAILED');
  const link=aPath+'-link';
  await symlink(aPath,link);
  args=pack();args.sourcePaths[0]=link;
  assert.equal((await verifySignedCohortImageFiles(args)).reason,
    'LOCAL_IMAGE_FILE_UNSUPPORTED');
}));
test('signed holdout collision blocks sequential audit before trusting image bytes',()=>privateFixture(async({pack,cohort})=>{
  const changed=structuredClone(cohort);
  changed.entries[0].family_sha256=changed.entries[1].family_sha256;
  const r=await verifySignedCohortImageFiles(pack(changed));
  assert.equal(r.reason,'SIGNED_COHORT_NOT_SCREENED');
}));
test('signature or pre-pinned key cannot be replaced by an attacker',()=>privateFixture(async({pack})=>{
  const args=pack();args.cohortSignatureBytes=Buffer.alloc(64);
  assert.equal((await verifySignedCohortImageFiles(args)).reason,
    'SIGNED_COHORT_NOT_SCREENED');
  const another=pack();another.trustedSpkiSha256=h(88);
  assert.equal((await verifySignedCohortImageFiles(another)).reason,
    'SIGNED_COHORT_NOT_SCREENED');
}));
