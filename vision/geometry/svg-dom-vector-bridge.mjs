/**
 * Experimental SVG tree adapter C3B.3: nested <g> matrices -> physical
 * millimetre corridor candidates. Only fully explicit inline opaque paths.
 * No CSS, no use, no clipPath, no filters, no raster, no text or stroke.
 * DO NOT pass untrusted HTML. Caller must first parse valid SVG XML and
 * independently verify artwork identity and final order placement.
 *
 * These source restrictions are intentionally stronger than SVG 2 rules.
 * Any unsupported child/attribute => MANUAL, never drop it silently.
 */
import {inspectSvgDocumentViewport} from './svg-viewport.mjs';
import {parseClosedSvgPath} from './svg-path-subset.mjs';
import {inspectVectorCorridors} from './vector-corridors.mjs';

const reject=(reason,more={})=>({
  schema:"printcheck.vision.svg-dom-bridge.v1",status:"MANUAL",
  reason,candidates:[],print_scale_proven:false,geometry_proven:false,...more
});
const finite = v=>typeof v==="number"&&Number.isFinite(v);
const mul = (m,n)=>[
  m[0]*n[0]+m[2]*n[1],m[1]*n[0]+m[3]*n[1],
  m[0]*n[2]+m[2]*n[3],m[1]*n[2]+m[3]*n[3],
  m[0]*n[4]+m[2]*n[5]+m[4],
  m[1]*n[4]+m[3]*n[5]+m[5]
];
const identity=[1,0,0,1,0,0];
const invertible=m=>Array.isArray(m)&&m.length===6&&m.every(finite)&&
  Math.abs(m[0]*m[3]-m[1]*m[2])>1e-14;
const limit=m=>m.every(x=>Math.abs(x)<=1e8);
const point=(p,m)=>({x:m[0]*p.x+m[2]*p.y+m[4],y:m[1]*p.x+m[3]*p.y+m[5]});
const scaleBound=m=>Math.hypot(Math.hypot(m[0],m[1]),Math.hypot(m[2],m[3]));
const allowedRoot=new Set(['width','height','viewBox','preserveAspectRatio','xmlns','version','id']);
const allowedGroup=new Set(['transform','fill','fill-rule','stroke','id']);
const allowedPath=new Set(['d','transform','fill','fill-rule','stroke','id']);
function attrsAllowed(element,allowed){
  const names=typeof element.getAttributeNames==="function"?
    element.getAttributeNames():null;
  return Array.isArray(names)&&names.every(name=>allowed.has(name));
}
/**
 * Whitelisted SVG affine transform syntax, preserving document order.
 * Unrecognized transforms and malformed argument sequences => rejection.
 */
export function parseSvgAffineTransform(value){
  if(value===null||value===undefined)return identity.slice();
  if(typeof value!=="string"||!value.trim()||value.length>512)return null;
  const re=/([A-Za-z]+)\s*\(\s*([^)]*?)\s*\)/g;
  const num=/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;
  let i=0,m=identity.slice(),match,count=0;
  while((match=re.exec(value))){
    if(!/^[\s,]*$/.test(value.slice(i,match.index)))return null;
    i=re.lastIndex;count++;
    if(count>24)return null;
    const values=match[2].trim().split(/[\s,]+/);
    if(values.some(s=>!num.test(s)))return null;
    const a=values.map(Number);
    if(!a.every(finite)||a.some(n=>Math.abs(n)>1e8))return null;
    let t;
    if(match[1]==="matrix"&&a.length===6)t=a;
    else if(match[1]==="translate"&&(a.length===1||a.length===2))
      t=[1,0,0,1,a[0],a[1]??0];
    else if(match[1]==="scale"&&(a.length===1||a.length===2))
      t=[a[0],0,0,a[1]??a[0],0,0];
    else if(match[1]==="rotate"&&(a.length===1||a.length===3)){
      const radians=a[0]*Math.PI/180,cs=Math.cos(radians),sn=Math.sin(radians);
      const rotation=[cs,sn,-sn,cs,0,0];
      t=a.length===1?rotation:
        mul(mul([1,0,0,1,a[1],a[2]],rotation),[1,0,0,1,-a[1],-a[2]]);
    }else return null;
    m=mul(m,t);
    if(!limit(m))return null;
  }
  if(count===0||!/^[\s,]*$/.test(value.slice(i))||!invertible(m))return null;
  return m;
}
function boxOf(contours){
  const pts=contours.flatMap(r=>r.points);
  return {
    xmin:Math.min(...pts.map(p=>p.x)),xmax:Math.max(...pts.map(p=>p.x)),
    ymin:Math.min(...pts.map(p=>p.y)),ymax:Math.max(...pts.map(p=>p.y))
  };
}
export function inspectSvgTree(context={}){
  const root=context.root,doc=inspectSvgDocumentViewport(root);
  if(doc.status!=="DOCUMENT_COORDINATES_ONLY")
    return reject("SVG_DOCUMENT_UNSUPPORTED",{detail:doc.reason});
  if(!attrsAllowed(root,allowedRoot))return reject("SVG_ROOT_ATTRIBUTES_UNSUPPORTED");
  const print=context.matrix_document_mm_to_print_mm;
  if(!invertible(print)||!limit(print))
    return reject("SVG_EXPLICIT_PRINT_MATRIX_REQUIRED");
  const mm=doc.svg_units_to_mm;
  const origin=doc.viewBox;
  const viewport=[mm,0,0,mm,-origin.minX*mm,-origin.minY*mm];
  const svgToPrint=mul(print,viewport);
  const eps=context.curve_flatness_mm??0.002;
  if(!finite(eps)||eps<=0||eps>0.02)return reject("SVG_FLATTEN_ERROR_INVALID");
  const stack=[{node:root,matrix:svgToPrint,fill:null,rule:null,depth:0}];
  const shapes=[],boxes=[];let paths=0,groups=0,segments=0,color=null;
  while(stack.length){
    const {node,matrix,fill,rule,depth}=stack.pop();
    if(depth>16)return reject("SVG_TREE_DEPTH_EXCEEDED");
    const name=node.localName;
    if(name==="title"||name==="desc"){
      if(node.children?.length)return reject("SVG_METADATA_NESTED_ELEMENTS");
      continue;
    }
    const isRoot=node===root;
    if(!isRoot&&name!=="g"&&name!=="path")
      return reject("SVG_CHILD_UNSUPPORTED",{element:name});
    if(!isRoot && !attrsAllowed(node,name==="g"?allowedGroup:allowedPath))
      return reject("SVG_CHILD_ATTRIBUTES_UNSUPPORTED",{element:name});
    const get=key=>node.getAttribute(key);
    const ownMatrix=isRoot?identity:parseSvgAffineTransform(get("transform"));
    if(!ownMatrix)return reject("SVG_GROUP_TRANSFORM_UNSUPPORTED",{element:name});
    const nextMatrix=mul(matrix,ownMatrix);
    if(!invertible(nextMatrix)||!limit(nextMatrix))
      return reject("SVG_GROUP_TRANSFORM_DEGENERATE");
    const nextFill=get("fill")??fill,nextRule=get("fill-rule")??rule;
    if(get("stroke")!==null && get("stroke")!=="none")
      return reject("SVG_STROKE_UNSUPPORTED");
    if(name==="path"){
      paths++;
      if(paths>128)return reject("SVG_PATH_BUDGET_EXCEEDED");
      if(typeof nextFill!=="string"||!/^#[0-9a-f]{6}$/i.test(nextFill))
        return reject("SVG_EXPLICIT_SOLID_FILL_REQUIRED");
      if(color===null)color=nextFill.toLowerCase();
      if(color!==nextFill.toLowerCase())
        return reject("SVG_DIFFERENT_INKS_REQUIRE_SEPARATION");
      const upper=scaleBound(nextMatrix);
      if(!(upper>1e-10))return reject("SVG_MATRIX_SCALE_INVALID");
      const parsed=parseClosedSvgPath(get("d"),{
        flatness_user_units:Math.min(10,eps/upper)
      });
      if(parsed.status!=="CONTOURS_ONLY")
        return reject("SVG_PATH_GEOMETRY_UNSUPPORTED",{detail:parsed.reason});
      const fillRule=nextRule??"nonzero";
      if(fillRule!=="evenodd" && !(fillRule==="nonzero"&&parsed.contours.length===1))
        return reject("SVG_COMPLEX_FILL_RULE_UNSUPPORTED");
      const rings=parsed.contours.map(r=>({points:r.points.map(p=>point(p,nextMatrix))}));
      const box=boxOf(rings);
      const guard=Math.max(1e-5,eps*2);
      for(const other of boxes){
        const dx=Math.max(other.xmin-box.xmax,box.xmin-other.xmax);
        const dy=Math.max(other.ymin-box.ymax,box.ymin-other.ymax);
        if(dx<=guard&&dy<=guard)
          return reject("SVG_PATHS_OVERLAP_OR_PROXIMITY_UNVERIFIED");
      }
      boxes.push(box);shapes.push(...rings);
      segments+=parsed.curve_segments;
    } else {
      if(name==="g")groups++;
      const children=node.children;
      if(!children||typeof children.length!=="number")
        return reject("SVG_TREE_CHILDREN_UNAVAILABLE");
      if(children.length>512)return reject("SVG_TREE_CHILD_LIMIT");
      for(let k=children.length-1;k>=0;k--){
        stack.push({node:children[k],matrix:nextMatrix,
          fill:nextFill,rule:nextRule,depth:depth+1});
      }
      if(stack.length>2048)return reject("SVG_TREE_NODE_LIMIT");
    }
  }
  if(paths===0)return reject("SVG_NO_PAINTED_PATHS");
  const measured=inspectVectorCorridors({
    contours:shapes,matrix_svg_to_mm:identity,
    fill_rule:"evenodd",curve_flatness_mm:eps,
    max_candidate_mm:context.max_candidate_mm
  });
  if(measured.status!=="RESEARCH_CANDIDATES_ONLY")
    return reject("SVG_VECTOR_GEOMETRY_UNSUPPORTED",{detail:measured.reason});
  return {
    ...measured,schema:"printcheck.vision.svg-dom-bridge.v1",
    status:"RESEARCH_CANDIDATES_ONLY",
    print_scale_proven:false,geometry_proven:false,
    svg_document_scale_proven:true,paths_count:paths,groups_count:groups,
    curve_segments:segments,source_matrix_document_to_print_mm:print.slice(),
    warnings:[...measured.warnings,
      "svg_tree_subset_not_complete_svg2",
      "document_scale_is_not_authorized_order_placement",
      "never_conclude_approved_from_research_candidates"]
  };
}
