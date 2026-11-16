/**
 * PrintCheck Vision C3B.2 — bounded local vector corridors (research only).
 *
 * Inputs are NORMALIZED, closed contours from one printing ink, using an
 * explicitly supplied affine mapping to final millimetres. Fill-rule is
 * explicitly EVENODD. Input paths, styles, transforms, clipping, blend modes,
 * overprints, artboard and placement are NOT independently verified here.
 *
 * Recognizes only stable near-parallel opposing walls with enough overlap.
 * Acute serif tips, corners, tapering and curved ribbons are NOT measured.
 * Each output is an observable local candidate, NOT the GLOBAL minimum.
 * It can therefore NEVER yield "the whole artwork is OK".
 *
 * All coordinates in this module are transformed to physical millimetres
 * BEFORE geometric comparison. No pixel conversions or AI predictions.
 */
const bad=(reason,extra={})=>({
  schema:"printcheck.vision.vector-corridors.v1",status:"MANUAL",reason,
  candidates:[],geometry_proven:false,print_scale_proven:false,...extra
});
const hypot=Math.hypot;
const finite=x=>typeof x==="number"&&Number.isFinite(x);
const between=(p,q,t)=>({x:p.x+(q.x-p.x)*t,y:p.y+(q.y-p.y)*t});
const subtract=(p,q)=>({x:p.x-q.x,y:p.y-q.y});
const dot=(u,v)=>u.x*v.x+u.y*v.y;
const cross=(u,v)=>u.x*v.y-u.y*v.x;
const distance=(u,v)=>hypot(u.x-v.x,u.y-v.y);
const same=(p,q,eps=1e-9)=>distance(p,q)<=eps;
const segmentPointDistance=(p,a,b)=>{
  const v=subtract(b,a),den=dot(v,v);
  if(den<=1e-30)return distance(p,a);
  const t=Math.max(0,Math.min(1,dot(subtract(p,a),v)/den));
  return distance(p,between(a,b,t));
};
function isOnSegment(p,a,b){
  return segmentPointDistance(p,a,b)<=1e-9;
}
function intersects(a,b,c,d){
  const ab=subtract(b,a),cd=subtract(d,c),p=subtract(c,a);
  const denom=cross(ab,cd);
  if(Math.abs(denom)>1e-12){
    const t=cross(p,cd)/denom,s=cross(p,ab)/denom;
    return t>=-1e-10&&t<=1+1e-10&&s>=-1e-10&&s<=1+1e-10;
  }
  if(Math.abs(cross(p,ab))>1e-9*hypot(ab.x,ab.y))return false;
  return isOnSegment(c,a,b)||isOnSegment(d,a,b)||isOnSegment(a,c,d)||isOnSegment(b,c,d);
}
function isAdjacent(a,b,sizes){
  if(a.ring!==b.ring)return false;
  const n=sizes[a.ring];
  return a.index===b.index || (a.index+1)%n===b.index || (b.index+1)%n===a.index;
}
function insideRing(p,points) {
  let inside=false;
  for(let i=0,j=points.length-1;i<points.length;j=i++){
    const a=points[i],b=points[j];
    if(isOnSegment(p,a,b))return null;
    if((a.y>p.y)!==(b.y>p.y)){
      const x=a.x+(p.y-a.y)*(b.x-a.x)/(b.y-a.y);
      if(x>p.x)inside=!inside;
    }
  }
  return inside;
}
function evenOdd(p,rings){
  let inside=false;
  for(const ring of rings){
    const result=insideRing(p,ring);
    if(result===null)return null;
    if(result)inside=!inside;
  }
  return inside;
}
/**
 * @param {{
 *  contours:Array<{points:Array<{x:number,y:number}>}>,
 *  matrix_svg_to_mm:number[], fill_rule:"evenodd",
 *  max_segments?:number,max_candidates?:number,
 *  max_candidate_mm?:number,min_support_mm?:number,
 *  angle_tolerance_degrees?:number,curve_flatness_mm?:number
 * }} options
 */
export function inspectVectorCorridors(options={}) {
  const matrix=options.matrix_svg_to_mm;
  if(!Array.isArray(matrix)||matrix.length!==6||!matrix.every(finite))
    return bad("PHYSICAL_MATRIX_REQUIRED");
  const [a,b,c,d,e,f]=matrix;
  const det=a*d-b*c;
  if(!Number.isFinite(det)||Math.abs(det)<1e-15)
    return bad("SINGULAR_PLACEMENT_MATRIX");
  const maxSegments=options.max_segments??768,maxCandidates=options.max_candidates??100;
  const minSupport=options.min_support_mm??0.2,maxWidth=options.max_candidate_mm??3;
  const angle=options.angle_tolerance_degrees??4;
  const flatness=options.curve_flatness_mm??0;
  if(!Number.isSafeInteger(maxSegments)||maxSegments<3||maxSegments>2048 ||
     !Number.isSafeInteger(maxCandidates)||maxCandidates<1||maxCandidates>1000||
     !finite(minSupport)||minSupport<=0||minSupport>100||
     !finite(maxWidth)||maxWidth<=0||maxWidth>100||
     !finite(angle)||angle<=0||angle>10||
     !finite(flatness)||flatness<0||flatness>0.1)
    return bad("INVALID_NUMERICAL_LIMITS");
  if(options.fill_rule!=="evenodd")return bad("EXPLICIT_EVENODD_FILL_REQUIRED");
  const original=options.contours;
  if(!Array.isArray(original)||original.length===0||original.length>128)
    return bad("CONTOURS_REQUIRED");
  const rings=[],edges=[],sizes=[];
  const transform=p=>({x:a*p.x+c*p.y+e,y:b*p.x+d*p.y+f});
  for(let k=0;k<original.length;k++){
    const item=original[k];
    if(!Array.isArray(item?.points)||item.points.length<3)
      return bad("INVALID_CONTOUR");
    let pts=item.points.map(p=>{
      if(!p||!finite(p.x)||!finite(p.y)||Math.max(Math.abs(p.x),Math.abs(p.y))>1e8)
        return null;
      const point=transform(p);
      return finite(point.x)&&finite(point.y)&&Math.max(Math.abs(point.x),Math.abs(point.y))<1e8?point:null;
    });
    if(pts.some(p=>!p))return bad("INVALID_COORDINATE");
    if(same(pts[0],pts[pts.length-1]))pts=pts.slice(0,-1);
    if(pts.length<3)return bad("DEGENERATE_CONTOUR");
    const area2=pts.reduce((sum,p,i)=>sum+cross(p,pts[(i+1)%pts.length]),0);
    if(Math.abs(area2)<1e-10)return bad("ZERO_AREA_CONTOUR");
    if(pts.some((p,i)=>same(p,pts[(i+1)%pts.length])))
      return bad("DEGENERATE_EDGE");
    sizes.push(pts.length);rings.push(pts);
    for(let i=0;i<pts.length;i++){
      const p=pts[i],q=pts[(i+1)%pts.length],len=distance(p,q);
      if(len<1e-9)return bad("DEGENERATE_EDGE");
      edges.push({ring:k,index:i,p,q,len,u:{x:(q.x-p.x)/len,y:(q.y-p.y)/len}});
    }
    if(edges.length>maxSegments)return bad("EDGE_BUDGET_EXCEEDED");
  }
  // Reject bow ties, crossing or tangent rings, overlaps and touching holes.
  for(let i=0;i<edges.length;i++){
    for(let j=i+1;j<edges.length;j++){
      if(isAdjacent(edges[i],edges[j],sizes))continue;
      if(intersects(edges[i].p,edges[i].q,edges[j].p,edges[j].q))
        return bad("SELF_INTERSECTION_OR_TOUCHING_CONTOURS");
    }
  }
  const candidates=[],angleMin=Math.cos(angle*Math.PI/180);
  let rejectedTapers=0,rejectedAmbiguous=0,possible=0,truncated=false;
  for(let i=0;i<edges.length;i++){
    const A=edges[i],U=A.u;
    for(let j=i+1;j<edges.length;j++){
      const B=edges[j],V=B.u;
      if(isAdjacent(A,B,sizes))continue;
      const cosine=dot(U,V);
      if(Math.abs(cosine)<angleMin)continue;
      const relB0=dot(subtract(B.p,A.p),U),relB1=dot(subtract(B.q,A.p),U);
      const lower=Math.max(0,Math.min(relB0,relB1));
      const upper=Math.min(A.len,Math.max(relB0,relB1));
      const support=upper-lower;
      if(support+1e-10<minSupport)continue;
      const sample=(s)=>{
        const P={x:A.p.x+U.x*s,y:A.p.y+U.y*s};
        const t=dot(subtract(P,B.p),U)/cosine;
        const Q={x:B.p.x+V.x*t,y:B.p.y+V.y*t};
        return {P,Q,w:Math.abs(cross(U,subtract(Q,P)))};
      };
      const lo=sample(lower),hi=sample(upper),mid=sample((lower+upper)/2);
      if(lo.w<1e-9||hi.w<1e-9){rejectedAmbiguous++;continue}
      const width=Math.max(lo.w,hi.w,mid.w);
      if(width>maxWidth)continue;
      possible++;
      // Avoid misleading "thin lines" at tapering serif tips.
      if(Math.abs(lo.w-hi.w)>Math.max(0.005,0.025*width)){
        rejectedTapers++;continue;
      }
      const fractions=[0.2,0.5,0.8];
      let filled=null,consistent=true;
      for(const frac of fractions){
        const probe=sample(lower+(upper-lower)*frac);
        for(const within of [0.2,0.5,0.8]){
          const inside=evenOdd(between(probe.P,probe.Q,within),rings);
          if(inside===null){consistent=false;break}
          if(filled===null)filled=inside;
          if(inside!==filled){consistent=false;break}
        }
        if(!consistent)break;
      }
      if(!consistent||filled===null){rejectedAmbiguous++;continue}
      const estimate=(lo.w+hi.w+mid.w)/3;
      const uncertainty=Math.max(flatness*2,(Math.max(lo.w,hi.w,mid.w)-Math.min(lo.w,hi.w,mid.w))/2);
      // Never let the research output masquerade as a globally verified min.
      candidates.push({
        kind:filled?"positive_width_mm":"negative_gap_mm",
        measured_mm:estimate,uncertainty_mm:uncertainty,
        local_support_mm:support,
        wall_segments:[{ring:A.ring,edge:A.index},{ring:B.ring,edge:B.index}],
        at_mm:between(mid.P,mid.Q,0.5),
        method:"parallel_walls_exact_segments",
        geometry_proven:false,scale_proven:false,
        warning:"Local corridor candidate, not full-artwork minimum or production proof"
      });
    }
  }
  candidates.sort((x,y)=>x.measured_mm-y.measured_mm);
  if(candidates.length>maxCandidates){candidates.length=maxCandidates;truncated=true}
  return {
    schema:"printcheck.vision.vector-corridors.v1",
    status:"RESEARCH_CANDIDATES_ONLY",units:"mm",
    fill_rule:"evenodd",geometry_proven:false,print_scale_proven:false,
    scope:"local_parallel_corridors_not_global_minimum",
    source_matrix_used:matrix.slice(),
    candidate_count:candidates.length,
    candidates,rejected_tapers:rejectedTapers,
    rejected_ambiguous:rejectedAmbiguous,possible_pairs:possible,
    truncated,warnings:[
      "unverified_source_shapes_and_placement",
      "nonparallel_walls_and_curves_require_additional_methods",
      "not_all_negative_gaps_are_printing_errors",
      "cannot_mark_artwork_as_passed",
      ...(truncated?["candidate_budget_exceeded_results_truncated"]:[])
    ]
  };
}
