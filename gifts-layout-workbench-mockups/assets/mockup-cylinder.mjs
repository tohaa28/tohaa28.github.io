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

export function cylinderWarpCoordinate(value,curvature=.72){
  const t=Math.max(0,Math.min(1,Number(value)||0));
  const k=Math.max(0,Math.min(1,Number(curvature)||0));
  if(k<1e-6)return t;
  const angle=k*Math.PI*.47;
  const denom=Math.sin(angle);
  if(Math.abs(denom)<EPS)return t;
  return .5+.5*Math.sin((t-.5)*2*angle)/denom;
}
