import test from 'node:test';
import assert from 'node:assert/strict';
import {deflateSync} from 'node:zlib';
import {decodeTrustedPngBytes,pngCrc32} from '../vision/dataset/strict-png-decoder.mjs';
import {makeSyntheticPng,pngChunk,syntheticT,syntheticO}
  from './helpers/synthetic-png.mjs';

const PNG_SIGNATURE=Buffer.from([137,80,78,71,13,10,26,10]);
const ihdrFrom=bytes=>Buffer.from(bytes.subarray(16,29));
const manual=(bytes)=>decodeTrustedPngBytes(bytes).status==='MANUAL';

test('all five W3C PNG byte filters reconstruct exactly the same opaque RGBA pixels',()=>{
  const ref=decodeTrustedPngBytes(
    makeSyntheticPng(128,80,syntheticT,{channels:4,filter:0})
  );
  assert.equal(ref.status,'DECODED_STRICT_PNG_ONLY');
  assert.equal(ref.width,128);assert.equal(ref.height,80);
  assert.equal(ref.data.length,128*80*4);
  for(let filter=0;filter<=4;filter++){
    const scan=decodeTrustedPngBytes(
      makeSyntheticPng(128,80,syntheticT,{channels:4,filter})
    );
    assert.equal(scan.status,'DECODED_STRICT_PNG_ONLY',scan.reason);
    assert.deepEqual(scan.data,ref.data,'filter '+filter);
  }
});
test('RGB, grayscale and grayscale+alpha map to canonical RGBA bytes',()=>{
  const base=decodeTrustedPngBytes(
    makeSyntheticPng(80,64,syntheticO,{channels:4}));
  for(const channels of [1,2,3,4]){
    const result=decodeTrustedPngBytes(
      makeSyntheticPng(80,64,syntheticO,{channels,filter:3}));
    assert.equal(result.status,'DECODED_STRICT_PNG_ONLY',result.reason);
    assert.deepEqual(result.data,base.data,'channels '+channels);
  }
});
test('consecutive split IDAT chunks are reconstructed without data loss',()=>{
  const single=makeSyntheticPng(100,80,syntheticT);
  const split=makeSyntheticPng(100,80,syntheticT,{chunkSplit:7});
  assert.deepEqual(decodeTrustedPngBytes(split).data,
    decodeTrustedPngBytes(single).data);
});
test('corrupt CRC or truncated critical chunks are always rejected',()=>{
  const png=makeSyntheticPng(64,64,syntheticT);
  const corrupted=Buffer.from(png);
  corrupted[corrupted.length-16]^=1;
  assert.equal(manual(corrupted),true);
  const broken=png.subarray(0,png.length-6);
  assert.equal(manual(broken),true);
  assert.equal(manual(Buffer.from('not a png')),true);
});
test('palette, color-profile metadata, transparency and animation require manual decoding',()=>{
  const plain=makeSyntheticPng(64,64,syntheticO);
  const ihdr=plain.subarray(0,33);
  const rest=plain.subarray(33);
  for(const [name,data] of [
    ['PLTE',Buffer.from([0,0,0,255,255,255])],
    ['tRNS',Buffer.alloc(6)],
    ['iCCP',Buffer.from('profile')],
    ['gAMA',Buffer.alloc(4)],
    ['sRGB',Buffer.from([0])],
    ['cICP',Buffer.from([1,1,1,1])],
    ['acTL',Buffer.alloc(8)],
    ['eXIf',Buffer.from([1,2])]
  ]){
    const newBytes=Buffer.concat([ihdr,pngChunk(name,data),rest]);
    const result=decodeTrustedPngBytes(newBytes);
    assert.equal(result.status,'MANUAL',name);
    assert.equal(result.reason,'PNG_UNSUPPORTED_CHUNK',name);
  }
});
test('interlacing and unsupported bit depth refuse without heuristics',()=>{
  const plain=makeSyntheticPng(64,64,syntheticT);
  const ihdr=ihdrFrom(plain);
  ihdr[12]=1; // Adam7 interlace
  const changed=Buffer.concat([
    PNG_SIGNATURE,pngChunk('IHDR',ihdr),plain.subarray(33)
  ]);
  assert.equal(decodeTrustedPngBytes(changed).reason,
    'PNG_COLOR_OR_INTERLACE_UNSUPPORTED');
  const depth=ihdrFrom(plain);depth[8]=16;
  assert.equal(decodeTrustedPngBytes(Buffer.concat([
    PNG_SIGNATURE,pngChunk('IHDR',depth),plain.subarray(33)
  ])).reason,'PNG_COLOR_OR_INTERLACE_UNSUPPORTED');
});
test('oversized dimensions are rejected before zlib decompression',()=>{
  const original=makeSyntheticPng(64,64,syntheticT);
  const hdr=ihdrFrom(original);
  hdr.writeUInt32BE(10000,0);hdr.writeUInt32BE(10000,4);
  const mutated=Buffer.concat([
    PNG_SIGNATURE,pngChunk('IHDR',hdr),original.subarray(33)
  ]);
  assert.equal(decodeTrustedPngBytes(mutated).reason,
    'PNG_DIMENSIONS_UNSUPPORTED');
});
test('compressed-data bombs cannot exceed expected uncompressed scanline budget',()=>{
  const original=makeSyntheticPng(64,64,syntheticT);
  const ihdr=original.subarray(0,33);
  const bomb=deflateSync(Buffer.alloc(300000,27));
  const mutated=Buffer.concat([
    ihdr,pngChunk('IDAT',bomb),pngChunk('IEND')
  ]);
  assert.equal(decodeTrustedPngBytes(mutated).reason,
    'PNG_INFLATE_FAILED_OR_TOO_LARGE');
});
test('noncontiguous IDAT, unexpected critical chunks and trailing bytes are refused',()=>{
  const original=makeSyntheticPng(64,64,syntheticT,{chunkSplit:6});
  const first=33,firstData=original.readUInt32BE(first),second=first+12+firstData;
  const separated=Buffer.concat([
    original.subarray(0,second),pngChunk('tEXt',Buffer.from('note')),
    original.subarray(second)
  ]);
  assert.equal(decodeTrustedPngBytes(separated).reason,'PNG_NONCONTIGUOUS_IDAT');
  const extraCritical=Buffer.concat([
    original.subarray(0,33),pngChunk('ABCD'),original.subarray(33)
  ]);
  assert.equal(decodeTrustedPngBytes(extraCritical).reason,'PNG_UNSUPPORTED_CHUNK');
  assert.equal(decodeTrustedPngBytes(
    Buffer.concat([original,Buffer.from('garbage')])
  ).reason,'PNG_END_INVALID');
});
test('a valid CRC-32 test vector is reproduced without external code',()=>{
  assert.equal(pngCrc32(Buffer.from('123456789')),0xcbf43926);
});
