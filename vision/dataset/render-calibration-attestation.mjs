/**
 * PrintCheck Vision C3B.3.J — signed renderer provenance and mm calibration.
 *
 * This verifier does NOT rasterize PDF/SVG or assert that PNG pixels equal
 * the original artwork. It proves exact input-byte identity to an independent
 * pinned Ed25519 signed renderer receipt and checks geometry/anchors against
 * explicit source metadata. True print scale still requires an authorized
 * Gifts order snapshot and independent inspection of its contents.
 */
import {createHash,createPublicKey,verify} from 'node:crypto';
import {decodeTrustedPngBytes} from './strict-png-decoder.mjs';

const HASH=/^[a-f0-9]{64}$/i;
const ID=/^[A-Za-z0-9._-]{1,64}$/;
const sha=b=>createHash('sha256').update(b).digest('hex');
const bytes=x=>Buffer.isBuffer(x)||x instanceof Uint8Array;
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const pos=x=>finite(x)&&x>0;
const manual=reason=>({
  schema:'printcheck.vision.render-calibration-check.v1',
  status:'MANUAL',reason,production_approved:false,
  render_pixels_independently_verified:false,print_scale_proven:false
});
const exact=(o,keys)=>o&&typeof o==='object'&&!Array.isArray(o)&&
  Object.keys(o).length===keys.length&&
  Object.keys(o).every(k=>keys.includes(k));
const near=(a,b,tol)=>Math.abs(a-b)<=tol;
const transform=(m,p)=>[
  m[0]*p[0]+m[2]*p[1]+m[4],
  m[1]*p[0]+m[3]*p[1]+m[5]
];
const matrix=m=>Array.isArray(m)&&m.length===6&&
  m.every(x=>finite(x)&&Math.abs(x)<=1e8);
function det(m){return m[0]*m[3]-m[1]*m[2]}
function pdfExpected(box,rotation,w,h){
  const [x0,y0,x1,y1]=box,sw=x1-x0,sh=y1-y0;
  if(sw<=0||sh<=0)return null;
  const logicalW=rotation%180===0?sw:sh;
  const logicalH=rotation%180===0?sh:sw;
  const sx=w/logicalW,sy=h/logicalH;
  if(!pos(sx)||Math.abs(sx-sy)>1e-6*Math.max(sx,sy))
    return null;
  const s=(sx+sy)/2;
  if(rotation===0)return [s,0,0,-s,-s*x0,s*y1];
  if(rotation===90)return [0,s,s,0,-s*y0,-s*x0];
  if(rotation===180)return [-s,0,0,s,s*x1,-s*y0];
  return [0,-s,-s,0,s*y1,s*x1];
}
function svgExpected(box,w,h){
  const [x,y,vw,vh]=box;
  if(!(vw>0&&vh>0))return null;
  const sx=w/vw,sy=h/vh;
  if(!pos(sx)||!pos(sy)||Math.abs(sx-sy)>1e-6*Math.max(sx,sy))
    return null;
  const s=(sx+sy)/2;
  return [s,0,0,s,-x*s,-y*s];
}
/**
 * Intentionally narrow SVG root parser; this is NOT a general SVG parser.
 * Reject XML entities, DOCTYPE and namespaces other than standard SVG.
 * Root width/height must use explicit physical units; SVG content still
 * requires separate trusted rendering and full paint-operator validation.
 */
function svgRootGeometry(raw){
  let src;
  try{src=new TextDecoder('utf-8',{fatal:true}).decode(raw)}
  catch{return null}
  if(src.length>8_000_000||/<!|&[a-zA-Z#]/.test(src)||
     /<\s*(?:script|foreignObject|image|use|style)\b/i.test(src)||
     /(?:href|url\(|@import)\s*[:=(]/i.test(src))return null;
  const prefix=src.replace(/^\uFEFF/,'').replace(
    /^\s*<\?xml\s+[^?]*\?>\s*/i,'');
  const opening=/^\s*<svg\b([^<>]*)>/i.exec(prefix);
  if(!opening||!/<\/svg\s*>\s*$/i.test(prefix))return null;
  const attrs=new Map(),body=opening[1];
  const re=/([A-Za-z_:][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let last=0,m;
  while((m=re.exec(body))){
    if(!/^\s*$/.test(body.slice(last,m.index))||attrs.has(m[1]))
      return null;
    attrs.set(m[1],m[2]??m[3]);last=re.lastIndex;
  }
  if(!/^\s*$/.test(body.slice(last)))return null;
  const allowed=new Set(['xmlns','width','height','viewBox',
    'preserveAspectRatio','version','id']);
  if([...attrs.keys()].some(k=>!allowed.has(k))||
     attrs.get('xmlns')!=='http://www.w3.org/2000/svg'||
     !['xMidYMid meet','xMidYMid'].includes(
       attrs.get('preserveAspectRatio')??'xMidYMid meet'))
    return null;
  const length=x=>{
    const m=/^([0-9]+(?:\.[0-9]+)?)\s*(mm|cm|in|pt)$/.exec(x??'');
    if(!m)return null;
    return Number(m[1])*({mm:1,cm:10,in:25.4,pt:25.4/72}[m[2]]);
  };
  const w=length(attrs.get('width')),h=length(attrs.get('height'));
  const vb=(attrs.get('viewBox')??'').trim().split(/[\s,]+/).map(Number);
  if(!pos(w)||!pos(h)||w>50000||h>50000||
     vb.length!==4||vb.some(v=>!finite(v))||
     !pos(vb[2])||!pos(vb[3])||
     Math.abs(w/vb[2]-h/vb[3])>1e-6*Math.max(w/vb[2],h/vb[3]))
    return null;
  return {viewBox:vb,document_size_mm:[w,h]};
}
const calibrationKeys=['schema','source_sha256','preview_sha256',
  'order_evidence_sha256','source_format','page_index','render_engine',
  'preview_pixel_dimensions','source_page_box','pdf_user_unit',
  'page_rotation_degrees','source_document_size_mm',
  'source_to_preview_px','source_to_field_mm',
  'field_size_mm','mirror_authorized','color_pipeline','anchors'];
const renderKeys=['engine_id','engine_version','engine_binary_sha256'];
const colorKeys=['source_color_state','output_encoding','conversion_profile_sha256'];
const anchorKeys=['source_xy','preview_xy','field_mm_xy'];
const isXY=v=>Array.isArray(v)&&v.length===2&&v.every(finite);
function verifyReceiptStructure(r,decoded){
  if(!exact(r,calibrationKeys)||
     r.schema!=='printcheck.vision.render-calibration.v1'||
     !HASH.test(r.source_sha256??'')||
     !HASH.test(r.preview_sha256??'')||
     !HASH.test(r.order_evidence_sha256??'')||
     !['svg','pdf'].includes(r.source_format)||
     !Number.isSafeInteger(r.page_index)||r.page_index<0||
     !exact(r.render_engine,renderKeys)||
     !ID.test(r.render_engine.engine_id??'')||
     !ID.test(r.render_engine.engine_version??'')||
     !HASH.test(r.render_engine.engine_binary_sha256??'')||
     !exact(r.color_pipeline,colorKeys)||
     r.color_pipeline.output_encoding!=='unprofiled_rgb8'||
     !['explicit_srgb','externally_attested_profile'].includes(
        r.color_pipeline.source_color_state)||
     !HASH.test(r.color_pipeline.conversion_profile_sha256??'')||
     !isXY(r.preview_pixel_dimensions)||
     r.preview_pixel_dimensions[0]!==decoded.width||
     r.preview_pixel_dimensions[1]!==decoded.height||
     !Array.isArray(r.source_page_box)||
     r.source_page_box.length!==4||
     !r.source_page_box.every(finite)||
     !pos(r.source_page_box[2])||!pos(r.source_page_box[3])||
     !isXY(r.source_document_size_mm)||
     r.source_document_size_mm.some(x=>!pos(x)||x>50000)||
     !isXY(r.field_size_mm)||
     r.field_size_mm.some(x=>!pos(x)||x>50000)||
     !matrix(r.source_to_preview_px)||
     !matrix(r.source_to_field_mm)||
     typeof r.mirror_authorized!=='boolean'||
     !Array.isArray(r.anchors)||r.anchors.length<5||r.anchors.length>32||
     r.anchors.some(a=>!exact(a,anchorKeys)||
       !isXY(a.source_xy)||!isXY(a.preview_xy)||!isXY(a.field_mm_xy)))
    return false;
  if(r.source_format==='svg'&&(
      r.pdf_user_unit!==null||r.page_rotation_degrees!==0||
      r.page_index!==0))
    return false;
  if(r.source_format==='pdf'&&(
      !pos(r.pdf_user_unit)||r.pdf_user_unit>75||
      ![0,90,180,270].includes(r.page_rotation_degrees)))
    return false;
  return true;
}
function checkAffineAnchors(r){
  const source=r.source_page_box;
  const pageMin=[source[0],source[1]];
  const pageMax=[source[0]+source[2],source[1]+source[3]];
  const expected=r.source_format==='svg'?
    svgExpected(source,...r.preview_pixel_dimensions):
    pdfExpected([
      pageMin[0],pageMin[1],pageMax[0],pageMax[1]
    ],r.page_rotation_degrees,...r.preview_pixel_dimensions);
  if(!expected||expected.some((v,i)=>!near(v,r.source_to_preview_px[i],
      1e-6*Math.max(1,Math.abs(v)))))
    return 'PREVIEW_VIEWPORT_MATRIX_INVALID';
  const m=r.source_to_field_mm;
  const sx=Math.hypot(m[0],m[1]),sy=Math.hypot(m[2],m[3]);
  const dot=m[0]*m[2]+m[1]*m[3];
  if(!(sx>1e-9&&sy>1e-9)||
     Math.abs(sx-sy)>1e-6*Math.max(sx,sy)||
     Math.abs(dot)>1e-6*sx*sy||
     Math.abs(det(m))<1e-14||
     (det(m)<0&&!r.mirror_authorized))
    return 'NON_UNIFORM_SHEAR_OR_UNAUTHORIZED_MIRROR';
  const [fieldW,fieldH]=r.field_size_mm;
  let lowX=Infinity,highX=-Infinity,lowY=Infinity,highY=-Infinity;
  const seen=[];
  for(const a of r.anchors){
    const [x,y]=a.source_xy;
    if(x<pageMin[0]-1e-7||x>pageMax[0]+1e-7||
       y<pageMin[1]-1e-7||y>pageMax[1]+1e-7)
      return 'ANCHOR_OUTSIDE_SOURCE_PAGE';
    if(seen.some(p=>Math.hypot(p[0]-x,p[1]-y)<1e-7))
      return 'DUPLICATE_SOURCE_ANCHOR';
    seen.push([x,y]);
    lowX=Math.min(lowX,x);highX=Math.max(highX,x);
    lowY=Math.min(lowY,y);highY=Math.max(highY,y);
    const predPx=transform(r.source_to_preview_px,[x,y]);
    const predMm=transform(m,[x,y]);
    if(Math.hypot(predPx[0]-a.preview_xy[0],predPx[1]-a.preview_xy[1])>0.25||
       Math.hypot(predMm[0]-a.field_mm_xy[0],predMm[1]-a.field_mm_xy[1])>0.02)
      return 'LANDMARK_RESIDUAL_TOO_HIGH';
    if(predPx[0]<-0.25||predPx[1]<-0.25||
       predPx[0]>r.preview_pixel_dimensions[0]+0.25||
       predPx[1]>r.preview_pixel_dimensions[1]+0.25)
      return 'ANCHOR_OUTSIDE_PREVIEW';
    if(predMm[0]<-0.02||predMm[1]<-0.02||
       predMm[0]>fieldW+0.02||predMm[1]>fieldH+0.02)
      return 'ANCHOR_OUTSIDE_PRINT_FIELD';
  }
  if((highX-lowX)/source[2]<0.65||
     (highY-lowY)/source[3]<0.65)
    return 'ANCHOR_SPREAD_INSUFFICIENT';
  // Enforce the whole page, not only selected anchors, is contained in field.
  for(const x of [pageMin[0],pageMax[0]]){
    for(const y of [pageMin[1],pageMax[1]]){
      const p=transform(m,[x,y]);
      if(p[0]<-0.02||p[1]<-0.02||
         p[0]>fieldW+0.02||p[1]>fieldH+0.02)
        return 'PRINTED_PAGE_CORNERS_OUTSIDE_FIELD';
    }
  }
  return null;
}
export function verifySignedRenderCalibration(input={}){
  const {sourceBytes,previewPngBytes,orderEvidenceBytes,
    receiptBytes,signatureBytes,trustedPublicKeyPem,trustedSpkiSha256}=input;
  if(![sourceBytes,previewPngBytes,orderEvidenceBytes,
        receiptBytes,signatureBytes].every(bytes)||
     sourceBytes.length===0||sourceBytes.length>64_000_000||
     previewPngBytes.length===0||previewPngBytes.length>25_000_000||
     orderEvidenceBytes.length===0||orderEvidenceBytes.length>8_000_000||
     receiptBytes.length===0||receiptBytes.length>32_768||
     signatureBytes.length!==64)
    return manual('RENDER_SOURCE_OR_SIGNATURE_BYTES_INVALID');
  if(!HASH.test(trustedSpkiSha256??'')||
     typeof trustedPublicKeyPem!=='string'||
     trustedPublicKeyPem.length>8192)
    return manual('RENDER_TRUST_PIN_REQUIRED');
  let key;
  try{key=createPublicKey(trustedPublicKeyPem)}
  catch{return manual('RENDER_PUBLIC_KEY_INVALID')}
  if(key.asymmetricKeyType!=='ed25519'||
     sha(key.export({type:'spki',format:'der'}))!==
       trustedSpkiSha256.toLowerCase())
    return manual('RENDER_TRUST_PIN_MISMATCH');
  if(!verify(null,receiptBytes,key,signatureBytes))
    return manual('RENDER_SIGNATURE_INVALID');
  let r;
  try{r=JSON.parse(Buffer.from(receiptBytes).toString('utf8'))}
  catch{return manual('RENDER_RECEIPT_JSON_INVALID')}
  const decoded=decodeTrustedPngBytes(previewPngBytes);
  if(decoded.status!=='DECODED_STRICT_PNG_ONLY')
    return manual('RENDER_PREVIEW_PNG_UNSUPPORTED');
  if(!verifyReceiptStructure(r,decoded))
    return manual('RENDER_RECEIPT_CONTRACT_INVALID');
  if(sha(sourceBytes)!==r.source_sha256.toLowerCase()||
     sha(previewPngBytes)!==r.preview_sha256.toLowerCase()||
     sha(orderEvidenceBytes)!==r.order_evidence_sha256.toLowerCase())
    return manual('RENDER_CHAIN_SOURCE_DIGEST_MISMATCH');
  if(r.source_format==='pdf'){
    const src=Buffer.from(sourceBytes);
    if(!src.subarray(0,1024).includes(Buffer.from('%PDF-'))||
       !src.subarray(Math.max(0,src.length-1024)).includes(Buffer.from('%%EOF')))
      return manual('PDF_SIGNATURE_OR_TRAILER_UNRECOGNIZED');
    const expectedMm=[
      r.source_page_box[2]*r.pdf_user_unit*25.4/72,
      r.source_page_box[3]*r.pdf_user_unit*25.4/72
    ];
    if(expectedMm.some((n,i)=>!near(n,r.source_document_size_mm[i],0.005)))
      return manual('PDF_USERUNIT_PHYSICAL_SIZE_CONFLICT');
  }else{
    const root=svgRootGeometry(sourceBytes);
    if(!root)return manual('SVG_SOURCE_VIEWPORT_NOT_INDEPENDENTLY_PARSED');
    if(root.viewBox.some((n,i)=>!near(n,r.source_page_box[i],1e-7))||
       root.document_size_mm.some((n,i)=>
         !near(n,r.source_document_size_mm[i],0.005)))
      return manual('SVG_SOURCE_VIEWPORT_CONFLICT');
  }
  const geometryReason=checkAffineAnchors(r);
  if(geometryReason)return manual(geometryReason);
  return {
    schema:'printcheck.vision.render-calibration-check.v1',
    status:'SIGNED_SOURCE_PREVIEW_AND_MM_AFFINE_CONSISTENT_ONLY',
    production_approved:false,
    byte_sha256_binds_source_preview_order:true,
    signed_renderer_receipt:true,
    renderer_binary_digest_recorded:true,
    preview_png_strictly_decoded:true,
    source_format:r.source_format,
    preview_dimensions_px:r.preview_pixel_dimensions.slice(),
    physical_field_size_mm:r.field_size_mm.slice(),
    calibration_anchor_count:r.anchors.length,
    mm_transform_numerically_consistent:true,
    renderer_color_process_attested_only:true,
    pdf_paint_content_independently_verified:false,
    svg_paint_content_independently_verified:false,
    visual_render_equivalence_proven:false,
    gifts_order_evidence_authenticity_proven:false,
    physical_placement_independently_verified:false,
    print_scale_proven:false,
    warning:'A signed renderer receipt and agreeing affine anchors do not prove render equivalence, actual order origin, ICC correctness, or production fitness'
  };
}
