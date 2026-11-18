/**
 * Read-only discovery of article discussion UI in an already-fetched order card.
 *
 * We have NO verified authenticated discussion endpoint yet. Never click a
 * discussion button, execute its onclick, fetch links, or scrape attachments.
 * Only fixed categorical counts may enter the anonymous diagnostics. The
 * words of a designer, screenshots, URLs, names and article IDs stay private.
 * All possible defect terms are weak "topic candidates", NEVER expert labels.
 */
const CONTROL_SELECTOR='a[href],button,[role="button"],[data-action],[data-toggle]';
const THREAD_SELECTOR='[data-discussion-id],[data-thread-id],[data-comments-id],'+
  '.discussion,.discussion-list,.discussion-dialog,.comments-list,'+
  '.comment-list,.chat-messages,.messages-list,.j_discussion,.j_comments';
const MESSAGE_SELECTOR='[data-comment-id],[data-message-id],.comment-item,'+
  '.message-item,.discussion-message,.chat-message';
const BODY_SELECTOR='.comment-body,.comment-text,.message-text,'+
  '.message-body,[data-comment-text],[data-message-text]';
const ARTICLE_SELECTOR='[data-orderitemid],[data-orderitem-id],'+
  '[data-item-id],[data-article],.orderitem,.order-item,'+
  '.cart-order-item,.cart-item,.j_order_item';
const DISCUSS=/(?:обсуждени[еяй]|комментар(?:ии|ий|ия|иев)|переписк[ауе]|discuss(?:ion)?|comments?|messages?|conversation|чат\b)/i;
const AGREEMENT=/(?:согласовани[ея]|утверждени[ея]|approval|approve)/i;
const TOPICS=Object.freeze({
  positive_min:/(?:тонк(?:ая|ие|их|ий)|толщин[ауы]|мелки[ех]|перемычк[аие]|линия\s+тонк)/i,
  negative_min:/(?:пробел[ауы]?|выворотк|зазор[ауы]?|просвет[ауы]?)/i,
  out_of_field:/(?:вне\s+(?:поля|зоны)|за\s+(?:пределы|границ)|выходит\s+за|охранн(?:ое|ая)\s+поле)/i,
  color:/(?:\brgb\b|\bcmyk\b|\bpantone\b|цветоделени|цветов(?:ое|ые)|цвет\s+не)/i,
  font:/(?:шрифт[ауы]?|в\s+кривы[ех]|текст\s+не\s+перев)/i,
  raster_resolution:/(?:разрешени[ея]|dpi|пикселизац|растров(?:ый|ое)|пиксел[ья])/i,
  gradient_transparency:/(?:градиент[ауы]?|прозрачност[ьи]|эффект[ауы]?|тень\b)/i,
  constructor_alignment:/(?:конструктор[ауы]?|шаблон[ауы]?|масштаб[ауы]?|смещени[ея]|совмещени[ея])/i
});
const limit=(n,max=10000)=>Math.min(max,n);
const empty=()=>({
 schema:'printcheck.vision.article-discussion-structure.v1',
 status:'STRUCTURE_ONLY_UNVERIFIED',
 controls_total:0,article_scoped_controls:0,order_scoped_controls:0,
 unresolved_scope_controls:0,link_targets_internal_test:0,
 link_targets_untrusted_or_external:0,link_targets_fragments:0,
 js_or_opaque_controls:0,inline_thread_candidates:0,
 visible_message_candidates:0,screenshot_or_image_candidates:0,
 weak_topic_candidates:[],
 discussion_endpoint_verified:false,discussion_content_complete:false,
 discussion_artwork_link_verified:false,expert_label_verified:false,
 screenshot_roi_verified:false,training_ready:false,
 customer_text_included:false,attachment_urls_included:false,
 order_ids_included:false,author_names_included:false,source_artwork_included:false
});
const safeAttr=(el,name)=>String(el?.getAttribute?.(name)||'').slice(0,260);
const inForbiddenBlock=el=>Boolean(el?.closest?.(
  '#vision-local-order-overlay,[data-vision-order-cell]'));
function controlLabel(el){
 const label=[safeAttr(el,'title'),safeAttr(el,'aria-label'),
  safeAttr(el,'data-action'),safeAttr(el,'data-toggle'),
  safeAttr(el,'data-target'),String(el?.textContent||'').slice(0,180)].join(' ');
 // Keep all text in memory, never in the return object.
 return label;
}
function targetClass(el,base){
 const raw=safeAttr(el,'href').trim();
 if(!raw)return 'OPAQUE';
 if(raw.startsWith('#'))return 'FRAGMENT';
 if(/^javascript:/i.test(raw))return 'OPAQUE';
 try{
   const href=new URL(raw,base);
   if(href.protocol!=='http:'&&href.protocol!=='https:')return 'OPAQUE';
   if(href.protocol==='http:'&&
      ['psk.testgifts.local','testgifts.local'].includes(href.hostname)&&
      (!href.port||href.port==='80')&&!href.username&&!href.password)
     return 'INTERNAL_TEST';
   return 'EXTERNAL';
 }catch{return 'OPAQUE'}
}
function all(scope,selector){
 try{return [...scope?.querySelectorAll?.(selector)||[]]}
 catch{return []}
}
function messageText(node){
 const bodies=all(node,BODY_SELECTOR);
 if(bodies.length)return bodies.slice(0,15).map(x=>String(x.textContent||'')
   .slice(0,2500)).join(' ');
 return String(node?.textContent||'').slice(0,2500);
}

/** No HTTP, no events, no DOM mutations; only passive structural heuristics. */
export function inspectOrderDiscussionDom(doc,{baseUrl='http://psk.testgifts.local/private/order/8000001'}={}){
 const report=empty();
 if(!doc?.querySelectorAll)return {...report,status:'ORDER_DOCUMENT_INVALID'};
 const topics=new Set();
 const controls=all(doc,CONTROL_SELECTOR);
 for(const el of controls){
   if(inForbiddenBlock(el))continue;
   // Skip approval/sign-off controls. Discussion of a PRINT APPLICATION
   // must not be confused with the prohibited "Согласования макетов" flow.
   const label=controlLabel(el);
   if(!DISCUSS.test(label)||AGREEMENT.test(label))continue;
   report.controls_total++;
   const scope=el.closest?.(ARTICLE_SELECTOR);
   if(scope)report.article_scoped_controls++;
   else if(el.closest?.('.cart-order,.order-card,#j_cart_host'))
     report.order_scoped_controls++;
   else report.unresolved_scope_controls++;
   const kind=targetClass(el,baseUrl);
   if(kind==='INTERNAL_TEST')report.link_targets_internal_test++;
   else if(kind==='FRAGMENT')report.link_targets_fragments++;
   else if(kind==='EXTERNAL')report.link_targets_untrusted_or_external++;
   else report.js_or_opaque_controls++;
 }
 const threads=all(doc,THREAD_SELECTOR).filter(x=>!inForbiddenBlock(x));
 report.inline_thread_candidates=limit(threads.length);
 const seen=new Set();
 for(const root of threads){
   const messages=all(root,MESSAGE_SELECTOR);
   for(const message of messages){
     if(seen.has(message))continue;
     seen.add(message);
     const body=messageText(message);
     for(const [topic,re] of Object.entries(TOPICS))
       if(re.test(body))topics.add(topic);
   }
 }
 report.visible_message_candidates=limit(seen.size);
 const photos=new Set();
 for(const root of threads){
   for(const el of all(root,'img,picture,video,a[href]')){
     if(el.tagName==='IMG'||el.tagName==='PICTURE'||el.tagName==='VIDEO'){
       photos.add(el);continue;
     }
     if(/\.(?:png|jpe?g|webp|gif|bmp)(?:$|[?#])/i.test(safeAttr(el,'href')))
       photos.add(el);
   }
 }
 report.screenshot_or_image_candidates=limit(photos.size);
 report.weak_topic_candidates=[...topics].sort();
 return report;
}

/** Anonymized aggregation across different DOM sources, never raw excerpts. */
export function mergeDiscussionProbes(...probes){
 const valid=probes.filter(x=>x?.schema==='printcheck.vision.article-discussion-structure.v1');
 const result=empty();
 for(const report of valid){
   for(const field of ['controls_total','article_scoped_controls','order_scoped_controls',
       'unresolved_scope_controls','link_targets_internal_test',
       'link_targets_untrusted_or_external','link_targets_fragments',
       'js_or_opaque_controls','inline_thread_candidates',
       'visible_message_candidates','screenshot_or_image_candidates'])
     result[field]=limit(result[field]+report[field]);
 }
 result.weak_topic_candidates=[...new Set(valid.flatMap(x=>x.weak_topic_candidates||[]))].sort();
 return result;
}
