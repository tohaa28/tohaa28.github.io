/**
 * PrintCheck Vision C3B.3 — cross-check order/constructor/field/artwork
 * placement and derive a page-coordinate -> physical-millimetre matrix.
 *
 * CRITICAL TRUST BOUNDARY:
 * Two matching client-side objects are NOT an authenticated order record.
 * This function cannot independently authenticate gifts.ru data or the PDF
 * bytes; the output is CONTEXT_CROSSCHECKED_ONLY and is NEVER production proof.
 * A future trusted adapter must authenticate both snapshots and the artwork
 * digest before using this result for actual production measurements.
 *
 * Pure local arithmetic; no network, no global state, no data export.
 */
const manual = (reason, extra={}) => Object.freeze({
  schema:"printcheck.vision.placement-context.v1",status:"MANUAL",reason,
  print_scale_proven:false,geometry_proven:false,...extra
});
const finite = n => typeof n === "number" && Number.isFinite(n);
const pos = n => finite(n) && n > 0;
const id = x => typeof x === "string" && x.length > 0 &&
  x.length <= 256 && x.trim() === x && !/[\x00-\x1f]/.test(x);
const hash = x => typeof x==="string" && /^[a-f0-9]{64}$/i.test(x);
const near = (x,y,tol=1e-6) => Math.abs(x-y) <= Math.max(tol, 1e-9*Math.max(Math.abs(x),Math.abs(y)));
const keys = ["order_id","sku","constructor_id","print_slot_id",
              "technology_code","artwork_sha256","snapshot_revision"];

/** Validated experimental page-to-final-field transform. */
export function crosscheckArtworkPlacement(snapshot={}, editor={}) {
  if(!snapshot||!editor||typeof snapshot!=="object"||typeof editor!=="object")
    return manual("PLACEMENT_CONTEXT_REQUIRED");
  for(const key of keys){
    if(!id(snapshot[key])||!id(editor[key])||
      snapshot[key]!==editor[key])return manual("PLACEMENT_IDENTITY_MISMATCH",{key});
  }
  if(!hash(snapshot.artwork_sha256))return manual("ARTWORK_DIGEST_INVALID");
  if(!hash(snapshot.source_revision_sha256))return manual("SOURCE_REVISION_DIGEST_MISSING");
  if(snapshot.source_system!=="gifts.ru"||!id(snapshot.source_document_ref))
    return manual("SOURCE_PROVENANCE_MISSING");
  if(editor.source_document_ref!==snapshot.source_document_ref)
    return manual("PLACEMENT_SOURCE_MISMATCH");
  for(const [expectedKey,observedKey] of [
    ["field_width_mm","field_width_mm"],["field_height_mm","field_height_mm"],
    ["page_width_units","page_width_units"],["page_height_units","page_height_units"]]){
    const expected=snapshot[expectedKey],got=editor[observedKey];
    if(!pos(expected)||!pos(got))return manual("PHYSICAL_DIMENSIONS_REQUIRED",{key:expectedKey});
    if(!near(expected,got,expectedKey.startsWith("field")?0.005:1e-6))
      return manual("PLACEMENT_DIMENSION_CONFLICT",{key:expectedKey});
  }
  const W=snapshot.field_width_mm,H=snapshot.field_height_mm;
  const pageW=snapshot.page_width_units,pageH=snapshot.page_height_units;
  // Use normalized placement values in the measured printing field (not CSS px).
  const p=editor.placement;
  if(!p||typeof p!=="object")return manual("PLACEMENT_RECT_REQUIRED");
  for(const key of ["x","y","width","height"]){
    if(!finite(p[key]))return manual("PLACEMENT_COORDINATE_INVALID",{key});
  }
  if(p.x<0||p.y<0||p.width<=0||p.height<=0||
     p.x+p.width>1+1e-9||p.y+p.height>1+1e-9)
    return manual("PLACEMENT_OUTSIDE_FIELD");
  const angle=p.rotation_degrees??0;
  if(!finite(angle)||Math.abs(angle)>360)return manual("PLACEMENT_ROTATION_INVALID");
  // Reject distortion: if the page dimensions and the display rect imply
  // different physical scale factors, the operator must review it.
  const widthMM=p.width*W,heightMM=p.height*H;
  const sx=widthMM/pageW,sy=heightMM/pageH;
  if(!pos(sx)||!pos(sy)||!near(sx,sy,1e-8))
    return manual("NON_UNIFORM_ARTWORK_SCALING");
  if(sx>1000)return manual("PLACEMENT_SCALE_OUT_OF_RANGE");
  const radians=angle*Math.PI/180,cos=Math.cos(radians),sin=Math.sin(radians);
  const a=cos*sx,b=sin*sx,c=-sin*sy,d=cos*sy;
  const cx=W*(p.x+p.width/2),cy=H*(p.y+p.height/2);
  const e=cx-a*(pageW/2)-c*(pageH/2);
  const f=cy-b*(pageW/2)-d*(pageH/2);
  const matrix=[a,b,c,d,e,f];
  if(!matrix.every(finite)||!near(a*d-b*c,sx*sy,1e-8))
    return manual("PLACEMENT_MATRIX_INVALID");
  // Ensure all rotated page corners remain inside the physical print field.
  const corners=[[0,0],[pageW,0],[pageW,pageH],[0,pageH]];
  const xform=([x,y])=>({x:a*x+c*y+e,y:b*x+d*y+f});
  const transformed=corners.map(xform);
  const epsilonMM=0.00001;
  if(transformed.some(v=>v.x < -epsilonMM||v.y < -epsilonMM||
      v.x>W+epsilonMM||v.y>H+epsilonMM))
    return manual("ROTATED_ARTWORK_OUTSIDE_FIELD");
  return Object.freeze({
    schema:"printcheck.vision.placement-context.v1",
    status:"CONTEXT_CROSSCHECKED_ONLY",
    order_context_matches:true,
    print_scale_proven:false,geometry_proven:false,
    page_to_field_mm:Object.freeze(matrix),
    field_size_mm:Object.freeze({width:W,height:H}),
    artwork_sha256:snapshot.artwork_sha256.toLowerCase(),
    source_revision_sha256:snapshot.source_revision_sha256.toLowerCase(),
    context:Object.freeze({
      order_id:snapshot.order_id,sku:snapshot.sku,
      constructor_id:snapshot.constructor_id,
      print_slot_id:snapshot.print_slot_id,
      technology_code:snapshot.technology_code,
      snapshot_revision:snapshot.snapshot_revision
    }),
    warning:"Untrusted client-side comparison. Cannot assert order authenticity or print-scale proof."
  });
}
