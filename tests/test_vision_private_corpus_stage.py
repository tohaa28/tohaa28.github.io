"""Synthetic-only tests for private PDF corpus staging; no customer artwork."""
from __future__ import annotations
import hashlib
import json
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
import vision_private_corpus_stage as stage


class PrivateCorpusStageTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        (self.root / "private_originals").mkdir()
        self.key = self.root / "private_grouping_key.bin"
        self.key.write_bytes(bytes(range(32)))
        self.out = self.root / "output"
        self.manifest = self.root / "private_full_manifest.json"

    def tearDown(self):
        self.tmp.cleanup()

    def add(self, archive, sequence, family, label, contents=None, tags=None):
        if contents is None:
            contents = ("%PDF-1.7\nSYNTHETIC %d:%d\n" % (
                archive, sequence)).encode()
        rel = "private_originals/archive%d_file%04d.pdf" % (archive, sequence)
        (self.root / rel).write_bytes(contents)
        return {
            "archive": archive, "sequence": sequence,
            "stored_as": rel,
            "bytes": len(contents), "sha256": hashlib.sha256(contents).hexdigest(),
            "original_filename": "SYNTHETIC PRIVATE CUSTOMER order=%s.pdf" % family,
            "order_group": family,
            "provisional_label": label, "filename_defect_tags": tags or [],
            "label_verification": "NOT_VERIFIED", "training_approved": False
        }

    def save(self, entries):
        self.manifest.write_text(json.dumps({
            "schema": stage.SCHEMA, "data_private": True,
            "source_names": ["PRIVATE SECRET ARCHIVE.rar"], "entries": entries
        }), encoding="utf-8")

    def test_duplicate_conflict_links_separate_families_and_never_trains(self):
        same = b"%PDF-1.7\nPRIVATE UNIQUE CONTENT"
        rows = [
            self.add(1,1,"7771769","unlabeled_reference",same),
            self.add(1,2,"7771769","error_claim_in_filename",
                     b"%PDF-1.4\nanother",["positive_stroke"]),
            self.add(2,1,"7772796","error_claim_in_filename",same),
            self.add(2,2,"7773608","explicit_clean_filename")
        ]
        self.save(rows)
        summary, output = stage.stage(self.manifest,self.out,self.key)
        self.assertEqual(summary["source_files"],4)
        self.assertEqual(summary["verified_pdf_files"],4)
        self.assertEqual(summary["family_clusters"],2)
        self.assertEqual(summary["unique_sha256_contents"],3)
        self.assertEqual(summary["duplicate_sha256_groups"],1)
        self.assertEqual(summary["duplicate_extra_copies"],1)
        self.assertEqual(summary["sha256_groups_with_mixed_filename_claims"],1)
        self.assertEqual(summary["sha256_error_claim_plus_unlabeled_groups"],1)
        self.assertEqual(summary["sha256_clean_claim_plus_unlabeled_groups"],0)
        self.assertEqual(summary["sha256_opposing_error_clean_claim_groups"],0)
        queue = output["review_tasks"]
        self.assertEqual(len(queue),4)
        self.assertEqual(queue[0]["priority"],"P0_MIXED_FILENAME_CLAIMS")
        self.assertEqual(queue[1]["priority"],"P0_MIXED_FILENAME_CLAIMS")
        self.assertEqual(queue[0]["family_token"],queue[1]["family_token"])
        self.assertEqual(queue[0]["content_token"],queue[1]["content_token"])
        self.assertEqual(queue[0]["candidate_review_partition"],
                         queue[1]["candidate_review_partition"])
        self.assertTrue(all(not x["training_approved"] for x in queue))
        self.assertFalse(summary["family_holdout_verified"])
        self.assertEqual(summary["training_approved_count"],0)
        safe = (self.out/"corpus-stage-summary.json").read_text()
        safe += (self.out/"private-review-tasks.json").read_text()
        for secret in ("PRIVATE SECRET ARCHIVE", "SYNTHETIC PRIVATE CUSTOMER",
                       "7771769", "7772796", "7773608",
                       "private_originals/", "PRIVATE UNIQUE CONTENT",
                       rows[0]["sha256"]):
            self.assertNotIn(secret,safe)
        self.assertTrue((self.out/"corpus-stage-summary.json").is_file())
        summary2, output2 = stage.stage(self.manifest,self.out,self.key)
        self.assertEqual(summary2,summary)
        self.assertEqual(output2,output)

    def test_streams_files_exceeding_browser_limit_and_caps_huge_files(self):
        big = b"%PDF-" + b"X" * 16_000_100
        self.save([self.add(1,1,"7771769","unlabeled_reference",big)])
        summary, queue = stage.stage(self.manifest,self.out,self.key)
        self.assertEqual(summary["verified_pdf_files"],1)
        self.assertEqual(summary["source_files_over_16mb"],1)
        self.assertTrue(queue["review_tasks"][0]["over_browser_16mb_limit"])
        second,_ = stage.stage(self.manifest,self.out,self.key,
                              max_bytes=16_000_000)
        self.assertEqual(second["verification_statuses"]["SOURCE_OVER_LIMIT"],1)
        self.assertFalse(second["automatic_training_enabled"])

    def test_changed_source_fails_closed(self):
        row = self.add(1,1,"7771769","explicit_clean_filename")
        self.save([row])
        (self.root/row["stored_as"]).write_bytes(
            b"%PDF-1.7\nSYNTHETIC same-length but different file")
        report, q = stage.stage(self.manifest,self.out,self.key)
        self.assertEqual(report["verified_pdf_files"],0)
        self.assertNotEqual(q["review_tasks"][0]["priority"],"P3_CLEAN_CLAIM")
        self.assertFalse(q["review_tasks"][0]["training_approved"])

    def test_path_traversal_unsafe_manifest_and_training_claims_fail(self):
        row = self.add(1,1,"7771769","unlabeled_reference")
        for prop,bad,expected in [
            ("stored_as", "../sneaky.pdf", "PRIVATE_SOURCE_RELATIVE_PATH_INVALID"),
            ("training_approved",True,"UNVERIFIED_LABEL_REQUIRED"),
            ("label_verification","VERIFIED","UNVERIFIED_LABEL_REQUIRED"),
            ("bytes",True,"PRIVATE_SOURCE_METADATA_INVALID"),
            ("order_group","PRIVATE CUSTOMER NAME","PRIVATE_FAMILY_KEY_INVALID")
        ]:
            with self.subTest(prop=prop):
                amended = {**row,prop:bad}
                self.save([amended])
                with self.assertRaisesRegex(ValueError,expected):
                    stage.stage(self.manifest,self.out,self.key)
        self.save([row,row])
        with self.assertRaisesRegex(ValueError,"PRIVATE_ENTRY_DUPLICATED"):
            stage.stage(self.manifest,self.out,self.key)

    def test_symlink_source_refused_and_unchanged_source_is_not_exfiltrated(self):
        row = self.add(1,1,"7771769","unlabeled_reference")
        self.save([row])
        source = self.root / row["stored_as"]
        source.unlink()
        secret = self.root / "private-external.pdf"
        secret.write_bytes(b"%PDF-1.7\nno access")
        try:
            source.symlink_to(secret)
        except (OSError, NotImplementedError):
            self.skipTest("OS does not permit symlink fixtures")
        summary, tasks = stage.stage(self.manifest,self.out,self.key)
        self.assertEqual(summary["verified_pdf_files"],0)
        self.assertEqual(tasks["review_tasks"][0]["priority"],
                         "P0_SOURCE_UNAVAILABLE")
        self.assertNotIn(str(secret), json.dumps(summary))


if __name__=="__main__":
    unittest.main()
