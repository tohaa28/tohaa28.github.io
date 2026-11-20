/**
 * Vision AI M3.24: ONE local ZIP per explicit devorders collection.
 * Only a synthetic browser or an authorized test order can populate it.
 * No network, storage, export consent bypass, or training truth is inferred.
 * Chrome content-script process owns the data until its user saves the ZIP.
 */
import {portableSha256Hex} from './approval-attachments.mjs';

export const BATCH_MAX_BYTES=180_000_000;
const MAX_PART=26_000_000,MAX_PACKET=48_000,MAX_ENTRIES=10000;
const te=new TextEncoder(),td=new TextDecoder('utf-8',{fatal:true});
const numeric=v=>typeof v==='string'&&/^\d{5,12}$/.test(v);
const fail=c=>{throw Error(c)};
const u16=(v,n,d)=>v.setUint16(n,d,true),u32=(v,n,d)=>v.setUint32(n,d>>>0,true);
const json=x=>te.encode(JSON.stringify(x,null,2)+'\n');
function crc32(bytes){
 let n=0xffffffff;
 for(const b of bytes){
  n^=b;
  for(let i=0;i<8;i++)n=n>>>1^((n&1)?0xedb88320:0);
 }
 return (n^0xffffffff)>>>0;
}
function safePath(name){
 if(typeof name!=='string'||name.length>420||name.includes('..')||
   name.includes('\\')||name.startsWith('/')||name.includes('//')||
   /[\x00-\x1f\x7f]/.test(name))return false;
 return name==='manifest.json'||name==='index/orders.json'||
   /^orders\/\d{5,12}\/(?:order|articles|approvals|review|files-index)\.json$/.test(name)||
   /^orders\/\d{5,12}\/source\/(?:evidence|backup)\.json$/.test(name)||
   /^orders\/\d{5,12}\/threads\/\d{1,20}\.json$/.test(name)||
   /^orders\/\d{5,12}\/assets\/[a-f0-9]{64}\.(?:pdf|psd|psb|png|jpe?g|webp|tiff?|gif|svg|eps|ai|cdr|zip)$/.test(name);
}
/** ZIP32 STORED with UTF-8, entry CRC-32, strict paths and bounded memory. */
export function buildVisionZip(entries){
 if(!Array.isArray(entries)||!entries.length||entries.length>MAX_ENTRIES)
  fail('MANUAL_ZIP_ENTRY_COUNT');
 const chunks=[],central=[],names=new Set();
 let position=0,centralSize=0;
 for(const {name,bytes} of entries){
  if(!safePath(name)||names.has(name)||!(bytes instanceof Uint8Array)||
    bytes.length>MAX_PART)fail('MANUAL_ZIP_ENTRY_INVALID');
  const path=te.encode(name);
  if(path.length>65535)fail('MANUAL_ZIP_PATH_TOO_LONG');
  names.add(name);
  const size=bytes.length,c=crc32(bytes);
  const local=new Uint8Array(30+path.length),dv=new DataView(local.buffer);
  u32(dv,0,0x04034b50);u16(dv,4,20);u16(dv,6,0x800);
  u16(dv,8,0);u16(dv,10,0);u16(dv,12,0);
  u32(dv,14,c);u32(dv,18,size);u32(dv,22,size);
  u16(dv,26,path.length);u16(dv,28,0);local.set(path,30);
  const cd=new Uint8Array(46+path.length),v=new DataView(cd.buffer);
  u32(v,0,0x02014b50);u16(v,4,20);u16(v,6,20);
  u16(v,8,0x800);u16(v,10,0);u16(v,12,0);
  u16(v,14,0);u32(v,16,c);u32(v,20,size);u32(v,24,size);
  u16(v,28,path.length);u16(v,30,0);u16(v,32,0);
  u16(v,34,0);u16(v,36,0);u32(v,38,0);u32(v,42,position);
  cd.set(path,46);
  chunks.push(local,bytes);central.push(cd);
  position+=local.length+size;centralSize+=cd.length;
  if(position+centralSize>BATCH_MAX_BYTES+5_000_000)fail('MANUAL_ZIP_SIZE_LIMIT');
 }
 if(entries.length>65535||position+centralSize>=0xffffffff)fail('MANUAL_ZIP32_LIMIT');
 const end=new Uint8Array(22),ev=new DataView(end.buffer);
 u32(ev,0,0x06054b50);u16(ev,4,0);u16(ev,6,0);
 u16(ev,8,entries.length);u16(ev,10,entries.length);
 u32(ev,12,centralSize);u32(ev,16,position);u16(ev,20,0);
 return new Blob([...chunks,...central,end],{type:'application/zip'});
}
/** Parser for the previous per-article STORED ZIP parts. No decompression. */
export function readStoredEntries(bytes){
 if(!(bytes instanceof Uint8Array)||bytes.length<22||bytes.length>MAX_PART)
  fail('MANUAL_BAD_PART_LENGTH');
 const dv=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 let offset=0;const result=new Map();
 while(offset+4<=bytes.length&&dv.getUint32(offset,true)===0x04034b50){
  if(offset+30>bytes.length)fail('MANUAL_ZIP_HEADER_TRUNCATED');
  const flags=dv.getUint16(offset+6,true),method=dv.getUint16(offset+8,true);
  const expected=dv.getUint32(offset+14,true),size=dv.getUint32(offset+18,true);
  const compressed=dv.getUint32(offset+22,true);
  const len=dv.getUint16(offset+26,true),extra=dv.getUint16(offset+28,true);
  if(flags!==0x800||method!==0||size!==compressed||size>16_000_000)
   fail('MANUAL_ZIP_UNSUPPORTED_CONTENT');
  const start=offset+30+len+extra,end=start+size;
  if(end>bytes.length||len===0)fail('MANUAL_ZIP_TRUNCATED');
  const name=td.decode(bytes.subarray(offset+30,offset+30+len));
  if(!/^(?:manifest\.json|attachments\/\d{4}\/\d{4}\.[a-z0-9]{2,5})$/.test(name)||
    result.has(name))fail('MANUAL_ZIP_UNSAFE_INNER_NAME');
  const data=bytes.subarray(start,end);
  if(crc32(data)!==expected)fail('MANUAL_ZIP_CRC_MISMATCH');
  result.set(name,data);
  offset=end;
  if(result.size>15)fail('MANUAL_ZIP_TOO_MANY_INNER_FILES');
 }
 if(!result.has('manifest.json')||offset+22>bytes.length)
  fail('MANUAL_ZIP_PART_UNREADABLE');
 if(dv.getUint32(offset,true)!==0x02014b50)
  fail('MANUAL_ZIP_CENTRAL_HEADER_MISSING');
 return result;
}
const fromB64=str=>{
 if(typeof str!=='string'||str.length>MAX_PACKET*2||
   !/^[A-Za-z0-9+/]*={0,2}$/.test(str))fail('MANUAL_CHUNK_BASE64');
 const s=atob(str);
 if(s.length>MAX_PACKET)fail('MANUAL_CHUNK_TOO_LARGE');
 return Uint8Array.from(s,c=>c.charCodeAt(0));
};
export function encodeTransferChunks(bytes){
 if(!(bytes instanceof Uint8Array)||bytes.length>MAX_PART)
  fail('MANUAL_TRANSFER_BYTES_LIMIT');
 const chunks=[];
 for(let i=0;i<bytes.length;i+=MAX_PACKET){
  const part=bytes.subarray(i,i+MAX_PACKET);
  let binary='';
  for(let j=0;j<part.length;j+=8192)
   binary+=String.fromCharCode(...part.subarray(j,j+8192));
  chunks.push(btoa(binary));
 }
 return chunks.length?chunks:[''];
}
/**
 * Long-lived data lives ONLY on the original devorders tab.
 * Receives bounded, ordered, acknowledged chunks via trusted MV3 worker.
 */
export class ApprovalBatchSession{
 constructor(){
  this.transfers=new Map();
  this.records=new Map();
  this.bytesReceived=0;
  this.partialFailures=[];
 }
 receive(message,expectedOrder){
  try{
   const order=message?.order_number;
   if(!numeric(order)||order!==expectedOrder)fail('MANUAL_TRANSFER_ORDER_MISMATCH');
   const type=message?.kind;
   const stage=message?.stage;
   const part=message?.part;
   if(!((type==='evidence'&&['raw','final'].includes(stage)&&part===0)||
     (type==='attachment_zip'&&stage==='binary'&&Number.isInteger(part)&&part>=1&&part<=64)))
    fail('MANUAL_TRANSFER_KIND_INVALID');
   const seq=message?.sequence,total=message?.chunk_count;
   if(!Number.isInteger(seq)||!Number.isInteger(total)||total<1||
     total>600||seq<0||seq>=total)fail('MANUAL_TRANSFER_SEQUENCE');
   const key=[order,type,stage,part].join(':');
   let transfer=this.transfers.get(key);
   if(!transfer){
    if(seq!==0)fail('MANUAL_TRANSFER_FIRST_CHUNK_MISSING');
    transfer={order,type,stage,part,total,next:0,chunks:[],size:0};
    this.transfers.set(key,transfer);
   }
   if(transfer.total!==total||transfer.next!==seq)fail('MANUAL_TRANSFER_ORDERING');
   const bytes=fromB64(message.chunk);
   if(this.bytesReceived+bytes.length>BATCH_MAX_BYTES)
    fail('MANUAL_BATCH_MEMORY_LIMIT');
   transfer.chunks.push(bytes);transfer.size+=bytes.length;
   this.bytesReceived+=bytes.length;transfer.next++;
   if(transfer.next===transfer.total){
    const data=new Uint8Array(transfer.size);let off=0;
    for(const chunk of transfer.chunks){data.set(chunk,off);off+=chunk.length}
    transfer.chunks=[];transfer.data=data;
    if(type==='evidence'){
     const decoded=JSON.parse(td.decode(data));
     if(decoded?.schema!=='printcheck.vision.private-approval-collection.v1'||
        decoded.order_number!==order||!Array.isArray(decoded.articles)||
        decoded.training_ready!==false||decoded.production_approved!==false)
      fail('MANUAL_BATCH_EVIDENCE_INVALID');
     transfer.report=decoded;
    }else{
     const parsed=readStoredEntries(data);
     const manifest=JSON.parse(td.decode(parsed.get('manifest.json')));
     if(manifest?.schema!=='printcheck.vision.private-approval-attachments.v1'||
       manifest.order_number!==order||manifest.package_part!==part||
       manifest.training_ready!==false||!Array.isArray(manifest.items))
      fail('MANUAL_BATCH_PART_MANIFEST_INVALID');
     transfer.manifest=manifest;
    }
   }
   return {status:'BATCH_CHUNK_ACCEPTED',complete:transfer.next===total};
  }catch(e){return {status:String(e?.message||'MANUAL_BATCH_RECEIVE_ERROR').slice(0,90)}}
 }
 get(order,type,stage,part){
  const r=this.transfers.get([order,type,stage,part].join(':'));
  return r?.data?r:null;
 }
 hasEvidence(order){return !!this.get(order,'evidence','final',0)}
 /**
  * Persist only complete, independently validated transfer parts for an
  * approved order. An interrupted order is retried after a page reload.
  */
 exportOrder(order){
  if(!numeric(order)||!this.hasEvidence(order))
   fail('MANUAL_RANGE_EVIDENCE_NOT_COMPLETE');
  const transfers=[...this.transfers.values()].filter(t=>t.order===order&&
   t.data instanceof Uint8Array&&t.next===t.total);
  if(!transfers.some(t=>t.type==='evidence'&&t.stage==='final'))
   fail('MANUAL_RANGE_FINAL_EVIDENCE_MISSING');
  return transfers.map(t=>({
   type:t.type,stage:t.stage,part:t.part,total:t.total,
   data:t.data,report:t.report||null,manifest:t.manifest||null
  }));
 }
 restoreOrder(order,parts){
  if(!numeric(order)||!Array.isArray(parts)||parts.length>68||
   !parts.some(t=>t.type==='evidence'&&t.stage==='final'))
   fail('MANUAL_RANGE_PERSISTED_EVIDENCE_INVALID');
  const restored=[];
  let size=0;
  for(const t of parts){
   if(!((t.type==='evidence'&&['raw','final'].includes(t.stage)&&t.part===0)||
     (t.type==='attachment_zip'&&t.stage==='binary'&&
      Number.isInteger(t.part)&&t.part>=1&&t.part<=64))||
     !(t.data instanceof Uint8Array)||!Number.isInteger(t.total)||
     t.total<1||t.total>600||t.data.length>MAX_PART)
    fail('MANUAL_RANGE_PERSISTED_PART_INVALID');
   if(t.type==='evidence'&&(t.report?.order_number!==order||
     t.report?.schema!=='printcheck.vision.private-approval-collection.v1'))
    fail('MANUAL_RANGE_PERSISTED_REPORT_INVALID');
   if(t.type==='attachment_zip'&&(t.manifest?.order_number!==order||
     t.manifest?.schema!=='printcheck.vision.private-approval-attachments.v1'))
    fail('MANUAL_RANGE_PERSISTED_MANIFEST_INVALID');
   const key=[order,t.type,t.stage,t.part].join(':');
   if(this.transfers.has(key)||restored.some(x=>x.key===key))
    fail('MANUAL_RANGE_PERSISTED_DUPLICATE');
   size+=t.data.length;
   restored.push({key,t});
  }
  if(this.bytesReceived+size>BATCH_MAX_BYTES)
   fail('MANUAL_RANGE_PERSISTED_MEMORY_LIMIT');
  for(const {key,t} of restored)this.transfers.set(key,{
   order,type:t.type,stage:t.stage,part:t.part,total:t.total,
   next:t.total,size:t.data.length,chunks:[],data:t.data,
   report:t.report||undefined,manifest:t.manifest||undefined
  });
  this.bytesReceived+=size;
 }
 discardOrder(order){
  for(const [key,t] of this.transfers){
   if(t.order!==order)continue;
   this.bytesReceived=Math.max(0,this.bytesReceived-(t.size||0));
   this.transfers.delete(key);
  }
 }

 receivedOrderIds(){
  return [...new Set([...this.transfers.values()].map(x=>x.order))].sort();
 }
 finalize(orderedResults=[]){
  const entries=[],index=[];
  let verified=0,missing=0,unverifiedOrders=0;
  for(const row of orderedResults){
   const order=row.order_number;
   if(!numeric(order))fail('MANUAL_BATCH_ORDER_INVALID');
   const evidence=this.get(order,'evidence','final',0)||
    this.get(order,'evidence','raw',0);
   if(!evidence){unverifiedOrders++;index.push({order_number:order,
    collection_status:row.status,evidence_status:'MISSING'});continue}
   const source=evidence.report,base='orders/'+order+'/';
   const orderFacts=source.order_facts||{};
   entries.push({name:base+'order.json',bytes:json(orderFacts.order||{})});
   entries.push({name:base+'articles.json',bytes:json(orderFacts.articles||[])});
   entries.push({name:base+'source/evidence.json',bytes:evidence.data});
   const raw=this.get(order,'evidence','raw',0);
   if(raw&&evidence.stage==='final')
    entries.push({name:base+'source/backup.json',bytes:raw.data});
   const approvals=[];
   const fileIndex=[],assetPaths=new Set();
   for(const article of source.articles){
    const item=article.item_id;
    const itemName=typeof item==='string'&&/^\d{1,20}$/.test(item)?
     item:'unknown';
    approvals.push({
     item_id:item,status:article.status,
     declared_message_badge:article.declared_message_badge,
     observed_human_comments:article.observed_human_comments,
     current_problems:article.current_problems||[],
     additional_problem_description:article.additional_problem_description||'',
     source_pdf_revision_confirmed:false,expert_roi_confirmed:false});
    if(Array.isArray(article.history)){
     if(itemName==='unknown')fail('MANUAL_ARTICLE_ID_UNKNOWN');
     entries.push({name:base+'threads/'+itemName+'.json',bytes:json({
      order_number:order,item_id:item,history:article.history,
      current_problems:article.current_problems||[],training_ready:false
     })});
    }
   }
   entries.push({name:base+'approvals.json',bytes:json(approvals)});
   // Validate each original SHA-256, source message, and byte size.
   const actualPartItems=new Map();
   for(let part=1;part<=64;part++){
    const p=this.get(order,'attachment_zip','binary',part);
    if(!p)continue;
    const files=readStoredEntries(p.data);
    for(const info of p.manifest.items){
     const bytes=files.get(info.entry);
     if(!bytes||bytes.length!==info.bytes||
       portableSha256Hex(bytes)!==info.sha256)
      fail('MANUAL_BATCH_FILE_SHA_MISMATCH');
     const ext=String(info.original_filename||'').split('.').at(-1).toLowerCase();
     if(!/^(?:pdf|psd|psb|png|jpe?g|webp|tiff?|gif|svg|eps|ai|cdr|zip)$/.test(ext))
      fail('MANUAL_BATCH_FILE_EXTENSION');
     const sha=info.sha256;
     const path=base+'assets/'+sha+'.'+ext;
     if(!assetPaths.has(path)){
      entries.push({name:path,bytes});assetPaths.add(path);
     }
     const key=part+':'+info.entry;
     if(actualPartItems.has(key))fail('MANUAL_BATCH_DUPLICATE_FILE');
     actualPartItems.set(key,{...info,asset_path:path});
    }
   }
   for(const article of source.articles){
    for(const m of article.history||[]){
     for(const a of m.attachments||[]){
      const key=a.private_zip_part+':'+a.private_zip_entry;
      const found=actualPartItems.get(key);
      if(a.local_get_status==='LOCAL_ATTACHMENT_BYTES_ONLY'){
       if(!found||found.order_item_id!==article.item_id||
         found.comment_sequence!==m.sequence||
         found.sha256!==a.sha256||found.original_filename!==a.filename)
        fail('MANUAL_BATCH_ATTACHMENT_LINK_MISMATCH');
       fileIndex.push({item_id:article.item_id,
        comment_sequence:m.sequence,native_comment_id:m.native_comment_id||null,
        original_filename:a.filename,source:a.source||'native_attachment',
        attachment_id:a.attachment_id||null,sha256:a.sha256,
        asset_path:found.asset_path});
       verified++;
      }else{
       missing++;
       fileIndex.push({item_id:article.item_id,comment_sequence:m.sequence,
        original_filename:a.filename,download_status:a.local_get_status||'NOT_ATTEMPTED',
        asset_path:null,sha256:null});
      }
     }
    }
   }
   entries.push({name:base+'files-index.json',bytes:json(fileIndex)});
   entries.push({name:base+'review.json',bytes:json({
    order_number:order,source_pdf_revision_confirmed:false,
    expert_roi_confirmed:false,training_ready:false,production_approved:false,
    pending_checks:['SOURCE_ARTWORK_REVISION','PRINT_METHOD','EXPERT_ROI','EXPERT_LABELS']
   })});
   index.push({order_number:order,collection_status:row.status,
    evidence_status:evidence.stage==='final'?'FINAL':'BACKUP_ONLY',
    articles:source.articles.length,files_verified:fileIndex.filter(x=>x.asset_path).length,
    files_unavailable:fileIndex.filter(x=>!x.asset_path).length});
  }
  const counts={orders:index.length,with_evidence:index.filter(x=>
   x.evidence_status!=='MISSING').length,unverified_orders:unverifiedOrders,
   verified_files:verified,missing_files:missing};
  entries.unshift({name:'index/orders.json',bytes:json(index)});
  entries.unshift({name:'manifest.json',bytes:json({
   schema:'printcheck.vision.local-batch-corpus.v1',
   created_at:new Date().toISOString(),scope:'LOCAL_TEST_ONLY',
   counts,order_results:index,training_ready:false,production_approved:false,
   remote_upload:false,expert_labels_verified:false,
   source_pdf_revision_confirmed:false,
   notes:'All named discussions and order facts are source evidence, not verified training labels.'
  })});
  return {status:'BATCH_ARCHIVE_READY',blob:buildVisionZip(entries),
   counts,entry_count:entries.length};
 }
}
