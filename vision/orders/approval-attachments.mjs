/**
 * M3.15 PRIVATE native approval attachment reader.
 * The user's saved authenticated order HTML identifies:
 * OrderEmployer.config.downloadMaketAdjustingAttachmentUrl =
 *   '/ajax/gifts/order?action=download_maketadjusting_attachment'
 * OrderEmployer.config.idParam = 'id'
 * and a.j_maketadjusting_attachment[data-id] per comment.
 *
 * This exact GET URL is the only candidate; its server response has NOT
 * been observed in an authorized session. Any denial, redirect, login,
 * malformed content or mismatch => MANUAL, never fallback endpoints.
 * Original bytes remain in memory until a PRIVATE local ZIP download.
 */
import {makeLocalStoredZip} from './local-training-zip.mjs';

const TEST_ORIGIN='http://testgifts.local';
const LIMIT_PER_FILE=16_000_000,MAX_FILES=64,MAX_PART_BYTES=24_000_000;
const MAX_PART_FILES=12;
const extensions=new Set(['pdf','psd','psb','png','jpg','jpeg','webp',
 'tif','tiff','gif','svg','eps','ai','cdr','zip']);
const te=new TextEncoder();
const numeric=v=>typeof v==='string'&&/^\d{1,20}$/.test(v);
const code=(status,extra={})=>({status,training_ready:false,...extra});
export function nativeApprovalAttachmentUrl(id,{origin=TEST_ORIGIN}={}){
 if(origin!==TEST_ORIGIN||!numeric(id))return null;
 const url=new URL('/ajax/gifts/order',origin);
 url.searchParams.set('action','download_maketadjusting_attachment');
 url.searchParams.set('id',id);
 return url.href;
}
function safeName(name){
 if(typeof name!=='string'||!name||name.length>200||
    /[\x00-\x1f\x7f\\/:*?"<>|]/.test(name)||/[. ]$/.test(name)||
    /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i.test(name)||
    te.encode(name).length>255)return null;
 const ext=/\.([a-z0-9]{2,5})$/i.exec(name)?.[1]?.toLowerCase();
 return ext&&extensions.has(ext)?{name,extension:ext}:null;
}
function looksLikeHTML(bytes){
 const prefix=new TextDecoder().decode(bytes.subarray(0,Math.min(384,bytes.length)))
   .trimStart().toLowerCase();
 return prefix.startsWith('<!doctype html')||prefix.startsWith('<html')||
   prefix.startsWith('<?xml')&&prefix.includes('<html')||
   prefix.startsWith('{"')||prefix.startsWith('{"error"')||
   prefix.startsWith('{"status"')||prefix.startsWith('<script')||
   prefix.startsWith('<body');
}
export function nativeAttachmentSignature(bytes,extension){
 if(!(bytes instanceof Uint8Array)||bytes.length<8)return 'FILE_TOO_SMALL';
 if(looksLikeHTML(bytes))return 'HTML_OR_AUTH_RESPONSE';
 const ascii=(start,size)=>String.fromCharCode(...bytes.subarray(start,start+size));
 if(extension==='pdf')return ascii(0,5)==='%PDF-'?'KNOWN_SIGNATURE':'FORMAT_MISMATCH';
 if(extension==='psd'||extension==='psb')
  return ascii(0,4)==='8BPS'?'KNOWN_SIGNATURE':'FORMAT_MISMATCH';
 if(extension==='png')
  return bytes[0]===137&&ascii(1,3)==='PNG'?'KNOWN_SIGNATURE':'FORMAT_MISMATCH';
 if(extension==='jpg'||extension==='jpeg')
  return bytes[0]===255&&bytes[1]===216?'KNOWN_SIGNATURE':'FORMAT_MISMATCH';
 if(extension==='gif')return /^GIF8[79]a$/.test(ascii(0,6))?
  'KNOWN_SIGNATURE':'FORMAT_MISMATCH';
 if(extension==='webp')
  return ascii(0,4)==='RIFF'&&ascii(8,4)==='WEBP'?
   'KNOWN_SIGNATURE':'FORMAT_MISMATCH';
 if(extension==='tif'||extension==='tiff')
  return ['II*\0','MM\0*','II+\0','MM\0+'].includes(ascii(0,4))?
   'KNOWN_SIGNATURE':'FORMAT_MISMATCH';
 if(extension==='zip')
  return bytes[0]===80&&bytes[1]===75&&
    [3,5,7].includes(bytes[2])?'KNOWN_SIGNATURE':'FORMAT_MISMATCH';
 if(extension==='svg'){
  const prefix=new TextDecoder().decode(bytes.subarray(0,Math.min(512,bytes.length)));
  return /<svg(?:\s|>)/i.test(prefix)?'KNOWN_SIGNATURE':'FORMAT_MISMATCH';
 }
 // EPS/AI/CDR are not assumed verified by extension alone.
 if(bytes[0]===77&&bytes[1]===90)return 'EXECUTABLE_MISMATCH';
 return 'UNVERIFIED_BINARY_TYPE';
}
async function hash(bytes){
 try{
  if(!globalThis.crypto?.subtle)return null;
  const dig=new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256',bytes));
  return Array.from(dig,x=>x.toString(16).padStart(2,'0')).join('');
 }catch{return null}
}
/** Only exact same-origin GET, no native click, no unknown URLs, no POST. */
export async function readNativeApprovalAttachment(attachment,{
 origin=globalThis.location?.origin||'',
 fetcher=globalThis.fetch,
 maxFileBytes=LIMIT_PER_FILE
}={}){
 const name=safeName(attachment?.filename);
 const url=nativeApprovalAttachmentUrl(attachment?.attachment_id,{origin});
 if(!url||!name)return code('MANUAL_UNSAFE_ATTACHMENT_METADATA');
 if(!Number.isInteger(maxFileBytes)||maxFileBytes<1||
    maxFileBytes>LIMIT_PER_FILE)return code('MANUAL_LIMIT_INVALID');
 if(typeof fetcher!=='function')return code('MANUAL_FETCH_UNAVAILABLE');
 const abort=new AbortController();
 const timeout=setTimeout(()=>abort.abort(),18000);
 let reader;
 try{
  const resp=await fetcher(url,{method:'GET',credentials:'same-origin',
   redirect:'error',cache:'no-store',signal:abort.signal,
   referrerPolicy:'no-referrer',
   headers:{accept:'application/octet-stream,application/pdf,image/*,*/*'}});
  if(resp?.url&&resp.url!==url)return code('MANUAL_REDIRECT_OR_PATH_CHANGED');
  if(resp?.redirected||resp?.type==='opaqueredirect')
   return code('MANUAL_REDIRECT_OR_PATH_CHANGED');
  if(!resp?.ok)return code('MANUAL_HTTP_ERROR',{http_status:resp?.status??null});
  const ct=String(resp.headers?.get?.('content-type')||'').toLowerCase();
  if(/(?:text\/html|application\/json|text\/plain|application\/xhtml)/.test(ct))
   return code('MANUAL_UNEXPECTED_CONTENT_TYPE');
  const declared=resp.headers?.get?.('content-length')||'';
  if(/^\d+$/.test(declared)&&Number(declared)>maxFileBytes)
   return code('MANUAL_ATTACHMENT_TOO_LARGE');
  if(!resp.body?.getReader)return code('MANUAL_BODY_UNREADABLE');
  reader=resp.body.getReader();
  let total=0;
  const chunks=[];
  while(true){
   const {done,value}=await reader.read();
   if(done)break;
   if(!(value instanceof Uint8Array))return code('MANUAL_BAD_BINARY_CHUNK');
   total+=value.length;
   if(total>maxFileBytes)return code('MANUAL_ATTACHMENT_TOO_LARGE');
   chunks.push(value);
  }
  if(total<8)return code('MANUAL_ATTACHMENT_EMPTY');
  const bytes=new Uint8Array(total);
  let off=0;
  for(const part of chunks){bytes.set(part,off);off+=part.length}
  const signature=nativeAttachmentSignature(bytes,name.extension);
  if(!['KNOWN_SIGNATURE','UNVERIFIED_BINARY_TYPE'].includes(signature))
   return code('MANUAL_ATTACHMENT_'+signature);
  return {status:'LOCAL_ATTACHMENT_BYTES_ONLY',bytes,extension:name.extension,
   original_filename:name.name,size:total,sha256:await hash(bytes),
   signature_status:signature,training_ready:false};
 }catch{return code(abort.signal.aborted?
  'MANUAL_ATTACHMENT_TIMEOUT':'MANUAL_ATTACHMENT_FETCH_FAILED')}
 finally{
  clearTimeout(timeout);
  try{await reader?.cancel()}catch{}
  try{reader?.releaseLock()}catch{}
 }
}
function* targets(report){
 for(let i=0;i<(report?.articles||[]).length;i++){
  const article=report.articles[i];
  if(article?.status!=='PRIVATE_REVIEW_ONLY')continue;
  for(const message of article.history||[])
   for(const attachment of message.attachments||[])
    yield {article,articleIndex:i+1,message,attachment};
 }
}
/**
 * Sequential private downloads, bounded ZIP parts. Manifest contains source
 * IDs and original filenames, because it is a local PRIVATE handoff.
 * Never publish the ZIP or use it as training ground truth.
 */
export async function* exportNativeApprovalAttachmentParts(report,{
 origin=globalThis.location?.origin||'',
 fetcher=globalThis.fetch,onProgress=()=>{},stop=()=>false,
 maxFiles=MAX_FILES,maxPerFile=LIMIT_PER_FILE,
 maxPartBytes=MAX_PART_BYTES,maxPartFiles=MAX_PART_FILES
}={}){
 if(origin!==TEST_ORIGIN||report?.schema!==
   'printcheck.vision.private-approval-collection.v1')
  {yield code('MANUAL_UNAUTHORIZED_SCOPE');return}
 if(maxFiles<1||maxFiles>MAX_FILES||maxPerFile<1||
    maxPerFile>LIMIT_PER_FILE||maxPartBytes<maxPerFile||
    maxPartBytes>MAX_PART_BYTES||maxPartFiles<1||
    maxPartFiles>MAX_PART_FILES)
  {yield code('MANUAL_INVALID_ATTACHMENT_LIMITS');return}
 const jobs=[...targets(report)];
 if(jobs.length>MAX_FILES){
  yield code('MANUAL_TOO_MANY_ATTACHMENTS',{found:jobs.length});return;
 }
 let partNo=0,processed=0,successful=0,entries=[],items=[],skipped=[],total=0;
 function createPart(){
  if(!items.length)return null;
  partNo++;
  const manifest={schema:'printcheck.vision.private-approval-attachments.v1',
   scope:'LOCAL_PRIVATE_ONLY',order_number:report.order_number,
   package_part:partNo,created_at:new Date().toISOString(),
   source:'native_maketadjusting_attachment_get',
   training_ready:false,expert_roi_verified:false,
   source_pdf_revision_confirmed:false,
   filenames_are_private:true,export_to_public_github_allowed:false,
   items,skipped};
  const zip=makeLocalStoredZip([{name:'manifest.json',
     bytes:te.encode(JSON.stringify(manifest,null,2)+'\n')},...entries]);
  const ready={status:'PRIVATE_LOCAL_ZIP_READY',zip,manifest,
   files:items.length,part:partNo,processed,successful};
  entries=[];items=[];skipped=[];total=0;
  return ready;
 }
 for(let j=0;j<jobs.length;j++){
  if(stop()){yield code('STOPPED',{processed,successful});return}
  const job=jobs[j];
  onProgress({processed,total:jobs.length,successful});
  const file=await readNativeApprovalAttachment(job.attachment,{
   origin,fetcher,maxFileBytes:maxPerFile});
  processed++;
  if(file.status!=='LOCAL_ATTACHMENT_BYTES_ONLY'){
   skipped.push({article_index:job.articleIndex,
    comment_sequence:job.message.sequence,
    reason:file.status,http_status:file.http_status??null});
   continue;
  }
  if(items.length&&(total+file.size>maxPartBytes||
       items.length>=maxPartFiles)){
   const part=createPart();if(part)yield part;
  }
  if(file.size>maxPartBytes){
   skipped.push({article_index:job.articleIndex,
    comment_sequence:job.message.sequence,
    reason:'MANUAL_PART_BYTES_LIMIT'});continue;
  }
  const n=String(items.length+1).padStart(4,'0');
  const ext=file.extension;
  const filename='attachments/'+String(partNo+1).padStart(4,'0')+
    '/'+n+'.'+ext;
  entries.push({name:filename,bytes:file.bytes});
  total+=file.size;successful++;
  items.push({entry:filename,article_index:job.articleIndex,
   order_item_id:job.article.item_id,
   comment_sequence:job.message.sequence,
   attachment_id:job.attachment.attachment_id,
   original_filename:file.original_filename,bytes:file.size,
   sha256:file.sha256,signature_status:file.signature_status,
   version_and_print_method_verified:false,training_ready:false});
 }
 const last=createPart();
 if(last)yield last;
 else yield code('NO_ATTACHMENT_FILES_VERIFIED',{processed,successful,
  skipped_count:skipped.length});
 onProgress({processed,total:jobs.length,successful,complete:true});
}