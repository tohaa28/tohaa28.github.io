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
