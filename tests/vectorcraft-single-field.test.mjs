import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const patch=fs.readFileSync('tools/patch-vectorcraft-single-field.py','utf8');
const wasmBridge=fs.readFileSync('tools/vectorcraft-bridge.rs','utf8');
const basePatch=fs.readFileSync('tools/patch-vectorcraft-upstream.py','utf8');
const ci=fs.readFileSync('.github/workflows/build-vectorcraft-web.yml','utf8');

test('single-field UI, command and drop blocking only exists in embedded VectorCraft',()=>{
  assert.match(patch,/single_field_mode: false/,'Standalone VectorCraft stays unrestricted');
  assert.match(patch,/app\.single_field_mode = gwb_is_embedded\(\)/);
  for(const command of ['file.new','file.newDialog','file.newFromTemplate','file.open','document.open','document.new','file.close','file.closeAll','app.home','app.quit'])
    assert.ok(patch.includes('"'+command+'"'),command+' must be prevented');
  assert.match(patch,/id\.starts_with\("file\.openRecent"\)/);
  assert.match(patch,/!self\.single_field_mode \{ chrome::doc_tabs/,'Doc tabs and close button hidden');
  assert.match(patch,/if !app\.single_field_mode/,'Home icon hidden');
  assert.match(patch,/Item::Sub\(name,_\)/,'Recent-files submenu omitted');
  assert.match(patch,/!gwb_is_embedded\(\) && !dropped\.is_empty/,'Drag-to-open new document disabled');
  assert.match(patch,/"file\.place"|File › Place/,'Place inside active document remains available');
});

test('trusted artwork only initializes document once, and export verifies one document',()=>{
  assert.match(wasmBridge,/bridge_document_received\.clone\(\)/);
  assert.match(wasmBridge,/if document_received\.get\(\)/);
  assert.match(wasmBridge,/document_received\.set\(true\)/);
  assert.match(wasmBridge,/session\.documents\(\)\.len\(\)!=1/);
  assert.match(basePatch,/bridge_document_received: Rc<Cell<bool>>/);
  assert.match(ci,/patch-vectorcraft-single-field\.py vectorcraft/);
});
