import {analyzeDetail} from './logo-detail-engine.mjs?v=20261001-1';
const colors={positive:[255,214,0],negative:[0,229,255],isolated:[255,128,0]};
self.onmessage=({data})=>{try{
 const result=analyzeDetail({...data,data:new Uint8ClampedArray(data.rgba)}),{width,height}=result;
 const padding=Math.ceil(result.boxes.reduce((m,b)=>Math.max(m,b.threshold/result.step/2),0)+3),W=width+2*padding,H=height+2*padding,scale=Math.min(1,Math.sqrt(4_000_000/(W*H)),8192/W,8192/H);
 const canvas=new OffscreenCanvas(Math.max(1,Math.ceil(W*scale)),Math.max(1,Math.ceil(H*scale))),ctx=canvas.getContext('2d');ctx.scale(canvas.width/W,canvas.height/H);ctx.translate(padding,padding);
 // One circle per accepted region, across the entire logo; no prefix limits.
 for(const b of result.boxes){const diameter=b.threshold/result.step;ctx.strokeStyle='rgb('+colors[b.kind].join(',')+')';ctx.lineWidth=Math.max(1,Math.min(3,diameter*.12));ctx.beginPath();ctx.arc(b.cx*width,b.cy*height,Math.max(.5,diameter/2),0,Math.PI*2);ctx.stroke();}
 const overlay=canvas.transferToImageBitmap();self.postMessage({id:data.id,result,overlay,overlayRect:{x:-padding/width,y:-padding/height,w:W/width,h:H/height}},[overlay]);
}catch(error){self.postMessage({id:data.id,error:String(error.message||error)});}};
