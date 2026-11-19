import test from 'node:test';
import assert from 'node:assert/strict';
import {ApprovalBatchSession,encodeTransferChunks,buildVisionZip,readStoredEntries}
 from '../vision/orders/approval-batch-archive.mjs';
import {makeLocalStoredZip} from '../vision/orders/local-training-zip.mjs';
import {portableSha256Hex} from '../vision/orders/approval-attachments.mjs';
const te=new TextEncoder(),td=new TextDecoder();
const order='8001111',item='77';
const png=new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,0,0,0,0,0]);
const hash=portableSha256Hex(png);
const zipEntry='attachments/0001/0001.png';
const makeEvidence=(status='LOCAL_ATTACHMENT_BYTES_ONLY')=>({
 schema:'printcheck.vision.private-approval-collection.v1',
 order_number:order,status:'COMPLETE',remote_upload:false,
 training_ready:false,production_approved:false,
 order_facts:{order:{order_number:order,customer_display:'Клиент Тестовый'},
  articles:[{item_id:item,article_code:'TEST.21',print_placement:'Поле 1'}]},
 articles:[{item_id:item,status:'PRIVATE_REVIEW_ONLY',declared_message_badge:2,
  observed_human_comments:2,current_problems:[{code:'4',label:'Тонкая линия'}],
  history:[{sequence:1,kind:'human',author_name:'Дизайнер Тестовый',
   date_time:'19.11.26 10:25',text:'Линия меньше 0,15 мм',
   attachments:[{filename:'capture.png',source:'native_approval_gallery',
    attachment_id:null,local_get_status:status,
    sha256:status==='LOCAL_ATTACHMENT_BYTES_ONLY'?hash:null,
    byte_count:status==='LOCAL_ATTACHMENT_BYTES_ONLY'?png.length:null,
    private_zip_part:status==='LOCAL_ATTACHMENT_BYTES_ONLY'?1:null,
    private_zip_entry:status==='LOCAL_ATTACHMENT_BYTES_ONLY'?zipEntry:null}]}]}]
});
const makePart=()=>makeLocalStoredZip([
 {name:'manifest.json',bytes:te.encode(JSON.stringify({
  schema:'printcheck.vision.private-approval-attachments.v1',
  package_part:1,order_number:order,training_ready:false,items:[{
   entry:zipEntry,order_item_id:item,comment_sequence:1,
   sha256:hash,bytes:png.length,original_filename:'capture.png',
   source:'native_approval_gallery'}]
 }))},
 {name:zipEntry,bytes:png}
]);
const feed=(session,kind,stage,part,bytes,expected=order)=>{
 const chunks=encodeTransferChunks(bytes);
 return chunks.map((chunk,i)=>session.receive({
  order_number:order,kind,stage,part,sequence:i,
  chunk_count:chunks.length,chunk
 },expected));
};
function listZip(bytes){
 const dv=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),
  result=new Map();let pos=0;
 while(pos+30<=bytes.length&&dv.getUint32(pos,true)===0x04034b50){
  const size=dv.getUint32(pos+18,true);
  const len=dv.getUint16(pos+26,true),extra=dv.getUint16(pos+28,true);
  const name=td.decode(bytes.subarray(pos+30,pos+30+len));
  const start=pos+30+len+extra;
  result.set(name,bytes.subarray(start,start+size));
  pos=start+size;
 }
 return result;
}
test('one bundle: raw/final, names, problems, SHA verified, direct images',async()=>{
 const s=new ApprovalBatchSession(),raw=makeEvidence('NOT_ATTEMPTED'),
  final=makeEvidence();
 assert.equal(feed(s,'evidence','raw',0,te.encode(JSON.stringify(raw))).at(-1).status,
  'BATCH_CHUNK_ACCEPTED');
 const part=new Uint8Array(await makePart().arrayBuffer());
 assert.equal(feed(s,'attachment_zip','binary',1,part).at(-1).status,
  'BATCH_CHUNK_ACCEPTED');
 assert.equal(feed(s,'evidence','final',0,te.encode(JSON.stringify(final))).at(-1).status,
  'BATCH_CHUNK_ACCEPTED');
 const zip=s.finalize([{order_number:order,status:'COMPLETE'}]);
 assert.equal(zip.counts.orders,1);
 assert.equal(zip.counts.verified_files,1);
 assert.equal(zip.counts.missing_files,0);
 const entries=listZip(new Uint8Array(await zip.blob.arrayBuffer()));
 assert.equal(entries.size,11);
 assert.equal(JSON.parse(td.decode(entries.get('manifest.json'))).training_ready,false);
 const orderData=JSON.parse(td.decode(entries.get('orders/'+order+'/order.json')));
 assert.equal(orderData.customer_display,'Клиент Тестовый');
 const thread=JSON.parse(td.decode(entries.get('orders/'+order+'/threads/'+item+'.json')));
 assert.equal(thread.history[0].author_name,'Дизайнер Тестовый');
 assert.equal(thread.current_problems[0].label,'Тонкая линия');
 const original=entries.get('orders/'+order+'/assets/'+hash+'.png');
 assert.deepEqual([...original],[...png]);
 const index=JSON.parse(td.decode(entries.get('orders/'+order+'/files-index.json')));
 assert.equal(index[0].sha256,hash);
 assert.equal(index[0].item_id,item);
 assert.equal(index[0].comment_sequence,1);
 const back=JSON.parse(td.decode(entries.get('orders/'+order+'/source/backup.json')));
 assert.equal(back.articles[0].history[0].attachments[0].local_get_status,'NOT_ATTEMPTED');
});
test('raw-only collection remains usable, never fakes binary or expert verdict',async()=>{
 const s=new ApprovalBatchSession();
 feed(s,'evidence','raw',0,te.encode(JSON.stringify(makeEvidence('MANUAL_HTTP_ERROR'))));
 const pack=s.finalize([{order_number:order,status:'MANUAL_ORDER_SCAN_FAILED'}]);
 assert.equal(pack.counts.with_evidence,1);
 assert.equal(pack.counts.missing_files,1);
 const files=listZip(new Uint8Array(await pack.blob.arrayBuffer()));
 assert.equal(files.has('orders/'+order+'/source/backup.json'),false);
 const idx=JSON.parse(td.decode(files.get('index/orders.json')));
 assert.equal(idx[0].evidence_status,'BACKUP_ONLY');
 assert.equal(idx[0].files_unavailable,1);
});
test('fail closed on reversed chunk sequence, wrong order and malicious zip path',()=>{
 const s=new ApprovalBatchSession();
 const bytes=new Uint8Array(60_000).fill(10);
 const chunks=encodeTransferChunks(bytes);
 assert.equal(s.receive({order_number:order,kind:'evidence',stage:'raw',part:0,
  sequence:1,chunk_count:chunks.length,chunk:chunks[1]},order).status,
 'MANUAL_TRANSFER_FIRST_CHUNK_MISSING');
 assert.equal(s.receive({order_number:order,kind:'evidence',stage:'raw',part:0,
  sequence:0,chunk_count:chunks.length,chunk:chunks[0]},'8002222').status,
 'MANUAL_TRANSFER_ORDER_MISMATCH');
 assert.throws(()=>buildVisionZip([{name:'../malicious.png',bytes:png}]),/MANUAL_ZIP_ENTRY_INVALID/);
 assert.throws(()=>readStoredEntries(new Uint8Array(40)),/MANUAL_ZIP_CENTRAL_HEADER_MISSING|MANUAL_ZIP_PART_UNREADABLE/);
});
test('corrupted attachment SHA blocks export, no invented training labels',async()=>{
 const s=new ApprovalBatchSession();
 const data=makeEvidence();
 data.articles[0].history[0].attachments[0].sha256='0'.repeat(64);
 feed(s,'evidence','final',0,te.encode(JSON.stringify(data)));
 feed(s,'attachment_zip','binary',1,new Uint8Array(await makePart().arrayBuffer()));
 assert.throws(()=>s.finalize([{order_number:order,status:'COMPLETE'}]),
  /MANUAL_BATCH_ATTACHMENT_LINK_MISMATCH/);
});
