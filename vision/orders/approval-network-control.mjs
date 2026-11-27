/**
 * Vision AI M3.32: bounded, side-effect-free network monitor for HTTP
 * preflight on exact allowlisted order URLs. No order tab is created here.
 * Separates transient connection failures from auth / rate-limit failures.
 */
export const NETWORK_RETRY_LIMIT=3;
export const NETWORK_CIRCUIT_LIMIT=6;
export const freshNetworkHealth=()=>({
 attempts:0,retries:0,transient_errors:0,consecutive_errors:0,
 auth_errors:0,rate_limits:0,last_error:null,last_http_status:null,
 last_error_at:null,last_success_at:null,last_request_at:null,
 state:'idle',last_duration_ms:null
});
export function normalizeNetworkHealth(value){
 const base=freshNetworkHealth();
 if(!value||typeof value!=='object')return base;
 for(const key of ['attempts','retries','transient_errors','consecutive_errors',
  'auth_errors','rate_limits']){
  const n=value[key];
  if(Number.isSafeInteger(n)&&n>=0)base[key]=n;
 }
 for(const key of ['last_error','last_error_at','last_success_at',
  'last_request_at','state']){
  if(typeof value[key]==='string'&&value[key].length<=100)
   base[key]=value[key];
 }
 if(Number.isInteger(value.last_http_status)&&value.last_http_status>=100&&
  value.last_http_status<=599)base.last_http_status=value.last_http_status;
 if(Number.isSafeInteger(value.last_duration_ms)&&value.last_duration_ms>=0)
  base.last_duration_ms=value.last_duration_ms;
 return base;
}
export function networkFailureType(result){
 const status=String(result?.status||'');
 if(status==='MANUAL_ORDER_AUTH_REQUIRED')return 'auth';
 if(status==='MANUAL_ORDER_RATE_LIMITED')return 'rate_limit';
 if(['MANUAL_ORDER_FETCH_FAILED','EXTENSION_FETCH_TIMEOUT',
   'MANUAL_NON_HTML_RESPONSE'].includes(status))return 'transient';
 if(status==='MANUAL_ORDER_HTTP_STATUS'){
  if(result.http_status===401||result.http_status===403)return 'auth';
  if(result.http_status===429)return 'rate_limit';
  if(result.http_status===408||(result.http_status>=500&&result.http_status<=599))return 'transient';
 }
 if(['TZ_APPROVED','TZ_NOT_APPROVED','ORDER_NOT_FOUND'].includes(status))
  return 'ok';
 return 'other';
}
/**
 * Retry only bounded transient failures. A single broken order is logged and
 * scan continues; six successive network failures open a circuit and pause
 * the queue, protecting a million-ID list from being falsely exhausted.
 */
export async function controlledOrderProbe(order,probe,{
 health=freshNetworkHealth(),
 sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms)),
 now=()=>new Date().toISOString(),
 maxRetries=NETWORK_RETRY_LIMIT
}={}){
 if(typeof probe!=='function'||!Number.isInteger(maxRetries)||
  maxRetries<0||maxRetries>3)throw Error('VISION_NETWORK_CONFIG_INVALID');
 const stats=normalizeNetworkHealth(health);
 const started=Date.now();
 let response=null,kind='other',used=0;
 stats.last_request_at=now();stats.state='requesting';
 for(let n=0;n<=maxRetries;n++){
  stats.attempts++;
  try{response=await probe(order)}
  catch{response={status:'MANUAL_ORDER_FETCH_FAILED'}}
  kind=networkFailureType(response);
  if(kind!=='transient'||n===maxRetries)break;
  stats.retries++;used++;
  // Fixed cap for high-volume LAN surveys; no infinite retry storm.
  await sleep(Math.min(2000,400*(n+1)));
 }
 stats.last_duration_ms=Math.max(0,Date.now()-started);
 if(kind==='ok'){
  stats.consecutive_errors=0;stats.last_success_at=now();
  stats.last_error=null;stats.last_http_status=null;stats.state='online';
 }else{
  stats.last_error=String(response?.status||'MANUAL_ORDER_PROBE_UNKNOWN')
   .slice(0,80);
  stats.last_http_status=Number.isInteger(response?.http_status)?
   response.http_status:null;
  stats.last_error_at=now();
  if(kind==='transient'){
   stats.transient_errors++;stats.consecutive_errors++;
   stats.state=stats.consecutive_errors>=NETWORK_CIRCUIT_LIMIT?
    'circuit_open':'degraded';
  }else if(kind==='auth'){
   stats.auth_errors++;stats.state='auth_required';
  }else if(kind==='rate_limit'){
   stats.rate_limits++;stats.state='rate_limited';
  }else stats.state='degraded';
 }
 const halt=kind==='auth'||kind==='rate_limit'||
  (kind==='transient'&&stats.consecutive_errors>=NETWORK_CIRCUIT_LIMIT);
 return {result:response,health:stats,retries:used,kind,halt,
  reason:halt?kind==='transient'?'VISION_NETWORK_CIRCUIT_OPEN':
   kind==='auth'?'VISION_NETWORK_AUTH_REQUIRED':'VISION_NETWORK_RATE_LIMITED':null};
}
