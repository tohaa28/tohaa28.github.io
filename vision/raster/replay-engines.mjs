/**
 * C3B.3.K -- constrained OFFLINE source rerenderer.
 *
 * PDF.js 6.5.438 (Apache-2.0) + @napi-rs/canvas 1.0.9 (MIT);
 * resvg-js 2.6.2 (MPL-2.0). Installed ONLY in vision/raster.
 * This is NOT a complete PDF/SVG color separation or ICC proof.
 *
 * SVG: parsed with strict single-color <path/> XML subset; no external
 * references, CSS, fonts, styles, text, images or embedded payloads.
 * PDF: loaded from bytes; accepted ONLY for simple path fill operators.
 * Unsupported paint, CMYK/spot, masks, fonts, transparency -> MANUAL.
 *
 * Run on a restricted CI worker with a per-process timeout for untrusted
 * documents. Render here only; never access Gifts credentials or network.
 */
const MAX_BYTES=16_000_000,MAX_PIXELS=12_000_000;
const no=reason=>({status:'MANUAL',reason});
const goodDim=(w,h)=>Number.isSafeInteger(w)&&Number.isSafeInteger(h)&&
  w>=8&&h>=8&&w*h<=MAX_PIXELS;
const rgba=(data,w,h,engine)=>({
  status:'REPLAY_PIXELS_RENDERED',
  width:w,height:h,data:new Uint8Array(data),
  replay_engine:engine,renderer_output_color_proven:false,
  production_approved:false
});
function parseAttrs(raw,allowed){
  const attrs=new Map(),re=/([A-Za-z][A-Za-z-]*)\s*=\s*"([^"]*)"/g;
  let end=0,m;
  while((m=re.exec(raw))){
    if(!/^\s*$/.test(raw.slice(end,m.index))||
       !allowed.has(m[1])||attrs.has(m[1]))return null;
    attrs.set(m[1],m[2]);end=re.lastIndex;
  }
  return /^\s*$/.test(raw.slice(end))?attrs:null;
}
export function checkReplaySvgSubset(bytes){
  if(!(bytes instanceof Uint8Array)||bytes.length===0||
     bytes.length>MAX_BYTES)return no('SVG_SOURCE_BYTES_INVALID');
  let text;
  try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes).trim()}
  catch{return no('SVG_ENCODING_UNSUPPORTED')}
  // Deliberately accept NO XML declarations, entities or processing
  // instructions: this prevents any kind of external resolver/href.
  if(/<!|<\?|&|[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(text)||
     /url\s*\(|href|@import/i.test(text))
    return no('SVG_EXTERNAL_OR_XML_FEATURE_UNSUPPORTED');
  const tags=text.match(/<[^<>]*>/g)||[];
  if(tags.length<3||tags.length>130||
     text.replace(/<[^<>]*>/g,'').trim())
    return no('SVG_REPLAY_STRUCTURE_UNSUPPORTED');
  const open=/^<svg\b([^<>]*)>$/i.exec(tags[0]);
  if(!open||tags.at(-1)!=='</svg>')
    return no('SVG_REPLAY_ROOT_UNSUPPORTED');
  const root=parseAttrs(open[1],new Set([
    'xmlns','width','height','viewBox','preserveAspectRatio'
  ]));
  if(!root||root.get('xmlns')!=='http://www.w3.org/2000/svg'||
     !/^[0-9]+(?:\.[0-9]+)?(?:mm|cm|in|pt)$/.test(root.get('width')??'')||
     !/^[0-9]+(?:\.[0-9]+)?(?:mm|cm|in|pt)$/.test(root.get('height')??'')||
     !/^[-\d., \t]+$/.test(root.get('viewBox')??'')||
     !['xMidYMid meet',undefined].includes(root.get('preserveAspectRatio')))
    return no('SVG_REPLAY_VIEWPORT_UNSUPPORTED');
  const pieces=tags.slice(1,-1);
  if(pieces.length<1)return no('SVG_REPLAY_EMPTY');
  for(const tag of pieces){
    const p=/^<path\b([^<>]*?)\/>$/.exec(tag);
    if(!p)return no('SVG_REPLAY_NON_PATH_PAINT_UNSUPPORTED');
    const attr=parseAttrs(p[1],new Set(['d','fill','fill-rule']));
    if(!attr||!/^#[0-9A-Fa-f]{6}$/.test(attr.get('fill')??'')||
       !/^[MLHVCSQTAZmlhvcsqtaz0-9eE+\-.,\s]+$/.test(
         attr.get('d')??'')||
       (attr.get('d')??'').length>8000||
       !['nonzero','evenodd',undefined].includes(attr.get('fill-rule')))
      return no('SVG_REPLAY_COMPLEX_PAINT_UNSUPPORTED');
  }
  return {status:'SVG_PATH_ONLY_RGB_NO_EXTERNALS',path_count:pieces.length};
}
export async function rerenderSvgPathOnly({sourceBytes,width,height}={}){
  if(!goodDim(width,height))return no('RENDER_DIMENSIONS_UNSUPPORTED');
  const scope=checkReplaySvgSubset(sourceBytes);
  if(scope.status!=='SVG_PATH_ONLY_RGB_NO_EXTERNALS')return scope;
  let Resvg;
  try{({Resvg}=await import('@resvg/resvg-js'))}
  catch{return no('PINNED_RESVG_ENGINE_NOT_INSTALLED')}
  try{
    const renderer=new Resvg(Buffer.from(sourceBytes),{
      fitTo:{mode:'width',value:width},
      background:'#ffffff',
      font:{loadSystemFonts:false},
      shapeRendering:1
    });
    const frame=renderer.render();
    if(frame.width!==width||frame.height!==height||
       frame.pixels.byteLength!==width*height*4)
      return no('RESVG_PIXEL_DIMENSION_MISMATCH');
    const result=rgba(frame.pixels,width,height,'resvg-js@2.6.2');
    // Only opacity 100% is allowed; unvalidated alpha blending is refused.
    for(let i=3;i<result.data.length;i+=4)
      if(result.data[i]!==255)return no('RESVG_ALPHA_CHANNEL_UNVERIFIED');
    return result;
  }catch{return no('SVG_REPLAY_ENGINE_FAILED')}
}
export async function rerenderPdfSimplePaths({
  sourceBytes,width,height,page_index=0,receipt
}={}){
  if(!(sourceBytes instanceof Uint8Array)||
     sourceBytes.length===0||sourceBytes.length>MAX_BYTES||
     !goodDim(width,height)||!Number.isSafeInteger(page_index)||
     page_index<0||page_index>50)
    return no('PDF_REPLAY_SOURCE_INVALID');
  let pdfjs,canvasLib;
  try{
    canvasLib=await import('@napi-rs/canvas');
    // PDF.js expects DOMMatrix / Path2D at module initialization in Node.
    if(canvasLib.DOMMatrix&&!globalThis.DOMMatrix)
      globalThis.DOMMatrix=canvasLib.DOMMatrix;
    if(canvasLib.Path2D&&!globalThis.Path2D)
      globalThis.Path2D=canvasLib.Path2D;
    if(canvasLib.ImageData&&!globalThis.ImageData)
      globalThis.ImageData=canvasLib.ImageData;
    pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');
  }catch{return no('PINNED_PDFJS_CANVAS_ENGINE_NOT_INSTALLED')}
  let task,doc,page;
  try{
    pdfjs.GlobalWorkerOptions.workerSrc=new URL(
      './node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs',
      import.meta.url).href;
    class CanvasFactory {
      create(w,h){const canvas=canvasLib.createCanvas(w,h);
        return {canvas,context:canvas.getContext('2d')};}
      reset(x,w,h){x.canvas.width=w;x.canvas.height=h;}
      destroy(x){x.canvas.width=0;x.canvas.height=0;
        x.canvas=null;x.context=null;}
    }
    task=pdfjs.getDocument({
      data:Uint8Array.from(sourceBytes),
      useSystemFonts:false,disableFontFace:true,
      enableXfa:false,isEvalSupported:false,
      stopAtErrors:true,disableAutoFetch:true,disableStream:true,
      CanvasFactory
    });
    doc=await task.promise;
    if(page_index>=doc.numPages)return no('PDF_REPLAY_PAGE_MISSING');
    page=await doc.getPage(page_index+1);
    // The PDF.js independent parser must validate the signed page box,
    // UserUnit and page rotation, not use merely self-reported metadata.
    const box=page.view,rec=receipt;
    if(!rec||!Array.isArray(rec.source_page_box)||
       rec.source_page_box.length!==4||
       ![box[0],box[1],box[2]-box[0],box[3]-box[1]]
         .every((x,i)=>Math.abs(x-rec.source_page_box[i])<=1e-5)||
       Math.abs((page.userUnit??1)-rec.pdf_user_unit)>1e-6||
       (page.rotate??0)!==rec.page_rotation_degrees)
      return no('PDF_PARSED_PAGE_METADATA_CONFLICT');
    // Fail closed on everything except elementary opaque RGB/gray fills.
    // In particular no CMYK, DeviceN/spot, transparency, images or fonts.
    const ops=await page.getOperatorList();
    const allowed=['save','restore','transform','constructPath',
      'fill','eoFill','endPath','setFillRGBColor','setFillGray',
      'setStrokeRGBColor','setStrokeGray','setLineWidth'];
    const whitelist=new Set(allowed.map(n=>pdfjs.OPS[n]).filter(Number.isInteger));
    if(ops.fnArray.length>12000||
       ops.fnArray.some(op=>!whitelist.has(op)))
      return no('PDF_COMPLEX_PAINT_OR_COLORSPACE_UNSUPPORTED');
    const viewport0=page.getViewport({scale:1,
      rotation:rec.page_rotation_degrees});
    const scale=width/viewport0.width;
    const vp=page.getViewport({scale,
      rotation:rec.page_rotation_degrees});
    if(Math.abs(vp.width-width)>0.01||
       Math.abs(vp.height-height)>0.01)
      return no('PDF_VIEWPORT_PIXEL_SIZE_CONFLICT');
    const canvas=canvasLib.createCanvas(width,height);
    const ctx=canvas.getContext('2d');
    ctx.fillStyle='#ffffff';ctx.fillRect(0,0,width,height);
    await page.render({
      canvas,canvasContext:ctx,viewport:vp,background:'#ffffff'
    }).promise;
    const pixels=ctx.getImageData(0,0,width,height).data;
    if(pixels.byteLength!==width*height*4)
      return no('PDF_REPLAY_PIXELS_INVALID');
    const result=rgba(pixels,width,height,'pdfjs-dist@6.5.438+skia');
    for(let i=3;i<result.data.length;i+=4)
      if(result.data[i]!==255)return no('PDF_REPLAY_ALPHA_UNVERIFIED');
    return result;
  }catch{
    return no('PDF_PARSER_OR_REPLAY_FAILED');
  }finally{
    try{page?.cleanup()}catch{}
    try{await task?.destroy()}catch{}
  }
}
