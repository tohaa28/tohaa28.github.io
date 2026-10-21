import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const PDFLib=require('../vendor/pdf-lib.min.js');
const sandbox={window:{},TextEncoder,TextDecoder};
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
 await api.stamp(base,entries,PDFLib,()=>{throw Error('already a PDF')},
   {order:'8006776',article:'77700.60',itemId:'49428451'});
 return {saved:await base.save(),bytes,entries};
}
test('stamps a producer and separate source attachment, without modifying constructor contents',async()=>{
 const {saved}=await fixture();
 const doc=await PDFLib.PDFDocument.load(saved,{updateMetadata:false});
 assert.match(doc.getProducer(),/gwb-maketnaya-layout-v1/);
 assert.equal(doc.getPageCount(),1);
 assert.ok(doc.catalog.lookup(PDFLib.PDFName.of('Names')),'PDF Names dictionary has source attachments');
});
test('selects exactly one PDF source for the designated imprint field',async()=>{
 const {bytes}=await fixture();
 const attachments={
   'gwb-maketnaya-source.json':{content:new TextEncoder().encode(JSON.stringify({
     marker:api.marker,version:1,order:'8006776',article:'77700.60',
     placements:[{art:'gwb-art-001.pdf',fieldIndex:1,page:0,field,placement}]
   }))},
   'gwb-art-001.pdf':{content:bytes}
 };
 const got=api.inspectAttachments(attachments,{order:'8006776',article:'77700.60',
   fieldIndex:1,page:0});
 assert.equal(got.kind,'maketnaya');
 assert.equal(got.bytes.length,bytes.length);
 assert.equal(got.placement.x,placement.x);
 assert.equal(api.inspectAttachments(attachments,{order:'8006776',article:'77700.60',
   fieldIndex:0,page:0}).kind,'invalid');
 assert.equal(api.inspectAttachments(attachments,{order:'9999999',article:'77700.60',
   fieldIndex:1,page:0}).kind,'invalid');
});
test('no manifest never imports a complete outside layout as logo',()=>{
 assert.equal(api.inspectAttachments(null,{order:'8006776'}).kind,'external');
 assert.equal(api.inspectAttachments({'gwb-maketnaya-source.json':{
   content:new TextEncoder().encode('{broken')
 }}).kind,'invalid');
});
