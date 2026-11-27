import test from 'node:test';
import assert from 'node:assert/strict';
import {compareExactRgbaPixels} from '../vision/dataset/exact-pixel-replay.mjs';

function rgba(w=12,h=8,val=200){
  const data=new Uint8Array(w*h*4);
  for(let i=0;i<data.length;i+=4){
    data[i]=data[i+1]=data[i+2]=val;data[i+3]=255;
  }
  return {data,width:w,height:h};
}
test('identical independently allocated RGBA arrays produce pixel-only research result',()=>{
  const a=rgba(),b=rgba();
  assert.notEqual(a.data,b.data);
  const x=compareExactRgbaPixels(a,b);
  assert.equal(x.status,'EXACT_RGBA_REPLAY_ONLY');
  assert.equal(x.visual_replay_verified,true);
  assert.equal(x.color_managed,false);
  assert.equal(x.spot_plates_verified,false);
  assert.equal(x.production_approved,false);
  assert.equal(x.mismatched_pixels,0);
});
test('one changed dark pixel never gets hidden by mean-average tolerance',()=>{
  const a=rgba(),b=rgba();
  b.data[0]=a.data[0]-1;
  const x=compareExactRgbaPixels(a,b);
  assert.equal(x.status,'MANUAL');
  assert.equal(x.reason,'PIXEL_CONTENT_MISMATCH');
  assert.equal(x.mismatched_pixels,1);
  assert.equal(x.max_channel_delta,1);
  assert.equal(x.visual_replay_verified,false);
});
test('even transparent pixel RGB and alpha differences are fail-closed',()=>{
  const a=rgba(),b=rgba();
  a.data[3]=b.data[3]=0;b.data[0]=a.data[0]+1;
  assert.equal(compareExactRgbaPixels(a,b).reason,'PIXEL_CONTENT_MISMATCH');
  b.data[0]=a.data[0];b.data[3]=1;
  assert.equal(compareExactRgbaPixels(a,b).mismatched_pixels,1);
});
test('different canvas dimensions are not accepted as a close resampling match',()=>{
  assert.equal(compareExactRgbaPixels(rgba(),rgba(8,12)).reason,
    'REPLAY_DIMENSION_MISMATCH');
});
test('invalid shape, huge buffer and incomplete pixels never permit replay',()=>{
  assert.equal(compareExactRgbaPixels(
    {data:new Uint8Array(3),width:12,height:8},rgba()).status,'MANUAL');
  assert.equal(compareExactRgbaPixels(
    {data:new Uint8Array(0),width:9000,height:9000},rgba()).status,'MANUAL');
  assert.equal(compareExactRgbaPixels(null,rgba()).status,'MANUAL');
});
