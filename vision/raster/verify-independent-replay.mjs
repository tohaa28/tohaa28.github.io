/**
 * PrintCheck Vision C3B.3.K — independently re-render source PDF/SVG and
 * compare every RGBA channel against signed preview PNG.
 *
 * The *existing* signed PDF/SVG→PNG→mm attestation must first verify. A
 * second engine then renders the SAME raw source bytes with no network.
 * Exact pixels are a RESEARCH witness only, not ICC/spot or manufacturing OK.
 *
 * Uses optional isolated engines under vision/raster/node_modules.
 */
import {verifySignedRenderCalibration}
  from '../dataset/render-calibration-attestation.mjs';
import {decodeTrustedPngBytes}
  from '../dataset/strict-png-decoder.mjs';
import {compareExactRgbaPixels}
  from '../dataset/exact-pixel-replay.mjs';
import {rerenderSvgPathOnly,rerenderPdfSimplePaths}
  from './replay-engines.mjs';

const no=(reason)=>({
  schema:'printcheck.vision.independent-raster-replay.v1',
  status:'MANUAL',reason,production_approved:false,
  pixel_replay_proven:false,icc_proven:false,
  spot_color_separations_proven:false,
  physical_print_scale_proven:false
});
export async function verifyIndependentRasterReplay(input={}){
  const calibration=verifySignedRenderCalibration(input);
  if(calibration.status!==
      'SIGNED_SOURCE_PREVIEW_AND_MM_AFFINE_CONSISTENT_ONLY')
    return no('SIGNED_SOURCE_PREVIEW_MM_RECEIPT_REQUIRED');
  const expected=decodeTrustedPngBytes(input.previewPngBytes);
  if(expected.status!=='DECODED_STRICT_PNG_ONLY')
    return no('SIGNED_PREVIEW_PNG_UNSUPPORTED');
  let receipt;
  try{receipt=JSON.parse(Buffer.from(input.receiptBytes).toString('utf8'))}
  catch{return no('SIGNED_RENDER_RECEIPT_INVALID')}
  // No independent CMS installed: only accept explicitly simple RGB
  // preview contracts. Claimed ICC profiles, CMYK and spots stay MANUAL.
  if(receipt.color_pipeline.source_color_state!=='explicit_srgb'||
     receipt.color_pipeline.output_encoding!=='unprofiled_rgb8')
    return no('SOURCE_COLOR_MANAGEMENT_NOT_VERIFIED');
  let replay;
  try{
    if(receipt.source_format==='svg'){
      replay=await rerenderSvgPathOnly({
        sourceBytes:input.sourceBytes,
        width:expected.width,height:expected.height
      });
    }else if(receipt.source_format==='pdf'){
      replay=await rerenderPdfSimplePaths({
        sourceBytes:input.sourceBytes,
        width:expected.width,height:expected.height,
        page_index:receipt.page_index,receipt
      });
    }else return no('RERENDER_SOURCE_FORMAT_UNSUPPORTED');
  }catch{return no('INDEPENDENT_RENDERER_FAILED')}
  if(replay?.status!=='REPLAY_PIXELS_RENDERED')
    return no(replay?.reason??'INDEPENDENT_RENDERER_UNAVAILABLE');
  const measured=compareExactRgbaPixels(expected,replay);
  if(measured.status!=='EXACT_RGBA_REPLAY_ONLY')
    return {
      ...no(measured.reason??'PIXEL_CONTENT_MISMATCH'),
      mismatched_pixels:measured.mismatched_pixels??null,
      mismatched_fraction:measured.mismatched_fraction??null,
      max_channel_delta:measured.max_channel_delta??null,
      replay_engine:replay.replay_engine
    };
  return {
    schema:'printcheck.vision.independent-raster-replay.v1',
    status:'EXACT_INDEPENDENT_RGBA_REPLAY_RESEARCH_ONLY',
    production_approved:false,pixel_replay_proven:true,
    replay_engine:replay.replay_engine,
    source_format:receipt.source_format,
    checked_pixels:expected.width*expected.height,
    rgba_exact_match:true,
    source_bytes_bound_to_ed25519_receipt:true,
    icc_proven:false,spot_color_separations_proven:false,
    physical_print_scale_proven:false,
    authenticated_gifts_order_proven:false,
    warning:'Exact replay on one pinned renderer and pixel grid does not establish ICC/spot equivalence, original order provenance or print fitness'
  };
}
