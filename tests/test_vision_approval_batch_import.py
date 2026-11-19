"""Synthetic one-archive Vision AI import: full attribution, SHA and fail-closed."""
import hashlib
import json
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
from vision_approval_batch_import import load_batch_zip, BatchImportError

ORDER = "8001111"
ITEM = "77"
PNG = b"\x89PNG\r\n\x1a\n" + b"synthetic-bytes"
SHA = hashlib.sha256(PNG).hexdigest()
SOURCE = {
    "schema": "printcheck.vision.private-approval-collection.v1",
    "order_number": ORDER,
    "status": "COMPLETE",
    "training_ready": False, "production_approved": False,
    "remote_upload": False,
    "order_facts": {
        "schema": "printcheck.vision.private-order-facts.v1",
        "capture_status": "ORDER_DOM_CAPTURED",
        "order": {"order_number": ORDER, "customer_display": "Клиент Тестовый"},
        "articles": [{"item_id": ITEM, "article_code": "TEST.21",
                      "imprint_and_technical_requirements_text": "UV2 0,15 мм"}]
    },
    "articles": [{
        "item_id": ITEM, "article_index": 1, "status": "PRIVATE_REVIEW_ONLY",
        "current_problems": [{"code": "4", "label": "Тонкие линии",
                              "print_method": "UV2", "print_placement": "Поле 1"}],
        "history": [{
            "sequence": 1, "kind": "human", "text": "Линия слишком тонкая",
            "author_name": "Дизайнер Тестовый", "date_time": "19.11.26 10:20",
            "attachments": [{
                "filename": "capture.png", "attachment_id": None,
                "source": "native_approval_gallery",
                "local_get_status": "LOCAL_ATTACHMENT_BYTES_ONLY",
                "sha256": SHA, "byte_count": len(PNG),
                "signature_status": "KNOWN_SIGNATURE",
                "private_zip_part": 1,
                "private_zip_entry": "attachments/0001/0001.png"
            }]
        }]
    }]
}

class BatchImportTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.source = self.root / "vision-ai-approvals-synthetic.zip"
        self.output = self.root / "corpus"
        self.make_zip()

    def tearDown(self):
        self.temp.cleanup()

    def make_zip(self, corrupt=False, unsafe=False):
        prefix = f"orders/{ORDER}/"
        row = SOURCE["articles"][0]["history"][0]["attachments"][0]
        asset = prefix + f"assets/{SHA}.png"
        with zipfile.ZipFile(self.source, "w", zipfile.ZIP_STORED) as z:
            z.writestr("manifest.json", json.dumps({
                "schema": "printcheck.vision.local-batch-corpus.v1",
                "training_ready": False, "production_approved": False,
                "remote_upload": False, "counts": {"orders": 1}}))
            z.writestr("index/orders.json", json.dumps([
                {"order_number": ORDER, "evidence_status": "FINAL"}]))
            for name, obj in [
                ("order.json", SOURCE["order_facts"]["order"]),
                ("articles.json", SOURCE["order_facts"]["articles"]),
                ("approvals.json", SOURCE["articles"]),
                ("review.json", {"training_ready": False}),
                ("files-index.json", [{
                    "item_id": ITEM, "comment_sequence": 1,
                    "original_filename": row["filename"],
                    "sha256": row["sha256"], "asset_path": asset
                }]),
                ("source/evidence.json", SOURCE),
                (f"threads/{ITEM}.json", {
                    "order_number": ORDER, "item_id": ITEM,
                    "history": SOURCE["articles"][0]["history"],
                    "current_problems": SOURCE["articles"][0]["current_problems"],
                    "training_ready": False
                })
            ]:
                z.writestr(prefix + name, json.dumps(obj, ensure_ascii=False))
            z.writestr(asset, PNG if not corrupt else b"not-a-png")
            if unsafe:
                z.writestr("../escape.json", "{}")

    def table(self, name):
        return [json.loads(line) for line in
                (self.output / (name + ".jsonl")).read_text(
                    encoding="utf-8").splitlines()]

    def test_full_single_archive_roundtrip(self):
        result = load_batch_zip(self.source, self.output)
        self.assertEqual(result["status"], "PRIVATE_CANDIDATE_CORPUS_READY")
        self.assertEqual(result["verified_attachment_links"], 1)
        self.assertEqual(self.table("orders")[0]["customer_display"], "Клиент Тестовый")
        self.assertEqual(self.table("articles")[0]["article_code"], "TEST.21")
        self.assertEqual(self.table("messages")[0]["author_name"], "Дизайнер Тестовый")
        self.assertEqual(self.table("problems")[0]["designer_text"], "Тонкие линии")
        self.assertEqual((self.output / self.table("assets")[0]["verified_local_file"]).read_bytes(), PNG)
        self.assertFalse(self.table("cases")[0]["training_ready"])
        self.assertTrue((self.output/"batch-source.json").exists())

    def test_file_byte_mismatch_never_prepares_corpus(self):
        self.make_zip(corrupt=True)
        with self.assertRaisesRegex(BatchImportError, "BATCH_ASSET_DIGEST_INVALID"):
            load_batch_zip(self.source, self.output)
        self.assertFalse(self.output.exists())

    def test_zip_slip_is_rejected_before_writing(self):
        self.make_zip(unsafe=True)
        with self.assertRaisesRegex(BatchImportError, "BATCH_UNSAFE_ENTRY"):
            load_batch_zip(self.source, self.output)
        self.assertFalse(self.output.exists())


if __name__ == "__main__":
    unittest.main()
