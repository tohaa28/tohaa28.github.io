/**
 * Vision AI 0.1.15: full remote scanner controls on ANY authorized page of
 * psk.testgifts.local or testgifts.local. Underlying engine and its IndexedDB
 * stay in the canonical inactive /devorders tab; no navigation is required.
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
 const label=make('label','Режим: ',css+'color:#eaf4ef!important;');
 const mode=make('select',undefined,css+
  'background:#fff!important;color:#1d3438!important;padding:5px!important;');
 for(const [value,text] of [['file','По списку TXT'],['range','Диапазон номеров']]){
  const item=make('option',text);item.value=value;mode.append(item);
 }
 label.append(mode);
 panel.append(title);row(label);
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
  ['Стоп и ZIP','stop'],['Сохранить ZIP','save'],
  ['Реестр JSON','export']
 ];
 row(...commands.map(([label,action])=>control(label,async()=>{
  try{const result=await rpc(action);
   showMessage(result.status||'Запрос отправлен');await updateStatus()}
  catch(error){showMessage(String(error?.message||'Ошибка подключения'))}
 })));
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
 const notice=make('p','Данные остаются локально. Работа продолжается и при '+
  'переходе между страницами. Заблокированные Chrome ZIP требуют '+ 
  'проверки в загрузках браузера.',css+
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
   status.textContent=running+
    '\n'+(data.filename?'Файл: '+data.filename+'\n':'')+
    'Проверено: '+(data.checked??0)+' / '+(data.total??'—')+
    '\nСледующий заказ: '+(data.next_order??'—')+
    '\nZIP готово: '+(data.archives??0)+
    ' · скачивается: '+(data.downloading?'да':'нет')+
    '\nНайдено: '+(data.found??0)+
    ' · партия: '+(data.pending??0)+
    (data.errors?'\nОшибок: '+data.errors:'')+
    (data.error?'\nОшибка: '+data.error:'')+
    (lastMessage?'\n'+lastMessage:'');
   if(!editingDelay&&Number.isInteger(data.delay_ms)&&data.delay_ms>=100)
    delay.value=String(data.delay_ms);
  }catch(error){
   status.textContent='Сканер недоступен: '+String(error?.message||'UNKNOWN');
  }finally{requesting=false}
 };
 mode.addEventListener('change',()=>{
  fileLabel.style.display=importBtn.style.display=
   mode.value==='file'?'block':'none';
  void updateStatus();
 });
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
