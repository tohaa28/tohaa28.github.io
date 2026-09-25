import fs from "node:fs";

const base = "https://tohaa28.github.io/gifts-layout-workbench/";
const assetStamp = Date.now().toString(36);
let app = fs.readFileSync(new URL("../editor.html", import.meta.url), "utf8");
let direct = fs.readFileSync(new URL("../direct-mode.js", import.meta.url), "utf8");
const parentWord = ["par","ent"].join("");
const fetchPatch = "const nativeFetch = " + parentWord + ".fetch.bind(" + parentWord + ");";
direct = direct.replace("const nativeFetch = window.fetch.bind(window);", fetchPatch);
direct = direct.replaceAll("</scr" + "ipt", "<\\/scr" + "ipt");

app = app
  .replace("<head>", '<head><base href="https://gifts.ru/">')
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
    old.remove();
    document.documentElement.style.overflow = "";
    document.body.style.overflow = "";
    return;
  }

  if (location.hostname !== "gifts.ru") {
    alert("Откройте gifts.ru и запустите закладку «Макетная» там.");
    return;
  }

  const host = document.createElement("div");
  host.id = ID;
  host.style.cssText = "position:fixed;inset:0;z-index:2147483647;background:#fff";

  const frame = document.createElement("iframe");
  frame.title = "Макетная gifts.ru";
  frame.style.cssText = "position:absolute;inset:0;width:100%;height:100%;border:0;background:#fff";

  const close = document.createElement("button");
  close.type = "button";
  close.textContent = "×";
  close.title = "Закрыть Макетную";
  close.style.cssText = "position:absolute;right:8px;bottom:8px;z-index:2147483647;width:42px;height:42px;border-radius:50%;border:1px solid #839095;background:#435159;color:#fff;font:28px/1 system-ui;cursor:pointer;box-shadow:0 3px 14px #0004";
  close.onclick = () => {
    host.remove();
    document.documentElement.style.overflow = "";
    document.body.style.overflow = "";
  };

  host.append(frame, close);
  document.documentElement.style.overflow = "hidden";
  document.body.style.overflow = "hidden";
  document.body.appendChild(host);

  frame.srcdoc = ${JSON.stringify(app)};
})();`;

fs.writeFileSync(new URL("../launcher.js", import.meta.url), source);