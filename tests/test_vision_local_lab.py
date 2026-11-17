"""Offline integration for Vision Check D: lab. All archives are synthetic."""
import importlib.util
import io
import json
from pathlib import Path
import sqlite3
import sys
import tempfile
import unittest
import zipfile

path = Path(__file__).resolve().parents[1] / "tools" / "vision_local_lab.py"
spec = importlib.util.spec_from_file_location("vision_local_lab", path)
lab = importlib.util.module_from_spec(spec)
spec.loader.exec_module(lab)
svg = (b'<svg xmlns="http://www.w3.org/2000/svg" width="100mm" height="80mm"'
       b' viewBox="0 0 100 80"><path d="M0 0 H10 V1 H0 Z"/></svg>')


def archive_data(files=None, extra=None, compression=zipfile.ZIP_STORED):
    import hashlib
    if files is None:
        files = [("samples/0001.svg", svg, "confirmed_defect")]
    samples = []
    out = io.BytesIO()
    with zipfile.ZipFile(out, "w", compression=compression) as z:
        for idx, (name, content, label) in enumerate(files, 1):
            z.writestr(name, content)
            metadata = {
                "sample_name": name, "anonymous_row_index": idx,
                "expert_label": label, "bytes": len(content),
                "sha256": hashlib.sha256(content).hexdigest(),
            }
            if "/" in name[len("samples/"):]:
                metadata["original_filename"] = Path(name).name
            samples.append(metadata)
        manifest = {
            "schema": lab.SCHEMA, "training_ready": False,
            "public_upload_permitted": False,
            "roi_annotations_verified": False,
            "held_out_families_verified": False,
            "samples": samples
        }
        if extra:
            manifest.update(extra)
        z.writestr("manifest.json", json.dumps(manifest))
    return out.getvalue()


class VisionLabTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name) / "VisionCheckLab"
        lab.init(self.root)

    def tearDown(self):
        self.tmp.cleanup()

    def write_archive(self, content):
        path = Path(self.tmp.name) / "test-samples.zip"
        path.write_bytes(content)
        return path

    def test_import_real_svg_bytes_are_private_hashed_and_not_auto_approved(self):
        src = self.write_archive(archive_data())
        result = lab.import_zip(self.root, src)
        self.assertEqual(result["source_files"], 1)
        self.assertFalse(result["training_ready"])
        status = lab.report(self.root)
        self.assertEqual(status["samples"], 1)
        self.assertEqual(status["with_expert_roi"], 0)
        self.assertEqual(status["auto_approved_training_samples"], 0)
        self.assertEqual(status["formats"][0]["extension"], "svg")
        with lab.open_db(self.root) as db:
            row = db.execute("""SELECT id,relative_path,source_sha256,approved_for_training
                 FROM samples""").fetchone()
        self.assertEqual((self.root / row[1]).read_bytes(), svg)
        self.assertEqual(len(row[2]), 64)
        self.assertEqual(row[3], 0)
        self.assertFalse((self.root / "config.json").read_text(encoding="utf-8")
                         .find('"automatic_training_enabled": false') == -1)

    def test_original_filenames_survive_import_even_with_duplicate_basenames(self):
        same = "Клиентский  оригинал.PDF"
        pdf = b"%PDF-1.7\\n" + b"A" * 100
        filenames = [f"samples/0001/{same}", f"samples/0002/{same}"]
        archive = archive_data([(name, pdf, "expert_clear") for name in filenames])
        result = lab.import_zip(self.root, self.write_archive(archive))
        self.assertEqual(result["source_files"], 2)
        with lab.open_db(self.root) as db:
            rows = db.execute("SELECT relative_path FROM samples ORDER BY id").fetchall()
        self.assertEqual(len(rows), 2)
        self.assertNotEqual(rows[0][0], rows[1][0])
        for (rel,) in rows:
            self.assertEqual(Path(rel).name, same)
            self.assertEqual((self.root / rel).read_bytes(), pdf)
        # No private original filenames in aggregate report.
        self.assertNotIn(same, json.dumps(lab.report(self.root), ensure_ascii=False))

    def test_original_filename_directory_escape_and_invalid_name_are_rejected(self):
        for member in ["samples/0001/../outside.pdf",
                       "samples/0001/CON.pdf", "samples/0001/bad:name.pdf",
                       "samples/0001/notes.pdf "]:
            with self.subTest(member=member):
                payload = archive_data([(member, b"%PDF-1.4\\n" + b"x"*64,
                                         "expert_clear")])
                with self.assertRaises(ValueError):
                    lab.import_zip(self.root, self.write_archive(payload))
        self.assertEqual(lab.report(self.root)["samples"], 0)

    def test_pdf_is_not_automatically_deemed_suitable_for_vector_training(self):
        pdf = b"%PDF-1.7\n" + b"A" * 100
        result = lab.import_zip(self.root, self.write_archive(archive_data(
            [("samples/0001.pdf", pdf, "expert_clear")]
        )))
        self.assertFalse(result["eligible_for_supervised_training"])
        self.assertEqual(lab.report(self.root)["formats"][0]["status"],
                         "PDF_VECTOR_VALIDATION_REQUIRED")

    def test_zip_path_traversal_and_wrong_training_claim_are_rejected(self):
        with self.assertRaises(ValueError):
            lab.import_zip(self.root, self.write_archive(archive_data(
                [("../private.svg", svg, "confirmed_defect")]
            )))
        with self.assertRaises(ValueError):
            lab.import_zip(self.root, self.write_archive(archive_data(
                extra={"training_ready": True}
            )))
        self.assertEqual(lab.report(self.root)["samples"], 0)

    def test_zip_hash_tamper_and_unsafe_svg_are_rejected(self):
        meta = {"schema": lab.SCHEMA, "training_ready": False,
                "public_upload_permitted": False,
                "samples": [{"sample_name": "samples/0001.svg",
                             "expert_label": "confirmed_defect",
                             "bytes": len(svg), "sha256": "0" * 64}]}
        stream = io.BytesIO()
        with zipfile.ZipFile(stream, "w") as z:
            z.writestr("samples/0001.svg", svg)
            z.writestr("manifest.json", json.dumps(meta))
        with self.assertRaises(ValueError):
            lab.import_zip(self.root, self.write_archive(stream.getvalue()))
        dangerous = b'<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///private.txt">]>' + svg
        with self.assertRaises(ValueError):
            lab.import_zip(self.root, self.write_archive(archive_data([
                ("samples/0001.svg", dangerous, "confirmed_defect")
            ])))
        self.assertEqual(lab.report(self.root)["samples"], 0)

    def test_explicit_roi_annotation_remains_research_only(self):
        lab.import_zip(self.root, self.write_archive(archive_data()))
        with lab.open_db(self.root) as db:
            sample_id = db.execute("SELECT id FROM samples").fetchone()[0]

        class Params:
            pass
        p = Params()
        p.sample_id, p.expert = sample_id, "tech_01"
        p.kind, p.label, p.units = "thin_line", "confirmed_defect", "svg_document_mm"
        p.x, p.y, p.width, p.height = 2.0, 3.0, 0.12, 1.0
        p.technology = "screen_print"
        lab.annotate(self.root, p)
        stat = lab.report(self.root)
        self.assertEqual(stat["with_expert_roi"], 1)
        self.assertEqual(stat["auto_approved_training_samples"], 0)
        self.assertFalse(stat["family_holdout_verified"])


if __name__ == "__main__":
    unittest.main()
