/**
 * PrintCheck Vision C3B.3.M — an actual small neural network (8-12-1
 * tanh MLP), trained exclusively on synthetic line/gap patches.
 * Research candidates only, never a print-fitness decision.
 */
export const MODEL_INFO=Object.freeze({
 schema:'printcheck.vision.synthetic-feature-mlp.v1',
 source:'synthetic_width_classes_only',seed:20261117,
 syntheticHoldoutN:3000,syntheticAccuracy:0.99733,
 syntheticPrecision075:0.99921,syntheticRecall075:0.99219,
 realWorldAccuracyVerified:false,productionApproved:false
});
const W1=[
[.508,.742,.326,.183,-1.196,1.962,-.303,-.437],
[-.331,.07,.917,-1.183,.721,-.602,.206,.371],
[-.242,-.305,.111,.019,1.056,-2.006,-.033,.45],
[-4.311,-3.913,1.203,1.019,2.101,-.764,.56,.787],
[-1.826,-1.959,2.746,2.707,.019,3.393,-.685,-.354],
[.069,.58,.807,-.799,-1.513,2.128,.072,-.665],
[-1.967,-2.02,2.744,2.762,-.752,3.886,-.826,-.38],
[.866,.611,.061,.152,-1.832,2.215,-.238,-.483],
[-.81,.736,-.363,.495,.509,-.199,.171,.334],
[-.822,-.316,-.029,-.91,1.467,-1.624,-.388,.716],
[-.729,-.266,.047,-.498,1.379,-1.973,-.05,.715],
[.209,-.096,-.201,.07,.752,.2,.017,.431]
];
const B1=[-1.12,.464,1.213,.8,-.906,-.635,-.457,-.549,.312,1.223,.908,.614];
const W2=[-1.586,.527,1.611,6.092,-3.253,-2.487,-4.178,-2.671,.465,1.638,1.798,.472];
const B2=.57528;
export function predictSyntheticThinPatch(features){
 if(!Array.isArray(features)||features.length!==8||
    features.some(v=>!Number.isFinite(v)||v<0||v>1))
   throw new RangeError('Invalid 8 synthetic patch features');
 let z=B2;
 for(let i=0;i<12;i++){
   let h=B1[i];
   for(let j=0;j<8;j++)h+=W1[i][j]*features[j];
   z+=W2[i]*Math.tanh(h);
 }
 return 1/(1+Math.exp(-Math.max(-40,Math.min(40,z))));
}
export function getPatchFeatures(mask,width,height,x,y,target=1){
 if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||
    mask?.length!==width*height||x<4||y<4||
    x>=width-4||y>=height-4)return null;
 let row=0,col=0,diag=0,anti=0,b3=0,b5=0,all=0,center=0;
 for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){
   const v=mask[(y+dy)*width+x+dx]===target?1:0;
   all+=v;
   if(dy===0){row+=v;if(dx>=-1&&dx<=1)center+=v;}
   if(dx===0)col+=v;
   if(dx===dy)diag+=v;
   if(dx===-dy)anti+=v;
   if(Math.abs(dx)<=1&&Math.abs(dy)<=1)b3+=v;
   if(Math.abs(dx)<=2&&Math.abs(dy)<=2)b5+=v;
 }
 return [row/9,col/9,diag/9,anti/9,b3/9,b5/25,all/81,center/3];
}
export function makeInkMask({width,height,data},{inkColor=null,tolerance=42}={}){
 const size=width*height;
 if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||
    width<9||height<9||size>700*700||data?.length!==size*4||
    !Number.isFinite(tolerance)||tolerance<2||tolerance>220)
   return {status:'MANUAL',reason:'RASTER_INPUT_UNSUPPORTED'};
 if(inkColor!==null&&(!Array.isArray(inkColor)||inkColor.length!==3||
   inkColor.some(c=>!Number.isInteger(c)||c<0||c>255)))
   return {status:'MANUAL',reason:'INK_SAMPLE_INVALID'};
 let transparent=0;
 for(let i=3;i<data.length;i+=4)if(data[i]<24)transparent++;
 const alphaMode=transparent>size/50&&transparent<size*.99;
 const bg=[data[0],data[1],data[2]],reference=inkColor??bg;
 const maxDist=tolerance*tolerance,mask=new Uint8Array(size);
 let count=0;
 for(let i=0;i<size;i++){
   const j=4*i;
   if(data[j+3]<24)continue;
   let ink;
   if(alphaMode&&!inkColor)ink=true;
   else{
     const d0=data[j]-reference[0],d1=data[j+1]-reference[1],d2=data[j+2]-reference[2];
     ink=inkColor?d0*d0+d1*d1+d2*d2<=maxDist:
       d0*d0+d1*d1+d2*d2>maxDist;
   }
   if(ink){mask[i]=1;count++}
 }
 if(count<2||count>=size*.98)
   return {status:'MANUAL',reason:'INK_MASK_EMPTY_OR_AMBIGUOUS'};
 return {status:'INK_MASK_READY',mask,inkPixels:count,segmentation:
   alphaMode&&!inkColor?'alpha':inkColor?'sampled_ink_rgb':'corner_background_rgb'};
}
function bracketedGap(mask,w,x,y){
 const dirs=[[1,0],[0,1],[1,1],[1,-1]];
 for(const [dx,dy] of dirs){
   let a=false,b=false;
   for(let r=1;r<=4;r++){
     if(mask[(y+dy*r)*w+x+dx*r]){a=true;break}
   }
   if(!a)continue;
   for(let r=1;r<=4;r++){
     if(mask[(y-dy*r)*w+x-dx*r]){b=true;break}
   }
   if(b)return true;
 }
 return false;
}
function collectRegions(flags,w,h,maxRegions){
 const seen=new Uint8Array(flags.length),stack=[],regions=[];
 for(let i=0;i<flags.length;i++){
   const kind=flags[i];if(!kind||seen[i])continue;
   seen[i]=1;stack.push(i);
   let xmin=w,xmax=0,ymin=h,ymax=0,pixels=0;
   while(stack.length){
     const cur=stack.pop(),x=cur%w,y=(cur-x)/w;
     pixels++;xmin=Math.min(xmin,x);xmax=Math.max(xmax,x);
     ymin=Math.min(ymin,y);ymax=Math.max(ymax,y);
     for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
       if(!dx&&!dy)continue;
       const nx=x+dx,ny=y+dy;
       if(nx<0||ny<0||nx>=w||ny>=h)continue;
       const nxt=ny*w+nx;
       if(!seen[nxt]&&flags[nxt]===kind){seen[nxt]=1;stack.push(nxt)}
     }
   }
   regions.push({kind:kind===1?'thin_ink_candidate':'narrow_gap_candidate',
     x:xmin,y:ymin,width:xmax-xmin+1,height:ymax-ymin+1,pixels});
 }
 return {regions:regions.sort((a,b)=>b.pixels-a.pixels).slice(0,maxRegions),
   regionsTotal:regions.length,regionsTruncated:regions.length>maxRegions};
}
export function analyzeSyntheticThinRegions(imageData,{inkColor=null,tolerance=42,
  probabilityThreshold=.75,maxRegions=120}={}){
 const {width,height}=imageData||{};
 if(!Number.isSafeInteger(maxRegions)||maxRegions<1||maxRegions>500||
    !Number.isFinite(probabilityThreshold)||
    probabilityThreshold<.5||probabilityThreshold>.999)
   return {status:'MANUAL',reason:'AI_SCAN_SETTINGS_INVALID',production_approved:false};
 const decoded=makeInkMask(imageData||{},{inkColor,tolerance});
 if(decoded.status!=='INK_MASK_READY')
   return {...decoded,production_approved:false};
 const {mask}=decoded,flags=new Uint8Array(mask.length);
 let thinInkPixels=0,narrowGapPixels=0;
 for(let y=4;y<height-4;y++)for(let x=4;x<width-4;x++){
   const i=y*width+x,target=mask[i];
   if(!target&&!bracketedGap(mask,width,x,y))continue;
   const f=getPatchFeatures(mask,width,height,x,y,target);
   if(predictSyntheticThinPatch(f)<probabilityThreshold)continue;
   flags[i]=target?1:2;
   if(target)thinInkPixels++;else narrowGapPixels++;
 }
 const grouped=collectRegions(flags,width,height,maxRegions);
 return {
   schema:'printcheck.vision.synthetic-mlp-scan.v1',
   status:'RESEARCH_AI_CANDIDATES_ONLY',width,height,
   thinInkPixels,narrowGapPixels,inkPixels:decoded.inkPixels,
   segmentation:decoded.segmentation,probabilityThreshold,
   model:MODEL_INFO,regions:grouped.regions,
   regionsTotal:grouped.regionsTotal,
   regionsTruncated:grouped.regionsTruncated,
   flags,production_approved:false,
   physical_scale_proven:false,real_world_accuracy_proven:false,
   note:'Synthetic neural patch model, not validated for customer logos, true mm widths or print process'
 };
}
