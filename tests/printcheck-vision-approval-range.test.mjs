import test from 'node:test';
import assert from 'node:assert/strict';
import {readTzApprovedStatus,rangeConfig,freshRangeCheckpoint,
 commitRangeArchive,commitOnlySkipped,probeTzForOrder,rangeOrderUrl,
 isRecoverableRangeFailure,
 RANGE_MIN,RANGE_MAX} from '../vision/orders/approval-range-scanner.mjs';

function makeDocument({id='3200000',checked=false,label='ТЗ утверждено',
 multiple=false,root=true}={}){
 const input={checked,getAttribute:x=>x==='data-id'?'59':null,
  closest:selector=>selector==='label'?{
   querySelectorAll:()=>[{textContent:label},{textContent:label}]
  }:null};
 const cart={getAttribute:x=>x==='data-orderid'?'7915133':null,
  querySelector:()=>({getAttribute:x=>x==='data-clipboard-text'?id:null}),
  querySelectorAll:()=>multiple?[input,input]:[input]};
 return {querySelector:()=>root?cart:null};
}
test('native status 59 is checked even though label exists in BOTH states',()=>{
 assert.equal(readTzApprovedStatus(makeDocument({checked:true}),'3200000').status,
  'TZ_APPROVED');
 const falseStatus=readTzApprovedStatus(makeDocument({checked:false}),'3200000');
 assert.equal(falseStatus.status,'TZ_NOT_APPROVED');
 assert.equal(falseStatus.status_text,'ТЗ утверждено');
});
test('fail closed for changed numbers, missing checkbox, contradictory text',()=>{
 assert.equal(readTzApprovedStatus(makeDocument({id:'3200022',checked:true}),'3200000')
  .status,'MANUAL_ORDER_NUMBER_MISMATCH');
 assert.equal(readTzApprovedStatus(makeDocument({root:false}), '3200000')
  .status,'MANUAL_ORDER_CARD_MISSING');
 assert.equal(readTzApprovedStatus(makeDocument({multiple:true,checked:true}), '3200000')
  .status,'MANUAL_TZ_STATUS_MISSING_OR_AMBIGUOUS');
 assert.equal(readTzApprovedStatus(makeDocument({checked:true,label:'ТЗ не утверждено'}),'3200000')
  .status,'MANUAL_TZ_LABEL_UNVERIFIED');
});
test('validated bounds, no uncontrolled catalog or second environment',()=>{
 assert.equal(rangeOrderUrl(3200000),
  'http://testgifts.local/private/order/3200000');
 assert.equal(rangeConfig(RANGE_MIN,RANGE_MAX,1200).archive_size,100);
 assert.throws(()=>rangeConfig(3199999,RANGE_MAX,1200),/RANGE_BOUNDS/);
 assert.throws(()=>rangeConfig(RANGE_MIN,RANGE_MAX,200),/RANGE_RATE/);
 assert.throws(()=>rangeOrderUrl(8200001),/RANGE_ORDER_INVALID/);
});
test('cursor is durable only after an archived batch, or skip-only interval',()=>{
 const init=freshRangeCheckpoint(rangeConfig(3200000,3200500,1000));
 const skipped=commitOnlySkipped(init,3200050);
 assert.equal(skipped.committed_next,3200050);
 assert.equal(skipped.checked_committed,50);
 assert.equal(skipped.archives_completed,0);
 const found=[{order_number:'3200055',status:'TZ_APPROVED'}];
 const advanced=commitRangeArchive(skipped,{next:3200060,found});
 assert.equal(advanced.committed_next,3200060);
 assert.equal(advanced.checked_committed,60);
 assert.equal(advanced.archives_completed,1);
 assert.deepEqual(advanced.registry,found);
 assert.deepEqual(advanced.failed_orders,[]);
 assert.throws(()=>commitRangeArchive(advanced,{next:3200059,found}),/CHECKPOINT_COMMIT_INVALID/);
});
test('one GET, HTTP 404 skip; auth/invalid never skip',async()=>{
 let count=0;
 const fetcher=async(url,opts)=>{
  count++;assert.equal(opts.method,'GET');
  assert.equal(url,'http://testgifts.local/private/order/3200000');
  return {status:404};
 };
 assert.equal((await probeTzForOrder(3200000,{fetcher})).status,'ORDER_NOT_FOUND');
 assert.equal(count,1);
 const auth=await probeTzForOrder(3200000,{fetcher:async()=>({status:403})});
 assert.equal(auth.status,'MANUAL_ORDER_AUTH_REQUIRED');
 const unknown=await probeTzForOrder(3200000,{fetcher:async()=>({
  status:200,headers:{get:()=>null},text:async()=>'<html></html>'})});
 assert.equal(unknown.status,'MANUAL_NON_HTML_RESPONSE');
});

test('inaccessible order pages remain retryable without blocking next ID',async()=>{
 const failureStatuses=['MANUAL_ORDER_FETCH_FAILED','MANUAL_ORDER_HTTP_STATUS',
  'MANUAL_NON_HTML_RESPONSE','MANUAL_ORDER_HTML_INVALID',
  'MANUAL_ORDER_CARD_MISSING','MANUAL_ORDER_TAB_UNREADABLE',
  'MANUAL_BACKGROUND_ORDER_FAILED','MANUAL_APPROVAL_COLLECTION_INCOMPLETE'];
 for(const status of failureStatuses)
  assert.equal(isRecoverableRangeFailure(status),true,status);
 for(const status of ['MANUAL_ORDER_AUTH_REQUIRED','MANUAL_ORDER_RATE_LIMITED',
  'MANUAL_MV3_TRANSPORT_REQUIRED','MANUAL_PROBE_CANCELLED'])
  assert.equal(isRecoverableRangeFailure(status),false,status);
 const attempts=[];
 for(const code of [503,404,200]){
  const fetcher=async url=>{
   attempts.push(url);
   return code===200?{
    status:200,headers:{get:()=> 'text/html'},
    text:async()=>'<html><body>No order</body></html>'
   }:{status:code};
  };
  const result=await probeTzForOrder(3200000+attempts.length-1,{fetcher,
   DOMParserClass:class{parseFromString(){
    return {querySelector:()=>null};
   }}
  }});
  assert.equal(result.status,code===503?'MANUAL_ORDER_HTTP_STATUS':
   code===404?'ORDER_NOT_FOUND':'MANUAL_ORDER_CARD_MISSING');
 }
 assert.equal(attempts.length,3,'scanner can safely advance across failed pages');
 const cp=freshRangeCheckpoint(rangeConfig(3200000,3200100,1000));
 const bad=[{order_number:'3200000',reason:'MANUAL_ORDER_HTTP_STATUS',
  phase:'order_card',http_status:503}];
 const progressed=commitOnlySkipped(cp,3200003,bad);
 assert.equal(progressed.committed_next,3200003);
 assert.equal(progressed.checked_committed,3);
 assert.deepEqual(progressed.failed_orders,bad);
 const same=commitRangeArchive(progressed,{
  next:3200005,found:[{order_number:'3200004',status:'TZ_APPROVED'}],
  failed_orders:[{order_number:'3200003',reason:'MANUAL_ORDER_FETCH_FAILED',
   phase:'order_card'}]
 });
 assert.deepEqual(same.failed_orders.map(x=>x.order_number),
  ['3200000','3200003']);
 assert.equal(same.found_committed,1);
 const replay=commitOnlySkipped(same,3200007,
  [{order_number:'3200003',reason:'MANUAL_ORDER_FETCH_FAILED',phase:'order_card'}]);
 assert.equal(replay.failed_orders.length,2,'retry numbers deduplicate');
});
