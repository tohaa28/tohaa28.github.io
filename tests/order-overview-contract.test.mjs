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
 assert.match(html,/panel\.inert=true/);
 assert.match(html,/stopImmediatePropagation\(\)/);
 assert.match(html,/insideItem&&card\.dataset\.gwbExpanded==="true"/);
 assert.match(html,/panel\.style\.height=expand\?panel\.scrollHeight\+"px":"0px"/);
 assert.match(html,/transition:height \.38s cubic-bezier/);
 assert.match(html,/aria-expanded/);
});
test('accordion lets the native button handle Enter and Space once',()=>{
 assert.match(html,/if\(toggle\.contains\(event\.target\)\)return;/);
 assert.match(html,/if\(card\.dataset\.gwbExpanded==="true"\)return;/);
});
