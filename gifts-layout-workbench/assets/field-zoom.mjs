// View-only magnification. Artwork dimensions and placement never change.
export function installFieldZoom({canvas,getState,render}){
 canvas.tabIndex=0;const bar=document.createElement('div');bar.id='fieldZoom';bar.className='field-zoom';bar.hidden=true;bar.setAttribute('aria-label','Масштаб просмотра поля');
 bar.innerHTML='<button id="fieldZoomOut" type="button" aria-label="Уменьшить поле">−</button><output id="fieldZoomValue">100%</output><button id="fieldZoomIn" type="button" aria-label="Увеличить поле">+</button><button id="fieldZoomFit" type="button">Вписать поле</button><span>Пробел + мышь — перемещение вида</span>';
 document.getElementById('fieldLogoTools').after(bar);
 let base=null,owned=null,field=null,factor=1,space=false,drag=null,queued=0;
 const $=id=>bar.querySelector('#'+id),schedule=()=>{if(!queued)queued=requestAnimationFrame(()=>{queued=0;render();});};
 function refresh(){const s=getState();bar.hidden=!(s.template&&s.field&&s.view);if(bar.hidden){base=null;owned=null;factor=1;return;}if(field!==s.field||owned!==s.view){field=s.field;base={...s.view};owned=s.view;factor=1;}
  $('fieldZoomValue').value=Math.round(factor*100)+'%';$('fieldZoomOut').disabled=factor<=1;$('fieldZoomIn').disabled=factor>=8;bar.dataset.factor=String(factor);
 }
 function zoom(next){refresh();if(!base)return;const s=getState(),v=s.view,anchor=factor===1&&next>1?s.placement:null,cx=anchor?anchor.x+anchor.w/2:v.x+v.w/2,cy=anchor?anchor.y+anchor.h/2:v.y+v.h/2;factor=Math.max(1,Math.min(8,next));owned=factor===1?{...base}:{x:cx-base.w/factor/2,y:cy-base.h/factor/2,w:base.w/factor,h:base.h/factor};s.view=owned;refresh();schedule();}
 $('fieldZoomIn').onclick=()=>zoom(factor*1.5);$('fieldZoomOut').onclick=()=>zoom(factor/1.5);$('fieldZoomFit').onclick=()=>zoom(1);
 const typing=e=>e.target.closest('input,select,textarea,button,[contenteditable=true]');
 window.addEventListener('keydown',e=>{if(e.code==='Space'&&!typing(e)&&!bar.hidden){space=true;canvas.style.cursor='grab';e.preventDefault();}});
 const end=()=>{drag=null;canvas.style.cursor=space?'grab':'';};window.addEventListener('keyup',e=>{if(e.code==='Space'){space=false;end();}});window.addEventListener('blur',()=>{space=false;end();});
 canvas.addEventListener('pointerdown',e=>{if(bar.hidden||!(space||e.button===1))return;const s=getState();if(s.busy)return;drag={x:e.clientX,y:e.clientY,view:{...s.view},rect:canvas.getBoundingClientRect()};canvas.setPointerCapture(e.pointerId);canvas.style.cursor='grabbing';e.preventDefault();e.stopImmediatePropagation();},true);
 canvas.addEventListener('pointermove',e=>{if(!drag)return;const v=drag.view;owned={...v,x:v.x-(e.clientX-drag.x)/drag.rect.width*v.w,y:v.y-(e.clientY-drag.y)/drag.rect.height*v.h};getState().view=owned;schedule();e.preventDefault();e.stopImmediatePropagation();},true);
 canvas.addEventListener('pointerup',end,true);canvas.addEventListener('pointercancel',end,true);canvas.addEventListener('lostpointercapture',end,true);refresh();return {refresh};
}
