/**
 * C3B.3.K -- strict RGBA pixel equivalence for independent re-rendering.
 * No tolerance is silently introduced: anti-alias or color differences
 * require MANUAL. Pixel identity is NEVER a color-management/spot or print OK.
 * This module is pure, deterministic and has no external dependencies.
 */
import {createHash} from 'node:crypto';
const MAX_PIXELS=12_000_000;
const refuse=reason=>({
  schema:'printcheck.vision.pixel-replay.v1',
  status:'MANUAL',reason,production_approved:false,
  visual_replay_verified:false,color_managed:false
});
const sha=b=>createHash('sha256').update(b).digest('hex');
function valid(p){
  return p&&Number.isSafeInteger(p.width)&&Number.isSafeInteger(p.height)&&
    p.width>=8&&p.height>=8&&p.width*p.height<=MAX_PIXELS&&
    (p.data instanceof Uint8Array||p.data instanceof Uint8ClampedArray||
      Buffer.isBuffer(p.data))&&
    p.data.byteLength===p.width*p.height*4;
}
export function compareExactRgbaPixels(expected,replayed){
  if(!valid(expected)||!valid(replayed))
    return refuse('PIXEL_BUFFERS_UNSUPPORTED_OR_TOO_LARGE');
  if(expected.width!==replayed.width||expected.height!==replayed.height)
    return refuse('REPLAY_DIMENSION_MISMATCH');
  let changed=0,maxDelta=0,sum=0;
  // Every byte, including alpha: transparent pixels are NOT allowed to hide
  // arbitrary RGB mismatches in this strict research-only comparison.
  const a=expected.data,b=replayed.data;
  for(let offset=0;offset<a.length;offset+=4){
    let mismatched=false;
    for(let c=0;c<4;c++){
      const diff=Math.abs(a[offset+c]-b[offset+c]);
      if(diff>0)mismatched=true;
      maxDelta=Math.max(maxDelta,diff);sum+=diff;
    }
    if(mismatched)changed++;
  }
  const count=expected.width*expected.height;
  return {
    schema:'printcheck.vision.pixel-replay.v1',
    status:changed===0?'EXACT_RGBA_REPLAY_ONLY':'MANUAL',
    ...(changed===0?{}:{reason:'PIXEL_CONTENT_MISMATCH'}),
    production_approved:false,visual_replay_verified:changed===0,
    color_managed:false,icc_profile_verified:false,
    spot_plates_verified:false,actual_print_scale_verified:false,
    dimensions_px:[expected.width,expected.height],
    mismatched_pixels:changed,
    mismatched_fraction:changed/count,
    max_channel_delta:maxDelta,
    mean_channel_delta:sum/(count*4),
    expected_rgba_sha256:sha(a),
    replayed_rgba_sha256:sha(b),
    warning:'Pixel equality at one scale and renderer does not validate ink separations or physical print fitness'
  };
}
