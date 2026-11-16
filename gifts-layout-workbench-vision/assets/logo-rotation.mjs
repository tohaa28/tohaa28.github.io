const radians=degrees=>degrees*Math.PI/180;
export const normalizeRotation=degrees=>((degrees%360)+360)%360;
export function rotationDelta(previous,current){return ((current-previous+540)%360)-180;}
export function rotationGeometry(placement,view,width,height){
  const sx=width/view.w,sy=height/view.h,angle=radians(placement.rotation||0);
  const center={x:(placement.x+placement.w/2-view.x)*sx,y:(placement.y+placement.h/2-view.y)*sy};
  const edge={x:center.x+Math.sin(angle)*placement.h/2*sx,y:center.y-Math.cos(angle)*placement.h/2*sy};
  const length=Math.hypot(edge.x-center.x,edge.y-center.y)||1;
  const handle={x:edge.x+(edge.x-center.x)/length*28,y:edge.y+(edge.y-center.y)/length*28};
  // Keep the grip reachable at high zoom and near page edges.
  handle.x=Math.max(13,Math.min(width-13,handle.x));handle.y=Math.max(13,Math.min(height-13,handle.y));
  return {center,edge,handle};
}

export function installLogoRotation({canvas,getState,redraw,toPoint}) {
  let drag=null;
  const button=document.createElement('button');button.id='logoRotateHandle';button.type='button';
  button.className='logo-rotate-handle';button.textContent='↻';button.title='Потяните для поворота. Shift — шаг 15°. Esc — отмена.';
  button.setAttribute('aria-label','Повернуть логотип мышью');button.hidden=true;
  canvas.parentElement.append(button);
  function refresh(){
    const state=getState(),p=state.placement;
    button.hidden=!p||!state.art||!state.template;
    if(button.hidden)return;
    const rect=canvas.getBoundingClientRect(),view=state.view||{x:0,y:0,w:state.template.w,h:state.template.h};
    const geometry=rotationGeometry(p,view,rect.width,rect.height);
    button.style.left=geometry.handle.x+'px';button.style.top=geometry.handle.y+'px';
    button.dataset.angle=String(normalizeRotation(p.rotation||0));
    button.dataset.centerX=String(geometry.center.x);button.dataset.centerY=String(geometry.center.y);
    button.setAttribute('aria-valuetext',Math.round(normalizeRotation(p.rotation||0))+'°');
    button.disabled=!!state.busy;
  }
  function finish(cancel=false){
    if(!drag)return;
    const previous=drag;drag=null;
    if(cancel)previous.placement.rotation=previous.original;
    button.classList.remove('dragging');
    if(button.hasPointerCapture(previous.pointerId))button.releasePointerCapture(previous.pointerId);
    redraw();
  }
  button.addEventListener('pointerdown',event=>{
    const state=getState(),p=state.placement;if(event.button!==0||!p||state.busy)return;
    const point=toPoint(event),center={x:p.x+p.w/2,y:p.y+p.h/2};
    drag={placement:p,pointerId:event.pointerId,original:p.rotation||0,angle:p.rotation||0,last:Math.atan2(point.y-center.y,point.x-center.x)*180/Math.PI,center};
    button.setPointerCapture(event.pointerId);button.classList.add('dragging');event.preventDefault();event.stopPropagation();
  });
  button.addEventListener('pointermove',event=>{
    if(!drag||event.pointerId!==drag.pointerId)return;
    if(getState().placement!==drag.placement){finish(true);return;}
    const point=toPoint(event);if(Math.hypot(point.x-drag.center.x,point.y-drag.center.y)<.01)return;
    const current=Math.atan2(point.y-drag.center.y,point.x-drag.center.x)*180/Math.PI;
    drag.angle+=rotationDelta(drag.last,current);drag.last=current;
    drag.placement.rotation=Math.round(normalizeRotation(event.shiftKey?Math.round(drag.angle/15)*15:drag.angle)*100)/100;
    redraw();event.preventDefault();event.stopPropagation();
  });
  button.addEventListener('pointerup',event=>{if(drag&&event.pointerId===drag.pointerId){finish();event.stopPropagation();}});
  button.addEventListener('pointercancel',()=>finish(true));
  button.addEventListener('lostpointercapture',()=>finish(true));
  window.addEventListener('keydown',event=>{if(event.key==='Escape'&&drag){event.preventDefault();event.stopPropagation();finish(true);}},true);
  button.addEventListener('keydown',event=>{
    if(!['ArrowLeft','ArrowRight'].includes(event.key)||drag)return;
    const state=getState();if(!state.placement||state.busy)return;
    state.placement.rotation=normalizeRotation((state.placement.rotation||0)+(event.key==='ArrowLeft'?-1:1)*(event.shiftKey?15:1));
    redraw();event.preventDefault();
  });
  refresh();return {refresh};
}
