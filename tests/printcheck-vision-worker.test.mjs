import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateWorkerRequest} from '../vision/ai/scan-worker.mjs';
import {analyzeSyntheticThinRegions}
  from '../vision/ai/synthetic-feature-model.mjs';
function synthetic(){
 const width=70,height=70,data=new Uint8ClampedArray(width*height*4);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
   const j=(y*width+x)*4;
   const thin=x===35&&y>10&&y<59;
   data[j]=data[j+1]=data[j+2]=thin?0:255;
   data[j+3]=255;
 }
 return {width,height,data};
}
test('module worker shares exact bounded neural inference with main model',()=>{
 const image=synthetic();
 const expected=analyzeSyntheticThinRegions(image);
 const response=evaluateWorkerRequest({id:17,width:image.width,
   height:image.height,pixels:image.data.buffer,
   options:{tolerance:42,probabilityThreshold:.75}});
 assert.equal(response.id,17);
 assert.equal(response.status,'RESEARCH_AI_CANDIDATES_ONLY');
 assert.equal(response.result.production_approved,false);
 assert.equal(response.result.real_world_accuracy_proven,false);
 assert.equal(response.result.thinInkPixels,expected.thinInkPixels);
 assert.deepEqual(new Uint8Array(response.result.flagsBuffer),expected.flags);
 assert.equal('pixels' in response.result,false);
 assert.equal('data' in response.result,false);
});
test('worker rejects malformed input and excessive pixel memory',()=>{
 for(const req of [{id:1,width:700,height:700,pixels:new ArrayBuffer(4)},
   {id:1,width:900,height:900,pixels:new ArrayBuffer(0)},
   {id:-1,width:16,height:16,pixels:new ArrayBuffer(1024)},
   {id:2,width:16,height:16,pixels:new Uint8Array(1024)}]){
   const r=evaluateWorkerRequest(req);
   assert.equal(r.status,'MANUAL');
   assert.equal(r.production_approved,false);
 }
});
