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
 assert.match(html,/class="gwb-om-persona-sprite" aria-hidden="true"/);
 assert.doesNotMatch(html,/class="gwb-om-(?:female|male)" src="data:image\/webp/);
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
 assert.ok(html.includes('root.dataset.productSource="basket"'));
 assert.match(html,/url\.protocol==="https:"/);
 assert.ok(html.includes('gifts\\.ru$/i.test(url.hostname)'),"Only approved gifts.ru images");
 assert.match(html,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(html,/if\(!article\|\|!\/\\d\{3,\}\/\.test\(article\)\)/);
});
test('approved four-pose storyboard is synchronized with the 18s design cycle',()=>{
 const sprite=readFileSync(new URL('../assets/orders-persona-poses.webp',import.meta.url));
 assert.ok(sprite.length>4000 && sprite.length<24000);
 assert.equal(sprite.toString('ascii',0,4),'RIFF');
 assert.equal(sprite.toString('ascii',8,12),'WEBP');
 assert.match(html,/\.gwb-om-persona-sprite\{[^}]*background-size:328px 100px;/);
 assert.match(html,/\.gwb-orders-motion\[data-gender="male"\] \.gwb-om-persona-sprite\{background-position-y:-50px\}/);
 assert.match(html,/@keyframes gwbOmPersonaFrames/);
 for(const pos of ['0','-82px','-164px','-246px'])assert.ok(html.includes('background-position-x:'+pos));
 assert.match(html,/animation:gwbOmPersonaFrames 18s steps\(1,end\) infinite/);
 assert.match(html,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(html,/\.gwb-om-persona-sprite\{background-position-x:0\}/);
});
test('printcheck and mockups keep their preexisting controls',()=>{
 assert.match(html,/id="basketOrders"/);
 assert.match(html,/function prepareOrderAccordion\(card,rows\)/);
 assert.match(html,/id="mockupModeButton"/);
});
