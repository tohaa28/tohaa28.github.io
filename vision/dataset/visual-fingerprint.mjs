/**
 * C3B.3.G -- local visual similarity fingerprint (advisory, NOT identity).
 *
 * Pure browser/Node function on caller-decoded RGBA. No image upload,
 * no network, no hidden decoder. Transparent or flat-background raster logos
 * are cropped to non-background artwork and compared in all eight D4
 * orientations. Perceptual collisions and arbitrary rotations/crops remain
 * possible: NEVER automatically merge family IDs based on this heuristic.
 */
const refuse=(reason)=>({status:'MANUAL',reason});
const isFiniteNumber=x=>typeof x==='number'&&Number.isFinite(x);
const DIM=16,MAX_PIXELS=12_000_000;
export const ADVISORY_SHAPE_BITS=15,ADVISORY_GRADIENT_BITS=20;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function sample(data,w,h,x,y,bg){
  const p=4*(y*w+x),alpha=data[p+3]/255;
  const [r,g,b]=[data[p],data[p+1],data[p+2]];
  const difference=Math.max(Math.abs(r-bg[0]),Math.abs(g-bg[1]),Math.abs(b-bg[2]));
  const ink=alpha>=0.15&&(bg[3]===0||difference>=32);
  const luminance=alpha*(0.2126*r+0.7152*g+0.0722*b)+255*(1-alpha);
  return [ink?1:0,ink?luminance:255];
}
function transformGrid(matrix,rotation,mirror){
  const size=DIM;
  const transformed=new Array(size*size);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    let u=mirror?size-1-x:x,v=y;
    if(rotation===1)[u,v]=[size-1-v,u];
    if(rotation===2)[u,v]=[size-1-u,size-1-v];
    if(rotation===3)[u,v]=[v,size-1-u];
    transformed[y*size+x]=matrix[v*size+u];
  }
  return transformed;
}
function bitsToHex(b){let s='';for(let i=0;i<b.length;i+=4){
  const n=(b[i]<<3)|(b[i+1]<<2)|(b[i+2]<<1)|b[i+3];
  s+=n.toString(16);
}return s;}
const nibbleCount=[0,1,1,2,1,2,2,3,1,2,2,3,2,3,3,4];
function distanceHex(a,b){
  let d=0;
  for(let i=0;i<a.length;i++)d+=nibbleCount[parseInt(a[i],16)^parseInt(b[i],16)];
  return d;
}
function gradientSignature(gray){
  const bit=[];
  // Sample broad structural gradients over 8x8 locations, constant under
  // uniform brightness scaling. Low-texture logos may yield all-zero hashes.
  for(let row=0;row<8;row++)for(let col=0;col<8;col++){
    const y=row*2,x=col*2;
    bit.push(gray[y*DIM+x]>gray[y*DIM+x+1]?1:0);
  }
  return bitsToHex(bit);
}
export function fingerprintRgba({data,width,height}={}){
  if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||
     width<8||height<8||width*height>MAX_PIXELS||
     !(data instanceof Uint8Array||data instanceof Uint8ClampedArray)||
     data.length!==4*width*height)
    return refuse('IMAGE_PIXELS_INVALID');
  // Detect transparency by alpha at corners and use an opaque default as
  // a first approximation for flat backgrounds. Nonflat backgrounds are not
  // assumed to be monochrome art.
  const cornerPositions=[[0,0],[width-1,0],[0,height-1],[width-1,height-1]];
  const corners=cornerPositions.map(([x,y])=>{
    const p=(y*width+x)*4;
    return [data[p],data[p+1],data[p+2],data[p+3]];
  });
  const bg=[0,0,0,0];
  for(let i=0;i<4;i++)bg[i]=Math.round(corners.reduce((sum,c)=>sum+c[i],0)/4);
  const spread=Math.max(...corners.flatMap(c=>c.map((v,i)=>Math.abs(v-bg[i]))));
  if(spread>28&&bg[3]>32)return refuse('NONFLAT_BACKGROUND_REQUIRES_MANUAL');
  let minX=width,minY=height,maxX=-1,maxY=-1,inkPixels=0;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    if(sample(data,width,height,x,y,bg)[0]!==1)continue;
    inkPixels++;
    minX=Math.min(minX,x);maxX=Math.max(maxX,x);
    minY=Math.min(minY,y);maxY=Math.max(maxY,y);
  }
  if(inkPixels<16||inkPixels>width*height*0.985||maxX<minX)
    return refuse('INSUFFICIENT_FOREGROUND_INFORMATION');
  const occupancy=[],gray=[];
  const roiWidth=maxX-minX+1,roiHeight=maxY-minY+1;
  for(let gy=0;gy<DIM;gy++)for(let gx=0;gx<DIM;gx++){
    let on=0,lum=0;
    // Each cell samples 4x4 locations. A deliberately tiny feature may
    // disappear; the output is only a near-duplicate candidate.
    for(let v=0;v<4;v++)for(let u=0;u<4;u++){
      const x=clamp(Math.floor(minX+(gx+(u+0.5)/4)*roiWidth/DIM),0,width-1);
      const y=clamp(Math.floor(minY+(gy+(v+0.5)/4)*roiHeight/DIM),0,height-1);
      const [ink,value]=sample(data,width,height,x,y,bg);
      on+=ink;lum+=value;
    }
    occupancy.push(on>=8?1:0);
    gray.push(lum/16);
  }
  const inkCells=occupancy.reduce((s,x)=>s+x,0);
  if(inkCells<4||inkCells>250)
    return refuse('LOW_INFORMATION_FINGERPRINT');
  const signatures=[];
  for(let flip=0;flip<2;flip++)for(let rotation=0;rotation<4;rotation++){
    const m=transformGrid(occupancy,rotation,Boolean(flip));
    const g=transformGrid(gray,rotation,Boolean(flip));
    signatures.push({
      orientation:flip*4+rotation,
      silhouette:bitsToHex(m),gradient:gradientSignature(g)
    });
  }
  return {
    schema:'printcheck.vision.visual-fingerprint.v1',
    status:'ADVISORY_SIGNATURE_ONLY',
    sha256_identity_proven:false,
    dimensions_px:{width,height},
    ink_fraction:inkPixels/(width*height),
    bbox_normalized:{
      x:minX/width,y:minY/height,
      w:roiWidth/width,h:roiHeight/height
    },
    orientations:signatures,
    warning:'perceptual_hash_is_not_collision_free_or_complete_duplicate_detector'
  };
}
export function visualDistance(first,second){
  if(first?.status!=='ADVISORY_SIGNATURE_ONLY'||
     second?.status!=='ADVISORY_SIGNATURE_ONLY'||
     first.schema!=='printcheck.vision.visual-fingerprint.v1'||
     second.schema!=='printcheck.vision.visual-fingerprint.v1'||
     !Array.isArray(first.orientations)||!Array.isArray(second.orientations)||
     first.orientations.length!==8||second.orientations.length!==8||
     [...first.orientations,...second.orientations].some(s=>
       !/^[0-9a-f]{64}$/.test(s?.silhouette??'')||
       !/^[0-9a-f]{16}$/.test(s?.gradient??'')))
    return refuse('FINGERPRINT_INVALID');
  let best={silhouette_bits:256,gradient_bits:64,
    orientation_a:null,orientation_b:null};
  let screeningPair=null;
  for(let i=0;i<8;i++)for(let j=0;j<8;j++){
    const a=first.orientations[i],b=second.orientations[j];
    const shape=distanceHex(a.silhouette,b.silhouette);
    const grad=distanceHex(a.gradient,b.gradient);
    if(shape<best.silhouette_bits||
       (shape===best.silhouette_bits&&grad<best.gradient_bits))
      best={silhouette_bits:shape,gradient_bits:grad,
        orientation_a:i,orientation_b:j};
    // Check ALL D4 orientation pairs. A smallest-silhouette pair may have
    // an unsuitable gradient while another near-silhouette pair qualifies.
    if(shape<=ADVISORY_SHAPE_BITS&&grad<=ADVISORY_GRADIENT_BITS&&
       (!screeningPair||shape+grad<screeningPair.silhouette_bits+
         screeningPair.gradient_bits))
      screeningPair={silhouette_bits:shape,gradient_bits:grad,
        orientation_a:i,orientation_b:j};
  }
  return {status:'ADVISORY_SIMILARITY_ONLY',...best,
    screening_match:screeningPair!==null,
    screening_pair:screeningPair};
}
