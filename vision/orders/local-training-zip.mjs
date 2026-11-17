/**
 * C3B.3.O2 — explicit opt-in local ZIP of test-only artwork with row labels.
 *
 * ZIP is downloaded to the user's own machine. No source bytes or labels
 * are posted, sent to GitHub or persisted in web storage.
 * A row-level opinion is NOT a verified ROI training annotation.
 */
import {LOCAL_ORDERS,isAllowedTestOrderPage,fetchSameOriginArtworkBytes}
  from './row-scanner.mjs';
import {fetchOrderResourceBytes} from './order-page-discovery.mjs';
const te=new TextEncoder();
const allowedLabels=new Set([
 'confirmed_defect','false_positive','missed_defect','expert_clear'
]);
const refused=reason=>({status:'MANUAL',reason,production_approved:false});
const size16=(dv,off,value)=>dv.setUint16(off,value,true);
const size32=(dv,off,value)=>dv.setUint32(off,value>>>0,true);
// Exact private filename preservation: no trimming, Unicode normalization,
// case folding, extension rewriting or collision-prone flat ZIP storage.
// Windows-unsafe filenames are explicitly refused, not silently renamed.
const formats=new Set(['svg','pdf','png','jpg','jpeg','webp','cdr','eps','ai']);
export function exactLocalFilename(value){
 if(typeof value!=='string'||!value||value.length>200||
    /[\u0000-\u001f\u007f\/\\:*?"<>|]/.test(value)||
    /[. ]$/.test(value)||value==='.'||value==='..'||
    /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i.test(value)||
    te.encode(value).length>255)return null;
 const m=/\.([a-z0-9]+)$/i.exec(value);
 return m&&formats.has(m[1].toLowerCase())?value:null;
}
function safeEntryName(name){
 if(name==='manifest.json')return true;
 if(/^samples\/[0-9]{4}\.(?:svg|pdf|png|jpg|jpeg|webp|cdr|eps|ai|bin)$/.test(name))return true;
 const m=/^samples\/[0-9]{4}\/([^/]+)$/.exec(name);
 return !!m&&exactLocalFilename(m[1])===m[1];
}
function crc32(bytes){
 let n=0xffffffff;
 for(const b of bytes){
   n^=b;
   for(let i=0;i<8;i++)
     n=(n>>>1) ^ ((n&1)?0xedb88320:0);
 }
 return (n^0xffffffff)>>>0;
}
export function makeLocalStoredZip(entries){
 if(!Array.isArray(entries)||!entries.length||entries.length>40)
   throw new RangeError('LOCAL_ZIP_ENTRIES_INVALID');
 const data=[],central=[],used=new Set();let offset=0,centralSize=0;
 for(const {name,bytes} of entries){
   if(typeof name!=='string'||te.encode(name).length>300||
      !safeEntryName(name)||used.has(name)||
      !(bytes instanceof Uint8Array)||bytes.length>16_000_000)
     throw new RangeError('LOCAL_ZIP_ENTRY_INVALID');
   used.add(name);
   const nameBytes=te.encode(name),crc=crc32(bytes);
   const local=new Uint8Array(30+nameBytes.length),v=new DataView(local.buffer);
   size32(v,0,0x04034b50);size16(v,4,20);size16(v,6,0x800);
   size16(v,8,0);size16(v,10,0);size16(v,12,0x21);
   size32(v,14,crc);size32(v,18,bytes.length);size32(v,22,bytes.length);
   size16(v,26,nameBytes.length);size16(v,28,0);
   local.set(nameBytes,30);
   data.push(local,bytes);
   const cd=new Uint8Array(46+nameBytes.length),d=new DataView(cd.buffer);
   size32(d,0,0x02014b50);size16(d,4,20);size16(d,6,20);
   size16(d,8,0x800);size16(d,10,0);size16(d,12,0);
   size16(d,14,0x21);size32(d,16,crc);size32(d,20,bytes.length);
   size32(d,24,bytes.length);size16(d,28,nameBytes.length);
   size16(d,30,0);size16(d,32,0);size16(d,34,0);
   size16(d,36,0);size32(d,38,0);size32(d,42,offset);
   cd.set(nameBytes,46);
   central.push(cd);centralSize+=cd.length;
   offset+=local.length+bytes.length;
 }
 if(offset+centralSize>=0xffffffff)throw new RangeError('LOCAL_ZIP_SIZE_LIMIT');
 const end=new Uint8Array(22),e=new DataView(end.buffer);
 size32(e,0,0x06054b50);size16(e,4,0);size16(e,6,0);
 size16(e,8,entries.length);size16(e,10,entries.length);
 size32(e,12,centralSize);size32(e,16,offset);size16(e,20,0);
 return new Blob([...data,...central,end],{type:'application/zip'});
}
function suffix(url,bytes,filenameHint=''){
 const match=/\.([a-z0-9]+)$/i.exec(filenameHint||url.pathname);
 const ext=match?.[1]?.toLowerCase();
 if(['svg','pdf','png','jpg','jpeg','webp','cdr','eps','ai'].includes(ext))
   return ext;
 if(bytes.length>5&&String.fromCharCode(...bytes.subarray(0,5))==='%PDF-')
   return 'pdf';
 if(bytes.length>8&&bytes[0]===137&&bytes[1]===80&&bytes[2]===78)
   return 'png';
 if(bytes.length>3&&bytes[0]===255&&bytes[1]===216)return 'jpg';
 if(bytes.length>12&&
    String.fromCharCode(...bytes.subarray(0,4))==='RIFF')return 'webp';
 if(bytes.length<=256000){
   try{if(/^\s*<svg\b/.test(new TextDecoder('utf-8',{fatal:true}).decode(bytes)))
     return 'svg'}catch{}
 }
 return 'bin';
}
async function optionalSha256(bytes){
 if(!globalThis.crypto?.subtle)return null;
 try{
   const digest=await globalThis.crypto.subtle.digest('SHA-256',bytes);
   return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
 }catch{return null}
}
export async function makeLocalExpertDataset(rows,{
  loc=globalThis.location,
  fetcher=globalThis.__visionLocalTrustedTransport||globalThis.fetch,
  maxFiles=16,maxPerFile=4_000_000,maxTotal=24_000_000
}={}){
 if(!isAllowedTestOrderPage(loc))return refused('NOT_TEST_ORDER_PAGE');
 if(!Array.isArray(rows)||rows.length>LOCAL_ORDERS.maxRows||
    !Number.isSafeInteger(maxFiles)||maxFiles<1||maxFiles>16||
    !Number.isSafeInteger(maxPerFile)||maxPerFile<1||maxPerFile>4_000_000||
    !Number.isSafeInteger(maxTotal)||maxTotal<1||maxTotal>24_000_000)
   return refused('EXPERT_EXPORT_LIMITS_INVALID');
 const picked=rows.filter(r=>allowedLabels.has(r.grade?.value));
 if(!picked.length)return refused('EXPERT_LABELS_REQUIRED');
 const entries=[],samples=[],skipped=[];
 let consumed=0,id=0;
 outer:for(const r of picked){
   const source=r.orderUploads?.length?r.orderUploads:r.files||[];
   for(const a of source.slice(0,4)){
     if(id>=maxFiles)break outer;
     const file=a.role==='customer_uploaded_artwork'?
       await fetchOrderResourceBytes(a,{
         fetcher,loc,maxBytes:maxPerFile
       }):
       await fetchSameOriginArtworkBytes(a,{
         fetcher,loc,maxFileBytes:maxPerFile
       });
     if(file.status!=='LOCAL_BYTES_ONLY'){
       skipped.push({row_index:r.row_index,reason:file.reason});
       continue;
     }
     if(consumed+file.bytes.length>maxTotal){
       skipped.push({row_index:r.row_index,reason:'EXPERT_EXPORT_TOTAL_LIMIT'});
       break outer;
     }
     const supplied=a.originalFilename??a.filename??'';
     const originalName=supplied?exactLocalFilename(supplied):null;
     if(supplied&&!originalName){
       skipped.push({row_index:r.row_index,reason:'ORIGINAL_FILENAME_UNSAFE_TO_EXPORT'});
       continue;
     }
     id++;
     consumed+=file.bytes.length;
     const slot=String(id).padStart(4,'0');
     const name=originalName?'samples/'+slot+'/'+originalName:
       'samples/'+slot+'.'+suffix(file.url,file.bytes,'');
     const sha=await optionalSha256(file.bytes);
     entries.push({name,bytes:file.bytes});
     samples.push({
       sample_name:name,anonymous_row_index:r.row_index,
       // Sensitive: available only inside this user-downloaded private ZIP.
       ...(originalName?{original_filename:originalName}:{}),
       expert_label:r.grade.value,
       expert_label_scope:'whole_order_row_not_object_ROI',
       bytes:file.bytes.length,sha256:sha,
       source_size_and_placement_proven:false,
       trusted_artwork_provenance_proven:false
     });
   }
 }
 if(!samples.length)return refused('NO_EXPORTABLE_LABELED_ARTWORK');
 const manifest={
   schema:'printcheck.vision.local-test-artwork.v0',
   created_at:new Date().toISOString(),source:'local_test_orders',
   training_ready:false,roi_annotations_verified:false,
   held_out_families_verified:false,source_order_ids_included:false,
   source_urls_included:false,public_upload_permitted:false,
   warning:'Contains original test-only files and row-level opinions, NOT a verified training dataset. Store and annotate locally.',
   samples,skipped
 };
 entries.unshift({name:'manifest.json',bytes:te.encode(JSON.stringify(manifest,null,2)+'\n')});
 const zip=makeLocalStoredZip(entries);
 return {status:'LOCAL_ZIP_READY',zip,manifest,
   sample_count:samples.length,skipped_count:skipped.length,
   exported_bytes:consumed};
}


/**
 * Uncapped, user-triggered, sequential local export. Each ZIP is bounded so
 * a large order queue cannot exhaust browser memory or produce oversized
 * archives. All test customer files are represented, including files not yet
 * given an expert label. They are explicitly NOT training-ready examples.
 *
 * The caller downloads each yielded part locally; this module NEVER uploads,
 * caches or persists sources or filenames to a remote service.
 */
export async function* exportLocalDatasetParts(rows,{
 loc=globalThis.location,
 fetcher=globalThis.__visionLocalTrustedTransport||globalThis.fetch,
 onProgress=()=>{},
 maxPerFile=16_000_000,
 maxPartBytes=24_000_000,
 maxFilesPerPart=16
}={}){
 if(!isAllowedTestOrderPage(loc)){yield refused('NOT_TEST_ORDER_PAGE');return}
 if(!Array.isArray(rows)||maxPerFile<1||maxPerFile>16_000_000||
    maxPartBytes<maxPerFile||maxPartBytes>24_000_000||
    maxFilesPerPart<1||maxFilesPerPart>16){
   yield refused('LOCAL_EXPORT_SETTINGS_INVALID');return;
 }
 const all=rows.flatMap(r=>(r.orderUploads?.length?r.orderUploads:r.files||[])
   .map(a=>({file:a,row:r})));
 if(!all.length){yield refused('NO_SOURCE_ARTWORK');return}
 let part=0,saved=0,processed=0,entries=[],samples=[],skipped=[],bytes=0;
 const buildPart=()=>{
   if(!samples.length)return null;
   part++;
   const manifest={
     schema:'printcheck.vision.local-test-artwork.v0',
     created_at:new Date().toISOString(),source:'local_test_orders',
     training_ready:false,roi_annotations_verified:false,
     held_out_families_verified:false,source_order_ids_included:false,
     source_urls_included:false,public_upload_permitted:false,
     contains_original_filenames:true,
     warning:'PRIVATE local archive. Unreviewed and row-only labels are NOT verified ROI training annotations.',
     samples,skipped
   };
   const parts=[{name:'manifest.json',
     bytes:te.encode(JSON.stringify(manifest,null,2)+'\n')},...entries];
   const output={status:'LOCAL_ZIP_READY',part,zip:makeLocalStoredZip(parts),
     manifest,sample_count:samples.length,skipped_count:skipped.length,
     processed_files:processed,total_files:all.length};
   entries=[];samples=[];skipped=[];bytes=0;
   return output;
 };
 for(const {file:a,row:r} of all){
   processed++;
   onProgress({processed,total:all.length,saved,part:part+1});
   // Apply the same official source verification and per-file bounded GET.
   const response=a.role==='customer_uploaded_artwork'?
     await fetchOrderResourceBytes(a,{fetcher,loc,maxBytes:maxPerFile}):
     await fetchSameOriginArtworkBytes(a,{fetcher,loc,maxFileBytes:maxPerFile});
   if(response.status!=='LOCAL_BYTES_ONLY'){
     skipped.push({row_index:r.row_index,reason:response.reason||'FILE_UNAVAILABLE'});
     continue;
   }
   const supplied=a.originalFilename??a.filename??'';
   const originalName=supplied?exactLocalFilename(supplied):null;
   if(supplied&&!originalName){
     skipped.push({row_index:r.row_index,reason:'ORIGINAL_FILENAME_UNSAFE_TO_EXPORT'});
     continue;
   }
   if(samples.length>=maxFilesPerPart||bytes+response.bytes.length>maxPartBytes){
     const batch=buildPart();
     if(batch)yield batch;
   }
   const slot=String(samples.length+1).padStart(4,'0');
   const name=originalName?'samples/'+slot+'/'+originalName:
     'samples/'+slot+'.'+suffix(response.url,response.bytes,'');
   const label=r.grade?.value||'unreviewed';
   const sha=await optionalSha256(response.bytes);
   samples.push({
     sample_name:name,anonymous_row_index:r.row_index,
     ...(originalName?{original_filename:originalName}:{}),
     expert_label:allowedLabels.has(label)?label:'unreviewed',
     expert_label_scope:allowedLabels.has(label)?
       'whole_order_row_not_object_ROI':'not_yet_expert_labeled',
     bytes:response.bytes.length,sha256:sha,
     source_size_and_placement_proven:false,
     trusted_artwork_provenance_proven:false
   });
   entries.push({name,bytes:response.bytes});
   bytes+=response.bytes.length;
   saved++;
   if(samples.length>=maxFilesPerPart){
     const batch=buildPart();
     if(batch)yield batch;
   }
 }
 const tail=buildPart();
 if(tail)yield tail;
 if(saved===0)yield refused('NO_EXPORTABLE_ARTWORK');
}
