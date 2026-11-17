/**
 * Vision C3B.3.M1 — isolated module Worker for actual synthetic MLP inference.
 * No fetch, storage, order session or dynamic dependencies. Image bytes are
 * received only from an explicit local UI request and not returned.
 */
import {analyzeSyntheticThinRegions}
  from './synthetic-feature-model.mjs';
export function evaluateWorkerRequest(request={}){
 const {id,width,height,pixels,options}=request;
 if(!Number.isSafeInteger(id)||id<0||
    !Number.isSafeInteger(width)||!Number.isSafeInteger(height)||
    width<9||height<9||width*height>700*700||
    !(pixels instanceof ArrayBuffer)||
    pixels.byteLength!==width*height*4)
   return {id,status:'MANUAL',reason:'WORKER_REQUEST_INVALID',
     production_approved:false};
 const result=analyzeSyntheticThinRegions({
   width,height,data:new Uint8ClampedArray(pixels)
 },options||{});
 if(result.status!=='RESEARCH_AI_CANDIDATES_ONLY')
   return {id,status:'MANUAL',reason:result.reason||'AI_SCAN_UNAVAILABLE',
     production_approved:false};
 const {flags,...rest}=result;
 return {id,status:'RESEARCH_AI_CANDIDATES_ONLY',
   result:{...rest,flagsBuffer:flags.buffer}};
}
if(typeof self!=='undefined'&&typeof self.addEventListener==='function'){
 self.addEventListener('message',event=>{
   let answer;
   try{answer=evaluateWorkerRequest(event.data)}
   catch{answer={id:event?.data?.id??-1,status:'MANUAL',
     reason:'WORKER_INFERENCE_FAILED',production_approved:false}}
   if(answer.result?.flagsBuffer)
     self.postMessage(answer,[answer.result.flagsBuffer]);
   else self.postMessage(answer);
 });
}
