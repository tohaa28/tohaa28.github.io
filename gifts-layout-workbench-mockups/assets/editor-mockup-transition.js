/* Presentation only: the native iframe and handoff remain the source of truth. */
(()=>{
  window.gwbCreateMockupTransition=({shell,open,back})=>{
    const app=document.querySelector('.app'), root=document.documentElement;
    const scene=document.createElement('section');
    scene.id='gwbMockupTransition';scene.hidden=true;
    scene.setAttribute('aria-label','Переход между редакторами');
    scene.innerHTML=`<div class="gmt-grid"></div><div class="gmt-glass gmt-glass-a"></div><div class="gmt-glass gmt-glass-b"></div><div class="gmt-heading"><span class="gmt-mark">М</span><div><small>МАКЕТНАЯ · РАБОЧЕЕ ПРОСТРАНСТВО</small><strong>Из макета — в изделие</strong><p role="status" aria-live="polite">Открываем редактор мокапов</p></div></div><div class="gmt-cards"><div class="gmt-card gmt-layout"><div class="gmt-card-bar"><i></i><span>ПОЛЕ НАНЕСЕНИЯ</span></div><div class="gmt-paper"><canvas></canvas><span class="gmt-empty">М</span></div></div><div class="gmt-card gmt-product"><div class="gmt-card-bar"><i></i><span>ФОТО ИЗДЕЛИЯ</span></div><div class="gmt-photo"><img alt="Фото выбранного изделия"></div></div><div class="gmt-sweep"></div></div><div class="gmt-footer"><span>МАКЕТ <i></i> МОКАП</span><div class="gmt-line"><b></b></div><button type="button">← Вернуться в Макетную</button></div>`;
    document.body.append(scene);
    const title=scene.querySelector('strong'),status=scene.querySelector('[role=status]'),photo=scene.querySelector('img'),canvas=scene.querySelector('canvas'),cancel=scene.querySelector('button');
    let phase='closed',epoch=0,timers=[],started=0,ready=false,saved=null;
    const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
    const later=(fn,ms)=>{const id=setTimeout(fn,ms);timers.push(id);return id};
    const clear=()=>{timers.forEach(clearTimeout);timers=[];scene.getAnimations({subtree:true}).forEach(a=>a.cancel());};
    const snapshot=()=>{
      const base=document.getElementById('templateCanvas'),overlay=document.getElementById('overlay');
      canvas.width=640;canvas.height=480;
      scene.classList.remove('has-layout','has-photo');photo.removeAttribute('src');
      if(!base?.width||!base?.height)return;
      const ratio=Math.min(1,1024/base.width,1024/base.height);
      canvas.width=Math.max(1,Math.round(base.width*ratio));canvas.height=Math.max(1,Math.round(base.height*ratio));
      try{const ctx=canvas.getContext('2d');ctx.drawImage(base,0,0,canvas.width,canvas.height);if(overlay?.width)ctx.drawImage(overlay,0,0,canvas.width,canvas.height);scene.classList.add('has-layout')}catch{}
    };
    const focus=el=>{try{el?.focus({preventScroll:true})}catch{}};
    const finishOpen=()=>{
      if(phase!=='opening')return;
      phase='revealing';scene.classList.add('gmt-reveal');shell.inert=false;
      later(()=>{if(phase!=='revealing')return;scene.hidden=true;scene.classList.remove('gmt-forward','gmt-reveal','gmt-waiting');phase='open';focus(back)},reduced()?0:240);
    };
    const revealWhenReady=()=>{if(phase!=='opening'||!ready)return;later(finishOpen,Math.max(0,(reduced()?0:660)-(performance.now()-started)))};
    const close=()=>{
      if(phase==='closed'||phase==='closing')return;
      clear();epoch++;phase='closing';scene.hidden=false;scene.className='gmt-return'+(canvas.width&&scene.classList.contains('has-layout')?' has-layout':'');
      title.textContent='Возвращаемся к макету';status.textContent='Ваше рабочее поле сохранено';
      scene.querySelector('.gmt-footer>span').textContent='МОКАП → МАКЕТ';
      cancel.hidden=true;shell.inert=true;
      // Reverse cover conceals the switch without reloading either editor.
      later(()=>{shell.hidden=true;scene.classList.add('gmt-return-reveal')},reduced()?0:220);
      later(()=>{
        shell.hidden=true;shell.inert=false;scene.hidden=true;phase='closed';
        if(saved){root.style.overflow=saved.root;document.body.style.overflow=saved.body;if(app)app.inert=saved.inert;}
        window.dispatchEvent(new Event('resize'));focus(open);saved=null;
      },reduced()?0:500);
    };
    cancel.addEventListener('click',close);
    const onKey=e=>{if(e.key==='Escape'&&phase!=='closed'){e.preventDefault();close()}};
    document.addEventListener('keydown',onKey);
    return {
      show(){
        if(phase!=='closed')return false;
        clear();epoch++;phase='opening';ready=false;started=performance.now();scene.className='';snapshot();
        saved={root:root.style.overflow,body:document.body.style.overflow,inert:app?.inert||false};
        root.style.overflow='hidden';document.body.style.overflow='hidden';if(app)app.inert=true;
        title.textContent='Из макета — в изделие';status.textContent='Открываем редактор мокапов';
        scene.querySelector('.gmt-footer>span').textContent='МАКЕТ → МОКАП';
        cancel.hidden=false;scene.hidden=false;scene.classList.add('gmt-forward');shell.hidden=false;shell.inert=true;
        focus(cancel);
        later(()=>{if(phase==='opening'){scene.classList.add('gmt-waiting');status.textContent='Подготавливаем мокап…'}},900);
        // Loading failures must never trap the user behind a decorative layer.
        later(()=>{if(phase==='opening'){status.textContent='Открываем инструменты редактора';finishOpen()}},8000);
        return true;
      },
      hide:close,
      ticket:()=>epoch,
      present(payload,ticket){
        if(ticket!==epoch||phase!=='opening')return;
        const item=payload.item||payload.selectedItem||payload.items?.[0]||payload;
        const candidates=[...(payload.photoCandidates||[]),...(item.photoCandidates||[])];
        const candidate=candidates[0];
        const src=payload.photoDataUrl||(typeof candidate==='string'?candidate:candidate?.dataUrl||candidate?.url||candidate?.src||candidate?.imageUrl)||item.imageUrl||payload.photoUrl;
        if(src){
          photo.onload=()=>{if(ticket===epoch&&phase==='opening')scene.classList.add('has-photo')};
          photo.onerror=()=>scene.classList.remove('has-photo');photo.src=src;
        }
      },
      ready(ticket){if(ticket!==epoch)return;ready=true;revealWhenReady()},
      get phase(){return phase}
    };
  };
})();
