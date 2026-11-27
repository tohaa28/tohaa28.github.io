"""Private local inventory for PrintCheck artwork archives.

Stdlib-only, NO uploads, NO extraction, NO file name/order/customer text in output.
Legacy PrintCheck diagnoses are not ground truth. Every candidate is UNREVIEWED.
Provides aggregate counts by default, an opt-in SHA256 manifest for local use.
The original archives are never modified.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import stat
import sys
import zipfile
from collections import Counter

FORMAT = "printcheck.vision.inventory.v1"
ARTWORK_EXTENSIONS = {".pdf", ".svg", ".png", ".jpg", ".jpeg", ".webp", ".ai"}
CONTEXT_EXTENSIONS = {".json", ".html", ".htm", ".txt", ".csv"}
MAX_MEMBERS = 20_000
MAX_ENTRY_SIZE = 512 * 1024 * 1024
MAX_TOTAL_SIZE = 2 * 1024 * 1024 * 1024
MAX_COMPRESSION_RATIO = 500


class UnsafeArchive(Exception):
    pass


def safe_member(info: zipfile.ZipInfo) -> tuple[bool, str]:
    """Refuse absolute/traversal/member links or unreasonable ZIP entries."""
    name = info.filename.replace("\\", "/")
    path = PurePosixPath(name)
    if info.is_dir():
        return False, "directory"
    if not name or name.startswith("/") or name.startswith("//") or ":" in name:
        return False, "unsafe_path"
    if any(part in ("", ".", "..") for part in path.parts):
        return False, "unsafe_path"
    if info.flag_bits & 1:
        return False, "encrypted"
    mode = info.external_attr >> 16
    if stat.S_IFMT(mode) == stat.S_IFLNK:
        return False, "symlink"
    if info.file_size > MAX_ENTRY_SIZE:
        return False, "oversize"
    if info.file_size > MAX_COMPRESSION_RATIO * max(info.compress_size, 1):
        return False, "suspicious_ratio"
    if path.suffix.lower() in (".zip", ".7z", ".rar", ".exe", ".py", ".js"):
        return False, "unsupported_type"
    return True, ""


def hash_member(archive: zipfile.ZipFile, info: zipfile.ZipInfo) -> tuple[str, int]:
    h = hashlib.sha256()
    count = 0
    with archive.open(info, "r") as stream:
        while chunk := stream.read(1024 * 1024):
            count += len(chunk)
            if count > MAX_ENTRY_SIZE:
                raise UnsafeArchive("entry_stream_limit_exceeded")
            h.update(chunk)
    if count != info.file_size:
        raise UnsafeArchive("zip_size_mismatch")
    return h.hexdigest(), count


def summarize_archives(paths: list[Path], *, include_hashes: bool = False) -> dict:
    """Return only non-identifying aggregate metadata unless hashes are opted in."""
    summary = {
        "schema": FORMAT,
        "source_archives": len(paths),
        "processed_archives": 0,
        "members_examined": 0,
        "unique_files": 0,
        "exact_duplicates": 0,
        "bytes_examined": 0,
        "artwork_candidates": 0,
        "context_candidates": 0,
        "other_files": 0,
        "labels": {"expert_confirmed": 0, "unreviewed": 0},
        "by_extension": {},
        "skipped": {},
        "archive_errors": {},
        "privacy": {
            "raw_archives_uploaded": False,
            "paths_order_ids_filenames_emitted": False,
            "legacy_labels_as_ground_truth": False,
            "manifest_requires_explicit_opt_in": True,
        },
    }
    counts = Counter()
    skipped = Counter()
    errors = Counter()
    seen = set()
    manifest = []
    for index, archive_path in enumerate(paths):
        if not archive_path.is_file() or archive_path.suffix.lower() != ".zip":
            errors["invalid_archive"] += 1
            continue
        total = 0
        try:
            with zipfile.ZipFile(archive_path, "r") as archive:
                members = archive.infolist()
                if len(members) > MAX_MEMBERS:
                    raise UnsafeArchive("too_many_members")
                summary["processed_archives"] += 1
                for member_index, info in enumerate(members):
                    summary["members_examined"] += 1
                    accepted, reason = safe_member(info)
                    if not accepted:
                        skipped[reason] += 1
                        continue
                    if total + info.file_size > MAX_TOTAL_SIZE:
                        skipped["total_uncompressed_limit"] += 1
                        continue
                    ext = PurePosixPath(info.filename).suffix.lower()
                    try:
                        sha, nbytes = hash_member(archive, info)
                    except (UnsafeArchive, OSError, EOFError, RuntimeError, zipfile.BadZipFile):
                        skipped["read_failure"] += 1
                        continue
                    total += nbytes
                    summary["bytes_examined"] += nbytes
                    if sha in seen:
                        summary["exact_duplicates"] += 1
                        continue
                    seen.add(sha)
                    summary["unique_files"] += 1
                    summary["labels"]["unreviewed"] += 1
                    counts[ext or "[no extension]"] += 1
                    kind = (
                        "artwork" if ext in ARTWORK_EXTENSIONS
                        else "context" if ext in CONTEXT_EXTENSIONS
                        else "other"
                    )
                    summary[kind + "_candidates" if kind != "other" else "other_files"] += 1
                    if include_hashes:
                        # No archive path, original member name, customer ID or raw file content.
                        manifest.append({
                            "source_ordinal": index,
                            "member_ordinal": member_index,
                            "sha256": sha,
                            "size_bytes": nbytes,
                            "kind": kind,
                            "extension": ext,
                            "label": "unreviewed",
                            "split": "unassigned",
                        })
        except (OSError, RuntimeError, zipfile.BadZipFile, UnsafeArchive) as exc:
            # Error class only, not exception text (may contain private paths).
            errors["archive_failed_" + type(exc).__name__] += 1
    summary["by_extension"] = dict(sorted(counts.items()))
    summary["skipped"] = dict(sorted(skipped.items()))
    summary["archive_errors"] = dict(sorted(errors.items()))
    if include_hashes:
        summary["manifest"] = manifest
        summary["privacy"]["content_hashes_emitted"] = True
        summary["privacy"]["manifest_requires_explicit_opt_in"] = False
    return summary


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Offline ZIP inventory only; never label AI/legacy warnings as expert truth."
    )
    parser.add_argument("archives", type=Path, nargs="+", help="Private local ZIP paths")
    parser.add_argument("--output", type=Path, help="Write report to local JSON file")
    parser.add_argument("--include-hashes", action="store_true",
                        help="Local SHA256 manifest; never publish it in a public repository")
    args = parser.parse_args(argv)
    result = summarize_archives(args.archives, include_hashes=args.include_hashes)
    output = json.dumps(result, indent=2, ensure_ascii=False) + "\n"
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        if args.output.exists():
            parser.error("output file already exists; refusing to overwrite history")
        fd = os.open(args.output, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, "w", encoding="utf-8") as stream:
            stream.write(output)
    else:
        sys.stdout.write(output)
    return 1 if result["archive_errors"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
