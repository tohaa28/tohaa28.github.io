import test from 'node:test';
import assert from 'node:assert/strict';
import {parseOrderListText,explicitListOrderUrl}
 from '../vision/orders/approval-file-list.mjs';
import {probeTzForOrder,rangeOrderUrl}
 from '../vision/orders/approval-range-scanner.mjs';

test('explicit TXT accepts old seven-digit orders and deduplicates without reordering',()=>{
 const parsed=parseOrderListText('\uFEFF2999999\r\n3200000\n2999999\n\n8150033\n');
 assert.deepEqual(parsed.numbers,[2999999,3200000,8150033]);
 assert.equal(parsed.duplicates,1);
 assert.equal(explicitListOrderUrl(2999999),
  'http://testgifts.local/private/order/2999999');
 assert.throws(()=>rangeOrderUrl(2999999),/MANUAL_RANGE_ORDER_INVALID/);
});
test('import never extracts numbers from arbitrary text, filenames or CSV',()=>{
 for(const text of ['2999999.pdf\n','2999999_foo.cdr','File,Size\n2999999,2',
  '12345678','123456','2999999 3200000','0','3000000\nBAD\n'])
  assert.throws(()=>parseOrderListText(text),/MANUAL_ORDER_LIST_INVALID_LINE/);
 assert.throws(()=>parseOrderListText(''),/MANUAL_ORDER_LIST_EMPTY/);
});
test('order list forbids other hosts, paths, non-seven-digit IDs',()=>{
 for(const num of [999999,10000000,-1,NaN,2.3,'2999999'])
  assert.throws(()=>explicitListOrderUrl(num),/MANUAL_ORDER_LIST_ID_INVALID/);
 assert.equal(explicitListOrderUrl(9999999),
  'http://testgifts.local/private/order/9999999');
});
test('list-mode preflight permits legacy IDs only on allowlisted local order URL',async()=>{
 const urls=[];
 const result=await probeTzForOrder(2999999,{
  explicitList:true,fetcher:async(url,options)=>{
   urls.push(url);assert.equal(options.method,'GET');
   return {status:404};
  }
 });
 assert.equal(result.status,'ORDER_NOT_FOUND');
 assert.deepEqual(urls,['http://testgifts.local/private/order/2999999']);
});
test('333943 imported seven-digit records fit a bounded dedicated queue',()=>{
 const numbers=Array.from({length:333943},(_,i)=>1788753+i);
 const result=parseOrderListText(numbers.join('\n'));
 assert.equal(result.numbers.length,333943);
 assert.deepEqual(result.numbers.slice(0,2),[1788753,1788754]);
});
