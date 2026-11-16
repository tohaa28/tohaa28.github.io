/**
 * SVG document viewport calibration, PrintCheck Vision.
 *
 * Caller supplies a DOMParser-validated root SVG element (not arbitrary HTML).
 * This proves only the SVG DOCUMENT coordinate space. The final placement in
 * Maketnaya/order is independent and MUST be calibrated before comparing any
 * stroke or gap to technological millimeter limits.
 */
const refuse=(reason)=>Object.freeze({
  status:"MANUAL",reason,svg_document_scale_proven:false,print_scale_proven:false
});
const mmMultipliers=Object.freeze({mm:1,cm:10,in:25.4,pt:25.4/72});
function unitValue(raw){
  if(typeof raw!=="string")return null;
  const match=/^\s*(\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*(mm|cm|in|pt)\s*$/i.exec(raw);
  if(!match)return null;
  const value=Number(match[1])*mmMultipliers[match[2].toLowerCase()];
  return Number.isFinite(value)&&value>0&&value<=50_000?value:null;
}
/**
 * Browser caller: DOMParser.parseFromString(svgText,'image/svg+xml'), reject any
 * parsererror, then pass doc.documentElement. No scripting or network is run.
 */
export function inspectSvgDocumentViewport(root){
  if(!root || root.localName!=="svg" || typeof root.getAttribute!=="function")
    return refuse("VALIDATED_SVG_ROOT_REQUIRED");
  const attr=name=>root.getAttribute(name);
  if(attr("style")||attr("class")||attr("transform"))
    return refuse("SVG_ROOT_STYLE_OR_TRANSFORM_UNVERIFIED");
  const align=(attr("preserveAspectRatio")||"xMidYMid meet").trim();
  if(!/^(?:x(?:Min|Mid|Max)Y(?:Min|Mid|Max))(?:\s+(?:meet|slice))?$/.test(align))
    return refuse("SVG_ASPECT_RATIO_UNSUPPORTED");
  if(/slice$/.test(align))return refuse("SVG_ASPECT_RATIO_SLICE_UNVERIFIED");
  const physicalWidthMm=unitValue(attr("width")),physicalHeightMm=unitValue(attr("height"));
  if(!physicalWidthMm||!physicalHeightMm)
    return refuse("SVG_EXPLICIT_PHYSICAL_SIZE_REQUIRED");
  const vb=attr("viewBox");
  if(typeof vb!=="string")return refuse("SVG_VIEWBOX_REQUIRED");
  const parts=vb.trim().split(/[\s,]+/);
  if(parts.length!==4)return refuse("SVG_VIEWBOX_INVALID");
  const [originX,originY,vbWidth,vbHeight]=parts.map(Number);
  if(![originX,originY,vbWidth,vbHeight].every(Number.isFinite)||
      vbWidth<=0||vbHeight<=0)return refuse("SVG_VIEWBOX_INVALID");
  const xMmPerUnit=physicalWidthMm/vbWidth,yMmPerUnit=physicalHeightMm/vbHeight;
  if(!Number.isFinite(xMmPerUnit)||!Number.isFinite(yMmPerUnit))
    return refuse("SVG_COORDINATE_SCALE_INVALID");
  const relative=Math.abs(xMmPerUnit-yMmPerUnit)/Math.max(xMmPerUnit,yMmPerUnit);
  if(relative>1e-6)return refuse("SVG_NONUNIFORM_OR_LETTERBOX_SCALE");
  return Object.freeze({
    schema:"printcheck.vision.svg-viewport.v1",
    status:"DOCUMENT_COORDINATES_ONLY",
    source:"svg-root-width-height-viewBox",
    svg_document_scale_proven:true,
    print_scale_proven:false,
    width_mm:physicalWidthMm,height_mm:physicalHeightMm,
    viewBox:Object.freeze({minX:originX,minY:originY,width:vbWidth,height:vbHeight}),
    svg_units_to_mm:xMmPerUnit,
    warning:"Actual print placement and object transforms are not proven. Do not set scale_proven=true in final measurement."
  });
}
