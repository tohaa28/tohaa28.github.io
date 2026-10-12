import {test} from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const read=p=>fs.readFileSync(new URL(p,import.meta.url),"utf8");
const editor=read("../editor.html"),mockup=read("../mockup.html");
const css=read("../assets/workbench-motion.css"),script=read("../assets/workbench-motion.js");
const mockCss=read("../assets/mockup-motion.css"),mockJs=read("../assets/mockup-motion.js");
test("Both editors load independently reversible motion assets",()=>{
 assert.match(editor,/href="\.\/assets\/workbench-motion\.css"/);
 assert.match(editor,/defer src="\.\/assets\/workbench-motion\.js"/);
 assert.match(mockup,/href="\.\/assets\/mockup-motion\.css"/);
 assert.match(mockup,/defer src="\.\/assets\/mockup-motion\.js"/);
});
test("Motion never modifies drawing canvases or engine geometry",()=>{
 assert.match(script,/changesGeometry:false/);assert.match(mockJs,/changesGeometry:false/);
 assert.doesNotMatch(css,/#stage(?:\{| |,)/);
 assert.doesNotMatch(mockCss,/#(?:templateCanvas|photoCanvas)\s*\{/);
 assert.match(css,/prefers-reduced-motion:reduce/);assert.match(mockCss,/prefers-reduced-motion:reduce/);
 assert.match(css,/#stageScroll\{position:relative;isolation:isolate\}/);
 new vm.Script(script);new vm.Script(mockJs);
});
test("Motion covers order, step, field, tools, checks, mockup and export",()=>{
 for(const id of ["orderEditor","orderBrowser","mockupShell","orderFieldChoiceBox","step4Box","fieldLogoTools","editorStep3","orderTemplates","orderFieldChoice","zoomPage","simpleExport","downloadLayoutMockup","simpleChecks","checks"])
  assert.ok(script.includes('"'+id+'"'),id);
 for(const cls of ["gwbMotionModal","gwbMotionField","gwbMotionCheck","gwbMotionExport"])
  assert.ok(css.includes(cls),cls);
 for(const id of ["photoCandidates","fieldCandidates","mappingOperationStatus","cylinderAxis"])
  assert.ok(mockJs.includes(id),id);
});
