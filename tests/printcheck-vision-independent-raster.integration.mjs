/**
 * Actual native/WASM independent renderer integration tests.
 * Installed only in isolated vision/raster, not the production workbench.
 * Run: node tests/printcheck-vision-independent-raster.integration.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,generateKeyPairSync,sign} from 'node:crypto';
import {decodeTrustedPngBytes} from '../vision/dataset/strict-png-decoder.mjs';
import {verifyIndependentRasterReplay}
  from '../vision/raster/verify-independent-replay.mjs';
import {rerenderSvgPathOnly,rerenderPdfSimplePaths,checkReplaySvgSubset}
  from '../vision/raster/replay-engines.mjs';
import {makeSyntheticPng} from './helpers/synthetic-png.mjs';
import {makeSyntheticBlackPdf} from './helpers/synthetic-simple-pdf.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
const keyPair=generateKeyPairSync('ed25519');
const pem=keyPair.publicKey.export({type:'spki',format:'pem'});
const pin=hash(keyPair.publicKey.export({type:'spki',format:'der'}));
const png=makeSyntheticPng(144,72,()=>true);
const svg=Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="72mm" height="36mm" viewBox="0 0 72 36">'+
  '<path d="M0 0 L72 0 L72 36 L0 36 Z" fill="#000000"/></svg>'
);
const pdf=makeSyntheticBlackPdf();
const order=Buffer.from('test-only, no actual order');
const points=[[0,0],[72,0],[0,36],[72,36],[36,18]];
const xy=(matrix,[x,y])=>[
  matrix[0]*x+matrix[2]*y+matrix[4],
  matrix[1]*x+matrix[3]*y+matrix[5]
];
function signedInput(sourceFormat='svg',sourceBytes=svg,previewPngBytes=png){
  const isPdf=sourceFormat==='pdf';
  const sourceToPx=isPdf?[2,0,0,-2,0,72]:[2,0,0,2,0,0];
  const sourceToMm=isPdf?[25.4/72,0,0,25.4/72,0,0]:
    [1,0,0,1,0,0];
  const receipt={
    schema:'printcheck.vision.render-calibration.v1',
    source_sha256:hash(sourceBytes),preview_sha256:hash(previewPngBytes),
    order_evidence_sha256:hash(order),
    source_format:sourceFormat,page_index:0,
    render_engine:{
      engine_id:'synthetic-untrusted-preview-generator',
      engine_version:'0.0.1',
      engine_binary_sha256:hash(Buffer.from('test-renderer'))
    },
    preview_pixel_dimensions:[144,72],source_page_box:[0,0,72,36],
    pdf_user_unit:isPdf?1:null,
    page_rotation_degrees:0,
    source_document_size_mm:isPdf?[25.4,12.7]:[72,36],
    source_to_preview_px:sourceToPx,
    source_to_field_mm:sourceToMm,
    field_size_mm:isPdf?[25.4,12.7]:[72,36],
    mirror_authorized:false,
    color_pipeline:{
      source_color_state:'explicit_srgb',
      output_encoding:'unprofiled_rgb8',
      conversion_profile_sha256:hash(Buffer.from('synthetic colour context'))
    },
    anchors:points.map(source_xy=>({
      source_xy,preview_xy:xy(sourceToPx,source_xy),
      field_mm_xy:xy(sourceToMm,source_xy)
    }))
  };
  const receiptBytes=Buffer.from(JSON.stringify(receipt)+'\n');
  return {
    sourceBytes,previewPngBytes,orderEvidenceBytes:order,
    receiptBytes,signatureBytes:sign(null,receiptBytes,keyPair.privateKey),
    trustedPublicKeyPem:pem,trustedSpkiSha256:pin
  };
}
test('real Rust resvg replays opaque monochrome SVG with exact 144x72 pixels',async()=>{
  const a=await rerenderSvgPathOnly({
    sourceBytes:svg,width:144,height:72
  });
  assert.equal(a.status,'REPLAY_PIXELS_RENDERED',a.reason);
  assert.equal(a.data.length,144*72*4);
  assert.deepEqual(a.data,decodeTrustedPngBytes(png).data);
  const result=await verifyIndependentRasterReplay(signedInput());
  assert.equal(result.status,
    'EXACT_INDEPENDENT_RGBA_REPLAY_RESEARCH_ONLY',result.reason);
  assert.equal(result.pixel_replay_proven,true);
  assert.equal(result.production_approved,false);
  assert.equal(result.icc_proven,false);
});
test('actual replay detects changed PNG after separate re-signing rather than trusting digest alone',async()=>{
  const shifted=makeSyntheticPng(144,72,(x,y,px,py)=>px!==30||py!==30);
  const result=await verifyIndependentRasterReplay(
    signedInput('svg',svg,shifted));
  assert.equal(result.status,'MANUAL');
  assert.equal(result.reason,'PIXEL_CONTENT_MISMATCH');
  assert.equal(result.mismatched_pixels,1);
});
test('SVG external href, style, fonts and different embedded backgrounds are not accepted',async()=>{
  for(const source of [
    '<svg xmlns="http://www.w3.org/2000/svg" width="72mm" height="36mm" viewBox="0 0 72 36"><image href="https://example.com/a.png"/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg" width="72mm" height="36mm" viewBox="0 0 72 36"><text>Hi</text></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg" width="72mm" height="36mm" viewBox="0 0 72 36"><path d="M0 0L72 0Z" style="fill:red"/></svg>',
    '<!DOCTYPE svg><svg xmlns="http://www.w3.org/2000/svg"></svg>'
  ]){
    assert.equal(checkReplaySvgSubset(Buffer.from(source)).status,'MANUAL');
  }
});
test('independent PDF.js plus separate Skia canvas parses and replays opaque PDF RGB path',async()=>{
  const input=signedInput('pdf',pdf);
  const receipt=JSON.parse(input.receiptBytes);
  const frame=await rerenderPdfSimplePaths({
    sourceBytes:pdf,width:144,height:72,page_index:0,receipt
  });
  assert.equal(frame.status,'REPLAY_PIXELS_RENDERED',frame.reason);
  assert.deepEqual(frame.data,decodeTrustedPngBytes(png).data);
  const result=await verifyIndependentRasterReplay(input);
  assert.equal(result.status,
    'EXACT_INDEPENDENT_RGBA_REPLAY_RESEARCH_ONLY',result.reason);
  assert.equal(result.spot_color_separations_proven,false);
  assert.equal(result.physical_print_scale_proven,false);
});
test('CMYK fill operator in PDF refuses independent color approval',async()=>{
  const cmyk=makeSyntheticBlackPdf({paint:'0 0 0 1 k'});
  const receipt=JSON.parse(signedInput('pdf',cmyk).receiptBytes);
  const result=await rerenderPdfSimplePaths({
    sourceBytes:cmyk,width:144,height:72,page_index:0,receipt
  });
  assert.equal(result.status,'MANUAL');
  assert.equal(result.reason,'PDF_COMPLEX_PAINT_OR_COLORSPACE_UNSUPPORTED');
});
test('a PDF page box claimed falsely in a valid signature cannot pass independent PDF parser',async()=>{
  const input=signedInput('pdf',pdf);
  const receipt=JSON.parse(input.receiptBytes);
  receipt.source_page_box=[0,0,73,36];
  const result=await rerenderPdfSimplePaths({
    sourceBytes:pdf,width:144,height:72,page_index:0,receipt
  });
  assert.equal(result.status,'MANUAL');
  assert.equal(result.reason,'PDF_PARSED_PAGE_METADATA_CONFLICT');
});
test('pretending an external ICC profile is verified is always manual for research replay',async()=>{
  const x=signedInput(),r=JSON.parse(x.receiptBytes);
  r.color_pipeline.source_color_state='externally_attested_profile';
  x.receiptBytes=Buffer.from(JSON.stringify(r)+'\n');
  x.signatureBytes=sign(null,x.receiptBytes,keyPair.privateKey);
  const result=await verifyIndependentRasterReplay(x);
  assert.equal(result.status,'MANUAL');
  assert.equal(result.reason,'SOURCE_COLOR_MANAGEMENT_NOT_VERIFIED');
});
