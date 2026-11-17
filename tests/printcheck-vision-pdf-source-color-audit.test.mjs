import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectPdfSourceColors} from '../vision/raster/pdf-source-color-audit.mjs';
import {makeSyntheticBlackPdf} from './helpers/synthetic-simple-pdf.mjs';
test('raw PDF DeviceRGB stays a non-authoritative diagnostic',()=>{
  const a=inspectPdfSourceColors(makeSyntheticBlackPdf());
  assert.equal(a.status,'SOURCE_COLOR_DIAGNOSTIC_ONLY',a.reason);
  assert.deepEqual(a.source_spaces,['DeviceRGB']);
  assert.equal(a.requires_manual,false);
  assert.equal(a.production_approved,false);
  assert.equal(a.source_structure_verified,false);
});
test('raw CMYK operator is detected even when PDF.js would output RGB',()=>{
  const a=inspectPdfSourceColors(makeSyntheticBlackPdf({paint:'0 0 0 1 k'}));
  assert.equal(a.status,'SOURCE_COLOR_DIAGNOSTIC_ONLY',a.reason);
  assert.deepEqual(a.source_spaces,['DeviceCMYK']);
  assert.equal(a.requires_manual,true);
  assert.equal(a.icc_proven,false);
});
test('nonstroking gray and named color space never become approved RGB',()=>{
  const gray=inspectPdfSourceColors(makeSyntheticBlackPdf({paint:'0 g'}));
  assert.deepEqual(gray.source_spaces,['DeviceGray']);
  assert.equal(gray.requires_manual,true);
  const spot=inspectPdfSourceColors(makeSyntheticBlackPdf({
    paint:'/PANTONE#20500 cs\n1 scn'
  }));
  assert.equal(spot.status,'SOURCE_COLOR_DIAGNOSTIC_ONLY',spot.reason);
  assert.ok(spot.source_spaces.includes('NamedColorSpace'));
  assert.equal(spot.requires_manual,true);
});
test('PDF comments cannot inject phantom CMYK paint',()=>{
  const a=inspectPdfSourceColors(makeSyntheticBlackPdf({
    paint:'% fake: 0 0 0 1 k\n0 0 0 rg'
  }));
  assert.deepEqual(a.source_spaces,['DeviceRGB']);
  assert.equal(a.requires_manual,false);
});
test('unsupported PDF tokens, strings, extra operators and compressed streams abstain',()=>{
  for(const paint of ['(abc) Tj','0 0 0 1 k\n(hello) Tj',
    '0 0 0 rg\n0 0 0 foo','0 0 0 rg\n[1 2] scn']){
    assert.equal(inspectPdfSourceColors(makeSyntheticBlackPdf({paint})).status,
      'MANUAL',paint);
  }
  const pdf=makeSyntheticBlackPdf().toString('latin1').replace(
    '/Resources << >>','/Resources << /Filter /FlateDecode >>');
  assert.equal(inspectPdfSourceColors(Buffer.from(pdf,'latin1')).status,'MANUAL');
});
test('unsupported bytes and missing paint abstain',()=>{
  assert.equal(inspectPdfSourceColors(Buffer.from('%PDF-1.4')).status,'MANUAL');
  const b=Buffer.from(makeSyntheticBlackPdf());
  b[80]=0;
  assert.equal(inspectPdfSourceColors(b).status,'MANUAL');
  const noPaint=makeSyntheticBlackPdf().toString('latin1').replace('re\nf\n','re\nn\n');
  assert.equal(inspectPdfSourceColors(Buffer.from(noPaint,'latin1')).status,'MANUAL');
});
