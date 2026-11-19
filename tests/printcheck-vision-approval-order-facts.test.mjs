import test from 'node:test';
import assert from 'node:assert/strict';
import {extractOrderFacts} from '../vision/orders/approval-order-facts.mjs';
const el=(text='',attr={},by={})=>({
 textContent:text,
 getAttribute:key=>attr[key]??null,
 querySelector:selector=>by[selector]??null,
 querySelectorAll:selector=>by['ALL '+selector]??[]
});
test('native order and item facts keep private customer info and exact article link',()=>{
 const articleName=el('Артикул 66003',{href:'http://testgifts.local/id/163481'});
 const product=el('Артикул 66003 Медаль Glory',{},{
  'a.cart-tbl-name':articleName,
  '.cart-tbl-lbl.vsbl-dk-lg':el('Медаль Glory')
 });
 const li=el('',{'data-itemid':'49994403','data-drawtaskids':'27633310,27633311'},{
  '.cart-tbl-id':product,
  '.cart-tbl-qty':el('16 шт. Цена Сумма 338,00 5 408,00'),
  '.cart-tbl-imp':el('UV2: УФ-печать; толщина 0,15 мм'),
  '.tbl-col.no-wrp':el('Сумма 11931,00'),
  'a.j_maketadjusting .gifts-badge':el('8')
 });
 const root=el('',{'data-orderid':'7915133'},{
  '.cart-header-date':el('05 ноя 2026'),
  '.cart-header-number':el('Заказ № 8097051'),
  '.cart-header-number .note':el('Сергей Корнюшин [Профессор] ООО ЮГА'),
  '.cart-header':el('Заказ № 8097051 Сергей Корнюшин'),
  'ALL .cart-log':[el('В обработке 06.11.26')],
  'ALL li[data-itemid]':[li]
 });
 const doc={querySelector:selector=>selector==='#j_cart_host'?root:null};
 const facts=extractOrderFacts(doc,'8097051');
 assert.equal(facts.schema,'printcheck.vision.private-order-facts.v1');
 assert.equal(facts.capture_status,'ORDER_DOM_CAPTURED');
 assert.equal(facts.order.order_number,'8097051');
 assert.equal(facts.order.internal_order_id,'7915133');
 assert.match(facts.order.customer_display,/Сергей Корнюшин/);
 assert.equal(facts.articles.length,1);
 const item=facts.articles[0];
 assert.equal(item.item_id,'49994403');
 assert.equal(item.article_code,'66003');
 assert.equal(item.product_name,'Медаль Glory');
 assert.equal(item.product_page,'http://testgifts.local/id/163481');
 assert.match(item.imprint_and_technical_requirements_text,/0,15 мм/);
 assert.equal(item.native_approval_badge,'8');
 assert.equal(facts.training_ready,false);
 assert.equal(facts.private_local_only,true);
});
test('unknown or hostile document does not fabricate facts or unsafe product links',()=>{
 const li=el('',{'data-itemid':'123'},{
  '.cart-tbl-id':el('',{},{
   'a.cart-tbl-name':el('Артикул x',{href:'http://evil.example/id/123'})
  })
 });
 const root=el('',{'data-orderid':'hack'},{
  'ALL li[data-itemid]':[li]
 });
 const res=extractOrderFacts({querySelector:()=>root},'nonsense');
 assert.equal(res.order.order_number,null);
 assert.equal(res.order.internal_order_id,null);
 assert.equal(res.articles[0].product_page,null);
 assert.equal(res.capture_status,'ORDER_DOM_INCOMPLETE');
});
