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
const REFUSE=reason=>({status:"MANUAL",reason,production_approved:false});
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
  const stated=row.getAttribute?.("data-order-number")||
    row.getAttribute?.("data-order")||"";
  if(digits(stated)){
    const url=testUrl("/private/order/"+stated,base);
    return {status:"ORDER_LINK_FOUND",url,number:stated,
      source:"explicit_row_attribute"};
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
 const value=(node.textContent||"").replace(/\s+/g," ").trim().slice(0,200);
 return value;
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
  if(!/\.(?:pdf|ai|svg|eps|cdr|png|jpe?g|webp)$/i.test(filename)){
    rejected.push("CUSTOMER_FILE_NAME_UNSUPPORTED");continue;
  }
  // No deletion controls are needed for read-only inspection.
  uploads.set(id,{id,orderNumber,role:"customer_uploaded_artwork",
    filename,url:url.href,source:"makets_popup"});
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
async function getText(url,fetcher,listOrigin){
 const loc=new URL(url);
 if(!allowed(loc))throw Error("UNTRUSTED_TEST_HOST");
 // Cross-origin mirrors are allowed ONLY on this exact local two-host allowlist.
 // Browser CORS still applies; no browser security bypass or cross-site redirect.
 const same=loc.origin===listOrigin;
 const res=await fetcher(loc.href,{
   method:"GET",mode:same?"same-origin":"cors",
   credentials:"include",redirect:"error",cache:"no-store",
   referrerPolicy:"no-referrer",headers:{accept:"text/html,application/json"}
 });
 const text=await boundedText(res);
 if(isAuthHtml(text))throw Error("TEST_SESSION_AUTH_REQUIRED");
 return text;
}
export async function inspectOrderPageFromRow(row,{
 loc=globalThis.location,fetcher=globalThis.fetch,
 DOMParserClass=globalThis.DOMParser
}={}){
 if(!loc||loc.protocol!=="http:"||loc.hostname!=="psk.testgifts.local"||
    !/^\/devorders(?:\/|$)/.test(loc.pathname))
   return REFUSE("NOT_TEST_ORDER_PAGE");
 const target=rowOrderTarget(row,loc.href);
 if(target.status!=="ORDER_LINK_FOUND")return target;
 try{
  const source=await getText(target.url.href,fetcher,loc.origin);
  const doc=parse(source,DOMParserClass);
  const oid=extractOrderInternalId(doc);
  if(!oid)return REFUSE("ORDER_INTERNAL_ID_NOT_FOUND");
  const popupUrl=testUrl("/ajax/gifts/order?action=makets_popup&oid="+oid,
    target.url.origin);
  const raw=await getText(popupUrl.href,fetcher,loc.origin);
  const parsed=popupHtml(raw);
  if(parsed.status!=="POPUP_HTML")return parsed;
  const popupDoc=parse(parsed.html,DOMParserClass);
  if(!popupDoc)return REFUSE("POPUP_HTML_UNREADABLE");
  const resources=extractOrderResources(popupDoc,popupUrl.origin,
    target.number,oid);
  if(resources.status!=="ORDER_RESOURCES")return resources;
  return {status:"ORDER_DETAIL_DISCOVERED",orderNumber:target.number,
    internalId:oid,detailOrigin:target.url.origin,
    uploads:resources.uploads,templates:resources.templates,
    rejected:resources.rejected};
 }catch(error){
  const msg=String(error?.message||"");
  return REFUSE(msg==="TEST_SESSION_AUTH_REQUIRED"?"TEST_SESSION_AUTH_REQUIRED":
    msg==="DOCUMENT_TOO_LARGE"?"ORDER_DOCUMENT_TOO_LARGE":
    msg.startsWith("HTTP_")?"ORDER_HTTP_ERROR":
    "ORDER_DETAIL_FETCH_OR_CORS_FAILURE");
 }
}
