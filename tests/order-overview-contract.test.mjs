import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../editor.html',import.meta.url),'utf8');
test('mockup badge reserves space beside compact basket quantity',()=>{
 assert.match(html,/\.basket-method\.has-mockup-map \.gwb-basket-details\{padding-right:28px;box-sizing:border-box\}/);
 assert.match(html,/\.mockup-map-badge\{position:absolute;right:7px;top:7px/);
});
test('order overview is expanded before first order is selected',()=>{
 assert.match(html,/<main class="gwb-orders-full">/);
 assert.match(html,/classList\.toggle\("gwb-orders-full",picking\)/);
 assert.match(html,/transition:width \.52s/);
 assert.match(html,/\.app>main\.gwb-orders-full>\.workspace\{opacity:0;visibility:hidden;pointer-events:none\}/);
 assert.match(html,/position:absolute;left:0;top:0;bottom:0;width:100%/);
});
test('basket overview preserves the order click contracts and derives photos from genuine items',()=>{
 assert.match(html,/querySelectorAll\("\.basket-order"\)/);
 assert.match(html,/orderItems/);
 assert.match(html,/item\.product/);
 assert.match(html,/item\.imageUrl/);
 assert.match(html,/detailRequests=new WeakMap\(\)/);
 assert.match(html,/detailFor\(card,order\)/);
 assert.match(html,/photos\/0/);
 assert.match(html,/visibleImages\.observe\(thumb\)/);
});

test('multi-item orders show the first article and unfold extras on hover',()=>{
 assert.match(html,/function prepareOrderAccordion\(card,rows\)/);
 assert.match(html,/rows\.length<=1/);
 assert.match(html,/card\.dataset\.gwbExpanded="false"/);
 assert.match(html,/for\(const row of rows\.slice\(1\)\)extra\.append\(row\)/);
 assert.match(html,/panel\.append\(extra\)/);
 assert.match(html,/extra\.inert=true/);
 assert.match(html,/card\.setAttribute\("aria-controls",extra\.id\)/);
 assert.match(html,/card\.addEventListener\("mouseenter",\(\)=>setExpanded\(true\)\)/);
 assert.match(html,/card\.addEventListener\("mouseleave",\(\)=>setExpanded\(false\)\)/);
 assert.match(html,/card\.addEventListener\("focusin",\(\)=>setExpanded\(true\)\)/);
 assert.match(html,/card\.matches\(":hover"\)/);
 assert.match(html,/extra\.style\.height=expand\?extra\.scrollHeight\+"px":"0px"/);
 assert.match(html,/transition:height \.38s cubic-bezier/);
});
test('arrow is decorative and order click delegation is unchanged',()=>{
 assert.match(html,/element\("span","gwb-order-multi-indicator"\)/);
 assert.match(html,/indicator\.setAttribute\("aria-hidden","true"\)/);
 assert.match(html,/\.gwb-order-multi-indicator\{[^}]*pointer-events:none/);
 assert.doesNotMatch(html,/element\("button","gwb-order-accordion-toggle"\)/);
 assert.doesNotMatch(html,/const toggleExpanded=/);
 assert.doesNotMatch(html,/card\.addEventListener\("click",event=>/);
 assert.match(html,/card\.setAttribute\("aria-expanded",String\(expand\)\)/);
});

test('cards on the same grid row stretch to the tallest order and counts are prominent',()=>{
 assert.match(html,/\.app>main\.gwb-orders-full #basketOrders\{[^}]*align-items:stretch\}/);
 assert.match(html,/\.app>main\.gwb-orders-full \.basket-order\{margin:0;align-self:stretch;box-sizing:border-box\}/);
 assert.match(html,/\.gwb-basket-count\{[^}]*font:750 12\.5px\/1\.3 system-ui,sans-serif/);
});
