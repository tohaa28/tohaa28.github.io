import test from 'node:test';
import assert from 'node:assert/strict';
import {nativeApprovalAttachmentUrl,nativeAttachmentSignature,
 readNativeApprovalAttachment,exportNativeApprovalAttachmentParts}
 from '../vision/orders/approval-attachments.mjs';

const pdf=new Uint8Array(Buffer.from('%PDF-1.7\n%%EOF\n','ascii'));
const psd=new Uint8Array(Buffer.concat([
 Buffer.from('8BPS','ascii'),Buffer.alloc(10)]));
const urlOf=id=>'http://testgifts.local/ajax/gifts/order?'+
 'action=download_maketadjusting_attachment&id='+id;
const response=(bytes,type='application/octet-stream')=>new Response(bytes,{
 status:200,headers:{'content-type':type,'content-length':String(bytes.length)}
});
const attachment=(id,filename)=>({attachment_id:id,filename,kind:'other'});

test('only the explicitly grounded same-origin attachment action and numeric ID',()=>{
 assert.equal(nativeApprovalAttachmentUrl('18'),urlOf('18'));
 for(const id of ['','-1','1?&evil','0x11','1/../login',null,'1'.repeat(21)])
  assert.equal(nativeApprovalAttachmentUrl(id),null);
 assert.equal(nativeApprovalAttachmentUrl('18',{origin:'http://evil.example'}),null);
 assert.equal(nativeApprovalAttachmentUrl('18',{origin:'https://testgifts.local'}),null);
});

test('GET: succeeds only with valid signed original PDF and PSD bytes',async()=>{
 const visits=[];
 const getter=async(url,opt)=>{
  visits.push({url,method:opt.method,credentials:opt.credentials,
   redirect:opt.redirect});
  return response(url.endsWith('id=2')?psd:pdf);
 };
 const one=await readNativeApprovalAttachment(attachment('1','оригинал.pdf'),{
  origin:'http://testgifts.local',fetcher:getter});
 const two=await readNativeApprovalAttachment(attachment('2','макет.psd'),{
  origin:'http://testgifts.local',fetcher:getter});
 assert.equal(one.status,'LOCAL_ATTACHMENT_BYTES_ONLY');
 assert.equal(one.signature_status,'KNOWN_SIGNATURE');
 assert.equal(one.size,pdf.length);
 assert.equal(two.status,'LOCAL_ATTACHMENT_BYTES_ONLY');
 assert.equal(two.signature_status,'KNOWN_SIGNATURE');
 assert.deepEqual(visits,[{
  url:urlOf('1'),method:'GET',credentials:'same-origin',redirect:'error'},
  {url:urlOf('2'),method:'GET',credentials:'same-origin',redirect:'error'}
 ]);
 assert.equal(one.training_ready,false);
});

test('fail closed on unrelated origin, HTML login, spoofed PDF, redirects, size',async()=>{
 let calls=0;
 const getter=async()=>{
  calls++;return response(pdf,'application/pdf');
 };
 const invalid=await readNativeApprovalAttachment(
  attachment('14','file.pdf'),{origin:'http://psk.testgifts.local',fetcher:getter});
 assert.equal(invalid.status,'MANUAL_UNSAFE_ATTACHMENT_METADATA');
 const traversal=await readNativeApprovalAttachment(
  attachment('14','../file.pdf'),{origin:'http://testgifts.local',fetcher:getter});
 assert.equal(traversal.status,'MANUAL_UNSAFE_ATTACHMENT_METADATA');
 const codefile=await readNativeApprovalAttachment(
  attachment('14','file.exe'),{origin:'http://testgifts.local',fetcher:getter});
 assert.equal(codefile.status,'MANUAL_UNSAFE_ATTACHMENT_METADATA');
 assert.equal(calls,0);
 const badHtml=await readNativeApprovalAttachment(
  attachment('14','file.pdf'),{origin:'http://testgifts.local',fetcher:async()=>
    response(new TextEncoder().encode('<html>denied</html>'),'application/pdf')});
 assert.equal(badHtml.status,'MANUAL_ATTACHMENT_HTML_OR_AUTH_RESPONSE');
 const wrong=await readNativeApprovalAttachment(
  attachment('14','file.pdf'),{origin:'http://testgifts.local',fetcher:async()=>
    response(psd)});
 assert.equal(wrong.status,'MANUAL_ATTACHMENT_FORMAT_MISMATCH');
 const oversize=await readNativeApprovalAttachment(
  attachment('14','file.pdf'),{origin:'http://testgifts.local',fetcher:async()=>
    new Response(null,{status:200,headers:{'content-length':'16000001'}})});
 assert.equal(oversize.status,'MANUAL_ATTACHMENT_TOO_LARGE');
 const redirect=await readNativeApprovalAttachment(
  attachment('14','file.pdf'),{origin:'http://testgifts.local',fetcher:async()=>{
    const r=response(pdf);Object.defineProperty(r,'url',{value:'http://evil.example/path'});
    return r;
  }});
 assert.equal(redirect.status,'MANUAL_REDIRECT_OR_PATH_CHANGED');
 const changed=await readNativeApprovalAttachment(
  attachment('14','file.pdf'),{origin:'http://testgifts.local',
   fetcher:async()=>new Response(pdf,{status:403})});
 assert.equal(changed.status,'MANUAL_HTTP_ERROR');
 assert.equal(changed.http_status,403);
});

test('signature checks reject executable, malformed and mistaken files',()=>{
 assert.equal(nativeAttachmentSignature(pdf,'pdf'),'KNOWN_SIGNATURE');
 assert.equal(nativeAttachmentSignature(psd,'psd'),'KNOWN_SIGNATURE');
 assert.equal(nativeAttachmentSignature(pdf,'psd'),'FORMAT_MISMATCH');
 assert.equal(nativeAttachmentSignature(
  new TextEncoder().encode('<!doctype html><html>login'), 'pdf'),
  'HTML_OR_AUTH_RESPONSE');
 assert.equal(nativeAttachmentSignature(
  Uint8Array.from([77,90,0,0,0,0,0,0,0,0]),'cdr'),
  'EXECUTABLE_MISMATCH');
});

test('local-only ZIP with source-message mapping, failures and no training approval',async()=>{
 const report={schema:'printcheck.vision.private-approval-collection.v1',
  order_number:'8001555',articles:[
   {status:'PRIVATE_REVIEW_ONLY',item_id:'12',history:[
    {sequence:1,attachments:[attachment('1','original.pdf'),
      attachment('2','original.psd'),attachment('3','bogus.exe')]}
   ]},
   {status:'PRIVATE_HISTORY_UNVERIFIED',item_id:'13',
    history:[{sequence:1,attachments:[attachment('4','unreviewed.pdf')]}]}
  ]};
 const visited=[];
 const read=async(url,opt)=>{
  visited.push({url,method:opt.method});
  return response(url.endsWith('id=2')?psd:pdf);
 };
 const parts=[];
 for await(const part of exportNativeApprovalAttachmentParts(report,{
  origin:'http://testgifts.local',fetcher:read
 }))parts.push(part);
 assert.equal(parts.length,1);
 assert.equal(parts[0].status,'PRIVATE_LOCAL_ZIP_READY');
 assert.equal(parts[0].files,2);
 assert.equal(parts[0].manifest.training_ready,false);
 assert.equal(parts[0].manifest.items.length,2);
 assert.equal(parts[0].manifest.items[0].entry,'attachments/0001/0001.pdf');
 assert.equal(parts[0].manifest.items[1].entry,'attachments/0001/0002.psd');
 assert.equal(parts[0].manifest.items[0].comment_sequence,1);
 assert.equal(parts[0].manifest.items[0].order_item_id,'12');
 assert.equal(parts[0].manifest.skipped[0].reason,
  'MANUAL_UNSAFE_ATTACHMENT_METADATA');
 assert.equal(report.articles[0].history[0].attachments[0].local_get_status,
  'LOCAL_ATTACHMENT_BYTES_ONLY');
 assert.equal(report.articles[0].history[0].attachments[2].local_get_status,
  'MANUAL_UNSAFE_ATTACHMENT_METADATA');
 assert.deepEqual(visited.map(v=>v.url),[urlOf('1'),urlOf('2')]);
 assert.equal(visited.every(v=>v.method==='GET'),true);
 const bytes=new Uint8Array(await parts[0].zip.arrayBuffer());
 assert.equal(String.fromCharCode(...bytes.subarray(0,2)),'PK');
 // The archive is PRIVATE, so filenames/IDs may occur only within it.
 assert.ok(Buffer.from(bytes).includes(Buffer.from('original.psd')));
 assert.equal(report.training_ready,undefined);
});
