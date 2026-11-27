/* Vision AI extension launcher. Site-isolated controls; extension-owned data. */
(()=>{
 'use strict';
 if(typeof chrome==='undefined'||!chrome.runtime?.sendMessage)return;
 if(window.top!==window||location.protocol!=='http:'||
  !['psk.testgifts.local','testgifts.local'].includes(location.hostname))return;
 if(location.hostname==='psk.testgifts.local'&&
  /^\/devorders(?:\/|$)/.test(location.pathname))return;
 if(/\/(?:login|logout|signin|signout|auth|register|password|captcha)(?:\/|$)/i.test(location.pathname)||
   document.querySelector('form[name="authform"],form#loginform,input[type="password"]'))return;
 if(document.getElementById('vision-ai-scan-launcher'))return;

 const make=(tag,txt,cls)=>{
  const e=document.createElement(tag);
  if(txt!==undefined)e.textContent=txt;
  if(cls)e.className=cls;
  return e;
 };
 const style=make('style');
 style.id='vision-ai-launcher-design-v024';
 style.textContent=[
 '#vision-ai-scan-launcher{position:fixed!important;right:14px!important;bottom:14px!important;z-index:2147483620!important;border:1px solid #6e918b!important;border-radius:10px!important;background:#24383c!important;color:#fff!important;padding:10px 15px!important;box-shadow:0 3px 16px #101d23a0!important;cursor:pointer!important;font:600 13px/1.45 system-ui,sans-serif!important}',
 '#vision-ai-scan-launcher:hover{background:#315258!important}',
 '#vision-ai-scanner-remote{position:fixed!important;right:14px!important;bottom:65px!important;z-index:2147483620!important;display:none!important;width:min(446px,calc(100vw - 28px))!important;max-height:min(82vh,780px)!important;overflow-y:auto!important;overscroll-behavior:contain!important;background:#f4f7f6!important;color:#1f353a!important;border:1px solid #91a5a2!important;border-radius:14px!important;box-shadow:0 12px 34px #101c22ad!important;padding:0!important;font:13px/1.5 system-ui,sans-serif!important;box-sizing:border-box!important}',
 '#vision-ai-scanner-remote *{box-sizing:border-box!important;font-family:system-ui,sans-serif!important}',
 '#vision-ai-scanner-remote .vai-header{background:#243b40!important;color:#f5faf7!important;padding:15px 16px 13px!important;border-radius:13px 13px 0 0!important}',
 '#vision-ai-scanner-remote .vai-headline{font-size:17px!important;font-weight:720!important;line-height:1.25!important;color:inherit!important;margin:0!important}',
 '#vision-ai-scanner-remote .vai-subtitle{font-size:11px!important;color:#c6ded5!important;margin:4px 0 0!important}',
 '#vision-ai-scanner-remote .vai-main{padding:12px!important;display:grid!important;gap:10px!important}',
 '#vision-ai-scanner-remote .vai-section{display:block!important;margin:0!important;padding:12px!important;border:1px solid #d7e1df!important;border-radius:10px!important;background:#fff!important;min-width:0!important}',
 '#vision-ai-scanner-remote .vai-section h3{margin:0 0 5px!important;padding:0!important;font:700 13px/1.4 system-ui,sans-serif!important;color:#213b40!important}',
 '#vision-ai-scanner-remote .vai-hint{margin:3px 0 9px!important;padding:0!important;font-size:11px!important;line-height:1.5!important;color:#586b70!important}',
 '#vision-ai-scanner-remote .vai-row{display:flex!important;gap:7px!important;align-items:center!important;flex-wrap:wrap!important;margin:8px 0 0!important}',
 '#vision-ai-scanner-remote .vai-row:first-child{margin-top:0!important}',
 '#vision-ai-scanner-remote .vai-control{appearance:none!important;display:inline-flex!important;justify-content:center!important;align-items:center!important;gap:5px!important;min-height:32px!important;padding:7px 10px!important;max-width:100%!important;border-radius:7px!important;border:1px solid #bdceca!important;background:#ecf2f0!important;color:#253a40!important;box-shadow:none!important;text-align:center!important;text-transform:none!important;font:600 12px/1.35 system-ui,sans-serif!important;cursor:pointer!important;white-space:normal!important}',
 '#vision-ai-scanner-remote .vai-control:hover{background:#dcebe6!important;border-color:#91ada3!important}',
 '#vision-ai-scanner-remote .vai-control:focus-visible,#vision-ai-scan-launcher:focus-visible{outline:2px solid #4680b6!important;outline-offset:2px!important}',
 '#vision-ai-scanner-remote .vai-control:disabled{opacity:.45!important;cursor:default!important}',
 '#vision-ai-scanner-remote .vai-primary{background:#294d50!important;color:#fff!important;border-color:#294d50!important}',
 '#vision-ai-scanner-remote .vai-primary:hover{background:#356469!important}',
 '#vision-ai-scanner-remote .vai-danger{color:#8b3838!important;border-color:#e8c8c5!important;background:#fcf4f3!important}',
 '#vision-ai-scanner-remote .vai-stretch{flex:1 1 auto!important}',
 '#vision-ai-scanner-remote label{display:block!important;font-size:11px!important;font-weight:650!important;color:#3a5155!important;margin:0!important;padding:0!important}',
 '#vision-ai-scanner-remote input[type=file]{display:block!important;width:100%!important;max-width:100%!important;margin:6px 0 0!important;padding:7px!important;background:#f7faf9!important;border:1px solid #d7e2de!important;border-radius:7px!important;color:#2b4547!important;font:12px system-ui,sans-serif!important}',
 '#vision-ai-scanner-remote input[type=number],#vision-ai-scanner-remote input[type=text],#vision-ai-scanner-remote select{display:block!important;width:100%!important;min-height:32px!important;padding:6px 8px!important;background:#fff!important;border:1px solid #bccdca!important;border-radius:7px!important;color:#243c42!important;font:12px system-ui,sans-serif!important;max-width:100%!important}',
 '#vision-ai-scanner-remote .vai-field{flex:1 1 150px!important;min-width:115px!important}',
 '#vision-ai-scanner-remote .vai-compact-field{flex:0 1 136px!important;min-width:112px!important}',
 '#vision-ai-scanner-remote .vai-metrics{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:7px!important;margin:8px 0!important}',
 '#vision-ai-scanner-remote .vai-metric{display:flex!important;flex-direction:column!important;gap:3px!important;min-width:0!important;padding:8px!important;background:#f2f7f5!important;border:1px solid #dfebe5!important;border-radius:8px!important}',
 '#vision-ai-scanner-remote .vai-metric-label{display:block!important;color:#647877!important;font-size:10px!important;line-height:1.25!important}',
 '#vision-ai-scanner-remote .vai-metric-value{display:block!important;color:#233d42!important;font-size:17px!important;line-height:1.2!important;font-weight:750!important;overflow-wrap:anywhere!important}',
 '#vision-ai-scanner-remote .vai-state{font-size:12px!important;font-weight:700!important;color:#275358!important}',
 '#vision-ai-scanner-remote .vai-progress-track{height:7px!important;width:100%!important;background:#e3ede9!important;border-radius:10px!important;overflow:hidden!important;margin:7px 0!important}',
 '#vision-ai-scanner-remote .vai-progress-bar{display:block!important;width:0;height:100%!important;background:#458f80!important;border-radius:10px!important;transition:width .2s!important}',
 '#vision-ai-scanner-remote .vai-status{font:11px/1.5 system-ui,sans-serif!important;color:#485e61!important;white-space:pre-line!important;overflow-wrap:anywhere!important;margin:6px 0 0!important}',
 '#vision-ai-scanner-remote .vai-message{margin:0!important;padding:8px 10px!important;border:1px solid #c9dad5!important;border-radius:8px!important;background:#edf4f1!important;color:#2d5252!important;font-size:11px!important;white-space:pre-wrap!important;overflow-wrap:anywhere!important}',
 '#vision-ai-scanner-remote .vai-message:empty{display:none!important}',
 '#vision-ai-scanner-remote .vai-message[data-error=true]{background:#fff2f1!important;color:#873939!important;border-color:#ecc3bf!important}',
 '#vision-ai-scanner-remote .vai-archive-results{white-space:pre-line!important;font-size:11px!important;overflow:auto!important;max-height:156px!important;color:#475e61!important;overflow-wrap:anywhere!important;margin:8px 0 0!important}',
 '#vision-ai-scanner-remote .vai-details{margin:0!important;border:1px solid #d7e1df!important;border-radius:10px!important;padding:10px 12px!important;background:#fff!important}',
 '#vision-ai-scanner-remote .vai-details summary{cursor:pointer!important;font-weight:700!important;font-size:12px!important;color:#344f54!important}',
 '#vision-ai-scanner-remote .vai-diagnostics{white-space:pre-line!important;color:#607275!important;font-size:11px!important;margin-top:8px!important;overflow-wrap:anywhere!important}',
 '#vision-ai-scanner-remote .vai-footer{padding:0 4px 6px!important;color:#667b79!important;font-size:10.5px!important;line-height:1.5!important}',
 '@media(max-width:460px){#vision-ai-scanner-remote .vai-metrics{grid-template-columns:repeat(2,minmax(0,1fr))!important}}'
 ].join('\n');
 (document.head||document.documentElement).append(style);

 const trigger=make('button','Vision AI · заказы');
 trigger.type='button';trigger.id='vision-ai-scan-launcher';
 trigger.setAttribute('aria-expanded','false');
 trigger.setAttribute('aria-controls','vision-ai-scanner-remote');
 const panel=make('section');
 panel.id='vision-ai-scanner-remote';
 panel.setAttribute('aria-label','Vision AI — управление сканированием заказов');
 const header=make('header',undefined,'vai-header');
 header.append(make('div','Vision AI · Проверка заказов','vai-headline'),
  make('p','Список TXT · архивы по 100 утверждённых заказов','vai-subtitle'));
 panel.append(header);
 const main=make('div',undefined,'vai-main');panel.append(main);

 const section=(heading,hint)=>{
  const s=make('section',undefined,'vai-section');
  s.append(make('h3',heading));
  if(hint)s.append(make('p',hint,'vai-hint'));
  main.append(s);
  return s;
 };
 const row=(section,...items)=>{
  const r=make('div',undefined,'vai-row');r.append(...items);
  section.append(r);return r;
 };
 const control=(name,fn,cls='')=>{
  const b=make('button',name,'vai-control '+cls);
  b.type='button';
  b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();void fn()});
  return b;
 };
 const labeled=(text,input,cls='vai-field')=>{
  const label=make('label',text,cls);label.append(input);return label;
 };
 const metric=(name)=>{
  const item=make('div',undefined,'vai-metric');
  const label=make('span',name,'vai-metric-label');
  const value=make('strong','0','vai-metric-value');
  item.append(label,value);return {item,value};
 };
 const metrics={};
 const stateSection=section('Состояние сканирования');
 const stateLine=make('div','Ожидает запуска','vai-state');
 const progressTrack=make('div',undefined,'vai-progress-track');
 progressTrack.setAttribute('role','progressbar');
 progressTrack.setAttribute('aria-label','Проверенные номера из TXT');
 progressTrack.setAttribute('aria-valuemin','0');
 progressTrack.setAttribute('aria-valuemax','100');
 progressTrack.setAttribute('aria-valuenow','0');
 const progressBar=make('div',undefined,'vai-progress-bar');
 progressTrack.append(progressBar);
 const metricGrid=make('div',undefined,'vai-metrics');
 for(const [key,title] of [
  ['checked','Проверено номеров'],['archived','Заказов в ZIP'],
  ['batch','Текущая партия'],['zips','Сохранено ZIP'],
  ['files','Вложений в ZIP'],['errors','Ошибок']]){
  const m=metric(title);metrics[key]=m.value;metricGrid.append(m.item);
 }
 const status=make('p','Ожидание данных…','vai-status');
 status.id='vision-ai-scanner-remote-status';status.setAttribute('role','status');
 stateSection.append(stateLine,progressTrack,metricGrid,status);
 const message=make('div','','vai-message');
 message.setAttribute('aria-live','polite');main.append(message);

 const listSection=section('1. Список заказов',
  'TXT-файл: один семизначный номер в строке. Повторы исключаются автоматически.');
 const file=make('input');file.type='file';file.accept='.txt,text/plain';
 file.setAttribute('aria-label','Файл с номерами заказов TXT');
 listSection.append(labeled('Файл с номерами заказов (TXT)',file));
 const importBtn=control('Импортировать список',async()=>{
  const selected=file.files?.[0];
  if(!selected)return showMessage('Сначала выберите TXT-файл.',true);
  if(selected.size>20_000_000)return showMessage('Файл превышает 20 МБ.',true);
  try{
   let result=await rpc('import',{text:await selected.text(),filename:selected.name});
   if(result.status==='VISION_IMPORT_REPLACE_REQUIRES_CONFIRMATION'){
    if(!confirm('Новый TXT заменит текущий список и сохранённый прогресс. Сначала выгрузите ZIP и реестр. Продолжить?'))return;
    result=await rpc('import',{text:await selected.text(),filename:selected.name,overwrite:true});
   }
   showMessage(result.status==='VISION_IMPORT_OK'?'Список загружен. Можно запустить проверку.':result.status,
    result.status!=='VISION_IMPORT_OK');
   await updateStatus();
  }catch(err){showMessage(String(err?.message||'Ошибка импорта'),true)}
 },'vai-stretch');
 row(listSection,importBtn);

 const scanSection=section('2. Управление проверкой',
  'Пауза сохраняет текущую партию. Остановка завершает текущий заказ и выгружает неполный ZIP.');
 const start=control('Старт / продолжить',async()=>command('start'),'vai-primary vai-stretch');
 const pause=control('Пауза',async()=>command('pause'));
 const stop=control('Остановить и сохранить ZIP',async()=>command('stop'));
 row(scanSection,start,pause,stop);
 const delay=make('input');delay.type='number';delay.min='100';delay.max='60000';
 delay.step='100';delay.value='1200';
 const delayWrap=labeled('Задержка между заказами, мс',delay,'vai-compact-field');
 const applyDelay=control('Применить',async()=>{
  const n=Number(delay.value);
  if(!Number.isSafeInteger(n)||n<100||n>60000)
   return showMessage('Введите задержку от 100 до 60 000 мс.',true);
  try{
   const r=await rpc('delay',{value:n});
   showMessage(r.status==='VISION_DELAY_UPDATED'?
    'Задержка изменена без сброса прогресса.':r.status);
   await updateStatus();
  }catch(err){showMessage(String(err?.message||'Ошибка задержки'),true)}
 });
 row(scanSection,delayWrap,applyDelay);

 const archiveSection=section('3. Сохранение и архивы',
  'Выберите место сохранения до запуска. ZIP содержит до 100 утверждённых заказов с переписками и вложениями.');
 const archiveMode=make('select');
 for(const [value,name] of [
  ['downloads','Подпапка «Загрузки»'],
  ['directory','Выбранная папка на диске']]){
  const option=make('option',name);option.value=value;archiveMode.append(option);
 }
 const folder=make('input');folder.type='text';folder.placeholder='Имя подпапки';
 folder.value='VisionAI';
 const archiveRpc=(action,extra={})=>chrome.runtime.sendMessage({
  op:'vision-archive-settings-v1',action,...extra
 });
 const archiveModeField=labeled('Способ сохранения ZIP',archiveMode);
 const folderField=labeled('Подпапка в «Загрузках»',folder,'vai-compact-field');
 const setArchive=control('Применить',async()=>{
  try{
   if(archiveMode.value==='directory'){
    showMessage('В открывшейся вкладке нажмите «Выбрать папку на диске».');
    await chrome.runtime.sendMessage({op:'vision-open-scanner-v1'});return;
   }
   const result=await archiveRpc('set',{payload:{mode:'downloads',folder:folder.value}});
   showMessage(result.status==='VISION_ARCHIVE_SETTINGS_SAVED'?
    'Папка задана: Загрузки / '+folder.value:result.status,
    result.status!=='VISION_ARCHIVE_SETTINGS_SAVED');
   await updateStatus();
  }catch(err){showMessage(String(err?.message||'Ошибка настроек'),true)}
 });
 row(archiveSection,archiveModeField,folderField,setArchive);
 const chooseFolder=control('Выбрать папку на диске…',async()=>{
  showMessage('На внутренней странице сканера нажмите «Выбрать папку на диске» и разрешите доступ.');
  try{await chrome.runtime.sendMessage({op:'vision-open-scanner-v1'})}
  catch{showMessage('Не удалось открыть внутреннюю страницу сканера.',true)}
 });
 row(archiveSection,chooseFolder);
 const archiveActions=[
  ['Сохранить неполную партию ZIP','save'],
  ['Реестр заказов JSON','export']
 ];
 row(archiveSection,...archiveActions.map(([text,action])=>
  control(text,async()=>command(action))));
 const verifyBtn=control('Проверить сохранение ZIP',async()=>{
  try{
   const r=await archiveRpc('list');
   if(r?.status!=='VISION_ARCHIVE_LIST_OK')throw Error(r?.status||'NO_AUDIT');
   const saved=(r.items||[]).filter(x=>x.state==='saved').length;
   showMessage('Файлы подтверждены: '+saved+'; требуют проверки: '+((r.items||[]).length-saved)+'.');
   await updateStatus();
  }catch(err){showMessage(String(err?.message||'Ошибка проверки ZIP'),true)}
 });
 row(archiveSection,verifyBtn);
 const archiveResults=make('div','','vai-archive-results');
 const listSaved=async(limit=100)=>{
  const reply=await archiveRpc('list',{limit});
  if(reply?.status!=='VISION_ARCHIVE_LIST_OK')
   throw Error(reply?.status||'VISION_ARCHIVE_LIST_FAILED');
  return reply.items||[];
 };
 const showArchives=control('Список сохранённых ZIP',async()=>{
  try{
   const list=await listSaved();
   archiveResults.textContent=list.length?
    list.map(x=>[
     x.state==='saved'?'СОХРАНЁН':String(x.state||'ОЖИДАНИЕ').toUpperCase(),
     x.expected_name||'Без имени',
     x.local_path||'Место сохранения ещё не подтверждено',
     (x.actual_bytes??x.expected_bytes??0)+' байт'
    ].join(' · ')).join('\n\n'):
    'Сохранённых или ожидающих ZIP пока нет.';
  }catch(err){showMessage(String(err?.message||'Ошибка реестра ZIP'),true)}
 });
 const exportArchives=control('Экспорт реестра ZIP',async()=>{
  try{
   const list=await listSaved(10000);
   const blob=new Blob([JSON.stringify({
    schema:'vision.ai.archive-registry.v2',
    created_at:new Date().toISOString(),entries:list
   },null,2)+'\n'],{type:'application/json'});
   const url=URL.createObjectURL(blob),a=document.createElement('a');
   a.href=url;a.download='vision-ai-archives-registry.json';
   document.body.append(a);a.click();a.remove();
   setTimeout(()=>URL.revokeObjectURL(url),15000);
   showMessage('Реестр архивов отправлен в загрузки Chrome.');
  }catch(err){showMessage(String(err?.message||'Ошибка экспорта ZIP'),true)}
 });
 row(archiveSection,showArchives,exportArchives);
 archiveSection.append(archiveResults);

 const toolsSection=section('4. Обслуживание',
  'Восстановление не удаляет прогресс. Сброс удаляет локальную очередь и ещё не сохранённые материалы.');
 const recover=control('Восстановить сканер',async()=>{
  if(!confirm('Перезапустить механизм проверки? Сохранённые архивы не будут удалены.'))return;
  try{
   const r=await chrome.runtime.sendMessage({op:'vision-recover-scanner-v1'});
   showMessage(r?.status||'VISION_RECOVER_FAILED');
  }catch(err){showMessage(String(err?.message||'Ошибка восстановления'),true)}
 });
 const reset=control('Сбросить прогресс',async()=>{
  const before=await rpc('status').catch(()=>({}));
  if(before.running){
   showMessage('Сначала остановите проверку и дождитесь завершения текущего заказа.',true);
   await updateStatus();return;
  }
  if(!confirm('Удалить очередь, контрольную точку, реестр и невыгруженные вложения? Уже сохранённые ZIP на диске останутся. Это действие необратимо.'))return;
  try{
   const r=await rpc('reset',{confirmed:true});
   showMessage(r?.status||'VISION_RESET_FAILED',r?.status!=='VISION_RESET_COMPLETE');
   await updateStatus();
  }catch(err){showMessage(String(err?.message||'Ошибка сброса'),true)}
 },'vai-danger');
 row(toolsSection,recover,reset);
 const detailed=control('Открыть подробные настройки',async()=>{
  try{
   const r=await chrome.runtime.sendMessage({op:'vision-open-scanner-v1'});
   if(r?.status!=='VISION_SCANNER_OPENED')showMessage(r?.status||'Ошибка открытия',true);
  }catch{showMessage('Не удалось открыть вкладку сканера.',true)}
 });
 row(toolsSection,detailed);
 const diagnostics=make('details',undefined,'vai-details');
 diagnostics.append(make('summary','Сеть и диагностика'));
 const details=make('div','Сканер ожидает запуска.','vai-diagnostics');
 diagnostics.append(details);main.append(diagnostics);
 main.append(make('p','Исходные файлы и переписки сохраняются локально. Состояние незавершённой партии хранится внутри расширения; не очищайте его данные до выгрузки ZIP.','vai-footer'));

 let opened=false,lastMessage='',requesting=false,editingDelay=false;
 delay.addEventListener('focus',()=>{editingDelay=true});
 delay.addEventListener('blur',()=>{editingDelay=false});
 const showMessage=(text,isError=false)=>{
  lastMessage=String(text||'').slice(0,180);
  message.textContent=lastMessage;
  message.dataset.error=String(isError);
 };
 const rpc=(action,payload={})=>chrome.runtime.sendMessage({
  op:'vision-remote-scanner-v1',mode:'file',action,payload
 });
 const command=async(action)=>{
  try{
   const r=await rpc(action);
   const names={
    start:'Запуск проверки запрошен.',
    pause:'Пауза после текущего заказа.',
    stop:'Остановка и сохранение текущей партии запрошены.',
    save:'Сохранение неполной партии запрошено.',
    export:'Экспорт реестра заказов запрошен.'
   };
   const accepted=String(r?.status||'').endsWith('_REQUESTED');
   showMessage(accepted?names[action]||'Команда передана.':r?.status||'Неизвестный ответ',!accepted);
   await updateStatus();
  }catch(err){showMessage(String(err?.message||'Нет связи со сканером'),true)}
 };
 const updateStatus=async()=>{
  if(requesting||!opened)return;
  requesting=true;
  try{
   const d=await rpc('status');
   if(d?.status&&d.status!=='VISION_IMPORT_OK'){
    status.textContent='Статус: '+String(d.status)+(lastMessage?'\n'+lastMessage:'');
    stateLine.textContent='Сканер недоступен';return;
   }
   const label=d.running?'В работе':d.blocked?'Ошибка восстановления':
    d.paused?'Пауза':d.stopped?'Остановлено':'Ожидает запуска';
   const pct=Number.isFinite(d.progress_percent)?
    Math.min(100,Math.max(0,d.progress_percent)):0;
   stateLine.textContent=label+(d.downloading?' · архив сохраняется':'');
   progressBar.style.width=pct+'%';
   progressTrack.setAttribute('aria-valuenow',String(pct));
   metrics.checked.textContent=(d.checked??0)+' / '+(d.total??0);
   metrics.archived.textContent=String(d.found??0);
   metrics.batch.textContent=(d.pending??0)+' / 100';
   metrics.zips.textContent=String(d.archives??0);
   metrics.files.textContent=String(d.files_archived??0);
   metrics.errors.textContent=String(d.errors??0);
   const last=d.last_activity_at?Date.parse(d.last_activity_at):NaN;
   const stale=d.running&&Number.isFinite(last)&&Date.now()-last>240000;
   status.textContent=(d.filename?'Файл: '+d.filename+'\n':'')+
    'Проверено: '+(d.checked??0)+' / '+(d.total??0)+
    ' ('+pct+'%)'+
    '\nСледующий заказ: '+(d.next_order??'—')+
    (stale?'\nВнимание: нет прогресса более 4 минут.':'')+
    (d.error?'\nОшибка: '+d.error:'')+
    (lastMessage?'\n'+lastMessage:'');
   const net=d.network||{},zip=d.download_details||{},
    saved=d.last_archive||{},audit=d.archive_audit||{};
   details.textContent='Этап: '+(d.phase||'ожидание')+
    '\nСеть: '+(net.state||'неизвестно')+
    ' · HTTP-запросов '+(d.direct_http_checks??0)+
    ' · фоновых карточек '+(d.browser_scans??0)+
    ' · повторов '+(net.retries??0)+
    ' · сетевых ошибок '+(net.transient_errors??0)+
    ' · подряд '+(net.consecutive_errors??0)+
    (net.last_http_status?' · HTTP '+net.last_http_status:'')+
    (net.last_error?'\nПоследняя сетевая ошибка: '+net.last_error:'')+
    '\nВложения ожидают ZIP: '+(d.files_staged??0)+
    (zip.filename?'\nТекущий архив: '+zip.filename+
      ' · '+(zip.bytes??0)+' байт':'')+
    (audit.status?'\nПроверка ZIP: '+audit.status+
      (audit.danger?' · '+audit.danger:''):'')+
    (saved.filename?'\nПоследний ZIP: '+saved.filename+
      ' · '+(saved.bytes??0)+' байт':'')+
    (Number.isInteger(saved.files_missing)?
      '\nВ последнем архиве недоступных вложений: '+saved.files_missing:'')+
    (d.last_activity_at?'\nПоследняя активность: '+d.last_activity_at:'');
   if(!editingDelay&&Number.isInteger(d.delay_ms)&&d.delay_ms>=100)
    delay.value=String(d.delay_ms);
  }catch(err){
   stateLine.textContent='Нет связи';
   status.textContent='Сканер недоступен: '+String(err?.message||'UNKNOWN');
  }finally{requesting=false}
 };
 void archiveRpc('get').then(result=>{
  if(result?.status!=='VISION_ARCHIVE_SETTINGS_OK')return;
  archiveMode.value=result.mode==='directory'?'directory':'downloads';
  folder.value=result.folder||'VisionAI';
  if(!result.configured)showMessage('Перед запуском укажите папку сохранения ZIP.');
 }).catch(()=>{});
 trigger.addEventListener('click',e=>{
  e.preventDefault();e.stopPropagation();opened=!opened;
  panel.style.setProperty('display',opened?'block':'none','important');
  trigger.setAttribute('aria-expanded',String(opened));
  if(opened)void updateStatus();
 });
 setInterval(()=>{if(opened)void updateStatus()},2500);
 (document.body||document.documentElement).append(trigger,panel);
})();