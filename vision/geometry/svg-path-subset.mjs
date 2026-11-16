/**
 * Strict SVG path-data adapter for PrintCheck Vision C3B.2.
 *
 * Supported: M/m, L/l, H/h, V/v, C/c, Q/q, Z/z, repeated and
 * implicit coordinate commands. Every returned contour is CLOSED and filled.
 *
 * Deliberately unsupported (MANUAL): A/a, S/s, T/t, unclosed strokes, CSS
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
  const supported=new Set(["M","L","H","V","C","Q","Z"]);
  let i=0,command=null,position={x:0,y:0},start=null,points=null,contours=[],count=0,curveSegments=0;
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
        points=null;position={...start};start=null;command=null;
        continue;
      }
      if(i>=tokens.length||typeof tokens[i]!=="number")
        return refused("MISSING_PATH_ARGUMENT");
      if(upper==="M"){
        if(points)return refused("UNCLOSED_SUBPATH");
        const p=target(rel);position=p;start={...p};points=[{...p}];
        command=rel?"l":"L";
        continue;
      }
      if(upper==="L"){const p=target(rel);emit(p);position=p;continue}
      if(upper==="H"){const x=scalar(),p={x:rel?position.x+x:x,y:position.y};emit(p);position=p;continue}
      if(upper==="V"){const y=scalar(),p={x:position.x,y:rel?position.y+y:y};emit(p);position=p;continue}
      if(upper==="C"){
        const c1=target(rel),c2=target(rel),end=target(rel);
        const before=count;
        cubicToPolyline(position,c1,c2,end,errorBudget,14,emit);
        curveSegments+=count-before;
        position=end;continue;
      }
      if(upper==="Q"){
        const c=target(rel),end=target(rel);
        const c1={x:position.x+(c.x-position.x)*2/3,y:position.y+(c.y-position.y)*2/3};
        const c2={x:end.x+(c.x-end.x)*2/3,y:end.y+(c.y-end.y)*2/3};
        const before=count;
        cubicToPolyline(position,c1,c2,end,errorBudget,14,emit);
        curveSegments+=count-before;
        position=end;continue;
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
