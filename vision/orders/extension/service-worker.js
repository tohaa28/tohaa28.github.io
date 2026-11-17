/**
 * Vision C3B.3.R / Chrome Manifest V3 service worker.
 * Pre-installed by user; runs only with exact test-host permissions.
 * Never accepts arbitrary URL fetches, other methods or remote data sinks.
 * No response data is stored, logged, uploaded, cached, or posted to the site.
 */
'use strict';
const TEST_HOSTS=new Set(['psk.testgifts.local','testgifts.local']);
const TABLE_ORIGIN='http://psk.testgifts.local';
const PORT_NAME='vision-order-lan-readonly-v1';
const MAX_DOCUMENT_BYTES=3_000_000,MAX_ARTWORK_BYTES=16_000_000;
const CHUNK_BYTES=48*1024;
function sourceAllowed(sender){
 try{
  const u=new URL(sender?.url||sender?.tab?.url||'');
  return u.origin===TABLE_ORIGIN&&
   (u.pathname==='/devorders'||u.pathname.startsWith('/devorders/'))&&
   sender.frameId===0;
 }catch{return false}
}
function validatedTarget(raw){
 if(typeof raw!=='string'||raw.length>2048)return null;
 let u;
 try{u=new URL(raw)}catch{return null}
 if(u.protocol!=='http:'||!TEST_HOSTS.has(u.hostname)||
    u.username||u.password||u.port||u.hash)return null;
 if(!/^[\x20-\x7e]*$/.test(u.pathname+u.search))return null;
 const p=u.pathname,q=u.searchParams;
 if(/^\/private\/order\/\d{5,12}\/?$/.test(p)&&!u.search)
  return {url:u.href,kind:'order_card',limit:MAX_DOCUMENT_BYTES};
 if(p==='/ajax/gifts/order'&&q.size===2&&q.get('action')==='makets_popup'&&
    /^\d{1,20}$/.test(q.get('oid')||''))
  return {url:u.href,kind:'popup',limit:MAX_DOCUMENT_BYTES};
 if(p==='/cart/act/mda'&&q.size===2&&
   /^\d{1,20}$/.test(q.get('oid')||'')&&
   /^\d{1,20}$/.test(q.get('id')||''))
  return {url:u.href,kind:'artwork',limit:MAX_ARTWORK_BYTES};
 return null;
}
const safeCode=code=>
 /^[A-Z][A-Z0-9_]{2,78}$/.test(code)?code:'EXTENSION_UNKNOWN_ERROR';
function installPortListener(runtime){
 runtime.onConnect.addListener(port=>{
  if(port?.name!==PORT_NAME||!sourceAllowed(port.sender)){
   try{port.disconnect()}catch{}return;
  }
  let used=false,closed=false,controller=null,timeout=null;
  const clear=()=>{
   closed=true;if(timeout)clearTimeout(timeout);
   try{controller?.abort()}catch{}
  };
  const send=message=>{
   if(closed)return false;
   try{port.postMessage(message);return true}
   catch{clear();return false}
  };
  port.onDisconnect.addListener(clear);
  port.onMessage.addListener(async message=>{
   if(message?.op==='cancel'){clear();return}
   if(message?.op!=='fetch'||used||closed)return;
   used=true;
   if(message.method!=='GET'){
    send({op:'error',code:'EXTENSION_GET_ONLY'});clear();return;
   }
   const target=validatedTarget(message.url);
   if(!target){
    send({op:'error',code:'EXTENSION_READ_ONLY_PATH_DENIED'});clear();return;
   }
   controller=new AbortController();
   timeout=setTimeout(()=>{
    send({op:'error',code:'EXTENSION_FETCH_TIMEOUT'});clear()
   },15000);
   try{
    const response=await fetch(target.url,{
     // Maketnaya follows the site's legitimate redirects, then validates the final location.
     method:'GET',credentials:'include',redirect:'follow',cache:'no-store',
     referrerPolicy:'no-referrer',signal:controller.signal,
     headers:target.kind==='popup'?
       {accept:'text/html,application/json',
        'x-requested-with':'XMLHttpRequest'}:
       {accept:target.kind==='artwork'?
         'application/pdf,application/octet-stream,*/*':
         'text/html,application/json'}
    });
    // A successful redirect is accepted only when the final URL is the
    // *same read-only resource* on one of the two explicitly trusted LAN
    // hosts. Never relay login pages, arbitrary paths or external hosts.
    // The native Maketnaya likewise follows, validates and rejects auth.
    if(response.url){
      let final;
      try{final=new URL(response.url)}catch{}
      if(!final||final.protocol!=='http:'||!TEST_HOSTS.has(final.hostname)||
         final.port||final.username||final.password){
        send({op:'error',code:'EXTENSION_REDIRECT_UNTRUSTED_ORIGIN'});return;
      }
      const original=new URL(target.url);
      const pathKey=path=>target.kind==='order_card'&&path.endsWith('/')?
        path.slice(0,-1):path;
      if(pathKey(final.pathname)!==pathKey(original.pathname)||
         final.search!==original.search){
        const login=final.pathname.toLowerCase().split('/').some(part=>['auth','login','signin'].includes(part));
        send({op:'error',code:login?'EXTENSION_AUTH_REDIRECT':'EXTENSION_REDIRECT_UNEXPECTED_PATH'});return;
      }
    }
    const lengthHeader=response.headers.get('content-length');
    const announced=lengthHeader&&/^\d+$/.test(lengthHeader)?
      Number(lengthHeader):null;
    if(announced!==null&&announced>target.limit){
     send({op:'error',code:'EXTENSION_RESPONSE_TOO_LARGE'});return;
    }
    const contentType=response.headers.get('content-type')||'';
    if(!send({op:'meta',status:response.status,
      content_type:contentType.slice(0,150),content_length:announced}))return;
    // Do not transmit login page/HTML content for an HTTP denial; the
    // consumer only needs status to produce its anonymous HTTP diagnostic.
    if(!response.ok){send({op:'end'});return}
    if(!response.body?.getReader){
     send({op:'error',code:'EXTENSION_UNSUPPORTED_STREAM'});return;
    }
    const reader=response.body.getReader();
    let total=0;
    try{
     while(!closed){
      const {done,value}=await reader.read();
      if(done)break;
      total+=value.byteLength;
      if(total>target.limit){
       send({op:'error',code:'EXTENSION_RESPONSE_TOO_LARGE'});break;
      }
      for(let i=0;i<value.byteLength&&!closed;i+=CHUNK_BYTES)
       if(!send({op:'chunk',bytes:Array.from(value.subarray(i,i+CHUNK_BYTES))}))
        break;
     }
     if(!closed&&total<=target.limit)send({op:'end'});
    }finally{try{reader.releaseLock()}catch{}}
   }catch(error){
    if(!closed)
      send({op:'error',code:controller.signal.aborted?
        'EXTENSION_FETCH_TIMEOUT':'EXTENSION_FETCH_REJECTED'});
   }finally{clear()}
  });
 });
}
if(typeof chrome!=='undefined'&&chrome.runtime?.onConnect)
 installPortListener(chrome.runtime);
// Pure hooks are available to synthetic Node tests via vm; no unsafe eval.
