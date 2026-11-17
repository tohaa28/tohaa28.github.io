import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,generateKeyPairSync,sign} from 'node:crypto';
import {decodeTrustedPngBytes} from '../vision/dataset/strict-png-decoder.mjs';
import {fingerprintRgba} from '../vision/dataset/visual-fingerprint.mjs';
import {verifyCohortImageBindings}
  from '../vision/dataset/cohort-image-provenance.mjs';
import {verifyFrozenHoldout} from '../vision/dataset/cohort-leakage-audit.mjs';
import {makeSyntheticPng,syntheticT,syntheticO}
  from './helpers/synthetic-png.mjs';

const hash=b=>createHash('sha256').update(b).digest('hex');
const hx=n=>n.toString(16).padStart(64,'0');
const A=makeSyntheticPng(192,192,syntheticT);
const B=makeSyntheticPng(192,192,syntheticO);
const calc=bytes=>{
  const decoded=decodeTrustedPngBytes(bytes);
  assert.equal(decoded.status,'DECODED_STRICT_PNG_ONLY',decoded.reason);
  const fp=fingerprintRgba(decoded);
  assert.equal(fp.status,'ADVISORY_SIGNATURE_ONLY',fp.reason);
  return fp;
};
const FA=calc(A),FB=calc(B);
const entry=(id,split,image,fingerprint)=>({
  image_sha256:hash(image),artwork_sha256:hx(1000+id),
  family_sha256:hx(2000+id),technology_code:'UV1',
  source_type:'svg',split,fingerprint
});
const cohort=()=>({
  schema:'printcheck.vision.cohort.v1',
  frozen_for_holdout:true,predictions_hidden:true,
  sampling_plan_sha256:hx(555),
  entries:[entry(1,'train',A,FA),entry(2,'test',B,FB)]
});
const serialize=o=>Buffer.from(JSON.stringify(o,null,2)+'\n');
test('both signed cohort source images are decoded and fingerprints recomputed',()=>{
  const manifest=serialize(cohort());
  const r=verifyCohortImageBindings({
    cohortManifestBytes:manifest,imageBytesList:[A,B]
  });
  assert.equal(r.status,'ALL_PREVIEW_FINGERPRINTS_RECONSTRUCTED',r.reason);
  assert.equal(r.verified_image_count,2);
  assert.equal(r.input_bytes_checked,A.length+B.length);
  assert.equal(r.source_sha256_verified,true);
  assert.equal(r.original_artwork_proven,false);
  assert.equal(r.production_approved,false);
});
test('substituting original image bytes at a different index fails SHA binding',()=>{
  const r=verifyCohortImageBindings({
    cohortManifestBytes:serialize(cohort()),imageBytesList:[B,A]
  });
  assert.equal(r.reason,'COHORT_IMAGE_SHA_MISMATCH');
});
test('well-formed but forged visual fingerprint fails despite signed metadata',()=>{
  const forged=cohort();
  forged.entries[0].fingerprint=structuredClone(FA);
  forged.entries[0].fingerprint.orientations[0].gradient=
    'ffffffffffffffff';
  const bundle=serialize(forged);
  const {publicKey,privateKey}=generateKeyPairSync('ed25519');
  const pub=publicKey.export({format:'pem',type:'spki'});
  const pin=hash(publicKey.export({format:'der',type:'spki'}));
  const sig=sign(null,bundle,privateKey);
  assert.equal(verifyFrozenHoldout({
    manifestBytes:bundle,signatureBytes:sig,
    trustedPublicKeyPem:pub,trustedSpkiSha256:pin
  }).status,'SCREENED_COHORT_ONLY');
  assert.equal(verifyCohortImageBindings({
    cohortManifestBytes:bundle,imageBytesList:[A,B]
  }).reason,'SIGNED_FINGERPRINT_NOT_FROM_SOURCE_IMAGE');
});
test('an injected extra image fingerprint field is not silently ignored',()=>{
  const forged=cohort();
  forged.entries[1].fingerprint.customer_order='leak';
  const r=verifyCohortImageBindings({
    cohortManifestBytes:serialize(forged),imageBytesList:[A,B]
  });
  assert.equal(r.reason,'SIGNED_FINGERPRINT_NOT_FROM_SOURCE_IMAGE');
});
test('a valid SHA of an unsupported JPEG still requires manual handling',()=>{
  const jpeg=Buffer.from([0xff,0xd8,0xff,0xe0,0,0,0,0]);
  const m=cohort();m.entries[1].image_sha256=hash(jpeg);
  const r=verifyCohortImageBindings({
    cohortManifestBytes:serialize(m),imageBytesList:[A,jpeg]
  });
  assert.equal(r.reason,'IMAGE_DECODER_UNSUPPORTED_OR_DAMAGED');
});
test('missing images cannot be treated as checked by signatures or cached claims',()=>{
  const bytes=serialize(cohort());
  for(const list of [undefined,[A],[A,null]]){
    const r=verifyCohortImageBindings({
      cohortManifestBytes:bytes,imageBytesList:list
    });
    assert.equal(r.status,'MANUAL');
  }
});
test('damaged PNG content fails even if the attacker changes signed image SHA',()=>{
  const data=Buffer.from(A);data[data.length-16]^=0x11;
  const m=cohort();m.entries[0].image_sha256=hash(data);
  assert.equal(verifyCohortImageBindings({
    cohortManifestBytes:serialize(m),imageBytesList:[data,B]
  }).reason,'IMAGE_DECODER_UNSUPPORTED_OR_DAMAGED');
});
test('source byte hash alone is insufficient to certify printer mm or original SVG',()=>{
  const result=verifyCohortImageBindings({
    cohortManifestBytes:serialize(cohort()),imageBytesList:[A,B]
  });
  assert.equal(result.status,'ALL_PREVIEW_FINGERPRINTS_RECONSTRUCTED');
  assert.equal(result.external_gifts_order_proven,false);
  assert.equal(result.original_artwork_proven,false);
  assert.equal(result.color_profile_supported,false);
});
