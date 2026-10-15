import {test} from 'node:test';import assert from 'node:assert/strict';
import {PRINT_REQUIREMENTS,configureRule,validateSettings,checkEnabled,detailRule,getSettings,saveSettings} from '../assets/method-settings.mjs';
const cfg=methods=>validateSettings({version:1,methods});
test('All method guard defaults are zero without changing official requirements',()=>{for(const r of Object.values(PRINT_REQUIREMENTS)){const c=configureRule(r,cfg({}));assert.equal(c.guard,0);assert.equal(c.guardLong,0);assert.equal(c.guardShort,0);}assert.equal(PRINT_REQUIREMENTS.T1.guard,18);});
test('Overrides and disabled checks are isolated by method',()=>{const settings=cfg({F1:{values:{guard:2,positive:.15},checks:{colors:false,negative:false}}});const r=configureRule(PRINT_REQUIREMENTS.F1,settings);assert.equal(r.guard,2);assert.equal(r.positive,.15);assert.equal(checkEnabled(r,'colors'),false);assert.equal(checkEnabled(r,'positive'),true);assert.equal(detailRule(r).negative,0);assert.equal(configureRule(PRINT_REQUIREMENTS.D1,settings).guard,0);});
test('Disabled method keeps identity but removes production checks',()=>{const r=configureRule(PRINT_REQUIREMENTS.T1,cfg({T1:{enabled:false}}));assert.equal(checkEnabled(r,'method'),true);for(const id of ['field-boundary','guard','outlined-text','effects','monochrome','positive'])assert.equal(checkEnabled(r,id),false);assert.equal(detailRule(r).positive,0);});
test('Reject invalid imports instead of partially applying them',()=>{for(const methods of [{BAD:{}},{F1:{values:{guard:-1}}},{F1:{values:{guard:Infinity}}},{F1:{values:{maxColors:1.5}}},{F1:{checks:{colors:'false'}}},{F1:{values:JSON.parse('{"__proto__":1}')}}])assert.throws(()=>cfg(methods));assert.throws(()=>validateSettings({version:2,methods:{}}));});
test('Legacy localStorage cannot silently replace shared server rules',async()=>{const before=getSettings();globalThis.localStorage={getItem(){return JSON.stringify(cfg({F1:{enabled:false}}))},setItem(){throw Error('Not allowed')}};assert.deepEqual(getSettings(),before);await assert.rejects(saveSettings(cfg({F1:{enabled:false}})),/сервер|token/);assert.deepEqual(getSettings(),before);delete globalThis.localStorage;});

test('Original-format requirement is configurable per method without changing other methods',()=>{
 const x=cfg({F1:{artworkPolicy:'vector-only'},UV1:{artworkPolicy:'any'}});
 assert.equal(configureRule(PRINT_REQUIREMENTS.F1,x).artworkPolicy,'vector-only');
 assert.equal(configureRule(PRINT_REQUIREMENTS.UV1,x).artworkPolicy,'any');
 assert.equal(configureRule(PRINT_REQUIREMENTS.F2,x).artworkPolicy,'auto-order-colors');
 assert.equal(checkEnabled(configureRule(PRINT_REQUIREMENTS.F1,x),'artwork-type'),true);
 const disabled=configureRule(PRINT_REQUIREMENTS.F1,cfg({F1:{artworkPolicy:'vector-only',checks:{artwork:false}}}));
 assert.equal(disabled.artworkPolicy,'vector-only');
 assert.equal(checkEnabled(disabled,'artwork-type'),false);
 const serialized=JSON.stringify(x);
 assert.equal(validateSettings(JSON.parse(serialized)).methods.F1.artworkPolicy,'vector-only');
 for(const invalid of ['raster-only','vector','',true,0,null])assert.throws(()=>cfg({F1:{artworkPolicy:invalid}}));
});

test('Order color count comparison is opt-in and isolated per print method',()=>{
 const settings=cfg({F1:{orderColorPolicy:'match'},D1:{orderColorPolicy:'off'}});
 assert.equal(configureRule(PRINT_REQUIREMENTS.F1,settings).orderColorPolicy,'match');
 assert.equal(configureRule(PRINT_REQUIREMENTS.D1,settings).orderColorPolicy,'off');
 assert.equal(configureRule(PRINT_REQUIREMENTS.F2,settings).orderColorPolicy,'off');
 assert.equal(checkEnabled(configureRule(PRINT_REQUIREMENTS.F1,settings),'order-colors'),true);
 assert.equal(checkEnabled(configureRule(PRINT_REQUIREMENTS.F1,cfg({F1:{orderColorPolicy:'match',checks:{orderColors:false}}})),'order-colors'),false);
 assert.equal(checkEnabled(configureRule(PRINT_REQUIREMENTS.F1,cfg({F1:{orderColorPolicy:'match',enabled:false}})),'order-colors'),false);
 assert.equal(validateSettings(JSON.parse(JSON.stringify(settings))).methods.F1.orderColorPolicy,'match');
 for(const policy of ['auto','max',true,null,2])assert.throws(()=>cfg({F1:{orderColorPolicy:policy}}));
});

test('automatic logo-format policy follows listed inks unless manually overridden',()=>{
 const base=configureRule(PRINT_REQUIREMENTS.F1,cfg({}));
 assert.equal(base.artworkPolicy,'auto-order-colors');
 assert.equal(configureRule(PRINT_REQUIREMENTS.F1,cfg({F1:{artworkPolicy:'auto-order-colors'}})).artworkPolicy,'auto-order-colors');
 assert.equal(configureRule(PRINT_REQUIREMENTS.F1,cfg({F1:{artworkPolicy:'any'}})).artworkPolicy,'any');
 assert.equal(configureRule(PRINT_REQUIREMENTS.F1,cfg({F1:{artworkPolicy:'vector-only'}})).artworkPolicy,'vector-only');
 assert.equal(checkEnabled(base,'artwork-type'),true);
 assert.throws(()=>cfg({F1:{artworkPolicy:'invented'}}));
});
