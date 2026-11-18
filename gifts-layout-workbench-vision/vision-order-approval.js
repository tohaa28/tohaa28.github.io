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
      const linkOk = anchorHref === "#" || anchorHref === "" || anchorHref.startsWith("http://testgifts.local/private/order/") && anchorHref.endsWith("#");
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
  function extractMaketApprovalEvidence(doc, { itemId, orderNumber, badge } = {}) {
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
    const currentProblems = checks.filter((c) => c.checked === true).map((c) => ({
      code: digits(String(c.value || attr2(c, "value"))) ? String(c.value || attr2(c, "value")) : null,
      label: safeText(str(c.closest("label") || c.parentElement))
    })).slice(0, 100);
    const description = safeText(form.querySelector('[name="ma_description"]')?.value || "");
    const list = modal.querySelector("#j_maketadjusting_comments_list");
    const entries = all(list, ":scope > li");
    if (entries.length > MAX_MESSAGES)
      return { status: "HISTORY_TOO_LONG", summary: summary2 };
    const messages = [];
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
      const clone = main.cloneNode(true);
      for (const anchor of all(clone, "a.j_maketadjusting_attachment"))
        anchor.remove();
      const body = safeText(str(clone).replace(/\s+/g, " "));
      const kind = humanOrSystem(body, wrap);
      const at = str(wrap.querySelector(".comment_info"));
      const timestamp = at.match(/\b\d{2}\.\d{2}\.\d{2,4}\s+\d{2}:\d{2}\b/)?.[0] || null;
      messages.push({ sequence: i + 1, kind, text: body, date_time: timestamp, attachments });
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
            badge: target.badge
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
        if (modal && activeId === target.itemId) modal.removeAttribute("visible");
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
    return {
      schema: "printcheck.vision.anonymous-approval-collection.v1",
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
    const header = make("strong", "Vision AI \xB7 \u0421\u043E\u0433\u043B\u0430\u0441\u043E\u0432\u0430\u043D\u0438\u0435 \u043C\u0430\u043A\u0435\u0442\u0430");
    const note = make("p", "\u0410\u0432\u0442\u043E\u043E\u0431\u0445\u043E\u0434 \u043F\u043E \u0430\u0440\u0442\u0438\u043A\u0443\u043B\u0430\u043C: Vision \u0441\u0430\u043C\u043E\u0441\u0442\u043E\u044F\u0442\u0435\u043B\u044C\u043D\u043E \u043D\u0430\u0436\u043C\u0451\u0442 \u0442\u043E\u043B\u044C\u043A\u043E \xAB\u0421\u043E\u0433\u043B\u0430\u0441\u043E\u0432\u0430\u043D\u0438\u0435 \u043C\u0430\u043A\u0435\u0442\u0430\xBB \u0441\u043E \u0441\u0447\u0451\u0442\u0447\u0438\u043A\u043E\u043C \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0439 \u0431\u043E\u043B\u044C\u0448\u0435 1, \u043F\u0440\u043E\u0447\u0438\u0442\u0430\u0435\u0442 \u043E\u0442\u043A\u0440\u044B\u0432\u0448\u0435\u0435\u0441\u044F \u043E\u043A\u043D\u043E \u0438 \u0437\u0430\u043A\u0440\u043E\u0435\u0442 \u0435\u0433\u043E. \u0411\u0435\u0437 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0438\u044F \u0438\u043B\u0438 \u043E\u0442\u043F\u0440\u0430\u0432\u043A\u0438 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0439. \u041C\u043E\u0436\u043D\u043E \u0442\u0430\u043A\u0436\u0435 \u043F\u0440\u043E\u0432\u0435\u0440\u0438\u0442\u044C \u043E\u0434\u043D\u043E \u0432\u0440\u0443\u0447\u043D\u0443\u044E \u043E\u0442\u043A\u0440\u044B\u0442\u043E\u0435 \u043E\u043A\u043D\u043E.");
    const stats = make("p", "\u041E\u0436\u0438\u0434\u0430\u0435\u0442\u0441\u044F \u043E\u0442\u043A\u0440\u044B\u0442\u043E\u0435 \u043E\u043A\u043D\u043E.");
    stats.setAttribute("role", "status");
    const scan = make("button", "\u041F\u0440\u043E\u0447\u0438\u0442\u0430\u0442\u044C \u043E\u0442\u043A\u0440\u044B\u0442\u043E\u0435 \u0441\u043E\u0433\u043B\u0430\u0441\u043E\u0432\u0430\u043D\u0438\u0435");
    const exportButton = make("button", "\u0421\u043A\u0430\u0447\u0430\u0442\u044C \u0430\u043D\u043E\u043D\u0438\u043C\u043D\u044B\u0439 JSON");
    const autoScan = make("button", "\u0410\u0432\u0442\u043E\u043E\u0431\u0445\u043E\u0434 \u0441\u043E\u0433\u043B\u0430\u0441\u043E\u0432\u0430\u043D\u0438\u0439 >1");
    const stopScan = make("button", "\u041E\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0442\u044C \u043E\u0431\u0445\u043E\u0434");
    const privateSave = make("button", "\u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u043F\u0440\u0438\u0432\u0430\u0442\u043D\u044B\u0435 \u0434\u0430\u043D\u043D\u044B\u0435");
    const anonymousSave = make("button", "\u0410\u043D\u043E\u043D\u0438\u043C\u043D\u044B\u0439 \u043E\u0442\u0447\u0451\u0442 \u043E\u0431\u0445\u043E\u0434\u0430");
    const close = make("button", "\u0417\u0430\u043A\u0440\u044B\u0442\u044C Vision");
    exportButton.disabled = true;
    stopScan.disabled = privateSave.disabled = anonymousSave.disabled = true;
    let last = null, collection = null, busy = false, stopRequested = false;
    for (const b of [scan, exportButton, autoScan, stopScan, privateSave, anonymousSave, close])
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
    autoScan.addEventListener("click", async (event) => {
      stop(event);
      if (busy) return;
      busy = true;
      stopRequested = false;
      collection = null;
      scan.disabled = autoScan.disabled = exportButton.disabled = true;
      stopScan.disabled = false;
      privateSave.disabled = anonymousSave.disabled = true;
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
        stats.textContent = "\u041E\u0431\u0445\u043E\u0434: " + collection.status + "\n\u041E\u0431\u0440\u0430\u0431\u043E\u0442\u0430\u043D\u043E: " + collection.articles.length + " \xB7 \u0443\u0441\u043F\u0435\u0448\u043D\u043E: " + done + " \xB7 \u043F\u0440\u043E\u043F\u0443\u0449\u0435\u043D\u043E \u043F\u043E \u0441\u0447\u0451\u0442\u0447\u0438\u043A\u0443/\u0431\u0435\u0437 \u0434\u043E\u0441\u0442\u0443\u043F\u0430: " + skipped + "\n\u041F\u0440\u0438\u0432\u0430\u0442\u043D\u044B\u0439 JSON \u0441\u043E\u0434\u0435\u0440\u0436\u0438\u0442 \u0442\u0435\u043A\u0441\u0442\u044B \u0437\u0430\u043C\u0435\u0447\u0430\u043D\u0438\u0439 \u0438 \u0438\u043C\u0435\u043D\u0430 \u0444\u0430\u0439\u043B\u043E\u0432 \u2014 \u0445\u0440\u0430\u043D\u0438\u0442\u0435 \u043B\u043E\u043A\u0430\u043B\u044C\u043D\u043E.";
        privateSave.disabled = anonymousSave.disabled = false;
      } catch {
        if (panel.isConnected) stats.textContent = "MANUAL: \u043E\u0448\u0438\u0431\u043A\u0430 \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u043E\u0433\u043E \u043E\u0431\u0445\u043E\u0434\u0430.";
      } finally {
        busy = false;
        scan.disabled = autoScan.disabled = false;
        stopScan.disabled = true;
        exportButton.disabled = last?.status !== "VISIBLE_MODAL_STRUCTURE_ONLY";
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
