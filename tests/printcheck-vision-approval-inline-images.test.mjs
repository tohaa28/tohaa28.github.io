import test from 'node:test';
import assert from 'node:assert/strict';
import {verifiedApprovalGalleryImageUrl,extractApprovalGalleryImages}
 from '../vision/orders/approval-inline-images.mjs';

const root='http://files.testgifts.local/maketadjusting/11313/8001111/77/';
const scope={orderNumber:'8001111',itemId:'77'};
function image(src){return {getAttribute:key=>key==='src'?src:null}}
function gallery(){
 const items=[image(root+'capture.png'),image(root+'capture.png'),
   image('http://evil.local/maketadjusting/11313/8001111/77/no.png')];
 return {shadowRoot:{querySelectorAll:selector=>{
  assert.equal(selector,'section picture img');return items
 }}};
}
test('native open shadowRoot original image nodes, not nav thumbnails/avatars',()=>{
 const main={querySelectorAll:selector=>{
  assert.equal(selector,'g-gallery');return [gallery()] }};
 const files=extractApprovalGalleryImages(main,scope);
 assert.equal(files.length,1);
 assert.equal(files[0].filename,'capture.png');
 assert.equal(files[0].source,'native_approval_gallery');
 assert.equal(files[0].kind,'image');
 assert.equal(files[0].inline_image_url,root+'capture.png');
 assert.equal('inline_image_url' in files[0],true);
 assert.equal(JSON.stringify(files[0]).includes('files.testgifts.local'),false);
 assert.equal(files[0].attachment_id,null);
});
test('deny screenshots from other orders/items, other origins, query or unknown paths',()=>{
 const inputs=[
  'http://evil.local/maketadjusting/11313/8001111/77/capture.png',
  'https://files.testgifts.local/maketadjusting/11313/8001111/77/capture.png',
  root+'capture.png?download=1',root+'capture.png#anchor',
  root.replace('/77/','/78/')+'capture.png',
  root.replace('/8001111/','/8001112/')+'capture.png',
  'http://files.testgifts.local/other/11313/8001111/77/capture.png',
  root+'capture.exe',root+'../secret.png'
 ];
 for(const src of inputs)
  assert.equal(verifiedApprovalGalleryImageUrl(src,scope),null,src);
 assert.deepEqual(verifiedApprovalGalleryImageUrl(root+'capture.JPG',scope),{
  url:root+'capture.JPG',filename:'capture.JPG',extension:'jpg'
 });
});
test('saved HTML declarative-shadow template fallback is read-only',()=>{
 const original=image(root+'offline.png');
 const gal={shadowRoot:null,querySelector:()=>({
  content:{querySelectorAll:()=>[original]}
 })};
 const files=extractApprovalGalleryImages({
  querySelectorAll:()=>[gal]
 },scope);
 assert.equal(files.length,1);
 assert.equal(files[0].filename,'offline.png');
});
