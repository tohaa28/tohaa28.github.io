import test from 'node:test';
import assert from 'node:assert/strict';
import {
 TEST_HOSTS,testUrl,rowOrderTarget,popupHtml,
 fetchOrderResourceBytes,recheckOrderPopupReferences
} from '../vision/orders/order-page-discovery.mjs';
const loc=new URL('http://psk.testgifts.local/devorders?status=140');
const anchor=href=>({getAttribute:n=>n==='href'?href:null});
const row=(anchors,attrs={},firstCell='')=>({
 querySelectorAll:()=>anchors.map(anchor),
 getAttribute:n=>attrs[n]??null,
 querySelector:()=>firstCell?{textContent:firstCell}:null
});
test('order-only navigation uses exact private/order route, never production gifts.ru',()=>{
 assert.deepEqual(TEST_HOSTS,['psk.testgifts.local','testgifts.local']);
 const x=rowOrderTarget(row(['/private/order/8000001']),loc.href);
 assert.equal(x.status,'ORDER_LINK_FOUND');
 assert.equal(x.number,'8000001');
 assert.equal(x.url.origin,loc.origin);
 const mixed=rowOrderTarget(row(['/private/order/8000001','/private/order/8000002']),loc.href);
 assert.equal(mixed.reason,'AMBIGUOUS_ORDER_ROW');
 assert.equal(rowOrderTarget(row(['https://gifts.ru/private/order/8000001']),loc.href)
   .reason,'ORDER_DETAIL_LINK_REQUIRED');
 assert.equal(testUrl('https://gifts.ru/private/order/8000001',loc.href),null);
 assert.equal(testUrl('http://testgifts.local/private/order/8000001',loc.href)?.hostname,
   'testgifts.local');
});
test('HTML row onclick is read as static URL text but never evaluated; numeric first cell is fallback',()=>{
 const fromClick=rowOrderTarget(row([],{onclick:"location.href='/private/order/8000012'"}),loc.href);
 assert.equal(fromClick.number,'8000012');
 const fromAttr=rowOrderTarget(row([],{ 'data-order-number':'8000013'}),loc.href);
 assert.equal(fromAttr.number,'8000013');
 const fromCell=rowOrderTarget(row([],{},'8000014'),loc.href);
 assert.equal(fromCell.number,'8000014');
 assert.equal(rowOrderTarget(row([],{},'100 шт.'),loc.href).status,'MANUAL');
});
test('Maketnaya popup JSON returns only HTML, rejects absent html and malformed JSON',()=>{
 assert.equal(popupHtml('{"html":"<a>ok</a>"}').html,'<a>ok</a>');
 assert.equal(popupHtml('<p>ok</p>').status,'POPUP_HTML');
 assert.equal(popupHtml('{"other":"secret"}').reason,'POPUP_JSON_MISSING_HTML');
 assert.equal(popupHtml('{not valid').reason,'POPUP_JSON_INVALID');
});
const valid={
 role:'customer_uploaded_artwork',id:'42',internalId:'55',
 orderNumber:'8000001',detailOrigin:'http://psk.testgifts.local',
 filename:'Customer.pdf',
 url:'http://psk.testgifts.local/cart/act/mda?oid=55&id=42'
};
test('only official validated customer mda can download, never templates or unrelated ids',async()=>{
 let calls=0;
 const mock=async(url,opts)=>{
  calls++;
  assert.equal(url,valid.url);
  assert.equal(opts.method,'GET');
  assert.equal(opts.mode,'same-origin');
  assert.equal(opts.credentials,'include');
  assert.equal(opts.redirect,'error');
  return new Response('%PDF-1.4\n'+('S'.repeat(80)),{
   status:200,headers:{'Content-Type':'application/pdf'}
  });
 };
 const result=await fetchOrderResourceBytes(valid,{loc,fetcher:mock});
 assert.equal(result.status,'LOCAL_BYTES_ONLY');
 assert.equal(result.bytes[0],37);
 assert.equal(calls,1);
 const bad=[
  {...valid,role:'constructor_template'},
  {...valid,url:'https://gifts.ru/cart/act/mda?oid=55&id=42'},
  {...valid,url:'http://psk.testgifts.local/cart/act/mda?oid=99&id=42'},
  {...valid,url:'http://psk.testgifts.local/ajax/gifts/order?action=upload_makets'},
  {...valid,id:'-111'},
  {...valid,detailOrigin:'http://testgifts.local'}
 ];
 for(const resource of bad){
  const out=await fetchOrderResourceBytes(resource,{loc,fetcher:mock});
  assert.equal(out.status,'MANUAL',JSON.stringify(resource));
 }
 assert.equal(calls,1,'Rejected resources cannot touch network');
});
test('test mirror download requires browser CORS; no credential or redirect bypass',async()=>{
 const resource={...valid,detailOrigin:'http://testgifts.local',
  url:'http://testgifts.local/cart/act/mda?oid=55&id=42'};
 let sent;
 const result=await fetchOrderResourceBytes(resource,{loc,fetcher:async(url,options)=>{
  sent={url,options};return new Response('%PDF-1.5\n'+('S'.repeat(64)),{
   headers:{'Content-Type':'application/pdf'}
  });
 }});
 assert.equal(result.status,'LOCAL_BYTES_ONLY');
 assert.equal(sent.options.mode,'cors');
 assert.equal(sent.options.credentials,'include');
 assert.equal(sent.options.redirect,'error');
});

test('customer artwork HTTP failure keeps numeric status, not private body or URL',async()=>{
 const file={role:'customer_uploaded_artwork',id:'42',internalId:'55',
  orderNumber:'8000001',detailOrigin:'http://psk.testgifts.local',
  filename:'Private filename.pdf',
  url:'http://psk.testgifts.local/cart/act/mda?oid=55&id=42'};
 const out=await fetchOrderResourceBytes(file,{loc,fetcher:async()=>
   new Response('secret customer details',{status:403,
     headers:{'Content-Type':'text/plain'}})});
 assert.equal(out.status,'MANUAL');
 assert.equal(out.reason,'ARTWORK_HTTP_ERROR');
 assert.equal(out.stage,'artwork');
 assert.equal(out.http_status,403);
 assert.equal(out.failure_class,'http_status');
 assert.equal(JSON.stringify(out).includes('secret'),false);
 assert.equal(JSON.stringify(out).includes('Private filename'),false);
});


test('HTTP 404 popup recheck distinguishes still-listed vs stale file reference without retrying file',async()=>{
 class Parser{
   parseFromString(html){
     const anchor={
       getAttribute:name=>name==='href'?'/cart/act/mda?oid=55&id=42':null,
       textContent:'Private  original.PDF',parentElement:null
     };
     return {querySelectorAll:sel=>sel==='a[data-maket="true"][href]'&&
       html.includes('id=42')?[anchor]:[]};
   }
 }
 const resource={...valid,originalFilename:'Customer private.pdf'};
 for(const [body,expected] of [
   ['<a data-maket="true" href="/cart/act/mda?oid=55&id=42">Private.pdf</a>',true],
   ['<span>no attachment</span>',false]
 ]){
   const requests=[];
   const out=await recheckOrderPopupReferences([resource],{
     loc,DOMParserClass:Parser,fetcher:async(url,opts)=>{
       requests.push({url,opts});
       return new Response(body,{headers:{'Content-Type':'text/html'}});
     }
   });
   assert.equal(out.status,'REFERENCE_RECHECKED');
   assert.deepEqual(out.listed,[expected]);
   assert.equal(requests.length,1);
   assert.equal(new URL(requests[0].url).pathname,'/ajax/gifts/order');
   assert.equal(requests[0].opts.method,'GET');
   assert.equal(JSON.stringify(out).includes('private'),false);
   assert.equal(JSON.stringify(out).includes('Customer'),false);
   assert.equal(JSON.stringify(out).includes('oid='),false);
 }
});
test('popup recheck refuses untrusted resource and redacts failures',async()=>{
 let calls=0;
 for(const candidate of [
   {...valid,role:'constructor_template'},
   {...valid,url:'https://gifts.ru/cart/act/mda?oid=55&id=42'},
   {...valid,url:'http://psk.testgifts.local/cart/act/mda?oid=66&id=42'},
   {...valid,id:'99'}
 ]){
   const out=await recheckOrderPopupReferences([candidate],{
     loc,fetcher:async()=>{calls++;throw Error('should not fetch')}
   });
   assert.equal(out.reason,'UNTRUSTED_POPUP_RECHECK_LIST');
 }
 assert.equal(calls,0);
 const out=await recheckOrderPopupReferences([valid],{loc,fetcher:async()=>{
   throw TypeError('private card cookie /cart/act/mda?oid=55&id=42');
 }});
 assert.equal(out.reason,'POPUP_REFERENCE_RECHECK_UNAVAILABLE');
 assert.equal(out.failure_class,'cors_redirect_or_network');
 assert.equal(JSON.stringify(out).includes('cookie'),false);
 assert.equal(JSON.stringify(out).includes('oid=55'),false);
});


test('test-subdomain errors preserve exact MV3 auth/network class but never private exception strings',async()=>{
 const resource={...valid,detailOrigin:'http://testgifts.local',
   url:'http://testgifts.local/cart/act/mda?oid=55&id=42'};
 const cases=[
  ['EXTENSION_AUTH_REDIRECT','ARTWORK_AUTH_REDIRECT','login_redirect'],
  ['EXTENSION_REDIRECT_UNTRUSTED_ORIGIN','ARTWORK_REDIRECT_UNTRUSTED_ORIGIN','untrusted_redirect_origin'],
  ['EXTENSION_REDIRECT_UNEXPECTED_PATH','ARTWORK_REDIRECT_UNEXPECTED_PATH','unexpected_redirect_path'],
  ['EXTENSION_FETCH_REJECTED','ARTWORK_EXTENSION_NETWORK_REJECTED','extension_network_rejected'],
  ['EXTENSION_SERVICE_DISCONNECTED','ARTWORK_EXTENSION_DISCONNECTED','extension_disconnected'],
  ['EXTENSION_FETCH_TIMEOUT','ARTWORK_TIMEOUT','timeout']
 ];
 for(const [code,reason,failure] of cases){
   const out=await fetchOrderResourceBytes(resource,{loc,
     fetcher:async()=>{throw new TypeError(code)}
   });
   assert.equal(out.reason,reason,code);
   assert.equal(out.failure_class,failure,code);
   assert.equal(out.stage,'artwork',code);
   assert.equal(out.transport_error,code);
   assert.equal(JSON.stringify(out).includes('testgifts.local'),false);
   assert.equal(JSON.stringify(out).includes('Customer.pdf'),false);
 }
 const generic=await fetchOrderResourceBytes(resource,{loc,
   fetcher:async()=>{throw new TypeError('Private cookie and /cart/act/mda?oid=55&id=42')}
 });
 assert.equal(generic.reason,'TEST_SUBDOMAIN_CORS_OR_AUTH_REQUIRED');
 assert.equal(generic.failure_class,'cors_redirect_or_network');
 assert.equal(JSON.stringify(generic).includes('cookie'),false);
 assert.equal(JSON.stringify(generic).includes('oid='),false);
});
