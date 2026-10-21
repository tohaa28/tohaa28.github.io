import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {inspectArtwork} from '../assets/logo-preflight.mjs';
const lib=createRequire(import.meta.url)('../vendor/pdf-lib.min.js');
globalThis.PDFLib=lib;
async function evidence(streams,{form,unusedImage=false}={}) {
  const pdf=await lib.PDFDocument.create(),page=pdf.addPage([100,100]);
  const resources=pdf.context.obj({});
  page.node.set(lib.PDFName.of('Resources'),resources);
  if(form){
    const x=pdf.context.register(pdf.context.flateStream(form,{Type:'XObject',Subtype:'Form',BBox:[0,0,100,100]}));
    resources.set(lib.PDFName.of('XObject'),pdf.context.obj({Art:x}));
  }
  if(unusedImage){
    const x=pdf.context.register(pdf.context.stream(new Uint8Array([255,0,0]),{Type:'XObject',Subtype:'Image',Width:1,Height:1,ColorSpace:'DeviceRGB',BitsPerComponent:8}));
    resources.set(lib.PDFName.of('XObject'),pdf.context.obj({Unused:x}));
  }
  page.node.set(lib.PDFName.of('Contents'),pdf.context.obj(streams.map(s=>pdf.context.register(pdf.context.flateStream(s)))));
  const bytes=await pdf.save({useObjectStreams:false});
  const facts=await inspectArtwork({ext:'pdf',bytes,w:35.28,h:35.28,pdfPage:{getOperatorList:async()=>({fnArray:[],argsArray:[]})}},{});
  assert.ok(!facts.limitations.some(s=>s.startsWith('Неполный анализ')),JSON.stringify(facts.limitations));
  return facts.originalColorModels;
}
test('PDF content array preserves RGB state across streams',async()=>{
  assert.deepEqual(await evidence(['1 0 0 rg','0 0 10 10 re f']),['RGB']);
});
test('PDF content array preserves q/Q state and ignores unused RGB resources',async()=>{
  assert.deepEqual(await evidence(['0 1 0 0 k q 1 0 0 rg','Q 0 0 10 10 re f'],{unusedImage:true}),['CMYK']);
});
test('Form XObject inherits the color at each invocation without leaking its changes',async()=>{
  assert.deepEqual(await evidence(['1 0 0 rg /Art Do 0 1 0 0 k /Art Do'],{form:'0 0 10 10 re f'}),['RGB','CMYK']);
  assert.deepEqual(await evidence(['0 1 0 0 k /Art Do 0 0 10 10 re f'],{form:'1 0 0 rg 0 0 10 10 re f'}),['RGB','CMYK']);
});
test('Do text inside comments or strings cannot activate an unused RGB image',async()=>{
  assert.deepEqual(await evidence(['% /Unused Do\n(/Unused Do) Tj 0 1 0 0 k 0 0 10 10 re f'],{unusedImage:true}),['Gray','CMYK']);
});
