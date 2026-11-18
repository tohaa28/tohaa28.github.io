/**
 * Vision C3B.3.R / Chrome Manifest V3 service worker.
 * Pre-installed by user; runs only with exact test-host permissions.
 * Never accepts arbitrary URL fetches, other methods or remote data sinks.
 * No response data is stored, logged, uploaded, cached, or posted to the site.
 */
'use strict';
const TEST_HOSTS=new Set(['psk.testgifts.local','testgifts.local','files.testgifts.local']);
const TABLE_ORIGIN='http://psk.testgifts.local';
const PORT_NAME='vision-order-lan-readonly-v1';
const MAX_DOCUMENT_BYTES=3_000_000,MAX_ARTWORK_BYTES=16_000_000;
const CHUNK_BYTES=48*1024;
function sourceAllowed(sender){
 try{
  const u=new URL(sender?.url||sender?.tab?.url||'');
  return sender.frameId===0&&(
    (u.origin===TABLE_ORIGIN&&
     (u.pathname==='/devorders'||u.pathname.startsWith('/devorders/')))||
    (u.origin==='http://testgifts.local'&&
     /^\/private\/order\/\d{5,12}\/?$/.test(u.pathname)));
 }catch{return false}
}
function validatedTarget(raw,sender){
 if(typeof raw!=='string'||raw.length>2048)return null;
 let u;
 try{u=new URL(raw)}catch{return null}
 if(u.protocol!=='http:'||!TEST_HOSTS.has(u.hostname)||
    u.username||u.password||u.port||u.hash)return null;
 if(!/^[\x20-\x7e]*$/.test(u.pathname+u.search))return null;
 const p=u.pathname,q=u.searchParams;
 const fromOrder=/^\/private\/order\/(\d{5,12})\/?$/.exec(
   new URL(sender?.url||sender?.tab?.url||TABLE_ORIGIN).pathname);
 const senderHost=new URL(sender?.url||sender?.tab?.url||TABLE_ORIGIN).hostname;
 // Only a real order-page extension can load native review files.
 if(fromOrder&&senderHost==='testgifts.local'){
  if(u.hostname==='testgifts.local'&&p==='/ajax/gifts/order'&&
     q.size===2&&q.get('action')==='download_maketadjusting_attachment'&&
     /^\d{1,20}$/.test(q.get('id')||''))
   return {url:u.href,kind:'native_approval_attachment',limit:MAX_ARTWORK_BYTES};
  const img=/^\/maketadjusting\/[0-9]{1,20}\/([0-9]{5,12})\/[0-9]{1,20}\/[^/]{1,180}\.(?:png|jpe?g|webp|gif)$/i.exec(p);
  if(u.hostname==='files.testgifts.local'&&!u.search&&img&&img[1]===fromOrder[1])
   return {url:u.href,kind:'approval_image',limit:MAX_ARTWORK_BYTES};
 }
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
   const target=validatedTarget(message.url,port.sender);
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
       {accept:target.kind==='artwork'||target.kind==='native_approval_attachment'?
         'application/pdf,application/octet-stream,*/*':
         target.kind==='approval_image'?'image/*,*/*':
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


/** M3.21: explicit list-page button -> one hidden AUTHORIZED order tab.
 * The native website's own GET-only clicks load discussion data into DOM.
 * No guessed AJAX parameters, no POST, no cloud/extension storage.
 * A single order is processed at a time; results returned are counts only.
 */
const QUEUE_RUN='vision-approval-order-queue-v1';
const ORDER_URL=/^http:\/\/testgifts\.local\/private\/order\/[0-9]{5,12}$/;
let queueRunning=false;
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function runNativeApprovalOrder(url){
 let tab=null;
 try{
  tab=await chrome.tabs.create({url,active:false});
  if(!Number.isInteger(tab?.id))return {status:'MANUAL_BACKGROUND_TAB_FAILED'};
  let result=null,ready=false;
  // An MV3 document_idle content script may register after tab completed.
  for(let attempt=0;attempt<40;attempt++){
   try{
    result=await Promise.race([
      chrome.tabs.sendMessage(tab.id,{op:'vision-approval-order-collect-v1',
       order_url:url}),
      new Promise((_,reject)=>setTimeout(()=>reject(Error('QUEUE_ORDER_TIMEOUT')),180000))
    ]);
    ready=true;break;
   }catch{
    // Retry ONLY while content script has not yet attached. Once it accepts
    // the message, its async response is awaited by sendMessage.
    let present=false;
    try{present=!!(await chrome.tabs.get(tab.id)).status}catch{}
    if(!present)return {status:'MANUAL_TAB_CLOSED'};
    await pause(250);
   }
  }
  if(!ready||!result||typeof result!=='object')
   return {status:'MANUAL_ORDER_CONTENT_SCRIPT_UNAVAILABLE'};
  // Close only our own tab, after browser has initiated local downloads.
  await pause(1400);
  const safeStatus=/^[A-Z][A-Z0-9_]{2,70}$/.test(result.status||'')?
    result.status:'MANUAL_UNKNOWN_RESULT';
  const count=x=>Number.isSafeInteger(x)&&x>=0&&x<=10000?x:0;
  return {status:safeStatus,eligible_articles:count(result.eligible_articles),
   verified_articles:count(result.verified_articles),files:count(result.files),
   zip_parts:count(result.zip_parts),failures:count(result.failures),
   private_text_saved:result.private_text_saved===true};
 }catch{return {status:'MANUAL_BACKGROUND_ORDER_FAILED'}}
 finally{if(tab?.id)try{await chrome.tabs.remove(tab.id)}catch{}}
}
if(typeof chrome!=='undefined'&&chrome.runtime?.onMessage){
 chrome.runtime.onMessage.addListener((message,sender,respond)=>{
  if(message?.op!==QUEUE_RUN)return false;
  const url=message.order_url;
  let sourceOK=false;
  try{
   const u=new URL(sender?.url||'');
   sourceOK=sender?.frameId===0&&u.origin===TABLE_ORIGIN&&
    (u.pathname==='/devorders'||u.pathname.startsWith('/devorders/'));
  }catch{}
  if(!sourceOK||typeof url!=='string'||!ORDER_URL.test(url)){
   respond({status:'MANUAL_QUEUE_SOURCE_DENIED'});return false;
  }
  if(queueRunning){
   respond({status:'MANUAL_QUEUE_ALREADY_RUNNING'});return false;
  }
  queueRunning=true;
  runNativeApprovalOrder(url).then(respond,()=>
   respond({status:'MANUAL_BACKGROUND_ORDER_FAILED'})).finally(()=>{
    queueRunning=false;
  });
  return true;
 });
}
