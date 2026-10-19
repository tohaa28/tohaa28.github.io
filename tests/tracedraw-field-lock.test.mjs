import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const patch = readFileSync('tools/patch-tracedraw-upstream.py', 'utf8');
const bridge = readFileSync('tools/tracedraw-embedded.rs', 'utf8');
const traceHost = readFileSync('assets/tracedraw-integration.js', 'utf8');
const vectorHost = readFileSync('assets/vectorcraft-integration.js', 'utf8');
const chooser = readFileSync('assets/logo-editor-choice.js', 'utf8');

test('TraceDraw embedded mode blocks every new or replacement document entrypoint',()=>{
  for(const api of [
    'request_new_document','open_dialog','open_template_dialog',
    'open_path_with_password','close_document','new_document',
    'open_document','close_active_document','close_all_documents',
    'request_exit','new_window'
  ]){
    assert.ok(patch.includes('pub fn '+api+'('),api+' must be guarded');
  }
  assert.match(patch,/gwb_embedded\(\)/);
  assert.match(patch,/fn file_menu/);
  assert.match(patch,/fn window_menu/);
  assert.match(patch,/pub fn document_tabs/);
  assert.match(patch,/Command::AddPage/);
  assert.match(patch,/Command::DeletePage/);
  assert.match(patch,/Command::ResizePage/);
});

test('CMYK document metadata, color docker, and millimeter field are part of native TraceDraw setup',()=>{
  assert.match(patch,/new_document\.values\.rgb = false/);
  assert.match(patch,/new_document\.pages = 1/);
  assert.match(patch,/color_model = 1/);
  assert.match(patch,/Units::Millimeters/);
  assert.match(bridge,/FIELD\.with/);
  assert.match(bridge,/pages\.len\(\)!=1/);
  assert.match(bridge,/f\.width-fw/);
  assert.match(bridge,/f\.height-fh/);
  assert.match(bridge,/logoBoundsMm/);
});

test('Original editor and neighbors remain isolated during a transfer',()=>{
  assert.match(traceHost,/gwbVectorcraftHost/);
  assert.match(vectorHost,/gwbTraceDrawHost/);
  assert.match(traceHost,/gwbApplyEditedLogoToActiveField/);
  assert.match(traceHost,/s\.placement/);
  assert.match(traceHost,/logoBoundsMm/);
  assert.match(chooser,/SVG\/PDF/);
  assert.doesNotMatch(chooser,/SVG\/CDR/);
});
