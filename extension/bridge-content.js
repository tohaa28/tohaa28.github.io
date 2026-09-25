const ext = globalThis.browser ?? globalThis.chrome;
const PAGE_ORIGIN = "https://tohaa28.github.io";

window.addEventListener("message", event => {
  if (event.source !== window || event.origin !== PAGE_ORIGIN) return;
  const msg = event.data;
  if (!msg || msg.channel !== "gifts-workbench-page" || !msg.id || !msg.request) return;

  ext.runtime.sendMessage({
    channel: "gifts-workbench",
    ...msg.request
  }).then(response => {
    window.postMessage({
      channel: "gifts-workbench-extension",
      id: msg.id,
      response
    }, PAGE_ORIGIN);
  }).catch(error => {
    window.postMessage({
      channel: "gifts-workbench-extension",
      id: msg.id,
      response: { ok: false, error: error?.message || String(error) }
    }, PAGE_ORIGIN);
  });
});

window.postMessage({
  channel: "gifts-workbench-extension-ready",
  version: ext.runtime.getManifest().version
}, PAGE_ORIGIN);
