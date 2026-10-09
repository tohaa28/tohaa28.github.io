import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../editor.html',import.meta.url),'utf8');
test('order overview is expanded before first order is selected',()=>{
 assert.match(html,/<main class="gwb-orders-full">/);
 assert.match(html,/classList\.toggle\("gwb-orders-full",picking\)/);
 assert.match(html,/transition:--gwb-order-rail-width \.52s/);
});
test('basket overview preserves the order click contracts and derives photos from genuine items',()=>{
 assert.match(html,/querySelectorAll\("\.basket-order"\)/);
 assert.match(html,/orderItems/);
 assert.match(html,/item\.product/);
 assert.match(html,/item\.imageUrl/);
 assert.match(html,/photos\/0/);
});
