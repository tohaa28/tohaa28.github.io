import test from 'node:test';
import assert from 'node:assert/strict';
import {
 LOCAL_ORDERS,isAllowedTestOrderPage,sameOriginArtifactUrl,
 isCandidateArtworkLink,inspectOrderArtworkBytes,inspectSameOriginArtwork
} from '../vision/orders/row-scanner.mjs';

const loc=new URL('http://psk.testgifts.local/devorders?status=140');
const anchor=href=>({getAttribute(n){return n==='href'?href:null},
  textContent:'скачать макет'});
test('LAN overlay is locked to exact host, protocol and orders route',()=>{
 assert.equal(isAllowedTestOrderPage(loc),true);
 for(const x of [
  'http://testgifts.local/devorders',
  'http://psk.testgifts.local/devorders-evil',
  'https://psk.testgifts.local/devorders',
  'http://psk.testgifts.local/admin',
  'http://psk.testgifts.local.evil.tld/devorders'
 ])assert.equal(isAllowedTestOrderPage(new URL(x)),false,x);
 assert.equal(LOCAL_ORDERS.maxBatchFiles<=40,true);
});
test('same-origin artwork links never accept data, script, credentials, cross subdomain or order table itself',()=>{
 for(const x of [
  'javascript:alert(1)','data:image/svg+xml;base64,AAAA',
  'http://evil.local/a.pdf','http://testgifts.local/logo.pdf',
  'http://psk.testgifts.local.evil.tld/x.pdf',
  'http://u:p@psk.testgifts.local/x.pdf','/devorders?status=140'
 ])assert.equal(sameOriginArtifactUrl(x,loc),null,x);
 assert.equal(sameOriginArtifactUrl('/download/file.svg',loc)?.origin,loc.origin);
});
test('artwork link detection does not treat order ID links as artwork',()=>{
 const fake=(href,text,download=null)=>({
   getAttribute(n){return n==='href'?href:n==='download'?download:null},
   textContent:text
 });
 assert.equal(isCandidateArtworkLink(fake('/devorders/300123','300123')),false);
 assert.equal(isCandidateArtworkLink(fake('/files/a.pdf','PDF')),true);
 assert.equal(isCandidateArtworkLink(fake('/attachment?id=1','скачать макет')),true);
 assert.equal(isCandidateArtworkLink(fake('javascript:alert(1)','300123')),false);
});
test('a PDF is recognized but never declared verified vector geometry',async()=>{
 const b=new TextEncoder().encode('%PDF-1.7\n'+('a'.repeat(70)));
 const out=await inspectOrderArtworkBytes(b,new URL('/files/file.pdf',loc),'application/pdf');
 assert.equal(out.status,'MANUAL');
 assert.equal(out.reason,'PDF_VECTOR_PAINT_PIPELINE_NOT_VERIFIED');
 assert.equal(out.geometry_extracted,false);
 assert.equal(out.production_approved,false);
});
test('mismatched HTML login page, changed signature and unsupported CDR never produce PASS',async()=>{
 const login=await inspectOrderArtworkBytes(new TextEncoder().encode('<html>login</html>'),
   new URL('/files/file.svg',loc),'text/html;charset=utf-8');
 assert.equal(login.reason,'UNEXPECTED_HTML_OR_JSON_RESPONSE');
 const bad=await inspectOrderArtworkBytes(new TextEncoder().encode('%PDF-1.4 hello'),
   new URL('/files/file.svg',loc),'image/svg+xml');
 assert.equal(bad.reason,'FILE_SIGNATURE_MISMATCH');
 const cdr=await inspectOrderArtworkBytes(new Uint8Array(50),
   new URL('/files/file.cdr',loc),'application/octet-stream');
 assert.equal(cdr.reason,'UNSUPPORTED_VECTOR_OR_ARCHIVE_FORMAT');
});
test('same-origin GET carries cookies only to LAN server; no POST or offsite fetch',async()=>{
 let called=0,request=null;
 const output=await inspectSameOriginArtwork(anchor('/files/a.pdf'),{
   loc,fetcher:async (url,args)=>{
     called++;request={url,args};
     return new Response('%PDF-1.7\n'+('x'.repeat(80)),
       {status:200,headers:{'Content-Type':'application/pdf'}});
   }
 });
 assert.equal(called,1);assert.equal(output.status,'MANUAL');
 assert.equal(request.url,'http://psk.testgifts.local/files/a.pdf');
 assert.equal(request.args.method,'GET');
 assert.equal(request.args.mode,'same-origin');
 assert.equal(request.args.credentials,'same-origin');
 assert.equal(request.args.redirect,'error');
 assert.equal(request.args.cache,'no-store');
 assert.equal(output.uploaded_to_external_service,false);
 let rejectCalls=0;
 const reject=await inspectSameOriginArtwork(anchor('http://elsewhere.testgifts.local/a.svg'),{
   loc,fetcher:async()=>{rejectCalls++;throw Error('must not call')}
 });
 assert.equal(reject.reason,'CROSS_ORIGIN_OR_UNSAFE_FILE_URL');
 assert.equal(rejectCalls,0);
});
test('bounded download refuses massive Content-Length without consuming body',async()=>{
 const out=await inspectSameOriginArtwork(anchor('/attachments/huge.pdf'),{
   loc,fetcher:async()=>new Response('%PDF-1.4\n',{
     headers:{'Content-Length':'800000000','Content-Type':'application/pdf'}
   })
 });
 assert.equal(out.status,'MANUAL');
 assert.equal(out.reason,'FILE_SIZE_LIMIT');
});
