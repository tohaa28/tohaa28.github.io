const NS='http://www.w3.org/2000/svg',HTML='http://www.w3.org/1999/xhtml';let sequence=0;
const element=(name,attrs={})=>{const node=document.createElementNS(NS,name);set(node,attrs);return node;};
function set(node,attrs){for(const [k,v]of Object.entries(attrs))if(node.getAttribute(k)!==String(v))node.setAttribute(k,String(v));}
function imageNode(art){return element('image',{href:art.src,preserveAspectRatio:'none'});}
function screenCanvas(width,height){const canvas=document.createElementNS(HTML,'canvas');canvas.width=Math.max(1,Math.ceil(width));canvas.height=Math.max(1,Math.ceil(height));canvas.style.cssText='display:block;width:100%;height:100%;';return canvas;}
function clipShape(field){return field.pathCommands?.length?element('path',{d:field.pathCommands.map(c=>c.join(' ')).join(' '),'clip-rule':field.evenOdd?'evenodd':'nonzero'}):element('rect',{x:field.x,y:field.y,width:field.w,height:field.h});}
export function installArtworkView({canvas,getState}){
 const root=element('svg',{id:'artworkVectorLayer',preserveAspectRatio:'none','aria-hidden':'true'});root.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:1;overflow:hidden';canvas.before(root);canvas.style.zIndex='2';
 const nodes=new Map();let renders=0;
 function cancel(node){clearTimeout(node.timer);node.timer=0;node.task?.cancel();node.task=null;node.token++;}
 function remove(node){cancel(node);node.group.remove();}
 function refresh(){
  const state=getState();root.hidden=!state.template;if(!state.template){for(const node of nodes.values())remove(node);nodes.clear();return;}
  const view=state.view||{x:0,y:0,w:state.template.w,h:state.template.h};set(root,{viewBox:[view.x,view.y,view.w,view.h].join(' ')});
  const visible=state.placements.filter(p=>p.page===state.page&&p.art&&p.placement),live=new Set(visible);
  for(const [p,node]of nodes)if(!live.has(p)){remove(node);nodes.delete(p);}
  for(const [order,p] of visible.entries()){const art=p.art,a=p.placement;let node=nodes.get(p);
   if(node&&node.art!==art){remove(node);nodes.delete(p);node=null;}
   if(!node){const group=element('g',{'data-format':art.pdfPage?'pdf':art.svg?'svg':'raster','data-state':'ready'}),clip=element('clipPath',{id:'artworkClip'+(++sequence),clipPathUnits:'userSpaceOnUse'}),defs=element('defs'),image=imageNode(art);defs.append(clip);group.append(defs,image);node={art,group,clip,image,token:0,key:'',clipKey:'',task:null,timer:0,detail:null};nodes.set(p,node);root.append(group);}
   if(root.children[order]!==node.group)root.insertBefore(node.group,root.children[order]||null);const index=state.placements.indexOf(p);set(node.group,{'data-placement':index});
   if(a.clipToField&&p.field){const clipKey=JSON.stringify(p.field);if(node.clipKey!==clipKey){node.clipKey=clipKey;node.clip.replaceChildren(clipShape(p.field));}set(node.group,{'clip-path':'url(#'+node.clip.id+')'});}else node.group.removeAttribute('clip-path');
   set(node.image,{x:a.x,y:a.y,width:a.w,height:a.h,transform:'rotate('+(a.rotation||0)+' '+(a.x+a.w/2)+' '+(a.y+a.h/2)+')'});
   if(!art.pdfPage)continue;
   const key=JSON.stringify([view,canvas.width,canvas.height,a.x,a.y,a.w,a.h,a.rotation||0]);if(key===node.key)continue;node.key=key;cancel(node);node.detail?.remove();node.detail=null;node.image.style.display='';node.group.dataset.state='pending';
   const token=node.token,snapshot={...a},v={...view},width=canvas.width,height=canvas.height;
   node.timer=setTimeout(async()=>{node.timer=0;const page=art.pdfPage,viewport=page.getViewport({scale:1}),surface=screenCanvas(width,height),ctx=surface.getContext('2d'),sx=width/v.w,sy=height/v.h,angle=(snapshot.rotation||0)*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle),px=snapshot.w/viewport.width,py=snapshot.h/viewport.height,cx=snapshot.x+snapshot.w/2-v.x,cy=snapshot.y+snapshot.h/2-v.y;
    try{renders++;node.task=page.render({canvasContext:ctx,viewport,transform:[c*px*sx,s*px*sy,-s*py*sx,c*py*sy,(cx-c*snapshot.w/2+s*snapshot.h/2)*sx,(cy-s*snapshot.w/2-c*snapshot.h/2)*sy],background:'rgba(0,0,0,0)'});await node.task.promise;if(token!==node.token)return;node.task=null;const fo=element('foreignObject',{x:0,y:0,width,height,transform:'translate('+v.x+' '+v.y+') scale('+(v.w/width)+' '+(v.h/height)+')'});fo.append(surface);node.group.append(fo);node.detail=fo;node.image.style.display='none';node.group.dataset.state='ready';}
    catch(error){if(token!==node.token||error.name==='RenderingCancelledException')return;node.task=null;node.group.dataset.state='fallback';node.group.dataset.error=String(error.message||error);}
   },120);
  }
  window.gwbArtworkView={renders,placements:visible.map(p=>({index:state.placements.indexOf(p),format:nodes.get(p).group.dataset.format,state:nodes.get(p).group.dataset.state}))};
 }
 window.addEventListener('pagehide',()=>{for(const node of nodes.values())cancel(node);});refresh();return {refresh};
}

// A focused preview uses the vector source and a viewport-sized PDF surface,
// never a crop enlarged from the initial low-resolution thumbnail.
export function renderArtworkPreview(container,{art,box,wMm,hMm,mode,color}){
 const W=320,H=200,contentH=175,sourceW=art.w,sourceH=art.h,pw=Math.max(box.w,box.threshold/wMm)*.8,ph=Math.max(box.h,box.threshold/hMm)*.8,x=Math.max(0,box.x-pw),y=Math.max(0,box.y-ph),w=Math.min(1-x,box.w+2*pw),h=Math.min(1-y,box.h+2*ph),z=Math.min(W/(w*sourceW),contentH/(h*sourceH)),zx=z*sourceW,zy=z*sourceH,ox=(W-w*zx)/2,oy=(contentH-h*zy)/2;
 const root=element('svg',{viewBox:'0 0 320 200',width:320,height:200,role:'img','aria-label':'Увеличенный проблемный участок'});root.style.cssText='display:block;width:100%;height:auto;background:#e9edf0';
 const clip=element('clipPath',{id:'previewClip'+(++sequence),clipPathUnits:'userSpaceOnUse'});clip.append(element('rect',{x:ox,y:oy,width:w*zx,height:h*zy}));const defs=element('defs');defs.append(clip);root.append(defs,element('rect',{x:ox,y:oy,width:w*zx,height:h*zy,fill:mode==='light'?'#222':'#fff'}));
 const group=element('g',{'clip-path':'url(#'+clip.id+')'});root.append(group);
 const image=imageNode(art);set(image,{x:ox-x*zx,y:oy-y*zy,width:zx,height:zy});group.append(image);
 root.append(element('ellipse',{cx:ox+(box.cx-x)*zx,cy:oy+(box.cy-y)*zy,rx:box.threshold/wMm*zx/2,ry:box.threshold/hMm*zy/2,fill:'none',stroke:color,'stroke-width':2}));
 const text=element('text',{x:8,y:192,fill:'#00529b','font-size':12,'font-family':'sans-serif'});text.textContent='Диаметр '+box.threshold+' мм · измерено '+box.minWidthMm.toFixed(3)+' мм';root.append(text);container.replaceChildren(root);container.dataset.format=art.pdfPage?'pdf':art.svg?'svg':'raster';container.dataset.state='ready';
 let cancelled=false,task=null;if(art.pdfPage){container.dataset.state='pending';const viewport=art.pdfPage.getViewport({scale:1}),dpr=Math.min(2,window.devicePixelRatio||1),surface=screenCanvas(W*dpr,contentH*dpr),ctx=surface.getContext('2d');task=art.pdfPage.render({canvasContext:ctx,viewport,transform:[zx/viewport.width*dpr,0,0,zy/viewport.height*dpr,(ox-x*zx)*dpr,(oy-y*zy)*dpr],background:'rgba(0,0,0,0)'});task.promise.then(()=>{if(cancelled)return;const fo=element('foreignObject',{x:0,y:0,width:W,height:contentH});fo.append(surface);group.replaceChildren(fo);container.dataset.state='ready';}).catch(error=>{if(!cancelled&&error.name!=='RenderingCancelledException'){container.dataset.state='fallback';container.dataset.error=String(error.message||error);}});}
 return ()=>{cancelled=true;task?.cancel();};
}
