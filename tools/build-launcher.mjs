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

const launcherCss = "#gifts-layout-workbench-host{\nposition:fixed;inset:0;z-index:2147483647;overflow:hidden;background:transparent;\nfont-family:system-ui,-apple-system,\"Segoe UI\",sans-serif;perspective:1800px\n}\n#gifts-layout-workbench-host .gwb-frame{\nposition:absolute;inset:0;width:100%;height:100%;border:0;background:#fff;\nopacity:0;transform:scale(.985);filter:blur(5px) saturate(.9);\ntransition:opacity .42s .18s ease,transform .82s cubic-bezier(.16,.82,.2,1),filter .58s ease;\nwill-change:opacity,transform,filter\n}\n#gifts-layout-workbench-host.gwb-ready .gwb-frame{opacity:1;transform:scale(1);filter:none}\n#gifts-layout-workbench-host .gwb-door-stage{\nposition:absolute;inset:0;z-index:4;pointer-events:none;perspective:1600px;transform-style:preserve-3d\n}\n#gifts-layout-workbench-host .gwb-door{\nposition:absolute;top:-2%;bottom:-2%;width:50.2%;\nbackground:\nlinear-gradient(90deg,rgba(255,255,255,.22),rgba(255,255,255,.72) 18%,rgba(247,250,246,.9) 64%,rgba(238,244,233,.94)),\nrepeating-linear-gradient(90deg,transparent 0 54px,rgba(75,96,77,.035) 55px 56px);\nbackdrop-filter:blur(4px) saturate(.72) brightness(.97);\n-webkit-backdrop-filter:blur(4px) saturate(.72) brightness(.97);\nborder:1px solid rgba(107,128,107,.18);\nbox-shadow:0 0 50px rgba(36,54,36,.18);\ntransition:transform 1.56s cubic-bezier(.16,.82,.13,1),filter 1.2s ease,box-shadow 1.2s ease;\nwill-change:transform\n}\n#gifts-layout-workbench-host .gwb-door::before{\ncontent:\"\";position:absolute;top:0;bottom:0;width:34px;opacity:.85;\nbackground:linear-gradient(90deg,rgba(255,255,255,0),rgba(255,255,255,.92),rgba(130,181,21,.13),rgba(55,70,58,.12))\n}\n#gifts-layout-workbench-host .gwb-door::after{\ncontent:\"\";position:absolute;top:50%;width:16px;height:16px;margin-top:-8px;border-radius:50%;\nbackground:radial-gradient(circle at 35% 30%,#eff5e9 0 20%,#9abc54 22% 45%,#55721a 48% 100%);\nbox-shadow:0 2px 8px rgba(45,64,17,.32),0 0 0 5px rgba(130,181,21,.07)\n}\n#gifts-layout-workbench-host .gwb-door-left{left:-.1%;transform-origin:0 50%;transform:translateX(0) rotateY(0deg)}\n#gifts-layout-workbench-host .gwb-door-right{right:-.1%;transform-origin:100% 50%;transform:translateX(0) rotateY(0deg);background:\nlinear-gradient(270deg,rgba(255,255,255,.22),rgba(255,255,255,.72) 18%,rgba(247,250,246,.9) 64%,rgba(238,244,233,.94)),\nrepeating-linear-gradient(90deg,transparent 0 54px,rgba(75,96,77,.035) 55px 56px)}\n#gifts-layout-workbench-host .gwb-door-left::before{right:-1px}\n#gifts-layout-workbench-host .gwb-door-right::before{left:-1px;transform:scaleX(-1)}\n#gifts-layout-workbench-host .gwb-door-left::after{right:24px}\n#gifts-layout-workbench-host .gwb-door-right::after{left:24px}\n#gifts-layout-workbench-host .gwb-seam{\nposition:absolute;left:50%;top:0;bottom:0;width:2px;z-index:6;transform:translateX(-50%);\nbackground:linear-gradient(180deg,transparent 0,#9bcf32 14%,#dff5ae 50%,#9bcf32 86%,transparent 100%);\nbox-shadow:0 0 8px rgba(130,181,21,.75),0 0 26px rgba(130,181,21,.38);\nanimation:gwbDoorGlow .72s ease-in-out infinite alternate;\ntransition:opacity .32s .34s ease,filter .32s ease\n}\n#gifts-layout-workbench-host .gwb-door-lock{\nposition:absolute;left:50%;top:50%;z-index:7;width:72px;height:72px;margin:-36px 0 0 -36px;\ndisplay:grid;place-items:center;border-radius:24px;\nbackground:linear-gradient(145deg,#94cb2b,#6f9e0d);color:#fff;\nfont:850 35px/1 system-ui,-apple-system,\"Segoe UI\",sans-serif;\nbox-shadow:0 18px 42px rgba(70,103,13,.3),0 0 0 8px rgba(130,181,21,.08);\ntransform:scale(.8);opacity:0;animation:gwbDoorLockIn .5s .08s cubic-bezier(.16,1,.3,1) forwards;\ntransition:opacity .28s ease,transform .44s cubic-bezier(.2,.8,.2,1),filter .28s ease\n}\n#gifts-layout-workbench-host .gwb-door-lock::after{\ncontent:\"\";position:absolute;inset:-11px;border:1px solid rgba(130,181,21,.28);border-radius:29px;\nanimation:gwbDoorRing 1.05s .12s ease-out infinite\n}\n#gifts-layout-workbench-host .gwb-door-caption{\nposition:absolute;left:50%;top:calc(50% + 52px);z-index:7;transform:translateX(-50%);\nwhite-space:nowrap;color:#506159;font-size:11px;font-weight:800;letter-spacing:.13em;text-transform:uppercase;\nopacity:0;animation:gwbDoorCaption .36s .2s ease-out forwards;\ntransition:opacity .22s ease,transform .34s ease\n}\n#gifts-layout-workbench-host.gwb-ready .gwb-door-left{\ntransform:translateX(-103%) rotateY(-16deg);filter:brightness(.88);box-shadow:22px 0 58px rgba(27,42,28,.28)\n}\n#gifts-layout-workbench-host.gwb-ready .gwb-door-right{\ntransform:translateX(103%) rotateY(16deg);filter:brightness(.88);box-shadow:-22px 0 58px rgba(27,42,28,.28)\n}\n#gifts-layout-workbench-host.gwb-ready .gwb-seam{opacity:0;filter:blur(8px);transform:translateX(-50%) scaleY(1.15)}\n#gifts-layout-workbench-host.gwb-ready .gwb-door-lock{opacity:0;transform:scale(1.5) rotate(8deg);filter:blur(8px)}\n#gifts-layout-workbench-host.gwb-ready .gwb-door-caption{opacity:0;transform:translateX(-50%) translateY(10px)}\n#gifts-layout-workbench-host .gwb-door-stage::before{\ncontent:\"\";position:absolute;left:50%;bottom:-10%;width:58vw;height:24vh;z-index:3;transform:translateX(-50%);\nbackground:radial-gradient(ellipse at center,rgba(130,181,21,.18),rgba(130,181,21,.045) 38%,transparent 70%);\nfilter:blur(10px);opacity:.15;transition:opacity .7s .18s ease,transform 1.45s cubic-bezier(.2,.8,.2,1)\n}\n#gifts-layout-workbench-host.gwb-ready .gwb-door-stage::before{opacity:.8;transform:translateX(-50%) scale(1.28)}\n#gifts-layout-workbench-host .gwb-door-left{box-shadow:inset -18px 0 30px rgba(45,63,46,.08),8px 0 28px rgba(35,49,36,.12)}\n#gifts-layout-workbench-host .gwb-door-right{box-shadow:inset 18px 0 30px rgba(45,63,46,.08),-8px 0 28px rgba(35,49,36,.12)}\n#gifts-layout-workbench-host .gwb-close{\nposition:absolute;right:8px;bottom:8px;z-index:8;width:42px;height:42px;border-radius:50%;\nborder:1px solid #839095;background:#435159;color:#fff;font:28px/1 system-ui;cursor:pointer;\nbox-shadow:0 3px 14px #0004;opacity:0;transform:translateY(8px) scale(.9);\ntransition:opacity .22s .72s ease,transform .28s .68s cubic-bezier(.2,.8,.2,1)\n}\n#gifts-layout-workbench-host.gwb-ready .gwb-close{opacity:1;transform:none}\n#gifts-layout-workbench-host.gwb-closing .gwb-door-left,\n#gifts-layout-workbench-host.gwb-closing .gwb-door-right{\ntransform:translateX(0) rotateY(0deg);filter:none;box-shadow:0 0 50px rgba(36,54,36,.18);\ntransition-duration:.72s\n}\n#gifts-layout-workbench-host.gwb-closing .gwb-frame{transform:scale(.985);filter:blur(5px) saturate(.9);opacity:.45;transition-delay:0s}\n#gifts-layout-workbench-host.gwb-closing .gwb-seam{opacity:1;filter:none;transition-delay:.42s}\n#gifts-layout-workbench-host.gwb-closing .gwb-door-lock{opacity:1;transform:scale(.9);filter:none;transition-delay:.42s}\n#gifts-layout-workbench-host.gwb-closing .gwb-door-caption{opacity:1;transform:translateX(-50%);transition-delay:.48s}\n#gifts-layout-workbench-host.gwb-closing .gwb-close{opacity:0;transition-delay:0s}\n@keyframes gwbDoorGlow{from{opacity:.42;box-shadow:0 0 7px rgba(130,181,21,.55),0 0 18px rgba(130,181,21,.24)}to{opacity:1;box-shadow:0 0 10px rgba(130,181,21,.9),0 0 34px rgba(130,181,21,.5)}}\n@keyframes gwbDoorLockIn{from{opacity:0;transform:scale(.46) rotate(-12deg)}to{opacity:1;transform:scale(.84) rotate(0deg)}}\n@keyframes gwbDoorRing{0%{opacity:.6;transform:scale(.8)}100%{opacity:0;transform:scale(1.45)}}\n@keyframes gwbDoorCaption{from{opacity:0;transform:translateX(-50%) translateY(8px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}\n@media(prefers-reduced-motion:reduce){\n#gifts-layout-workbench-host *{animation:none!important;transition-duration:.01ms!important}\n#gifts-layout-workbench-host .gwb-door-lock,#gifts-layout-workbench-host .gwb-door-caption{opacity:1}\n}";

const source = `(() => {
  const ID = "gifts-layout-workbench-host";
  const old = document.getElementById(ID);
  if (old) {
    old.classList.add("gwb-closing");
    setTimeout(() => {
      old.remove();
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
    }, 900);
    return;
  }

  if (location.hostname !== "gifts.ru") {
    alert("Откройте gifts.ru и запустите закладку «Макетная + мокапы» там.");
    return;
  }

  const host = document.createElement("div");
  host.id = ID;

  const style = document.createElement("style");
  style.textContent = ${JSON.stringify(launcherCss)}


  const frame = document.createElement("iframe");
  frame.className = "gwb-frame";
  frame.title = "Макетная + мокапы";

  const doors = document.createElement("div");
  doors.className = "gwb-door-stage";
  doors.innerHTML = '<div class="gwb-door gwb-door-left"></div><div class="gwb-door gwb-door-right"></div><div class="gwb-seam"></div><div class="gwb-door-lock">М</div><div class="gwb-door-caption">Открываем Макетную</div>';

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
    }, 900);
  };
  close.onclick = closeWorkbench;

  host.append(style, frame, doors, close);
  document.documentElement.style.overflow = "hidden";
  document.body.style.overflow = "hidden";
  document.body.appendChild(host);

  const launchedAt = performance.now();
  let revealed = false;
  const reveal = () => {
    if (revealed) return;
    revealed = true;
    const wait = Math.max(0, 420 - (performance.now() - launchedAt));
    setTimeout(() => {
      if (!host.isConnected) return;
      host.classList.add("gwb-ready");
    }, wait);
  };
  frame.addEventListener("load", reveal, {once:true});
  setTimeout(reveal, 420);
  frame.srcdoc = ${JSON.stringify(app)};
})();`;

fs.writeFileSync(new URL("../launcher.js", import.meta.url), source);