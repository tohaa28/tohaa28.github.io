/**
 * PrintCheck Vision C3B.3.I -- strict PNG byte decoder for local provenance.
 *
 * Deliberately restricted to non-interlaced 8-bit grayscale/GA/RGB/RGBA PNG
 * WITHOUT palette, tRNS, APNG or color-management metadata. Unsupported
 * pictures are MANUAL, not silently converted. No network or dependency.
 *
 * PNG Third Edition: https://www.w3.org/TR/png-3/
 * zlib.inflateSync maxOutputLength protects the decompressed scanline budget.
 */
import {inflateSync} from 'node:zlib';

const MAGIC=Buffer.from([137,80,78,71,13,10,26,10]);
const MAX_SOURCE=25_000_000,MAX_PIXELS=12_000_000;
const CRC_TABLE=new Uint32Array(256);
for(let n=0;n<256;n++){
  let c=n;
  for(let k=0;k<8;k++)c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1);
  CRC_TABLE[n]=c>>>0;
}
export function pngCrc32(bytes){
  let crc=0xffffffff;
  for(let i=0;i<bytes.length;i++)
    crc=CRC_TABLE[(crc^bytes[i])&255]^(crc>>>8);
  return (crc^0xffffffff)>>>0;
}
const bad=reason=>({status:'MANUAL',reason});
const validType=t=>/^[A-Za-z]{4}$/.test(t);
const paeth=(a,b,c)=>{
  const p=a+b-c,da=Math.abs(p-a),db=Math.abs(p-b),dc=Math.abs(p-c);
  return da<=db&&da<=dc?a:db<=dc?b:c;
};
export function decodeTrustedPngBytes(input){
  if(!(Buffer.isBuffer(input)||input instanceof Uint8Array))
    return bad('PNG_BYTES_REQUIRED');
  const bytes=Buffer.from(input.buffer,input.byteOffset,input.byteLength);
  if(bytes.length<57||bytes.length>MAX_SOURCE||
     !bytes.subarray(0,8).equals(MAGIC))
    return bad('PNG_HEADER_OR_LENGTH_UNSUPPORTED');
  let pos=8,ihdr=false,hadIDAT=false,endedIDAT=false,iend=false;
  let width=0,height=0,channels=0,rowBytes=0;
  const idats=[];
  let compressed=0;
  while(pos<bytes.length){
    if(pos+12>bytes.length)return bad('PNG_TRUNCATED_CHUNK');
    const len=bytes.readUInt32BE(pos);
    if(len>MAX_SOURCE||pos+len+12>bytes.length)
      return bad('PNG_CHUNK_LENGTH_INVALID');
    const type=bytes.toString('ascii',pos+4,pos+8);
    if(!validType(type))return bad('PNG_CHUNK_TYPE_INVALID');
    const actual=pngCrc32(bytes.subarray(pos+4,pos+8+len));
    const recorded=bytes.readUInt32BE(pos+8+len);
    if(actual!==recorded)return bad('PNG_CRC_MISMATCH');
    const chunk=bytes.subarray(pos+8,pos+8+len);
    pos+=12+len;
    if(!ihdr&&type!=='IHDR')return bad('PNG_IHDR_NOT_FIRST');
    if(type==='IHDR'){
      if(ihdr||len!==13)return bad('PNG_IHDR_DUPLICATE_OR_LENGTH');
      width=chunk.readUInt32BE(0);
      height=chunk.readUInt32BE(4);
      const depth=chunk[8],colour=chunk[9];
      if(!Number.isSafeInteger(width*height)||width<8||height<8||
         width*height>MAX_PIXELS)
        return bad('PNG_DIMENSIONS_UNSUPPORTED');
      if(depth!==8||![0,2,4,6].includes(colour)||
         chunk[10]!==0||chunk[11]!==0||chunk[12]!==0)
        return bad('PNG_COLOR_OR_INTERLACE_UNSUPPORTED');
      channels=colour===0?1:colour===2?3:colour===4?2:4;
      rowBytes=width*channels;
      ihdr=true;
    }else if(type==='IDAT'){
      if(endedIDAT)return bad('PNG_NONCONTIGUOUS_IDAT');
      hadIDAT=true;compressed+=chunk.length;
      if(compressed>MAX_SOURCE)return bad('PNG_COMPRESSED_BUDGET_EXCEEDED');
      idats.push(chunk);
    }else if(type==='IEND'){
      if(len!==0||!hadIDAT||pos!==bytes.length)
        return bad('PNG_END_INVALID');
      iend=true;
      break;
    }else{
      if(hadIDAT)endedIDAT=true;
      // Any unknown critical chunk, palette, transparency or colour profile
      // may change the interpretation of pixel values. Fail closed.
      if(type[0]===type[0].toUpperCase()||
         ['tRNS','gAMA','sRGB','iCCP','cICP','cHRM','sBIT',
          'acTL','fcTL','fdAT','eXIf'].includes(type))
        return bad('PNG_UNSUPPORTED_CHUNK');
      // Other ancillary metadata is ignored. It cannot alter our strict
      // 8-bit non-colour-managed pixel reconstruction.
    }
  }
  if(!iend||!hadIDAT||!ihdr)return bad('PNG_REQUIRED_CHUNKS_MISSING');
  const expected=(rowBytes+1)*height;
  if(expected>MAX_PIXELS*4+MAX_PIXELS)
    return bad('PNG_INFLATE_BUDGET_EXCEEDED');
  let compressedScanlines;
  try{
    compressedScanlines=inflateSync(Buffer.concat(idats),{
      maxOutputLength:expected
    });
  }catch{return bad('PNG_INFLATE_FAILED_OR_TOO_LARGE')}
  if(compressedScanlines.length!==expected)
    return bad('PNG_INFLATED_LENGTH_MISMATCH');
  const rgba=new Uint8Array(width*height*4);
  const previous=new Uint8Array(rowBytes),current=new Uint8Array(rowBytes);
  for(let y=0;y<height;y++){
    const start=y*(rowBytes+1),filter=compressedScanlines[start];
    if(filter>4)return bad('PNG_FILTER_UNSUPPORTED');
    for(let x=0;x<rowBytes;x++){
      const a=x>=channels?current[x-channels]:0;
      const b=previous[x];
      const c=x>=channels?previous[x-channels]:0;
      const diff=filter===0?0:filter===1?a:filter===2?b:
        filter===3?Math.floor((a+b)/2):paeth(a,b,c);
      current[x]=(compressedScanlines[start+1+x]+diff)&255;
    }
    for(let x=0;x<width;x++){
      const src=x*channels,dst=(y*width+x)*4;
      if(channels===1||channels===2){
        rgba[dst]=rgba[dst+1]=rgba[dst+2]=current[src];
        rgba[dst+3]=channels===2?current[src+1]:255;
      }else{
        rgba[dst]=current[src];
        rgba[dst+1]=current[src+1];
        rgba[dst+2]=current[src+2];
        rgba[dst+3]=channels===4?current[src+3]:255;
      }
    }
    previous.set(current);
  }
  return {
    schema:'printcheck.vision.decoded-png.v1',
    status:'DECODED_STRICT_PNG_ONLY',
    width,height,data:rgba,
    decoder_scope:'8bit_noninterlaced_no_profiles',
    production_approved:false
  };
}
