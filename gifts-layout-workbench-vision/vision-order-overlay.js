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
    const attr = (name) => root.getAttribute(name);
    if (attr("style") || attr("class") || attr("transform"))
      return refuse("SVG_ROOT_STYLE_OR_TRANSFORM_UNVERIFIED");
    const align = (attr("preserveAspectRatio") || "xMidYMid meet").trim();
    if (!/^(?:x(?:Min|Mid|Max)Y(?:Min|Mid|Max))(?:\s+(?:meet|slice))?$/.test(align))
      return refuse("SVG_ASPECT_RATIO_UNSUPPORTED");
    if (/slice$/.test(align)) return refuse("SVG_ASPECT_RATIO_SLICE_UNVERIFIED");
    const physicalWidthMm = unitValue(attr("width")), physicalHeightMm = unitValue(attr("height"));
    if (!physicalWidthMm || !physicalHeightMm)
      return refuse("SVG_EXPLICIT_PHYSICAL_SIZE_REQUIRED");
    const vb = attr("viewBox");
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
    let i = 0, command = null, position = { x: 0, y: 0 }, start = null, points = null, contours = [], count = 0, curveSegments = 0;
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
        count++;
      }
      if (count > maxSegments) throw new Error("PATH_SEGMENT_BUDGET_EXCEEDED");
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
          const before = count;
          cubicToPolyline(position, c1, c2, end, errorBudget, 14, emit);
          curveSegments += count - before;
          position = end;
          lastCubicControl = c2;
          lastQuadControl = null;
          continue;
        }
        if (upper === "S") {
          const c1 = reflected(lastCubicControl);
          const c2 = target(rel), end = target(rel);
          const before = count;
          cubicToPolyline(position, c1, c2, end, errorBudget, 14, emit);
          curveSegments += count - before;
          position = end;
          lastCubicControl = c2;
          lastQuadControl = null;
          continue;
        }
        if (upper === "Q") {
          const c = target(rel), end = target(rel);
          const c1 = { x: position.x + (c.x - position.x) * 2 / 3, y: position.y + (c.y - position.y) * 2 / 3 };
          const c2 = { x: end.x + (c.x - end.x) * 2 / 3, y: end.y + (c.y - end.y) * 2 / 3 };
          const before = count;
          cubicToPolyline(position, c1, c2, end, errorBudget, 14, emit);
          curveSegments += count - before;
          position = end;
          lastQuadControl = c;
          lastCubicControl = null;
          continue;
        }
        if (upper === "A") {
          const rx = scalar(), ry = scalar(), rotation = scalar(), large = scalar(), sweep = scalar(), end = target(rel);
          const before = count;
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
            maxSegments - count
          );
          curveSegments += count - before;
          position = end;
          resetSmooth();
          continue;
        }
        if (upper === "T") {
          const c = reflected(lastQuadControl);
          const end = target(rel);
          const c1 = { x: position.x + (c.x - position.x) * 2 / 3, y: position.y + (c.y - position.y) * 2 / 3 };
          const c2 = { x: end.x + (c.x - end.x) * 2 / 3, y: end.y + (c.y - end.y) * 2 / 3 };
          const before = count;
          cubicToPolyline(position, c1, c2, end, errorBudget, 14, emit);
          curveSegments += count - before;
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
    let i = 0, m = identity.slice(), match, count = 0;
    while (match = re.exec(value)) {
      if (!/^[\s,]*$/.test(value.slice(i, match.index))) return null;
      i = re.lastIndex;
      count++;
      if (count > 24) return null;
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
    if (count === 0 || !/^[\s,]*$/.test(value.slice(i)) || !invertible(m)) return null;
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
    let count = 0;
    while (work.length) {
      const node2 = work.pop();
      if (++count > 512) return "SVG_XML_NODE_LIMIT";
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
    let row = 0, col = 0, diag = 0, anti = 0, b3 = 0, b5 = 0, all = 0, center = 0;
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const v = mask[(y + dy) * width + x + dx] === target ? 1 : 0;
      all += v;
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
    return [row / 9, col / 9, diag / 9, anti / 9, b3 / 9, b5 / 25, all / 81, center / 3];
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
    let count = 0;
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
        count++;
      }
    }
    if (count < 2 || count >= size * 0.98)
      return { status: "MANUAL", reason: "INK_MASK_EMPTY_OR_AMBIGUOUS" };
    return { status: "INK_MASK_READY", mask, inkPixels: count, segmentation: alphaMode && !inkColor ? "alpha" : inkColor ? "sampled_ink_rgb" : "corner_background_rgb" };
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

  // vision/orders/order-page-discovery.mjs
  var TEST_HOSTS = Object.freeze(["psk.testgifts.local", "testgifts.local"]);
  var REFUSE = (reason) => ({ status: "MANUAL", reason, production_approved: false });
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
    for (const attr of ["data-href", "data-url"]) {
      const url = testUrl(row.getAttribute?.(attr) || "", base);
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
  function popupHtml(text) {
    if (typeof text !== "string" || !text.trim() || text.length > 3e6)
      return REFUSE("POPUP_BODY_INVALID");
    try {
      if (text.trimStart().startsWith("{")) {
        const data = JSON.parse(text);
        if (typeof data?.html !== "string") return REFUSE("POPUP_JSON_MISSING_HTML");
        return { status: "POPUP_HTML", html: data.html };
      }
    } catch {
      return REFUSE("POPUP_JSON_INVALID");
    }
    return { status: "POPUP_HTML", html: text };
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
    const value = (node2.textContent || "").replace(/\s+/g, " ").trim().slice(0, 200);
    return value;
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
      if (!/\.(?:pdf|ai|svg|eps|cdr|png|jpe?g|webp)$/i.test(filename)) {
        rejected.push("CUSTOMER_FILE_NAME_UNSUPPORTED");
        continue;
      }
      uploads.set(id, {
        id,
        orderNumber,
        role: "customer_uploaded_artwork",
        filename,
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
  function isAuthHtml(text) {
    return /<form[^>]+name=["']authform["']/i.test(text) || /Авторизация\s*-\s*Проект\s*111/i.test(text);
  }
  async function boundedText(response, limit2 = 3e6) {
    if (!response.ok) throw Error("HTTP_" + response.status);
    const type = response.headers.get("content-type") || "";
    if (!/(?:html|json|text)/i.test(type)) throw Error("UNEXPECTED_DOCUMENT_CONTENT_TYPE");
    const length2 = response.headers.get("content-length");
    if (length2 && Number(length2) > limit2) throw Error("DOCUMENT_TOO_LARGE");
    const reader = response.body?.getReader();
    if (!reader) {
      const s = await response.text();
      if (s.length > limit2) throw Error("DOCUMENT_TOO_LARGE");
      return s;
    }
    const parts = [];
    let count = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        count += value.length;
        if (count > limit2) throw Error("DOCUMENT_TOO_LARGE");
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
    const buf = new Uint8Array(count);
    let offset = 0;
    for (const part of parts) {
      buf.set(part, offset);
      offset += part.length;
    }
    return new TextDecoder("utf-8").decode(buf);
  }
  async function getText(url, fetcher, listOrigin) {
    const loc = new URL(url);
    if (!allowed(loc)) throw Error("UNTRUSTED_TEST_HOST");
    const same3 = loc.origin === listOrigin;
    const res = await fetcher(loc.href, {
      method: "GET",
      mode: same3 ? "same-origin" : "cors",
      credentials: "include",
      redirect: "error",
      cache: "no-store",
      referrerPolicy: "no-referrer",
      headers: { accept: "text/html,application/json" }
    });
    const text = await boundedText(res);
    if (isAuthHtml(text)) throw Error("TEST_SESSION_AUTH_REQUIRED");
    return text;
  }
  async function inspectOrderPageFromRow(row, {
    loc = globalThis.location,
    fetcher = globalThis.fetch,
    DOMParserClass = globalThis.DOMParser
  } = {}) {
    if (!loc || loc.protocol !== "http:" || loc.hostname !== "psk.testgifts.local" || !/^\/devorders(?:\/|$)/.test(loc.pathname))
      return REFUSE("NOT_TEST_ORDER_PAGE");
    const target = rowOrderTarget(row, loc.href);
    if (target.status !== "ORDER_LINK_FOUND") return target;
    try {
      const source = await getText(target.url.href, fetcher, loc.origin);
      const doc = parse(source, DOMParserClass);
      const oid = extractOrderInternalId(doc);
      if (!oid) return REFUSE("ORDER_INTERNAL_ID_NOT_FOUND");
      const popupUrl = testUrl(
        "/ajax/gifts/order?action=makets_popup&oid=" + oid,
        target.url.origin
      );
      const raw = await getText(popupUrl.href, fetcher, loc.origin);
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
        rejected: resources.rejected
      };
    } catch (error) {
      const msg = String(error?.message || "");
      return REFUSE(msg === "TEST_SESSION_AUTH_REQUIRED" ? "TEST_SESSION_AUTH_REQUIRED" : msg === "DOCUMENT_TOO_LARGE" ? "ORDER_DOCUMENT_TOO_LARGE" : msg.startsWith("HTTP_") ? "ORDER_HTTP_ERROR" : "ORDER_DETAIL_FETCH_OR_CORS_FAILURE");
    }
  }
  async function fetchOrderResourceBytes(resource, {
    fetcher = globalThis.fetch,
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
      if (!res.ok) return REFUSE("ARTWORK_HTTP_ERROR");
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
    } catch {
      return REFUSE(ctrl.signal.aborted ? "ARTWORK_TIMEOUT" : same3 ? "ARTWORK_DOWNLOAD_FAILED" : "TEST_SUBDOMAIN_CORS_OR_AUTH_REQUIRED");
    } finally {
      clearTimeout(timer);
    }
  }

  // vision/orders/row-scanner.mjs
  var LOCAL_ORDERS = Object.freeze({
    host: "psk.testgifts.local",
    route: "/devorders",
    maxRows: 80,
    maxFilesPerRow: 8,
    maxFileBytes: 16e6,
    maxBatchFiles: 32,
    maxOrdersPerClick: 10,
    timeoutMs: 15e3
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
    const all = [...doc.querySelectorAll("table tbody tr, table tr, [data-order-id]")];
    const seen = /* @__PURE__ */ new Set(), rows = [];
    for (const node2 of all) {
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
        files: files.slice(0, LOCAL_ORDERS.maxFilesPerRow),
        local_only_excluded: anchors.length - files.length,
        row_index: rows.length + 1,
        limited: files.length > LOCAL_ORDERS.maxFilesPerRow
      });
      if (rows.length >= LOCAL_ORDERS.maxRows) break;
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
    for (const item of discoverOrderRows(doc)) {
      const target = rowOrderTarget(item.element, doc.defaultView.location.href);
      if (target.status !== "ORDER_LINK_FOUND") {
        rowRoutes[target.reason === "AMBIGUOUS_ORDER_ROW" ? "ambiguous" : "unresolved"]++;
      } else {
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
    const data = [], central = [];
    let offset = 0, centralSize = 0;
    for (const { name, bytes } of entries) {
      if (typeof name !== "string" || name.length > 100 || !/^(?:manifest\.json|samples\/[0-9]{4}\.(?:svg|pdf|png|jpg|jpeg|webp|cdr|eps|ai|bin))$/.test(name) || !(bytes instanceof Uint8Array) || bytes.length > 5e6)
        throw new RangeError("LOCAL_ZIP_ENTRY_INVALID");
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
  async function makeLocalExpertDataset(rows, {
    loc = globalThis.location,
    fetcher = globalThis.fetch,
    maxFiles = 16,
    maxPerFile = 4e6,
    maxTotal = 24e6
  } = {}) {
    if (!isAllowedTestOrderPage(loc)) return refused2("NOT_TEST_ORDER_PAGE");
    if (!Array.isArray(rows) || rows.length > LOCAL_ORDERS.maxRows || !Number.isSafeInteger(maxFiles) || maxFiles < 1 || maxFiles > 16 || !Number.isSafeInteger(maxPerFile) || maxPerFile < 1 || maxPerFile > 4e6 || !Number.isSafeInteger(maxTotal) || maxTotal < 1 || maxTotal > 24e6)
      return refused2("EXPERT_EXPORT_LIMITS_INVALID");
    const picked = rows.filter((r) => allowedLabels.has(r.grade?.value));
    if (!picked.length) return refused2("EXPERT_LABELS_REQUIRED");
    const entries = [], samples = [], skipped = [];
    let consumed = 0, id = 0;
    outer: for (const r of picked) {
      const source = r.orderUploads?.length ? r.orderUploads : r.files || [];
      for (const a of source.slice(0, 4)) {
        if (id >= maxFiles) break outer;
        const file = a.role === "customer_uploaded_artwork" ? await fetchOrderResourceBytes(a, {
          fetcher,
          loc,
          maxBytes: maxPerFile
        }) : await fetchSameOriginArtworkBytes(a, {
          fetcher,
          loc,
          maxFileBytes: maxPerFile
        });
        if (file.status !== "LOCAL_BYTES_ONLY") {
          skipped.push({ row_index: r.row_index, reason: file.reason });
          continue;
        }
        if (consumed + file.bytes.length > maxTotal) {
          skipped.push({ row_index: r.row_index, reason: "EXPERT_EXPORT_TOTAL_LIMIT" });
          break outer;
        }
        id++;
        consumed += file.bytes.length;
        const name = "samples/" + String(id).padStart(4, "0") + "." + suffix(file.url, file.bytes, a.filename || "");
        const sha = await optionalSha256(file.bytes);
        entries.push({ name, bytes: file.bytes });
        samples.push({
          sample_name: name,
          anonymous_row_index: r.row_index,
          expert_label: r.grade.value,
          expert_label_scope: "whole_order_row_not_object_ROI",
          bytes: file.bytes.length,
          sha256: sha,
          source_size_and_placement_proven: false,
          trusted_artwork_provenance_proven: false
        });
      }
    }
    if (!samples.length) return refused2("NO_EXPORTABLE_LABELED_ARTWORK");
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
      warning: "Contains original test-only files and row-level opinions, NOT a verified training dataset. Store and annotate locally.",
      samples,
      skipped
    };
    entries.unshift({ name: "manifest.json", bytes: te.encode(JSON.stringify(manifest, null, 2) + "\n") });
    const zip = makeLocalStoredZip(entries);
    return {
      status: "LOCAL_ZIP_READY",
      zip,
      manifest,
      sample_count: samples.length,
      skipped_count: skipped.length,
      exported_bytes: consumed
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
    "#vision-local-order-overlay .vlo-stats{white-space:pre-line!important;margin:8px 0!important;color:#cbe3d6!important}",
    ".vision-order-result-cell{min-width:210px!important;font:12px/1.5 system-ui,sans-serif!important;white-space:normal!important;color:#2f4348!important;padding:6px!important;vertical-align:middle!important}",
    ".vision-order-result-cell .vlo-label{font-weight:700!important;color:#36515a!important}",
    ".vision-order-result-cell .vlo-detail{display:block!important;white-space:normal!important;color:#6b777a!important}",
    ".vision-order-result-cell button,.vision-order-result-cell select{font:12px system-ui,sans-serif!important;margin:3px 4px 3px 0!important;border:1px solid #a4b6b5!important;border-radius:4px!important;background:#f5f8f6!important;color:#345058!important;padding:3px 5px!important;cursor:pointer!important;max-width:160px!important}",
    ".vision-order-result-cell [data-vlo-grade]{display:block!important}"
  ].join("\n");
  var node = (tag, text, cls) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text !== void 0) el.textContent = text;
    return el;
  };
  var safeNumber = (n) => Number.isFinite(n) ? n.toFixed(3) + " \u043C\u043C" : "\u043D\u0435 \u0438\u0437\u043C\u0435\u0440\u0435\u043D\u043E";
  function summarize(res) {
    if (res.status !== "RESEARCH_ONLY")
      return (res.type || "\u0444\u0430\u0439\u043B").toUpperCase() + ": \u0440\u0443\u0447\u043D\u0430\u044F \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u2014 " + String(res.reason || "\u043D\u0435 \u043E\u043F\u0440\u0435\u0434\u0435\u043B\u0435\u043D\u043E").slice(0, 80);
    if (res.type === "svg")
      return "SVG: " + res.detected_regions + " \u043C\u0435\u0441\u0442; \u043B\u0438\u043D\u0438\u044F " + safeNumber(res.min_line_document_mm) + ", \u043F\u0440\u043E\u0431\u0435\u043B " + safeNumber(res.min_gap_document_mm) + " (\u043D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D \u043C\u0430\u0441\u0448\u0442\u0430\u0431 \u0437\u0430\u043A\u0430\u0437\u0430)";
    return "\u0420\u0430\u0441\u0442\u0440: " + res.detected_regions + " \u043A\u0430\u043D\u0434\u0438\u0434\u0430\u0442\u043E\u0432 (\u0441\u0438\u043D\u0442\u0435\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439 MLP; \u043C\u0430\u0441\u0448\u0442\u0430\u0431 \u043D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u0435\u043D)";
  }
  var makeButton = (text, fn) => {
    const b = node("button", text);
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
    const title = node("h2", "Vision Check \xB7 \u0442\u0435\u0441\u0442\u043E\u0432\u044B\u0435 \u0437\u0430\u043A\u0430\u0437\u044B");
    const description = node(
      "p",
      "\u0422\u043E\u043B\u044C\u043A\u043E \u043B\u043E\u043A\u0430\u043B\u044C\u043D\u0430\u044F \u0441\u0435\u0442\u044C. \u0421\u0441\u044B\u043B\u043A\u0438 \u043D\u0430 \u043C\u0430\u043A\u0435\u0442\u044B \u0437\u0430\u0433\u0440\u0443\u0436\u0430\u044E\u0442\u0441\u044F \u0432 \u043F\u0430\u043C\u044F\u0442\u044C \u0431\u0440\u0430\u0443\u0437\u0435\u0440\u0430 \u043F\u043E\u0441\u043B\u0435 \u0432\u0430\u0448\u0435\u0433\u043E \u043D\u0430\u0436\u0430\u0442\u0438\u044F; \u0444\u0430\u0439\u043B\u044B \u043D\u0435 \u043E\u0442\u043F\u0440\u0430\u0432\u043B\u044F\u044E\u0442\u0441\u044F \u043D\u0430 GitHub."
    );
    const actions = node("div", void 0, "vlo-actions");
    const stats = node("div", "\u041F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u043A\u0430 \u043F\u043E\u0438\u0441\u043A\u0430 \u0441\u0442\u0440\u043E\u043A\u2026", "vlo-stats");
    stats.setAttribute("role", "status");
    const warning = node("p", "\u042D\u0442\u043E \u0438\u0441\u0441\u043B\u0435\u0434\u043E\u0432\u0430\u0442\u0435\u043B\u044C\u0441\u043A\u0438\u0439 \u0430\u043D\u0430\u043B\u0438\u0437, \u043D\u0435 \u0434\u043E\u043F\u0443\u0441\u043A \u043A \u043F\u0435\u0447\u0430\u0442\u0438. \u041D\u0435\u0442 \u043D\u0430\u0439\u0434\u0435\u043D\u043D\u044B\u0445 \u043C\u0435\u0441\u0442 \u2260 \u043C\u0430\u043A\u0435\u0442 \u0433\u043E\u0434\u0435\u043D. PDF \u0438 \u0441\u043B\u043E\u0436\u043D\u044B\u0435 \u0432\u0435\u043A\u0442\u043E\u0440\u044B: MANUAL. \u041B\u043E\u043A\u0430\u043B\u044C\u043D\u044B\u0439 ZIP \u0441\u043E\u0434\u0435\u0440\u0436\u0438\u0442 \u0438\u0441\u0445\u043E\u0434\u043D\u044B\u0435 \u0442\u0435\u0441\u0442\u043E\u0432\u044B\u0435 \u0444\u0430\u0439\u043B\u044B \u2014 \u043D\u0435 \u043F\u0443\u0431\u043B\u0438\u043A\u0443\u0439\u0442\u0435 \u0435\u0433\u043E.", "vlo-note");
    let rows = [], busy = false, closed = false, fileBudget = LOCAL_ORDERS.maxBatchFiles;
    function close2() {
      closed = true;
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
        source_artwork_included: false,
        order_urls_included: false,
        raw_artwork_bytes_included: false,
        production_approved: false,
        real_world_accuracy_verified: false,
        rows: rows.map((r) => ({
          row_index: r.row_index,
          discovered_links: r.anchors.length,
          same_origin_files: r.files.length,
          order_card_discovered: r.hasOrderLink,
          customer_uploaded_artworks: r.orderUploads?.length ?? null,
          constructor_template_count: r.orderTemplates ?? null,
          excluded_links: r.local_only_excluded,
          expert_label: r.grade?.value || "unreviewed",
          artifacts: (r.results || []).map((result, i) => ({
            file_index: i + 1,
            type: result.type,
            status: result.status,
            reason: result.reason || null,
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
    const scanBtn = makeButton("\u041F\u0440\u043E\u0432\u0435\u0440\u0438\u0442\u044C \u043C\u0430\u043A\u0435\u0442\u044B", () => scanAll());
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
    const bundleBtn = makeButton("\u041B\u043E\u043A\u0430\u043B\u044C\u043D\u044B\u0435 \u043F\u0440\u0438\u043C\u0435\u0440\u044B ZIP", async () => {
      if (busy || closed) return;
      if (!window.confirm("\u0421\u043A\u0430\u0447\u0430\u0442\u044C \u043B\u043E\u043A\u0430\u043B\u044C\u043D\u044B\u0439 ZIP \u0441 \u041E\u0420\u0418\u0413\u0418\u041D\u0410\u041B\u0410\u041C\u0418 \u0442\u0435\u0441\u0442\u043E\u0432\u044B\u0445 \u043C\u0430\u043A\u0435\u0442\u043E\u0432 \u0438\u0437 \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u044B\u0445 \u0441\u0442\u0440\u043E\u043A? \u0424\u0430\u0439\u043B\u044B \u043C\u043E\u0433\u0443\u0442 \u0441\u043E\u0434\u0435\u0440\u0436\u0430\u0442\u044C \u043A\u043E\u043D\u0444\u0438\u0434\u0435\u043D\u0446\u0438\u0430\u043B\u044C\u043D\u044B\u0435 \u0434\u0430\u043D\u043D\u044B\u0435. \u041D\u0435 \u0437\u0430\u0433\u0440\u0443\u0436\u0430\u0439\u0442\u0435 ZIP \u0432 \u043F\u0443\u0431\u043B\u0438\u0447\u043D\u044B\u0439 GitHub.")) return;
      busy = true;
      bundleBtn.disabled = true;
      refreshBtn.disabled = scanBtn.disabled = true;
      stats.textContent = "\u041B\u043E\u043A\u0430\u043B\u044C\u043D\u043E\u0435 \u0441\u043A\u0430\u0447\u0438\u0432\u0430\u043D\u0438\u0435 \u043E\u0442\u043C\u0435\u0447\u0435\u043D\u043D\u044B\u0445 \u0442\u0435\u0445\u043D\u043E\u043B\u043E\u0433\u043E\u043C \u0442\u0435\u0441\u0442\u043E\u0432\u044B\u0445 \u0444\u0430\u0439\u043B\u043E\u0432\u2026";
      try {
        const exported = await makeLocalExpertDataset(rows);
        if (closed) return;
        if (exported.status !== "LOCAL_ZIP_READY") {
          renderStats("ZIP \u043D\u0435 \u0441\u0444\u043E\u0440\u043C\u0438\u0440\u043E\u0432\u0430\u043D: " + String(exported.reason).slice(0, 90) + ". \u041F\u043E\u0441\u0442\u0430\u0432\u044C\u0442\u0435 \u044D\u043A\u0441\u043F\u0435\u0440\u0442\u043D\u0443\u044E \u043C\u0435\u0442\u043A\u0443 \u0445\u043E\u0442\u044F \u0431\u044B \u043E\u0434\u043D\u043E\u0439 \u0441\u0442\u0440\u043E\u043A\u0435.");
          return;
        }
        const u = URL.createObjectURL(exported.zip), a = node("a");
        a.href = u;
        a.download = "vision-local-test-labeled-samples.zip";
        a.click();
        setTimeout(() => URL.revokeObjectURL(u), 1500);
        renderStats("\u041B\u043E\u043A\u0430\u043B\u044C\u043D\u043E \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u043E " + exported.sample_count + " \u0442\u0435\u0441\u0442\u043E\u0432\u044B\u0445 \u043F\u0440\u0438\u043C\u0435\u0440\u043E\u0432. \u041D\u0443\u0436\u043D\u044B \u044D\u043A\u0441\u043F\u0435\u0440\u0442\u043D\u044B\u0435 ROI \u0438 \u043D\u0435\u0437\u0430\u0432\u0438\u0441\u0438\u043C\u0430\u044F \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u043F\u0435\u0440\u0435\u0434 \u043E\u0431\u0443\u0447\u0435\u043D\u0438\u0435\u043C.");
      } catch {
        if (!closed) renderStats("\u041E\u0448\u0438\u0431\u043A\u0430 \u043B\u043E\u043A\u0430\u043B\u044C\u043D\u043E\u0433\u043E ZIP. \u0414\u0430\u043D\u043D\u044B\u0435 \u043D\u0430\u0440\u0443\u0436\u0443 \u043D\u0435 \u043F\u0435\u0440\u0435\u0434\u0430\u0432\u0430\u043B\u0438\u0441\u044C.");
      } finally {
        busy = false;
        bundleBtn.disabled = false;
        refreshBtn.disabled = false;
        scanBtn.disabled = rows.length === 0;
      }
    });
    actions.append(
      refreshBtn,
      scanBtn,
      exportBtn,
      diagnosticBtn,
      bundleBtn,
      makeButton("\u0417\u0430\u043A\u0440\u044B\u0442\u044C", close2)
    );
    panel.append(title, description, actions, stats, warning);
    document.body.append(panel);
    window.__visionLocalOrderOverlay = { close: close2, refresh, version: "C3B.3.O" };
    function renderStats(msg) {
      const discovered = rows.reduce((n, r) => n + r.anchors.length, 0);
      const local = rows.reduce((n, r) => n + (r.orderUploads?.length ?? r.files.length), 0);
      const completed = rows.reduce((n, r) => n + (r.results?.length || 0), 0);
      stats.textContent = "\u0421\u0442\u0440\u043E\u043A: " + rows.length + " \xB7 \u0441\u0441\u044B\u043B\u043A\u0438: " + discovered + " \xB7 \u0444\u0430\u0439\u043B\u044B \u0438\u0437 \u043A\u0430\u0440\u0442\u043E\u0447\u0435\u043A/\u0441\u0442\u0440\u043E\u043A: " + local + " \xB7 \u043F\u0440\u043E\u0432\u0435\u0440\u0435\u043D\u043E: " + completed + "\n" + (msg || "\u041D\u0430\u0436\u043C\u0438\u0442\u0435 \xAB\u041F\u0440\u043E\u0432\u0435\u0440\u0438\u0442\u044C \u043C\u0430\u043A\u0435\u0442\u044B\xBB.");
    }
    function refresh() {
      if (busy || closed) return;
      document.querySelectorAll("[data-vision-order-cell]").forEach((n) => n.remove());
      rows = discoverOrderRows(document);
      fileBudget = LOCAL_ORDERS.maxBatchFiles;
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
        const trigger = makeButton("\u041F\u0440\u043E\u0432\u0435\u0440\u0438\u0442\u044C \u0441\u0442\u0440\u043E\u043A\u0443", () => scanRow(r));
        const gradeLabel = node("label", "\u041C\u0435\u0442\u043A\u0430 \u0442\u0435\u0445\u043D\u043E\u043B\u043E\u0433\u0430: ");
        gradeLabel.setAttribute("data-vlo-grade", "");
        const grade = node("select");
        for (const [value, text] of [
          ["unreviewed", "\u041D\u0435 \u0440\u0430\u0437\u043C\u0435\u0447\u0435\u043D\u043E"],
          ["confirmed_defect", "\u041F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043D \u0434\u0435\u0444\u0435\u043A\u0442"],
          ["false_positive", "\u041B\u043E\u0436\u043D\u043E\u0435 \u0441\u0440\u0430\u0431\u0430\u0442\u044B\u0432\u0430\u043D\u0438\u0435"],
          ["missed_defect", "\u041F\u0440\u043E\u043F\u0443\u0449\u0435\u043D \u0434\u0435\u0444\u0435\u043A\u0442"],
          ["expert_clear", "\u041F\u0440\u043E\u0432\u0435\u0440\u0435\u043D\u043E \u0432\u0440\u0443\u0447\u043D\u0443\u044E"]
        ]) {
          const option = node("option", text);
          option.value = value;
          grade.append(option);
        }
        gradeLabel.append(grade);
        r.grade = grade;
        cell.append(label, detail, trigger, gradeLabel);
        r.element.append(cell);
        r.label = label;
        r.detail = detail;
        r.button = trigger;
      }
      scanBtn.disabled = rows.length === 0;
      renderStats(rows.length ? "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430 \u043D\u0430\u0447\u043D\u0451\u0442\u0441\u044F \u0442\u043E\u043B\u044C\u043A\u043E \u043F\u043E \u043D\u0430\u0436\u0430\u0442\u0438\u044E \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F." : "\u0421\u0442\u0440\u043E\u043A\u0438 \u043D\u0435 \u0440\u0430\u0441\u043F\u043E\u0437\u043D\u0430\u043D\u044B. \u0422\u0440\u0435\u0431\u0443\u0435\u0442\u0441\u044F \u0430\u0434\u0430\u043F\u0442\u0435\u0440 \u043A DOM \u0442\u0435\u0441\u0442\u043E\u0432\u043E\u0439 \u0442\u0430\u0431\u043B\u0438\u0446\u044B; \u0444\u0430\u0439\u043B\u043E\u0432\u044B\u0435 \u0437\u0430\u043F\u0440\u043E\u0441\u044B \u043D\u0435 \u0432\u044B\u043F\u043E\u043B\u043D\u044F\u043B\u0438\u0441\u044C.");
    }
    async function scanRowContents(r) {
      r.button.disabled = true;
      r.label.textContent = "Vision: \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0430 \u0437\u0430\u043A\u0430\u0437\u0430 \u2192 \u043C\u0430\u043A\u0435\u0442\u044B\u2026";
      r.results = [];
      let manual2 = 0, research = 0, desc = [];
      let candidates = [], fromOrder = false;
      if (r.hasOrderLink) {
        const detail = await inspectOrderPageFromRow(r.element);
        if (closed) return;
        if (detail.status !== "ORDER_DETAIL_DISCOVERED") {
          r.label.textContent = "Vision: \u0440\u0443\u0447\u043D\u0430\u044F \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0430";
          r.detail.textContent = "\u041A\u0430\u0440\u0442\u043E\u0447\u043A\u0430 \u0437\u0430\u043A\u0430\u0437\u0430 / \u043E\u043A\u043D\u043E \u043C\u0430\u043A\u0435\u0442\u043E\u0432: " + String(detail.reason || "\u043D\u0435 \u043F\u0440\u043E\u0447\u0438\u0442\u0430\u043D\u043E").slice(0, 120);
          r.results.push({
            type: "order",
            status: "MANUAL",
            reason: detail.reason || "ORDER_DETAIL_UNAVAILABLE"
          });
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
          r.button.disabled = false;
          renderStats("\u041A\u043E\u043D\u0441\u0442\u0440\u0443\u043A\u0442\u043E\u0440\u044B \u043D\u0435 \u044F\u0432\u043B\u044F\u044E\u0442\u0441\u044F \u0438\u0441\u0445\u043E\u0434\u043D\u044B\u043C\u0438 \u043C\u0430\u043A\u0435\u0442\u0430\u043C\u0438 \u043A\u043B\u0438\u0435\u043D\u0442\u0430");
          return;
        }
        candidates = detail.uploads;
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
          r.button.disabled = false;
          renderStats("\u041D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D \u043F\u0435\u0440\u0435\u0445\u043E\u0434 \u043D\u0430 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0443 \u0437\u0430\u043A\u0430\u0437\u0430");
          return;
        }
      }
      const limit2 = LOCAL_ORDERS.maxFilesPerRow;
      for (const a of candidates.slice(0, limit2)) {
        if (closed) break;
        if (fileBudget <= 0) {
          manual2++;
          desc.push("\u041B\u0438\u043C\u0438\u0442 \u0441\u0435\u0430\u043D\u0441\u0430 \u2014 \u043E\u0441\u0442\u0430\u043B\u044C\u043D\u044B\u0435 \u0444\u0430\u0439\u043B\u044B \u043D\u0435 \u043F\u0440\u043E\u0432\u0435\u0440\u0435\u043D\u044B");
          break;
        }
        fileBudget--;
        let result;
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
            reason: artifact.reason || "ARTWORK_DOWNLOAD_FAILED"
          };
        } else result = await inspectSameOriginArtwork(a);
        if (closed) return;
        r.results.push(result);
        desc.push(summarize(result));
        if (result.status === "MANUAL") manual2++;
        else research++;
      }
      if (closed) return;
      if (candidates.length > limit2 || r.limited || r.local_only_excluded > 0 && !fromOrder)
        manual2++;
      r.label.textContent = manual2 ? "Vision: " + manual2 + " \u0442\u0440\u0435\u0431\u0443\u044E\u0442 \u0440\u0443\u0447\u043D\u043E\u0439 \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0438" : "Vision: " + research + " \u0438\u0441\u0441\u043B\u0435\u0434\u043E\u0432\u0430\u043D\u044B (\u043D\u0435 \u0434\u043E\u043F\u0443\u0441\u043A)";
      r.detail.textContent = (fromOrder ? "\u041A\u0430\u0440\u0442\u043E\u0447\u043A\u0430 \u0437\u0430\u043A\u0430\u0437\u0430: " + candidates.length + " \u043A\u043B\u0438\u0435\u043D\u0442\u0441\u043A\u0438\u0445 \u0444\u0430\u0439\u043B\u043E\u0432, " + r.orderTemplates + " \u043A\u043E\u043D\u0441\u0442\u0440\u0443\u043A\u0442\u043E\u0440\u043E\u0432. " : "") + desc.join(" | ").slice(0, 520) + (candidates.length > limit2 ? " \xB7 \u0447\u0430\u0441\u0442\u044C \u0444\u0430\u0439\u043B\u043E\u0432 \u043F\u0440\u043E\u043F\u0443\u0449\u0435\u043D\u0430 \u043F\u043E \u043B\u0438\u043C\u0438\u0442\u0443" : "");
      r.button.disabled = false;
      renderStats("\u041F\u0440\u043E\u0432\u0435\u0440\u0435\u043D\u043E \u043F\u043E \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0430\u043C \u0437\u0430\u043A\u0430\u0437\u043E\u0432. \u0412\u044B\u0432\u043E\u0434 \u043D\u0435 \u044F\u0432\u043B\u044F\u0435\u0442\u0441\u044F \u0434\u043E\u043F\u0443\u0441\u043A\u043E\u043C.");
    }
    async function scanRow(r) {
      if (busy || closed) return;
      busy = true;
      refreshBtn.disabled = scanBtn.disabled = true;
      try {
        await scanRowContents(r);
      } finally {
        busy = false;
        refreshBtn.disabled = false;
        scanBtn.disabled = rows.length === 0;
      }
    }
    async function scanAll() {
      if (busy || closed) return;
      busy = true;
      refreshBtn.disabled = scanBtn.disabled = true;
      try {
        for (const r of rows) {
          if (closed) break;
          if (fileBudget <= 0) {
            renderStats("\u041B\u0438\u043C\u0438\u0442 " + LOCAL_ORDERS.maxBatchFiles + " \u0444\u0430\u0439\u043B\u043E\u0432. \u0414\u043B\u044F \u043D\u043E\u0432\u043E\u0433\u043E \u0441\u0435\u0430\u043D\u0441\u0430 \u043D\u0430\u0436\u043C\u0438\u0442\u0435 \xAB\u041D\u0430\u0439\u0442\u0438 \u0441\u0442\u0440\u043E\u043A\u0438\xBB.");
            break;
          }
          await scanRowContents(r);
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      } finally {
        busy = false;
        refreshBtn.disabled = false;
        scanBtn.disabled = rows.length === 0;
      }
    }
    refresh();
    return true;
  }
  if (typeof window !== "undefined" && typeof document !== "undefined")
    initLocalOrdersOverlay();
})();
