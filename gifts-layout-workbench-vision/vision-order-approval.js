(() => {
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
    if (verified.length !== 1)
      return { ...result, status: verified.length > 1 ? "AMBIGUOUS_APPROVAL_MODAL" : "MODAL_NOT_LOADED" };
    const modal = verified[0], form = forms.find((x) => x.closest?.("g-modal") === modal);
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
    const header = make("strong", "Vision AI \xB7 \u0421\u043E\u0433\u043B\u0430\u0441\u043E\u0432\u0430\u043D\u0438\u0435 \u043C\u0430\u043A\u0435\u0442\u0430");
    const note = make("p", "\u041E\u0442\u043A\u0440\u043E\u0439\u0442\u0435 \u0448\u0442\u0430\u0442\u043D\u043E\u0439 \u043A\u043D\u043E\u043F\u043A\u043E\u0439 \xAB\u0421\u043E\u0433\u043B\u0430\u0441\u043E\u0432\u0430\u043D\u0438\u0435 \u043C\u0430\u043A\u0435\u0442\u0430\xBB \u0443 \u043D\u0443\u0436\u043D\u043E\u0433\u043E \u0430\u0440\u0442\u0438\u043A\u0443\u043B\u0430. \u0417\u0430\u0442\u0435\u043C \u043F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u0443\u0436\u0435 \u043E\u0442\u043A\u0440\u044B\u0442\u043E\u0435 \u043E\u043A\u043D\u043E. \u041D\u0438\u0447\u0435\u0433\u043E \u043D\u0430 \u0441\u0430\u0439\u0442\u0435 \u043D\u0435 \u0438\u0437\u043C\u0435\u043D\u044F\u0435\u0442\u0441\u044F.");
    const stats = make("p", "\u041E\u0436\u0438\u0434\u0430\u0435\u0442\u0441\u044F \u043E\u0442\u043A\u0440\u044B\u0442\u043E\u0435 \u043E\u043A\u043D\u043E.");
    stats.setAttribute("role", "status");
    const scan = make("button", "\u041F\u0440\u043E\u0447\u0438\u0442\u0430\u0442\u044C \u043E\u0442\u043A\u0440\u044B\u0442\u043E\u0435 \u0441\u043E\u0433\u043B\u0430\u0441\u043E\u0432\u0430\u043D\u0438\u0435");
    const exportButton = make("button", "\u0421\u043A\u0430\u0447\u0430\u0442\u044C \u0430\u043D\u043E\u043D\u0438\u043C\u043D\u044B\u0439 JSON");
    const close = make("button", "\u0417\u0430\u043A\u0440\u044B\u0442\u044C Vision");
    exportButton.disabled = true;
    let last = null;
    scan.type = exportButton.type = close.type = "button";
    const stop = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };
    scan.addEventListener("click", (event) => {
      stop(event);
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
    close.addEventListener("click", (event) => {
      stop(event);
      panel.remove();
      style.remove();
    });
    panel.append(header, note, scan, exportButton, close, stats);
    document.body.append(panel);
    return true;
  }
  if (typeof document !== "undefined" && typeof location !== "undefined")
    initApprovalPageEntry();
})();
