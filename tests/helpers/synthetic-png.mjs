/**
 * Synthetic PNG generator for tests ONLY. No customer data or external I/O.
 * Uses independent raw scanline creation and standard CRC32 from decoder.
 */
import {deflateSync} from 'node:zlib';
import {pngCrc32} from '../../vision/dataset/strict-png-decoder.mjs';
const signature=Buffer.from([137,80,78,71,13,10,26,10]);
export function pngChunk(type,data=Buffer.alloc(0)){
  const name=Buffer.from(type,'ascii'),size=Buffer.alloc(4),crc=Buffer.alloc(4);
  size.writeUInt32BE(data.length,0);
  crc.writeUInt32BE(pngCrc32(Buffer.concat([name,data])),0);
  return Buffer.concat([size,name,data,crc]);
}
const paeth=(a,b,c)=>{
  const p=a+b-c,da=Math.abs(p-a),db=Math.abs(p-b),dc=Math.abs(p-c);
  return da<=db&&da<=dc?a:db<=dc?b:c;
};
export function makeSyntheticPng(width,height,predicate,{
  channels=4,filter=0,chunkSplit=0
}={}){
  if(![1,2,3,4].includes(channels)||width<8||height<8)
    throw new Error('INVALID_SYNTHETIC_DIMENSIONS');
  const color={1:0,2:4,3:2,4:6}[channels];
  const ihdr=Buffer.alloc(13);
  ihdr.writeUInt32BE(width,0);ihdr.writeUInt32BE(height,4);
  ihdr[8]=8;ihdr[9]=color;
  const raw=Buffer.alloc((width*channels+1)*height);
  const previous=Buffer.alloc(width*channels);
  for(let y=0;y<height;y++){
    const current=Buffer.alloc(width*channels);
    for(let x=0;x<width;x++){
      const value=predicate(x/width,y/height,x,y)?0:255;
      const base=x*channels;
      current[base]=value;
      if(channels===2){current[base+1]=255;}
      if(channels===3||channels===4){
        current[base+1]=value;
        current[base+2]=value;
      }
      if(channels===4)current[base+3]=255;
    }
    const start=y*(width*channels+1);
    raw[start]=filter;
    for(let i=0;i<current.length;i++){
      const left=i>=channels?current[i-channels]:0;
      const up=previous[i];
      const aboveLeft=i>=channels?previous[i-channels]:0;
      const estimate=filter===0?0:filter===1?left:filter===2?up:
        filter===3?Math.floor((left+up)/2):
        paeth(left,up,aboveLeft);
      raw[start+1+i]=(current[i]-estimate+256)&255;
    }
    current.copy(previous);
  }
  const deflated=deflateSync(raw);
  const idat=chunkSplit>0?[
    pngChunk('IDAT',deflated.subarray(0,chunkSplit)),
    pngChunk('IDAT',deflated.subarray(chunkSplit))
  ]:[pngChunk('IDAT',deflated)];
  return Buffer.concat([
    signature,pngChunk('IHDR',ihdr),...idat,pngChunk('IEND')
  ]);
}
export const syntheticT=(x,y)=>
  (x>.45&&x<.55&&y>.2&&y<.82)||
  (x>.2&&x<.8&&y>.18&&y<.28);
export const syntheticO=(x,y)=>{
  const r=Math.hypot(x-.5,y-.5);
  return r>.22&&r<.36;
};
