/* Gifts Maketnaya — non-destructive, embedded SVG logo editor.
   Isolated from placement geometry, PrintCheck and the mockup engine. */
(function(){
  'use strict';
  if (window.gwbLogoEditorInstalled) return;
  window.gwbLogoEditorInstalled=true;
  const NS='http://www.w3.org/2000/svg', XL='http://www.w3.org/1999/xlink';
  const $=id=>document.getElementById(id);
  const S=(name,attrs={})=>{const n=document.createElementNS(NS,name);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,String(v));return n;};
  const num=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
  const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
  const text=(n,s)=>{if(n)n.textContent=s;};
  const escapeName=s=>String(s||'логотип').replace(/[^\p{L}\p{N}._-]+/gu,'_').slice(0,70);
  let shell,svg,layer,ui,stage,btn,status,layersPanel,tool='select',selected=null,multi=[];
  let W=900,H=600,zoom=1,gesture=null,history=[],index=-1,dirty=false,loadedName='Логотип';
  let artInput,mode='select',active=false,openedToken=null,opening=false;
  // The host editor clears input.value after each asynchronous import. Preserve
  // the selected File only in RAM so the currently selected artwork is editable.
  const sourceFilesBySlot=new Map();
  const sourceFilesByName=new Map();
  const currentSlot=()=>[
    $('order')?.value||$('editorTitle')?.textContent||'',
    $('orderTemplates')?.value||$('article')?.value||'',
    $('orderFieldChoice')?.value||$('fields')?.value||''
  ].join('|');
  function captureArtwork(event){
    const file=event.target.files?.[0];
    if(!file)return;
    const slot=currentSlot();
    if(slot.replace(/\|/g,'').trim())sourceFilesBySlot.set(slot,file);
    sourceFilesByName.set(file.name,file);
    // Do not indefinitely retain personal customer artwork in this tab.
    for(const map of [sourceFilesBySlot,sourceFilesByName]){
      if(map.size>25)map.delete(map.keys().next().value);
    }
  }
  let hasFonts=false,sourceUnsupported=false;
  const MAX_FILE=25*1024*1024;
  const ALLOWED=new Set('svg g defs path rect circle ellipse line polygon polyline image text tspan use linearGradient radialGradient stop clipPath mask pattern symbol marker filter feGaussianBlur feOffset feMerge feMergeNode feColorMatrix feComponentTransfer feFuncR feFuncG feFuncB feFuncA feBlend feComposite'.split(' '));
  function scrub(node){
    if(node.nodeType===8){node.remove();return}
    if(node.nodeType!==1)return;
    if(!ALLOWED.has(node.localName)){node.remove();return}
    for(const attr of Array.from(node.attributes)){
      const key=attr.name.toLowerCase(),v=attr.value.trim();
      if(key.startsWith('on')||key==='style'||key==='src'||key==='srcset'||key==='formaction'
        ||/javascript:|vbscript:|file:|@import|expression\s*\(/i.test(v)
        ||(/url\s*\(/i.test(v)&&!/url\s*\(\s*['"]?#[A-Za-z0-9_.:-]+['"]?\s*\)/i.test(v))
        ||((key==='href'||key==='xlink:href')&&!(/^#[\w.:-]+$/.test(v)||/^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/i.test(v)))
        ||/^(?:http:|https:|\/\/)/i.test(v))node.removeAttributeNode(attr);
    }
    if(node.localName==='image'&&!node.getAttribute('href')&&!node.getAttributeNS(XL,'href')){node.remove();return}
    for(const child of Array.from(node.childNodes))scrub(child);
  }
  function serialize(){
    const out=S('svg',{xmlns:NS,'xmlns:xlink':XL,version:'1.1',viewBox:'0 0 '+W+' '+H,width:W,height:H});
    for(const n of Array.from(layer.childNodes))out.appendChild(n.cloneNode(true));
    return new XMLSerializer().serializeToString(out);
  }
  function snapshot(force=false){
    const s=serialize();
    if(!force&&history[index]===s)return;
    history=history.slice(0,index+1);history.push(s);
    if(history.length>80)history.shift();
    index=history.length-1;dirty=true;refresh();
  }
  function restore(s){
    if(!s)return;
    const doc=new DOMParser().parseFromString(s,'image/svg+xml');
    if(doc.querySelector('parsererror'))return;
    layer.replaceChildren();
    for(const n of Array.from(doc.documentElement.children)){if(!ALLOWED.has(n.localName))continue;const copy=document.importNode(n,true);scrub(copy);layer.appendChild(copy)}
    selected=null;multi=[];refresh();
  }
  function undo(dir){
    const next=index+dir;
    if(next<0||next>=history.length)return;
    index=next;restore(history[index]);dirty=true;
  }
  function point(e){
    const ctm=svg.getScreenCTM();
    if(!ctm)return {x:0,y:0};
    const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(ctm.inverse());
    return {x:p.x,y:p.y};
  }
  function owner(n){
    while(n&&n.parentNode!==layer)n=n.parentNode;
    return n&&n.parentNode===layer?n:null;
  }
  function bbox(el){
    if(!el||typeof el.getBBox!=='function')return null;
    try{
      const b=el.getBBox(),p=svg.getScreenCTM(),c=el.getScreenCTM();
      if(!p||!c)return null;
      const m=p.inverse().multiply(c);
      const corners=[[b.x,b.y],[b.x+b.width,b.y],[b.x,b.y+b.height],[b.x+b.width,b.y+b.height]]
        .map(([x,y])=>new DOMPoint(x,y).matrixTransform(m));
      const xs=corners.map(v=>v.x),ys=corners.map(v=>v.y);
      return {x:Math.min(...xs),y:Math.min(...ys),w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys)};
    }catch{return null}
  }
  function select(el,add=false){
    const next=el&&el.parentNode===layer?el:null;
    if(add&&next){
      if(multi.includes(next))multi=multi.filter(n=>n!==next);
      else multi.push(next);
      selected=multi[multi.length-1]||null;
    }else{selected=next;multi=next?[next]:[]}
    refresh();
  }
  function groupSelection(){
    const nodes=Array.from(layer.children).filter(n=>multi.includes(n));
    if(nodes.length<2){status='Для группировки выделите два или больше объектов с Shift.';refresh();return}
    const group=S('g',{'data-label':'Группа'});
    nodes[0].before(group);
    nodes.forEach(n=>group.append(n));
    select(group);snapshot();
  }
  function svgPointForElement(el,p){
    const a=svg.getScreenCTM(),b=el.getScreenCTM();
    if(!a||!b)return p;
    return new DOMPoint(p.x,p.y).matrixTransform(a.inverse().multiply(b));
  }
  function pathNodeHandles(){
    if(tool!=='nodes'||selected?.localName!=='path')return;
    const segments=window.gwbLogoPath?.parse(selected.getAttribute('d'));
    if(!segments){status='У этого контура есть дуги или неподдерживаемые команды. Узлы оставлены без изменений.';return}
    for(let i=0;i<segments.length;i++){
      const n=segments[i];if(n.cmd==='Z')continue;
      const pivot=svgPointForElement(selected,{x:n.x,y:n.y});
      const line=(key,base)=>{
        const ctrl=svgPointForElement(selected,{x:n[key],y:n[key==='x1'?'y1':'y2']});
        ui.append(S('line',{x1:base.x,y1:base.y,x2:ctrl.x,y2:ctrl.y,stroke:'#8cb4d5','stroke-width':1/zoom,'pointer-events':'none'}));
      };
      if(n.cmd==='C'||n.cmd==='Q'){
        const prev=segments.slice(0,i).reverse().find(q=>q.cmd!=='Z');
        if(prev&&Number.isFinite(prev.x))line('x1',svgPointForElement(selected,{x:prev.x,y:prev.y}));
        if(n.cmd==='C')line('x2',pivot);
      }
      for(const k of n.cmd==='C'?['x1','x2','x']:n.cmd==='Q'?['x1','x']:['x']){
        const yk=k==='x'?'y':k==='x1'?'y1':'y2';
        const pos=svgPointForElement(selected,{x:n[k],y:n[yk]});
        const corner=k==='x';
        ui.append(S(corner?'rect':'circle',corner?
          {x:pos.x-5/zoom,y:pos.y-5/zoom,width:10/zoom,height:10/zoom,fill:'#fff',stroke:'#1479c5','stroke-width':1.6/zoom,'data-path-index':i,'data-path-key':k,style:'cursor:move'}:
          {cx:pos.x,cy:pos.y,r:4.4/zoom,fill:'#fbd18b',stroke:'#1479c5','stroke-width':1.2/zoom,'data-path-index':i,'data-path-key':k,style:'cursor:move'}));
      }
    }
  }
  function drawHandles(){
    ui.replaceChildren();
    const b=bbox(selected);if(!b)return;
    if(tool==='nodes'&&selected?.localName==='path'){pathNodeHandles();return}
    const rect=S('rect',{x:b.x,y:b.y,width:b.w,height:b.h,fill:'none',stroke:'#2d7fd0','stroke-width':1.3/zoom,'stroke-dasharray':(5/zoom)+' '+(4/zoom),'pointer-events':'none'});
    ui.appendChild(rect);
    const ps=[['nw',b.x,b.y],['n',b.x+b.w/2,b.y],['ne',b.x+b.w,b.y],['e',b.x+b.w,b.y+b.h/2],['se',b.x+b.w,b.y+b.h],['s',b.x+b.w/2,b.y+b.h],['sw',b.x,b.y+b.h],['w',b.x,b.y+b.h/2]];
    for(const [where,x,y] of ps){
      const h=S('rect',{x:x-4/zoom,y:y-4/zoom,width:8/zoom,height:8/zoom,fill:'#fff',stroke:'#2d7fd0','stroke-width':1.4/zoom,'data-handle':where});
      h.style.cursor=(where==='n'||where==='s')?'ns-resize':(where==='e'||where==='w')?'ew-resize':(where==='nw'||where==='se')?'nwse-resize':'nesw-resize';
      ui.appendChild(h);
    }
  }
  function refresh(){
    if(!active)return;
    drawHandles();
    const kids=Array.from(layer.children).filter(n=>n.localName!=='defs');
    layersPanel.replaceChildren();
    kids.slice().reverse().forEach((n,i)=>{
      const b=document.createElement('button');b.type='button';b.className='gwb-ve-layer'+(n===selected?' is-selected':'');
      b.textContent=(n.dataset.label||({text:'Текст',image:'Растр',path:'Контур',rect:'Прямоугольник',ellipse:'Эллипс',circle:'Окружность',line:'Линия',g:'Группа'}[n.localName]||n.localName))+' · '+(kids.length-i);
      b.onclick=()=>select(n);layersPanel.append(b);
    });
    $('gwbVeEmpty').hidden=kids.length>0;
    $('gwbVeGroup').disabled=multi.length<2;
    $('gwbVeSmooth').disabled=!selected||!['path','polyline','polygon'].includes(selected.localName);
    $('gwbVeCrop').disabled=!selected||selected.localName!=='image';
    $('gwbVeUndo').disabled=index<=0;
    $('gwbVeRedo').disabled=index>=history.length-1;
    for(const id of ['gwbVeDelete','gwbVeUp','gwbVeDown','gwbVeDuplicate'])$(id).disabled=!selected;
    const first=selected&&(selected.localName==='g'?selected.querySelector('text,rect,circle,ellipse,path,line,polygon,polyline,image'):selected);
    $('gwbVeTextBox').hidden=first?.localName!=='text';
    $('gwbVeUngroup').disabled=!selected||selected.localName!=='g';
    if(first?.localName==='text')$('gwbVeText').value=first.textContent;
    $('gwbVeOpacity').value=selected?.getAttribute('opacity')||'1';
    text($('gwbVeZoomText'),Math.round(zoom*100)+'%');
    text($('gwbVeDocSize'),W+' × '+H+' SVG');
    text($('gwbVeStatus'),status||'Выберите объект для изменения');
  }
  function initBlank(){
    W=900;H=600;layer.replaceChildren();selected=null;multi=[];loadedName='Логотип';history=[];index=-1;dirty=false;hasFonts=false;sourceUnsupported=false;
    sizeStage();snapshot(true);dirty=false;
  }
  function sizeStage(){
    svg.setAttribute('viewBox','0 0 '+W+' '+H);
    svg.setAttribute('width',W);svg.setAttribute('height',H);
    svg.style.width=Math.round(W*zoom)+'px';
    svg.style.height=Math.round(H*zoom)+'px';
    refresh();
  }
  function setZoom(n){
    zoom=clamp(n,.2,5);sizeStage();
  }
  function fit(){
    const b=stage.getBoundingClientRect();setZoom(Math.min(1.5,Math.max(.2,Math.min((b.width-60)/W,(b.height-60)/H))));
  }
  async function importFile(file,reset=true){
    if(!file)return;
    if(file.size>MAX_FILE)throw Error('Файл больше 25 МБ. Для редактора требуется меньший исходник.');
    const type=file.type,ext=(file.name.split('.').pop()||'').toLowerCase();
    if(!['svg','png','jpg','jpeg','webp'].includes(ext)&&!/^image\/(svg\+xml|png|jpeg|webp)$/.test(type)){
      sourceUnsupported=true;
      throw Error('Встроенное редактирование '+(ext||'этого формата').toUpperCase()+' пока не поддерживается. Исходник остаётся в Макетной без изменений. Для редактирования здесь откройте SVG, PNG или JPG либо создайте новый логотип.');
    }
    const xml=ext==='svg'||type==='image/svg+xml';
    if(reset){layer.replaceChildren();selected=null;W=900;H=600}
    if(xml){
      const string=await file.text();
      const documentSvg=new DOMParser().parseFromString(string,'image/svg+xml');
      const root=documentSvg.documentElement;
      if(root.localName!=='svg'||documentSvg.querySelector('parsererror'))throw Error('Не удалось прочитать SVG.');
      if(reset){
        const vb=(root.getAttribute('viewBox')||'').split(/[,\s]+/).map(Number);
        if(vb.length===4&&vb.every(Number.isFinite)&&vb[2]>0&&vb[3]>0){
          W=clamp(vb[2],1,10000);H=clamp(vb[3],1,10000);
        }else{
          W=clamp(parseFloat(root.getAttribute('width'))||900,1,10000);
          H=clamp(parseFloat(root.getAttribute('height'))||600,1,10000);
        }
      }
      const wrapper=S('g',{'data-label':file.name.replace(/\.svg$/i,'')});
      const nested=root.cloneNode(true);scrub(nested);
      if(reset){nested.setAttribute('x','0');nested.setAttribute('y','0');nested.setAttribute('width',String(W));nested.setAttribute('height',String(H))}
      // Root SVG may have a non-zero viewBox origin: nest it rather than shifting paths.
      if(!reset){
        nested.setAttribute('x',String(W*.2));nested.setAttribute('y',String(H*.2));
        nested.setAttribute('width',String(W*.6));nested.setAttribute('height',String(H*.6));
      }
      wrapper.appendChild(document.importNode(nested,true));layer.appendChild(wrapper);
      hasFonts=!!wrapper.querySelector('text');
    }else{
      const uri=await new Promise((resolve,reject)=>{
        const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=()=>reject(Error('Ошибка чтения картинки'));r.readAsDataURL(file);
      });
      const img=await new Promise((resolve,reject)=>{
        const n=new Image();n.onload=()=>resolve(n);n.onerror=()=>reject(Error('Изображение повреждено'));n.src=uri;
      });
      if(reset){W=clamp(img.naturalWidth,1,10000);H=clamp(img.naturalHeight,1,10000)}
      const scale=reset?1:Math.min(1,W*.6/img.naturalWidth,H*.6/img.naturalHeight);
      const image=S('image',{x:reset?0:W*.2,y:reset?0:H*.2,width:img.naturalWidth*scale,height:img.naturalHeight*scale,preserveAspectRatio:'xMidYMid meet','data-label':file.name});
      image.setAttributeNS(XL,'href',uri);layer.appendChild(image);
    }
    if(reset){history=[];index=-1;zoom=1;loadedName=file.name.replace(/\.[^.]+$/,'');sizeStage();snapshot(true);dirty=false;fit()}
    else snapshot();
    select(layer.lastElementChild);
    status='Изображение загружено. Изменения ещё не применены в шаблоне.';refresh();
  }
  function addShape(kind,a,b){
    const x=Math.min(a.x,b.x),y=Math.min(a.y,b.y),w=Math.abs(a.x-b.x),h=Math.abs(a.y-b.y);
    if(kind==='rect')return S('rect',{x,y,width:Math.max(1,w),height:Math.max(1,h),fill:'#81b315'});
    if(kind==='ellipse')return S('ellipse',{cx:x+w/2,cy:y+h/2,rx:Math.max(.5,w/2),ry:Math.max(.5,h/2),fill:'#81b315'});
    if(kind==='line')return S('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,stroke:'#435159','stroke-width':3,'stroke-linecap':'round'});
    return null;
  }
  function begin(e){
    if(e.button!==0||!active)return;
    const p=point(e),node=e.target.closest?.('[data-path-index]'),handle=e.target.closest?.('[data-handle]')?.dataset.handle;
    if(tool==='nodes'&&selected?.localName==='path'&&node){
      const segments=window.gwbLogoPath?.parse(selected.getAttribute('d'));
      if(!segments)return;
      gesture={type:'node',el:selected,segments,index:Number(node.dataset.pathIndex),key:node.dataset.pathKey};
      svg.setPointerCapture(e.pointerId);e.preventDefault();return;
    }
    if(tool==='nodes'){const obj=owner(e.target);if(obj?.localName==='path')select(obj);return}
    if(handle&&selected){
      const b=bbox(selected);
      gesture={type:'scale',a:p,b,handle,el:selected,transform:selected.getAttribute('transform')||''};
      svg.setPointerCapture(e.pointerId);e.preventDefault();return;
    }
    if(tool==='select'){
      const obj=owner(e.target);select(obj,e.shiftKey);
      if(obj&&!e.shiftKey)gesture={type:'move',a:p,el:obj,transform:obj.getAttribute('transform')||''};
    }else if(tool==='text'){
      const obj=S('text',{x:p.x,y:p.y,fill:'#253841','font-family':'Arial, sans-serif','font-size':Math.max(18,Math.round(H/18))});
      obj.textContent='Текст';layer.append(obj);select(obj);snapshot();
      $('gwbVeText').focus();$('gwbVeText').select();hasFonts=true;
      setTool('select');
    }else if(tool==='pen'){
      if(!gesture||gesture.type!=='pen'){
        const el=S('polyline',{points:p.x+','+p.y,fill:'none',stroke:'#435159','stroke-width':3,'stroke-linecap':'round','stroke-linejoin':'round'});
        layer.append(el);gesture={type:'pen',el,points:[p]};
      }else{gesture.points.push(p);gesture.el.setAttribute('points',gesture.points.map(q=>q.x+','+q.y).join(' '));}
    }else if(tool==='free'){
      const el=S('path',{d:'M '+p.x+' '+p.y,fill:'none',stroke:'#435159','stroke-width':3,'stroke-linecap':'round','stroke-linejoin':'round'});
      layer.append(el);gesture={type:'free',el,last:p};svg.setPointerCapture(e.pointerId);
    }else{
      const el=addShape(tool,p,{x:p.x+1,y:p.y+1});
      if(el){layer.append(el);gesture={type:'draw',kind:tool,a:p,el};svg.setPointerCapture(e.pointerId)}
    }
    if(gesture)e.preventDefault();
  }
  function motion(e){
    if(!gesture)return;
    const p=point(e),g=gesture;
    if(g.type==='node'){
      const local=new DOMPoint(e.clientX,e.clientY).matrixTransform(g.el.getScreenCTM().inverse());
      const seg=g.segments[g.index],key=g.key,yk=key==='x'?'y':key==='x1'?'y1':'y2';
      seg[key]=local.x;seg[yk]=local.y;
      g.el.setAttribute('d',window.gwbLogoPath.stringify(g.segments));
    }else if(g.type==='move'){
      const dx=p.x-g.a.x,dy=p.y-g.a.y;
      g.el.setAttribute('transform','translate('+dx+' '+dy+') '+g.transform);
    }else if(g.type==='scale'){
      const b=g.b,dir=g.handle,dx=p.x-g.a.x,dy=p.y-g.a.y;
      const west=dir.includes('w'),east=dir.includes('e'),north=dir.includes('n'),south=dir.includes('s');
      const sx=west?Math.max(.02,(b.w-dx)/Math.max(1,b.w)):east?Math.max(.02,(b.w+dx)/Math.max(1,b.w)):1;
      const sy=north?Math.max(.02,(b.h-dy)/Math.max(1,b.h)):south?Math.max(.02,(b.h+dy)/Math.max(1,b.h)):1;
      const ax=west?b.x+b.w:b.x,ay=north?b.y+b.h:b.y;
      g.el.setAttribute('transform','translate('+ax+' '+ay+') scale('+sx+' '+sy+') translate('+(-ax)+' '+(-ay)+') '+g.transform);
    }else if(g.type==='draw'){
      const next=addShape(g.kind,g.a,p);if(next){layer.replaceChild(next,g.el);g.el=next}
    }else if(g.type==='free'){
      const d=g.el.getAttribute('d');if(Math.hypot(p.x-g.last.x,p.y-g.last.y)>1){g.el.setAttribute('d',d+' L '+p.x+' '+p.y);g.last=p}
    }
    drawHandles();
  }
  function finish(e){
    if(!gesture||gesture.type==='pen')return;
    const completed=gesture;gesture=null;
    if(svg.hasPointerCapture?.(e.pointerId))svg.releasePointerCapture(e.pointerId);
    if(completed.type==='move'||completed.type==='scale'||completed.type==='draw'||completed.type==='free'||completed.type==='node'){
      select(completed.el);snapshot();
    }
  }
  function finishPen(){
    if(gesture?.type!=='pen')return;
    const g=gesture;gesture=null;
    if(g.points.length<2){g.el.remove();return}
    snapshot();select(g.el);setTool('select');
  }
  function setTool(name){
    if(tool==='pen'&&name!=='pen')finishPen();
    tool=name;
    document.querySelectorAll('#gwbVeTools [data-tool]').forEach(b=>b.classList.toggle('is-active',b.dataset.tool===name));
    svg.style.cursor=name==='select'?'default':name==='text'?'text':'crosshair';
    refresh();
  }
  function changeShapeColor(attr,value){
    if(!selected)return;
    const targets=selected.localName==='g'?selected.querySelectorAll('path,rect,ellipse,circle,line,polyline,polygon,text'): [selected];
    targets.forEach(n=>n.setAttribute(attr,value));
    snapshot();refresh();
  }
  function moveLayer(delta){
    if(!selected)return;
    const sib=delta>0?selected.nextElementSibling:selected.previousElementSibling;
    if(sib){if(delta>0)sib.after(selected);else sib.before(selected);snapshot()}
  }
  function duplicate(){
    if(!selected)return;
    const n=selected.cloneNode(true),t=n.getAttribute('transform')||'';
    n.setAttribute('transform','translate(18 18) '+t);selected.after(n);select(n);snapshot();
  }
  function ungroupSelected(){
    if(!selected||selected.localName!=='g')return;
    let group=selected;
    if(group.children.length===1&&group.firstElementChild.localName==='svg'){
      const nested=group.firstElementChild;
      const vb=(nested.getAttribute('viewBox')||'0 0 '+W+' '+H).trim().split(/[\s,]+/).map(Number);
      const valid=vb.length===4&&vb.every(Number.isFinite)&&vb[2]>0&&vb[3]>0;
      const vx=valid?vb[0]:0,vy=valid?vb[1]:0,vw=valid?vb[2]:W,vh=valid?vb[3]:H;
      const x=num(nested.getAttribute('x')),y=num(nested.getAttribute('y'));
      const width=num(nested.getAttribute('width'),vw),height=num(nested.getAttribute('height'),vh);
      const scale=Math.min(width/vw,height/vh);
      const tx=x+(width-vw*scale)/2,ty=y+(height-vh*scale)/2;
      const old=(group.getAttribute('transform')||'');
      group.setAttribute('transform',old+' translate('+tx+' '+ty+') scale('+scale+') translate('+(-vx)+' '+(-vy)+')');
      for(const child of Array.from(nested.children))group.append(child);
      nested.remove();
    }
    const tf=group.getAttribute('transform')||'';
    const inherited=['fill','stroke','stroke-width','opacity','font-family','font-size'];
    const children=Array.from(group.children);
    for(const n of children){
      for(const attr of inherited){
        if(group.hasAttribute(attr)&&!n.hasAttribute(attr))n.setAttribute(attr,group.getAttribute(attr));
      }
      if(tf)n.setAttribute('transform',tf+' '+(n.getAttribute('transform')||''));
      group.before(n);
    }
    group.remove();selected=children.find(n=>n.localName!=='defs')||null;
    snapshot();refresh();
  }
  function smoothSelected(){
    if(!selected||!window.gwbLogoPath)return;
    let d='';
    if(selected.localName==='polyline'||selected.localName==='polygon'){
      d=window.gwbLogoPath.smoothPolyline(selected.getAttribute('points'),selected.localName==='polygon');
    }else if(selected.localName==='path'){
      const seg=window.gwbLogoPath.parse(selected.getAttribute('d'));
      if(!seg||!seg.length||seg.some(n=>!['M','L','Z'].includes(n.cmd))){
        status='Сглаживание применяется к ломаным M/L. Для кривых используйте инструмент «Узлы».';refresh();return;
      }
      const pts=seg.filter(n=>n.cmd!=='Z').map(n=>n.x+','+n.y).join(' ');
      d=window.gwbLogoPath.smoothPolyline(pts,seg.some(n=>n.cmd==='Z'));
    }
    if(!d){status='Не удалось сгладить выбранную ломаную.';refresh();return}
    const path=S('path',{d});
    for(const at of Array.from(selected.attributes))if(!['points','d'].includes(at.name))path.setAttribute(at.name,at.value);
    selected.replaceWith(path);select(path);snapshot();
    setTool('nodes');
  }
  async function cropSelected(){
    if(selected?.localName!=='image')return;
    const el=selected,href=el.getAttribute('href')||el.getAttributeNS(XL,'href')||'';
    if(!/^data:image\//i.test(href)){status='Обрезка доступна только для встроенного растрового файла';refresh();return}
    const inputs=['left','top','right','bottom'].map(v=>Number($('gwbVeCrop'+v)?.value||0));
    if(inputs.some(v=>!Number.isFinite(v)||v<0||v>95)||inputs[0]+inputs[2]>=100||inputs[1]+inputs[3]>=100){
      status='Неверные отступы обрезки';refresh();return
    }
    const img=new Image();
    try{await new Promise((yes,no)=>{img.onload=yes;img.onerror=()=>no(Error('Растр не удалось декодировать'));img.src=href})}
    catch(err){status=err.message;refresh();return}
    const [l,t,r,b]=inputs.map(v=>v/100);
    const px=Math.floor(img.naturalWidth*l),py=Math.floor(img.naturalHeight*t);
    const pw=Math.max(1,Math.ceil(img.naturalWidth*(1-r))-px),ph=Math.max(1,Math.ceil(img.naturalHeight*(1-b))-py);
    const canvas=document.createElement('canvas');canvas.width=pw;canvas.height=ph;
    canvas.getContext('2d').drawImage(img,px,py,pw,ph,0,0,pw,ph);
    const x=num(el.getAttribute('x')),y=num(el.getAttribute('y')),w=num(el.getAttribute('width')),h=num(el.getAttribute('height'));
    el.setAttribute('x',x+w*l);el.setAttribute('y',y+h*t);
    el.setAttribute('width',w*(1-l-r));el.setAttribute('height',h*(1-t-b));
    el.setAttributeNS(XL,'href',canvas.toDataURL('image/png'));
    ['left','top','right','bottom'].forEach(v=>$('gwbVeCrop'+v).value=0);
    snapshot();status='Растр обрезан без масштабирования оставшихся пикселей.';refresh();
  }
  function deleteSelected(){
    if(!selected)return;
    selected.remove();selected=null;snapshot();
  }
  function rotate(deg){
    const b=bbox(selected);if(!b)return;
    const cx=b.x+b.w/2,cy=b.y+b.h/2;
    selected.setAttribute('transform','rotate('+deg+' '+cx+' '+cy+') '+(selected.getAttribute('transform')||''));
    snapshot();refresh();
  }
  function setup(){
    if(shell)return;
    const css=document.createElement('style');css.id='gwbLogoEditorStyle';
    css.textContent=[
      '#gwbLogoEditor[hidden]{display:none!important}',
      '#gwbLogoEditor{position:fixed;inset:0;z-index:2147483300;background:#f4f6f6;color:#344950;font:13px/1.4 Inter,system-ui,"Segoe UI",sans-serif;display:flex;flex-direction:column;isolation:isolate}',
      '#gwbLogoEditor *{box-sizing:border-box}',
      '#gwbLogoEditor button,#gwbLogoEditor input,#gwbLogoEditor select{font:inherit}',
      '#gwbLogoEditor button{border:1px solid #d4dede;background:#fff;color:#394f56;border-radius:5px;padding:7px 10px;cursor:pointer;white-space:nowrap}',
      '#gwbLogoEditor button:hover:not(:disabled){background:#edf5df;border-color:#a7c56b}',
      '#gwbLogoEditor button:disabled{opacity:.4;cursor:default}',
      '#gwbLogoEditor .gwb-ve-header{display:flex;align-items:center;gap:12px;min-height:65px;padding:10px 20px;background:#435159;color:white}',
      '#gwbLogoEditor .gwb-ve-logo{background:#81b315;width:34px;height:34px;display:grid;place-items:center;font-size:20px;font-weight:750;border-radius:3px}',
      '#gwbLogoEditor .gwb-ve-title{font-size:18px;font-weight:700;margin-right:auto}',
      '#gwbLogoEditor .gwb-ve-title small{display:block;font-size:11px;font-weight:400;color:#c8d3d3}',
      '#gwbLogoEditor .gwb-ve-header button{background:#52626a;color:#fff;border-color:#778b92}',
      '#gwbLogoEditor .gwb-ve-header .gwb-ve-apply{background:#81b315;color:#fff;border-color:#81b315;font-weight:700}',
      '#gwbLogoEditor .gwb-ve-bar{display:flex;align-items:center;gap:5px;padding:8px 15px;background:white;border-bottom:1px solid #dae1df;overflow-x:auto;flex-shrink:0}',
      '#gwbLogoEditor .gwb-ve-bar .is-active{background:#e8f5cd;border-color:#81b315;color:#4b7112;font-weight:700}',
      '#gwbLogoEditor .gwb-ve-main{display:grid;grid-template-columns:1fr 260px;min-height:0;flex:1}',
      '#gwbLogoEditor .gwb-ve-stage{overflow:auto;position:relative;background-color:#e9eeed;background-image:linear-gradient(45deg,#dde5e3 25%,transparent 25%),linear-gradient(-45deg,#dde5e3 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#dde5e3 75%),linear-gradient(-45deg,transparent 75%,#dde5e3 75%);background-size:20px 20px;background-position:0 0,0 10px,10px -10px,-10px 0;padding:40px;display:flex;align-items:flex-start;justify-content:center}',
      '#gwbLogoEditor .gwb-ve-page{flex-shrink:0;box-shadow:0 16px 44px #25353a31;background:#fff;touch-action:none;user-select:none}',
      '#gwbLogoEditor .gwb-ve-aside{overflow:auto;border-left:1px solid #dae1df;background:#fff;padding:16px;display:flex;flex-direction:column;gap:13px}',
      '#gwbLogoEditor .gwb-ve-aside h3{font-size:13px;color:#52696c;margin:0;border-bottom:1px solid #e4e8e8;padding-bottom:8px}',
      '#gwbLogoEditor .gwb-ve-aside label{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:28px}',
      '#gwbLogoEditor .gwb-ve-aside input:not([type=color]){min-width:0;width:125px;padding:5px;border:1px solid #d1dddd;border-radius:4px}',
      '#gwbLogoEditor .gwb-ve-aside input[type=color]{width:65px;height:29px;padding:2px;border:1px solid #d1dddd;background:#fff;border-radius:4px}',
      '#gwbLogoEditor .gwb-ve-layer{display:block;width:100%;text-align:left;border-radius:3px!important;margin-top:4px;overflow:hidden;text-overflow:ellipsis}',
      '#gwbLogoEditor .gwb-ve-layer.is-selected{border-color:#81b315;background:#eff7df}',
      '#gwbLogoEditor .gwb-ve-small{font-size:11px;color:#77878c}',
      '#gwbLogoEditor .gwb-ve-footer{min-height:34px;display:flex;align-items:center;gap:18px;padding:7px 17px;border-top:1px solid #d4dfdc;background:#fff;color:#63757b}',
      '#gwbLogoEditor .gwb-ve-footer span:first-child{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '#gwbLogoEditor .gwb-ve-hiddenfile{display:none}',
      '#gwbLogoEditor .gwb-ve-crop-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px}',
      '#gwbLogoEditor .gwb-ve-crop-grid label{display:grid;gap:3px;font-size:11px}',
      '#gwbLogoEditor .gwb-ve-crop-grid input{width:100%!important}',
      '#gwbLogoEditor .gwb-ve-separator{border-left:1px solid #dae1df;height:24px;margin:0 6px}',
      '@media(max-width:850px){#gwbLogoEditor .gwb-ve-main{grid-template-columns:1fr 205px}#gwbLogoEditor .gwb-ve-aside{padding:10px}#gwbLogoEditor .gwb-ve-stage{padding:18px}}',
      '@media(max-width:600px){#gwbLogoEditor .gwb-ve-main{display:flex;flex-direction:column}#gwbLogoEditor .gwb-ve-aside{max-height:200px;border-left:0;border-top:1px solid #dae1df}#gwbLogoEditor .gwb-ve-header{padding:8px}#gwbLogoEditor .gwb-ve-header button{padding:6px}}'
    ].join('\n');
    document.head.append(css);
    shell=document.createElement('div');shell.id='gwbLogoEditor';shell.hidden=true;
    shell.setAttribute('role','dialog');shell.setAttribute('aria-modal','true');shell.setAttribute('aria-label','Редактор логотипа');
    shell.innerHTML=[
      '<div class="gwb-ve-header"><span class="gwb-ve-logo">М</span><div class="gwb-ve-title">Редактор логотипа<small>Встроенный векторный редактор · SVG / PNG / JPG</small></div>',
      '<button type="button" id="gwbVeCancel">Закрыть</button><button type="button" id="gwbVeDownload">Скачать SVG</button><button type="button" class="gwb-ve-apply" id="gwbVeApply">Применить в шаблоне</button></div>',
      '<div class="gwb-ve-bar" id="gwbVeTools">',
      '<button type="button" class="is-active" data-tool="select" title="Выделить, переместить, масштабировать">Выбор (V)</button>',
      '<button type="button" data-tool="rect">▭ Прямоугольник</button><button type="button" data-tool="ellipse">◯ Эллипс</button>',
      '<button type="button" data-tool="line">╱ Линия</button><button type="button" data-tool="pen">⌁ Контур</button>',
      '<button type="button" data-tool="free">✎ Карандаш</button><button type="button" data-tool="text">T Текст</button>',
      '<button type="button" data-tool="nodes" title="Перемещать узлы и управляющие точки кривых Безье">Узлы (N)</button><button type="button" id="gwbVeSmooth">Сгладить контур</button>',
      '<i class="gwb-ve-separator"></i><button type="button" id="gwbVeNew">Новый</button><button type="button" id="gwbVeImport">+ Изображение</button>',
      '<input class="gwb-ve-hiddenfile" id="gwbVeImageFile" type="file" accept=".svg,.png,.jpg,.jpeg,.webp,image/svg+xml,image/png,image/jpeg,image/webp">',
      '<button type="button" id="gwbVeUndo">↶ Отменить</button><button type="button" id="gwbVeRedo">↷ Повторить</button>',
      '<button type="button" id="gwbVeDuplicate">Дублировать</button><button type="button" id="gwbVeGroup">Группировать</button><button type="button" id="gwbVeUngroup">Разгруппировать</button><button type="button" id="gwbVeDelete">Удалить</button>',
      '<button type="button" id="gwbVeFit">Вписать</button><button type="button" id="gwbVeMinus">−</button><span id="gwbVeZoomText">100%</span><button type="button" id="gwbVePlus">+</button></div>',
      '<div class="gwb-ve-main"><div class="gwb-ve-stage" id="gwbVeStage">',
      '<svg id="gwbVeCanvas" class="gwb-ve-page" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 600" width="900" height="600"><g id="gwbVeLayer"></g><g id="gwbVeUi"></g></svg>',
      '<div id="gwbVeEmpty" style="display:none"></div></div>',
      '<aside class="gwb-ve-aside"><h3>Свойства объекта</h3>',
      '<label>Заливка <input type="color" id="gwbVeFill" value="#81b315"></label>',
      '<label>Обводка <input type="color" id="gwbVeStroke" value="#435159"></label>',
      '<label>Толщина, px <input type="number" id="gwbVeStrokeWidth" min="0" max="100" step=".5" value="2"></label>',
      '<label>Прозрачность <input type="range" id="gwbVeOpacity" min="0" max="1" step=".05" value="1"></label>',
      '<label>Поворот, ° <input type="number" id="gwbVeRotation" step="15" value="0"></label>',
      '<div id="gwbVeTextBox" hidden><h3>Содержимое текста</h3><textarea id="gwbVeText" rows="3" style="width:100%;resize:vertical"></textarea>',
      '<label>Размер <input type="number" id="gwbVeFont" value="48" min="1" max="500" step="1"></label></div>',
      '<h3>Растр: обрезка, % от края</h3>',
      '<div class="gwb-ve-crop-grid"><label>Слева<input id="gwbVeCropleft" type="number" min="0" max="95" value="0"></label>',
      '<label>Сверху<input id="gwbVeCroptop" type="number" min="0" max="95" value="0"></label>',
      '<label>Справа<input id="gwbVeCropright" type="number" min="0" max="95" value="0"></label>',
      '<label>Снизу<input id="gwbVeCropbottom" type="number" min="0" max="95" value="0"></label></div>',
      '<button id="gwbVeCrop" type="button">Обрезать выделенный растр</button>',
      '<h3>Объекты / слои</h3><div id="gwbVeLayers"></div>',
      '<div style="display:flex;gap:6px"><button id="gwbVeUp" type="button">Выше ↑</button><button id="gwbVeDown" type="button">Ниже ↓</button></div>',
      '<p class="gwb-ve-small">SVG сохраняет векторные контуры. Растровые изображения остаются растром внутри SVG, а текст — редактируемым текстом, не кривыми. Для типографии учитывайте требования нанесения.</p>',
      '</aside></div><div class="gwb-ve-footer"><span id="gwbVeStatus" role="status">Редактор готов</span><span id="gwbVeDocSize">900 × 600 SVG</span></div>'
    ].join('');
    document.body.append(shell);
    svg=$('gwbVeCanvas');layer=$('gwbVeLayer');ui=$('gwbVeUi');stage=$('gwbVeStage');layersPanel=$('gwbVeLayers');
    svg.addEventListener('pointerdown',begin);svg.addEventListener('pointermove',motion);svg.addEventListener('pointerup',finish);svg.addEventListener('pointercancel',finish);
    svg.addEventListener('dblclick',()=>{if(tool==='pen')finishPen()});
    $('gwbVeTools').addEventListener('click',e=>{const t=e.target.closest('[data-tool]');if(t)setTool(t.dataset.tool)});
    $('gwbVeCancel').onclick=close;
    $('gwbVeApply').onclick=apply;
    $('gwbVeDownload').onclick=download;
    $('gwbVeNew').onclick=()=>{if(dirty&&!confirm('Создать чистый документ? Несохранённые изменения будут потеряны.'))return;initBlank();status='Новый SVG-документ';refresh()};
    $('gwbVeImport').onclick=()=>$('gwbVeImageFile').click();
    $('gwbVeImageFile').onchange=async e=>{try{await importFile(e.target.files?.[0],false)}catch(err){status=err.message;refresh()}finally{e.target.value=''}};
    $('gwbVeUndo').onclick=()=>undo(-1);$('gwbVeRedo').onclick=()=>undo(1);
    $('gwbVeDuplicate').onclick=duplicate;$('gwbVeDelete').onclick=deleteSelected;
    $('gwbVeGroup').onclick=groupSelection;
    $('gwbVeSmooth').onclick=smoothSelected;
    $('gwbVeCrop').onclick=()=>void cropSelected();
    $('gwbVeUngroup').onclick=ungroupSelected;
    $('gwbVeUp').onclick=()=>moveLayer(1);$('gwbVeDown').onclick=()=>moveLayer(-1);
    $('gwbVeFit').onclick=fit;$('gwbVePlus').onclick=()=>setZoom(zoom*1.25);$('gwbVeMinus').onclick=()=>setZoom(zoom/1.25);
    $('gwbVeFill').onchange=e=>changeShapeColor('fill',e.target.value);
    $('gwbVeStroke').onchange=e=>changeShapeColor('stroke',e.target.value);
    $('gwbVeStrokeWidth').onchange=e=>changeShapeColor('stroke-width',e.target.value);
    $('gwbVeOpacity').onchange=e=>{if(selected){selected.setAttribute('opacity',e.target.value);snapshot()}};
    $('gwbVeRotation').onchange=e=>{rotate(num(e.target.value));e.target.value=0};
    $('gwbVeText').onchange=e=>{
      if(!selected)return;const n=selected.localName==='text'?selected:selected.querySelector('text');
      if(n){n.textContent=e.target.value;snapshot();refresh()}
    };
    $('gwbVeFont').onchange=e=>{
      if(!selected)return;const n=selected.localName==='text'?selected:selected.querySelector('text');
      if(n){n.setAttribute('font-size',String(clamp(num(e.target.value,48),1,500)));snapshot();refresh()}
    };
    window.addEventListener('keydown',e=>{
      if(!active)return;
      const typing=/^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName||'');
      if(e.key==='Escape'){if(gesture?.type==='pen'){finishPen()}else if(!typing)close();return}
      if(typing)return;
      if(e.ctrlKey||e.metaKey){
        if(e.key.toLowerCase()==='z'){e.preventDefault();undo(e.shiftKey?1:-1)}
        else if(e.key.toLowerCase()==='y'){e.preventDefault();undo(1)}
        else if(e.key.toLowerCase()==='d'){e.preventDefault();duplicate()}
        return;
      }
      if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();deleteSelected()}
      else if(e.key.toLowerCase()==='v')setTool('select');
      else if(e.key.toLowerCase()==='n')setTool('nodes');
      else if(e.key==='Enter'&&tool==='pen')finishPen();
    },true);
    window.addEventListener('beforeunload',e=>{if(active&&dirty){e.preventDefault();e.returnValue=''}});
    initBlank();
  }
  function close(){
    if(gesture?.type==='pen')finishPen();
    if(dirty&&!confirm('Закрыть редактор? Несохранённые изменения не попадут в шаблон.'))return;
    active=false;shell.hidden=true;status='';dirty=false;openedToken=null;
  }
  async function open(){
    if(opening)return;opening=true;
    setup();artInput=$('artwork');active=true;shell.hidden=false;
    initBlank();status='Новый логотип. Можно рисовать и добавлять текст.';
    openedToken=null;
    const bridge=typeof window.gwbGetActiveLogoForEditor==='function'?window.gwbGetActiveLogoForEditor():null;
    let file=null;
    if(bridge){
      openedToken=bridge.token;
      if(bridge.hasArtwork){
        file=bridge.file;
        status='Редактируется логотип выбранного поля'+(Number.isInteger(bridge.fieldIndex)?' №'+(bridge.fieldIndex+1):'')+'.';
        if(!file)status='Исходный файл выбранного поля недоступен. Загрузите подходящий SVG или PNG/JPG.';
      }else status='В выбранном поле нет логотипа. Создайте новый.';
    }else if(typeof window.gwbGetActiveLogoForEditor==='function'){
      status='Выберите конкретное поле для редактирования логотипа.';
    }else{
      const label=String($('artworkName')?.textContent||'').trim();
      const slot=currentSlot();
      const slotFile=sourceFilesBySlot.get(slot)||null;
      file=artInput?.files?.[0]||slotFile||
        (!sourceFilesBySlot.size?sourceFilesByName.get(label):null);
    }
    if(file){
      try{await importFile(file,true)}
      catch(err){status=err.message;refresh()}
    }
    else if(!bridge&&typeof window.gwbGetActiveLogoForEditor!=='function'&&
      typeof window.gwbGetEditorReadiness==='function'&&window.gwbGetEditorReadiness()?.logoReady){
      status='Исходный логотип недоступен. Выберите его файл или создайте новый SVG.';
    }
    fit();refresh();opening=false;
  }
  function svgBlob(){return new Blob([serialize()],{type:'image/svg+xml;charset=utf-8'})}
  function download(){
    const u=URL.createObjectURL(svgBlob()),a=document.createElement('a');
    a.href=u;a.download=escapeName(loadedName)+'-edited.svg';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1500);
  }
  async function apply(){
    if(gesture?.type==='pen')finishPen();
    const input=$('artwork');
    if(!input){status='Поле загрузки логотипа не найдено';refresh();return}
    if(!layer.children.length){status='Добавьте хотя бы один объект перед применением';refresh();return}
    if(layer.querySelector('image')&&!confirm('В изображении присутствует растр. Даже внутри SVG он не становится векторным. Продолжить?'))return;
    const blob=svgBlob(),file=new File([blob],escapeName(loadedName)+'-edited.svg',{type:'image/svg+xml',lastModified:Date.now()});
    try{
      if(openedToken!==null&&typeof window.gwbApplyEditedLogoToActiveField==='function'){
        $('gwbVeApply').disabled=true;
        try{
          await window.gwbApplyEditedLogoToActiveField(file,openedToken);
          dirty=false;active=false;shell.hidden=true;
        }finally{$('gwbVeApply').disabled=false}
        return;
      }
      const dt=new DataTransfer();dt.items.add(file);input.files=dt.files;
      input.dispatchEvent(new Event('input',{bubbles:true}));
      input.dispatchEvent(new Event('change',{bubbles:true}));
      dirty=false;active=false;shell.hidden=true;
      const s=$('status');if(s)s.textContent='Логотип передан в шаблон. Проверка PrintCheck выполняется штатно.';
    }catch(error){status='Не удалось передать SVG в Макетную: '+error.message;refresh()}
  }
  function start(){
    btn=$('editorOpenLogoEditor');
    artInput=$('artwork');
    // Capture phase runs before the existing uploader's onchange handler clears
    // the file input. Never overwrite its existing handler.
    if(artInput)artInput.addEventListener('change',captureArtwork,true);
    if(btn)btn.addEventListener('click',open);
    window.gwbLogoEditor={open:open,get active(){return active}};
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();