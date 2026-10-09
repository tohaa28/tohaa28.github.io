import {applyLogoPreflight} from './patch-artwork-preflight.mjs';
import {stampComponentVersions} from './stamp-component-versions.mjs';
applyLogoPreflight();
stampComponentVersions();
import fs from "node:fs";

const base = "https://tohaa28.github.io/gifts-layout-workbench-mockups/";
const assetStamp = Date.now().toString(36);
let app = fs.readFileSync(new URL("../editor.html", import.meta.url), "utf8");
let direct = fs.readFileSync(new URL("../direct-mode.js", import.meta.url), "utf8");
const mockup = fs.readFileSync(new URL("../mockup.html", import.meta.url), "utf8");
const embeddedMockup = mockup
  .replaceAll('from "./assets/', 'from "' + base + 'assets/')
  .replaceAll("from './assets/", "from '" + base + "assets/")
  .replaceAll('src="./assets/', 'src="' + base + 'assets/')
  .replaceAll("src='./assets/", "src='" + base + "assets/")
  .replaceAll('href="./assets/', 'href="' + base + 'assets/')
  .replaceAll("href='./assets/", "href='" + base + "assets/");
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
    'srcdoc="' + htmlAttr(embeddedMockup) + '"'
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

const launcherCss = "#gifts-layout-workbench-host{\nposition:fixed;inset:0;z-index:2147483647;overflow:hidden;background:#f4f8f2;\nfont-family:system-ui,-apple-system,\"Segoe UI\",sans-serif;perspective:1800px\n}\n#gifts-layout-workbench-host .gwb-frame{\nposition:absolute;inset:0;width:100%;height:100%;border:0;background:#fff;\nopacity:.88;transform:scale(.975);filter:blur(7px) saturate(.82);\nwill-change:opacity,transform,filter\n}\n#gifts-layout-workbench-host.gwb-opening .gwb-frame{\nanimation:gwbFrameReveal 2000ms cubic-bezier(.16,.82,.2,1) forwards\n}\n#gifts-layout-workbench-host.gwb-opened .gwb-frame{\nopacity:1;transform:scale(1);filter:none\n}\n#gifts-layout-workbench-host .gwb-door-stage{\nposition:absolute;inset:0;z-index:4;pointer-events:none;perspective:1800px;transform-style:preserve-3d\n}\n#gifts-layout-workbench-host .gwb-door-stage::before{\ncontent:\"\";position:absolute;left:50%;bottom:-12%;width:62vw;height:28vh;z-index:3;transform:translateX(-50%) scale(.75);\nbackground:radial-gradient(ellipse at center,rgba(130,181,21,.20),rgba(130,181,21,.055) 38%,transparent 72%);\nfilter:blur(12px);opacity:.08\n}\n#gifts-layout-workbench-host.gwb-opening .gwb-door-stage::before{\nanimation:gwbFloorLight 2000ms ease-out forwards\n}\n#gifts-layout-workbench-host .gwb-door{\nposition:absolute;top:-2%;bottom:-2%;width:50.2%;\nbackdrop-filter:blur(5px) saturate(.74) brightness(.98);\n-webkit-backdrop-filter:blur(5px) saturate(.74) brightness(.98);\nborder:1px solid rgba(90,112,92,.22);\nwill-change:transform,filter,box-shadow;\noverflow:visible\n}\n#gifts-layout-workbench-host .gwb-door-left{\nleft:-.1%;z-index:2;transform-origin:0 50%;transform:translateX(0) rotateY(0deg);\nbackground:\nlinear-gradient(90deg,rgba(255,255,255,.18),rgba(255,255,255,.84) 17%,rgba(246,250,243,.97) 63%,rgba(226,236,219,.99)),\nlinear-gradient(180deg,rgba(130,181,21,.06),transparent 18%,transparent 82%,rgba(67,87,68,.06)),\nrepeating-linear-gradient(90deg,transparent 0 58px,rgba(75,96,77,.035) 59px 60px);\nbox-shadow:inset -22px 0 34px rgba(45,63,46,.09),9px 0 32px rgba(35,49,36,.15)\n}\n#gifts-layout-workbench-host .gwb-door-right{\nright:-.1%;z-index:1;transform-origin:100% 50%;transform:translateX(0) rotateY(0deg);\nbackground:\nlinear-gradient(270deg,rgba(255,255,255,.18),rgba(255,255,255,.84) 17%,rgba(246,250,243,.97) 63%,rgba(226,236,219,.99)),\nlinear-gradient(180deg,rgba(130,181,21,.06),transparent 18%,transparent 82%,rgba(67,87,68,.06)),\nrepeating-linear-gradient(90deg,transparent 0 58px,rgba(75,96,77,.035) 59px 60px);\nbox-shadow:inset 22px 0 34px rgba(45,63,46,.09),-9px 0 32px rgba(35,49,36,.15)\n}\n#gifts-layout-workbench-host .gwb-door::before{\ncontent:\"\";position:absolute;top:5%;bottom:5%;width:calc(100% - 42px);\nborder:1px solid rgba(89,111,91,.17);border-radius:18px;\nbox-shadow:inset 0 0 0 7px rgba(255,255,255,.42),inset 0 0 34px rgba(79,102,81,.06);\nbackground:linear-gradient(180deg,rgba(255,255,255,.27),rgba(255,255,255,0) 25%,rgba(112,145,67,.025) 75%,rgba(88,108,88,.05))\n}\n#gifts-layout-workbench-host .gwb-door-left::before{left:21px}\n#gifts-layout-workbench-host .gwb-door-right::before{right:21px}\n#gifts-layout-workbench-host .gwb-door::after{\ncontent:\"\";position:absolute;top:50%;width:18px;height:18px;margin-top:-9px;border-radius:50%;\nbackground:radial-gradient(circle at 35% 30%,#f4f8ee 0 18%,#9fc35a 20% 46%,#58731c 49% 100%);\nbox-shadow:0 2px 10px rgba(45,64,17,.34),0 0 0 6px rgba(130,181,21,.075)\n}\n#gifts-layout-workbench-host .gwb-door-left::after{right:25px}\n#gifts-layout-workbench-host .gwb-door-right::after{left:25px}\n#gifts-layout-workbench-host.gwb-opening .gwb-door-left{\nanimation:gwbDoorOpenLeft 2000ms cubic-bezier(.16,.82,.13,1) forwards\n}\n#gifts-layout-workbench-host.gwb-opening .gwb-door-right{\nanimation:gwbDoorOpenRight 2000ms cubic-bezier(.16,.82,.13,1) forwards\n}\n#gifts-layout-workbench-host .gwb-door-lock{\nposition:absolute;right:-38px;left:auto;top:50%;z-index:7;width:76px;height:76px;margin:-38px 0 0 0;\ndisplay:grid;place-items:center;border-radius:25px;\nbackground:linear-gradient(145deg,#98d02d,#6b990b);color:#fff;\nfont:850 36px/1 system-ui,-apple-system,\"Segoe UI\",sans-serif;\nbox-shadow:0 20px 48px rgba(70,103,13,.34),0 0 0 9px rgba(130,181,21,.09);\ntransform:scale(.82);opacity:1\n}\n#gifts-layout-workbench-host .gwb-door-lock::after{\ncontent:\"\";position:absolute;inset:-12px;border:1px solid rgba(130,181,21,.32);border-radius:31px;\nanimation:gwbDoorRing 1s ease-out infinite\n}\n#gifts-layout-workbench-host .gwb-door-caption{\nposition:absolute;left:50%;top:calc(50% + 58px);z-index:7;transform:translateX(-50%);\nwhite-space:nowrap;color:#506159;font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;\nopacity:1\n}\n#gifts-layout-workbench-host.gwb-opening .gwb-door-caption{\nanimation:gwbCaptionOpen 2000ms ease-out forwards\n}\n#gifts-layout-workbench-host .gwb-close{\nposition:absolute;right:8px;bottom:8px;z-index:8;width:42px;height:42px;border-radius:50%;\nborder:1px solid #839095;background:#435159;color:#fff;font:28px/1 system-ui;cursor:pointer;\nbox-shadow:0 3px 14px #0004;opacity:0;transform:translateY(8px) scale(.9)\n}\n#gifts-layout-workbench-host.gwb-opened .gwb-close{\nanimation:gwbCloseIn .28s ease-out forwards\n}\n#gifts-layout-workbench-host .gwb-close::after{\ncontent:attr(data-tooltip);position:absolute;top:50%;right:calc(100% + 10px);\ntransform:translate(5px,-50%);padding:7px 10px;border-radius:5px;\nbackground:#33444b;color:#fff;white-space:nowrap;font:600 12px/1.3 system-ui,sans-serif;\nbox-shadow:0 4px 14px #0003;pointer-events:none;\nopacity:0;visibility:hidden;transition:opacity .15s ease,transform .15s ease\n}\n#gifts-layout-workbench-host.gwb-opened .gwb-close:is(:hover,:focus-visible)::after{\nopacity:1;visibility:visible;transform:translate(0,-50%)\n}\n#gifts-layout-workbench-host.gwb-closing .gwb-door-left{animation:gwbDoorCloseLeft 850ms cubic-bezier(.3,.05,.25,1) forwards}\n#gifts-layout-workbench-host.gwb-closing .gwb-door-right{animation:gwbDoorCloseRight 850ms cubic-bezier(.3,.05,.25,1) forwards}\n#gifts-layout-workbench-host.gwb-closing .gwb-frame{animation:gwbFrameClose 850ms ease-in forwards}\n#gifts-layout-workbench-host.gwb-closing .gwb-close{opacity:0}\n@keyframes gwbFrameReveal{\n0%,18%{opacity:.72;transform:scale(.965);filter:blur(9px) saturate(.76)}\n62%{opacity:.94;transform:scale(.992);filter:blur(2px) saturate(.95)}\n100%{opacity:1;transform:scale(1);filter:none}\n}\n@keyframes gwbDoorOpenLeft{\n0%,18%{transform:translateX(0) rotateY(0deg);filter:brightness(1);box-shadow:inset -22px 0 34px rgba(45,63,46,.09),9px 0 32px rgba(35,49,36,.15)}\n42%{transform:translateX(-14%) rotateY(-5deg)}\n78%{transform:translateX(-78%) rotateY(-18deg);filter:brightness(.88)}\n100%{transform:translateX(-106%) rotateY(-24deg);filter:brightness(.8) saturate(.84);box-shadow:42px 0 92px rgba(27,42,28,.36)}\n}\n@keyframes gwbDoorOpenRight{\n0%,18%{transform:translateX(0) rotateY(0deg);filter:brightness(1);box-shadow:inset 22px 0 34px rgba(45,63,46,.09),-9px 0 32px rgba(35,49,36,.15)}\n42%{transform:translateX(14%) rotateY(5deg)}\n78%{transform:translateX(78%) rotateY(18deg);filter:brightness(.88)}\n100%{transform:translateX(106%) rotateY(24deg);filter:brightness(.8) saturate(.84);box-shadow:-42px 0 92px rgba(27,42,28,.36)}\n}\n@keyframes gwbCaptionOpen{\n0%,20%{opacity:1;transform:translateX(-50%) translateY(0)}\n52%{opacity:.85}\n78%{opacity:0;transform:translateX(-50%) translateY(14px)}\n100%{opacity:0;transform:translateX(-50%) translateY(18px)}\n}\n@keyframes gwbFloorLight{\n0%,18%{opacity:.08;transform:translateX(-50%) scale(.75)}\n58%{opacity:.42}\n100%{opacity:.88;transform:translateX(-50%) scale(1.38)}\n}\n@keyframes gwbDoorGlow{\nfrom{opacity:.44;box-shadow:0 0 8px rgba(130,181,21,.62),0 0 22px rgba(130,181,21,.3)}\nto{opacity:1;box-shadow:0 0 13px rgba(130,181,21,1),0 0 42px rgba(130,181,21,.58)}\n}\n@keyframes gwbDoorRing{0%{opacity:.65;transform:scale(.78)}100%{opacity:0;transform:scale(1.48)}}\n@keyframes gwbCloseIn{from{opacity:0;transform:translateY(8px) scale(.9)}to{opacity:1;transform:none}}\n@keyframes gwbDoorCloseLeft{from{transform:translateX(-106%) rotateY(-24deg)}to{transform:translateX(0) rotateY(0deg)}}\n@keyframes gwbDoorCloseRight{from{transform:translateX(106%) rotateY(24deg)}to{transform:translateX(0) rotateY(0deg)}}\n@keyframes gwbFrameClose{from{opacity:1;transform:scale(1);filter:none}to{opacity:.35;transform:scale(.98);filter:blur(7px)}}\n";

const source = `(() => {
  const ID = "gifts-layout-workbench-host";
  const old = document.getElementById(ID);
  if (old) {
    old.classList.remove("gwb-opening");
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
  doors.innerHTML = '<div class="gwb-door gwb-door-left"><div class="gwb-door-lock">М</div></div><div class="gwb-door gwb-door-right"></div><div class="gwb-door-caption">Открываем Макетную</div>';

  const close = document.createElement("button");
  close.className = "gwb-close";
  close.type = "button";
  close.textContent = "×";
  close.setAttribute("aria-label", "Закрыть Макетную");
  close.dataset.tooltip = "Закрыть Макетную";

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

  const OPEN_MS = 2000;
  frame.srcdoc = ${JSON.stringify(app)};

  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (!host.isConnected) return;
    host.classList.add("gwb-opening");
    setTimeout(() => {
      if (!host.isConnected) return;
      host.classList.remove("gwb-opening");
      host.classList.add("gwb-opened");
      doors.remove();
    }, OPEN_MS + 80);
  }));
})();`;

fs.writeFileSync(new URL("../launcher.js", import.meta.url), source);