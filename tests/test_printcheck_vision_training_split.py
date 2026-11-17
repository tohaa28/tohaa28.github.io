"""Synthetic-only checks for fail-closed Vision AI split manifest contract."""
import copy
import unittest
from vision.ai.training_split_gate import audit_split_manifest


def record(n, split):
    return {"split": split, "source_family": f"{n:064x}",
            "source_sha256": f"{n+100:064x}",
            "roi_sha256": f"{n+200:064x}",
            "region_role": "ink", "expert_consensus": True,
            "physical_scale_verified": True, "color_profile_verified": True}


class SplitGateTests(unittest.TestCase):
    def setUp(self):
        self.rows = [record(1, "train"), record(2, "validation"),
                     record(3, "test")]

    def test_clean_synthetic_attestations_are_still_not_approved(self):
        out = audit_split_manifest(self.rows)
        self.assertEqual(out["status"], "RESEARCH_SPLIT_STRUCTURE_ONLY")
        self.assertEqual(out["counts"], {"train": 1, "validation": 1, "test": 1})
        self.assertFalse(out["production_approved"])
        self.assertFalse(out["auto_deploy_allowed"])
        self.assertFalse(out["real_world_accuracy_verified"])

    def test_rejects_cross_split_family_source_and_roi_leakage(self):
        for key, reason in (("source_family", "FAMILY_LEAKAGE"),
                            ("source_sha256", "SOURCE_LEAKAGE"),
                            ("roi_sha256", "ROI_LEAKAGE")):
            with self.subTest(key=key):
                rows = copy.deepcopy(self.rows)
                rows[2][key] = rows[0][key]
                self.assertEqual(audit_split_manifest(rows)["reason"], reason)

    def test_rejects_missing_expert_scale_color_and_invalid_provenance(self):
        for key, value, reason in (
            ("expert_consensus", False, "EXPERT_CONSENSUS_REQUIRED"),
            ("physical_scale_verified", False, "PHYSICAL_SCALE_UNVERIFIED"),
            ("color_profile_verified", None, "COLOR_PROFILE_UNVERIFIED"),
            ("source_family", "order-123", "UNVERIFIED_FAMILY_PROVENANCE"),
            ("source_sha256", "xyz", "UNVERIFIED_SOURCE_HASH"),
            ("roi_sha256", "", "UNVERIFIED_ROI_HASH"),
            ("region_role", "unknown", "UNVERIFIED_REGION_ROLE"),
            ("split", "production", "INVALID_SPLIT")
        ):
            with self.subTest(key=key):
                rows = copy.deepcopy(self.rows)
                rows[0][key] = value
                out = audit_split_manifest(rows)
                self.assertEqual(out["status"], "MANUAL")
                self.assertEqual(out["reason"], reason)
                self.assertNotIn("order-123", str(out))

    def test_rejects_empty_split_and_invalid_manifest(self):
        self.assertEqual(audit_split_manifest(self.rows[:2])["reason"], "SPLIT_EMPTY")
        for data in ([], {}, None, [None]):
            self.assertEqual(audit_split_manifest(data)["status"], "MANUAL")

    def test_malformed_container_values_fail_closed_without_exception(self):
        for key, value, reason in (
            ("split", [], "INVALID_SPLIT"),
            ("split", {}, "INVALID_SPLIT"),
            ("region_role", [], "UNVERIFIED_REGION_ROLE"),
            ("region_role", {}, "UNVERIFIED_REGION_ROLE"),
        ):
            with self.subTest(key=key, value=value):
                rows = copy.deepcopy(self.rows)
                rows[0][key] = value
                out = audit_split_manifest(rows)
                self.assertEqual(out["status"], "MANUAL")
                self.assertEqual(out["reason"], reason)
                self.assertFalse(out["production_approved"])
                self.assertFalse(out["auto_deploy_allowed"])

    def test_same_roi_conflicting_roles_fail_closed(self):
        rows = copy.deepcopy(self.rows)
        duplicate = copy.deepcopy(rows[0])
        duplicate["region_role"] = "gap"
        rows.insert(1, duplicate)
        out = audit_split_manifest(rows)
        self.assertEqual(out["status"], "MANUAL")
        self.assertEqual(out["reason"], "ROI_ROLE_CONFLICT")
        self.assertFalse(out["production_approved"])
        self.assertFalse(out["auto_deploy_allowed"])

    def test_same_roi_same_role_remains_research_only(self):
        rows = copy.deepcopy(self.rows)
        rows.insert(1, copy.deepcopy(rows[0]))
        out = audit_split_manifest(rows)
        self.assertEqual(out["status"], "RESEARCH_SPLIT_STRUCTURE_ONLY")
        self.assertFalse(out["production_approved"])
        self.assertFalse(out["auto_deploy_allowed"])

    def test_counts_are_aggregate_only(self):
        rows = copy.deepcopy(self.rows)
        rows[0]["private_customer_name"] = "SECRET-DO-NOT-EXPORT"
        output = audit_split_manifest(rows)
        self.assertNotIn("SECRET-DO-NOT-EXPORT", str(output))


if __name__ == "__main__":
    unittest.main()
