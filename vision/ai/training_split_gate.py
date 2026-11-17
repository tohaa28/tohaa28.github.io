"""Fail-closed, standard-library-only gate for future *local* training manifests.

Does not read files, labels, images, or credentials. This is a structural gate,
not proof that a real-world dataset is independent or fit for production.
"""
import re

SHA256 = re.compile(r"^[0-9a-f]{64}$")
SPLITS = ("train", "validation", "test")
ROLES = ("ink", "gap")


def audit_split_manifest(records):
    """Return aggregate counts/reasons only. Never echo identifiers or metadata."""
    counts = {key: 0 for key in SPLITS}
    if not isinstance(records, list) or not records:
        return {"status": "MANUAL", "reason": "EMPTY_OR_INVALID_MANIFEST",
                "counts": counts, "production_approved": False}
    families = {}
    sources = {}
    hashes = {}
    for item in records:
        if not isinstance(item, dict):
            return _manual("INVALID_RECORD", counts)
        split = item.get("split")
        if split not in SPLITS:
            return _manual("INVALID_SPLIT", counts)
        counts[split] += 1
        family = item.get("source_family")
        source = item.get("source_sha256")
        roi = item.get("roi_sha256")
        role = item.get("region_role")
        # Do not trust IDs or arbitrary strings as provenance.
        if not isinstance(family, str) or not SHA256.fullmatch(family):
            return _manual("UNVERIFIED_FAMILY_PROVENANCE", counts)
        if not isinstance(source, str) or not SHA256.fullmatch(source):
            return _manual("UNVERIFIED_SOURCE_HASH", counts)
        if not isinstance(roi, str) or not SHA256.fullmatch(roi):
            return _manual("UNVERIFIED_ROI_HASH", counts)
        if role not in ROLES:
            return _manual("UNVERIFIED_REGION_ROLE", counts)
        if item.get("expert_consensus") is not True:
            return _manual("EXPERT_CONSENSUS_REQUIRED", counts)
        if item.get("physical_scale_verified") is not True:
            return _manual("PHYSICAL_SCALE_UNVERIFIED", counts)
        if item.get("color_profile_verified") is not True:
            return _manual("COLOR_PROFILE_UNVERIFIED", counts)
        for key, value, seen in (
            ("FAMILY", family, families), ("SOURCE", source, sources),
            ("ROI", roi, hashes)
        ):
            previous = seen.setdefault(value, split)
            if previous != split:
                return _manual(key + "_LEAKAGE", counts)
    if any(counts[split] == 0 for split in SPLITS):
        return _manual("SPLIT_EMPTY", counts)
    return {"status": "RESEARCH_SPLIT_STRUCTURE_ONLY",
            "reason": "PROVENANCE_ATTESTATIONS_NOT_INDEPENDENTLY_VERIFIED",
            "counts": counts, "production_approved": False,
            "real_world_accuracy_verified": False,
            "auto_deploy_allowed": False}


def _manual(reason, counts):
    return {"status": "MANUAL", "reason": reason,
            "counts": counts.copy(), "production_approved": False,
            "auto_deploy_allowed": False}
