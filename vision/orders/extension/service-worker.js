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
/**
 * M3.23: the hidden order tab must not be closed before the PRIVATE evidence
 * download has COMPLETED. A click on a blob anchor in a background tab was
 * often lost when the queue closed the tab. The downloads API is owned by
 * the extension worker, and a successful response requires completion.
 * No network upload, no Cookies API, no filesystem path from web content.
 */
const EVIDENCE_SAVE='vision-approval-save-evidence-v1';
function exactEvidenceSender(sender,orderNumber){
 try{
  const u=new URL(sender?.url||'');
  return sender?.frameId===0&&Number.isInteger(sender?.tab?.id)&&
   u.origin==='http://testgifts.local'&&!u.search&&!u.hash&&
   u.pathname==='/private/order/'+orderNumber;
 }catch{return false}
}
function utf8DataUrl(data){
 const bytes=new TextEncoder().encode(data);
 // Bound before converting to a base64 data URL: Chrome messages and
 // downloads must not silently allocate unbounded user data.
 if(bytes.length>8_000_000)throw Error('EVIDENCE_TOO_LARGE');
 let binary='';
 for(let i=0;i<bytes.length;i+=32768)
  binary+=String.fromCharCode(...bytes.subarray(i,i+32768));
 return 'data:application/json;charset=utf-8;base64,'+btoa(binary);
}
async function saveNativeEvidence(message,sender){
 const order=String(message?.order_number||'');
 const stage=message?.stage;
 const evidence=message?.evidence;
 if(!/^\d{5,12}$/.test(order)||!['raw','final'].includes(stage)||
    !exactEvidenceSender(sender,order)||!evidence||
    evidence.schema!=='printcheck.vision.private-approval-collection.v1'||
    evidence.order_number!==order||
    !Array.isArray(evidence.articles))
  return {status:'MANUAL_PRIVATE_EVIDENCE_DENIED'};
 if(typeof chrome.downloads?.download!=='function'||
    typeof chrome.downloads?.search!=='function')
  return {status:'MANUAL_DOWNLOADS_API_UNAVAILABLE'};
 let data;
 try{data=JSON.stringify(evidence,null,2)+'\n'}catch{
  return {status:'MANUAL_EVIDENCE_SERIALIZATION_FAILED'};
 }
 let url;
 try{url=utf8DataUrl(data)}catch{return {status:'MANUAL_EVIDENCE_TOO_LARGE'}}
 const filename='vision-private-approval-evidence-'+order+
   (stage==='raw'?'-raw':'')+'.json';
 try{
  const id=await chrome.downloads.download({
   url,filename,saveAs:false,conflictAction:'uniquify'
  });
  if(!Number.isInteger(id))return {status:'MANUAL_EVIDENCE_DOWNLOAD_REJECTED'};
  for(let attempt=0;attempt<150;attempt++){
   const results=await chrome.downloads.search({id});
   const row=results?.[0];
   if(row?.state==='complete')return {
    status:'EVIDENCE_DOWNLOAD_COMPLETE',stage,
    article_count:evidence.articles.length
   };
   if(row?.state==='interrupted')return {
    status:'MANUAL_EVIDENCE_DOWNLOAD_INTERRUPTED'};
   await new Promise(resolve=>setTimeout(resolve,100));
  }
  return {status:'MANUAL_EVIDENCE_DOWNLOAD_TIMEOUT'};
 }catch{return {status:'MANUAL_EVIDENCE_DOWNLOAD_FAILED'}}
}
if(typeof chrome!=='undefined'&&chrome.runtime?.onMessage){
 chrome.runtime.onMessage.addListener((message,sender,respond)=>{
  if(message?.op!==EVIDENCE_SAVE)return false;
  saveNativeEvidence(message,sender).then(respond,()=>
   respond({status:'MANUAL_EVIDENCE_DOWNLOAD_FAILED'}));
  return true;
 });
}

/**
 * Explicit list page <-- background worker <-- exact current order page.
 * No standalone files from a transient hidden tab in batch mode.
 */
const BATCH_TRANSFER='vision-approval-batch-transfer-v1';
const BATCH_ACCEPT='vision-approval-batch-accept-v1';
let activeBatch=null;
if(typeof chrome!=='undefined'&&chrome.runtime?.onMessage){
 chrome.runtime.onMessage.addListener((message,sender,respond)=>{
  if(message?.op!==BATCH_TRANSFER)return false;
  const order=String(message.order_number||''),data=message.chunk||'';
  const running=activeBatch;
  if(!running||!queueRunning||!exactEvidenceSender(sender,order)||
    sender.tab?.id!==running.orderTabId||
    running.orderUrl!=='http://testgifts.local/private/order/'+order||
    typeof data!=='string'||data.length>70_000||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(data)||
    !Number.isInteger(message.sequence)||!Number.isInteger(message.chunk_count)){
   respond({status:'MANUAL_BATCH_RELAY_DENIED'});return false;
  }
  chrome.tabs.sendMessage(running.listTabId,{
   op:BATCH_ACCEPT,order_number:order,kind:message.kind,
   stage:message.stage,part:message.part,
   sequence:message.sequence,chunk_count:message.chunk_count,chunk:data
  }).then(result=>respond(result||{status:'MANUAL_BATCH_LIST_NOT_READY'}),
   ()=>respond({status:'MANUAL_BATCH_LIST_NOT_READY'}));
  return true;
 });
}

/**
 * Read-only Chrome Downloads audit for range ZIP. Never claims that clicking
 * an <a download> guarantees persistence. The list tab polls the download
 * state and advances the checkpoint only after COMPLETE.
 */
const RANGE_DOWNLOAD_AUDIT='vision-range-download-audit-v1';
function isApprovedListSender(sender){
 try{
  const u=new URL(sender?.url||'');
  return sender?.frameId===0&&Number.isInteger(sender?.tab?.id)&&
   u.origin===TABLE_ORIGIN&&/^\/devorders(?:\/|$)/.test(u.pathname);
 }catch{return false}
}
if(typeof chrome!=='undefined'&&chrome.runtime?.onMessage){
 chrome.runtime.onMessage.addListener((message,sender,respond)=>{
  if(message?.op!==RANGE_DOWNLOAD_AUDIT)return false;
  if(!isApprovedListSender(sender)||typeof chrome.downloads?.search!=='function'){
   respond({status:'MANUAL_RANGE_AUDIT_DENIED'});return false;
  }
  const phase=message.phase;
  if(phase!=='baseline'&&phase!=='check'){
   respond({status:'MANUAL_RANGE_AUDIT_PHASE'});return false;
  }
  chrome.downloads.search({}).then(items=>{
   if(phase==='baseline'){
    respond({status:'RANGE_DOWNLOAD_BASELINE',
     highest_id:Math.max(0,...items.map(x=>x.id).filter(Number.isSafeInteger))});
    return;
   }
   const after=message.after_id,expected=message.byte_length;
    const filename=message.expected_filename;
    if(!Number.isSafeInteger(after)||after<0||
      !Number.isSafeInteger(expected)||expected<100||expected>200_000_000||
      typeof filename!=='string'||
      !/^vision-ai-range-\d{7}-\d{7}-part-\d{5}-\d{7}-\d{7}\.zip$/.test(filename)){
    respond({status:'MANUAL_RANGE_AUDIT_ARGS'});return;
   }
   const matching=items.filter(x=>{
     const basename=String(x.filename||'').split(/[\\/]/).at(-1);
     const normalized=basename.replace(/ \(\d+\)(?=\.zip$)/,'');
     // Headless Chromium stores completed downloads under opaque UUID
     // filenames. Its suggested filename remains available to the
     // initiating page, not through downloads.search(). In that case rely
     // on the strictly newer download ID, byte-exact size, ZIP MIME and
     // pinned first-party blob URL; never accept a different named file.
     const opaqueName=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(basename);
     return x.id>after&&x.mime==='application/zip'&&
      (x.totalBytes===expected||x.fileSize===expected)&&
      (x.url||'').startsWith('blob:http://psk.testgifts.local/')&&
      (normalized===filename||opaqueName);
    });
   const status=matching.some(x=>x.state==='complete')?
    'RANGE_DOWNLOAD_COMPLETE':matching.some(x=>x.state==='interrupted')?
    'MANUAL_RANGE_DOWNLOAD_INTERRUPTED':'RANGE_DOWNLOAD_PENDING';
   respond({status,matched:matching.length});
  },()=>respond({status:'MANUAL_RANGE_AUDIT_FAILED'}));
  return true;
 });
}
const QUEUE_RUN='vision-approval-order-queue-v1';
const ORDER_URL=/^http:\/\/testgifts\.local\/private\/order\/[0-9]{5,12}$/;
let queueRunning=false;
const QUEUE_STATUS='vision-approval-queue-status-v1';
if(typeof chrome!=='undefined'&&chrome.runtime?.onMessage){
 chrome.runtime.onMessage.addListener((message,sender,respond)=>{
  if(message?.op!==QUEUE_STATUS)return false;
  if(!isApprovedListSender(sender)){
   respond({status:'MANUAL_QUEUE_STATUS_DENIED'});return false;
  }
  respond({status:'QUEUE_STATUS_OK',busy:queueRunning});return false;
 });
}
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function runNativeApprovalOrder(url,listTabId,rangeMode=false){
 let tab=null;
 try{
  tab=await chrome.tabs.create({url,active:false});
  if(!Number.isInteger(tab?.id))return {status:'MANUAL_BACKGROUND_TAB_FAILED'};
  if(!Number.isInteger(listTabId))return {status:'MANUAL_SOURCE_TAB_UNKNOWN'};
  activeBatch={orderTabId:tab.id,listTabId,orderUrl:url};
  let result=null,ready=false;
  // An MV3 document_idle content script may register after tab completed.
  for(let attempt=0;attempt<40;attempt++){
   try{
    result=await Promise.race([
      chrome.tabs.sendMessage(tab.id,{op:'vision-approval-order-collect-v1',
       order_url:url,batch_mode:true,require_tz_approved:rangeMode}),
      new Promise((_,reject)=>setTimeout(()=>reject(Error('QUEUE_ORDER_TIMEOUT')),180000))
    ]);
    ready=true;break;
   }catch(error){
    const reason=String(error?.message||error||'');
    // Never retry a native scan after it has started: duplicated exports
    // could overwrite files or repeat authenticated GETs.
    if(!/Receiving end does not exist|Could not establish connection/i.test(reason))
     return {status:/QUEUE_ORDER_TIMEOUT/.test(reason)?
      'MANUAL_ORDER_TIMEOUT':'MANUAL_ORDER_SCAN_FAILED'};
    let present=false;
    try{present=!!(await chrome.tabs.get(tab.id)).status}catch{}
    if(!present)return {status:'MANUAL_TAB_CLOSED'};
    await pause(250);
   }
  }
  if(!ready||!result||typeof result!=='object'){
   let stage='UNKNOWN';
   try{
    const current=await chrome.tabs.get(tab.id);
    const location=new URL(current.url||current.pendingUrl||'about:blank');
    stage=location.href===url?'EXPECTED_'+(current.status==='complete'?
      'COMPLETE':'LOADING'):location.protocol==='chrome-error:'?
      'ERROR_PAGE':'OTHER';
   }catch{stage='TAB_UNREADABLE'}
   return {status:'MANUAL_ORDER_TAB_'+stage};
  }
  // Close only our own tab, after browser has initiated local downloads.
  await pause(1400);
  const safeStatus=/^[A-Z][A-Z0-9_]{2,70}$/.test(result.status||'')?
    result.status:'MANUAL_UNKNOWN_RESULT';
  const count=x=>Number.isSafeInteger(x)&&x>=0&&x<=10000?x:0;
  return {status:safeStatus,eligible_articles:count(result.eligible_articles),
   verified_articles:count(result.verified_articles),files:count(result.files),
   zip_parts:count(result.zip_parts),failures:count(result.failures),
   private_text_saved:result.private_text_saved===true,
   final_evidence_saved:result.final_evidence_status==='BATCH_EVIDENCE_STAGED',
   raw_evidence_saved:result.raw_evidence_status==='BATCH_EVIDENCE_STAGED',
    batch_staged:result.batch_mode===true};
 }catch{return {status:'MANUAL_BACKGROUND_ORDER_FAILED'}}
 finally{
  if(activeBatch?.orderTabId===tab?.id)activeBatch=null;
  if(tab?.id)try{await chrome.tabs.remove(tab.id)}catch{}
 }
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
  runNativeApprovalOrder(url,sender?.tab?.id,message.require_tz_approved===true).then(respond,()=>
   respond({status:'MANUAL_BACKGROUND_ORDER_FAILED'})).finally(()=>{
    queueRunning=false;
  });
  return true;
 });
}
