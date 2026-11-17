import test from 'node:test';
import assert from 'node:assert/strict';
import {fingerprintRgba,visualDistance} from '../vision/dataset/visual-fingerprint.mjs';

function paint(width,height,predicate,{brightness=0,alpha=false}={}){
  const data=new Uint8ClampedArray(width*height*4);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const ink=predicate(x/width,y/height);
    const i=4*(y*width+x);
    const value=ink?Math.max(0,brightness):255;
    data[i]=data[i+1]=data[i+2]=value;
    data[i+3]=alpha?(ink?255:0):255;
  }
  return {data,width,height};
}
const t=(x,y)=>(
 (y>.15&&y<.25&&x>.15&&x<.85) ||
 (x>.46&&x<.56&&y>.2&&y<.86)
);
const plus=(x,y)=>(
 (x>.22&&x<.78&&y>.45&&y<.55) ||
 (y>.2&&y<.8&&x>.44&&x<.56)
);
const square=(x,y)=>x>.2&&x<.8&&y>.2&&y<.8;
const ring=(x,y)=> {
 const d=Math.hypot(x-.5,y-.5);
 return d>.27&&d<.36;
};
const fp=(shape,w=256,h=256,more={})=>fingerprintRgba(
 paint(w,h,shape,more));
test('same artwork at different source resolution has a near-zero perceptual distance',()=>{
  const a=fp(t,256,256),b=fp(t,512,512);
  assert.equal(a.status,'ADVISORY_SIGNATURE_ONLY');
  assert.equal(b.status,'ADVISORY_SIGNATURE_ONLY');
  const d=visualDistance(a,b);
  assert.equal(d.status,'ADVISORY_SIMILARITY_ONLY');
  assert.ok(d.silhouette_bits<=12,JSON.stringify(d));
});
test('90-degree rotation and mirroring use exact D4 orientation search',()=>{
  const a=fp(t,240,240);
  const rotated=fp((x,y)=>t(y,1-x),240,240);
  const mirrored=fp((x,y)=>t(1-x,y),240,240);
  for(const other of [rotated,mirrored]){
    const d=visualDistance(a,other);
    assert.equal(d.status,'ADVISORY_SIMILARITY_ONLY');
    assert.ok(d.silhouette_bits<=12,JSON.stringify(d));
  }
});
test('brightness/contrast and transparent background preserve visible silhouette',()=>{
  const normal=fp(plus,260,260);
  const bright=fp(plus,260,260,{brightness:40});
  const transparent=fp(plus,260,260,{alpha:true});
  for(const other of [bright,transparent]){
    const d=visualDistance(normal,other);
    assert.ok(d.silhouette_bits<=12,JSON.stringify(d));
  }
});
test('different visual logos are not assigned an automatic SAME_ARTWORK verdict',()=>{
  const a=fp(ring),b=fp(square);
  const d=visualDistance(a,b);
  assert.equal(d.status,'ADVISORY_SIMILARITY_ONLY');
  assert.ok(d.silhouette_bits>0,JSON.stringify(d));
  assert.equal(Object.hasOwn(d,'same_artwork'),false);
});
test('unusable uniform and tiny images require manual rather than duplicate acceptance',()=>{
  const blank=fp(()=>false);
  assert.equal(blank.status,'MANUAL');
  assert.equal(blank.reason,'INSUFFICIENT_FOREGROUND_INFORMATION');
  const tooSmall=fingerprintRgba({data:new Uint8Array(16),width:2,height:2});
  assert.equal(tooSmall.status,'MANUAL');
  const tiny=fp((x,y)=>x>.501&&x<.509&&y>.501&&y<.509);
  assert.equal(tiny.status,'MANUAL');
});
test('photographic nonuniform corner background is refused',()=>{
  const img=paint(100,100,t);
  img.data[0]=0;img.data[1]=170;img.data[2]=220;
  const result=fingerprintRgba(img);
  assert.equal(result.status,'MANUAL');
  assert.equal(result.reason,'NONFLAT_BACKGROUND_REQUIRES_MANUAL');
});
test('all fingerprint values and dimensional checks remain bounded',()=>{
  const data=new Uint8ClampedArray(20*20*4);
  assert.equal(fingerprintRgba({data,width:0,height:20}).status,'MANUAL');
  assert.equal(fingerprintRgba({data,width:100000,height:100000}).status,'MANUAL');
  assert.equal(visualDistance({status:'ADVISORY_SIGNATURE_ONLY'},fp(t)).status,'MANUAL');
  const sample=fp(t);
  assert.equal(sample.orientations.length,8);
  assert.equal(sample.orientations.every(x=>
    /^[a-f0-9]{64}$/.test(x.silhouette)&&/^[a-f0-9]{16}$/.test(x.gradient)),true);
});
