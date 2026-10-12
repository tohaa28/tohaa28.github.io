import {test} from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const source=path=>fs.readFileSync(new URL(path,import.meta.url),"utf8");
const editor=source("../editor.html"),mockup=source("../mockup.html");
const css=source("../assets/workbench-shell.css"),js=source("../assets/workbench-shell.js");
const mockCss=source("../assets/mockup-shell.css"),mockJs=source("../assets/mockup-shell.js");
test("Studio layout replaces legacy visuals after the inline stylesheet",()=>{
 assert.match(editor,/<\/style><link rel="stylesheet" href="\.\/assets\/workbench-shell\.css"><script defer src="\.\/assets\/workbench-shell\.js"><\/script><\/head>/);
 assert.match(mockup,/<\/style>\s*<link rel="stylesheet" href="\.\/assets\/mockup-shell\.css">/);
 for(const sel of [".site-header",".gwb-shell-tabs",".gwb-shell-intro",".basket-order","#fieldLogoTools","#stageScroll","#mockupShell"])
  assert.ok(css.includes(sel),sel);
 for(const sel of [".layout",".sidebar",".candidate.active",".canvasPanel",".workspaceGrid"])
  assert.ok(mockCss.includes(sel),sel);
});
test("Real step tracker and section navigation delegate to existing buttons",()=>{
 assert.match(js,/gwb-shell-tabs/);assert.match(js,/gwb-step-track/);
 for(const control of ["backToOrders","resumeEditor","mockupModeButton","orderFieldChoice","step4Box","orderTemplateList"])
  assert.ok(js.includes(control),control);
 assert.match(js,/changesCanvas:false/);
 assert.match(mockJs,/changesCanvas:false/);
 new vm.Script(js);new vm.Script(mockJs);
});
test("Compact article detail typography and previous single outer frame remain",()=>{
 assert.match(css,/#orderTemplateList \.detail-key,html\.gwb-studio-v2 #orderTemplateList \.detail-value\{font-size:10px;font-weight:400\}/);
 assert.match(css,/#orderEditor \.article-card #orderTemplatePicker\{/);
 assert.match(css,/grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
 assert.match(css,/align-items:stretch/);
 assert.match(css,/@media\(max-width:780px\)/);
 assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
});
test("CSS never transforms any artwork or mockup canvases",()=>{
 for(const x of ["#templateCanvas{transform:","#overlay{transform:","#photoCanvas{transform:","#stage{transform:"])
  assert.ok(!css.includes(x)&&!mockCss.includes(x),x);
 assert.match(mockJs,/gwb-mockup-studio-v2/);
});
