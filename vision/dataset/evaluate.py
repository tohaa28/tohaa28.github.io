"""Offline PrintCheck Vision evaluation of expertly reviewed *regions*.

Never treats legacy PrintCheck diagnostics or filename keywords as ground truth.
No network. No raw artwork. Only SHA-256 opaque IDs and per-region labels.
Output intentionally contains NO hashes, identifiers, filenames or examples.
Candidate detection is NOT a production verdict about artwork quality.

Input JSON schema:
{
 "schema": "printcheck.vision.expert-regions.v1",
 "regions": [
  {"artwork_sha256": <64 hex>, "family_sha256": <64 hex>,
   "region_sha256": <64 hex>, "split": "test"|"train"|"validation",
   "technology_code": "UV1",
   "expert": {"state":"verified","label":"defect"|"acceptable",
              "annotation_sha256": <64 hex>, "reviewer_ref_sha256": <64 hex>},
   "detection": {"state":"candidate"|"none"|"manual",
                 "revision":"C3B.3.D-normal-probe-v1"}}
 ]
}
Expert confirmation and cryptographic provenance must be independently
authenticated outside this utility. Hash-like strings alone are NOT proof.
"""
from __future__ import annotations
import argparse
from collections import Counter, defaultdict
import json
import os
from pathlib import Path
import re
import sys

MAX_INPUT_BYTES = 8 * 1024 * 1024
MAX_REGIONS = 200_000
HASH = re.compile(r"^[a-f0-9]{64}$", re.I)
TECH = re.compile(r"^[A-Z0-9_-]{1,30}$")
SPLITS = {"train", "validation", "test"}
DETECTIONS = {"candidate", "none", "manual"}
LABELS = {"defect", "acceptable"}


class InvalidEvaluation(ValueError):
    """Input is unsuitable for privacy-safe expert evaluation."""


def valid_hash(value):
    return isinstance(value, str) and bool(HASH.fullmatch(value))


def validate_regions(document):
    if not isinstance(document, dict) or (
        document.get("schema") != "printcheck.vision.expert-regions.v1"
    ):
        raise InvalidEvaluation("SCHEMA_UNSUPPORTED")
    regions = document.get("regions")
    if not isinstance(regions, list) or len(regions) > MAX_REGIONS:
        raise InvalidEvaluation("REGION_LIST_INVALID")
    seen = set()
    families = {}
    artworks = {}
    for row in regions:
        if not isinstance(row, dict):
            raise InvalidEvaluation("REGION_INVALID")
        for field in ("artwork_sha256", "family_sha256", "region_sha256"):
            if not valid_hash(row.get(field)):
                raise InvalidEvaluation("HASH_INVALID")
        split = row.get("split")
        if split not in SPLITS:
            raise InvalidEvaluation("SPLIT_INVALID")
        if not TECH.fullmatch(str(row.get("technology_code", ""))):
            raise InvalidEvaluation("TECHNOLOGY_INVALID")
        family = row["family_sha256"].lower()
        artwork = row["artwork_sha256"].lower()
        region = row["region_sha256"].lower()
        if family in families and families[family] != split:
            raise InvalidEvaluation("DATA_LEAKAGE_FAMILY_SPLIT")
        if artwork in artworks and artworks[artwork] != split:
            raise InvalidEvaluation("DATA_LEAKAGE_ARTWORK_SPLIT")
        families[family] = split
        artworks[artwork] = split
        if region in seen:
            raise InvalidEvaluation("DUPLICATE_REGION")
        seen.add(region)
        expert, detection = row.get("expert"), row.get("detection")
        if not isinstance(expert, dict) or not isinstance(detection, dict):
            raise InvalidEvaluation("EXPERT_OR_DETECTION_MISSING")
        if expert.get("state") != "verified":
            raise InvalidEvaluation("EXPERT_VERIFICATION_REQUIRED")
        if expert.get("label") not in LABELS:
            raise InvalidEvaluation("EXPERT_LABEL_INVALID")
        if not valid_hash(expert.get("annotation_sha256")) or not valid_hash(
            expert.get("reviewer_ref_sha256")
        ):
            raise InvalidEvaluation("EXPERT_ANNOTATION_PROVENANCE_REQUIRED")
        if detection.get("state") not in DETECTIONS:
            raise InvalidEvaluation("DETECTION_STATE_INVALID")
        revision = detection.get("revision")
        if not isinstance(revision, str) or not (
            1 <= len(revision) <= 64 and re.fullmatch(r"[A-Za-z0-9._-]+", revision)
        ):
            raise InvalidEvaluation("DETECTION_REVISION_INVALID")
    return regions


def metrics(regions, split):
    selected = [row for row in regions if row["split"] == split]
    resolved = [row for row in selected if row["detection"]["state"] != "manual"]
    tp = sum(1 for r in resolved if r["detection"]["state"] == "candidate" and
             r["expert"]["label"] == "defect")
    fp = sum(1 for r in resolved if r["detection"]["state"] == "candidate" and
             r["expert"]["label"] == "acceptable")
    tn = sum(1 for r in resolved if r["detection"]["state"] == "none" and
             r["expert"]["label"] == "acceptable")
    fn = sum(1 for r in resolved if r["detection"]["state"] == "none" and
             r["expert"]["label"] == "defect")
    total = len(selected)
    return {
        "expert_regions": total,
        "manual_abstentions": total - len(resolved),
        "resolved_regions": len(resolved),
        "candidate_true_positive": tp,
        "candidate_false_positive": fp,
        "candidate_true_negative": tn,
        "candidate_false_negative": fn,
        "coverage": len(resolved) / total if total else None,
        "candidate_precision": tp / (tp + fp) if tp + fp else None,
        "candidate_recall_among_resolved": tp / (tp + fn) if tp + fn else None,
        "candidate_false_positive_rate": fp / (fp + tn) if fp + tn else None,
    }


def evaluate_document(document, *, split="test", min_technology_samples=5):
    if split not in SPLITS:
        raise InvalidEvaluation("SPLIT_INVALID")
    if not isinstance(min_technology_samples, int) or min_technology_samples < 1:
        raise InvalidEvaluation("PRIVACY_GROUP_MIN_INVALID")
    rows = validate_regions(document)
    selected = [r for r in rows if r["split"] == split]
    counts = Counter(r["technology_code"] for r in selected)
    buckets = defaultdict(list)
    for r in selected:
        buckets[r["technology_code"]].append(r)
    visible = {
        tech: metrics(part, split)
        for tech, part in sorted(buckets.items())
        if counts[tech] >= min_technology_samples
    }
    return {
        "schema": "printcheck.vision.eval-summary.v1",
        "split": split,
        "evaluation_unit": "expert_verified_region_not_whole_artwork",
        "quality_verdict": "NOT_PRODUCTION_APPROVED",
        "metric_scope": "candidate_detection_not_manufacturability",
        "expert_identity_cryptographically_authenticated": False,
        "overall": metrics(selected, split),
        "by_technology": visible,
        "suppressed_technologies": sum(1 for n in counts.values()
                                       if n < min_technology_samples),
        "privacy": {
            "individual_results_emitted": False,
            "artwork_hashes_emitted": False,
            "order_ids_emitted": False,
            "source_filenames_emitted": False,
            "legacy_diagnostics_trusted": False,
        }
    }


def main(argv=None):
    parser = argparse.ArgumentParser(
        description="Offline candidate metrics only, expert regions with grouped splits")
    parser.add_argument("input", type=Path, help="Private labeled region JSON")
    parser.add_argument("--split", choices=sorted(SPLITS), default="test")
    parser.add_argument("--output", type=Path,
                        help="Local new JSON; never overwrite prior evaluations")
    args = parser.parse_args(argv)
    try:
        if not args.input.is_file() or args.input.stat().st_size > MAX_INPUT_BYTES:
            raise InvalidEvaluation("INPUT_NOT_FOUND_OR_TOO_LARGE")
        source = json.loads(args.input.read_text(encoding="utf-8"))
        result = evaluate_document(source, split=args.split)
        output = json.dumps(result, indent=2, ensure_ascii=False) + "\n"
        if args.output:
            args.output.parent.mkdir(parents=True, exist_ok=True)
            fd = os.open(args.output, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            with os.fdopen(fd, "w", encoding="utf-8") as writer:
                writer.write(output)
        else:
            sys.stdout.write(output)
    except (OSError, json.JSONDecodeError, InvalidEvaluation):
        # Never print the private file path, raw JSON, artwork IDs or exceptions.
        print("EVALUATION_REFUSED: see input schema and data integrity checks",
              file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
