// Stamp reproducible component revisions into the two published UIs.
// Hashing each component's own source avoids misleading unrelated version bumps.
// No network calls, generated timestamps or mutable version counters.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const assets=path.join(root,'assets');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8').replace(/\r\n/g,'\n');
const tag=(html,id,text)=>{
 const re=new RegExp('(<span id="'+id+'"[^>]*>)[^<]*(<\\/span>)');
 if(!re.test(html))throw Error('Missing unique version label: '+id);
 if(html.match(new RegExp('id="'+id+'"','g'))?.length!==1)throw Error('Duplicate version label: '+id);
 return html.replace(re,(_,a,b)=>a+text+b);
};
const normalise=(html,id,placeholder)=>tag(html,id,placeholder);
const digest=(chunks)=>crypto.createHash('sha256').update(chunks.join('\n--COMPONENT--\n')).digest('hex');
const assetContents=re=>fs.readdirSync(assets).filter(x=>re.test(x)).sort().map(x=>x+'\n'+fs.readFileSync(path.join(assets,x),'utf8'));
export function deriveComponentVersions({editor, mockup, editorAssets, mockupAssets, detailAssets, directMode, launcherBuilder, profiles, saveProfile}){
 const cleanEditor=normalise(normalise(editor,'maketnayaVersion','MAKETNAYA_VERSION'),'printcheckVersion','PRINTCHECK_VERSION');
 const cleanMockup=normalise(mockup,'mockupVersion','MOCKUP_VERSION');
 const mk=digest([cleanEditor,directMode,launcherBuilder,...editorAssets]).slice(0,8);
 const mo=digest([cleanMockup,profiles,saveProfile,...mockupAssets]).slice(0,8);
 const source=detailAssets.find(x=>x.startsWith('logo-detail-engine.mjs\n'));
 if(!source)throw Error('PrintCheck engine missing from version fingerprint');
 const id=source.match(/algorithm:\s*['"]([^'"]+)['"]/);
 if(!id)throw Error('PrintCheck algorithm signature missing');
 const m=id[1].match(/-v(\d+)-/);
 if(!m)throw Error('PrintCheck release version missing');
 const pc=digest(detailAssets).slice(0,8);
 return {maketnaya:'Макетная r'+mk,mockup:'Редактор мокапов r'+mo,printcheck:'PrintCheck v'+m[1]+' r'+pc,printcheckAlgorithm:id[1]};
}
export function stampComponentVersions(){
 const editor=read('editor.html'),mockup=read('mockup.html');
 const versions=deriveComponentVersions({
  editor,mockup,directMode:read('direct-mode.js'),
  launcherBuilder:read('tools/build-launcher.mjs'),
  editorAssets:assetContents(/^index-.*\.(?:js|css)$/),
  mockupAssets:assetContents(/^mockup[-.].*\.(?:mjs|js|css)$/),
  detailAssets:assetContents(/^(?:logo-detail-.*|logo-preflight\.mjs|logo-artwork-view\.mjs)$/),
  profiles:read('mockup-profiles.json'),saveProfile:read('save-profile.html')
 });
 const outputEditor=tag(tag(editor,'maketnayaVersion',versions.maketnaya),'printcheckVersion',versions.printcheck);
 const outputMockup=tag(mockup,'mockupVersion',versions.mockup);
 if(outputEditor!==editor)fs.writeFileSync(path.join(root,'editor.html'),outputEditor);
 if(outputMockup!==mockup)fs.writeFileSync(path.join(root,'mockup.html'),outputMockup);
 return versions;
}
