"""Only synthetic ZIP bytes: never use customer artwork in public CI."""
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
import zipfile

MODULE_PATH = Path(__file__).resolve().parents[1] / "vision" / "dataset" / "inventory.py"
spec = importlib.util.spec_from_file_location("pcv_inventory", MODULE_PATH)
inventory = importlib.util.module_from_spec(spec)
spec.loader.exec_module(inventory)


def make_zip(path, entries):
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as f:
        for name, data in entries:
            f.writestr(name, data)


class InventoryTest(unittest.TestCase):
    def test_duplicates_and_private_names_are_not_exposed(self):
        with tempfile.TemporaryDirectory() as d:
            a = Path(d) / "private-order-1234567.zip"
            b = Path(d) / "private-order-9999999.zip"
            make_zip(a, [
                ("private/1234567/customer-logo.pdf", b"%PDF-1.4 synthetic"),
                ("private/customer-logo-copy.pdf", b"%PDF-1.4 synthetic"),
                ("private/details.json", b'{"source":"synthetic"}'),
            ])
            make_zip(b, [
                ("orders/9999999/another.pdf", b"%PDF-1.4 synthetic"),
                ("orders/9999999/unique.png", b"\x89PNG fake"),
            ])
            result = inventory.summarize_archives([a,b])
            self.assertEqual(result["processed_archives"],2)
            self.assertEqual(result["unique_files"],3)
            self.assertEqual(result["exact_duplicates"],2)
            self.assertEqual(result["artwork_candidates"],2)
            self.assertEqual(result["context_candidates"],1)
            self.assertEqual(result["labels"]["expert_confirmed"],0)
            dumped=json.dumps(result)
            self.assertNotIn("1234567",dumped)
            self.assertNotIn("9999999",dumped)
            self.assertNotIn("customer-logo",dumped)
            self.assertNotIn("manifest",result)

    def test_explicit_manifest_has_content_hashes_but_not_names(self):
        with tempfile.TemporaryDirectory() as d:
            f=Path(d)/"private.zip"
            make_zip(f,[("secret-client/logo.svg",b"<svg/>")])
            result=inventory.summarize_archives([f],include_hashes=True)
            self.assertEqual(len(result["manifest"]),1)
            item=result["manifest"][0]
            self.assertEqual(len(item["sha256"]),64)
            self.assertEqual(item["label"],"unreviewed")
            self.assertEqual(item["split"],"unassigned")
            self.assertNotIn("secret-client",json.dumps(result))
            self.assertNotIn("name",item)
            self.assertNotIn("file_path",item)

    def test_zip_slip_and_nested_archive_are_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            f=Path(d)/"cases.zip"
            make_zip(f,[("../outside.pdf",b"bad"),
                        ("/absolute.jpg",b"bad"),
                        ("normal/a.svg",b"<svg/>"),
                        ("nested.zip",b"zipped")])
            result=inventory.summarize_archives([f])
            self.assertEqual(result["unique_files"],1)
            self.assertEqual(result["skipped"]["unsafe_path"],2)
            self.assertEqual(result["skipped"]["unsupported_type"],1)
            self.assertFalse((Path(d)/"outside.pdf").exists())

    def test_suspicious_ratio_and_total_limits(self):
        with tempfile.TemporaryDirectory() as d:
            f=Path(d)/"ratio.zip"
            make_zip(f,[("highly-compressible.svg",b"a"*500000),
                        ("safe.pdf",b"start-synthetic-pdf")])
            result=inventory.summarize_archives([f])
            self.assertGreaterEqual(result["skipped"].get("suspicious_ratio",0),1)
            self.assertEqual(result["unique_files"],1)

    def test_invalid_archive_and_existing_output_guard(self):
        with tempfile.TemporaryDirectory() as d:
            f=Path(d)/"broken.zip"
            f.write_bytes(b"not a ZIP")
            result=inventory.summarize_archives([f])
            self.assertEqual(result["processed_archives"],0)
            self.assertEqual(result["archive_errors"].get("archive_failed_BadZipFile"),1)

    def test_real_filename_is_never_a_quality_label(self):
        with tempfile.TemporaryDirectory() as d:
            f=Path(d)/"bad-labels.zip"
            make_zip(f,[("good_approved.pdf",b"unknown"),
                        ("bad_diagnostic.pdf",b"also unknown")])
            r=inventory.summarize_archives([f],include_hashes=True)
            self.assertEqual(r["labels"]["expert_confirmed"],0)
            self.assertEqual({x["label"] for x in r["manifest"]},{"unreviewed"})


if __name__ == "__main__":
    unittest.main()
