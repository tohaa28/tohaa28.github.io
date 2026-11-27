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
import os
import stat
import tempfile
import sys
from collections import Counter
from pathlib import Path
import re

import vision_local_lab as lab

POINT_MM = 25.4 / 72.0
MAX_FILE = 16_000_000
MAX_PAGES = 32
MAX_DRAWINGS_PER_PAGE = 10_000
MAX_ITEMS_PER_PATH = 10_000
MAX_CANDIDATES_PER_PAGE = 80
MAX_FILLED_CANDIDATES_PER_PAGE = 80
SCHEMA = "printcheck.vision.pdf-path-audit.v1"


def manual(reason: str) -> dict:
    return {"schema": SCHEMA, "status": "MANUAL", "reason": reason,
            "geometry_verified": False, "color_verified": False,
            "production_approved": False, "training_ready": False}


def positive_number(number) -> bool:
    return type(number) in (int, float) and math.isfinite(number) and number > 0


def rect_points(value):
    try:
        coords = [value.x0, value.y0, value.x1, value.y1]
    except (TypeError, AttributeError, ValueError, OverflowError):
        return None
    # Reject booleans and numeric strings rather than coercing PDF geometry.
    if any(type(x) not in (int, float) for x in coords):
        return None
    return coords if all(math.isfinite(x) for x in coords) and (
        coords[2] >= coords[0] and coords[3] >= coords[1]
    ) else None


def audit_document(pdf_path: Path, *, engine=None,
                   exploratory_stroke_mm: float = 0.1,
                   exploratory_fill_bbox_mm: float = 0.15) -> dict:
    """Inspect only a signed, local source file; accepts an injected fake
    engine in CI. The proposed stroke threshold is exploratory, NOT a
    technology-specific print specification.
    """
    if not positive_number(exploratory_stroke_mm) or exploratory_stroke_mm > 2:
        return manual("STROKE_THRESHOLD_INVALID")
    if not positive_number(exploratory_fill_bbox_mm) or exploratory_fill_bbox_mm > 2:
        return manual("FILLED_BBOX_THRESHOLD_INVALID")
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
            thin_candidates_total = 0
            narrow_fills = []
            narrow_fills_total = 0
            stroke_paths = 0
            filled_paths = 0
            hairlines = 0
            beziers = 0
            for path in drawings:
                if not isinstance(path, dict):
                    return manual("PDF_PATH_STRUCTURE_UNSUPPORTED")
                kind = path.get("type", "")
                if type(kind) is not str or kind not in ("s", "f", "fs"):
                    return manual("PDF_PATH_TYPE_UNSUPPORTED")
                items = path.get("items")
                if not isinstance(items, (list, tuple)) or len(items) > MAX_ITEMS_PER_PATH or any(
                    not isinstance(item, (list, tuple)) or not item or
                    type(item[0]) is not str or item[0] not in ("l", "c", "re", "qu")
                    for item in items
                ):
                    return manual("PDF_PATH_ITEMS_UNSUPPORTED")
                if kind in ("s", "fs"):
                    stroke_paths += 1
                    stroke = path.get("width")
                    if stroke is None:
                        continue
                    if type(stroke) not in (float, int) or not math.isfinite(stroke) or stroke < 0:
                        return manual("PDF_STROKE_WIDTH_INVALID")
                    if stroke == 0:
                        hairlines += 1
                    elif stroke * POINT_MM < exploratory_stroke_mm:
                        bbox = rect_points(path.get("rect"))
                        if bbox is not None:
                            thin_candidates_total += 1
                            if len(thin) < MAX_CANDIDATES_PER_PAGE:
                                thin.append({
                                "page_number": page_num,
                                "bbox_page_pt": [round(v, 4) for v in bbox],
                                "nominal_stroke_mm": round(stroke * POINT_MM, 5),
                                "candidate_only": True
                            })
                if kind in ("f", "fs"):
                    filled_paths += 1
                    # Bounding boxes are not equivalent to actual minimum ink
                    # feature width: Bezier clips, overlaps and transparencies
                    # remain unknown. Retain them only as review candidates.
                    box = rect_points(path.get("rect"))
                    if box is not None:
                        bwidth = (box[2] - box[0]) * POINT_MM
                        bheight = (box[3] - box[1]) * POINT_MM
                        if min(bwidth, bheight) < exploratory_fill_bbox_mm:
                            narrow_fills_total += 1
                            if len(narrow_fills) < MAX_FILLED_CANDIDATES_PER_PAGE:
                                narrow_fills.append({
                                    "page_number": page_num,
                                    "bbox_page_pt": [round(v, 4) for v in box],
                                    "bbox_min_dimension_mm": round(min(bwidth, bheight), 5),
                                    "bbox_max_dimension_mm": round(max(bwidth, bheight), 5),
                                    "candidate_kind": "narrow_filled_bbox",
                                    "actual_ink_feature_width_verified": False,
                                    "candidate_only": True
                                })
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
                "thin_stroke_candidates_truncated": thin_candidates_total > MAX_CANDIDATES_PER_PAGE,
                "narrow_filled_bbox_candidates": narrow_fills,
                "narrow_filled_bbox_candidates_truncated": narrow_fills_total > MAX_FILLED_CANDIDATES_PER_PAGE,
                "unit_for_boxes": "pdf_page_pt"
            })
        return {"schema": SCHEMA, "status": "RESEARCH_ONLY",
                "page_count": len(pages), "pages": pages,
                "exploratory_stroke_threshold_mm": exploratory_stroke_mm,
                "exploratory_filled_bbox_threshold_mm": exploratory_fill_bbox_mm,
                "narrow_filled_bbox_is_actual_ink_feature_width": False,
                "clipping_and_paint_order_verified": False,
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
                 exploratory_stroke_mm: float = 0.1,
                 exploratory_fill_bbox_mm: float = 0.15) -> dict:
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
    # Analyze exactly the bytes verified against the private manifest.
    # A source replacement after hashing must not change the engine input.
    # Keep the bounded snapshot private and delete it even on backend failure.
    checksum = hashlib.sha256()
    total = 0
    snapshot_path = None
    try:
        with tempfile.TemporaryDirectory(prefix="vision-pdf-", dir=root) as private_dir:
            if os.name == "posix":
                os.chmod(private_dir, 0o700)
            snapshot_path = Path(private_dir) / "verified.pdf"
            with target.open("rb") as source, snapshot_path.open("xb") as snapshot:
                if os.name == "posix":
                    os.chmod(snapshot_path, 0o600)
                while chunk := source.read(1024 * 1024):
                    total += len(chunk)
                    if total > MAX_FILE:
                        return manual("PDF_SIZE_OR_SOURCE_INVALID")
                    checksum.update(chunk)
                    snapshot.write(chunk)
            if checksum.hexdigest() != digest:
                return manual("SOURCE_SHA256_MISMATCH")
            out = audit_document(snapshot_path, engine=engine,
                                 exploratory_stroke_mm=exploratory_stroke_mm,
                                 exploratory_fill_bbox_mm=exploratory_fill_bbox_mm)
    except OSError:
        return manual("SAMPLE_PATH_UNSAFE")
    out["sample_id"] = sample_id
    return out


def audit_all_samples(root: Path, *, engine=None,
                      exploratory_stroke_mm: float = 0.1,
                      exploratory_fill_bbox_mm: float = 0.15,
                      on_progress=None) -> dict:
    """Process ALL local imported PDFs sequentially, without a file-count cap.

    Each result is atomically written to a private report filename based on a
    SHA256 of its local sample ID. Reports contain no PDF text, source filename,
    order URL, cookies or raw file bytes. Not a model-training pipeline.
    """
    root = root.resolve()
    report_dir = root / "reports" / "pdf-audits"
    if (report_dir.is_symlink() or
        any(p.is_symlink() for p in (root / "reports", root))):
        return manual("REPORT_DIRECTORY_SYMLINK_DENIED")
    # New private reports directory must not be traversable by other local users.
    # Existing directory permissions are not silently changed.
    try:
        report_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
        directory_mode = report_dir.stat().st_mode
    except OSError:
        # Never expose filesystem exception strings containing private paths.
        return manual("REPORT_DIRECTORY_UNAVAILABLE")
    if not stat.S_ISDIR(directory_mode):
        return manual("REPORT_DIRECTORY_UNAVAILABLE")
    # Refuse pre-existing group/world-accessible report directories on POSIX.
    # Never silently chmod a directory that may belong to another workflow.
    if os.name == "posix" and (report_dir.stat().st_mode & 0o077):
        return manual("REPORT_DIRECTORY_PERMISSIONS_UNSAFE")
    with lab.open_db(root) as db:
        samples = db.execute("SELECT id,source_sha256 FROM samples "
                             "WHERE extension='pdf' ORDER BY id").fetchall()
    stats = Counter()
    processed = 0
    total = len(samples)
    for sample_id, source_sha in samples:
        try:
            result = audit_sample(root, sample_id, engine=engine,
                exploratory_stroke_mm=exploratory_stroke_mm,
                exploratory_fill_bbox_mm=exploratory_fill_bbox_mm)
        except Exception:
            # No path, source content or backend error text may escape.
            result = manual("PDF_LOCAL_SOURCE_READ_ERROR")
            result["sample_id"] = sample_id
        result["source_sha256"] = source_sha
        result["local_report_schema"] = "printcheck.vision.local-batch-pdf.v1"
        name = hashlib.sha256(sample_id.encode("utf-8")).hexdigest() + ".json"
        dest = report_dir / name
        tmp_path = None
        try:
            with tempfile.NamedTemporaryFile(mode="w",encoding="utf-8",
                    dir=report_dir,prefix="audit-",suffix=".tmp",
                    delete=False) as stream:
                tmp_path = Path(stream.name)
                json.dump(result, stream, ensure_ascii=False, indent=2,
                          allow_nan=False)
                stream.write("\n")
            os.replace(tmp_path, dest)
        finally:
            if tmp_path is not None and tmp_path.exists():
                tmp_path.unlink()
        processed += 1
        stats[result.get("reason") or result["status"]] += 1
        if on_progress is not None:
            on_progress(processed,total,result["status"])
    return {
        "schema":"printcheck.vision.local-pdf-batch-summary.v1",
        "total_pdf_samples":total, "processed":processed,
        "status_counts":dict(sorted(stats.items())),
        "production_approved":False,
        "training_ready":False,
        "remote_uploads":False
    }


def main(argv=None):
    p = argparse.ArgumentParser(description="Optional local PDF vector path audit — never an approval")
    p.add_argument("--root", default=r"D:\VisionCheckLab")
    p.add_argument("--sample-id")
    p.add_argument("--all",action="store_true",
                   help="Audit all imported local PDFs sequentially")
    p.add_argument("--exploratory-stroke-mm", type=float, default=.1)
    p.add_argument("--exploratory-fill-bbox-mm", type=float, default=.15)
    args = p.parse_args(argv)
    if args.all:
        if args.sample_id:
            p.error("--all and --sample-id cannot be combined")
        result = audit_all_samples(Path(args.root),
            exploratory_stroke_mm=args.exploratory_stroke_mm,
            exploratory_fill_bbox_mm=args.exploratory_fill_bbox_mm,
            on_progress=lambda index,total,status:
                print(f"PDF audit {index}/{total}: {status}",file=sys.stderr))
    else:
        if not args.sample_id:
            p.error("--sample-id is required unless --all is used")
        result = audit_sample(Path(args.root), args.sample_id,
            exploratory_stroke_mm=args.exploratory_stroke_mm,
            exploratory_fill_bbox_mm=args.exploratory_fill_bbox_mm)
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
