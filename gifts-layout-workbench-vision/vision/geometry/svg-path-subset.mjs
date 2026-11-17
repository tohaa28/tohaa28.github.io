/**
 * Strict SVG path-data adapter for PrintCheck Vision C3B.2.
 *
 * Supported: M/m, L/l, H/h, V/v, C/c, S/s, Q/q, T/t, A/a, Z/z, repeated and
 * implicit coordinate commands. Every returned contour is CLOSED and filled.
 *
 * Deliberately unsupported (MANUAL): invalid arcs, unclosed strokes, CSS
 * styling, clip-path, marker, text, external references, group transforms.
 * The caller must independently check actual fill and document placement.
 *
 * Cubic/quad curves are adaptively flattened with an explicit error budget
 * in SVG user units. Unsupported elements NEVER silently disappear.
 */
const refused=(reason,more={})=>({status:"MANUAL",reason,contours:[],...more});
const NUM=/[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?/y;
const isCommand=s=>/^[A-Za-z]$/.test(s);
function tokensOf(d,maxTokens){
  const tokens=[];
  let i=0;
  while(i<d.length){
    if(/\s|,/.test(d[i])){i++;continue}
    if(isCommand(d[i])){tokens.push(d[i++]);}
    else{
      NUM.lastIndex=i;
      const m=NUM.exec(d);
      if(!m)return null;
      const v=Number(m[0]);
      if(!Number.isFinite(v)||Math.abs(v)>1e8)return null;
      tokens.push(v);i=NUM.lastIndex;
    }
    if(tokens.length>maxTokens)return null;
  }
  return tokens;
}
const midpoint=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
function flatness(p0,p1,p2,p3){
  // Distance to the FINITE chord segment, not to its infinite supporting line.
  // The segment is convex, so bounding its distance for every Bezier control
  // point bounds the entire cubic curve (convex-hull property). This also
  // handles collinear control-point overshoot without infinite subdivisions.
  const dx=p3.x-p0.x,dy=p3.y-p0.y,den=dx*dx+dy*dy;
  const distanceToChord=p=>{
    if(den<=1e-28)return Math.hypot(p.x-p0.x,p.y-p0.y);
    const t=Math.max(0,Math.min(1,((p.x-p0.x)*dx+(p.y-p0.y)*dy)/den));
    return Math.hypot(p.x-(p0.x+t*dx),p.y-(p0.y+t*dy));
  };
  return Math.max(distanceToChord(p1),distanceToChord(p2));
}
function cubicToPolyline(p0,p1,p2,p3,eps,depth,emit){
  if(flatness(p0,p1,p2,p3)<=eps){emit(p3);return}
  if(depth<=0)throw new Error("CURVE_FLATTEN_DEPTH_EXCEEDED");
  const p01=midpoint(p0,p1),p12=midpoint(p1,p2),p23=midpoint(p2,p3);
  const p012=midpoint(p01,p12),p123=midpoint(p12,p23),p=midpoint(p012,p123);
  cubicToPolyline(p0,p01,p012,p,eps,depth-1,emit);
  cubicToPolyline(p,p123,p23,p3,eps,depth-1,emit);
}
/**
 * SVG 2 elliptical endpoint arc (A/a) to a safely bounded polyline.
 * Error bound <= eps in local user units for each arc chord, with maximum
 * curvature controlled by the ellipse's largest radius. Invalid, degenerate
 * or very large arcs fail closed rather than silently producing straight lines.
 */
function arcToPolyline(start,rx,ry,rotation,largeFlag,sweepFlag,end,eps,emit,maxSegments){
  if(!(rx>0&&ry>0) || ![rx,ry,rotation].every(Number.isFinite)||
     !(largeFlag===0||largeFlag===1) || !(sweepFlag===0||sweepFlag===1))
    throw new Error("SVG_ARC_PARAMETERS_INVALID");
  if(rx>1e8||ry>1e8 || (start.x===end.x&&start.y===end.y))
    throw new Error("SVG_ARC_DEGENERATE_OR_OVERSIZED");
  const phi=rotation*Math.PI/180,cosPhi=Math.cos(phi),sinPhi=Math.sin(phi);
  const dx=(start.x-end.x)/2,dy=(start.y-end.y)/2;
  const xp=cosPhi*dx+sinPhi*dy,yp=-sinPhi*dx+cosPhi*dy;
  const correction=Math.sqrt(xp*xp/(rx*rx)+yp*yp/(ry*ry));
  if(!Number.isFinite(correction))throw new Error("SVG_ARC_PARAMETERS_INVALID");
  if(correction>1){rx*=correction;ry*=correction}
  const rx2=rx*rx,ry2=ry*ry,xp2=xp*xp,yp2=yp*yp;
  const denom=rx2*yp2+ry2*xp2;
  if(!(denom>1e-24))throw new Error("SVG_ARC_DEGENERATE_OR_OVERSIZED");
  const ratio=Math.max(0,(rx2*ry2-denom)/denom);
  const sign=largeFlag===sweepFlag?-1:1;
  const factor=sign*Math.sqrt(ratio);
  const cxp=factor*(rx*yp/ry),cyp=factor*(-ry*xp/rx);
  const cx=cosPhi*cxp-sinPhi*cyp+(start.x+end.x)/2;
  const cy=sinPhi*cxp+cosPhi*cyp+(start.y+end.y)/2;
  const ux=(xp-cxp)/rx,uy=(yp-cyp)/ry;
  const vx=(-xp-cxp)/rx,vy=(-yp-cyp)/ry;
  const begin=Math.atan2(uy,ux);
  let delta=Math.atan2(ux*vy-uy*vx,ux*vx+uy*vy);
  if(sweepFlag===0&&delta>0)delta-=2*Math.PI;
  if(sweepFlag===1&&delta<0)delta+=2*Math.PI;
  const maxRadius=Math.max(rx,ry);
  const angleBound=2*Math.acos(Math.max(-1,Math.min(1,1-eps/maxRadius)));
  const maxStep=Math.min(Math.PI/6,angleBound);
  if(!(maxStep>0)||!Number.isFinite(maxStep))
    throw new Error("SVG_ARC_ERROR_BUDGET_UNREACHABLE");
  const steps=Math.max(1,Math.ceil(Math.abs(delta)/maxStep));
  if(!Number.isSafeInteger(steps)||steps>maxSegments)
    throw new Error("SVG_ARC_SEGMENT_BUDGET_EXCEEDED");
  for(let i=1;i<=steps;i++){
    if(i===steps){emit(end);continue}
    const t=begin+delta*i/steps;
    const ct=Math.cos(t),st=Math.sin(t);
    emit({
      x:cx+rx*cosPhi*ct-ry*sinPhi*st,
      y:cy+rx*sinPhi*ct+ry*cosPhi*st
    });
  }
}
function same(a,b){return a.x===b.x&&a.y===b.y}
export function parseClosedSvgPath(d, options={}){
  if(typeof d!=="string"||!d.trim())return refused("EMPTY_PATH");
  const maxTokens=options.max_tokens??10_000,maxSegments=options.max_segments??4096;
  const errorBudget=options.flatness_user_units??0.002;
  if(!Number.isSafeInteger(maxTokens)||maxTokens<2||maxTokens>100_000||
     !Number.isSafeInteger(maxSegments)||maxSegments<3||maxSegments>20_000||
     typeof errorBudget!=="number"||!Number.isFinite(errorBudget)||
     errorBudget<=0||errorBudget>10)return refused("INVALID_FLATTEN_OPTIONS");
  const tokens=tokensOf(d,maxTokens);
  if(!tokens||tokens.length===0)return refused("INVALID_PATH_DATA");
  const supported=new Set(["M","L","H","V","C","S","Q","T","A","Z"]);
  let i=0,command=null,position={x:0,y:0},start=null,points=null,contours=[],count=0,curveSegments=0;
  let lastCubicControl=null,lastQuadControl=null;
  const resetSmooth=()=>{lastCubicControl=null;lastQuadControl=null;};
  const reflected=control=>control?{x:2*position.x-control.x,y:2*position.y-control.y}:{...position};
  const emit=p=>{
    if(!Number.isFinite(p.x)||!Number.isFinite(p.y))throw new Error("NONFINITE_COORDINATE");
    if(Math.abs(p.x)>1e8||Math.abs(p.y)>1e8)throw new Error("COORDINATE_RANGE_EXCEEDED");
    if(!points)throw new Error("PATH_SUBPATH_NOT_STARTED");
    if(!same(points[points.length-1],p)){points.push(p);count++;}
    if(count>maxSegments)throw new Error("PATH_SEGMENT_BUDGET_EXCEEDED");
  };
  const scalar=()=>{const v=tokens[i++];if(typeof v!=="number")throw new Error("MISSING_PATH_ARGUMENT");return v;};
  const target=(relative)=>{const x=scalar(),y=scalar();return relative?{x:position.x+x,y:position.y+y}:{x,y};};
  try{
    while(i<tokens.length){
      if(isCommand(String(tokens[i]))){
        if(typeof tokens[i]==="string"){
          command=tokens[i++];
          if(!supported.has(command.toUpperCase()))return refused("UNSUPPORTED_SVG_COMMAND",{command});
        }
      }else if(!command)return refused("PATH_EXPECTED_COMMAND");
      if(!command)break;
      const upper=command.toUpperCase(),rel=command!==upper;
      if(upper==="Z"){
        if(!points||points.length<3)return refused("DEGENERATE_OR_OPEN_SUBPATH");
        if(points.length>3&&same(points[points.length-1],start))points.pop();
        contours.push({points,closed:true});
        points=null;position={...start};start=null;command=null;resetSmooth();
        continue;
      }
      if(i>=tokens.length||typeof tokens[i]!=="number")
        return refused("MISSING_PATH_ARGUMENT");
      if(upper==="M"){
        if(points)return refused("UNCLOSED_SUBPATH");
        const p=target(rel);position=p;start={...p};points=[{...p}];resetSmooth();
        command=rel?"l":"L";
        continue;
      }
      if(upper==="L"){const p=target(rel);emit(p);position=p;resetSmooth();continue}
      if(upper==="H"){const x=scalar(),p={x:rel?position.x+x:x,y:position.y};emit(p);position=p;resetSmooth();continue}
      if(upper==="V"){const y=scalar(),p={x:position.x,y:rel?position.y+y:y};emit(p);position=p;resetSmooth();continue}
      if(upper==="C"){
        const c1=target(rel),c2=target(rel),end=target(rel);
        const before=count;
        cubicToPolyline(position,c1,c2,end,errorBudget,14,emit);
        curveSegments+=count-before;
        position=end;lastCubicControl=c2;lastQuadControl=null;continue;
      }
      if(upper==="S"){
        const c1=reflected(lastCubicControl);
        const c2=target(rel),end=target(rel);
        const before=count;
        cubicToPolyline(position,c1,c2,end,errorBudget,14,emit);
        curveSegments+=count-before;
        position=end;lastCubicControl=c2;lastQuadControl=null;continue;
      }
      if(upper==="Q"){
        const c=target(rel),end=target(rel);
        const c1={x:position.x+(c.x-position.x)*2/3,y:position.y+(c.y-position.y)*2/3};
        const c2={x:end.x+(c.x-end.x)*2/3,y:end.y+(c.y-end.y)*2/3};
        const before=count;
        cubicToPolyline(position,c1,c2,end,errorBudget,14,emit);
        curveSegments+=count-before;
        position=end;lastQuadControl=c;lastCubicControl=null;continue;
      }
      if(upper==="A"){
        const rx=scalar(),ry=scalar(),rotation=scalar(),
              large=scalar(),sweep=scalar(),end=target(rel);
        const before=count;
        arcToPolyline(position,rx,ry,rotation,large,sweep,end,
                      errorBudget,emit,maxSegments-count);
        curveSegments+=count-before;
        position=end;resetSmooth();continue;
      }
      if(upper==="T"){
        const c=reflected(lastQuadControl);
        const end=target(rel);
        const c1={x:position.x+(c.x-position.x)*2/3,y:position.y+(c.y-position.y)*2/3};
        const c2={x:end.x+(c.x-end.x)*2/3,y:end.y+(c.y-end.y)*2/3};
        const before=count;
        cubicToPolyline(position,c1,c2,end,errorBudget,14,emit);
        curveSegments+=count-before;
        position=end;lastQuadControl=c;lastCubicControl=null;continue;
      }
    }
    if(points)return refused("UNCLOSED_SUBPATH");
    if(contours.length===0)return refused("PATH_NO_CLOSED_CONTOURS");
    return {status:"CONTOURS_ONLY",schema:"printcheck.vision.svg-path-subset.v1",
      contours,curve_segments:curveSegments,flatness_user_units:errorBudget,
      warning:"The source style, grouping, fill-rule and print placement are not verified by this parser."};
  }catch(e){
    return refused(e.message||"PATH_PARSER_FAILED");
  }
}
