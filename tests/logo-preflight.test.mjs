import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PRINT_REQUIREMENTS,effectiveRule,resolveMethod} from '../assets/print-requirements.mjs';
import {checkLogo,contextFromOrder,pdfColorOperators,rasterColorModel} from '../assets/logo-preflight.mjs';
const art={ext:'png',w:25.4,h:25.4,preflight:{rasters:[{pixelW:300,pixelH:300,w:25.4,h:25.4}],limitations:[]}};
const run=(method,overrides={})=>checkLogo({art,placement:{w:25.4,h:25.4},field:{},method,margin:1,...overrides});
test('exact method tokens never confuse families, print IDs, unknown or ambiguous variants',()=>{
 for(const code of Object.keys(PRINT_REQUIREMENTS))assert.equal(resolveMethod(`${code}: выбранное нанесение`).code,code);
 for(const value of ['UV-DTF1','DTF-F','UVRL','UVR','FS','LRUV'])assert.equal(resolveMethod(`[${value}]`).code,value);
 for(const value of ['print1','DTF9','A1 DTF1','UV-DTF10','B4 UNKNOWN99','Шелкография на текстиль'])assert.equal(resolveMethod(value).rule,null);
 assert.equal(resolveMethod('LM1: Гравировка,1; LM1: Гравировка,2').code,'LM1');
});
test('threshold differences and conditional requirements stay explicit',()=>{
 assert.equal(PRINT_REQUIREMENTS.A1.positive,.1);assert.equal(PRINT_REQUIREMENTS.DTF1.positive,.6);
 assert.equal(PRINT_REQUIREMENTS['DTF-F'].positive,1.2);assert.equal(PRINT_REQUIREMENTS.F3.positive,3);
 assert.equal(effectiveRule(PRINT_REQUIREMENTS.B4,{underbase:true}).positive,.4);
 assert.equal(effectiveRule(PRINT_REQUIREMENTS.B4,{foilOrPuff:true}).negative,.6);
 assert.equal(effectiveRule(PRINT_REQUIREMENTS.UV1,{softTouch:true}).positive,.5);
 assert.ok(effectiveRule(PRINT_REQUIREMENTS.B4).unresolvedConditions.length);
 assert.equal(contextFromOrder('купол [подложка; черный]').underbase,true);
 assert.equal(contextFromOrder('без подложки').underbase,false);
 assert.equal(PRINT_REQUIREMENTS.LM1.guard,undefined);assert.equal(PRINT_REQUIREMENTS.LSM.guard,2);
 assert.equal(PRINT_REQUIREMENTS.RP1.guardShort,20);
});
test('effective DPI recalculates at final dimensions including scaled templates',()=>{
 assert.equal(run('UV1').findings.find(f=>f.id==='raster-dpi').status,'ok');
 assert.equal(run('UV1',{placement:{w:50.8,h:25.4}}).findings.find(f=>f.id==='raster-dpi').actual,150);
 assert.equal(run('UV1',{field:{templateScale:10}}).findings.find(f=>f.id==='raster-dpi').actual,30);
 assert.equal(run('AR1',{placement:{w:40,h:40}}).findings.find(f=>f.id==='raster-dpi').status,'ok');
 assert.equal(run('UV1',{minDpi:72,field:{templateScale:2}}).findings.find(f=>f.id==='raster-dpi').status,'bad');
});
test('unknown method is unresolved; product margins are never confused with print fields',()=>{
 assert.equal(run('UNKNOWN').status,'manual');
 const report=run('T1');assert.equal(report.findings.find(f=>f.id==='guard').status,'manual');
 assert.equal(report.productionApproved,false);
 assert.equal(run('T1',{margin:-2,placement:{w:25.4,h:25.4,clipToField:true}}).findings.find(f=>f.id==='field-boundary').status,'bad');
});
test('method and placement size change measured feature findings',()=>{
 const vector={ext:'svg',w:10,h:10,preflight:{strokes:[{width:.2}],rasters:[],limitations:[]}};
 const args={art:vector,placement:{w:10,h:10}};
 assert.equal(run('A1',args).findings.some(f=>f.id==='positive'&&f.status==='bad'),false);
 assert.equal(run('DTF1',args).findings.some(f=>f.id==='positive'&&f.status==='bad'),true);
 assert.equal(run('DTF1',{...args,placement:{w:40,h:40}}).findings.some(f=>f.id==='positive'&&f.status==='bad'),false);
});
test('unsupported analysis cannot yield a production approval',()=>{
 const r=run('LM1',{art:{ext:'pdf',w:10,h:10}});assert.equal(r.status,'manual');assert.ok(r.findings.some(f=>f.id==='analysis'));
 const r2=run('LM1',{art:{ext:'pdf',w:10,h:10,preflight:{text:true,transparency:true,limitations:[]}}});
 assert.equal(r2.status,'bad');assert.ok(r2.findings.some(f=>f.id==='outlined-text'));assert.ok(r2.findings.some(f=>f.id==='effects'));
});
test('original PDF color evidence ignores comments, text strings and inline images',()=>{
 const colors=pdfColorOperators('% 1 0 0 rg\n(0 1 0 rg (nested)) Tj\n1 0 0 0 k\n0 0 1 rg\nBI /W 1 /H 1 ID 1 0 0 rg EI\n');
 assert.deepEqual(colors,[{model:'CMYK',values:[1,0,0,0]},{model:'RGB',values:[0,0,1]}]);
 const r=run('SL1',{art:{...art,preflight:{originalColors:[{model:'CMYK',values:[1,1,1,1]}],originalColorModels:['CMYK'],limitations:[]}}});
 assert.ok(r.findings.some(f=>f.id==='ink-limit'&&f.status==='bad'));
});
test('all 92 source codes match the archived formal map',()=>{
 const map=JSON.parse(fs.readFileSync(new URL('../docs/print-requirements.json',import.meta.url),'utf8'));
 assert.equal(map.sourceCodes.length,92);assert.deepEqual(Object.keys(PRINT_REQUIREMENTS).sort(),map.sourceCodes);
 assert.deepEqual(JSON.parse(JSON.stringify(PRINT_REQUIREMENTS)),map.rules);
});
test('CMYK JPEG is not misclassified from its RGB browser preview',()=>{
 const jpeg=Uint8Array.from([255,216,255,192,0,12,8,0,10,0,10,4,0,0]);
 assert.equal(rasterColorModel(jpeg,'jpg'),'CMYK');
 const png=new Uint8Array(26);png[25]=6;assert.equal(rasterColorModel(png,'png'),'RGB');
 png[25]=0;assert.equal(rasterColorModel(png,'png'),'Gray');
});

test('exact contour crossing sentinel is an error, including clipped placement',()=>{
 for(const clipToField of [false,true])assert.equal(run('LM1',{margin:-.001,field:{pathPoints:[[0,0],[10,0],[10,10]]},placement:{w:10,h:10,clipToField}}).findings.find(f=>f.id==='field-boundary').status,'bad');
 assert.equal(run('LM1',{margin:0}).findings.find(f=>f.id==='field-boundary').status,'ok');
});
