#!/usr/bin/env python3
"""Private offline transformation: native order approvals -> linked Vision candidates.

Inputs: vision-private-approval-evidence-<order>.json and original numbered ZIPs.
No remote I/O. Files/text stay in the selected PRIVATE local output directory.
Designer claims, checkboxes and screenshots are NOT model ground truth.
"""
import argparse
from collections import Counter
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import sys
import zipfile

from vision_approval_archive_audit import AuditError, audit_archives, read_json

SCHEMA = "printcheck.vision.private-approval-collection.v1"
DATASET = "printcheck.vision.training-candidates.v1"
ZIP = re.compile(r"vision-private-approval-attachments-(\d{5,12})-part-(\d{4})\.zip\Z")
NUM = re.compile(r"[0-9]{1,20}\Z")
TABLES = ("orders", "articles", "messages", "problems", "assets",
          "relations", "cases", "review_queue")

class CorpusError(ValueError):
    """Public-safe code only, no private source values."""

def need(value, reason):
    if not value:
        raise CorpusError(reason)

def sha(bytes_):
    return hashlib.sha256(bytes_).hexdigest()

def ref(kind, *parts):
    return kind + "_" + sha(("/".join((DATASET, kind, *(str(p) for p in parts)))).encode())[:24]

def private_write(path, contents):
    handle = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(handle, "wb") as file:
        file.write(contents)

def jsonl(rows):
    return ("".join(json.dumps(x, ensure_ascii=False, sort_keys=True) + "\n"
                    for x in rows)).encode("utf-8")

def transform(evidences, archives, output):
    need(1 <= len(evidences) <= 500, "EVIDENCE_COUNT_INVALID")
    by_order, by_zip = {}, {}
    for path in evidences:
        path = Path(path)
        need(path.is_file() and path.stat().st_size <= 25_000_000,
             "EVIDENCE_FILE_INVALID")
        raw = path.read_bytes()
        report = read_json(raw)
        order = report.get("order_number") if isinstance(report, dict) else None
        need(isinstance(order, str) and re.fullmatch(r"\d{5,12}", order),
             "ORDER_NUMBER_INVALID")
        need(report.get("schema") == SCHEMA and
             report.get("training_ready") is False and
             report.get("production_approved") is False and
             report.get("remote_upload") is False and
             isinstance(report.get("articles"), list) and
             len(report["articles"]) <= 100, "EVIDENCE_CONTRACT_INVALID")
        need(order not in by_order, "DUPLICATE_EVIDENCE_ORDER")
        by_order[order] = (path, raw, report)
    for file in archives:
        file = Path(file)
        match = ZIP.fullmatch(file.name)
        need(match is not None and match[1] in by_order,
             "ARCHIVE_ORDER_OR_NAME_INVALID")
        need(file.is_file(), "ARCHIVE_UNAVAILABLE")
        by_zip.setdefault(match[1], []).append(file)
    # Verify all available ZIP parts and exact message attachment links BEFORE
    # the first output write. The existing auditor checks SHA, sizes, paths,
    # duplicate JSON keys, source scope and attachment-to-message identity.
    for order, parts in by_zip.items():
        audit_archives(parts, by_order[order][0])
    out = Path(output)
    need(not out.is_symlink() and not out.exists(),
         "OUTPUT_MUST_NOT_EXIST")
    out.mkdir(parents=True, mode=0o700)
    if os.name == "posix":
        os.chmod(out, 0o700)
    (out / "raw").mkdir(mode=0o700)
    (out / "assets").mkdir(mode=0o700)
    rows = {table: [] for table in TABLES}
    missing = verified = 0
    for order in sorted(by_order):
        _, raw, report = by_order[order]
        raw_name = f"raw/evidence-{order}.json"
        private_write(out / raw_name, raw)
        oid = ref("order", order)
        rows["orders"].append({"id": oid, "order_number": order,
            "original_evidence": raw_name, "evidence_sha256": sha(raw),
            "capture_scope": report.get("scope"),
            "collection_status": report.get("status"), "ground_truth": False})
        byte_lookup = {}
        for src in sorted(by_zip.get(order, [])):
            part = int(ZIP.fullmatch(src.name)[2])
            raw_zip = f"raw/attachments-{order}-part-{part:04d}.zip"
            private_write(out / raw_zip, src.read_bytes())
            with zipfile.ZipFile(src, "r") as zip_file:
                manifest = read_json(zip_file.read("manifest.json"))
                for entry in manifest["items"]:
                    key = (part, entry["entry"])
                    need(key not in byte_lookup, "ARCHIVE_DUPLICATE_BINARY")
                    byte_lookup[key] = (zip_file.read(entry["entry"]), raw_zip)
        for i, article in enumerate(report["articles"], 1):
            need(isinstance(article, dict), "ARTICLE_INVALID")
            item = article.get("item_id")
            need(item is None or isinstance(item, str) and NUM.fullmatch(item),
                 "ARTICLE_ITEM_ID_INVALID")
            item_key = item or f"unresolved-{i}"
            aid = ref("article", order, item_key, i)
            rows["articles"].append({"id": aid, "order_id": oid,
                "order_number": order, "item_id": item, "article_index": i,
                "capture_status": article.get("status"),
                "native_trigger_index": article.get("article_index"),
                "message_badge": article.get("declared_message_badge"),
                "observed_human_comments": article.get("observed_human_comments"),
                "additional_problem_description": article.get(
                    "additional_problem_description", ""),
                "source_pdf_revision_verified": False, "ground_truth": False})
            rows["relations"].append({"from": oid, "type": "order_has_article", "to": aid})
            message_ids, asset_ids, problem_ids = [], [], []
            reasons = ["SOURCE_ARTWORK_REVISION_UNKNOWN",
                       "PRINT_METHOD_AND_SCALE_UNVERIFIED",
                       "DEFECT_ROI_UNANNOTATED", "EXPERT_VERDICT_MISSING"]
            if article.get("status") != "PRIVATE_REVIEW_ONLY":
                reasons.append("HISTORY_UNVERIFIED")
            problems = article.get("current_problems") or []
            history = article.get("history") or []
            need(isinstance(problems, list) and len(problems) <= 100,
                 "PROBLEMS_COUNT_INVALID")
            need(isinstance(history, list) and len(history) <= 1500,
                 "MESSAGES_COUNT_INVALID")
            for pidx, problem in enumerate(problems, 1):
                need(isinstance(problem, dict), "PROBLEM_RECORD_INVALID")
                pid = ref("problem", order, item_key, i, pidx)
                problem_ids.append(pid)
                rows["problems"].append({"id": pid, "article_id": aid,
                    "native_code": problem.get("code"),
                    "designer_text": problem.get("label"),
                    "print_method_text": problem.get("print_method"),
                    "print_placement_text": problem.get("print_placement"),
                    "evidence_state": "CURRENT_CHECKBOX_ONLY",
                    "historical_revision_verified": False,
                    "ground_truth": False})
                rows["relations"].append({"from": aid,
                    "type": "article_has_current_problem", "to": pid})
            last_sequence = 0
            for m in history:
                need(isinstance(m, dict), "MESSAGE_RECORD_INVALID")
                seq = m.get("sequence")
                need(type(seq) is int and last_sequence < seq <= 1500,
                     "MESSAGE_SEQUENCE_INVALID")
                last_sequence = seq
                body = m.get("text", "")
                need(isinstance(body, str) and len(body) <= 12000,
                     "MESSAGE_TEXT_INVALID")
                mid = ref("message", order, item_key, i, seq)
                rows["messages"].append({"id": mid, "article_id": aid,
                    "sequence": seq, "kind": m.get("kind"),
                    "text": body, "date_time_raw": m.get("date_time"),
                    "native_comment_id": m.get("native_comment_id"),
                    "actor_ref": m.get("actor_ref"),
                    "expert_verified": False})
                rows["relations"].append({"from": aid,
                    "type": "article_has_message", "to": mid})
                if message_ids:
                    rows["relations"].append({"from": message_ids[-1],
                        "type": "next_message", "to": mid})
                message_ids.append(mid)
                files = m.get("attachments") or []
                need(isinstance(files, list) and len(files) <= 40,
                     "ATTACHMENT_COUNT_INVALID")
                for j, attachment in enumerate(files, 1):
                    need(isinstance(attachment, dict) and
                         isinstance(attachment.get("filename"), str) and
                         1 <= len(attachment["filename"]) <= 200,
                         "ATTACHMENT_METADATA_INVALID")
                    fid = ref("attachment", order, item_key, i, seq, j)
                    key = (attachment.get("private_zip_part"),
                           attachment.get("private_zip_entry"))
                    bytes_entry = byte_lookup.get(key)
                    state = attachment.get("local_get_status") or "NOT_ATTEMPTED"
                    need(state != "LOCAL_ATTACHMENT_BYTES_ONLY" or bytes_entry is not None,
                         "VERIFIED_ATTACHMENT_MISSING")
                    need(state == "LOCAL_ATTACHMENT_BYTES_ONLY" or bytes_entry is None,
                         "UNVERIFIED_ATTACHMENT_HAS_BYTES")
                    asset_path, asset_hash, source_zip = None, None, None
                    if bytes_entry:
                        binary, source_zip = bytes_entry
                        asset_hash = sha(binary)
                        need(asset_hash == attachment.get("sha256") and
                             len(binary) == attachment.get("byte_count"),
                             "ATTACHMENT_HASH_OR_SIZE_MISMATCH")
                        ext = attachment["filename"].rsplit(".", 1)[-1].lower()
                        need(re.fullmatch(r"[a-z0-9]{2,5}", ext),
                             "ATTACHMENT_EXTENSION_INVALID")
                        asset_path = f"assets/{asset_hash}.{ext}"
                        target = out / asset_path
                        if target.exists():
                            need(sha(target.read_bytes()) == asset_hash,
                                 "DUPLICATE_ASSET_MISMATCH")
                        else:
                            private_write(target, binary)
                        verified += 1
                    else:
                        missing += 1
                    asset_ids.append(fid)
                    rows["assets"].append({"id": fid, "message_id": mid,
                        "article_id": aid, "attachment_index": j,
                        "source": attachment.get("source",
                              "native_maketadjusting_attachment_get"),
                        "native_attachment_id": attachment.get("attachment_id"),
                        "original_filename": attachment["filename"],
                        "download_status": state, "sha256": asset_hash,
                        "original_zip": source_zip, "original_zip_entry": key[1]
                          if bytes_entry else None,
                        "verified_local_file": asset_path,
                        "source_pdf_revision": None, "expert_verified": False})
                    rows["relations"].append({"from": mid,
                        "type": "message_has_attachment", "to": fid})
            if len(asset_ids) != sum(1 for r in rows["assets"] if r["article_id"] == aid and
                                     r["verified_local_file"] is not None):
                reasons.append("ATTACHMENT_BYTES_INCOMPLETE")
            cid = ref("case", order, item_key, i)
            rows["cases"].append({"id": cid, "article_id": aid,
                "order_id": oid, "message_ids": message_ids,
                "current_problem_ids": problem_ids, "attachment_ids": asset_ids,
                "source_pdf_revision": None, "annotated_rois": [],
                "expert_labels": [], "pending_reasons": reasons,
                "training_ready": False, "production_approved": False})
            rows["relations"].append({"from": aid,
                "type": "article_has_case", "to": cid})
            rows["review_queue"].append({"case_id": cid,
                "pending_reasons": reasons, "expert_verified": False,
                "training_ready": False})
    for table in TABLES:
        private_write(out / (table + ".jsonl"), jsonl(rows[table]))
    manifest = {"schema": DATASET, "scope": "LOCAL_PRIVATE_ONLY",
       "created_at_utc": datetime.now(timezone.utc).isoformat(),
       "counts": {name: len(rows[name]) for name in TABLES},
       "verified_attachment_links": verified, "missing_attachment_links": missing,
       "binary_sha256_checked": True,
       "all_cases_require_expert_revision_and_roi_review": True,
       "training_ready": False, "production_approved": False,
       "remote_upload": False, "public_git_allowed": False}
    private_write(out / "manifest.json",
                  (json.dumps(manifest, ensure_ascii=False, indent=2) + "\n").encode())
    return {"status": "PRIVATE_CANDIDATE_CORPUS_READY",
        "counts": manifest["counts"], "verified_attachment_links": verified,
        "missing_attachment_links": missing, "training_ready": False}

def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--evidence", action="append", required=True)
    ap.add_argument("--archive", action="append", default=[])
    ap.add_argument("--output", required=True)
    args = ap.parse_args()
    try:
        result = transform(args.evidence, args.archive, args.output)
    except (CorpusError, AuditError, ValueError, OSError, zipfile.BadZipFile) as exc:
        code = str(exc) if isinstance(exc, (CorpusError, AuditError)) else "LOCAL_IO_FAILED"
        result = {"status": "MANUAL_CORPUS_TRANSFORM_FAILED",
                  "reason": code, "training_ready": False}
        print(json.dumps(result))
        return 1
    print(json.dumps(result))
    return 0

if __name__ == "__main__":
    sys.exit(main())
