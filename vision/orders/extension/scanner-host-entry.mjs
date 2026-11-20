/* Single extension-origin scanner host; no devorders tab or production access. */
import {makeApprovalFileListController} from '../approval-file-controller.mjs';
const mount=document.querySelector('#vision-scanner-host');
if(!mount||location.href!==chrome.runtime.getURL('scanner-host.html'))
 throw Error('VISION_ENGINE_HOST_UNTRUSTED');
if(typeof globalThis.__visionLocalTrustedTransport!=='function')
 throw Error('VISION_ENGINE_TRANSPORT_MISSING');
let busy=false,activeOrder=null;
const controller=makeApprovalFileListController({
 getBusy:()=>busy,
 setBusy:value=>{busy=!!value},
 isClosed:()=>false,
 scanOrder:async(url,require_tz_approved)=>{
  activeOrder=new URL(url).pathname.split('/').at(-1);
  try{
   return await chrome.runtime.sendMessage({
    op:'vision-approval-order-queue-v1',order_url:url,
    require_tz_approved:require_tz_approved===true
   });
  }finally{activeOrder=null}
 }
});
mount.append(controller.element);
chrome.runtime.onMessage.addListener((message,sender,respond)=>{
 if(sender?.id!==chrome.runtime.id||sender?.tab||!message)return false;
 if(message.op==='vision-engine-command-v1'){
  if(message.mode!=='file'||!['status','import','start','pause','stop',
   'reset','save','export','delay'].includes(message.action)){
   respond({status:'VISION_ENGINE_COMMAND_DENIED'});return false;
  }
  controller.remote(message.action,message.payload||{}).then(respond,error=>
   respond({status:'VISION_ENGINE_COMMAND_FAILED',
    reason:String(error?.message||'UNKNOWN').slice(0,120)}));
  return true;
 }
 if(message.op==='vision-approval-batch-accept-v1'){
  if(!activeOrder||String(message.order_number)!==activeOrder){
   respond({status:'MANUAL_BATCH_HOST_ORDER_MISMATCH'});return false;
  }
  respond(controller.receive(message,activeOrder));return false;
 }
 return false;
});
