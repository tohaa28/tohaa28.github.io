import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../editor.html',import.meta.url),'utf8');
test('full width orders motion does not add height or replace navigation',()=>{
 assert.doesNotMatch(html,/<strong>МАКЕТЫ ЗАКАЗОВ<\/strong>/);
 assert.match(html,/<nav class="navrow"[^>]*><div class="gwb-orders-motion"/);
 assert.match(html,/\.navrow>\.gwb-orders-motion\{position:relative;box-sizing:border-box;width:100%;max-width:none;/);
 assert.match(html,/height:100%;max-height:50px;/);
 assert.match(html,/class="navlinks"/);
});
test('clicking the portrait changes gender with accessible keyboard button, no visible gender switch',()=>{
 assert.match(html,/<button class="gwb-om-portrait" id="gwbMotionCharacter" type="button"/);
 assert.match(html,/class="gwb-om-female" src="data:image\/webp;base64,UklGR/);
 assert.match(html,/class="gwb-om-male" src="data:image\/webp;base64,UklGR/);
 assert.doesNotMatch(html,/gwb-om-gender|data-gwb-gender/);
 assert.match(html,/persona\?\.addEventListener\("click",\(\)=>setGender/);
 assert.match(html,/localStorage\.setItem\(storageKey,gender\)/);
 assert.match(html,/gwb-om-portrait:focus-visible/);
});
test('laptop has correct aspect ratio, flight cards use real basket data when available',()=>{
 assert.match(html,/viewBox="0 0 106 52" preserveAspectRatio="xMidYMid meet"/);
 assert.match(html,/\.gwb-om-laptop\{height:50px;width:auto;aspect-ratio:106\/52;/);
 assert.match(html,/class="gwb-om-flight"/);
 for(const kind of ['sheet-1','sheet-2','sheet-3'])assert.match(html,new RegExp('class="gwb-om-sheet gwb-om-'+kind+'"'));
 assert.match(html,/\.basket-order \.gwb-basket-item/);
 assert.match(html,/\.gwb-basket-art/);
 assert.match(html,/\.gwb-basket-thumb img/);
 assert.match(html,/new MutationObserver\(queueRefresh\)/);
 assert.match(html,/addEventListener\("animationiteration"/);
 assert.match(html,/dataSource="basket"|dataset\.productSource="basket"/);
 assert.match(html,/url\.protocol==="https:"/);
 assert.match(html,/\(\^\|\\\.\)gifts\\\.ru\$\/i/);
 assert.match(html,/@media\(prefers-reduced-motion:reduce\)/);
});
test('printcheck and mockups keep their preexisting controls',()=>{
 assert.match(html,/id="basketOrders"/);
 assert.match(html,/function prepareOrderAccordion\(card,rows\)/);
 assert.match(html,/id="mockupModeButton"/);
});
