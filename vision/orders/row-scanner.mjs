/**
 * Vision C3B.3.O — local test order artifact adapter.
 * No remote telemetry, no persistence, no uploads, no production acceptance.
 * Every request is same-origin to the page the user explicitly opened.
 */
import {inspectLocalSvgVector} from '../geometry/svg-local-vector.mjs';
import {analyzeSyntheticThinRegions} from '../ai/synthetic-feature-model.mjs';
import {rowOrderTarget} from './order-page-discovery.mjs';

export const LOCAL_ORDERS=Object.freeze({
 host:'psk.testgifts.local',route:'/devorders',
 maxRows:80,maxFilesPerRow:8,maxFileBytes:16_000_000,
 maxBatchFiles:32,maxOrdersPerClick:10,timeoutMs:15000
});
const extensions=/\.(?:svg|pdf|png|jpe?g|webp|cdr|ai|eps|zip|tiff?|psd)(?:$|[?#])/i;
const downloadWords=/(?:макет|скачать\s*(?:файл|вложен)|artwork|download\s*(?:artwork|file)|приложени[ея])/i;
const formatFromPath=(pathname)=>{
 const match=/\.([a-z0-9]+)$/i.exec(pathname);
 return match?match[1].toLowerCase():'';
};
const manual=(reason,type='unknown',extra={})=>({
 schema:'printcheck.vision.local-order-artifact.v1',status:'MANUAL',
 type,reason,production_approved:false,physical_scale_proven:false,
 uploaded_to_external_service:false,...extra
});
export function isAllowedTestOrderPage(loc=globalThis.location){
 return !!loc&&loc.protocol==='http:'&&
   loc.hostname.toLowerCase()===LOCAL_ORDERS.host&&
   (loc.pathname===LOCAL_ORDERS.route||
     loc.pathname.startsWith(LOCAL_ORDERS.route+'/'));
}
export function sameOriginArtifactUrl(raw,loc=globalThis.location){
 if(typeof raw!=='string'||!raw.trim()||!loc)return null;
 try{
   const url=new URL(raw,loc.href);
   if(!['http:','https:'].includes(url.protocol)||
      url.origin!==loc.origin||url.username||url.password)return null;
   if(url.pathname===LOCAL_ORDERS.route||
      url.pathname===LOCAL_ORDERS.route+'/')return null;
   return url;
 }catch{return null}
}
export function isCandidateArtworkLink(element){
 if(!element||typeof element.getAttribute!=='function')return false;
 const raw=element.getAttribute('href')||'';
 if(!raw)return false;
 const download=element.getAttribute('download');
 const label=((element.textContent||'')+' '+(download||'')).slice(0,300);
 return extensions.test(raw.split('#')[0])||
   (download!==null&&/\.(svg|pdf|png|jpe?g|webp|cdr|ai|eps|zip)$/i.test(download))||
   downloadWords.test(label);
}
export function discoverOrderRows(doc=globalThis.document){
 if(!doc||!isAllowedTestOrderPage(doc.defaultView?.location))return [];
 const all=[...doc.querySelectorAll('table tbody tr, table tr, [data-order-id]')];
 const seen=new Set(),rows=[];
 for(const node of all){
   if(seen.has(node)||node.closest('#vision-local-order-overlay'))continue;
   seen.add(node);
   if(node.tagName==='TR'){
     if(node.closest('thead')||node.querySelectorAll(':scope > td').length<1)continue;
   }else if(node.querySelector('tr'))continue;
   const anchors=[...node.querySelectorAll('a[href]')].filter(isCandidateArtworkLink);
   const files=anchors.filter(a=>sameOriginArtifactUrl(a.getAttribute('href'),
     doc.defaultView.location));
   if(!anchors.length && node.tagName==='TR' &&
      node.querySelectorAll(':scope > td').length<2)continue;
   rows.push({element:node,anchors,files:files.slice(0,LOCAL_ORDERS.maxFilesPerRow),
     local_only_excluded:anchors.length-files.length,
     row_index:rows.length+1,limited:files.length>LOCAL_ORDERS.maxFilesPerRow});
   if(rows.length>=LOCAL_ORDERS.maxRows)break;
 }
 return rows;
}
/**
 * Export safe counts only, not the local table HTML, order IDs, anchors,
 * attachment URLs, cookies, customer text or class names.
 */
export function diagnoseTestOrderTable(doc=globalThis.document){
 if(!doc||!isAllowedTestOrderPage(doc.defaultView?.location))
   return {schema:'printcheck.vision.local-order-dom-diagnostic.v1',
     status:'MANUAL',reason:'NOT_TEST_ORDER_PAGE'};
 const links=[...doc.querySelectorAll('a[href]')].filter(a=>
   !a.closest('#vision-local-order-overlay'));
 const candidates=links.filter(isCandidateArtworkLink);
 const same=candidates.filter(a=>sameOriginArtifactUrl(
   a.getAttribute('href'),doc.defaultView.location));
 const tables=[...doc.querySelectorAll('table')].slice(0,20).map((table,i)=>({
   table_index:i,
   body_row_count:table.querySelectorAll('tbody tr').length,
   direct_row_count:table.querySelectorAll('tr').length,
   cell_count:table.querySelectorAll('td').length,
   anchor_count:table.querySelectorAll('a[href]').length,
   recognized_artwork_links:[...table.querySelectorAll('a[href]')]
     .filter(isCandidateArtworkLink).length,
   action_button_count:table.querySelectorAll('button,[role="button"]').length
 }));
 const rowRoutes={explicit_order_links:0,static_onclick_urls:0,
   numeric_first_cells:0,explicit_row_attributes:0,ambiguous:0,unresolved:0};
 for(const item of discoverOrderRows(doc)){
   const target=rowOrderTarget(item.element,doc.defaultView.location.href);
   if(target.status!=='ORDER_LINK_FOUND'){
     rowRoutes[target.reason==='AMBIGUOUS_ORDER_ROW'?'ambiguous':'unresolved']++;
   }else{
     rowRoutes[target.source==='static_onclick_url'?'static_onclick_urls':
       target.source==='numeric_first_cell'?'numeric_first_cells':
       target.source==='explicit_row_attribute'?'explicit_row_attributes':
       'explicit_order_links']++;
   }
 }
 const ext={svg:0,pdf:0,raster:0,other:0,unknown:0};
 for(const a of candidates){
   const url=sameOriginArtifactUrl(a.getAttribute('href'),doc.defaultView.location);
   if(!url){ext.other++;continue}
   const fmt=extensionType(url.pathname);
   ext[Object.hasOwn(ext,fmt)?fmt:'unknown']++;
 }
 return {schema:'printcheck.vision.local-order-dom-diagnostic.v1',
   status:'ANONYMOUS_STRUCTURE_ONLY',captured_at:new Date().toISOString(),
   script_scope:'psk_local_devorders',table_count:doc.querySelectorAll('table').length,
   tables,all_anchor_count:links.length,candidate_anchor_count:candidates.length,
   same_origin_candidate_count:same.length,
   cross_origin_or_unsafe_candidate_count:candidates.length-same.length,
   recognized_rows:discoverOrderRows(doc).length,
   order_navigation_patterns:rowRoutes,
   order_detail_first_required:rowRoutes.explicit_order_links>0&&same.length===0,
   file_attachments_verified:false,
   test_order_details_access_verified:false,
   data_order_id_elements:doc.querySelectorAll('[data-order-id]').length,
   action_button_count:doc.querySelectorAll('button,[role="button"]').length,
   candidate_url_formats:ext,
   contains_order_ids:false,contains_order_urls:false,
   contains_attachment_urls:false,contains_user_text:false,
   raw_artwork_bytes_included:false};
}

function extensionType(pathname){
 const ext=formatFromPath(pathname);
 if(ext==='svg')return 'svg';
 if(ext==='pdf')return 'pdf';
 if(['png','jpg','jpeg','webp'].includes(ext))return 'raster';
 if(ext)return 'unsupported';
 return 'unknown';
}
async function readBounded(response,maxBytes){
 const header=response.headers.get('content-length');
 if(header!==null&&(/^\d+$/.test(header)===false||
     Number(header)>maxBytes))throw new Error('FILE_SIZE_LIMIT');
 const reader=response.body?.getReader();
 if(!reader){
   if(header===null)throw new Error('UNBOUNDED_RESPONSE_STREAM');
   const b=new Uint8Array(await response.arrayBuffer());
   if(b.length>maxBytes)throw new Error('FILE_SIZE_LIMIT');
   return b;
 }
 let chunks=[],n=0;
 try{
   while(true){
     const {done,value}=await reader.read();
     if(done)break;
     n+=value.length;
     if(n>maxBytes)throw new Error('FILE_SIZE_LIMIT');
     chunks.push(value);
   }
 }catch(err){try{await reader.cancel()}catch{};throw err}
 const result=new Uint8Array(n);
 let at=0;for(const part of chunks){result.set(part,at);at+=part.length}
 chunks=null;return result;
}
function png(bytes){return bytes.length>8&&bytes[0]===137&&bytes[1]===80&&
  bytes[2]===78&&bytes[3]===71}
function jpg(bytes){return bytes.length>3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255}
function webp(bytes){return bytes.length>12&&
  String.fromCharCode(...bytes.subarray(0,4))==='RIFF'&&
  String.fromCharCode(...bytes.subarray(8,12))==='WEBP'}
function pdf(bytes){return bytes.length>8&&String.fromCharCode(...bytes.subarray(0,5))==='%PDF-'}
async function examineRaster(bytes,mime){
 if(typeof globalThis.createImageBitmap!=='function')return manual('RASTER_DECODER_UNAVAILABLE','raster');
 let bitmap;
 try{
   bitmap=await createImageBitmap(new Blob([bytes],{type:mime}));
   if(bitmap.width<9||bitmap.height<9||
      bitmap.width*bitmap.height>24_000_000)
     return manual('RASTER_SIZE_UNSUPPORTED','raster');
   const scale=Math.min(1,300/Math.max(bitmap.width,bitmap.height));
   const width=Math.max(9,Math.round(bitmap.width*scale));
   const height=Math.max(9,Math.round(bitmap.height*scale));
   const canvas=globalThis.document.createElement('canvas');
   canvas.width=width;canvas.height=height;
   const ctx=canvas.getContext('2d',{willReadFrequently:true});
   if(!ctx)return manual('RASTER_CANVAS_UNAVAILABLE','raster');
   ctx.drawImage(bitmap,0,0,width,height);
   const analysis=analyzeSyntheticThinRegions(ctx.getImageData(0,0,width,height),
     {probabilityThreshold:.75,maxRegions:40});
   if(analysis.status!=='RESEARCH_AI_CANDIDATES_ONLY')
     return manual('RASTER_SEGMENTATION_UNVERIFIED','raster',
       {detail:analysis.reason});
   return {schema:'printcheck.vision.local-order-artifact.v1',
     status:'RESEARCH_ONLY',type:'raster',
     method:'synthetic_MLP_proxy_300px',
     detected_regions:analysis.regionsTotal,
     thin_ink_pixels:analysis.thinInkPixels,
     narrow_gap_pixels:analysis.narrowGapPixels,
     dimensions_proxy_px:[width,height],
     pixel_downsampled:scale<1,
     real_world_accuracy_verified:false,
     production_approved:false,physical_scale_proven:false,
     uploaded_to_external_service:false};
 }catch{return manual('RASTER_DECODING_FAILED','raster')}
 finally{bitmap?.close()}
}
export async function inspectOrderArtworkBytes(bytes,url,contentType='',filenameHint=''){
 if(!(bytes instanceof Uint8Array)||bytes.length<4)
   return manual('EMPTY_OR_INVALID_FILE');
 const hinted=extensionType(filenameHint||url.pathname);
 if(/text\/html|application\/json/i.test(contentType))
   return manual('UNEXPECTED_HTML_OR_JSON_RESPONSE',hinted);
 // Attachment endpoints may hide the extension behind a query parameter.
 // Accept SVG only if the same-origin response explicitly identifies SVG.
 // The independent strict XML/geometry validator still decides support.
 const declaredSvg=/^image\/svg\+xml(?:\s*;|$)/i.test(contentType);
 const trueType=pdf(bytes)?'pdf':
   png(bytes)||jpg(bytes)||webp(bytes)?'raster':
   (hinted==='svg'||(hinted==='unknown'&&declaredSvg))?'svg':'unknown';
 if(hinted==='unsupported')return manual('UNSUPPORTED_VECTOR_OR_ARCHIVE_FORMAT',hinted);
 if(hinted!=='unknown'&&hinted!==trueType)
   return manual('FILE_SIGNATURE_MISMATCH',hinted);
 if(trueType==='pdf'){
   // A PDF's page content can be compressed; raw bytes cannot certify
   // absence/presence of a paint operator. Never state it is a valid vector.
   return manual('PDF_VECTOR_PAINT_PIPELINE_NOT_VERIFIED','pdf',
     {header_recognized:true,file_bytes:bytes.length,
      source_color_spaces_verified:false,geometry_extracted:false});
 }
 if(trueType==='svg'){
   if(bytes.length>256000)return manual('SVG_SOURCE_SIZE_UNSUPPORTED','svg');
   let svg;
   try{svg=new TextDecoder('utf-8',{fatal:true}).decode(bytes)}
   catch{return manual('SVG_UTF8_INVALID','svg')}
   const scan=inspectLocalSvgVector(svg,{maxCandidateMm:1,includeCurvedProbes:false});
   if(scan.status!=='RESEARCH_VECTOR_CANDIDATES_ONLY')
     return manual('SVG_VECTOR_UNSUPPORTED','svg',{detail:scan.reason});
   const candidates=scan.report.candidates;
   return {schema:'printcheck.vision.local-order-artifact.v1',
     status:'RESEARCH_ONLY',type:'svg',
     method:'source_vector_mm',detected_regions:candidates.length,
     min_line_document_mm:candidates.filter(c=>c.kind==='positive_width_mm')
       .reduce((n,c)=>Math.min(n,c.measured_mm),Infinity),
     min_gap_document_mm:candidates.filter(c=>c.kind==='negative_gap_mm')
       .reduce((n,c)=>Math.min(n,c.measured_mm),Infinity),
     source_ink_count:scan.report.source_colors_rgb.length,
     document_mm:[scan.report.width_document_mm,scan.report.height_document_mm],
     source_shape_count:scan.report.paths_count,
     full_artwork_coverage_verified:false,
     production_approved:false,physical_scale_proven:false,
     uploaded_to_external_service:false};
 }
 if(trueType==='raster'){
   const actual=png(bytes)?'image/png':jpg(bytes)?'image/jpeg':'image/webp';
   return examineRaster(bytes,actual);
 }
 return manual('FILE_TYPE_UNKNOWN');
}
/**
 * Explicit local-only byte fetch: used by both research scan and by an
 * optional locally downloaded expert ZIP. Do not expose to remote endpoints.
 */
export async function fetchSameOriginArtworkBytes(anchor,{
  fetcher=globalThis.fetch,loc=globalThis.location,
  timeoutMs=LOCAL_ORDERS.timeoutMs,
  maxFileBytes=LOCAL_ORDERS.maxFileBytes
}={}){
 if(!isAllowedTestOrderPage(loc))return manual('NOT_TEST_ORDER_PAGE');
 const url=sameOriginArtifactUrl(anchor?.getAttribute?.('href'),loc);
 if(!url)return manual('CROSS_ORIGIN_OR_UNSAFE_FILE_URL');
 if(!Number.isSafeInteger(timeoutMs)||timeoutMs<100||timeoutMs>60000)
   return manual('INVALID_TIMEOUT');
 if(!Number.isSafeInteger(maxFileBytes)||maxFileBytes<1||
    maxFileBytes>LOCAL_ORDERS.maxFileBytes)
   return manual('INVALID_BYTE_LIMIT');
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),timeoutMs);
 try{
   const response=await fetcher(url.href,{
     method:'GET',credentials:'same-origin',mode:'same-origin',
     redirect:'error',referrerPolicy:'no-referrer',cache:'no-store',
     signal:controller.signal
   });
   if(!response?.ok)return manual('ARTWORK_HTTP_ERROR',extensionType(url.pathname),
     {http_status:response?.status||0});
   const bytes=await readBounded(response,maxFileBytes);
   return {status:'LOCAL_BYTES_ONLY',bytes,url,
     contentType:response.headers.get('content-type')||''};
 }catch(err){
   return manual(controller.signal.aborted?'ARTWORK_TIMEOUT':
     err?.message==='FILE_SIZE_LIMIT'?'FILE_SIZE_LIMIT':
     'ARTWORK_NETWORK_OR_CORS_FAILURE');
 }finally{clearTimeout(timer)}
}
export async function inspectSameOriginArtwork(anchor,options={}){
 const payload=await fetchSameOriginArtworkBytes(anchor,options);
 if(payload.status!=='LOCAL_BYTES_ONLY')return payload;
 return inspectOrderArtworkBytes(payload.bytes,payload.url,payload.contentType);
}
