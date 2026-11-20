/**
 * M3.13: read-only inspection of the REAL Gifts article-level
 * "Согласование макета" modal in already visible/loaded DOM.
 *
 * Trigger: li[data-itemid] a.j_maketadjusting.
 * Modal: g-modal[visible] #j_maketAdjustingForm
 * Tabs: form ma_problem[], #j_maketadjusting_comments_list
 *
 * Crucially: an AVAILABLE checkbox is NOT a selected defect; historical
 * problem events are NOT current selected defects; the comments badge
 * counts human entries, NOT all audit events. Nothing in output includes
 * customer text, order/item IDs, names, timestamps or attachment URLs.
 */
import {extractApprovalGalleryImages} from './approval-inline-images.mjs';
const MAX=10000;
const count=n=>Math.min(MAX,Math.max(0,n));
const nodes=(root,selector)=>{
 try{return [...root?.querySelectorAll?.(selector)||[]]}
 catch{return []}
};
const text=node=>String(node?.textContent||'').trim().slice(0,4096);
const attr=(node,key)=>String(node?.getAttribute?.(key)||'');
const CATEGORIES={
 positive_min:/(?:толщин(?:а|ы)\s+лини|позитивн|тонки[ех]|мелк(?:ий|ие|их))/i,
 negative_min:/(?:пробельн|выворотк|зазор(?:ы|ов)?|просвет)/i,
 text_height:/(?:высот[аы]\s+букв)/i,
 color:/(?:\bCMYK\b|\bRGB\b|\bPantone\b|цветов(?:ой|ая|ые))/i,
 raster_resolution:/(?:разрешени[ея]|dpi|растров(?:ого|ое))/i,
 effects:/(?:градиент|прозрачност|эффект)/i,
 field_boundary:/(?:поле\s+нанесени|площад[ьи]|вылет)/i,
 constructor:/(?:конструктор|шаблон|масштаб|оси\s+конструктора)/i,
 fonts:/(?:текст\s+не\s+преобразов|шрифт)/i,
 wrong_artwork:/(?:макет\s+не\s+тот|не\s+тот\s+файл|файл\s+не\s+тот|неверн(?:ый|ое)\s+(?:макет|файл))/i,
 complex_work:/(?:сложност|час(?:а|ов)?\s+на\s+(?:дизайн|гравир))/i,
 revision:/(?:доработан|исправлен|нов(?:ый|ую)\s+макет)/i
};
function summary(){
 return {
  schema:'printcheck.vision.maket-adjusting-structure.v1',
  status:'MODAL_NOT_LOADED',
  trigger_count:0,article_scoped_trigger_count:0,
  modal_loaded:false,modal_currently_visible:false,
  problems_available_count:0,problems_checked_current_count:0,
  checked_problem_topic_hints:[],weak_message_topic_hints:[],
  unselected_problem_options_are_not_defects:true,
  human_comment_count:0,history_entry_count:0,history_system_entry_count:0,
  problem_add_events:0,problem_remove_events:0,status_change_events:0,
  other_system_events:0,attachments_total:0,attachments_pdf:0,
  attachments_psd:0,attachments_image_candidates:0,attachments_other:0,
  badge_comment_count:null,badge_matches_human_messages:null,
  attachment_content_downloaded:false,current_defects_expert_verified:false,
  history_version_alignment_verified:false,training_ready:false,
  order_numbers_included:false,item_ids_included:false,author_names_included:false,
  message_text_included:false,attachment_names_or_urls_included:false,
  timestamps_included:false
 };
}
function inRealModal(form){
 const modal=form?.closest?.('g-modal');
 if(!modal||!modal.querySelector?.('#j_maketadjusting_comments_list'))
   return null;
 return modal;
}
function isVisible(modal){
 return modal?.hasAttribute?.('visible')===true;
}
function categorize(textValue,found){
 for(const [key,re] of Object.entries(CATEGORIES))
  if(re.test(textValue))found.add(key);
}
function typeFromAttachment(anchor){
 const label=text(anchor);
 const ext=/\.([a-z0-9]{2,5})$/i.exec(label)?.[1]?.toLowerCase()||'';
 if(ext==='pdf')return 'pdf';
 if(['psd','psb'].includes(ext))return 'psd';
 if(['png','jpg','jpeg','webp','gif','bmp','tif','tiff'].includes(ext))return 'image';
 return 'other';
}
function isAuditEvent(content,wrap){
 if(/^Добавлены проблемы\s*:/i.test(content))return 'problem_add';
 if(/^Удалены проблемы\s*:/i.test(content))return 'problem_remove';
 if(/^(?:Вкл|Выкл)\s*\[/i.test(content))return 'state';
 // Native audit entries are compact and stylized differently from human
 // comments. Keep this as a fallback only, not a confirmed defect label.
 if(/(?:font-size\s*:\s*10px|background-color\s*:\s*#fbffff|background-color\s*:\s*#ffffcc)/i
    .test(attr(wrap,'style'))||wrap?.querySelector?.('.flex-main.opacity-half'))
   return 'other_system';
 return 'human';
}
function getCounter(modal){
 const span=modal.querySelector?.('#j_maketadjustingcomments_counter');
 const match=/^\s*(\d{1,5})\s*$/.exec(text(span));
 return match?Math.min(MAX,Number(match[1])):null;
}
export function inspectOpenMaketApprovalDom(doc){
 const result=summary();
 if(!doc?.querySelectorAll)return {...result,status:'DOCUMENT_UNAVAILABLE'};
 const triggers=nodes(doc,'a.j_maketadjusting');
 result.trigger_count=count(triggers.length);
 result.article_scoped_trigger_count=count(triggers.filter(el=>
   Boolean(el.closest?.('li[data-itemid]'))).length);
 const forms=nodes(doc,'#j_maketAdjustingForm');
 const verified=forms.map(inRealModal).filter(Boolean);
 const visible=verified.filter(isVisible);
 // Old native modals can persist hidden in DOM between article scans.
 // Prefer exactly one visible modal, never mix data across articles.
 const candidates=visible.length?visible:verified;
 if(candidates.length!==1)
  return {...result,status:candidates.length>1?
   'AMBIGUOUS_APPROVAL_MODAL':'MODAL_NOT_LOADED'};
 const modal=candidates[0],form=forms.find(x=>x.closest?.('g-modal')===modal);
 result.modal_loaded=true;
 result.modal_currently_visible=isVisible(modal);
 result.status=result.modal_currently_visible?
   'VISIBLE_MODAL_STRUCTURE_ONLY':'PRELOADED_MODAL_STRUCTURE_ONLY';
 const checks=nodes(form,'input[name="ma_problem[]"][type="checkbox"]');
 const checked=checks.filter(el=>el.checked===true||el.hasAttribute?.('checked'));
 result.problems_available_count=count(checks.length);
 result.problems_checked_current_count=count(checked.length);
 const topics=new Set();
 for(const el of checked){
  const label=el.closest?.('label')||el.parentElement;
  categorize(text(label),topics);
 }
 result.checked_problem_topic_hints=[...topics].sort();
 const list=modal.querySelector?.('#j_maketadjusting_comments_list');
 const entries=nodes(list,':scope > li');
 result.history_entry_count=count(entries.length);
 let humans=0;
 const weakMessages=new Set();
 for(const el of entries){
  const wrapper=el.querySelector?.('.comment_wrap');
  const main=wrapper?.querySelector?.(':scope > .flex-main');
  const content=text(main);
  const kind=isAuditEvent(content,wrapper);
  if(kind==='problem_add')result.problem_add_events++;
  else if(kind==='problem_remove')result.problem_remove_events++;
  else if(kind==='state')result.status_change_events++;
  else if(kind==='other_system')result.other_system_events++;
  else {humans++;categorize(content,weakMessages)}
  // Original screenshots live in g-gallery.shadowRoot, not attachment links.
  const orderNumber=String(doc?.location?.pathname||'').match(
    /^\/private\/order\/(\d{5,12})\/?$/)?.[1];
  const itemId=String(form?.querySelector('input[name="oiid"]')?.value||'');
  const gallery=extractApprovalGalleryImages(main,{orderNumber,itemId});
  result.attachments_total+=gallery.length;
  result.attachments_image_candidates+=gallery.length;
  // Attachment links appear WITHIN the comment's main text block, not
  // inside the author avatar. No GETs and no links returned.
  for(const anchor of nodes(main,'a.j_maketadjusting_attachment')){
   result.attachments_total++;
   const type=typeFromAttachment(anchor);
   if(type==='pdf')result.attachments_pdf++;
   if(type==='psd')result.attachments_psd++;
   if(type==='image')result.attachments_image_candidates++;
   if(type==='other')result.attachments_other++;
  }
 }
 result.human_comment_count=count(humans);
 result.weak_message_topic_hints=[...weakMessages].sort();
 result.history_system_entry_count=count(entries.length-humans);
 result.badge_comment_count=getCounter(modal);
 result.badge_matches_human_messages=result.badge_comment_count===null?
    null:result.badge_comment_count===result.human_comment_count;
 for(const field of ['problem_add_events','problem_remove_events',
  'status_change_events','other_system_events','attachments_total',
  'attachments_pdf','attachments_psd','attachments_image_candidates',
  'attachments_other'])result[field]=count(result[field]);
 return result;
}
