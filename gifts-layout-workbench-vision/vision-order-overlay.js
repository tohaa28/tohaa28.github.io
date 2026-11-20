(() => {
  // vision/geometry/svg-viewport.mjs
  var refuse = (reason) => Object.freeze({
    status: "MANUAL",
    reason,
    svg_document_scale_proven: false,
    print_scale_proven: false
  });
  var mmMultipliers = Object.freeze({ mm: 1, cm: 10, in: 25.4, pt: 25.4 / 72 });
  function unitValue(raw) {
    if (typeof raw !== "string") return null;
    const match = /^\s*(\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*(mm|cm|in|pt)\s*$/i.exec(raw);
    if (!match) return null;
    const value = Number(match[1]) * mmMultipliers[match[2].toLowerCase()];
    return Number.isFinite(value) && value > 0 && value <= 5e4 ? value : null;
  }
  function inspectSvgDocumentViewport(root) {
    if (!root || root.localName !== "svg" || typeof root.getAttribute !== "function")
      return refuse("VALIDATED_SVG_ROOT_REQUIRED");
    const attr2 = (name) => root.getAttribute(name);
    if (attr2("style") || attr2("class") || attr2("transform"))
      return refuse("SVG_ROOT_STYLE_OR_TRANSFORM_UNVERIFIED");
    const align = (attr2("preserveAspectRatio") || "xMidYMid meet").trim();
    if (!/^(?:x(?:Min|Mid|Max)Y(?:Min|Mid|Max))(?:\s+(?:meet|slice))?$/.test(align))
      return refuse("SVG_ASPECT_RATIO_UNSUPPORTED");
    if (/slice$/.test(align)) return refuse("SVG_ASPECT_RATIO_SLICE_UNVERIFIED");
    const physicalWidthMm = unitValue(attr2("width")), physicalHeightMm = unitValue(attr2("height"));
    if (!physicalWidthMm || !physicalHeightMm)
      return refuse("SVG_EXPLICIT_PHYSICAL_SIZE_REQUIRED");
    const vb = attr2("viewBox");
    if (typeof vb !== "string") return refuse("SVG_VIEWBOX_REQUIRED");
    const parts = vb.trim().split(/[\s,]+/);
    if (parts.length !== 4) return refuse("SVG_VIEWBOX_INVALID");
    const [originX, originY, vbWidth, vbHeight] = parts.map(Number);
    if (![originX, originY, vbWidth, vbHeight].every(Number.isFinite) || vbWidth <= 0 || vbHeight <= 0) return refuse("SVG_VIEWBOX_INVALID");
    const xMmPerUnit = physicalWidthMm / vbWidth, yMmPerUnit = physicalHeightMm / vbHeight;
    if (!Number.isFinite(xMmPerUnit) || !Number.isFinite(yMmPerUnit))
      return refuse("SVG_COORDINATE_SCALE_INVALID");
    const relative = Math.abs(xMmPerUnit - yMmPerUnit) / Math.max(xMmPerUnit, yMmPerUnit);
    if (relative > 1e-6) return refuse("SVG_NONUNIFORM_OR_LETTERBOX_SCALE");
    return Object.freeze({
      schema: "printcheck.vision.svg-viewport.v1",
      status: "DOCUMENT_COORDINATES_ONLY",
      source: "svg-root-width-height-viewBox",
      svg_document_scale_proven: true,
      print_scale_proven: false,
      width_mm: physicalWidthMm,
      height_mm: physicalHeightMm,
      viewBox: Object.freeze({ minX: originX, minY: originY, width: vbWidth, height: vbHeight }),
      svg_units_to_mm: xMmPerUnit,
      warning: "Actual print placement and object transforms are not proven. Do not set scale_proven=true in final measurement."
    });
  }

  // vision/geometry/svg-path-subset.mjs
  var refused = (reason, more = {}) => ({ status: "MANUAL", reason, contours: [], ...more });
  var NUM = /[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?/y;
  var isCommand = (s) => /^[A-Za-z]$/.test(s);
  function tokensOf(d, maxTokens) {
    const tokens = [];
    let i = 0;
    while (i < d.length) {
      if (/\s|,/.test(d[i])) {
        i++;
        continue;
      }
      if (isCommand(d[i])) {
        tokens.push(d[i++]);
      } else {
        NUM.lastIndex = i;
        const m = NUM.exec(d);
        if (!m) return null;
        const v = Number(m[0]);
        if (!Number.isFinite(v) || Math.abs(v) > 1e8) return null;
        tokens.push(v);
        i = NUM.lastIndex;
      }
      if (tokens.length > maxTokens) return null;
    }
    return tokens;
  }
  var midpoint = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  function flatness(p0, p1, p2, p3) {
    const dx = p3.x - p0.x, dy = p3.y - p0.y, den = dx * dx + dy * dy;
    const distanceToChord = (p) => {
      if (den <= 1e-28) return Math.hypot(p.x - p0.x, p.y - p0.y);
      const t = Math.max(0, Math.min(1, ((p.x - p0.x) * dx + (p.y - p0.y) * dy) / den));
      return Math.hypot(p.x - (p0.x + t * dx), p.y - (p0.y + t * dy));
    };
    return Math.max(distanceToChord(p1), distanceToChord(p2));
  }
  function cubicToPolyline(p0, p1, p2, p3, eps, depth, emit) {
    if (flatness(p0, p1, p2, p3) <= eps) {
      emit(p3);
      return;
    }
    if (depth <= 0) throw new Error("CURVE_FLATTEN_DEPTH_EXCEEDED");
    const p01 = midpoint(p0, p1), p12 = midpoint(p1, p2), p23 = midpoint(p2, p3);
    const p012 = midpoint(p01, p12), p123 = midpoint(p12, p23), p = midpoint(p012, p123);
    cubicToPolyline(p0, p01, p012, p, eps, depth - 1, emit);
    cubicToPolyline(p, p123, p23, p3, eps, depth - 1, emit);
  }
  function arcToPolyline(start, rx, ry, rotation, largeFlag, sweepFlag, end, eps, emit, maxSegments) {
    if (!(rx > 0 && ry > 0) || ![rx, ry, rotation].every(Number.isFinite) || !(largeFlag === 0 || largeFlag === 1) || !(sweepFlag === 0 || sweepFlag === 1))
      throw new Error("SVG_ARC_PARAMETERS_INVALID");
    if (rx > 1e8 || ry > 1e8 || start.x === end.x && start.y === end.y)
      throw new Error("SVG_ARC_DEGENERATE_OR_OVERSIZED");
    const phi = rotation * Math.PI / 180, cosPhi = Math.cos(phi), sinPhi = Math.sin(phi);
    const dx = (start.x - end.x) / 2, dy = (start.y - end.y) / 2;
    const xp = cosPhi * dx + sinPhi * dy, yp = -sinPhi * dx + cosPhi * dy;
    const correction = Math.sqrt(xp * xp / (rx * rx) + yp * yp / (ry * ry));
    if (!Number.isFinite(correction)) throw new Error("SVG_ARC_PARAMETERS_INVALID");
    if (correction > 1) {
      rx *= correction;
      ry *= correction;
    }
    const rx2 = rx * rx, ry2 = ry * ry, xp2 = xp * xp, yp2 = yp * yp;
    const denom = rx2 * yp2 + ry2 * xp2;
    if (!(denom > 1e-24)) throw new Error("SVG_ARC_DEGENERATE_OR_OVERSIZED");
    const ratio = Math.max(0, (rx2 * ry2 - denom) / denom);
    const sign = largeFlag === sweepFlag ? -1 : 1;
    const factor = sign * Math.sqrt(ratio);
    const cxp = factor * (rx * yp / ry), cyp = factor * (-ry * xp / rx);
    const cx = cosPhi * cxp - sinPhi * cyp + (start.x + end.x) / 2;
    const cy = sinPhi * cxp + cosPhi * cyp + (start.y + end.y) / 2;
    const ux = (xp - cxp) / rx, uy = (yp - cyp) / ry;
    const vx = (-xp - cxp) / rx, vy = (-yp - cyp) / ry;
    const begin = Math.atan2(uy, ux);
    let delta = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
    if (sweepFlag === 0 && delta > 0) delta -= 2 * Math.PI;
    if (sweepFlag === 1 && delta < 0) delta += 2 * Math.PI;
    const maxRadius = Math.max(rx, ry);
    const angleBound = 2 * Math.acos(Math.max(-1, Math.min(1, 1 - eps / maxRadius)));
    const maxStep = Math.min(Math.PI / 6, angleBound);
    if (!(maxStep > 0) || !Number.isFinite(maxStep))
      throw new Error("SVG_ARC_ERROR_BUDGET_UNREACHABLE");
    const steps = Math.max(1, Math.ceil(Math.abs(delta) / maxStep));
    if (!Number.isSafeInteger(steps) || steps > maxSegments)
      throw new Error("SVG_ARC_SEGMENT_BUDGET_EXCEEDED");
    for (let i = 1; i <= steps; i++) {
      if (i === steps) {
        emit(end);
        continue;
      }
      const t = begin + delta * i / steps;
      const ct = Math.cos(t), st = Math.sin(t);
      emit({
        x: cx + rx * cosPhi * ct - ry * sinPhi * st,
        y: cy + rx * sinPhi * ct + ry * cosPhi * st
      });
    }
  }
  function same(a, b) {
    return a.x === b.x && a.y === b.y;
  }
  function parseClosedSvgPath(d, options = {}) {
    if (typeof d !== "string" || !d.trim()) return refused("EMPTY_PATH");
    const maxTokens = options.max_tokens ?? 1e4, maxSegments = options.max_segments ?? 4096;
    const errorBudget = options.flatness_user_units ?? 2e-3;
    if (!Number.isSafeInteger(maxTokens) || maxTokens < 2 || maxTokens > 1e5 || !Number.isSafeInteger(maxSegments) || maxSegments < 3 || maxSegments > 2e4 || typeof errorBudget !== "number" || !Number.isFinite(errorBudget) || errorBudget <= 0 || errorBudget > 10) return refused("INVALID_FLATTEN_OPTIONS");
    const tokens = tokensOf(d, maxTokens);
    if (!tokens || tokens.length === 0) return refused("INVALID_PATH_DATA");
    const supported = /* @__PURE__ */ new Set(["M", "L", "H", "V", "C", "S", "Q", "T", "A", "Z"]);
    let i = 0, command = null, position = { x: 0, y: 0 }, start = null, points = null, contours = [], count2 = 0, curveSegments = 0;
    let lastCubicControl = null, lastQuadControl = null;
    const resetSmooth = () => {
      lastCubicControl = null;
      lastQuadControl = null;
    };
    const reflected = (control) => control ? { x: 2 * position.x - control.x, y: 2 * position.y - control.y } : { ...position };
    const emit = (p) => {
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) throw new Error("NONFINITE_COORDINATE");
      if (Math.abs(p.x) > 1e8 || Math.abs(p.y) > 1e8) throw new Error("COORDINATE_RANGE_EXCEEDED");
      if (!points) throw new Error("PATH_SUBPATH_NOT_STARTED");
      if (!same(points[points.length - 1], p)) {
        points.push(p);
        count2++;
      }
      if (count2 > maxSegments) throw new Error("PATH_SEGMENT_BUDGET_EXCEEDED");
    };
    const scalar = () => {
      const v = tokens[i++];
      if (typeof v !== "number") throw new Error("MISSING_PATH_ARGUMENT");
      return v;
    };
    const target = (relative) => {
      const x = scalar(), y = scalar();
      return relative ? { x: position.x + x, y: position.y + y } : { x, y };
    };
    try {
      while (i < tokens.length) {
        if (isCommand(String(tokens[i]))) {
          if (typeof tokens[i] === "string") {
            command = tokens[i++];
            if (!supported.has(command.toUpperCase())) return refused("UNSUPPORTED_SVG_COMMAND", { command });
          }
        } else if (!command) return refused("PATH_EXPECTED_COMMAND");
        if (!command) break;
        const upper = command.toUpperCase(), rel = command !== upper;
        if (upper === "Z") {
          if (!points || points.length < 3) return refused("DEGENERATE_OR_OPEN_SUBPATH");
          if (points.length > 3 && same(points[points.length - 1], start)) points.pop();
          contours.push({ points, closed: true });
          points = null;
          position = { ...start };
          start = null;
          command = null;
          resetSmooth();
          continue;
        }
        if (i >= tokens.length || typeof tokens[i] !== "number")
          return refused("MISSING_PATH_ARGUMENT");
        if (upper === "M") {
          if (points) return refused("UNCLOSED_SUBPATH");
          const p = target(rel);
          position = p;
          start = { ...p };
          points = [{ ...p }];
          resetSmooth();
          command = rel ? "l" : "L";
          continue;
        }
        if (upper === "L") {
          const p = target(rel);
          emit(p);
          position = p;
          resetSmooth();
          continue;
        }
        if (upper === "H") {
          const x = scalar(), p = { x: rel ? position.x + x : x, y: position.y };
          emit(p);
          position = p;
          resetSmooth();
          continue;
        }
        if (upper === "V") {
          const y = scalar(), p = { x: position.x, y: rel ? position.y + y : y };
          emit(p);
          position = p;
          resetSmooth();
          continue;
        }
        if (upper === "C") {
          const c1 = target(rel), c2 = target(rel), end = target(rel);
          const before = count2;
          cubicToPolyline(position, c1, c2, end, errorBudget, 14, emit);
          curveSegments += count2 - before;
          position = end;
          lastCubicControl = c2;
          lastQuadControl = null;
          continue;
        }
        if (upper === "S") {
          const c1 = reflected(lastCubicControl);
          const c2 = target(rel), end = target(rel);
          const before = count2;
          cubicToPolyline(position, c1, c2, end, errorBudget, 14, emit);
          curveSegments += count2 - before;
          position = end;
          lastCubicControl = c2;
          lastQuadControl = null;
          continue;
        }
        if (upper === "Q") {
          const c = target(rel), end = target(rel);
          const c1 = { x: position.x + (c.x - position.x) * 2 / 3, y: position.y + (c.y - position.y) * 2 / 3 };
          const c2 = { x: end.x + (c.x - end.x) * 2 / 3, y: end.y + (c.y - end.y) * 2 / 3 };
          const before = count2;
          cubicToPolyline(position, c1, c2, end, errorBudget, 14, emit);
          curveSegments += count2 - before;
          position = end;
          lastQuadControl = c;
          lastCubicControl = null;
          continue;
        }
        if (upper === "A") {
          const rx = scalar(), ry = scalar(), rotation = scalar(), large = scalar(), sweep = scalar(), end = target(rel);
          const before = count2;
          arcToPolyline(
            position,
            rx,
            ry,
            rotation,
            large,
            sweep,
            end,
            errorBudget,
            emit,
            maxSegments - count2
          );
          curveSegments += count2 - before;
          position = end;
          resetSmooth();
          continue;
        }
        if (upper === "T") {
          const c = reflected(lastQuadControl);
          const end = target(rel);
          const c1 = { x: position.x + (c.x - position.x) * 2 / 3, y: position.y + (c.y - position.y) * 2 / 3 };
          const c2 = { x: end.x + (c.x - end.x) * 2 / 3, y: end.y + (c.y - end.y) * 2 / 3 };
          const before = count2;
          cubicToPolyline(position, c1, c2, end, errorBudget, 14, emit);
          curveSegments += count2 - before;
          position = end;
          lastQuadControl = c;
          lastCubicControl = null;
          continue;
        }
      }
      if (points) return refused("UNCLOSED_SUBPATH");
      if (contours.length === 0) return refused("PATH_NO_CLOSED_CONTOURS");
      return {
        status: "CONTOURS_ONLY",
        schema: "printcheck.vision.svg-path-subset.v1",
        contours,
        curve_segments: curveSegments,
        flatness_user_units: errorBudget,
        warning: "The source style, grouping, fill-rule and print placement are not verified by this parser."
      };
    } catch (e) {
      return refused(e.message || "PATH_PARSER_FAILED");
    }
  }

  // vision/geometry/vector-corridors.mjs
  var bad = (reason, extra = {}) => ({
    schema: "printcheck.vision.vector-corridors.v1",
    status: "MANUAL",
    reason,
    candidates: [],
    geometry_proven: false,
    print_scale_proven: false,
    ...extra
  });
  var hypot = Math.hypot;
  var finite = (x) => typeof x === "number" && Number.isFinite(x);
  var between = (p, q, t) => ({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t });
  var subtract = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
  var dot = (u, v) => u.x * v.x + u.y * v.y;
  var cross = (u, v) => u.x * v.y - u.y * v.x;
  var distance = (u, v) => hypot(u.x - v.x, u.y - v.y);
  var same2 = (p, q, eps = 1e-9) => distance(p, q) <= eps;
  var segmentPointDistance = (p, a, b) => {
    const v = subtract(b, a), den = dot(v, v);
    if (den <= 1e-30) return distance(p, a);
    const t = Math.max(0, Math.min(1, dot(subtract(p, a), v) / den));
    return distance(p, between(a, b, t));
  };
  function isOnSegment(p, a, b) {
    return segmentPointDistance(p, a, b) <= 1e-9;
  }
  function intersects(a, b, c, d) {
    const ab = subtract(b, a), cd = subtract(d, c), p = subtract(c, a);
    const denom = cross(ab, cd);
    if (Math.abs(denom) > 1e-12) {
      const t = cross(p, cd) / denom, s = cross(p, ab) / denom;
      return t >= -1e-10 && t <= 1 + 1e-10 && s >= -1e-10 && s <= 1 + 1e-10;
    }
    if (Math.abs(cross(p, ab)) > 1e-9 * hypot(ab.x, ab.y)) return false;
    return isOnSegment(c, a, b) || isOnSegment(d, a, b) || isOnSegment(a, c, d) || isOnSegment(b, c, d);
  }
  function buildSegmentGrid(bounds, maxLinks) {
    const n = bounds.length;
    const minX = Math.min(...bounds.map((b) => b.minX));
    const minY = Math.min(...bounds.map((b) => b.minY));
    const maxX = Math.max(...bounds.map((b) => b.maxX));
    const maxY = Math.max(...bounds.map((b) => b.maxY));
    const bins = Math.min(32, Math.max(2, Math.ceil(Math.sqrt(n))));
    const nx = bins, ny = bins;
    const stepX = Math.max((maxX - minX) / nx, 1e-12);
    const stepY = Math.max((maxY - minY) / ny, 1e-12);
    const clamp = (v, hi) => Math.min(hi, Math.max(0, v));
    const rx = (lo, hi) => [
      clamp(Math.floor((lo - minX) / stepX), nx - 1),
      clamp(Math.floor((hi - minX) / stepX), nx - 1)
    ];
    const ry = (lo, hi) => [
      clamp(Math.floor((lo - minY) / stepY), ny - 1),
      clamp(Math.floor((hi - minY) / stepY), ny - 1)
    ];
    const cells = /* @__PURE__ */ new Map();
    let links = 0;
    for (let i = 0; i < n; i++) {
      const b = bounds[i], xx = rx(b.minX, b.maxX), yy = ry(b.minY, b.maxY);
      links += (xx[1] - xx[0] + 1) * (yy[1] - yy[0] + 1);
      if (links > maxLinks) return null;
      for (let x = xx[0]; x <= xx[1]; x++) {
        for (let y = yy[0]; y <= yy[1]; y++) {
          const cell = y * nx + x, existing = cells.get(cell);
          if (existing) existing.push(i);
          else cells.set(cell, [i]);
        }
      }
    }
    function query(i, padding) {
      const a = bounds[i], minQX = a.minX - padding, maxQX = a.maxX + padding;
      const minQY = a.minY - padding, maxQY = a.maxY + padding;
      const xx = rx(minQX, maxQX), yy = ry(minQY, maxQY);
      const seen = /* @__PURE__ */ new Set(), found = [];
      for (let x = xx[0]; x <= xx[1]; x++) {
        for (let y = yy[0]; y <= yy[1]; y++) {
          for (const j of cells.get(y * nx + x) || []) {
            if (j <= i || seen.has(j)) continue;
            seen.add(j);
            const b = bounds[j];
            if (b.maxX < minQX || b.minX > maxQX || b.maxY < minQY || b.minY > maxQY) continue;
            found.push(j);
          }
        }
      }
      return found.sort((a2, b) => a2 - b);
    }
    return { query, links, cells: cells.size };
  }
  function isAdjacent(a, b, sizes) {
    if (a.ring !== b.ring) return false;
    const n = sizes[a.ring];
    return a.index === b.index || (a.index + 1) % n === b.index || (b.index + 1) % n === a.index;
  }
  function insideRing(p, points) {
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const a = points[i], b = points[j];
      if (isOnSegment(p, a, b)) return null;
      if (a.y > p.y !== b.y > p.y) {
        const x = a.x + (p.y - a.y) * (b.x - a.x) / (b.y - a.y);
        if (x > p.x) inside = !inside;
      }
    }
    return inside;
  }
  function evenOdd(p, rings, ringBounds) {
    let inside = false;
    for (let k = 0; k < rings.length; k++) {
      const box = ringBounds[k];
      if (p.x < box.minX - 1e-9 || p.x > box.maxX + 1e-9 || p.y < box.minY - 1e-9 || p.y > box.maxY + 1e-9) continue;
      const result = insideRing(p, rings[k]);
      if (result === null) return null;
      if (result) inside = !inside;
    }
    return inside;
  }
  function inspectVectorCorridors(options = {}) {
    const matrix = options.matrix_svg_to_mm;
    if (!Array.isArray(matrix) || matrix.length !== 6 || !matrix.every(finite))
      return bad("PHYSICAL_MATRIX_REQUIRED");
    const [a, b, c, d, e, f] = matrix;
    const det = a * d - b * c;
    if (!Number.isFinite(det) || Math.abs(det) < 1e-15)
      return bad("SINGULAR_PLACEMENT_MATRIX");
    const maxSegments = options.max_segments ?? 768, maxCandidates = options.max_candidates ?? 100;
    const minSupport = options.min_support_mm ?? 0.2, maxWidth = options.max_candidate_mm ?? 3;
    const angle = options.angle_tolerance_degrees ?? 4;
    const flatness2 = options.curve_flatness_mm ?? 0;
    if (!Number.isSafeInteger(maxSegments) || maxSegments < 3 || maxSegments > 2048 || !Number.isSafeInteger(maxCandidates) || maxCandidates < 1 || maxCandidates > 1e3 || !finite(minSupport) || minSupport <= 0 || minSupport > 100 || !finite(maxWidth) || maxWidth <= 0 || maxWidth > 100 || !finite(angle) || angle <= 0 || angle > 10 || !finite(flatness2) || flatness2 < 0 || flatness2 > 0.1)
      return bad("INVALID_NUMERICAL_LIMITS");
    if (options.fill_rule !== "evenodd") return bad("EXPLICIT_EVENODD_FILL_REQUIRED");
    const original = options.contours;
    if (!Array.isArray(original) || original.length === 0 || original.length > 128)
      return bad("CONTOURS_REQUIRED");
    const rings = [], ringBounds = [], edges = [], sizes = [];
    const transform = (p) => ({ x: a * p.x + c * p.y + e, y: b * p.x + d * p.y + f });
    for (let k = 0; k < original.length; k++) {
      const item = original[k];
      if (!Array.isArray(item?.points) || item.points.length < 3)
        return bad("INVALID_CONTOUR");
      let pts = item.points.map((p) => {
        if (!p || !finite(p.x) || !finite(p.y) || Math.max(Math.abs(p.x), Math.abs(p.y)) > 1e8)
          return null;
        const point2 = transform(p);
        return finite(point2.x) && finite(point2.y) && Math.max(Math.abs(point2.x), Math.abs(point2.y)) < 1e8 ? point2 : null;
      });
      if (pts.some((p) => !p)) return bad("INVALID_COORDINATE");
      if (same2(pts[0], pts[pts.length - 1])) pts = pts.slice(0, -1);
      if (pts.length < 3) return bad("DEGENERATE_CONTOUR");
      const area2 = pts.reduce((sum, p, i) => sum + cross(p, pts[(i + 1) % pts.length]), 0);
      if (Math.abs(area2) < 1e-10) return bad("ZERO_AREA_CONTOUR");
      if (pts.some((p, i) => same2(p, pts[(i + 1) % pts.length])))
        return bad("DEGENERATE_EDGE");
      sizes.push(pts.length);
      rings.push(pts);
      ringBounds.push({
        minX: Math.min(...pts.map((p) => p.x)),
        maxX: Math.max(...pts.map((p) => p.x)),
        minY: Math.min(...pts.map((p) => p.y)),
        maxY: Math.max(...pts.map((p) => p.y))
      });
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i], q = pts[(i + 1) % pts.length], len = distance(p, q);
        if (len < 1e-9) return bad("DEGENERATE_EDGE");
        edges.push({ ring: k, index: i, p, q, len, u: { x: (q.x - p.x) / len, y: (q.y - p.y) / len } });
      }
      if (edges.length > maxSegments) return bad("EDGE_BUDGET_EXCEEDED");
    }
    const edgeBounds = edges.map((edge) => ({
      minX: Math.min(edge.p.x, edge.q.x),
      maxX: Math.max(edge.p.x, edge.q.x),
      minY: Math.min(edge.p.y, edge.q.y),
      maxY: Math.max(edge.p.y, edge.q.y)
    }));
    const indexEnabled = options.pair_index !== "reference";
    if (options.pair_index !== void 0 && options.pair_index !== "grid" && options.pair_index !== "reference")
      return bad("PAIR_INDEX_MODE_INVALID");
    const maxIndexLinks = options.max_index_links ?? Math.max(16384, edges.length * 64);
    if (!Number.isSafeInteger(maxIndexLinks) || maxIndexLinks < 1 || maxIndexLinks > 1e6)
      return bad("SPATIAL_INDEX_BUDGET_INVALID");
    const spatial = indexEnabled ? buildSegmentGrid(edgeBounds, maxIndexLinks) : null;
    const pairMode = !indexEnabled ? "reference" : spatial ? "grid" : "reference_fallback";
    const boxEpsilon = Math.max(
      1e-8,
      1e-10 * Math.max(1, ...edgeBounds.flatMap((b2) => [Math.abs(b2.minX), Math.abs(b2.maxX), Math.abs(b2.minY), Math.abs(b2.maxY)]))
    );
    function* segmentPairs(padding) {
      for (let i = 0; i < edges.length; i++) {
        if (spatial) {
          for (const j of spatial.query(i, padding)) yield [i, j];
        } else {
          for (let j = i + 1; j < edges.length; j++) yield [i, j];
        }
      }
    }
    let intersectionPairChecks = 0, corridorPairChecks = 0;
    for (const [i, j] of segmentPairs(boxEpsilon)) {
      if (isAdjacent(edges[i], edges[j], sizes)) continue;
      intersectionPairChecks++;
      if (intersects(edges[i].p, edges[i].q, edges[j].p, edges[j].q))
        return bad("SELF_INTERSECTION_OR_TOUCHING_CONTOURS");
    }
    const candidates = [], angleMin = Math.cos(angle * Math.PI / 180);
    let rejectedTapers = 0, rejectedAmbiguous = 0, possible = 0, truncated = false;
    for (const [i, j] of segmentPairs(maxWidth + boxEpsilon)) {
      corridorPairChecks++;
      const A = edges[i], U = A.u;
      const B = edges[j], V = B.u;
      if (isAdjacent(A, B, sizes)) continue;
      const cosine = dot(U, V);
      if (Math.abs(cosine) < angleMin) continue;
      const relB0 = dot(subtract(B.p, A.p), U), relB1 = dot(subtract(B.q, A.p), U);
      const lower = Math.max(0, Math.min(relB0, relB1));
      const upper = Math.min(A.len, Math.max(relB0, relB1));
      const support = upper - lower;
      if (support + 1e-10 < minSupport) continue;
      const sample = (s) => {
        const P = { x: A.p.x + U.x * s, y: A.p.y + U.y * s };
        const t = dot(subtract(P, B.p), U) / cosine;
        const Q = { x: B.p.x + V.x * t, y: B.p.y + V.y * t };
        return { P, Q, w: Math.abs(cross(U, subtract(Q, P))) };
      };
      const lo = sample(lower), hi = sample(upper), mid = sample((lower + upper) / 2);
      if (lo.w < 1e-9 || hi.w < 1e-9) {
        rejectedAmbiguous++;
        continue;
      }
      const width = Math.max(lo.w, hi.w, mid.w);
      if (width > maxWidth) continue;
      possible++;
      if (Math.abs(lo.w - hi.w) > Math.max(5e-3, 0.025 * width)) {
        rejectedTapers++;
        continue;
      }
      const fractions = [0.2, 0.5, 0.8];
      let filled = null, consistent = true;
      for (const frac of fractions) {
        const probe = sample(lower + (upper - lower) * frac);
        for (const within of [0.2, 0.5, 0.8]) {
          const inside = evenOdd(between(probe.P, probe.Q, within), rings, ringBounds);
          if (inside === null) {
            consistent = false;
            break;
          }
          if (filled === null) filled = inside;
          if (inside !== filled) {
            consistent = false;
            break;
          }
        }
        if (!consistent) break;
      }
      if (!consistent || filled === null) {
        rejectedAmbiguous++;
        continue;
      }
      const estimate = (lo.w + hi.w + mid.w) / 3;
      const uncertainty = Math.max(flatness2 * 2, (Math.max(lo.w, hi.w, mid.w) - Math.min(lo.w, hi.w, mid.w)) / 2);
      candidates.push({
        kind: filled ? "positive_width_mm" : "negative_gap_mm",
        measured_mm: estimate,
        uncertainty_mm: uncertainty,
        local_support_mm: support,
        wall_segments: [{ ring: A.ring, edge: A.index }, { ring: B.ring, edge: B.index }],
        at_mm: between(mid.P, mid.Q, 0.5),
        method: "parallel_walls_exact_segments",
        geometry_proven: false,
        scale_proven: false,
        warning: "Local corridor candidate, not full-artwork minimum or production proof"
      });
    }
    candidates.sort((x, y) => x.measured_mm - y.measured_mm);
    if (candidates.length > maxCandidates) {
      candidates.length = maxCandidates;
      truncated = true;
    }
    return {
      schema: "printcheck.vision.vector-corridors.v1",
      status: "RESEARCH_CANDIDATES_ONLY",
      units: "mm",
      fill_rule: "evenodd",
      geometry_proven: false,
      print_scale_proven: false,
      scope: "local_parallel_corridors_not_global_minimum",
      source_matrix_used: matrix.slice(),
      candidate_count: candidates.length,
      candidates,
      rejected_tapers: rejectedTapers,
      rejected_ambiguous: rejectedAmbiguous,
      possible_pairs: possible,
      pair_search: Object.freeze({
        mode: pairMode,
        edges: edges.length,
        exhaustive_pair_count: edges.length * (edges.length - 1) / 2,
        intersection_pair_checks: intersectionPairChecks,
        corridor_pair_checks: corridorPairChecks,
        index_cells: spatial?.cells ?? 0,
        index_links: spatial?.links ?? 0
      }),
      truncated,
      warnings: [
        "unverified_source_shapes_and_placement",
        "nonparallel_walls_and_curves_require_additional_methods",
        "not_all_negative_gaps_are_printing_errors",
        "cannot_mark_artwork_as_passed",
        ...truncated ? ["candidate_budget_exceeded_results_truncated"] : []
      ]
    };
  }

  // vision/geometry/curved-normal-probes.mjs
  var MANUAL = (reason, extra = {}) => ({
    schema: "printcheck.vision.curved-normal-probes.v1",
    status: "MANUAL",
    reason,
    geometry_proven: false,
    print_scale_proven: false,
    candidates: [],
    ...extra
  });
  var finite2 = (x) => typeof x === "number" && Number.isFinite(x);
  var cross2 = (a, b) => a.x * b.y - a.y * b.x;
  var dot2 = (a, b) => a.x * b.x + a.y * b.y;
  var sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
  var along = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  var length = (v) => Math.hypot(v.x, v.y);
  var close = (a, b) => length(sub(a, b)) <= 1e-9;
  var angleCos = (degrees) => Math.cos(degrees * Math.PI / 180);
  function polygonState(p, rings, bounds) {
    let inside = false;
    for (let r = 0; r < rings.length; r++) {
      const bb = bounds[r];
      if (p.x < bb[0] - 1e-9 || p.x > bb[2] + 1e-9 || p.y < bb[1] - 1e-9 || p.y > bb[3] + 1e-9) continue;
      const ring = rings[r];
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const a = ring[i], b = ring[j], v = sub(b, a), den = dot2(v, v);
        const t = Math.max(0, Math.min(1, dot2(sub(p, a), v) / den));
        if (length(sub(p, along(a, b, t))) <= 1e-9) return null;
        if (a.y > p.y !== b.y > p.y) {
          const x = a.x + (p.y - a.y) * (b.x - a.x) / (b.y - a.y);
          if (x > p.x) inside = !inside;
        }
      }
    }
    return inside;
  }
  function segmentsOf(rings) {
    const seg = [], byRing = [];
    for (let r = 0; r < rings.length; r++) {
      const pts = rings[r], seq = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length], v = sub(b, a), len = length(v);
        const id = seg.length;
        seg.push({
          id,
          ring: r,
          index: i,
          a,
          b,
          len,
          u: { x: v.x / len, y: v.y / len },
          bbox: [
            Math.min(a.x, b.x),
            Math.min(a.y, b.y),
            Math.max(a.x, b.x),
            Math.max(a.y, b.y)
          ]
        });
        seq.push(id);
      }
      byRing.push(seq);
    }
    return { seg, byRing };
  }
  function closeAlongRing(src, dst, ringSize) {
    return src.ring === dst.ring && Math.min(
      (src.index - dst.index + ringSize) % ringSize,
      (dst.index - src.index + ringSize) % ringSize
    ) <= 2;
  }
  function hitAlongNormal(P, N, source, segments, ringSizes, maxWidth, parallelCos) {
    const hits = [];
    for (const target of segments) {
      if (closeAlongRing(source, target, ringSizes[source.ring])) continue;
      const box = target.bbox;
      const Q = { x: P.x + N.x * maxWidth, y: P.y + N.y * maxWidth };
      if (Math.max(P.x, Q.x) < box[0] - 1e-9 || Math.min(P.x, Q.x) > box[2] + 1e-9 || Math.max(P.y, Q.y) < box[1] - 1e-9 || Math.min(P.y, Q.y) > box[3] + 1e-9)
        continue;
      const v = sub(target.b, target.a), det = cross2(N, v);
      if (Math.abs(det) <= 1e-12) continue;
      const offset = sub(target.a, P);
      const dist = cross2(offset, v) / det;
      const pos = cross2(offset, N) / det;
      if (dist <= 1e-6 || dist > maxWidth + 1e-9 || pos < -1e-9 || pos > 1 + 1e-9) continue;
      if (pos <= 0.04 || pos >= 0.96) continue;
      if (Math.abs(dot2(source.u, target.u)) < parallelCos) continue;
      hits.push({ dist, target: target.id, point: along(P, { x: P.x + N.x * dist, y: P.y + N.y * dist }, 1) });
    }
    if (hits.length === 0) return null;
    hits.sort((a, b) => a.dist - b.dist || a.target - b.target);
    if (hits.length > 1 && hits[1].dist - hits[0].dist <= 1e-5)
      return { ambiguous: true };
    return hits[0];
  }
  function inspectCurvedNormalProbes(options = {}) {
    const maxSegments = options.max_segments ?? 768;
    const maxCandidates = options.max_candidates ?? 120;
    const maxWidth = options.max_candidate_mm ?? 2;
    const minSupport = options.min_support_mm ?? 0.2;
    const maxTurn = options.max_turn_degrees ?? 26;
    const wallAngle = options.wall_angle_degrees ?? 32;
    const maxVariation = options.max_width_variation ?? 0.12;
    const flatness2 = options.curve_flatness_mm ?? 0;
    if (!Number.isSafeInteger(maxSegments) || maxSegments < 3 || maxSegments > 2048 || !Number.isSafeInteger(maxCandidates) || maxCandidates < 1 || maxCandidates > 1e3 || !finite2(maxWidth) || maxWidth <= 0 || maxWidth > 20 || !finite2(minSupport) || minSupport <= 0 || minSupport > 20 || !finite2(maxTurn) || maxTurn <= 0 || maxTurn > 45 || !finite2(wallAngle) || wallAngle <= 0 || wallAngle > 45 || !finite2(maxVariation) || maxVariation <= 0 || maxVariation > 0.5 || !finite2(flatness2) || flatness2 < 0 || flatness2 > 0.1)
      return MANUAL("NORMAL_PROBE_OPTIONS_INVALID");
    const preflight = inspectVectorCorridors({
      contours: options.contours,
      matrix_svg_to_mm: options.matrix_svg_to_mm,
      fill_rule: options.fill_rule,
      max_segments: maxSegments,
      max_candidates: 1,
      max_candidate_mm: maxWidth,
      curve_flatness_mm: flatness2
    });
    if (preflight.status !== "RESEARCH_CANDIDATES_ONLY")
      return MANUAL("NORMAL_PROBE_CONTOUR_PREFLIGHT_FAILED", { detail: preflight.reason });
    const rings = [];
    const [a, b, c, d, e, f] = options.matrix_svg_to_mm;
    for (const item of options.contours) {
      const pts = item.points.map((p) => ({ x: a * p.x + c * p.y + e, y: b * p.x + d * p.y + f }));
      if (close(pts[0], pts[pts.length - 1])) pts.pop();
      rings.push(pts);
    }
    const bounds = rings.map((r) => r.reduce((bb, p) => [
      Math.min(bb[0], p.x),
      Math.min(bb[1], p.y),
      Math.max(bb[2], p.x),
      Math.max(bb[3], p.y)
    ], [Infinity, Infinity, -Infinity, -Infinity]));
    const { seg, byRing } = segmentsOf(rings), cosTurn = angleCos(maxTurn);
    const parallelCos = angleCos(wallAngle), candidates = [];
    let skippedCorners = 0, skippedTapers = 0, skippedAmbiguous = 0, examinedWindows = 0;
    for (let ring = 0; ring < byRing.length; ring++) {
      const ids = byRing[ring], n = ids.length;
      if (n < 6) continue;
      for (let i = 0; i < n; i++) {
        const left = seg[ids[(i + n - 1) % n]], mid = seg[ids[i]], right = seg[ids[(i + 1) % n]];
        if (left.len + mid.len + right.len < minSupport) continue;
        if (dot2(left.u, mid.u) < cosTurn || dot2(mid.u, right.u) < cosTurn) {
          skippedCorners++;
          continue;
        }
        examinedWindows++;
        for (const side of [-1, 1]) {
          const probes = [];
          let okay = true;
          for (const source of [left, mid, right]) {
            const P = along(source.a, source.b, 0.5);
            const N = { x: -source.u.y * side, y: source.u.x * side };
            const hit = hitAlongNormal(
              P,
              N,
              source,
              seg,
              ids.length ? byRing.map((x) => x.length) : [],
              maxWidth,
              parallelCos
            );
            if (!hit || hit.ambiguous) {
              okay = false;
              break;
            }
            const midpoint2 = along(P, hit.point, 0.5);
            const state = polygonState(midpoint2, rings, bounds);
            if (state === null) {
              okay = false;
              break;
            }
            probes.push({ source, origin: P, hit, state, midpoint: midpoint2 });
          }
          if (!okay) {
            skippedAmbiguous++;
            continue;
          }
          if (probes.some((p) => p.state !== probes[0].state)) {
            skippedAmbiguous++;
            continue;
          }
          const widths = probes.map((p) => p.hit.dist);
          const mean = widths.reduce((s, x) => s + x, 0) / 3;
          const range = Math.max(...widths) - Math.min(...widths);
          if (range > Math.max(8e-3, maxVariation * mean)) {
            skippedTapers++;
            continue;
          }
          const center = probes[1];
          candidates.push({
            kind: center.state ? "positive_width_mm" : "negative_gap_mm",
            measured_mm: mean,
            uncertainty_mm: Math.max(flatness2 * 2, range / 2),
            local_support_mm: left.len + mid.len + right.len,
            at_mm: center.midpoint,
            wall_segments: [
              { ring: mid.ring, edge: mid.index },
              {
                ring: seg[center.hit.target].ring,
                edge: seg[center.hit.target].index
              }
            ],
            sampling: "three_adjacent_boundary_normals",
            geometry_proven: false,
            scale_proven: false,
            warning: "Local stable normal-ray estimate; not medial axis or global minimum"
          });
        }
      }
    }
    candidates.sort((x, y) => x.measured_mm - y.measured_mm || x.wall_segments[0].ring - y.wall_segments[0].ring || x.wall_segments[0].edge - y.wall_segments[0].edge);
    const detected = candidates.length, truncated = detected > maxCandidates;
    if (truncated) candidates.length = maxCandidates;
    return {
      schema: "printcheck.vision.curved-normal-probes.v1",
      status: "RESEARCH_CANDIDATES_ONLY",
      geometry_proven: false,
      print_scale_proven: false,
      units: "mm",
      method: "stable_three_normal_ray_support",
      candidates,
      curve_flatness_mm: flatness2,
      candidate_count: candidates.length,
      total_candidate_count: detected,
      examined_windows: examinedWindows,
      skipped_corners: skippedCorners,
      skipped_tapers: skippedTapers,
      skipped_ambiguous: skippedAmbiguous,
      truncated,
      warnings: [
        "local_samples_can_miss_thinner_regions_between_samples",
        "not_exact_medial_axis_or_full_minimum_thickness",
        "printing_technique_and_artwork_scale_require_independent_attestation",
        "not_a_production_quality_verdict",
        ...truncated ? ["truncated_candidates_require_manual_review"] : []
      ]
    };
  }

  // vision/geometry/svg-dom-vector-bridge.mjs
  var reject = (reason, more = {}) => ({
    schema: "printcheck.vision.svg-dom-bridge.v1",
    status: "MANUAL",
    reason,
    candidates: [],
    print_scale_proven: false,
    geometry_proven: false,
    ...more
  });
  var finite3 = (v) => typeof v === "number" && Number.isFinite(v);
  var mul = (m, n) => [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5]
  ];
  var identity = [1, 0, 0, 1, 0, 0];
  var invertible = (m) => Array.isArray(m) && m.length === 6 && m.every(finite3) && Math.abs(m[0] * m[3] - m[1] * m[2]) > 1e-14;
  var limit = (m) => m.every((x) => Math.abs(x) <= 1e8);
  var point = (p, m) => ({ x: m[0] * p.x + m[2] * p.y + m[4], y: m[1] * p.x + m[3] * p.y + m[5] });
  var scaleBound = (m) => Math.hypot(Math.hypot(m[0], m[1]), Math.hypot(m[2], m[3]));
  var allowedRoot = /* @__PURE__ */ new Set(["width", "height", "viewBox", "preserveAspectRatio", "xmlns", "version", "id"]);
  var allowedGroup = /* @__PURE__ */ new Set(["transform", "fill", "fill-rule", "stroke", "id"]);
  var allowedPath = /* @__PURE__ */ new Set(["d", "transform", "fill", "fill-rule", "stroke", "id"]);
  function attrsAllowed(element, allowed2) {
    const names = typeof element.getAttributeNames === "function" ? element.getAttributeNames() : null;
    return Array.isArray(names) && names.every((name) => allowed2.has(name));
  }
  function parseSvgAffineTransform(value) {
    if (value === null || value === void 0) return identity.slice();
    if (typeof value !== "string" || !value.trim() || value.length > 512) return null;
    const re = /([A-Za-z]+)\s*\(\s*([^)]*?)\s*\)/g;
    const num = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;
    let i = 0, m = identity.slice(), match, count2 = 0;
    while (match = re.exec(value)) {
      if (!/^[\s,]*$/.test(value.slice(i, match.index))) return null;
      i = re.lastIndex;
      count2++;
      if (count2 > 24) return null;
      const values = match[2].trim().split(/[\s,]+/);
      if (values.some((s) => !num.test(s))) return null;
      const a = values.map(Number);
      if (!a.every(finite3) || a.some((n) => Math.abs(n) > 1e8)) return null;
      let t;
      if (match[1] === "matrix" && a.length === 6) t = a;
      else if (match[1] === "translate" && (a.length === 1 || a.length === 2))
        t = [1, 0, 0, 1, a[0], a[1] ?? 0];
      else if (match[1] === "scale" && (a.length === 1 || a.length === 2))
        t = [a[0], 0, 0, a[1] ?? a[0], 0, 0];
      else if (match[1] === "rotate" && (a.length === 1 || a.length === 3)) {
        const radians = a[0] * Math.PI / 180, cs = Math.cos(radians), sn = Math.sin(radians);
        const rotation = [cs, sn, -sn, cs, 0, 0];
        t = a.length === 1 ? rotation : mul(mul([1, 0, 0, 1, a[1], a[2]], rotation), [1, 0, 0, 1, -a[1], -a[2]]);
      } else return null;
      m = mul(m, t);
      if (!limit(m)) return null;
    }
    if (count2 === 0 || !/^[\s,]*$/.test(value.slice(i)) || !invertible(m)) return null;
    return m;
  }
  function boxOf(contours) {
    const pts = contours.flatMap((r) => r.points);
    return {
      xmin: Math.min(...pts.map((p) => p.x)),
      xmax: Math.max(...pts.map((p) => p.x)),
      ymin: Math.min(...pts.map((p) => p.y)),
      ymax: Math.max(...pts.map((p) => p.y))
    };
  }
  function inspectSvgTree(context = {}) {
    const root = context.root, doc = inspectSvgDocumentViewport(root);
    if (doc.status !== "DOCUMENT_COORDINATES_ONLY")
      return reject("SVG_DOCUMENT_UNSUPPORTED", { detail: doc.reason });
    if (!attrsAllowed(root, allowedRoot)) return reject("SVG_ROOT_ATTRIBUTES_UNSUPPORTED");
    const print = context.matrix_document_mm_to_print_mm;
    if (!invertible(print) || !limit(print))
      return reject("SVG_EXPLICIT_PRINT_MATRIX_REQUIRED");
    const mm = doc.svg_units_to_mm;
    const origin = doc.viewBox;
    const viewport = [mm, 0, 0, mm, -origin.minX * mm, -origin.minY * mm];
    const svgToPrint = mul(print, viewport);
    const eps = context.curve_flatness_mm ?? 2e-3;
    if (!finite3(eps) || eps <= 0 || eps > 0.02) return reject("SVG_FLATTEN_ERROR_INVALID");
    const stack = [{ node: root, matrix: svgToPrint, fill: null, rule: null, depth: 0 }];
    const shapes = [], boxes = [];
    let paths = 0, groups = 0, segments = 0, curveSegments = 0, color = null;
    while (stack.length) {
      const { node: node2, matrix, fill, rule, depth } = stack.pop();
      if (depth > 16) return reject("SVG_TREE_DEPTH_EXCEEDED");
      const name = node2.localName;
      if (name === "title" || name === "desc") {
        if (node2.children?.length) return reject("SVG_METADATA_NESTED_ELEMENTS");
        continue;
      }
      const isRoot = node2 === root;
      if (!isRoot && name !== "g" && name !== "path")
        return reject("SVG_CHILD_UNSUPPORTED", { element: name });
      if (!isRoot && !attrsAllowed(node2, name === "g" ? allowedGroup : allowedPath))
        return reject("SVG_CHILD_ATTRIBUTES_UNSUPPORTED", { element: name });
      const get = (key) => node2.getAttribute(key);
      const ownMatrix = isRoot ? identity : parseSvgAffineTransform(get("transform"));
      if (!ownMatrix) return reject("SVG_GROUP_TRANSFORM_UNSUPPORTED", { element: name });
      const nextMatrix = mul(matrix, ownMatrix);
      if (!invertible(nextMatrix) || !limit(nextMatrix))
        return reject("SVG_GROUP_TRANSFORM_DEGENERATE");
      const nextFill = get("fill") ?? fill, nextRule = get("fill-rule") ?? rule;
      if (get("stroke") !== null && get("stroke") !== "none")
        return reject("SVG_STROKE_UNSUPPORTED");
      if (name === "path") {
        paths++;
        if (paths > 128) return reject("SVG_PATH_BUDGET_EXCEEDED");
        if (typeof nextFill !== "string" || !/^#[0-9a-f]{6}$/i.test(nextFill))
          return reject("SVG_EXPLICIT_SOLID_FILL_REQUIRED");
        if (color === null) color = nextFill.toLowerCase();
        if (color !== nextFill.toLowerCase())
          return reject("SVG_DIFFERENT_INKS_REQUIRE_SEPARATION");
        const upper = scaleBound(nextMatrix);
        if (!(upper > 1e-10)) return reject("SVG_MATRIX_SCALE_INVALID");
        const parsed = parseClosedSvgPath(get("d"), {
          flatness_user_units: Math.min(10, eps / upper)
        });
        if (parsed.status !== "CONTOURS_ONLY")
          return reject("SVG_PATH_GEOMETRY_UNSUPPORTED", { detail: parsed.reason });
        const fillRule = nextRule ?? "nonzero";
        if (fillRule !== "evenodd" && !(fillRule === "nonzero" && parsed.contours.length === 1))
          return reject("SVG_COMPLEX_FILL_RULE_UNSUPPORTED");
        const ringCount = parsed.contours.reduce((sum, r) => sum + r.points.length, 0);
        if (segments + ringCount > 768) return reject("SVG_TOTAL_SEGMENT_BUDGET_EXCEEDED");
        const rings = parsed.contours.map((r) => ({ points: r.points.map((p) => point(p, nextMatrix)) }));
        const box = boxOf(rings);
        const guard = Math.max(1e-5, eps * 2);
        for (const other of boxes) {
          const dx = Math.max(other.xmin - box.xmax, box.xmin - other.xmax);
          const dy = Math.max(other.ymin - box.ymax, box.ymin - other.ymax);
          if (dx <= guard && dy <= guard)
            return reject("SVG_PATHS_OVERLAP_OR_PROXIMITY_UNVERIFIED");
        }
        boxes.push(box);
        shapes.push(...rings);
        segments += ringCount;
        curveSegments += parsed.curve_segments;
      } else {
        if (name === "g") groups++;
        const children = node2.children;
        if (!children || typeof children.length !== "number")
          return reject("SVG_TREE_CHILDREN_UNAVAILABLE");
        if (children.length > 512) return reject("SVG_TREE_CHILD_LIMIT");
        for (let k = children.length - 1; k >= 0; k--) {
          stack.push({
            node: children[k],
            matrix: nextMatrix,
            fill: nextFill,
            rule: nextRule,
            depth: depth + 1
          });
        }
        if (stack.length > 2048) return reject("SVG_TREE_NODE_LIMIT");
      }
    }
    if (paths === 0) return reject("SVG_NO_PAINTED_PATHS");
    const measured = inspectVectorCorridors({
      contours: shapes,
      matrix_svg_to_mm: identity,
      fill_rule: "evenodd",
      curve_flatness_mm: eps,
      max_candidate_mm: context.max_candidate_mm
    });
    if (measured.status !== "RESEARCH_CANDIDATES_ONLY")
      return reject("SVG_VECTOR_GEOMETRY_UNSUPPORTED", { detail: measured.reason });
    let curved = null;
    if (context.include_curved_probes === true) {
      curved = inspectCurvedNormalProbes({
        contours: shapes,
        matrix_svg_to_mm: identity,
        fill_rule: "evenodd",
        curve_flatness_mm: eps,
        max_candidate_mm: context.max_candidate_mm
      });
      if (curved.status !== "RESEARCH_CANDIDATES_ONLY")
        return reject("SVG_CURVED_PROBES_UNSUPPORTED", { detail: curved.reason });
    }
    return {
      ...measured,
      schema: "printcheck.vision.svg-dom-bridge.v1",
      ...curved ? { curved_probes: curved } : {},
      status: "RESEARCH_CANDIDATES_ONLY",
      print_scale_proven: false,
      geometry_proven: false,
      svg_document_scale_proven: true,
      paths_count: paths,
      groups_count: groups,
      curve_segments: curveSegments,
      vertex_count: segments,
      source_matrix_document_to_print_mm: print.slice(),
      warnings: [
        ...measured.warnings,
        "svg_tree_subset_not_complete_svg2",
        "document_scale_is_not_authorized_order_placement",
        "never_conclude_approved_from_research_candidates"
      ]
    };
  }

  // vision/geometry/svg-ink-forms.mjs
  var no = (reason) => ({ status: "MANUAL", reason });
  function bboxOfPath(path) {
    const m = path.matrixDocumentMm;
    if (!Array.isArray(m) || m.length !== 6 || m.some((x) => !Number.isFinite(x)))
      return null;
    const largest = Math.hypot(Math.hypot(m[0], m[1]), Math.hypot(m[2], m[3]));
    if (!(largest > 1e-12)) return null;
    const parsed = parseClosedSvgPath(path.d, {
      flatness_user_units: Math.min(10, 2e-3 / largest),
      max_segments: 768
    });
    if (parsed.status !== "CONTOURS_ONLY") return null;
    const points = parsed.contours.flatMap((r) => r.points);
    if (!points.length || points.length > 768) return null;
    const xy = points.map((p) => ({
      x: m[0] * p.x + m[2] * p.y + m[4],
      y: m[1] * p.x + m[3] * p.y + m[5]
    }));
    if (xy.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y)))
      return null;
    return {
      minX: Math.min(...xy.map((p) => p.x)),
      maxX: Math.max(...xy.map((p) => p.x)),
      minY: Math.min(...xy.map((p) => p.y)),
      maxY: Math.max(...xy.map((p) => p.y)),
      count: xy.length
    };
  }
  function inspectDisjointSvgInkForms(root, paths, {
    maxCandidateMm = 3,
    includeCurvedProbes = false
  } = {}) {
    if (!root || !Array.isArray(paths) || paths.length < 2 || paths.length > 128)
      return no("VECTOR_MULTICOLOR_SOURCE_INVALID");
    const inks = [...new Set(paths.map((p) => p.fill?.toLowerCase()))];
    if (inks.length < 2 || inks.length > 8 || inks.some((v) => typeof v !== "string" || !/^#[a-f0-9]{6}$/.test(v)))
      return no("VECTOR_MULTICOLOR_INKS_UNSUPPORTED");
    const boxes = paths.map(bboxOfPath);
    if (boxes.some((v) => v === null) || boxes.reduce((n, v) => n + v.count, 0) > 768)
      return no("VECTOR_MULTICOLOR_GEOMETRY_BUDGET");
    const EPS = 4e-3;
    for (let i = 0; i < paths.length; i++) for (let j = i + 1; j < paths.length; j++) {
      if (paths[i].fill.toLowerCase() === paths[j].fill.toLowerCase()) continue;
      const a = boxes[i], b = boxes[j];
      if (a.minX <= b.maxX + EPS && b.minX <= a.maxX + EPS && a.minY <= b.maxY + EPS && b.minY <= a.maxY + EPS)
        return no("VECTOR_DIFFERENT_INKS_OVERLAP_OR_TOUCH");
    }
    const results = [], candidates = [], curved = [];
    for (const ink of inks) {
      const clone = root.cloneNode(true);
      const selected = Array.from(clone.getElementsByTagNameNS(
        "http://www.w3.org/2000/svg",
        "path"
      ));
      if (selected.length !== paths.length)
        return no("VECTOR_MULTICOLOR_TREE_MISMATCH");
      for (let i = selected.length - 1; i >= 0; i--)
        if (paths[i].fill.toLowerCase() !== ink) selected[i].remove();
      const measured = inspectSvgTree({
        root: clone,
        matrix_document_mm_to_print_mm: [1, 0, 0, 1, 0, 0],
        max_candidate_mm: maxCandidateMm,
        include_curved_probes: includeCurvedProbes,
        curve_flatness_mm: 2e-3
      });
      if (measured.status !== "RESEARCH_CANDIDATES_ONLY")
        return no("VECTOR_MULTICOLOR_FORM_UNSUPPORTED:" + measured.reason);
      results.push({
        source_rgb_ink: ink,
        paths_count: measured.paths_count,
        candidate_count: measured.candidates.length,
        truncated: measured.truncated === true
      });
      candidates.push(...measured.candidates.map((x) => ({ ...x, source_rgb_ink: ink })));
      if (measured.curved_probes?.candidates)
        curved.push(...measured.curved_probes.candidates.map((x) => ({
          ...x,
          source_rgb_ink: ink
        })));
    }
    return {
      status: "RESEARCH_CANDIDATES_ONLY",
      paths_count: paths.length,
      groups_count: 0,
      vertex_count: boxes.reduce((sum, b) => sum + b.count, 0),
      curve_segments: null,
      candidates: candidates.sort((a, b) => a.measured_mm - b.measured_mm),
      curved_probes: { candidates: curved },
      separated_ink_forms: results,
      print_scale_proven: false,
      geometry_proven: false,
      inks_verified_as_print_spots: false,
      production_approved: false
    };
  }

  // vision/geometry/svg-local-vector.mjs
  var SVG_NS = "http://www.w3.org/2000/svg";
  var failure = (reason, detail) => ({
    status: "MANUAL",
    schema: "printcheck.vision.local-svg-vector.v1",
    reason,
    ...detail ? { detail } : {},
    production_approved: false,
    print_scale_proven: false,
    geometry_proven: false
  });
  var mult = (a, b) => [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5]
  ];
  function validateDom(doc) {
    if (!doc?.documentElement || doc.getElementsByTagName("parsererror").length)
      return "SVG_XML_PARSE_ERROR";
    const root = doc.documentElement;
    if (root.localName !== "svg" || root.namespaceURI !== SVG_NS)
      return "SVG_NAMESPACE_REQUIRED";
    const work = [root];
    let count2 = 0;
    while (work.length) {
      const node2 = work.pop();
      if (++count2 > 512) return "SVG_XML_NODE_LIMIT";
      if (node2.namespaceURI !== SVG_NS || node2.prefix)
        return "SVG_FOREIGN_NAMESPACE_OR_PREFIX";
      const allowMetadata = node2.localName === "title" || node2.localName === "desc";
      for (const child of node2.childNodes) {
        if (child.nodeType === 1) work.push(child);
        else if (child.nodeType === 3) {
          if (!allowMetadata && child.nodeValue.trim())
            return "SVG_NONWHITESPACE_TEXT_UNSUPPORTED";
        } else return "SVG_XML_NODE_TYPE_UNSUPPORTED";
      }
    }
    return null;
  }
  function previewPaths(root, mmPerUser, viewBox) {
    const viewport = [
      mmPerUser,
      0,
      0,
      mmPerUser,
      -viewBox.minX * mmPerUser,
      -viewBox.minY * mmPerUser
    ];
    const work = [{ node: root, matrix: viewport, fill: null, rule: "nonzero" }];
    const paths = [];
    while (work.length) {
      const { node: node2, matrix, fill, rule } = work.pop();
      const mine = node2 === root ? [1, 0, 0, 1, 0, 0] : parseSvgAffineTransform(node2.getAttribute("transform"));
      if (!mine) throw Error("UNSUPPORTED_SVG_TRANSFORM");
      const nextMatrix = mult(matrix, mine);
      const nextFill = node2.getAttribute("fill") ?? fill;
      const nextRule = node2.getAttribute("fill-rule") ?? rule;
      if (node2.localName === "path") {
        paths.push({
          d: node2.getAttribute("d"),
          fill: nextFill,
          fillRule: nextRule,
          matrixDocumentMm: nextMatrix
        });
      } else {
        const kids = node2.children;
        for (let i = kids.length - 1; i >= 0; i--)
          if (kids[i].localName !== "title" && kids[i].localName !== "desc")
            work.push({
              node: kids[i],
              matrix: nextMatrix,
              fill: nextFill,
              rule: nextRule
            });
      }
    }
    return paths;
  }
  function inspectLocalSvgVector(source, {
    DOMParserClass = globalThis.DOMParser,
    maxCandidateMm = 3,
    includeCurvedProbes = false
  } = {}) {
    if (typeof source !== "string" || !source.trim() || source.length > 256e3) return failure("SVG_SOURCE_SIZE_UNSUPPORTED");
    const withoutSvgNamespace = source.replace(
      /xmlns\s*=\s*["']http:\/\/www\.w3\.org\/2000\/svg["']/g,
      ""
    );
    if (/<!|<\?|&|[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(source) || /(?:https?:|file:|data:|javascript:)/i.test(withoutSvgNamespace))
      return failure("SVG_XML_OR_EXTERNAL_FEATURE_UNSUPPORTED");
    if (typeof DOMParserClass !== "function") return failure("XML_PARSER_UNAVAILABLE");
    if (typeof maxCandidateMm !== "number" || !Number.isFinite(maxCandidateMm) || maxCandidateMm <= 0 || maxCandidateMm > 20 || typeof includeCurvedProbes !== "boolean")
      return failure("VECTOR_SCAN_SETTINGS_INVALID");
    let doc;
    try {
      doc = new DOMParserClass().parseFromString(source, "image/svg+xml");
    } catch {
      return failure("SVG_XML_PARSE_ERROR");
    }
    const err = validateDom(doc);
    if (err) return failure(err);
    const viewport = inspectSvgDocumentViewport(doc.documentElement);
    if (viewport.status !== "DOCUMENT_COORDINATES_ONLY")
      return failure("SVG_DOCUMENT_VIEWPORT_UNSUPPORTED", viewport.reason);
    let measured = inspectSvgTree({
      root: doc.documentElement,
      matrix_document_mm_to_print_mm: [1, 0, 0, 1, 0, 0],
      include_curved_probes: includeCurvedProbes,
      max_candidate_mm: maxCandidateMm,
      curve_flatness_mm: 2e-3
    });
    if (measured.status !== "RESEARCH_CANDIDATES_ONLY" && measured.reason !== "SVG_DIFFERENT_INKS_REQUIRE_SEPARATION")
      return failure("SVG_VECTOR_GEOMETRY_UNSUPPORTED", measured.reason);
    let paths;
    try {
      paths = previewPaths(
        doc.documentElement,
        viewport.svg_units_to_mm,
        viewport.viewBox
      );
    } catch {
      return failure("SVG_PREVIEW_COORDINATES_UNSUPPORTED");
    }
    if (measured.status !== "RESEARCH_CANDIDATES_ONLY") {
      measured = inspectDisjointSvgInkForms(doc.documentElement, paths, {
        maxCandidateMm,
        includeCurvedProbes
      });
      if (measured.status !== "RESEARCH_CANDIDATES_ONLY")
        return failure("SVG_INK_SEPARATIONS_UNSUPPORTED", measured.reason);
    }
    const c = measured.candidates.map(({
      kind,
      measured_mm,
      uncertainty_mm,
      at_mm,
      local_support_mm,
      method,
      source_rgb_ink
    }) => ({
      kind,
      measured_mm,
      uncertainty_mm,
      at_mm,
      local_support_mm,
      method,
      ...source_rgb_ink ? { source_rgb_ink } : {}
    }));
    const curved = measured.curved_probes?.candidates?.map((x) => ({
      kind: x.kind,
      measured_mm: x.measured_mm,
      uncertainty_mm: x.uncertainty_mm,
      at_mm: x.at_mm,
      local_support_mm: x.local_support_mm,
      method: x.method,
      ...x.source_rgb_ink ? { source_rgb_ink: x.source_rgb_ink } : {}
    })) ?? [];
    const report = {
      schema: "printcheck.vision.local-svg-vector.v1",
      status: "RESEARCH_VECTOR_CANDIDATES_ONLY",
      source_format: "SVG",
      width_document_mm: viewport.width_mm,
      height_document_mm: viewport.height_mm,
      paths_count: measured.paths_count,
      groups_count: measured.groups_count,
      curve_segments: measured.curve_segments,
      vertex_count: measured.vertex_count,
      candidate_count: c.length,
      candidates: c,
      source_colors_rgb: [...new Set(paths.map((p) => p.fill.toLowerCase()))],
      ink_forms: measured.separated_ink_forms ?? null,
      inks_verified_as_print_spots: false,
      curved_candidates: curved,
      include_curved_probes: includeCurvedProbes,
      max_candidate_mm: maxCandidateMm,
      source_document_scale_declared: true,
      actual_artwork_placement_scale_proven: false,
      print_scale_proven: false,
      geometry_proven: false,
      production_approved: false,
      full_svg2_supported: false,
      complete_artwork_minimum_proven: false,
      report_contains_vector_source: false,
      warning: "Local candidates use SVG-declared physical dimensions only; print placement and minimum-feature completeness are unverified"
    };
    return { status: report.status, report, localPreviewPaths: paths };
  }

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
  var W1 = [
    [0.508, 0.742, 0.326, 0.183, -1.196, 1.962, -0.303, -0.437],
    [-0.331, 0.07, 0.917, -1.183, 0.721, -0.602, 0.206, 0.371],
    [-0.242, -0.305, 0.111, 0.019, 1.056, -2.006, -0.033, 0.45],
    [-4.311, -3.913, 1.203, 1.019, 2.101, -0.764, 0.56, 0.787],
    [-1.826, -1.959, 2.746, 2.707, 0.019, 3.393, -0.685, -0.354],
    [0.069, 0.58, 0.807, -0.799, -1.513, 2.128, 0.072, -0.665],
    [-1.967, -2.02, 2.744, 2.762, -0.752, 3.886, -0.826, -0.38],
    [0.866, 0.611, 0.061, 0.152, -1.832, 2.215, -0.238, -0.483],
    [-0.81, 0.736, -0.363, 0.495, 0.509, -0.199, 0.171, 0.334],
    [-0.822, -0.316, -0.029, -0.91, 1.467, -1.624, -0.388, 0.716],
    [-0.729, -0.266, 0.047, -0.498, 1.379, -1.973, -0.05, 0.715],
    [0.209, -0.096, -0.201, 0.07, 0.752, 0.2, 0.017, 0.431]
  ];
  var B1 = [-1.12, 0.464, 1.213, 0.8, -0.906, -0.635, -0.457, -0.549, 0.312, 1.223, 0.908, 0.614];
  var W2 = [-1.586, 0.527, 1.611, 6.092, -3.253, -2.487, -4.178, -2.671, 0.465, 1.638, 1.798, 0.472];
  var B2 = 0.57528;
  function predictSyntheticThinPatch(features) {
    if (!Array.isArray(features) || features.length !== 8 || features.some((v) => !Number.isFinite(v) || v < 0 || v > 1))
      throw new RangeError("Invalid 8 synthetic patch features");
    let z = B2;
    for (let i = 0; i < 12; i++) {
      let h = B1[i];
      for (let j = 0; j < 8; j++) h += W1[i][j] * features[j];
      z += W2[i] * Math.tanh(h);
    }
    return 1 / (1 + Math.exp(-Math.max(-40, Math.min(40, z))));
  }
  function getPatchFeatures(mask, width, height, x, y, target = 1) {
    if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || mask?.length !== width * height || x < 4 || y < 4 || x >= width - 4 || y >= height - 4) return null;
    let row = 0, col = 0, diag = 0, anti = 0, b3 = 0, b5 = 0, all2 = 0, center = 0;
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const v = mask[(y + dy) * width + x + dx] === target ? 1 : 0;
      all2 += v;
      if (dy === 0) {
        row += v;
        if (dx >= -1 && dx <= 1) center += v;
      }
      if (dx === 0) col += v;
      if (dx === dy) diag += v;
      if (dx === -dy) anti += v;
      if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) b3 += v;
      if (Math.abs(dx) <= 2 && Math.abs(dy) <= 2) b5 += v;
    }
    return [row / 9, col / 9, diag / 9, anti / 9, b3 / 9, b5 / 25, all2 / 81, center / 3];
  }
  function makeInkMask({ width, height, data }, { inkColor = null, tolerance = 42 } = {}) {
    const size = width * height;
    if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 9 || height < 9 || size > 700 * 700 || data?.length !== size * 4 || !Number.isFinite(tolerance) || tolerance < 2 || tolerance > 220)
      return { status: "MANUAL", reason: "RASTER_INPUT_UNSUPPORTED" };
    if (inkColor !== null && (!Array.isArray(inkColor) || inkColor.length !== 3 || inkColor.some((c) => !Number.isInteger(c) || c < 0 || c > 255)))
      return { status: "MANUAL", reason: "INK_SAMPLE_INVALID" };
    let transparent = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] < 24) transparent++;
    const alphaMode = transparent > size / 50 && transparent < size * 0.99;
    const bg = [data[0], data[1], data[2]], reference = inkColor ?? bg;
    const maxDist = tolerance * tolerance, mask = new Uint8Array(size);
    let count2 = 0;
    for (let i = 0; i < size; i++) {
      const j = 4 * i;
      if (data[j + 3] < 24) continue;
      let ink;
      if (alphaMode && !inkColor) ink = true;
      else {
        const d0 = data[j] - reference[0], d1 = data[j + 1] - reference[1], d2 = data[j + 2] - reference[2];
        ink = inkColor ? d0 * d0 + d1 * d1 + d2 * d2 <= maxDist : d0 * d0 + d1 * d1 + d2 * d2 > maxDist;
      }
      if (ink) {
        mask[i] = 1;
        count2++;
      }
    }
    if (count2 < 2 || count2 >= size * 0.98)
      return { status: "MANUAL", reason: "INK_MASK_EMPTY_OR_AMBIGUOUS" };
    return { status: "INK_MASK_READY", mask, inkPixels: count2, segmentation: alphaMode && !inkColor ? "alpha" : inkColor ? "sampled_ink_rgb" : "corner_background_rgb" };
  }
  function bracketedGap(mask, w, x, y) {
    const dirs = [[1, 0], [0, 1], [1, 1], [1, -1]];
    for (const [dx, dy] of dirs) {
      let a = false, b = false;
      for (let r = 1; r <= 4; r++) {
        if (mask[(y + dy * r) * w + x + dx * r]) {
          a = true;
          break;
        }
      }
      if (!a) continue;
      for (let r = 1; r <= 4; r++) {
        if (mask[(y - dy * r) * w + x - dx * r]) {
          b = true;
          break;
        }
      }
      if (b) return true;
    }
    return false;
  }
  function collectRegions(flags, w, h, maxRegions) {
    const seen = new Uint8Array(flags.length), stack = [], regions = [];
    for (let i = 0; i < flags.length; i++) {
      const kind = flags[i];
      if (!kind || seen[i]) continue;
      seen[i] = 1;
      stack.push(i);
      let xmin = w, xmax = 0, ymin = h, ymax = 0, pixels = 0;
      while (stack.length) {
        const cur = stack.pop(), x = cur % w, y = (cur - x) / w;
        pixels++;
        xmin = Math.min(xmin, x);
        xmax = Math.max(xmax, x);
        ymin = Math.min(ymin, y);
        ymax = Math.max(ymax, y);
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const nxt = ny * w + nx;
          if (!seen[nxt] && flags[nxt] === kind) {
            seen[nxt] = 1;
            stack.push(nxt);
          }
        }
      }
      regions.push({
        kind: kind === 1 ? "thin_ink_candidate" : "narrow_gap_candidate",
        x: xmin,
        y: ymin,
        width: xmax - xmin + 1,
        height: ymax - ymin + 1,
        pixels
      });
    }
    return {
      regions: regions.sort((a, b) => b.pixels - a.pixels).slice(0, maxRegions),
      regionsTotal: regions.length,
      regionsTruncated: regions.length > maxRegions
    };
  }
  function analyzeSyntheticThinRegions(imageData, {
    inkColor = null,
    tolerance = 42,
    probabilityThreshold = 0.75,
    maxRegions = 120
  } = {}) {
    const { width, height } = imageData || {};
    if (!Number.isSafeInteger(maxRegions) || maxRegions < 1 || maxRegions > 500 || !Number.isFinite(probabilityThreshold) || probabilityThreshold < 0.5 || probabilityThreshold > 0.999)
      return { status: "MANUAL", reason: "AI_SCAN_SETTINGS_INVALID", production_approved: false };
    const decoded = makeInkMask(imageData || {}, { inkColor, tolerance });
    if (decoded.status !== "INK_MASK_READY")
      return { ...decoded, production_approved: false };
    const { mask } = decoded, flags = new Uint8Array(mask.length);
    let thinInkPixels = 0, narrowGapPixels = 0;
    for (let y = 4; y < height - 4; y++) for (let x = 4; x < width - 4; x++) {
      const i = y * width + x, target = mask[i];
      if (!target && !bracketedGap(mask, width, x, y)) continue;
      const f = getPatchFeatures(mask, width, height, x, y, target);
      if (predictSyntheticThinPatch(f) < probabilityThreshold) continue;
      flags[i] = target ? 1 : 2;
      if (target) thinInkPixels++;
      else narrowGapPixels++;
    }
    const grouped = collectRegions(flags, width, height, maxRegions);
    return {
      schema: "printcheck.vision.synthetic-mlp-scan.v1",
      status: "RESEARCH_AI_CANDIDATES_ONLY",
      width,
      height,
      thinInkPixels,
      narrowGapPixels,
      inkPixels: decoded.inkPixels,
      segmentation: decoded.segmentation,
      probabilityThreshold,
      model: MODEL_INFO,
      regions: grouped.regions,
      regionsTotal: grouped.regionsTotal,
      regionsTruncated: grouped.regionsTruncated,
      flags,
      production_approved: false,
      physical_scale_proven: false,
      real_world_accuracy_proven: false,
      note: "Synthetic neural patch model, not validated for customer logos, true mm widths or print process"
    };
  }

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
  var text = (node2) => String(node2?.textContent || "").trim().slice(0, 4096);
  var attr = (node2, key) => String(node2?.getAttribute?.(key) || "");
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
    result.article_scoped_trigger_count = count(triggers.filter((el2) => Boolean(el2.closest?.("li[data-itemid]"))).length);
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
    const checked = checks.filter((el2) => el2.checked === true || el2.hasAttribute?.("checked"));
    result.problems_available_count = count(checks.length);
    result.problems_checked_current_count = count(checked.length);
    const topics = /* @__PURE__ */ new Set();
    for (const el2 of checked) {
      const label = el2.closest?.("label") || el2.parentElement;
      categorize(text(label), topics);
    }
    result.checked_problem_topic_hints = [...topics].sort();
    const list = modal.querySelector?.("#j_maketadjusting_comments_list");
    const entries = nodes(list, ":scope > li");
    result.history_entry_count = count(entries.length);
    let humans = 0;
    const weakMessages = /* @__PURE__ */ new Set();
    for (const el2 of entries) {
      const wrapper = el2.querySelector?.(".comment_wrap");
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

  // vision/orders/discussion-probe.mjs
  var CONTROL_SELECTOR = 'a[href],button,[role="button"],[data-action],[data-toggle],[onclick],[class*="discuss"],[class*="comment"],[class*="chat"]';
  var THREAD_SELECTOR = "[data-discussion-id],[data-thread-id],[data-comments-id],.discussion,.discussion-list,.discussion-dialog,.order-discussion,.comments-list,.comment-list,.chat-messages,.messages-list,.j_discussion,.j_comments";
  var MESSAGE_SELECTOR = "[data-comment-id],[data-message-id],.comment-item,.message-item,.discussion-message,.chat-message";
  var BODY_SELECTOR = ".comment-body,.comment-text,.message-text,.message-body,[data-comment-text],[data-message-text]";
  var ARTICLE_SELECTOR = "[data-itemid],[data-orderitemid],[data-orderitem-id],[data-item-id],[data-article],.orderitem,.order-item,.cart-order-item,.cart-item,.j_order_item";
  var DISCUSS = /(?:обсуждени[еяй]|комментар(?:ии|ий|ия|иев)|переписк[ауе]|discuss(?:ion)?|comments?|messages?|conversation|чат\b)/i;
  var AGREEMENT = /(?:согласовани[ея]|утверждени[ея]|approval|approve)/i;
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
  var limit2 = (n, max = 1e4) => Math.min(max, n);
  var empty = () => ({
    schema: "printcheck.vision.article-discussion-structure.v1",
    status: "STRUCTURE_ONLY_UNVERIFIED",
    controls_total: 0,
    article_scoped_controls: 0,
    order_scoped_controls: 0,
    unresolved_scope_controls: 0,
    link_targets_internal_test: 0,
    link_targets_untrusted_or_external: 0,
    link_targets_fragments: 0,
    js_or_opaque_controls: 0,
    inline_thread_candidates: 0,
    visible_message_candidates: 0,
    screenshot_or_image_candidates: 0,
    weak_topic_candidates: [],
    discussion_endpoint_verified: false,
    discussion_content_complete: false,
    discussion_artwork_link_verified: false,
    expert_label_verified: false,
    screenshot_roi_verified: false,
    training_ready: false,
    customer_text_included: false,
    attachment_urls_included: false,
    order_ids_included: false,
    author_names_included: false,
    source_artwork_included: false,
    maket_approval: null
  });
  var safeAttr = (el2, name) => String(el2?.getAttribute?.(name) || "").slice(0, 260);
  var inForbiddenBlock = (el2) => Boolean(el2?.closest?.(
    "#vision-local-order-overlay,[data-vision-order-cell]"
  ));
  function controlLabel(el2) {
    const label = [
      safeAttr(el2, "title"),
      safeAttr(el2, "aria-label"),
      safeAttr(el2, "data-action"),
      safeAttr(el2, "data-toggle"),
      safeAttr(el2, "data-target"),
      safeAttr(el2, "class"),
      safeAttr(el2, "href"),
      String(el2?.textContent || "").slice(0, 180)
    ].join(" ");
    return label;
  }
  function targetClass(el2, base) {
    const raw = safeAttr(el2, "href").trim();
    if (!raw) return "OPAQUE";
    if (raw.startsWith("#")) return "FRAGMENT";
    if (/^javascript:/i.test(raw)) return "OPAQUE";
    try {
      const href = new URL(raw, base);
      if (href.protocol !== "http:" && href.protocol !== "https:") return "OPAQUE";
      if (href.protocol === "http:" && ["psk.testgifts.local", "testgifts.local"].includes(href.hostname) && (!href.port || href.port === "80") && !href.username && !href.password)
        return "INTERNAL_TEST";
      return "EXTERNAL";
    } catch {
      return "OPAQUE";
    }
  }
  function all(scope, selector) {
    try {
      return [...scope?.querySelectorAll?.(selector) || []];
    } catch {
      return [];
    }
  }
  function messageText(node2) {
    const bodies = all(node2, BODY_SELECTOR);
    if (bodies.length) return bodies.slice(0, 15).map((x) => String(x.textContent || "").slice(0, 2500)).join(" ");
    return String(node2?.textContent || "").slice(0, 2500);
  }
  function inspectOrderDiscussionDom(doc, { baseUrl = "http://psk.testgifts.local/private/order/8000001" } = {}) {
    const report = empty();
    if (!doc?.querySelectorAll) return { ...report, status: "ORDER_DOCUMENT_INVALID" };
    const topics = /* @__PURE__ */ new Set();
    const controls = all(doc, CONTROL_SELECTOR);
    for (const el2 of controls) {
      if (inForbiddenBlock(el2)) continue;
      const tag = String(el2.tagName || "").toUpperCase();
      const role = safeAttr(el2, "role");
      const action = safeAttr(el2, "data-action") || safeAttr(el2, "data-toggle") || safeAttr(el2, "onclick");
      const className = safeAttr(el2, "class");
      const isNative = ["A", "BUTTON", "INPUT", "SPAN", "I"].includes(tag);
      if (!isNative && role !== "button" && !action && !/(?:button|trigger|toggle|open|link|btn)/i.test(className)) continue;
      const label = controlLabel(el2);
      const nativeMaketAdjusting = safeAttr(el2, "class").split(/\s+/).includes("j_maketadjusting");
      if ((!DISCUSS.test(label) || AGREEMENT.test(label)) && !nativeMaketAdjusting)
        continue;
      report.controls_total++;
      const scope = el2.closest?.(ARTICLE_SELECTOR);
      if (scope) report.article_scoped_controls++;
      else if (el2.closest?.(".cart-order,.order-card,#j_cart_host"))
        report.order_scoped_controls++;
      else report.unresolved_scope_controls++;
      const kind = targetClass(el2, baseUrl);
      if (kind === "INTERNAL_TEST") report.link_targets_internal_test++;
      else if (kind === "FRAGMENT") report.link_targets_fragments++;
      else if (kind === "EXTERNAL") report.link_targets_untrusted_or_external++;
      else report.js_or_opaque_controls++;
    }
    const threads = all(doc, THREAD_SELECTOR).filter((x) => !inForbiddenBlock(x));
    report.inline_thread_candidates = limit2(threads.length);
    const seen = /* @__PURE__ */ new Set();
    for (const root of threads) {
      const messages = all(root, MESSAGE_SELECTOR);
      for (const message of messages) {
        if (seen.has(message)) continue;
        seen.add(message);
        const body = messageText(message);
        for (const [topic, re] of Object.entries(TOPICS))
          if (re.test(body)) topics.add(topic);
      }
    }
    report.visible_message_candidates = limit2(seen.size);
    const photos = /* @__PURE__ */ new Set();
    for (const root of threads) {
      for (const el2 of all(root, "img,picture,video,a[href],[data-vision-media-candidate]")) {
        if (el2.tagName === "IMG" || el2.tagName === "PICTURE" || el2.tagName === "VIDEO" || el2.getAttribute?.("data-vision-media-candidate") != null) {
          photos.add(el2);
          continue;
        }
        if (/\.(?:png|jpe?g|webp|gif|bmp)(?:$|[?#])/i.test(safeAttr(el2, "href")) && !all(el2, "img,picture,video,[data-vision-media-candidate]").length)
          photos.add(el2);
      }
    }
    report.screenshot_or_image_candidates = limit2(photos.size);
    report.weak_topic_candidates = [...topics].sort();
    report.maket_approval = inspectOpenMaketApprovalDom(doc);
    if (report.maket_approval.modal_loaded) {
      report.visible_message_candidates = report.maket_approval.history_entry_count;
      report.screenshot_or_image_candidates = report.maket_approval.attachments_image_candidates;
      report.weak_topic_candidates = [.../* @__PURE__ */ new Set([
        ...report.weak_topic_candidates,
        ...report.maket_approval.weak_message_topic_hints
      ])].sort();
    }
    return report;
  }

  // vision/orders/order-page-discovery.mjs
  var TEST_HOSTS = Object.freeze(["psk.testgifts.local", "testgifts.local"]);
  var REFUSE = (reason, extra = {}) => ({ status: "MANUAL", reason, production_approved: false, ...extra });
  var digits = (s) => /^\d{5,12}$/.test(String(s || ""));
  var internal = (s) => /^\d{1,20}$/.test(String(s || ""));
  var allowed = (url) => url?.protocol === "http:" && TEST_HOSTS.includes(url.hostname) && !url.username && !url.password;
  function testUrl(input, base) {
    try {
      const u = new URL(input, base);
      if (!allowed(u) || u.port && u.port !== "80") return null;
      if (/\/(?:delete|remove|upload|logout)(?:\/|$)/i.test(u.pathname)) return null;
      return u;
    } catch {
      return null;
    }
  }
  function rowOrderTarget(row, base) {
    if (!row || !allowed(new URL(base))) return REFUSE("UNTRUSTED_LIST_ORIGIN");
    const choices = [];
    for (const a of row.querySelectorAll("a[href]")) {
      const href = a.getAttribute("href");
      const url = testUrl(href, base);
      if (!url) continue;
      const found = /^\/private\/order\/(\d{5,12})\/?$/.exec(url.pathname);
      if (found) choices.push({ url, number: found[1] });
    }
    for (const attr2 of ["data-href", "data-url"]) {
      const url = testUrl(row.getAttribute?.(attr2) || "", base);
      const found = url && /^\/private\/order\/(\d{5,12})\/?$/.exec(url.pathname);
      if (found) choices.push({ url, number: found[1] });
    }
    const ordered = [...new Map(choices.map((x) => [x.number, x])).values()];
    if (ordered.length > 1) return REFUSE("AMBIGUOUS_ORDER_ROW");
    if (ordered.length === 1) return { status: "ORDER_LINK_FOUND", ...ordered[0] };
    const onclick = row.getAttribute?.("onclick") || "";
    const orderInHandler = onclick.match(/\/private\/order\/(\d{5,12})(?!\d)/);
    const firstCell = row.querySelector?.(":scope > td:first-child")?.textContent?.trim() || "";
    const stated = row.getAttribute?.("data-order-number") || row.getAttribute?.("data-order") || orderInHandler?.[1] || (/^\d{5,12}$/.test(firstCell) ? firstCell : "");
    if (digits(stated)) {
      const url = testUrl("/private/order/" + stated, base);
      return {
        status: "ORDER_LINK_FOUND",
        url,
        number: stated,
        source: row.getAttribute?.("data-order-number") || row.getAttribute?.("data-order") ? "explicit_row_attribute" : orderInHandler ? "static_onclick_url" : "numeric_first_cell"
      };
    }
    return REFUSE("ORDER_DETAIL_LINK_REQUIRED");
  }
  function extractOrderInternalId(doc) {
    const ids = [
      doc.querySelector("#j_cart_host[data-orderid]"),
      doc.querySelector(".cart-order[data-orderid]"),
      doc.querySelector(".j_add_maket[data-orderid]")
    ].map((n) => n?.getAttribute("data-orderid")).filter(Boolean);
    const unique = [...new Set(ids)];
    return unique.length === 1 && internal(unique[0]) ? unique[0] : null;
  }
  function popupHtml(text2) {
    if (typeof text2 !== "string" || !text2.trim() || text2.length > 3e6)
      return REFUSE("POPUP_BODY_INVALID");
    try {
      if (text2.trimStart().startsWith("{")) {
        const data = JSON.parse(text2);
        if (typeof data?.html !== "string") return REFUSE("POPUP_JSON_MISSING_HTML");
        return { status: "POPUP_HTML", html: data.html };
      }
    } catch {
      return REFUSE("POPUP_JSON_INVALID");
    }
    return { status: "POPUP_HTML", html: text2 };
  }
  var findAll = (doc, selector) => {
    const out = [];
    const scan = (root) => {
      out.push(...root.querySelectorAll(selector));
      for (const t of root.querySelectorAll("template")) if (t.content) scan(t.content);
    };
    scan(doc);
    return out;
  };
  function nameOf(node2) {
    return node2?.textContent?.trim() || "";
  }
  function originalNameOf(link) {
    const row = link.closest?.(".flex-item.flex-main,li,tr,.maket-row") || link.parentElement;
    const label = row?.querySelector?.('[title="\u0418\u0441\u0445\u043E\u0434\u043D\u043E\u0435 \u0438\u043C\u044F \u0437\u0430\u043A\u0430\u0447\u0430\u043D\u043D\u043E\u0433\u043E \u0444\u0430\u0439\u043B\u0430"]');
    const original = label?.textContent;
    return typeof original === "string" && original.length > 0 ? original : nameOf(link);
  }
  function extractOrderResources(doc, base, orderNumber, orderId) {
    if (!digits(orderNumber) || !internal(orderId)) return REFUSE("ORDER_IDENTIFIERS_INVALID");
    if (!doc?.querySelectorAll) return REFUSE("ORDER_DOCUMENT_INVALID");
    const uploads = /* @__PURE__ */ new Map(), templates = /* @__PURE__ */ new Map(), rejected = [];
    for (const a of findAll(doc, 'a[data-maket="true"][href]')) {
      const url = testUrl(a.getAttribute("href"), base);
      if (!url || url.pathname !== "/cart/act/mda" || url.searchParams.get("oid") !== orderId || !internal(url.searchParams.get("id"))) {
        rejected.push("UNTRUSTED_CUSTOMER_FILE_LINK");
        continue;
      }
      const id = url.searchParams.get("id");
      const filename = nameOf(a);
      const originalFilename = originalNameOf(a);
      if (!/\.(?:pdf|ai|svg|eps|cdr|png|jpe?g|webp)$/i.test(filename)) {
        rejected.push("CUSTOMER_FILE_NAME_UNSUPPORTED");
        continue;
      }
      uploads.set(id, {
        id,
        orderNumber,
        role: "customer_uploaded_artwork",
        filename,
        originalFilename,
        url: url.href,
        source: "makets_popup"
      });
    }
    for (const a of findAll(doc, 'a[href*="getOrderItemPdf"],[data-orderitemid],[data-oiid]')) {
      const href = a.getAttribute("href") || "";
      let itemId = a.getAttribute("data-orderitemid") || a.getAttribute("data-oiid") || "";
      const link = href ? testUrl(href, base) : null;
      if (!itemId) itemId = link?.searchParams.get("orderitemid") || "";
      if (!internal(itemId)) continue;
      const endpoint = testUrl("/drawing?action=getOrderItemPdf&orderitemid=" + encodeURIComponent(itemId), base);
      templates.set(itemId, {
        itemId,
        role: "constructor_template",
        url: endpoint.href,
        source: "makets_popup"
      });
    }
    return {
      status: "ORDER_RESOURCES",
      uploads: [...uploads.values()],
      templates: [...templates.values()],
      rejected
    };
  }
  function parse(docText, parser = globalThis.DOMParser) {
    if (typeof docText !== "string" || docText.length > 3e6 || typeof parser !== "function") return null;
    try {
      return new parser().parseFromString(docText, "text/html");
    } catch {
      return null;
    }
  }
  function isAuthHtml(text2) {
    return /<form[^>]+name=["']authform["']/i.test(text2) || /Авторизация\s*-\s*Проект\s*111/i.test(text2);
  }
  async function boundedText(response, limit3 = 3e6) {
    if (!response.ok) throw Error("HTTP_" + response.status);
    const type = response.headers.get("content-type") || "";
    if (!/(?:html|json|text)/i.test(type)) throw Error("UNEXPECTED_DOCUMENT_CONTENT_TYPE");
    const length2 = response.headers.get("content-length");
    if (length2 && Number(length2) > limit3) throw Error("DOCUMENT_TOO_LARGE");
    const reader = response.body?.getReader();
    if (!reader) {
      const s = await response.text();
      if (s.length > limit3) throw Error("DOCUMENT_TOO_LARGE");
      return s;
    }
    const parts = [];
    let count2 = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        count2 += value.length;
        if (count2 > limit3) throw Error("DOCUMENT_TOO_LARGE");
        parts.push(value);
      }
    } catch (err) {
      try {
        await reader.cancel();
      } catch {
      }
      ;
      throw err;
    }
    const buf = new Uint8Array(count2);
    let offset = 0;
    for (const part of parts) {
      buf.set(part, offset);
      offset += part.length;
    }
    return new TextDecoder("utf-8").decode(buf);
  }
  function classifiedError(error, phase, originRelation) {
    const message = String(error?.message || "");
    const common = {
      stage: phase,
      origin_relation: originRelation,
      network_attempted: true,
      http_status: null
    };
    if (error?.visionCode === "RESPONSE_HTTP_STATUS")
      return REFUSE(
        phase === "order_card" ? "ORDER_CARD_HTTP_ERROR" : "ORDER_POPUP_HTTP_ERROR",
        { ...common, failure_class: "http_status", http_status: error.status }
      );
    if (error?.visionCode === "TEST_SESSION_AUTH_REQUIRED")
      return REFUSE(
        phase === "order_card" ? "ORDER_CARD_AUTH_REQUIRED" : "ORDER_POPUP_AUTH_REQUIRED",
        { ...common, failure_class: "login_html" }
      );
    if (error?.visionCode === "DOCUMENT_TOO_LARGE")
      return REFUSE(
        phase === "order_card" ? "ORDER_CARD_TOO_LARGE" : "ORDER_POPUP_TOO_LARGE",
        { ...common, failure_class: "response_limit" }
      );
    if (error?.visionCode === "UNEXPECTED_DOCUMENT_CONTENT_TYPE")
      return REFUSE(
        phase === "order_card" ? "ORDER_CARD_UNEXPECTED_TYPE" : "ORDER_POPUP_UNEXPECTED_TYPE",
        { ...common, failure_class: "content_type" }
      );
    if (error?.visionCode === "FETCH_TIMEOUT")
      return REFUSE(
        phase === "order_card" ? "ORDER_CARD_TIMEOUT" : "ORDER_POPUP_TIMEOUT",
        { ...common, failure_class: "timeout" }
      );
    if (error?.visionCode === "TEST_REDIRECT_DENIED")
      return REFUSE(
        phase === "order_card" ? "ORDER_CARD_REDIRECT_DENIED" : "ORDER_POPUP_REDIRECT_DENIED",
        { ...common, failure_class: "redirect_denied" }
      );
    const mv3FailureClasses = {
      EXTENSION_AUTH_REDIRECT: "login_redirect",
      EXTENSION_REDIRECT_UNTRUSTED_ORIGIN: "untrusted_redirect_origin",
      EXTENSION_REDIRECT_UNEXPECTED_PATH: "unexpected_redirect_path",
      EXTENSION_FETCH_REJECTED: "extension_network_rejected",
      EXTENSION_SERVICE_DISCONNECTED: "extension_disconnected",
      EXTENSION_FETCH_TIMEOUT: "timeout"
    };
    if (Object.prototype.hasOwnProperty.call(mv3FailureClasses, message))
      return REFUSE(
        phase === "order_card" ? "ORDER_CARD_FETCH_REJECTED" : "ORDER_POPUP_FETCH_REJECTED",
        {
          ...common,
          failure_class: mv3FailureClasses[message],
          transport_error: message,
          fetch_exception_family: "TypeError"
        }
      );
    return REFUSE(
      phase === "order_card" ? "ORDER_CARD_FETCH_REJECTED" : "ORDER_POPUP_FETCH_REJECTED",
      {
        ...common,
        failure_class: "cors_redirect_or_network",
        fetch_exception_family: error?.name === "TypeError" ? "TypeError" : "other"
      }
    );
  }
  async function getText(url, fetcher, listOrigin, phase) {
    const loc = new URL(url);
    if (!allowed(loc)) throw Error("UNTRUSTED_TEST_HOST");
    const same3 = loc.origin === listOrigin;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15e3);
    let res;
    try {
      res = await fetcher(loc.href, {
        method: "GET",
        mode: same3 ? "same-origin" : "cors",
        credentials: "include",
        redirect: same3 ? "follow" : "error",
        cache: "no-store",
        referrerPolicy: "no-referrer",
        signal: controller.signal,
        headers: phase === "popup" && same3 ? { accept: "text/html,application/json", "x-requested-with": "XMLHttpRequest" } : { accept: "text/html,application/json" }
      });
      if (res.url) {
        let final;
        try {
          final = new URL(res.url);
        } catch {
        }
        const auth = final && final.pathname.toLowerCase().split("/").some((part) => ["auth", "login", "signin"].includes(part));
        const expected = (loc.pathname.endsWith("/") ? loc.pathname.slice(0, -1) : loc.pathname) + loc.search;
        const actual = final && (final.pathname.endsWith("/") ? final.pathname.slice(0, -1) : final.pathname) + final.search;
        if (auth) {
          const e = Error("TEST_SESSION_AUTH_REQUIRED");
          e.visionCode = "TEST_SESSION_AUTH_REQUIRED";
          throw e;
        }
        if (!final || !testUrl(res.url, loc.href) || final.origin !== loc.origin || actual !== expected) {
          const e = Error("TEST_REDIRECT_DENIED");
          e.visionCode = "TEST_REDIRECT_DENIED";
          throw e;
        }
      }
      if (!res.ok) {
        const error = Error("RESPONSE_HTTP_STATUS");
        error.visionCode = "RESPONSE_HTTP_STATUS";
        error.status = res.status;
        throw error;
      }
      let text2;
      try {
        text2 = await boundedText(res);
      } catch (error) {
        if (error.message === "DOCUMENT_TOO_LARGE") error.visionCode = "DOCUMENT_TOO_LARGE";
        if (error.message === "UNEXPECTED_DOCUMENT_CONTENT_TYPE")
          error.visionCode = "UNEXPECTED_DOCUMENT_CONTENT_TYPE";
        throw error;
      }
      if (isAuthHtml(text2)) {
        const error = Error("TEST_SESSION_AUTH_REQUIRED");
        error.visionCode = "TEST_SESSION_AUTH_REQUIRED";
        throw error;
      }
      return text2;
    } catch (error) {
      if (controller.signal.aborted) error.visionCode = "FETCH_TIMEOUT";
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
  async function inspectOrderPageFromRow(row, {
    loc = globalThis.location,
    fetcher = globalThis.__visionLocalTrustedTransport || globalThis.fetch,
    DOMParserClass = globalThis.DOMParser
  } = {}) {
    if (!loc || loc.protocol !== "http:" || loc.hostname !== "psk.testgifts.local" || !/^\/devorders(?:\/|$)/.test(loc.pathname))
      return REFUSE("NOT_TEST_ORDER_PAGE");
    const target = rowOrderTarget(row, loc.href);
    if (target.status !== "ORDER_LINK_FOUND") return target;
    const originRelation = target.url.origin === loc.origin ? "same_origin" : "approved_other_test_origin";
    let phase = "order_card";
    try {
      const source = await getText(target.url.href, fetcher, loc.origin, phase);
      const doc = parse(source, DOMParserClass);
      const oid = extractOrderInternalId(doc);
      if (!oid) return REFUSE("ORDER_INTERNAL_ID_NOT_FOUND");
      const popupUrl = testUrl(
        "/ajax/gifts/order?action=makets_popup&oid=" + oid,
        target.url.origin
      );
      phase = "popup";
      const raw = await getText(popupUrl.href, fetcher, loc.origin, phase);
      const parsed = popupHtml(raw);
      if (parsed.status !== "POPUP_HTML") return parsed;
      const popupDoc = parse(parsed.html, DOMParserClass);
      if (!popupDoc) return REFUSE("POPUP_HTML_UNREADABLE");
      const resources = extractOrderResources(
        popupDoc,
        popupUrl.origin,
        target.number,
        oid
      );
      if (resources.status !== "ORDER_RESOURCES") return resources;
      return {
        status: "ORDER_DETAIL_DISCOVERED",
        orderNumber: target.number,
        internalId: oid,
        detailOrigin: target.url.origin,
        uploads: resources.uploads.map((x) => ({
          ...x,
          internalId: oid,
          detailOrigin: target.url.origin
        })),
        templates: resources.templates,
        rejected: resources.rejected,
        stage: "resources",
        origin_relation: originRelation
      };
    } catch (error) {
      return classifiedError(error, phase, originRelation);
    }
  }
  function inertOrderDiscussionHtml(source) {
    if (typeof source !== "string" || source.length > 3e6) return null;
    const withoutScripts = source.replace(
      /<\s*(script|style)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi,
      ""
    );
    const withoutMedia = withoutScripts.replace(
      /<\s*(?:img|image|iframe|source|video|audio|track|embed|object|link)\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi,
      '<span data-vision-media-candidate=""></span>'
    );
    if (/<\s*(?:img|image|iframe|source|video|audio|track|embed|object|link)\b/i.test(withoutMedia))
      return null;
    return withoutMedia;
  }
  async function inspectOrderDiscussionFromRow(row, {
    loc = globalThis.location,
    fetcher = globalThis.__visionLocalTrustedTransport || globalThis.fetch,
    DOMParserClass = globalThis.DOMParser
  } = {}) {
    if (!loc || loc.protocol !== "http:" || loc.hostname !== "psk.testgifts.local" || !/^\/devorders(?:\/|$)/.test(loc.pathname))
      return REFUSE("NOT_TEST_ORDER_PAGE");
    const target = rowOrderTarget(row, loc.href);
    if (target.status !== "ORDER_LINK_FOUND") return target;
    const originRelation = target.url.origin === loc.origin ? "same_origin" : "approved_other_test_origin";
    try {
      const source = await getText(target.url.href, fetcher, loc.origin, "order_card");
      const inert = inertOrderDiscussionHtml(source);
      if (inert === null) return REFUSE(
        "ORDER_DISCUSSION_HTML_UNSAFE",
        { stage: "order_card" }
      );
      const doc = parse(inert, DOMParserClass);
      if (!doc) return REFUSE(
        "ORDER_DISCUSSION_HTML_UNREADABLE",
        { stage: "order_card" }
      );
      return inspectOrderDiscussionDom(doc, { baseUrl: target.url.href });
    } catch (error) {
      return classifiedError(error, "order_card", originRelation);
    }
  }
  async function recheckOrderPopupReferences(resources, {
    loc = globalThis.location,
    fetcher = globalThis.__visionLocalTrustedTransport || globalThis.fetch,
    DOMParserClass = globalThis.DOMParser
  } = {}) {
    if (!loc || loc.protocol !== "http:" || loc.hostname !== "psk.testgifts.local" || !/^\/devorders(?:\/|$)/.test(loc.pathname))
      return REFUSE("NOT_TEST_ORDER_PAGE");
    if (!Array.isArray(resources) || resources.length < 1 || resources.length > 1e4)
      return REFUSE("UNTRUSTED_POPUP_RECHECK_LIST");
    const first = resources[0];
    if (!internal(first?.internalId) || !digits(first?.orderNumber) || !testUrl(first?.detailOrigin, loc.href))
      return REFUSE("UNTRUSTED_POPUP_RECHECK_LIST");
    const validate = (r) => {
      if (r?.role !== "customer_uploaded_artwork" || !internal(r.id) || r.internalId !== first.internalId || r.orderNumber !== first.orderNumber || r.detailOrigin !== first.detailOrigin) return false;
      const u = testUrl(r.url, loc.href);
      return Boolean(u && u.pathname === "/cart/act/mda" && u.origin === r.detailOrigin && u.searchParams.get("oid") === r.internalId && u.searchParams.get("id") === r.id);
    };
    if (!resources.every(validate)) return REFUSE("UNTRUSTED_POPUP_RECHECK_LIST");
    const popupUrl = testUrl("/ajax/gifts/order?action=makets_popup&oid=" + first.internalId, first.detailOrigin);
    if (!popupUrl) return REFUSE("UNTRUSTED_POPUP_RECHECK_LIST");
    try {
      const raw = await getText(popupUrl.href, fetcher, loc.origin, "popup");
      const html = popupHtml(raw);
      if (html.status !== "POPUP_HTML")
        return REFUSE("POPUP_REFERENCE_RECHECK_MALFORMED");
      const parsed = parse(html.html, DOMParserClass);
      if (!parsed) return REFUSE("POPUP_REFERENCE_RECHECK_MALFORMED");
      const discovered = extractOrderResources(
        parsed,
        popupUrl.origin,
        first.orderNumber,
        first.internalId
      );
      if (discovered.status !== "ORDER_RESOURCES")
        return REFUSE("POPUP_REFERENCE_RECHECK_MALFORMED");
      const exact = new Set(discovered.uploads.map((x) => x.url));
      return {
        status: "REFERENCE_RECHECKED",
        listed: resources.map((x) => exact.has(x.url)),
        production_approved: false
      };
    } catch (error) {
      const reason = classifiedError(error, "popup", first.detailOrigin === loc.origin ? "same_origin" : "approved_other_test_origin");
      return REFUSE("POPUP_REFERENCE_RECHECK_UNAVAILABLE", {
        failure_class: reason.failure_class || null,
        http_status: reason.http_status ?? null,
        transport_error: reason.transport_error || null
      });
    }
  }
  async function fetchOrderResourceBytes(resource, {
    fetcher = globalThis.__visionLocalTrustedTransport || globalThis.fetch,
    loc = globalThis.location,
    timeoutMs = 15e3,
    maxBytes = 16e6
  } = {}) {
    if (!loc || loc.protocol !== "http:" || loc.hostname !== "psk.testgifts.local" || !/^\/devorders(?:\/|$)/.test(loc.pathname))
      return REFUSE("NOT_TEST_ORDER_PAGE");
    if (resource?.role !== "customer_uploaded_artwork" || !internal(resource.id) || !internal(resource.internalId) || !digits(resource.orderNumber) || !TEST_HOSTS.includes(new URL(loc.href).hostname))
      return REFUSE("UNTRUSTED_ORDER_RESOURCE");
    const url = testUrl(resource.url, loc.href);
    if (!url || url.pathname !== "/cart/act/mda" || url.searchParams.get("id") !== resource.id || url.searchParams.get("oid") !== resource.internalId || url.origin !== resource.detailOrigin)
      return REFUSE("UNTRUSTED_RESOURCE_URL");
    if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > 16e6)
      return REFUSE("RESOURCE_BYTE_LIMIT_INVALID");
    const same3 = url.origin === loc.origin, ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetcher(url.href, {
        method: "GET",
        mode: same3 ? "same-origin" : "cors",
        credentials: "include",
        redirect: "error",
        cache: "no-store",
        referrerPolicy: "no-referrer",
        signal: ctrl.signal,
        headers: { accept: "application/pdf,application/octet-stream,*/*" }
      });
      if (!res.ok) return REFUSE("ARTWORK_HTTP_ERROR", {
        stage: "artwork",
        http_status: res.status,
        failure_class: "http_status"
      });
      const mime = res.headers.get("content-type") || "";
      if (/(?:text\/html|application\/json)/i.test(mime))
        return REFUSE("ARTWORK_LOGIN_OR_HTML_RESPONSE");
      if (Number(res.headers.get("content-length") || 0) > maxBytes)
        return REFUSE("ARTWORK_SIZE_EXCEEDED");
      const chunks = [];
      let length2 = 0;
      const reader = res.body?.getReader();
      if (!reader) return REFUSE("ARTWORK_STREAM_UNAVAILABLE");
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          length2 += value.byteLength;
          if (length2 > maxBytes) return REFUSE("ARTWORK_SIZE_EXCEEDED");
          chunks.push(value);
        }
      } finally {
        try {
          reader.releaseLock();
        } catch {
        }
      }
      const bytes = new Uint8Array(length2);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
      }
      if (bytes.byteLength < 8) return REFUSE("ARTWORK_EMPTY");
      return { status: "LOCAL_BYTES_ONLY", bytes, url, mime };
    } catch (error) {
      if (ctrl.signal.aborted)
        return REFUSE("ARTWORK_TIMEOUT", {
          stage: "artwork",
          failure_class: "timeout"
        });
      const mv3Codes = {
        EXTENSION_AUTH_REDIRECT: ["ARTWORK_AUTH_REDIRECT", "login_redirect"],
        EXTENSION_REDIRECT_UNTRUSTED_ORIGIN: ["ARTWORK_REDIRECT_UNTRUSTED_ORIGIN", "untrusted_redirect_origin"],
        EXTENSION_REDIRECT_UNEXPECTED_PATH: ["ARTWORK_REDIRECT_UNEXPECTED_PATH", "unexpected_redirect_path"],
        EXTENSION_FETCH_REJECTED: ["ARTWORK_EXTENSION_NETWORK_REJECTED", "extension_network_rejected"],
        EXTENSION_SERVICE_DISCONNECTED: ["ARTWORK_EXTENSION_DISCONNECTED", "extension_disconnected"],
        EXTENSION_FETCH_TIMEOUT: ["ARTWORK_TIMEOUT", "timeout"],
        EXTENSION_FETCH_ABORTED: ["ARTWORK_TRANSPORT_ABORTED", "extension_aborted"],
        EXTENSION_READ_ONLY_PATH_DENIED: ["ARTWORK_EXTENSION_PATH_DENIED", "extension_policy_refusal"]
      };
      const known = Object.prototype.hasOwnProperty.call(mv3Codes, error?.message) ? mv3Codes[error.message] : null;
      if (known)
        return REFUSE(known[0], {
          stage: "artwork",
          failure_class: known[1],
          transport_error: error.message
        });
      return REFUSE(same3 ? "ARTWORK_DOWNLOAD_FAILED" : "TEST_SUBDOMAIN_CORS_OR_AUTH_REQUIRED", {
        stage: "artwork",
        failure_class: "cors_redirect_or_network"
      });
    } finally {
      clearTimeout(timer);
    }
  }

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
  var extensions = /\.(?:svg|pdf|png|jpe?g|webp|cdr|ai|eps|zip|tiff?|psd)(?:$|[?#])/i;
  var downloadWords = /(?:макет|скачать\s*(?:файл|вложен)|artwork|download\s*(?:artwork|file)|приложени[ея])/i;
  var formatFromPath = (pathname) => {
    const match = /\.([a-z0-9]+)$/i.exec(pathname);
    return match ? match[1].toLowerCase() : "";
  };
  var manual = (reason, type = "unknown", extra = {}) => ({
    schema: "printcheck.vision.local-order-artifact.v1",
    status: "MANUAL",
    type,
    reason,
    production_approved: false,
    physical_scale_proven: false,
    uploaded_to_external_service: false,
    ...extra
  });
  function isAllowedTestOrderPage(loc = globalThis.location) {
    return !!loc && loc.protocol === "http:" && loc.hostname.toLowerCase() === LOCAL_ORDERS.host && (loc.pathname === LOCAL_ORDERS.route || loc.pathname.startsWith(LOCAL_ORDERS.route + "/"));
  }
  function sameOriginArtifactUrl(raw, loc = globalThis.location) {
    if (typeof raw !== "string" || !raw.trim() || !loc) return null;
    try {
      const url = new URL(raw, loc.href);
      if (!["http:", "https:"].includes(url.protocol) || url.origin !== loc.origin || url.username || url.password) return null;
      if (url.pathname === LOCAL_ORDERS.route || url.pathname === LOCAL_ORDERS.route + "/") return null;
      return url;
    } catch {
      return null;
    }
  }
  function isCandidateArtworkLink(element) {
    if (!element || typeof element.getAttribute !== "function") return false;
    const raw = element.getAttribute("href") || "";
    if (!raw) return false;
    const download = element.getAttribute("download");
    const label = ((element.textContent || "") + " " + (download || "")).slice(0, 300);
    return extensions.test(raw.split("#")[0]) || download !== null && /\.(svg|pdf|png|jpe?g|webp|cdr|ai|eps|zip)$/i.test(download) || downloadWords.test(label);
  }
  function discoverOrderRows(doc = globalThis.document) {
    if (!doc || !isAllowedTestOrderPage(doc.defaultView?.location)) return [];
    const all2 = [...doc.querySelectorAll("table tbody tr, table tr, [data-order-id]")];
    const seen = /* @__PURE__ */ new Set(), rows = [];
    for (const node2 of all2) {
      if (seen.has(node2) || node2.closest("#vision-local-order-overlay")) continue;
      seen.add(node2);
      if (node2.tagName === "TR") {
        if (node2.closest("thead") || node2.querySelectorAll(":scope > td").length < 1) continue;
      } else if (node2.querySelector("tr")) continue;
      const anchors = [...node2.querySelectorAll("a[href]")].filter(isCandidateArtworkLink);
      const files = anchors.filter((a) => sameOriginArtifactUrl(
        a.getAttribute("href"),
        doc.defaultView.location
      ));
      if (!anchors.length && node2.tagName === "TR" && node2.querySelectorAll(":scope > td").length < 2) continue;
      rows.push({
        element: node2,
        anchors,
        files,
        local_only_excluded: anchors.length - files.length,
        row_index: rows.length + 1,
        limited: false
      });
    }
    return rows;
  }
  function diagnoseTestOrderTable(doc = globalThis.document) {
    if (!doc || !isAllowedTestOrderPage(doc.defaultView?.location))
      return {
        schema: "printcheck.vision.local-order-dom-diagnostic.v1",
        status: "MANUAL",
        reason: "NOT_TEST_ORDER_PAGE"
      };
    const links = [...doc.querySelectorAll("a[href]")].filter((a) => !a.closest("#vision-local-order-overlay"));
    const candidates = links.filter(isCandidateArtworkLink);
    const same3 = candidates.filter((a) => sameOriginArtifactUrl(
      a.getAttribute("href"),
      doc.defaultView.location
    ));
    const tables = [...doc.querySelectorAll("table")].slice(0, 20).map((table, i) => ({
      table_index: i,
      body_row_count: table.querySelectorAll("tbody tr").length,
      direct_row_count: table.querySelectorAll("tr").length,
      cell_count: table.querySelectorAll("td").length,
      anchor_count: table.querySelectorAll("a[href]").length,
      recognized_artwork_links: [...table.querySelectorAll("a[href]")].filter(isCandidateArtworkLink).length,
      action_button_count: table.querySelectorAll('button,[role="button"]').length
    }));
    const rowRoutes = {
      explicit_order_links: 0,
      static_onclick_urls: 0,
      numeric_first_cells: 0,
      explicit_row_attributes: 0,
      ambiguous: 0,
      unresolved: 0
    };
    const orderOriginCounts = { same_origin: 0, approved_other_test_origin: 0 };
    for (const item of discoverOrderRows(doc)) {
      const target = rowOrderTarget(item.element, doc.defaultView.location.href);
      if (target.status !== "ORDER_LINK_FOUND") {
        rowRoutes[target.reason === "AMBIGUOUS_ORDER_ROW" ? "ambiguous" : "unresolved"]++;
      } else {
        orderOriginCounts[target.url.origin === doc.defaultView.location.origin ? "same_origin" : "approved_other_test_origin"]++;
        rowRoutes[target.source === "static_onclick_url" ? "static_onclick_urls" : target.source === "numeric_first_cell" ? "numeric_first_cells" : target.source === "explicit_row_attribute" ? "explicit_row_attributes" : "explicit_order_links"]++;
      }
    }
    const ext = { svg: 0, pdf: 0, raster: 0, other: 0, unknown: 0 };
    for (const a of candidates) {
      const url = sameOriginArtifactUrl(a.getAttribute("href"), doc.defaultView.location);
      if (!url) {
        ext.other++;
        continue;
      }
      const fmt = extensionType(url.pathname);
      ext[Object.hasOwn(ext, fmt) ? fmt : "unknown"]++;
    }
    return {
      schema: "printcheck.vision.local-order-dom-diagnostic.v1",
      status: "ANONYMOUS_STRUCTURE_ONLY",
      captured_at: (/* @__PURE__ */ new Date()).toISOString(),
      script_scope: "psk_local_devorders",
      table_count: doc.querySelectorAll("table").length,
      tables,
      all_anchor_count: links.length,
      candidate_anchor_count: candidates.length,
      same_origin_candidate_count: same3.length,
      cross_origin_or_unsafe_candidate_count: candidates.length - same3.length,
      recognized_rows: discoverOrderRows(doc).length,
      order_navigation_patterns: rowRoutes,
      order_target_origin_counts: orderOriginCounts,
      order_detail_first_required: rowRoutes.explicit_order_links > 0 && same3.length === 0,
      file_attachments_verified: false,
      test_order_details_access_verified: false,
      data_order_id_elements: doc.querySelectorAll("[data-order-id]").length,
      action_button_count: doc.querySelectorAll('button,[role="button"]').length,
      candidate_url_formats: ext,
      contains_order_ids: false,
      contains_order_urls: false,
      contains_attachment_urls: false,
      contains_user_text: false,
      raw_artwork_bytes_included: false
    };
  }
  function extensionType(pathname) {
    const ext = formatFromPath(pathname);
    if (ext === "svg") return "svg";
    if (ext === "pdf") return "pdf";
    if (["png", "jpg", "jpeg", "webp"].includes(ext)) return "raster";
    if (ext) return "unsupported";
    return "unknown";
  }
  async function readBounded(response, maxBytes) {
    const header = response.headers.get("content-length");
    if (header !== null && (/^\d+$/.test(header) === false || Number(header) > maxBytes)) throw new Error("FILE_SIZE_LIMIT");
    const reader = response.body?.getReader();
    if (!reader) {
      if (header === null) throw new Error("UNBOUNDED_RESPONSE_STREAM");
      const b = new Uint8Array(await response.arrayBuffer());
      if (b.length > maxBytes) throw new Error("FILE_SIZE_LIMIT");
      return b;
    }
    let chunks = [], n = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        n += value.length;
        if (n > maxBytes) throw new Error("FILE_SIZE_LIMIT");
        chunks.push(value);
      }
    } catch (err) {
      try {
        await reader.cancel();
      } catch {
      }
      ;
      throw err;
    }
    const result = new Uint8Array(n);
    let at = 0;
    for (const part of chunks) {
      result.set(part, at);
      at += part.length;
    }
    chunks = null;
    return result;
  }
  function png(bytes) {
    return bytes.length > 8 && bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71;
  }
  function jpg(bytes) {
    return bytes.length > 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  }
  function webp(bytes) {
    return bytes.length > 12 && String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF" && String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP";
  }
  function pdf(bytes) {
    return bytes.length > 8 && String.fromCharCode(...bytes.subarray(0, 5)) === "%PDF-";
  }
  async function examineRaster(bytes, mime) {
    if (typeof globalThis.createImageBitmap !== "function") return manual("RASTER_DECODER_UNAVAILABLE", "raster");
    let bitmap;
    try {
      bitmap = await createImageBitmap(new Blob([bytes], { type: mime }));
      if (bitmap.width < 9 || bitmap.height < 9 || bitmap.width * bitmap.height > 24e6)
        return manual("RASTER_SIZE_UNSUPPORTED", "raster");
      const scale = Math.min(1, 300 / Math.max(bitmap.width, bitmap.height));
      const width = Math.max(9, Math.round(bitmap.width * scale));
      const height = Math.max(9, Math.round(bitmap.height * scale));
      const canvas = globalThis.document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return manual("RASTER_CANVAS_UNAVAILABLE", "raster");
      ctx.drawImage(bitmap, 0, 0, width, height);
      const analysis = analyzeSyntheticThinRegions(
        ctx.getImageData(0, 0, width, height),
        { probabilityThreshold: 0.75, maxRegions: 40 }
      );
      if (analysis.status !== "RESEARCH_AI_CANDIDATES_ONLY")
        return manual(
          "RASTER_SEGMENTATION_UNVERIFIED",
          "raster",
          { detail: analysis.reason }
        );
      return {
        schema: "printcheck.vision.local-order-artifact.v1",
        status: "RESEARCH_ONLY",
        type: "raster",
        method: "synthetic_MLP_proxy_300px",
        detected_regions: analysis.regionsTotal,
        thin_ink_pixels: analysis.thinInkPixels,
        narrow_gap_pixels: analysis.narrowGapPixels,
        dimensions_proxy_px: [width, height],
        pixel_downsampled: scale < 1,
        real_world_accuracy_verified: false,
        production_approved: false,
        physical_scale_proven: false,
        uploaded_to_external_service: false
      };
    } catch {
      return manual("RASTER_DECODING_FAILED", "raster");
    } finally {
      bitmap?.close();
    }
  }
  async function inspectOrderArtworkBytes(bytes, url, contentType = "", filenameHint = "") {
    if (!(bytes instanceof Uint8Array) || bytes.length < 4)
      return manual("EMPTY_OR_INVALID_FILE");
    const hinted = extensionType(filenameHint || url.pathname);
    if (/text\/html|application\/json/i.test(contentType))
      return manual("UNEXPECTED_HTML_OR_JSON_RESPONSE", hinted);
    const declaredSvg = /^image\/svg\+xml(?:\s*;|$)/i.test(contentType);
    const trueType = pdf(bytes) ? "pdf" : png(bytes) || jpg(bytes) || webp(bytes) ? "raster" : hinted === "svg" || hinted === "unknown" && declaredSvg ? "svg" : "unknown";
    if (hinted === "unsupported") return manual("UNSUPPORTED_VECTOR_OR_ARCHIVE_FORMAT", hinted);
    if (hinted !== "unknown" && hinted !== trueType)
      return manual("FILE_SIGNATURE_MISMATCH", hinted);
    if (trueType === "pdf") {
      return manual(
        "PDF_VECTOR_PAINT_PIPELINE_NOT_VERIFIED",
        "pdf",
        {
          header_recognized: true,
          file_bytes: bytes.length,
          source_color_spaces_verified: false,
          geometry_extracted: false
        }
      );
    }
    if (trueType === "svg") {
      if (bytes.length > 256e3) return manual("SVG_SOURCE_SIZE_UNSUPPORTED", "svg");
      let svg;
      try {
        svg = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      } catch {
        return manual("SVG_UTF8_INVALID", "svg");
      }
      const scan = inspectLocalSvgVector(svg, { maxCandidateMm: 1, includeCurvedProbes: false });
      if (scan.status !== "RESEARCH_VECTOR_CANDIDATES_ONLY")
        return manual("SVG_VECTOR_UNSUPPORTED", "svg", { detail: scan.reason });
      const candidates = scan.report.candidates;
      return {
        schema: "printcheck.vision.local-order-artifact.v1",
        status: "RESEARCH_ONLY",
        type: "svg",
        method: "source_vector_mm",
        detected_regions: candidates.length,
        min_line_document_mm: candidates.filter((c) => c.kind === "positive_width_mm").reduce((n, c) => Math.min(n, c.measured_mm), Infinity),
        min_gap_document_mm: candidates.filter((c) => c.kind === "negative_gap_mm").reduce((n, c) => Math.min(n, c.measured_mm), Infinity),
        source_ink_count: scan.report.source_colors_rgb.length,
        document_mm: [scan.report.width_document_mm, scan.report.height_document_mm],
        source_shape_count: scan.report.paths_count,
        full_artwork_coverage_verified: false,
        production_approved: false,
        physical_scale_proven: false,
        uploaded_to_external_service: false
      };
    }
    if (trueType === "raster") {
      const actual = png(bytes) ? "image/png" : jpg(bytes) ? "image/jpeg" : "image/webp";
      return examineRaster(bytes, actual);
    }
    return manual("FILE_TYPE_UNKNOWN");
  }
  async function fetchSameOriginArtworkBytes(anchor, {
    fetcher = globalThis.fetch,
    loc = globalThis.location,
    timeoutMs = LOCAL_ORDERS.timeoutMs,
    maxFileBytes = LOCAL_ORDERS.maxFileBytes
  } = {}) {
    if (!isAllowedTestOrderPage(loc)) return manual("NOT_TEST_ORDER_PAGE");
    const url = sameOriginArtifactUrl(anchor?.getAttribute?.("href"), loc);
    if (!url) return manual("CROSS_ORIGIN_OR_UNSAFE_FILE_URL");
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 6e4)
      return manual("INVALID_TIMEOUT");
    if (!Number.isSafeInteger(maxFileBytes) || maxFileBytes < 1 || maxFileBytes > LOCAL_ORDERS.maxFileBytes)
      return manual("INVALID_BYTE_LIMIT");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetcher(url.href, {
        method: "GET",
        credentials: "same-origin",
        mode: "same-origin",
        redirect: "error",
        referrerPolicy: "no-referrer",
        cache: "no-store",
        signal: controller.signal
      });
      if (!response?.ok) return manual(
        "ARTWORK_HTTP_ERROR",
        extensionType(url.pathname),
        { http_status: response?.status || 0 }
      );
      const bytes = await readBounded(response, maxFileBytes);
      return {
        status: "LOCAL_BYTES_ONLY",
        bytes,
        url,
        contentType: response.headers.get("content-type") || ""
      };
    } catch (err) {
      return manual(controller.signal.aborted ? "ARTWORK_TIMEOUT" : err?.message === "FILE_SIZE_LIMIT" ? "FILE_SIZE_LIMIT" : "ARTWORK_NETWORK_OR_CORS_FAILURE");
    } finally {
      clearTimeout(timer);
    }
  }
  async function inspectSameOriginArtwork(anchor, options = {}) {
    const payload = await fetchSameOriginArtworkBytes(anchor, options);
    if (payload.status !== "LOCAL_BYTES_ONLY") return payload;
    return inspectOrderArtworkBytes(payload.bytes, payload.url, payload.contentType);
  }

  // vision/orders/local-training-zip.mjs
  var te = new TextEncoder();
  var allowedLabels = /* @__PURE__ */ new Set([
    "confirmed_defect",
    "false_positive",
    "missed_defect",
    "expert_clear"
  ]);
  var refused2 = (reason) => ({ status: "MANUAL", reason, production_approved: false });
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
  function suffix(url, bytes, filenameHint = "") {
    const match = /\.([a-z0-9]+)$/i.exec(filenameHint || url.pathname);
    const ext = match?.[1]?.toLowerCase();
    if (["svg", "pdf", "png", "jpg", "jpeg", "webp", "cdr", "eps", "ai"].includes(ext))
      return ext;
    if (bytes.length > 5 && String.fromCharCode(...bytes.subarray(0, 5)) === "%PDF-")
      return "pdf";
    if (bytes.length > 8 && bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78)
      return "png";
    if (bytes.length > 3 && bytes[0] === 255 && bytes[1] === 216) return "jpg";
    if (bytes.length > 12 && String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF") return "webp";
    if (bytes.length <= 256e3) {
      try {
        if (/^\s*<svg\b/.test(new TextDecoder("utf-8", { fatal: true }).decode(bytes)))
          return "svg";
      } catch {
      }
    }
    return "bin";
  }
  async function optionalSha256(bytes) {
    if (!globalThis.crypto?.subtle) return null;
    try {
      const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
      return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
    } catch {
      return null;
    }
  }
  async function* exportLocalDatasetParts(rows, {
    loc = globalThis.location,
    fetcher = globalThis.__visionLocalTrustedTransport || globalThis.fetch,
    onProgress = () => {
    },
    maxPerFile = 16e6,
    maxPartBytes = 24e6,
    maxFilesPerPart = 16
  } = {}) {
    if (!isAllowedTestOrderPage(loc)) {
      yield refused2("NOT_TEST_ORDER_PAGE");
      return;
    }
    if (!Array.isArray(rows) || maxPerFile < 1 || maxPerFile > 16e6 || maxPartBytes < maxPerFile || maxPartBytes > 24e6 || maxFilesPerPart < 1 || maxFilesPerPart > 16) {
      yield refused2("LOCAL_EXPORT_SETTINGS_INVALID");
      return;
    }
    const all2 = rows.flatMap((r) => (r.orderUploads?.length ? r.orderUploads : r.files || []).map((a) => ({ file: a, row: r })));
    if (!all2.length) {
      yield refused2("NO_SOURCE_ARTWORK");
      return;
    }
    let part = 0, saved = 0, processed = 0, entries = [], samples = [], skipped = [], bytes = 0;
    const buildPart = () => {
      if (!samples.length) return null;
      part++;
      const manifest = {
        schema: "printcheck.vision.local-test-artwork.v0",
        created_at: (/* @__PURE__ */ new Date()).toISOString(),
        source: "local_test_orders",
        training_ready: false,
        roi_annotations_verified: false,
        held_out_families_verified: false,
        source_order_ids_included: false,
        source_urls_included: false,
        public_upload_permitted: false,
        contains_original_filenames: true,
        warning: "PRIVATE local archive. Unreviewed and row-only labels are NOT verified ROI training annotations.",
        samples,
        skipped
      };
      const parts = [{
        name: "manifest.json",
        bytes: te.encode(JSON.stringify(manifest, null, 2) + "\n")
      }, ...entries];
      const output = {
        status: "LOCAL_ZIP_READY",
        part,
        zip: makeLocalStoredZip(parts),
        manifest,
        sample_count: samples.length,
        skipped_count: skipped.length,
        processed_files: processed,
        total_files: all2.length
      };
      entries = [];
      samples = [];
      skipped = [];
      bytes = 0;
      return output;
    };
    for (const { file: a, row: r } of all2) {
      processed++;
      onProgress({ processed, total: all2.length, saved, part: part + 1 });
      const response = a.role === "customer_uploaded_artwork" ? await fetchOrderResourceBytes(a, { fetcher, loc, maxBytes: maxPerFile }) : await fetchSameOriginArtworkBytes(a, { fetcher, loc, maxFileBytes: maxPerFile });
      if (response.status !== "LOCAL_BYTES_ONLY") {
        skipped.push({ row_index: r.row_index, reason: response.reason || "FILE_UNAVAILABLE" });
        continue;
      }
      const supplied = a.originalFilename ?? a.filename ?? "";
      const originalName = supplied ? exactLocalFilename(supplied) : null;
      if (supplied && !originalName) {
        skipped.push({ row_index: r.row_index, reason: "ORIGINAL_FILENAME_UNSAFE_TO_EXPORT" });
        continue;
      }
      if (samples.length >= maxFilesPerPart || bytes + response.bytes.length > maxPartBytes) {
        const batch = buildPart();
        if (batch) yield batch;
      }
      const slot = String(samples.length + 1).padStart(4, "0");
      const name = originalName ? "samples/" + slot + "/" + originalName : "samples/" + slot + "." + suffix(response.url, response.bytes, "");
      const label = r.grade?.value || "unreviewed";
      const sha = await optionalSha256(response.bytes);
      samples.push({
        sample_name: name,
        anonymous_row_index: r.row_index,
        ...originalName ? { original_filename: originalName } : {},
        expert_label: allowedLabels.has(label) ? label : "unreviewed",
        expert_label_scope: allowedLabels.has(label) ? "whole_order_row_not_object_ROI" : "not_yet_expert_labeled",
        bytes: response.bytes.length,
        sha256: sha,
        source_size_and_placement_proven: false,
        trusted_artwork_provenance_proven: false
      });
      entries.push({ name, bytes: response.bytes });
      bytes += response.bytes.length;
      saved++;
      if (samples.length >= maxFilesPerPart) {
        const batch = buildPart();
        if (batch) yield batch;
      }
    }
    const tail = buildPart();
    if (tail) yield tail;
    if (saved === 0) yield refused2("NO_EXPORTABLE_ARTWORK");
  }

  // vision/orders/approval-attachments.mjs
  var te2 = new TextEncoder();
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
    const length2 = Math.ceil((size + 9) / 64) * 64;
    const data = new Uint8Array(length2);
    data.set(bytes);
    data[size] = 128;
    const view = new DataView(data.buffer);
    view.setUint32(length2 - 8, Math.floor(size / 536870912));
    view.setUint32(length2 - 4, size * 8 >>> 0);
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
    for (let offset = 0; offset < length2; offset += 64) {
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

  // vision/orders/approval-batch-archive.mjs
  var BATCH_MAX_BYTES = 18e7;
  var MAX_PART = 26e6;
  var MAX_PACKET = 48e3;
  var MAX_ENTRIES = 1e4;
  var te3 = new TextEncoder();
  var td = new TextDecoder("utf-8", { fatal: true });
  var numeric = (v) => typeof v === "string" && /^\d{5,12}$/.test(v);
  var fail = (c) => {
    throw Error(c);
  };
  var u16 = (v, n, d) => v.setUint16(n, d, true);
  var u32 = (v, n, d) => v.setUint32(n, d >>> 0, true);
  var json = (x) => te3.encode(JSON.stringify(x, null, 2) + "\n");
  function crc322(bytes) {
    let n = 4294967295;
    for (const b of bytes) {
      n ^= b;
      for (let i = 0; i < 8; i++) n = n >>> 1 ^ (n & 1 ? 3988292384 : 0);
    }
    return (n ^ 4294967295) >>> 0;
  }
  function safePath(name) {
    if (typeof name !== "string" || name.length > 420 || name.includes("..") || name.includes("\\") || name.startsWith("/") || name.includes("//") || /[\x00-\x1f\x7f]/.test(name)) return false;
    return name === "manifest.json" || name === "index/orders.json" || /^orders\/\d{5,12}\/(?:order|articles|approvals|review|files-index)\.json$/.test(name) || /^orders\/\d{5,12}\/source\/(?:evidence|backup)\.json$/.test(name) || /^orders\/\d{5,12}\/threads\/\d{1,20}\.json$/.test(name) || /^orders\/\d{5,12}\/assets\/[a-f0-9]{64}\.(?:pdf|psd|psb|png|jpe?g|webp|tiff?|gif|svg|eps|ai|cdr|zip)$/.test(name);
  }
  function buildVisionZip(entries) {
    if (!Array.isArray(entries) || !entries.length || entries.length > MAX_ENTRIES)
      fail("MANUAL_ZIP_ENTRY_COUNT");
    const chunks = [], central = [], names = /* @__PURE__ */ new Set();
    let position = 0, centralSize = 0;
    for (const { name, bytes } of entries) {
      if (!safePath(name) || names.has(name) || !(bytes instanceof Uint8Array) || bytes.length > MAX_PART) fail("MANUAL_ZIP_ENTRY_INVALID");
      const path = te3.encode(name);
      if (path.length > 65535) fail("MANUAL_ZIP_PATH_TOO_LONG");
      names.add(name);
      const size = bytes.length, c = crc322(bytes);
      const local = new Uint8Array(30 + path.length), dv = new DataView(local.buffer);
      u32(dv, 0, 67324752);
      u16(dv, 4, 20);
      u16(dv, 6, 2048);
      u16(dv, 8, 0);
      u16(dv, 10, 0);
      u16(dv, 12, 0);
      u32(dv, 14, c);
      u32(dv, 18, size);
      u32(dv, 22, size);
      u16(dv, 26, path.length);
      u16(dv, 28, 0);
      local.set(path, 30);
      const cd = new Uint8Array(46 + path.length), v = new DataView(cd.buffer);
      u32(v, 0, 33639248);
      u16(v, 4, 20);
      u16(v, 6, 20);
      u16(v, 8, 2048);
      u16(v, 10, 0);
      u16(v, 12, 0);
      u16(v, 14, 0);
      u32(v, 16, c);
      u32(v, 20, size);
      u32(v, 24, size);
      u16(v, 28, path.length);
      u16(v, 30, 0);
      u16(v, 32, 0);
      u16(v, 34, 0);
      u16(v, 36, 0);
      u32(v, 38, 0);
      u32(v, 42, position);
      cd.set(path, 46);
      chunks.push(local, bytes);
      central.push(cd);
      position += local.length + size;
      centralSize += cd.length;
      if (position + centralSize > BATCH_MAX_BYTES + 5e6) fail("MANUAL_ZIP_SIZE_LIMIT");
    }
    if (entries.length > 65535 || position + centralSize >= 4294967295) fail("MANUAL_ZIP32_LIMIT");
    const end = new Uint8Array(22), ev = new DataView(end.buffer);
    u32(ev, 0, 101010256);
    u16(ev, 4, 0);
    u16(ev, 6, 0);
    u16(ev, 8, entries.length);
    u16(ev, 10, entries.length);
    u32(ev, 12, centralSize);
    u32(ev, 16, position);
    u16(ev, 20, 0);
    return new Blob([...chunks, ...central, end], { type: "application/zip" });
  }
  function readStoredEntries(bytes) {
    if (!(bytes instanceof Uint8Array) || bytes.length < 22 || bytes.length > MAX_PART)
      fail("MANUAL_BAD_PART_LENGTH");
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let offset = 0;
    const result = /* @__PURE__ */ new Map();
    while (offset + 4 <= bytes.length && dv.getUint32(offset, true) === 67324752) {
      if (offset + 30 > bytes.length) fail("MANUAL_ZIP_HEADER_TRUNCATED");
      const flags = dv.getUint16(offset + 6, true), method = dv.getUint16(offset + 8, true);
      const expected = dv.getUint32(offset + 14, true), size = dv.getUint32(offset + 18, true);
      const compressed = dv.getUint32(offset + 22, true);
      const len = dv.getUint16(offset + 26, true), extra = dv.getUint16(offset + 28, true);
      if (flags !== 2048 || method !== 0 || size !== compressed || size > 16e6)
        fail("MANUAL_ZIP_UNSUPPORTED_CONTENT");
      const start = offset + 30 + len + extra, end = start + size;
      if (end > bytes.length || len === 0) fail("MANUAL_ZIP_TRUNCATED");
      const name = td.decode(bytes.subarray(offset + 30, offset + 30 + len));
      if (!/^(?:manifest\.json|attachments\/\d{4}\/\d{4}\.[a-z0-9]{2,5})$/.test(name) || result.has(name)) fail("MANUAL_ZIP_UNSAFE_INNER_NAME");
      const data = bytes.subarray(start, end);
      if (crc322(data) !== expected) fail("MANUAL_ZIP_CRC_MISMATCH");
      result.set(name, data);
      offset = end;
      if (result.size > 15) fail("MANUAL_ZIP_TOO_MANY_INNER_FILES");
    }
    if (!result.has("manifest.json") || offset + 22 > bytes.length)
      fail("MANUAL_ZIP_PART_UNREADABLE");
    if (dv.getUint32(offset, true) !== 33639248)
      fail("MANUAL_ZIP_CENTRAL_HEADER_MISSING");
    return result;
  }
  var fromB64 = (str) => {
    if (typeof str !== "string" || str.length > MAX_PACKET * 2 || !/^[A-Za-z0-9+/]*={0,2}$/.test(str)) fail("MANUAL_CHUNK_BASE64");
    const s = atob(str);
    if (s.length > MAX_PACKET) fail("MANUAL_CHUNK_TOO_LARGE");
    return Uint8Array.from(s, (c) => c.charCodeAt(0));
  };
  var ApprovalBatchSession = class {
    constructor() {
      this.transfers = /* @__PURE__ */ new Map();
      this.records = /* @__PURE__ */ new Map();
      this.bytesReceived = 0;
      this.partialFailures = [];
    }
    receive(message, expectedOrder) {
      try {
        const order = message?.order_number;
        if (!numeric(order) || order !== expectedOrder) fail("MANUAL_TRANSFER_ORDER_MISMATCH");
        const type = message?.kind;
        const stage = message?.stage;
        const part = message?.part;
        if (!(type === "evidence" && ["raw", "final"].includes(stage) && part === 0 || type === "attachment_zip" && stage === "binary" && Number.isInteger(part) && part >= 1 && part <= 64))
          fail("MANUAL_TRANSFER_KIND_INVALID");
        const seq = message?.sequence, total = message?.chunk_count;
        if (!Number.isInteger(seq) || !Number.isInteger(total) || total < 1 || total > 600 || seq < 0 || seq >= total) fail("MANUAL_TRANSFER_SEQUENCE");
        const key = [order, type, stage, part].join(":");
        let transfer = this.transfers.get(key);
        if (!transfer) {
          if (seq !== 0) fail("MANUAL_TRANSFER_FIRST_CHUNK_MISSING");
          transfer = { order, type, stage, part, total, next: 0, chunks: [], size: 0 };
          this.transfers.set(key, transfer);
        }
        if (transfer.total !== total || transfer.next !== seq) fail("MANUAL_TRANSFER_ORDERING");
        const bytes = fromB64(message.chunk);
        if (this.bytesReceived + bytes.length > BATCH_MAX_BYTES)
          fail("MANUAL_BATCH_MEMORY_LIMIT");
        transfer.chunks.push(bytes);
        transfer.size += bytes.length;
        this.bytesReceived += bytes.length;
        transfer.next++;
        if (transfer.next === transfer.total) {
          const data = new Uint8Array(transfer.size);
          let off = 0;
          for (const chunk of transfer.chunks) {
            data.set(chunk, off);
            off += chunk.length;
          }
          transfer.chunks = [];
          transfer.data = data;
          if (type === "evidence") {
            const decoded = JSON.parse(td.decode(data));
            if (decoded?.schema !== "printcheck.vision.private-approval-collection.v1" || decoded.order_number !== order || !Array.isArray(decoded.articles) || decoded.training_ready !== false || decoded.production_approved !== false)
              fail("MANUAL_BATCH_EVIDENCE_INVALID");
            transfer.report = decoded;
          } else {
            const parsed = readStoredEntries(data);
            const manifest = JSON.parse(td.decode(parsed.get("manifest.json")));
            if (manifest?.schema !== "printcheck.vision.private-approval-attachments.v1" || manifest.order_number !== order || manifest.package_part !== part || manifest.training_ready !== false || !Array.isArray(manifest.items))
              fail("MANUAL_BATCH_PART_MANIFEST_INVALID");
            transfer.manifest = manifest;
          }
        }
        return { status: "BATCH_CHUNK_ACCEPTED", complete: transfer.next === total };
      } catch (e) {
        return { status: String(e?.message || "MANUAL_BATCH_RECEIVE_ERROR").slice(0, 90) };
      }
    }
    get(order, type, stage, part) {
      const r = this.transfers.get([order, type, stage, part].join(":"));
      return r?.data ? r : null;
    }
    hasEvidence(order) {
      return !!this.get(order, "evidence", "final", 0);
    }
    /**
     * Persist only complete, independently validated transfer parts for an
     * approved order. An interrupted order is retried after a page reload.
     */
    exportOrder(order) {
      if (!numeric(order) || !this.hasEvidence(order))
        fail("MANUAL_RANGE_EVIDENCE_NOT_COMPLETE");
      const transfers = [...this.transfers.values()].filter((t) => t.order === order && t.data instanceof Uint8Array && t.next === t.total);
      if (!transfers.some((t) => t.type === "evidence" && t.stage === "final"))
        fail("MANUAL_RANGE_FINAL_EVIDENCE_MISSING");
      return transfers.map((t) => ({
        type: t.type,
        stage: t.stage,
        part: t.part,
        total: t.total,
        data: t.data,
        report: t.report || null,
        manifest: t.manifest || null
      }));
    }
    restoreOrder(order, parts) {
      if (!numeric(order) || !Array.isArray(parts) || parts.length > 68 || !parts.some((t) => t.type === "evidence" && t.stage === "final"))
        fail("MANUAL_RANGE_PERSISTED_EVIDENCE_INVALID");
      const restored = [];
      let size = 0;
      for (const t of parts) {
        if (!(t.type === "evidence" && ["raw", "final"].includes(t.stage) && t.part === 0 || t.type === "attachment_zip" && t.stage === "binary" && Number.isInteger(t.part) && t.part >= 1 && t.part <= 64) || !(t.data instanceof Uint8Array) || !Number.isInteger(t.total) || t.total < 1 || t.total > 600 || t.data.length > MAX_PART)
          fail("MANUAL_RANGE_PERSISTED_PART_INVALID");
        if (t.type === "evidence" && (t.report?.order_number !== order || t.report?.schema !== "printcheck.vision.private-approval-collection.v1"))
          fail("MANUAL_RANGE_PERSISTED_REPORT_INVALID");
        if (t.type === "attachment_zip" && (t.manifest?.order_number !== order || t.manifest?.schema !== "printcheck.vision.private-approval-attachments.v1"))
          fail("MANUAL_RANGE_PERSISTED_MANIFEST_INVALID");
        const key = [order, t.type, t.stage, t.part].join(":");
        if (this.transfers.has(key) || restored.some((x) => x.key === key))
          fail("MANUAL_RANGE_PERSISTED_DUPLICATE");
        size += t.data.length;
        restored.push({ key, t });
      }
      if (this.bytesReceived + size > BATCH_MAX_BYTES)
        fail("MANUAL_RANGE_PERSISTED_MEMORY_LIMIT");
      for (const { key, t } of restored) this.transfers.set(key, {
        order,
        type: t.type,
        stage: t.stage,
        part: t.part,
        total: t.total,
        next: t.total,
        size: t.data.length,
        chunks: [],
        data: t.data,
        report: t.report || void 0,
        manifest: t.manifest || void 0
      });
      this.bytesReceived += size;
    }
    discardOrder(order) {
      for (const [key, t] of this.transfers) {
        if (t.order !== order) continue;
        this.bytesReceived = Math.max(0, this.bytesReceived - (t.size || 0));
        this.transfers.delete(key);
      }
    }
    receivedOrderIds() {
      return [...new Set([...this.transfers.values()].map((x) => x.order))].sort();
    }
    finalize(orderedResults = []) {
      const entries = [], index = [];
      let verified = 0, missing = 0, unverifiedOrders = 0;
      for (const row of orderedResults) {
        const order = row.order_number;
        if (!numeric(order)) fail("MANUAL_BATCH_ORDER_INVALID");
        const evidence = this.get(order, "evidence", "final", 0) || this.get(order, "evidence", "raw", 0);
        if (!evidence) {
          unverifiedOrders++;
          index.push({
            order_number: order,
            collection_status: row.status,
            evidence_status: "MISSING"
          });
          continue;
        }
        const source = evidence.report, base = "orders/" + order + "/";
        const orderFacts = source.order_facts || {};
        entries.push({ name: base + "order.json", bytes: json(orderFacts.order || {}) });
        entries.push({ name: base + "articles.json", bytes: json(orderFacts.articles || []) });
        entries.push({ name: base + "source/evidence.json", bytes: evidence.data });
        const raw = this.get(order, "evidence", "raw", 0);
        if (raw && evidence.stage === "final")
          entries.push({ name: base + "source/backup.json", bytes: raw.data });
        const approvals = [];
        const fileIndex = [], assetPaths = /* @__PURE__ */ new Set();
        for (const article of source.articles) {
          const item = article.item_id;
          const itemName = typeof item === "string" && /^\d{1,20}$/.test(item) ? item : "unknown";
          approvals.push({
            item_id: item,
            status: article.status,
            declared_message_badge: article.declared_message_badge,
            observed_human_comments: article.observed_human_comments,
            current_problems: article.current_problems || [],
            additional_problem_description: article.additional_problem_description || "",
            source_pdf_revision_confirmed: false,
            expert_roi_confirmed: false
          });
          if (Array.isArray(article.history)) {
            if (itemName === "unknown") fail("MANUAL_ARTICLE_ID_UNKNOWN");
            entries.push({ name: base + "threads/" + itemName + ".json", bytes: json({
              order_number: order,
              item_id: item,
              history: article.history,
              current_problems: article.current_problems || [],
              training_ready: false
            }) });
          }
        }
        entries.push({ name: base + "approvals.json", bytes: json(approvals) });
        const actualPartItems = /* @__PURE__ */ new Map();
        for (let part = 1; part <= 64; part++) {
          const p = this.get(order, "attachment_zip", "binary", part);
          if (!p) continue;
          const files = readStoredEntries(p.data);
          for (const info of p.manifest.items) {
            const bytes = files.get(info.entry);
            if (!bytes || bytes.length !== info.bytes || portableSha256Hex(bytes) !== info.sha256)
              fail("MANUAL_BATCH_FILE_SHA_MISMATCH");
            const ext = String(info.original_filename || "").split(".").at(-1).toLowerCase();
            if (!/^(?:pdf|psd|psb|png|jpe?g|webp|tiff?|gif|svg|eps|ai|cdr|zip)$/.test(ext))
              fail("MANUAL_BATCH_FILE_EXTENSION");
            const sha = info.sha256;
            const path = base + "assets/" + sha + "." + ext;
            if (!assetPaths.has(path)) {
              entries.push({ name: path, bytes });
              assetPaths.add(path);
            }
            const key = part + ":" + info.entry;
            if (actualPartItems.has(key)) fail("MANUAL_BATCH_DUPLICATE_FILE");
            actualPartItems.set(key, { ...info, asset_path: path });
          }
        }
        for (const article of source.articles) {
          for (const m of article.history || []) {
            for (const a of m.attachments || []) {
              const key = a.private_zip_part + ":" + a.private_zip_entry;
              const found = actualPartItems.get(key);
              if (a.local_get_status === "LOCAL_ATTACHMENT_BYTES_ONLY") {
                if (!found || found.order_item_id !== article.item_id || found.comment_sequence !== m.sequence || found.sha256 !== a.sha256 || found.original_filename !== a.filename)
                  fail("MANUAL_BATCH_ATTACHMENT_LINK_MISMATCH");
                fileIndex.push({
                  item_id: article.item_id,
                  comment_sequence: m.sequence,
                  native_comment_id: m.native_comment_id || null,
                  original_filename: a.filename,
                  source: a.source || "native_attachment",
                  attachment_id: a.attachment_id || null,
                  sha256: a.sha256,
                  asset_path: found.asset_path
                });
                verified++;
              } else {
                missing++;
                fileIndex.push({
                  item_id: article.item_id,
                  comment_sequence: m.sequence,
                  original_filename: a.filename,
                  download_status: a.local_get_status || "NOT_ATTEMPTED",
                  asset_path: null,
                  sha256: null
                });
              }
            }
          }
        }
        entries.push({ name: base + "files-index.json", bytes: json(fileIndex) });
        entries.push({ name: base + "review.json", bytes: json({
          order_number: order,
          source_pdf_revision_confirmed: false,
          expert_roi_confirmed: false,
          training_ready: false,
          production_approved: false,
          pending_checks: ["SOURCE_ARTWORK_REVISION", "PRINT_METHOD", "EXPERT_ROI", "EXPERT_LABELS"]
        }) });
        index.push({
          order_number: order,
          collection_status: row.status,
          evidence_status: evidence.stage === "final" ? "FINAL" : "BACKUP_ONLY",
          articles: source.articles.length,
          files_verified: fileIndex.filter((x) => x.asset_path).length,
          files_unavailable: fileIndex.filter((x) => !x.asset_path).length
        });
      }
      const counts = {
        orders: index.length,
        with_evidence: index.filter((x) => x.evidence_status !== "MISSING").length,
        unverified_orders: unverifiedOrders,
        verified_files: verified,
        missing_files: missing
      };
      entries.unshift({ name: "index/orders.json", bytes: json(index) });
      entries.unshift({ name: "manifest.json", bytes: json({
        schema: "printcheck.vision.local-batch-corpus.v1",
        created_at: (/* @__PURE__ */ new Date()).toISOString(),
        scope: "LOCAL_TEST_ONLY",
        counts,
        order_results: index,
        training_ready: false,
        production_approved: false,
        remote_upload: false,
        expert_labels_verified: false,
        source_pdf_revision_confirmed: false,
        notes: "All named discussions and order facts are source evidence, not verified training labels."
      }) });
      return {
        status: "BATCH_ARCHIVE_READY",
        blob: buildVisionZip(entries),
        counts,
        entry_count: entries.length
      };
    }
  };

  // vision/orders/extension-zip-transfer.mjs
  async function startExtensionZipDownload(blob, filename) {
    if (!(blob instanceof Blob) || blob.size < 100 || blob.size > 2e8 || !/^vision-ai-(?:range-\d{7}-\d{7}-part|list-part)-\d{5}-\d{7}-\d{7}\.zip$/.test(filename))
      throw Error("VISION_ZIP_TRANSFER_ARGS_INVALID");
    if (!globalThis.chrome?.runtime?.sendMessage)
      throw Error("VISION_ZIP_EXTENSION_TRANSPORT_REQUIRED");
    const random = new Uint8Array(16);
    crypto.getRandomValues(random);
    const job = Array.from(random, (b) => b.toString(16).padStart(2, "0")).join("");
    const command = (op, extra = {}) => chrome.runtime.sendMessage({
      op: "vision-zip-secure-message-v1",
      action: op,
      job,
      ...extra
    });
    const begin = await command("begin", { filename, size: blob.size });
    if (begin?.status !== "ZIP_READY_FOR_CHUNK")
      throw Error(begin?.status || "VISION_ZIP_BEGIN_FAILED");
    let finished = false;
    try {
      let sequence = 0;
      for (let offset = 0; offset < blob.size; offset += 48e3) {
        const part = new Uint8Array(await blob.slice(offset, offset + 48e3).arrayBuffer());
        let binary = "";
        for (let i = 0; i < part.length; i += 8192)
          binary += String.fromCharCode(...part.subarray(i, i + 8192));
        const result2 = await command("chunk", { sequence, base64: btoa(binary) });
        if (result2?.status !== "ZIP_CHUNK_ACCEPTED")
          throw Error(result2?.status || "VISION_ZIP_CHUNK_FAILED");
        sequence++;
      }
      const result = await command("finish", { chunks: sequence });
      if (result?.status !== "ZIP_DOWNLOAD_STARTED" || !Number.isSafeInteger(result.download_id) || result.download_id < 0)
        throw Error(result?.status || "VISION_ZIP_FINISH_FAILED");
      finished = true;
      return result.download_id;
    } finally {
      if (!finished) void command("cancel").catch(() => {
      });
    }
  }

  // vision/orders/approval-network-control.mjs
  var NETWORK_RETRY_LIMIT = 3;
  var NETWORK_CIRCUIT_LIMIT = 6;
  var freshNetworkHealth = () => ({
    attempts: 0,
    retries: 0,
    transient_errors: 0,
    consecutive_errors: 0,
    auth_errors: 0,
    rate_limits: 0,
    last_error: null,
    last_http_status: null,
    last_error_at: null,
    last_success_at: null,
    last_request_at: null,
    state: "idle",
    last_duration_ms: null
  });
  function normalizeNetworkHealth(value) {
    const base = freshNetworkHealth();
    if (!value || typeof value !== "object") return base;
    for (const key of [
      "attempts",
      "retries",
      "transient_errors",
      "consecutive_errors",
      "auth_errors",
      "rate_limits"
    ]) {
      const n = value[key];
      if (Number.isSafeInteger(n) && n >= 0) base[key] = n;
    }
    for (const key of [
      "last_error",
      "last_error_at",
      "last_success_at",
      "last_request_at",
      "state"
    ]) {
      if (typeof value[key] === "string" && value[key].length <= 100)
        base[key] = value[key];
    }
    if (Number.isInteger(value.last_http_status) && value.last_http_status >= 100 && value.last_http_status <= 599) base.last_http_status = value.last_http_status;
    if (Number.isSafeInteger(value.last_duration_ms) && value.last_duration_ms >= 0)
      base.last_duration_ms = value.last_duration_ms;
    return base;
  }
  function networkFailureType(result) {
    const status = String(result?.status || "");
    if (status === "MANUAL_ORDER_AUTH_REQUIRED") return "auth";
    if (status === "MANUAL_ORDER_RATE_LIMITED") return "rate_limit";
    if ([
      "MANUAL_ORDER_FETCH_FAILED",
      "EXTENSION_FETCH_TIMEOUT",
      "MANUAL_NON_HTML_RESPONSE"
    ].includes(status)) return "transient";
    if (status === "MANUAL_ORDER_HTTP_STATUS" && (result.http_status === 408 || result.http_status >= 500)) return "transient";
    if (["TZ_APPROVED", "TZ_NOT_APPROVED", "ORDER_NOT_FOUND"].includes(status))
      return "ok";
    return "other";
  }
  async function controlledOrderProbe(order, probe, {
    health = freshNetworkHealth(),
    sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    now = () => (/* @__PURE__ */ new Date()).toISOString(),
    maxRetries = NETWORK_RETRY_LIMIT
  } = {}) {
    if (typeof probe !== "function" || !Number.isInteger(maxRetries) || maxRetries < 0 || maxRetries > 3) throw Error("VISION_NETWORK_CONFIG_INVALID");
    const stats = normalizeNetworkHealth(health);
    const started = Date.now();
    let response = null, kind = "other", used = 0;
    stats.last_request_at = now();
    stats.state = "requesting";
    for (let n = 0; n <= maxRetries; n++) {
      stats.attempts++;
      try {
        response = await probe(order);
      } catch {
        response = { status: "MANUAL_ORDER_FETCH_FAILED" };
      }
      kind = networkFailureType(response);
      if (kind !== "transient" || n === maxRetries) break;
      stats.retries++;
      used++;
      await sleep(Math.min(2e3, 400 * (n + 1)));
    }
    stats.last_duration_ms = Math.max(0, Date.now() - started);
    if (kind === "ok") {
      stats.consecutive_errors = 0;
      stats.last_success_at = now();
      stats.last_error = null;
      stats.last_http_status = null;
      stats.state = "online";
    } else {
      stats.last_error = String(response?.status || "MANUAL_ORDER_PROBE_UNKNOWN").slice(0, 80);
      stats.last_http_status = Number.isInteger(response?.http_status) ? response.http_status : null;
      stats.last_error_at = now();
      if (kind === "transient") {
        stats.transient_errors++;
        stats.consecutive_errors++;
        stats.state = stats.consecutive_errors >= NETWORK_CIRCUIT_LIMIT ? "circuit_open" : "degraded";
      } else if (kind === "auth") {
        stats.auth_errors++;
        stats.state = "auth_required";
      } else if (kind === "rate_limit") {
        stats.rate_limits++;
        stats.state = "rate_limited";
      } else stats.state = "degraded";
    }
    const halt = kind === "auth" || kind === "rate_limit" || kind === "transient" && stats.consecutive_errors >= NETWORK_CIRCUIT_LIMIT;
    return {
      result: response,
      health: stats,
      retries: used,
      kind,
      halt,
      reason: halt ? kind === "transient" ? "VISION_NETWORK_CIRCUIT_OPEN" : kind === "auth" ? "VISION_NETWORK_AUTH_REQUIRED" : "VISION_NETWORK_RATE_LIMITED" : null
    };
  }

  // vision/orders/approval-file-list.mjs
  var ORDER_LIST_MIN = 1e6;
  var ORDER_LIST_MAX = 9999999;
  var ORDER_LIST_MAX_COUNT = 1e6;
  var ORDER_LIST_MAX_BYTES = 2e7;
  function explicitListOrderUrl(order) {
    if (!Number.isSafeInteger(order) || order < ORDER_LIST_MIN || order > ORDER_LIST_MAX)
      throw Error("MANUAL_ORDER_LIST_ID_INVALID");
    return "http://testgifts.local/private/order/" + order;
  }
  function parseOrderListText(text2) {
    if (typeof text2 !== "string" || new TextEncoder().encode(text2).length > ORDER_LIST_MAX_BYTES)
      throw Error("MANUAL_ORDER_LIST_TOO_LARGE");
    const seen = /* @__PURE__ */ new Set(), numbers = [];
    const rows = text2.replace(/^\uFEFF/, "").split(/\r\n|\n|\r/);
    let duplicates = 0, empty2 = 0;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i].trim();
      if (!row) {
        empty2++;
        continue;
      }
      if (!/^[0-9]{7}$/.test(row))
        throw Error("MANUAL_ORDER_LIST_INVALID_LINE_" + (i + 1));
      const id = Number(row);
      if (id < ORDER_LIST_MIN || id > ORDER_LIST_MAX)
        throw Error("MANUAL_ORDER_LIST_ID_INVALID");
      if (seen.has(id)) {
        duplicates++;
        continue;
      }
      if (numbers.length >= ORDER_LIST_MAX_COUNT)
        throw Error("MANUAL_ORDER_LIST_TOO_MANY_NUMBERS");
      seen.add(id);
      numbers.push(id);
    }
    if (!numbers.length) throw Error("MANUAL_ORDER_LIST_EMPTY");
    return { numbers, duplicates, empty: empty2, source_lines: rows.length };
  }

  // vision/orders/approval-range-scanner.mjs
  var RANGE_MIN = 32e5;
  var RANGE_MAX = 82e5;
  var RANGE_ARCHIVE_SIZE = 100;
  var RANGE_MIN_DELAY_MS = 100;
  var MAX_BODY = 3e6;
  var digits2 = (s) => /^\d{5,12}$/.test(String(s || ""));
  var clear = (s) => String(s || "").replace(/\s+/g, " ").trim().toLocaleUpperCase("ru-RU");
  var exactText = (s) => clear(s) === "\u0422\u0417 \u0423\u0422\u0412\u0415\u0420\u0416\u0414\u0415\u041D\u041E";
  function rangeOrderUrl(number) {
    if (!Number.isSafeInteger(number) || number < RANGE_MIN || number > RANGE_MAX)
      throw Error("MANUAL_RANGE_ORDER_INVALID");
    return "http://testgifts.local/private/order/" + number;
  }
  function readTzApprovedStatus(doc, orderNumber) {
    if (!digits2(orderNumber) || !doc?.querySelector) return { status: "MANUAL_ORDER_ID_INVALID" };
    const root = doc.querySelector("#j_cart_host[data-orderid]");
    if (!root) return { status: "MANUAL_ORDER_CARD_MISSING" };
    const shown = root.querySelector(".cart-header-number [data-clipboard-text]")?.getAttribute("data-clipboard-text")?.trim();
    if (shown !== String(orderNumber)) return { status: "MANUAL_ORDER_NUMBER_MISMATCH" };
    const fields = [...root.querySelectorAll(
      '.cart-log label input.j_toggle_status[data-id="59"][type="checkbox"]'
    )];
    if (fields.length !== 1) return { status: "MANUAL_TZ_STATUS_MISSING_OR_AMBIGUOUS" };
    const input = fields[0], label = input.closest("label");
    const texts = [...label?.querySelectorAll(".btn--toggle .on,.btn--toggle .off") || []].map((node2) => node2.textContent);
    if (texts.length !== 2 || !texts.every(exactText))
      return { status: "MANUAL_TZ_LABEL_UNVERIFIED" };
    return {
      status: input.checked === true ? "TZ_APPROVED" : "TZ_NOT_APPROVED",
      native_status_id: "59",
      status_text: "\u0422\u0417 \u0443\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u043E",
      status_checked: input.checked === true,
      native_order_id: root.getAttribute("data-orderid") || null
    };
  }
  function safeDoc(html, DOMParserClass) {
    if (typeof html !== "string" || html.length > MAX_BODY || typeof DOMParserClass !== "function")
      return null;
    const inert = inertOrderDiscussionHtml(html);
    if (!inert) return null;
    try {
      return new DOMParserClass().parseFromString(inert, "text/html");
    } catch {
      return null;
    }
  }
  async function boundedHtml(response) {
    const type = response.headers?.get?.("content-type") || "";
    if (!/html/i.test(type)) throw Error("MANUAL_NON_HTML_RESPONSE");
    const announced = response.headers?.get?.("content-length");
    if (announced && Number(announced) > MAX_BODY) throw Error("MANUAL_ORDER_BODY_TOO_LARGE");
    if (!response.body?.getReader) {
      const data = await response.text();
      if (data.length > MAX_BODY) throw Error("MANUAL_ORDER_BODY_TOO_LARGE");
      return data;
    }
    const reader = response.body.getReader(), parts = [];
    let bytes = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > MAX_BODY) throw Error("MANUAL_ORDER_BODY_TOO_LARGE");
        parts.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    const out = new Uint8Array(bytes);
    let offset = 0;
    for (const part of parts) {
      out.set(part, offset);
      offset += part.length;
    }
    return new TextDecoder("utf-8", { fatal: true }).decode(out);
  }
  async function probeTzForOrder(orderNumber, {
    fetcher = globalThis.__visionLocalTrustedTransport,
    DOMParserClass = globalThis.DOMParser,
    signal,
    explicitList = false
  } = {}) {
    const url = explicitList ? explicitListOrderUrl(orderNumber) : rangeOrderUrl(orderNumber);
    if (typeof fetcher !== "function") return { status: "MANUAL_MV3_TRANSPORT_REQUIRED" };
    let response;
    try {
      response = await fetcher(url, {
        method: "GET",
        signal,
        credentials: "include",
        redirect: "error",
        cache: "no-store"
      });
      if (response.status === 404 || response.status === 410)
        return { status: "ORDER_NOT_FOUND", http_status: response.status };
      if (response.status === 401 || response.status === 403)
        return { status: "MANUAL_ORDER_AUTH_REQUIRED", http_status: response.status };
      if (response.status === 429)
        return { status: "MANUAL_ORDER_RATE_LIMITED", http_status: 429 };
      if (response.status !== 200)
        return { status: "MANUAL_ORDER_HTTP_STATUS", http_status: response.status };
      const html = await boundedHtml(response);
      if (/<form[^>]+name=["']authform["']/i.test(html) || /Авторизация\s*-\s*Проект\s*111/i.test(html))
        return { status: "MANUAL_ORDER_AUTH_REQUIRED" };
      const doc = safeDoc(html, DOMParserClass);
      if (!doc) return { status: "MANUAL_ORDER_HTML_INVALID" };
      return readTzApprovedStatus(doc, String(orderNumber));
    } catch (error) {
      if (signal?.aborted) return { status: "MANUAL_PROBE_CANCELLED" };
      const token = String(error?.message || "");
      if (token === "EXTENSION_AUTH_REDIRECT" || token === "TEST_SESSION_AUTH_REQUIRED")
        return { status: "MANUAL_ORDER_AUTH_REQUIRED" };
      if (token === "MANUAL_ORDER_BODY_TOO_LARGE" || token === "MANUAL_NON_HTML_RESPONSE")
        return { status: token };
      return { status: "MANUAL_ORDER_FETCH_FAILED" };
    }
  }
  var RECOVERABLE_RANGE_FAILURES = /* @__PURE__ */ new Set([
    "MANUAL_ORDER_FETCH_FAILED",
    "MANUAL_ORDER_HTTP_STATUS",
    "MANUAL_ORDER_BODY_TOO_LARGE",
    "MANUAL_NON_HTML_RESPONSE",
    "MANUAL_ORDER_HTML_INVALID",
    "MANUAL_ORDER_CARD_MISSING",
    "MANUAL_ORDER_NUMBER_MISMATCH",
    "MANUAL_TZ_STATUS_MISSING_OR_AMBIGUOUS",
    "MANUAL_TZ_LABEL_UNVERIFIED",
    "MANUAL_ORDER_ID_INVALID",
    "MANUAL_BACKGROUND_ORDER_FAILED",
    "MANUAL_QUEUE_ORDER_TIMEOUT",
    "MANUAL_TAB_CLOSED",
    "MANUAL_ORDER_URL_MISMATCH",
    "MANUAL_AUTO_SCAN_FAILED",
    "MANUAL_TZ_RECHECK_FAILED",
    "MANUAL_TZ_CHANGED_BEFORE_SCAN",
    "MANUAL_NATIVE_APPROVAL_QUEUE_FAILED",
    "MANUAL_BATCH_EVIDENCE_ENCODING_FAILED",
    "MANUAL_BATCH_RELAY_FAILED",
    "MANUAL_BATCH_RELAY_REJECTED",
    "MANUAL_BATCH_PAYLOAD_TOO_LARGE",
    "MANUAL_APPROVAL_COLLECTION_INCOMPLETE"
  ]);
  function isRecoverableRangeFailure(status) {
    return RECOVERABLE_RANGE_FAILURES.has(status) || /^MANUAL_ORDER_TAB_[A-Z0-9_]{1,80}$/.test(status || "");
  }
  var MAX_RETRY_ROWS = 2e4;
  function mergeRetryRows(previous, additions) {
    if (!Array.isArray(additions) || additions.length > RANGE_ARCHIVE_SIZE * 100)
      throw Error("MANUAL_RETRY_REGISTRY_INVALID");
    const unique = /* @__PURE__ */ new Map();
    for (const record of [...previous || [], ...additions]) {
      if (!/^\d{5,12}$/.test(record?.order_number || "") || typeof record?.reason !== "string" || record.reason.length > 90 || !isRecoverableRangeFailure(record.reason))
        throw Error("MANUAL_RETRY_ROW_INVALID");
      unique.set(record.order_number, record);
    }
    if (unique.size > MAX_RETRY_ROWS) throw Error("MANUAL_RETRY_REGISTRY_LIMIT");
    return [...unique.values()];
  }
  function rangeConfig(start, end, delay2 = RANGE_MIN_DELAY_MS) {
    const n = Number(start), m = Number(end), ms = Number(delay2);
    if (!Number.isSafeInteger(n) || !Number.isSafeInteger(m) || n < RANGE_MIN || m > RANGE_MAX || n > m)
      throw Error("MANUAL_RANGE_BOUNDS_INVALID");
    if (!Number.isSafeInteger(ms) || ms < RANGE_MIN_DELAY_MS || ms > 6e4)
      throw Error("MANUAL_RANGE_RATE_INVALID");
    return { start: n, end: m, delay_ms: ms, archive_size: RANGE_ARCHIVE_SIZE };
  }
  function changeRangeDelay(checkpoint, delayMs) {
    if (checkpoint?.schema !== "printcheck.vision.range-checkpoint.v1" || !checkpoint.config) throw Error("MANUAL_RANGE_CHECKPOINT_INVALID");
    const newConfig = rangeConfig(
      checkpoint.config.start,
      checkpoint.config.end,
      delayMs
    );
    if (newConfig.archive_size !== checkpoint.config.archive_size)
      throw Error("MANUAL_RANGE_CHECKPOINT_ARCHIVE_SIZE");
    return { ...checkpoint, config: newConfig, updated_at: (/* @__PURE__ */ new Date()).toISOString() };
  }
  function freshRangeCheckpoint(config) {
    return {
      schema: "printcheck.vision.range-checkpoint.v1",
      config,
      committed_next: config.start,
      archives_completed: 0,
      found_committed: 0,
      checked_committed: 0,
      registry: [],
      failed_orders: [],
      created_at: (/* @__PURE__ */ new Date()).toISOString(),
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
  function commitOnlySkipped(checkpoint, next, failedOrders = []) {
    if (checkpoint?.schema !== "printcheck.vision.range-checkpoint.v1" || !Number.isSafeInteger(next) || next < checkpoint.committed_next || next > checkpoint.config.end + 1) throw Error("MANUAL_SKIPPED_CHECKPOINT_INVALID");
    return {
      ...checkpoint,
      committed_next: next,
      failed_orders: mergeRetryRows(checkpoint.failed_orders || [], failedOrders),
      checked_committed: checkpoint.checked_committed + (next - checkpoint.committed_next),
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
  function commitRangeArchive(checkpoint, record) {
    if (checkpoint?.schema !== "printcheck.vision.range-checkpoint.v1" || !Number.isSafeInteger(record?.next) || record.next < checkpoint.committed_next || record.next > checkpoint.config.end + 1 || !Array.isArray(record?.found) || record.found.length > RANGE_ARCHIVE_SIZE)
      throw Error("MANUAL_CHECKPOINT_COMMIT_INVALID");
    const current = {
      ...checkpoint,
      committed_next: record.next,
      archives_completed: checkpoint.archives_completed + 1,
      found_committed: checkpoint.found_committed + record.found.length,
      checked_committed: checkpoint.checked_committed + (record.next - checkpoint.committed_next),
      registry: [...checkpoint.registry, ...record.found],
      failed_orders: mergeRetryRows(checkpoint.failed_orders || [], record.failed_orders || []),
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    if (current.registry.length > 1e5) throw Error("MANUAL_REGISTRY_CAPACITY");
    return current;
  }

  // vision/orders/approval-range-persistence.mjs
  var DB_NAME = "vision-ai-approved-range-pending-v1";
  var DB_VERSION = 1;
  var JOURNAL = "journal";
  var ORDERS = "orders";
  var ACTIVE = "active";
  var STATUS_SCHEMA = "printcheck.vision.range-journal.v1";
  var RANGE_JOURNAL_SCHEMA = STATUS_SCHEMA;
  function openDb(factory = globalThis.indexedDB) {
    if (!factory?.open) throw Error("MANUAL_RANGE_INDEXEDDB_UNAVAILABLE");
    return new Promise((resolve, reject2) => {
      const req = factory.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(JOURNAL)) db.createObjectStore(JOURNAL, { keyPath: "id" });
        if (!db.objectStoreNames.contains(ORDERS)) db.createObjectStore(ORDERS, { keyPath: "order_number" });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject2(Error("MANUAL_RANGE_INDEXEDDB_OPEN_FAILED"));
      req.onblocked = () => reject2(Error("MANUAL_RANGE_INDEXEDDB_BLOCKED"));
    });
  }
  function request(req) {
    return new Promise((resolve, reject2) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject2(Error("MANUAL_RANGE_INDEXEDDB_REQUEST_FAILED"));
    });
  }
  function complete(tx) {
    return new Promise((resolve, reject2) => {
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject2(Error("MANUAL_RANGE_INDEXEDDB_TRANSACTION_ABORTED"));
      tx.onerror = () => reject2(Error("MANUAL_RANGE_INDEXEDDB_TRANSACTION_FAILED"));
    });
  }
  async function transaction(mode, handler, factory) {
    const db = await openDb(factory);
    try {
      const tx = db.transaction([JOURNAL, ORDERS], mode), done = complete(tx);
      const result = handler(tx);
      await done;
      return await result;
    } finally {
      db.close();
    }
  }
  function verifyJournal(state) {
    if (state?.schema !== STATUS_SCHEMA || !Number.isSafeInteger(state.cursor) || !Number.isSafeInteger(state.archives_completed) || !["running", "paused", "stopped", "downloading"].includes(state.mode) || !Array.isArray(state.pending_registry) || !Array.isArray(state.failed_pending))
      throw Error("MANUAL_RANGE_JOURNAL_CORRUPTED");
  }
  async function loadRangeJournal(factory) {
    return transaction("readonly", async (tx) => {
      const journal = await request(tx.objectStore(JOURNAL).get(ACTIVE));
      if (!journal) return { journal: null, orders: [] };
      verifyJournal(journal);
      const orders = await request(tx.objectStore(ORDERS).getAll());
      return { journal, orders };
    }, factory);
  }
  async function saveRangeJournal(state, orderRecord = null, factory) {
    verifyJournal(state);
    if (orderRecord && (!/^\d{5,12}$/.test(orderRecord.order_number) || !Array.isArray(orderRecord.transfers)))
      throw Error("MANUAL_RANGE_JOURNAL_ORDER_INVALID");
    return transaction("readwrite", (tx) => {
      if (orderRecord) tx.objectStore(ORDERS).put(orderRecord);
      tx.objectStore(JOURNAL).put({ ...state, id: ACTIVE });
    }, factory);
  }
  async function setRangeJournalMode(mode, delayMs = null, factory) {
    if (!["running", "paused", "stopped", "downloading"].includes(mode))
      throw Error("MANUAL_RANGE_JOURNAL_MODE");
    if (delayMs !== null && (!Number.isSafeInteger(delayMs) || delayMs < 100 || delayMs > 6e4))
      throw Error("MANUAL_RANGE_JOURNAL_DELAY");
    return transaction("readwrite", async (tx) => {
      const store = tx.objectStore(JOURNAL), state = await request(store.get(ACTIVE));
      if (!state) return;
      verifyJournal(state);
      store.put({
        ...state,
        mode,
        delay_ms: delayMs ?? state.delay_ms,
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      });
    }, factory);
  }
  async function clearRangeJournal(factory) {
    return transaction("readwrite", (tx) => {
      tx.objectStore(JOURNAL).clear();
      tx.objectStore(ORDERS).clear();
    }, factory);
  }
  async function pruneRangeJournalOrders(state, orderNumbers, factory) {
    verifyJournal(state);
    if (!Array.isArray(orderNumbers) || orderNumbers.length < 1 || orderNumbers.length > 100 || orderNumbers.some((n) => !/^\d{7}$/.test(n)))
      throw Error("MANUAL_RANGE_PRUNE_INVALID");
    return transaction("readwrite", (tx) => {
      const store = tx.objectStore(ORDERS);
      for (const id of orderNumbers) store.delete(id);
      tx.objectStore(JOURNAL).put({ ...state, id: ACTIVE });
    }, factory);
  }

  // vision/orders/approval-range-controller.mjs
  var KEY = "vision-ai-approved-range-checkpoint-v1";
  var delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  var sameRange = (a, b) => a?.start === b?.start && a?.end === b?.end && a?.archive_size === b?.archive_size;
  var create = (tag, text2) => {
    const n = document.createElement(tag);
    if (text2 !== void 0) n.textContent = text2;
    return n;
  };
  var button = (label, fn) => {
    const el2 = create("button", label);
    el2.type = "button";
    el2.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      fn();
    });
    return el2;
  };
  function makeApprovalRangeController({
    getBusy = () => false,
    setBusy = () => {
    },
    scanOrder = async () => null,
    isClosed = () => false,
    refreshControls = () => {
    }
  } = {}) {
    const root = create("div");
    root.className = "vlo-range";
    root.style.cssText = "width:100%;border:1px solid #69898b;border-radius:8px;padding:10px;margin:10px 0;";
    root.append(create("strong", "\u0414\u0438\u0430\u043F\u0430\u0437\u043E\u043D \u0437\u0430\u043A\u0430\u0437\u043E\u0432 \xB7 \u0441\u0442\u0430\u0442\u0443\u0441 \xAB\u0422\u0417 \u0443\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u043E\xBB"));
    root.append(create("p", "\u0422\u043E\u043B\u044C\u043A\u043E \u043E\u0442\u043C\u0435\u0447\u0435\u043D\u043D\u044B\u0439 \u0441\u0442\u0430\u0442\u0443\u0441 ID 59. \u041E\u0434\u0438\u043D GET \u043D\u0430 \u043D\u043E\u043C\u0435\u0440; \u043A\u0430\u0436\u0434\u044B\u0435 100 \u0443\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043D\u043D\u044B\u0445 \u0437\u0430\u043A\u0430\u0437\u043E\u0432 \u2014 \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u044B\u0439 ZIP. \u0417\u0430\u0434\u0435\u0440\u0436\u043A\u0430 100\u201360000 \u043C\u0441 \u0438\u0437\u043C\u0435\u043D\u044F\u0435\u0442\u0441\u044F \u0432\u043E \u0432\u0440\u0435\u043C\u044F \u0440\u0430\u0431\u043E\u0442\u044B. \u0421\u0442\u0440\u0430\u043D\u0438\u0446\u0430 \u0441\u043F\u0438\u0441\u043A\u0430 \u0434\u043E\u043B\u0436\u043D\u0430 \u043E\u0441\u0442\u0430\u0432\u0430\u0442\u044C\u0441\u044F \u043E\u0442\u043A\u0440\u044B\u0442\u043E\u0439."));
    const fields = create("div");
    fields.style.cssText = "display:flex;gap:5px;flex-wrap:wrap";
    const input = (caption, value) => {
      const label = create("label", caption + " ");
      const el2 = create("input");
      el2.type = "number";
      el2.value = String(value);
      el2.style.cssText = "max-width:105px;min-width:76px;color:#203436;background:#f2f8f3;padding:5px;border-radius:4px";
      label.append(el2);
      fields.append(label);
      return el2;
    };
    const startInput = input("\u041E\u0442", RANGE_MIN), endInput = input("\u0414\u043E", RANGE_MAX), rateInput = input("\u0417\u0430\u0434\u0435\u0440\u0436\u043A\u0430, \u043C\u0441", 1200);
    startInput.min = endInput.min = String(RANGE_MIN);
    startInput.max = endInput.max = String(RANGE_MAX);
    rateInput.min = "100";
    rateInput.max = "60000";
    rateInput.step = "100";
    rateInput.title = "\u0417\u0430\u0434\u0435\u0440\u0436\u043A\u0430 \u043F\u043E\u0441\u043B\u0435 \u043E\u0431\u0440\u0430\u0431\u043E\u0442\u043A\u0438 \u043A\u0430\u0436\u0434\u043E\u0433\u043E \u043D\u043E\u043C\u0435\u0440\u0430: 100\u201360000 \u043C\u0441. \u0418\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u044F \u043F\u0440\u0438\u043C\u0435\u043D\u044F\u044E\u0442\u0441\u044F \u0431\u0435\u0437 \u0441\u0431\u0440\u043E\u0441\u0430 \u0434\u0438\u0430\u043F\u0430\u0437\u043E\u043D\u0430.";
    root.append(fields);
    const controls = create("div");
    controls.className = "vlo-actions";
    const progress = create("p", "\u0414\u0438\u0430\u043F\u0430\u0437\u043E\u043D \u043D\u0435 \u0437\u0430\u043F\u0443\u0449\u0435\u043D.");
    progress.style.whiteSpace = "pre-line";
    let running = false, paused = false, stopped = false, activeOrder = null;
    let checkpoint = null, config = null, cursor = null, pending = [], pendingRegistry = [], failedPending = [];
    let batch = new ApprovalBatchSession(), testedThisSession = 0, lastError = null;
    let liveDelayMs = 1200, delayDirty = false, checkpointWrite = Promise.resolve();
    let journalWrite = Promise.resolve(), initialLoadPromise = Promise.resolve();
    let inflightDownload = null, restoreBlocked = false;
    let networkHealth = freshNetworkHealth(), lastActivityAt = null;
    let stopWithoutZip = false, stage = "idle";
    const activePending = () => pending.filter((x) => !inflightDownload?.order_numbers?.includes(x.order_number));
    const activeBytes = () => [...batch.transfers.values()].reduce((n, t) => n + (inflightDownload?.order_numbers?.includes(t.order) ? 0 : t.size || 0), 0);
    const startBtn = button("\u0421\u0442\u0430\u0440\u0442 / \u043F\u0440\u043E\u0434\u043E\u043B\u0436\u0438\u0442\u044C", () => {
      void start();
    });
    const pauseBtn = button("\u041F\u0430\u0443\u0437\u0430", () => {
      paused = true;
      void persistMode("paused");
      show("\u041F\u0430\u0443\u0437\u0430 \u043F\u043E\u0441\u043B\u0435 \u0442\u0435\u043A\u0443\u0449\u0435\u0433\u043E \u0437\u0430\u043F\u0440\u043E\u0441\u0430");
    });
    const stopBtn = button("\u0421\u0442\u043E\u043F \u0438 \u0430\u0440\u0445\u0438\u0432", () => {
      stopped = true;
      void persistMode("stopped");
      show("\u041E\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0430 \u043F\u043E\u0441\u043B\u0435 \u0442\u0435\u043A\u0443\u0449\u0435\u0433\u043E \u0437\u0430\u043F\u0440\u043E\u0441\u0430");
    });
    const saveBtn = button("\u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u043D\u0435\u043F\u043E\u043B\u043D\u0443\u044E \u043F\u0430\u0440\u0442\u0438\u044E ZIP", () => {
      if (running || !pending.length) return;
      void (async () => {
        if (inflightDownload) {
          if (typeof globalThis.confirm === "function" && !globalThis.confirm(
            "\u041F\u0440\u0435\u0434\u044B\u0434\u0443\u0449\u0430\u044F \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0430 ZIP \u043D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u0430. \u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u043F\u0430\u043F\u043A\u0443 \u0437\u0430\u0433\u0440\u0443\u0437\u043E\u043A Chrome. \u041F\u043E\u0432\u0442\u043E\u0440\u043D\u043E\u0435 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0438\u0435 \u043C\u043E\u0436\u0435\u0442 \u0441\u043E\u0437\u0434\u0430\u0442\u044C \u0434\u0443\u0431\u043B\u0438\u043A\u0430\u0442 \u0430\u0440\u0445\u0438\u0432\u0430. \u041F\u0440\u043E\u0434\u043E\u043B\u0436\u0438\u0442\u044C?"
          )) return;
          inflightDownload = null;
          await persistJournal("paused");
        }
        await saveBatch("partial manual");
      })().catch((error) => {
        lastError = String(error?.message || "MANUAL_ARCHIVE_RETRY_FAILED");
        show();
      });
    });
    const registryBtn = button("\u042D\u043A\u0441\u043F\u043E\u0440\u0442 \u0440\u0435\u0435\u0441\u0442\u0440\u0430 JSON", () => {
      void exportRegistry();
    });
    const resetBtn = button("\u0421\u0431\u0440\u043E\u0441\u0438\u0442\u044C \u043A\u043E\u043D\u0442\u0440\u043E\u043B\u044C\u043D\u0443\u044E \u0442\u043E\u0447\u043A\u0443", () => {
      void reset();
    });
    controls.append(startBtn, pauseBtn, stopBtn, saveBtn, registryBtn, resetBtn);
    root.append(controls, progress);
    pauseBtn.disabled = stopBtn.disabled = saveBtn.disabled = true;
    const storage = () => globalThis.chrome?.storage?.local;
    function currentMode() {
      return stopped ? "stopped" : paused ? "paused" : running ? "running" : "paused";
    }
    function journalSnapshot(mode = currentMode()) {
      return {
        schema: RANGE_JOURNAL_SCHEMA,
        config: { start: config.start, end: config.end, archive_size: config.archive_size },
        archives_completed: checkpoint.archives_completed,
        committed_next: checkpoint.committed_next,
        cursor,
        pending_registry: pendingRegistry.slice(),
        failed_pending: failedPending.slice(),
        delay_ms: liveDelayMs,
        download: inflightDownload,
        network: networkHealth,
        mode,
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      };
    }
    async function persistJournal(mode = currentMode(), orderRecord = null) {
      const snapshot = journalSnapshot(mode);
      journalWrite = journalWrite.catch(() => {
      }).then(() => saveRangeJournal(snapshot, orderRecord));
      await journalWrite;
    }
    async function persistMode(mode) {
      if (!checkpoint || !config) return;
      journalWrite = journalWrite.catch(() => {
      }).then(() => setRangeJournalMode(mode, liveDelayMs));
      try {
        await journalWrite;
      } catch (error) {
        lastError = String(error?.message || "MANUAL_RANGE_MODE_SAVE_FAILED");
        show();
      }
    }
    function show(message = "") {
      const cp = checkpoint;
      progress.textContent = (cp ? "\u0414\u0438\u0430\u043F\u0430\u0437\u043E\u043D " + cp.config.start + "\u2013" + cp.config.end + " \xB7 \u0437\u0430\u0434\u0435\u0440\u0436\u043A\u0430 (\u0444\u0430\u043A\u0442\u0438\u0447\u0435\u0441\u043A\u0430\u044F) " + liveDelayMs + " \u043C\u0441" : "\u041A\u043E\u043D\u0442\u0440\u043E\u043B\u044C\u043D\u0430\u044F \u0442\u043E\u0447\u043A\u0430 \u043D\u0435 \u0437\u0430\u0433\u0440\u0443\u0436\u0435\u043D\u0430") + "\n\u0421\u043B\u0435\u0434\u0443\u044E\u0449\u0438\u0439 \u043D\u043E\u043C\u0435\u0440: " + (cursor ?? cp?.committed_next ?? "\u2014") + " \xB7 \u043F\u0440\u043E\u0432\u0435\u0440\u0435\u043D\u043E \u0441\u0435\u0439\u0447\u0430\u0441: " + testedThisSession + " \xB7 \u0430\u0440\u0445\u0438\u0432\u043E\u0432: " + (cp?.archives_completed || 0) + " \xB7 \u043D\u0430\u0439\u0434\u0435\u043D\u043E \u0438 \u0430\u0440\u0445\u0438\u0432\u0438\u0440\u043E\u0432\u0430\u043D\u043E: " + (cp?.found_committed || 0) + " \xB7 \u0442\u0435\u043A\u0443\u0449\u0430\u044F \u043F\u0430\u0440\u0442\u0438\u044F: " + activePending().length + " \xB7 ZIP \u0437\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u0442\u0441\u044F: " + (inflightDownload ? 1 : 0) + " \xB7 \u0441\u0435\u0442\u044C: " + networkHealth.state + " \xB7 \u043F\u043E\u0432\u0442\u043E\u0440\u043E\u0432 GET: " + networkHealth.retries + " \xB7 \u0441\u0435\u0442\u0435\u0432\u044B\u0445 \u043E\u0448\u0438\u0431\u043E\u043A: " + networkHealth.transient_errors + " \xB7 \u0444\u0430\u0437\u0430: " + stage + " \xB7 \u043E\u0448\u0438\u0431\u043E\u043A \u043E\u0442\u043A\u0440\u044B\u0442\u0438\u044F (\u0440\u0435\u0435\u0441\u0442\u0440): " + ((cp?.failed_orders?.length || 0) + failedPending.length) + (lastError ? "\n\u041E\u0448\u0438\u0431\u043A\u0430: " + lastError : "") + (message ? "\n" + message : "");
    }
    async function saveCheckpoint(next) {
      if (!storage()) throw Error("MANUAL_CHROME_STORAGE_UNAVAILABLE");
      const snapshot = changeRangeDelay(next, liveDelayMs);
      checkpointWrite = checkpointWrite.catch(() => {
      }).then(() => storage().set({ [KEY]: snapshot }));
      await checkpointWrite;
      checkpoint = snapshot;
      delayDirty = liveDelayMs !== snapshot.config.delay_ms;
    }
    function validateDelayInput() {
      const value = Number(rateInput.value);
      return Number.isSafeInteger(value) && value >= 100 && value <= 6e4 ? value : null;
    }
    rateInput.addEventListener("input", () => {
      const nextDelay = validateDelayInput();
      if (nextDelay === null) {
        show("\u041D\u0435\u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u0430\u044F \u0437\u0430\u0434\u0435\u0440\u0436\u043A\u0430: \u0440\u0430\u0437\u0440\u0435\u0448\u0435\u043D\u043E \u043E\u0442 100 \u0434\u043E 60000 \u043C\u0441. \u041F\u0440\u043E\u0434\u043E\u043B\u0436\u0430\u044E \u0441 " + liveDelayMs + " \u043C\u0441.");
        return;
      }
      if (nextDelay === liveDelayMs) return;
      liveDelayMs = nextDelay;
      delayDirty = true;
      if (config) config = { ...config, delay_ms: liveDelayMs };
      show("\u041D\u043E\u0432\u0430\u044F \u0437\u0430\u0434\u0435\u0440\u0436\u043A\u0430 " + liveDelayMs + " \u043C\u0441 \u043F\u0440\u0438\u043C\u0435\u043D\u0435\u043D\u0430 \u043A \u0442\u0435\u043A\u0443\u0449\u0435\u043C\u0443 \u043E\u0431\u0445\u043E\u0434\u0443.");
      if (checkpoint && config) void persistMode(currentMode());
      if (checkpoint && !running) void saveCheckpoint(
        changeRangeDelay(checkpoint, liveDelayMs)
      ).catch(() => {
        lastError = "MANUAL_DELAY_SAVE_FAILED";
        show();
      });
    });
    rateInput.addEventListener("change", () => {
      if (validateDelayInput() === null) {
        rateInput.value = String(liveDelayMs);
        show("\u0412\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u043E \u0434\u043E\u043F\u0443\u0441\u0442\u0438\u043C\u043E\u0435 \u0432\u0440\u0435\u043C\u044F \u0437\u0430\u0434\u0435\u0440\u0436\u043A\u0438: " + liveDelayMs + " \u043C\u0441.");
      }
    });
    async function waitDynamicDelay() {
      const started = performance.now();
      while (!paused && !stopped && !isClosed()) {
        const remaining = liveDelayMs - (performance.now() - started);
        if (remaining <= 0) break;
        await delay(Math.min(remaining, 100));
      }
    }
    async function loadCheckpoint(nextConfig) {
      if (!storage()) throw Error("MANUAL_CHROME_STORAGE_UNAVAILABLE");
      const data = await storage().get(KEY);
      const cp = data?.[KEY];
      if (cp) {
        if (cp.schema !== "printcheck.vision.range-checkpoint.v1" || !sameRange(cp.config, nextConfig) || !Number.isSafeInteger(cp.committed_next) || cp.committed_next < nextConfig.start || cp.committed_next > nextConfig.end + 1 || !Array.isArray(cp.registry))
          throw Error("MANUAL_CHECKPOINT_CONFIG_CONFLICT_RESET_REQUIRED");
        if (cp.config.delay_ms !== nextConfig.delay_ms) {
          await saveCheckpoint(changeRangeDelay(cp, nextConfig.delay_ms));
          return checkpoint;
        }
        return cp;
      }
      const first = freshRangeCheckpoint(nextConfig);
      await saveCheckpoint(first);
      return first;
    }
    function registryObject() {
      return {
        schema: "printcheck.vision.approved-order-registry.v1",
        config: checkpoint.config,
        committed_next: checkpoint.committed_next,
        cursor_now: cursor,
        archives_completed: checkpoint.archives_completed,
        checked_committed: checkpoint.checked_committed,
        found_archived: checkpoint.registry,
        found_pending: pendingRegistry,
        failed_orders: checkpoint.failed_orders || [],
        failed_pending: failedPending,
        training_ready: false
      };
    }
    async function exportRegistry() {
      try {
        if (!checkpoint) {
          const cp = (await storage()?.get(KEY))?.[KEY];
          if (!cp) {
            show("\u0420\u0435\u0435\u0441\u0442\u0440 \u0435\u0449\u0451 \u043D\u0435 \u0441\u043E\u0437\u0434\u0430\u043D");
            return;
          }
          checkpoint = cp;
        }
        const url = URL.createObjectURL(new Blob(
          [JSON.stringify(registryObject(), null, 2) + "\n"],
          { type: "application/json" }
        ));
        const a = create("a");
        a.href = url;
        a.download = "vision-ai-approved-orders-register.json";
        document.body.append(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1e4);
      } catch {
        show("MANUAL_REGISTRY_EXPORT_FAILED");
      }
    }
    async function reset(remote = false) {
      if (running || getBusy()) return { status: "VISION_RESET_STOP_FIRST" };
      if (!remote && typeof globalThis.confirm === "function" && !globalThis.confirm(
        "\u041E\u0447\u0438\u0441\u0442\u0438\u0442\u044C \u0440\u0435\u0435\u0441\u0442\u0440 \u0438 \u043A\u043E\u043D\u0442\u0440\u043E\u043B\u044C\u043D\u0443\u044E \u0442\u043E\u0447\u043A\u0443 \u0434\u0438\u0430\u043F\u0430\u0437\u043E\u043D\u0430? \u0423\u0436\u0435 \u0437\u0430\u0433\u0440\u0443\u0436\u0435\u043D\u043D\u044B\u0435 ZIP \u043E\u0441\u0442\u0430\u043D\u0443\u0442\u0441\u044F \u043D\u0430 \u0434\u0438\u0441\u043A\u0435."
      ))
        return;
      try {
        await journalWrite.catch(() => {
        });
        await checkpointWrite.catch(() => {
        });
        await clearRangeJournal();
        await storage().remove(KEY);
        config = checkpoint = null;
        cursor = null;
        inflightDownload = null;
        restoreBlocked = false;
        pending = [];
        pendingRegistry = [];
        failedPending = [];
        testedThisSession = 0;
        batch = new ApprovalBatchSession();
        lastError = null;
        networkHealth = freshNetworkHealth();
        lastActivityAt = null;
        stopWithoutZip = false;
        saveBtn.disabled = true;
        show("\u0421\u0431\u0440\u043E\u0448\u0435\u043D\u043E");
        return { status: "VISION_RESET_COMPLETE" };
      } catch {
        show("MANUAL_CHECKPOINT_RESET_FAILED");
        return { status: "VISION_RESET_FAILED" };
      }
    }
    function audit(phase, rest = {}) {
      return chrome.runtime.sendMessage({ op: "vision-range-download-audit-v1", phase, ...rest });
    }
    async function waitForChrome(id, size, filename) {
      for (let i = 0; i < 240; i++) {
        const data = await audit("check", {
          after_id: id,
          byte_length: size,
          expected_filename: filename
        });
        if (data?.status === "RANGE_DOWNLOAD_COMPLETE") return true;
        if (data?.status !== "RANGE_DOWNLOAD_PENDING")
          throw Error(data?.status || "MANUAL_RANGE_DOWNLOAD_FAILED");
        await delay(500);
      }
      throw Error("MANUAL_RANGE_DOWNLOAD_TIMEOUT");
    }
    async function commitConfirmedArchive(reason) {
      const info = inflightDownload;
      if (!info) return;
      const ids = info.order_numbers || pendingRegistry.map((x) => x.order_number);
      const selected = new Set(ids);
      const found = pendingRegistry.filter((x) => selected.has(x.order_number));
      if (found.length !== ids.length || !found.length)
        throw Error("MANUAL_RANGE_ARCHIVE_ROWS_LOST");
      const next = commitRangeArchive({ ...checkpoint, network: networkHealth }, {
        next: info.end_cursor ?? cursor,
        found,
        failed_orders: info.failed_orders || failedPending
      });
      next.last_archive = {
        filename: info.filename,
        bytes: info.byte_length,
        orders: found.length,
        files_verified: info.verified_files ?? null,
        files_missing: info.missing_files ?? null,
        entry_count: info.entry_count ?? null,
        status: "CHROME_COMPLETE",
        confirmed_at: (/* @__PURE__ */ new Date()).toISOString()
      };
      next.files_committed = (checkpoint.files_committed || 0) + (Number.isInteger(info.verified_files) ? info.verified_files : found.reduce((n, x) => n + (x.files || 0), 0));
      await saveCheckpoint(next);
      pendingRegistry = pendingRegistry.filter((x) => !selected.has(x.order_number));
      pending = pendingRegistry.slice();
      const oldFailures = info.failed_orders || failedPending;
      failedPending = failedPending.filter((x) => !oldFailures.some((y) => y.order_number === x.order_number));
      inflightDownload = null;
      for (const id of ids) batch.discardOrder(id);
      await journalWrite.catch(() => {
      });
      await pruneRangeJournalOrders(journalSnapshot(currentMode()), ids);
      saveBtn.disabled = running || !pending.length;
      lastError = null;
      show("ZIP \u2116" + next.archives_completed + " \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043D: " + reason + ". \u041D\u043E\u0432\u0430\u044F \u043F\u0430\u0440\u0442\u0438\u044F \u0438 \u043A\u0443\u0440\u0441\u043E\u0440 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u044B.");
    }
    async function waitForPreviousOrderTab() {
      for (let i = 0; i < 210; i++) {
        const status = await chrome.runtime.sendMessage({
          op: "vision-approval-queue-status-v1"
        }).catch(() => null);
        if (status?.status !== "QUEUE_STATUS_OK")
          throw Error("MANUAL_QUEUE_STATUS_UNAVAILABLE");
        if (!status.busy) return;
        await delay(1e3);
      }
      throw Error("MANUAL_OLD_ORDER_TAB_STILL_RUNNING");
    }
    async function resumePreparingZip() {
      const info = inflightDownload;
      if (info?.stage !== "preparing") return true;
      const result = await audit("check", {
        after_id: info.after_id,
        byte_length: info.byte_length,
        expected_filename: info.filename
      });
      if (result?.status === "RANGE_DOWNLOAD_COMPLETE") {
        await commitConfirmedArchive("ZIP \u0432\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D");
        return true;
      }
      if (result?.status === "RANGE_DOWNLOAD_PENDING" && result.matched > 0) {
        inflightDownload = { ...info, stage: "started" };
        await persistJournal(currentMode());
        for (const id2 of info.order_numbers) batch.discardOrder(id2);
        return true;
      }
      if (result?.status !== "RANGE_DOWNLOAD_PENDING")
        throw Error(result?.status || "MANUAL_RANGE_ZIP_PREPARED_AUDIT_FAILED");
      const selected = new Set(info.order_numbers);
      const rows = pendingRegistry.filter((r) => selected.has(r.order_number));
      if (rows.length !== info.order_numbers.length)
        throw Error("MANUAL_RANGE_PREPARED_ROWS_MISSING");
      const temp = new ApprovalBatchSession();
      const { orders } = await loadRangeJournal();
      for (const row of orders.filter((r) => selected.has(r.order_number)))
        temp.restoreOrder(row.order_number, row.transfers);
      const blob = temp.finalize(rows).blob;
      if (blob.size !== info.byte_length)
        throw Error("MANUAL_RANGE_PREPARED_SIZE_CHANGED");
      const id = await startExtensionZipDownload(blob, info.filename);
      inflightDownload = { ...info, after_id: id - 1, stage: "started" };
      await persistJournal(currentMode());
      for (const oid of info.order_numbers) batch.discardOrder(oid);
      return true;
    }
    async function recoverDownload(waitForCompletion = false) {
      if (!inflightDownload) return true;
      try {
        await resumePreparingZip();
        if (!inflightDownload) return true;
        const d = inflightDownload;
        if (waitForCompletion) {
          await waitForChrome(d.after_id, d.byte_length, d.filename);
          await commitConfirmedArchive("Chrome \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u043B \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u0438\u0435 ZIP");
          return true;
        }
        const res = await audit("check", {
          after_id: d.after_id,
          byte_length: d.byte_length,
          expected_filename: d.filename
        });
        if (res?.status === "RANGE_DOWNLOAD_COMPLETE") {
          await commitConfirmedArchive("Chrome \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u043B \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u0438\u0435 ZIP");
          return true;
        }
        if (res?.status === "RANGE_DOWNLOAD_PENDING") return true;
        throw Error(res?.status || "MANUAL_RANGE_DOWNLOAD_AUDIT_FAILED");
      } catch (error) {
        lastError = "MANUAL_ZIP_DOWNLOAD_UNCONFIRMED_" + String(error?.message || "UNKNOWN").slice(0, 50);
        show("ZIP \u043D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043D Chrome. \u0418\u0441\u0445\u043E\u0434\u043D\u044B\u0435 \u043C\u0430\u0442\u0435\u0440\u0438\u0430\u043B\u044B \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u044B.");
        return false;
      }
    }
    async function saveBatch(reason = "full") {
      let rows = activePending();
      if (!rows.length) return true;
      if (inflightDownload) {
        if (!await recoverDownload(true)) return false;
        rows = activePending();
        if (!rows.length) return true;
      }
      let result;
      try {
        result = batch.finalize(rows);
      } catch (error) {
        lastError = String(error?.message || "MANUAL_BATCH_ZIP_INVALID");
        show("\u0410\u0440\u0445\u0438\u0432 \u043D\u0435 \u0441\u0444\u043E\u0440\u043C\u0438\u0440\u043E\u0432\u0430\u043D, \u0434\u0430\u043D\u043D\u044B\u0435 \u043E\u0441\u0442\u0430\u044E\u0442\u0441\u044F \u0432 IndexedDB.");
        return false;
      }
      const part = checkpoint.archives_completed + 1;
      const filename = "vision-ai-range-" + config.start + "-" + config.end + "-part-" + String(part).padStart(5, "0") + "-" + rows[0].order_number + "-" + rows.at(-1).order_number + ".zip";
      try {
        const before = await audit("baseline");
        if (before?.status !== "RANGE_DOWNLOAD_BASELINE")
          throw Error("MANUAL_RANGE_DOWNLOAD_BASELINE_FAILED");
        inflightDownload = {
          after_id: before.highest_id,
          byte_length: result.blob.size,
          filename,
          part,
          end_cursor: cursor,
          order_numbers: rows.map((x) => x.order_number),
          failed_orders: failedPending.slice(),
          stage: "preparing",
          verified_files: result.counts.verified_files,
          missing_files: result.counts.missing_files,
          entry_count: result.entry_count
        };
        await persistJournal(currentMode());
        const downloadId = await startExtensionZipDownload(result.blob, filename);
        inflightDownload = {
          ...inflightDownload,
          after_id: downloadId - 1,
          stage: "started"
        };
        await persistJournal(currentMode());
        for (const row of rows) batch.discardOrder(row.order_number);
        show("ZIP \u2116" + part + " \u043F\u0435\u0440\u0435\u0434\u0430\u043D Chrome, \u043F\u0440\u043E\u0434\u043E\u043B\u0436\u0430\u044E \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0438\u0435 \u0437\u0430\u043A\u0430\u0437\u044B.");
        return true;
      } catch (error) {
        lastError = String(error?.message || "MANUAL_RANGE_DOWNLOAD_UNCONFIRMED");
        show("ZIP \u043D\u0435 \u043D\u0430\u0447\u0430\u0442/\u043D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043D, \u0434\u0430\u043D\u043D\u044B\u0435 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u044B \u043B\u043E\u043A\u0430\u043B\u044C\u043D\u043E.");
        return false;
      }
    }
    async function start() {
      if (running || getBusy() || isClosed()) return;
      await initialLoadPromise;
      if (running || getBusy() || isClosed()) return;
      try {
        if (restoreBlocked) throw Error("MANUAL_RANGE_JOURNAL_REPAIR_REQUIRED");
        const selected = rangeConfig(startInput.value, endInput.value, rateInput.value);
        if (!storage() || typeof globalThis.__visionLocalTrustedTransport !== "function")
          throw Error("MANUAL_MV3_TRANSPORT_AND_STORAGE_REQUIRED");
        if (config && !sameRange(config, selected))
          throw Error("MANUAL_RANGE_INPUT_CHANGED_RESET_REQUIRED");
        liveDelayMs = selected.delay_ms;
        if (!checkpoint) {
          checkpoint = await loadCheckpoint(selected);
          cursor = checkpoint.committed_next;
        } else if (checkpoint.config.delay_ms !== selected.delay_ms) {
          await saveCheckpoint(changeRangeDelay(checkpoint, selected.delay_ms));
        }
        config = selected;
        if (cursor > config.end) {
          show("\u0412\u0435\u0441\u044C \u0434\u0438\u0430\u043F\u0430\u0437\u043E\u043D \u043F\u0440\u043E\u0432\u0435\u0440\u0435\u043D");
          return;
        }
        lastError = null;
      } catch (error) {
        lastError = String(error?.message || "MANUAL_RANGE_INPUT_INVALID");
        show();
        return;
      }
      running = true;
      paused = false;
      stopped = false;
      setBusy(true);
      startBtn.disabled = resetBtn.disabled = saveBtn.disabled = true;
      pauseBtn.disabled = stopBtn.disabled = false;
      let message = "";
      try {
        if (inflightDownload && !await recoverDownload(false))
          throw Error("MANUAL_ZIP_DOWNLOAD_REQUIRES_REVIEW");
        await persistJournal("running");
        if (activePending().length >= RANGE_ARCHIVE_SIZE || activeBytes() > 12e7) {
          if (!await saveBatch("recovered")) throw Error("MANUAL_BATCH_NOT_SAVED");
        }
        while (cursor <= config.end && !paused && !stopped && !isClosed()) {
          const order = cursor;
          stage = "checking_order";
          lastActivityAt = (/* @__PURE__ */ new Date()).toISOString();
          const measured = await controlledOrderProbe(
            order,
            (n) => probeTzForOrder(n),
            { health: networkHealth }
          );
          networkHealth = measured.health;
          checkpoint = { ...checkpoint, network: networkHealth };
          const inspected = measured.result;
          if (measured.halt) {
            lastError = measured.reason;
            paused = true;
            await persistJournal("paused");
            show("\u041E\u0431\u0449\u0438\u0439 \u0441\u0431\u043E\u0439 \u0441\u0435\u0442\u0438. \u041E\u0447\u0435\u0440\u0435\u0434\u044C \u0438 \u043A\u0443\u0440\u0441\u043E\u0440 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u044B.");
            break;
          }
          let failure2 = null, orderRecord = null;
          if (inspected.status === "TZ_APPROVED") {
            checkpoint = { ...checkpoint, browser_scans: (checkpoint.browser_scans || 0) + 1 };
            activeOrder = String(order);
            stage = "collecting_approvals";
            let collected;
            try {
              await waitForPreviousOrderTab();
              collected = await scanOrder(rangeOrderUrl(order), true);
            } catch {
              collected = { status: "MANUAL_NATIVE_APPROVAL_QUEUE_FAILED" };
            } finally {
              activeOrder = null;
            }
            if (collected?.status !== "COMPLETE" || collected?.final_evidence_saved !== true) {
              const reason = isRecoverableRangeFailure(collected?.status) ? collected.status : "MANUAL_APPROVAL_COLLECTION_INCOMPLETE";
              failure2 = {
                order_number: String(order),
                reason,
                phase: "native_approval",
                observed_status: String(collected?.status || "UNKNOWN").slice(0, 80)
              };
            } else {
              const record = {
                order_number: String(order),
                status: "TZ_APPROVED",
                native_status_id: "59",
                eligible_articles: collected.eligible_articles || 0,
                verified_articles: collected.verified_articles || 0,
                files: collected.files || 0,
                collected_at: (/* @__PURE__ */ new Date()).toISOString()
              };
              orderRecord = {
                order_number: String(order),
                transfers: batch.exportOrder(String(order))
              };
              pending.push(record);
              pendingRegistry.push(record);
            }
          } else if (inspected.status !== "TZ_NOT_APPROVED" && inspected.status !== "ORDER_NOT_FOUND") {
            if (!isRecoverableRangeFailure(inspected.status)) {
              lastError = "MANUAL_ORDER_PROBE " + String(inspected.status);
              break;
            }
            failure2 = {
              order_number: String(order),
              reason: inspected.status,
              phase: "order_card",
              ...Number.isInteger(inspected.http_status) ? { http_status: inspected.http_status } : {}
            };
          }
          if (failure2) failedPending.push(failure2);
          if (!orderRecord) batch.discardOrder(String(order));
          cursor++;
          testedThisSession++;
          lastActivityAt = (/* @__PURE__ */ new Date()).toISOString();
          await persistJournal(currentMode(), orderRecord);
          if (inflightDownload && !await recoverDownload(false)) break;
          if (activePending().length >= RANGE_ARCHIVE_SIZE || activeBytes() > 12e7 || inflightDownload && batch.bytesReceived > 16e7) {
            if (!await saveBatch("100 orders / byte threshold")) break;
          } else if (!pending.length && !inflightDownload && cursor - checkpoint.committed_next >= 50) {
            await saveCheckpoint(commitOnlySkipped(checkpoint, cursor, failedPending));
            failedPending = [];
            await persistJournal(currentMode());
          }
          if (delayDirty) {
            await saveCheckpoint(changeRangeDelay(checkpoint, liveDelayMs));
          }
          show("\u041F\u043E\u0441\u043B\u0435\u0434\u043D\u044F\u044F \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0430: " + order + " \u2014 " + (failure2 ? "\u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u043D\u0430, \u0432\u043D\u0435\u0441\u0435\u043D\u0430 \u0432 \u0440\u0435\u0435\u0441\u0442\u0440 \u043E\u0448\u0438\u0431\u043E\u043A (" + failure2.reason + ")" : inspected.status));
          if (!paused && !stopped) await waitDynamicDelay();
        }
        if ((stopped && !stopWithoutZip || cursor > config.end) && pending.length) {
          if (activePending().length && !await saveBatch(stopped ? "stopped partial" : "final partial")) paused = true;
          if (inflightDownload && !await recoverDownload(true)) paused = true;
        }
        if (!pending.length && !inflightDownload && (cursor > config.end || stopped || paused) && cursor > checkpoint.committed_next) {
          await saveCheckpoint(commitOnlySkipped(checkpoint, cursor, failedPending));
          failedPending = [];
          await persistJournal(currentMode());
        }
        if (delayDirty) {
          await saveCheckpoint(changeRangeDelay(checkpoint, liveDelayMs));
        }
        message = lastError ? "\u041E\u0421\u0422\u0410\u041D\u041E\u0412\u041A\u0410: \u043E\u0431\u0449\u0438\u0439 \u0441\u0431\u043E\u0439 \u0430\u0432\u0442\u043E\u0440\u0438\u0437\u0430\u0446\u0438\u0438, \u043B\u0438\u043C\u0438\u0442 \u0437\u0430\u043F\u0440\u043E\u0441\u043E\u0432 \u0438\u043B\u0438 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0438\u044F." : paused ? "\u041F\u0410\u0423\u0417\u0410. \u041C\u043E\u0436\u043D\u043E \u043F\u0440\u043E\u0434\u043E\u043B\u0436\u0438\u0442\u044C; \u043D\u0435\u043F\u043E\u043B\u043D\u0430\u044F \u043F\u0430\u0440\u0442\u0438\u044F \u043E\u0441\u0442\u0430\u0451\u0442\u0441\u044F \u0432 \u043F\u0430\u043C\u044F\u0442\u0438." : stopped ? stopWithoutZip ? "\u041E\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u043E. \u0414\u0430\u043D\u043D\u044B\u0435 \u043F\u0430\u0440\u0442\u0438\u0438 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u044B \u043B\u043E\u043A\u0430\u043B\u044C\u043D\u043E; ZIP \u2014 \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u043E." : "\u041E\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u043E, \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D \u0447\u0430\u0441\u0442\u0438\u0447\u043D\u044B\u0439 \u0430\u0440\u0445\u0438\u0432." : cursor > config.end ? "\u0414\u0438\u0430\u043F\u0430\u0437\u043E\u043D \u043F\u043E\u043B\u043D\u043E\u0441\u0442\u044C\u044E \u043F\u0440\u043E\u0432\u0435\u0440\u0435\u043D." : "\u0421\u043A\u0430\u043D\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u0435 \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u043E.";
      } catch (error) {
        lastError = String(error?.message || "MANUAL_RANGE_SCAN_FAILED");
        message = "\u041E\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0430 \u043F\u043E \u043E\u0448\u0438\u0431\u043A\u0435: " + lastError;
      } finally {
        activeOrder = null;
        running = false;
        setBusy(false);
        stage = "idle";
        if (checkpoint) {
          try {
            await persistJournal(stopped || cursor > config.end ? "stopped" : "paused");
          } catch (error) {
            lastError = String(error?.message || "MANUAL_RANGE_FINAL_JOURNAL_FAILED");
          }
        }
        startBtn.disabled = resetBtn.disabled = false;
        pauseBtn.disabled = stopBtn.disabled = true;
        saveBtn.disabled = !pending.length;
        refreshControls();
        show(message);
      }
    }
    if (storage()) initialLoadPromise = (async () => {
      const cp = (await storage().get(KEY))?.[KEY];
      if (cp?.schema !== "printcheck.vision.range-checkpoint.v1") return false;
      checkpoint = cp;
      config = { ...cp.config };
      cursor = cp.committed_next;
      networkHealth = normalizeNetworkHealth(cp.network);
      lastActivityAt = cp.updated_at || null;
      startInput.value = String(cp.config.start);
      endInput.value = String(cp.config.end);
      rateInput.value = String(cp.config.delay_ms);
      liveDelayMs = cp.config.delay_ms;
      let autoResume = false;
      const loaded = await loadRangeJournal();
      let journal = loaded.journal, orders = loaded.orders;
      if (journal) {
        const same3 = sameRange(journal.config, cp.config);
        if (!same3) throw Error("MANUAL_RANGE_JOURNAL_DIFFERENT_CONFIG");
        autoResume = journal.mode === "running" || journal.mode === "downloading";
        if (journal.download && !Array.isArray(journal.download.order_numbers)) {
          journal = { ...journal, download: {
            ...journal.download,
            order_numbers: journal.pending_registry.map((x) => x.order_number),
            end_cursor: journal.cursor,
            part: journal.archives_completed + 1,
            failed_orders: journal.failed_pending.slice()
          } };
          await saveRangeJournal(journal);
        }
        const d = journal.download;
        if (journal.archives_completed + 1 === cp.archives_completed && d && d.part === cp.archives_completed && d.end_cursor === cp.committed_next) {
          const ids = new Set(d.order_numbers);
          const old = new Set((d.failed_orders || []).map((x) => x.order_number));
          journal = {
            ...journal,
            archives_completed: cp.archives_completed,
            committed_next: cp.committed_next,
            download: null,
            pending_registry: journal.pending_registry.filter((x) => !ids.has(x.order_number)),
            failed_pending: journal.failed_pending.filter((x) => !old.has(x.order_number))
          };
          await pruneRangeJournalOrders(journal, [...ids]);
          orders = orders.filter((x) => !ids.has(x.order_number));
        }
        const compatible = journal.archives_completed === cp.archives_completed && journal.cursor >= cp.committed_next && journal.cursor <= cp.config.end + 1;
        if (!compatible) throw Error("MANUAL_RANGE_JOURNAL_RECONCILE_REQUIRED");
        if (journal.pending_registry.length !== orders.length || journal.pending_registry.length > RANGE_ARCHIVE_SIZE * 2 || !journal.pending_registry.every((r) => orders.some((o) => o.order_number === r.order_number)))
          throw Error("MANUAL_RANGE_JOURNAL_INCOMPLETE");
        const rate = rangeConfig(cp.config.start, cp.config.end, journal.delay_ms);
        liveDelayMs = rate.delay_ms;
        rateInput.value = String(liveDelayMs);
        networkHealth = normalizeNetworkHealth(journal.network || cp.network);
        lastActivityAt = journal.updated_at || lastActivityAt;
        pendingRegistry = journal.pending_registry.slice();
        pending = pendingRegistry.slice();
        failedPending = journal.failed_pending.slice();
        cursor = journal.cursor;
        inflightDownload = journal.download || null;
        for (const item of orders) {
          if (!inflightDownload?.order_numbers?.includes(item.order_number) || inflightDownload?.stage === "preparing")
            batch.restoreOrder(item.order_number, item.transfers);
        }
      }
      saveBtn.disabled = !pending.length;
      show(journal ? "\u0421\u043A\u0430\u043D\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u0435 \u0432\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u043E \u043F\u043E\u0441\u043B\u0435 \u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u044F \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u044B." : "\u041D\u0430\u0439\u0434\u0435\u043D\u0430 \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D\u043D\u0430\u044F \u043A\u043E\u043D\u0442\u0440\u043E\u043B\u044C\u043D\u0430\u044F \u0442\u043E\u0447\u043A\u0430. \u041D\u0430\u0436\u043C\u0438\u0442\u0435 \xAB\u0421\u0442\u0430\u0440\u0442 / \u043F\u0440\u043E\u0434\u043E\u043B\u0436\u0438\u0442\u044C\xBB.");
      return autoResume;
    })().catch((error) => {
      lastError = String(error?.message || "MANUAL_RANGE_RESTORE_FAILED");
      restoreBlocked = true;
      show("\u041E\u0448\u0438\u0431\u043A\u0430 \u0432\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u044F; \u0434\u0430\u043D\u043D\u044B\u0435 \u043D\u0435 \u0441\u0431\u0440\u043E\u0448\u0435\u043D\u044B.");
      return false;
    });
    initialLoadPromise.then((shouldResume) => {
      if (shouldResume && !isClosed()) void start();
    });
    return {
      element: root,
      get activeOrder() {
        return activeOrder;
      },
      get running() {
        return running;
      },
      get pendingCount() {
        return pending.length;
      },
      receive: (message, expectedOrder) => batch.receive(message, expectedOrder),
      remote: async (action, payload = {}) => {
        await initialLoadPromise;
        if (action === "status") {
          let archive_audit = null;
          if (inflightDownload) {
            const d = inflightDownload;
            try {
              archive_audit = await audit("check", {
                after_id: d.after_id,
                byte_length: d.byte_length,
                expected_filename: d.filename
              });
            } catch {
              archive_audit = { status: "VISION_DOWNLOAD_AUDIT_UNAVAILABLE" };
            }
          }
          return {
            mode: "range",
            running,
            paused,
            stopped,
            archive_audit,
            download_details: inflightDownload ? {
              filename: inflightDownload.filename,
              bytes: inflightDownload.byte_length,
              files_verified: inflightDownload.verified_files ?? null,
              files_missing: inflightDownload.missing_files ?? null
            } : null,
            checked: config && cursor !== null ? cursor - config.start : 0,
            total: config ? config.end - config.start + 1 : RANGE_MAX - RANGE_MIN + 1,
            progress_percent: config && cursor !== null ? Math.floor(100 * (cursor - config.start) / (config.end - config.start + 1)) : 0,
            next_order: cursor,
            phase: stage,
            last_activity_at: lastActivityAt,
            network: { ...networkHealth },
            last_archive: checkpoint?.last_archive || null,
            files_archived: checkpoint?.files_committed || 0,
            files_staged: pending.reduce((n, x) => n + (x.files || 0), 0),
            direct_http_checks: networkHealth.attempts,
            browser_scans: checkpoint?.browser_scans || 0,
            range_start: config?.start || RANGE_MIN,
            range_end: config?.end || RANGE_MAX,
            archives: checkpoint?.archives_completed || 0,
            found: checkpoint?.found_committed || 0,
            pending: pending.length,
            downloading: !!inflightDownload,
            delay_ms: liveDelayMs,
            blocked: restoreBlocked,
            error: lastError
          };
        }
        if (action === "delay") {
          if (!Number.isSafeInteger(payload.value) || payload.value < 100 || payload.value > 6e4)
            throw Error("MANUAL_RANGE_DELAY_INVALID");
          rateInput.value = String(payload.value);
          rateInput.dispatchEvent(new Event("input"));
          return { status: "VISION_DELAY_UPDATED" };
        }
        if (action === "start") {
          void start();
          return { status: "VISION_SCAN_START_REQUESTED" };
        }
        if (action === "pause") {
          pauseBtn.click();
          return { status: "VISION_SCAN_PAUSE_REQUESTED" };
        }
        if (action === "stop") {
          stopped = true;
          stopWithoutZip = true;
          await persistMode("stopped");
          return { status: "VISION_SCAN_STOP_REQUESTED" };
        }
        if (action === "save") {
          saveBtn.click();
          return { status: "VISION_SCAN_ZIP_SAVE_REQUESTED" };
        }
        if (action === "reset") {
          if (payload.confirmed !== true) return { status: "VISION_RESET_CONFIRMATION_REQUIRED" };
          return await reset(true);
        }
        if (action === "export") {
          registryBtn.click();
          return { status: "VISION_REGISTRY_EXPORT_REQUESTED" };
        }
        return { status: "VISION_REMOTE_ACTION_DENIED" };
      },
      requestPause: () => {
        paused = true;
      },
      requestStop: () => {
        stopped = true;
      }
    };
  }

  // vision/orders/approval-file-persistence.mjs
  var LIST_DB_NAME = "vision-ai-approved-file-list-v1";
  var LIST_STATUS_SCHEMA = "printcheck.vision.order-file-list.v1";
  var STORE_QUEUE = "queue";
  var STORE_STATE = "state";
  var STORE_PENDING = "pending";
  var STORE_SUCCESS = "success";
  var STORE_FAILURES = "failures";
  var STORES = [STORE_QUEUE, STORE_STATE, STORE_PENDING, STORE_SUCCESS, STORE_FAILURES];
  var KEY2 = "active";
  var checkState = (s) => {
    if (s?.schema !== LIST_STATUS_SCHEMA || !Number.isSafeInteger(s.index) || s.index < 0 || !Number.isSafeInteger(s.total) || s.total < 1 || !Number.isSafeInteger(s.archive_count) || s.archive_count < 0 || !Number.isSafeInteger(s.found_committed) || s.found_committed < 0 || !Number.isSafeInteger(s.delay_ms) || s.delay_ms < 100 || s.delay_ms > 6e4 || !["running", "paused", "stopped", "downloading"].includes(s.mode))
      throw Error("MANUAL_ORDER_LIST_STATE_INVALID");
  };
  async function openDb2(factory = globalThis.indexedDB) {
    if (!factory?.open) throw Error("MANUAL_ORDER_LIST_INDEXEDDB_UNAVAILABLE");
    return new Promise((resolve, reject2) => {
      const req = factory.open(LIST_DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const store of STORES)
          if (!db.objectStoreNames.contains(store))
            db.createObjectStore(store, { keyPath: "id" });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject2(Error("MANUAL_ORDER_LIST_DB_OPEN_FAILED"));
      req.onblocked = () => reject2(Error("MANUAL_ORDER_LIST_DB_BLOCKED"));
    });
  }
  async function transact(stores, mode, build, factory) {
    const db = await openDb2(factory);
    try {
      return await new Promise((resolve, reject2) => {
        let tx, extract;
        try {
          tx = db.transaction(stores, mode);
          extract = build(tx);
        } catch (error) {
          reject2(error);
          return;
        }
        tx.oncomplete = () => {
          try {
            resolve(typeof extract === "function" ? extract() : void 0);
          } catch (error) {
            reject2(error);
          }
        };
        tx.onabort = () => reject2(Error("MANUAL_ORDER_LIST_DB_TRANSACTION_ABORTED"));
        tx.onerror = () => reject2(Error("MANUAL_ORDER_LIST_DB_TRANSACTION_FAILED"));
      });
    } finally {
      db.close();
    }
  }
  async function loadOrderFileState(factory) {
    return transact([STORE_QUEUE, STORE_STATE, STORE_PENDING], "readonly", (tx) => {
      const queue = tx.objectStore(STORE_QUEUE).get(KEY2);
      const state = tx.objectStore(STORE_STATE).get(KEY2);
      const pending = tx.objectStore(STORE_PENDING).getAll();
      return () => {
        if (!queue.result && !state.result) return null;
        if (!queue.result || !state.result)
          throw Error("MANUAL_ORDER_LIST_INCOMPLETE_STATE");
        checkState(state.result);
        if (!(queue.result.numbers instanceof Uint32Array) || queue.result.numbers.length !== state.result.total || state.result.index > state.result.total)
          throw Error("MANUAL_ORDER_LIST_QUEUE_CORRUPTED");
        const orders = pending.result || [];
        if (orders.length > 200 || orders.some((x) => !/^[0-9]{7}$/.test(x.id) || !Array.isArray(x.transfers)))
          throw Error("MANUAL_ORDER_LIST_PENDING_CORRUPTED");
        return { queue: queue.result.numbers, state: state.result, pending: orders };
      };
    }, factory);
  }
  async function importOrderFileQueue(numbers, filename, delayMs = 1200, factory) {
    if (!Array.isArray(numbers) || !numbers.length || numbers.length > 1e6 || numbers.some((n) => !Number.isSafeInteger(n) || n < 1e6 || n > 9999999) || new Set(numbers).size !== numbers.length)
      throw Error("MANUAL_ORDER_LIST_IMPORT_INVALID");
    if (!Number.isSafeInteger(delayMs) || delayMs < 100 || delayMs > 6e4)
      throw Error("MANUAL_ORDER_LIST_DELAY_INVALID");
    const state = {
      id: KEY2,
      schema: LIST_STATUS_SCHEMA,
      mode: "paused",
      filename: String(filename || "orders.txt").slice(0, 120),
      total: numbers.length,
      index: 0,
      archive_count: 0,
      found_committed: 0,
      failed_count: 0,
      delay_ms: delayMs,
      download: null,
      imported_at: (/* @__PURE__ */ new Date()).toISOString(),
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    await transact(STORES, "readwrite", (tx) => {
      for (const store of STORES) tx.objectStore(store).clear();
      tx.objectStore(STORE_QUEUE).put({ id: KEY2, numbers: Uint32Array.from(numbers) });
      tx.objectStore(STORE_STATE).put(state);
    }, factory);
    return state;
  }
  async function saveOrderFileProgress(state, order = null, failure2 = null, factory) {
    checkState(state);
    if (order && (!/^[0-9]{7}$/.test(order.id) || !Array.isArray(order.transfers))) throw Error("MANUAL_ORDER_LIST_RECORD_INVALID");
    if (failure2 && !/^[0-9]{7}$/.test(failure2.id))
      throw Error("MANUAL_ORDER_LIST_FAILURE_INVALID");
    return transact([STORE_STATE, STORE_PENDING, STORE_FAILURES], "readwrite", (tx) => {
      tx.objectStore(STORE_STATE).put({ ...state, updated_at: (/* @__PURE__ */ new Date()).toISOString() });
      if (order) tx.objectStore(STORE_PENDING).put(order);
      if (failure2) tx.objectStore(STORE_FAILURES).put(failure2);
    }, factory);
  }
  async function saveOrderFileStatus(state, factory) {
    checkState(state);
    return transact([STORE_STATE], "readwrite", (tx) => tx.objectStore(STORE_STATE).put({ ...state, updated_at: (/* @__PURE__ */ new Date()).toISOString() }), factory);
  }
  async function commitOrderFileArchive(state, records, factory) {
    checkState(state);
    if (!Array.isArray(records) || records.length < 1 || records.length > 100 || records.some((x) => !/^[0-9]{7}$/.test(x.id))) throw Error("MANUAL_ORDER_LIST_COMMIT_INVALID");
    if (state.download !== null) throw Error("MANUAL_ORDER_LIST_DOWNLOAD_NOT_CLEARED");
    return transact([STORE_STATE, STORE_PENDING, STORE_SUCCESS], "readwrite", (tx) => {
      tx.objectStore(STORE_STATE).put({ ...state, updated_at: (/* @__PURE__ */ new Date()).toISOString() });
      for (const row of records) {
        tx.objectStore(STORE_PENDING).delete(row.id);
        tx.objectStore(STORE_SUCCESS).put({
          id: row.id,
          order_number: row.id,
          collection_status: "TZ_APPROVED",
          collected_at: row.collected_at,
          files: row.files,
          eligible_articles: row.eligible_articles,
          verified_articles: row.verified_articles
        });
      }
    }, factory);
  }
  async function exportOrderFileRegistry(factory) {
    return transact([STORE_STATE, STORE_SUCCESS, STORE_FAILURES], "readonly", (tx) => {
      const status = tx.objectStore(STORE_STATE).get(KEY2);
      const found = tx.objectStore(STORE_SUCCESS).getAll();
      const failed = tx.objectStore(STORE_FAILURES).getAll();
      return () => ({
        state: status.result,
        found_archived: found.result || [],
        failed_orders: failed.result || []
      });
    }, factory);
  }
  async function clearOrderFileQueue(factory) {
    return transact(STORES, "readwrite", (tx) => {
      for (const store of STORES) tx.objectStore(store).clear();
    }, factory);
  }

  // vision/orders/approval-file-controller.mjs
  var el = (tag, value) => {
    const n = document.createElement(tag);
    if (value !== void 0) n.textContent = value;
    return n;
  };
  var button2 = (label, fn) => {
    const b = el("button", label);
    b.type = "button";
    b.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      void fn();
    });
    return b;
  };
  var wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  var pad = (n) => String(n).padStart(5, "0");
  var acceptedRate = (n) => Number.isSafeInteger(n) && n >= 100 && n <= 6e4;
  function makeApprovalFileListController({
    getBusy = () => false,
    setBusy = () => {
    },
    scanOrder = async () => null,
    isClosed = () => false,
    refreshControls = () => {
    }
  } = {}) {
    const root = el("div");
    root.className = "vlo-file-list";
    root.style.cssText = "width:100%;border:1px solid #69898b;border-radius:8px;padding:10px;margin:10px 0;";
    root.append(el("strong", "\u0421\u043F\u0438\u0441\u043E\u043A \u0437\u0430\u043A\u0430\u0437\u043E\u0432 \u0438\u0437 \u0444\u0430\u0439\u043B\u0430 TXT"));
    root.append(el("p", "\u0417\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u0435 \u0444\u0430\u0439\u043B \u0441 \u0441\u0435\u043C\u0438\u0437\u043D\u0430\u0447\u043D\u044B\u043C\u0438 \u043D\u043E\u043C\u0435\u0440\u0430\u043C\u0438: \u043E\u0434\u0438\u043D \u043D\u043E\u043C\u0435\u0440 \u0432 \u0441\u0442\u0440\u043E\u043A\u0435. \u041F\u043E\u0432\u0442\u043E\u0440\u044B \u0443\u0434\u0430\u043B\u044F\u044E\u0442\u0441\u044F. \u041F\u0440\u043E\u0432\u0435\u0440\u044F\u044E\u0442\u0441\u044F \u0442\u043E\u043B\u044C\u043A\u043E \u043D\u043E\u043C\u0435\u0440\u0430 \u0438\u0437 \u0444\u0430\u0439\u043B\u0430, \u043D\u0435\u0437\u0430\u0432\u0438\u0441\u0438\u043C\u043E \u043E\u0442 \u0433\u0440\u0430\u043D\u0438\u0446 \u0440\u0435\u0436\u0438\u043C\u0430 \u0434\u0438\u0430\u043F\u0430\u0437\u043E\u043D\u0430. \u0414\u043E 100 \u0443\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043D\u043D\u044B\u0445 \u0437\u0430\u043A\u0430\u0437\u043E\u0432 \u0432 ZIP."));
    const fileLabel = el("label", "\u0412\u044B\u0431\u0440\u0430\u0442\u044C TXT \u0441\u043E \u0441\u043F\u0438\u0441\u043A\u043E\u043C ");
    const fileInput = el("input");
    fileInput.type = "file";
    fileInput.accept = ".txt,text/plain";
    fileInput.title = "\u041E\u0434\u0438\u043D \u0441\u0435\u043C\u0438\u0437\u043D\u0430\u0447\u043D\u044B\u0439 \u043D\u043E\u043C\u0435\u0440 \u0437\u0430\u043A\u0430\u0437\u0430 \u0432 \u043A\u0430\u0436\u0434\u043E\u0439 \u0441\u0442\u0440\u043E\u043A\u0435, \u0434\u043E 20 \u041C\u0411";
    fileInput.style.cssText = "max-width:100%;margin:4px 0;";
    fileLabel.append(fileInput);
    root.append(fileLabel);
    const rateLabel = el("label", "\u0417\u0430\u0434\u0435\u0440\u0436\u043A\u0430 \u043C\u0435\u0436\u0434\u0443 \u043D\u043E\u043C\u0435\u0440\u0430\u043C\u0438, \u043C\u0441 ");
    const rateInput = el("input");
    rateInput.type = "number";
    rateInput.value = "1200";
    rateInput.min = "100";
    rateInput.max = "60000";
    rateInput.step = "100";
    rateInput.title = "100\u201360000 \u043C\u0441, \u043F\u0440\u0438\u043C\u0435\u043D\u044F\u0435\u0442\u0441\u044F \u0441\u0440\u0430\u0437\u0443";
    rateInput.style.cssText = "max-width:110px;color:#203436;background:#f2f8f3;padding:5px;border-radius:4px;";
    rateLabel.append(rateInput);
    root.append(rateLabel);
    const controls = el("div");
    controls.className = "vlo-actions";
    const startBtn = button2("\u0421\u0442\u0430\u0440\u0442 / \u043F\u0440\u043E\u0434\u043E\u043B\u0436\u0438\u0442\u044C \u043F\u043E \u0441\u043F\u0438\u0441\u043A\u0443", () => start());
    const pauseBtn = button2("\u041F\u0430\u0443\u0437\u0430 \u0441\u043F\u0438\u0441\u043A\u0430", () => {
      paused = true;
      void setMode("paused");
      show("\u041F\u0430\u0443\u0437\u0430 \u043F\u043E\u0441\u043B\u0435 \u0442\u0435\u043A\u0443\u0449\u0435\u0433\u043E \u0437\u0430\u043A\u0430\u0437\u0430");
    });
    const stopBtn = button2("\u0421\u0442\u043E\u043F \u0438 \u0430\u0440\u0445\u0438\u0432 \u0441\u043F\u0438\u0441\u043A\u0430", () => {
      stopped = true;
      void setMode("stopped");
      show("\u0421\u043E\u0445\u0440\u0430\u043D\u044E \u043D\u0435\u043F\u043E\u043B\u043D\u0443\u044E ZIP-\u043F\u0430\u0440\u0442\u0438\u044E \u043F\u043E\u0441\u043B\u0435 \u0442\u0435\u043A\u0443\u0449\u0435\u0433\u043E \u0437\u0430\u043A\u0430\u0437\u0430");
    });
    const saveBtn = button2("\u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u043D\u0435\u043F\u043E\u043B\u043D\u0443\u044E ZIP \u0441\u043F\u0438\u0441\u043A\u0430", () => manualSave());
    const exportBtn = button2("\u0420\u0435\u0435\u0441\u0442\u0440 \u0441\u043F\u0438\u0441\u043A\u0430 JSON", () => exportRegistry());
    const resetBtn = button2("\u041E\u0447\u0438\u0441\u0442\u0438\u0442\u044C \u0441\u043F\u0438\u0441\u043E\u043A \u0438 \u043F\u0440\u043E\u0433\u0440\u0435\u0441\u0441", () => reset());
    controls.append(startBtn, pauseBtn, stopBtn, saveBtn, exportBtn, resetBtn);
    root.append(controls);
    const progress = el("p", "\u0421\u043F\u0438\u0441\u043E\u043A \u0437\u0430\u043A\u0430\u0437\u043E\u0432 \u043D\u0435 \u0437\u0430\u0433\u0440\u0443\u0436\u0435\u043D.");
    progress.style.whiteSpace = "pre-line";
    root.append(progress);
    pauseBtn.disabled = stopBtn.disabled = saveBtn.disabled = true;
    let state = null, queue = null, pending = [], batch = new ApprovalBatchSession();
    let running = false, paused = false, stopped = false, activeOrder = null;
    let currentDelay = 1200, lastError = null, checkedSession = 0;
    let restoreBlocked = false, writeChain = Promise.resolve();
    let networkHealth = freshNetworkHealth(), lastActivityAt = null;
    let stopWithoutZip = false, stage = "idle";
    let init = Promise.resolve(false);
    const write = (fn) => {
      writeChain = writeChain.catch(() => {
      }).then(fn);
      return writeChain;
    };
    const currentMode = () => stopped ? "stopped" : paused ? "paused" : running ? "running" : "paused";
    function show(message = "") {
      const next = state && state.index < state.total ? String(queue[state.index]) : "\u2014";
      progress.textContent = (state ? "\u0424\u0430\u0439\u043B: " + state.filename + " \xB7 \u0432\u0441\u0435\u0433\u043E: " + state.total + " \xB7 \u043E\u0431\u0440\u0430\u0431\u043E\u0442\u0430\u043D\u043E: " + state.index + " \xB7 \u0437\u0430\u0434\u0435\u0440\u0436\u043A\u0430: " + currentDelay + " \u043C\u0441" : "\u0424\u0430\u0439\u043B \u043D\u0435 \u0437\u0430\u0433\u0440\u0443\u0436\u0435\u043D") + "\n\u0421\u043B\u0435\u0434\u0443\u044E\u0449\u0438\u0439 \u0437\u0430\u043A\u0430\u0437: " + next + " \xB7 \u043F\u0440\u043E\u0432\u0435\u0440\u0435\u043D\u043E \u043F\u043E\u0441\u043B\u0435 \u043E\u0442\u043A\u0440\u044B\u0442\u0438\u044F: " + checkedSession + " \xB7 ZIP: " + (state?.archive_count || 0) + " \xB7 \u043D\u0430\u0439\u0434\u0435\u043D\u043E \u0438 \u0430\u0440\u0445\u0438\u0432\u0438\u0440\u043E\u0432\u0430\u043D\u043E: " + (state?.found_committed || 0) + " \xB7 \u0432 \u0442\u0435\u043A\u0443\u0449\u0435\u0439 \u043F\u0430\u0440\u0442\u0438\u0438: " + activeRows().length + " \xB7 ZIP \u0437\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u0442\u0441\u044F: " + (state?.download ? 1 : 0) + " \xB7 \u043E\u0448\u0438\u0431\u043E\u043A \u043E\u0442\u043A\u0440\u044B\u0442\u0438\u044F: " + (state?.failed_count || 0) + " \xB7 \u0441\u0435\u0442\u044C: " + networkHealth.state + " \xB7 \u043F\u043E\u0432\u0442\u043E\u0440\u043E\u0432 GET: " + networkHealth.retries + " \xB7 \u0441\u0435\u0442\u0435\u0432\u044B\u0445 \u043E\u0448\u0438\u0431\u043E\u043A: " + networkHealth.transient_errors + " \xB7 \u0444\u0430\u0437\u0430: " + stage + (lastError ? "\n\u041E\u0448\u0438\u0431\u043A\u0430: " + lastError : "") + (message ? "\n" + message : "");
    }
    const activeRows = () => pending.filter((row) => !state?.download?.order_ids?.includes(row.id));
    const activeBytes = () => activeRows().reduce((sum, row) => sum + row.transfers.reduce((n, t) => n + (t.data?.byteLength || 0), 0), 0);
    const captureMode = (mode) => {
      if (!state) return null;
      state = { ...state, mode, delay_ms: currentDelay };
      return { ...state };
    };
    async function setMode(mode) {
      if (!state) return;
      const snapshot = captureMode(mode);
      try {
        await write(() => saveOrderFileStatus(snapshot));
      } catch (error) {
        lastError = String(error?.message || "MANUAL_LIST_MODE_FAILED");
        show();
      }
    }
    function validateDelay() {
      const n = Number(rateInput.value);
      return acceptedRate(n) ? n : null;
    }
    rateInput.addEventListener("input", () => {
      const value = validateDelay();
      if (value === null) {
        show("\u0414\u043E\u043F\u0443\u0441\u0442\u0438\u043C\u0430\u044F \u0437\u0430\u0434\u0435\u0440\u0436\u043A\u0430: 100\u201360000 \u043C\u0441");
        return;
      }
      if (value === currentDelay) return;
      currentDelay = value;
      if (state) void setMode(currentMode());
      show("\u041D\u043E\u0432\u0430\u044F \u0437\u0430\u0434\u0435\u0440\u0436\u043A\u0430 " + value + " \u043C\u0441 \u043F\u0440\u0438\u043C\u0435\u043D\u044F\u0435\u0442\u0441\u044F \u0431\u0435\u0437 \u0441\u0431\u0440\u043E\u0441\u0430 \u043E\u0447\u0435\u0440\u0435\u0434\u0438");
    });
    rateInput.addEventListener("change", () => {
      if (validateDelay() === null) rateInput.value = String(currentDelay);
    });
    async function dynamicDelay() {
      const started = performance.now();
      while (!paused && !stopped && !isClosed()) {
        const ms = currentDelay - (performance.now() - started);
        if (ms <= 0) break;
        await wait(Math.min(ms, 100));
      }
    }
    function audit(phase, rest = {}) {
      return chrome.runtime.sendMessage({ op: "vision-range-download-audit-v1", phase, ...rest });
    }
    async function waitForChrome(afterId, bytes, filename) {
      for (let i = 0; i < 240; i++) {
        const result = await audit("check", {
          after_id: afterId,
          byte_length: bytes,
          expected_filename: filename
        });
        if (result?.status === "RANGE_DOWNLOAD_COMPLETE") return;
        if (result?.status !== "RANGE_DOWNLOAD_PENDING")
          throw Error(result?.status || "MANUAL_ORDER_LIST_ZIP_AUDIT_FAILED");
        await wait(500);
      }
      throw Error("MANUAL_ORDER_LIST_ZIP_DOWNLOAD_TIMEOUT");
    }
    async function waitForPreviousOrder() {
      for (let i = 0; i < 210; i++) {
        const result = await chrome.runtime.sendMessage({
          op: "vision-approval-queue-status-v1"
        }).catch(() => null);
        if (result?.status !== "QUEUE_STATUS_OK")
          throw Error("MANUAL_ORDER_LIST_WORKER_STATUS_FAILED");
        if (!result.busy) return;
        await wait(1e3);
      }
      throw Error("MANUAL_ORDER_LIST_OLD_WORKER_BUSY");
    }
    async function commitDownloaded() {
      const info = state?.download;
      if (!info) return;
      const ids = info.order_ids || pending.map((x) => x.id);
      const selected = new Set(ids), rows = pending.filter((x) => selected.has(x.id));
      if (rows.length !== ids.length || !rows.length)
        throw Error("MANUAL_ORDER_LIST_DOWNLOAD_ROWS_MISSING");
      const updated = {
        ...state,
        download: null,
        archive_count: state.archive_count + 1,
        found_committed: state.found_committed + rows.length,
        files_committed: (state.files_committed || 0) + (Number.isInteger(info.verified_files) ? info.verified_files : rows.reduce((n, x) => n + (x.files || 0), 0)),
        last_archive: {
          filename: info.filename,
          bytes: info.bytes,
          orders: rows.length,
          files_verified: info.verified_files ?? null,
          files_missing: info.missing_files ?? null,
          entry_count: info.entry_count ?? null,
          confirmed_at: (/* @__PURE__ */ new Date()).toISOString(),
          status: "CHROME_COMPLETE"
        },
        mode: currentMode()
      };
      await write(() => commitOrderFileArchive(updated, rows));
      state = updated;
      pending = pending.filter((x) => !selected.has(x.id));
      for (const id of ids) batch.discardOrder(id);
      saveBtn.disabled = running || !activeRows().length;
      lastError = null;
      show("ZIP \u2116" + state.archive_count + " \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043D; \u043D\u043E\u0432\u0430\u044F \u043F\u0430\u0440\u0442\u0438\u044F \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0430.");
    }
    async function resumePreparingZip() {
      const info = state?.download;
      if (info?.stage !== "preparing") return true;
      const check = await audit("check", {
        after_id: info.after_id,
        byte_length: info.bytes,
        expected_filename: info.filename
      });
      if (check?.status === "RANGE_DOWNLOAD_COMPLETE") {
        await commitDownloaded();
        return true;
      }
      if (check?.status === "RANGE_DOWNLOAD_PENDING" && check.matched > 0) {
        const next2 = { ...state, download: { ...info, stage: "started" } };
        await write(() => saveOrderFileStatus(next2));
        state = next2;
        for (const id of info.order_ids) batch.discardOrder(id);
        return true;
      }
      if (check?.status !== "RANGE_DOWNLOAD_PENDING")
        throw Error(check?.status || "VISION_ZIP_PREPARED_AUDIT_FAILED");
      const selected = new Set(info.order_ids);
      const rows = pending.filter((row) => selected.has(row.id));
      if (rows.length !== info.order_ids.length)
        throw Error("VISION_ZIP_PREPARED_ROWS_MISSING");
      const temp = new ApprovalBatchSession();
      for (const row of rows) temp.restoreOrder(row.id, row.transfers);
      const blob = temp.finalize(rows).blob;
      if (blob.size !== info.bytes) throw Error("VISION_ZIP_PREPARED_SIZE_CHANGED");
      const downloadId = await startExtensionZipDownload(blob, info.filename);
      const next = { ...state, download: {
        ...info,
        stage: "started",
        after_id: downloadId - 1
      } };
      await write(() => saveOrderFileStatus(next));
      state = next;
      for (const id of info.order_ids) batch.discardOrder(id);
      return true;
    }
    async function recoverDownload(waitForCompletion = false) {
      if (!state?.download) return true;
      try {
        await resumePreparingZip();
        if (!state.download) return true;
        const info = state.download;
        if (waitForCompletion) {
          await waitForChrome(info.after_id, info.bytes, info.filename);
          await commitDownloaded();
          return true;
        }
        const result = await audit("check", {
          after_id: info.after_id,
          byte_length: info.bytes,
          expected_filename: info.filename
        });
        if (result?.status === "RANGE_DOWNLOAD_COMPLETE") {
          await commitDownloaded();
          return true;
        }
        if (result?.status === "RANGE_DOWNLOAD_PENDING") return true;
        throw Error(result?.status || "MANUAL_ORDER_LIST_ZIP_AUDIT_FAILED");
      } catch (error) {
        lastError = String(error?.message || "MANUAL_ORDER_LIST_ZIP_UNCONFIRMED");
        show("Chrome \u043D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u043B ZIP. \u0414\u0430\u043D\u043D\u044B\u0435 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u044B; \u043F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0438.");
        return false;
      }
    }
    async function saveBatch(reason) {
      let rows = activeRows();
      if (!rows.length) return true;
      if (state.download) {
        if (!await recoverDownload(true)) return false;
        rows = activeRows();
        if (!rows.length) return true;
      }
      let result;
      try {
        result = batch.finalize(rows);
      } catch (error) {
        lastError = String(error?.message || "MANUAL_ORDER_LIST_ZIP_INVALID");
        show();
        return false;
      }
      const filename = "vision-ai-list-part-" + pad(state.archive_count + 1) + "-" + rows[0].id + "-" + rows.at(-1).id + ".zip";
      try {
        const before = await audit("baseline");
        if (before?.status !== "RANGE_DOWNLOAD_BASELINE")
          throw Error("MANUAL_ORDER_LIST_DOWNLOAD_BASELINE");
        const download = {
          after_id: before.highest_id,
          bytes: result.blob.size,
          filename,
          order_ids: rows.map((x) => x.id),
          stage: "preparing",
          verified_files: result.counts.verified_files,
          missing_files: result.counts.missing_files,
          entry_count: result.entry_count
        };
        const snapshot = { ...state, download, mode: currentMode() };
        await write(() => saveOrderFileStatus(snapshot));
        state = snapshot;
        const downloadId = await startExtensionZipDownload(result.blob, filename);
        const started = { ...state, download: {
          ...download,
          stage: "started",
          after_id: downloadId - 1
        } };
        await write(() => saveOrderFileStatus(started));
        state = started;
        for (const row of rows) batch.discardOrder(row.id);
        show("ZIP \u043F\u0435\u0440\u0435\u0434\u0430\u043D Chrome (" + reason + "); \u043F\u0440\u043E\u0434\u043E\u043B\u0436\u0430\u044E \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0443 \u043D\u043E\u0432\u044B\u0445 \u043D\u043E\u043C\u0435\u0440\u043E\u0432.");
        return true;
      } catch (error) {
        lastError = String(error?.message || "MANUAL_ORDER_LIST_DOWNLOAD_FAILED");
        show("ZIP \u043F\u043E\u043A\u0430 \u043D\u0435 \u043D\u0430\u0447\u0430\u0442/\u043D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043D: \u043F\u0430\u0440\u0442\u0438\u044F \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0430 \u0432 IndexedDB");
        return false;
      }
    }
    async function manualSave() {
      if (running || !pending.length) return;
      if (state.download && !await recoverDownload(true)) return;
      await saveBatch("\u0432\u0440\u0443\u0447\u043D\u0443\u044E");
      if (state.download) await recoverDownload(true);
    }
    async function importFile(file, remote = false, overwrite = false) {
      await init;
      if (running || getBusy()) {
        show("\u041D\u0435\u043B\u044C\u0437\u044F \u0437\u0430\u043C\u0435\u043D\u0438\u0442\u044C \u0441\u043F\u0438\u0441\u043E\u043A \u0432\u043E \u0432\u0440\u0435\u043C\u044F \u0434\u0440\u0443\u0433\u043E\u0433\u043E \u0441\u043A\u0430\u043D\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u044F.");
        return;
      }
      if (!file) return;
      if (file.size > ORDER_LIST_MAX_BYTES) {
        lastError = "MANUAL_ORDER_LIST_FILE_TOO_LARGE";
        show();
        return;
      }
      let parsed;
      try {
        parsed = parseOrderListText(await file.text());
      } catch (error) {
        lastError = String(error?.message || "MANUAL_ORDER_LIST_PARSE_FAILED");
        show();
        return;
      }
      if (state && (state.index > 0 || pending.length || state.found_committed > 0)) {
        if (remote && !overwrite) return { status: "VISION_IMPORT_REPLACE_REQUIRES_CONFIRMATION" };
        if (!remote && typeof globalThis.confirm === "function" && !globalThis.confirm(
          "\u0418\u043C\u043F\u043E\u0440\u0442 \u043D\u043E\u0432\u043E\u0433\u043E \u0444\u0430\u0439\u043B\u0430 \u0437\u0430\u043C\u0435\u043D\u0438\u0442 \u0442\u0435\u043A\u0443\u0449\u0438\u0439 \u0441\u043F\u0438\u0441\u043E\u043A \u0438 \u0435\u0433\u043E \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D\u043D\u044B\u0439 \u043F\u0440\u043E\u0433\u0440\u0435\u0441\u0441. \u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u044D\u043A\u0441\u043F\u043E\u0440\u0442\u0438\u0440\u0443\u0439\u0442\u0435 \u0440\u0435\u0435\u0441\u0442\u0440 \u0438 \u0441\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u0435 ZIP. \u041F\u0440\u043E\u0434\u043E\u043B\u0436\u0438\u0442\u044C?"
        )) return;
      }
      try {
        await writeChain.catch(() => {
        });
        const next = await importOrderFileQueue(parsed.numbers, file.name, currentDelay);
        state = next;
        queue = Uint32Array.from(parsed.numbers);
        pending = [];
        batch = new ApprovalBatchSession();
        checkedSession = 0;
        networkHealth = freshNetworkHealth();
        lastActivityAt = null;
        stopWithoutZip = false;
        lastError = null;
        restoreBlocked = false;
        paused = stopped = false;
        saveBtn.disabled = true;
        show("\u0424\u0430\u0439\u043B \u043F\u0440\u0438\u043D\u044F\u0442. \u0423\u043D\u0438\u043A\u0430\u043B\u044C\u043D\u044B\u0445 \u043D\u043E\u043C\u0435\u0440\u043E\u0432: " + parsed.numbers.length + "; \u0443\u0434\u0430\u043B\u0435\u043D\u043E \u043F\u043E\u0432\u0442\u043E\u0440\u043E\u0432: " + parsed.duplicates + ". \u041D\u0430\u0436\u043C\u0438\u0442\u0435 \xAB\u0421\u0442\u0430\u0440\u0442 / \u043F\u0440\u043E\u0434\u043E\u043B\u0436\u0438\u0442\u044C \u043F\u043E \u0441\u043F\u0438\u0441\u043A\u0443\xBB.");
        return { status: "VISION_IMPORT_OK" };
      } catch (error) {
        lastError = String(error?.message || "MANUAL_ORDER_LIST_IMPORT_FAILED");
        show();
      }
    }
    fileInput.addEventListener("change", () => {
      const file = fileInput.files?.[0];
      fileInput.value = "";
      void importFile(file);
    });
    async function reset(remote = false) {
      await init;
      if (running || getBusy()) return { status: "VISION_RESET_STOP_FIRST" };
      if (!remote && typeof globalThis.confirm === "function" && !globalThis.confirm(
        "\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u0432\u0435\u0441\u044C \u0438\u043C\u043F\u043E\u0440\u0442\u0438\u0440\u043E\u0432\u0430\u043D\u043D\u044B\u0439 \u0441\u043F\u0438\u0441\u043E\u043A, \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u044B \u0438 \u043A\u043E\u043D\u0442\u0440\u043E\u043B\u044C\u043D\u0443\u044E \u0442\u043E\u0447\u043A\u0443? \u0421\u043A\u0430\u0447\u0430\u043D\u043D\u044B\u0435 ZIP \u043E\u0441\u0442\u0430\u043D\u0443\u0442\u0441\u044F \u043D\u0430 \u0434\u0438\u0441\u043A\u0435."
      )) return;
      try {
        await writeChain.catch(() => {
        });
        await clearOrderFileQueue();
        queue = state = null;
        pending = [];
        batch = new ApprovalBatchSession();
        networkHealth = freshNetworkHealth();
        lastActivityAt = null;
        stopWithoutZip = false;
        checkedSession = 0;
        lastError = null;
        restoreBlocked = false;
        paused = stopped = false;
        saveBtn.disabled = true;
        show("\u0421\u043F\u0438\u0441\u043E\u043A \u0438 \u043F\u0440\u043E\u0433\u0440\u0435\u0441\u0441 \u043E\u0447\u0438\u0449\u0435\u043D\u044B");
        return { status: "VISION_RESET_COMPLETE" };
      } catch (error) {
        lastError = String(error?.message || "MANUAL_ORDER_LIST_RESET_FAILED");
        show();
        return { status: "VISION_RESET_FAILED" };
      }
    }
    async function exportRegistry() {
      if (!state) {
        show("\u0421\u043F\u0438\u0441\u043E\u043A \u0435\u0449\u0451 \u043D\u0435 \u0437\u0430\u0433\u0440\u0443\u0436\u0435\u043D");
        return;
      }
      try {
        const reg = await exportOrderFileRegistry();
        const json2 = {
          schema: "printcheck.vision.order-file-registry.v1",
          filename: state.filename,
          total: state.total,
          index: state.index,
          next_order: queue[state.index] || null,
          archives_completed: state.archive_count,
          found_committed: state.found_committed,
          found_archived: reg.found_archived,
          found_pending: pending.map(({ transfers, ...other }) => other),
          failed_orders: reg.failed_orders,
          training_ready: false,
          imported_at: state.imported_at
        };
        const u = URL.createObjectURL(new Blob(
          [JSON.stringify(json2, null, 2) + "\n"],
          { type: "application/json" }
        ));
        const a = el("a");
        a.href = u;
        a.download = "vision-ai-file-list-registry.json";
        document.body.append(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(u), 15e3);
      } catch (error) {
        lastError = String(error?.message || "MANUAL_ORDER_LIST_REGISTRY_FAILED");
        show();
      }
    }
    async function start() {
      if (running || getBusy() || isClosed()) return;
      await init;
      if (running || getBusy() || isClosed()) return;
      if (restoreBlocked) {
        show("\u0416\u0443\u0440\u043D\u0430\u043B \u043F\u043E\u0432\u0440\u0435\u0436\u0434\u0451\u043D. \u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u0441\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u0435 \u0438\u0441\u0445\u043E\u0434\u043D\u044B\u0435 \u0434\u0430\u043D\u043D\u044B\u0435.");
        return;
      }
      if (!state || !queue) {
        show("\u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u0435 TXT \u0441\u043E \u0441\u043F\u0438\u0441\u043A\u043E\u043C");
        return;
      }
      if (!globalThis.__visionLocalTrustedTransport) {
        lastError = "MANUAL_MV3_TRANSPORT_REQUIRED";
        show();
        return;
      }
      const rate = validateDelay();
      if (rate === null) {
        lastError = "MANUAL_ORDER_LIST_DELAY_INVALID";
        show();
        return;
      }
      currentDelay = rate;
      if (state.index >= state.total && !pending.length) {
        show("\u0412\u0441\u0435 \u043D\u043E\u043C\u0435\u0440\u0430 \u0438\u0437 \u0441\u043F\u0438\u0441\u043A\u0430 \u043F\u0440\u043E\u0432\u0435\u0440\u0435\u043D\u044B.");
        return;
      }
      running = true;
      paused = stopped = false;
      setBusy(true);
      startBtn.disabled = resetBtn.disabled = saveBtn.disabled = true;
      pauseBtn.disabled = stopBtn.disabled = false;
      let message = "";
      try {
        if (state.download && !await recoverDownload())
          throw Error("MANUAL_ORDER_LIST_ZIP_UNCONFIRMED");
        await setMode("running");
        if (activeRows().length >= 100 || activeBytes() > 12e7) {
          if (!await saveBatch("\u0432\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u043D\u0430\u044F \u043F\u0430\u0440\u0442\u0438\u044F"))
            throw Error("MANUAL_ORDER_LIST_ZIP_REQUIRES_REVIEW");
        }
        while (state.index < state.total && !paused && !stopped && !isClosed()) {
          const id = queue[state.index], order_number = String(id);
          stage = "checking_order";
          lastActivityAt = (/* @__PURE__ */ new Date()).toISOString();
          const measured = await controlledOrderProbe(id, (n) => probeTzForOrder(n, { explicitList: true }), { health: networkHealth });
          networkHealth = measured.health;
          const inspected = measured.result;
          if (measured.halt) {
            lastError = measured.reason;
            const blocked = {
              ...state,
              network: networkHealth,
              mode: "paused",
              last_activity_at: lastActivityAt
            };
            await write(() => saveOrderFileStatus(blocked));
            state = blocked;
            paused = true;
            show("\u041E\u0431\u043D\u0430\u0440\u0443\u0436\u0435\u043D \u043E\u0431\u0449\u0438\u0439 \u0441\u0431\u043E\u0439 \u0441\u0435\u0442\u0438. \u041E\u0447\u0435\u0440\u0435\u0434\u044C \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0430.");
            break;
          }
          let record = null, failure2 = null;
          if (inspected.status === "TZ_APPROVED") {
            activeOrder = order_number;
            stage = "collecting_approvals";
            let collected;
            try {
              await waitForPreviousOrder();
              collected = await scanOrder(explicitListOrderUrl(id), true);
            } catch {
              collected = { status: "MANUAL_NATIVE_APPROVAL_QUEUE_FAILED" };
            } finally {
              activeOrder = null;
            }
            if (collected?.status === "COMPLETE" && collected.final_evidence_saved === true) {
              try {
                record = {
                  id: order_number,
                  order_number,
                  collected_at: (/* @__PURE__ */ new Date()).toISOString(),
                  status: "TZ_APPROVED",
                  native_status_id: "59",
                  eligible_articles: collected.eligible_articles || 0,
                  verified_articles: collected.verified_articles || 0,
                  files: collected.files || 0,
                  transfers: batch.exportOrder(order_number)
                };
              } catch (error) {
                failure2 = {
                  id: order_number,
                  phase: "native_approval",
                  reason: String(error?.message || "MANUAL_ORDER_LIST_MISSING_EVIDENCE")
                };
              }
            } else {
              failure2 = {
                id: order_number,
                phase: "native_approval",
                reason: String(collected?.status || "MANUAL_APPROVAL_COLLECTION_INCOMPLETE")
              };
            }
          } else if (inspected.status !== "TZ_NOT_APPROVED" && inspected.status !== "ORDER_NOT_FOUND") {
            if (!isRecoverableRangeFailure(inspected.status)) {
              lastError = "MANUAL_ORDER_LIST_GLOBAL_" + inspected.status;
              break;
            }
            failure2 = {
              id: order_number,
              phase: "order_card",
              reason: inspected.status,
              ...Number.isInteger(inspected.http_status) ? { http_status: inspected.http_status } : {}
            };
          }
          const next = {
            ...state,
            index: state.index + 1,
            failed_count: state.failed_count + (failure2 ? 1 : 0),
            delay_ms: currentDelay,
            mode: currentMode(),
            network: networkHealth,
            browser_scans: (state.browser_scans || 0) + (inspected.status === "TZ_APPROVED" ? 1 : 0),
            last_activity_at: (/* @__PURE__ */ new Date()).toISOString()
          };
          await write(() => saveOrderFileProgress(next, record, failure2));
          state = next;
          lastActivityAt = next.last_activity_at;
          if (record) pending.push(record);
          else batch.discardOrder(order_number);
          checkedSession++;
          if (state.download && !await recoverDownload(false)) break;
          if (activeRows().length >= 100 || activeBytes() > 12e7) {
            if (!await saveBatch("100 \u0437\u0430\u043A\u0430\u0437\u043E\u0432 / \u043E\u0433\u0440\u0430\u043D\u0438\u0447\u0435\u043D\u0438\u0435 \u0440\u0430\u0437\u043C\u0435\u0440\u0430")) break;
          }
          show("\u041F\u043E\u0441\u043B\u0435\u0434\u043D\u0438\u0439 \u043F\u0440\u043E\u0432\u0435\u0440\u0435\u043D\u043D\u044B\u0439 \u043D\u043E\u043C\u0435\u0440: " + order_number + " \u2014 " + (failure2 ? failure2.reason : inspected.status));
          if (!paused && !stopped) await dynamicDelay();
        }
        if ((stopped && !stopWithoutZip || state.index >= state.total) && pending.length) {
          if (activeRows().length && !await saveBatch(stopped ? "\u043E\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0430" : "\u043E\u043A\u043E\u043D\u0447\u0430\u043D\u0438\u0435 \u0444\u0430\u0439\u043B\u0430"))
            paused = true;
          if (state.download && !await recoverDownload(true)) paused = true;
        }
        message = lastError ? "\u041E\u0421\u0422\u0410\u041D\u041E\u0412\u041B\u0415\u041D\u041E: " + lastError : paused ? "\u041F\u0410\u0423\u0417\u0410. \u041C\u043E\u0436\u043D\u043E \u043F\u0440\u043E\u0434\u043E\u043B\u0436\u0438\u0442\u044C. \u0414\u0430\u043D\u043D\u044B\u0435 \u043F\u0430\u0440\u0442\u0438\u0438 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u044B." : stopped ? stopWithoutZip ? "\u041E\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u043E. \u041A\u0443\u0440\u0441\u043E\u0440 \u0438 \u0444\u0430\u0439\u043B\u044B \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u044B \u0432 IndexedDB; ZIP \u2014 \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u043E." : "\u041E\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u043E. \u0420\u0435\u0435\u0441\u0442\u0440 \u0438 \u0430\u0440\u0445\u0438\u0432 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u044B." : state.index >= state.total ? "\u0421\u043F\u0438\u0441\u043E\u043A \u043F\u043E\u043B\u043D\u043E\u0441\u0442\u044C\u044E \u043F\u0440\u043E\u0432\u0435\u0440\u0435\u043D." : "\u0421\u043A\u0430\u043D\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u0435 \u043F\u0440\u0435\u0440\u0432\u0430\u043D\u043E.";
      } catch (error) {
        lastError = String(error?.message || "MANUAL_ORDER_LIST_SCAN_FAILED");
        message = "\u041E\u0421\u0422\u0410\u041D\u041E\u0412\u041A\u0410 \u041F\u041E \u041E\u0428\u0418\u0411\u041A\u0415: " + lastError;
      } finally {
        activeOrder = null;
        running = false;
        setBusy(false);
        stage = "idle";
        if (state) await setMode(stopped || state.index >= state.total ? "stopped" : "paused");
        startBtn.disabled = resetBtn.disabled = false;
        pauseBtn.disabled = stopBtn.disabled = true;
        saveBtn.disabled = !pending.length;
        refreshControls();
        show(message);
      }
    }
    init = (async () => {
      const saved = await loadOrderFileState();
      if (!saved) return false;
      state = saved.state;
      queue = saved.queue;
      if (state.download && !Array.isArray(state.download.order_ids)) {
        state = { ...state, download: {
          ...state.download,
          order_ids: saved.pending.map((x) => x.id)
        } };
        await saveOrderFileStatus(state);
      }
      currentDelay = state.delay_ms;
      rateInput.value = String(currentDelay);
      networkHealth = normalizeNetworkHealth(state.network);
      lastActivityAt = state.last_activity_at || state.updated_at || null;
      if (saved.pending.some((x) => !Array.isArray(x.transfers) || !x.transfers.length))
        throw Error("MANUAL_ORDER_LIST_PENDING_INVALID");
      batch = new ApprovalBatchSession();
      for (const record of saved.pending) {
        if (!state.download?.order_ids?.includes(record.id) || state.download?.stage === "preparing")
          batch.restoreOrder(record.id, record.transfers);
        pending.push(record);
      }
      saveBtn.disabled = !pending.length;
      show("\u041E\u0447\u0435\u0440\u0435\u0434\u044C \u0438 \u043D\u0435\u043F\u043E\u043B\u043D\u0430\u044F ZIP-\u043F\u0430\u0440\u0442\u0438\u044F \u0432\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u044B \u043F\u043E\u0441\u043B\u0435 \u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u044F \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u044B.");
      return state.mode === "running" || state.mode === "downloading";
    })().catch((error) => {
      restoreBlocked = true;
      lastError = String(error?.message || "MANUAL_ORDER_LIST_RESTORE_FAILED");
      show("\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0432\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0442\u044C \u043E\u0447\u0435\u0440\u0435\u0434\u044C. \u0414\u0430\u043D\u043D\u044B\u0435 \u043D\u0435 \u043E\u0447\u0438\u0449\u0435\u043D\u044B.");
      return false;
    });
    init.then((auto) => {
      if (auto && !isClosed()) void start();
    });
    return {
      element: root,
      get activeOrder() {
        return activeOrder;
      },
      get running() {
        return running;
      },
      receive: (message, expectedOrder) => batch.receive(message, expectedOrder),
      remote: async (action, payload = {}) => {
        if (action === "status") {
          await init;
          let archive_audit = null;
          if (state?.download) {
            const d = state.download;
            try {
              archive_audit = await audit("check", {
                after_id: d.after_id,
                byte_length: d.bytes,
                expected_filename: d.filename
              });
            } catch {
              archive_audit = { status: "VISION_DOWNLOAD_AUDIT_UNAVAILABLE" };
            }
          }
          return {
            mode: "file",
            running,
            paused,
            stopped,
            archive_audit,
            download_details: state?.download ? {
              filename: state.download.filename,
              bytes: state.download.bytes,
              files_verified: state.download.verified_files ?? null,
              files_missing: state.download.missing_files ?? null
            } : null,
            filename: state?.filename || null,
            total: state?.total || 0,
            checked: state?.index || 0,
            progress_percent: state?.total ? Math.floor(100 * state.index / state.total) : 0,
            last_activity_at: lastActivityAt || state?.updated_at || null,
            phase: stage,
            network: { ...networkHealth },
            last_archive: state?.last_archive || null,
            files_archived: state?.files_committed || 0,
            files_staged: pending.reduce((n, x) => n + (x.files || 0), 0),
            direct_http_checks: networkHealth.attempts,
            browser_scans: state?.browser_scans || 0,
            next_order: queue && state?.index < state?.total ? String(queue[state.index]) : null,
            archives: state?.archive_count || 0,
            found: state?.found_committed || 0,
            pending: pending.length,
            downloading: !!state?.download,
            errors: state?.failed_count || 0,
            delay_ms: currentDelay,
            blocked: restoreBlocked,
            error: lastError
          };
        }
        if (action === "import") {
          if (typeof payload.text !== "string" || payload.text.length > 2e7 || typeof payload.filename !== "string")
            throw Error("MANUAL_ORDER_LIST_REMOTE_IMPORT_INVALID");
          const raw = payload.text;
          const file = {
            name: payload.filename.slice(0, 120),
            size: new TextEncoder().encode(raw).length,
            text: async () => raw
          };
          const result = await importFile(file, true, payload.overwrite === true);
          return result || { status: lastError || "VISION_IMPORT_NOT_COMPLETED" };
        }
        if (action === "delay") {
          if (!acceptedRate(payload.value)) throw Error("MANUAL_ORDER_LIST_DELAY_INVALID");
          rateInput.value = String(payload.value);
          rateInput.dispatchEvent(new Event("input"));
          return { status: "VISION_DELAY_UPDATED" };
        }
        if (action === "start") {
          void start();
          return { status: "VISION_SCAN_START_REQUESTED" };
        }
        if (action === "pause") {
          pauseBtn.click();
          return { status: "VISION_SCAN_PAUSE_REQUESTED" };
        }
        if (action === "stop") {
          stopped = true;
          stopWithoutZip = true;
          await setMode("stopped");
          return { status: "VISION_SCAN_STOP_REQUESTED" };
        }
        if (action === "save") {
          saveBtn.click();
          return { status: "VISION_SCAN_ZIP_SAVE_REQUESTED" };
        }
        if (action === "reset") {
          if (payload.confirmed !== true) return { status: "VISION_RESET_CONFIRMATION_REQUIRED" };
          return await reset(true);
        }
        if (action === "export") {
          exportBtn.click();
          return { status: "VISION_REGISTRY_EXPORT_REQUESTED" };
        }
        return { status: "VISION_REMOTE_ACTION_DENIED" };
      },
      requestPause: () => {
        paused = true;
        void setMode("paused");
      },
      requestStop: () => {
        stopped = true;
        void setMode("stopped");
      }
    };
  }

  // vision/orders/overlay-entry.mjs
  var ID = "vision-local-order-overlay";
  var STYLE_ID = "vision-local-order-style";
  var CSS = [
    "#vision-local-order-overlay{position:fixed!important;top:12px!important;right:12px!important;z-index:2147483640!important;width:min(390px,calc(100vw - 24px))!important;max-height:76vh!important;overflow:auto!important;background:#24383c!important;border:1px solid #5c777a!important;border-radius:9px!important;box-shadow:0 8px 35px #101b22a8!important;color:#eef5f2!important;padding:15px!important;text-align:left!important;font:13px/1.45 system-ui,sans-serif!important}",
    "#vision-local-order-overlay *{box-sizing:border-box!important;font:inherit!important}",
    "#vision-local-order-overlay h2{font-size:17px!important;margin:0 0 5px!important;color:white!important}",
    "#vision-local-order-overlay p{margin:6px 0 9px!important;color:#cbd8d4!important}",
    "#vision-local-order-overlay .vlo-actions{display:flex!important;flex-wrap:wrap!important;gap:7px!important;margin:10px 0!important}",
    "#vision-local-order-overlay button{border-radius:5px!important;border:1px solid #839b99!important;background:#e9efec!important;color:#263c41!important;padding:6px 9px!important;cursor:pointer!important}",
    "#vision-local-order-overlay button:disabled{opacity:.5!important;cursor:not-allowed!important}",
    "#vision-local-order-overlay .vlo-start{background:#8fb83f!important;border-color:#8fb83f!important;font-weight:700!important}",
    "#vision-local-order-overlay .vlo-note{font-size:12px!important;line-height:1.4!important}",
    ".vision-order-result-cell .vlo-files{margin:4px 0!important;max-width:320px!important}",
    ".vision-order-result-cell .vlo-filename{white-space:pre-wrap!important;overflow-wrap:anywhere!important;margin:3px 0!important}",
    "#vision-local-order-overlay .vlo-stats{white-space:pre-line!important;margin:8px 0!important;color:#cbe3d6!important}",
    ".vision-order-result-cell{min-width:210px!important;font:12px/1.5 system-ui,sans-serif!important;white-space:normal!important;color:#2f4348!important;padding:6px!important;vertical-align:middle!important}",
    ".vision-order-result-cell .vlo-label{font-weight:700!important;color:#36515a!important}",
    ".vision-order-result-cell .vlo-detail{display:block!important;white-space:normal!important;color:#6b777a!important}",
    ".vision-order-result-cell button,.vision-order-result-cell select{font:12px system-ui,sans-serif!important;margin:3px 4px 3px 0!important;border:1px solid #a4b6b5!important;border-radius:4px!important;background:#f5f8f6!important;color:#345058!important;padding:3px 5px!important;cursor:pointer!important;max-width:160px!important}",
    ".vision-order-result-cell [data-vlo-grade]{display:block!important}"
  ].join("\n");
  var node = (tag, text2, cls) => {
    const el2 = document.createElement(tag);
    if (cls) el2.className = cls;
    if (text2 !== void 0) el2.textContent = text2;
    return el2;
  };
  var safeNumber = (n) => Number.isFinite(n) ? n.toFixed(3) + " \u043C\u043C" : "\u043D\u0435 \u0438\u0437\u043C\u0435\u0440\u0435\u043D\u043E";
  function summarize(res) {
    if (res.status !== "RESEARCH_ONLY")
      return (res.type || "\u0444\u0430\u0439\u043B").toUpperCase() + ": \u0440\u0443\u0447\u043D\u0430\u044F \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u2014 " + String(res.reason || "\u043D\u0435 \u043E\u043F\u0440\u0435\u0434\u0435\u043B\u0435\u043D\u043E").slice(0, 80) + (res.reference_state ? " \xB7 " + res.reference_state : "");
    if (res.type === "svg")
      return "SVG: " + res.detected_regions + " \u043C\u0435\u0441\u0442; \u043B\u0438\u043D\u0438\u044F " + safeNumber(res.min_line_document_mm) + ", \u043F\u0440\u043E\u0431\u0435\u043B " + safeNumber(res.min_gap_document_mm) + " (\u043D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D \u043C\u0430\u0441\u0448\u0442\u0430\u0431 \u0437\u0430\u043A\u0430\u0437\u0430)";
    return "\u0420\u0430\u0441\u0442\u0440: " + res.detected_regions + " \u043A\u0430\u043D\u0434\u0438\u0434\u0430\u0442\u043E\u0432 (\u0441\u0438\u043D\u0442\u0435\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439 MLP; \u043C\u0430\u0441\u0448\u0442\u0430\u0431 \u043D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u0435\u043D)";
  }
  var makeButton = (text2, fn) => {
    const b = node("button", text2);
    b.type = "button";
    b.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      fn(event);
    });
    return b;
  };
  function initLocalOrdersOverlay() {
    if (!isAllowedTestOrderPage()) {
      alert("Vision Check: \u0437\u0430\u043F\u0443\u0441\u043A \u0442\u043E\u043B\u044C\u043A\u043E \u043D\u0430 http://psk.testgifts.local/devorders");
      return false;
    }
    const prior = window.__visionLocalOrderOverlay;
    if (prior?.close) {
      prior.close();
      return true;
    }
    document.getElementById(ID)?.remove();
    document.getElementById(STYLE_ID)?.remove();
    const style = node("style");
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.append(style);
    const panel = node("section");
    panel.id = ID;
    panel.setAttribute("aria-label", "Vision Check \u2014 \u0442\u0430\u0431\u043B\u0438\u0446\u0430 \u0442\u0435\u0441\u0442\u043E\u0432\u044B\u0445 \u0437\u0430\u043A\u0430\u0437\u043E\u0432");
    const title = node("h2", "Vision Check v0.1.15 \xB7 \u0442\u0435\u0441\u0442\u043E\u0432\u044B\u0435 \u0437\u0430\u043A\u0430\u0437\u044B");
    const description = node(
      "p",
      "\u0422\u043E\u043B\u044C\u043A\u043E \u043B\u043E\u043A\u0430\u043B\u044C\u043D\u0430\u044F \u0441\u0435\u0442\u044C. \u0421\u0441\u044B\u043B\u043A\u0438 \u043D\u0430 \u043C\u0430\u043A\u0435\u0442\u044B \u0437\u0430\u0433\u0440\u0443\u0436\u0430\u044E\u0442\u0441\u044F \u0432 \u043F\u0430\u043C\u044F\u0442\u044C \u0431\u0440\u0430\u0443\u0437\u0435\u0440\u0430 \u043F\u043E\u0441\u043B\u0435 \u0432\u0430\u0448\u0435\u0433\u043E \u043D\u0430\u0436\u0430\u0442\u0438\u044F; \u0444\u0430\u0439\u043B\u044B \u043D\u0435 \u043E\u0442\u043F\u0440\u0430\u0432\u043B\u044F\u044E\u0442\u0441\u044F \u043D\u0430 GitHub."
    );
    const actions = node("div", void 0, "vlo-actions");
    const stats = node("div", "\u041F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u043A\u0430 \u043F\u043E\u0438\u0441\u043A\u0430 \u0441\u0442\u0440\u043E\u043A\u2026", "vlo-stats");
    stats.setAttribute("role", "status");
    const warning = node("p", "\u042D\u0442\u043E \u0438\u0441\u0441\u043B\u0435\u0434\u043E\u0432\u0430\u0442\u0435\u043B\u044C\u0441\u043A\u0438\u0439 \u0430\u043D\u0430\u043B\u0438\u0437, \u043D\u0435 \u0434\u043E\u043F\u0443\u0441\u043A \u043A \u043F\u0435\u0447\u0430\u0442\u0438. \u041D\u0435\u0442 \u043D\u0430\u0439\u0434\u0435\u043D\u043D\u044B\u0445 \u043C\u0435\u0441\u0442 \u2260 \u043C\u0430\u043A\u0435\u0442 \u0433\u043E\u0434\u0435\u043D. PDF \u0438 \u0441\u043B\u043E\u0436\u043D\u044B\u0435 \u0432\u0435\u043A\u0442\u043E\u0440\u044B: MANUAL. \u041B\u043E\u043A\u0430\u043B\u044C\u043D\u044B\u0439 ZIP \u0441\u043E\u0434\u0435\u0440\u0436\u0438\u0442 \u0438\u0441\u0445\u043E\u0434\u043D\u044B\u0435 \u0442\u0435\u0441\u0442\u043E\u0432\u044B\u0435 \u0444\u0430\u0439\u043B\u044B \u2014 \u043D\u0435 \u043F\u0443\u0431\u043B\u0438\u043A\u0443\u0439\u0442\u0435 \u0435\u0433\u043E.", "vlo-note");
    let rows = [], busy = false, closed = false, pauseRequested = false, nextRowIndex = 0;
    function close2() {
      closed = true;
      pauseRequested = true;
      rangeController.requestStop();
      fileController.requestStop();
      panel.remove();
      style.remove();
      document.querySelectorAll("[data-vision-order-cell]").forEach((n) => n.remove());
      if (window.__visionLocalOrderOverlay?.close === close2)
        delete window.__visionLocalOrderOverlay;
    }
    function localReport() {
      return {
        schema: "printcheck.vision.local-order-feedback.v1",
        scope: "anonymous_local_test_only",
        created_at: (/* @__PURE__ */ new Date()).toISOString(),
        host: LOCAL_ORDERS.host,
        transport_kind: typeof globalThis.__visionLocalTrustedTransport === "function" ? "mv3_background" : "browser_fetch",
        source_artwork_included: false,
        order_urls_included: false,
        raw_artwork_bytes_included: false,
        private_discussion_text_included: false,
        private_discussion_attachment_urls_included: false,
        production_approved: false,
        real_world_accuracy_verified: false,
        rows: rows.map((r) => ({
          row_index: r.row_index,
          discovered_links: r.anchors.length,
          same_origin_files: r.files.length,
          order_card_discovered: r.hasOrderLink,
          analysis_complete: r.scanAttempted === true,
          pending_file_count: r.partial ? Math.max(0, r.partial.candidates.length - r.partial.nextIndex) : 0,
          customer_uploaded_artworks: r.orderUploads?.length ?? null,
          constructor_template_count: r.orderTemplates ?? null,
          discussion_probe: r.discussionProbe || { status: "NOT_SCANNED", training_ready: false },
          excluded_links: r.local_only_excluded,
          expert_label: r.grade?.value || "unreviewed",
          artifacts: (r.results || []).map((result, i) => ({
            file_index: i + 1,
            type: result.type,
            status: result.status,
            reason: result.reason || null,
            stage: result.stage || null,
            origin_relation: result.origin_relation || null,
            failure_class: result.failure_class || null,
            http_status: result.http_status ?? null,
            reference_state: result.reference_state || null,
            reference_recheck_failure_class: result.reference_recheck_failure_class || null,
            fetch_exception_family: result.fetch_exception_family || null,
            transport_error: result.transport_error || null,
            detected_regions: result.detected_regions ?? null,
            source_shape_count: result.source_shape_count ?? null,
            min_line_document_mm: Number.isFinite(result.min_line_document_mm) ? result.min_line_document_mm : null,
            min_gap_document_mm: Number.isFinite(result.min_gap_document_mm) ? result.min_gap_document_mm : null,
            production_approved: false
          }))
        }))
      };
    }
    function saveReport() {
      const u = URL.createObjectURL(new Blob([JSON.stringify(localReport(), null, 2) + "\n"], { type: "application/json" }));
      const a = node("a");
      a.href = u;
      a.download = "vision-local-test-order-review.json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(u), 1e3);
    }
    const refreshBtn = makeButton("\u041D\u0430\u0439\u0442\u0438 \u0441\u0442\u0440\u043E\u043A\u0438", refresh);
    const scanBtn = makeButton("\u041F\u0440\u043E\u0432\u0435\u0440\u0438\u0442\u044C \u0432\u0441\u0435 \u0437\u0430\u043A\u0430\u0437\u044B", () => scanAll());
    const pauseBtn = makeButton("\u041E\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0442\u044C \u043F\u043E\u0441\u043B\u0435 \u0444\u0430\u0439\u043B\u0430", () => {
      if (!busy || closed) return;
      pauseRequested = true;
      pauseBtn.disabled = true;
      renderStats("\u041E\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0430 \u0437\u0430\u043F\u0440\u043E\u0448\u0435\u043D\u0430: \u0442\u0435\u043A\u0443\u0449\u0438\u0439 \u0444\u0430\u0439\u043B \u0437\u0430\u0432\u0435\u0440\u0448\u0438\u0442\u0441\u044F, \u043E\u0441\u0442\u0430\u043B\u044C\u043D\u044B\u0435 \u043E\u0441\u0442\u0430\u043D\u0443\u0442\u0441\u044F \u0432 \u043E\u0447\u0435\u0440\u0435\u0434\u0438.");
    });
    pauseBtn.disabled = true;
    scanBtn.className = "vlo-start";
    const exportBtn = makeButton("\u041E\u0442\u0447\u0451\u0442 JSON", saveReport);
    const diagnosticBtn = makeButton("\u0414\u0438\u0430\u0433\u043D\u043E\u0441\u0442\u0438\u043A\u0430 \u0442\u0430\u0431\u043B\u0438\u0446\u044B", () => {
      const report = diagnoseTestOrderTable(document);
      const url = URL.createObjectURL(new Blob(
        [JSON.stringify(report, null, 2) + "\n"],
        { type: "application/json" }
      ));
      const a = node("a");
      a.href = url;
      a.download = "vision-local-table-diagnostic.json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1e3);
    });
    const discussionBtn = makeButton("\u041D\u0430\u0439\u0442\u0438 \u043E\u0431\u0441\u0443\u0436\u0434\u0435\u043D\u0438\u044F", () => scanDiscussions());
    const discussionExportBtn = makeButton("\u041E\u0431\u0441\u0443\u0436\u0434\u0435\u043D\u0438\u044F JSON", saveDiscussionReport);
    const bundleBtn = makeButton("\u041B\u043E\u043A\u0430\u043B\u044C\u043D\u044B\u0435 \u043F\u0440\u0438\u043C\u0435\u0440\u044B ZIP \u2014 \u0432\u0441\u0435", async () => {
      if (busy || closed) return;
      if (!window.confirm("\u0421\u043A\u0430\u0447\u0430\u0442\u044C \u0412\u0421\u0415 \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u044B\u0435 \u043E\u0440\u0438\u0433\u0438\u043D\u0430\u043B\u044B \u0442\u0435\u0441\u0442\u043E\u0432\u044B\u0445 \u043C\u0430\u043A\u0435\u0442\u043E\u0432 \u0432 \u043F\u043E\u0441\u043B\u0435\u0434\u043E\u0432\u0430\u0442\u0435\u043B\u044C\u043D\u044B\u0435 \u043B\u043E\u043A\u0430\u043B\u044C\u043D\u044B\u0435 ZIP-\u0447\u0430\u0441\u0442\u0438? \u0418\u043C\u0435\u043D\u0430 \u0438 \u0444\u0430\u0439\u043B\u044B \u043A\u043E\u043D\u0444\u0438\u0434\u0435\u043D\u0446\u0438\u0430\u043B\u044C\u043D\u044B; \u0431\u0440\u0430\u0443\u0437\u0435\u0440 \u043C\u043E\u0436\u0435\u0442 \u0437\u0430\u043F\u0440\u043E\u0441\u0438\u0442\u044C \u0440\u0430\u0437\u0440\u0435\u0448\u0435\u043D\u0438\u0435 \u043D\u0430 \u043D\u0435\u0441\u043A\u043E\u043B\u044C\u043A\u043E \u0437\u0430\u0433\u0440\u0443\u0437\u043E\u043A. \u0412 \u0430\u0440\u0445\u0438\u0432\u0430\u0445 \u043D\u0435\u0442 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043D\u043D\u044B\u0445 ROI \u0434\u043B\u044F \u043E\u0431\u0443\u0447\u0435\u043D\u0438\u044F. \u041D\u0415 \u0437\u0430\u0433\u0440\u0443\u0436\u0430\u0439\u0442\u0435 \u0438\u0445 \u0432 \u043F\u0443\u0431\u043B\u0438\u0447\u043D\u044B\u0439 GitHub.")) return;
      busy = true;
      bundleBtn.disabled = true;
      refreshBtn.disabled = scanBtn.disabled = true;
      let saved = 0, parts = 0, unavailable = 0;
      stats.textContent = "\u041B\u043E\u043A\u0430\u043B\u044C\u043D\u043E\u0435 \u043F\u043E\u0441\u043B\u0435\u0434\u043E\u0432\u0430\u0442\u0435\u043B\u044C\u043D\u043E\u0435 \u0447\u0442\u0435\u043D\u0438\u0435 \u0432\u0441\u0435\u0445 \u0444\u0430\u0439\u043B\u043E\u0432. \u041A\u0430\u0436\u0434\u044B\u0439 \u0430\u0440\u0445\u0438\u0432 \u043E\u0433\u0440\u0430\u043D\u0438\u0447\u0435\u043D \u0440\u0430\u0437\u043C\u0435\u0440\u043E\u043C, \u0430 \u043D\u0435 \u043E\u0431\u0449\u0438\u043C \u043A\u043E\u043B\u0438\u0447\u0435\u0441\u0442\u0432\u043E\u043C \u0444\u0430\u0439\u043B\u043E\u0432.";
      try {
        for await (const part of exportLocalDatasetParts(rows, {
          onProgress: (progress) => {
            if (!closed) stats.textContent = "\u041B\u043E\u043A\u0430\u043B\u044C\u043D\u043E\u0435 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0438\u0435 " + progress.processed + "/" + progress.total + " \xB7 \u0437\u0430\u043F\u0438\u0441\u0430\u043D\u043E " + progress.saved + " \xB7 \u0447\u0430\u0441\u0442\u044C " + progress.part;
          }
        })) {
          if (closed) break;
          if (part.status !== "LOCAL_ZIP_READY") {
            if (!saved) renderStats("ZIP \u043D\u0435 \u0441\u0444\u043E\u0440\u043C\u0438\u0440\u043E\u0432\u0430\u043D: " + String(part.reason).slice(0, 90));
            continue;
          }
          const u = URL.createObjectURL(part.zip), a = node("a");
          a.href = u;
          a.download = "vision-private-originals-part-" + String(part.part).padStart(4, "0") + ".zip";
          document.body.append(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(u), 4e3);
          saved += part.sample_count;
          parts++;
          unavailable += part.skipped_count;
          await new Promise((resolve) => setTimeout(resolve, 180));
        }
        if (!closed && saved) renderStats("\u041B\u043E\u043A\u0430\u043B\u044C\u043D\u043E \u0432\u044B\u0433\u0440\u0443\u0436\u0435\u043D\u043E " + saved + " \u0438\u0441\u0445\u043E\u0434\u043D\u044B\u0445 \u0444\u0430\u0439\u043B\u043E\u0432 \u0432 " + parts + " ZIP-\u0447\u0430\u0441\u0442\u044F\u0445. \u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0432\u044B\u0433\u0440\u0443\u0437\u0438\u0442\u044C: " + unavailable + ". \u0411\u0440\u0430\u0443\u0437\u0435\u0440 \u043C\u043E\u0436\u0435\u0442 \u0437\u0430\u043F\u0440\u043E\u0441\u0438\u0442\u044C \u0440\u0430\u0437\u0440\u0435\u0448\u0435\u043D\u0438\u0435 \u043D\u0430 \u043C\u043D\u043E\u0433\u043E\u043A\u0440\u0430\u0442\u043D\u043E\u0435 \u0441\u043A\u0430\u0447\u0438\u0432\u0430\u043D\u0438\u0435. \u0411\u0435\u0437 \u044D\u043A\u0441\u043F\u0435\u0440\u0442\u043D\u044B\u0445 ROI \u043C\u043E\u0434\u0435\u043B\u044C \u043D\u0435 \u0434\u043E\u043E\u0431\u0443\u0447\u0430\u0435\u0442\u0441\u044F.");
      } catch {
        if (!closed) renderStats("\u0421\u0431\u043E\u0439 \u0444\u043E\u0440\u043C\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u044F ZIP. \u0423\u0436\u0435 \u0441\u043E\u0437\u0434\u0430\u043D\u043D\u044B\u0435 \u043B\u043E\u043A\u0430\u043B\u044C\u043D\u044B\u0435 \u0447\u0430\u0441\u0442\u0438 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u044B; \u0434\u0430\u043D\u043D\u044B\u0435 \u043D\u0430\u0440\u0443\u0436\u0443 \u043D\u0435 \u043F\u0435\u0440\u0435\u0434\u0430\u0432\u0430\u043B\u0438\u0441\u044C.");
      } finally {
        busy = false;
        bundleBtn.disabled = false;
        refreshBtn.disabled = false;
        updateBatchControls();
      }
    });
    let approvalQueueIndex = 0, approvalQueueStop = false, approvalQueueUrls = null;
    let approvalBatch = new ApprovalBatchSession(), activeBatchOrder = null;
    const rangeController = makeApprovalRangeController({
      getBusy: () => busy,
      setBusy: (value) => {
        busy = value;
        approvalQueueBtn.disabled = value;
        refreshBtn.disabled = value;
      },
      scanOrder: async (url, require_tz_approved) => {
        activeBatchOrder = new URL(url).pathname.split("/").at(-1);
        try {
          return await chrome.runtime.sendMessage({
            op: "vision-approval-order-queue-v1",
            order_url: url,
            require_tz_approved: require_tz_approved === true
          });
        } finally {
          activeBatchOrder = null;
        }
      },
      isClosed: () => closed,
      refreshControls: () => {
        refreshBtn.disabled = busy;
        updateBatchControls();
      }
    });
    const fileController = makeApprovalFileListController({
      getBusy: () => busy,
      setBusy: (value) => {
        busy = value;
        approvalQueueBtn.disabled = value;
        refreshBtn.disabled = value;
      },
      scanOrder: async (url, require_tz_approved) => {
        activeBatchOrder = new URL(url).pathname.split("/").at(-1);
        try {
          return await chrome.runtime.sendMessage({
            op: "vision-approval-order-queue-v1",
            order_url: url,
            require_tz_approved: require_tz_approved === true
          });
        } finally {
          activeBatchOrder = null;
        }
      },
      isClosed: () => closed,
      refreshControls: () => {
        refreshBtn.disabled = busy;
        updateBatchControls();
      }
    });
    if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener((message, sender, respond) => {
        if (message?.op !== "vision-engine-command-v1") return false;
        if (sender?.id !== chrome.runtime.id || closed) return false;
        const kind = message.mode, action = message.action;
        if (!["file", "range"].includes(kind) || !["status", "import", "start", "pause", "stop", "reset", "save", "export", "delay"].includes(action) || kind === "range" && action === "import") {
          respond({ status: "VISION_ENGINE_COMMAND_DENIED" });
          return false;
        }
        const target = kind === "file" ? fileController : rangeController;
        target.remote(action, message.payload || {}).then(respond, (error) => respond({
          status: "VISION_ENGINE_COMMAND_FAILED",
          reason: String(error?.message || "UNKNOWN").slice(0, 120)
        }));
        return true;
      });
    }
    let preparedBundle = null;
    function downloadApprovalBatch() {
      if (!preparedBundle) return;
      const uri = URL.createObjectURL(preparedBundle.blob), a = node("a");
      a.href = uri;
      a.download = "vision-ai-approvals-" + (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-") + ".zip";
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(uri), 6e4);
    }
    const approvalZipBtn = makeButton("\u0421\u043A\u0430\u0447\u0430\u0442\u044C \u0435\u0434\u0438\u043D\u044B\u0439 \u0430\u0440\u0445\u0438\u0432 ZIP", () => {
      if (!preparedBundle) return;
      downloadApprovalBatch();
      renderStats("\u0415\u0434\u0438\u043D\u044B\u0439 ZIP \u043F\u043E\u0432\u0442\u043E\u0440\u043D\u043E \u043D\u0430\u043F\u0440\u0430\u0432\u043B\u0435\u043D \u0432 \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0438 Chrome. \u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u0438\u0435.");
    });
    approvalZipBtn.disabled = true;
    if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener((message, sender, respond) => {
        if (message?.op !== "vision-approval-batch-accept-v1") return false;
        if (sender?.id !== chrome.runtime.id || !activeBatchOrder || closed) {
          respond({ status: "MANUAL_BATCH_LIST_SENDER_DENIED" });
          return false;
        }
        const recipient = rangeController.activeOrder === activeBatchOrder ? rangeController : fileController.activeOrder === activeBatchOrder ? fileController : approvalBatch;
        respond(recipient.receive(message, activeBatchOrder));
        return false;
      });
    }
    const approvalQueueReports = [];
    const approvalQueueBtn = makeButton("\u0421\u043E\u0431\u0440\u0430\u0442\u044C \u0441\u043E\u0433\u043B\u0430\u0441\u043E\u0432\u0430\u043D\u0438\u044F \u0438\u0437 \u0432\u0441\u0435\u0445 \u0437\u0430\u043A\u0430\u0437\u043E\u0432 (\u043E\u0434\u0438\u043D ZIP)", () => {
      void collectFromOrdersList();
    });
    const approvalQueueStopBtn = makeButton("\u041E\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0442\u044C \u0441\u043E\u0433\u043B\u0430\u0441\u043E\u0432\u0430\u043D\u0438\u044F", () => {
      approvalQueueStop = true;
      renderStats("\u041E\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0430 \u0437\u0430\u043F\u0440\u043E\u0448\u0435\u043D\u0430; \u0442\u0435\u043A\u0443\u0449\u0438\u0439 \u0437\u0430\u043A\u0430\u0437 \u0437\u0430\u0432\u0435\u0440\u0448\u0430\u0435\u0442\u0441\u044F \u0431\u0435\u0437\u043E\u043F\u0430\u0441\u043D\u043E.");
    });
    const approvalQueueDiagBtn = makeButton("\u041E\u0442\u0447\u0451\u0442 \u0441\u043E\u0433\u043B\u0430\u0441\u043E\u0432\u0430\u043D\u0438\u0439 JSON", () => {
      const data = {
        schema: "printcheck.vision.anonymous-list-approval-queue.v1",
        orders_attempted: approvalQueueReports.length,
        totals: approvalQueueReports.reduce((total, r) => {
          for (const key of ["eligible_articles", "verified_articles", "files", "zip_parts", "failures"])
            total[key] += r[key] || 0;
          return total;
        }, { eligible_articles: 0, verified_articles: 0, files: 0, zip_parts: 0, failures: 0 }),
        results: approvalQueueReports.map((r, i) => ({
          row_index: i + 1,
          status: r.status,
          eligible_articles: r.eligible_articles || 0,
          verified_articles: r.verified_articles || 0,
          files: r.files || 0,
          zip_parts: r.zip_parts || 0,
          failures: r.failures || 0,
          private_text_saved: r.private_text_saved === true,
          final_evidence_saved: r.final_evidence_saved === true,
          raw_evidence_saved: r.raw_evidence_saved === true
        })),
        raw_text_included: false,
        order_ids_included: false,
        attachment_names_or_urls_included: false,
        training_ready: false
      };
      const uri = URL.createObjectURL(new Blob(
        [JSON.stringify(data, null, 2) + "\n"],
        { type: "application/json" }
      ));
      const a = node("a");
      a.href = uri;
      a.download = "vision-anonymous-approval-queue.json";
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(uri), 2e3);
    });
    approvalQueueStopBtn.disabled = true;
    async function collectFromOrdersList() {
      if (busy || closed) return;
      if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) {
        renderStats("MANUAL: \u0434\u043B\u044F \u0447\u0442\u0435\u043D\u0438\u044F \u0448\u0442\u0430\u0442\u043D\u044B\u0445 \u0441\u043E\u0433\u043B\u0430\u0441\u043E\u0432\u0430\u043D\u0438\u0439 \u0442\u0440\u0435\u0431\u0443\u0435\u0442\u0441\u044F \u0440\u0430\u0441\u0448\u0438\u0440\u0435\u043D\u0438\u0435 Chrome MV3.");
        return;
      }
      busy = true;
      approvalQueueStop = false;
      approvalQueueBtn.disabled = true;
      approvalQueueStopBtn.disabled = false;
      refreshBtn.disabled = scanBtn.disabled = discussionBtn.disabled = true;
      pauseBtn.disabled = true;
      const ordered = /* @__PURE__ */ new Map();
      for (const row of rows) {
        const target = rowOrderTarget(row.element, window.location.href);
        if (target.status === "ORDER_LINK_FOUND" && target.url?.origin === "http://testgifts.local" && /^\/private\/order\/[0-9]{5,12}$/.test(target.url.pathname) && !target.url.search && !target.url.hash)
          ordered.set(target.url.href, target.url.href);
      }
      if (!approvalQueueUrls || approvalQueueIndex === 0)
        approvalQueueUrls = [...ordered.values()];
      const urls = approvalQueueUrls;
      if (!urls.length) {
        busy = false;
        approvalQueueBtn.disabled = false;
        approvalQueueStopBtn.disabled = true;
        refreshBtn.disabled = false;
        updateBatchControls();
        renderStats("MANUAL: \u0432 \u0442\u0430\u0431\u043B\u0438\u0446\u0435 \u043D\u0435\u0442 \u0442\u043E\u0447\u043D\u044B\u0445 \u0441\u0441\u044B\u043B\u043E\u043A \u043D\u0430 \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0438 \u0440\u0430\u0437\u0440\u0435\u0448\u0451\u043D\u043D\u044B\u0445 \u0437\u0430\u043A\u0430\u0437\u043E\u0432.");
        return;
      }
      let done = 0, verified = 0, imagesAndFiles = 0, errors = 0, finalSaved = 0, rawOnly = 0, textFailures = 0;
      if (approvalQueueIndex === 0) {
        approvalBatch = new ApprovalBatchSession();
        preparedBundle = null;
        approvalZipBtn.disabled = true;
      }
      try {
        while (approvalQueueIndex < urls.length && !closed && !approvalQueueStop) {
          const url = urls[approvalQueueIndex];
          renderStats("\u0421\u043E\u0433\u043B\u0430\u0441\u043E\u0432\u0430\u043D\u0438\u044F \u0438\u0437 \u0441\u043F\u0438\u0441\u043A\u0430: " + done + " / " + urls.length + "\n\u041E\u0442\u043A\u0440\u044B\u0432\u0430\u0435\u0442\u0441\u044F \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0438\u0439 \u0437\u0430\u043A\u0430\u0437 \u0432\u043E \u0432\u0440\u0435\u043C\u0435\u043D\u043D\u043E\u0439 \u0432\u043A\u043B\u0430\u0434\u043A\u0435. \u0421\u0442\u0440\u0430\u043D\u0438\u0446\u0430 \u0441\u043F\u0438\u0441\u043A\u0430 \u043E\u0441\u0442\u0430\u0451\u0442\u0441\u044F \u043E\u0442\u043A\u0440\u044B\u0442\u043E\u0439.");
          let result;
          activeBatchOrder = new URL(url).pathname.split("/").at(-1);
          try {
            result = await chrome.runtime.sendMessage({
              op: "vision-approval-order-queue-v1",
              order_url: url
            });
          } catch {
            result = { status: "MANUAL_BACKGROUND_ORDER_FAILED" };
          } finally {
            activeBatchOrder = null;
          }
          const safeStatus = /^[A-Z0-9_]{3,70}$/.test(result?.status || "") ? result.status : "MANUAL_UNKNOWN_RESULT";
          const num = (x) => Number.isSafeInteger(x) && x >= 0 && x <= 1e4 ? x : 0;
          const entry = {
            order_number: new URL(url).pathname.split("/").at(-1),
            status: safeStatus,
            eligible_articles: num(result?.eligible_articles),
            verified_articles: num(result?.verified_articles),
            files: num(result?.files),
            zip_parts: num(result?.zip_parts),
            failures: num(result?.failures),
            private_text_saved: result?.private_text_saved === true,
            final_evidence_saved: result?.final_evidence_saved === true,
            raw_evidence_saved: result?.raw_evidence_saved === true
          };
          approvalQueueReports.push(entry);
          approvalQueueIndex++;
          done++;
          verified += entry.verified_articles;
          imagesAndFiles += entry.files;
          if (safeStatus.startsWith("MANUAL")) errors++;
          if (entry.final_evidence_saved) finalSaved++;
          else if (entry.raw_evidence_saved) rawOnly++;
          else textFailures++;
          renderStats("\u0421\u043E\u0433\u043B\u0430\u0441\u043E\u0432\u0430\u043D\u0438\u044F \u0438\u0437 \u0441\u043F\u0438\u0441\u043A\u0430: " + approvalQueueIndex + " / " + urls.length + "\n\u041F\u0440\u043E\u0447\u0438\u0442\u0430\u043D\u043E \u043E\u0431\u0441\u0443\u0436\u0434\u0435\u043D\u0438\u0439: " + verified + " \xB7 \u0432\u043B\u043E\u0436\u0435\u043D\u0438\u0439: " + imagesAndFiles + " \xB7 \u0438\u0442\u043E\u0433\u043E\u0432\u044B\u0445 JSON: " + finalSaved + " \xB7 \u0442\u043E\u043B\u044C\u043A\u043E \u0440\u0435\u0437\u0435\u0440\u0432\u043D\u044B\u0445 JSON: " + rawOnly + " \xB7 \u0431\u0435\u0437 \u043F\u0435\u0440\u0435\u043F\u0438\u0441\u043A\u0438: " + textFailures + " \xB7 \u0440\u0443\u0447\u043D\u044B\u0445 \u043F\u0440\u043E\u0432\u0435\u0440\u043E\u043A: " + errors + "\n\u0422\u0435\u043A\u0441\u0442\u044B, \u0438\u043C\u0435\u043D\u0430, \u043F\u0440\u043E\u0431\u043B\u0435\u043C\u044B, \u0430\u0440\u0442\u0438\u043A\u0443\u043B\u044B \u0438 \u0441\u0432\u0435\u0434\u0435\u043D\u0438\u044F \u0437\u0430\u043A\u0430\u0437\u0430 \u2014 \u0432 JSON; \u0432\u043B\u043E\u0436\u0435\u043D\u0438\u044F \u2014 \u0432 ZIP.");
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        let finalStatus = "";
        if (approvalQueueIndex === urls.length && !approvalQueueStop && !closed) {
          try {
            preparedBundle = approvalBatch.finalize(approvalQueueReports);
            approvalZipBtn.disabled = false;
            downloadApprovalBatch();
            finalStatus = "\u0415\u0434\u0438\u043D\u044B\u0439 ZIP: " + preparedBundle.entry_count + " \u0437\u0430\u043F\u0438\u0441\u0435\u0439, " + preparedBundle.counts.with_evidence + " \u0437\u0430\u043A\u0430\u0437\u043E\u0432 \u0441 \u0434\u0430\u043D\u043D\u044B\u043C\u0438, " + preparedBundle.counts.verified_files + " \u0432\u043B\u043E\u0436\u0435\u043D\u0438\u0439, " + preparedBundle.counts.missing_files + " \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u043D\u044B\u0445 \u0444\u0430\u0439\u043B\u043E\u0432. \u0418\u043D\u0438\u0446\u0438\u0438\u0440\u043E\u0432\u0430\u043D\u0430 \u041E\u0414\u041D\u0410 \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0430; \u043F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u0435\u0451 \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u0438\u0435 \u0432 Chrome.";
          } catch (e) {
            finalStatus = "MANUAL: \u0435\u0434\u0438\u043D\u044B\u0439 ZIP \u043D\u0435 \u0441\u0444\u043E\u0440\u043C\u0438\u0440\u043E\u0432\u0430\u043D (" + String(e?.message || "UNKNOWN").slice(0, 85) + "). \u0414\u0430\u043D\u043D\u044B\u0435 \u043D\u0430\u0445\u043E\u0434\u044F\u0442\u0441\u044F \u0432 \u044D\u0442\u043E\u0439 \u0432\u043A\u043B\u0430\u0434\u043A\u0435 \u2014 \u043D\u0435 \u043E\u0431\u043D\u043E\u0432\u043B\u044F\u0439\u0442\u0435 \u0435\u0451.";
          }
        } else if (approvalQueueStop) {
          try {
            preparedBundle = approvalBatch.finalize(approvalQueueReports);
            approvalZipBtn.disabled = false;
            finalStatus = "\u041E\u0431\u0445\u043E\u0434 \u043F\u0440\u0438\u043E\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D: " + approvalQueueIndex + " / " + urls.length + ". \u041C\u043E\u0436\u043D\u043E \u0441\u043A\u0430\u0447\u0430\u0442\u044C \u0447\u0430\u0441\u0442\u0438\u0447\u043D\u044B\u0439 \u0430\u0440\u0445\u0438\u0432 \u043A\u043D\u043E\u043F\u043A\u043E\u0439 \u043B\u0438\u0431\u043E \u043F\u0440\u043E\u0434\u043E\u043B\u0436\u0438\u0442\u044C \u043E\u0431\u0445\u043E\u0434.";
          } catch (e) {
            finalStatus = "\u041F\u0430\u0443\u0437\u0430: \u0430\u0440\u0445\u0438\u0432 \u043D\u0435 \u0433\u043E\u0442\u043E\u0432 (" + String(e?.message || "UNKNOWN").slice(0, 80) + ").";
          }
        }
        if (!closed) renderStats(finalStatus || "MANUAL: \u0430\u0440\u0445\u0438\u0432 \u043D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043D.");
      } finally {
        busy = false;
        approvalQueueBtn.disabled = false;
        approvalQueueStopBtn.disabled = true;
        refreshBtn.disabled = false;
        updateBatchControls();
      }
    }
    actions.append(
      rangeController.element,
      fileController.element,
      approvalQueueBtn,
      approvalQueueStopBtn,
      approvalZipBtn,
      approvalQueueDiagBtn,
      refreshBtn,
      scanBtn,
      discussionBtn,
      pauseBtn,
      exportBtn,
      discussionExportBtn,
      diagnosticBtn,
      bundleBtn,
      makeButton("\u0417\u0430\u043A\u0440\u044B\u0442\u044C", close2)
    );
    panel.append(title, description, actions, stats, warning);
    document.body.append(panel);
    window.__visionLocalOrderOverlay = { close: close2, refresh, version: "0.1.13" };
    function renderStats(msg) {
      const discovered = rows.reduce((n, r) => n + r.anchors.length, 0);
      const local = rows.reduce((n, r) => n + (r.orderUploads?.length ?? r.files.length), 0);
      const completed = rows.reduce((n, r) => n + (r.results?.length || 0), 0);
      const scanned = rows.filter((r) => r.scanAttempted).length;
      const linked = rows.filter((r) => r.hasOrderLink).length;
      stats.textContent = "\u0421\u0442\u0440\u043E\u043A: " + rows.length + " \xB7 \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0438: " + linked + " \xB7 \u043E\u0431\u0440\u0430\u0431\u043E\u0442\u0430\u043D\u043E \u0441\u0442\u0440\u043E\u043A: " + scanned + " \xB7 \u0444\u0430\u0439\u043B\u043E\u0432/\u043E\u0442\u043A\u0430\u0437\u043E\u0432: " + completed + " \xB7 \u0432\u043B\u043E\u0436\u0435\u043D\u0438\u0439 \u043D\u0430\u0439\u0434\u0435\u043D\u043E: " + local + " \xB7 \u043E\u0447\u0435\u0440\u0435\u0434\u044C \u0431\u0435\u0437 \u043B\u0438\u043C\u0438\u0442\u0430 \u0444\u0430\u0439\u043B\u043E\u0432\n\u0422\u0440\u0430\u043D\u0441\u043F\u043E\u0440\u0442: " + (typeof globalThis.__visionLocalTrustedTransport === "function" ? "\u043B\u043E\u043A\u0430\u043B\u044C\u043D\u044B\u0439 MV3 (\u0442\u0435\u0441\u0442\u043E\u0432\u044B\u0435 \u0445\u043E\u0441\u0442\u044B \u0437\u0430\u043A\u0430\u0437\u043E\u0432 \u0438 \u0432\u043B\u043E\u0436\u0435\u043D\u0438\u0439)" : "\u043E\u0431\u044B\u0447\u043D\u044B\u0439 \u0431\u0440\u0430\u0443\u0437\u0435\u0440\u043D\u044B\u0439 fetch; \u043F\u0435\u0440\u0435\u0445\u043E\u0434 \u043D\u0430 \u0434\u0440\u0443\u0433\u043E\u0439 \u0445\u043E\u0441\u0442 \u043C\u043E\u0436\u0435\u0442 \u0431\u043B\u043E\u043A\u0438\u0440\u043E\u0432\u0430\u0442\u044C\u0441\u044F") + "\n" + (msg || "\u041D\u0430\u0436\u043C\u0438\u0442\u0435 \xAB\u041F\u0440\u043E\u0432\u0435\u0440\u0438\u0442\u044C \u043C\u0430\u043A\u0435\u0442\u044B\xBB.");
    }
    function refresh() {
      if (busy || closed) return;
      document.querySelectorAll("[data-vision-order-cell]").forEach((n) => n.remove());
      rows = discoverOrderRows(document);
      nextRowIndex = 0;
      approvalQueueIndex = 0;
      approvalQueueReports.length = 0;
      approvalQueueUrls = null;
      approvalBatch = new ApprovalBatchSession();
      preparedBundle = null;
      approvalZipBtn.disabled = true;
      pauseRequested = false;
      for (const r of rows) {
        const cell = node(
          r.element.tagName === "TR" ? "td" : "div",
          void 0,
          "vision-order-result-cell"
        );
        cell.setAttribute("data-vision-order-cell", "");
        for (const eventName of ["click", "dblclick", "pointerdown", "mousedown", "keydown"])
          cell.addEventListener(eventName, (event) => event.stopPropagation());
        const label = node("span", "Vision: \u043D\u0435 \u043F\u0440\u043E\u0432\u0435\u0440\u0435\u043D\u043E", "vlo-label");
        const target = rowOrderTarget(r.element, window.location.href);
        r.hasOrderLink = target.status === "ORDER_LINK_FOUND" && !(target.source === "numeric_first_cell" && r.anchors.length > 0);
        const detail = node(
          "span",
          r.hasOrderLink ? "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430 \u043C\u0430\u043A\u0435\u0442\u043E\u0432 \u0438\u0437 \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0438 \u0437\u0430\u043A\u0430\u0437\u0430 \u2192 \xAB\u041C\u0430\u043A\u0435\u0442\u044B \u0434\u043B\u044F \u0437\u0430\u043A\u0430\u0437\u0430\xBB" : r.anchors.length > 0 ? "\u041E\u0431\u043D\u0430\u0440\u0443\u0436\u0435\u043D\u044B \u0441\u0441\u044B\u043B\u043A\u0438 \u0432 \u0441\u0442\u0440\u043E\u043A\u0435; \u043F\u0440\u043E\u0432\u0435\u0440\u044E \u0440\u0435\u0437\u0435\u0440\u0432\u043D\u044B\u0439 \u043C\u0430\u0440\u0448\u0440\u0443\u0442" : "\u041D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D \u043F\u0435\u0440\u0435\u0445\u043E\u0434 \u0432 \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0443 \u0437\u0430\u043A\u0430\u0437\u0430",
          "vlo-detail"
        );
        const fileNames = node("details", void 0, "vlo-files");
        fileNames.hidden = true;
        const trigger = makeButton("\u041F\u0440\u043E\u0432\u0435\u0440\u0438\u0442\u044C \u0441\u0442\u0440\u043E\u043A\u0443", () => scanRow(r));
        const gradeLabel = node("label", "\u041C\u0435\u0442\u043A\u0430 \u0442\u0435\u0445\u043D\u043E\u043B\u043E\u0433\u0430: ");
        gradeLabel.setAttribute("data-vlo-grade", "");
        const grade = node("select");
        for (const [value, text2] of [
          ["unreviewed", "\u041D\u0435 \u0440\u0430\u0437\u043C\u0435\u0447\u0435\u043D\u043E"],
          ["confirmed_defect", "\u041F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043D \u0434\u0435\u0444\u0435\u043A\u0442"],
          ["false_positive", "\u041B\u043E\u0436\u043D\u043E\u0435 \u0441\u0440\u0430\u0431\u0430\u0442\u044B\u0432\u0430\u043D\u0438\u0435"],
          ["missed_defect", "\u041F\u0440\u043E\u043F\u0443\u0449\u0435\u043D \u0434\u0435\u0444\u0435\u043A\u0442"],
          ["expert_clear", "\u041F\u0440\u043E\u0432\u0435\u0440\u0435\u043D\u043E \u0432\u0440\u0443\u0447\u043D\u0443\u044E"]
        ]) {
          const option = node("option", text2);
          option.value = value;
          grade.append(option);
        }
        gradeLabel.append(grade);
        r.grade = grade;
        cell.append(label, detail, fileNames, trigger, gradeLabel);
        r.element.append(cell);
        r.label = label;
        r.detail = detail;
        r.button = trigger;
        r.fileNames = fileNames;
      }
      updateBatchControls();
      renderStats(rows.length ? "\u041E\u0447\u0435\u0440\u0435\u0434\u044C \u0432\u0441\u0435\u0445 \u0437\u0430\u043A\u0430\u0437\u043E\u0432 \u0437\u0430\u043F\u0443\u0441\u043A\u0430\u0435\u0442\u0441\u044F \u0432\u0440\u0443\u0447\u043D\u0443\u044E, \u0444\u0430\u0439\u043B\u044B \u043F\u0440\u043E\u0432\u0435\u0440\u044F\u044E\u0442\u0441\u044F \u0441\u0442\u0440\u043E\u0433\u043E \u043F\u043E \u043E\u0434\u043D\u043E\u043C\u0443." : "\u0421\u0442\u0440\u043E\u043A\u0438 \u043D\u0435 \u0440\u0430\u0441\u043F\u043E\u0437\u043D\u0430\u043D\u044B. \u0422\u0440\u0435\u0431\u0443\u0435\u0442\u0441\u044F \u0430\u0434\u0430\u043F\u0442\u0435\u0440 \u043A DOM \u0442\u0435\u0441\u0442\u043E\u0432\u043E\u0439 \u0442\u0430\u0431\u043B\u0438\u0446\u044B; \u0444\u0430\u0439\u043B\u043E\u0432\u044B\u0435 \u0437\u0430\u043F\u0440\u043E\u0441\u044B \u043D\u0435 \u0432\u044B\u043F\u043E\u043B\u043D\u044F\u043B\u0438\u0441\u044C.");
    }
    async function scanRowContents(r) {
      r.scanAttempted = false;
      r.button.disabled = true;
      r.label.textContent = "Vision: \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0430 \u0437\u0430\u043A\u0430\u0437\u0430 \u2192 \u043C\u0430\u043A\u0435\u0442\u044B\u2026";
      if (!r.partial) r.results = [];
      let manual2 = r.partial?.manual || 0, research = r.partial?.research || 0, desc = r.partial?.descriptions || [];
      let candidates = r.partial?.candidates || [], fromOrder = r.partial?.fromOrder || false;
      if (r.partial) {
      } else if (r.hasOrderLink) {
        const detail = await inspectOrderPageFromRow(r.element);
        if (closed) return;
        if (detail.status !== "ORDER_DETAIL_DISCOVERED") {
          r.label.textContent = "Vision: \u0440\u0443\u0447\u043D\u0430\u044F \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0430";
          r.detail.textContent = "\u041A\u0430\u0440\u0442\u043E\u0447\u043A\u0430 \u0437\u0430\u043A\u0430\u0437\u0430 / \u043E\u043A\u043D\u043E \u043C\u0430\u043A\u0435\u0442\u043E\u0432: " + String(detail.reason || "\u043D\u0435 \u043F\u0440\u043E\u0447\u0438\u0442\u0430\u043D\u043E").slice(0, 120) + (detail.stage ? " \xB7 \u044D\u0442\u0430\u043F " + detail.stage : "") + (detail.origin_relation ? " \xB7 " + detail.origin_relation : "");
          r.results.push({
            type: "order",
            status: "MANUAL",
            reason: detail.reason || "ORDER_DETAIL_UNAVAILABLE",
            stage: detail.stage || null,
            origin_relation: detail.origin_relation || null,
            failure_class: detail.failure_class || null,
            http_status: detail.http_status ?? null,
            fetch_exception_family: detail.fetch_exception_family || null
          });
          r.scanAttempted = true;
          r.button.disabled = false;
          renderStats("\u041D\u0443\u0436\u0435\u043D \u0434\u043E\u0441\u0442\u0443\u043F \u043A \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0435 \u0437\u0430\u043A\u0430\u0437\u0430 \u0438 AJAX \u043E\u043A\u043D\u0443");
          return;
        }
        fromOrder = true;
        r.orderUploads = detail.uploads;
        r.orderTemplates = detail.templates.length;
        if (!detail.uploads.length) {
          r.label.textContent = "Vision: \u0440\u0443\u0447\u043D\u0430\u044F \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0430";
          r.detail.textContent = "\u0412 \u043E\u043A\u043D\u0435 \xAB\u041C\u0430\u043A\u0435\u0442\u044B \u0434\u043B\u044F \u0437\u0430\u043A\u0430\u0437\u0430\xBB \u043E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0443\u044E\u0442 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043D\u043D\u044B\u0435 \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0438 \u043A\u043B\u0438\u0435\u043D\u0442\u0430; \u043D\u0430\u0439\u0434\u0435\u043D\u043E \u043A\u043E\u043D\u0441\u0442\u0440\u0443\u043A\u0442\u043E\u0440\u043E\u0432: " + detail.templates.length;
          r.results.push({
            type: "order",
            status: "MANUAL",
            reason: "CUSTOMER_UPLOADS_NOT_FOUND"
          });
          r.scanAttempted = true;
          r.button.disabled = false;
          renderStats("\u041A\u043E\u043D\u0441\u0442\u0440\u0443\u043A\u0442\u043E\u0440\u044B \u043D\u0435 \u044F\u0432\u043B\u044F\u044E\u0442\u0441\u044F \u0438\u0441\u0445\u043E\u0434\u043D\u044B\u043C\u0438 \u043C\u0430\u043A\u0435\u0442\u0430\u043C\u0438 \u043A\u043B\u0438\u0435\u043D\u0442\u0430");
          return;
        }
        candidates = detail.uploads;
        r.fileNames.replaceChildren(node("summary", "\u041E\u0440\u0438\u0433\u0438\u043D\u0430\u043B\u044C\u043D\u044B\u0435 \u0438\u043C\u0435\u043D\u0430 (" + detail.uploads.length + ")"));
        for (const upload of detail.uploads) {
          r.fileNames.append(node("div", upload.originalFilename ?? upload.filename, "vlo-filename"));
        }
        r.fileNames.hidden = false;
        r.detail.textContent = "\u0417\u0430\u0433\u0440\u0443\u0436\u0435\u043D\u043E \u0437\u0430\u043A\u0430\u0437\u0447\u0438\u043A\u043E\u043C: " + detail.uploads.length + "; \u043A\u043E\u043D\u0441\u0442\u0440\u0443\u043A\u0442\u043E\u0440\u043E\u0432: " + detail.templates.length;
      } else {
        candidates = r.files;
        if (!candidates.length) {
          r.label.textContent = "Vision: \u0440\u0443\u0447\u043D\u0430\u044F \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0430";
          r.detail.textContent = "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043D\u0430\u0439\u0442\u0438 \u0431\u0435\u0437\u043E\u043F\u0430\u0441\u043D\u0443\u044E \u0441\u0441\u044B\u043B\u043A\u0443 \u043D\u0430 \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0443 \u0437\u0430\u043A\u0430\u0437\u0430";
          r.results.push({
            type: "order",
            status: "MANUAL",
            reason: "ORDER_DETAIL_LINK_REQUIRED"
          });
          r.scanAttempted = true;
          r.button.disabled = false;
          renderStats("\u041D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D \u043F\u0435\u0440\u0435\u0445\u043E\u0434 \u043D\u0430 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0443 \u0437\u0430\u043A\u0430\u0437\u0430");
          return;
        }
      }
      const total = candidates.length;
      let popup404Recheck = null;
      for (let i = r.partial?.nextIndex || 0; i < total; i++) {
        if (closed) return;
        if (pauseRequested) {
          r.partial = {
            candidates,
            fromOrder,
            nextIndex: i,
            manual: manual2,
            research,
            descriptions: desc
          };
          r.label.textContent = "Vision: \u043E\u0447\u0435\u0440\u0435\u0434\u044C \u043E\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u0430, \u043C\u043E\u0436\u043D\u043E \u043F\u0440\u043E\u0434\u043E\u043B\u0436\u0438\u0442\u044C";
          r.detail.textContent = "\u041F\u0440\u043E\u0432\u0435\u0440\u0435\u043D\u043E " + i + " \u0438\u0437 " + total + " \u0432\u043B\u043E\u0436\u0435\u043D\u0438\u0439. \u041F\u0440\u0438 \u043F\u0440\u043E\u0434\u043E\u043B\u0436\u0435\u043D\u0438\u0438 \u0443\u0436\u0435 \u043E\u0431\u0440\u0430\u0431\u043E\u0442\u0430\u043D\u043D\u044B\u0435 \u0444\u0430\u0439\u043B\u044B \u043D\u0435 \u0441\u043A\u0430\u0447\u0438\u0432\u0430\u044E\u0442\u0441\u044F \u043F\u043E\u0432\u0442\u043E\u0440\u043D\u043E.";
          r.button.disabled = false;
          renderStats("\u041E\u0447\u0435\u0440\u0435\u0434\u044C \u043E\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u0430. \u0421\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u0435 \u0442\u0435\u043A\u0443\u0449\u0435\u0433\u043E \u0437\u0430\u043A\u0430\u0437\u0430 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u043E \u0432 \u043F\u0430\u043C\u044F\u0442\u0438 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u044B.");
          return;
        }
        const a = candidates[i];
        let result;
        try {
          if (fromOrder) {
            const artifact = await fetchOrderResourceBytes(a);
            result = artifact.status === "LOCAL_BYTES_ONLY" ? await inspectOrderArtworkBytes(
              artifact.bytes,
              artifact.url,
              artifact.mime,
              a.filename
            ) : {
              status: "MANUAL",
              type: "order_artwork",
              reason: artifact.reason || "ARTWORK_DOWNLOAD_FAILED",
              stage: artifact.stage || "artwork",
              http_status: artifact.http_status ?? null,
              failure_class: artifact.failure_class || null
            };
          } else result = await inspectSameOriginArtwork(a);
        } catch {
          result = { status: "MANUAL", type: "order_artwork", reason: "ARTWORK_INSPECTION_FAILED" };
        }
        if (fromOrder && result.reason === "ARTWORK_HTTP_ERROR" && result.http_status === 404) {
          if (!popup404Recheck)
            popup404Recheck = await recheckOrderPopupReferences(candidates);
          result.reference_state = popup404Recheck.status === "REFERENCE_RECHECKED" ? popup404Recheck.listed[i] ? "STILL_LISTED_IN_POPUP" : "MISSING_FROM_POPUP" : "POPUP_RECHECK_UNAVAILABLE";
          if (result.reference_state === "POPUP_RECHECK_UNAVAILABLE")
            result.reference_recheck_failure_class = popup404Recheck.failure_class || null;
        }
        if (closed) return;
        r.results.push(result);
        desc.push(summarize(result));
        if (result.status === "MANUAL") manual2++;
        else research++;
        renderStats("\u041F\u0440\u043E\u0432\u0435\u0440\u0435\u043D\u043E \u0444\u0430\u0439\u043B\u043E\u0432 \u0432 \u0442\u0435\u043A\u0443\u0449\u0435\u043C \u0437\u0430\u043A\u0430\u0437\u0435: " + (i + 1) + "/" + total);
        if (i + 1 < total) await new Promise((resolve) => setTimeout(resolve, LOCAL_ORDERS.fetchPaceMs));
      }
      if (closed) return;
      r.partial = null;
      r.scanAttempted = true;
      if (r.local_only_excluded > 0 && !fromOrder)
        manual2++;
      r.label.textContent = manual2 ? "Vision: " + manual2 + " \u0442\u0440\u0435\u0431\u0443\u044E\u0442 \u0440\u0443\u0447\u043D\u043E\u0439 \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0438" : "Vision: " + research + " \u0438\u0441\u0441\u043B\u0435\u0434\u043E\u0432\u0430\u043D\u044B (\u043D\u0435 \u0434\u043E\u043F\u0443\u0441\u043A)";
      r.detail.textContent = (fromOrder ? "\u041A\u0430\u0440\u0442\u043E\u0447\u043A\u0430 \u0437\u0430\u043A\u0430\u0437\u0430: " + candidates.length + " \u043A\u043B\u0438\u0435\u043D\u0442\u0441\u043A\u0438\u0445 \u0444\u0430\u0439\u043B\u043E\u0432, " + r.orderTemplates + " \u043A\u043E\u043D\u0441\u0442\u0440\u0443\u043A\u0442\u043E\u0440\u043E\u0432. " : "") + desc.join(" | ").slice(0, 520);
      r.button.disabled = false;
      renderStats("\u041F\u0440\u043E\u0432\u0435\u0440\u0435\u043D\u043E \u043F\u043E \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0430\u043C \u0437\u0430\u043A\u0430\u0437\u043E\u0432. \u0412\u044B\u0432\u043E\u0434 \u043D\u0435 \u044F\u0432\u043B\u044F\u0435\u0442\u0441\u044F \u0434\u043E\u043F\u0443\u0441\u043A\u043E\u043C.");
    }
    async function scanRow(r) {
      if (busy || closed) return;
      busy = true;
      pauseRequested = false;
      refreshBtn.disabled = scanBtn.disabled = true;
      pauseBtn.disabled = false;
      try {
        await scanRowContents(r);
      } finally {
        busy = false;
        refreshBtn.disabled = false;
        updateBatchControls();
      }
    }
    function saveDiscussionReport() {
      const safe = rows.map((r) => {
        const probe = r.discussionProbe;
        if (!probe || probe.status !== "STRUCTURE_ONLY_UNVERIFIED")
          return {
            row_index: r.row_index,
            status: probe?.status || "NOT_SCANNED",
            reason: /^[A-Z0-9_]+$/.test(probe?.reason || "") ? probe.reason : null,
            training_ready: false
          };
        const fields = [
          "controls_total",
          "article_scoped_controls",
          "order_scoped_controls",
          "unresolved_scope_controls",
          "link_targets_internal_test",
          "link_targets_untrusted_or_external",
          "link_targets_fragments",
          "js_or_opaque_controls",
          "inline_thread_candidates",
          "visible_message_candidates",
          "screenshot_or_image_candidates"
        ];
        const categorical = Object.fromEntries(fields.map((field) => [field, Number.isSafeInteger(probe[field]) ? Math.min(1e4, Math.max(0, probe[field])) : 0]));
        const topics = [
          "positive_min",
          "negative_min",
          "out_of_field",
          "color",
          "font",
          "raster_resolution",
          "gradient_transparency",
          "constructor_alignment"
        ];
        return {
          row_index: r.row_index,
          status: "STRUCTURE_ONLY_UNVERIFIED",
          ...categorical,
          weak_topic_candidates: topics.filter((x) => probe.weak_topic_candidates?.includes(x)).sort(),
          discussion_content_complete: false,
          expert_label_verified: false,
          screenshot_roi_verified: false,
          training_ready: false
        };
      });
      const report = {
        schema: "printcheck.vision.anonymous-article-discussion-probe.v1",
        scope: "test_order_card_only",
        created_at: (/* @__PURE__ */ new Date()).toISOString(),
        rows_scanned: safe.filter((x) => x.status !== "NOT_SCANNED").length,
        rows: safe,
        raw_messages_included: false,
        authors_included: false,
        attachments_included: false,
        attachment_urls_included: false,
        order_identifiers_included: false,
        training_ready: false,
        note: "DOM structural heuristics only; collapsed discussion content is not fetched."
      };
      const blob = new Blob([JSON.stringify(report, null, 2) + "\n"], { type: "application/json" });
      const url = URL.createObjectURL(blob), a = node("a");
      a.href = url;
      a.download = "vision-local-discussion-probe.json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1e3);
    }
    async function scanDiscussions() {
      if (busy || closed) return;
      busy = true;
      pauseRequested = false;
      refreshBtn.disabled = scanBtn.disabled = discussionBtn.disabled = true;
      pauseBtn.disabled = false;
      let attempted = 0, markers = 0, threads = 0;
      try {
        for (const r of rows) {
          if (closed || pauseRequested) break;
          if (r.discussionProbe) continue;
          if (!r.hasOrderLink) {
            r.discussionProbe = {
              status: "MANUAL",
              reason: "ORDER_DETAIL_LINK_REQUIRED",
              training_ready: false
            };
            continue;
          }
          try {
            r.discussionProbe = await inspectOrderDiscussionFromRow(r.element);
          } catch {
            r.discussionProbe = {
              status: "MANUAL",
              reason: "DISCUSSION_SCAN_FAILED",
              training_ready: false
            };
          }
          attempted++;
          if (r.discussionProbe.status === "STRUCTURE_ONLY_UNVERIFIED") {
            markers += r.discussionProbe.controls_total;
            threads += r.discussionProbe.inline_thread_candidates;
          }
          if (!closed) stats.textContent = "\u041E\u0431\u0441\u0443\u0436\u0434\u0435\u043D\u0438\u044F: \u043F\u0440\u043E\u0447\u0438\u0442\u0430\u043D\u043E \u043A\u0430\u0440\u0442\u043E\u0447\u0435\u043A " + attempted + " \xB7 \u044D\u043B\u0435\u043C\u0435\u043D\u0442\u043E\u0432 UI " + markers + " \xB7 \u0432\u0441\u0442\u0440\u043E\u0435\u043D\u043D\u044B\u0445 \u0432\u0435\u0442\u043E\u043A " + threads + "\n\u0422\u043E\u043B\u044C\u043A\u043E \u0441\u0442\u0440\u0443\u043A\u0442\u0443\u0440\u0430: \u0442\u0435\u043A\u0441\u0442, \u0441\u0441\u044B\u043B\u043A\u0438 \u0438 \u0438\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u044F \u043D\u0435 \u044D\u043A\u0441\u043F\u043E\u0440\u0442\u0438\u0440\u0443\u044E\u0442\u0441\u044F.";
          if (!closed && !pauseRequested) await new Promise((resolve) => setTimeout(resolve, LOCAL_ORDERS.fetchPaceMs));
        }
        if (!closed) renderStats(pauseRequested ? "\u041F\u043E\u0438\u0441\u043A \u043E\u0431\u0441\u0443\u0436\u0434\u0435\u043D\u0438\u0439 \u043F\u0440\u0438\u043E\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D. \u041F\u043E\u0432\u0442\u043E\u0440\u043D\u043E\u0435 \u043D\u0430\u0436\u0430\u0442\u0438\u0435 \u043F\u0440\u043E\u0434\u043E\u043B\u0436\u0438\u0442 \u043D\u0435\u043F\u0440\u043E\u0447\u0438\u0442\u0430\u043D\u043D\u044B\u0435 \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0438." : "\u0414\u0438\u0430\u0433\u043D\u043E\u0441\u0442\u0438\u043A\u0430 \u043E\u0431\u0441\u0443\u0436\u0434\u0435\u043D\u0438\u0439 \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u0430. \u041D\u0430\u0436\u043C\u0438\u0442\u0435 \xAB\u041E\u0431\u0441\u0443\u0436\u0434\u0435\u043D\u0438\u044F JSON\xBB. \u041D\u0430\u0439\u0434\u0435\u043D\u043D\u044B\u0435 \u044D\u043B\u0435\u043C\u0435\u043D\u0442\u044B \u043D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0430\u044E\u0442 \u0434\u043E\u0441\u0442\u0443\u043F \u043A \u0442\u0435\u043A\u0441\u0442\u0443 \u0438\u043B\u0438 \u0432\u043B\u043E\u0436\u0435\u043D\u0438\u044F\u043C.");
      } finally {
        busy = false;
        refreshBtn.disabled = false;
        updateBatchControls();
      }
    }
    function updateBatchControls() {
      discussionBtn.disabled = busy || closed;
      pauseBtn.disabled = !busy || closed || pauseRequested;
      scanBtn.disabled = busy || closed || nextRowIndex >= rows.length;
      scanBtn.textContent = nextRowIndex >= rows.length ? "\u0412\u0441\u0435 \u0441\u0442\u0440\u043E\u043A\u0438 \u043E\u0431\u0440\u0430\u0431\u043E\u0442\u0430\u043D\u044B" : pauseRequested ? "\u041F\u0440\u043E\u0434\u043E\u043B\u0436\u0438\u0442\u044C \u043E\u0447\u0435\u0440\u0435\u0434\u044C (" + (rows.length - nextRowIndex) + ")" : "\u041F\u0440\u043E\u0432\u0435\u0440\u0438\u0442\u044C \u0432\u0441\u0435 \u0437\u0430\u043A\u0430\u0437\u044B (" + (rows.length - nextRowIndex) + ")";
    }
    async function scanAll() {
      if (busy || closed) return;
      busy = true;
      pauseRequested = false;
      refreshBtn.disabled = scanBtn.disabled = true;
      pauseBtn.disabled = false;
      let examined = 0;
      try {
        while (nextRowIndex < rows.length && !closed && !pauseRequested) {
          const r = rows[nextRowIndex++];
          if (r.scanAttempted) continue;
          try {
            await scanRowContents(r);
          } catch {
            r.results = [{ type: "order", status: "MANUAL", reason: "ORDER_INSPECTION_FAILED" }];
            r.scanAttempted = true;
            r.button.disabled = false;
          }
          if (r.partial) {
            nextRowIndex--;
            break;
          }
          examined++;
          renderStats("\u041E\u0447\u0435\u0440\u0435\u0434\u044C: \u043E\u0431\u0440\u0430\u0431\u043E\u0442\u0430\u043D\u043E " + examined + " \u0437\u0430\u043A\u0430\u0437\u043E\u0432 \u0441 \u043C\u043E\u043C\u0435\u043D\u0442\u0430 \u0437\u0430\u043F\u0443\u0441\u043A\u0430, \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0438\u0439 " + (nextRowIndex + 1) + "/" + rows.length);
          await new Promise((resolve) => setTimeout(resolve, LOCAL_ORDERS.fetchPaceMs));
        }
        if (!closed) renderStats(nextRowIndex >= rows.length ? "\u041E\u0447\u0435\u0440\u0435\u0434\u044C \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u0430. \u0412\u0441\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u043D\u044B\u0435 \u0444\u0430\u0439\u043B\u044B \u043F\u0440\u043E\u0432\u0435\u0440\u0435\u043D\u044B \u0438\u043B\u0438 \u043F\u043E\u043C\u0435\u0447\u0435\u043D\u044B \u0434\u043B\u044F \u0440\u0443\u0447\u043D\u043E\u0439 \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0438." : "\u041E\u0447\u0435\u0440\u0435\u0434\u044C \u043E\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u0430 \u043F\u043E\u0441\u043B\u0435 \u0442\u0435\u043A\u0443\u0449\u0435\u0433\u043E \u0444\u0430\u0439\u043B\u0430. \u041D\u0430\u0436\u043C\u0438\u0442\u0435 \xAB\u041F\u0440\u043E\u0434\u043E\u043B\u0436\u0438\u0442\u044C \u043E\u0447\u0435\u0440\u0435\u0434\u044C\xBB.");
      } finally {
        busy = false;
        refreshBtn.disabled = false;
        updateBatchControls();
      }
    }
    refresh();
    return true;
  }
  if (typeof window !== "undefined" && typeof document !== "undefined")
    initLocalOrdersOverlay();
})();
