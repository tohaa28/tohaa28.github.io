"""Synthetic-only tests for bounded child supervision (no 512 MB allocation)."""
from pathlib import Path
import sys
import unittest
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
from vision_resource_runner import supervise, peak_rss_from_status


@unittest.skipUnless(sys.platform == "linux", "Linux procfs watchdog")
class ResourceRunnerTests(unittest.TestCase):
    def test_three_synthetic_small_children(self):
        for attempt in range(3):
            with self.subTest(attempt=attempt):
                code, peak = supervise(
                    [sys.executable, "-c", "import time; x=bytearray(2000000); time.sleep(.08)"],
                    timeout_s=3, rss_limit_bytes=128 * 1024 * 1024)
                self.assertEqual(code, 0)
                self.assertGreater(peak, 0)

    def test_kernel_high_water_survives_transient_rss_drop(self):
        for attempt in range(3):
            with self.subTest(attempt=attempt):
                status = "Name:\tpython\nVmHWM:\t8192 kB\nVmRSS:\t1024 kB\n"
                self.assertEqual(peak_rss_from_status(status), 8192 * 1024)

    def test_missing_or_invalid_high_water_fails_closed(self):
        for status in (
            "VmRSS: 1024 kB\n",
            "VmRSS: 1024 kB\nVmHWM: invalid kB\n",
            "VmRSS: 1024 kB\nVmHWM: 8192 MB\n",
        ):
            with self.subTest(status=status):
                with self.assertRaisesRegex(RuntimeError, "RSS_UNAVAILABLE"):
                    peak_rss_from_status(status)

    def test_duplicate_kernel_metrics_fail_closed_three_passes(self):
        for attempt in range(3):
            for duplicate in ("VmRSS: 2 kB", "VmHWM: 2 kB"):
                with self.subTest(attempt=attempt, duplicate=duplicate):
                    status = "VmRSS: 1024 kB\nVmHWM: 8192 kB\n" + duplicate + "\n"
                    with self.assertRaisesRegex(RuntimeError, "RSS_UNAVAILABLE"):
                        peak_rss_from_status(status)

    def test_timeout_fails_closed(self):
        with self.assertRaisesRegex(RuntimeError, "CHILD_TIMEOUT"):
            supervise([sys.executable, "-c", "import time; time.sleep(5)"],
                      timeout_s=.05, rss_limit_bytes=128 * 1024 * 1024)

    def test_rss_excess_fails_closed(self):
        with self.assertRaisesRegex(RuntimeError, "RSS_LIMIT_EXCEEDED"):
            supervise([sys.executable, "-c", "import time; x=bytearray(4000000); time.sleep(.3)"],
                      timeout_s=3, rss_limit_bytes=1024)

    def test_child_failure_fails_closed(self):
        with self.assertRaisesRegex(RuntimeError, "CHILD_TEST_FAILED"):
            supervise([sys.executable, "-c", "raise SystemExit(3)"],
                      timeout_s=3, rss_limit_bytes=128 * 1024 * 1024)


if __name__ == "__main__":
    unittest.main()
