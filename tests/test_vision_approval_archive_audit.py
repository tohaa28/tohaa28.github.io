"""Synthetic offline tests: never load or print real customer information."""
import hashlib
import importlib.util
import json
import subprocess
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path

TOOL = Path(__file__).resolve().parents[1] / "tools" / "vision_approval_archive_audit.py"
spec = importlib.util.spec_from_file_location("vision_approval_archive_audit", TOOL)
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)
PDF = b"%PDF-1.7\nsynthetic\n%%EOF\n"


def item(part=1, name="attachments/0001/0001.pdf", data=PDF):
    return dict(entry=name, article_index=1, order_item_id="77", comment_sequence=3,
                attachment_id="14", original_filename="example.pdf", bytes=len(data),
                sha256=hashlib.sha256(data).hexdigest(), signature_status="KNOWN_SIGNATURE",
                version_and_print_method_verified=False, training_ready=False)


def manifest(part=1, entries=None):
    return dict(schema="printcheck.vision.private-approval-attachments.v1",
                scope="LOCAL_PRIVATE_ONLY", order_number="9000001", package_part=part,
                source="native_maketadjusting_attachment_get", training_ready=False,
                expert_roi_verified=False, source_pdf_revision_confirmed=False,
                export_to_public_github_allowed=False, items=entries or [item(part)], skipped=[])


def write_zip(path, m=None, data=PDF, compression=zipfile.ZIP_STORED):
    m = m or manifest()
    with zipfile.ZipFile(path, "w", compression=compression) as zf:
        zf.writestr("manifest.json", json.dumps(m, ensure_ascii=False))
        for record in m["items"]:
            zf.writestr(record["entry"], data)
    return path


def evidence(path):
    report = {"schema": "printcheck.vision.private-approval-collection.v1",
              "order_number": "9000001", "articles": [
                  {"status": "PRIVATE_REVIEW_ONLY", "item_id": "77", "history": [
                      {"sequence": 3, "attachments": [
                          {"attachment_id": "14", "filename": "example.pdf",
                           "byte_count": len(PDF), "sha256": hashlib.sha256(PDF).hexdigest(),
                           "local_get_status": "LOCAL_ATTACHMENT_BYTES_ONLY",
                           "private_zip_part": 1,
                           "private_zip_entry": "attachments/0001/0001.pdf"}]}]}]}
    path.write_text(json.dumps(report), encoding="utf8")
    return path


class ArchiveAuditTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.folder = Path(self.tmp.name)
        self.zip = write_zip(self.folder / "part.zip")
        self.evidence = evidence(self.folder / "private.json")

    def reason(self, zip_paths=None, evidence_path=None):
        with self.assertRaises(audit.AuditError) as ctx:
            audit.audit_archives(zip_paths or [self.zip], evidence_path)
        return str(ctx.exception)

    def test_valid_synthetic_part_and_exact_evidence_mapping(self):
        summary = audit.audit_archives([self.zip], self.evidence)
        self.assertEqual(summary["status"], "LOCAL_ARCHIVES_VERIFIED")
        self.assertEqual(summary["attachments"], 1)
        self.assertEqual(summary["payload_bytes"], len(PDF))
        self.assertTrue(summary["evidence_crosschecked"])
        self.assertFalse(summary["training_ready"])
        self.assertEqual(summary["contains_private_ids"], False)
        self.assertEqual(audit.audit_archives([self.zip])["status"],
                         "LOCAL_PARTS_ONLY_VERIFIED")

    def test_same_length_byte_change_with_recomputed_zip_crc_fails_sha256(self):
        changed = PDF.replace(b"synthetic", b"synthetiC")
        self.assertEqual(len(PDF), len(changed))
        write_zip(self.zip, data=changed)
        self.assertEqual(self.reason(), "ITEM_SHA256_MISMATCH")

    def test_mismatched_source_item_and_missing_evidence(self):
        raw = json.loads(self.evidence.read_text())
        raw["articles"][0]["history"][0]["attachments"][0]["attachment_id"] = "99"
        self.evidence.write_text(json.dumps(raw))
        self.assertEqual(self.reason(evidence_path=self.evidence), "EVIDENCE_SOURCE_MAPPING_MISMATCH")
        raw["articles"][0]["history"][0]["attachments"] = []
        self.evidence.write_text(json.dumps(raw))
        self.assertEqual(self.reason(evidence_path=self.evidence), "EVIDENCE_ARCHIVE_COVERAGE_MISMATCH")

    def test_reject_unsafe_path_flags_compression_and_duplicate_parts(self):
        m = manifest()
        m["items"][0]["entry"] = "attachments/0001/../secret.pdf"
        write_zip(self.zip, m)
        self.assertEqual(self.reason(), "ZIP_ITEM_PATH_MISMATCH")
        m = manifest()
        m["training_ready"] = True
        write_zip(self.zip, m)
        self.assertEqual(self.reason(), "UNSAFE_MANIFEST_FLAG")
        write_zip(self.zip, manifest(), compression=zipfile.ZIP_DEFLATED)
        self.assertEqual(self.reason(), "ZIP_COMPRESSION_OR_ENCRYPTION")
        write_zip(self.zip)
        other = write_zip(self.folder / "copy.zip")
        self.assertEqual(self.reason([self.zip, other]), "PART_DUPLICATE_OR_INVALID")

    def test_missing_part_and_wrong_order(self):
        part2 = manifest(2, [item(2, "attachments/0002/0001.pdf")])
        write_zip(self.zip, part2)
        self.assertEqual(self.reason(), "PARTS_MISSING")
        write_zip(self.zip)
        part2_path = write_zip(self.folder / "part2.zip", part2)
        result = audit.audit_archives([part2_path, self.zip])
        self.assertEqual(result["parts"], 2)
        self.assertEqual(result["attachments"], 2)

    def test_cli_redacts_private_paths_and_item_names(self):
        m = manifest()
        m["items"][0]["sha256"] = "bad"
        write_zip(self.zip, m)
        child = subprocess.run([sys.executable, str(TOOL), str(self.zip)],
                               capture_output=True, text=True)
        self.assertEqual(child.returncode, 1)
        data = json.loads(child.stdout)
        self.assertEqual(data["reason"], "ITEM_SHA256_MISSING")
        self.assertNotIn(str(self.zip), child.stdout)
        self.assertNotIn("example.pdf", child.stdout)
        self.assertFalse(child.stderr)


    def test_duplicate_manifest_json_key_rejected_before_flag_interpretation(self):
        m = manifest()
        raw = json.dumps(m, ensure_ascii=False)
        self.assertIn('"training_ready": false', raw)
        raw = raw.replace('"training_ready": false',
                          '"training_ready": true, "training_ready": false', 1)
        with zipfile.ZipFile(self.zip, "w", compression=zipfile.ZIP_STORED) as zf:
            zf.writestr("manifest.json", raw)
            zf.writestr(m["items"][0]["entry"], PDF)
        self.assertEqual(self.reason(evidence_path=self.evidence), "DUPLICATE_JSON_KEY")
        child = subprocess.run([sys.executable, str(TOOL), str(self.zip)],
                               capture_output=True, text=True)
        self.assertEqual(child.returncode, 1)
        receipt = json.loads(child.stdout)
        self.assertEqual(receipt["reason"], "DUPLICATE_JSON_KEY")
        self.assertFalse(receipt.get("training_ready", False))
        for secret in (str(self.zip), "9000001", "example.pdf"):
            self.assertNotIn(secret, child.stdout + child.stderr)

    def test_duplicate_private_evidence_json_key_rejected_without_leak(self):
        raw = self.evidence.read_text(encoding="utf8")
        self.assertIn('"order_number": "9000001"', raw)
        raw = raw.replace('"order_number": "9000001"',
                          '"order_number": "9000002", "order_number": "9000001"', 1)
        self.evidence.write_text(raw, encoding="utf8")
        self.assertEqual(self.reason(evidence_path=self.evidence), "DUPLICATE_JSON_KEY")
        child = subprocess.run([sys.executable, str(TOOL), str(self.zip),
                                "--evidence", str(self.evidence)],
                               capture_output=True, text=True)
        self.assertEqual(child.returncode, 1)
        receipt = json.loads(child.stdout)
        self.assertEqual(receipt["reason"], "DUPLICATE_JSON_KEY")
        self.assertFalse(receipt.get("training_ready", False))
        for secret in (str(self.zip), str(self.evidence), "9000001", "9000002",
                       "example.pdf"):
            self.assertNotIn(secret, child.stdout + child.stderr)


    def test_nested_duplicate_item_digest_is_fail_closed_and_redacted(self):
        m = manifest()
        raw = json.dumps(m, ensure_ascii=False)
        digest = m["items"][0]["sha256"]
        original = '"sha256": "' + digest + '"'
        self.assertIn(original, raw)
        raw = raw.replace(original,
                          '"sha256": "' + "0" * 64 + '", ' + original, 1)
        with zipfile.ZipFile(self.zip, "w", compression=zipfile.ZIP_STORED) as zf:
            zf.writestr("manifest.json", raw)
            zf.writestr(m["items"][0]["entry"], PDF)
        self.assertEqual(self.reason(evidence_path=self.evidence), "DUPLICATE_JSON_KEY")
        child = subprocess.run([sys.executable, str(TOOL), str(self.zip),
                                "--evidence", str(self.evidence)],
                               capture_output=True, text=True)
        self.assertEqual(child.returncode, 1)
        receipt = json.loads(child.stdout)
        self.assertEqual(receipt["reason"], "DUPLICATE_JSON_KEY")
        self.assertIs(receipt["training_ready"], False)
        self.assertIs(receipt["production_approved"], False)
        for secret in (str(self.zip), str(self.evidence), digest, "9000001",
                       "example.pdf"):
            self.assertNotIn(secret, child.stdout + child.stderr)


    def test_nested_duplicate_evidence_digest_rejected_without_leak(self):
        """Duplicate nested digest cannot be selected by JSON parser ordering."""
        raw = self.evidence.read_text(encoding="utf8")
        digest = hashlib.sha256(PDF).hexdigest()
        original = '"sha256": "' + digest + '"'
        self.assertIn(original, raw)
        raw = raw.replace(original,
                          '"sha256": "' + "0" * 64 + '", ' + original, 1)
        self.evidence.write_text(raw, encoding="utf8")
        self.assertEqual(self.reason(evidence_path=self.evidence), "DUPLICATE_JSON_KEY")
        child = subprocess.run([sys.executable, str(TOOL), str(self.zip),
                                "--evidence", str(self.evidence)],
                               capture_output=True, text=True)
        self.assertEqual(child.returncode, 1)
        receipt = json.loads(child.stdout)
        self.assertEqual(receipt["reason"], "DUPLICATE_JSON_KEY")
        self.assertIs(receipt["training_ready"], False)
        self.assertIs(receipt["production_approved"], False)
        for secret in (str(self.zip), str(self.evidence), digest, "9000001",
                       "example.pdf"):
            self.assertNotIn(secret, child.stdout + child.stderr)


if __name__ == "__main__":
    unittest.main()
