"""Synthetic only: private approval conversations and binary-provenance corpus."""
import hashlib
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
import zipfile
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
import vision_approval_training_corpus as corpus
from vision_approval_training_corpus import transform, CorpusError
from vision_approval_archive_audit import AuditError

ORDER = "8001111"
ITEM = "77"
PNG = b"\x89PNG\r\n\x1a\n" + b"synthetic-bytes"
SHA = hashlib.sha256(PNG).hexdigest()
ENTRY = "attachments/0001/0001.png"

class TrainingCorpusTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.evidence = self.root / f"vision-private-approval-evidence-{ORDER}.json"
        self.archive = self.root / f"vision-private-approval-attachments-{ORDER}-part-0001.zip"
        self.source = {
            "schema": "printcheck.vision.private-approval-collection.v1",
            "scope": "LOCAL_AUTHORIZED_TEST_ORDER",
            "status": "COMPLETE", "order_number": ORDER,
            "training_ready": False, "production_approved": False,
            "remote_upload": False,
            "order_facts": {
                "schema": "printcheck.vision.private-order-facts.v1",
                "capture_status": "ORDER_DOM_CAPTURED",
                "order": {"order_number": ORDER, "internal_order_id": "551",
                    "customer_display": "Тестовый Клиент",
                    "order_date_display": "11 ноя 2026",
                    "order_status_timeline": "Макет на согласовании"},
                "articles": [{"item_id": ITEM,
                    "article_code": "TEST.21",
                    "product_name": "Медаль тестовая",
                    "quantity_and_pricing_text": "16 шт.",
                    "imprint_and_technical_requirements_text": "UV2 0,15 мм"}]
            },
            "articles": [
                {"item_id": ITEM, "article_index": 1, "status": "PRIVATE_REVIEW_ONLY",
                 "current_problems": [
                     {"code":"66", "label":"Толщина линии меньше допуска",
                      "print_method":"SB1", "print_placement":"Поле 1"}
                 ],
                 "history": [
                     {"sequence": 1, "kind": "problem_added",
                      "text": "Добавлены проблемы: тонкие линии",
                      "date_time": "17.11.26 10:22",
                      "native_comment_id": "123001", "actor_ref": "actor_1",
                      "author_name": "Дизайнер Тестовый",
                      "author_display_text": "Дизайнер Тестовый 17.11.26 10:22",
                      "attachments": []},
                     {"sequence": 2, "kind": "human",
                      "text": "Скриншот мелкого элемента",
                      "date_time": "17.11.26 10:25",
                      "native_comment_id": "123002", "actor_ref": "actor_2",
                      "author_name": "Менеджер Тестовый",
                      "attachments": [
                         {"filename": "image.png", "attachment_id": None,
                          "source": "native_approval_gallery",
                          "local_get_status": "LOCAL_ATTACHMENT_BYTES_ONLY",
                          "sha256": SHA, "byte_count": len(PNG),
                          "private_zip_part": 1, "private_zip_entry": ENTRY}
                      ]}
                 ]}
            ]
        }
        self.manifest = {
            "schema": "printcheck.vision.private-approval-attachments.v1",
            "scope": "LOCAL_PRIVATE_ONLY", "source": "native_maketadjusting_attachment_get",
            "order_number": ORDER, "package_part": 1,
            "training_ready": False, "expert_roi_verified": False,
            "source_pdf_revision_confirmed": False,
            "export_to_public_github_allowed": False,
            "items": [{
                "entry": ENTRY, "article_index": 1,
                "order_item_id": ITEM, "comment_sequence": 2,
                "attachment_id": None, "source": "native_approval_gallery",
                "original_filename": "image.png", "bytes": len(PNG),
                "sha256": SHA, "signature_status": "KNOWN_SIGNATURE",
                "version_and_print_method_verified": False,
                "training_ready": False
            }], "skipped": []
        }
        self._save()

    def tearDown(self):
        self.tmp.cleanup()

    def _save(self):
        self.evidence.write_text(json.dumps(self.source), encoding="utf-8")
        with zipfile.ZipFile(self.archive, "w", compression=zipfile.ZIP_STORED) as z:
            z.writestr("manifest.json", json.dumps(self.manifest))
            z.writestr(ENTRY, PNG)

    def table(self, output, name):
        return [json.loads(line) for line in (output/(name+".jsonl")).read_text(
            encoding="utf-8").splitlines()]

    def test_preserves_complete_thread_to_binary_and_review_blockers(self):
        out = self.root / "out"
        result = transform([self.evidence], [self.archive], out)
        self.assertEqual(result["status"], "PRIVATE_CANDIDATE_CORPUS_READY")
        self.assertEqual(result["verified_attachment_links"], 1)
        self.assertEqual(result["missing_attachment_links"], 0)
        self.assertEqual(result["counts"]["messages"], 2)
        self.assertEqual(result["counts"]["problems"], 1)
        self.assertEqual(result["counts"]["assets"], 1)
        msg = self.table(out, "messages")
        self.assertEqual(msg[0]["native_comment_id"], "123001")
        self.assertEqual(msg[1]["actor_ref"], "actor_2")
        self.assertEqual(msg[1]["author_name"], "Менеджер Тестовый")
        self.assertEqual(self.table(out,"orders")[0]["customer_display"],"Тестовый Клиент")
        self.assertEqual(self.table(out,"articles")[0]["article_code"],"TEST.21")
        self.assertIn("0,15",self.table(out,"articles")[0]["imprint_and_technical_requirements_text"])
        self.assertIn("Скриншот", msg[1]["text"])
        asset = self.table(out, "assets")[0]
        self.assertEqual((out/asset["verified_local_file"]).read_bytes(), PNG)
        self.assertEqual(asset["message_id"], msg[1]["id"])
        self.assertEqual(asset["sha256"], SHA)
        self.assertTrue((out/"raw"/f"evidence-{ORDER}.json").exists())
        self.assertTrue((out/"raw"/f"attachments-{ORDER}-part-0001.zip").exists())
        case = self.table(out, "cases")[0]
        self.assertEqual(case["message_ids"], [msg[0]["id"], msg[1]["id"]])
        self.assertEqual(case["attachment_ids"], [asset["id"]])
        self.assertFalse(case["training_ready"])
        self.assertIn("SOURCE_ARTWORK_REVISION_UNKNOWN", case["pending_reasons"])
        self.assertFalse(json.loads((out/"manifest.json").read_text())["public_git_allowed"])
        if os.name == "posix":
            self.assertEqual(out.stat().st_mode & 0o777, 0o700)
            self.assertEqual((out/"messages.jsonl").stat().st_mode & 0o777, 0o600)

    def test_duplicate_binary_uses_streaming_digest_for_existing_asset(self):
        """Two distinct ZIP entries with identical bytes reuse one private asset."""
        duplicate = "attachments/0001/0002.png"
        second = dict(self.source["articles"][0]["history"][1]["attachments"][0])
        second["private_zip_entry"] = duplicate
        self.source["articles"][0]["history"][1]["attachments"].append(second)
        second_manifest = dict(self.manifest["items"][0])
        second_manifest["entry"] = duplicate
        self.manifest["items"].append(second_manifest)
        self.evidence.write_text(json.dumps(self.source), encoding="utf-8")
        with zipfile.ZipFile(self.archive, "w") as z:
            z.writestr("manifest.json", json.dumps(self.manifest))
            z.writestr(ENTRY, PNG)
            z.writestr(duplicate, PNG)
        out = self.root / "deduplicated"
        original_read = Path.read_bytes
        def guard_asset_read(path):
            if path.parent.name == "assets":
                raise AssertionError("asset must be hashed in streaming mode")
            return original_read(path)
        with patch.object(Path, "read_bytes", guard_asset_read):
            result = transform([self.evidence], [self.archive], out)
        self.assertEqual(result["verified_attachment_links"], 2)
        self.assertEqual(len(list((out / "assets").iterdir())), 1)
        self.assertFalse(result["training_ready"])

    def test_rejects_tampered_archive_before_writing_output(self):
        self.manifest["items"][0]["sha256"] = "0"*64
        self._save()
        out = self.root / "out"
        with self.assertRaises(AuditError):
            transform([self.evidence], [self.archive], out)
        self.assertFalse(out.exists())

    def test_rejects_oversized_source_before_creating_corpus(self):
        out = self.root / "limited"
        with patch.object(corpus, "MAX_PRIVATE_ZIP_BYTES", 32):
            with self.assertRaisesRegex(CorpusError, "PRIVATE_ZIP_SIZE_LIMIT"):
                transform([self.evidence], [self.archive], out)
        self.assertFalse(out.exists())

    def test_preflight_rejects_aggregate_expansion_before_output(self):
        out = self.root / "expansion-denied"
        # Synthetic ZIP metadata: the total includes manifest and attachment.
        with zipfile.ZipFile(self.archive, "r") as z:
            total = sum(info.file_size for info in z.infolist())
        self.assertGreater(total, len(PNG))
        with patch.object(corpus, "MAX_PRIVATE_UNCOMPRESSED_BYTES", total - 1):
            with self.assertRaisesRegex(CorpusError, "PRIVATE_UNCOMPRESSED_SIZE_LIMIT"):
                transform([self.evidence], [self.archive], out)
        self.assertFalse(out.exists())

    def test_preflight_accepts_exact_declared_budget(self):
        with zipfile.ZipFile(self.archive, "r") as z:
            total = sum(info.file_size for info in z.infolist())
        with patch.object(corpus, "MAX_PRIVATE_UNCOMPRESSED_BYTES", total):
            result = transform([self.evidence], [self.archive], self.root / "exact-budget")
        self.assertFalse(result["training_ready"])

    def test_rejects_source_changed_after_archive_audit(self):
        out = self.root / "changed"
        real_audit = corpus.audit_archives
        def mutate_after_audit(parts, evidence):
            result = real_audit(parts, evidence)
            with open(self.archive, "ab") as handle:
                handle.write(b"post-audit-mutation")
            return result
        with patch.object(corpus, "audit_archives", side_effect=mutate_after_audit):
            with self.assertRaisesRegex(CorpusError, "SOURCE_ZIP_CHANGED_AFTER_AUDIT"):
                transform([self.evidence], [self.archive], out)
        self.assertFalse((out / "raw" / f"attachments-{ORDER}-part-0001.zip").exists())

    def test_bounded_zip_entry_accepts_small_synthetic_attachment(self):
        with zipfile.ZipFile(self.archive, "r") as z:
            self.assertEqual(corpus.bounded_zip_entry(z, ENTRY), PNG)

    def test_bounded_zip_entry_rejects_decompression_over_limit(self):
        with patch.object(corpus, "MAX_PRIVATE_ATTACHMENT_BYTES", len(PNG) - 1):
            with zipfile.ZipFile(self.archive, "r") as z:
                with self.assertRaisesRegex(CorpusError, "PRIVATE_ATTACHMENT_SIZE_LIMIT"):
                    corpus.bounded_zip_entry(z, ENTRY)

    def test_actual_decompression_budget_rejects_second_entry(self):
        """Runtime counter catches cumulative reads even if metadata preflight passed."""
        duplicate = "attachments/0001/0002.png"
        with zipfile.ZipFile(self.archive, "a") as z:
            z.writestr(duplicate, PNG)
        with zipfile.ZipFile(self.archive, "r") as z:
            budget = [0]
            with patch.object(corpus, "MAX_PRIVATE_UNCOMPRESSED_BYTES", len(PNG)):
                self.assertEqual(corpus.bounded_zip_entry(z, ENTRY, budget), PNG)
                with self.assertRaisesRegex(CorpusError, "PRIVATE_UNCOMPRESSED_SIZE_LIMIT"):
                    corpus.bounded_zip_entry(z, duplicate, budget)
            self.assertGreater(budget[0], len(PNG))

    def test_actual_decompression_budget_exact_boundary(self):
        with zipfile.ZipFile(self.archive, "r") as z:
            budget = [0]
            with patch.object(corpus, "MAX_PRIVATE_UNCOMPRESSED_BYTES", len(PNG)):
                self.assertEqual(corpus.bounded_zip_entry(z, ENTRY, budget), PNG)
            self.assertEqual(budget[0], len(PNG))

    def test_missing_binary_keeps_case_unapproved_with_explicit_reason(self):
        self.source["articles"][0]["history"][1]["attachments"][0].update({
            "local_get_status": "MANUAL_HTTP_ERROR",
            "sha256": None, "byte_count": None,
            "private_zip_part": None, "private_zip_entry": None
        })
        self.evidence.write_text(json.dumps(self.source), encoding="utf-8")
        out = self.root / "incomplete"
        result = transform([self.evidence], [], out)
        self.assertEqual(result["missing_attachment_links"], 1)
        self.assertIn("ATTACHMENT_BYTES_INCOMPLETE",
                      self.table(out, "cases")[0]["pending_reasons"])
        self.assertIsNone(self.table(out, "assets")[0]["verified_local_file"])

if __name__ == "__main__":
    unittest.main()
