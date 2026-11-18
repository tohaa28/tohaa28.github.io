#!/usr/bin/env python3
"""Offline-only staging for private, filename-labelled PDF research corpora.

A private manifest is an inventory, NOT trusted ground truth. Stream and verify
each source, build keyed family/duplicate groups and a review-only queue. No raw
customer artwork, filenames, order numbers or hashes go to GitHub or a service.
Do NOT feed the resulting queue directly to model fitting.
"""
from __future__ import annotations

import argparse
from collections import Counter, defaultdict
import hashlib
import hmac
import json
import os
from pathlib import Path
import re
import stat
import tempfile

SCHEMA = "vision.private.archive-review.v1"
SUMMARY_SCHEMA = "printcheck.vision.private-corpus-stage-summary.v1"
QUEUE_SCHEMA = "printcheck.vision.private-corpus-review-queue.v1"
MAX_FILE_BYTES = 512_000_000
CHUNK_BYTES = 1024 * 1024
LABELS = frozenset(("error_claim_in_filename", "explicit_clean_filename",
                    "unlabeled_reference"))
NAME_PATTERN = re.compile(r"private_originals/archive([1-9][0-9]*)_file([0-9]{4})\.pdf\Z")
SHA_PATTERN = re.compile(r"[0-9a-f]{64}\Z")
GROUP_PATTERN = re.compile(r"[0-9]{5,12}\Z")
TAG_PATTERN = re.compile(r"[a-z][a-z0-9_]{0,63}\Z")


def tag(key: bytes, prefix: str, value: str) -> str:
    return prefix + hmac.new(key, (prefix + ":" + value).encode("utf-8"),
                              hashlib.sha256).hexdigest()[:20]


def validate_manifest(data: object) -> list[dict]:
    if not isinstance(data, dict) or data.get("schema") != SCHEMA or (
        data.get("data_private") is not True
    ):
        raise ValueError("PRIVATE_MANIFEST_SCHEMA_REQUIRED")
    entries = data.get("entries")
    if not isinstance(entries, list) or not entries or len(entries) > 100000:
        raise ValueError("PRIVATE_ENTRY_COUNT_INVALID")
    seen = set()
    for row in entries:
        if not isinstance(row, dict):
            raise ValueError("PRIVATE_ENTRY_INVALID")
        archive, sequence = row.get("archive"), row.get("sequence")
        if type(archive) is not int or archive < 1 or (
            type(sequence) is not int or not 1 <= sequence <= 9999
        ):
            raise ValueError("PRIVATE_ENTRY_INDEX_INVALID")
        if (archive, sequence) in seen:
            raise ValueError("PRIVATE_ENTRY_DUPLICATED")
        seen.add((archive, sequence))
        expected = "private_originals/archive%d_file%04d.pdf" % (archive, sequence)
        if row.get("stored_as") != expected or not NAME_PATTERN.fullmatch(expected):
            raise ValueError("PRIVATE_SOURCE_RELATIVE_PATH_INVALID")
        if (type(row.get("bytes")) is not int or row["bytes"] <= 0 or
            not isinstance(row.get("sha256"), str) or
            not SHA_PATTERN.fullmatch(row["sha256"])):
            raise ValueError("PRIVATE_SOURCE_METADATA_INVALID")
        if not isinstance(row.get("order_group"), str) or (
            not GROUP_PATTERN.fullmatch(row["order_group"])
        ):
            raise ValueError("PRIVATE_FAMILY_KEY_INVALID")
        if row.get("provisional_label") not in LABELS or (
            row.get("training_approved") is not False
        ) or row.get("label_verification") != "NOT_VERIFIED":
            raise ValueError("UNVERIFIED_LABEL_REQUIRED")
        labels = row.get("filename_defect_tags")
        if not isinstance(labels, list) or len(labels) > 30 or (
            not all(isinstance(x, str) and TAG_PATTERN.fullmatch(x) for x in labels)
        ):
            raise ValueError("PRIVATE_DEFECT_TAGS_INVALID")
    return entries


def verified_pdf(root: Path, relative: str, expected_size: int,
                 expected_sha: str, max_bytes: int) -> str:
    """Returns a fixed enum; never copies exception text or leaks filenames."""
    source = root / relative
    try:
        canonical = source.resolve(strict=True)
        canonical.relative_to(root.resolve(strict=True))
        if (source.is_symlink() or source.parent.is_symlink() or
            source.parent.parent.is_symlink()):
            return "SOURCE_UNSAFE_PATH"
        flags = os.O_RDONLY | getattr(os, "O_BINARY", 0)
        flags |= getattr(os, "O_NOFOLLOW", 0)
        fd = os.open(source, flags)
        with os.fdopen(fd, "rb") as inp:
            desc = os.fstat(inp.fileno())
            if not stat.S_ISREG(desc.st_mode):
                return "SOURCE_NOT_REGULAR"
            if desc.st_size > max_bytes:
                return "SOURCE_OVER_LIMIT"
            if desc.st_size != expected_size:
                return "SOURCE_SIZE_MISMATCH"
            if inp.read(5) != b"%PDF-":
                return "SOURCE_PDF_SIGNATURE_INVALID"
            inp.seek(0)
            digest = hashlib.sha256()
            total = 0
            while True:
                chunk = inp.read(CHUNK_BYTES)
                if not chunk:
                    break
                total += len(chunk)
                if total > max_bytes:
                    return "SOURCE_OVER_LIMIT"
                digest.update(chunk)
            if total != expected_size or digest.hexdigest() != expected_sha:
                return "SOURCE_SHA256_MISMATCH"
            return "SOURCE_VERIFIED_RESEARCH_ONLY"
    except (OSError, ValueError, RuntimeError):
        return "SOURCE_UNAVAILABLE_OR_UNSAFE"


def atomic_json(dest: Path, data: dict) -> None:
    temp = None
    try:
        with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=dest.parent,
                                         prefix=".vision-", suffix=".tmp",
                                         delete=False) as out:
            temp = Path(out.name)
            os.chmod(temp, 0o600)
            json.dump(data, out, ensure_ascii=False, indent=2, allow_nan=False)
            out.write("\n")
        os.replace(temp, dest)
        os.chmod(dest, 0o600)
    finally:
        if temp is not None and temp.exists():
            temp.unlink()


def stage(manifest_path: Path, output_dir: Path, group_key_path: Path,
          max_bytes: int = MAX_FILE_BYTES) -> tuple[dict, dict]:
    if type(max_bytes) is not int or not 16_000_000 <= max_bytes <= 512_000_000:
        raise ValueError("MAX_PRIVATE_PDF_BYTES_INVALID")
    manifest_path = manifest_path.expanduser().resolve(strict=True)
    root = manifest_path.parent
    key_path = group_key_path.expanduser().resolve(strict=True)
    if group_key_path.is_symlink():
        raise ValueError("PRIVATE_GROUP_KEY_UNSAFE")
    key = key_path.read_bytes()
    if len(key) != 32:
        raise ValueError("PRIVATE_GROUP_KEY_LENGTH_INVALID")
    data = json.loads(manifest_path.read_text(encoding="utf-8"))
    entries = validate_manifest(data)
    if output_dir.is_symlink():
        raise ValueError("PRIVATE_OUTPUT_SYMLINK")
    output_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
    if not output_dir.is_dir():
        raise ValueError("PRIVATE_OUTPUT_NOT_DIRECTORY")
    try:
        os.chmod(output_dir, 0o700)
    except OSError:
        pass
    # Content-hash duplicates tie different order groups together: they may
    # never be split across a blind review boundary.
    parent = {r["order_group"]: r["order_group"] for r in entries}

    def root_of(group: str) -> str:
        while group != parent[group]:
            parent[group] = parent[parent[group]]
            group = parent[group]
        return group

    def unite(first: str, second: str) -> None:
        a, b = root_of(first), root_of(second)
        if a != b:
            parent[max(a, b)] = min(a, b)

    seen_hash = {}
    by_hash = defaultdict(list)
    for row in entries:
        sha = row["sha256"]
        if sha in seen_hash:
            unite(row["order_group"], seen_hash[sha])
        seen_hash[sha] = row["order_group"]
        by_hash[sha].append(row)
    mixed_sha = {sha for sha, variants in by_hash.items()
                 if len({x["provisional_label"] for x in variants}) > 1}
    error_neutral_sha = {sha for sha, variants in by_hash.items() if
                         {x["provisional_label"] for x in variants} >=
                         {"error_claim_in_filename", "unlabeled_reference"}}
    clean_neutral_sha = {sha for sha, variants in by_hash.items() if
                         {x["provisional_label"] for x in variants} >=
                         {"explicit_clean_filename", "unlabeled_reference"}}
    opposed_sha = {sha for sha, variants in by_hash.items() if
                   {x["provisional_label"] for x in variants} >=
                   {"explicit_clean_filename", "error_claim_in_filename"}}
    queue_rows = []
    statuses = Counter()
    oversized = 0
    for row in sorted(entries, key=lambda r: (r["archive"], r["sequence"])):
        sha = row["sha256"]
        status = verified_pdf(root, row["stored_as"], row["bytes"], sha, max_bytes)
        statuses[status] += 1
        oversized += row["bytes"] > 16_000_000
        family = root_of(row["order_group"])
        # This HMAC partition is ONLY a suggested blind-review split, never
        # a verified train/test split or permission to learn from a label.
        partition = hmac.new(key, ("review-partition-v1:" + family).encode(),
                             hashlib.sha256).digest()[0] % 10
        label = row["provisional_label"]
        priority = "P0_MIXED_FILENAME_CLAIMS" if sha in mixed_sha else (
            "P0_SOURCE_UNAVAILABLE" if status != "SOURCE_VERIFIED_RESEARCH_ONLY"
            else ("P1_UNLABELED" if label == "unlabeled_reference" else
                  "P2_ERROR_CLAIM" if label == "error_claim_in_filename"
                  else "P3_CLEAN_CLAIM"))
        queue_rows.append({
            "sample_token": tag(key, "sample", "%d:%04d" % (row["archive"], row["sequence"])),
            "family_token": tag(key, "family", family),
            "content_token": tag(key, "content", sha),
            "candidate_review_partition": "BLIND_REVIEW_CANDIDATE" if partition < 2 else "REVIEW_POOL",
            "priority": priority,
            "source_status": status,
            "provisional_label_from_filename_only": label,
            "filename_defect_tags_not_verified": sorted(set(row["filename_defect_tags"])),
            "duplicate_sha256_size": len(by_hash[sha]),
            "source_bytes": row["bytes"],
            "over_browser_16mb_limit": row["bytes"] > 16_000_000,
            "roi_verified": False,
            "physical_scale_verified": False,
            "technology_rules_verified": False,
            "family_holdout_verified": False,
            "training_approved": False
        })
    order = {"P0_MIXED_FILENAME_CLAIMS":0, "P0_SOURCE_UNAVAILABLE":1,
             "P1_UNLABELED":2, "P2_ERROR_CLAIM":3, "P3_CLEAN_CLAIM":4}
    queue_rows.sort(key=lambda r: (order[r["priority"]],
                                   r["family_token"], r["sample_token"]))
    summary = {
        "schema": SUMMARY_SCHEMA, "source_files": len(entries),
        "verified_pdf_files": statuses["SOURCE_VERIFIED_RESEARCH_ONLY"],
        "verification_statuses": dict(sorted(statuses.items())),
        "family_clusters": len({root_of(r["order_group"]) for r in entries}),
        "unique_sha256_contents": len(by_hash),
        "duplicate_sha256_groups": sum(len(v)>1 for v in by_hash.values()),
        "duplicate_extra_copies": sum(len(v)-1 for v in by_hash.values()),
        "sha256_groups_with_mixed_filename_claims": len(mixed_sha),
        "sha256_error_claim_plus_unlabeled_groups": len(error_neutral_sha),
        "sha256_clean_claim_plus_unlabeled_groups": len(clean_neutral_sha),
        "sha256_opposing_error_clean_claim_groups": len(opposed_sha),
        "source_files_over_16mb": oversized,
        "largest_source_bytes": max(x["bytes"] for x in entries),
        "provisional_labels_from_filenames": dict(sorted(Counter(
            r["provisional_label"] for r in entries).items())),
        "priority_counts": dict(sorted(Counter(r["priority"] for r in queue_rows).items())),
        "candidate_review_partitions_only": dict(sorted(Counter(
            r["candidate_review_partition"] for r in queue_rows).items())),
        "verified_expert_roi_count": 0, "training_approved_count": 0,
        "automatic_training_enabled": False, "family_holdout_verified": False,
        "production_approved": False, "raw_source_names_in_output": False,
        "network_access": False
    }
    queue_data = {
        "schema": QUEUE_SCHEMA, "private_local_only": True,
        "training_ready": False, "review_tasks": queue_rows
    }
    atomic_json(output_dir / "corpus-stage-summary.json", summary)
    atomic_json(output_dir / "private-review-tasks.json", queue_data)
    return summary, queue_data


def main(argv=None) -> None:
    ap = argparse.ArgumentParser(description="Local-only research corpus staging; no ML training")
    ap.add_argument("--manifest", type=Path, required=True)
    ap.add_argument("--output", type=Path, required=True)
    ap.add_argument("--key", type=Path, required=True,
                    help="Private 32-byte HMAC grouping key; never publish")
    ap.add_argument("--max-file-bytes", type=int, default=MAX_FILE_BYTES)
    args = ap.parse_args(argv)
    summary, _ = stage(args.manifest, args.output, args.key, args.max_file_bytes)
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
