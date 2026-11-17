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
