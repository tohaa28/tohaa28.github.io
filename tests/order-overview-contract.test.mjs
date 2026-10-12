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

test('multi-item orders start collapsed, keep source card handler, and animate expansion',()=>{
 assert.match(html,/function prepareOrderAccordion\(card,rows\)/);
 assert.match(html,/rows\.length<=1/);
 assert.match(html,/card\.dataset\.gwbExpanded="false"/);
 assert.match(html,/for\(const row of rows\.slice\(1\)\)extra\.append\(row\)/);
 assert.match(html,/panel\.append\(extra\)/);
 assert.match(html,/extra\.inert=true/);
 assert.match(html,/toggle\.setAttribute\("aria-controls",extra\.id\)/);
 assert.match(html,/stopImmediatePropagation\(\)/);
 assert.match(html,/if\(event\.target\?\.closest\?\.\("\.basket-method"\)\)return;/);
 assert.match(html,/extra\.style\.height=expand\?extra\.scrollHeight\+"px":"0px"/);
 assert.match(html,/transition:height \.38s cubic-bezier/);
 assert.match(html,/aria-expanded/);
});
test('accordion prevents duplicate native button keyboard activation',()=>{
 assert.match(html,/const fromToggle=toggle\.contains\(event\.target\)/);
 assert.match(html,/if\(!fromToggle&&!collapsed\)return;\s*event\.preventDefault\(\);\s*event\.stopImmediatePropagation\(\);\s*toggleExpanded\(\);/);
});
