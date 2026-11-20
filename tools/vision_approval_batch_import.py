#!/usr/bin/env python3
"""Offline conversion: ONE Vision AI batch ZIP -> existing linked Vision JSONL corpus.

The input is the local extension's v0.1.8 one-file ZIP with direct media files.
No network is used. No customer identifiers appear in stdout.
"""
import argparse
import hashlib
import json
import re
import shutil
import sys
import tempfile
import zipfile
from collections import defaultdict
from pathlib import Path

from vision_approval_training_corpus import transform, CorpusError
from vision_approval_archive_audit import AuditError

MAX_TOTAL = 190_000_000
MAX_COUNT = 10_000
MAX_ENTRY = 26_000_000
ORD = re.compile(r"\d{5,12}\Z")
ASSET = re.compile(r"orders/(\d{5,12})/assets/([a-f0-9]{64})\.(pdf|psd|psb|png|jpg|jpeg|webp|tif|tiff|gif|svg|eps|ai|cdr|zip)\Z")
STRUCT = re.compile(r"orders/(\d{5,12})/(?:order|articles|approvals|review|files-index)\.json\Z")
SOURCE = re.compile(r"orders/(\d{5,12})/source/(?:evidence|backup)\.json\Z")
THREAD = re.compile(r"orders/(\d{5,12})/threads/\d{1,20}\.json\Z")


class BatchImportError(ValueError):
    """Private identifiers are deliberately excluded from error messages."""


def require(condition, reason):
    if not condition:
        raise BatchImportError(reason)


def safe_json(blob):
    try:
        def pairs(items):
            value = {}
            for key, item in items:
                require(key not in value, "DUPLICATE_BATCH_JSON_KEY")
                value[key] = item
            return value
        return json.loads(blob.decode("utf-8"), object_pairs_hook=pairs)
    except (ValueError, UnicodeError) as error:
        if isinstance(error, BatchImportError):
            raise
        raise BatchImportError("BATCH_JSON_INVALID") from None


def load_batch_zip(source, output):
    """Verify and stage reconstructed verified legacy evidence/ZIP parts."""
    source = Path(source)
    require(source.is_file() and not source.is_symlink()
            and source.stat().st_size <= MAX_TOTAL, "BATCH_FILE_INVALID")
    require(not Path(output).exists(), "OUTPUT_MUST_NOT_EXIST")
    with tempfile.TemporaryDirectory(prefix="vision-local-batch-") as working:
        temp = Path(working)
        evidences, archives = [], []
        with zipfile.ZipFile(source) as zf:
            infos = zf.infolist()
            require(2 <= len(infos) <= MAX_COUNT, "BATCH_ENTRIES_INVALID")
            names = [x.filename for x in infos]
            require(len(names) == len(set(names)) and
                    names[0] == "manifest.json" and
                    names[1] == "index/orders.json", "BATCH_ORDER_OR_DUPLICATE")
            declared = 0
            for info in infos:
                name = info.filename
                require((name in ("manifest.json", "index/orders.json") or
                         ASSET.fullmatch(name) or STRUCT.fullmatch(name) or
                         SOURCE.fullmatch(name) or THREAD.fullmatch(name)),
                        "BATCH_UNSAFE_ENTRY")
                require(info.compress_type == zipfile.ZIP_STORED and
                        not info.is_dir() and not info.flag_bits & 1 and
                        ((info.external_attr >> 16) & 0o170000) != 0o120000,
                        "BATCH_ENTRY_MODE")
                require(info.file_size <= MAX_ENTRY and info.compress_size == info.file_size,
                        "BATCH_ENTRY_TOO_LARGE")
                declared += info.file_size
                require(declared <= MAX_TOTAL, "BATCH_SIZE_LIMIT")
            require(zf.testzip() is None, "BATCH_CRC_INVALID")
            manifest = safe_json(zf.read("manifest.json"))
            order_index = safe_json(zf.read("index/orders.json"))
            require(manifest.get("schema") == "printcheck.vision.local-batch-corpus.v1"
                    and manifest.get("training_ready") is False
                    and manifest.get("production_approved") is False
                    and manifest.get("remote_upload") is False,
                    "BATCH_MANIFEST_UNSAFE")
            require(isinstance(order_index, list) and len(order_index) <= 500
                    and len(order_index) == manifest.get("counts", {}).get("orders"),
                    "BATCH_ORDER_INDEX_INVALID")
            ids = set()
            for record in order_index:
                require(isinstance(record, dict), "BATCH_ORDER_RECORD_INVALID")
                order = record.get("order_number")
                require(isinstance(order, str) and ORD.fullmatch(order)
                        and order not in ids, "BATCH_ORDER_ID_INVALID")
                ids.add(order)
                status = record.get("evidence_status")
                require(status in ("FINAL", "BACKUP_ONLY", "MISSING"),
                        "BATCH_EVIDENCE_STATUS_INVALID")
                if status == "MISSING":
                    continue
                prefix = f"orders/{order}/"
                evidence_name = prefix + "source/evidence.json"
                require(evidence_name in names, "BATCH_EVIDENCE_MISSING")
                report_bytes = zf.read(evidence_name)
                report = safe_json(report_bytes)
                require(report.get("schema") ==
                        "printcheck.vision.private-approval-collection.v1"
                        and report.get("order_number") == order
                        and report.get("training_ready") is False
                        and report.get("production_approved") is False
                        and report.get("remote_upload") is False,
                        "BATCH_EVIDENCE_UNSAFE")
                require(isinstance(report.get("articles"), list), "BATCH_ARTICLES_INVALID")
                if status == "BACKUP_ONLY":
                    require(not any(a.get("local_get_status") ==
                      "LOCAL_ATTACHMENT_BYTES_ONLY" for row in report["articles"]
                      for m in row.get("history", [])
                      for a in m.get("attachments", [])),
                      "BATCH_BACKUP_WITH_BINARY_LINKS")
                # Secondary ordered copies can be consumed by humans and models,
                # but the canonical original evidence is the integrity source.
                for suffix in ("order.json", "articles.json", "approvals.json",
                               "review.json", "files-index.json"):
                    require(prefix + suffix in names, "BATCH_STRUCTURED_FILE_MISSING")
                    safe_json(zf.read(prefix + suffix))
                observed_threads = {
                    prefix + "threads/" + str(row["item_id"]) + ".json"
                    for row in report["articles"]
                    if isinstance(row.get("history"), list)
                    and isinstance(row.get("item_id"), str)
                    and re.fullmatch(r"\d{1,20}", row["item_id"])
                }
                for thread in observed_threads:
                    require(thread in names, "BATCH_THREAD_MISSING")
                    detail = safe_json(zf.read(thread))
                    require(detail.get("order_number") == order,
                            "BATCH_THREAD_ORDER_MISMATCH")
                evidence_path = temp / f"vision-private-approval-evidence-{order}.json"
                evidence_path.write_bytes(report_bytes)
                evidences.append(evidence_path)
                index = safe_json(zf.read(prefix + "files-index.json"))
                require(isinstance(index, list), "BATCH_FILES_INDEX_INVALID")
                matched = set()
                attachment_parts = defaultdict(list)
                for article_num, article in enumerate(report["articles"], 1):
                    item = article.get("item_id")
                    for message in article.get("history", []):
                        for a in message.get("attachments", []):
                            if a.get("local_get_status") != "LOCAL_ATTACHMENT_BYTES_ONLY":
                                continue
                            part, entry = a.get("private_zip_part"), a.get("private_zip_entry")
                            require(type(part) is int and 1 <= part <= 64 and
                                    isinstance(entry, str) and
                                    re.fullmatch(r"attachments/\d{4}/\d{4}\."
                                    r"(pdf|psd|psb|png|jpg|jpeg|webp|tif|tiff|gif|svg|eps|ai|cdr|zip)",
                                    entry), "BATCH_BINARY_REFERENCE_INVALID")
                            sha = a.get("sha256")
                            filename = a.get("filename")
                            require(isinstance(sha, str) and re.fullmatch(r"[a-f0-9]{64}", sha)
                                    and isinstance(filename, str) and len(filename) <= 200,
                                    "BATCH_ATTACHMENT_METADATA_INVALID")
                            ext = filename.rsplit(".", 1)[-1].lower()
                            asset_name = prefix + f"assets/{sha}.{ext}"
                            require(ASSET.fullmatch(asset_name) is not None and
                                    asset_name in names, "BATCH_ASSET_MISSING")
                            binary = zf.read(asset_name)
                            require(hashlib.sha256(binary).hexdigest() == sha and
                                    len(binary) == a.get("byte_count"),
                                    "BATCH_ASSET_DIGEST_INVALID")
                            match = [v for v in index if
                                v.get("item_id") == item and
                                v.get("comment_sequence") == message.get("sequence") and
                                v.get("sha256") == sha and
                                v.get("asset_path") == asset_name and
                                v.get("original_filename") == filename]
                            require(len(match) == 1, "BATCH_INDEX_LINK_MISMATCH")
                            key = (part, entry)
                            require(key not in matched, "BATCH_DUPLICATE_BINARY_REFERENCE")
                            matched.add(key)
                            attachment_parts[part].append((entry, binary, {
                                "entry": entry, "article_index": article_num,
                                "order_item_id": item,
                                "comment_sequence": message.get("sequence"),
                                "attachment_id": a.get("attachment_id"),
                                "source": a.get("source", "native_maketadjusting_attachment_get"),
                                "original_filename": filename, "bytes": len(binary),
                                "sha256": sha,
                                "signature_status": a.get("signature_status","KNOWN_SIGNATURE"),
                                "version_and_print_method_verified": False,
                                "training_ready": False
                            }))
                for part, items in sorted(attachment_parts.items()):
                    items.sort(key=lambda x: x[0])
                    payload = {
                        "schema": "printcheck.vision.private-approval-attachments.v1",
                        "scope": "LOCAL_PRIVATE_ONLY",
                        "source": "native_maketadjusting_attachment_get",
                        "order_number": order, "package_part": part,
                        "training_ready": False, "expert_roi_verified": False,
                        "source_pdf_revision_confirmed": False,
                        "export_to_public_github_allowed": False,
                        "items": [x[2] for x in items], "skipped": []
                    }
                    archive = temp / (
                        f"vision-private-approval-attachments-{order}-part-{part:04d}.zip")
                    with zipfile.ZipFile(archive, "w", zipfile.ZIP_STORED) as out:
                        out.writestr("manifest.json", json.dumps(payload, ensure_ascii=False))
                        for name, binary, _ in items:
                            out.writestr(name, binary)
                    archives.append(archive)
        require(len(evidences) > 0, "BATCH_NO_EVIDENCE")
        result = transform(evidences, archives, output)
        # Preserve the root provenance identifier even when the original
        # downloaded ZIP remains separate in the user's download folder.
        path = Path(output) / "batch-source.json"
        path.write_text(json.dumps({
            "schema": "printcheck.vision.local-batch-source.v1",
            "source_archive_sha256": hashlib.sha256(source.read_bytes()).hexdigest(),
            "orders": len(ids), "training_ready": False
        }, indent=2) + "\n", encoding="utf-8")
        return result


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--batch-zip", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args(argv)
    try:
        result = load_batch_zip(args.batch_zip, args.output)
    except (BatchImportError, CorpusError, AuditError, OSError,
            ValueError, zipfile.BadZipFile, KeyError) as error:
        reason = (str(error) if isinstance(error,
                  (BatchImportError, CorpusError, AuditError))
                  else "BATCH_IMPORT_INVALID")
        print(json.dumps({"status": "MANUAL_BATCH_IMPORT_FAILED",
                          "reason": reason, "training_ready": False}))
        return 1
    print(json.dumps(result))
    return 0


if __name__ == "__main__":
    sys.exit(main())
