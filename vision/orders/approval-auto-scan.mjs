/**
 * M3.14 — client-side, explicit user-initiated, READ-ONLY native modal walker.
 * It clicks ONLY an exact a.j_maketadjusting within li[data-itemid],
 * when the trigger has a numeric badge strictly greater than 1.
 * If the message list is lazy, it switches to the exact native
 * label[for=j_ma_comments] (a GET-only UI tab) once.
 * Site-owned clicks may perform documented GETs to render the modal.
 * Never click form-save controls, attachment links or send POST.
 * Private messages, article/order IDs and attachment filenames may appear
 * only in an explicitly downloaded LOCAL PRIVATE JSON, not in GitHub/CI.
 */
import {inspectOpenMaketApprovalDom} from './maket-approval-probe.mjs';

const MAX_TARGETS=100,MAX_MESSAGES=1500,MAX_TEXT=12000;
const MAX_LOCAL_PRIVATE_CHARS=24_000_000;
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const all=(root,selector)=>{try{return [...root.querySelectorAll(selector)]}catch{return []}};
const str=node=>String(node?.textContent||'').trim();
const attr=(node,name)=>String(node?.getAttribute?.(name)||'');
const digits=v=>/^\d{1,20}$/.test(v);
const safeText=s=>String(s||'').slice(0,MAX_TEXT);
const badgeNumber=a=>{
 const badge=a?.querySelector?.('.gifts-badge');
 const match=badge&&/^\s*(\d{1,5})\s*$/.exec(str(badge));
 return match?Number(match[1]):null;
};
const attachedFileType=name=>{
 const extension=/\.([a-z0-9]{2,5})$/i.exec(name)?.[1]?.toLowerCase();
 if(extension==='pdf')return 'pdf';
 if(['psd','psb'].includes(extension))return 'psd';
 if(['png','jpg','jpeg','webp','gif','bmp','tif','tiff'].includes(extension))return 'image';
 return 'other';
};
const visibleModal=doc=>all(doc,'g-modal[visible]').find(m=>
 m.querySelector?.('#j_maketAdjustingForm'));
const humanOrSystem=(body,wrapper)=>{
 if(/^Добавлены проблемы\s*:/i.test(body))return 'problem_added';
 if(/^Удалены проблемы\s*:/i.test(body))return 'problem_removed';
 if(/^(?:Вкл|Выкл)\s*\[/i.test(body))return 'status_change';
 if(wrapper?.querySelector?.('.flex-main.opacity-half')||
    /(?:font-size\s*:\s*10px|background-color\s*:\s*#(?:fbffff|ffffcc))/i
     .test(attr(wrapper,'style')))return 'system_other';
 return 'human';
};
/** The native DOM rather than a guessed HTTP URL establishes the association. */
export function discoverMaketApprovalTargets(doc){
 const anchors=all(doc,'li[data-itemid] a.j_maketadjusting');
 const eligible=[],skipped=[];
 for(let index=0;index<anchors.length;index++){
  const element=anchors[index],li=element.closest('li[data-itemid]');
  const itemId=attr(li,'data-itemid'),badge=badgeNumber(element);
  const anchorHref=attr(element,'href');
  const linkOk=anchorHref==='#'||anchorHref===''||
     (anchorHref.startsWith('http://testgifts.local/private/order/')&&
       anchorHref.endsWith('#'));
  const approved=digits(itemId)&&linkOk;
  const info={index:index+1,element,itemId,badge};
  if(!approved)skipped.push({index:index+1,reason:'UNSAFE_NATIVE_TRIGGER'});
  else if(badge===null)skipped.push({index:index+1,reason:'BADGE_UNKNOWN'});
  else if(badge<=1)skipped.push({index:index+1,reason:'BELOW_MESSAGE_THRESHOLD'});
  else eligible.push(info);
 }
 return {eligible:eligible.slice(0,MAX_TARGETS),skipped,
  eligible_over_limit:eligible.length>MAX_TARGETS,
  total_triggers:anchors.length};
}

/** Private, never auto-uploaded. Raw author names/cookies never included. */
export function extractMaketApprovalEvidence(doc,{itemId,orderNumber,badge}={}){
 const modal=visibleModal(doc);
 if(!modal)return {status:'MODAL_NOT_VISIBLE'};
 const form=modal.querySelector('#j_maketAdjustingForm');
 const formItem=attr(form?.querySelector('input[name="oiid"]'),'value')||
   String(form?.querySelector('input[name="oiid"]')?.value||'');
 if(!form||!digits(itemId)||formItem!==itemId)
  return {status:'ARTICLE_MISMATCH_OR_MISSING'};
 const summary=inspectOpenMaketApprovalDom(doc);
 if(summary.status!=='VISIBLE_MODAL_STRUCTURE_ONLY')
  return {status:'MODAL_STRUCTURE_INCOMPLETE'};
 const checks=all(form,'input[type="checkbox"][name="ma_problem[]"]');
 const currentProblems=checks.filter(c=>c.checked===true).map(c=>{
  const group=c.closest('.grid');
  const tech=group?.querySelector('.col-3-12');
  const method=str(tech?.querySelector('.bold-500'));
  const placement=str(tech?.querySelector('.color-text.color--dark'));
  return {
   code:digits(String(c.value||attr(c,'value')))?
     String(c.value||attr(c,'value')):null,
   label:safeText(str(c.closest('label')||c.parentElement)),
   print_method:safeText(method),print_placement:safeText(placement),
   source:'currently_checked_designer_problem',
   historical_event_required_for_original_defect_proof:true
  };
 }).slice(0,100);
 const description=safeText(form.querySelector('[name="ma_description"]')?.value||'');
 const list=modal.querySelector('#j_maketadjusting_comments_list');
 const entries=all(list,':scope > li');
 if(entries.length>MAX_MESSAGES)
  return {status:'HISTORY_TOO_LONG',summary};
 const messages=[];
 for(let i=0;i<entries.length;i++){
  const wrap=entries[i].querySelector('.comment_wrap');
  const main=wrap?.querySelector('.flex-main');
  if(!wrap||!main)return {status:'HISTORY_STRUCTURE_UNREADABLE',summary};
  const attachments=all(main,'a.j_maketadjusting_attachment').map(a=>({
   // Saved only in LOCAL PRIVATE JSON to link the comment to a source,
   // but no href/URL, cookie, author identity or binary is collected.
   attachment_id:digits(attr(a,'data-id'))?attr(a,'data-id'):null,
   filename:safeText(str(a)),
   kind:attachedFileType(str(a)),
   downloaded:false
  })).slice(0,40);
  const clone=main.cloneNode(true);
  for(const anchor of all(clone,'a.j_maketadjusting_attachment'))
   anchor.remove();
  const body=safeText(str(clone).replace(/\s+/g,' '));
  const kind=humanOrSystem(body,wrap);
  const at=str(wrap.querySelector('.comment_info'));
  const timestamp=at.match(/\b\d{2}\.\d{2}\.\d{2,4}\s+\d{2}:\d{2}\b/)?.[0]||null;
  messages.push({sequence:i+1,kind,text:body,date_time:timestamp,attachments});
 }
 const humans=messages.filter(m=>m.kind==='human').length;
 return {
  status:humans===badge?'PRIVATE_REVIEW_ONLY':'PRIVATE_HISTORY_UNVERIFIED',
  order_number:digits(orderNumber)?orderNumber:null,item_id:itemId,
  declared_message_badge:badge,observed_human_comments:humans,
  current_problems:currentProblems,
  additional_problem_description:description,
  history:messages,summary,attachment_bytes_collected:false,
  source_pdf_revision_confirmed:false,expert_roi_confirmed:false,
  training_ready:false,production_approved:false
 };
}
const waitForArticleModal=async(doc,itemId,badge,{
 stop=()=>false,timeoutMs=16000,pollMs=150}={})=>{
 const deadline=Date.now()+timeoutMs;
 let modalOpenedAt=0,discussionTabOpened=false;
 let stableHistoryAt=0,stableHistoryCount=-1;
 while(Date.now()<deadline){
  if(stop())return {status:'STOP_REQUESTED'};
  const modal=visibleModal(doc);
  if(modal){
   const form=modal.querySelector('#j_maketAdjustingForm');
   const input=form?.querySelector('input[name="oiid"]');
   const modalId=String(input?.value||attr(input,'value'));
   const list=modal.querySelector('#j_maketadjusting_comments_list');
   if(modalId===itemId){
    if(!modalOpenedAt)modalOpenedAt=Date.now();
    if(list){
     const probe=inspectOpenMaketApprovalDom(doc);
     if(probe.human_comment_count===badge){
      if(stableHistoryCount!==probe.history_entry_count){
       stableHistoryCount=probe.history_entry_count;
       stableHistoryAt=Date.now();
      }else if(Date.now()-stableHistoryAt>=350)
       return {status:'READY'};
     }else{
      stableHistoryAt=0;stableHistoryCount=-1;
     }
    }
    // Native Gifts loads the comments tab lazily in some orders.
    // Exactly one label click per opened modal: UI navigation only.
    // The site's documented load_maketadjusting_comments is a GET.
    if(!discussionTabOpened&&Date.now()-modalOpenedAt>=450){
     const tab=modal.querySelector('label[for="j_ma_comments"]');
     if(tab&&modal.querySelector('input#j_ma_comments')){
      discussionTabOpened=true;tab.click();
     }else discussionTabOpened=true;
    }
   }
  }
  await sleep(pollMs);
 }
 return {status:'TIMEOUT_OR_INCOMPLETE_COMMENTS'};
};
/**
 * Traverse one opened order page in sequence, one native modal at a time.
 * Does not follow new order links; a separate authorized batch controller
 * may call this via the extension later.
 */
export async function collectMaketApprovalsOnOrderPage(doc,{
 orderNumber='',onProgress=()=>{},stop=()=>false,
 timeoutMs=16000,pauseMs=220}={}){
 const discovered=discoverMaketApprovalTargets(doc);
 const result={
  schema:'printcheck.vision.private-approval-collection.v1',
  scope:'LOCAL_AUTHORIZED_TEST_ORDER',
  order_number:digits(orderNumber)?orderNumber:null,
  total_triggers:discovered.total_triggers,
  selected_by_badge:discovered.eligible.length,
  skipped:discovered.skipped,
  eligible_over_limit:discovered.eligible_over_limit,
  articles:[],status:'COMPLETE',
  remote_upload:false,comments_saved_to_github:false,
  attachment_bytes_collected:false,expert_roi_confirmed:false,
  training_ready:false,production_approved:false
 };
 if(discovered.eligible_over_limit){
  result.status='TARGET_LIMIT_EXCEEDED';return result;
 }
 if(all(doc,'g-modal[visible]').length){
  result.status='EXISTING_NATIVE_MODAL_OPEN';return result;
 }
 let retainedPrivateChars=0;
 for(let i=0;i<discovered.eligible.length;i++){
  if(stop()){result.status='STOPPED';break}
  const target=discovered.eligible[i];
  onProgress({processed:i,total:discovered.eligible.length,badge:target.badge});
  // Do not repeat an entrypoint if a user has opened another native modal.
  if(all(doc,'g-modal[visible]').length){
   result.status='EXISTING_NATIVE_MODAL_OPEN';break;
  }
  const stub={article_index:target.index,declared_badge:target.badge};
  try{
   target.element.click(); // the ONLY native site action, strictly scoped
   const ready=await waitForArticleModal(doc,target.itemId,target.badge,{
    stop,timeoutMs});
   if(ready.status==='READY'){
    const data=extractMaketApprovalEvidence(doc,{
     itemId:target.itemId,orderNumber,badge:target.badge});
    const estimated=JSON.stringify(data).length;
    if(retainedPrivateChars+estimated>MAX_LOCAL_PRIVATE_CHARS){
     result.status='LOCAL_PRIVATE_BUDGET_REACHED';
     result.articles.push({...stub,status:'LOCAL_PRIVATE_BUDGET_REACHED'});
    }else{
     retainedPrivateChars+=estimated;
     result.articles.push({...stub,...data});
    }
   }else result.articles.push({...stub,status:ready.status});
  }catch{result.articles.push({...stub,status:'NATIVE_MODAL_UNAVAILABLE'})}
  finally{
   const modal=visibleModal(doc);
   // Only close the modal opened by this exact article if its form ID
   // matches, preventing accidental closing of an unrelated user modal.
   const activeId=String(modal?.querySelector('input[name="oiid"]')?.value||
     attr(modal?.querySelector('input[name="oiid"]'),'value'));
   if(modal&&activeId===target.itemId)modal.removeAttribute('visible');
  }
  if(result.status==='LOCAL_PRIVATE_BUDGET_REACHED')break;
  if(stop()){result.status='STOPPED';break}
  await sleep(pauseMs);
 }
 result.successful_articles=result.articles.filter(x=>
  x.status==='PRIVATE_REVIEW_ONLY').length;
 result.unverified_articles=result.articles.length-result.successful_articles;
 onProgress({processed:result.articles.length,
  total:discovered.eligible.length,complete:true});
 return result;
}
/** Sharing-safe derivative of private review file, no customer data. */
export function anonymousApprovalCollection(report){
 const statuses=new Set(['PRIVATE_REVIEW_ONLY','PRIVATE_HISTORY_UNVERIFIED',
  'TIMEOUT_OR_INCOMPLETE_COMMENTS','STOP_REQUESTED',
  'ARTICLE_MISMATCH_OR_MISSING','MODAL_STRUCTURE_INCOMPLETE',
  'HISTORY_TOO_LONG','HISTORY_STRUCTURE_UNREADABLE',
  'NATIVE_MODAL_UNAVAILABLE','LOCAL_PRIVATE_BUDGET_REACHED']);
 const nums=['history_entry_count','human_comment_count',
  'history_system_entry_count','problems_available_count',
  'problems_checked_current_count','attachments_total','attachments_pdf',
  'attachments_psd','attachments_image_candidates',
  'problem_add_events','problem_remove_events'];
 const rows=(report?.articles||[]).map((row,i)=>{
  const summary=row?.summary||{};
  const safe={article_index:i+1,
   status:statuses.has(row.status)?row.status:'MANUAL',
   declared_badge:Number.isInteger(row.declared_badge)?row.declared_badge:null};
  for(const key of nums)safe[key]=Number.isInteger(summary[key])?
   Math.max(0,Math.min(10000,summary[key])):null;
  return safe;
 });
 return {
  schema:'printcheck.vision.anonymous-approval-collection.v1',
  eligible_articles:rows.length,articles:rows,
  skipped_below_or_unknown:(report?.skipped||[]).length,
  training_ready:false,remote_upload:false,
  contains_customer_text:false,contains_order_ids:false,
  contains_attachment_names:false,contains_authors:false,
  contains_attachment_urls:false
 };
}
