import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../editor.html',import.meta.url),'utf8');
test('animated orders character replaces heading in same 50 px navigation row',()=>{
 assert.doesNotMatch(html,/<strong>МАКЕТЫ ЗАКАЗОВ<\/strong>/);
 assert.match(html,/<nav class="navrow"[^>]*><div class="gwb-orders-motion"/);
 assert.match(html,/\.navrow>\.gwb-orders-motion\{height:100%;max-height:50px;/);
 assert.match(html,/\.navrow/);
 assert.match(html,/class="navlinks"/);
});
test('loop has four design beats, real matching artwork and accessible gender switch',()=>{
 for(const word of ['Создаём макет','Макет готов','Новая идея','И снова макет'])assert.ok(html.includes(word),word);
 assert.match(html,/data:image\/webp;base64,UklGR/);
 assert.match(html,/data-gender="female"/);
 assert.match(html,/data-gwb-gender="male" aria-pressed="false"/);
 assert.match(html,/data-gwb-gender="female" aria-pressed="true"/);
 assert.match(html,/localStorage\.setItem\(storageKey,gender\)/);
 assert.match(html,/animation:gwbOmScene 16s/);
 assert.match(html,/@media\(prefers-reduced-motion:reduce\)/);
});
test('orders motion has no external network assets, order controls and parent structure unchanged',()=>{
 assert.match(html,/id="basketOrders"/);
 assert.match(html,/function prepareOrderAccordion\(card,rows\)/);
 assert.match(html,/id="mockupModeButton"/);
 assert.doesNotMatch(html,/gwb-orders-motion[^\n]*<script src=/);
});
