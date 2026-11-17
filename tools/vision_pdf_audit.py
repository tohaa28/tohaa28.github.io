#!/usr/bin/env python3
"""Optional OFFLINE PDF path audit, never a print acceptance decision.

Requires separately installed PyMuPDF (AGPL/commercial license). No PDF is
uploaded or rewritten. Only path/stroke candidates, document dimensions and
counts are returned. Min-gap / font / transparency / ICC / final rendered
geometry are NOT certified by this audit.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import math
from pathlib import Path
import re

import vision_local_lab as lab

POINT_MM = 25.4 / 72.0
MAX_FILE = 16_000_000
MAX_PAGES = 32
MAX_DRAWINGS_PER_PAGE = 10_000
MAX_CANDIDATES_PER_PAGE = 80
SCHEMA = "printcheck.vision.pdf-path-audit.v1"


def manual(reason: str) -> dict:
    return {"schema": SCHEMA, "status": "MANUAL", "reason": reason,
            "geometry_verified": False, "color_verified": False,
            "production_approved": False, "training_ready": False}


def positive_number(number) -> bool:
    return type(number) in (int, float) and math.isfinite(number) and number > 0


def rect_points(value):
    try:
        coords = [float(value.x0), float(value.y0),
                  float(value.x1), float(value.y1)]
    except (TypeError, AttributeError, ValueError, OverflowError):
        return None
    return coords if all(math.isfinite(x) for x in coords) and (
        coords[2] >= coords[0] and coords[3] >= coords[1]
    ) else None


def audit_document(pdf_path: Path, *, engine=None,
                   exploratory_stroke_mm: float = 0.1) -> dict:
    """Inspect only a signed, local source file; accepts an injected fake
    engine in CI. The proposed stroke threshold is exploratory, NOT a
    technology-specific print specification.
    """
    if not positive_number(exploratory_stroke_mm) or exploratory_stroke_mm > 2:
        return manual("STROKE_THRESHOLD_INVALID")
    if not pdf_path.is_file() or pdf_path.stat().st_size > MAX_FILE:
        return manual("PDF_SIZE_OR_SOURCE_INVALID")
    with pdf_path.open("rb") as source:
        if source.read(5) != b"%PDF-":
            return manual("PDF_SIGNATURE_INVALID")
    if engine is None:
        try:
            import pymupdf as engine
        except ImportError:
            return manual("PDF_ENGINE_NOT_INSTALLED")
    doc = None
    try:
        doc = engine.open(str(pdf_path))
        if getattr(doc, "needs_pass", False):
            return manual("PDF_PASSWORD_REQUIRED")
        if len(doc) < 1 or len(doc) > MAX_PAGES:
            return manual("PDF_PAGE_COUNT_LIMIT")
        pages = []
        for page_num, page in enumerate(doc, 1):
            bounds = rect_points(page.rect)
            if not bounds or not positive_number(bounds[2]-bounds[0]) or (
                not positive_number(bounds[3]-bounds[1])
            ):
                return manual("PDF_PAGE_BOX_INVALID")
            drawings = page.get_drawings()
            if len(drawings) > MAX_DRAWINGS_PER_PAGE:
                return manual("PDF_DRAWING_COMPLEXITY_LIMIT")
            thin = []
            stroke_paths = 0
            filled_paths = 0
            hairlines = 0
            beziers = 0
            for path in drawings:
                if not isinstance(path, dict):
                    return manual("PDF_PATH_STRUCTURE_UNSUPPORTED")
                kind = path.get("type", "")
                if kind in ("s", "fs"):
                    stroke_paths += 1
                    stroke = path.get("width")
                    if stroke is None:
                        continue
                    if type(stroke) not in (float, int) or not math.isfinite(stroke) or stroke < 0:
                        return manual("PDF_STROKE_WIDTH_INVALID")
                    if stroke == 0:
                        hairlines += 1
                    elif (stroke * POINT_MM < exploratory_stroke_mm and
                          len(thin) < MAX_CANDIDATES_PER_PAGE):
                        bbox = rect_points(path.get("rect"))
                        if bbox is not None:
                            thin.append({
                                "page_number": page_num,
                                "bbox_page_pt": [round(v, 4) for v in bbox],
                                "nominal_stroke_mm": round(stroke * POINT_MM, 5),
                                "candidate_only": True
                            })
                if kind in ("f", "fs"):
                    filled_paths += 1
                beziers += sum(1 for item in path.get("items", ())
                               if isinstance(item, (tuple, list)) and
                               item and item[0] == "c")
            # Never copy PDF text or image bytes into the local summary.
            text_blocks = page.get_text("dict").get("blocks", [])
            images = page.get_images(full=True)
            pages.append({
                "page_number": page_num,
                "page_width_mm": round((bounds[2]-bounds[0])*POINT_MM, 3),
                "page_height_mm": round((bounds[3]-bounds[1])*POINT_MM, 3),
                "vector_path_count": len(drawings),
                "stroke_path_count": stroke_paths,
                "filled_path_count": filled_paths,
                "bezier_command_count": beziers,
                "zero_width_hairline_count": hairlines,
                "image_reference_count": len(images),
                "text_block_count": sum(b.get("type") == 0 for b in text_blocks
                                        if isinstance(b, dict)),
                "thin_stroke_candidates": thin,
                "thin_stroke_candidates_truncated": stroke_paths > MAX_CANDIDATES_PER_PAGE,
                "unit_for_boxes": "pdf_page_pt"
            })
        return {"schema": SCHEMA, "status": "RESEARCH_ONLY",
                "page_count": len(pages), "pages": pages,
                "exploratory_stroke_threshold_mm": exploratory_stroke_mm,
                "stroke_width_is_nominal_not_printed_width": True,
                "min_gap_verified": False, "transparency_verified": False,
                "text_outlines_verified": False, "spot_and_icc_verified": False,
                "physical_scale_proven": False,
                "geometry_verified": False, "color_verified": False,
                "production_approved": False, "training_ready": False}
    except Exception:
        # Do not leak exception strings: some backends include private paths.
        return manual("PDF_PARSE_OR_BACKEND_FAILURE")
    finally:
        if doc is not None:
            try:
                doc.close()
            except Exception:
                pass


def audit_sample(root: Path, sample_id: str, *, engine=None,
                 exploratory_stroke_mm: float = 0.1) -> dict:
    if not isinstance(sample_id, str) or not re.fullmatch(
        r"\d{8}T\d{6}_[0-9a-f]{10}:\d{4}", sample_id
    ):
        return manual("SAMPLE_ID_INVALID")
    with lab.open_db(root) as db:
        row = db.execute("SELECT relative_path,source_sha256,extension "
                         "FROM samples WHERE id=?", (sample_id,)).fetchone()
    if row is None:
        return manual("SAMPLE_ID_NOT_FOUND")
    relative, digest, ext = row
    if ext != "pdf":
        return manual("SAMPLE_NOT_PDF")
    root = root.resolve()
    candidate = root / relative
    target = candidate.resolve()
    try:
        target.relative_to((root / "samples").resolve())
    except ValueError:
        return manual("SAMPLE_PATH_UNSAFE")
    if (any(p.is_symlink() for p in
            (candidate, *candidate.parents)) or not target.is_file()):
        return manual("SAMPLE_PATH_UNSAFE")
    if target.stat().st_size > MAX_FILE:
        return manual("PDF_SIZE_OR_SOURCE_INVALID")
    if hashlib.sha256(target.read_bytes()).hexdigest() != digest:
        return manual("SOURCE_SHA256_MISMATCH")
    out = audit_document(target, engine=engine,
                         exploratory_stroke_mm=exploratory_stroke_mm)
    out["sample_id"] = sample_id
    return out


def main(argv=None):
    p = argparse.ArgumentParser(description="Optional local PDF vector path audit — never an approval")
    p.add_argument("--root", default=r"D:\VisionCheckLab")
    p.add_argument("--sample-id", required=True)
    p.add_argument("--exploratory-stroke-mm", type=float, default=.1)
    args = p.parse_args(argv)
    print(json.dumps(audit_sample(Path(args.root), args.sample_id,
        exploratory_stroke_mm=args.exploratory_stroke_mm),
        ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
