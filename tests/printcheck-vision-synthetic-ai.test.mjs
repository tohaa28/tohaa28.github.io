import test from 'node:test';
import assert from 'node:assert/strict';
import {MODEL_INFO,predictSyntheticThinPatch,makeInkMask,
  analyzeSyntheticThinRegions,getPatchFeatures}
  from '../vision/ai/synthetic-feature-model.mjs';
const frame=(w,h,ink)=>{
 const data=new Uint8ClampedArray(w*h*4);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
   const j=(y*w+x)*4,c=ink(x,y)?0:255;
   data[j]=c;data[j+1]=c;data[j+2]=c;data[j+3]=255;
 }
 return {width:w,height:h,data};
};
test('frozen model is a real 8-12-1 predictor with explicit synthetic-only provenance',()=>{
 const z=predictSyntheticThinPatch([1,1,1,1,1,1,1,1]);
 assert.ok(z>=0&&z<=1);
 assert.equal(MODEL_INFO.realWorldAccuracyVerified,false);
 assert.equal(MODEL_INFO.productionApproved,false);
 assert.throws(()=>predictSyntheticThinPatch([1,2]),RangeError);
});
test('single-pixel ink line activates synthetic neural thin-stroke candidates',()=>{
 const out=analyzeSyntheticThinRegions(frame(70,70,(x,y)=>x===35&&y>10&&y<59));
 assert.equal(out.status,'RESEARCH_AI_CANDIDATES_ONLY');
 assert.ok(out.thinInkPixels>25);
 assert.equal(out.narrowGapPixels,0);
 assert.equal(out.production_approved,false);
 assert.equal(out.physical_scale_proven,false);
 assert.ok(out.regions.some(r=>r.kind==='thin_ink_candidate'&&r.height>25));
});
test('unprinted thin gap inside a thick printed bar is detected separately',()=>{
 const out=analyzeSyntheticThinRegions(frame(70,70,
   (x,y)=>x>=20&&x<=50&&y>10&&y<59&&x!==35));
 assert.equal(out.status,'RESEARCH_AI_CANDIDATES_ONLY');
 assert.ok(out.narrowGapPixels>20);
 assert.ok(out.regions.some(r=>r.kind==='narrow_gap_candidate'&&r.height>20));
});
test('wide filled circle has no confirmed long thin region',()=>{
 const out=analyzeSyntheticThinRegions(frame(70,70,
   (x,y)=>(x-35)**2+(y-35)**2<19**2));
 assert.equal(out.status,'RESEARCH_AI_CANDIDATES_ONLY');
 assert.equal(out.thinInkPixels,0);
 assert.equal(out.narrowGapPixels,0);
});
test('custom color selection can segment arbitrary printed color',()=>{
 const picture=frame(45,45,(x,y)=>x===22&&y>8&&y<35);
 for(let i=0;i<picture.data.length;i+=4)
   if(picture.data[i]===0){
     picture.data[i]=7;picture.data[i+1]=100;picture.data[i+2]=220;
   }
 const analyzed=analyzeSyntheticThinRegions(picture,
   {inkColor:[7,100,220],tolerance:20});
 assert.equal(analyzed.segmentation,'sampled_ink_rgb');
 assert.ok(analyzed.thinInkPixels>8);
});
test('ambiguous blank image, oversized input, bad settings and patch edges fail safely',()=>{
 const blank=frame(35,35,()=>false);
 assert.equal(makeInkMask(blank).status,'MANUAL');
 assert.equal(analyzeSyntheticThinRegions(blank).status,'MANUAL');
 assert.equal(analyzeSyntheticThinRegions(blank,
   {probabilityThreshold:1.2}).status,'MANUAL');
 assert.equal(makeInkMask({width:1000,height:1000,
   data:new Uint8Array(4_000_000)}).status,'MANUAL');
 const mask=new Uint8Array(35*35);
 assert.equal(getPatchFeatures(mask,35,35,2,2),null);
});
