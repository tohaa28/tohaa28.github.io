import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../editor.html',import.meta.url),'utf8');
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
