import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read = path => fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const js=read('assets/workbench-flow.js'), css=read('assets/workbench-flow.css');
test('Flow script parses and never invokes destructive editor actions',()=>{
  new vm.Script(js);
  assert.doesNotMatch(js,/\b(?:fetch|localStorage|sessionStorage)\s*[.(]/);
  assert.doesNotMatch(js,/\.cloneNode\(|\.files\s*=|gwbRefreshEditorState\s*\(/);
  assert.match(js,/content\.append\(\$\(id\)\)/);
});
test('Both direct and embedded editors receive motion assets',()=>{
  for(const file of ['editor.html','mockup.html']) {
    const html=read(file);
    assert.equal((html.match(/href="\.\/assets\/workbench-flow\.css(?:\?v=[0-9a-f]{8})?"/g)||[]).length,1);
    assert.equal((html.match(/src="\.\/assets\/workbench-flow\.js(?:\?v=[0-9a-f]{8})?"/g)||[]).length,1);
  }
  assert.match(read('tools/build-launcher.mjs'),/replaceAll\('src="\.\/assets\//);
  assert.match(read('tools/stamp-component-versions.mjs'),/workbench-flow/);
});
test('Motion respects accessibility and changes only presentation',()=>{
  assert.match(js,/prefers-reduced-motion: reduce/);
  assert.match(css,/prefers-reduced-motion:reduce/);
  assert.match(js,/animations\.get\(node\)\?\.cancel\(\)/);
  assert.match(js,/aria-current/);
  assert.match(js,/event\.key === 'Escape'/);
  assert.match(js,/node\.hidden !== hidden/);
});
