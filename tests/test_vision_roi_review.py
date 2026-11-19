"""Synthetic local Vision ROI review tests. No real customer files."""
import io
import json
from pathlib import Path
import sys
import tempfile
import unittest
import zipfile
import hashlib

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
import vision_local_lab as lab
import vision_roi_review as review

SVG = b'<svg xmlns="http://www.w3.org/2000/svg" width="100mm" height="80mm"></svg>'


class ReviewWorkflowTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name) / "lab"
        lab.init(self.root)
        stream = io.BytesIO()
        with zipfile.ZipFile(stream, "w") as z:
            z.writestr("samples/0001.svg", SVG)
            z.writestr("manifest.json", json.dumps({
                "schema": lab.SCHEMA,
                "training_ready": False,
                "public_upload_permitted": False,
                "samples": [{
                    "sample_name": "samples/0001.svg",
                    "expert_label": "unreviewed",
                    "bytes": len(SVG),
                    "sha256": hashlib.sha256(SVG).hexdigest()
                }]
            }))
        archive = Path(self.temp.name) / "source.zip"
        archive.write_bytes(stream.getvalue())
        lab.import_zip(self.root, archive)
        self.sample_id = lab.list_samples(self.root)[0]["sample_id"]

    def tearDown(self):
        self.temp.cleanup()

    def proposal(self, **changes):
        params = dict(sample_id=self.sample_id, expert="designer",
                      kind="narrow_gap", technology="screen_print",
                      units="svg_document_mm", x=2., y=3.,
                      width=.13, height=1.)
        params.update(changes)
        return review.propose(self.root, **params)

    def test_original_streaming_sha_accepts_valid_and_rejects_tampering(self):
        with lab.open_db(self.root) as db:
            relative, expected = db.execute(
                "SELECT relative_path, source_sha256 FROM samples WHERE id=?",
                (self.sample_id,)).fetchone()
        review.verify_original(self.root, relative, expected)
        original = self.root / relative
        original.write_bytes(b"modified synthetic artwork")
        with self.assertRaisesRegex(ValueError, "SOURCE_SHA256_MISMATCH"):
            review.verify_original(self.root, relative, expected)

    def test_original_streaming_rejects_oversized_and_unsafe_path_without_leak(self):
        with lab.open_db(self.root) as db:
            relative, expected = db.execute(
                "SELECT relative_path, source_sha256 FROM samples WHERE id=?",
                (self.sample_id,)).fetchone()
        original = self.root / relative
        with original.open("wb") as stream:
            stream.truncate(lab.MAX_FILE + 1)
        with self.assertRaises(ValueError) as caught:
            review.verify_original(self.root, relative, expected)
        self.assertEqual(str(caught.exception), "SOURCE_PATH_UNSAFE")
        self.assertNotIn(str(self.root), str(caught.exception))
        with self.assertRaisesRegex(ValueError, "SOURCE_PATH_UNSAFE"):
            review.verify_original(self.root, "../outside.svg", expected)

    def test_distinct_independent_votes_create_research_consensus_not_training(self):
        case = self.proposal()
        review.vote(self.root, case_id=case, expert="expert_a",
                    verdict="confirmed_defect")
        self.assertEqual(review.queue(self.root)[0]["state"],
                         "NEEDS_SECOND_INDEPENDENT_REVIEW")
        review.vote(self.root, case_id=case, expert="expert_b",
                    verdict="confirmed_defect")
        result = review.queue(self.root)[0]
        self.assertEqual(result["state"], "CONSENSUS_RESEARCH_ONLY")
        self.assertEqual(result["research_label"], "confirmed_defect")
        self.assertFalse(result["physical_scale_verified"])
        self.assertFalse(result["training_approved"])
        self.assertEqual(review.summary(self.root)["training_approved"], 0)
        self.assertEqual(lab.report(self.root)["auto_approved_training_samples"], 0)

    def test_disagreement_requires_a_third_independent_adjudicator(self):
        case = self.proposal()
        review.vote(self.root, case_id=case, expert="expert_a",
                    verdict="confirmed_defect")
        review.vote(self.root, case_id=case, expert="expert_b",
                    verdict="false_positive")
        self.assertEqual(review.queue(self.root)[0]["state"],
                         "DISAGREEMENT_NEEDS_ADJUDICATION")
        self.assertEqual(review.summary(self.root)["disagreements"], 1)
        with self.assertRaisesRegex(ValueError, "ADJUDICATOR_MUST_BE_INDEPENDENT"):
            review.adjudicate(self.root, case_id=case, expert="expert_a",
                              verdict="uncertain")
        review.adjudicate(self.root, case_id=case, expert="expert_c",
                          verdict="uncertain")
        self.assertEqual(review.queue(self.root)[0]["state"],
                         "ADJUDICATED_RESEARCH_ONLY")
        self.assertEqual(review.queue(self.root)[0]["research_label"], "uncertain")
        with self.assertRaisesRegex(ValueError, "ADJUDICATION_ALREADY_EXISTS"):
            review.adjudicate(self.root, case_id=case, expert="expert_d",
                              verdict="confirmed_defect")

    def test_identity_and_votes_are_immutable(self):
        case = self.proposal()
        with self.assertRaisesRegex(ValueError, "REVIEWER_MUST_BE_INDEPENDENT"):
            review.vote(self.root, case_id=case, expert="designer",
                        verdict="confirmed_defect")
        review.vote(self.root, case_id=case, expert="expert_a",
                    verdict="false_positive")
        with self.assertRaisesRegex(ValueError, "DUPLICATE_EXPERT_REVIEW"):
            review.vote(self.root, case_id=case, expert="expert_a",
                        verdict="confirmed_defect")
        review.vote(self.root, case_id=case, expert="expert_b",
                    verdict="false_positive")
        with self.assertRaisesRegex(ValueError, "TWO_INDEPENDENT_REVIEWS_ALREADY_COMPLETE"):
            review.vote(self.root, case_id=case, expert="expert_c",
                        verdict="uncertain")
        with self.assertRaisesRegex(ValueError, "ADJUDICATION_REQUIRES_TWO_DISAGREEING_REVIEWS"):
            review.adjudicate(self.root, case_id=case, expert="expert_c",
                              verdict="confirmed_defect")

    def test_proposal_requires_finite_positive_geometry_and_exact_units(self):
        for key, bad in (("width", 0.), ("height", -2.), ("x", -3.),
                         ("x", float("nan")), ("height", float("inf"))):
            with self.subTest(key=key, bad=bad), self.assertRaises(ValueError):
                self.proposal(**{key: bad})
        # bool is a subclass of int; reject it for all ROI coordinates.
        for key in ("x", "y", "width", "height"):
            for bad in (True, False):
                with self.subTest(key=key, bad=bad), self.assertRaisesRegex(
                    ValueError, "ROI_NONFINITE"
                ):
                    self.proposal(**{key: bad})
        self.assertEqual(review.summary(self.root)["total_cases"], 0)
        with self.assertRaisesRegex(ValueError, "ROI_UNIT_FORMAT_MISMATCH"):
            self.proposal(units="pdf_page_pt", page_number=1)
        with self.assertRaisesRegex(ValueError, "PDF_PAGE_NUMBER_REQUIRED"):
            self.proposal(page_number=1)
        with self.assertRaisesRegex(ValueError, "SAMPLE_ID_NOT_FOUND"):
            self.proposal(sample_id="missing:0001")
        with self.assertRaisesRegex(ValueError, "EXPERT_ID_INVALID"):
            self.proposal(expert="<html>")

    def test_modified_original_cannot_be_used_for_new_or_existing_roi_votes(self):
        case = self.proposal()
        item = lab.list_samples(self.root)[0]
        original = self.root / item["path"]
        original.write_bytes(SVG + b"tampered")
        with self.assertRaisesRegex(ValueError, "SOURCE_SHA256_MISMATCH"):
            self.proposal()
        with self.assertRaisesRegex(ValueError, "SOURCE_SHA256_MISMATCH"):
            review.vote(self.root, case_id=case, expert="expert_a",
                        verdict="confirmed_defect")
        self.assertEqual(review.queue(self.root)[0]["review_count"], 0)

    def test_local_queue_does_not_expose_original_filenames_or_file_bytes(self):
        case = self.proposal()
        string = json.dumps(review.queue(self.root), ensure_ascii=False)
        self.assertNotIn(".svg", string)
        self.assertNotIn("sample_name", string)
        self.assertNotIn(SVG.decode(), string)
        self.assertIn(case, string)

    def test_active_learning_review_priority_changes_after_independent_votes(self):
        initial = review.prioritized_review_queue(self.root)
        self.assertEqual(len(initial), 1)
        self.assertEqual(initial[0]["reason"], "EXPERT_ROI_PROPOSAL_REQUIRED")
        self.assertFalse(initial[0]["training_approved"])
        case = self.proposal()
        self.assertEqual(review.prioritized_review_queue(self.root)[0]["reason"],
                         "INDEPENDENT_REVIEWERS_REQUIRED")
        review.vote(self.root, case_id=case, expert="expert_a",
                    verdict="confirmed_defect")
        self.assertEqual(review.prioritized_review_queue(self.root)[0]["reason"],
                         "SECOND_REVIEW_REQUIRED")
        review.vote(self.root, case_id=case, expert="expert_b",
                    verdict="false_positive")
        priority = review.prioritized_review_queue(self.root)[0]
        self.assertEqual(priority["priority"], 0)
        self.assertEqual(priority["reason"], "ADJUDICATOR_REQUIRED")
        self.assertNotIn("relative_path", priority)
        self.assertNotIn("original_filename", priority)
        review.adjudicate(self.root, case_id=case, expert="expert_c",
                          verdict="uncertain")
        self.assertEqual(review.prioritized_review_queue(self.root), [])
        self.assertEqual(review.summary(self.root)["training_approved"], 0)

    def test_existing_legacy_annotations_are_preserved(self):
        case = self.proposal()
        with lab.open_db(self.root) as db:
            db.execute("""INSERT INTO roi_reviews
                (sample_id,expert,kind,label,units,x,y,width,height,technology,created_at)
                VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
                (self.sample_id, "legacy_expert", "thin_line", "confirmed_defect",
                 "svg_document_mm", 1., 2., .2, 3., "screen_print", "2026-01-01"))
        self.assertEqual(lab.report(self.root)["with_expert_roi"], 1)
        self.assertEqual(review.queue(self.root)[0]["case_id"], case)
        self.assertEqual(review.queue(self.root)[0]["review_count"], 0)


if __name__ == "__main__":
    unittest.main()
