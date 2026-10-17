import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=file=>fs.readFileSync(file,'utf8');

test('VectorCraft gains native egui gifts skin without modifying logo geometry',()=>{
  const p=read('tools/patch-vectorcraft-gifts-theme.py');
  assert.match(p,/pub fn apply_gifts\(ctx: &egui::Context\)/);
  assert.match(p,/Tokens::for_scheme\(Scheme::Modern, Brightness::Light, Accent::Green\)/);
  assert.match(p,/ctx\.set_visuals\(v\)/);
  assert.match(p,/ctx\.global_style_mut/);
  assert.match(p,/bridge_native_style/);
  assert.match(p,/ctx\.set_style\(style\)/);
  assert.match(p,/app\.logic\(ctx\)/,'Native editor remains the source of interactions');
  assert.doesNotMatch(p,/fileio::encode_with_warnings|doc\.art_bounds\(\)/,
    'Theme code must not interfere with VectorCraft document export');
});

test('Embedded mode is the only place where gifts theme is enabled',()=>{
  const p=read('tools/patch-vectorcraft-gifts-theme.py');
  assert.match(p,/if gwb_is_embedded\(\) && self\.host\.bridge_gifts_pending/);
  const rust=read('tools/vectorcraft-bridge.rs');
  assert.match(rust,/gwb-vectorcraft-theme/);
  assert.match(rust,/mode!="gifts"&&mode!="native"/);
  assert.match(rust,/gwb-vectorcraft-theme-applied/);
  assert.match(rust,/event\.origin\(\)/);
  const job=read('.github/workflows/build-vectorcraft-web.yml');
  assert.match(job,/patch-vectorcraft-gifts-theme\.py vectorcraft/);
  assert.match(job,/trunk build --release/);
});

test('Theme toggle is adjacent to simple-editor button, preserves artwork session',()=>{
  const js=read('assets/vectorcraft-integration.js');
  assert.match(js,/footer\.append\(fallback,themeBtn\)/);
  assert.match(js,/gwb-vectorcraft-theme-applied/);
  assert.match(js,/type:'gwb-vectorcraft-theme'/);
  assert.match(js,/changeTheme\(active,!active\.giftsMode\)/);
  assert.match(js,/gwbApplyEditedLogoToActiveField/);
  assert.doesNotMatch(js,/themeBtn\.onclick=.+iframe\.src=/);
});
