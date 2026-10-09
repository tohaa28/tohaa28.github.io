const EPS=1e-10;

function finitePoint(p){
  return p&&Number.isFinite(Number(p.x))&&Number.isFinite(Number(p.y));
}
function normalizedQuad(q){
  if(!Array.isArray(q)||q.length!==4||!q.every(finitePoint))throw new Error("quad must contain four finite points");
  return q.map(p=>({x:Number(p.x),y:Number(p.y)}));
}
function homographyMatrix(q){
  const [p0,p1,p2,p3]=normalizedQuad(q);
  const dx1=p1.x-p2.x,dx2=p3.x-p2.x,sx=p0.x-p1.x+p2.x-p3.x;
  const dy1=p1.y-p2.y,dy2=p3.y-p2.y,sy=p0.y-p1.y+p2.y-p3.y;
  let a,b,c=p0.x,d,e,f=p0.y,g,h;
  if(Math.abs(sx)<EPS&&Math.abs(sy)<EPS){
    g=h=0;a=p1.x-p0.x;b=p3.x-p0.x;d=p1.y-p0.y;e=p3.y-p0.y;
  }else{
    const den=dx1*dy2-dx2*dy1;
    if(Math.abs(den)<EPS)throw new Error("degenerate quad");
    g=(sx*dy2-dx2*sy)/den;h=(dx1*sy-sx*dy1)/den;
    a=p1.x-p0.x+g*p1.x;b=p3.x-p0.x+h*p3.x;
    d=p1.y-p0.y+g*p1.y;e=p3.y-p0.y+h*p3.y;
  }
  return [a,b,c,d,e,f,g,h,1];
}
function applyMatrix(m,p){
  const z=m[6]*p.x+m[7]*p.y+m[8];
  if(Math.abs(z)<EPS)throw new Error("point maps to infinity");
  return {x:(m[0]*p.x+m[1]*p.y+m[2])/z,y:(m[3]*p.x+m[4]*p.y+m[5])/z};
}
function invert3(m){
  const [a,b,c,d,e,f,g,h,i]=m;
  const A=e*i-f*h,B=-(d*i-f*g),C=d*h-e*g;
  const D=-(b*i-c*h),E=a*i-c*g,F=-(a*h-b*g);
  const G=b*f-c*e,H=-(a*f-c*d),I=a*e-b*d;
  const det=a*A+b*B+c*C;
  if(Math.abs(det)<EPS)throw new Error("degenerate quad");
  return [A/det,D/det,G/det,B/det,E/det,H/det,C/det,F/det,I/det];
}

export function mapPointBetweenQuads(point,fromQuad,toQuad){
  const local=applyMatrix(invert3(homographyMatrix(fromQuad)),{x:Number(point.x),y:Number(point.y)});
  return applyMatrix(homographyMatrix(toQuad),local);
}

export function mapQuadBetweenQuads(points,fromQuad,toQuad){
  return normalizedQuad(points).map(p=>mapPointBetweenQuads(p,fromQuad,toQuad));
}

const MAX_CYLINDER_HALF_ANGLE=5*Math.PI/6; // 150° each side => up to 300° artwork wrap.

export function cylinderHalfAngle(curvature=.72){
  const k=Math.max(0,Math.min(1,Number(curvature)||0));
  return k*MAX_CYLINDER_HALF_ANGLE;
}

export function cylinderVisibleRange(curvature=.72){
  const halfAngle=cylinderHalfAngle(curvature);
  if(halfAngle<=Math.PI/2+EPS)return {start:0,end:1,halfAngle,clipped:false};
  const halfSpan=Math.PI/(4*halfAngle);
  return {start:.5-halfSpan,end:.5+halfSpan,halfAngle,clipped:true};
}

export function cylinderProjection(value,curvature=.72){
  const t=Math.max(0,Math.min(1,Number(value)||0));
  const halfAngle=cylinderHalfAngle(curvature);
  if(halfAngle<EPS)return {coordinate:t,visible:true,angle:0,depth:1};
  const angle=(t-.5)*2*halfAngle;
  const visible=Math.cos(angle)>=-EPS;
  const denom=Math.sin(Math.min(halfAngle,Math.PI/2));
  const coordinate=Math.abs(denom)<EPS?t:.5+.5*Math.sin(angle)/denom;
  return {coordinate,visible,angle,depth:Math.cos(angle)};
}

export function cylinderWarpCoordinate(value,curvature=.72){
  return cylinderProjection(value,curvature).coordinate;
}


function point(v){return {x:Number(v?.x)||0,y:Number(v?.y)||0};}
function mixPoint(a,b,t){return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};}
function mid(a,b){return mixPoint(a,b,.5);}
function sub(a,b){return {x:a.x-b.x,y:a.y-b.y};}
function add(a,b){return {x:a.x+b.x,y:a.y+b.y};}
function mul(a,k){return {x:a.x*k,y:a.y*k};}
function len(a){return Math.hypot(a.x,a.y);}
function unit(a){const l=len(a)||1;return {x:a.x/l,y:a.y/l};}

export function cylinder3DWrapScale(curvature=.72){
  const k=Math.max(0,Math.min(1,Number(curvature)||0));
  return Math.max(.25,Math.min(1.45,k/.72));
}

export function cylinder3DTheta(localWrapped,curvature=.72){
  return (Number(localWrapped)-.5)*Math.PI*cylinder3DWrapScale(curvature);
}

export function cylinder3DVisible(localWrapped,curvature=.72){
  return Math.cos(cylinder3DTheta(localWrapped,curvature))>=-EPS;
}

export function cylinder3DSurfacePoint(surfaceQuad,localX,localY,{axis="vertical",curvature=.72,topArc=.07,bottomArc=.045}={}){
  const q=normalizedQuad(surfaceQuad);
  const horizontal=axis==="horizontal";
  const wrapped=horizontal?Number(localY):Number(localX);
  const axial=horizontal?Number(localX):Number(localY);
  const theta=cylinder3DTheta(wrapped,curvature),sn=Math.sin(theta),cs=Math.cos(theta);
  let startA,startB,endA,endB;
  if(horizontal){
    startA=q[0];startB=q[3];endA=q[1];endB=q[2];
  }else{
    startA=q[0];startB=q[1];endA=q[3];endB=q[2];
  }
  startA=point(startA);startB=point(startB);endA=point(endA);endB=point(endB);
  const startMid=mid(startA,startB),endMid=mid(endA,endB),axisVec=unit(sub(endMid,startMid));
  const height=Math.max(EPS,len(sub(endMid,startMid)));
  const startHalf=mul(sub(startB,startA),.5),endHalf=mul(sub(endB,endA),.5);
  const startCurve=add(add(startMid,mul(startHalf,sn)),mul(axisVec,Number(topArc||0)*height*cs));
  const endCurve=add(add(endMid,mul(endHalf,sn)),mul(axisVec,Number(bottomArc||0)*height*cs));
  const p=mixPoint(startCurve,endCurve,axial);
  return {x:p.x,y:p.y,visible:cs>=-EPS,depth:cs,theta,wrapped,axial};
}


const UNIT_QUAD=[{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:0,y:1}];

function quadEdgeMetrics(q){
  return {
    width:(len(sub(q[1],q[0]))+len(sub(q[2],q[3])))/2,
    height:(len(sub(q[3],q[0]))+len(sub(q[2],q[1])))/2
  };
}

function cylinder3DSurfaceMetricScales(surfaceQuad,opts={}){
  const q=normalizedQuad(surfaceQuad),{width,height}=quadEdgeMetrics(q);
  const arcFactor=Math.PI/2*cylinder3DWrapScale(opts.curvature??.72);
  return opts.axis==="horizontal"
    ?{x:width,y:height*arcFactor}
    :{x:width*arcFactor,y:height};
}

/** Invert the curved cylinder projection rather than approximating it with a planar homography. */
export function cylinder3DInverseSurfacePoint(surfaceQuad,target,{axis="vertical",curvature=.72,topArc=.07,bottomArc=.045}={}){
  const q=normalizedQuad(surfaceQuad),goal=point(target),opts={axis,curvature,topArc,bottomArc};
  let seed;
  try{seed=mapPointBetweenQuads(goal,q,UNIT_QUAD);}
  catch{seed={x:.5,y:.5};}
  const initial={x:seed.x,y:seed.y};
  let x=seed.x,y=seed.y;
  const {width,height}=quadEdgeMetrics(q),scale=Math.max(1,width,height),tolerance=scale*1e-8;
  const at=(xx,yy)=>cylinder3DSurfacePoint(q,xx,yy,opts);
  for(let i=0;i<32;i++){
    const cur=at(x,y),rx=cur.x-goal.x,ry=cur.y-goal.y,error=Math.hypot(rx,ry);
    if(error<=tolerance)break;
    const step=1e-4;
    const xp=at(x+step,y),xm=at(x-step,y),yp=at(x,y+step),ym=at(x,y-step);
    const j11=(xp.x-xm.x)/(2*step),j21=(xp.y-xm.y)/(2*step);
    const j12=(yp.x-ym.x)/(2*step),j22=(yp.y-ym.y)/(2*step);
    const det=j11*j22-j12*j21;
    if(!Number.isFinite(det)||Math.abs(det)<1e-12)break;
    const dx=(rx*j22-ry*j12)/det,dy=(j11*ry-j21*rx)/det;
    if(!Number.isFinite(dx)||!Number.isFinite(dy))break;
    let factor=1,improved=false;
    for(let attempt=0;attempt<12;attempt++,factor*=.5){
      const nx=x-factor*dx,ny=y-factor*dy;
      if(Math.abs(nx)>20||Math.abs(ny)>20)continue;
      const next=at(nx,ny),nextError=Math.hypot(next.x-goal.x,next.y-goal.y);
      if(nextError<error){x=nx;y=ny;improved=true;break;}
    }
    if(!improved)break;
  }
  const final=at(x,y);
  if(Math.hypot(final.x-goal.x,final.y-goal.y)>Math.max(tolerance*100,scale*1e-4))return initial;
  return {x,y};
}

/** Fit artwork inside a cylindrical field without changing its intrinsic aspect ratio. */
export function cylinder3DArtworkQuad(surfaceQuad,fieldQuad,artworkAspect,{axis="vertical",curvature=.72,topArc=.07,bottomArc=.045}={}){
  const opts={axis,curvature,topArc,bottomArc};
  const localFieldQuad=normalizedQuad(fieldQuad).map(p=>cylinder3DInverseSurfacePoint(surfaceQuad,p,opts));
  const {width,height}=quadEdgeMetrics(localFieldQuad),metrics=cylinder3DSurfaceMetricScales(surfaceQuad,opts);
  const fieldAspect=(width*metrics.x)/(Math.max(EPS,height)*Math.max(EPS,metrics.y));
  const aspect=Number(artworkAspect);
  if(!Number.isFinite(aspect)||aspect<=EPS||!Number.isFinite(fieldAspect)||fieldAspect<=EPS){
    return {localFieldQuad,localArtworkQuad:localFieldQuad,fieldAspect,artworkAspect:aspect,bounds:{u0:0,u1:1,v0:0,v1:1}};
  }
  let u0=0,u1=1,v0=0,v1=1;
  if(aspect>fieldAspect){
    const innerV=Math.max(.0001,Math.min(1,fieldAspect/aspect));
    v0=(1-innerV)/2;v1=(1+innerV)/2;
  }else if(aspect<fieldAspect){
    const innerU=Math.max(.0001,Math.min(1,aspect/fieldAspect));
    u0=(1-innerU)/2;u1=(1+innerU)/2;
  }
  const matrix=homographyMatrix(localFieldQuad);
  const localArtworkQuad=[
    applyMatrix(matrix,{x:u0,y:v0}),
    applyMatrix(matrix,{x:u1,y:v0}),
    applyMatrix(matrix,{x:u1,y:v1}),
    applyMatrix(matrix,{x:u0,y:v1})
  ];
  return {localFieldQuad,localArtworkQuad,fieldAspect,artworkAspect:aspect,bounds:{u0,u1,v0,v1}};
}

/** Resize one field corner while keeping its unwrapped surface width/height ratio. */
export function cylinder3DResizeFieldPreservingAspect(surfaceQuad,fieldQuad,activeIndex,draggedPoint,opts={}){
  const local=normalizedQuad(fieldQuad).map(p=>cylinder3DInverseSurfacePoint(surfaceQuad,p,opts));
  const i=Math.max(0,Math.min(3,Math.trunc(Number(activeIndex)||0)));
  const target=cylinder3DInverseSurfacePoint(surfaceQuad,draggedPoint,opts);
  const {width,height}=quadEdgeMetrics(local),ratio=Math.max(.0001,width/Math.max(EPS,height));
  const anchor=local[(i+2)%4],dx=Math.abs(target.x-anchor.x),dy=Math.abs(target.y-anchor.y);
  const h=Math.max(.002,(ratio*dx+dy)/(ratio*ratio+1)),w=Math.max(.002,ratio*h);
  const next=new Array(4);
  if(i===0){
    next[2]=anchor;next[1]={x:anchor.x,y:anchor.y-h};next[3]={x:anchor.x-w,y:anchor.y};next[0]={x:anchor.x-w,y:anchor.y-h};
  }else if(i===1){
    next[3]=anchor;next[0]={x:anchor.x,y:anchor.y-h};next[2]={x:anchor.x+w,y:anchor.y};next[1]={x:anchor.x+w,y:anchor.y-h};
  }else if(i===2){
    next[0]=anchor;next[1]={x:anchor.x+w,y:anchor.y};next[3]={x:anchor.x,y:anchor.y+h};next[2]={x:anchor.x+w,y:anchor.y+h};
  }else{
    next[1]=anchor;next[0]={x:anchor.x-w,y:anchor.y};next[2]={x:anchor.x,y:anchor.y+h};next[3]={x:anchor.x-w,y:anchor.y+h};
  }
  return next.map(p=>cylinder3DSurfacePoint(surfaceQuad,p.x,p.y,opts)).map(p=>({x:p.x,y:p.y}));
}

export function cylinder3DArcHandle(surfaceQuad,which="top",{axis="vertical",curvature=.72,topArc=.07,bottomArc=.045}={}){
  const horizontal=axis==="horizontal";
  const localX=horizontal?(which==="top"?0:1):.5;
  const localY=horizontal?.5:(which==="top"?0:1);
  return cylinder3DSurfacePoint(surfaceQuad,localX,localY,{axis,curvature,topArc,bottomArc});
}

export function cylinder3DArcRatioFromPoint(surfaceQuad,p,which="top",{axis="vertical"}={}){
  const q=normalizedQuad(surfaceQuad),pt=point(p),horizontal=axis==="horizontal";
  const startA=point(horizontal?q[0]:q[0]),startB=point(horizontal?q[3]:q[1]);
  const endA=point(horizontal?q[1]:q[3]),endB=point(horizontal?q[2]:q[2]);
  const startMid=mid(startA,startB),endMid=mid(endA,endB),axisVec=unit(sub(endMid,startMid));
  const height=Math.max(EPS,len(sub(endMid,startMid))),base=which==="top"?startMid:endMid;
  return ((pt.x-base.x)*axisVec.x+(pt.y-base.y)*axisVec.y)/height;
}
