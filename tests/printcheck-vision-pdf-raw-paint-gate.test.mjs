import test from 'node:test';
import assert from 'node:assert/strict';
import {makeSyntheticBlackPdf} from './helpers/synthetic-simple-pdf.mjs';
import {checkReplayPdfRgbSubset} from '../vision/raster/replay-engines.mjs';

test('only a single explicit opaque DeviceRGB uncompressed rectangle is accepted',()=>{
  const r=checkReplayPdfRgbSubset(makeSyntheticBlackPdf());
  assert.equal(r.status,'PDF_SINGLE_UNCOMPRESSED_RGB_RECTANGLE_ONLY',r.reason);
});
test('CMYK black looking identical to RGB black cannot pass upstream paint gate',()=>{
  const r=checkReplayPdfRgbSubset(
    makeSyntheticBlackPdf({paint:'0 0 0 1 k'}));
  assert.equal(r.status,'MANUAL');
  assert.equal(r.reason,'PDF_PAINT_NOT_EXPLICIT_SINGLE_RGB_RECTANGLE');
});
test('spot, compressed streams, images, ICC, fonts and transparency refuse',()=>{
  for(const key of ['DeviceCMYK','DeviceN','Separation','ICCBased',
    'Filter','XObject','SMask','Font','ExtGState','Encrypt']){
    const original=makeSyntheticBlackPdf().toString('latin1');
    const changed=Buffer.from(original.replace(
      '/Resources << >>','/Resources << /'+key+' 99 >>'));
    const r=checkReplayPdfRgbSubset(changed);
    assert.equal(r.status,'MANUAL',key);
    assert.equal(r.reason,'PDF_UNSUPPORTED_COLOR_OR_OBJECT',key);
  }
});
test('extra paint operation is not silently folded into approved RGB rectangle',()=>{
  const source=makeSyntheticBlackPdf();
  const text=source.toString('latin1').replace(
    '0 0 0 rg\n0 0 72 36 re\nf\n',
    '0 0 0 rg\n0 0 72 36 re\nf\n1 0 0 rg\n');
  const x=checkReplayPdfRgbSubset(Buffer.from(text));
  assert.equal(x.status,'MANUAL');
});
test('damaged/absent raw PDF and binary content are never classified as safe RGB',()=>{
  assert.equal(checkReplayPdfRgbSubset(Buffer.from('%PDF-1.7')).status,'MANUAL');
  const pdf=Buffer.from(makeSyntheticBlackPdf());
  pdf[20]=0;
  assert.equal(checkReplayPdfRgbSubset(pdf).status,'MANUAL');
});

test('C3B.3.L1: hex-escaped PDF resource and color-space names cannot bypass raw denylist',()=>{
  const original=makeSyntheticBlackPdf().toString('latin1');
  for(const masked of [
    '/Color#53pace << /C0 /DeviceCM#59K >>',
    '/ExtG#53tate << /G0 9 0 R >>',
    '/ICCB#61sed 99 0 R'
  ]){
    const text=original.replace('/Resources << >>',
      '/Resources << '+masked+' >>');
    const out=checkReplayPdfRgbSubset(Buffer.from(text,'latin1'));
    assert.equal(out.status,'MANUAL',masked);
    assert.equal(out.reason,'PDF_HEX_ESCAPED_NAMES_UNSUPPORTED',masked);
  }
});
test('C3B.3.L1: alternate xref revisions and an appended second EOF are manual',()=>{
  const original=makeSyntheticBlackPdf().toString('latin1');
  for(const changed of [
    original.replace('startxref\n','startxref\nstartxref\n'),
    original+'\n%%EOF\n',
    original.replace('xref\n0 5\n','xref\n0 5\nxref\n')
  ]){
    const out=checkReplayPdfRgbSubset(Buffer.from(changed,'latin1'));
    assert.equal(out.status,'MANUAL');
  }
});
test('C3B.3.L1: incorrect stream length and unexpected page resources refuse',()=>{
  const original=makeSyntheticBlackPdf().toString('latin1');
  const withBadLength=original.replace(/\/Length\s+(\d+)/,(_,x)=>
    '/Length '+(Number(x)+1));
  const withResources=original.replace('/Resources << >>',
    '/Resources << /ProcSet [/PDF] >>');
  assert.equal(checkReplayPdfRgbSubset(
    Buffer.from(withBadLength,'latin1')).reason,
    'PDF_STREAM_LENGTH_MISMATCH');
  assert.equal(checkReplayPdfRgbSubset(
    Buffer.from(withResources,'latin1')).reason,
    'PDF_PAGE_STRUCTURE_UNSUPPORTED');
});
