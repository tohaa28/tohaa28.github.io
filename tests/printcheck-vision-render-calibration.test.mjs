import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,generateKeyPairSync,sign} from 'node:crypto';
import {verifySignedRenderCalibration}
  from '../vision/dataset/render-calibration-attestation.mjs';
import {makeSyntheticPng,syntheticT} from './helpers/synthetic-png.mjs';

const sha=b=>createHash('sha256').update(b).digest('hex');
const syntheticPng=makeSyntheticPng(200,100,syntheticT);
const svg=Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="100mm" height="50mm" viewBox="0 0 100 50"><path d="M10 10L80 10L80 30Z" fill="#000000"/></svg>'
);
const order=Buffer.from('synthetic-only independent order snapshot');
const location=[ [0,0],[100,0],[0,50],[100,50],[50,25] ];
const pt=(m,[x,y])=>[m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]];
const render=()=>({
  schema:'printcheck.vision.render-calibration.v1',
  source_sha256:sha(svg),preview_sha256:sha(syntheticPng),
  order_evidence_sha256:sha(order),
  source_format:'svg',page_index:0,
  render_engine:{
    engine_id:'isolated-test-renderer',engine_version:'0.1.0',
    engine_binary_sha256:sha(Buffer.from('synthetic renderer identity'))
  },
  preview_pixel_dimensions:[200,100],source_page_box:[0,0,100,50],
  pdf_user_unit:null,page_rotation_degrees:0,
  source_document_size_mm:[100,50],
  source_to_preview_px:[2,0,0,2,0,0],
  source_to_field_mm:[1,0,0,1,0,0],
  field_size_mm:[100,50],mirror_authorized:false,
  color_pipeline:{
    source_color_state:'explicit_srgb',
    output_encoding:'unprofiled_rgb8',
    conversion_profile_sha256:sha(Buffer.from('synthetic test color policy'))
  },
  anchors:location.map(source_xy=>({
    source_xy,preview_xy:pt([2,0,0,2,0,0],source_xy),
    field_mm_xy:source_xy.slice()
  }))
});
const json=o=>Buffer.from(JSON.stringify(o,null,2)+'\n');
const pair=generateKeyPairSync('ed25519');
const key=pair.publicKey.export({format:'pem',type:'spki'});
const pin=sha(pair.publicKey.export({format:'der',type:'spki'}));
function input(changes={},sourceBytes=svg,previewPngBytes=syntheticPng,
  orderEvidenceBytes=order){
  const receipt=Object.assign(render(),changes);
  const receiptBytes=json(receipt);
  return {
    receiptBytes,signatureBytes:sign(null,receiptBytes,pair.privateKey),
    sourceBytes,previewPngBytes,orderEvidenceBytes,
    trustedPublicKeyPem:key,trustedSpkiSha256:pin
  };
}
test('signed synthetic SVG viewport, preview SHA, five anchor coordinates and mm matrix agree',()=>{
  const r=verifySignedRenderCalibration(input());
  assert.equal(r.status,'SIGNED_SOURCE_PREVIEW_AND_MM_AFFINE_CONSISTENT_ONLY',r.reason);
  assert.equal(r.calibration_anchor_count,5);
  assert.deepEqual(r.physical_field_size_mm,[100,50]);
  assert.equal(r.byte_sha256_binds_source_preview_order,true);
  assert.equal(r.print_scale_proven,false);
  assert.equal(r.visual_render_equivalence_proven,false);
  assert.equal(r.gifts_order_evidence_authenticity_proven,false);
  assert.equal(r.production_approved,false);
});
test('changed SVG bytes, rendered preview or order evidence is rejected even with intact signature',()=>{
  for(const overwritten of [
    {sourceBytes:Buffer.from('different source')},
    {previewPngBytes:makeSyntheticPng(200,100,()=>true)},
    {orderEvidenceBytes:Buffer.from('different signed order')},
  ]){
    const r=verifySignedRenderCalibration({...input(),...overwritten});
    assert.equal(r.status,'MANUAL');
    assert.ok(/DIGEST|PNG/.test(r.reason),r.reason);
  }
});
test('changed signature, forged signing key or wrong independent trust pin fail closed',()=>{
  assert.equal(verifySignedRenderCalibration({
    ...input(),signatureBytes:Buffer.alloc(64)
  }).reason,'RENDER_SIGNATURE_INVALID');
  const attacker=generateKeyPairSync('ed25519'),base=input();
  assert.equal(verifySignedRenderCalibration({
    ...base,signatureBytes:sign(null,base.receiptBytes,attacker.privateKey),
    trustedPublicKeyPem:attacker.publicKey.export({type:'spki',format:'pem'})
  }).reason,'RENDER_TRUST_PIN_MISMATCH');
  assert.equal(verifySignedRenderCalibration({
    ...base,trustedSpkiSha256:sha(Buffer.from('wrong pin'))
  }).reason,'RENDER_TRUST_PIN_MISMATCH');
});
test('SVG independently parsed physical width/viewBox must match attested report',()=>{
  assert.equal(verifySignedRenderCalibration(input({
    source_page_box:[0,0,200,50]
  })).reason,'SVG_SOURCE_VIEWPORT_CONFLICT');
  assert.equal(verifySignedRenderCalibration(input({
    source_document_size_mm:[101,50]
  })).reason,'SVG_SOURCE_VIEWPORT_CONFLICT');
  const malformed=Buffer.from(
    '<!DOCTYPE svg [ <!ENTITY a SYSTEM "file:///private" > ]>'+
    '<svg xmlns="http://www.w3.org/2000/svg" width="100mm" height="50mm" viewBox="0 0 100 50"></svg>'
  );
  const r=render();r.source_sha256=sha(malformed);
  assert.equal(verifySignedRenderCalibration(input(r,malformed)).reason,
    'SVG_SOURCE_VIEWPORT_NOT_INDEPENDENTLY_PARSED');
});
test('misleading preview viewport offset or scale is rejected',()=>{
  assert.equal(verifySignedRenderCalibration(input({
    source_to_preview_px:[2,0,0,2,5,0]
  })).reason,'PREVIEW_VIEWPORT_MATRIX_INVALID');
  assert.equal(verifySignedRenderCalibration(input({
    source_to_preview_px:[2.2,0,0,2,0,0]
  })).reason,'PREVIEW_VIEWPORT_MATRIX_INVALID');
});
test('nonuniform scale, shear or unauthorized mirrored print placement is rejected',()=>{
  for(const m of [
    [1.2,0,0,1,0,0],[1,0.2,0,1,0,0],
    [-1,0,0,1,100,0]
  ]){
    assert.equal(verifySignedRenderCalibration(input({
      source_to_field_mm:m
    })).reason,'NON_UNIFORM_SHEAR_OR_UNAUTHORIZED_MIRROR');
  }
});
test('mirror may be acknowledged but cannot escape field',()=>{
  const original=render(),matrix=[-1,0,0,1,100,0];
  const anchors=location.map(source_xy=>({
    source_xy,
    preview_xy:pt(original.source_to_preview_px,source_xy),
    field_mm_xy:pt(matrix,source_xy)
  }));
  const r=verifySignedRenderCalibration(input({
    source_to_field_mm:matrix,mirror_authorized:true,anchors
  }));
  assert.equal(r.status,'SIGNED_SOURCE_PREVIEW_AND_MM_AFFINE_CONSISTENT_ONLY',r.reason);
  assert.equal(r.print_scale_proven,false);
});
test('disagreeing control points and insufficient source-space coverage fail closed',()=>{
  const changed=render();
  changed.anchors[4].field_mm_xy=[99,99];
  assert.equal(verifySignedRenderCalibration(input(changed)).reason,
    'LANDMARK_RESIDUAL_TOO_HIGH');
  const clustered=render();
  const pts=[[0,0],[1,0],[0,1],[1,1],[.5,.5]];
  clustered.anchors=pts.map(source_xy=>({
    source_xy,preview_xy:pt(clustered.source_to_preview_px,source_xy),
    field_mm_xy:source_xy
  }));
  assert.equal(verifySignedRenderCalibration(input(clustered)).reason,
    'ANCHOR_SPREAD_INSUFFICIENT');
  const repeated=render();
  repeated.anchors[4]=structuredClone(repeated.anchors[0]);
  assert.equal(verifySignedRenderCalibration(input(repeated)).reason,
    'DUPLICATE_SOURCE_ANCHOR');
});
test('page entirely outside printing field is refused even if central points are signed',()=>{
  const original=render(),m=[1,0,0,1,20,0];
  const anchors=original.anchors.map(a=>({
    ...a,field_mm_xy:pt(m,a.source_xy)
  }));
  assert.equal(verifySignedRenderCalibration(input({
    source_to_field_mm:m,anchors
  })).reason,'ANCHOR_OUTSIDE_PRINT_FIELD');
});
test('fake PDF header and trailer is distinguishable from actual PDF parsing',()=>{
  const sourceBytes=Buffer.from('%PDF-1.7\n% minimal test fixture, not an actual parsed PDF\n%%EOF');
  const receipt=render(),pageBox=[0,0,72,36];
  const s=200/72;
  const r={
    ...receipt,source_sha256:sha(sourceBytes),source_format:'pdf',
    source_page_box:pageBox,pdf_user_unit:1,page_rotation_degrees:0,
    source_document_size_mm:[25.4,12.7],
    field_size_mm:[25.4,12.7],
    source_to_preview_px:[s,0,0,-s,0,36*s],
    source_to_field_mm:[25.4/72,0,0,25.4/72,0,0],
  };
  const anchors=[[0,0],[72,0],[0,36],[72,36],[36,18]];
  r.anchors=anchors.map(source_xy=>({
    source_xy,preview_xy:pt(r.source_to_preview_px,source_xy),
    field_mm_xy:pt(r.source_to_field_mm,source_xy)
  }));
  const result=verifySignedRenderCalibration(input(r,sourceBytes));
  assert.equal(result.status,'SIGNED_SOURCE_PREVIEW_AND_MM_AFFINE_CONSISTENT_ONLY',result.reason);
  assert.equal(result.pdf_paint_content_independently_verified,false);
  // UserUnit is part of the actual document page metadata. Self-reported
  // mismatches are forbidden; real PDF bytes are NOT parsed here.
  const broken={...r,source_document_size_mm:[25.4,25.4]};
  assert.equal(verifySignedRenderCalibration(input(broken,sourceBytes)).reason,
    'PDF_USERUNIT_PHYSICAL_SIZE_CONFLICT');
});
test('PDF rotated viewport expected matrix handles page rotation without fake page DPI',()=>{
  const sourceBytes=Buffer.from('%PDF-1.7\n%%EOF');
  const s=200/72;
  const m=[0,s,s,0,0,0];
  // A PDF page 36x72, rotated 90°, has pixel viewport 200x100.
  // Coordinates after rotation [x,y] -> [s*y,s*x], positive downward.
  const p=[0,0,36,72],receipt=render();
  const r={...receipt,source_sha256:sha(sourceBytes),
    source_format:'pdf',source_page_box:p,
    source_document_size_mm:[12.7,25.4],
    field_size_mm:[12.7,25.4],pdf_user_unit:1,
    page_rotation_degrees:90,source_to_preview_px:m,
    source_to_field_mm:[25.4/72,0,0,25.4/72,0,0]
  };
  // This deliberate inconsistent sample checks the rotation handling:
  // 36x72 after 90° would require 200x100 only if scale=200/72=100/36.
  const pts=[[0,0],[36,0],[0,72],[36,72],[18,36]];
  r.anchors=pts.map(source_xy=>({
    source_xy,preview_xy:pt(m,source_xy),
    field_mm_xy:pt(r.source_to_field_mm,source_xy)
  }));
  const result=verifySignedRenderCalibration(input(r,sourceBytes));
  assert.equal(result.status,'SIGNED_SOURCE_PREVIEW_AND_MM_AFFINE_CONSISTENT_ONLY',result.reason);
  assert.equal(result.print_scale_proven,false);
});
test('unapproved render engine/color contract and unsupported PNG fail closed',()=>{
  const invalid=render();
  invalid.color_pipeline.output_encoding='CMYK';
  assert.equal(verifySignedRenderCalibration(input(invalid)).reason,
    'RENDER_RECEIPT_CONTRACT_INVALID');
  const svgJpeg=Buffer.from([255,216,255,224]);
  const rr=render();rr.preview_sha256=sha(svgJpeg);
  assert.equal(verifySignedRenderCalibration(input(rr,svg,svgJpeg)).reason,
    'RENDER_PREVIEW_PNG_UNSUPPORTED');
});
