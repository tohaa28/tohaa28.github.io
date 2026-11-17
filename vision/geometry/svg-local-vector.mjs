/**
 * C3B.3.N — validated LOCAL SVG -> exact-source vector-mm corridor inspection.
 *
 * The source is parsed as isolated XML, never inserted into the live page.
 * Only the strict existing SVG DOM bridge's subset is eligible. No raster
 * or AI probability participates in measurement. Missing print placement
 * is deliberately NOT inferred from SVG width/height.
 */
import {inspectSvgTree,parseSvgAffineTransform} from './svg-dom-vector-bridge.mjs';
import {inspectSvgDocumentViewport} from './svg-viewport.mjs';

const SVG_NS='http://www.w3.org/2000/svg';
const failure=(reason,detail)=>({
  status:'MANUAL',schema:'printcheck.vision.local-svg-vector.v1',
  reason,...(detail?{detail}:{}),production_approved:false,
  print_scale_proven:false,geometry_proven:false
});
const mult=(a,b)=>[
  a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],
  a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],
  a[0]*b[4]+a[2]*b[5]+a[4],
  a[1]*b[4]+a[3]*b[5]+a[5]
];
function validateDom(doc){
  if(!doc?.documentElement||doc.getElementsByTagName('parsererror').length)
    return 'SVG_XML_PARSE_ERROR';
  const root=doc.documentElement;
  if(root.localName!=='svg'||root.namespaceURI!==SVG_NS)
    return 'SVG_NAMESPACE_REQUIRED';
  const work=[root];
  let count=0;
  while(work.length){
    const node=work.pop();
    if(++count>512)return 'SVG_XML_NODE_LIMIT';
    if(node.namespaceURI!==SVG_NS||node.prefix)
      return 'SVG_FOREIGN_NAMESPACE_OR_PREFIX';
    const allowMetadata=node.localName==='title'||node.localName==='desc';
    for(const child of node.childNodes){
      if(child.nodeType===1)work.push(child);
      else if(child.nodeType===3){
        if(!allowMetadata&&child.nodeValue.trim())
          return 'SVG_NONWHITESPACE_TEXT_UNSUPPORTED';
      }else return 'SVG_XML_NODE_TYPE_UNSUPPORTED';
    }
  }
  return null;
}
function previewPaths(root,mmPerUser,viewBox){
  const viewport=[mmPerUser,0,0,mmPerUser,
    -viewBox.minX*mmPerUser,-viewBox.minY*mmPerUser];
  const work=[{node:root,matrix:viewport,fill:null,rule:'nonzero'}];
  const paths=[];
  while(work.length){
    const {node,matrix,fill,rule}=work.pop();
    const mine=node===root?[1,0,0,1,0,0]:
      parseSvgAffineTransform(node.getAttribute('transform'));
    if(!mine)throw Error('UNSUPPORTED_SVG_TRANSFORM');
    const nextMatrix=mult(matrix,mine);
    const nextFill=node.getAttribute('fill')??fill;
    const nextRule=node.getAttribute('fill-rule')??rule;
    if(node.localName==='path'){
      paths.push({
        d:node.getAttribute('d'),fill:nextFill,fillRule:nextRule,
        matrixDocumentMm:nextMatrix
      });
    }else{
      const kids=node.children;
      for(let i=kids.length-1;i>=0;i--)
        if(kids[i].localName!=='title'&&kids[i].localName!=='desc')
          work.push({node:kids[i],matrix:nextMatrix,
            fill:nextFill,rule:nextRule});
    }
  }
  return paths;
}
export function inspectLocalSvgVector(source,{
  DOMParserClass=globalThis.DOMParser,
  maxCandidateMm=3,includeCurvedProbes=false
}={}){
  if(typeof source!=='string'||!source.trim()||
      source.length>256_000)return failure('SVG_SOURCE_SIZE_UNSUPPORTED');
  if(/<!|<\?|&|[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(source)||
     /(?:https?:|file:|data:|javascript:)/i.test(source))
    return failure('SVG_XML_OR_EXTERNAL_FEATURE_UNSUPPORTED');
  if(typeof DOMParserClass!=='function')return failure('XML_PARSER_UNAVAILABLE');
  if(typeof maxCandidateMm!=='number'||!Number.isFinite(maxCandidateMm)||
      maxCandidateMm<=0||maxCandidateMm>20||typeof includeCurvedProbes!=='boolean')
    return failure('VECTOR_SCAN_SETTINGS_INVALID');
  let doc;
  try{doc=new DOMParserClass().parseFromString(source,'image/svg+xml')}
  catch{return failure('SVG_XML_PARSE_ERROR')}
  const err=validateDom(doc);
  if(err)return failure(err);
  const viewport=inspectSvgDocumentViewport(doc.documentElement);
  if(viewport.status!=='DOCUMENT_COORDINATES_ONLY')
    return failure('SVG_DOCUMENT_VIEWPORT_UNSUPPORTED',viewport.reason);
  // Identity means "document mm"; NOT proof that the logo was placed at
  // 100% in the actual Gifts order. This never grants production approval.
  const measured=inspectSvgTree({
    root:doc.documentElement,
    matrix_document_mm_to_print_mm:[1,0,0,1,0,0],
    include_curved_probes:includeCurvedProbes,
    max_candidate_mm:maxCandidateMm,curve_flatness_mm:0.002
  });
  if(measured.status!=='RESEARCH_CANDIDATES_ONLY')
    return failure('SVG_VECTOR_GEOMETRY_UNSUPPORTED',measured.reason);
  let paths;
  try{paths=previewPaths(doc.documentElement,
    viewport.svg_units_to_mm,viewport.viewBox)}
  catch{return failure('SVG_PREVIEW_COORDINATES_UNSUPPORTED')}
  const c=measured.candidates.map(({kind,measured_mm,uncertainty_mm,
    at_mm,local_support_mm,method})=>({
      kind,measured_mm,uncertainty_mm,at_mm,local_support_mm,method
    }));
  const curved=measured.curved_probes?.candidates?.map(x=>({
    kind:x.kind,measured_mm:x.measured_mm,
    uncertainty_mm:x.uncertainty_mm,at_mm:x.at_mm,
    local_support_mm:x.local_support_mm,method:x.method
  }))??[];
  const report={
    schema:'printcheck.vision.local-svg-vector.v1',
    status:'RESEARCH_VECTOR_CANDIDATES_ONLY',
    source_format:'SVG',width_document_mm:viewport.width_mm,
    height_document_mm:viewport.height_mm,
    paths_count:measured.paths_count,groups_count:measured.groups_count,
    curve_segments:measured.curve_segments,vertex_count:measured.vertex_count,
    candidate_count:c.length,candidates:c,
    curved_candidates:curved,include_curved_probes:includeCurvedProbes,
    max_candidate_mm:maxCandidateMm,
    source_document_scale_declared:true,
    actual_artwork_placement_scale_proven:false,
    print_scale_proven:false,geometry_proven:false,production_approved:false,
    full_svg2_supported:false,complete_artwork_minimum_proven:false,
    report_contains_vector_source:false,
    warning:'Local candidates use SVG-declared physical dimensions only; print placement and minimum-feature completeness are unverified'
  };
  return {status:report.status,report,localPreviewPaths:paths};
}
