/**
 * Chrome MV3, local test order page only.
 * Read the ALREADY OPEN native article "Согласование макета" modal.
 * Zero network requests, zero native modal clicks, zero HTML storage,
 * zero training labels, zero customer details in the downloadable JSON.
 */
import {inspectOpenMaketApprovalDom} from './maket-approval-probe.mjs';
const BOX_ID='vision-approval-inspector',STYLE_ID='vision-approval-inspector-css';
const ACCEPTED=['testgifts.local'];
function isOrderPage(loc=globalThis.location){
 return loc?.protocol==='http:'&&ACCEPTED.includes(loc.hostname)&&
   !loc.port&&/^\/private\/order\/\d{5,12}\/?$/.test(loc.pathname);
}
const make=(tag,contents)=>{
 const n=document.createElement(tag);
 if(contents!=null)n.textContent=contents;
 return n;
};
export function initApprovalPageEntry(){
 if(!isOrderPage()||document.getElementById(BOX_ID))return false;
 const style=make('style');
 style.id=STYLE_ID;
 style.textContent='#'+BOX_ID+'{position:fixed!important;right:12px!important;'+
  'top:12px!important;z-index:2147483605!important;width:315px!important;'+
  'max-width:calc(100vw - 20px)!important;background:#253a3f!important;'+
  'color:#fff!important;border:1px solid #92aea6!important;'+
  'box-shadow:0 4px 22px #0008!important;border-radius:10px!important;'+
  'padding:12px!important;font:13px/1.35 system-ui,sans-serif!important}'+
  '#'+BOX_ID+' button{cursor:pointer!important;margin:4px!important;'+
  'background:#e5f0e8!important;color:#203336!important;'+
  'border:0!important;border-radius:5px!important;padding:7px!important}'+
  '#'+BOX_ID+' p{margin:6px 0!important;white-space:pre-wrap!important}';
 document.head.append(style);
 const panel=make('section');panel.id=BOX_ID;
 panel.setAttribute('aria-label','Vision AI — исследование открытого согласования');
 const header=make('strong','Vision AI · Согласование макета');
 const note=make('p','Откройте штатной кнопкой «Согласование макета» у нужного артикула. Затем проверьте уже открытое окно. Ничего на сайте не изменяется.');
 const stats=make('p','Ожидается открытое окно.');stats.setAttribute('role','status');
 const scan=make('button','Прочитать открытое согласование');
 const exportButton=make('button','Скачать анонимный JSON');
 const close=make('button','Закрыть Vision');
 exportButton.disabled=true;
 let last=null;
 scan.type=exportButton.type=close.type='button';
 const stop=e=>{e.preventDefault();e.stopPropagation()};
 scan.addEventListener('click',event=>{
  stop(event);
  last=inspectOpenMaketApprovalDom(document);
  const r=last;
  if(r.status!=='VISIBLE_MODAL_STRUCTURE_ONLY'){
   exportButton.disabled=true;
   stats.textContent='Окно не открыто или структура не подтверждена: '+
     r.status+'. Сначала откройте штатное «Согласование макета».';
   return;
  }
  exportButton.disabled=false;
  stats.textContent='Вариантов проблем: '+r.problems_available_count+
   ' · отмечено сейчас: '+r.problems_checked_current_count+
   '\nСообщений: '+r.human_comment_count+
   ' · событий: '+r.history_system_entry_count+
   ' · вложений: '+r.attachments_total+
   ' (PDF '+r.attachments_pdf+', PSD '+r.attachments_psd+
   ', изображения '+r.attachments_image_candidates+')'+
   '\nДанные предназначены только для исследования; допуск к печати не выдаётся.';
 });
 exportButton.addEventListener('click',event=>{
  stop(event);
  if(!last||last.status!=='VISIBLE_MODAL_STRUCTURE_ONLY')return;
  // Never export DOM, order id, message text, full hrefs or anything
  // dynamically copied from unknown page properties.
  const safeKeys=['status','trigger_count','article_scoped_trigger_count',
   'modal_loaded','modal_currently_visible','problems_available_count',
   'problems_checked_current_count','human_comment_count','history_entry_count',
   'history_system_entry_count','problem_add_events','problem_remove_events',
   'status_change_events','other_system_events','attachments_total',
   'attachments_pdf','attachments_psd','attachments_image_candidates',
   'attachments_other','badge_comment_count','badge_matches_human_messages'];
  const safe=Object.fromEntries(safeKeys.map(key=>[key,last[key]]));
  const topics=['positive_min','negative_min','text_height','color',
   'raster_resolution','effects','field_boundary','constructor','fonts',
   'wrong_artwork','complex_work','revision'];
  const report={
   schema:'printcheck.vision.local-maket-approval.v1',
   scope:'CURRENT_VISIBLE_NATIVE_MODAL_ONLY',
   ...safe,
   checked_problem_topic_hints:topics.filter(x=>
     last.checked_problem_topic_hints?.includes(x)).sort(),
   weak_message_topic_hints:topics.filter(x=>
     last.weak_message_topic_hints?.includes(x)).sort(),
   unselected_problem_options_are_not_defects:true,
   reported_issues_expert_verified:false,history_version_alignment_verified:false,
   training_ready:false,production_approved:false,
   order_numbers_included:false,item_ids_included:false,
   message_text_included:false,author_names_included:false,
   attachment_names_or_urls_included:false,attachments_downloaded:false
  };
  const url=URL.createObjectURL(new Blob(
   [JSON.stringify(report,null,2)+'\n'],{type:'application/json'}));
  const anchor=make('a');anchor.href=url;
  anchor.download='vision-local-maket-approval.json';
  document.body.append(anchor);anchor.click();anchor.remove();
  setTimeout(()=>URL.revokeObjectURL(url),2000);
 });
 close.addEventListener('click',event=>{
  stop(event);panel.remove();style.remove();
 });
 panel.append(header,note,scan,exportButton,close,stats);
 document.body.append(panel);
 return true;
}
if(typeof document!=='undefined'&&typeof location!=='undefined')
 initApprovalPageEntry();
