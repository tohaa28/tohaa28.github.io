/**
 * PrintCheck Vision / local binary-mask topology extractor.
 *
 * Input is an already-validated one-color 0/1 bitmap. This extractor does not
 * rasterize PDF, infer DPI, classify colors, detect minimum stroke widths or
 * decide whether any artwork is manufacturable.
 *
 * Foreground uses 8-connectivity, its dual background uses 4-connectivity.
 * That avoids declaring diagonal touching foreground pixels separate islands
 * and avoids incompatible 8/8 dual topology.
 */
const manual=(reason)=>({status:"MANUAL",reason,components:[],holes:[],geometry_proven:false});
const fixed=(n)=>typeof n==="number"&&Number.isFinite(n)&&n>0;

/**
 * @param {{width:number,height:number,data:Uint8Array|number[],
 *  scale_proven?:boolean,pixel_pitch_x_mm?:number,pixel_pitch_y_mm?:number,
 *  max_pixels?:number,max_components?:number}} input
 * @returns {{status:string,components:object[],holes:object[],warnings:string[]}}
 */
export function inspectBinaryMask(input={}) {
  const {width,height,data}=input;
  if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<=0||height<=0)
    return manual("INVALID_DIMENSIONS");
  const n=width*height;
  const pixelLimit=Math.min(input.max_pixels??16_000_000,16_000_000);
  if(!Number.isSafeInteger(n)||!Number.isSafeInteger(pixelLimit)||pixelLimit<1||n>pixelLimit)
    return manual("PIXEL_BUDGET_EXCEEDED");
  if(!(data instanceof Uint8Array) && !Array.isArray(data))
    return manual("BINARY_MASK_REQUIRED");
  if(data.length!==n)return manual("BINARY_MASK_DIMENSIONS_MISMATCH");
  // Fail closed on unbinarized RGBA/gray images: no automatic threshold guess.
  for(let i=0;i<n;i++) if(data[i]!==0&&data[i]!==1)return manual("NOT_BINARY");
  const maxComponents=input.max_components??10_000;
  if(!Number.isSafeInteger(maxComponents)||maxComponents<1||maxComponents>100_000)
    return manual("INVALID_COMPONENT_BUDGET");
  const calibrated=input.scale_proven===true&&
    fixed(input.pixel_pitch_x_mm)&&fixed(input.pixel_pitch_y_mm);
  const foregroundVisited=new Uint8Array(n);
  const backgroundVisited=new Uint8Array(n);
  const queue=new Int32Array(n);
  const components=[],holes=[],warnings=[
    "topology_candidates_only_not_quality_verdict",
    "component_bbox_is_not_min_stroke_width",
    "isolated_letters_and_internal_holes_may_be_valid"
  ];
  if(!calibrated)warnings.push("scale_unproven_dimensions_in_pixels_only");
  let overflow=false;
  function flood(start,target,seen,connectivity,id) {
    let head=0,tail=1;queue[0]=start;seen[start]=1;
    let left=width,top=height,right=-1,bottom=-1,count=0,touchesEdge=false;
    while(head<tail) {
      const p=queue[head++],x=p%width,y=(p-x)/width;
      count++;
      if(x<left)left=x;if(x>right)right=x;
      if(y<top)top=y;if(y>bottom)bottom=y;
      if(x===0||y===0||x===width-1||y===height-1) touchesEdge=true;
      const walk=(nx,ny)=>{
        if(nx<0||ny<0||nx>=width||ny>=height)return;
        const k=ny*width+nx;
        if(seen[k]||data[k]!==target)return;
        seen[k]=1;queue[tail++]=k;
      };
      walk(x-1,y);walk(x+1,y);walk(x,y-1);walk(x,y+1);
      if(connectivity===8){
        walk(x-1,y-1);walk(x+1,y-1);walk(x-1,y+1);walk(x+1,y+1);
      }
    }
    const bbox_px={x:left,y:top,width:right-left+1,height:bottom-top+1};
    const bbox_mm=calibrated?{
      x:left*input.pixel_pitch_x_mm,y:top*input.pixel_pitch_y_mm,
      width:bbox_px.width*input.pixel_pitch_x_mm,
      height:bbox_px.height*input.pixel_pitch_y_mm
    }:null;
    return {id,kind:target===1?"foreground_component":"enclosed_background",
      pixels:count,bbox_px,bbox_mm,
      area_mm2:calibrated?count*input.pixel_pitch_x_mm*input.pixel_pitch_y_mm:null,
      touches_edge:touchesEdge};
  }
  let foregroundCount=0,backgroundCount=0;
  for(let i=0;i<n;i++){
    if(data[i]===1&&!foregroundVisited[i]){
      if(components.length>=maxComponents){overflow=true;break}
      components.push(flood(i,1,foregroundVisited,8,++foregroundCount));
    }
  }
  if(!overflow){
    for(let i=0;i<n;i++){
      if(data[i]===0&&!backgroundVisited[i]){
        const bg=flood(i,0,backgroundVisited,4,++backgroundCount);
        if(!bg.touches_edge){
          if(holes.length>=maxComponents){overflow=true;break}
          holes.push(bg);
        }
      }
    }
  }
  if(overflow)warnings.push("component_budget_exceeded_incomplete_result");
  return {
    schema:"printcheck.vision.mask-topology.v1",
    status:overflow?"INCOMPLETE":"CANDIDATES_ONLY",
    geometry_proven:false,
    scale_proven:calibrated,
    width_px:width,height_px:height,
    foreground_connectivity:8,background_connectivity:4,
    components,holes,warnings
  };
}
