import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../editor.html',import.meta.url),'utf8');
test('full navigation-row motion replaces orders heading without extra row or fixed-width limit',()=>{
 assert.doesNotMatch(html,/<strong>МАКЕТЫ ЗАКАЗОВ<\/strong>/);
 assert.match(html,/<nav class="navrow"[^>]*><div class="gwb-orders-motion"/);
 assert.match(html,/\.navrow>\.gwb-orders-motion\{position:relative;box-sizing:border-box;width:100%;max-width:none;/);
 assert.match(html,/height:100%;max-height:50px;/);
 assert.match(html,/\.navrow:has\(>\.gwb-orders-motion\)>\.navlinks\{position:absolute;/);
 assert.match(html,/class="navlinks"/);
});
test('visible workbench screen launches three different completed layouts down a real full-width route',()=>{
 assert.match(html,/class="gwb-om-laptop"/);
 assert.match(html,/class="gwb-om-flight"/);
 assert.match(html,/class="gwb-om-route"/);
 for(const kind of ['sheet-1','sheet-2','sheet-3'])assert.match(html,new RegExp('class="gwb-om-sheet gwb-om-'+kind+'"'));
 for(const word of ['Создаём макет','PDF готов','Новая идея','Новый макет','Готовые макеты'])assert.ok(html.includes(word),word);
 assert.match(html,/@keyframes gwbOmFly/);
 assert.match(html,/left:calc\(100% - 60px\)/);
 assert.match(html,/animation:gwbOmFly 18s/);
});
test('approved gender portraits and persisted chooser are unchanged',()=>{
 assert.match(html,/class="gwb-om-female" src="data:image\/webp;base64,UklGR/);
 assert.match(html,/class="gwb-om-male" src="data:image\/webp;base64,UklGR/);
 assert.match(html,/data-gwb-gender="male" aria-pressed="false"/);
 assert.match(html,/data-gwb-gender="female" aria-pressed="true"/);
 assert.match(html,/localStorage\.setItem\(storageKey,gender\)/);
 assert.match(html,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(html,/\.gwb-om-sheet-1\{left:5%\}/);
});
test('printcheck, orders and mockup UI still exist',()=>{
 assert.match(html,/id="basketOrders"/);
 assert.match(html,/function prepareOrderAccordion\(card,rows\)/);
 assert.match(html,/id="mockupModeButton"/);
 assert.match(html,/class="navlinks"/);
 assert.doesNotMatch(html,/gwb-orders-motion[^\n]*<script src=/);
});
