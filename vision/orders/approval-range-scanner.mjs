/**
 * Vision AI M3.25: authorized, read-only numeric range preflight.
 * Source evidence: native test Gifts #j_cart_host .cart-log
 * input.j_toggle_status[data-id="59"][type="checkbox"] CHECKED, not
 * the duplicated always-visible 'ТЗ утверждено' on/off labels.
 */
import {inertOrderDiscussionHtml} from './order-page-discovery.mjs';

export const RANGE_MIN=3_200_000;
export const RANGE_MAX=8_200_000;
export const RANGE_ARCHIVE_SIZE=100;
export const RANGE_MIN_DELAY_MS=100;
const MAX_BODY=3_000_000;
const digits=s=>/^\d{5,12}$/.test(String(s||''));
const clear=s=>String(s||'').replace(/\s+/g,' ').trim().toLocaleUpperCase('ru-RU');
const exactText=s=>clear(s)==='ТЗ УТВЕРЖДЕНО';

export function rangeOrderUrl(number){
 if(!Number.isSafeInteger(number)||number<RANGE_MIN||number>RANGE_MAX)
  throw Error('MANUAL_RANGE_ORDER_INVALID');
 return 'http://testgifts.local/private/order/'+number;
}
/** Never infer approval from a text label, activity log or 140 status. */
export function readTzApprovedStatus(doc,orderNumber){
 if(!digits(orderNumber)||!doc?.querySelector)return {status:'MANUAL_ORDER_ID_INVALID'};
 const root=doc.querySelector('#j_cart_host[data-orderid]');
 if(!root)return {status:'MANUAL_ORDER_CARD_MISSING'};
 const shown=root.querySelector('.cart-header-number [data-clipboard-text]')?.
  getAttribute('data-clipboard-text')?.trim();
 if(shown!==String(orderNumber))return {status:'MANUAL_ORDER_NUMBER_MISMATCH'};
 const fields=[...root.querySelectorAll(
  '.cart-log label input.j_toggle_status[data-id="59"][type="checkbox"]')];
 if(fields.length!==1)return {status:'MANUAL_TZ_STATUS_MISSING_OR_AMBIGUOUS'};
 const input=fields[0],label=input.closest('label');
 const texts=[...label?.querySelectorAll('.btn--toggle .on,.btn--toggle .off')||[]]
  .map(node=>node.textContent);
 if(texts.length!==2||!texts.every(exactText))
  return {status:'MANUAL_TZ_LABEL_UNVERIFIED'};
 return {
  status:input.checked===true?
   'TZ_APPROVED':'TZ_NOT_APPROVED',
  native_status_id:'59',
  status_text:'ТЗ утверждено',
  status_checked:input.checked===true,
  native_order_id:root.getAttribute('data-orderid')||null
 };
}
function safeDoc(html,DOMParserClass){
 if(typeof html!=='string'||html.length>MAX_BODY||typeof DOMParserClass!=='function')
  return null;
 const inert=inertOrderDiscussionHtml(html);
 if(!inert)return null;
 try{return new DOMParserClass().parseFromString(inert,'text/html')}catch{return null}
}
async function boundedHtml(response){
 const type=response.headers?.get?.('content-type')||'';
 if(!/html/i.test(type))throw Error('MANUAL_NON_HTML_RESPONSE');
 const announced=response.headers?.get?.('content-length');
 if(announced&&Number(announced)>MAX_BODY)throw Error('MANUAL_ORDER_BODY_TOO_LARGE');
 if(!response.body?.getReader){
  const data=await response.text();
  if(data.length>MAX_BODY)throw Error('MANUAL_ORDER_BODY_TOO_LARGE');
  return data;
 }
 const reader=response.body.getReader(),parts=[];
 let bytes=0;
 try{
  while(true){
   const {done,value}=await reader.read();if(done)break;
   bytes+=value.byteLength;
   if(bytes>MAX_BODY)throw Error('MANUAL_ORDER_BODY_TOO_LARGE');
   parts.push(value);
  }
 }finally{reader.releaseLock()}
 const out=new Uint8Array(bytes);let offset=0;
 for(const part of parts){out.set(part,offset);offset+=part.length}
 return new TextDecoder('utf-8',{fatal:true}).decode(out);
}
/**
 * One exact GET and zero modal requests for every rejected/nonexistent number.
 * Ambiguous responses are NOT silently advanced by the range controller.
 */
export async function probeTzForOrder(orderNumber,{
 fetcher=globalThis.__visionLocalTrustedTransport,
 DOMParserClass=globalThis.DOMParser,signal
}={}){
 const url=rangeOrderUrl(orderNumber);
 if(typeof fetcher!=='function')return {status:'MANUAL_MV3_TRANSPORT_REQUIRED'};
 let response;
 try{
  response=await fetcher(url,{method:'GET',signal,credentials:'include',
   redirect:'error',cache:'no-store'});
  if(response.status===404||response.status===410)
   return {status:'ORDER_NOT_FOUND',http_status:response.status};
  if(response.status===401||response.status===403)
   return {status:'MANUAL_ORDER_AUTH_REQUIRED',http_status:response.status};
  if(response.status===429)
   return {status:'MANUAL_ORDER_RATE_LIMITED',http_status:429};
  if(response.status!==200)
   return {status:'MANUAL_ORDER_HTTP_STATUS',http_status:response.status};
  const html=await boundedHtml(response);
  if(/<form[^>]+name=["']authform["']/i.test(html)||
   /Авторизация\s*-\s*Проект\s*111/i.test(html))
   return {status:'MANUAL_ORDER_AUTH_REQUIRED'};
  const doc=safeDoc(html,DOMParserClass);
  if(!doc)return {status:'MANUAL_ORDER_HTML_INVALID'};
  return readTzApprovedStatus(doc,String(orderNumber));
 }catch(error){
  if(signal?.aborted)return {status:'MANUAL_PROBE_CANCELLED'};
  const token=String(error?.message||'');
  if(token==='EXTENSION_AUTH_REDIRECT'||token==='TEST_SESSION_AUTH_REQUIRED')
   return {status:'MANUAL_ORDER_AUTH_REQUIRED'};
  if(token==='MANUAL_ORDER_BODY_TOO_LARGE'||token==='MANUAL_NON_HTML_RESPONSE')
   return {status:token};
  return {status:'MANUAL_ORDER_FETCH_FAILED'};
 }
}
/**
 * A missing/broken individual order card does not block enumeration.
 * Authentication failures, rate-limits, or a dead extension must not be
 * mistaken for missing orders. Transient failures enter the retry register.
 */
export const RECOVERABLE_RANGE_FAILURES=new Set([
 'MANUAL_ORDER_FETCH_FAILED','MANUAL_ORDER_HTTP_STATUS',
 'MANUAL_ORDER_BODY_TOO_LARGE','MANUAL_NON_HTML_RESPONSE',
 'MANUAL_ORDER_HTML_INVALID','MANUAL_ORDER_CARD_MISSING',
 'MANUAL_ORDER_NUMBER_MISMATCH','MANUAL_TZ_STATUS_MISSING_OR_AMBIGUOUS',
 'MANUAL_TZ_LABEL_UNVERIFIED','MANUAL_ORDER_ID_INVALID',
 'MANUAL_BACKGROUND_ORDER_FAILED','MANUAL_QUEUE_ORDER_TIMEOUT',
 'MANUAL_TAB_CLOSED','MANUAL_ORDER_URL_MISMATCH',
 'MANUAL_AUTO_SCAN_FAILED','MANUAL_TZ_RECHECK_FAILED',
 'MANUAL_TZ_CHANGED_BEFORE_SCAN','MANUAL_NATIVE_APPROVAL_QUEUE_FAILED',
 'MANUAL_BATCH_EVIDENCE_ENCODING_FAILED',
 'MANUAL_BATCH_RELAY_FAILED','MANUAL_BATCH_RELAY_REJECTED',
 'MANUAL_BATCH_PAYLOAD_TOO_LARGE','MANUAL_APPROVAL_COLLECTION_INCOMPLETE'
]);
export function isRecoverableRangeFailure(status){
 return RECOVERABLE_RANGE_FAILURES.has(status)||
  /^MANUAL_ORDER_TAB_[A-Z0-9_]{1,80}$/.test(status||'');
}
const MAX_RETRY_ROWS=20_000;
function mergeRetryRows(previous,additions){
 if(!Array.isArray(additions)||additions.length>RANGE_ARCHIVE_SIZE*100)
  throw Error('MANUAL_RETRY_REGISTRY_INVALID');
 const unique=new Map();
 for(const record of [...previous||[],...additions]){
  if(!/^\d{5,12}$/.test(record?.order_number||'')||
   typeof record?.reason!=='string'||record.reason.length>90||
   !isRecoverableRangeFailure(record.reason))
   throw Error('MANUAL_RETRY_ROW_INVALID');
  unique.set(record.order_number,record);
 }
 if(unique.size>MAX_RETRY_ROWS)throw Error('MANUAL_RETRY_REGISTRY_LIMIT');
 return [...unique.values()];
}
export function rangeConfig(start,end,delay=RANGE_MIN_DELAY_MS){
 const n=Number(start),m=Number(end),ms=Number(delay);
 if(!Number.isSafeInteger(n)||!Number.isSafeInteger(m)||
  n<RANGE_MIN||m>RANGE_MAX||n>m)
  throw Error('MANUAL_RANGE_BOUNDS_INVALID');
 if(!Number.isSafeInteger(ms)||ms<RANGE_MIN_DELAY_MS||ms>60_000)
  throw Error('MANUAL_RANGE_RATE_INVALID');
 return {start:n,end:m,delay_ms:ms,archive_size:RANGE_ARCHIVE_SIZE};
}
/**
 * Delay is an operational preference, not range identity. Adjusting it
 * must never reset the committed cursor, found records or failed-order log.
 */
export function changeRangeDelay(checkpoint,delayMs){
 if(checkpoint?.schema!=='printcheck.vision.range-checkpoint.v1'||
  !checkpoint.config)throw Error('MANUAL_RANGE_CHECKPOINT_INVALID');
 const newConfig=rangeConfig(checkpoint.config.start,
  checkpoint.config.end,delayMs);
 if(newConfig.archive_size!==checkpoint.config.archive_size)
  throw Error('MANUAL_RANGE_CHECKPOINT_ARCHIVE_SIZE');
 return {...checkpoint,config:newConfig,updated_at:new Date().toISOString()};
}
export function freshRangeCheckpoint(config){
 return {
  schema:'printcheck.vision.range-checkpoint.v1',
  config,committed_next:config.start,
  archives_completed:0,found_committed:0,checked_committed:0,
  registry:[],failed_orders:[],created_at:new Date().toISOString(),updated_at:new Date().toISOString()
 };
}
/**
 * Skips/nonexistent orders may advance the cursor only when the collector has
 * NO unarchived approved order evidence. This makes restart idempotent.
 */
export function commitOnlySkipped(checkpoint,next,failedOrders=[]){
 if(checkpoint?.schema!=='printcheck.vision.range-checkpoint.v1'||
  !Number.isSafeInteger(next)||next<checkpoint.committed_next||
  next>checkpoint.config.end+1)throw Error('MANUAL_SKIPPED_CHECKPOINT_INVALID');
 return {...checkpoint,committed_next:next,
  failed_orders:mergeRetryRows(checkpoint.failed_orders||[],failedOrders),
  checked_committed:checkpoint.checked_committed+
   (next-checkpoint.committed_next),
  updated_at:new Date().toISOString()};
}
/** Only advance durable cursor after a batch ZIP has actually saved. */
export function commitRangeArchive(checkpoint,record){
 if(checkpoint?.schema!=='printcheck.vision.range-checkpoint.v1'||
  !Number.isSafeInteger(record?.next)||
  record.next<checkpoint.committed_next||record.next>checkpoint.config.end+1||
  !Array.isArray(record?.found)||record.found.length>RANGE_ARCHIVE_SIZE)
  throw Error('MANUAL_CHECKPOINT_COMMIT_INVALID');
 const current={...checkpoint,committed_next:record.next,
  archives_completed:checkpoint.archives_completed+1,
  found_committed:checkpoint.found_committed+record.found.length,
  checked_committed:checkpoint.checked_committed+
   (record.next-checkpoint.committed_next),
  registry:[...checkpoint.registry,...record.found],
  failed_orders:mergeRetryRows(checkpoint.failed_orders||[],record.failed_orders||[]),
  updated_at:new Date().toISOString()};
 if(current.registry.length>100_000)throw Error('MANUAL_REGISTRY_CAPACITY');
 return current;
}
