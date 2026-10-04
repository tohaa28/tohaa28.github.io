import {applyLogoPreflight} from './patch-artwork-preflight.mjs';
applyLogoPreflight();
import fs from "node:fs";

const base = "https://tohaa28.github.io/gifts-layout-workbench-mockups/";
const assetStamp = Date.now().toString(36);
let app = fs.readFileSync(new URL("../editor.html", import.meta.url), "utf8");
let direct = fs.readFileSync(new URL("../direct-mode.js", import.meta.url), "utf8");
const mockup = fs.readFileSync(new URL("../mockup.html", import.meta.url), "utf8");
const htmlAttr = value => value
  .replaceAll("&", "&amp;")
  .replaceAll('"', "&quot;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;");
const parentWord = ["par","ent"].join("");
const fetchPatch = "const nativeFetch = " + parentWord + ".fetch.bind(" + parentWord + ");";
direct = direct.replace("const nativeFetch = window.fetch.bind(window);", fetchPatch);
direct = direct.replaceAll("</scr" + "ipt", "<\\/scr" + "ipt");

app = app
  .replace("<head>", '<head><base href="https://gifts.ru/">')
  .replace(
    'src="https://tohaa28.github.io/gifts-layout-workbench-mockups/mockup.html"',
    'srcdoc="' + htmlAttr(mockup) + '"'
  )
  .replace(
    'const targetOrigin="https://tohaa28.github.io";',
    'const targetOrigin=location.origin;'
  )
  .replaceAll('src="./vendor/', 'src="' + base + 'vendor/')
  .replaceAll('src="./assets/', 'src="' + base + 'assets/')
  .replaceAll('href="./assets/', 'href="' + base + 'assets/')
  .replace('<script src="./direct-mode.js"></script>', "<script>" + direct + "</script>")
  .replace(base + "assets/index-BpU9kvz8.js", base + "assets/index-BpU9kvz8.js?v=" + assetStamp)
  .replace(base + "assets/index-CdEUuUA7.css", base + "assets/index-CdEUuUA7.css?v=" + assetStamp);

const source = `(() => {
  const ID = "gifts-layout-workbench-host";
  const old = document.getElementById(ID);
  if (old) {
    old.classList.add("gwb-closing");
    setTimeout(() => {
      old.remove();
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
    }, 360);
    return;
  }

  if (location.hostname !== "gifts.ru") {
    alert("Откройте gifts.ru и запустите закладку «Макетная + мокапы» там.");
    return;
  }

  const host = document.createElement("div");
  host.id = ID;

  const style = document.createElement("style");
  style.textContent = "#gifts-layout-workbench-host{\nposition:fixed;inset:0;z-index:2147483647;overflow:hidden;\nbackground:rgba(244,248,242,.72);\nbackdrop-filter:blur(0px) saturate(1);\n-webkit-backdrop-filter:blur(0px) saturate(1);\nanimation:gwbBackdropIn .34s ease-out forwards;\nfont-family:system-ui,-apple-system,\"Segoe UI\",sans-serif\n}\n#gifts-layout-workbench-host .gwb-frame{\nposition:absolute;inset:0;width:100%;height:100%;border:0;background:#fff;\nopacity:.08;transform:scale(.975) translateY(18px);\nclip-path:inset(47% 48% 47% 48% round 30px);\nfilter:blur(10px) saturate(.8);\ntransition:clip-path .72s cubic-bezier(.2,.82,.18,1),transform .72s cubic-bezier(.2,.82,.18,1),opacity .46s ease,filter .56s ease;\nwill-change:clip-path,transform,opacity,filter\n}\n#gifts-layout-workbench-host.gwb-ready .gwb-frame{clip-path:inset(0 0 0 0 round 0);transform:scale(1) translateY(0);opacity:1;filter:none}\n#gifts-layout-workbench-host .gwb-splash{position:absolute;inset:0;z-index:4;display:grid;place-items:center;pointer-events:none;color:#36464d;transition:opacity .24s ease,transform .32s ease,filter .24s ease}\n#gifts-layout-workbench-host.gwb-ready .gwb-splash{opacity:0;transform:scale(.94);filter:blur(5px)}\n#gifts-layout-workbench-host .gwb-splash-core{position:relative;display:grid;justify-items:center;gap:10px;transform:translateY(-2vh);animation:gwbCoreIn .48s cubic-bezier(.2,.9,.25,1) both}\n#gifts-layout-workbench-host .gwb-mark-wrap{position:relative;width:78px;height:78px;display:grid;place-items:center}\n#gifts-layout-workbench-host .gwb-mark{width:62px;height:62px;border-radius:19px;display:grid;place-items:center;background:linear-gradient(145deg,#93c92b,#74a50c);color:#fff;font:800 34px/1 system-ui,-apple-system,\"Segoe UI\",sans-serif;box-shadow:0 14px 34px rgba(93,132,19,.28),0 3px 9px rgba(45,64,10,.18);transform:rotate(-5deg);animation:gwbMarkIn .58s cubic-bezier(.16,1,.3,1) both}\n#gifts-layout-workbench-host .gwb-ring{position:absolute;inset:2px;border:1px solid rgba(130,181,21,.32);border-radius:26px;animation:gwbRing .85s cubic-bezier(.2,.8,.2,1) both}\n#gifts-layout-workbench-host .gwb-ring::before,#gifts-layout-workbench-host .gwb-ring::after{content:\"\";position:absolute;background:#82b515;border-radius:50%;box-shadow:0 0 0 5px rgba(130,181,21,.08)}\n#gifts-layout-workbench-host .gwb-ring::before{width:6px;height:6px;left:-3px;top:28px}\n#gifts-layout-workbench-host .gwb-ring::after{width:4px;height:4px;right:7px;bottom:-2px}\n#gifts-layout-workbench-host .gwb-title{font-size:24px;font-weight:800;letter-spacing:-.45px;animation:gwbTextIn .38s .12s ease-out both}\n#gifts-layout-workbench-host .gwb-subtitle{font-size:12px;font-weight:650;letter-spacing:.1em;text-transform:uppercase;color:#77868b;animation:gwbTextIn .38s .18s ease-out both}\n#gifts-layout-workbench-host .gwb-line{width:126px;height:3px;margin-top:2px;border-radius:99px;overflow:hidden;background:rgba(70,88,94,.1);animation:gwbTextIn .3s .2s ease-out both}\n#gifts-layout-workbench-host .gwb-line::after{content:\"\";display:block;width:42%;height:100%;border-radius:inherit;background:#82b515;animation:gwbScan .72s .14s cubic-bezier(.4,0,.2,1) infinite}\n#gifts-layout-workbench-host .gwb-close{position:absolute;right:8px;bottom:8px;z-index:5;width:42px;height:42px;border-radius:50%;border:1px solid #839095;background:#435159;color:#fff;font:28px/1 system-ui;cursor:pointer;box-shadow:0 3px 14px #0004;opacity:0;transform:translateY(8px) scale(.9);transition:opacity .22s .46s ease,transform .28s .42s cubic-bezier(.2,.8,.2,1)}\n#gifts-layout-workbench-host.gwb-ready .gwb-close{opacity:1;transform:none}\n#gifts-layout-workbench-host.gwb-closing{animation:gwbBackdropOut .34s ease-in forwards}\n#gifts-layout-workbench-host.gwb-closing .gwb-frame{opacity:0;transform:scale(.985) translateY(10px);filter:blur(6px)}\n#gifts-layout-workbench-host.gwb-closing .gwb-close{opacity:0;transition-delay:0s}\n@keyframes gwbBackdropIn{from{background:rgba(244,248,242,0);backdrop-filter:blur(0) saturate(1);-webkit-backdrop-filter:blur(0) saturate(1)}to{background:rgba(244,248,242,.72);backdrop-filter:blur(11px) saturate(.82);-webkit-backdrop-filter:blur(11px) saturate(.82)}}\n@keyframes gwbBackdropOut{to{opacity:0;backdrop-filter:blur(0);-webkit-backdrop-filter:blur(0)}}\n@keyframes gwbCoreIn{from{opacity:0;transform:translateY(14px) scale(.96)}to{opacity:1;transform:translateY(-2vh) scale(1)}}\n@keyframes gwbMarkIn{0%{opacity:0;transform:scale(.45) rotate(-18deg)}70%{transform:scale(1.08) rotate(-3deg)}100%{opacity:1;transform:scale(1) rotate(-5deg)}}\n@keyframes gwbRing{from{opacity:0;transform:scale(.55) rotate(-18deg)}to{opacity:1;transform:scale(1) rotate(0)}}\n@keyframes gwbTextIn{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:none}}\n@keyframes gwbScan{0%{transform:translateX(-115%)}65%,100%{transform:translateX(340%)}}\n@media(prefers-reduced-motion:reduce){#gifts-layout-workbench-host,#gifts-layout-workbench-host *{animation:none!important;transition-duration:.01ms!important}}";

  const frame = document.createElement("iframe");
  frame.className = "gwb-frame";
  frame.title = "Макетная + мокапы";

  const splash = document.createElement("div");
  splash.className = "gwb-splash";
  splash.innerHTML = '<div class="gwb-splash-core"><div class="gwb-mark-wrap"><div class="gwb-ring"></div><div class="gwb-mark">М</div></div><div class="gwb-title">Макетная</div><div class="gwb-subtitle">подготовка рабочего пространства</div><div class="gwb-line"></div></div>';

  const close = document.createElement("button");
  close.className = "gwb-close";
  close.type = "button";
  close.textContent = "×";
  close.title = "Закрыть Макетную";

  const closeWorkbench = () => {
    if (host.classList.contains("gwb-closing")) return;
    host.classList.add("gwb-closing");
    setTimeout(() => {
      host.remove();
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
    }, 360);
  };
  close.onclick = closeWorkbench;

  host.append(style, frame, splash, close);
  document.documentElement.style.overflow = "hidden";
  document.body.style.overflow = "hidden";
  document.body.appendChild(host);

  const launchedAt = performance.now();
  let revealed = false;
  const reveal = () => {
    if (revealed) return;
    revealed = true;
    const wait = Math.max(0, 520 - (performance.now() - launchedAt));
    setTimeout(() => {
      if (!host.isConnected) return;
      host.classList.add("gwb-ready");
      setTimeout(() => splash.remove(), 420);
    }, wait);
  };
  frame.addEventListener("load", reveal, {once:true});
  setTimeout(reveal, 1400);
  frame.srcdoc = ${JSON.stringify(app)};
})();`;

fs.writeFileSync(new URL("../launcher.js", import.meta.url), source);