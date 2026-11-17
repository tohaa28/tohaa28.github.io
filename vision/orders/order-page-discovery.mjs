/**
 * C3B.3.P: order-detail-first read-only adapter for testgifts.local.
 * Mirrors the established Maketnaya path:
 * order card /private/order/{number} -> data-orderid ->
 * /ajax/gifts/order?action=makets_popup&oid={internalId} ->
 * a[data-maket=true] /cart/act/mda?id=...&oid=...
 * Template /drawing?action=getOrderItemPdf&orderitemid=... is NOT client art.
 *
 * No clicks that mutate orders, no GET to delete/upload endpoints, no POST,
 * never request production gifts.ru, never mistake template for training logo.
 */
export const TEST_HOSTS=Object.freeze(["psk.testgifts.local","testgifts.local"]);
const REFUSE=(reason,extra={})=>({status:"MANUAL",reason,production_approved:false,...extra});
const digits=s=>/^\d{5,12}$/.test(String(s||""));
const internal=s=>/^\d{1,20}$/.test(String(s||""));
const allowed=url=>url?.protocol==="http:"&&TEST_HOSTS.includes(url.hostname)&&
   !url.username&&!url.password;
export function testUrl(input,base){
  try{
    const u=new URL(input,base);
    if(!allowed(u)||u.port&&u.port!=="80")return null;
    if(/\/(?:delete|remove|upload|logout)(?:\/|$)/i.test(u.pathname))return null;
    return u;
  }catch{return null}
}
export function rowOrderTarget(row,base){
  if(!row||!allowed(new URL(base)))return REFUSE("UNTRUSTED_LIST_ORIGIN");
  const choices=[];
  for(const a of row.querySelectorAll("a[href]")){
    const href=a.getAttribute("href");
    const url=testUrl(href,base);
    if(!url)continue;
    const found=/^\/private\/order\/(\d{5,12})\/?$/.exec(url.pathname);
    if(found)choices.push({url,number:found[1]});
  }
  for(const attr of ["data-href","data-url"]){
    const url=testUrl(row.getAttribute?.(attr)||"",base);
    const found=url&&/^\/private\/order\/(\d{5,12})\/?$/.exec(url.pathname);
    if(found)choices.push({url,number:found[1]});
  }
  const ordered=[...new Map(choices.map(x=>[x.number,x])).values()];
  if(ordered.length>1)return REFUSE("AMBIGUOUS_ORDER_ROW");
  if(ordered.length===1)return {status:"ORDER_LINK_FOUND",...ordered[0]};
  // Fallback only when an unambiguous numeric order ID is actually present
  // as a DOM attribute, NOT extracted from unrelated prices/quantities.
  const onclick=row.getAttribute?.("onclick")||"";
  // Static URL extraction only. Do not execute page-provided JS handlers.
  const orderInHandler=onclick.match(/\/private\/order\/(\d{5,12})(?!\d)/);
  const firstCell=row.querySelector?.(":scope > td:first-child")?.textContent?.trim()||"";
  const stated=row.getAttribute?.("data-order-number")||
    row.getAttribute?.("data-order")||orderInHandler?.[1]||
    (/^\d{5,12}$/.test(firstCell)?firstCell:"");
  if(digits(stated)){
    const url=testUrl("/private/order/"+stated,base);
    return {status:"ORDER_LINK_FOUND",url,number:stated,
      source:row.getAttribute?.("data-order-number")||
        row.getAttribute?.("data-order")?"explicit_row_attribute":
        orderInHandler?"static_onclick_url":"numeric_first_cell"};
  }
  return REFUSE("ORDER_DETAIL_LINK_REQUIRED");
}
export function extractOrderInternalId(doc){
 const ids=[
  doc.querySelector("#j_cart_host[data-orderid]"),
  doc.querySelector(".cart-order[data-orderid]"),
  doc.querySelector(".j_add_maket[data-orderid]")
 ].map(n=>n?.getAttribute("data-orderid")).filter(Boolean);
 const unique=[...new Set(ids)];
 return unique.length===1&&internal(unique[0])?unique[0]:null;
}
export function popupHtml(text){
 if(typeof text!=="string"||!text.trim()||text.length>3_000_000)
   return REFUSE("POPUP_BODY_INVALID");
 try{
   if(text.trimStart().startsWith("{")){
     const data=JSON.parse(text);
     if(typeof data?.html!=="string")return REFUSE("POPUP_JSON_MISSING_HTML");
     return {status:"POPUP_HTML",html:data.html};
   }
 }catch{return REFUSE("POPUP_JSON_INVALID")}
 return {status:"POPUP_HTML",html:text};
}
const findAll=(doc,selector)=>{
 const out=[];
 const scan=root=>{
  out.push(...root.querySelectorAll(selector));
  for(const t of root.querySelectorAll("template"))if(t.content)scan(t.content);
 };
 scan(doc);
 return out;
};
function nameOf(node){
 // The clickable link can expose Gifts' normalized PDF name. Do not alter
 // Unicode, whitespace or case of the original metadata when it is present.
 return node?.textContent?.trim()||"";
}
function originalNameOf(link){
 // Same explicit metadata selector as the existing Maketnaya direct-mode.
 const row=link.closest?.(".flex-item.flex-main,li,tr,.maket-row")||link.parentElement;
 const label=row?.querySelector?.('[title="Исходное имя закачанного файла"]');
 // Exact raw textContent: no trimming, Unicode normalization or extension change.
 // A blank metadata element is not a valid filename; use the link as fallback.
 const original=label?.textContent;
 return typeof original==="string"&&original.length>0?original:nameOf(link);
}
export function extractOrderResources(doc,base,orderNumber,orderId){
 if(!digits(orderNumber)||!internal(orderId))return REFUSE("ORDER_IDENTIFIERS_INVALID");
 if(!doc?.querySelectorAll)return REFUSE("ORDER_DOCUMENT_INVALID");
 const uploads=new Map(),templates=new Map(),rejected=[];
 for(const a of findAll(doc,'a[data-maket="true"][href]')){
  const url=testUrl(a.getAttribute("href"),base);
  if(!url||url.pathname!=="/cart/act/mda"||
     url.searchParams.get("oid")!==orderId||
     !internal(url.searchParams.get("id"))){
    rejected.push("UNTRUSTED_CUSTOMER_FILE_LINK");continue;
  }
  const id=url.searchParams.get("id");
  const filename=nameOf(a);
  const originalFilename=originalNameOf(a);
  if(!/\.(?:pdf|ai|svg|eps|cdr|png|jpe?g|webp)$/i.test(filename)){
    rejected.push("CUSTOMER_FILE_NAME_UNSUPPORTED");continue;
  }
  // No deletion controls are needed for read-only inspection.
  uploads.set(id,{id,orderNumber,role:"customer_uploaded_artwork",
    filename,originalFilename,url:url.href,source:"makets_popup"});
 }
 for(const a of findAll(doc,'a[href*="getOrderItemPdf"],[data-orderitemid],[data-oiid]')){
  const href=a.getAttribute("href")||"";
  let itemId=a.getAttribute("data-orderitemid")||a.getAttribute("data-oiid")||"";
  const link=href?testUrl(href,base):null;
  if(!itemId)itemId=link?.searchParams.get("orderitemid")||"";
  if(!internal(itemId))continue;
  const endpoint=testUrl("/drawing?action=getOrderItemPdf&orderitemid="+
    encodeURIComponent(itemId),base);
  templates.set(itemId,{itemId,role:"constructor_template",
    url:endpoint.href,source:"makets_popup"});
 }
 return {status:"ORDER_RESOURCES",uploads:[...uploads.values()],
   templates:[...templates.values()],rejected};
}
function parse(docText,parser=globalThis.DOMParser){
 if(typeof docText!=="string"||docText.length>3_000_000||
    typeof parser!=="function")return null;
 try{return new parser().parseFromString(docText,"text/html")}
 catch{return null}
}
function isAuthHtml(text){
 return /<form[^>]+name=["']authform["']/i.test(text)||
    /Авторизация\s*-\s*Проект\s*111/i.test(text);
}
async function boundedText(response,limit=3_000_000){
 if(!response.ok)throw Error("HTTP_"+response.status);
 const type=response.headers.get("content-type")||"";
 if(!/(?:html|json|text)/i.test(type))throw Error("UNEXPECTED_DOCUMENT_CONTENT_TYPE");
 const length=response.headers.get("content-length");
 if(length&&Number(length)>limit)throw Error("DOCUMENT_TOO_LARGE");
 const reader=response.body?.getReader();
 if(!reader){const s=await response.text();if(s.length>limit)throw Error("DOCUMENT_TOO_LARGE");return s}
 const parts=[];let count=0;
 try{
  while(true){
   const {done,value}=await reader.read();if(done)break;
   count+=value.length;if(count>limit)throw Error("DOCUMENT_TOO_LARGE");
   parts.push(value);
  }
 }catch(err){try{await reader.cancel()}catch{};throw err}
 const buf=new Uint8Array(count);let offset=0;
 for(const part of parts){buf.set(part,offset);offset+=part.length}
 return new TextDecoder("utf-8").decode(buf);
}
// No URLs, customer filenames, authentication state or server response body
// are ever serialized into a diagnostics object.
function classifiedError(error,phase,originRelation){
 const message=String(error?.message||'');
 const common={stage:phase,origin_relation:originRelation,
   network_attempted:true,http_status:null};
 if(error?.visionCode==='RESPONSE_HTTP_STATUS')
   return REFUSE(phase==='order_card'?'ORDER_CARD_HTTP_ERROR':'ORDER_POPUP_HTTP_ERROR',
     {...common,failure_class:'http_status',http_status:error.status});
 if(error?.visionCode==='TEST_SESSION_AUTH_REQUIRED')
   return REFUSE(phase==='order_card'?'ORDER_CARD_AUTH_REQUIRED':'ORDER_POPUP_AUTH_REQUIRED',
     {...common,failure_class:'login_html'});
 if(error?.visionCode==='DOCUMENT_TOO_LARGE')
   return REFUSE(phase==='order_card'?'ORDER_CARD_TOO_LARGE':'ORDER_POPUP_TOO_LARGE',
     {...common,failure_class:'response_limit'});
 if(error?.visionCode==='UNEXPECTED_DOCUMENT_CONTENT_TYPE')
   return REFUSE(phase==='order_card'?'ORDER_CARD_UNEXPECTED_TYPE':'ORDER_POPUP_UNEXPECTED_TYPE',
     {...common,failure_class:'content_type'});
 if(error?.visionCode==='FETCH_TIMEOUT')
   return REFUSE(phase==='order_card'?'ORDER_CARD_TIMEOUT':'ORDER_POPUP_TIMEOUT',
     {...common,failure_class:'timeout'});
 if(error?.visionCode==='TEST_REDIRECT_DENIED')
   return REFUSE(phase==='order_card'?'ORDER_CARD_REDIRECT_DENIED':'ORDER_POPUP_REDIRECT_DENIED',
     {...common,failure_class:'redirect_denied'});
 // MV3 returns fixed code tokens, not raw URLs, response text or cookies.
 // Distinguish an extension redirect/auth failure from an ordinary browser
 // TypeError while preserving privacy in the downloadable JSON diagnostics.
 const mv3FailureClasses={
   EXTENSION_AUTH_REDIRECT:'login_redirect',
   EXTENSION_REDIRECT_UNTRUSTED_ORIGIN:'untrusted_redirect_origin',
   EXTENSION_REDIRECT_UNEXPECTED_PATH:'unexpected_redirect_path',
   EXTENSION_FETCH_REJECTED:'extension_network_rejected',
   EXTENSION_SERVICE_DISCONNECTED:'extension_disconnected',
   EXTENSION_FETCH_TIMEOUT:'timeout'
 };
 if(Object.prototype.hasOwnProperty.call(mv3FailureClasses,message))
   return REFUSE(phase==='order_card'?'ORDER_CARD_FETCH_REJECTED':'ORDER_POPUP_FETCH_REJECTED',
     {...common,failure_class:mv3FailureClasses[message],
       transport_error:message,fetch_exception_family:'TypeError'});
 // A failed browser fetch does NOT identify CORS specifically: it can
 // mean a denied redirect, DNS, offline test host or another network block.
 return REFUSE(phase==='order_card'?'ORDER_CARD_FETCH_REJECTED':'ORDER_POPUP_FETCH_REJECTED',
   {...common,failure_class:'cors_redirect_or_network',
     fetch_exception_family:error?.name==='TypeError'?'TypeError':'other'});
}
async function getText(url,fetcher,listOrigin,phase){
 const loc=new URL(url);
 if(!allowed(loc))throw Error("UNTRUSTED_TEST_HOST");
 const same=loc.origin===listOrigin;
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),15000);
 let res;
 try{
  res=await fetcher(loc.href,{
   method:"GET",mode:same?"same-origin":"cors",
   credentials:"include",redirect:same?"follow":"error",cache:"no-store",
   referrerPolicy:"no-referrer",signal:controller.signal,
   headers:phase==="popup"&&same?
     {accept:"text/html,application/json","x-requested-with":"XMLHttpRequest"}:
     {accept:"text/html,application/json"}
  });
  // The original Maketnaya follows canonical same-origin redirects and
  // rejects auth-page landings. Preserve that behavior without allowing
  // redirected content from unrelated endpoints or an untrusted host.
  if(res.url){
   let final;
   try{final=new URL(res.url)}catch{}
   const auth=final&&final.pathname.toLowerCase().split('/').some(part=>['auth','login','signin'].includes(part));
   const expected=(loc.pathname.endsWith('/')?loc.pathname.slice(0,-1):loc.pathname)+loc.search;
   const actual=final&&((final.pathname.endsWith('/')?final.pathname.slice(0,-1):final.pathname)+final.search);
   if(auth){const e=Error('TEST_SESSION_AUTH_REQUIRED');
     e.visionCode='TEST_SESSION_AUTH_REQUIRED';throw e}
   if(!final||!testUrl(res.url,loc.href)||
      final.origin!==loc.origin||actual!==expected){
     const e=Error('TEST_REDIRECT_DENIED');
     e.visionCode='TEST_REDIRECT_DENIED';throw e;
   }
  }
  if(!res.ok){
   const error=Error("RESPONSE_HTTP_STATUS");
   error.visionCode="RESPONSE_HTTP_STATUS";
   error.status=res.status;
   throw error;
  }
  let text;
  try{text=await boundedText(res)}
  catch(error){
   if(error.message==="DOCUMENT_TOO_LARGE")error.visionCode="DOCUMENT_TOO_LARGE";
   if(error.message==="UNEXPECTED_DOCUMENT_CONTENT_TYPE")
     error.visionCode="UNEXPECTED_DOCUMENT_CONTENT_TYPE";
   throw error;
  }
  if(isAuthHtml(text)){
   const error=Error("TEST_SESSION_AUTH_REQUIRED");
   error.visionCode="TEST_SESSION_AUTH_REQUIRED";throw error;
  }
  return text;
 }catch(error){
  if(controller.signal.aborted)error.visionCode="FETCH_TIMEOUT";
  throw error;
 }finally{clearTimeout(timer)}
}

export async function inspectOrderPageFromRow(row,{
 loc=globalThis.location,
 fetcher=globalThis.__visionLocalTrustedTransport||globalThis.fetch,
 DOMParserClass=globalThis.DOMParser
}={}){
 if(!loc||loc.protocol!=="http:"||loc.hostname!=="psk.testgifts.local"||
    !/^\/devorders(?:\/|$)/.test(loc.pathname))
   return REFUSE("NOT_TEST_ORDER_PAGE");
 const target=rowOrderTarget(row,loc.href);
 if(target.status!=="ORDER_LINK_FOUND")return target;
 const originRelation=target.url.origin===loc.origin?
   "same_origin":"approved_other_test_origin";
 let phase="order_card";
 try{
  const source=await getText(target.url.href,fetcher,loc.origin,phase);
  const doc=parse(source,DOMParserClass);
  const oid=extractOrderInternalId(doc);
  if(!oid)return REFUSE("ORDER_INTERNAL_ID_NOT_FOUND");
  const popupUrl=testUrl("/ajax/gifts/order?action=makets_popup&oid="+oid,
    target.url.origin);
  phase="popup";
  const raw=await getText(popupUrl.href,fetcher,loc.origin,phase);
  const parsed=popupHtml(raw);
  if(parsed.status!=="POPUP_HTML")return parsed;
  const popupDoc=parse(parsed.html,DOMParserClass);
  if(!popupDoc)return REFUSE("POPUP_HTML_UNREADABLE");
  const resources=extractOrderResources(popupDoc,popupUrl.origin,
    target.number,oid);
  if(resources.status!=="ORDER_RESOURCES")return resources;
  return {status:"ORDER_DETAIL_DISCOVERED",orderNumber:target.number,
    internalId:oid,detailOrigin:target.url.origin,
    uploads:resources.uploads.map(x=>({...x,internalId:oid,
      detailOrigin:target.url.origin})),
    templates:resources.templates,
    rejected:resources.rejected,
    stage:"resources",origin_relation:originRelation};
 }catch(error){
  return classifiedError(error,phase,originRelation);
 }
}


/**
 * Read customer artwork bytes from a VERIFIED popup descriptor. Download
 * filenames, template links, arbitrary row hrefs or untrusted URLs are never
 * independently granted access to this helper.
 */
export async function fetchOrderResourceBytes(resource,{
 fetcher=globalThis.__visionLocalTrustedTransport||globalThis.fetch,
 loc=globalThis.location,timeoutMs=15000,
 maxBytes=16_000_000
}={}){
 if(!loc||loc.protocol!=="http:"||loc.hostname!=="psk.testgifts.local"||
   !/^\/devorders(?:\/|$)/.test(loc.pathname))
  return REFUSE("NOT_TEST_ORDER_PAGE");
 if(resource?.role!=="customer_uploaded_artwork"||
   !internal(resource.id)||!internal(resource.internalId)||
   !digits(resource.orderNumber)||!TEST_HOSTS.includes(new URL(loc.href).hostname))
  return REFUSE("UNTRUSTED_ORDER_RESOURCE");
 const url=testUrl(resource.url,loc.href);
 if(!url||url.pathname!=="/cart/act/mda"||
   url.searchParams.get("id")!==resource.id||
   url.searchParams.get("oid")!==resource.internalId||
   url.origin!==resource.detailOrigin)
  return REFUSE("UNTRUSTED_RESOURCE_URL");
 if(!Number.isSafeInteger(maxBytes)||maxBytes<1||maxBytes>16_000_000)
  return REFUSE("RESOURCE_BYTE_LIMIT_INVALID");
 const same=url.origin===loc.origin,ctrl=new AbortController();
 const timer=setTimeout(()=>ctrl.abort(),timeoutMs);
 try{
  const res=await fetcher(url.href,{
   method:"GET",mode:same?"same-origin":"cors",credentials:"include",
   redirect:"error",cache:"no-store",referrerPolicy:"no-referrer",
   signal:ctrl.signal,headers:{accept:"application/pdf,application/octet-stream,*/*"}
  });
  if(!res.ok)return REFUSE("ARTWORK_HTTP_ERROR");
  const mime=res.headers.get("content-type")||"";
  if(/(?:text\/html|application\/json)/i.test(mime))
   return REFUSE("ARTWORK_LOGIN_OR_HTML_RESPONSE");
  if(Number(res.headers.get("content-length")||0)>maxBytes)
   return REFUSE("ARTWORK_SIZE_EXCEEDED");
  const chunks=[];let length=0;
  const reader=res.body?.getReader();
  if(!reader)return REFUSE("ARTWORK_STREAM_UNAVAILABLE");
  try{
   while(true){
    const {done,value}=await reader.read();if(done)break;
    length+=value.byteLength;
    if(length>maxBytes)return REFUSE("ARTWORK_SIZE_EXCEEDED");
    chunks.push(value);
   }
  }finally{try{reader.releaseLock()}catch{}}
  const bytes=new Uint8Array(length);let offset=0;
  for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}
  if(bytes.byteLength<8)return REFUSE("ARTWORK_EMPTY");
  return {status:"LOCAL_BYTES_ONLY",bytes,url,mime};
 }catch{
  return REFUSE(ctrl.signal.aborted?"ARTWORK_TIMEOUT":
    same?"ARTWORK_DOWNLOAD_FAILED":"TEST_SUBDOMAIN_CORS_OR_AUTH_REQUIRED");
 }finally{clearTimeout(timer)}
}
