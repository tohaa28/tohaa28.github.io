#!/usr/bin/env python3
"""Local-only, append-only ROI review workflow for Vision Check.

Separate independent votes from initial proposed rectangles. No private art,
order details, sample paths or user names go to a remote endpoint. Neither
consensus nor adjudication alone authorizes supervised training.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import hashlib
import math
from pathlib import Path
import re
import secrets
import sqlite3

import vision_local_lab as lab

KINDS = frozenset(("thin_line", "narrow_gap", "tiny_object", "overprint", "other"))
VERDICTS = frozenset(("confirmed_defect", "false_positive", "uncertain"))
UNITS = frozenset(("svg_document_mm", "pdf_page_pt", "raster_pixel"))
EXPERT = re.compile(r"[A-Za-z0-9_-]{2,36}\Z")
TECHNOLOGY = re.compile(r"[A-Za-z0-9_-]{2,64}\Z")


def timestamp() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat()


def initialize(db: sqlite3.Connection) -> None:
    db.executescript("""
    CREATE TABLE IF NOT EXISTS roi_cases (
      id TEXT PRIMARY KEY,
      sample_id TEXT NOT NULL REFERENCES samples(id),
      source_sha256 TEXT NOT NULL,
      proposer TEXT NOT NULL,
      kind TEXT NOT NULL,
      technology TEXT NOT NULL,
      units TEXT NOT NULL,
      page_number INTEGER,
      x REAL NOT NULL, y REAL NOT NULL,
      width REAL NOT NULL, height REAL NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS roi_votes (
      case_id TEXT NOT NULL REFERENCES roi_cases(id),
      expert TEXT NOT NULL,
      verdict TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY(case_id, expert)
    );
    CREATE TABLE IF NOT EXISTS roi_adjudications (
      case_id TEXT PRIMARY KEY REFERENCES roi_cases(id),
      expert TEXT NOT NULL,
      verdict TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS roi_cases_sample ON roi_cases(sample_id);
    """)
    db.commit()


def ensure_expert(value: str) -> None:
    if not isinstance(value, str) or not EXPERT.fullmatch(value):
        raise ValueError("EXPERT_ID_INVALID")



def verify_original(root: Path, relative: str, expected_sha256: str) -> None:
    """Reject modified or substituted local originals before recording a vote."""
    base = (root / "samples").resolve()
    candidate = root / relative
    actual = candidate.resolve()
    try:
        actual.relative_to(base)
    except ValueError as exc:
        raise ValueError("SOURCE_PATH_UNSAFE") from exc
    if any(p.is_symlink() for p in (candidate, *candidate.parents)) or (
        not actual.is_file() or actual.stat().st_size > lab.MAX_FILE
    ):
        raise ValueError("SOURCE_PATH_UNSAFE")
    # Bound memory regardless of file size; re-check the byte count during read.
    digest = hashlib.sha256()
    total = 0
    try:
        with actual.open("rb") as source:
            while chunk := source.read(1024 * 1024):
                total += len(chunk)
                if total > lab.MAX_FILE:
                    raise ValueError("SOURCE_PATH_UNSAFE")
                digest.update(chunk)
    except OSError as exc:
        raise ValueError("SOURCE_PATH_UNSAFE") from exc
    if digest.hexdigest() != expected_sha256:
        raise ValueError("SOURCE_SHA256_MISMATCH")


def propose(root: Path, *, sample_id: str, expert: str, kind: str,
            technology: str, units: str, x: float, y: float,
            width: float, height: float, page_number: int | None = None) -> str:
    ensure_expert(expert)
    if kind not in KINDS or units not in UNITS or not TECHNOLOGY.fullmatch(technology):
        raise ValueError("ROI_CLASS_OR_TECHNOLOGY_INVALID")
    if any(type(n) not in (int, float) or not math.isfinite(n)
           for n in (x, y, width, height)):
        raise ValueError("ROI_NONFINITE")
    if x < 0 or y < 0 or width <= 0 or height <= 0:
        raise ValueError("ROI_GEOMETRY_INVALID")
    if (units == "pdf_page_pt") != (type(page_number) is int and page_number >= 1):
        raise ValueError("PDF_PAGE_NUMBER_REQUIRED")
    with lab.open_db(root) as db:
        initialize(db)
        sample = db.execute("SELECT source_sha256, extension, relative_path FROM samples "
                            "WHERE id=?", (sample_id,)).fetchone()
        if not sample:
            raise ValueError("SAMPLE_ID_NOT_FOUND")
        digest, extension, relative = sample
        verify_original(root, relative, digest)
        if (extension == "pdf") != (units == "pdf_page_pt"):
            raise ValueError("ROI_UNIT_FORMAT_MISMATCH")
        if extension == "svg" and units != "svg_document_mm":
            raise ValueError("ROI_UNIT_FORMAT_MISMATCH")
        if extension in ("png", "jpg", "jpeg", "webp") and units != "raster_pixel":
            raise ValueError("ROI_UNIT_FORMAT_MISMATCH")
        if extension not in ("pdf", "svg", "png", "jpg", "jpeg", "webp"):
            raise ValueError("ROI_FORMAT_NOT_READY")
        # No file contents, customer paths or names are stored in review events.
        case_id = "roi_" + secrets.token_hex(12)
        db.execute("""INSERT INTO roi_cases
            (id,sample_id,source_sha256,proposer,kind,technology,units,
             page_number,x,y,width,height,created_at)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (case_id, sample_id, digest, expert, kind, technology, units,
             page_number, x, y, width, height, timestamp()))
    return case_id


def vote(root: Path, *, case_id: str, expert: str, verdict: str) -> None:
    ensure_expert(expert)
    if verdict not in VERDICTS:
        raise ValueError("REVIEW_VERDICT_INVALID")
    with lab.open_db(root) as db:
        initialize(db)
        row = db.execute("""SELECT c.proposer,s.relative_path,c.source_sha256
                            FROM roi_cases c JOIN samples s ON s.id=c.sample_id
                            WHERE c.id=?""", (case_id,)).fetchone()
        if row is None:
            raise ValueError("ROI_CASE_NOT_FOUND")
        verify_original(root, row[1], row[2])
        if row[0] == expert:
            raise ValueError("REVIEWER_MUST_BE_INDEPENDENT")
        count = db.execute("SELECT COUNT(*) FROM roi_votes WHERE case_id=?",
                           (case_id,)).fetchone()[0]
        if count >= 2:
            raise ValueError("TWO_INDEPENDENT_REVIEWS_ALREADY_COMPLETE")
        try:
            db.execute("INSERT INTO roi_votes VALUES (?,?,?,?)",
                       (case_id, expert, verdict, timestamp()))
        except sqlite3.IntegrityError as exc:
            raise ValueError("DUPLICATE_EXPERT_REVIEW") from exc


def adjudicate(root: Path, *, case_id: str, expert: str, verdict: str) -> None:
    ensure_expert(expert)
    if verdict not in VERDICTS:
        raise ValueError("REVIEW_VERDICT_INVALID")
    with lab.open_db(root) as db:
        initialize(db)
        found = db.execute("""SELECT c.proposer,s.relative_path,c.source_sha256
                             FROM roi_cases c JOIN samples s ON s.id=c.sample_id
                             WHERE c.id=?""", (case_id,)).fetchone()
        if not found:
            raise ValueError("ROI_CASE_NOT_FOUND")
        verify_original(root, found[1], found[2])
        rows = db.execute("SELECT expert,verdict FROM roi_votes WHERE case_id=?",
                          (case_id,)).fetchall()
        if len(rows) != 2 or rows[0][1] == rows[1][1]:
            raise ValueError("ADJUDICATION_REQUIRES_TWO_DISAGREEING_REVIEWS")
        if expert == found[0] or expert in (rows[0][0], rows[1][0]):
            raise ValueError("ADJUDICATOR_MUST_BE_INDEPENDENT")
        try:
            db.execute("INSERT INTO roi_adjudications VALUES (?,?,?,?)",
                       (case_id, expert, verdict, timestamp()))
        except sqlite3.IntegrityError as exc:
            raise ValueError("ADJUDICATION_ALREADY_EXISTS") from exc


def queue(root: Path) -> list[dict]:
    with lab.open_db(root) as db:
        initialize(db)
        cases = db.execute("""SELECT id,sample_id,source_sha256,kind,technology,
                                     units,page_number,x,y,width,height
                              FROM roi_cases ORDER BY created_at,id""").fetchall()
        result = []
        for (case_id, sample_id, digest, kind, technology, units, page,
             x, y, width, height) in cases:
            votes = db.execute("SELECT verdict FROM roi_votes WHERE case_id=? "
                               "ORDER BY expert", (case_id,)).fetchall()
            adjudicated = db.execute("SELECT verdict FROM roi_adjudications WHERE case_id=?",
                                     (case_id,)).fetchone()
            verdicts = [v[0] for v in votes]
            if len(verdicts) == 0:
                state = "NEEDS_TWO_INDEPENDENT_REVIEWS"
            elif len(verdicts) == 1:
                state = "NEEDS_SECOND_INDEPENDENT_REVIEW"
            elif len(set(verdicts)) == 1:
                state = "CONSENSUS_RESEARCH_ONLY"
            elif adjudicated:
                state = "ADJUDICATED_RESEARCH_ONLY"
            else:
                state = "DISAGREEMENT_NEEDS_ADJUDICATION"
            final = (adjudicated[0] if adjudicated else
                     verdicts[0] if len(verdicts) == 2 and verdicts[0] == verdicts[1]
                     else None)
            result.append({
                "case_id": case_id, "sample_id": sample_id,
                "source_sha256": digest,
                "kind": kind, "technology": technology, "units": units,
                "page_number": page, "x": x, "y": y,
                "width": width, "height": height,
                "review_count": len(verdicts), "state": state,
                "adjudicated": bool(adjudicated), "research_label": final,
                "physical_scale_verified": False,
                "family_holdout_verified": False,
                "training_approved": False
            })
    return result


def summary(root: Path) -> dict:
    items = queue(root)
    return {
        "schema": "printcheck.vision.roi-review-queue.v1",
        "total_cases": len(items),
        "needs_review": sum(x["review_count"] < 2 for x in items),
        "disagreements": sum(x["state"] == "DISAGREEMENT_NEEDS_ADJUDICATION" for x in items),
        "consensus_research_only": sum(x["state"] == "CONSENSUS_RESEARCH_ONLY" for x in items),
        "adjudicated_research_only": sum(x["state"] == "ADJUDICATED_RESEARCH_ONLY" for x in items),
        "training_approved": 0,
        "automatic_training_enabled": False
    }



def prioritized_review_queue(root: Path, limit: int = 200) -> list[dict]:
    """Active-learning *review selection* only, never model fitting.

    Deterministic ordering: unresolved disagreements, second opinions,
    proposed regions without votes, then source samples needing proposals.
    No filenames, image bytes, order IDs or customer URLs are returned.
    Same-hash duplicates are explicitly flagged for family holdout.
    """
    if type(limit) is not int or not 1 <= limit <= 1000:
        raise ValueError("REVIEW_QUEUE_LIMIT_INVALID")
    cases = queue(root)
    priorities = {
        "DISAGREEMENT_NEEDS_ADJUDICATION": (0, "ADJUDICATOR_REQUIRED"),
        "NEEDS_SECOND_INDEPENDENT_REVIEW": (1, "SECOND_REVIEW_REQUIRED"),
        "NEEDS_TWO_INDEPENDENT_REVIEWS": (2, "INDEPENDENT_REVIEWERS_REQUIRED")
    }
    tasks = [
        {"priority": priorities[c["state"]][0],
         "reason": priorities[c["state"]][1],
         "case_id": c["case_id"], "sample_id": c["sample_id"],
         "source_sha256": c["source_sha256"],
         "training_approved": False}
        for c in cases if c["state"] in priorities
    ]
    existing_samples = {c["sample_id"] for c in cases}
    with lab.open_db(root) as db:
        rows = db.execute("""SELECT id,source_sha256,extension,row_label
                             FROM samples ORDER BY id""").fetchall()
    from collections import Counter
    duplicate_counts = Counter(r[1] for r in rows)
    for sample_id, digest, extension, label in rows:
        if sample_id in existing_samples:
            continue
        reason = ("PDF_VECTOR_AUDIT_REQUIRED" if extension == "pdf"
                  else "EXPERT_ROI_PROPOSAL_REQUIRED")
        tasks.append({
            "priority": 3 if label == "confirmed_defect" else 4,
            "reason": "ROW_LABEL_NEEDS_OBJECT_ROI" if label == "confirmed_defect"
                      else reason,
            "sample_id": sample_id, "case_id": None,
            "source_sha256": digest,
            "source_format": extension,
            "duplicate_sha256_group": duplicate_counts[digest] > 1,
            "training_approved": False
        })
    tasks.sort(key=lambda t: (t["priority"], t["sample_id"], t["case_id"] or ""))
    return tasks[:limit]


def main(argv=None):
    p = argparse.ArgumentParser(description="Vision local independent ROI reviews; no automatic training")
    p.add_argument("command", choices=("propose", "vote", "adjudicate", "queue", "summary", "prioritize"))
    p.add_argument("--root", default=r"D:\VisionCheckLab")
    p.add_argument("--sample-id")
    p.add_argument("--case-id")
    p.add_argument("--expert")
    p.add_argument("--kind", choices=sorted(KINDS))
    p.add_argument("--technology", default="unspecified")
    p.add_argument("--units", choices=sorted(UNITS))
    p.add_argument("--page-number", type=int)
    p.add_argument("--x", type=float)
    p.add_argument("--y", type=float)
    p.add_argument("--width", type=float)
    p.add_argument("--height", type=float)
    p.add_argument("--verdict", choices=sorted(VERDICTS))
    args = p.parse_args(argv)
    root = Path(args.root).expanduser().resolve()
    if args.command == "propose":
        if any(getattr(args, f) is None for f in
               ("sample_id", "expert", "kind", "units", "x", "y", "width", "height")):
            p.error("propose requires sample-id, expert, kind, units, x/y/width/height")
        print(json.dumps({"case_id": propose(root, sample_id=args.sample_id,
          expert=args.expert, kind=args.kind, technology=args.technology,
          units=args.units, page_number=args.page_number, x=args.x, y=args.y,
          width=args.width, height=args.height), "training_approved": False}))
    elif args.command in ("vote", "adjudicate"):
        if not all((args.case_id, args.expert, args.verdict)):
            p.error("vote/adjudicate require case-id, expert, verdict")
        fn = vote if args.command == "vote" else adjudicate
        fn(root, case_id=args.case_id, expert=args.expert, verdict=args.verdict)
        print(json.dumps({"status": "RECORDED", "training_approved": False}))
    elif args.command == "queue":
        print(json.dumps(queue(root), ensure_ascii=False, indent=2))
    elif args.command == "prioritize":
        print(json.dumps(prioritized_review_queue(root), ensure_ascii=False, indent=2))
    else:
        print(json.dumps(summary(root), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
