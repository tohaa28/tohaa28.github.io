import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {webcrypto} from 'node:crypto';
const require=createRequire(import.meta.url);
const PDFLib=require('../vendor/pdf-lib.min.js');
const sandbox={window:{crypto:webcrypto},TextEncoder,TextDecoder,
  CompressionStream,DecompressionStream,Blob,Response};
vm.runInNewContext(fs.readFileSync('assets/maketnaya-pdf-provenance.js','utf8'),sandbox);
const api=sandbox.window.gwbMaketnayaPdfProvenance;
const field={x:10,y:20,w:80,h:40};
const placement={x:22,y:25,w:30,h:20,rotation:15};
async function fixture(){
 const base=await PDFLib.PDFDocument.create();
 base.addPage([400,200]).drawText('CONSTRUCTOR - NEVER IMPORT');
 const art=await PDFLib.PDFDocument.create();
 art.addPage([100,60]).drawRectangle({x:0,y:0,width:100,height:60,color:PDFLib.cmyk(.8,.3,.2,.1)});
 const bytes=await art.save();
 const entries=[{art:{pdfCompatible:true,ext:'pdf',name:'imprint.pdf',bytes},
   field,placement,page:0,fieldIndex:1}];
 const attachments={};
 const origAttach=base.attach.bind(base);
 base.attach=async(buffer,name,opts)=>{
   attachments[name]={content:new Uint8Array(buffer),opts};
   return origAttach(new Uint8Array(buffer),name,opts);
 };
 await api.stamp(base,entries,PDFLib,()=>{throw Error('already PDF')},
   {order:'8006776',article:'77700.60',itemId:'49428451'});
 return {saved:await base.save(),bytes,entries,attachments};
}
test('new PDF keeps origin metadata binary and portable without plaintext maker or order identity',async()=>{
 const {saved,attachments}=await fixture();
 const doc=await PDFLib.PDFDocument.load(saved,{updateMetadata:false});
 assert.equal(doc.getPageCount(),1);
 assert.ok(doc.catalog.lookup(PDFLib.PDFName.of('Names')),'PDF embeds portable source attachments');
 const raw=new TextDecoder('latin1').decode(saved);
 for(const phrase of ['gwb-maketnaya-layout-v1','gwb-maketnaya-source.json',
   '"order":"8006776"','Editable original logo only']){
   assert.ok(!raw.includes(phrase),'No plaintext identity in PDF: '+phrase);
 }
 assert.ok(attachments['e0002.dat'],'Portable binary envelope exists');
 assert.ok(attachments['e0002.dat'].content[0]===0x1f &&
   attachments['e0002.dat'].content[1]===0x8b,'Metadata is GZIP binary');
 assert.ok(attachments['e0002.dat'].content.length<128*1024);
 assert.equal((await api.identifyAttachments(attachments)).kind,'maketnaya');
});
test('any independent Maketnaya can recognize source and extract ONLY logo PDF for matched field',async()=>{
 const {bytes,attachments}=await fixture();
 const got=await api.inspectAttachments(attachments,
   {order:'8006776',article:'77700.60',fieldIndex:1,page:0});
 assert.equal(got.kind,'maketnaya');
 assert.equal(got.format,2);
 assert.equal(got.bytes.length,bytes.length);
 assert.deepEqual([...got.bytes], [...bytes]);
 assert.equal(got.placement.x,placement.x);
 assert.equal(got.placement.rotation,15);
 assert.equal((await api.inspectAttachments(attachments,
   {order:'8006776',article:'77700.60',fieldIndex:0,page:0})).kind,'invalid');
 assert.equal((await api.inspectAttachments(attachments,
   {order:'9999999',article:'77700.60',fieldIndex:1,page:0})).kind,'invalid');
});
test('binary capsule rejects altered source artwork (integrity bound to its PDF)',async()=>{
 const {attachments}=await fixture();
 const altered={...attachments,'e0001.bin':{
   content:new Uint8Array(attachments['e0001.bin'].content)
 }};
 altered['e0001.bin'].content[10]^=1;
 assert.equal((await api.identifyAttachments(altered)).kind,'invalid');
 assert.equal((await api.inspectAttachments(altered,{order:'8006776',fieldIndex:1,page:0})).kind,'invalid');
});
test('old transparent PDF capsule is readable for backward compatibility; unknown remains external',async()=>{
 const {bytes}=await fixture();
 const legacy={
   'gwb-maketnaya-source.json':{content:new TextEncoder().encode(JSON.stringify({
      marker:api.marker,version:1,order:'8006776',article:'77700.60',
      placements:[{art:'gwb-art-001.pdf',fieldIndex:1,page:0,field,placement}]
   }))},
   'gwb-art-001.pdf':{content:bytes}
 };
 assert.equal((await api.identifyAttachments(legacy)).kind,'maketnaya');
 assert.equal((await api.inspectAttachments(legacy,
   {order:'8006776',article:'77700.60',fieldIndex:1,page:0})).kind,'maketnaya');
 assert.equal((await api.identifyAttachments(null)).kind,'external');
 assert.equal((await api.inspectAttachments({'gwb-maketnaya-source.json':{
   content:new TextEncoder().encode('{broken')
 }})).kind,'invalid');
});
