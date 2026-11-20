/**
 * Vision C3B.3.R / Chrome Manifest V3 service worker.
 * Pre-installed by user; runs only with exact test-host permissions.
 * Never accepts arbitrary URL fetches, other methods or remote data sinks.
 * No response data is stored, logged, uploaded, cached, or posted to the site.
 */
'use strict';
if(typeof importScripts==='function')importScripts('archive-registry.js');
const ENGINE_PAGE='scanner-host.html';
const ENGINE_URL=()=>chrome.runtime.getURL(ENGINE_PAGE);
const isEnginePage=u=>typeof chrome?.runtime?.getURL==='function'&&u.href===ENGINE_URL();
const TEST_HOSTS=new Set(['psk.testgifts.local','testgifts.local','files.testgifts.local']);
const TABLE_ORIGIN='http://psk.testgifts.local';
const PORT_NAME='vision-order-lan-readonly-v1';
const MAX_DOCUMENT_BYTES=3_000_000,MAX_ARTWORK_BYTES=16_000_000;
const CHUNK_BYTES=48*1024;
function sourceAllowed(sender){
 try{
  const u=new URL(sender?.url||sender?.tab?.url||'');
  return isEnginePage(u)||(sender.frameId===0&&(
    (u.origin===TABLE_ORIGIN&&
     (u.pathname==='/devorders'||u.pathname.startsWith('/devorders/')))||
    (u.origin==='http://testgifts.local'&&
     /^\/private\/order\/\d{5,12}\/?$/.test(u.pathname))));
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
  const transfer={
   op:BATCH_ACCEPT,order_number:order,kind:message.kind,
   stage:message.stage,part:message.part,
   sequence:message.sequence,chunk_count:message.chunk_count,chunk:data
  };
  const relay=running.engineHost?chrome.runtime.sendMessage(transfer):
   chrome.tabs.sendMessage(running.listTabId,transfer);
  relay.then(result=>respond(result||{status:'MANUAL_BATCH_LIST_NOT_READY'}),
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
  return (isEnginePage(u)||(sender?.frameId===0&&
   Number.isInteger(sender?.tab?.id)&&u.origin===TABLE_ORIGIN&&
    /^\/devorders(?:\/|$)/.test(u.pathname)));
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
      !/^vision-ai-(?:range-\d{7}-\d{7}-part|list-part)-\d{5}-\d{7}-\d{7}\.zip$/.test(filename)){
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
      ((x.url||'').startsWith('blob:http://psk.testgifts.local/')||
       (x.url||'').startsWith('blob:'+chrome.runtime.getURL('')))&&
      (normalized===filename||opaqueName);
    });
   // Chrome security verdict is authoritative. Do not use acceptDanger
   // or auto-approve blocked ZIPs; notify the user and retain local evidence.
   const danger=matching.find(x=>x.danger&&
    !['safe','accepted'].includes(x.danger));
   if(danger){
    respond({status:'MANUAL_ZIP_CHROME_SECURITY_REVIEW_REQUIRED',
     danger:String(danger.danger).slice(0,70),matched:matching.length});
    return;
   }
   const status=matching.some(x=>x.state==='complete')?
    'RANGE_DOWNLOAD_COMPLETE':matching.some(x=>x.state==='interrupted')?
    'MANUAL_RANGE_DOWNLOAD_INTERRUPTED':'RANGE_DOWNLOAD_PENDING';
   const verified=matching.find(x=>x.state==='complete')||matching[0];
   respond({status,matched:matching.length,
    ...(verified?{download_id:verified.id,
     bytes_saved:Number.isSafeInteger(verified.fileSize)?verified.fileSize:0,
     download_state:verified.state||'unknown',
     danger:verified.danger||'unknown'}:{})});
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
async function runNativeApprovalOrder(url,listTabId,rangeMode=false,engineHost=false){
 let tab=null;
 try{
  tab=await chrome.tabs.create({url,active:false});
  if(!Number.isInteger(tab?.id))return {status:'MANUAL_BACKGROUND_TAB_FAILED'};
  if(!engineHost&&!Number.isInteger(listTabId))return {status:'MANUAL_SOURCE_TAB_UNKNOWN'};
  activeBatch={orderTabId:tab.id,listTabId,orderUrl:url,engineHost};
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
   sourceOK=isEnginePage(u)||(sender?.frameId===0&&
    u.origin===TABLE_ORIGIN&&
    (u.pathname==='/devorders'||u.pathname.startsWith('/devorders/')));
  }catch{}
  if(!sourceOK||typeof url!=='string'||!ORDER_URL.test(url)){
   respond({status:'MANUAL_QUEUE_SOURCE_DENIED'});return false;
  }
  if(queueRunning){
   respond({status:'MANUAL_QUEUE_ALREADY_RUNNING'});return false;
  }
  queueRunning=true;
  runNativeApprovalOrder(url,sender?.tab?.id,message.require_tz_approved===true,
   sender?.url===ENGINE_URL()).then(respond,()=>
   respond({status:'MANUAL_BACKGROUND_ORDER_FAILED'})).finally(()=>{
    queueRunning=false;
  });
  return true;
 });
}


/** The dedicated extension-origin engine replaces the old /devorders host.
 * It never navigates to the order table. The active portal remains visible.
 */
const SCANNER_START='vision-open-scanner-v1';
if(typeof chrome!=='undefined'&&chrome.runtime?.onMessage){
 chrome.runtime.onMessage.addListener((message,sender,respond)=>{
  if(message?.op!==SCANNER_START)return false;
  if(!isAuthorizedPortalSender(sender)){
   respond({status:'VISION_SCANNER_SOURCE_DENIED'});return false;
  }
  (async()=>{
   const host=await ensureScannerTab();
   await chrome.tabs.update(host.id,{active:true});
   if(Number.isInteger(host.windowId))
    await chrome.windows.update(host.windowId,{focused:true}).catch(()=>{});
   return {status:'VISION_SCANNER_OPENED',reused:true};
  })().then(respond,()=>respond({status:'VISION_SCANNER_TAB_FAILED'}));
  return true;
 });
}

const REMOTE_SCAN='vision-remote-scanner-v1';
let creatingScannerTab=null;
function isAuthorizedPortalSender(sender){
 try{
  const u=new URL(sender?.url||'');
  return sender?.frameId===0&&Number.isInteger(sender?.tab?.id)&&
   u.protocol==='http:'&&u.port===''&&
   ['psk.testgifts.local','testgifts.local'].includes(u.hostname);
 }catch{return false}
}
async function ensureScannerTab(){
 const url=ENGINE_URL(),tabs=await chrome.tabs.query({});
 const found=tabs.find(t=>t.url===url||t.pendingUrl===url);
 if(found){
  if(found.discarded)await chrome.tabs.reload(found.id);
  return found;
 }
 if(!creatingScannerTab){
  creatingScannerTab=chrome.tabs.create({url,active:false})
   .finally(()=>{creatingScannerTab=null});
 }
 return creatingScannerTab;
}
const remoteWait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function forwardScannerAction(request){
 const tab=await ensureScannerTab();
 if(!Number.isInteger(tab?.id))return {status:'VISION_ENGINE_TAB_UNAVAILABLE'};
 const message={op:'vision-engine-command-v1',mode:'file',
  action:request.action,payload:request.payload||{}};
 for(let attempt=0;attempt<40;attempt++){
  try{
   const result=await chrome.runtime.sendMessage(message);
   if(result&&typeof result==='object')return result;
  }catch(error){
   const reason=String(error?.message||error||'');
   if(!/Receiving end does not exist|Could not establish connection/i.test(reason))
    return {status:'VISION_ENGINE_RELAY_FAILED'};
  }
  await remoteWait(250);
 }
 return {status:'VISION_ENGINE_NOT_READY_OR_UNAUTHORIZED'};
}
if(typeof chrome!=='undefined'&&chrome.runtime?.onMessage){
 chrome.runtime.onMessage.addListener((message,sender,respond)=>{
  if(message?.op!==REMOTE_SCAN)return false;
  if(!isAuthorizedPortalSender(sender)){
   respond({status:'VISION_REMOTE_SOURCE_DENIED'});return false;
  }
  if(message.mode!=='file'||
   !['status','start','pause','stop','reset','import','delay','save','export'].includes(message.action)){
   respond({status:'VISION_REMOTE_COMMAND_DENIED'});return false;
  }
  if(message.action==='import'){
   if(typeof message.payload?.text!=='string'||
    message.payload.text.length>20_000_000||
    typeof message.payload.filename!=='string'||
    message.payload.filename.length>120){
    respond({status:'VISION_REMOTE_IMPORT_INVALID'});return false;
   }
  }
  forwardScannerAction(message).then(respond,()=>respond({
   status:'VISION_REMOTE_ENGINE_FAILED'}));
  return true;
 });
}


/**
 * Vision 0.1.15: native Chrome Downloads from an extension-origin ZIP blob.
 * The HTTP portal does NOT initiate the download. We do not override Chrome
 * danger verdicts or call acceptDanger. All data stays local in Chrome.
 */
const SECURE_ZIP_PORT='vision-ai-zip-secure-v1';
let creatingZipOffscreen=null,zipTransferOwner=null;
const zipUrls=new Map();
const ZIP_URL_MAP_KEY='vision-ai-active-zip-blob-urls-v1';
async function keepZipBlobUntilChromeCompletes(id,url){
 zipUrls.set(id,url);
 if(chrome.storage?.session){
  const state=(await chrome.storage.session.get(ZIP_URL_MAP_KEY))[ZIP_URL_MAP_KEY]||{};
  await chrome.storage.session.set({[ZIP_URL_MAP_KEY]:{...state,[id]:url}});
 }
 // Chrome may finish a tiny ZIP before the above session write completes.
 const downloads=await chrome.downloads.search({id});
 if(downloads.some(x=>x.state==='complete'||x.state==='interrupted'))
  await releaseZipBlob(id);
}
async function releaseZipBlob(id){
 let saved={};
 if(chrome.storage?.session){
  saved=(await chrome.storage.session.get(ZIP_URL_MAP_KEY))[ZIP_URL_MAP_KEY]||{};
 }
 const url=zipUrls.get(id)||saved[id];
 zipUrls.delete(id);
 if(saved[id]){
  delete saved[id];
  await chrome.storage.session.set({[ZIP_URL_MAP_KEY]:saved});
 }
 if(url)await sendZipOffscreen('release',{url}).catch(()=>{});
}

const zipFileName=/^vision-ai-(?:range-\d{7}-\d{7}-part|list-part)-\d{5}-\d{7}-\d{7}\.zip$/;
async function getZipOffscreen(){
 if(!chrome.offscreen?.createDocument||!chrome.runtime?.getContexts)
  throw Error('VISION_ZIP_OFFSCREEN_NOT_AVAILABLE');
 const offscreenUrl=chrome.runtime.getURL('zip-offscreen.html');
 const existing=await chrome.runtime.getContexts({
  contextTypes:['OFFSCREEN_DOCUMENT'],documentUrls:[offscreenUrl]
 });
 if(existing.length)return;
 if(!creatingZipOffscreen){
  creatingZipOffscreen=chrome.offscreen.createDocument({
   url:'zip-offscreen.html',reasons:['BLOBS'],
   justification:'Create a local ZIP Blob on the secure extension origin for a user-initiated export.'
  }).finally(()=>{creatingZipOffscreen=null});
 }
 await creatingZipOffscreen;
}
const sendZipOffscreen=async(op,data={})=>{
 const result=await chrome.runtime.sendMessage({
  op:'vision-zip-offscreen-'+op,...data
 });
 if(!result||typeof result.status!=='string')
  throw Error('VISION_ZIP_OFFSCREEN_NO_RESPONSE');
 return result;
};
// Each chunk is a standalone MV3 event, so a sleeping/restarted service
// worker does not interrupt a long ZIP transfer. Offscreen owns byte state.
if(typeof chrome!=='undefined'&&chrome.runtime?.onMessage){
 chrome.runtime.onMessage.addListener((message,sender,respond)=>{
  if(message?.op!=='vision-zip-secure-message-v1')return false;
  if(!isApprovedListSender(sender)||typeof message.job!=='string'||
    !/^[a-f0-9]{32}$/.test(message.job)){
   respond({status:'VISION_ZIP_SENDER_DENIED'});return false;
  }
  (async()=>{
   const job=message.job,action=message.action;
   if(!['begin','chunk','finish','cancel'].includes(action))
    throw Error('VISION_ZIP_OPCODE_DENIED');
   if(action==='begin')await getZipOffscreen();
   const data={job};
   if(action==='begin'){
    if(!zipFileName.test(message.filename||'')||
     !Number.isSafeInteger(message.size)||message.size<100||
     message.size>200_000_000)
     throw Error('VISION_ZIP_BEGIN_ARGS');
    Object.assign(data,{filename:message.filename,size:message.size});
   }else if(action==='chunk'){
    if(!Number.isSafeInteger(message.sequence)||message.sequence<0||
     typeof message.base64!=='string'||message.base64.length>65_000)
     throw Error('VISION_ZIP_CHUNK_ARGS');
    Object.assign(data,{sequence:message.sequence,base64:message.base64});
   }else if(action==='finish'){
    if(!Number.isSafeInteger(message.chunks)||message.chunks<1||
     message.chunks>5000)throw Error('VISION_ZIP_FINISH_ARGS');
    data.chunks=message.chunks;
   }
   const result=await sendZipOffscreen(action,data);
   if(action!=='finish')return result;
   if(result.status!=='ZIP_EXTENSION_BLOB_READY'||typeof result.url!=='string'||
    !result.url.startsWith('blob:'+chrome.runtime.getURL(''))||
    !Number.isSafeInteger(result.bytes)||result.bytes<100)
    throw Error(result.status||'VISION_ZIP_BLOB_INVALID');
   let id;
   try{
    const pref=await VisionArchives.config();
    const suggested=pref.mode==='ask'?result.filename:
     pref.folder+'/'+result.filename;
    id=await chrome.downloads.download({url:result.url,
     filename:suggested,conflictAction:'uniquify',saveAs:pref.mode==='ask'});
    if(Number.isSafeInteger(id))try{
     await VisionArchives.begin(id,result.filename,result.bytes,pref);
    }catch(error){
     console.error('VISION_ARCHIVE_REGISTRY',String(error?.message||'UNKNOWN').slice(0,80));
    }
    if(!Number.isSafeInteger(id)||id<0)
     throw Error('VISION_ZIP_DOWNLOAD_ID_INVALID');
   }catch{
    await sendZipOffscreen('release',{url:result.url}).catch(()=>{});
    throw Error('VISION_ZIP_DOWNLOAD_FAILED');
   }
   await keepZipBlobUntilChromeCompletes(id,result.url);
   return {status:'ZIP_DOWNLOAD_STARTED',download_id:id};
  })().then(respond,error=>{
   console.error('VISION_ZIP_TRANSFER',String(error?.message||'UNKNOWN').slice(0,100));
   respond({status:String(error?.message||'VISION_ZIP_TRANSFER_FAILED').slice(0,100)});
  });
  return true;
 });
}
if(typeof chrome!=='undefined'&&chrome.downloads?.onChanged){
 chrome.downloads.onChanged.addListener(delta=>{
  if(!['complete','interrupted'].includes(delta?.state?.current))return;
  // The onChanged event wakes a previously stopped MV3 worker; recover
  // transient Blob mapping from storage.session, then release its memory.
  void releaseZipBlob(delta.id).catch(()=>{});
  if(typeof VisionArchives!=='undefined')
   void VisionArchives.reconcile(delta.id).catch(()=>{});
 });
}

/** Archive settings are available on any authorized test-portal page.
 * Never accept arbitrary paths, web URLs or upload destinations.
 */
const ARCHIVE_CONTROL='vision-archive-settings-v1';
if(typeof chrome!=='undefined'&&chrome.runtime?.onMessage){
 chrome.runtime.onMessage.addListener((message,sender,reply)=>{
  if(message?.op!==ARCHIVE_CONTROL)return false;
  if(!isAuthorizedPortalSender(sender)&&!isApprovedListSender(sender)){
   reply({status:'VISION_ARCHIVE_SOURCE_DENIED'});return false;
  }
  (async()=>{
   if(message.action==='get')return {status:'VISION_ARCHIVE_SETTINGS_OK',
    ...await VisionArchives.config()};
   if(message.action==='set')return VisionArchives.setConfig(message.payload);
   if(message.action==='list')return {status:'VISION_ARCHIVE_LIST_OK',
    items:await VisionArchives.inspect(message.limit===10000?10000:100),
    config:await VisionArchives.config()};
   return {status:'VISION_ARCHIVE_ACTION_DENIED'};
  })().then(reply,error=>reply({status:'VISION_ARCHIVE_STORE_FAILED',
   reason:String(error?.message||'UNKNOWN').slice(0,90)}));
  return true;
 });
}
/** Explicit, non-destructive engine reload clears an in-memory stale flag. */
if(typeof chrome!=='undefined'&&chrome.runtime?.onMessage){
 chrome.runtime.onMessage.addListener((message,sender,reply)=>{
  if(message?.op!=='vision-recover-scanner-v1')return false;
  if(!isAuthorizedPortalSender(sender)){
   reply({status:'VISION_RECOVER_SOURCE_DENIED'});return false;
  }
  (async()=>{
   const tab=await ensureScannerTab();
   await chrome.tabs.reload(tab.id);
   return {status:'VISION_SCANNER_RELOAD_REQUESTED'};
  })().then(reply,()=>reply({status:'VISION_SCANNER_RELOAD_FAILED'}));
  return true;
 });
}
/** Remove obsolete range checkpoint automatically on extension update.
 * Never remove prior site-origin IndexedDB with unconfirmed raw files.
 */
if(typeof chrome!=='undefined'&&chrome.runtime?.onInstalled){
 chrome.runtime.onInstalled.addListener(details=>{
  if(details.reason==='update')
   void chrome.storage.local.remove('vision-ai-approved-range-checkpoint-v1').catch(()=>{});
 });
}
