/**
 * Vision C3B.3.R — local, packaged Chrome MV3 transport.
 * Runs in the extension isolated world, never in a page main-world script.
 * The service worker performs only audited GETs against two exact LAN hosts.
 * No raw source file or cookie goes to GitHub or any analytics endpoint.
 */
(()=>{
 'use strict';
 if(typeof chrome==='undefined'||!chrome.runtime?.connect)return;
 if(location.protocol!=='http:'||location.hostname!=='psk.testgifts.local'||
   !/^\/devorders(?:\/|$)/.test(location.pathname))return;
 if(globalThis.__visionLocalTrustedTransport)return;
 const CHUNK_LIMIT=64*1024;
 globalThis.__visionLocalTrustedTransport=async function(url,options={}){
   if(options.method&&options.method!=='GET')throw Error('EXTENSION_GET_ONLY');
   if(options.signal?.aborted)throw new DOMException('Aborted','AbortError');
   const port=chrome.runtime.connect({name:'vision-order-lan-readonly-v1'});
   let controller=null,settled=false,resolved=false,resolveMeta,rejectMeta;
   const meta=new Promise((resolve,reject)=>{resolveMeta=resolve;rejectMeta=reject});
   const cleanup=()=>{
     clearTimeout(timer);
     options.signal?.removeEventListener('abort',abort);
   };
   const stream=new ReadableStream({
     start(c){controller=c},
     cancel(){try{port.postMessage({op:'cancel'})}catch{}
       try{port.disconnect()}catch{}}
   });
   const fail=(code)=>{
     if(settled)return;
     settled=true;cleanup();
     const error=new TypeError(code||'EXTENSION_LAN_FETCH_FAILED');
     if(!resolved)rejectMeta(error);
     else try{controller.error(error)}catch{}
     try{port.disconnect()}catch{}
   };
   const abort=()=>fail('EXTENSION_FETCH_ABORTED');
   const timer=setTimeout(()=>fail('EXTENSION_FETCH_TIMEOUT'),20000);
   options.signal?.addEventListener('abort',abort,{once:true});
   port.onDisconnect.addListener(()=>{
     if(!settled)fail('EXTENSION_SERVICE_DISCONNECTED');
   });
   port.onMessage.addListener(msg=>{
     if(settled||!msg||typeof msg!=='object')return;
     if(msg.op==='meta'){
       if(resolved)return fail('EXTENSION_DUPLICATE_METADATA');
       const status=Number(msg.status);
       if(!Number.isInteger(status)||status<200||status>599)
         return fail('EXTENSION_INVALID_STATUS');
       resolved=true;
       try{
         const response=new Response(stream,{
           status,
           headers:{
             'content-type':String(msg.content_type||'application/octet-stream').slice(0,150),
             ...(msg.content_length!==null?{'content-length':String(msg.content_length)}:{})
           }
         });
         resolveMeta(response);
       }catch{return fail('EXTENSION_RESPONSE_UNSUPPORTED')}
       return;
     }
     if(msg.op==='chunk'){
       if(!resolved||!Array.isArray(msg.bytes)||msg.bytes.length>CHUNK_LIMIT)
         return fail('EXTENSION_BAD_CHUNK');
       try{
         const bytes=Uint8Array.from(msg.bytes);
         controller.enqueue(bytes);
       }catch{return fail('EXTENSION_STREAM_FAILURE')}
       return;
     }
     if(msg.op==='end'){
       if(!resolved)return fail('EXTENSION_END_WITHOUT_METADATA');
       settled=true;cleanup();controller.close();
       try{port.disconnect()}catch{}
       return;
     }
     if(msg.op==='error'){
       // Only worker-authored enum tokens, never target URLs or HTTP bodies.
       fail(typeof msg.code==='string'?msg.code.slice(0,90):'EXTENSION_WORKER_ERROR');
     }
   });
   try{
     port.postMessage({op:'fetch',url:String(url),method:'GET'});
   }catch{fail('EXTENSION_REQUEST_SEND_FAILED')}
   return meta;
 };
})();
