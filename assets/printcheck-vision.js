/* PrintCheck Vision v0.1.0. Read-only UI for the isolated Maketnaya copy.
 * No AI claims, network calls, order mutations or training by end users.
 */
(function(){
'use strict';
if(window.gwbPrintCheckVisionInstalled)return;
window.gwbPrintCheckVisionInstalled=true;
const $=id=>document.getElementById('pcv-'+id);
function init(){
  if(!document.body||$('app'))return;
  const root=document.createElement('div');
  root.id='pcv-host';
  root.innerHTML=`
<button id="pcv-launcher" type="button" aria-controls="pcv-app" aria-expanded="false" title="PrintCheck Vision">
  <span class="pcv-lamp" aria-hidden="true">◈</span><span>PrintCheck Vision</span>
</button>
<section id="pcv-app" role="dialog" aria-modal="true" aria-label="PrintCheck Vision" hidden>
 <header class="pcv-top">
  <span class="pcv-mark" aria-hidden="true">◇</span>
  <div class="pcv-heading"><strong>PrintCheck Vision</strong><small>Визуальная проверка · Изолированная копия Макетной</small></div>
  <span class="pcv-experiment">Интерфейс v0.1 · ИИ не подключён</span>
  <button id="pcv-close" class="pcv-close" type="button" title="Закрыть" aria-label="Закрыть окно">×</button>
 </header>
 <div class="pcv-body">
  <nav class="pcv-nav" aria-label="Разделы PrintCheck Vision">
   <div class="pcv-nav-title">Рабочее место</div>
   <button class="pcv-nav-btn" type="button" data-pcv-view="summary" aria-selected="true"><span class="pcv-nav-symbol" aria-hidden="true">▤</span><span class="pcv-nav-text">Сводка</span></button>
   <button class="pcv-nav-btn" type="button" data-pcv-view="issues" aria-selected="false"><span class="pcv-nav-symbol" aria-hidden="true">◎</span><span class="pcv-nav-text">Замечания</span></button>
   <button class="pcv-nav-btn" type="button" data-pcv-view="spec" aria-selected="false"><span class="pcv-nav-symbol" aria-hidden="true">≡</span><span class="pcv-nav-text">Требования</span></button>
   <button class="pcv-nav-btn" type="button" data-pcv-view="about" aria-selected="false"><span class="pcv-nav-symbol" aria-hidden="true">◇</span><span class="pcv-nav-text">О системе</span></button>
   <div class="pcv-nav-note">Все изображения остаются в браузере. Обучение предназначено только для специалистов.</div>
  </nav>
  <main class="pcv-center">
   <div class="pcv-centerbar">
    <div><strong>Визуальный обзор</strong><div class="pcv-sub">Исходное изображение без изменения макета</div></div>
    <span class="pcv-spacer"></span>
    <div class="pcv-controls">
     <button id="pcv-current" class="pcv-button" type="button">Из Макетной</button>
     <button id="pcv-open-image" class="pcv-button" type="button">Открыть изображение</button>
     <input id="pcv-image-input" class="pcv-hidden-input" type="file" accept="image/png,image/jpeg,image/webp">
    </div>
   </div>
   <div class="pcv-canvas-zone">
    <div class="pcv-image-wrap" id="pcv-image-wrap" hidden><canvas id="pcv-preview" aria-label="Предпросмотр макета"></canvas></div>
    <div class="pcv-empty" id="pcv-empty"><span class="pcv-big" aria-hidden="true">▧</span><strong>Выберите макет для обзора</strong>
     <span>Покажем холст текущего поля или локальный PNG, JPG, WebP. Файлы не отправляются на сервер.</span>
     <button id="pcv-empty-current" class="pcv-button pcv-button-primary" type="button">Показать текущий макет</button>
    </div>
   </div>
   <div class="pcv-bottom"><span><i class="pcv-dot"></i><span id="pcv-preview-state">Изображение не выбрано</span></span>
     <span class="pcv-spacer"></span><span id="pcv-canvas-size" class="pcv-source-name">—</span></div>
  </main>
  <aside class="pcv-aside" aria-label="Результаты анализа">
   <section class="pcv-panel" data-pcv-panel="summary" aria-hidden="false">
    <div class="pcv-eyebrow">Результаты существующего PrintCheck</div><h2>Сводка проверки</h2>
    <p class="pcv-description">Отображаются реальные сообщения текущего редактора. Новый нейросетевой анализ не выполняется.</p>
    <div class="pcv-kpis"><div class="pcv-kpi"><b id="pcv-count-errors">—</b><span>Сообщения о нарушениях</span></div>
      <div class="pcv-kpi"><b id="pcv-count-others">—</b><span>Остальные сообщения</span></div></div>
    <div id="pcv-check-status" class="pcv-status pcv-caution">Ожидаем данные текущего макета.</div>
    <div class="pcv-section-title">Выбранное нанесение</div>
    <dl class="pcv-meta"><dt>Артикул</dt><dd id="pcv-article">—</dd><dt>Метод</dt><dd id="pcv-method">—</dd>
     <dt>Размер лого</dt><dd id="pcv-logo-size">—</dd><dt>Поле</dt><dd id="pcv-field-size">—</dd></dl>
    <div class="pcv-divider"></div>
    <button id="pcv-refresh" class="pcv-button pcv-button-primary" type="button">Обновить сводку</button>
    <p class="pcv-footnote">Отсутствие ошибок штатной проверки не гарантирует технологическую пригодность макета.</p>
   </section>
   <section class="pcv-panel" data-pcv-panel="issues" aria-hidden="true">
    <div class="pcv-eyebrow">Наблюдения</div><h2>Замечания</h2>
    <p class="pcv-description">Сообщения PrintCheck без изменения смысла и без генерации неподтверждённых диагнозов.</p>
    <div id="pcv-issues-list" class="pcv-issue-list"></div>
    <p class="pcv-footnote">Нейронная карта микродефектов будет доступна после испытаний модели на реальных макетах.</p>
   </section>
   <section class="pcv-panel" data-pcv-panel="spec" aria-hidden="true">
    <div class="pcv-eyebrow">Производственные правила</div><h2>Требования</h2>
    <p class="pcv-description">Нормативы привязываются к методу нанесения и версии спецификации.</p>
    <div class="pcv-section-title">Текущий шаблон</div><div id="pcv-requirements" class="pcv-note">Нет данных</div>
    <div class="pcv-section-title">Актуальные нормативы</div><div class="pcv-note">Для окончательного решения необходима проверенная технологическая спецификация.</div>
    <p><a href="https://gifts.ru/nanesenie-logotipa/specifications" target="_blank" rel="noopener noreferrer">Требования gifts.ru</a></p>
   </section>
   <section class="pcv-panel" data-pcv-panel="about" aria-hidden="true">
    <div class="pcv-eyebrow">Исследовательская архитектура</div><h2>Vision Engine</h2>
    <p class="pcv-description">Экономная многоуровневая обработка изображений на CPU.</p>
    <div class="pcv-progress" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
    <ol class="pcv-list"><li>Общий обзор композиции.</li><li>Объекты и отдельные печатные цвета.</li>
     <li>Детальное изучение подозрительных участков.</li><li>Топология, геометрические размеры и технологические нормы.</li></ol>
    <div class="pcv-status pcv-caution">Нейронная сегментация, физические измерения и экспертное обучение ещё не интегрированы. Автоматическое решение «годен» не выносится.</div>
    <p class="pcv-footnote">Пользователи получают только заключение. Специалисты обучают и утверждают отдельные версии модели.</p>
   </section>
  </aside>
 </div>
</section>`;
  document.body.append(root);
  const app=$('app'),launcher=$('launcher');
  let priorFocus=null,refreshPending=false,latest=[];
  const getVal=id=>{
    const element=document.getElementById(id);
    if(!element)return '—';
    const value=typeof element.value==='string'?element.value:element.textContent;
    return (value||'').trim()||'—';
  };
  function messages(){
    const result=[],known=new Set();
    for(const id of ['checks','simpleChecks']){
      const container=document.getElementById(id);
      if(!container)continue;
      const nodes=id==='checks'&&container.children.length?Array.from(container.children):[container];
      for(const node of nodes){
        const msg=(node.textContent||'').replace(/\s+/g,' ').trim();
        if(!msg||/^Загрузите шаблон и нанесение\.?$/i.test(msg)||/^Ожидание/i.test(msg)||known.has(msg))continue;
        known.add(msg);
        const css=(typeof node.className==='string'?node.className:'')+' '+(typeof container.className==='string'?container.className:'');
        const error=/(^|\s)(error|bad|invalid|danger)(\s|$)/i.test(css)||
          /ошибк|не соответств|нарушен|выходит за|выход за|недопустим|превышен|меньше минимальн|обрезан/i.test(msg);
        const good=/(^|\s)(ok|success|valid|good)(\s|$)/i.test(css)||
          /^(✓|✔|проверка пройдена|нет ошибок)/i.test(msg);
        result.push({text:msg,severity:error?'error':good?'good':'warning'});
      }
    }
    return result;
  }
  function refresh(){
    $('article').textContent=getVal('article');
    $('method').textContent=getVal('method');
    const w=getVal('width'),h=getVal('height');
    $('logo-size').textContent=w!=='—'&&h!=='—'?w+' × '+h+' мм':'—';
    $('field-size').textContent=getVal('fieldSize');
    $('requirements').textContent=getVal('requirementsText');
    latest=messages();
    const count=latest.filter(x=>x.severity==='error').length;
    $('count-errors').textContent=latest.length?String(count):'—';
    $('count-others').textContent=latest.length?String(latest.length-count):'—';
    $('check-status').textContent=!latest.length?'Штатный PrintCheck пока не предоставил результатов для текущего макета.':
      count?'В штатной проверке обнаружены сообщения с признаками нарушений ('+count+').':
        'Получены результаты штатной проверки. Нейросетевой анализ ещё не выполняется.';
    const container=$('issues-list');container.replaceChildren();
    if(!latest.length){
      const n=document.createElement('div');n.className='pcv-note';
      n.textContent='Замечаний пока нет. Выберите шаблон и логотип в Макетной, затем обновите сводку.';
      container.append(n);
    }else for(const x of latest){
      const n=document.createElement('div');n.className='pcv-issue '+x.severity;n.textContent=x.text;container.append(n);
    }
    return latest;
  }
  function capture(width,height,paint,title){
    if(!width||!height)return false;
    const scale=Math.min(1,1100/Math.max(width,height));
    const canvas=$('preview');canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));
    const ctx=canvas.getContext('2d');if(!ctx)return false;
    ctx.clearRect(0,0,canvas.width,canvas.height);paint(ctx,canvas.width,canvas.height);
    $('image-wrap').hidden=false;$('empty').hidden=true;
    $('preview-state').textContent=title;$('canvas-size').textContent=width+' × '+height+' px';return true;
  }
  function current(verbose=true){
    const c=document.getElementById('templateCanvas'),o=document.getElementById('overlay');
    if(!c||!c.width||!c.height){if(verbose)$('preview-state').textContent='В Макетной пока нет готового шаблона';return false;}
    try{return capture(c.width,c.height,(ctx,w,h)=>{
      ctx.drawImage(c,0,0,w,h);if(o&&o.width&&o.height&&o!==c)ctx.drawImage(o,0,0,w,h);
    },'Обзор холста Макетной');}
    catch(err){$('preview-state').textContent='Невозможно показать холст: '+(err.name||'ошибка');return false;}
  }
  function open(){priorFocus=document.activeElement;app.hidden=false;launcher.setAttribute('aria-expanded','true');$('close').focus();refresh();current(false);}
  function close(){app.hidden=true;launcher.setAttribute('aria-expanded','false');if(priorFocus?.isConnected)priorFocus.focus();else launcher.focus();}
  launcher.addEventListener('click',open);
  $('close').addEventListener('click',close);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!app.hidden){e.stopPropagation();close();}},true);
  for(const b of app.querySelectorAll('[data-pcv-view]'))b.addEventListener('click',()=>{
    const view=b.getAttribute('data-pcv-view');
    app.querySelectorAll('[data-pcv-view]').forEach(n=>n.setAttribute('aria-selected',String(n===b)));
    app.querySelectorAll('[data-pcv-panel]').forEach(n=>n.setAttribute('aria-hidden',String(n.getAttribute('data-pcv-panel')!==view)));
  });
  $('refresh').addEventListener('click',refresh);
  $('current').addEventListener('click',()=>current(true));
  $('empty-current').addEventListener('click',()=>current(true));
  $('open-image').addEventListener('click',()=>$('image-input').click());
  $('image-input').addEventListener('change',e=>{
    const file=e.target.files?.[0];e.target.value='';if(!file)return;
    if(!/^image\/(png|jpeg|webp)$/.test(file.type)||file.size>40*1024*1024){
      $('preview-state').textContent='Нужен PNG, JPG или WebP до 40 МБ';return;
    }
    const url=URL.createObjectURL(file),img=new Image();
    img.onload=()=>{
      try{capture(img.naturalWidth,img.naturalHeight,(ctx,w,h)=>ctx.drawImage(img,0,0,w,h),'Локальное изображение: '+file.name);}
      catch(err){$('preview-state').textContent='Ошибка изображения: '+(err.message||'неизвестно');}
      finally{URL.revokeObjectURL(url);}
    };
    img.onerror=()=>{URL.revokeObjectURL(url);$('preview-state').textContent='Ошибка декодирования изображения';};
    img.src=url;
  });
  function schedule(){
    if(app.hidden||refreshPending)return;
    refreshPending=true;requestAnimationFrame(()=>{refreshPending=false;refresh();});
  }
  const mo=new MutationObserver(schedule);
  for(const id of ['checks','simpleChecks','requirementsText','fieldSize']){
    const node=document.getElementById(id);if(node)mo.observe(node,{subtree:true,childList:true,characterData:true});
  }
  for(const id of ['article','method','width','height']){
    const node=document.getElementById(id);if(node){node.addEventListener('input',schedule);node.addEventListener('change',schedule);}
  }
  window.gwbPrintCheckVision=Object.freeze({version:'0.1.0',open,close,refresh,getExistingChecks:()=>latest.map(x=>({...x}))});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
