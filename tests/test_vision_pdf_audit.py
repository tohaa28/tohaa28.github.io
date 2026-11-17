"""Synthetic PDF vector audit: no real customer files, no dependency on PyMuPDF."""
from pathlib import Path
import hashlib
import io
import json
import sys
import tempfile
import unittest
import zipfile

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
import vision_local_lab as lab
import vision_pdf_audit as pdf


class Rect:
    def __init__(self, x0, y0, x1, y1):
        self.x0, self.y0, self.x1, self.y1 = x0, y0, x1, y1


class Page:
    rect = Rect(0, 0, 288, 144)

    def get_drawings(self):
        return [
            {"type": "s", "width": .2, "rect": Rect(1, 2, 30, 40),
             "items": [("c", 1, 2, 3, 4)]},
            {"type": "f", "width": None, "rect": Rect(0, 0, 80, 90),
             "items": [("re", Rect(0, 0, 80, 90))]},
            {"type": "s", "width": 0, "rect": Rect(2, 3, 6, 10),
             "items": []}
        ]

    def get_images(self, full=False):
        assert full
        return [(1, "image-secret")]

    def get_text(self, _format):
        return {"blocks": [{"type": 0, "text": "SECRET CLIENT NAME"},
                           {"type": 1, "image": b"private"}]}


class Document:
    needs_pass = False

    def __len__(self):
        return 1

    def __iter__(self):
        return iter([Page()])

    def close(self):
        pass


class Engine:
    def open(self, _):
        return Document()


class PDFAuditTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name) / "lab"
        lab.init(self.root)
        self.pdf = b"%PDF-1.7\n" + b"A" * 128
        mem = io.BytesIO()
        with zipfile.ZipFile(mem, "w") as zip_:
            zip_.writestr("samples/0001.pdf", self.pdf)
            zip_.writestr("manifest.json", json.dumps({
                "schema": lab.SCHEMA,
                "training_ready": False, "public_upload_permitted": False,
                "samples": [{
                    "sample_name": "samples/0001.pdf",
                    "bytes": len(self.pdf), "expert_label": "unreviewed",
                    "sha256": hashlib.sha256(self.pdf).hexdigest()
                }]
            }))
        archive = Path(self.temp.name) / "source.zip"
        archive.write_bytes(mem.getvalue())
        lab.import_zip(self.root, archive)
        self.sample_id = lab.list_samples(self.root)[0]["sample_id"]

    def tearDown(self):
        self.temp.cleanup()

    def test_vector_path_evidence_is_coordinate_based_and_not_approval(self):
        out = pdf.audit_sample(self.root, self.sample_id, engine=Engine(),
                               exploratory_stroke_mm=.1)
        self.assertEqual(out["status"], "RESEARCH_ONLY")
        page = out["pages"][0]
        self.assertEqual(page["page_width_mm"], 101.6)
        self.assertEqual(page["page_height_mm"], 50.8)
        self.assertEqual(page["vector_path_count"], 3)
        self.assertEqual(page["filled_path_count"], 1)
        self.assertEqual(page["zero_width_hairline_count"], 1)
        self.assertEqual(page["bezier_command_count"], 1)
        self.assertEqual(page["image_reference_count"], 1)
        self.assertEqual(page["text_block_count"], 1)
        self.assertEqual(len(page["thin_stroke_candidates"]), 1)
        self.assertEqual(page["thin_stroke_candidates"][0]["bbox_page_pt"],
                         [1., 2., 30., 40.])
        self.assertFalse(out["production_approved"])
        self.assertFalse(out["training_ready"])
        self.assertFalse(out["min_gap_verified"])
        self.assertFalse(out["spot_and_icc_verified"])
        serialized = json.dumps(out)
        self.assertNotIn("SECRET CLIENT NAME", serialized)
        self.assertNotIn("image-secret", serialized)
        self.assertNotIn(str(self.root), serialized)

    def test_thin_candidate_truncation_counts_only_valid_thin_boxes(self):
        class ManyPage(Page):
            def __init__(self, count, width):
                self.count, self.width = count, width

            def get_drawings(self):
                return [{"type": "s", "width": self.width,
                         "rect": Rect(0, 0, 5, 5), "items": []}
                        for _ in range(self.count)]

        class ManyEngine:
            def __init__(self, count, width):
                self.page = ManyPage(count, width)

            def open(self, _):
                page = self.page

                class OnePageDocument(Document):
                    def __iter__(self):
                        return iter([page])
                return OnePageDocument()

        source = self.root / lab.list_samples(self.root)[0]["path"]
        for count, width, expected_count, truncated in (
            (81, 2.0, 0, False),
            (80, .2, 80, False),
            (81, .2, 80, True),
        ):
            with self.subTest(count=count, width=width):
                out = pdf.audit_document(source, engine=ManyEngine(count, width))
                self.assertEqual(out["status"], "RESEARCH_ONLY")
                page = out["pages"][0]
                self.assertEqual(len(page["thin_stroke_candidates"]), expected_count)
                self.assertEqual(page["thin_stroke_candidates_truncated"], truncated)
                self.assertFalse(out["training_ready"])
                self.assertFalse(out["production_approved"])

    def test_pdf_rect_rejects_boolean_string_and_nonfinite_coordinates(self):
        for bad in (True, False, "1", None, float("nan"), float("inf")):
            for index in range(4):
                values = [0, 0, 10, 10]
                values[index] = bad
                with self.subTest(bad=repr(bad), index=index):
                    self.assertIsNone(pdf.rect_points(Rect(*values)))
        self.assertEqual(pdf.rect_points(Rect(0, 0, 10, 10)), [0, 0, 10, 10])

    def test_invalid_pdf_page_box_fails_closed(self):
        class BadPage(Page):
            rect = Rect(False, 0, 288, 144)

        class BadEngine:
            def open(self, _):
                class BadDocument(Document):
                    def __iter__(self):
                        return iter([BadPage()])
                return BadDocument()

        source = self.root / lab.list_samples(self.root)[0]["path"]
        out = pdf.audit_document(source, engine=BadEngine())
        self.assertEqual(out["status"], "MANUAL")
        self.assertEqual(out["reason"], "PDF_PAGE_BOX_INVALID")
        self.assertFalse(out["production_approved"])
        self.assertFalse(out["training_ready"])

    def test_unsupported_pdf_path_structures_fail_closed(self):
        class BadPage(Page):
            def __init__(self, drawing):
                self.drawing = drawing
            def get_drawings(self):
                return [self.drawing]
        class BadEngine:
            def __init__(self, drawing):
                self.drawing = drawing
            def open(self, _):
                drawing = self.drawing
                class BadDocument(Document):
                    def __iter__(self):
                        return iter([BadPage(drawing)])
                return BadDocument()
        source = self.root / lab.list_samples(self.root)[0]['path']
        for kind in ('unknown', '', None, True, ['s']):
            with self.subTest(kind=repr(kind)):
                drawing = {'type': kind, 'width': .2, 'rect': Rect(0, 0, 5, 5), 'items': []}
                result = pdf.audit_document(source, engine=BadEngine(drawing))
                self.assertEqual(result['status'], 'MANUAL')
                self.assertEqual(result['reason'], 'PDF_PATH_TYPE_UNSUPPORTED')
                self.assertFalse(result['training_ready'])
                self.assertFalse(result['production_approved'])
        for items in (None, 'PRIVATE', {}, [None], [()], [[True]], [42]):
            with self.subTest(items=repr(items)):
                drawing = {'type': 's', 'width': .2, 'rect': Rect(0, 0, 5, 5), 'items': items}
                result = pdf.audit_document(source, engine=BadEngine(drawing))
                self.assertEqual(result['status'], 'MANUAL')
                self.assertEqual(result['reason'], 'PDF_PATH_ITEMS_UNSUPPORTED')
                self.assertFalse(result['production_approved'])
                self.assertNotIn('PRIVATE', json.dumps(result))

    def test_narrow_filled_bounding_box_is_only_a_research_candidate(self):
        class FilledPage(Page):
            def get_drawings(self):
                return [
                    {"type": "f", "width": None, "rect": Rect(1, 2, 1.2, 100),
                     "items": [("c", "private path")], "secret": "CUSTOMER TEXT"},
                    {"type": "fs", "width": .4, "rect": Rect(0, 0, 50, 60),
                     "items": []},
                    {"type": "f", "width": None, "rect": Rect(False, 0, 2, 3),
                     "items": []}
                ]

        class FilledEngine:
            def open(self, _):
                class FilledDocument(Document):
                    def __iter__(self):
                        return iter([FilledPage()])
                return FilledDocument()

        src = self.root / lab.list_samples(self.root)[0]["path"]
        out = pdf.audit_document(src, engine=FilledEngine(),
                                 exploratory_fill_bbox_mm=.15)
        self.assertEqual(out["status"], "RESEARCH_ONLY")
        page = out["pages"][0]
        self.assertEqual(page["filled_path_count"], 3)
        self.assertEqual(len(page["narrow_filled_bbox_candidates"]), 1)
        feature = page["narrow_filled_bbox_candidates"][0]
        self.assertEqual(feature["bbox_page_pt"], [1, 2, 1.2, 100])
        self.assertEqual(feature["candidate_kind"], "narrow_filled_bbox")
        self.assertFalse(feature["actual_ink_feature_width_verified"])
        self.assertFalse(out["narrow_filled_bbox_is_actual_ink_feature_width"])
        self.assertFalse(out["clipping_and_paint_order_verified"])
        self.assertFalse(out["production_approved"])
        self.assertFalse(out["training_ready"])
        self.assertNotIn("CUSTOMER TEXT", json.dumps(out))

    def test_filled_candidate_limit_and_invalid_threshold_fail_closed(self):
        class ManyPage(Page):
            def get_drawings(self):
                return [{"type": "f", "rect": Rect(0, 0, .15, 200),
                         "items": [], "width": None}
                        for _ in range(81)]

        class ManyEngine:
            def open(self, _):
                class ManyDocument(Document):
                    def __iter__(self):
                        return iter([ManyPage()])
                return ManyDocument()

        src = self.root / lab.list_samples(self.root)[0]["path"]
        result = pdf.audit_document(src, engine=ManyEngine())
        self.assertEqual(len(result["pages"][0]["narrow_filled_bbox_candidates"]), 80)
        self.assertTrue(result["pages"][0]["narrow_filled_bbox_candidates_truncated"])
        for invalid in (0, -1, True, float("nan"), float("inf"), 5):
            with self.subTest(invalid=repr(invalid)):
                out = pdf.audit_document(src, engine=ManyEngine(),
                                         exploratory_fill_bbox_mm=invalid)
                self.assertEqual(out["reason"], "FILLED_BBOX_THRESHOLD_INVALID")
                self.assertFalse(out["production_approved"])

    def test_unbounded_sequential_pdf_batch_writes_private_atomic_reports(self):
        for part, n in enumerate((16, 3), 1):
            buffer = io.BytesIO()
            with zipfile.ZipFile(buffer, "w") as archive:
                samples = []
                for i in range(n):
                    name = "samples/" + str(i+1).zfill(4) + ".pdf"
                    payload = self.pdf + bytes([part, i])
                    archive.writestr(name, payload)
                    samples.append({
                        "sample_name": name, "expert_label": "unreviewed",
                        "bytes": len(payload),
                        "sha256": hashlib.sha256(payload).hexdigest()
                    })
                archive.writestr("manifest.json", json.dumps({
                    "schema": lab.SCHEMA, "training_ready": False,
                    "public_upload_permitted": False, "samples": samples
                }))
            source = Path(self.temp.name) / ("part" + str(part) + ".zip")
            source.write_bytes(buffer.getvalue())
            lab.import_zip(self.root, source)
        progress = []
        result = pdf.audit_all_samples(self.root, engine=Engine(),
                 on_progress=lambda i, total, status: progress.append((i,total,status)))
        self.assertEqual(result["total_pdf_samples"], 20)
        self.assertEqual(result["processed"], 20)
        self.assertEqual(result["status_counts"]["RESEARCH_ONLY"], 20)
        self.assertEqual(len(progress), 20)
        self.assertEqual(progress[-1], (20,20,"RESEARCH_ONLY"))
        self.assertFalse(result["remote_uploads"])
        self.assertFalse(result["training_ready"])
        location = self.root / "reports" / "pdf-audits"
        outputs = sorted(location.glob("*.json"))
        self.assertEqual(len(outputs), 20)
        self.assertFalse(list(location.glob("*.tmp")))
        for output in outputs:
            self.assertEqual(len(output.stem), 64)
            sample = json.loads(output.read_text(encoding="utf8"))
            self.assertEqual(sample["status"], "RESEARCH_ONLY")
            self.assertFalse(sample["production_approved"])
            self.assertEqual(len(sample["source_sha256"]), 64)
            self.assertNotIn(str(self.root), output.read_text(encoding="utf8"))
        again = pdf.audit_all_samples(self.root, engine=Engine())
        self.assertEqual(again["processed"], 20)
        self.assertEqual(len(list(location.glob("*.json"))), 20)

    def test_batch_cannot_treat_modified_original_as_valid_pdf(self):
        source = self.root / lab.list_samples(self.root)[0]["path"]
        source.write_bytes(self.pdf + b"tampered")
        result = pdf.audit_all_samples(self.root,engine=Engine())
        self.assertEqual(result["processed"], 1)
        self.assertEqual(result["status_counts"]["SOURCE_SHA256_MISMATCH"], 1)
        self.assertFalse(result["production_approved"])
        report = next((self.root / "reports" / "pdf-audits").glob("*.json"))
        self.assertEqual(json.loads(report.read_text(encoding="utf8"))["status"], "MANUAL")

    def test_missing_and_tampered_source_fail_closed(self):
        self.assertEqual(pdf.audit_sample(self.root, "invalid", engine=Engine())["reason"],
                         "SAMPLE_ID_INVALID")
        info = lab.list_samples(self.root)[0]
        path = self.root / info["path"]
        path.write_bytes(self.pdf + b"CHANGED")
        self.assertEqual(pdf.audit_sample(self.root, self.sample_id, engine=Engine())["reason"],
                         "SOURCE_SHA256_MISMATCH")

    def test_wrong_threshold_and_backend_failure_never_accept_pdf(self):
        f = self.root / lab.list_samples(self.root)[0]["path"]
        self.assertEqual(pdf.audit_document(f, engine=Engine(),
                exploratory_stroke_mm=-1)["status"], "MANUAL")
        class Fail:
            def open(self, _):
                raise RuntimeError("Private path should not appear in report")
        result = pdf.audit_document(f, engine=Fail())
        self.assertEqual(result["reason"], "PDF_PARSE_OR_BACKEND_FAILURE")
        self.assertNotIn("Private path", str(result))


if __name__ == "__main__":
    unittest.main()
