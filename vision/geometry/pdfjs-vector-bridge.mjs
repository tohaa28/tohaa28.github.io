/**
 * PrintCheck Vision C3B.2 — fail-closed bridge from the EXISTING Maketnaya
 * PDF.js vector importer (assets/logo-pdf-import.js, .convert()) to local
 * parallel-corridor research measurements.
 *
 * Input is the *already converted* {shapes} object, not arbitrary PDF bytes.
 * Any importer warning must abort conversion before calling this bridge.
 * Full PDF parsing, XRef, encryption, fonts, transparency, image raster and
 * clipping are not implemented in this module.
 *
 * Coordinate model:
 *   page PDF user units --PDFjs viewport--> screen units
 *   local path --shape.transform--> screen units
 *   screen --inverse viewport--> PDF page user units
 *   PDF page --page_to_print_mm--> final placement millimetres
 *
 * The physical print matrix is explicitly provided for RESEARCH only; its
 * link to the actual order, constructor and artwork is not verified here.
 */
import {parseClosedSvgPath} from './svg-path-subset.mjs';
import {inspectVectorCorridors} from './vector-corridors.mjs';

const fail=(reason,extra={})=>Object.freeze({
  schema:'printcheck.vision.pdf-vector-bridge.v1',
  status:'MANUAL',reason,print_scale_proven:false,
  geometry_proven:false,candidates:[],...extra
});
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const mul=(a,b)=>[
  a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],
  a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],
  a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]
];
function inverse(m){
  const [a,b,c,d,e,f]=m,det=a*d-b*c;
  if(!Number.isFinite(det)||Math.abs(det)<1e-14)return null;
  return [
    d/det,-b/det,-c/det,a/det,
    (c*f-d*e)/det,(b*e-a*f)/det
  ];
}
function matrixAttr(raw){
  if(typeof raw!=='string')return null;
  const m=/^matrix\(\s*([^)]+)\s*\)$/.exec(raw.trim());
  if(!m)return null;
  const nums=m[1].trim().split(/[\s,]+/).map(Number);
  return nums.length===6&&nums.every(finite)?nums:null;
}
function validMatrix(m){
  return Array.isArray(m)&&m.length===6&&m.every(finite)&&
    m.every(n=>Math.abs(n)<=1e8);
}
function operatorNorm(m){
  const [a,b,c,d]=m;
  const col1=Math.hypot(a,b),col2=Math.hypot(c,d);
  return Math.hypot(col1,col2); // upper bound on 2-norm
}
function mapPoint(p,m){
  return {x:m[0]*p.x+m[2]*p.y+m[4],y:m[1]*p.x+m[3]*p.y+m[5]};
}

/**
 * @param {{
 *  converted:{shapes:Array<object>,width:number,height:number},
 *  viewport_transform:Array<number>,page_to_print_mm:Array<number>,
 *  curve_flatness_mm?:number,max_candidate_mm?:number,
 *  min_support_mm?:number
 * }} context
 */
export function inspectConvertedPdfVectors(context={}) {
  const result=context.converted;
  if(!result||!Array.isArray(result.shapes)||result.shapes.length!==1)
    return fail('PDF_SINGLE_PAINTED_SHAPE_REQUIRED');
  if(!validMatrix(context.viewport_transform)||
     !validMatrix(context.page_to_print_mm))
    return fail('PDF_EXPLICIT_VIEWPORT_AND_PLACEMENT_REQUIRED');
  if(!finite(result.width)||!finite(result.height)||
     result.width<=0||result.height<=0)
    return fail('PDF_PAGE_SIZE_REQUIRED');
  const viewInverse=inverse(context.viewport_transform);
  if(!viewInverse)return fail('PDF_VIEWPORT_NOT_INVERTIBLE');
  const shape=result.shapes[0];
  if(!shape || typeof shape.d!=='string')
    return fail('PDF_VECTOR_PATH_REQUIRED');
  // No automatic stroke-width conversion: cap/join/dash change topology.
  if(shape.stroke!=='none'||!shape.fill||shape.fill==='none'||
     /url\(|pattern|gradient|transparent/i.test(shape.fill))
    return fail('PDF_SOLID_FILLED_ONLY');
  if(shape.opacity!==undefined||shape['clip-path']!==undefined||
     shape.mask!==undefined||shape.filter!==undefined)
    return fail('PDF_EFFECTS_OR_CLIPPING_UNSUPPORTED');
  const localScreen=matrixAttr(shape.transform);
  if(!localScreen)return fail('PDF_SHAPE_MATRIX_REQUIRED');
  const finalMm=mul(context.page_to_print_mm,mul(viewInverse,localScreen));
  if(!finalMm.every(finite)||!inverse(finalMm))
    return fail('PDF_COMPOSED_TRANSFORM_INVALID');
  const accuracy=context.curve_flatness_mm??0.002;
  if(!finite(accuracy)||accuracy<=0||accuracy>0.02)
    return fail('PDF_CURVE_ERROR_BUDGET_INVALID');
  const maximumScale=operatorNorm(finalMm);
  if(!(maximumScale>1e-10))
    return fail('PDF_COMPOSED_TRANSFORM_INVALID');
  const path=parseClosedSvgPath(shape.d,{
    flatness_user_units:Math.min(10,accuracy/maximumScale)
  });
  if(path.status!=='CONTOURS_ONLY')
    return fail('PDF_VECTOR_PATH_UNSUPPORTED',{detail: path.reason});
  const evenodd=shape['fill-rule']==='evenodd';
  const nonzero=shape['fill-rule']===undefined||shape['fill-rule']==='nonzero';
  if(!evenodd&&!(nonzero&&path.contours.length===1))
    return fail('PDF_COMPLEX_FILL_RULE_UNSUPPORTED');
  const mapped=path.contours.map(ring=>({
    points:ring.points.map(p=>mapPoint(p,finalMm))
  }));
  const measured=inspectVectorCorridors({
    contours:mapped,matrix_svg_to_mm:[1,0,0,1,0,0],
    fill_rule:'evenodd',curve_flatness_mm:accuracy,
    max_candidate_mm:context.max_candidate_mm,
    min_support_mm:context.min_support_mm
  });
  if(measured.status!=='RESEARCH_CANDIDATES_ONLY')
    return fail('PDF_VECTOR_GEOMETRY_UNSUPPORTED',{detail:measured.reason});
  return {
    ...measured,
    schema:'printcheck.vision.pdf-vector-bridge.v1',
    origin:'gwbImportPdfVector.convert / PDFjs operator list',
    status:'RESEARCH_CANDIDATES_ONLY',
    print_scale_proven:false,geometry_proven:false,
    source_matrix_pdf_to_print_mm:context.page_to_print_mm.slice(),
    source_matrix_viewport:context.viewport_transform.slice(),
    path_curve_segments:path.curve_segments,
    warnings:[
      ...measured.warnings,
      'pdf_importer_must_have_rejected_all_unsupported_paints',
      'pdf_page_to_print_matrix_not_certified_by_order',
      'not_a_pdf_binary_parser_and_no_production_verdict'
    ]
  };
}
