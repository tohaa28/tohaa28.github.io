import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,generateKeyPairSync,sign} from 'node:crypto';
import {mkdtemp,writeFile,symlink,readFile,rm} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {verifyRenderFiles} from '../vision/dataset/verify-render-files.mjs';
import {makeSyntheticPng,syntheticT} from './helpers/synthetic-png.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex');
const json=x=>Buffer.from(JSON.stringify(x,null,2)+'\n');
const pt=m=>p=>[m[0]*p[0]+m[2]*p[1]+m[4],
  m[1]*p[0]+m[3]*p[1]+m[5]];
const source=Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="100mm" height="50mm" viewBox="0 0 100 50"><path d="M10 10L80 10L80 40Z" fill="#000000"/></svg>'
);
const preview=makeSyntheticPng(200,100,syntheticT);
const order=Buffer.from('synthetic private order attestation bytes');
async function localFixture(fn){
  const dir=await mkdtemp(join(tmpdir(),'pcv-mm-private-'));
  try{
    const files=['artwork.svg','preview.png','order-evidence.bin',
      'render-receipt.json','render.sig','render-public.pem'];
    const paths=files.map(f=>join(dir,f));
    const pts=[[0,0],[100,0],[0,50],[100,50],[50,25]];
    const px=[2,0,0,2,0,0],mm=[1,0,0,1,0,0];
    const receipt={
      schema:'printcheck.vision.render-calibration.v1',
      source_sha256:sha(source),preview_sha256:sha(preview),
      order_evidence_sha256:sha(order),source_format:'svg',
      page_index:0,render_engine:{
        engine_id:'test-only-svg-engine',engine_version:'v0.1',
        engine_binary_sha256:sha(Buffer.from('fixture engine'))
      },
      preview_pixel_dimensions:[200,100],
      source_page_box:[0,0,100,50],pdf_user_unit:null,
      page_rotation_degrees:0,source_document_size_mm:[100,50],
      source_to_preview_px:px,source_to_field_mm:mm,
      field_size_mm:[100,50],mirror_authorized:false,
      color_pipeline:{
        source_color_state:'explicit_srgb',
        output_encoding:'unprofiled_rgb8',
        conversion_profile_sha256:sha(Buffer.from('synthetic RGB policy'))
      },
      anchors:pts.map(source_xy=>({
        source_xy,preview_xy:pt(px)(source_xy),
        field_mm_xy:pt(mm)(source_xy)
      }))
    };
    const signer=generateKeyPairSync('ed25519');
    const signedBytes=json(receipt);
    const signature=sign(null,signedBytes,signer.privateKey);
    const publicPem=signer.publicKey.export({type:'spki',format:'pem'});
    const pin=sha(signer.publicKey.export({type:'spki',format:'der'}));
    const bytes=[source,preview,order,signedBytes,signature,publicPem];
    for(let i=0;i<files.length;i++)await writeFile(paths[i],bytes[i]);
    const args={
      sourcePath:paths[0],previewPath:paths[1],orderPath:paths[2],
      receiptPath:paths[3],signaturePath:paths[4],
      publicKeyPath:paths[5],trustedSpkiSha256:pin
    };
    return await fn({dir,paths,args,receipt,signature,pin});
  }finally{await rm(dir,{recursive:true,force:true})}
}
test('private render source, PNG and field evidence verify through local file API',()=>localFixture(async({args})=>{
  const out=await verifyRenderFiles(args);
  assert.equal(out.status,'SIGNED_SOURCE_PREVIEW_AND_MM_AFFINE_CONSISTENT_ONLY',out.reason);
  assert.equal(out.print_scale_proven,false);
  assert.equal(out.gifts_order_evidence_authenticity_proven,false);
}));
test('local CLI verifies only trusted raw files and redacts sensitive paths',()=>localFixture(async({args,paths})=>{
  const proc=spawnSync(process.execPath,[
    'vision/dataset/verify-render-files.mjs',...paths,args.trustedSpkiSha256
  ],{encoding:'utf8',timeout:15000,maxBuffer:250000});
  assert.equal(proc.status,0,proc.stderr);
  const output=JSON.parse(proc.stdout);
  assert.equal(output.status,'SIGNED_SOURCE_PREVIEW_AND_MM_AFFINE_CONSISTENT_ONLY');
  for(const path of paths)assert.equal(proc.stdout.includes(path),false);
  assert.equal(proc.stdout.includes(args.trustedSpkiSha256),false);
}));
test('modified order evidence file fails even when signed manifest stays intact',()=>localFixture(async({args,paths})=>{
  await writeFile(paths[2],Buffer.from('attacker replaced source'));
  const result=await verifyRenderFiles(args);
  assert.equal(result.reason,'RENDER_CHAIN_SOURCE_DIGEST_MISMATCH');
}));
test('untrusted key pin and symlink cannot be used as source evidence',()=>localFixture(async({args,paths})=>{
  assert.equal((await verifyRenderFiles({
    ...args,trustedSpkiSha256:sha(Buffer.from('attacker'))
  })).reason,'RENDER_TRUST_PIN_MISMATCH');
  const linked=paths[2]+'-link';
  await symlink(paths[2],linked);
  assert.equal((await verifyRenderFiles({
    ...args,orderPath:linked
  })).reason,'RENDER_FILE_UNSUPPORTED_OR_MISSING');
}));
test('file CLI rejects nonexistent or oversized inputs without leaking filenames',()=>localFixture(async({args,paths})=>{
  assert.equal((await verifyRenderFiles({
    ...args,previewPath:'definitely-missing-preview.png'
  })).reason,'RENDER_LOCAL_IO_ERROR');
  await writeFile(paths[4],Buffer.alloc(200,17));
  assert.equal((await verifyRenderFiles(args)).reason,
    'RENDER_FILE_UNSUPPORTED_OR_MISSING');
}));
