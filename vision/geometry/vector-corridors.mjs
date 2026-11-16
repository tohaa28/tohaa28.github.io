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
/**
 * Complete broad-phase index for finite segment AABBs. This is strictly a
 * candidate enumerator: all exact geometric decisions still use the same
 * narrow-phase predicates as the reference implementation.
 *
 * Every query expands the asking segment AABB by a NON-NEGATIVE padding,
 * then finds ALL original segment AABBs overlapping it. No sparse/nearest
 * heuristic, k-neighbor truncation or sampled coordinates are used.
 *
 * Pathological bin link counts fall back to exhaustive pair checks rather
 * than silently dropping possible micro-features.
 */
function buildSegmentGrid(bounds,maxLinks){
  const n=bounds.length;
  const minX=Math.min(...bounds.map(b=>b.minX));
  const minY=Math.min(...bounds.map(b=>b.minY));
  const maxX=Math.max(...bounds.map(b=>b.maxX));
  const maxY=Math.max(...bounds.map(b=>b.maxY));
  const bins=Math.min(32,Math.max(2,Math.ceil(Math.sqrt(n))));
  const nx=bins,ny=bins;
  const stepX=Math.max((maxX-minX)/nx,1e-12);
  const stepY=Math.max((maxY-minY)/ny,1e-12);
  const clamp=(v,hi)=>Math.min(hi,Math.max(0,v));
  const rx=(lo,hi)=>[
    clamp(Math.floor((lo-minX)/stepX),nx-1),
    clamp(Math.floor((hi-minX)/stepX),nx-1)
  ];
  const ry=(lo,hi)=>[
    clamp(Math.floor((lo-minY)/stepY),ny-1),
    clamp(Math.floor((hi-minY)/stepY),ny-1)
  ];
  const cells=new Map();
  let links=0;
  for(let i=0;i<n;i++){
    const b=bounds[i],xx=rx(b.minX,b.maxX),yy=ry(b.minY,b.maxY);
    links+=(xx[1]-xx[0]+1)*(yy[1]-yy[0]+1);
    if(links>maxLinks)return null;
    for(let x=xx[0];x<=xx[1];x++){
      for(let y=yy[0];y<=yy[1];y++){
        const cell=y*nx+x,existing=cells.get(cell);
        if(existing)existing.push(i);
        else cells.set(cell,[i]);
      }
    }
  }
  function query(i,padding){
    const a=bounds[i],minQX=a.minX-padding,maxQX=a.maxX+padding;
    const minQY=a.minY-padding,maxQY=a.maxY+padding;
    const xx=rx(minQX,maxQX),yy=ry(minQY,maxQY);
    const seen=new Set(),found=[];
    for(let x=xx[0];x<=xx[1];x++){
      for(let y=yy[0];y<=yy[1];y++){
        for(const j of cells.get(y*nx+x)||[]){
          if(j<=i||seen.has(j))continue;
          seen.add(j);
          const b=bounds[j];
          if(b.maxX<minQX||b.minX>maxQX||
             b.maxY<minQY||b.minY>maxQY)continue;
          found.push(j);
        }
      }
    }
    return found.sort((a,b)=>a-b);
  }
  return {query,links,cells:cells.size};
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
  // Build one complete broad-phase index for both topology and corridor
  // searches. Reference mode is reserved for exhaustive equivalence tests.
  const edgeBounds=edges.map(edge=>({
    minX:Math.min(edge.p.x,edge.q.x),
    maxX:Math.max(edge.p.x,edge.q.x),
    minY:Math.min(edge.p.y,edge.q.y),
    maxY:Math.max(edge.p.y,edge.q.y)
  }));
  const indexEnabled=options.pair_index!=="reference";
  if(options.pair_index!==undefined&&
     options.pair_index!=="grid"&&options.pair_index!=="reference")
    return bad("PAIR_INDEX_MODE_INVALID");
  const spatial=indexEnabled?
    buildSegmentGrid(edgeBounds,Math.max(16384,edges.length*64)):null;
  const pairMode=!indexEnabled?"reference":spatial?"grid":"reference_fallback";
  const boxEpsilon=Math.max(1e-8,
    1e-10*Math.max(1,...edgeBounds.flatMap(b=>
      [Math.abs(b.minX),Math.abs(b.maxX),Math.abs(b.minY),Math.abs(b.maxY)])));
  function* segmentPairs(padding){
    for(let i=0;i<edges.length;i++){
      if(spatial){
        for(const j of spatial.query(i,padding))yield [i,j];
      }else{
        for(let j=i+1;j<edges.length;j++)yield [i,j];
      }
    }
  }
  let intersectionPairChecks=0,corridorPairChecks=0;
  // Reject bow ties, crossing or tangent rings, overlaps and touching holes.
  for(const [i,j] of segmentPairs(boxEpsilon)){
    if(isAdjacent(edges[i],edges[j],sizes))continue;
    intersectionPairChecks++;
    if(intersects(edges[i].p,edges[i].q,edges[j].p,edges[j].q))
      return bad("SELF_INTERSECTION_OR_TOUCHING_CONTOURS");
  }
  const candidates=[],angleMin=Math.cos(angle*Math.PI/180);
  let rejectedTapers=0,rejectedAmbiguous=0,possible=0,truncated=false;
  for(const [i,j] of segmentPairs(maxWidth+boxEpsilon)){
      corridorPairChecks++;
      const A=edges[i],U=A.u;
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
    pair_search:Object.freeze({
      mode:pairMode,edges:edges.length,
      exhaustive_pair_count:edges.length*(edges.length-1)/2,
      intersection_pair_checks:intersectionPairChecks,
      corridor_pair_checks:corridorPairChecks,
      index_cells:spatial?.cells??0,index_links:spatial?.links??0
    }),
    truncated,warnings:[
      "unverified_source_shapes_and_placement",
      "nonparallel_walls_and_curves_require_additional_methods",
      "not_all_negative_gaps_are_printing_errors",
      "cannot_mark_artwork_as_passed",
      ...(truncated?["candidate_budget_exceeded_results_truncated"]:[])
    ]
  };
}
