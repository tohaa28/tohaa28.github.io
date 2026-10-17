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
  assert.match(p,/ctx\.set_global_style\(style\)/);
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

test('Embedded egui Apply and immersive controls never replace existing handoff',()=>{
  const patch=read('tools/patch-vectorcraft-gifts-theme.py');
  const js=read('assets/vectorcraft-integration.js');
  const launcher=read('tools/build-launcher.mjs');
  assert.match(patch,/gwb_native_toolbar_apply/);
  assert.match(patch,/Перенести на шаблон артикула/);
  assert.doesNotMatch(patch,/Применить в Макетной/,'Old button caption must disappear');
  assert.match(patch,/egui::vec2\(242\.0, WIDGET_H\)/,'Full Russian caption fits the toolbar');
  assert.match(js,/bar\.append\(heading,field,space,fullscreenBtn,cancel\)/,
    'Maketnaya toolbar has no Apply button');
  assert.doesNotMatch(js,/textContent:'Применить в Макетной'/);
  assert.match(js,/s\.apply\.click\(\)/,'Native button uses existing guarded export');
  assert.match(patch,/ui.put\(raised, button\)/);
  assert.match(patch,/egui::vec2\(0\.0, -3\.0\)/,'Toolbar button raised by 3 px without changing layout slot');
  assert.match(patch,/gwb-vectorcraft-apply-request/);
  assert.match(js,/gwb-vectorcraft-apply-request/);
  assert.match(js,/s\.apply\.click\(\)/,'In-engine Apply must reuse original export validation');
  assert.match(js,/fallback\.hidden=true/);
  assert.match(js,/themeBtn\.hidden=true/);
  assert.match(js,/requestFullscreen\(\)/);
  assert.match(js,/document\.exitFullscreen\(\)/);
  assert.match(js,/reportEditorVisibility\(true\)/);
  assert.match(js,/reportEditorVisibility\(false\)/);
  assert.match(js,/window\.parent\.location\.origin/);
  assert.match(js,/window\.parent\.document\.getElementById/);
  assert.match(js,/gwbReportLogoEditorVisibility=reportEditorVisibility/);
  const legacy=read('assets/logo-editor.js');
  assert.match(legacy,/gwbReportLogoEditorVisibility\?\.\(true\)/);
  assert.match(legacy,/gwbReportLogoEditorVisibility\?\.\(false\)/);
  assert.match(launcher,/event\.source !== frame\.contentWindow/);
  assert.match(launcher,/gwb-maketnaya-vectorcraft-visibility/);
  assert.match(launcher,/close\.style\.display = event\.data\.visible \? "none" : ""/);
  assert.match(launcher,/frame\.setAttribute\("allowfullscreen", ""\)/);
});
