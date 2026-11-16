"""Only fabricated region labels and digests; no user files in CI."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

SCRIPT=Path(__file__).resolve().parents[1]/"vision"/"dataset"/"evaluate.py"
spec=importlib.util.spec_from_file_location("pc_vision_eval",SCRIPT)
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
h=lambda n:format(n,'064x')

def row(n, label='defect', prediction='candidate', split='test',
        family=None,artwork=None, tech='UV1'):
    return {
        'artwork_sha256':h(artwork if artwork is not None else n+1000),
        'family_sha256':h(family if family is not None else n+5000),
        'region_sha256':h(n),
        'split':split,'technology_code':tech,
        'expert':{
            'state':'verified','label':label,
            'annotation_sha256':h(n+9000),'reviewer_ref_sha256':h(99999)
        },
        'detection':{'state':prediction,'revision':'C3B.3.D-normal-probe-v1'}
    }

def doc(*rows):
    return {'schema':'printcheck.vision.expert-regions.v1','regions':list(rows)}

class EvaluationTest(unittest.TestCase):
    def test_metrics_count_false_positives_and_abstentions_separately(self):
        d=doc(
            row(1),row(2,label='acceptable'),
            row(3,label='acceptable',prediction='none'),
            row(4,label='defect',prediction='none'),
            row(5,label='defect',prediction='manual')
        )
        r=mod.evaluate_document(d,min_technology_samples=5)
        m=r['overall']
        self.assertEqual(m['expert_regions'],5)
        self.assertEqual(m['resolved_regions'],4)
        self.assertEqual(m['manual_abstentions'],1)
        self.assertEqual(m['candidate_true_positive'],1)
        self.assertEqual(m['candidate_false_positive'],1)
        self.assertEqual(m['candidate_true_negative'],1)
        self.assertEqual(m['candidate_false_negative'],1)
        self.assertAlmostEqual(m['candidate_precision'],0.5)
        self.assertAlmostEqual(m['candidate_recall_among_resolved'],0.5)
        self.assertAlmostEqual(m['coverage'],0.8)
        self.assertEqual(r['quality_verdict'],'NOT_PRODUCTION_APPROVED')
        self.assertIn('UV1',r['by_technology'])

    def test_train_regions_are_not_counted_in_test_metrics(self):
        r=mod.evaluate_document(doc(
            row(1,split='train'),row(2,split='validation'),
            row(3,split='test')
        ))
        self.assertEqual(r['overall']['expert_regions'],1)
        self.assertEqual(r['suppressed_technologies'],1)

    def test_family_leakage_between_train_and_test_is_rejected(self):
        with self.assertRaisesRegex(mod.InvalidEvaluation,'DATA_LEAKAGE_FAMILY_SPLIT'):
            mod.evaluate_document(doc(row(1,split='train',family=42),
                                      row(2,split='test',family=42)))

    def test_duplicate_artwork_leakage_between_splits_is_rejected(self):
        with self.assertRaisesRegex(mod.InvalidEvaluation,'DATA_LEAKAGE_ARTWORK_SPLIT'):
            mod.evaluate_document(doc(row(1,split='train',artwork=42),
                                      row(2,split='test',artwork=42)))

    def test_duplicate_regions_are_rejected_and_not_double_counted(self):
        with self.assertRaisesRegex(mod.InvalidEvaluation,'DUPLICATE_REGION'):
            mod.evaluate_document(doc(row(1),row(1)))

    def test_legacy_machine_verdict_is_not_expert_verified(self):
        d=doc(row(1))
        d['regions'][0]['expert']['state']='legacy_auto_diagnostic'
        with self.assertRaisesRegex(mod.InvalidEvaluation,'EXPERT_VERIFICATION_REQUIRED'):
            mod.evaluate_document(d)

    def test_missing_annotation_provenance_prevents_fake_ground_truth(self):
        d=doc(row(1))
        d['regions'][0]['expert']['annotation_sha256']='unknown'
        with self.assertRaisesRegex(mod.InvalidEvaluation,'EXPERT_ANNOTATION_PROVENANCE_REQUIRED'):
            mod.evaluate_document(d)

    def test_small_technology_groups_suppressed_without_identity_leaks(self):
        d=doc(row(1,tech='UV1'),row(2,tech='T1'),row(3,tech='DTF1'))
        r=mod.evaluate_document(d)
        self.assertEqual(r['by_technology'],{})
        self.assertEqual(r['suppressed_technologies'],3)
        data=json.dumps(r)
        for private in [h(1),h(1001),h(5001),'ORDER-ID','REVIEWER-EMAIL']:
            self.assertNotIn(private,data)
        self.assertFalse(r['privacy']['artwork_hashes_emitted'])

    def test_no_false_precision_when_no_predictions_exist(self):
        r=mod.evaluate_document(doc(row(1,prediction='manual')))
        self.assertIsNone(r['overall']['candidate_precision'])
        self.assertIsNone(r['overall']['candidate_recall_among_resolved'])
        self.assertEqual(r['overall']['coverage'],0)

    def test_unrecognized_schema_and_malformed_prediction_rejected(self):
        d=doc(row(1))
        d['schema']='invalid'
        with self.assertRaisesRegex(mod.InvalidEvaluation,'SCHEMA_UNSUPPORTED'):
            mod.evaluate_document(d)
        d=doc(row(1))
        d['regions'][0]['detection']['state']='production_approved'
        with self.assertRaisesRegex(mod.InvalidEvaluation,'DETECTION_STATE_INVALID'):
            mod.evaluate_document(d)

    def test_cli_refuses_overwrite_and_never_leaks_private_file_paths(self):
        with tempfile.TemporaryDirectory() as dirname:
            folder=Path(dirname)
            secret=folder/'secret-customer-ORDER-1234567.json'
            output=folder/'report.json'
            secret.write_text(json.dumps(doc(row(1))),encoding='utf-8')
            self.assertEqual(mod.main([str(secret),'--output',str(output)]),0)
            self.assertTrue(output.exists())
            self.assertEqual(mod.main([str(secret),'--output',str(output)]),2)
            self.assertEqual(json.loads(output.read_text())['overall']['expert_regions'],1)

if __name__=='__main__':
    unittest.main()
