import {applyLogoPreflight} from './patch-artwork-preflight.mjs';
import {stampComponentVersions} from './stamp-component-versions.mjs';
import {applyLogoEditorBridge} from './patch-logo-editor-bridge.mjs';
import {launcherCss,motionMarkup,MOTION_DURATION_MS} from './launcher-motion.mjs';
applyLogoPreflight();
applyLogoEditorBridge();
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

  const motionStage = document.createElement("div");
  motionStage.className = "gwb-motion-stage";
  motionStage.setAttribute("aria-hidden","true");
  motionStage.innerHTML = ${JSON.stringify(motionMarkup)};

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

  host.append(style, frame, motionStage, close);
  document.documentElement.style.overflow = "hidden";
  document.body.style.overflow = "hidden";
  document.body.appendChild(host);

  const OPEN_MS = ${MOTION_DURATION_MS};
  frame.srcdoc = ${JSON.stringify(app)};

  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (!host.isConnected) return;
    host.classList.add("gwb-opening");
    setTimeout(() => {
      if (!host.isConnected) return;
      host.classList.remove("gwb-opening");
      host.classList.add("gwb-opened");
      motionStage.remove();
    }, OPEN_MS + 80);
  }));
})();`;

fs.writeFileSync(new URL("../launcher.js", import.meta.url), source);