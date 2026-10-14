import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initialMethodCode} from '../assets/method-admin.mjs';

test('method-settings dialog selects the exact code of the current print method',()=>{
  for(const [input,expected] of [
    ['F1: Флекс,1','F1'],
    ['B4: Шелкография на текстиль,3','B4'],
    ['UV-DTF1: УФ-DTF печать','UV-DTF1'],
    ['SHR: Круговая шелкография','SHR'],
    ['[DTF-F] эффекты','DTF-F'],
    ['LM1: лазерная гравировка,1; LM1: лазерная гравировка,2','LM1']
  ]) assert.equal(initialMethodCode(input),expected,input);
});
test('ambiguous, missing and unsupported method labels do not silently select the wrong rule',()=>{
  for(const input of [
    '', 'F1 DTF1', 'F1 UV-DTF1', 'UNLISTED999', 'print1',
    'Шелкография на текстиль', 'Unknown'
  ]) assert.equal(initialMethodCode(input),null,input);
});
