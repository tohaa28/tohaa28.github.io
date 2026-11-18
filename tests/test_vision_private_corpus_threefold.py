"""Three independent synthetic corpus-stage regressions; never load customer files."""
from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
import vision_private_corpus_stage as corpus


class ThreefoldPrivateCorpusTests(unittest.TestCase):
    def test_three_independent_streaming_and_family_cycles(self):
        # The payload is generated locally and never committed or uploaded.
        payload = b"%PDF-1.7\n" + b"S" * 16_000_001
        digest = hashlib.sha256(payload).hexdigest()
        for cycle in range(3):
            with self.subTest(cycle=cycle), tempfile.TemporaryDirectory() as td:
                root = Path(td)
                (root / "private_originals").mkdir()
                key = root / "private_key.bin"
                key.write_bytes(bytes(range(32)))
                if os.name == "posix":
                    key.chmod(0o600)
                rows = []
                for number, family in ((1, "1111111"), (2, "2222222")):
                    relative = f"private_originals/sample{number}.pdf"
                    (root / relative).write_bytes(payload)
                    rows.append({
                        "archive": 1, "sequence": number,
                        "stored_as": relative, "bytes": len(payload),
                        "sha256": digest,
                        "original_filename": "PRIVATE SYNTHETIC NAME",
                        "order_group": family,
                        "provisional_label": "unlabeled_reference",
                        "filename_defect_tags": [],
                        "label_verification": "NOT_VERIFIED",
                        "training_approved": False,
                    })
                manifest = root / "private_manifest.json"
                manifest.write_text(json.dumps({
                    "schema": corpus.SCHEMA, "data_private": True,
                    "source_names": ["PRIVATE ARCHIVE NAME"],
                    "entries": rows,
                }), encoding="utf-8")
                output = root / "private_output"
                summary, tasks = corpus.stage(
                    manifest, output, key, max_bytes=512_000_000)
                self.assertEqual(summary["verified_pdf_files"], 2)
                self.assertEqual(summary["family_clusters"], 1)
                self.assertEqual(summary["unique_sha256_contents"], 1)
                self.assertEqual(summary["duplicate_extra_copies"], 1)
                self.assertEqual(summary["source_files_over_16mb"], 2)
                self.assertFalse(summary["automatic_training_enabled"])
                self.assertFalse(summary["family_holdout_verified"])
                self.assertFalse(summary["production_approved"])
                self.assertFalse(tasks["training_ready"])
                items = tasks["review_tasks"]
                self.assertEqual(items[0]["family_token"], items[1]["family_token"])
                self.assertEqual(items[0]["content_token"], items[1]["content_token"])
                self.assertEqual(items[0]["candidate_review_partition"],
                                 items[1]["candidate_review_partition"])
                self.assertTrue(all(not item["training_approved"] for item in items))
                reports = (output / "corpus-stage-summary.json").read_text()
                reports += (output / "private-review-tasks.json").read_text()
                for forbidden in ("PRIVATE SYNTHETIC NAME", "PRIVATE ARCHIVE NAME",
                                  "1111111", "2222222", digest, "private_originals"):
                    self.assertNotIn(forbidden, reports)
                # A changed source must fail closed, even when the manifest SHA is unchanged.
                (root / "private_originals/sample2.pdf").write_bytes(
                    b"%PDF-1.7\nCHANGED")
                changed, _ = corpus.stage(
                    manifest, output, key, max_bytes=512_000_000)
                self.assertEqual(changed["verified_pdf_files"], 1)
                self.assertFalse(changed["automatic_training_enabled"])


    def test_hmac_namespace_and_key_rotation_are_isolated(self):
        # Synthetic tokens must be deterministic only for the same private key.
        # A different key must not preserve corpus identity or family tokens.
        key_a = bytes(range(32))
        key_b = bytes(reversed(range(32)))
        for cycle in range(3):
            family = f"synthetic-family-{cycle}"
            first = corpus.tag(key_a, "family", family)
            self.assertEqual(first, corpus.tag(key_a, "family", family))
            self.assertNotEqual(first, corpus.tag(key_b, "family", family))
            self.assertNotEqual(first, corpus.tag(key_a, "content", family))
            self.assertNotIn(family, first)
            self.assertNotIn(key_a.hex(), first)

if __name__ == "__main__":
    unittest.main()
