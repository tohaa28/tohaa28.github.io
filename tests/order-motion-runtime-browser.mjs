import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chromium} from 'playwright';

// Test actual production CSS and actual banner script under the accessibility
// mode that previously DISABLED the entire animation in the user's browser.
const original=readFileSync('editor.html','utf8');
const css=original.slice(original.indexOf('<style>')+7,original.indexOf('</style>'));
const bannerStart=original.indexOf('<div class="gwb-orders-motion"');
const bannerEnd=original.indexOf('</div><div class="navlinks">',bannerStart);
assert.ok(bannerStart>0&&bannerEnd>bannerStart);
const banner=original.slice(bannerStart,bannerEnd+6);
const jsStart=original.indexOf('/* Compact orders motion:');
const jsEnd=original.indexOf('</script>',jsStart);
assert.ok(jsStart>0&&jsEnd>jsStart);
const script=original.slice(jsStart,jsEnd);
const html='<!doctype html><html><head><style>'+css+
' .navrow{display:flex;width:1150px;height:50px;position:relative}body{margin:0}'+
'</style></head><body><nav class="navrow">'+banner+'</nav>'+
'<div id="basketOrders"></div><script>'+script+'</script></body></html>';
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1200,height:350},reducedMotion:'reduce'});
 await page.route('https://gifts.ru/__gwb_motion_realistic_test',r=>
   r.fulfill({status:200,contentType:'text/html',body:html}));
 await page.goto('https://gifts.ru/__gwb_motion_realistic_test');
 const mover=page.locator('.gwb-om-sheet-1');
 await mover.waitFor();
 assert.equal(await page.locator('#gwbOrdersMotion').getAttribute('data-motion'),'play');
 const s1=await mover.evaluate(el=>({time:el.getAnimations()[0]?.currentTime||0,
   name:getComputedStyle(el).animationName,opacity:getComputedStyle(el).opacity,
   left:el.getBoundingClientRect().left}));
 assert.equal(s1.name,'gwbOmFly','Must animate even when Windows requests reduced motion');
 await page.waitForTimeout(1400);
 const s2=await mover.evaluate(el=>({time:el.getAnimations()[0]?.currentTime||0,
   left:el.getBoundingClientRect().left}));
 assert.ok(s2.time>s1.time+1000,'Animation clock did not advance: '+JSON.stringify({s1,s2}));
 assert.ok(Math.abs(s1.left-s2.left)>1,'Sheet must physically move on screen: '+JSON.stringify({s1,s2}));
 const toggle=page.locator('#gwbMotionToggle');
 assert.equal(await toggle.count(),1,'Play/pause control must be present');
 await toggle.evaluate(el=>el.click());
 assert.equal(await page.locator('#gwbOrdersMotion').getAttribute('data-motion'),'pause');
 assert.equal(await mover.evaluate(el=>getComputedStyle(el).animationName),'none');
 await toggle.evaluate(el=>el.click());
 assert.equal(await mover.evaluate(el=>getComputedStyle(el).animationName),'gwbOmFly');
 console.log('Top header visibly moves with reduced-motion OS preference, and explicit pause/play works');
}finally{await browser.close()}
