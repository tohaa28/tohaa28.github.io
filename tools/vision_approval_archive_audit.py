#!/usr/bin/env python3
"""Offline verification for private Vision approval ZIP parts (no network, no PII output).

Does not authenticate gifts.ru or establish an expert training label.
"""
import argparse
import hashlib
import json
import re
import sys
import zipfile
from pathlib import Path

MAX_PARTS = 64
MAX_FILES = 64
MAX_FILE_BYTES = 16_000_000
MAX_PART_BYTES = 24_000_000
MAX_MANIFEST_BYTES = 1024 * 1024
MAX_EVIDENCE_BYTES = 16 * 1024 * 1024
ENTRY = re.compile(r"attachments/([0-9]{4})/([0-9]{4})\.(pdf|psd|psb|png|jpg|jpeg|webp|tif|tiff|gif|svg|eps|ai|cdr|zip)\Z")
DIGITS = re.compile(r"[0-9]{1,20}\Z")
SHA256 = re.compile(r"[a-f0-9]{64}\Z")


class AuditError(ValueError):
    """Code-only error: never print a private path, ID, or filename."""


def require(condition, reason):
    if not condition:
        raise AuditError(reason)


def unique_pairs(pairs):
    result = {}
    for k, v in pairs:
        require(k not in result, "DUPLICATE_JSON_KEY")
        result[k] = v
    return result


def read_json(raw):
    try:
        return json.loads(raw.decode("utf-8"), object_pairs_hook=unique_pairs)
    except (ValueError, UnicodeError) as exc:
        if isinstance(exc, AuditError):
            raise
        raise AuditError("BAD_JSON") from None


def is_positive_int(value):
    return type(value) is int and value > 0


def audit_archives(paths, evidence=None):
    """Raise AuditError or return an anonymous, count-only verified receipt."""
    require(1 <= len(paths) <= MAX_PARTS, "INVALID_PART_COUNT")
    order = None
    parts = set()
    seen = set()
    archive_items = {}
    checked_bytes = 0
    for path in paths:
        try:
            zf = zipfile.ZipFile(path, "r")
        except (OSError, zipfile.BadZipFile, zipfile.LargeZipFile):
            raise AuditError("INVALID_ZIP") from None
        with zf:
            members = zf.infolist()
            require(2 <= len(members) <= 13, "ZIP_ENTRY_COUNT_INVALID")
            names = [info.filename for info in members]
            require(names[0] == "manifest.json" and len(names) == len(set(names)),
                    "ZIP_ENTRY_ORDER_OR_DUPLICATE")
            for info in members:
                require(info.compress_type == zipfile.ZIP_STORED and not info.flag_bits & 1,
                        "ZIP_COMPRESSION_OR_ENCRYPTION")
                require(not info.is_dir() and ((info.external_attr >> 16) & 0o170000) != 0o120000,
                        "ZIP_UNSAFE_ENTRY")
            require(members[0].file_size <= MAX_MANIFEST_BYTES, "MANIFEST_TOO_LARGE")
            try:
                with zf.open(members[0]) as manifest_stream:
                    raw_manifest = manifest_stream.read(MAX_MANIFEST_BYTES + 1)
                require(len(raw_manifest) <= MAX_MANIFEST_BYTES, "MANIFEST_TOO_LARGE")
                manifest = read_json(raw_manifest)
            except (OSError, RuntimeError, zipfile.BadZipFile):
                raise AuditError("ZIP_CHECKSUM_INVALID") from None
            require(isinstance(manifest, dict), "MANIFEST_NOT_OBJECT")
            require(manifest.get("schema") == "printcheck.vision.private-approval-attachments.v1"
                    and manifest.get("scope") == "LOCAL_PRIVATE_ONLY"
                    and manifest.get("source") == "native_maketadjusting_attachment_get",
                    "MANIFEST_SCHEMA_INVALID")
            for key in ("training_ready", "expert_roi_verified",
                        "source_pdf_revision_confirmed", "export_to_public_github_allowed"):
                require(manifest.get(key) is False, "UNSAFE_MANIFEST_FLAG")
            order_id = manifest.get("order_number")
            require(isinstance(order_id, str) and DIGITS.fullmatch(order_id) is not None,
                    "ORDER_IDENTIFIER_INVALID")
            if order is None:
                order = order_id
            require(order == order_id, "ORDER_MISMATCH")
            part = manifest.get("package_part")
            require(is_positive_int(part) and part <= MAX_PARTS and part not in parts,
                    "PART_DUPLICATE_OR_INVALID")
            parts.add(part)
            items = manifest.get("items")
            require(isinstance(items, list) and len(items) == len(members) - 1,
                    "ITEM_LIST_MISMATCH")
            require(isinstance(manifest.get("skipped"), list) and
                    len(manifest["skipped"]) <= MAX_FILES, "SKIPPED_LIST_INVALID")
            part_bytes = 0
            for index, (item, info) in enumerate(zip(items, members[1:]), start=1):
                require(isinstance(item, dict), "ITEM_INVALID")
                entry = item.get("entry")
                match = ENTRY.fullmatch(entry) if isinstance(entry, str) else None
                require(match is not None and match.group(1) == f"{part:04d}"
                        and match.group(2) == f"{index:04d}" and entry == info.filename,
                        "ZIP_ITEM_PATH_MISMATCH")
                require(is_positive_int(item.get("article_index"))
                        and is_positive_int(item.get("comment_sequence"))
                        and isinstance(item.get("order_item_id"), str)
                        and DIGITS.fullmatch(item["order_item_id"]) is not None
                        and (
                            (item.get("source") == "native_approval_gallery"
                             and item.get("attachment_id") is None)
                            or
                            (item.get("source", "native_maketadjusting_attachment_get")
                             == "native_maketadjusting_attachment_get"
                             and isinstance(item.get("attachment_id"), str)
                             and DIGITS.fullmatch(item["attachment_id"]) is not None)),
                        "ITEM_SOURCE_MAPPING_INVALID")
                require(isinstance(item.get("original_filename"), str)
                        and 0 < len(item["original_filename"]) <= 200,
                        "ORIGINAL_NAME_INVALID")
                require(item.get("training_ready") is False
                        and item.get("version_and_print_method_verified") is False,
                        "UNSAFE_ITEM_FLAGS")
                require(type(item.get("bytes")) is int and 8 <= item["bytes"] <= MAX_FILE_BYTES
                        and item["bytes"] == info.file_size,
                        "ITEM_SIZE_MISMATCH")
                digest = item.get("sha256")
                require(isinstance(digest, str) and SHA256.fullmatch(digest) is not None,
                        "ITEM_SHA256_MISSING")
                require(item.get("signature_status") in ("KNOWN_SIGNATURE", "UNVERIFIED_BINARY_TYPE"),
                        "ITEM_SIGNATURE_INVALID")
                part_bytes += info.file_size
                require(part_bytes <= MAX_PART_BYTES, "PART_PAYLOAD_LIMIT")
                try:
                    with zf.open(info) as source:
                        calc = hashlib.sha256()
                        while block := source.read(1024 * 1024):
                            calc.update(block)
                except (OSError, RuntimeError, zipfile.BadZipFile):
                    raise AuditError("ZIP_CHECKSUM_INVALID") from None
                require(calc.hexdigest() == digest, "ITEM_SHA256_MISMATCH")
                ref = (part, entry)
                require(ref not in seen, "DUPLICATE_ITEM_REFERENCE")
                seen.add(ref)
                archive_items[ref] = item
            checked_bytes += part_bytes
    require(parts == set(range(1, len(paths) + 1)), "PARTS_MISSING")
    require(len(archive_items) <= MAX_FILES, "FILE_COUNT_LIMIT")
    if evidence is not None:
        try:
            with Path(evidence).open("rb") as evidence_stream:
                raw_evidence = evidence_stream.read(MAX_EVIDENCE_BYTES + 1)
            require(len(raw_evidence) <= MAX_EVIDENCE_BYTES, "EVIDENCE_TOO_LARGE")
            report = read_json(raw_evidence)
        except OSError:
            raise AuditError("EVIDENCE_UNREADABLE") from None
        require(isinstance(report, dict) and report.get("schema") ==
                "printcheck.vision.private-approval-collection.v1"
                and report.get("order_number") == order,
                "EVIDENCE_IDENTITY_MISMATCH")
        expected = {}
        require(isinstance(report.get("articles"), list), "EVIDENCE_STRUCTURE_INVALID")
        for index, article in enumerate(report["articles"], start=1):
            require(isinstance(article, dict), "EVIDENCE_STRUCTURE_INVALID")
            if article.get("status") != "PRIVATE_REVIEW_ONLY":
                continue
            history = article.get("history", [])
            require(isinstance(history, list), "EVIDENCE_STRUCTURE_INVALID")
            for message in history:
                require(isinstance(message, dict) and
                        isinstance(message.get("attachments", []), list),
                        "EVIDENCE_STRUCTURE_INVALID")
                for attachment in message.get("attachments", []):
                    require(isinstance(attachment, dict), "EVIDENCE_STRUCTURE_INVALID")
                    if attachment.get("local_get_status") != "LOCAL_ATTACHMENT_BYTES_ONLY":
                        continue
                    ref = (attachment.get("private_zip_part"),
                           attachment.get("private_zip_entry"))
                    require(ref not in expected, "EVIDENCE_DUPLICATE_REFERENCE")
                    expected[ref] = (index, article.get("item_id"),
                                     message.get("sequence"), attachment)
        require(expected.keys() == archive_items.keys(), "EVIDENCE_ARCHIVE_COVERAGE_MISMATCH")
        for ref, (index, item_id, sequence, attachment) in expected.items():
            item = archive_items[ref]
            require(item["article_index"] == index
                    and item["order_item_id"] == item_id
                    and item["comment_sequence"] == sequence
                    and item["attachment_id"] == attachment.get("attachment_id")
                    and item["original_filename"] == attachment.get("filename")
                    and item["bytes"] == attachment.get("byte_count")
                    and item["sha256"] == attachment.get("sha256"),
                    "EVIDENCE_SOURCE_MAPPING_MISMATCH")
    status = "LOCAL_ARCHIVES_VERIFIED" if evidence is not None else "LOCAL_PARTS_ONLY_VERIFIED"
    return {"status": status, "parts": len(parts),
            "attachments": len(archive_items), "payload_bytes": checked_bytes,
            "evidence_crosschecked": evidence is not None,
            "training_ready": False, "production_approved": False,
            "contains_private_ids": False}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archives", nargs="+", help="Private local approval ZIP parts")
    parser.add_argument("--evidence", help="Optional private approval evidence JSON")
    args = parser.parse_args(argv)
    try:
        result = audit_archives(args.archives, args.evidence)
    except (AuditError, OSError) as exc:
        reason = str(exc) if isinstance(exc, AuditError) else "ARCHIVE_UNREADABLE"
        print(json.dumps({"status": "MANUAL_ARCHIVE_AUDIT_FAILED", "reason": reason,
                          "training_ready": False, "production_approved": False}))
        return 1
    print(json.dumps(result))
    return 0


if __name__ == "__main__":
    sys.exit(main())
