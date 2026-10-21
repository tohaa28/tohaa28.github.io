import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');

test('Header animation has a continuous four-stage flight without a 12-second dead period',()=>{
  const html=read('editor.html');
  const css=html.split('@keyframes gwbOmFly{')[1]?.split('}\n@keyframes')[0]||
    html.split('@keyframes gwbOmFly{')[1]?.split('}\n/*')[0];
  assert.ok(css,'Flight animation stylesheet retained');
  for(const p of ['10%','21%','35%','46%','60%','71%','85%','96%'])
    assert.ok(css.includes(p),'Flight missing keyframe '+p);
  assert.ok(!css.includes('0%,69%'),'Do not hide finished cards for most of the 18-second loop');
  assert.match(html,/id="gwbOrdersMotion"/);
  assert.match(html,/orders-persona-poses\.webp/);
});

test('Real CMYK document working mode set inside VectorCraft embedded field import',()=>{
  const bridge=read('tools/vectorcraft-bridge.rs');
  assert.match(bridge,/fn gwb_apply_field_size/);
  assert.match(bridge,/file\.documentColorMode/);
  assert.match(bridge,/convert":true/);
  assert.doesNotMatch(bridge,/Arc::make_mut\(&mut doc\.doc\)\.color_mode=/,
    'Changing only document mode without converting paints is forbidden');
  assert.match(bridge,/fn gwb_export_editor/);
  assert.match(bridge,/gwb_send_cropped_logo/);
  const job=read('.github/workflows/build-vectorcraft-web.yml');
  assert.match(job,/patch-vectorcraft-upstream\.py/);
});

test('Personal layout library is opt-in, per profile and article, not order registry',()=>{
  const lib=read('assets/personal-layout-library.js');
  const bridge=read('tools/patch-logo-editor-bridge.mjs');
  assert.match(lib,/indexedDB\.open\(DB,VERSION\)/);
  assert.match(lib,/const scope=\(\)=>user\(\)/);
  assert.match(lib,/status:'personal-draft'/);
  assert.match(lib,/orderId:null/);
  assert.match(lib,/gwbRestorePersonalLayout\(serverIdentity\?decodeState\(r\.layout\):r\.data\)/);
  assert.match(lib,/serverBase='\/private\/maketnaya-layouts\/v1'/);
  assert.match(lib,/cloudRequest\('\/me'\)/);
  assert.match(lib,/giftsIdentity\(\)/);
  assert.doesNotMatch(lib,/Имя профиля личной библиотеки/);
  assert.match(lib,/confirm\('Восстановить/);
  assert.match(lib,/gwbCreateReadyLayoutPdf/);
  assert.match(lib,/application\/pdf/);
  assert.match(lib,/Скачать PDF/);
  assert.match(lib,/const host=\$\('orderEditor'\)/);
  assert.doesNotMatch(lib,/Импортировать копию|Копия JSON/);
  assert.doesNotMatch(read('editor.html'),/gwbMotionToggle/);
  assert.match(read('server/personal-layouts/index.mjs'),/\.pdf/);
  assert.doesNotMatch(lib,/api\.github\.com|mockup-profiles\.json|method-settings\.json/);
  assert.match(bridge,/window\.gwbCapturePersonalLayout=function/);
  assert.match(bridge,/window\.gwbRestorePersonalLayout=async function/);
  assert.match(bridge,/y\.template!==template/);
  assert.match(bridge,/y\.placements=prepared/);
  assert.match(bridge,/near\(a\.w,b\.w\)/);
  assert.match(bridge,/Qe\(file,"art"\)/);
  assert.match(read('editor.html'),/personal-layout-library\.js/);
});
