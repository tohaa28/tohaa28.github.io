import test from 'node:test';
import assert from 'node:assert/strict';
import {makeLocalStoredZip,makeLocalExpertDataset}
  from '../vision/orders/local-training-zip.mjs';
const loc=new URL('http://psk.testgifts.local/devorders?status=140');
const link=href=>({getAttribute(name){return name==='href'?href:null}});
const rows=[{row_index:1,grade:{value:'confirmed_defect'},files:[link('/file/a.pdf')]}];

test('generated ZIP is a valid bounded store archive with local + central directory',async()=>{
 const file=new TextEncoder().encode('%PDF-1.4\nVALID SYNTHETIC');
 const manifest=new TextEncoder().encode('{"training_ready":false}\n');
 const b=Buffer.from(await makeLocalStoredZip([
   {name:'manifest.json',bytes:manifest},
   {name:'samples/0001.pdf',bytes:file}
 ]).arrayBuffer());
 assert.equal(b.readUInt32LE(0),0x04034b50);
 assert.equal(b.readUInt32LE(b.length-22),0x06054b50);
 assert.equal(b.readUInt16LE(b.length-22+10),2);
 const centralOffset=b.readUInt32LE(b.length-22+16);
 assert.equal(b.readUInt32LE(centralOffset),0x02014b50);
 assert.ok(b.includes(Buffer.from('{"training_ready":false}')));
 assert.ok(b.includes(Buffer.from('%PDF-1.4')));
 assert.throws(()=>makeLocalStoredZip([
   {name:'../evil.zip',bytes:new Uint8Array(5)}
 ]),/LOCAL_ZIP_ENTRY_INVALID/);
});
test('local ZIP requires a user-supplied expert label, not automatically inferred defects',async()=>{
 let calls=0;
 const output=await makeLocalExpertDataset([
   {...rows[0],grade:{value:'unreviewed'}}
 ],{loc,fetcher:async()=>{calls++;throw Error('must not fetch')}});
 assert.equal(output.status,'MANUAL');
 assert.equal(output.reason,'EXPERT_LABELS_REQUIRED');
 assert.equal(calls,0);
});
test('explicit expert ZIP fetches same-origin originals and marks manifest not train-ready',async()=>{
 let calls=0;
 const result=await makeLocalExpertDataset(rows,{loc,
   fetcher:async (url,args)=>{
     calls++;
     assert.equal(url,'http://psk.testgifts.local/file/a.pdf');
     assert.equal(args.credentials,'same-origin');
     assert.equal(args.redirect,'error');
     assert.equal(args.method,'GET');
     return new Response('%PDF-1.4\n'+('x'.repeat(100)),
       {headers:{'Content-Type':'application/pdf'}});
   }
 });
 assert.equal(calls,1);
 assert.equal(result.status,'LOCAL_ZIP_READY');
 assert.equal(result.sample_count,1);
 assert.equal(result.manifest.training_ready,false);
 assert.equal(result.manifest.public_upload_permitted,false);
 assert.equal(result.manifest.roi_annotations_verified,false);
 assert.equal(result.manifest.source_urls_included,false);
 assert.equal(result.manifest.source_order_ids_included,false);
 assert.equal(result.manifest.samples[0].expert_label,'confirmed_defect');
 assert.equal(result.manifest.samples[0].sample_name,'samples/0001.pdf');
 assert.ok(result.zip.size>100);
});
test('cross-origin artifacts cannot enter training zip even when expert labeled row',async()=>{
 let called=0;
 const result=await makeLocalExpertDataset([
   {...rows[0],files:[link('http://testgifts.local/other.pdf')]}
 ],{loc,fetcher:async()=>{called++;throw Error('must not fetch')}});
 assert.equal(result.status,'MANUAL');
 assert.equal(result.reason,'NO_EXPORTABLE_LABELED_ARTWORK');
 assert.equal(called,0);
});
