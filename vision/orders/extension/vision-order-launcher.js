/**
 * Vision AI 0.2.0: file-list scanner on ANY authorized test portal page of
 * psk.testgifts.local or testgifts.local. Underlying engine and its IndexedDB
 * stay inside the extension-owned host; no order-table tab is required.
 * Only approved local extension messages, never arbitrary site scripts.
 */
(()=>{
 'use strict';
 if(typeof chrome==='undefined'||!chrome.runtime?.sendMessage)return;
 if(window.top!==window||location.protocol!=='http:'||
  !['psk.testgifts.local','testgifts.local'].includes(location.hostname))return;
 if(location.hostname==='psk.testgifts.local'&&
  /^\/devorders(?:\/|$)/.test(location.pathname))return;
 const excluded=/\/(?:login|logout|signin|signout|auth|register|password|captcha)(?:\/|$)/i;
 if(excluded.test(location.pathname)||document.querySelector(
  'form[name="authform"],form#loginform,input[type="password"]'))return;
 if(document.getElementById('vision-ai-scan-launcher'))return;
 const css='font:13px/1.5 system-ui,sans-serif!important;';
 const style=(e,text)=>{
  e.style.cssText=text;return e;
 };
 const make=(tag,txt,cssText)=>{
  const n=document.createElement(tag);
  if(txt!==undefined)n.textContent=txt;
  if(cssText)n.style.cssText=cssText;return n;
 };
 const id='vision-ai-scan-launcher';
 const button=make('button','Vision AI · заказы',css+
  'position:fixed!important;right:14px!important;bottom:14px!important;'+
  'z-index:2147483620!important;border:1px solid #98b2a7!important;'+
  'border-radius:10px!important;background:#24383c!important;color:#fff!important;'+
  'padding:10px 14px!important;box-shadow:0 3px 15px #1118!important;'+
  'font-weight:650!important;cursor:pointer!important;');
 button.type='button';button.id=id;
 const panel=make('section',undefined,css+
  'position:fixed!important;right:14px!important;bottom:65px!important;'+
  'z-index:2147483620!important;width:min(370px,calc(100vw - 28px))!important;'+
  'max-height:75vh!important;overflow:auto!important;padding:14px!important;'+
  'background:#24383c!important;color:#e5f7ec!important;'+
  'border:1px solid #89a69e!important;border-radius:10px!important;'+
  'box-shadow:0 9px 30px #101c22a8!important;display:none!important;');
 panel.id='vision-ai-scanner-remote';
 panel.setAttribute('aria-label','Vision AI — управление сканированием заказов');
 const title=make('strong','Vision AI — проверка заказов',css+
  'font-size:16px!important;color:white!important;');
 const row=(...items)=>{
  const div=make('div',undefined,'display:flex!important;flex-wrap:wrap!important;'+
   'gap:6px!important;align-items:center!important;margin:8px 0!important;');
  div.append(...items);panel.append(div);
 };
 const control=(text,fn)=>{
  const b=make('button',text,css+'background:#e9efec!important;'+
   'color:#203438!important;border:1px solid #a5b9b0!important;'+
   'border-radius:5px!important;padding:6px 8px!important;cursor:pointer!important;');
  b.type='button';
  b.addEventListener('click',e=>{
   e.preventDefault();e.stopPropagation();void fn();
  });
  return b;
 };
 const mode={value:'file'};
 panel.append(title);
 panel.append(make('p','Режим: только импортированный TXT. Очередь работает в расширении, без открытия таблицы заказов.',
  css+'font-size:11px!important;color:#d9e6df!important;'));
 const fileLabel=make('label','Файл с номерами заказов (TXT): ',css+
  'color:#eaf4ef!important;display:block!important;');
 const file=make('input');file.type='file';file.accept='.txt,text/plain';
 file.style.cssText=css+'display:block!important;max-width:100%!important;'+
  'margin:7px 0!important;color:#fff!important;';
 fileLabel.append(file);panel.append(fileLabel);
 const importBtn=control('Импортировать список',async()=>{
  const selected=file.files?.[0];
  if(!selected)return showMessage('Выберите файл TXT.');
  if(selected.size>20_000_000)return showMessage('Файл превышает 20 МБ.');
  try{
   const text=await selected.text();
   let result=await rpc('import',{text,filename:selected.name});
   if(result.status==='VISION_IMPORT_REPLACE_REQUIRES_CONFIRMATION'){
    if(!confirm('Новый TXT заменит текущий список и весь сохранённый прогресс. '+
     'Сначала выгрузите ZIP и реестр. Продолжить?'))return;
    result=await rpc('import',{text,filename:selected.name,overwrite:true});
   }
   showMessage(result.status==='VISION_IMPORT_OK'?'Список загружен.':result.status);
   await updateStatus();
  }catch(error){showMessage(String(error?.message||'Ошибка импорта'))}
 });
 row(importBtn);
 const delayLabel=make('label','Задержка, мс: ',css+'color:#eaf4ef!important;');
 const delay=make('input',undefined,css+
  'max-width:108px!important;color:#1d3438!important;'+
  'padding:5px!important;background:#fff!important;');
 delay.type='number';delay.min='100';delay.max='60000';
 delay.step='100';delay.value='1200';
 delayLabel.append(delay);
 const applyDelay=control('Применить',async()=>{
  const n=Number(delay.value);
  if(!Number.isSafeInteger(n)||n<100||n>60000)
   return showMessage('Допустимая задержка: 100–60000 мс.');
  try{const r=await rpc('delay',{value:n});
   showMessage(r.status);await updateStatus()}
  catch(error){showMessage(String(error?.message||'Ошибка'))}
 });
 row(delayLabel,applyDelay);
 const commands=[
  ['Старт / продолжить','start'],['Пауза','pause'],
  ['Остановить','stop'],['Сохранить ZIP','save'],
  ['Реестр JSON','export']
 ];
 row(...commands.map(([label,action])=>control(label,async()=>{
  try{const result=await rpc(action);
   showMessage(result.status||'Запрос отправлен');await updateStatus()}
  catch(error){showMessage(String(error?.message||'Ошибка подключения'))}
 })));
 const resetBtn=control('Сбросить прогресс',async()=>{
  const before=await rpc('status').catch(()=>({}));
  if(before.running){
   showMessage('Сначала остановите сканирование и дождитесь завершения текущего заказа.');
   await updateStatus();return;
  }
  if(!confirm('Удалить текущую очередь, контрольную точку, реестр и '+
   'невыгруженные вложения выбранного режима? Уже сохранённые ZIP на диске '+
   'останутся. Это действие необратимо.'))return;
  try{
   const result=await rpc('reset',{confirmed:true});
   showMessage(result?.status||'VISION_RESET_FAILED');
   await updateStatus();
  }catch(error){showMessage(String(error?.message||'Ошибка сброса'))}
 });
 row(resetBtn);
 const verifyBtn=control('Проверить сохранение ZIP',async()=>{
  try{
   const r=await chrome.runtime.sendMessage({op:'vision-archive-settings-v1',
    action:'list'});
   if(r?.status!=='VISION_ARCHIVE_LIST_OK')throw Error(r?.status||'NO_AUDIT');
   const saved=r.items.filter(x=>x.state==='saved').length;
   const unresolved=r.items.length-saved;
   showMessage('Архивы: сохранено '+saved+', ожидают или требуют проверки '+unresolved);
   await updateStatus();
  }catch(error){showMessage(String(error?.message||'Ошибка проверки ZIP'))}
 });
 row(verifyBtn);

 const archiveHeading=make('strong','Архивы ZIP',css+
  'display:block!important;color:#fff!important;margin-top:12px!important;');
 panel.append(archiveHeading);
 const archiveMode=make('select',undefined,css+
  'background:#fff!important;color:#203438!important;padding:5px!important;');
 for(const [value,description] of [
  ['downloads','Автоматически в подпапку Загрузок'],
  ['directory','Выбранная папка на диске']
 ]){
  const option=make('option',description);option.value=value;archiveMode.append(option);
 }
 const folder=make('input',undefined,css+
  'max-width:145px!important;background:white!important;color:#203438!important;padding:5px!important;');
 folder.placeholder='Имя подпапки';folder.value='VisionAI';
 const archiveRpc=(action,extra={})=>chrome.runtime.sendMessage({
  op:'vision-archive-settings-v1',action,...extra
 });
 const setArchive=control('Применить',async()=>{
  try{
   if(archiveMode.value==='directory'){
    showMessage('Выберите папку в открывающемся окне сканера Chrome.');
    await chrome.runtime.sendMessage({op:'vision-open-scanner-v1'});
    return;
   }
   const result=await archiveRpc('set',{payload:{mode:'downloads',folder:folder.value}});
   showMessage(result.status==='VISION_ARCHIVE_SETTINGS_SAVED'?
    'Папка задана: Загрузки / '+folder.value:result.status);
   await updateStatus();
  }catch(error){showMessage(String(error?.message||'Ошибка настроек'))}
 });
 row(archiveMode,folder,setArchive);
 const chooseFolder=control('Выбрать папку на диске…',async()=>{
  showMessage('В открывшейся вкладке сканера нажмите «Выбрать папку на диске».');
  try{await chrome.runtime.sendMessage({op:'vision-open-scanner-v1'})}
  catch{showMessage('Не удалось открыть внутреннюю страницу сканера')}
 });
 row(chooseFolder);
 const archiveResults=make('div','',css+
  'white-space:pre-line!important;color:#d3e6dd!important;'+
  'font-size:11px!important;max-height:190px!important;overflow:auto!important;');
 panel.append(archiveResults);
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
     x.expected_name||'без имени',
     x.local_path||'путь ещё не подтверждён',
     (x.actual_bytes??x.expected_bytes??0)+' байт'
    ].join(' · ')).join('\n\n'):
    'Сохранённых или ожидающих ZIP пока нет.';
  }catch(error){showMessage(String(error?.message||'Ошибка реестра ZIP'))}
 });
 const exportArchives=control('Экспорт реестра ZIP',async()=>{
  try{
   const list=await listSaved(10000);
   const blob=new Blob([JSON.stringify({schema:'vision.ai.archive-registry.v2',
    created_at:new Date().toISOString(),entries:list},null,2)+'\n'],
    {type:'application/json'});
   const url=URL.createObjectURL(blob),a=document.createElement('a');
   a.href=url;a.download='vision-ai-archives-registry.json';
   document.body.append(a);a.click();a.remove();
   setTimeout(()=>URL.revokeObjectURL(url),15000);
   showMessage('Реестр передан в загрузки Chrome.');
  }catch(error){showMessage(String(error?.message||'Ошибка экспорта'))}
 });
 row(showArchives,exportArchives);
 const recover=control('Восстановить сканер',async()=>{
  if(!confirm('Перезапустить локальный механизм сканирования? Незаконченный заказ будет проверен повторно, сохранённые архивы не удалятся.'))return;
  try{
   const result=await chrome.runtime.sendMessage({op:'vision-recover-scanner-v1'});
   showMessage(result?.status||'VISION_RECOVER_FAILED');
  }catch(error){showMessage(String(error?.message||'Ошибка восстановления'))}
 });
 row(recover);
 void archiveRpc('get').then(result=>{
  if(result?.status!=='VISION_ARCHIVE_SETTINGS_OK')return;
  archiveMode.value=result.mode==='directory'?'directory':'downloads';
  folder.value=result.folder;
  if(!result.configured)showMessage('Перед запуском выберите папку для архивов');
 }).catch(()=>{});
 const more=control('Открыть подробные настройки',async()=>{
  try{
   const r=await chrome.runtime.sendMessage({op:'vision-open-scanner-v1'});
   if(r?.status!=='VISION_SCANNER_OPENED')showMessage(r?.status||'Ошибка открытия');
  }catch{showMessage('Не удалось открыть вкладку сканера')}
 });
 row(more);
 const status=make('div','Ожидание данных…',css+
  'white-space:pre-line!important;color:#d3e6dd!important;'+
  'padding:7px!important;border-top:1px solid #547570!important;');
 status.setAttribute('role','status');status.id='vision-ai-scanner-remote-status';
 panel.append(status);
 const notice=make('p','До запуска обязательно укажите папку. '+
  'Каждый утверждённый заказ сохраняется отдельным ZIP с переписками, '+
  'замечаниями и доступными вложениями. Для динамических согласований '+
  'временно используется неактивная карточка заказа. Данные остаются локально.',css+
  'font-size:11px!important;color:#b8d0c4!important;');
 panel.append(notice);
 let opened=false,editingDelay=false,lastMessage='',requesting=false;
 delay.addEventListener('focus',()=>{editingDelay=true});
 delay.addEventListener('blur',()=>{editingDelay=false});
 const showMessage=msg=>{lastMessage=String(msg||'').slice(0,150)};
 const rpc=(action,payload={})=>chrome.runtime.sendMessage({
  op:'vision-remote-scanner-v1',mode:mode.value,action,payload
 });
 const updateStatus=async()=>{
  if(requesting||!opened)return;
  requesting=true;
  try{
   const data=await rpc('status');
   if(data?.status&&data.status!=='VISION_IMPORT_OK'){
    status.textContent='Статус: '+String(data.status)+
     (lastMessage?'\n'+lastMessage:'');
    return;
   }
   const running=data.running?'В РАБОТЕ':data.blocked?'Ошибка восстановления':
    data.paused?'ПАУЗА':data.stopped?'Остановлено':'Ожидает запуска';
   const net=data.network||{};
   const lastZip=data.last_archive||{};
   const zipAudit=data.archive_audit||{};
   const pendingZip=data.download_details||{};
   const lastTime=data.last_activity_at?Date.parse(data.last_activity_at):NaN;
   const stale=data.running&&Number.isFinite(lastTime)&&
    Date.now()-lastTime>240000;
   status.textContent=running+(stale?' · НЕТ ПРОГРЕССА БОЛЕЕ 4 МИНУТ':'')+
    '\n'+(data.filename?'Файл: '+data.filename+'\n':'')+
    'Проверено: '+(data.checked??0)+' / '+(data.total??'—')+
    ' ('+(data.progress_percent??0)+'%)'+
    '\nСледующий заказ: '+(data.next_order??'—')+
    '\nЭтап: '+(data.phase||'ожидание')+
    '\nАрхивов подтверждено: '+(data.archives??0)+
    ' · текущая загрузка: '+(data.downloading?'да':'нет')+
    (pendingZip.filename?'\nЗагрузка: '+pendingZip.filename+
     ' · байт '+(pendingZip.bytes??0):'')+
    (zipAudit.status?'\nПроверка Chrome: '+zipAudit.status+
     (zipAudit.danger?' · '+zipAudit.danger:''):'')+
    (lastZip.filename?'\nПоследний сохранённый ZIP: '+lastZip.filename+
     ' · '+(lastZip.bytes??0)+' байт'+
     (lastZip.confirmed_at?' · '+lastZip.confirmed_at:''):'')+
    '\nЗаказов архивировано: '+(data.found??0)+
    ' · партия: '+(data.pending??0)+
    '\nВложений: подтверждено '+(data.files_archived??0)+
    ' · ожидает ZIP '+(data.files_staged??0)+
    (Number.isInteger(lastZip.files_missing)?
     ' · отсутствует в последнем ZIP '+lastZip.files_missing:'')+
    '\nПрямых HTTP-запросов: '+(data.direct_http_checks??0)+
    ' · фоновых карточек: '+(data.browser_scans??0)+
    '\nСеть: '+(net.state||'нет данных')+
    ' · повторов '+(net.retries??0)+
    ' · ошибок '+(net.transient_errors??0)+
    ' · подряд '+(net.consecutive_errors??0)+
    (net.last_http_status?' · HTTP '+net.last_http_status:'')+
    (net.last_error?'\nПоследняя сетевая ошибка: '+net.last_error:'')+
    (data.last_activity_at?'\nПоследняя активность: '+
     data.last_activity_at:'')+
    (data.errors?'\nОшибок: '+data.errors:'')+
    (data.error?'\nОшибка: '+data.error:'')+
    (lastMessage?'\n'+lastMessage:'');
   if(!editingDelay&&Number.isInteger(data.delay_ms)&&data.delay_ms>=100)
    delay.value=String(data.delay_ms);
  }catch(error){
   status.textContent='Сканер недоступен: '+String(error?.message||'UNKNOWN');
  }finally{requesting=false}
 };
 
 button.addEventListener('click',event=>{
  event.preventDefault();event.stopPropagation();
  opened=!opened;
  panel.style.setProperty('display',opened?'block':'none','important');
  button.setAttribute('aria-expanded',String(opened));
  if(opened)void updateStatus();
 });
 setInterval(()=>{if(opened)void updateStatus()},2500);
 (document.body||document.documentElement).append(button,panel);
})();
