/**
 * C3B.3.N2: research-only, source-geometry separation of fully disjoint
 * SVG solid fills. RGB fill literals are NOT Pantone/CMYK print separations.
 *
 * This helper does NOT combine inks. AABB overlap (including touching)
 * between different fills refuses all results rather than assuming knockout,
 * overprint, opacity or final composite semantics.
 */
import {inspectSvgTree} from './svg-dom-vector-bridge.mjs';
import {parseClosedSvgPath} from './svg-path-subset.mjs';

const no=(reason)=>({status:'MANUAL',reason});
function bboxOfPath(path){
  const m=path.matrixDocumentMm;
  if(!Array.isArray(m)||m.length!==6||m.some(x=>!Number.isFinite(x)))
    return null;
  const largest=Math.hypot(Math.hypot(m[0],m[1]),Math.hypot(m[2],m[3]));
  if(!(largest>1e-12))return null;
  const parsed=parseClosedSvgPath(path.d,{
    flatness_user_units:Math.min(10,.002/largest),
    max_segments:768
  });
  if(parsed.status!=='CONTOURS_ONLY')return null;
  const points=parsed.contours.flatMap(r=>r.points);
  if(!points.length||points.length>768)return null;
  const xy=points.map(p=>({
    x:m[0]*p.x+m[2]*p.y+m[4],
    y:m[1]*p.x+m[3]*p.y+m[5]
  }));
  if(xy.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))
    return null;
  return {
    minX:Math.min(...xy.map(p=>p.x)),maxX:Math.max(...xy.map(p=>p.x)),
    minY:Math.min(...xy.map(p=>p.y)),maxY:Math.max(...xy.map(p=>p.y)),
    count:xy.length
  };
}
export function inspectDisjointSvgInkForms(root,paths,{
  maxCandidateMm=3,includeCurvedProbes=false
}={}){
  if(!root||!Array.isArray(paths)||paths.length<2||paths.length>128)
    return no('VECTOR_MULTICOLOR_SOURCE_INVALID');
  const inks=[...new Set(paths.map(p=>p.fill?.toLowerCase()))];
  if(inks.length<2||inks.length>8||
     inks.some(v=>typeof v!=='string'||!/^#[a-f0-9]{6}$/.test(v)))
    return no('VECTOR_MULTICOLOR_INKS_UNSUPPORTED');
  const boxes=paths.map(bboxOfPath);
  if(boxes.some(v=>v===null)||
     boxes.reduce((n,v)=>n+v.count,0)>768)
    return no('VECTOR_MULTICOLOR_GEOMETRY_BUDGET');
  const EPS=.004;
  for(let i=0;i<paths.length;i++)for(let j=i+1;j<paths.length;j++){
    if(paths[i].fill.toLowerCase()===paths[j].fill.toLowerCase())continue;
    const a=boxes[i],b=boxes[j];
    if(a.minX<=b.maxX+EPS&&b.minX<=a.maxX+EPS&&
       a.minY<=b.maxY+EPS&&b.minY<=a.maxY+EPS)
      return no('VECTOR_DIFFERENT_INKS_OVERLAP_OR_TOUCH');
  }
  const results=[],candidates=[],curved=[];
  for(const ink of inks){
    const clone=root.cloneNode(true);
    const selected=Array.from(clone.getElementsByTagNameNS(
      'http://www.w3.org/2000/svg','path'));
    if(selected.length!==paths.length)
      return no('VECTOR_MULTICOLOR_TREE_MISMATCH');
    for(let i=selected.length-1;i>=0;i--)
      if(paths[i].fill.toLowerCase()!==ink)selected[i].remove();
    const measured=inspectSvgTree({
      root:clone,matrix_document_mm_to_print_mm:[1,0,0,1,0,0],
      max_candidate_mm:maxCandidateMm,
      include_curved_probes:includeCurvedProbes,curve_flatness_mm:.002
    });
    if(measured.status!=='RESEARCH_CANDIDATES_ONLY')
      return no('VECTOR_MULTICOLOR_FORM_UNSUPPORTED:'+measured.reason);
    results.push({
      source_rgb_ink:ink,paths_count:measured.paths_count,
      candidate_count:measured.candidates.length,
      truncated:measured.truncated===true
    });
    candidates.push(...measured.candidates.map(x=>({...x,source_rgb_ink:ink})));
    if(measured.curved_probes?.candidates)
      curved.push(...measured.curved_probes.candidates.map(x=>({
        ...x,source_rgb_ink:ink
      })));
  }
  return {
    status:'RESEARCH_CANDIDATES_ONLY',
    paths_count:paths.length,
    groups_count:0,
    vertex_count:boxes.reduce((sum,b)=>sum+b.count,0),
    curve_segments:null,
    candidates:candidates.sort((a,b)=>a.measured_mm-b.measured_mm),
    curved_probes:{candidates:curved},
    separated_ink_forms:results,
    print_scale_proven:false,geometry_proven:false,
    inks_verified_as_print_spots:false,production_approved:false
  };
}
