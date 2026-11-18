(() => {
  // vision/orders/approval-inline-images.mjs
  var imagePath = /^\/maketadjusting\/([0-9]{1,20})\/([0-9]{5,12})\/([0-9]{1,20})\/([^/?#]+)\.(png|jpe?g|webp|gif)$/i;
  var safeOriginal = /^[^\\/:*?"<>|\x00-\x1f\x7f]{1,180}$/;
  function verifiedApprovalGalleryImageUrl(raw, { orderNumber, itemId } = {}) {
    if (typeof raw !== "string" || raw.length > 1800 || !/^[0-9]{5,12}$/.test(String(orderNumber)) || !/^[0-9]{1,20}$/.test(String(itemId))) return null;
    try {
      const u = new URL(raw);
      if (u.origin !== "http://files.testgifts.local" || u.search || u.hash || u.username || u.password || u.port) return null;
      const m = imagePath.exec(u.pathname);
      if (!m || m[2] !== String(orderNumber) || m[3] !== String(itemId)) return null;
      const filename = decodeURIComponent(m[4]) + "." + m[5];
      if (!safeOriginal.test(filename) || /[. ]$/.test(filename)) return null;
      return { url: u.href, filename, extension: m[5].toLowerCase() };
    } catch {
      return null;
    }
  }
  function galleryOriginals(gallery) {
    const root = gallery.shadowRoot || gallery.querySelector?.('template[shadowrootmode="open"]')?.content;
    return root ? [...root.querySelectorAll("section picture img")] : [...gallery.querySelectorAll(":scope > img")];
  }
  function extractApprovalGalleryImages(messageMain, scope) {
    if (!messageMain?.querySelectorAll) return [];
    const found = [], seen = /* @__PURE__ */ new Set();
    for (const gallery of messageMain.querySelectorAll("g-gallery")) {
      for (const image of galleryOriginals(gallery)) {
        const raw = image.getAttribute("data-hd") || image.getAttribute("src") || image.getAttribute("data-src") || "";
        const candidate = verifiedApprovalGalleryImageUrl(raw, scope);
        if (!candidate || seen.has(candidate.url)) continue;
        seen.add(candidate.url);
        const record = {
          source: "native_approval_gallery",
          attachment_id: null,
          filename: candidate.filename,
          kind: "image",
          downloaded: false
        };
        Object.defineProperty(record, "inline_image_url", {
          value: candidate.url,
          enumerable: false,
          writable: false
        });
        found.push(record);
        if (found.length >= 40) return found;
      }
    }
    return found;
  }

  // vision/orders/maket-approval-probe.mjs
  var MAX = 1e4;
  var count = (n) => Math.min(MAX, Math.max(0, n));
  var nodes = (root, selector) => {
    try {
      return [...root?.querySelectorAll?.(selector) || []];
    } catch {
      return [];
    }
  };
  var text = (node) => String(node?.textContent || "").trim().slice(0, 4096);
  var attr = (node, key) => String(node?.getAttribute?.(key) || "");
  var CATEGORIES = {
    positive_min: /(?:толщин(?:а|ы)\s+лини|позитивн|тонки[ех]|мелк(?:ий|ие|их))/i,
    negative_min: /(?:пробельн|выворотк|зазор(?:ы|ов)?|просвет)/i,
    text_height: /(?:высот[аы]\s+букв)/i,
    color: /(?:\bCMYK\b|\bRGB\b|\bPantone\b|цветов(?:ой|ая|ые))/i,
    raster_resolution: /(?:разрешени[ея]|dpi|растров(?:ого|ое))/i,
    effects: /(?:градиент|прозрачност|эффект)/i,
    field_boundary: /(?:поле\s+нанесени|площад[ьи]|вылет)/i,
    constructor: /(?:конструктор|шаблон|масштаб|оси\s+конструктора)/i,
    fonts: /(?:текст\s+не\s+преобразов|шрифт)/i,
    wrong_artwork: /(?:макет\s+не\s+тот|не\s+тот\s+файл|файл\s+не\s+тот|неверн(?:ый|ое)\s+(?:макет|файл))/i,
    complex_work: /(?:сложност|час(?:а|ов)?\s+на\s+(?:дизайн|гравир))/i,
    revision: /(?:доработан|исправлен|нов(?:ый|ую)\s+макет)/i
  };
  function summary() {
    return {
      schema: "printcheck.vision.maket-adjusting-structure.v1",
      status: "MODAL_NOT_LOADED",
      trigger_count: 0,
      article_scoped_trigger_count: 0,
      modal_loaded: false,
      modal_currently_visible: false,
      problems_available_count: 0,
      problems_checked_current_count: 0,
      checked_problem_topic_hints: [],
      weak_message_topic_hints: [],
      unselected_problem_options_are_not_defects: true,
      human_comment_count: 0,
      history_entry_count: 0,
      history_system_entry_count: 0,
      problem_add_events: 0,
      problem_remove_events: 0,
      status_change_events: 0,
      other_system_events: 0,
      attachments_total: 0,
      attachments_pdf: 0,
      attachments_psd: 0,
      attachments_image_candidates: 0,
      attachments_other: 0,
      badge_comment_count: null,
      badge_matches_human_messages: null,
      attachment_content_downloaded: false,
      current_defects_expert_verified: false,
      history_version_alignment_verified: false,
      training_ready: false,
      order_numbers_included: false,
      item_ids_included: false,
      author_names_included: false,
      message_text_included: false,
      attachment_names_or_urls_included: false,
      timestamps_included: false
    };
  }
  function inRealModal(form) {
    const modal = form?.closest?.("g-modal");
    if (!modal || !modal.querySelector?.("#j_maketadjusting_comments_list"))
      return null;
    return modal;
  }
  function isVisible(modal) {
    return modal?.hasAttribute?.("visible") === true;
  }
  function categorize(textValue, found) {
    for (const [key, re] of Object.entries(CATEGORIES))
      if (re.test(textValue)) found.add(key);
  }
  function typeFromAttachment(anchor) {
    const label = text(anchor);
    const ext = /\.([a-z0-9]{2,5})$/i.exec(label)?.[1]?.toLowerCase() || "";
    if (ext === "pdf") return "pdf";
    if (["psd", "psb"].includes(ext)) return "psd";
    if (["png", "jpg", "jpeg", "webp", "gif", "bmp", "tif", "tiff"].includes(ext)) return "image";
    return "other";
  }
  function isAuditEvent(content, wrap) {
    if (/^Добавлены проблемы\s*:/i.test(content)) return "problem_add";
    if (/^Удалены проблемы\s*:/i.test(content)) return "problem_remove";
    if (/^(?:Вкл|Выкл)\s*\[/i.test(content)) return "state";
    if (/(?:font-size\s*:\s*10px|background-color\s*:\s*#fbffff|background-color\s*:\s*#ffffcc)/i.test(attr(wrap, "style")) || wrap?.querySelector?.(".flex-main.opacity-half"))
      return "other_system";
    return "human";
  }
  function getCounter(modal) {
    const span = modal.querySelector?.("#j_maketadjustingcomments_counter");
    const match = /^\s*(\d{1,5})\s*$/.exec(text(span));
    return match ? Math.min(MAX, Number(match[1])) : null;
  }
  function inspectOpenMaketApprovalDom(doc) {
    const result = summary();
    if (!doc?.querySelectorAll) return { ...result, status: "DOCUMENT_UNAVAILABLE" };
    const triggers = nodes(doc, "a.j_maketadjusting");
    result.trigger_count = count(triggers.length);
    result.article_scoped_trigger_count = count(triggers.filter((el) => Boolean(el.closest?.("li[data-itemid]"))).length);
    const forms = nodes(doc, "#j_maketAdjustingForm");
    const verified = forms.map(inRealModal).filter(Boolean);
    const visible = verified.filter(isVisible);
    const candidates = visible.length ? visible : verified;
    if (candidates.length !== 1)
      return { ...result, status: candidates.length > 1 ? "AMBIGUOUS_APPROVAL_MODAL" : "MODAL_NOT_LOADED" };
    const modal = candidates[0], form = forms.find((x) => x.closest?.("g-modal") === modal);
    result.modal_loaded = true;
    result.modal_currently_visible = isVisible(modal);
    result.status = result.modal_currently_visible ? "VISIBLE_MODAL_STRUCTURE_ONLY" : "PRELOADED_MODAL_STRUCTURE_ONLY";
    const checks = nodes(form, 'input[name="ma_problem[]"][type="checkbox"]');
    const checked = checks.filter((el) => el.checked === true || el.hasAttribute?.("checked"));
    result.problems_available_count = count(checks.length);
    result.problems_checked_current_count = count(checked.length);
    const topics = /* @__PURE__ */ new Set();
    for (const el of checked) {
      const label = el.closest?.("label") || el.parentElement;
      categorize(text(label), topics);
    }
    result.checked_problem_topic_hints = [...topics].sort();
    const list = modal.querySelector?.("#j_maketadjusting_comments_list");
    const entries = nodes(list, ":scope > li");
    result.history_entry_count = count(entries.length);
    let humans = 0;
    const weakMessages = /* @__PURE__ */ new Set();
    for (const el of entries) {
      const wrapper = el.querySelector?.(".comment_wrap");
      const main = wrapper?.querySelector?.(":scope > .flex-main");
      const content = text(main);
      const kind = isAuditEvent(content, wrapper);
      if (kind === "problem_add") result.problem_add_events++;
      else if (kind === "problem_remove") result.problem_remove_events++;
      else if (kind === "state") result.status_change_events++;
      else if (kind === "other_system") result.other_system_events++;
      else {
        humans++;
        categorize(content, weakMessages);
      }
      const orderNumber = String(doc?.location?.pathname || "").match(
        /^\/private\/order\/(\d{5,12})\/?$/
      )?.[1];
      const itemId = String(form?.querySelector('input[name="oiid"]')?.value || "");
      const gallery = extractApprovalGalleryImages(main, { orderNumber, itemId });
      result.attachments_total += gallery.length;
      result.attachments_image_candidates += gallery.length;
      for (const anchor of nodes(main, "a.j_maketadjusting_attachment")) {
        result.attachments_total++;
        const type = typeFromAttachment(anchor);
        if (type === "pdf") result.attachments_pdf++;
        if (type === "psd") result.attachments_psd++;
        if (type === "image") result.attachments_image_candidates++;
        if (type === "other") result.attachments_other++;
      }
    }
    result.human_comment_count = count(humans);
    result.weak_message_topic_hints = [...weakMessages].sort();
    result.history_system_entry_count = count(entries.length - humans);
    result.badge_comment_count = getCounter(modal);
    result.badge_matches_human_messages = result.badge_comment_count === null ? null : result.badge_comment_count === result.human_comment_count;
    for (const field of [
      "problem_add_events",
      "problem_remove_events",
      "status_change_events",
      "other_system_events",
      "attachments_total",
      "attachments_pdf",
      "attachments_psd",
      "attachments_image_candidates",
      "attachments_other"
    ]) result[field] = count(result[field]);
    return result;
  }

  // vision/geometry/svg-viewport.mjs
  var mmMultipliers = Object.freeze({ mm: 1, cm: 10, in: 25.4, pt: 25.4 / 72 });

  // vision/ai/synthetic-feature-model.mjs
  var MODEL_INFO = Object.freeze({
    schema: "printcheck.vision.synthetic-feature-mlp.v1",
    source: "synthetic_width_classes_only",
    seed: 20261117,
    syntheticHoldoutN: 3e3,
    syntheticAccuracy: 0.99733,
    syntheticPrecision075: 0.99921,
    syntheticRecall075: 0.99219,
    realWorldAccuracyVerified: false,
    productionApproved: false
  });

  // vision/orders/discussion-probe.mjs
  var TOPICS = Object.freeze({
    positive_min: /(?:тонк(?:ая|ие|их|ий)|толщин[ауы]|мелки[ех]|перемычк[аие]|линия\s+тонк)/i,
    negative_min: /(?:пробел[ауы]?|выворотк|зазор[ауы]?|просвет[ауы]?)/i,
    out_of_field: /(?:вне\s+(?:поля|зоны)|за\s+(?:пределы|границ)|выходит\s+за|охранн(?:ое|ая)\s+поле)/i,
    color: /(?:\brgb\b|\bcmyk\b|\bpantone\b|цветоделени|цветов(?:ое|ые)|цвет\s+не)/i,
    font: /(?:шрифт[ауы]?|в\s+кривы[ех]|текст\s+не\s+перев)/i,
    raster_resolution: /(?:разрешени[ея]|dpi|пикселизац|растров(?:ый|ое)|пиксел[ья])/i,
    gradient_transparency: /(?:градиент[ауы]?|прозрачност[ьи]|эффект[ауы]?|тень\b)/i,
    constructor_alignment: /(?:конструктор[ауы]?|шаблон[ауы]?|масштаб[ауы]?|смещени[ея]|совмещени[ея])/i
  });

  // vision/orders/order-page-discovery.mjs
  var TEST_HOSTS = Object.freeze(["psk.testgifts.local", "testgifts.local"]);

  // vision/orders/row-scanner.mjs
  var LOCAL_ORDERS = Object.freeze({
    host: "psk.testgifts.local",
    route: "/devorders",
    // No row or file-count quota: read and inspect sequentially on user action.
    // The per-file size and network timeout guards remain mandatory.
    maxFileBytes: 16e6,
    timeoutMs: 15e3,
    fetchPaceMs: 30
  });

  // vision/orders/local-training-zip.mjs
  var te = new TextEncoder();
  var size16 = (dv, off, value) => dv.setUint16(off, value, true);
  var size32 = (dv, off, value) => dv.setUint32(off, value >>> 0, true);
  var formats = /* @__PURE__ */ new Set(["svg", "pdf", "png", "jpg", "jpeg", "webp", "cdr", "eps", "ai"]);
  function exactLocalFilename(value) {
    if (typeof value !== "string" || !value || value.length > 200 || /[\u0000-\u001f\u007f\/\\:*?"<>|]/.test(value) || /[. ]$/.test(value) || value === "." || value === ".." || /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i.test(value) || te.encode(value).length > 255) return null;
    const m = /\.([a-z0-9]+)$/i.exec(value);
    return m && formats.has(m[1].toLowerCase()) ? value : null;
  }
  function safeEntryName(name) {
    if (name === "manifest.json") return true;
    if (/^attachments\/[0-9]{4}\/[0-9]{4}\.(?:pdf|psd|psb|png|jpg|jpeg|webp|tif|tiff|gif|svg|eps|ai|cdr|zip)$/.test(name)) return true;
    if (/^samples\/[0-9]{4}\.(?:svg|pdf|png|jpg|jpeg|webp|cdr|eps|ai|bin)$/.test(name)) return true;
    const m = /^samples\/[0-9]{4}\/([^/]+)$/.exec(name);
    return !!m && exactLocalFilename(m[1]) === m[1];
  }
  function crc32(bytes) {
    let n = 4294967295;
    for (const b of bytes) {
      n ^= b;
      for (let i = 0; i < 8; i++)
        n = n >>> 1 ^ (n & 1 ? 3988292384 : 0);
    }
    return (n ^ 4294967295) >>> 0;
  }
  function makeLocalStoredZip(entries) {
    if (!Array.isArray(entries) || !entries.length || entries.length > 40)
      throw new RangeError("LOCAL_ZIP_ENTRIES_INVALID");
    const data = [], central = [], used = /* @__PURE__ */ new Set();
    let offset = 0, centralSize = 0;
    for (const { name, bytes } of entries) {
      if (typeof name !== "string" || te.encode(name).length > 300 || !safeEntryName(name) || used.has(name) || !(bytes instanceof Uint8Array) || bytes.length > 16e6)
        throw new RangeError("LOCAL_ZIP_ENTRY_INVALID");
      used.add(name);
      const nameBytes = te.encode(name), crc = crc32(bytes);
      const local = new Uint8Array(30 + nameBytes.length), v = new DataView(local.buffer);
      size32(v, 0, 67324752);
      size16(v, 4, 20);
      size16(v, 6, 2048);
      size16(v, 8, 0);
      size16(v, 10, 0);
      size16(v, 12, 33);
      size32(v, 14, crc);
      size32(v, 18, bytes.length);
      size32(v, 22, bytes.length);
      size16(v, 26, nameBytes.length);
      size16(v, 28, 0);
      local.set(nameBytes, 30);
      data.push(local, bytes);
      const cd = new Uint8Array(46 + nameBytes.length), d = new DataView(cd.buffer);
      size32(d, 0, 33639248);
      size16(d, 4, 20);
      size16(d, 6, 20);
      size16(d, 8, 2048);
      size16(d, 10, 0);
      size16(d, 12, 0);
      size16(d, 14, 33);
      size32(d, 16, crc);
      size32(d, 20, bytes.length);
      size32(d, 24, bytes.length);
      size16(d, 28, nameBytes.length);
      size16(d, 30, 0);
      size16(d, 32, 0);
      size16(d, 34, 0);
      size16(d, 36, 0);
      size32(d, 38, 0);
      size32(d, 42, offset);
      cd.set(nameBytes, 46);
      central.push(cd);
      centralSize += cd.length;
      offset += local.length + bytes.length;
    }
    if (offset + centralSize >= 4294967295) throw new RangeError("LOCAL_ZIP_SIZE_LIMIT");
    const end = new Uint8Array(22), e = new DataView(end.buffer);
    size32(e, 0, 101010256);
    size16(e, 4, 0);
    size16(e, 6, 0);
    size16(e, 8, entries.length);
    size16(e, 10, entries.length);
    size32(e, 12, centralSize);
    size32(e, 16, offset);
    size16(e, 20, 0);
    return new Blob([...data, ...central, end], { type: "application/zip" });
  }

  // vision/orders/approval-attachments.mjs
  var TEST_ORIGIN = "http://testgifts.local";
  var LIMIT_PER_FILE = 16e6;
  var MAX_FILES = 64;
  var MAX_PART_BYTES = 24e6;
  var MAX_PART_FILES = 12;
  var extensions = /* @__PURE__ */ new Set([
    "pdf",
    "psd",
    "psb",
    "png",
    "jpg",
    "jpeg",
    "webp",
    "tif",
    "tiff",
    "gif",
    "svg",
    "eps",
    "ai",
    "cdr",
    "zip"
  ]);
  var te2 = new TextEncoder();
  var numeric = (v) => typeof v === "string" && /^\d{1,20}$/.test(v);
  var code = (status, extra = {}) => ({ status, training_ready: false, ...extra });
  function nativeApprovalAttachmentUrl(id, { origin = TEST_ORIGIN } = {}) {
    if (origin !== TEST_ORIGIN || !numeric(id)) return null;
    const url = new URL("/ajax/gifts/order", origin);
    url.searchParams.set("action", "download_maketadjusting_attachment");
    url.searchParams.set("id", id);
    return url.href;
  }
  function safeName(name) {
    if (typeof name !== "string" || !name || name.length > 200 || /[\x00-\x1f\x7f\\/:*?"<>|]/.test(name) || /[. ]$/.test(name) || /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i.test(name) || te2.encode(name).length > 255) return null;
    const ext = /\.([a-z0-9]{2,5})$/i.exec(name)?.[1]?.toLowerCase();
    return ext && extensions.has(ext) ? { name, extension: ext } : null;
  }
  function looksLikeHTML(bytes) {
    const prefix = new TextDecoder().decode(bytes.subarray(0, Math.min(384, bytes.length))).trimStart().toLowerCase();
    return prefix.startsWith("<!doctype html") || prefix.startsWith("<html") || prefix.startsWith("<?xml") && prefix.includes("<html") || prefix.startsWith('{"') || prefix.startsWith('{"error"') || prefix.startsWith('{"status"') || prefix.startsWith("<script") || prefix.startsWith("<body");
  }
  function nativeAttachmentSignature(bytes, extension) {
    if (!(bytes instanceof Uint8Array) || bytes.length < 8) return "FILE_TOO_SMALL";
    if (looksLikeHTML(bytes)) return "HTML_OR_AUTH_RESPONSE";
    const ascii = (start, size) => String.fromCharCode(...bytes.subarray(start, start + size));
    if (extension === "pdf") return ascii(0, 5) === "%PDF-" ? "KNOWN_SIGNATURE" : "FORMAT_MISMATCH";
    if (extension === "psd" || extension === "psb")
      return ascii(0, 4) === "8BPS" ? "KNOWN_SIGNATURE" : "FORMAT_MISMATCH";
    if (extension === "png")
      return bytes[0] === 137 && ascii(1, 3) === "PNG" ? "KNOWN_SIGNATURE" : "FORMAT_MISMATCH";
    if (extension === "jpg" || extension === "jpeg")
      return bytes[0] === 255 && bytes[1] === 216 ? "KNOWN_SIGNATURE" : "FORMAT_MISMATCH";
    if (extension === "gif") return /^GIF8[79]a$/.test(ascii(0, 6)) ? "KNOWN_SIGNATURE" : "FORMAT_MISMATCH";
    if (extension === "webp")
      return ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP" ? "KNOWN_SIGNATURE" : "FORMAT_MISMATCH";
    if (extension === "tif" || extension === "tiff")
      return ["II*\0", "MM\0*", "II+\0", "MM\0+"].includes(ascii(0, 4)) ? "KNOWN_SIGNATURE" : "FORMAT_MISMATCH";
    if (extension === "zip")
      return bytes[0] === 80 && bytes[1] === 75 && [3, 5, 7].includes(bytes[2]) ? "KNOWN_SIGNATURE" : "FORMAT_MISMATCH";
    if (extension === "svg") {
      const prefix = new TextDecoder().decode(bytes.subarray(0, Math.min(512, bytes.length)));
      return /<svg(?:\s|>)/i.test(prefix) ? "KNOWN_SIGNATURE" : "FORMAT_MISMATCH";
    }
    if (bytes[0] === 77 && bytes[1] === 90) return "EXECUTABLE_MISMATCH";
    return "UNVERIFIED_BINARY_TYPE";
  }
  var SHA256_K = new Uint32Array([
    1116352408,
    1899447441,
    3049323471,
    3921009573,
    961987163,
    1508970993,
    2453635748,
    2870763221,
    3624381080,
    310598401,
    607225278,
    1426881987,
    1925078388,
    2162078206,
    2614888103,
    3248222580,
    3835390401,
    4022224774,
    264347078,
    604807628,
    770255983,
    1249150122,
    1555081692,
    1996064986,
    2554220882,
    2821834349,
    2952996808,
    3210313671,
    3336571891,
    3584528711,
    113926993,
    338241895,
    666307205,
    773529912,
    1294757372,
    1396182291,
    1695183700,
    1986661051,
    2177026350,
    2456956037,
    2730485921,
    2820302411,
    3259730800,
    3345764771,
    3516065817,
    3600352804,
    4094571909,
    275423344,
    430227734,
    506948616,
    659060556,
    883997877,
    958139571,
    1322822218,
    1537002063,
    1747873779,
    1955562222,
    2024104815,
    2227730452,
    2361852424,
    2428436474,
    2756734187,
    3204031479,
    3329325298
  ]);
  var rotr = (x, n) => x >>> n | x << 32 - n;
  function portableSha256Hex(bytes) {
    if (!(bytes instanceof Uint8Array)) throw new TypeError("SHA256_BYTES_REQUIRED");
    const size = bytes.length;
    const length = Math.ceil((size + 9) / 64) * 64;
    const data = new Uint8Array(length);
    data.set(bytes);
    data[size] = 128;
    const view = new DataView(data.buffer);
    view.setUint32(length - 8, Math.floor(size / 536870912));
    view.setUint32(length - 4, size * 8 >>> 0);
    const h = new Uint32Array([
      1779033703,
      3144134277,
      1013904242,
      2773480762,
      1359893119,
      2600822924,
      528734635,
      1541459225
    ]);
    const w = new Uint32Array(64);
    for (let offset = 0; offset < length; offset += 64) {
      for (let i = 0; i < 16; i++) w[i] = view.getUint32(offset + 4 * i);
      for (let i = 16; i < 64; i++) {
        const a2 = w[i - 15], b2 = w[i - 2];
        const s0 = rotr(a2, 7) ^ rotr(a2, 18) ^ a2 >>> 3;
        const s1 = rotr(b2, 17) ^ rotr(b2, 19) ^ b2 >>> 10;
        w[i] = w[i - 16] + s0 + w[i - 7] + s1 >>> 0;
      }
      let [a, b, c, d, e, f, g, z] = h;
      for (let i = 0; i < 64; i++) {
        const s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        const choice = e & f ^ ~e & g;
        const t1 = z + s1 + choice + SHA256_K[i] + w[i] >>> 0;
        const s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        const majority = a & b ^ a & c ^ b & c;
        const t2 = s0 + majority >>> 0;
        z = g;
        g = f;
        f = e;
        e = d + t1 >>> 0;
        d = c;
        c = b;
        b = a;
        a = t1 + t2 >>> 0;
      }
      for (const [i, value] of [a, b, c, d, e, f, g, z].entries()) h[i] = h[i] + value >>> 0;
    }
    return Array.from(h, (v) => v.toString(16).padStart(8, "0")).join("");
  }
  async function hash(bytes) {
    try {
      if (globalThis.crypto?.subtle) {
        const dig = new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", bytes));
        return Array.from(dig, (x) => x.toString(16).padStart(2, "0")).join("");
      }
    } catch {
    }
    return portableSha256Hex(bytes);
  }
  async function readNativeApprovalAttachment(attachment, {
    origin = globalThis.location?.origin || "",
    fetcher = globalThis.fetch,
    imageFetcher = globalThis.__visionLocalTrustedTransport,
    orderNumber = "",
    itemId = "",
    maxFileBytes = LIMIT_PER_FILE
  } = {}) {
    const name = safeName(attachment?.filename);
    const inline = attachment?.source === "native_approval_gallery" ? verifiedApprovalGalleryImageUrl(attachment.inline_image_url, { orderNumber, itemId }) : null;
    const url = attachment?.source === "native_approval_gallery" ? inline?.url : nativeApprovalAttachmentUrl(attachment?.attachment_id, { origin });
    if (!url || !name || inline && name.name !== inline.filename)
      return code("MANUAL_UNSAFE_ATTACHMENT_METADATA");
    const selectedFetcher = inline ? imageFetcher : fetcher;
    if (inline && origin !== TEST_ORIGIN) return code("MANUAL_UNAUTHORIZED_SCOPE");
    if (!Number.isInteger(maxFileBytes) || maxFileBytes < 1 || maxFileBytes > LIMIT_PER_FILE) return code("MANUAL_LIMIT_INVALID");
    if (typeof selectedFetcher !== "function") return code("MANUAL_FETCH_UNAVAILABLE");
    const abort = new AbortController();
    const timeout = setTimeout(() => abort.abort(), 18e3);
    let reader;
    try {
      const resp = await selectedFetcher(url, {
        method: "GET",
        credentials: inline ? "include" : "same-origin",
        redirect: "error",
        cache: "no-store",
        signal: abort.signal,
        referrerPolicy: "no-referrer",
        headers: { accept: "application/octet-stream,application/pdf,image/*,*/*" }
      });
      if (resp?.url && resp.url !== url) return code("MANUAL_REDIRECT_OR_PATH_CHANGED");
      if (resp?.redirected || resp?.type === "opaqueredirect")
        return code("MANUAL_REDIRECT_OR_PATH_CHANGED");
      if (!resp?.ok) return code("MANUAL_HTTP_ERROR", { http_status: resp?.status ?? null });
      if (resp.status !== 200) return code(
        "MANUAL_HTTP_UNEXPECTED_STATUS",
        { http_status: resp.status }
      );
      const ct = String(resp.headers?.get?.("content-type") || "").toLowerCase();
      if (/(?:text\/html|application\/json|text\/plain|application\/xhtml)/.test(ct))
        return code("MANUAL_UNEXPECTED_CONTENT_TYPE");
      const declared = resp.headers?.get?.("content-length") || "";
      if (/^\d+$/.test(declared) && Number(declared) > maxFileBytes)
        return code("MANUAL_ATTACHMENT_TOO_LARGE");
      if (!resp.body?.getReader) return code("MANUAL_BODY_UNREADABLE");
      reader = resp.body.getReader();
      let total = 0;
      const chunks = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!(value instanceof Uint8Array)) return code("MANUAL_BAD_BINARY_CHUNK");
        total += value.length;
        if (total > maxFileBytes) return code("MANUAL_ATTACHMENT_TOO_LARGE");
        chunks.push(value);
      }
      if (total < 8) return code("MANUAL_ATTACHMENT_EMPTY");
      if (/^\d+$/.test(declared) && Number(declared) !== total)
        return code("MANUAL_ATTACHMENT_TRUNCATED");
      const bytes = new Uint8Array(total);
      let off = 0;
      for (const part of chunks) {
        bytes.set(part, off);
        off += part.length;
      }
      const signature = nativeAttachmentSignature(bytes, name.extension);
      if (!["KNOWN_SIGNATURE", "UNVERIFIED_BINARY_TYPE"].includes(signature))
        return code("MANUAL_ATTACHMENT_" + signature);
      return {
        status: "LOCAL_ATTACHMENT_BYTES_ONLY",
        bytes,
        extension: name.extension,
        original_filename: name.name,
        size: total,
        sha256: await hash(bytes),
        signature_status: signature,
        training_ready: false
      };
    } catch {
      return code(abort.signal.aborted ? "MANUAL_ATTACHMENT_TIMEOUT" : "MANUAL_ATTACHMENT_FETCH_FAILED");
    } finally {
      clearTimeout(timeout);
      try {
        await reader?.cancel();
      } catch {
      }
      try {
        reader?.releaseLock();
      } catch {
      }
    }
  }
  function* targets(report) {
    for (let i = 0; i < (report?.articles || []).length; i++) {
      const article = report.articles[i];
      if (article?.status !== "PRIVATE_REVIEW_ONLY") continue;
      for (const message of article.history || [])
        for (const attachment of message.attachments || [])
          yield { article, articleIndex: i + 1, message, attachment };
    }
  }
  async function* exportNativeApprovalAttachmentParts(report, {
    origin = globalThis.location?.origin || "",
    fetcher = globalThis.fetch,
    imageFetcher = globalThis.__visionLocalTrustedTransport,
    onProgress = () => {
    },
    stop = () => false,
    maxFiles = MAX_FILES,
    maxPerFile = LIMIT_PER_FILE,
    maxPartBytes = MAX_PART_BYTES,
    maxPartFiles = MAX_PART_FILES
  } = {}) {
    if (origin !== TEST_ORIGIN || report?.schema !== "printcheck.vision.private-approval-collection.v1") {
      yield code("MANUAL_UNAUTHORIZED_SCOPE");
      return;
    }
    if (!Number.isInteger(maxFiles) || maxFiles < 1 || maxFiles > MAX_FILES || !Number.isInteger(maxPerFile) || maxPerFile < 1 || maxPerFile > LIMIT_PER_FILE || !Number.isInteger(maxPartBytes) || maxPartBytes < maxPerFile || maxPartBytes > MAX_PART_BYTES || !Number.isInteger(maxPartFiles) || maxPartFiles < 1 || maxPartFiles > MAX_PART_FILES) {
      yield code("MANUAL_INVALID_ATTACHMENT_LIMITS");
      return;
    }
    const jobs = [...targets(report)];
    if (jobs.length > maxFiles) {
      yield code("MANUAL_TOO_MANY_ATTACHMENTS", { found: jobs.length });
      return;
    }
    let partNo = 0, processed = 0, successful = 0, entries = [], items = [], skipped = [], total = 0;
    function createPart() {
      if (!items.length) return null;
      partNo++;
      const manifest = {
        schema: "printcheck.vision.private-approval-attachments.v1",
        scope: "LOCAL_PRIVATE_ONLY",
        order_number: report.order_number,
        package_part: partNo,
        created_at: (/* @__PURE__ */ new Date()).toISOString(),
        source: "native_maketadjusting_attachment_get",
        training_ready: false,
        expert_roi_verified: false,
        source_pdf_revision_confirmed: false,
        filenames_are_private: true,
        export_to_public_github_allowed: false,
        items,
        skipped
      };
      const zip = makeLocalStoredZip([{
        name: "manifest.json",
        bytes: te2.encode(JSON.stringify(manifest, null, 2) + "\n")
      }, ...entries]);
      const ready = {
        status: "PRIVATE_LOCAL_ZIP_READY",
        zip,
        manifest,
        files: items.length,
        part: partNo,
        processed,
        successful
      };
      entries = [];
      items = [];
      skipped = [];
      total = 0;
      return ready;
    }
    for (let j = 0; j < jobs.length; j++) {
      if (stop()) {
        yield code("STOPPED", { processed, successful });
        return;
      }
      const job = jobs[j];
      onProgress({ processed, total: jobs.length, successful });
      const file = await readNativeApprovalAttachment(job.attachment, {
        origin,
        fetcher,
        imageFetcher,
        orderNumber: report.order_number,
        itemId: job.article.item_id,
        maxFileBytes: maxPerFile
      });
      processed++;
      job.attachment.local_get_status = file.status;
      if (file.status === "LOCAL_ATTACHMENT_BYTES_ONLY") {
        job.attachment.byte_count = file.size;
        job.attachment.sha256 = file.sha256;
        job.attachment.signature_status = file.signature_status;
      }
      if (file.status !== "LOCAL_ATTACHMENT_BYTES_ONLY") {
        skipped.push({
          article_index: job.articleIndex,
          comment_sequence: job.message.sequence,
          reason: file.status,
          http_status: file.http_status ?? null
        });
        continue;
      }
      if (items.length && (total + file.size > maxPartBytes || items.length >= maxPartFiles)) {
        const part = createPart();
        if (part) yield part;
      }
      if (file.size > maxPartBytes) {
        skipped.push({
          article_index: job.articleIndex,
          comment_sequence: job.message.sequence,
          reason: "MANUAL_PART_BYTES_LIMIT"
        });
        continue;
      }
      const n = String(items.length + 1).padStart(4, "0");
      const ext = file.extension;
      const filename = "attachments/" + String(partNo + 1).padStart(4, "0") + "/" + n + "." + ext;
      entries.push({ name: filename, bytes: file.bytes });
      total += file.size;
      successful++;
      job.attachment.private_zip_part = partNo + 1;
      job.attachment.private_zip_entry = filename;
      items.push({
        entry: filename,
        article_index: job.articleIndex,
        order_item_id: job.article.item_id,
        comment_sequence: job.message.sequence,
        attachment_id: job.attachment.attachment_id,
        source: job.attachment.source === "native_approval_gallery" ? "native_approval_gallery" : "native_maketadjusting_attachment_get",
        original_filename: file.original_filename,
        bytes: file.size,
        sha256: file.sha256,
        signature_status: file.signature_status,
        version_and_print_method_verified: false,
        training_ready: false
      });
    }
    report.attachment_gets_completed = processed;
    report.attachment_gets_verified = successful;
    const last = createPart();
    if (last) yield last;
    else yield code("NO_ATTACHMENT_FILES_VERIFIED", {
      processed,
      successful,
      skipped_count: skipped.length
    });
    onProgress({ processed, total: jobs.length, successful, complete: true });
  }

  // vision/orders/approval-auto-scan.mjs
  var MAX_TARGETS = 100;
  var MAX_MESSAGES = 1500;
  var MAX_TEXT = 12e3;
  var MAX_LOCAL_PRIVATE_CHARS = 24e6;
  var sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  var all = (root, selector) => {
    try {
      return [...root.querySelectorAll(selector)];
    } catch {
      return [];
    }
  };
  var str = (node) => String(node?.textContent || "").trim();
  var attr2 = (node, name) => String(node?.getAttribute?.(name) || "");
  var digits = (v) => /^\d{1,20}$/.test(v);
  var safeText = (s) => String(s || "").slice(0, MAX_TEXT);
  var badgeNumber = (a) => {
    const badge = a?.querySelector?.(".gifts-badge");
    const match = badge && /^\s*(\d{1,5})\s*$/.exec(str(badge));
    return match ? Number(match[1]) : null;
  };
  var attachedFileType = (name) => {
    const extension = /\.([a-z0-9]{2,5})$/i.exec(name)?.[1]?.toLowerCase();
    if (extension === "pdf") return "pdf";
    if (["psd", "psb"].includes(extension)) return "psd";
    if (["png", "jpg", "jpeg", "webp", "gif", "bmp", "tif", "tiff"].includes(extension)) return "image";
    return "other";
  };
  var visibleModal = (doc) => all(doc, "g-modal[visible]").find((m) => m.querySelector?.("#j_maketAdjustingForm"));
  function isCurrentOrderApprovalLink(raw, doc) {
    if (raw === "#" || raw === "") return true;
    try {
      const page = new URL(doc?.location?.href || globalThis.location?.href);
      const target = new URL(raw, page.href);
      return page.protocol === "http:" && page.hostname === "testgifts.local" && target.origin === page.origin && target.pathname === page.pathname && target.hash === "#" && !target.search && !target.username && !target.password;
    } catch {
      return false;
    }
  }
  var humanOrSystem = (body, wrapper) => {
    if (/^Добавлены проблемы\s*:/i.test(body)) return "problem_added";
    if (/^Удалены проблемы\s*:/i.test(body)) return "problem_removed";
    if (/^(?:Вкл|Выкл)\s*\[/i.test(body)) return "status_change";
    if (wrapper?.querySelector?.(".flex-main.opacity-half") || /(?:font-size\s*:\s*10px|background-color\s*:\s*#(?:fbffff|ffffcc))/i.test(attr2(wrapper, "style"))) return "system_other";
    return "human";
  };
  function discoverMaketApprovalTargets(doc) {
    const anchors = all(doc, "li[data-itemid] a.j_maketadjusting");
    const eligible = [], skipped = [];
    for (let index = 0; index < anchors.length; index++) {
      const element = anchors[index], li = element.closest("li[data-itemid]");
      const itemId = attr2(li, "data-itemid"), badge = badgeNumber(element);
      const anchorHref = attr2(element, "href");
      const linkOk = isCurrentOrderApprovalLink(anchorHref, doc);
      const approved = digits(itemId) && linkOk;
      const info = { index: index + 1, element, itemId, badge };
      if (!approved) skipped.push({ index: index + 1, reason: "UNSAFE_NATIVE_TRIGGER" });
      else if (badge === null) skipped.push({ index: index + 1, reason: "BADGE_UNKNOWN" });
      else if (badge <= 1) skipped.push({ index: index + 1, reason: "BELOW_MESSAGE_THRESHOLD" });
      else eligible.push(info);
    }
    return {
      eligible: eligible.slice(0, MAX_TARGETS),
      skipped,
      eligible_over_limit: eligible.length > MAX_TARGETS,
      total_triggers: anchors.length
    };
  }
  function extractMaketApprovalEvidence(doc, { itemId, orderNumber, badge, actorAliases = null } = {}) {
    const modal = visibleModal(doc);
    if (!modal) return { status: "MODAL_NOT_VISIBLE" };
    const form = modal.querySelector("#j_maketAdjustingForm");
    const formItem = attr2(form?.querySelector('input[name="oiid"]'), "value") || String(form?.querySelector('input[name="oiid"]')?.value || "");
    if (!form || !digits(itemId) || formItem !== itemId)
      return { status: "ARTICLE_MISMATCH_OR_MISSING" };
    const summary2 = inspectOpenMaketApprovalDom(doc);
    if (summary2.status !== "VISIBLE_MODAL_STRUCTURE_ONLY")
      return { status: "MODAL_STRUCTURE_INCOMPLETE" };
    const checks = all(form, 'input[type="checkbox"][name="ma_problem[]"]');
    const currentProblems = checks.filter((c) => c.checked === true).map((c) => {
      const group = c.closest(".grid");
      const tech = group?.querySelector(".col-3-12");
      const method = str(tech?.querySelector(".bold-500"));
      const placement = str(tech?.querySelector(".color-text.color--dark"));
      return {
        code: digits(String(c.value || attr2(c, "value"))) ? String(c.value || attr2(c, "value")) : null,
        label: safeText(str(c.closest("label") || c.parentElement)),
        print_method: safeText(method),
        print_placement: safeText(placement),
        source: "currently_checked_designer_problem",
        historical_event_required_for_original_defect_proof: true
      };
    }).slice(0, 100);
    const description = safeText(form.querySelector('[name="ma_description"]')?.value || "");
    const list = modal.querySelector("#j_maketadjusting_comments_list");
    const entries = all(list, ":scope > li");
    if (entries.length > MAX_MESSAGES)
      return { status: "HISTORY_TOO_LONG", summary: summary2 };
    const messages = [];
    const actors = actorAliases instanceof Map ? actorAliases : /* @__PURE__ */ new Map();
    for (let i = 0; i < entries.length; i++) {
      const wrap = entries[i].querySelector(".comment_wrap");
      const main = wrap?.querySelector(".flex-main");
      if (!wrap || !main) return { status: "HISTORY_STRUCTURE_UNREADABLE", summary: summary2 };
      const attachments = all(main, "a.j_maketadjusting_attachment").map((a) => ({
        // Saved only in LOCAL PRIVATE JSON to link the comment to a source,
        // but no href/URL, cookie, author identity or binary is collected.
        attachment_id: digits(attr2(a, "data-id")) ? attr2(a, "data-id") : null,
        filename: safeText(str(a)),
        kind: attachedFileType(str(a)),
        downloaded: false
      })).slice(0, 40);
      const screenshots = extractApprovalGalleryImages(main, { orderNumber, itemId });
      attachments.push(...screenshots.slice(0, Math.max(0, 40 - attachments.length)));
      const clone = main.cloneNode(true);
      for (const anchor of all(clone, "a.j_maketadjusting_attachment"))
        anchor.remove();
      const body = safeText(str(clone).replace(/\s+/g, " "));
      const kind = humanOrSystem(body, wrap);
      const at = str(wrap.querySelector(".comment_info"));
      const timestamp = at.match(/\b\d{2}\.\d{2}\.\d{2,4}\s+\d{2}:\d{2}\b/)?.[0] || null;
      const actorLabel = at.replace(timestamp || "", "").trim();
      if (actorLabel && !actors.has(actorLabel)) actors.set(actorLabel, "actor_" + (actors.size + 1));
      const nativeRef = /^maketadjusting_commentid_(\d{1,20})$/.exec(attr2(wrap, "id"));
      messages.push({
        sequence: i + 1,
        kind,
        text: body,
        date_time: timestamp,
        native_comment_id: nativeRef?.[1] || null,
        actor_ref: actorLabel ? actors.get(actorLabel) : null,
        attachments
      });
    }
    const humans = messages.filter((m) => m.kind === "human").length;
    return {
      status: humans === badge ? "PRIVATE_REVIEW_ONLY" : "PRIVATE_HISTORY_UNVERIFIED",
      order_number: digits(orderNumber) ? orderNumber : null,
      item_id: itemId,
      declared_message_badge: badge,
      observed_human_comments: humans,
      current_problems: currentProblems,
      additional_problem_description: description,
      history: messages,
      summary: summary2,
      attachment_bytes_collected: false,
      source_pdf_revision_confirmed: false,
      expert_roi_confirmed: false,
      training_ready: false,
      production_approved: false
    };
  }
  var waitForArticleModal = async (doc, itemId, badge, {
    stop = () => false,
    timeoutMs = 16e3,
    pollMs = 150
  } = {}) => {
    const deadline = Date.now() + timeoutMs;
    let modalOpenedAt = 0, discussionTabOpened = false;
    let stableHistoryAt = 0, stableHistoryCount = -1;
    while (Date.now() < deadline) {
      if (stop()) return { status: "STOP_REQUESTED" };
      const modal = visibleModal(doc);
      if (modal) {
        const form = modal.querySelector("#j_maketAdjustingForm");
        const input = form?.querySelector('input[name="oiid"]');
        const modalId = String(input?.value || attr2(input, "value"));
        const list = modal.querySelector("#j_maketadjusting_comments_list");
        if (modalId === itemId) {
          if (!modalOpenedAt) modalOpenedAt = Date.now();
          if (list) {
            const probe = inspectOpenMaketApprovalDom(doc);
            if (probe.human_comment_count === badge) {
              if (stableHistoryCount !== probe.history_entry_count) {
                stableHistoryCount = probe.history_entry_count;
                stableHistoryAt = Date.now();
              } else if (Date.now() - stableHistoryAt >= 350)
                return { status: "READY" };
            } else {
              stableHistoryAt = 0;
              stableHistoryCount = -1;
            }
          }
          if (!discussionTabOpened && Date.now() - modalOpenedAt >= 450) {
            const tab = modal.querySelector('label[for="j_ma_comments"]');
            if (tab && modal.querySelector("input#j_ma_comments")) {
              discussionTabOpened = true;
              tab.click();
            } else discussionTabOpened = true;
          }
        }
      }
      await sleep(pollMs);
    }
    return { status: "TIMEOUT_OR_INCOMPLETE_COMMENTS" };
  };
  async function collectMaketApprovalsOnOrderPage(doc, {
    orderNumber = "",
    onProgress = () => {
    },
    stop = () => false,
    timeoutMs = 16e3,
    pauseMs = 220
  } = {}) {
    const discovered = discoverMaketApprovalTargets(doc);
    const result = {
      schema: "printcheck.vision.private-approval-collection.v1",
      scope: "LOCAL_AUTHORIZED_TEST_ORDER",
      order_number: digits(orderNumber) ? orderNumber : null,
      total_triggers: discovered.total_triggers,
      selected_by_badge: discovered.eligible.length,
      skipped: discovered.skipped,
      eligible_over_limit: discovered.eligible_over_limit,
      articles: [],
      status: "COMPLETE",
      remote_upload: false,
      comments_saved_to_github: false,
      attachment_bytes_collected: false,
      expert_roi_confirmed: false,
      training_ready: false,
      production_approved: false
    };
    if (discovered.eligible_over_limit) {
      result.status = "TARGET_LIMIT_EXCEEDED";
      return result;
    }
    if (all(doc, "g-modal[visible]").length) {
      result.status = "EXISTING_NATIVE_MODAL_OPEN";
      return result;
    }
    let retainedPrivateChars = 0;
    const actorAliases = /* @__PURE__ */ new Map();
    for (let i = 0; i < discovered.eligible.length; i++) {
      if (stop()) {
        result.status = "STOPPED";
        break;
      }
      const target = discovered.eligible[i];
      onProgress({ processed: i, total: discovered.eligible.length, badge: target.badge });
      if (all(doc, "g-modal[visible]").length) {
        result.status = "EXISTING_NATIVE_MODAL_OPEN";
        break;
      }
      const stub = { article_index: target.index, declared_badge: target.badge };
      try {
        target.element.click();
        const ready = await waitForArticleModal(doc, target.itemId, target.badge, {
          stop,
          timeoutMs
        });
        if (ready.status === "READY") {
          const data = extractMaketApprovalEvidence(doc, {
            itemId: target.itemId,
            orderNumber,
            badge: target.badge,
            actorAliases
          });
          const estimated = JSON.stringify(data).length;
          if (retainedPrivateChars + estimated > MAX_LOCAL_PRIVATE_CHARS) {
            result.status = "LOCAL_PRIVATE_BUDGET_REACHED";
            result.articles.push({ ...stub, status: "LOCAL_PRIVATE_BUDGET_REACHED" });
          } else {
            retainedPrivateChars += estimated;
            result.articles.push({ ...stub, ...data });
          }
        } else result.articles.push({ ...stub, status: ready.status });
      } catch {
        result.articles.push({ ...stub, status: "NATIVE_MODAL_UNAVAILABLE" });
      } finally {
        const modal = visibleModal(doc);
        const activeId = String(modal?.querySelector('input[name="oiid"]')?.value || attr2(modal?.querySelector('input[name="oiid"]'), "value"));
        if (modal && activeId === target.itemId) {
          const nativeClose = modal.shadowRoot?.querySelector?.(".close[close]");
          if (nativeClose) nativeClose.click();
          if (modal.hasAttribute("visible")) modal.removeAttribute("visible");
        }
      }
      if (result.status === "LOCAL_PRIVATE_BUDGET_REACHED") break;
      if (stop()) {
        result.status = "STOPPED";
        break;
      }
      await sleep(pauseMs);
    }
    result.successful_articles = result.articles.filter((x) => x.status === "PRIVATE_REVIEW_ONLY").length;
    result.unverified_articles = result.articles.length - result.successful_articles;
    onProgress({
      processed: result.articles.length,
      total: discovered.eligible.length,
      complete: true
    });
    return result;
  }
  function anonymousApprovalCollection(report) {
    const statuses = /* @__PURE__ */ new Set([
      "PRIVATE_REVIEW_ONLY",
      "PRIVATE_HISTORY_UNVERIFIED",
      "TIMEOUT_OR_INCOMPLETE_COMMENTS",
      "STOP_REQUESTED",
      "ARTICLE_MISMATCH_OR_MISSING",
      "MODAL_STRUCTURE_INCOMPLETE",
      "HISTORY_TOO_LONG",
      "HISTORY_STRUCTURE_UNREADABLE",
      "NATIVE_MODAL_UNAVAILABLE",
      "LOCAL_PRIVATE_BUDGET_REACHED"
    ]);
    const nums = [
      "history_entry_count",
      "human_comment_count",
      "history_system_entry_count",
      "problems_available_count",
      "problems_checked_current_count",
      "attachments_total",
      "attachments_pdf",
      "attachments_psd",
      "attachments_image_candidates",
      "problem_add_events",
      "problem_remove_events"
    ];
    const rows = (report?.articles || []).map((row, i) => {
      const summary2 = row?.summary || {};
      const safe = {
        article_index: i + 1,
        status: statuses.has(row.status) ? row.status : "MANUAL",
        declared_badge: Number.isInteger(row.declared_badge) ? row.declared_badge : null
      };
      for (const key of nums) safe[key] = Number.isInteger(summary2[key]) ? Math.max(0, Math.min(1e4, summary2[key])) : null;
      return safe;
    });
    const allowedReadStatuses = /* @__PURE__ */ new Set([
      "LOCAL_ATTACHMENT_BYTES_ONLY",
      "MANUAL_UNSAFE_ATTACHMENT_METADATA",
      "MANUAL_ATTACHMENT_TOO_LARGE",
      "MANUAL_HTTP_ERROR",
      "MANUAL_HTTP_UNEXPECTED_STATUS",
      "MANUAL_ATTACHMENT_TRUNCATED",
      "MANUAL_REDIRECT_OR_PATH_CHANGED",
      "MANUAL_UNEXPECTED_CONTENT_TYPE",
      "MANUAL_BODY_UNREADABLE",
      "MANUAL_ATTACHMENT_EMPTY",
      "MANUAL_ATTACHMENT_FORMAT_MISMATCH",
      "MANUAL_ATTACHMENT_HTML_OR_AUTH_RESPONSE",
      "MANUAL_ATTACHMENT_EXECUTABLE_MISMATCH",
      "MANUAL_ATTACHMENT_FILE_TOO_SMALL",
      "MANUAL_ATTACHMENT_TIMEOUT",
      "MANUAL_ATTACHMENT_FETCH_FAILED",
      "MANUAL_BAD_BINARY_CHUNK",
      "MANUAL_FETCH_UNAVAILABLE",
      "MANUAL_LIMIT_INVALID"
    ]);
    const byStatus = {};
    let attemptCount = 0, confirmed = 0;
    for (const row of report?.articles || []) {
      for (const message of row.history || []) {
        for (const attachment of message.attachments || []) {
          const raw = attachment.local_get_status;
          const state = !raw ? "NOT_ATTEMPTED" : allowedReadStatuses.has(raw) ? raw : "MANUAL_UNKNOWN";
          byStatus[state] = (byStatus[state] || 0) + 1;
          if (raw) {
            attemptCount++;
            if (state === "LOCAL_ATTACHMENT_BYTES_ONLY") confirmed++;
          }
        }
      }
    }
    return {
      schema: "printcheck.vision.anonymous-approval-collection.v1",
      attachment_reads_attempted: attemptCount,
      attachment_reads_verified: confirmed,
      attachment_reads_by_status: byStatus,
      local_zip_parts_prepared: Number.isSafeInteger(
        report?.attachment_download_summary?.local_zip_parts
      ) ? Math.min(1e3, report.attachment_download_summary.local_zip_parts) : 0,
      eligible_articles: rows.length,
      articles: rows,
      skipped_below_or_unknown: (report?.skipped || []).length,
      training_ready: false,
      remote_upload: false,
      contains_customer_text: false,
      contains_order_ids: false,
      contains_attachment_names: false,
      contains_authors: false,
      contains_attachment_urls: false
    };
  }

  // vision/orders/approval-page-entry.mjs
  var BOX_ID = "vision-approval-inspector";
  var STYLE_ID = "vision-approval-inspector-css";
  var ACCEPTED = ["testgifts.local"];
  function isOrderPage(loc = globalThis.location) {
    return loc?.protocol === "http:" && ACCEPTED.includes(loc.hostname) && !loc.port && /^\/private\/order\/\d{5,12}\/?$/.test(loc.pathname);
  }
  var make = (tag, contents) => {
    const n = document.createElement(tag);
    if (contents != null) n.textContent = contents;
    return n;
  };
  function initApprovalPageEntry() {
    if (!isOrderPage() || document.getElementById(BOX_ID)) return false;
    const style = make("style");
    style.id = STYLE_ID;
    style.textContent = "#" + BOX_ID + "{position:fixed!important;right:12px!important;top:12px!important;z-index:2147483605!important;width:315px!important;max-width:calc(100vw - 20px)!important;background:#253a3f!important;color:#fff!important;border:1px solid #92aea6!important;box-shadow:0 4px 22px #0008!important;border-radius:10px!important;padding:12px!important;font:13px/1.35 system-ui,sans-serif!important}#" + BOX_ID + " button{cursor:pointer!important;margin:4px!important;background:#e5f0e8!important;color:#203336!important;border:0!important;border-radius:5px!important;padding:7px!important}#" + BOX_ID + " p{margin:6px 0!important;white-space:pre-wrap!important}";
    document.head.append(style);
    const panel = make("section");
    panel.id = BOX_ID;
    panel.setAttribute("aria-label", "Vision AI \u2014 \u0438\u0441\u0441\u043B\u0435\u0434\u043E\u0432\u0430\u043D\u0438\u0435 \u043E\u0442\u043A\u0440\u044B\u0442\u043E\u0433\u043E \u0441\u043E\u0433\u043B\u0430\u0441\u043E\u0432\u0430\u043D\u0438\u044F");
    const header = make("strong", "Vision AI \xB7 \u0421\u043E\u0433\u043B\u0430\u0441\u043E\u0432\u0430\u043D\u0438\u0435 \u043C\u0430\u043A\u0435\u0442\u0430 \xB7 v0.1.6");
    const note = make("p", "\u0410\u0432\u0442\u043E\u043E\u0431\u0445\u043E\u0434: \u0434\u043B\u044F \u0441\u043E\u0433\u043B\u0430\u0441\u043E\u0432\u0430\u043D\u0438\u0439 \u0441 2+ \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u044F\u043C\u0438 \u043F\u0440\u043E\u0433\u0440\u0430\u043C\u043C\u0430 \u0447\u0438\u0442\u0430\u0435\u0442 \u043F\u0440\u043E\u0431\u043B\u0435\u043C\u044B, \u0432\u0441\u044E \u0438\u0441\u0442\u043E\u0440\u0438\u044E \u0438 \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u043E \u043F\u043E\u043B\u0443\u0447\u0430\u0435\u0442 \u0444\u0430\u0439\u043B\u044B \u0447\u0435\u0440\u0435\u0437 \u0440\u0430\u0437\u0440\u0435\u0448\u0451\u043D\u043D\u044B\u0439 GET. \u0410\u0440\u0445\u0438\u0432\u044B \u0441 \u0432\u043B\u043E\u0436\u0435\u043D\u0438\u044F\u043C\u0438 \u0441\u043A\u0430\u0447\u0438\u0432\u0430\u044E\u0442\u0441\u044F \u0442\u043E\u043B\u044C\u043A\u043E \u043D\u0430 \u044D\u0442\u043E\u0442 \u043A\u043E\u043C\u043F\u044C\u044E\u0442\u0435\u0440. \u041C\u043E\u0436\u043D\u043E \u043E\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0442\u044C \u0441\u0431\u043E\u0440. \u041D\u0435 \u043E\u0442\u043F\u0440\u0430\u0432\u043B\u044F\u0439\u0442\u0435 \u043F\u0440\u0438\u0432\u0430\u0442\u043D\u044B\u0435 ZIP \u0438 JSON \u0432 \u043F\u0443\u0431\u043B\u0438\u0447\u043D\u044B\u0439 GitHub.");
    const stats = make("p", "\u041E\u0436\u0438\u0434\u0430\u0435\u0442\u0441\u044F \u043E\u0442\u043A\u0440\u044B\u0442\u043E\u0435 \u043E\u043A\u043D\u043E.");
    stats.setAttribute("role", "status");
    const scan = make("button", "\u041F\u0440\u043E\u0447\u0438\u0442\u0430\u0442\u044C \u043E\u0442\u043A\u0440\u044B\u0442\u043E\u0435 \u0441\u043E\u0433\u043B\u0430\u0441\u043E\u0432\u0430\u043D\u0438\u0435");
    const exportButton = make("button", "\u0421\u043A\u0430\u0447\u0430\u0442\u044C \u0430\u043D\u043E\u043D\u0438\u043C\u043D\u044B\u0439 JSON");
    const autoScan = make("button", "\u0410\u0432\u0442\u043E\u043E\u0431\u0445\u043E\u0434 \u0441\u043E\u0433\u043B\u0430\u0441\u043E\u0432\u0430\u043D\u0438\u0439 >1");
    const stopScan = make("button", "\u041E\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0442\u044C \u043E\u0431\u0445\u043E\u0434");
    const privateSave = make("button", "\u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u043F\u0440\u0438\u0432\u0430\u0442\u043D\u044B\u0435 \u0434\u0430\u043D\u043D\u044B\u0435");
    const anonymousSave = make("button", "\u0410\u043D\u043E\u043D\u0438\u043C\u043D\u044B\u0439 \u043E\u0442\u0447\u0451\u0442 \u043E\u0431\u0445\u043E\u0434\u0430");
    const attachmentRetry = make("button", "\u041F\u043E\u0432\u0442\u043E\u0440\u0438\u0442\u044C \u0441\u043A\u0430\u0447\u0438\u0432\u0430\u043D\u0438\u0435 \u0432\u043B\u043E\u0436\u0435\u043D\u0438\u0439");
    const close = make("button", "\u0417\u0430\u043A\u0440\u044B\u0442\u044C Vision");
    exportButton.disabled = true;
    stopScan.disabled = privateSave.disabled = anonymousSave.disabled = attachmentRetry.disabled = true;
    let last = null, collection = null, busy = false, stopRequested = false;
    for (const b of [
      scan,
      exportButton,
      autoScan,
      stopScan,
      privateSave,
      anonymousSave,
      attachmentRetry,
      close
    ])
      b.type = "button";
    const stop = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };
    scan.addEventListener("click", (event) => {
      stop(event);
      if (busy) return;
      last = inspectOpenMaketApprovalDom(document);
      const r = last;
      if (r.status !== "VISIBLE_MODAL_STRUCTURE_ONLY") {
        exportButton.disabled = true;
        stats.textContent = "\u041E\u043A\u043D\u043E \u043D\u0435 \u043E\u0442\u043A\u0440\u044B\u0442\u043E \u0438\u043B\u0438 \u0441\u0442\u0440\u0443\u043A\u0442\u0443\u0440\u0430 \u043D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u0430: " + r.status + ". \u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u043E\u0442\u043A\u0440\u043E\u0439\u0442\u0435 \u0448\u0442\u0430\u0442\u043D\u043E\u0435 \xAB\u0421\u043E\u0433\u043B\u0430\u0441\u043E\u0432\u0430\u043D\u0438\u0435 \u043C\u0430\u043A\u0435\u0442\u0430\xBB.";
        return;
      }
      exportButton.disabled = false;
      stats.textContent = "\u0412\u0430\u0440\u0438\u0430\u043D\u0442\u043E\u0432 \u043F\u0440\u043E\u0431\u043B\u0435\u043C: " + r.problems_available_count + " \xB7 \u043E\u0442\u043C\u0435\u0447\u0435\u043D\u043E \u0441\u0435\u0439\u0447\u0430\u0441: " + r.problems_checked_current_count + "\n\u0421\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0439: " + r.human_comment_count + " \xB7 \u0441\u043E\u0431\u044B\u0442\u0438\u0439: " + r.history_system_entry_count + " \xB7 \u0432\u043B\u043E\u0436\u0435\u043D\u0438\u0439: " + r.attachments_total + " (PDF " + r.attachments_pdf + ", PSD " + r.attachments_psd + ", \u0438\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u044F " + r.attachments_image_candidates + ")\n\u0414\u0430\u043D\u043D\u044B\u0435 \u043F\u0440\u0435\u0434\u043D\u0430\u0437\u043D\u0430\u0447\u0435\u043D\u044B \u0442\u043E\u043B\u044C\u043A\u043E \u0434\u043B\u044F \u0438\u0441\u0441\u043B\u0435\u0434\u043E\u0432\u0430\u043D\u0438\u044F; \u0434\u043E\u043F\u0443\u0441\u043A \u043A \u043F\u0435\u0447\u0430\u0442\u0438 \u043D\u0435 \u0432\u044B\u0434\u0430\u0451\u0442\u0441\u044F.";
    });
    exportButton.addEventListener("click", (event) => {
      stop(event);
      if (!last || last.status !== "VISIBLE_MODAL_STRUCTURE_ONLY") return;
      const safeKeys = [
        "status",
        "trigger_count",
        "article_scoped_trigger_count",
        "modal_loaded",
        "modal_currently_visible",
        "problems_available_count",
        "problems_checked_current_count",
        "human_comment_count",
        "history_entry_count",
        "history_system_entry_count",
        "problem_add_events",
        "problem_remove_events",
        "status_change_events",
        "other_system_events",
        "attachments_total",
        "attachments_pdf",
        "attachments_psd",
        "attachments_image_candidates",
        "attachments_other",
        "badge_comment_count",
        "badge_matches_human_messages"
      ];
      const safe = Object.fromEntries(safeKeys.map((key) => [key, last[key]]));
      const topics = [
        "positive_min",
        "negative_min",
        "text_height",
        "color",
        "raster_resolution",
        "effects",
        "field_boundary",
        "constructor",
        "fonts",
        "wrong_artwork",
        "complex_work",
        "revision"
      ];
      const report = {
        schema: "printcheck.vision.local-maket-approval.v1",
        scope: "CURRENT_VISIBLE_NATIVE_MODAL_ONLY",
        ...safe,
        checked_problem_topic_hints: topics.filter((x) => last.checked_problem_topic_hints?.includes(x)).sort(),
        weak_message_topic_hints: topics.filter((x) => last.weak_message_topic_hints?.includes(x)).sort(),
        unselected_problem_options_are_not_defects: true,
        reported_issues_expert_verified: false,
        history_version_alignment_verified: false,
        training_ready: false,
        production_approved: false,
        order_numbers_included: false,
        item_ids_included: false,
        message_text_included: false,
        author_names_included: false,
        attachment_names_or_urls_included: false,
        attachments_downloaded: false
      };
      const url = URL.createObjectURL(new Blob(
        [JSON.stringify(report, null, 2) + "\n"],
        { type: "application/json" }
      ));
      const anchor = make("a");
      anchor.href = url;
      anchor.download = "vision-local-maket-approval.json";
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2e3);
    });
    function downloadJson(data, filename) {
      const uri = URL.createObjectURL(new Blob(
        [JSON.stringify(data, null, 2) + "\n"],
        { type: "application/json" }
      ));
      const a = make("a");
      a.href = uri;
      a.download = filename;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(uri), 2500);
    }
    async function savePrivateAttachmentParts({ queueMode = false } = {}) {
      if (!collection) return { status: "NO_COLLECTION", files: 0, parts: 0 };
      let files = 0, parts = 0, processed = 0, failures = 0;
      for await (const item of exportNativeApprovalAttachmentParts(collection, {
        stop: () => stopRequested || !panel.isConnected,
        onProgress: (p) => {
          if (panel.isConnected) stats.textContent = "\u0424\u0430\u0439\u043B\u044B \u0438\u0437 \u043E\u0431\u0441\u0443\u0436\u0434\u0435\u043D\u0438\u0439: " + p.processed + " / " + p.total + " \xB7 \u0441\u0447\u0438\u0442\u0430\u043D\u043E " + p.successful + "\n\u0422\u043E\u043B\u044C\u043A\u043E \u0430\u0432\u0442\u043E\u0440\u0438\u0437\u043E\u0432\u0430\u043D\u043D\u044B\u0435 GET, \u0431\u0435\u0437 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0438\u044F \u043D\u0430 \u0441\u0430\u0439\u0442\u0435.";
        }
      })) {
        if (item.status === "PRIVATE_LOCAL_ZIP_READY") {
          files += item.files;
          parts++;
          const u = URL.createObjectURL(item.zip), a = make("a");
          a.href = u;
          a.download = "vision-private-approval-attachments-" + (queueMode ? location.pathname.split("/").filter(Boolean).at(-1) + "-" : "") + "part-" + String(item.part).padStart(4, "0") + ".zip";
          document.body.append(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(u), 3e4);
          processed = item.processed;
          failures += item.manifest.skipped.length;
          await new Promise((resolve) => setTimeout(resolve, 300));
        } else if (item.status === "STOPPED") {
          return { status: "STOPPED", files, parts, processed, failures };
        } else if (item.status === "NO_ATTACHMENT_FILES_VERIFIED") {
          processed = item.processed;
          failures += item.skipped_count;
          return { status: "MANUAL_NO_FILE_BYTES", files, parts, processed, failures };
        } else {
          return { status: item.status, files, parts, processed, failures };
        }
      }
      return {
        status: files ? "LOCAL_ZIP_PARTS_PREPARED" : "NO_ATTACHMENTS",
        files,
        parts,
        processed,
        failures
      };
    }
    async function performAutomaticApprovalScan(queueMode = false) {
      if (busy) return { status: "BUSY" };
      busy = true;
      stopRequested = false;
      collection = null;
      scan.disabled = autoScan.disabled = exportButton.disabled = true;
      stopScan.disabled = false;
      privateSave.disabled = anonymousSave.disabled = attachmentRetry.disabled = true;
      try {
        collection = await collectMaketApprovalsOnOrderPage(document, {
          orderNumber: location.pathname.split("/").filter(Boolean).at(-1),
          stop: () => stopRequested || !panel.isConnected,
          onProgress: (p) => {
            if (!panel.isConnected) return;
            stats.textContent = p.complete ? "\u0410\u0432\u0442\u043E\u043E\u0431\u0445\u043E\u0434 \u0437\u0430\u0432\u0435\u0440\u0448\u0451\u043D. \u041F\u0440\u043E\u0432\u0435\u0440\u0435\u043D\u043E: " + p.processed + " / " + p.total : "\u0410\u0432\u0442\u043E\u043E\u0431\u0445\u043E\u0434: " + p.processed + " / " + p.total + " \xB7 \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0435\u0433\u043E \u0441\u043E\u0433\u043B\u0430\u0441\u043E\u0432\u0430\u043D\u0438\u044F; \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0439 " + p.badge;
          }
        });
        if (!panel.isConnected) return;
        const done = collection.articles.filter((x) => x.status === "PRIVATE_REVIEW_ONLY").length;
        const skipped = collection.skipped.length;
        const attachmentReport = stopRequested ? { status: "STOPPED", files: 0, parts: 0, failures: 0 } : await savePrivateAttachmentParts({ queueMode });
        collection.attachment_download_summary = {
          status: attachmentReport.status,
          verified_files: attachmentReport.files,
          local_zip_parts: attachmentReport.parts,
          read_failures: attachmentReport.failures,
          source_pdf_revision_confirmed: false,
          training_ready: false
        };
        if (!panel.isConnected) return;
        stats.textContent = "\u041E\u0431\u0445\u043E\u0434: " + collection.status + "\n\u0410\u0440\u0442\u0438\u043A\u0443\u043B\u043E\u0432: " + collection.articles.length + " \xB7 \u0438\u0441\u0442\u043E\u0440\u0438\u044F \u043F\u0440\u043E\u0432\u0435\u0440\u0435\u043D\u0430: " + done + " \xB7 \u043F\u0440\u043E\u043F\u0443\u0449\u0435\u043D\u043E: " + skipped + "\n\u0424\u0430\u0439\u043B\u044B: " + attachmentReport.files + " \xB7 ZIP-\u0447\u0430\u0441\u0442\u0435\u0439: " + attachmentReport.parts + " \xB7 \u043E\u0448\u0438\u0431\u043E\u043A \u0447\u0442\u0435\u043D\u0438\u044F: " + attachmentReport.failures + " \xB7 \u0441\u0442\u0430\u0442\u0443\u0441: " + attachmentReport.status + "\n\u041F\u0440\u0438\u0432\u0430\u0442\u043D\u044B\u0439 JSON \u0441\u043E\u0434\u0435\u0440\u0436\u0438\u0442 \u0442\u0435\u043A\u0441\u0442 \u0437\u0430\u043C\u0435\u0447\u0430\u043D\u0438\u0439. \u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u0435 \u0435\u0433\u043E \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u043E. Chrome \u043C\u043E\u0436\u0435\u0442 \u0437\u0430\u043F\u0440\u043E\u0441\u0438\u0442\u044C \u0440\u0430\u0437\u0440\u0435\u0448\u0435\u043D\u0438\u0435 \u043D\u0430 \u043D\u0435\u0441\u043A\u043E\u043B\u044C\u043A\u043E \u0441\u043A\u0430\u0447\u0438\u0432\u0430\u043D\u0438\u0439.";
        privateSave.disabled = anonymousSave.disabled = attachmentRetry.disabled = false;
        if (queueMode && collection?.articles?.length) {
          downloadJson(collection, "vision-private-approval-evidence-" + location.pathname.split("/").filter(Boolean).at(-1) + ".json");
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
        return {
          status: collection.status,
          eligible_articles: collection.selected_by_badge,
          verified_articles: done,
          files: attachmentReport.files,
          zip_parts: attachmentReport.parts,
          failures: attachmentReport.failures,
          private_text_saved: !!(queueMode && collection?.articles?.length)
        };
      } catch {
        if (panel.isConnected) stats.textContent = "MANUAL: \u043E\u0448\u0438\u0431\u043A\u0430 \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u043E\u0433\u043E \u043E\u0431\u0445\u043E\u0434\u0430.";
        return { status: "MANUAL_AUTO_SCAN_FAILED" };
      } finally {
        busy = false;
        scan.disabled = autoScan.disabled = false;
        stopScan.disabled = true;
        exportButton.disabled = last?.status !== "VISIBLE_MODAL_STRUCTURE_ONLY";
      }
    }
    autoScan.addEventListener("click", (event) => {
      stop(event);
      void performAutomaticApprovalScan();
    });
    if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener((message, _sender, respond) => {
        if (message?.op !== "vision-approval-order-collect-v1") return false;
        if (!isOrderPage() || message.order_url !== location.href) {
          respond({ status: "MANUAL_ORDER_URL_MISMATCH" });
          return false;
        }
        performAutomaticApprovalScan(true).then(respond, () => respond({ status: "MANUAL_AUTO_SCAN_FAILED" }));
        return true;
      });
    }
    attachmentRetry.addEventListener("click", async (event) => {
      stop(event);
      if (busy || !collection) return;
      busy = true;
      stopRequested = false;
      autoScan.disabled = attachmentRetry.disabled = true;
      stopScan.disabled = false;
      try {
        const res = await savePrivateAttachmentParts();
        if (panel.isConnected) stats.textContent = "\u041F\u043E\u0432\u0442\u043E\u0440\u043D\u043E\u0435 \u0447\u0442\u0435\u043D\u0438\u0435 \u0444\u0430\u0439\u043B\u043E\u0432: " + res.status + " \xB7 \u0441\u0447\u0438\u0442\u0430\u043D\u043E " + res.files + " \xB7 ZIP-\u0447\u0430\u0441\u0442\u0435\u0439 " + res.parts + " \xB7 \u043E\u0442\u043A\u0430\u0437\u043E\u0432 " + res.failures;
      } finally {
        busy = false;
        autoScan.disabled = attachmentRetry.disabled = false;
        stopScan.disabled = true;
      }
    });
    stopScan.addEventListener("click", (event) => {
      stop(event);
      stopRequested = true;
      stopScan.disabled = true;
      stats.textContent = "\u041E\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0430 \u0437\u0430\u043F\u0440\u043E\u0448\u0435\u043D\u0430. \u0422\u0435\u043A\u0443\u0449\u0438\u0439 \u0448\u0430\u0433 \u0437\u0430\u0432\u0435\u0440\u0448\u0438\u0442\u0441\u044F \u0431\u0435\u0437\u043E\u043F\u0430\u0441\u043D\u043E.";
    });
    privateSave.addEventListener("click", (event) => {
      stop(event);
      if (!collection) return;
      if (!window.confirm("\u0412 \u043F\u0440\u0438\u0432\u0430\u0442\u043D\u043E\u043C JSON \u043D\u0430\u0445\u043E\u0434\u044F\u0442\u0441\u044F \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u044F \u043E \u0437\u0430\u043A\u0430\u0437\u0435, \u0438\u0434\u0435\u043D\u0442\u0438\u0444\u0438\u043A\u0430\u0442\u043E\u0440\u044B \u0430\u0440\u0442\u0438\u043A\u0443\u043B\u043E\u0432 \u0438 \u0438\u043C\u0435\u043D\u0430 \u0432\u043B\u043E\u0436\u0435\u043D\u0438\u0439. \u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u0442\u043E\u043B\u044C\u043A\u043E \u043D\u0430 \u0441\u0432\u043E\u0439 \u043A\u043E\u043C\u043F\u044C\u044E\u0442\u0435\u0440? \u041D\u0435 \u043F\u0443\u0431\u043B\u0438\u043A\u0443\u0439\u0442\u0435 \u0444\u0430\u0439\u043B \u0432 GitHub \u0438 \u043D\u0435 \u043E\u0442\u043F\u0440\u0430\u0432\u043B\u044F\u0439\u0442\u0435 \u0432 \u043E\u0431\u0449\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u043D\u044B\u0435 \u0441\u0435\u0440\u0432\u0438\u0441\u044B.")) return;
      downloadJson(collection, "vision-private-approval-evidence.json");
    });
    anonymousSave.addEventListener("click", (event) => {
      stop(event);
      if (!collection) return;
      downloadJson(
        anonymousApprovalCollection(collection),
        "vision-anonymous-approval-collection.json"
      );
    });
    close.addEventListener("click", (event) => {
      stop(event);
      stopRequested = true;
      panel.remove();
      style.remove();
    });
    panel.append(
      header,
      note,
      autoScan,
      stopScan,
      privateSave,
      anonymousSave,
      attachmentRetry,
      scan,
      exportButton,
      close,
      stats
    );
    document.body.append(panel);
    return true;
  }
  if (typeof document !== "undefined" && typeof location !== "undefined")
    initApprovalPageEntry();
})();
