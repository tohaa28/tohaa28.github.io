#!/usr/bin/env python3
"""Vision Check LAN lab: local-only, offline test-artwork research registry.

Read-only to remote services. Never automatically trains, uploads source
artwork or turns row-level labels into validated geometric ROI ground truth.
Usage: py -3 tools/vision_local_lab.py init --root D:\VisionCheckLab
       py -3 tools/vision_local_lab.py import --root D:\VisionCheckLab --zip FILE
       py -3 tools/vision_local_lab.py report --root D:\VisionCheckLab
       py -3 tools/vision_local_lab.py annotate --root D:\VisionCheckLab ...
       py -3 tools/vision_local_lab.py serve --root D:\VisionCheckLab
"""
from __future__ import annotations
import argparse
import datetime as dt
import hashlib
import html
import json
import os
from pathlib import Path
import re
import secrets
import shutil
import sqlite3
import sys
import tempfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlsplit
import zipfile

MAX_ZIP = 32 * 1024 * 1024
MAX_TOTAL = 24_000_000
MAX_FILE = 4_000_000
MAX_SAMPLES = 16
SCHEMA = "printcheck.vision.local-test-artwork.v0"
LABELS = {"confirmed_defect", "false_positive", "missed_defect", "expert_clear"}
FORMATS = {"svg", "pdf", "png", "jpg", "jpeg", "webp", "cdr", "eps", "ai", "bin"}
EXT_RE = re.compile(r"^samples/([0-9]{4})\.([a-z]+)$")


def utc() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat()


def root_path(value: str) -> Path:
    return Path(value).expanduser().resolve()


def open_db(root: Path) -> sqlite3.Connection:
    root.mkdir(parents=True, exist_ok=True)
    c = sqlite3.connect(root / "visionlab.sqlite3")
    c.execute("PRAGMA foreign_keys=ON")
    c.executescript("""
    CREATE TABLE IF NOT EXISTS imports (
      id TEXT PRIMARY KEY, imported_at TEXT NOT NULL, source TEXT NOT NULL,
      sample_count INTEGER NOT NULL, is_training_ready INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS samples (
      id TEXT PRIMARY KEY, import_id TEXT NOT NULL REFERENCES imports(id),
      relative_path TEXT NOT NULL, source_sha256 TEXT NOT NULL,
      source_bytes INTEGER NOT NULL, extension TEXT NOT NULL,
      row_label TEXT NOT NULL, source_row_index INTEGER,
      research_eligibility TEXT NOT NULL,
      family_key TEXT, approved_for_training INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS roi_reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sample_id TEXT NOT NULL REFERENCES samples(id),
      expert TEXT NOT NULL, kind TEXT NOT NULL, label TEXT NOT NULL,
      units TEXT NOT NULL, x REAL NOT NULL, y REAL NOT NULL,
      width REAL NOT NULL, height REAL NOT NULL,
      technology TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS roi_sample ON roi_reviews(sample_id);
    """)
    c.commit()
    return c


def init(root: Path):
    for name in ["incoming", "samples", "reports", "quarantine", "logs", "tools"]:
        (root / name).mkdir(parents=True, exist_ok=True)
    with open_db(root) as db:
        db.execute("PRAGMA user_version=1")
    cfg = root / "config.json"
    if not cfg.exists():
        cfg.write_text(json.dumps({
            "schema": "printcheck.vision.local-lab.v1",
            "allowed_test_hosts": ["psk.testgifts.local", "testgifts.local"],
            "network_access": "disabled",
            "production_approved": False,
            "automatic_training_enabled": False,
            "data_directory": str(root / "samples"),
            "family_holdout_verified": False
        }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("Local Vision Lab initialized:", root)


def verify_file(extension: str, b: bytes) -> str:
    if extension == "pdf":
        return "PDF_VECTOR_VALIDATION_REQUIRED" if b.startswith(b"%PDF-") else "REJECT_SIGNATURE"
    if extension == "png":
        return "ROI_LABELING_REQUIRED" if b.startswith(b"\x89PNG\r\n\x1a\n") else "REJECT_SIGNATURE"
    if extension in ("jpg", "jpeg"):
        return "ROI_LABELING_REQUIRED" if b.startswith(b"\xff\xd8\xff") else "REJECT_SIGNATURE"
    if extension == "webp":
        return "ROI_LABELING_REQUIRED" if b[:4] == b"RIFF" and b[8:12] == b"WEBP" else "REJECT_SIGNATURE"
    if extension == "svg":
        if len(b) > 256_000 or b"<!DOCTYPE" in b.upper() or b"<!ENTITY" in b.upper():
            return "REJECT_UNSAFE_SVG"
        try:
            import xml.etree.ElementTree as ET
            el = ET.fromstring(b)
            if el.tag != "{http://www.w3.org/2000/svg}svg":
                return "REJECT_SVG_NAMESPACE"
            if len(list(el.iter())) > 5000:
                return "REJECT_SVG_COMPLEXITY"
            return "SVG_VECTOR_ROI_LABELING_REQUIRED"
        except (ET.ParseError, ValueError):
            return "REJECT_SVG_XML"
    return "CONVERTER_REQUIRED_MANUAL"


def import_zip(root: Path, archive_path: Path) -> dict:
    init(root)
    if not archive_path.is_file() or archive_path.stat().st_size > MAX_ZIP:
        raise ValueError("ARCHIVE_SIZE_OR_FILE_INVALID")
    with zipfile.ZipFile(archive_path) as archive:
        infos = archive.infolist()
        if not infos or len(infos) > MAX_SAMPLES + 1:
            raise ValueError("ZIP_ENTRY_COUNT_INVALID")
        names = [x.filename for x in infos]
        if len(set(names)) != len(names) or names.count("manifest.json") != 1:
            raise ValueError("ZIP_DUPLICATE_OR_MISSING_MANIFEST")
        for member in infos:
            if member.is_dir() or member.flag_bits & 0x1 or member.file_size > MAX_FILE or (
                member.external_attr >> 16
            ) & 0o170000 == 0o120000:
                raise ValueError("ZIP_ENTRY_UNSAFE")
            if member.filename != "manifest.json":
                match = EXT_RE.fullmatch(member.filename)
                if not match or match.group(2) not in FORMATS:
                    raise ValueError("ZIP_FILENAME_UNSAFE")
        if sum(i.file_size for i in infos) > MAX_TOTAL + 512_000:
            raise ValueError("ZIP_EXPANDED_SIZE_LIMIT")
        manifest = json.loads(archive.read("manifest.json"))
        if manifest.get("schema") != SCHEMA or manifest.get("training_ready") is not False or (
            manifest.get("public_upload_permitted") is not False
        ):
            raise ValueError("MANIFEST_TRAINING_SCOPE_UNTRUSTED")
        items = manifest.get("samples")
        if not isinstance(items, list) or len(items) > MAX_SAMPLES or not items:
            raise ValueError("MANIFEST_SAMPLES_INVALID")
        if set(names) != {"manifest.json"} | {x.get("sample_name") for x in items if isinstance(x, dict)}:
            raise ValueError("MANIFEST_FILES_MISMATCH")
        pending = []
        for meta in items:
            name = meta.get("sample_name")
            match = EXT_RE.fullmatch(name or "")
            if not match or name not in names or meta.get("expert_label") not in LABELS:
                raise ValueError("SAMPLE_METADATA_INVALID")
            with archive.open(name) as stream:
                data = stream.read(MAX_FILE + 1)
            if not data or len(data) > MAX_FILE or len(data) != meta.get("bytes"):
                raise ValueError("SAMPLE_SIZE_INVALID")
            digest = hashlib.sha256(data).hexdigest()
            if meta.get("sha256") and meta["sha256"].lower() != digest:
                raise ValueError("SAMPLE_SHA256_MISMATCH")
            eligibility = verify_file(match.group(2), data)
            if eligibility.startswith("REJECT_"):
                raise ValueError("SAMPLE_SOURCE_UNSAFE:" + eligibility)
            pending.append((name, digest, data, meta, eligibility, match.group(2)))
    import_id = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%S") + "_" + secrets.token_hex(5)
    temp = root / "quarantine" / import_id
    final = root / "samples" / import_id
    temp.mkdir(parents=True, exist_ok=False)
    try:
        for name, _, data, _, _, _ in pending:
            (temp / Path(name).name).write_bytes(data)
        with open_db(root) as db:
            db.execute("INSERT INTO imports VALUES(?,?,?,0,0)",
                       (import_id, utc(), "browser_local_test_zip"))
            for i, (name, sha, data, meta, status, ext) in enumerate(pending, 1):
                sample_id = import_id + ":" + str(i).zfill(4)
                rel = str(Path("samples") / import_id / Path(name).name)
                db.execute("INSERT INTO samples VALUES (?,?,?,?,?,?,?,?,?,NULL,0)", (
                    sample_id, import_id, rel, sha, len(data), ext,
                    meta["expert_label"], meta.get("anonymous_row_index"), status))
            db.execute("UPDATE imports SET sample_count=? WHERE id=?",
                       (len(pending), import_id))
            temp.rename(final)
    except Exception:
        shutil.rmtree(temp, ignore_errors=True)
        if final.exists():
            shutil.rmtree(final, ignore_errors=True)
        raise
    report = {"schema": "printcheck.vision.local-lab-import.v1", "import_id": import_id,
              "source_files": len(pending), "training_ready": False,
              "eligible_for_supervised_training": False,
              "roi_annotations_verified": False,
              "note": "Test art imported locally. Expert ROI annotation and family holdout are required.",
              "formats": {f: sum(1 for item in pending if item[-1] == f)
                          for f in sorted(set(x[-1] for x in pending))}}
    path = root / "reports" / (import_id + ".json")
    path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return report


def report(root: Path) -> dict:
    with open_db(root) as db:
        items = db.execute("SELECT extension, research_eligibility, COUNT(*) FROM samples GROUP BY 1,2").fetchall()
        count = db.execute("SELECT COUNT(*) FROM samples").fetchone()[0]
        reviewed = db.execute("SELECT COUNT(DISTINCT sample_id) FROM roi_reviews").fetchone()[0]
        bad = db.execute("SELECT COUNT(*) FROM samples WHERE approved_for_training!=0").fetchone()[0]
        samehash = db.execute("SELECT COUNT(*) FROM (SELECT source_sha256 FROM samples GROUP BY 1 HAVING COUNT(*)>1)").fetchone()[0]
    return {"schema": "printcheck.vision.local-lab-report.v1",
            "root": str(root), "samples": count, "with_expert_roi": reviewed,
            "unreviewed": count - reviewed, "duplicate_sha256_groups": samehash,
            "auto_approved_training_samples": bad,
            "family_holdout_verified": False, "production_approved": False,
            "formats": [{"extension": ext, "status": status, "count": number}
                        for ext, status, number in items]}


def list_samples(root: Path) -> list[dict]:
    with open_db(root) as db:
        rows = db.execute("""SELECT id,relative_path,source_sha256,extension,
          row_label,research_eligibility FROM samples ORDER BY import_id,id""").fetchall()
    return [{"sample_id": sample_id, "path": path, "sha256": sha,
             "format": ext, "row_label": label, "research_status": research_state,
             "training_approved": False} for
            sample_id, path, sha, ext, label, research_state in rows]


def annotate(root: Path, args):
    import math
    for key in ("x", "y", "width", "height"):
        if not math.isfinite(getattr(args, key)):
            raise ValueError("ROI_NONFINITE")
    if args.width <= 0 or args.height <= 0 or args.x < 0 or args.y < 0:
        raise ValueError("ROI_GEOMETRY_INVALID")
    if not re.fullmatch(r"[A-Za-z0-9_-]{2,36}", args.expert):
        raise ValueError("EXPERT_ID_INVALID")
    with open_db(root) as db:
        exists = db.execute("SELECT id FROM samples WHERE id=?", (args.sample_id,)).fetchone()
        if not exists:
            raise ValueError("SAMPLE_ID_NOT_FOUND")
        db.execute("""INSERT INTO roi_reviews
          (sample_id,expert,kind,label,units,x,y,width,height,technology,created_at)
          VALUES(?,?,?,?,?,?,?,?,?,?,?)""", (
              args.sample_id, args.expert, args.kind, args.label, args.units,
              args.x, args.y, args.width, args.height, args.technology, utc()))
    print("ROI annotation saved. Training approval remains FALSE.")


def serve(root: Path, port: int):
    if not 1024 <= port <= 65535:
        raise ValueError("INVALID_PORT")
    secret = secrets.token_urlsafe(24)
    with open_db(root):
        pass

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            path = urlsplit(self.path)
            query = parse_qs(path.query)
            if query.get("token") != [secret]:
                self.send_error(403, "Local session token required")
                return
            if path.path not in ("/", "/report"):
                self.send_error(404)
                return
            content = report(root)
            rows = "".join(
                "<tr><td>" + html.escape(x["extension"]) + "</td><td>" +
                html.escape(x["status"]) + "</td><td>" +
                str(x["count"]) + "</td></tr>" for x in content["formats"])
            sample_rows = "".join(
                "<tr><td>" + html.escape(item["sample_id"]) + "</td><td>" +
                html.escape(item["format"]) + "</td><td>" +
                html.escape(item["research_status"]) + "</td><td>" +
                html.escape(item["row_label"]) + "</td></tr>" for item in list_samples(root)[:200])
            body = ("<!doctype html><meta charset=utf-8><title>Vision Lab local</title>"
                    "<style>body{font:16px system-ui;max-width:850px;margin:40px auto}"
                    "td,th{border:1px solid #ddd;padding:9px}table{border-collapse:collapse}</style>"
                    "<h1>Vision Check Lab — private localhost</h1>"
                    "<p>Samples: " + str(content["samples"]) + " | ROI reviewed: " +
                    str(content["with_expert_roi"]) + " | unreviewed: " +
                    str(content["unreviewed"]) + "</p>"
                    "<p><strong>Training approval: FALSE. Family holdout: not proven.</strong></p>"
                    "<table><tr><th>Format</th><th>Research state</th><th>Count</th></tr>" +
                    rows + "</table><h2>Research samples</h2><table>"
                    "<tr><th>Sample ID</th><th>Format</th><th>State</th><th>Expert row label</th></tr>" +
                    sample_rows + "</table>"
                    "<p>Raw artwork is not served to browser. Use CLI for review/annotation.</p>")
            encoded = body.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'")
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("Content-Length", str(len(encoded)))
            self.end_headers()
            self.wfile.write(encoded)
        def log_message(self, format, *args):
            pass
    url = "http://127.0.0.1:" + str(port) + "/?token=" + secret
    print("Local read-only dashboard:", url)
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.server_close()


def main(argv=None):
    parser = argparse.ArgumentParser(description="Vision Local Research Lab — no network uploads")
    parser.add_argument("command", choices=["init", "import", "report", "list", "annotate", "serve"])
    parser.add_argument("--root", default=r"D:\VisionCheckLab" if os.name == "nt" else "./VisionCheckLab")
    parser.add_argument("--zip")
    parser.add_argument("--sample-id")
    parser.add_argument("--expert")
    parser.add_argument("--kind", choices=["thin_line", "narrow_gap", "tiny_object", "other"])
    parser.add_argument("--label", choices=["confirmed_defect", "false_positive", "expert_clear", "uncertain"])
    parser.add_argument("--units", choices=["svg_document_mm", "raster_pixel", "pdf_page_pt"])
    parser.add_argument("--x", type=float)
    parser.add_argument("--y", type=float)
    parser.add_argument("--width", type=float)
    parser.add_argument("--height", type=float)
    parser.add_argument("--technology", default="unspecified")
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args(argv)
    root = root_path(args.root)
    if args.command == "init":
        init(root)
    elif args.command == "import":
        if not args.zip:
            parser.error("--zip is required")
        print(json.dumps(import_zip(root, Path(args.zip)), ensure_ascii=False, indent=2))
    elif args.command == "report":
        print(json.dumps(report(root), ensure_ascii=False, indent=2))
    elif args.command == "list":
        print(json.dumps(list_samples(root), ensure_ascii=False, indent=2))
    elif args.command == "annotate":
        if any(getattr(args, name) is None for name in
               ("sample_id", "expert", "kind", "label", "units", "x", "y", "width", "height")):
            parser.error("ROI sample-id/expert/kind/label/units/x/y/width/height required")
        annotate(root, args)
    elif args.command == "serve":
        serve(root, args.port)


if __name__ == "__main__":
    try:
        main()
    except (ValueError, FileNotFoundError, sqlite3.Error, zipfile.BadZipFile) as error:
        print("MANUAL:", error, file=sys.stderr)
        raise SystemExit(2)
