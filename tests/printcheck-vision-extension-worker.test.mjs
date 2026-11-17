// C3B.3.R — offline tests of the exact MV3 service-worker sandbox.
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const code=readFileSync('vision/orders/extension/service-worker.js','utf8');
const origin='http://psk.testgifts.local';
const member={url:origin+'/devorders?status=140',frameId:0};
function harness({sender=member,fetcher=async()=>new Response('default',{
 headers:{'Content-Type':'text/html'}
})}={}){
 let connected,listener;
 const requests=[],messages=[];
 const runtime={onConnect:{addListener(fn){connected=fn}}};
 vm.runInNewContext(code,{chrome:{runtime},URL,AbortController,fetch:async(url,options)=>{
  requests.push({url,options});return fetcher(url,options);
 },setTimeout,clearTimeout,console});
 const port={
  name:'vision-order-lan-readonly-v1',sender,
  onMessage:{addListener(fn){listener=fn}},
  onDisconnect:{addListener(){}},
  postMessage(m){messages.push(JSON.parse(JSON.stringify(m)))},
  disconnect(){}
 };
 connected(port);
 return {messages,requests,
   invoke:async(message)=>{
     if(!listener)throw Error('Sender was rejected by service worker');
     await listener(message);
     return messages;
   },
   isConnected:()=>Boolean(listener)
 };
}
test('reject sender from another site, non-list origin, or iframe',()=>{
 for(const s of [
  {url:'http://testgifts.local/devorders',frameId:0},
  {url:'https://tohaa28.github.io/index.html',frameId:0},
  {url:origin+'/admin',frameId:0},
  {url:origin+'/devorders?status=140',frameId:1}
 ]){
   const h=harness({sender:s});
   assert.equal(h.isConnected(),false);
 }
});
test('reject arbitrary URLs, production Gifts, mutations, non-GET without touching network',async()=>{
 for(const url of [
  'https://gifts.ru/private/order/8000001',
  'http://psk.testgifts.local.evil.org/private/order/8000001',
  'http://testgifts.local/cart/act/mda?id=1&oid=55&delete=1',
  'http://testgifts.local/cart/act/mda?id=1',
  'http://testgifts.local/ajax/gifts/order?action=upload_makets&oid=55',
  'http://psk.testgifts.local/drawing?action=getOrderItemPdf&orderitemid=123',
  'http://testgifts.local/private/order/8000001?x=1',
  'http://testgifts.local/admin',
  'javascript:alert(1)'
 ]){
  const h=harness();
  const m=await h.invoke({op:'fetch',method:'GET',url});
  assert.equal(m[0]?.code,'EXTENSION_READ_ONLY_PATH_DENIED',url);
  assert.equal(h.requests.length,0,url);
 }
 const h=harness();
 const m=await h.invoke({op:'fetch',method:'POST',
  url:'http://testgifts.local/private/order/8000001'});
 assert.equal(m[0]?.code,'EXTENSION_GET_ONLY');
 assert.equal(h.requests.length,0);
});
test('permitted cross-origin popup is fetched from extension worker, session credentials retained',async()=>{
 const h=harness({fetcher:async()=>new Response('{"html":"<p>ok</p>"}',{
 headers:{'Content-Type':'application/json'}
 })});
 const m=await h.invoke({op:'fetch',method:'GET',
  url:'http://testgifts.local/ajax/gifts/order?action=makets_popup&oid=55'});
 assert.equal(m[0].op,'meta');
 assert.equal(m[0].status,200);
 assert.equal(m.at(-1).op,'end');
 const output=Buffer.concat(m.filter(x=>x.op==='chunk')
   .map(x=>Buffer.from(x.bytes))).toString();
 assert.equal(output,'{"html":"<p>ok</p>"}');
 assert.equal(h.requests.length,1);
 assert.equal(h.requests[0].options.credentials,'include');
 assert.equal(h.requests[0].options.method,'GET');
 assert.equal(h.requests[0].options.redirect,'error');
 assert.equal(h.requests[0].options.headers['x-requested-with'],'XMLHttpRequest');
});
test('bounded artwork is transmitted in chunks; no constructor or other URL touched',async()=>{
 const data=Buffer.from('%PDF-1.7\n'+'A'.repeat(230000));
 const h=harness({fetcher:async()=>new Response(data,{
 headers:{'Content-Type':'application/pdf','Content-Length':String(data.length)}
 })});
 const m=await h.invoke({op:'fetch',method:'GET',
  url:'http://testgifts.local/cart/act/mda?oid=55&id=42'});
 assert.equal(m[0].status,200);
 assert.equal(m.at(-1).op,'end');
 assert.ok(m.some(x=>x.op==='chunk'));
 assert.ok(m.filter(x=>x.op==='chunk').every(x=>x.bytes.length<=48*1024));
 assert.deepEqual(Buffer.concat(m.filter(x=>x.op==='chunk')
    .map(x=>Buffer.from(x.bytes))),data);
 assert.equal(h.requests.length,1);
});
test('reject declared payload above 16 MB before reading original bytes',async()=>{
 const h=harness({fetcher:async()=>new Response('abc',{
 headers:{'Content-Type':'application/octet-stream','Content-Length':'17000000'}
 })});
 const m=await h.invoke({op:'fetch',method:'GET',
  url:'http://psk.testgifts.local/cart/act/mda?oid=55&id=42'});
 assert.equal(m[0].code,'EXTENSION_RESPONSE_TOO_LARGE');
 assert.equal(m.length,1);
});
test('403 denial reports status, never returns denial body or URL',async()=>{
 const h=harness({fetcher:async()=>new Response('customer private page',{status:403,
 headers:{'Content-Type':'text/html'}
 })});
 const m=await h.invoke({op:'fetch',method:'GET',
  url:'http://testgifts.local/private/order/8000001'});
 assert.equal(m[0].status,403);
 assert.equal(m.at(-1).op,'end');
 assert.equal(m.some(x=>x.op==='chunk'),false);
 assert.equal(JSON.stringify(m).includes('customer'),false);
 assert.equal(JSON.stringify(m).includes('8000001'),false);
});
