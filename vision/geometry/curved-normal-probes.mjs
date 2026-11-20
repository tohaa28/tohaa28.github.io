/**
 * PrintCheck Vision C3B.3.D — conservative curved-boundary local probes.
 *
 * Research-only NORMAL RAY sampling on closed physical-mm contours.
 * A three-edge smooth support window is required; samples need a stable
 * nearest opposing wall with near-parallel tangents, consistent ink polarity
 * and low width variation. Acute tips, corners, tangent/vertex hits, missing
 * scale, self-intersecting shapes and over-budget inputs are rejected.
 *
 * This is deliberately NOT a medial-axis transform, global minimum or print
 * approval: sparse ray sampling can miss real defects. Results are only
 * local candidates and NEVER carry geometry_proven or print_scale_proven.
 *
 * No raster data, network calls, training labels or user orders handled.
 */
import {inspectVectorCorridors} from './vector-corridors.mjs';

const MANUAL=(reason,extra={})=>({
  schema:'printcheck.vision.curved-normal-probes.v1',
  status:'MANUAL',reason,geometry_proven:false,print_scale_proven:false,
  candidates:[],...extra
});
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const cross=(a,b)=>a.x*b.y-a.y*b.x;
const dot=(a,b)=>a.x*b.x+a.y*b.y;
const sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y});
const along=(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
const length=v=>Math.hypot(v.x,v.y);
const close=(a,b)=>length(sub(a,b))<=1e-9;
const angleCos=degrees=>Math.cos(degrees*Math.PI/180);

function polygonState(p,rings,bounds){
  let inside=false;
  for(let r=0;r<rings.length;r++){
    const bb=bounds[r];
    if(p.x<bb[0]-1e-9||p.x>bb[2]+1e-9||
       p.y<bb[1]-1e-9||p.y>bb[3]+1e-9)continue;
    const ring=rings[r];
    for(let i=0,j=ring.length-1;i<ring.length;j=i++){
      const a=ring[i],b=ring[j],v=sub(b,a),den=dot(v,v);
      const t=Math.max(0,Math.min(1,dot(sub(p,a),v)/den));
      if(length(sub(p,along(a,b,t)))<=1e-9)return null;
      if((a.y>p.y)!==(b.y>p.y)){
        const x=a.x+(p.y-a.y)*(b.x-a.x)/(b.y-a.y);
        if(x>p.x)inside=!inside;
      }
    }
  }
  return inside;
}
function segmentsOf(rings){
  const seg=[],byRing=[];
  for(let r=0;r<rings.length;r++){
    const pts=rings[r],seq=[];
    for(let i=0;i<pts.length;i++){
      const a=pts[i],b=pts[(i+1)%pts.length],v=sub(b,a),len=length(v);
      const id=seg.length;
      seg.push({id,ring:r,index:i,a,b,len,
        u:{x:v.x/len,y:v.y/len},
        bbox:[Math.min(a.x,b.x),Math.min(a.y,b.y),
              Math.max(a.x,b.x),Math.max(a.y,b.y)]});
      seq.push(id);
    }
    byRing.push(seq);
  }
  return {seg,byRing};
}
function closeAlongRing(src,dst,ringSize){
  return src.ring===dst.ring &&
    Math.min((src.index-dst.index+ringSize)%ringSize,
             (dst.index-src.index+ringSize)%ringSize)<=2;
}
function hitAlongNormal(P,N,source,segments,ringSizes,maxWidth,parallelCos){
  const hits=[];
  for(const target of segments){
    if(closeAlongRing(source,target,ringSizes[source.ring]))continue;
    // Safe broad phase: any ray hit is in the projected bounding rectangle.
    const box=target.bbox;
    const Q={x:P.x+N.x*maxWidth,y:P.y+N.y*maxWidth};
    if(Math.max(P.x,Q.x)<box[0]-1e-9||Math.min(P.x,Q.x)>box[2]+1e-9||
       Math.max(P.y,Q.y)<box[1]-1e-9||Math.min(P.y,Q.y)>box[3]+1e-9)
      continue;
    const v=sub(target.b,target.a),det=cross(N,v);
    if(Math.abs(det)<=1e-12)continue;
    const offset=sub(target.a,P);
    const dist=cross(offset,v)/det;
    const pos=cross(offset,N)/det;
    if(dist<=1e-6||dist>maxWidth+1e-9||pos<-1e-9||pos>1+1e-9)continue;
    // Edge endpoints and strong tangent mismatch are not stable evidence.
    if(pos<=0.04||pos>=0.96)continue;
    if(Math.abs(dot(source.u,target.u))<parallelCos)continue;
    hits.push({dist,target:target.id,point:along(P,{x:P.x+N.x*dist,y:P.y+N.y*dist},1)});
  }
  if(hits.length===0)return null;
  hits.sort((a,b)=>a.dist-b.dist || a.target-b.target);
  if(hits.length>1 && hits[1].dist-hits[0].dist<=1e-5)
    return {ambiguous:true};
  return hits[0];
}

/**
 * @param {{contours:Array<{points:Array<{x:number,y:number}>}>,
 *  matrix_svg_to_mm:number[],fill_rule:"evenodd",
 *  max_segments?:number,max_candidates?:number,max_candidate_mm?:number,
 *  min_support_mm?:number,max_turn_degrees?:number,
 *  wall_angle_degrees?:number,max_width_variation?:number,
 *  curve_flatness_mm?:number}} options
 */
export function inspectCurvedNormalProbes(options={}) {
  const maxSegments=options.max_segments??768;
  const maxCandidates=options.max_candidates??120;
  const maxWidth=options.max_candidate_mm??2;
  const minSupport=options.min_support_mm??0.2;
  const maxTurn=options.max_turn_degrees??26;
  const wallAngle=options.wall_angle_degrees??32;
  const maxVariation=options.max_width_variation??0.12;
  const flatness=options.curve_flatness_mm??0;
  if(!Number.isSafeInteger(maxSegments)||maxSegments<3||maxSegments>2048||
     !Number.isSafeInteger(maxCandidates)||maxCandidates<1||maxCandidates>1000||
     !finite(maxWidth)||maxWidth<=0||maxWidth>20||
     !finite(minSupport)||minSupport<=0||minSupport>20||
     !finite(maxTurn)||maxTurn<=0||maxTurn>45||
     !finite(wallAngle)||wallAngle<=0||wallAngle>45||
     !finite(maxVariation)||maxVariation<=0||maxVariation>0.5||
     !finite(flatness)||flatness<0||flatness>0.1)
    return MANUAL('NORMAL_PROBE_OPTIONS_INVALID');
  const preflight=inspectVectorCorridors({
    contours:options.contours,matrix_svg_to_mm:options.matrix_svg_to_mm,
    fill_rule:options.fill_rule,max_segments:maxSegments,max_candidates:1,
    max_candidate_mm:maxWidth,curve_flatness_mm:flatness
  });
  if(preflight.status!=='RESEARCH_CANDIDATES_ONLY')
    return MANUAL('NORMAL_PROBE_CONTOUR_PREFLIGHT_FAILED',{detail:preflight.reason});
  const rings=[];
  const [a,b,c,d,e,f]=options.matrix_svg_to_mm;
  for(const item of options.contours){
    const pts=item.points.map(p=>({x:a*p.x+c*p.y+e,y:b*p.x+d*p.y+f}));
    if(close(pts[0],pts[pts.length-1]))pts.pop();
    rings.push(pts);
  }
  const bounds=rings.map(r=>r.reduce((bb,p)=>[
    Math.min(bb[0],p.x),Math.min(bb[1],p.y),
    Math.max(bb[2],p.x),Math.max(bb[3],p.y)
  ],[Infinity,Infinity,-Infinity,-Infinity]));
  const {seg,byRing}=segmentsOf(rings),cosTurn=angleCos(maxTurn);
  const parallelCos=angleCos(wallAngle),candidates=[];
  let skippedCorners=0,skippedTapers=0,skippedAmbiguous=0,examinedWindows=0;
  for(let ring=0;ring<byRing.length;ring++){
    const ids=byRing[ring],n=ids.length;
    // A triangle and all short corner spikes have no stable three-wall window.
    if(n<6)continue;
    for(let i=0;i<n;i++){
      const left=seg[ids[(i+n-1)%n]],mid=seg[ids[i]],right=seg[ids[(i+1)%n]];
      if(left.len+mid.len+right.len<minSupport)continue;
      if(dot(left.u,mid.u)<cosTurn||dot(mid.u,right.u)<cosTurn){
        skippedCorners++;continue;
      }
      examinedWindows++;
      for(const side of [-1,1]){
        const probes=[];
        let okay=true;
        for(const source of [left,mid,right]){
          const P=along(source.a,source.b,0.5);
          const N={x:-source.u.y*side,y:source.u.x*side};
          const hit=hitAlongNormal(P,N,source,seg,ids.length?byRing.map(x=>x.length):[],
            maxWidth,parallelCos);
          if(!hit||hit.ambiguous){okay=false;break}
          const midpoint=along(P,hit.point,0.5);
          const state=polygonState(midpoint,rings,bounds);
          if(state===null){okay=false;break}
          probes.push({source,origin:P,hit,state,midpoint});
        }
        if(!okay){skippedAmbiguous++;continue}
        if(probes.some(p=>p.state!==probes[0].state)){
          skippedAmbiguous++;continue;
        }
        const widths=probes.map(p=>p.hit.dist);
        const mean=widths.reduce((s,x)=>s+x,0)/3;
        const range=Math.max(...widths)-Math.min(...widths);
        if(range>Math.max(0.008,maxVariation*mean)){
          skippedTapers++;continue;
        }
        const center=probes[1];
        candidates.push({
          kind:center.state?'positive_width_mm':'negative_gap_mm',
          measured_mm:mean,
          uncertainty_mm:Math.max(flatness*2,range/2),
          local_support_mm:left.len+mid.len+right.len,
          at_mm:center.midpoint,
          wall_segments:[
            {ring:mid.ring,edge:mid.index},
            {ring:seg[center.hit.target].ring,
              edge:seg[center.hit.target].index}
          ],
          sampling:'three_adjacent_boundary_normals',
          geometry_proven:false,scale_proven:false,
          warning:'Local stable normal-ray estimate; not medial axis or global minimum'
        });
      }
    }
  }
  candidates.sort((x,y)=>x.measured_mm-y.measured_mm||
    x.wall_segments[0].ring-y.wall_segments[0].ring||
    x.wall_segments[0].edge-y.wall_segments[0].edge);
  const detected=candidates.length,truncated=detected>maxCandidates;
  if(truncated)candidates.length=maxCandidates;
  return {
    schema:'printcheck.vision.curved-normal-probes.v1',
    status:'RESEARCH_CANDIDATES_ONLY',
    geometry_proven:false,print_scale_proven:false,units:'mm',
    method:'stable_three_normal_ray_support',
    candidates,curve_flatness_mm:flatness,
    candidate_count:candidates.length,total_candidate_count:detected,
    examined_windows:examinedWindows,
    skipped_corners:skippedCorners,
    skipped_tapers:skippedTapers,
    skipped_ambiguous:skippedAmbiguous,
    truncated,warnings:[
      'local_samples_can_miss_thinner_regions_between_samples',
      'not_exact_medial_axis_or_full_minimum_thickness',
      'printing_technique_and_artwork_scale_require_independent_attestation',
      'not_a_production_quality_verdict',
      ...(truncated?['truncated_candidates_require_manual_review']:[])
    ]
  };
}
