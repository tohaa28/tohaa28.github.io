import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const js=fs.readFileSync('assets/logo-editor-choice.js','utf8');
const html=fs.readFileSync('editor.html','utf8');

test('animated editor selector parses and is correctly versioned',()=>{
  assert.doesNotThrow(()=>new Function(js));
  assert.match(html,/logo-editor-choice\.js\?v=20261019-approved-characters-3/);
  for(const frame of ['gwbDevilEntrance','gwbAngelEntrance','gwbDevilFloat','gwbAngelFloat']){
    assert.ok(js.includes('@keyframes '+frame),frame+' must be defined');
  }
  assert.match(js,/prefers-reduced-motion:reduce/);
  assert.match(js,/const devilSvg='<img alt="" aria-hidden="true"/);
  assert.match(js,/const angelSvg='<img alt="" aria-hidden="true"/);
  assert.equal((js.match(/data:image\\/png;base64,/g)||[]).length,2,'The two approved transparent PNGs are embedded');
  assert.match(js,/gwb-choice-art img\\{object-fit:contain\\}/);
  assert.match(js,/gwb-choice-role\\{display:none!important\\}/,'Character names are not shown');
});

test('editor selector routes cartoon characters to existing unmodified engines',()=>{
  assert.match(js,/ЧЁРТИК/);
  assert.match(js,/АНГЕЛ/);
  assert.match(js,/Аналог Adobe Illustrator/);
  assert.match(js,/Аналог CorelDRAW/);
  assert.match(js,/gwbVectorcraftHost\?\.open/);
  assert.match(js,/gwbTraceDrawHost\?\.open/);
  assert.match(js,/gwbEditorChooser=\{show,hide,vectorcraft:/);
  assert.match(js,/event\.key==='Escape'/);
});

test('only the redundant VectorCraft return status is hidden',()=>{
  assert.match(js,/new MutationObserver\(suppress\)/);
  assert.match(js,/const obsolete='Из VectorCraft возвращён только нарисованный логотип с его габаритами и положением\.'/);
  assert.match(js,/if\(status\.textContent\.trim\(\)===obsolete\)status\.textContent=''/);
  assert.doesNotMatch(js,/id="printcheck"/);
});
