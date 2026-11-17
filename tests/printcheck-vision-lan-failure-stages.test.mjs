// C3B.3.R: errors are identified without storing URLs, identifiers, page HTML
// or server error text. All test data in this file are invented.
import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectOrderPageFromRow}
  from '../vision/orders/order-page-discovery.mjs';
const loc=new URL('http://psk.testgifts.local/devorders?status=140');
const row=href=>({
 querySelectorAll:()=>[{
   getAttribute:name=>name==='href'?href:null
 }],
 getAttribute:()=>null,
 querySelector:()=>null
});
const options={loc};
test('an HTTP CORS/redirect/network rejection is classified by actual stage and origin, not falsely diagnosed as CORS',async()=>{
 const x=await inspectOrderPageFromRow(row('/private/order/8000001'),{
  ...options,fetcher:async()=>{throw TypeError('Failed to fetch: private URL SHOULD NEVER BE IN OUTPUT')}
 });
 assert.equal(x.status,'MANUAL');
 assert.equal(x.reason,'ORDER_CARD_FETCH_REJECTED');
 assert.equal(x.stage,'order_card');
 assert.equal(x.origin_relation,'same_origin');
 assert.equal(x.failure_class,'cors_redirect_or_network');
 assert.equal(x.fetch_exception_family,'TypeError');
 assert.equal(JSON.stringify(x).includes('private'),false);
 assert.equal(JSON.stringify(x).includes('8000001'),false);
});
test('other approved test origin is only an anonymous relation flag',async()=>{
 const x=await inspectOrderPageFromRow(row('http://testgifts.local/private/order/8000001'),{
  ...options,fetcher:async()=>{throw TypeError('NetworkError')}
 });
 assert.equal(x.reason,'ORDER_CARD_FETCH_REJECTED');
 assert.equal(x.origin_relation,'approved_other_test_origin');
 assert.equal(x.stage,'order_card');
 assert.equal(JSON.stringify(x).includes('testgifts.local'),false);
});
test('HTTP denial has status without response URL or body',async()=>{
 const x=await inspectOrderPageFromRow(row('/private/order/8000001'),{
  ...options,fetcher:async()=>new Response('Access denied private token',{
   status:403,headers:{'Content-Type':'text/html'}
  })
 });
 assert.equal(x.reason,'ORDER_CARD_HTTP_ERROR');
 assert.equal(x.http_status,403);
 assert.equal(x.failure_class,'http_status');
 assert.equal(JSON.stringify(x).includes('private token'),false);
});
test('HTML auth form reports auth stage without copying markup',async()=>{
 const x=await inspectOrderPageFromRow(row('/private/order/8000001'),{
  ...options,fetcher:async()=>new Response('<form name="authform">secret</form>',{
   headers:{'Content-Type':'text/html'}
  })
 });
 assert.equal(x.reason,'ORDER_CARD_AUTH_REQUIRED');
 assert.equal(x.failure_class,'login_html');
 assert.equal(JSON.stringify(x).includes('secret'),false);
});
test('popup failure is distinguished from accessible card after internal ID',async()=>{
 const fakeDoc={
  querySelector(selector){
   return selector==='#j_cart_host[data-orderid]'?
    {getAttribute:name=>name==='data-orderid'?'55':null}:null;
  }
 };
 class Parser{
  parseFromString(){return fakeDoc}
 }
 const requests=[];
 const x=await inspectOrderPageFromRow(row('http://testgifts.local/private/order/8000001'),{
  ...options,DOMParserClass:Parser,fetcher:async(url,options)=>{
   requests.push({url,options});
   if(url.includes('/private/order/'))
    return new Response('<div id="j_cart_host" data-orderid="55"></div>',{
     headers:{'Content-Type':'text/html'}
    });
   throw TypeError('No cross-origin permission for popup');
  }
 });
 assert.equal(x.reason,'ORDER_POPUP_FETCH_REJECTED');
 assert.equal(x.stage,'popup');
 assert.equal(x.origin_relation,'approved_other_test_origin');
 assert.equal(requests.length,2);
 assert.equal(requests[0].options.mode,'cors');
 assert.equal(requests[1].options.mode,'cors');
 assert.equal(requests[0].options.method,'GET');
 assert.equal(requests[1].options.method,'GET');
 assert.equal(requests[1].options.redirect,'error');
 assert.equal(requests[1].options.headers['x-requested-with'],undefined,
  'Cross-origin bookmarklet must avoid preflight-only X-Requested-With');
});
test('same-origin AJAX popup uses header from original Maketnaya API',async()=>{
 class Parser{parseFromString(){
  return {querySelector:sel=>sel.startsWith('#j_cart_host')?
    {getAttribute:()=> '55'}:null};
 }}
 let ajaxHeaders;
 const x=await inspectOrderPageFromRow(row('/private/order/8000001'),{
  ...options,DOMParserClass:Parser,
  fetcher:async(url,opts)=>{
   if(url.includes('makets_popup')){
    ajaxHeaders=opts.headers;
    throw TypeError('synthetic popup abort');
   }
   return new Response('test',{headers:{'Content-Type':'text/html'}});
  }
 });
 assert.equal(x.stage,'popup');
 assert.equal(x.reason,'ORDER_POPUP_FETCH_REJECTED');
 assert.equal(ajaxHeaders['x-requested-with'],'XMLHttpRequest');
});
