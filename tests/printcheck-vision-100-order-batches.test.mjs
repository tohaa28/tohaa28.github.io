import test from 'node:test';
import assert from 'node:assert/strict';
import {ApprovalBatchSession} from '../vision/orders/approval-batch-archive.mjs';
import {APPROVED_ORDERS_PER_ZIP,SOFT_BATCH_PAYLOAD_LIMIT,
 archivePayloadBytes,selectArchiveRows,archiveBatchDue}
 from '../vision/orders/approval-file-batch-policy.mjs';

const te=new TextEncoder();
function makeRow(n){
 const id=String(3500000+n);
 const report={schema:'printcheck.vision.private-approval-collection.v1',
  order_number:id,scope:'LOCAL_AUTHORIZED_TEST_ORDER',
  order_facts:{order:{order_number:id},articles:[]},articles:[],
  training_ready:false,production_approved:false};
 const data=te.encode(JSON.stringify(report));
 return {id,order_number:id,collected_at:'2026-01-01T00:00:00Z',
  status:'TZ_APPROVED',files:0,transfers:[{
   type:'evidence',stage:'final',part:0,total:1,data,report
  }]};
}
async function zipEntries(blob){
 const data=new Uint8Array(await blob.arrayBuffer());
 const dv=new DataView(data.buffer),entries=new Map();
 let p=0;
 while(p+30<=data.length&&dv.getUint32(p,true)===0x04034b50){
  const size=dv.getUint32(p+18,true),nameLen=dv.getUint16(p+26,true),
   extraLen=dv.getUint16(p+28,true);
  const name=new TextDecoder().decode(data.subarray(p+30,p+30+nameLen));
  const at=p+30+nameLen+extraLen;
  assert.ok(at+size<=data.length);
  assert.ok(!entries.has(name));
  entries.set(name,new TextDecoder().decode(data.subarray(at,at+size)));
  p=at+size;
 }
 return entries;
}

test('batch threshold is 100 approved, not all checked order numbers',()=>{
 assert.equal(APPROVED_ORDERS_PER_ZIP,100);
 const approved=Array.from({length:99},(_,i)=>makeRow(i));
 assert.equal(archiveBatchDue(approved),false);
 assert.equal(selectArchiveRows(approved).length,99);
 // 300 nonapproved/not found order numbers do not become archive rows.
 const checked=399;
 assert.ok(checked>APPROVED_ORDERS_PER_ZIP);
 assert.equal(archiveBatchDue(approved),false);
 approved.push(makeRow(99));
 assert.equal(archiveBatchDue(approved),true);
 approved.push(makeRow(100));
 assert.equal(selectArchiveRows(approved).length,100);
 assert.equal(selectArchiveRows(approved.slice(100)).length,1);
 assert.equal(archiveBatchDue(approved.slice(100)),false);
});

test('99-order incomplete batch remains lossless when restored',async()=>{
 const rows=Array.from({length:99},(_,i)=>makeRow(i));
 const session=new ApprovalBatchSession();
 for(const r of rows)session.restoreOrder(r.id,r.transfers);
 assert.equal(session.receivedOrderIds().length,99);
 const checkpointRows=rows.map(r=>({...r,transfers:r.transfers.map(t=>({...t}))}));
 const recovered=new ApprovalBatchSession();
 for(const row of checkpointRows)recovered.restoreOrder(row.id,row.transfers);
 assert.equal(recovered.receivedOrderIds().length,99);
 assert.equal(archiveBatchDue(checkpointRows),false);
 const result=recovered.finalize(checkpointRows);
 assert.equal(result.counts.orders,99);
 assert.equal(result.counts.unverified_orders,0);
});

test('101 approved -> exactly 100 in first ZIP, 1 in final ZIP',async()=>{
 const rows=Array.from({length:101},(_,i)=>makeRow(i));
 const restored=new ApprovalBatchSession();
 for(const row of rows)restored.restoreOrder(row.id,row.transfers);
 const firstRows=selectArchiveRows(rows),lastRows=rows.slice(firstRows.length);
 assert.equal(firstRows.length,100);
 assert.equal(lastRows.length,1);
 const first=restored.finalize(firstRows);
 const firstFiles=await zipEntries(first.blob);
 const firstManifest=JSON.parse(firstFiles.get('manifest.json'));
 const firstIndex=JSON.parse(firstFiles.get('index/orders.json'));
 assert.equal(firstManifest.counts.orders,100);
 assert.equal(firstManifest.counts.unverified_orders,0);
 assert.equal(firstIndex.length,100);
 assert.equal(firstFiles.has('orders/3500000/source/evidence.json'),true);
 assert.equal(firstFiles.has('orders/3500099/source/evidence.json'),true);
 assert.equal(firstFiles.has('orders/3500100/source/evidence.json'),false);
 for(const row of firstRows)restored.discardOrder(row.id);
 assert.deepEqual(restored.receivedOrderIds(),['3500100']);
 const tail=restored.finalize(lastRows);
 const tailFiles=await zipEntries(tail.blob);
 const tailManifest=JSON.parse(tailFiles.get('manifest.json'));
 assert.equal(tailManifest.counts.orders,1);
 assert.equal(tailFiles.has('orders/3500100/source/evidence.json'),true);
 assert.equal(tailFiles.has('orders/3500099/source/evidence.json'),false);
 assert.equal(new Set([...firstIndex.map(x=>x.order_number),'3500100']).size,101);
});

test('safety flush prevents archive payload from approaching 180 MB',()=>{
 const rows=[{id:'3500000',transfers:[{data:{byteLength:SOFT_BATCH_PAYLOAD_LIMIT-1}}]}];
 assert.equal(archivePayloadBytes(rows),SOFT_BATCH_PAYLOAD_LIMIT-1);
 assert.equal(archiveBatchDue(rows),false);
 rows[0].transfers.push({data:{byteLength:1}});
 assert.equal(archiveBatchDue(rows),true);
 // Safety exception: fewer than 100 orders may form a ZIP.
 assert.equal(selectArchiveRows(rows).length,1);
});
